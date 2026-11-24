import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { authenticationError } from '../admin-auth.js'
import { DEFAULT_CONTENT, DEFAULT_THEME, GOAL, INITIAL_TOTAL, validMilestones } from '../src/fundraising.js'

const paths = { content: 'settings/content.json', theme: 'settings/theme.json', milestones: 'settings/milestones.json', milestonesEnabled: 'settings/milestones-enabled.json', total: 'settings/total.json', goal: 'settings/goal.json' }
const defaults = { content: DEFAULT_CONTENT, theme: DEFAULT_THEME, milestones: [], milestonesEnabled: false, total: INITIAL_TOTAL, goal: GOAL }

function validValue(key, value) {
  if (key === 'theme') return value === 'poster' || value === 'green'
  if (key === 'milestones') return validMilestones(value)
  if (key === 'milestonesEnabled') return typeof value === 'boolean'
  if (key === 'total') return Number.isSafeInteger(value) && value >= 0
  if (key === 'goal' || key === 'contribution') return Number.isSafeInteger(value) && value > 0
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(field => ['title', 'description', 'encouragement'].includes(field))
    && ['title', 'description'].every(field => typeof value[field] === 'string' && value[field].length <= 10000)
    && (!Object.hasOwn(value, 'encouragement') || (typeof value.encouragement === 'string' && value.encouragement.length <= 10000))
    && value.title.trim().length > 0
}

export function createBlobStorage(getBlob = get, putBlob = put) {
  return {
    async read(key) {
      const result = await getBlob(paths[key], { access: 'private', useCache: false })
      if (result === null) return null
      if (result.statusCode !== 200 || !result.stream) throw new Error(`Could not read ${key}`)
      return JSON.parse(await new Response(result.stream).text())
    },
    async write(key, value) {
      await putBlob(paths[key], JSON.stringify(value), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
    },
    async updateTotal(update) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await getBlob(paths.total, { access: 'private', useCache: false })
        if (current && (current.statusCode !== 200 || !current.stream)) throw new Error('Could not read total')
        if (current && !current.blob.etag) throw new Error('Missing total version')
        const value = update(current ? JSON.parse(await new Response(current.stream).text()) : null)
        try {
          await putBlob(paths.total, JSON.stringify(value), {
            access: 'private', addRandomSuffix: false, contentType: 'application/json',
            ...(current ? { ifMatch: current.blob.etag } : { allowOverwrite: false }),
          })
          return value
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError)) throw error
        }
      }
      throw new Error('Could not update total due to concurrent changes')
    },
  }
}

const blobStorage = createBlobStorage()

export function createSettingsHandler(storage = blobStorage, authorize = authenticationError) {
  return async function handleSettings(request) {
    const headers = { 'Cache-Control': 'no-store' }
    if (request.method === 'GET') {
      try {
        if (new URL(request.url).searchParams.get('view') === 'milestones') {
          const [milestones, milestonesEnabled] = await Promise.all([storage.read('milestones'), storage.read('milestonesEnabled')])
          if ((milestones !== null && !validValue('milestones', milestones))
            || (milestonesEnabled !== null && !validValue('milestonesEnabled', milestonesEnabled))) {
            throw new Error('Invalid stored milestones settings')
          }
          return Response.json({
            milestones: milestones ?? defaults.milestones,
            milestonesEnabled: milestonesEnabled ?? defaults.milestonesEnabled,
          }, { headers })
        }
        const [content, theme, milestones, milestonesEnabled, total, goal] = await Promise.all([storage.read('content'), storage.read('theme'), storage.read('milestones'), storage.read('milestonesEnabled'), storage.read('total'), storage.read('goal')])
        for (const [key, value] of Object.entries({ content, theme, milestones, milestonesEnabled, total, goal })) {
          if (value !== null && !validValue(key, value)) throw new Error(`Invalid stored ${key}`)
        }
        return Response.json({
          content: { ...defaults.content, ...content },
          theme: theme ?? defaults.theme,
          milestones: milestones ?? defaults.milestones,
          milestonesEnabled: milestonesEnabled ?? defaults.milestonesEnabled,
          total: total ?? defaults.total,
          goal: goal ?? defaults.goal,
          initialized: { content: content !== null, theme: theme !== null, milestones: milestones !== null, total: total !== null, goal: goal !== null },
        }, { headers })
      } catch (error) {
        console.error('Could not load campaign settings:', error)
        return Response.json({ error: 'Could not load campaign settings.' }, { status: 503, headers })
      }
    }

    if (request.method !== 'PUT') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { ...headers, Allow: 'GET, PUT' } })
    }

    const authError = authorize(request)
    if (authError) return authError
    if (request.headers.get('origin') !== new URL(request.url).origin
      || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      return Response.json({ error: 'Invalid request origin or content type.' }, { status: 403, headers })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers })
    }
    const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : []
    if (keys.length !== 1 || (!Object.hasOwn(paths, keys[0]) && keys[0] !== 'contribution') || !validValue(keys[0], body[keys[0]])) {
      return Response.json({ error: 'Invalid setting.' }, { status: 400, headers })
    }

    try {
      const key = keys[0]
      let value = body[key]
      if (key === 'total' || key === 'contribution') {
        value = await storage.updateTotal(current => {
          if (current !== null && !validValue('total', current)) throw new Error('Invalid stored total')
          const next = key === 'total' ? value : (current ?? defaults.total) + value
          if (!Number.isSafeInteger(next)) throw new RangeError('Total is too large')
          return next
        })
        return Response.json({ total: value }, { headers })
      }
      if (key === 'content' && !Object.hasOwn(value, 'encouragement')) {
        const previous = await storage.read('content')
        if (previous !== null && !validValue('content', previous)) throw new Error('Invalid stored content settings')
        value = { ...defaults.content, ...previous, ...value }
      }
      await storage.write(key, value)
      return Response.json({ [key]: value }, { headers })
    } catch (error) {
      if (error instanceof RangeError) return Response.json({ error: 'Total is too large.' }, { status: 400, headers })
      console.error('Could not save campaign setting:', error)
      return Response.json({ error: 'Could not save campaign setting.' }, { status: 503, headers })
    }
  }
}
