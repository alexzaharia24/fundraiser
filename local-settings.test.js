import assert from 'node:assert/strict'
import { mkdtemp, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createServer } from 'vite'
import { localSettings } from './lib/local-settings.js'

test('local settings persist across server restarts and reject cross-origin writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fundraiser-settings-'))
  let server
  async function start() {
    server = await createServer({
      configFile: false,
      plugins: [localSettings(directory)],
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'silent',
    })
    await server.listen()
    return `http://127.0.0.1:${server.httpServer.address().port}`
  }

  try {
    let origin = await start()
    const initial = await fetch(`${origin}/api/settings`)
    assert.equal(initial.headers.get('content-type'), 'application/json')
    assert.equal((await initial.json()).initialized.content, false)

    const content = { title: 'Un titlu local', description: 'O descriere locală', encouragement: 'Mulțumim!' }
    const write = (value, requestOrigin = origin) => fetch(`${origin}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
      body: JSON.stringify(value),
    })
    assert.equal((await write({ content }, 'https://other.example')).status, 403)
    assert.equal((await write({ content })).status, 200)
    assert.equal((await write({ theme: 'green' })).status, 200)
    assert.equal((await write({ milestones: [{ label: 'Etapă', amount: 100000 }] })).status, 200)
    assert.equal((await write({ milestonesEnabled: true })).status, 200)
    assert.equal((await write({ total: 100000 })).status, 200)
    assert.equal((await write({ goal: 500000 })).status, 200)
    const contributions = await Promise.all(Array.from({ length: 10 }, () => write({ contribution: 100 })))
    assert.ok(contributions.every(response => response.status === 200))
    const clients = await Promise.all([
      fetch(`${origin}/api/settings`).then(response => response.json()),
      fetch(`${origin}/api/settings`).then(response => response.json()),
    ])
    assert.deepEqual(clients[0], clients[1])
    assert.equal(clients[0].total, 101000)
    assert.equal(clients[0].goal, 500000)

    await server.close()
    origin = await start()
    const saved = await (await fetch(`${origin}/api/settings`)).json()
    assert.deepEqual(saved.content, content)
    assert.equal(saved.theme, 'green')
    assert.deepEqual(saved.milestones, [{ label: 'Etapă', amount: 100000 }])
    assert.equal(saved.milestonesEnabled, true)
    assert.equal(saved.total, 101000)
    assert.equal(saved.goal, 500000)
    assert.deepEqual(saved.initialized, { content: true, theme: true, milestones: true, total: true, goal: true })
  } finally {
    if (server) await server.close()
    await rm(join(directory, 'fundraiser-content.local'), { force: true })
    await rm(join(directory, 'fundraiser-theme.local'), { force: true })
    await rm(join(directory, 'fundraiser-milestones.local'), { force: true })
    await rm(join(directory, 'fundraiser-milestones-enabled.local'), { force: true })
    await rm(join(directory, 'fundraiser-total.local'), { force: true })
    await rm(join(directory, 'fundraiser-goal.local'), { force: true })
    await rmdir(directory)
  }
})
