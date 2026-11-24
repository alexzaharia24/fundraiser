import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlobPreconditionFailedError } from '@vercel/blob'
import { createBlobStorage, createSettingsHandler } from './lib/settings.js'
import { DEFAULT_CONTENT, GOAL, INITIAL_TOTAL } from './src/fundraising.js'

test('blob total updates retry stale versions without losing another contribution', async () => {
  let total = 100
  let version = 'v1'
  let attempts = 0
  const storage = createBlobStorage(
    async () => ({ statusCode: 200, stream: new Response(JSON.stringify(total)).body, blob: { etag: version } }),
    async (path, body, options) => {
      assert.equal(path, 'settings/total.json')
      if (attempts++ === 0) {
        total = 120
        version = 'v2'
        throw new BlobPreconditionFailedError()
      }
      assert.equal(options.ifMatch, 'v2')
      total = JSON.parse(body)
    },
  )
  assert.equal(await storage.updateTotal(current => current + 10), 130)
  assert.equal(total, 130)
  assert.equal(attempts, 2)
})

test('blob total creation cannot overwrite a concurrently created value', async () => {
  const storage = createBlobStorage(
    async () => null,
    async (path, body, options) => {
      assert.equal(path, 'settings/total.json')
      assert.equal(JSON.parse(body), 200)
      assert.equal(options.allowOverwrite, false)
      throw new Error('Already exists')
    },
  )
  await assert.rejects(storage.updateTotal(() => 200), /Already exists/)
})

test('settings are public to read but only authenticated same-origin writes persist', async () => {
  const previous = process.env.ADMIN_PASSWORD
  process.env.ADMIN_PASSWORD = 'test-password'
  const data = {}
  const reads = []
  const handler = createSettingsHandler({
    async read(key) { reads.push(key); return data[key] ?? null },
    async write(key, value) { data[key] = value },
    async updateTotal(update) { data.total = update(data.total ?? null); return data.total },
  })
  const auth = `Basic ${Buffer.from('admin:test-password').toString('base64')}`
  const write = (value, headers = {}) => new Request('https://example.com/api/settings', {
    method: 'PUT',
    headers: { origin: 'https://example.com', 'content-type': 'application/json', authorization: auth, ...headers },
    body: JSON.stringify(value),
  })

  try {
    const initial = await handler(new Request('https://example.com/api/settings'))
    assert.deepEqual(await initial.json(), {
      content: DEFAULT_CONTENT,
      theme: 'poster',
      milestones: [],
      milestonesEnabled: false,
      total: INITIAL_TOTAL,
      goal: GOAL,
      initialized: { content: false, theme: false, milestones: false, total: false, goal: false },
    })
    assert.equal(initial.headers.get('cache-control'), 'no-store')
    reads.length = 0
    const milestoneResponse = await handler(new Request('https://example.com/api/settings?view=milestones'))
    assert.deepEqual(await milestoneResponse.json(), { milestones: [], milestonesEnabled: false })
    assert.deepEqual(reads.sort(), ['milestones', 'milestonesEnabled'])
    assert.equal(milestoneResponse.headers.get('cache-control'), 'no-store')
    assert.equal((await handler(write({ theme: 'green' }, { authorization: '' }))).status, 401)
    assert.equal((await handler(write({ theme: 'green' }, { origin: 'https://evil.example' }))).status, 403)
    assert.equal((await handler(write({ total: 0 }, { authorization: '' }))).status, 401)
    assert.equal((await handler(write({ total: -1 }))).status, 400)
    assert.equal((await handler(write({ total: 1.2 }))).status, 400)
    assert.equal((await handler(write({ contribution: 0 }))).status, 400)
    assert.equal((await handler(write({ goal: 0 }))).status, 400)
    assert.equal((await handler(write({ goal: Number.MAX_SAFE_INTEGER + 1 }))).status, 400)
    assert.equal((await handler(write({ theme: 'invalid' }))).status, 400)
    assert.equal((await handler(write({ theme: 'green', content: DEFAULT_CONTENT }))).status, 400)
    assert.equal((await handler(write({ content: { title: '', description: 'Text' } }))).status, 400)
    assert.equal((await handler(write({ content: { title: 'Title', description: '', encouragement: 'Text' } }, { authorization: '' }))).status, 401)
    assert.equal((await handler(write({ content: { title: 'Title', description: '', encouragement: null } }))).status, 400)
    assert.equal((await handler(write({ content: { title: 'Title', description: '', extra: 'Text' } }))).status, 400)
    assert.equal((await handler(write({ content: { title: 'Title', description: '', encouragement: 'x'.repeat(10001) } }))).status, 400)
    assert.equal((await handler(write({ milestones: [{ label: 'Etapa', amount: 0 }] }))).status, 400)
    assert.equal((await handler(write({ milestones: [{ label: 'A', amount: 100 }, { label: 'B', amount: 100 }] }))).status, 400)
    assert.equal((await handler(write({ milestones: [{ label: 'Etapa', amount: 100 }] }, { authorization: '' }))).status, 401)
    assert.equal((await handler(write({ milestonesEnabled: true }, { authorization: '' }))).status, 401)
    assert.equal((await handler(write({ milestonesEnabled: 'true' }))).status, 400)
    assert.deepEqual(data, {})
    data.content = { title: 'Existing title', description: 'Existing description' }
    assert.deepEqual((await (await handler(new Request('https://example.com/api/settings'))).json()).content, {
      ...data.content, encouragement: DEFAULT_CONTENT.encouragement,
    })
    delete data.content
    assert.equal((await handler(write({ total: 100000 }))).status, 200)
    assert.deepEqual(await (await handler(write({ contribution: 2500 }))).json(), { total: 102500 })
    assert.equal((await handler(write({ goal: 400000 }))).status, 200)
    assert.equal((await handler(write({ theme: 'green' }))).status, 200)
    assert.equal((await handler(write({ content: { title: 'Title', description: '' } }))).status, 200)
    assert.equal((await (await handler(new Request('https://example.com/api/settings'))).json()).content.description, '')
    assert.equal((await handler(write({ content: { title: 'Title', description: '', encouragement: 'Mulțumim!' } }))).status, 200)
    assert.equal((await handler(write({ content: { title: 'Title', description: 'Description' } }))).status, 200)
    assert.equal((await handler(write({ milestones: [{ label: 'Etapa', amount: 100000 }] }))).status, 200)
    assert.equal((await handler(write({ milestonesEnabled: true }))).status, 200)
    assert.deepEqual(await (await handler(new Request('https://example.com/api/settings'))).json(), {
      content: { title: 'Title', description: 'Description', encouragement: 'Mulțumim!' },
      theme: 'green',
      milestones: [{ label: 'Etapa', amount: 100000 }],
      milestonesEnabled: true,
      total: 102500,
      goal: 400000,
      initialized: { content: true, theme: true, milestones: true, total: true, goal: true },
    })
    assert.equal((await handler(write({ content: { title: 'Title', description: 'Description', encouragement: '' } }))).status, 200)
    assert.equal((await handler(write({ content: { title: 'Title', description: 'Updated' } }))).status, 200)
    assert.equal((await (await handler(new Request('https://example.com/api/settings'))).json()).content.encouragement, '')
    assert.equal((await handler(write({ milestonesEnabled: false }))).status, 200)
    const disabled = await (await handler(new Request('https://example.com/api/settings'))).json()
    assert.equal(disabled.milestonesEnabled, false)
    assert.deepEqual(disabled.milestones, [{ label: 'Etapa', amount: 100000 }])
    assert.deepEqual(await (await handler(new Request('https://example.com/api/settings?view=milestones'))).json(), {
      milestones: [{ label: 'Etapa', amount: 100000 }], milestonesEnabled: false,
    })
    assert.equal((await handler(write({ milestones: [] }))).status, 200)
    assert.deepEqual((await (await handler(new Request('https://example.com/api/settings'))).json()).milestones, [])
    assert.equal((await handler(write({ total: Number.MAX_SAFE_INTEGER }))).status, 200)
    assert.equal((await handler(write({ contribution: 1 }))).status, 400)
    assert.equal(data.total, Number.MAX_SAFE_INTEGER)
    delete process.env.ADMIN_PASSWORD
    assert.equal((await handler(write({ theme: 'poster' }))).status, 503)
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = previous
  }
})
