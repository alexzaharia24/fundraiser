import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('highlights the final sentence while preserving comma-separated and single-part titles', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { CampaignTitle } = await server.ssrLoadModule('/src/App.jsx')
    const render = title => renderToStaticMarkup(createElement(CampaignTitle, { title }))

    assert.equal(render('Două cauze. Două povești. Un singur obiectiv.'), '<h1 id="heading">Două cauze. Două povești.<em> Un singur obiectiv.</em></h1>')
    assert.equal(render('Împreună, reușim'), '<h1 id="heading">Împreună,<em> reușim</em></h1>')
    assert.equal(render('Un singur obiectiv.'), '<h1 id="heading">Un singur obiectiv.</h1>')
  } finally {
    await server.close()
  }
})

test('shows the edited encouragement before the goal and hides it when empty or reached', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { ProgressMessage } = await server.ssrLoadModule('/src/App.jsx')
    const render = (remaining, encouragement) => renderToStaticMarkup(createElement(ProgressMessage, { remaining, encouragement }))
    assert.match(render(100, 'Mulțumim!'), /<span class="progress-caption">Mulțumim!<\/span>/)
    assert.doesNotMatch(render(100, ''), /progress-caption/)
    assert.doesNotMatch(render(0, 'Mulțumim!'), /Mulțumim!/)
  } finally {
    await server.close()
  }
})

test('shows remaining amount until the goal is reached and caps the progress bar', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { CampaignProgress } = await server.ssrLoadModule('/src/App.jsx')
    const render = (total, goal) => renderToStaticMarkup(createElement(CampaignProgress, {
      total, goal, milestones: [], milestonesEnabled: false, milestonesError: '', encouragement: 'Fiecare contribuție contează!',
    }))

    const inProgress = render(153200, 300000)
    assert.match(inProgress, /Mai sunt <strong>1\.468 RON<\/strong> până la obiectiv/)
    assert.match(inProgress, /<span class="progress-caption">Fiecare contribuție contează!<\/span>/)
    assert.match(inProgress, /Donează acum!/)
    assert.match(inProgress, /<figure class="donation-qr"><img[^>]*src="\/donation-qr\.svg"[^>]*alt="Cod QR pentru donații"[^>]*\/><figcaption class="donation-title">Donează acum!<\/figcaption>/)
    assert.ok(inProgress.indexOf('Fiecare contribuție contează!') < inProgress.indexOf('Donează acum!'))
    assert.match(inProgress, /<span class="progress-goal"><strong>3\.000 RON<\/strong><\/span>/)
    assert.doesNotMatch(inProgress, /<span>Obiectiv<\/span>/)
    assert.match(inProgress, /aria-valuetext="1\.532 RON din 3\.000 RON"/)
    assert.match(inProgress, /aria-valuenow="51"/)

    const customGoal = render(153200, 400000)
    assert.match(customGoal, /4\.000 RON/)
    assert.match(customGoal, /Mai sunt <strong>2\.468 RON<\/strong>/)
    assert.match(customGoal, /aria-valuenow="38"/)

    const completed = render(350000, 300000)
    assert.match(completed, /Obiectiv atins!/)
    assert.match(completed, /Donează acum!/)
    assert.match(completed, /aria-valuenow="100"/)
    assert.match(completed, /width:100%/)
    assert.doesNotMatch(completed, /Mai sunt/)

  } finally {
    await server.close()
  }
})

test('waits for shared amounts before enabling admin edits', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const previousWindow = globalThis.window
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx')
    globalThis.window = { location: { pathname: '/admin' } }
    const admin = renderToStaticMarkup(createElement(App))
    assert.match(admin, /Se încarcă totalul/)
    assert.match(admin, /id="goal-input"[^>]*disabled/)
    assert.match(admin, /aria-labelledby="amounts-heading"/)
    assert.match(admin, /aria-labelledby="theme-heading"/)
    assert.match(admin, /aria-labelledby="content-heading"/)
    assert.match(admin, /id="title-input"[^>]*disabled/)
    assert.match(admin, /id="encouragement-input"[^>]*disabled/)
    assert.match(admin, /role="switch"[^>]*disabled/)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    await server.close()
  }
})

