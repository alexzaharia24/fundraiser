import { useEffect, useState } from 'react'
import { CONTENT_STORAGE_KEY, DEFAULT_CONTENT, DEFAULT_THEME, formatAmount, formatInputAmount, MAX_MILESTONES, parseAmount, parseDonation, readLegacyAmounts, THEME_STORAGE_KEY, validMilestones } from './fundraising.js'
import './App.css'

const SETTINGS_REFRESH_INTERVAL = 30000

function validSettings(settings) {
  return settings && settings.content && typeof settings.content.title === 'string'
    && typeof settings.content.description === 'string' && typeof settings.content.encouragement === 'string'
    && ['poster', 'green'].includes(settings.theme) && validMilestones(settings.milestones)
    && typeof settings.milestonesEnabled === 'boolean' && Number.isSafeInteger(settings.total) && settings.total >= 0
    && Number.isSafeInteger(settings.goal) && settings.goal > 0 && settings.initialized
    && ['content', 'theme', 'milestones', 'total', 'goal'].every(key => typeof settings.initialized[key] === 'boolean')
}

export function CampaignTitle({ title }) {
  const lastSentence = title.trimEnd().replace(/\.+$/, '').lastIndexOf('.')
  const titleBreak = Math.max(title.lastIndexOf(','), lastSentence)
  return <h1 id="heading">{titleBreak >= 0 && titleBreak < title.length - 1
    ? <>{title.slice(0, titleBreak + 1)}<em>{title.slice(titleBreak + 1)}</em></>
    : title}</h1>
}

export function ProgressMessage({ remaining, encouragement }) {
  return <p className="progress-message">{remaining > 0
    ? <>Mai sunt <strong>{formatAmount(remaining)} RON</strong> până la obiectiv.{encouragement && <span className="progress-caption">{encouragement}</span>}</>
    : <>Obiectiv atins! <strong>Împreună am reușit.</strong></>}</p>
}

export function CampaignProgress({ total, goal, milestones, milestonesEnabled, milestonesError, encouragement }) {
  return <div className="campaign-progress">
    <div className="progress-details">
      <span><strong className="progress-percent">{Math.round(total / goal * 100)}%</strong> strâns</span>
      <span className="progress-goal"><strong>{formatAmount(goal)} RON</strong></span>
    </div>
    <div className="progress-bar-wrap">
      <div className="progress-track" role="progressbar" aria-label="Progres către obiectiv" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(Math.round(total / goal * 100), 100)} aria-valuetext={`${formatAmount(total)} RON din ${formatAmount(goal)} RON`}>
        <div className="progress-fill" style={{ width: `${Math.min(total / goal * 100, 100)}%` }} />
      </div>
      {milestonesEnabled && milestones?.filter(item => item.amount <= goal).map(item => (
        <span key={item.amount} className={`milestone-marker${item.amount <= total ? ' is-reached' : ''}`} style={{ left: `${item.amount / goal * 100}%` }} aria-hidden="true" />
      ))}
    </div>
    {milestonesEnabled && milestones?.length > 0 && <ul className="milestone-list" aria-label="Etapele campaniei">
      {[...milestones].sort((a, b) => a.amount - b.amount).map(item => (
        <li key={item.amount}><span className={`milestone-key${item.amount <= total ? ' is-reached' : ''}`} aria-hidden="true" /><span><strong>{item.label}</strong> · {formatAmount(item.amount)} RON {item.amount > goal ? '(peste obiectiv)' : item.amount <= total ? '(atinsă)' : ''}</span></li>
      ))}
    </ul>}
    {milestonesError && <p className="storage-error" role="alert">{milestonesError}</p>}
    <ProgressMessage remaining={goal - total} encouragement={encouragement} />
    <figure className="donation-qr">
      <img src="/donation-qr.svg" alt="Cod QR pentru donații" width="410" height="410" />
      <figcaption className="donation-title">Donează acum!</figcaption>
    </figure>
  </div>
}

function readContent() {
  try {
    const stored = localStorage.getItem(CONTENT_STORAGE_KEY)
    if (stored === null) return { value: DEFAULT_CONTENT, error: '' }
    const value = JSON.parse(stored)
    if (!value || typeof value !== 'object' || ['title', 'description'].some(key => typeof value[key] !== 'string')
      || (Object.hasOwn(value, 'encouragement') && typeof value.encouragement !== 'string') || !value.title.trim()) {
      return { value: null, error: 'Textele salvate nu sunt valide. Actualizează-le în pagina de administrare.' }
    }
    return { value: { ...DEFAULT_CONTENT, ...Object.fromEntries(Object.keys(DEFAULT_CONTENT).filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) }, error: '' }
  } catch {
    return { value: null, error: 'Nu am putut citi textele salvate în acest browser.' }
  }
}

function App() {
  const [saved, setSaved] = useState({ total: null, error: '' })
  const [goal, setGoal] = useState({ value: null, error: '' })
  const [content, setContent] = useState({ value: null, error: '' })
  const [theme, setTheme] = useState({ value: DEFAULT_THEME, error: '' })
  const [milestones, setMilestones] = useState({ value: null, error: '' })
  const [milestonesEnabled, setMilestonesEnabled] = useState(null)
  const [milestonesToggleSaving, setMilestonesToggleSaving] = useState(false)
  const [milestonesToggleMessage, setMilestonesToggleMessage] = useState('')
  const [milestoneDraft, setMilestoneDraft] = useState(null)
  const [milestoneMessage, setMilestoneMessage] = useState('')
  const [milestoneSaving, setMilestoneSaving] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [legacyNotice, setLegacyNotice] = useState(false)
  const [legacyError, setLegacyError] = useState('')
  const [legacyAmounts, setLegacyAmounts] = useState({ total: false, goal: false })
  const [refreshError, setRefreshError] = useState('')
  const [totalSaving, setTotalSaving] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [themeSaving, setThemeSaving] = useState(false)
  const [totalDraft, setTotalDraft] = useState(null)
  const [incrementInput, setIncrementInput] = useState('')
  const [goalDraft, setGoalDraft] = useState(null)
  const [contentDraft, setContentDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [messageAction, setMessageAction] = useState('set')
  const [goalMessage, setGoalMessage] = useState('')
  const [contentMessage, setContentMessage] = useState('')
  const [themeMessage, setThemeMessage] = useState('')
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'
  const totalInput = totalDraft ?? (saved.total === null ? '' : formatInputAmount(saved.total))
  const goalInput = goalDraft ?? (goal.value === null ? '' : formatInputAmount(goal.value))
  const textFields = contentDraft ?? content.value ?? { title: '', description: '', encouragement: '' }
  const milestoneFields = milestoneDraft ?? milestones.value?.map(item => ({ label: item.label, amount: formatInputAmount(item.amount) })) ?? []
  const title = content.value?.title ?? ''

  useEffect(() => {
    let active = true
    async function loadSettings() {
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Settings request failed: ${response.status}`)
        const settings = await response.json()
        if (!validSettings(settings)) throw new Error('Invalid settings response')
        if (!active) return
        setContent({ value: settings.content, error: '' })
        setTheme({ value: settings.theme, error: '' })
        setMilestones({ value: settings.milestones, error: '' })
        setMilestonesEnabled(settings.milestonesEnabled)
        setSaved({ total: settings.total, error: '' })
        setGoal({ value: settings.goal, error: '' })
        if (isAdmin) {
          try {
            const hasLegacyContent = !settings.initialized.content && localStorage.getItem(CONTENT_STORAGE_KEY) !== null
            const hasLegacyTheme = !settings.initialized.theme && localStorage.getItem(THEME_STORAGE_KEY) !== null
            if (hasLegacyContent) {
              const legacy = readContent()
              if (legacy.value) setContentDraft(legacy.value)
            }
            setLegacyNotice(hasLegacyContent || hasLegacyTheme)
            const legacyAmounts = readLegacyAmounts(settings.initialized, localStorage)
            if (legacyAmounts.total.found) {
              if (legacyAmounts.total.draft !== null) setTotalDraft(legacyAmounts.total.draft)
              else { setMessageAction('set'); setMessage(legacyAmounts.total.error) }
            }
            if (legacyAmounts.goal.found) {
              if (legacyAmounts.goal.draft !== null) setGoalDraft(legacyAmounts.goal.draft)
              else setGoalMessage(legacyAmounts.goal.error)
            }
            setLegacyAmounts({ total: legacyAmounts.total.found, goal: legacyAmounts.goal.found })
          } catch (error) {
            console.error('Could not read previous browser settings:', error)
            setLegacyError('Nu am putut verifica setările salvate anterior în acest browser.')
          }
        }
      } catch (error) {
        console.error('Could not load campaign settings:', error)
        if (active) {
          setContent({ value: null, error: 'Nu am putut încărca textele. Reîncarcă pagina și încearcă din nou.' })
          setTheme({ value: null, error: 'Nu am putut încărca tema. Reîncarcă pagina și încearcă din nou.' })
          setMilestones({ value: null, error: 'Nu am putut încărca etapele. Reîncarcă pagina și încearcă din nou.' })
          setSaved({ total: null, error: 'Nu am putut încărca totalul. Reîncarcă pagina și încearcă din nou.' })
          setGoal({ value: null, error: 'Nu am putut încărca obiectivul. Reîncarcă pagina și încearcă din nou.' })
        }
      } finally {
        if (active) setSettingsLoading(false)
      }
    }
    loadSettings()
    return () => { active = false }
  }, [isAdmin])

  useEffect(() => {
    if (settingsLoading || totalSaving || goalSaving || contentSaving || themeSaving || milestoneSaving || milestonesToggleSaving) return
    let active = true
    let controller = null

    async function refreshSettings() {
      if (document.hidden || controller) return
      controller = new AbortController()
      const requestController = controller
      const timeout = setTimeout(() => requestController.abort(), 10000)
      try {
        const response = await fetch('/api/settings', { cache: 'no-store', signal: requestController.signal })
        if (!response.ok) throw new Error(`Settings request failed: ${response.status}`)
        const settings = await response.json()
        if (!validSettings(settings)) throw new Error('Invalid settings response')
        if (active) {
          setContent({ value: settings.content, error: '' })
          setTheme({ value: settings.theme, error: '' })
          setMilestones({ value: settings.milestones, error: '' })
          setMilestonesEnabled(settings.milestonesEnabled)
          setSaved({ total: settings.total, error: '' })
          setGoal({ value: settings.goal, error: '' })
          setRefreshError('')
        }
      } catch (error) {
        if (active) {
          console.error('Could not refresh settings:', error)
          setRefreshError('Nu am putut actualiza datele. Încercăm din nou automat.')
        }
      } finally {
        clearTimeout(timeout)
        controller = null
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) refreshSettings()
    }

    const interval = setInterval(refreshSettings, SETTINGS_REFRESH_INTERVAL)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      controller?.abort()
    }
  }, [settingsLoading, totalSaving, goalSaving, contentSaving, themeSaving, milestoneSaving, milestonesToggleSaving])

  async function updateTotal(event, action) {
    event.preventDefault()
    setMessageAction(action)
    const value = action === 'set' ? parseAmount(totalInput) : parseDonation(incrementInput)
    if (value === null) {
      setMessage(action === 'set'
        ? 'Introdu o sumă validă, de cel puțin zero, cu cel mult două zecimale.'
        : 'Introdu o sumă validă, mai mare decât zero, cu cel mult două zecimale.')
      return
    }
    setTotalSaving(true)
    try {
      const response = await fetch('/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(action === 'set' ? { total: value } : { contribution: value }),
      })
      if (!response.ok) throw new Error(`Total update failed: ${response.status}`)
      const result = await response.json()
      if (!Number.isSafeInteger(result.total) || result.total < 0) throw new Error('Invalid total response')
      setSaved({ total: result.total, error: '' })
      if (action === 'set') {
        setTotalDraft(null)
        setLegacyAmounts(previous => ({ ...previous, total: false }))
      }
      else setIncrementInput('')
      setMessage(action === 'set' ? 'Totalul a fost actualizat.' : 'Contribuția a fost adăugată.')
    } catch (error) {
      console.error('Could not save total:', error)
      setMessage('Nu am putut salva modificarea pe server. Verifică suma și încearcă din nou.')
    } finally {
      setTotalSaving(false)
    }
  }

  async function updateGoal(event) {
    event.preventDefault()
    const value = parseDonation(goalInput)
    if (value === null) {
      setGoalMessage('Introdu un obiectiv valid, mai mare decât zero, cu cel mult două zecimale.')
      return
    }
    setGoalSaving(true)
    try {
      const response = await fetch('/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ goal: value }),
      })
      if (!response.ok) throw new Error(`Goal update failed: ${response.status}`)
      setGoal({ value, error: '' })
      setGoalDraft(null)
      setLegacyAmounts(previous => ({ ...previous, goal: false }))
      setGoalMessage('Obiectivul a fost actualizat.')
    } catch (error) {
      console.error('Could not save goal:', error)
      setGoalMessage('Nu am putut salva obiectivul pe server. Încearcă din nou.')
    } finally {
      setGoalSaving(false)
    }
  }

  async function updateContent(event) {
    event.preventDefault()
    const value = Object.fromEntries(Object.entries(textFields).map(([key, text]) => [key, text.trim()]))
    if (!value.title) {
      setContentMessage('Completează titlul.')
      return
    }
    setContentSaving(true)
    try {
      const response = await fetch('/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ content: value }),
      })
      if (!response.ok) throw new Error(`Settings update failed: ${response.status}`)
      setContent({ value, error: '' })
      setContentDraft(null)
      setContentMessage('Textele au fost actualizate.')
    } catch (error) {
      console.error('Could not save campaign text:', error)
      setContentMessage('Nu am putut salva textele pe server. Încearcă din nou.')
    } finally {
      setContentSaving(false)
    }
  }

  function editContent(key, value) {
    setContentDraft({ ...textFields, [key]: value })
    setContentMessage('')
  }

  async function toggleTheme() {
    const value = theme.value === 'green' ? 'poster' : 'green'
    setThemeSaving(true)
    try {
      const response = await fetch('/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ theme: value }),
      })
      if (!response.ok) throw new Error(`Settings update failed: ${response.status}`)
      setTheme({ value, error: '' })
      setThemeMessage('Tema a fost actualizată.')
    } catch (error) {
      console.error('Could not save campaign theme:', error)
      setThemeMessage('Nu am putut salva tema pe server. Încearcă din nou.')
    } finally {
      setThemeSaving(false)
    }
  }

  function editMilestones(value) {
    setMilestoneDraft(value)
    setMilestoneMessage('')
  }

  async function toggleMilestones() {
    const value = !milestonesEnabled
    setMilestonesToggleSaving(true)
    setMilestonesToggleMessage('')
    try {
      const response = await fetch('/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ milestonesEnabled: value }),
      })
      if (!response.ok) throw new Error(`Milestones visibility update failed: ${response.status}`)
      setMilestonesEnabled(value)
      setMilestonesToggleMessage(value ? 'Etapele sunt vizibile pe pagina publică.' : 'Etapele sunt ascunse pe pagina publică.')
    } catch (error) {
      console.error('Could not update milestone visibility:', error)
      setMilestonesToggleMessage('Nu am putut actualiza vizibilitatea etapelor. Încearcă din nou.')
    } finally {
      setMilestonesToggleSaving(false)
    }
  }

  async function saveMilestones(event) {
    event.preventDefault()
    const value = milestoneFields.map(item => ({ label: item.label.trim(), amount: parseDonation(item.amount) }))
    if (!validMilestones(value)) {
      setMilestoneMessage('Completează fiecare etapă cu un nume și o sumă pozitivă, diferită de celelalte.')
      return
    }
    value.sort((a, b) => a.amount - b.amount)
    setMilestoneSaving(true)
    try {
      const response = await fetch('/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ milestones: value }),
      })
      if (!response.ok) throw new Error(`Milestones update failed: ${response.status}`)
      setMilestones({ value, error: '' })
      setMilestoneDraft(null)
      setMilestoneMessage('Etapele au fost salvate.')
    } catch (error) {
      console.error('Could not save milestones:', error)
      setMilestoneMessage('Nu am putut salva etapele. Încearcă din nou.')
    } finally {
      setMilestoneSaving(false)
    }
  }

  if (isAdmin) {
    return (
      <div className={`page admin-page${theme.value === 'green' ? ' theme-green' : ''}`}>
        <header className="site-header">
          <a className="brand" href="/" aria-label="Împreună pentru Bobi Simion - acasă">
            <span className="brand-mark" aria-hidden="true">✳</span>
            <span>ÎMPREUNĂ <span className="brand-light">PENTRU</span> BOBI SIMION</span>
          </a>
          <a className="admin-back" href="/">Înapoi la pagină ↗</a>
        </header>
        <main className="admin-main">
          <div className="eyebrow"><span className="eyebrow-line" /> ADMINISTRARE</div>
          <h1>Gestionează <em>campania.</em></h1>
          {legacyError && <p className="storage-error" role="alert">{legacyError}</p>}
          {refreshError && <p className="storage-error" role="alert">{refreshError}</p>}
          <div className="admin-sections">
            <section className="fund-card admin-card theme-control" aria-labelledby="theme-heading">
              <h2 id="theme-heading">Tema paginii</h2>
              <div className="theme-row">
                <span>Verde și portocaliu</span>
                <button className="theme-switch" type="button" role="switch" aria-label="Tema verde și portocaliu" aria-checked={theme.value === 'green'} aria-describedby="theme-status" onClick={toggleTheme} disabled={settingsLoading || theme.value === null || themeSaving}><span aria-hidden="true" /></button>
              </div>
              <p id="theme-status" className="form-description">{settingsLoading ? 'Se încarcă tema...' : theme.value !== null ? `Tema curentă: ${theme.value === 'green' ? 'verde și portocaliu' : 'alb și magenta'}.` : ''}</p>
              {theme.error && <p className="storage-error" role="alert">{theme.error}</p>}
              <p className="form-message" role="status">{themeMessage}</p>
            </section>
            <section className="fund-card admin-card" aria-labelledby="amounts-heading">
              <h2 id="amounts-heading">Sume și obiectiv</h2>
              {(legacyAmounts.total || legacyAmounts.goal) && <p className="form-description">Există sume salvate anterior în acest browser. Verifică valorile completate și salvează-le pentru a le partaja. Contribuțiile pot fi adăugate după salvarea totalului.</p>}
              <p className="card-label" id="admin-total-label"><span className="status-dot" /> SUMA STRÂNSĂ PÂNĂ ACUM</p>
              {saved.total === null ? (
                settingsLoading ? <p>Se încarcă totalul...</p> : <p className="storage-error" role="alert">{saved.error}</p>
              ) : (
                <>
                  <p className="total admin-total" aria-live="polite">{formatAmount(saved.total)} <span>RON</span></p>
                  <div className="card-divider" />
                  <form onSubmit={(event) => updateTotal(event, 'set')} noValidate>
                    <label htmlFor="total-input">Modifică totalul</label>
                    <p className="form-description">Introdu noua sumă totală strânsă.</p>
                    <div className="form-row">
                      <div className="input-wrap">
                        <input id="total-input" type="text" inputMode="decimal" placeholder="Noul total" value={totalInput} onChange={(event) => { setTotalDraft(event.target.value); setMessage('') }} aria-describedby="total-message local-note" disabled={totalSaving} />
                        <span>RON</span>
                      </div>
                      <button type="submit" disabled={totalSaving}>Salvează <span aria-hidden="true">↗</span></button>
                    </div>
                    <p id="total-message" className="form-message" role="status">{messageAction === 'set' ? message : ''}</p>
                  </form>
                  <div className="card-divider donation-divider" />
                  <form onSubmit={(event) => updateTotal(event, 'add')} noValidate>
                    <label htmlFor="increment-input">Adaugă o contribuție</label>
                    <p className="form-description">Adaugă o sumă la totalul existent.</p>
                    <div className="form-row">
                      <div className="input-wrap">
                        <input id="increment-input" type="text" inputMode="decimal" placeholder="Suma" value={incrementInput} onChange={(event) => { setIncrementInput(event.target.value); setMessage('') }} aria-describedby="increment-message local-note" disabled={totalSaving || legacyAmounts.total} />
                        <span>RON</span>
                      </div>
                      <button type="submit" disabled={totalSaving || legacyAmounts.total}>Adaugă <span aria-hidden="true">↗</span></button>
                    </div>
                    <p id="increment-message" className="form-message" role="status">{messageAction === 'add' ? message : ''}</p>
                  </form>
                </>
              )}
              <div className="card-divider donation-divider" />
              <form onSubmit={updateGoal} noValidate>
                <label htmlFor="goal-input">Modifică obiectivul</label>
                {goal.value === null
                  ? settingsLoading ? <p>Se încarcă obiectivul...</p> : <p className="storage-error" role="alert">{goal.error}</p>
                  : <p className="form-description">Obiectivul actual: <strong>{formatAmount(goal.value)} RON</strong>.</p>}
                <div className="form-row">
                  <div className="input-wrap">
                    <input id="goal-input" type="text" inputMode="decimal" placeholder="Noul obiectiv" value={goalInput} onChange={(event) => { setGoalDraft(event.target.value); setGoalMessage('') }} aria-describedby="goal-message local-note" disabled={settingsLoading || goal.value === null || goalSaving} />
                    <span>RON</span>
                  </div>
                  <button type="submit" disabled={settingsLoading || goal.value === null || goalSaving}>Salvează <span aria-hidden="true">↗</span></button>
                </div>
                <p id="goal-message" className="form-message" role="status">{goalMessage}</p>
              </form>
            </section>
            <section className="fund-card admin-card" aria-labelledby="milestones-heading">
              <h2 id="milestones-heading">Etapele campaniei</h2>
              <div className="theme-row">
                <span>Afișează etapele pe pagina publică</span>
                <button className="theme-switch" type="button" role="switch" aria-label="Afișează etapele pe pagina publică" aria-checked={milestonesEnabled === true} aria-describedby="milestones-visibility-status" onClick={toggleMilestones} disabled={settingsLoading || milestonesEnabled === null || milestonesToggleSaving}><span aria-hidden="true" /></button>
              </div>
              <p id="milestones-visibility-status" className="form-description">{milestonesEnabled === null ? 'Se încarcă vizibilitatea...' : milestonesEnabled ? 'Etapele sunt vizibile.' : 'Etapele sunt ascunse. Le poți edita în continuare.'}</p>
              <p className="form-message" role="status">{milestonesToggleMessage}</p>
              <p className="form-description">Adaugă până la {MAX_MILESTONES} etape cu un nume și o sumă. Etapele peste obiectiv apar în listă, dar nu pe bară.</p>
              {milestones.error && <p className="storage-error" role="alert">{milestones.error}</p>}
              <form className="milestone-form" onSubmit={saveMilestones} noValidate>
                <fieldset disabled={settingsLoading || milestones.value === null || milestoneSaving}>
                  {milestoneFields.map((item, index) => (
                    <div className="milestone-editor" key={index}>
                      <label htmlFor={`milestone-label-${index}`}>Numele etapei {index + 1}</label>
                      <input id={`milestone-label-${index}`} className="text-input" maxLength="80" value={item.label} onChange={event => editMilestones(milestoneFields.map((field, i) => i === index ? { ...field, label: event.target.value } : field))} />
                      <label htmlFor={`milestone-amount-${index}`}>Suma (RON)</label>
                      <input id={`milestone-amount-${index}`} className="text-input" inputMode="decimal" value={item.amount} onChange={event => editMilestones(milestoneFields.map((field, i) => i === index ? { ...field, amount: event.target.value } : field))} />
                      <button type="button" className="milestone-remove" onClick={() => editMilestones(milestoneFields.filter((_, i) => i !== index))}>Șterge etapa {index + 1}</button>
                    </div>
                  ))}
                  <div className="milestone-actions">
                    <button type="button" onClick={() => editMilestones([...milestoneFields, { label: '', amount: '' }])} disabled={milestoneFields.length >= MAX_MILESTONES}>Adaugă etapă</button>
                    <button type="submit">Salvează etapele</button>
                  </div>
                </fieldset>
                <p className="form-message" role="status">{milestoneMessage}</p>
              </form>
            </section>
            <section className="fund-card admin-card" aria-labelledby="content-heading">
              <h2 id="content-heading">Textele paginii</h2>
              <form className="content-form" onSubmit={updateContent} noValidate>
                {content.error && <p className="storage-error" role="alert">{content.error}</p>}
                {legacyNotice && <p className="form-description">Există setări salvate anterior în acest browser. Selectează tema și salvează textele pentru a le partaja.</p>}
                <label htmlFor="title-input">Titlu</label>
                <input id="title-input" className="text-input" value={textFields.title} onChange={(event) => editContent('title', event.target.value)} aria-describedby="content-message" disabled={settingsLoading || content.value === null || contentSaving} />
                <label htmlFor="description-input">Descrierea cauzei (opțional)</label>
                <textarea id="description-input" className="text-input" rows="3" value={textFields.description} onChange={(event) => editContent('description', event.target.value)} aria-describedby="content-message" disabled={settingsLoading || content.value === null || contentSaving} />
                <label htmlFor="encouragement-input">Mesaj de încurajare (opțional)</label>
                <input id="encouragement-input" className="text-input" value={textFields.encouragement} onChange={(event) => editContent('encouragement', event.target.value)} aria-describedby="content-message" disabled={settingsLoading || content.value === null || contentSaving} />
                <button type="submit" disabled={settingsLoading || content.value === null || contentSaving}>Salvează textele <span aria-hidden="true">↗</span></button>
                <p id="content-message" className="form-message" role="status">{contentMessage}</p>
              </form>
            </section>
          </div>
          <p id="local-note" className="local-note"><span aria-hidden="true">✳</span> {import.meta.env.DEV ? 'Toate setările sunt salvate local pe serverul de dezvoltare, separat de site-ul publicat.' : 'Toate setările sunt salvate pe server și partajate cu vizitatorii.'} Pagina nu procesează plăți.</p>
        </main>
      </div>
    )
  }

  return (
    <div className={`page${theme.value === 'green' ? ' theme-green' : ''}`}>
      <main className="main-content">
        <section className="campaign" aria-labelledby={content.value ? 'heading' : undefined}>
          {refreshError && <p className="storage-error" role="alert">{refreshError}</p>}
          {theme.error && <p className="storage-error" role="alert">{theme.error}</p>}
          {content.value
            ? <CampaignTitle title={title} />
            : settingsLoading ? <p>Se încarcă textele...</p> : <p className="storage-error" role="alert">{content.error}</p>}
          {content.value?.description && <p className="intro-copy">{content.value.description}</p>}
          <p className="card-label" id="total-label"><span className="status-dot" /> SUMA STRÂNSĂ PÂNĂ ACUM</p>
          {saved.total === null ? (
            settingsLoading ? <p>Se încarcă totalul...</p> : <p className="storage-error" role="alert">{saved.error}</p>
          ) : (
            <>
              <p className="total public-total" aria-live="polite">{formatAmount(saved.total)} <span>RON</span></p>
              {goal.value === null ? (
                <p className="storage-error" role="alert">{goal.error}</p>
              ) : <CampaignProgress total={saved.total} goal={goal.value} milestones={milestones.value} milestonesEnabled={milestonesEnabled} milestonesError={milestones.error} encouragement={content.value?.encouragement ?? DEFAULT_CONTENT.encouragement} />}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
