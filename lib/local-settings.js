import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { createSettingsHandler } from './settings.js'

export function localSettings(directory) {
  return {
    name: 'local-settings',
    apply: 'serve',
    configureServer(server) {
      const root = directory ?? server.config.root
      const paths = {
        content: join(root, 'fundraiser-content.local'),
        theme: join(root, 'fundraiser-theme.local'),
        milestones: join(root, 'fundraiser-milestones.local'),
        milestonesEnabled: join(root, 'fundraiser-milestones-enabled.local'),
        total: join(root, 'fundraiser-total.local'),
        goal: join(root, 'fundraiser-goal.local'),
      }
      let totalOperation = Promise.resolve()
      const storage = {
        async read(key) {
          try {
            return JSON.parse(await readFile(paths[key], 'utf8'))
          } catch (error) {
            if (error.code === 'ENOENT') return null
            throw error
          }
        },
        async write(key, value) {
          const temporary = `${paths[key]}.${randomUUID()}.local`
          try {
            await writeFile(temporary, JSON.stringify(value), { flag: 'wx' })
            await rename(temporary, paths[key])
          } finally {
            await rm(temporary, { force: true })
          }
        },
        async updateTotal(update) {
          const operation = totalOperation.then(async () => {
            const value = update(await storage.read('total'))
            await storage.write('total', value)
            return value
          })
          totalOperation = operation.then(() => undefined, () => undefined)
          return operation
        },
      }
      const handle = createSettingsHandler(storage, () => null)

      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/api/settings' && path !== '/admin/settings') return next()

        const remote = req.socket.remoteAddress
        let url
        try {
          url = new URL(req.url, `${server.config.server.https ? 'https' : 'http'}://${req.headers.host}`)
        } catch {
          res.writeHead(400).end('Invalid request URL.')
          return
        }
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
          || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
          res.writeHead(403).end('Local settings are only available on this computer.')
          return
        }

        try {
          const options = { method: req.method, headers: req.headers }
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            options.body = Readable.toWeb(req)
            options.duplex = 'half'
          }
          const response = await handle(new Request(url, options))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          console.error('Local settings request failed:', error)
          if (!res.headersSent) res.writeHead(500)
          res.end('Local settings request failed.')
        }
      })
    },
  }
}
