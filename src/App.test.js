import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { CONTENT_STORAGE_KEY, GOAL_STORAGE_KEY, STORAGE_KEY, THEME_STORAGE_KEY } from './fundraising.js'

test('shows remaining amount until the goal is reached and caps the progress bar', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx')
    globalThis.window = { location: { pathname: '/' } }
    let total = 153200
    let goal = null
    let content = null
    let theme = null
    globalThis.localStorage = { getItem: key => key === STORAGE_KEY ? JSON.stringify(total) : key === GOAL_STORAGE_KEY ? goal : key === CONTENT_STORAGE_KEY ? content : key === THEME_STORAGE_KEY ? theme : null }

    const inProgress = renderToStaticMarkup(createElement(App))
    assert.match(inProgress, /Un vis, o minge,<em> o comunitate\.<\/em>/)
    assert.match(inProgress, /Mai sunt <strong>1\.468 RON<\/strong> până la obiectiv/)
    assert.match(inProgress, /aria-valuenow="51"/)

    goal = JSON.stringify(400000)
    const customGoal = renderToStaticMarkup(createElement(App))
    assert.match(customGoal, /4\.000 RON/)
    assert.match(customGoal, /Mai sunt <strong>2\.468 RON<\/strong>/)
    assert.match(customGoal, /aria-valuenow="38"/)

    total = 350000
    goal = null
    const completed = renderToStaticMarkup(createElement(App))
    assert.match(completed, /Obiectiv atins!/)
    assert.match(completed, /aria-valuenow="100"/)
    assert.match(completed, /width:100%/)
    assert.doesNotMatch(completed, /Mai sunt/)

    goal = '0'
    assert.match(renderToStaticMarkup(createElement(App)), /Obiectivul salvat nu este valid/)

    content = JSON.stringify({ title: 'Un alt vis', description: 'O cauză nouă' })
    const customized = renderToStaticMarkup(createElement(App))
    for (const text of ['Un alt vis', 'O cauză nouă']) assert.ok(customized.includes(text))
    assert.doesNotMatch(customized, /<footer/)
    globalThis.window.location.pathname = '/admin'
    goal = JSON.stringify(400000)
    const admin = renderToStaticMarkup(createElement(App))
    assert.match(admin, /id="total-input"[^>]*value="3500"/)
    assert.match(admin, /id="goal-input"[^>]*value="4000"/)
    assert.match(admin, /id="title-input"[^>]*value="Un alt vis"/)
    assert.match(admin, /role="switch"[^>]*aria-checked="false"/)

    theme = 'green'
    assert.match(renderToStaticMarkup(createElement(App)), /role="switch"[^>]*aria-checked="true"/)
    globalThis.window.location.pathname = '/'
    assert.match(renderToStaticMarkup(createElement(App)), /class="page theme-green"/)
    theme = 'unexpected'
    assert.match(renderToStaticMarkup(createElement(App)), /Tema salvată nu este validă/)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previousStorage
    await server.close()
  }
})
