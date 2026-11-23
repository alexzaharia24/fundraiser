import { useEffect, useState } from 'react'
import { CONTENT_STORAGE_KEY, DEFAULT_CONTENT, formatAmount, formatInputAmount, GOAL, GOAL_STORAGE_KEY, INITIAL_TOTAL, parseAmount, parseDonation, STORAGE_KEY, THEME_STORAGE_KEY } from './fundraising.js'
import './App.css'

function readTotal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return { total: INITIAL_TOTAL, error: '' }
    const total = JSON.parse(stored)
    if (!Number.isSafeInteger(total) || total < 0) {
      return { total: null, error: 'Datele salvate nu pot fi citite. Verifică datele acestui browser.' }
    }
    return { total, error: '' }
  } catch {
    return { total: null, error: 'Nu am putut citi datele salvate în acest browser.' }
  }
}

function readGoal() {
  try {
    const stored = localStorage.getItem(GOAL_STORAGE_KEY)
    if (stored === null) return { value: GOAL, error: '' }
    const value = JSON.parse(stored)
    if (!Number.isSafeInteger(value) || value <= 0) {
      return { value: null, error: 'Obiectivul salvat nu este valid. Actualizează-l în pagina de administrare.' }
    }
    return { value, error: '' }
  } catch {
    return { value: null, error: 'Nu am putut citi obiectivul salvat în acest browser.' }
  }
}

function readContent() {
  try {
    const stored = localStorage.getItem(CONTENT_STORAGE_KEY)
    if (stored === null) return { value: DEFAULT_CONTENT, error: '' }
    const value = JSON.parse(stored)
    if (!value || typeof value !== 'object' || Object.keys(DEFAULT_CONTENT).some(key => typeof value[key] !== 'string' || !value[key].trim())) {
      return { value: null, error: 'Textele salvate nu sunt valide. Actualizează-le în pagina de administrare.' }
    }
    return { value: Object.fromEntries(Object.keys(DEFAULT_CONTENT).map(key => [key, value[key]])), error: '' }
  } catch {
    return { value: null, error: 'Nu am putut citi textele salvate în acest browser.' }
  }
}

function readTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value === null) return { value: 'poster', error: '' }
    if (value === 'poster' || value === 'green') return { value, error: '' }
    return { value: null, error: 'Tema salvată nu este validă. Selectează o temă în pagina de administrare.' }
  } catch {
    return { value: null, error: 'Nu am putut citi tema salvată în acest browser.' }
  }
}

function App() {
  const [saved, setSaved] = useState(readTotal)
  const [goal, setGoal] = useState(readGoal)
  const [content, setContent] = useState(readContent)
  const [theme, setTheme] = useState(readTheme)
  const [totalDraft, setTotalDraft] = useState(null)
  const [incrementInput, setIncrementInput] = useState('')
  const [goalDraft, setGoalDraft] = useState(null)
  const [contentDraft, setContentDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [goalMessage, setGoalMessage] = useState('')
  const [contentMessage, setContentMessage] = useState('')
  const [themeMessage, setThemeMessage] = useState('')
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'
  const totalInput = totalDraft ?? (saved.total === null ? '' : formatInputAmount(saved.total))
  const goalInput = goalDraft ?? (goal.value === null ? '' : formatInputAmount(goal.value))
  const textFields = contentDraft ?? content.value ?? { title: '', description: '' }
  const title = content.value?.title ?? ''
  const titleBreak = title.lastIndexOf(',')

  useEffect(() => {
    function syncTotal(event) {
      if (event.key === STORAGE_KEY || event.key === null) setSaved(readTotal())
      if (event.key === GOAL_STORAGE_KEY || event.key === null) setGoal(readGoal())
      if (event.key === CONTENT_STORAGE_KEY || event.key === null) setContent(readContent())
      if (event.key === THEME_STORAGE_KEY || event.key === null) setTheme(readTheme())
    }
    window.addEventListener('storage', syncTotal)
    return () => window.removeEventListener('storage', syncTotal)
  }, [])

  function updateTotal(event, action) {
    event.preventDefault()
    const value = action === 'set' ? parseAmount(totalInput) : parseDonation(incrementInput)
    if (value === null) {
      setMessage(action === 'set'
        ? 'Introdu o sumă validă, de cel puțin zero, cu cel mult două zecimale.'
        : 'Introdu o sumă validă, mai mare decât zero, cu cel mult două zecimale.')
      return
    }
    const current = readTotal()
    if (current.total === null) {
      setSaved(current)
      return
    }
    const total = action === 'set' ? value : current.total + value
    if (!Number.isSafeInteger(total)) {
      setMessage('Totalul este prea mare pentru a fi salvat.')
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(total))
      setSaved({ total, error: '' })
      if (action === 'set') setTotalDraft(null)
      else setIncrementInput('')
      setMessage(action === 'set' ? 'Totalul a fost actualizat.' : 'Contribuția a fost adăugată.')
    } catch {
      setMessage('Nu am putut salva modificarea. Verifică setările de stocare ale browserului și încearcă din nou.')
    }
  }

  function updateGoal(event) {
    event.preventDefault()
    const value = parseDonation(goalInput)
    if (value === null) {
      setGoalMessage('Introdu un obiectiv valid, mai mare decât zero, cu cel mult două zecimale.')
      return
    }
    try {
      localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(value))
      setGoal({ value, error: '' })
      setGoalDraft(null)
      setGoalMessage('Obiectivul a fost actualizat.')
    } catch {
      setGoalMessage('Nu am putut salva obiectivul. Verifică setările de stocare ale browserului și încearcă din nou.')
    }
  }

  function updateContent(event) {
    event.preventDefault()
    const value = Object.fromEntries(Object.entries(textFields).map(([key, text]) => [key, text.trim()]))
    if (Object.values(value).some(text => !text)) {
      setContentMessage('Completează toate câmpurile de text.')
      return
    }
    try {
      localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(value))
      setContent({ value, error: '' })
      setContentDraft(null)
      setContentMessage('Textele au fost actualizate.')
    } catch {
      setContentMessage('Nu am putut salva textele. Verifică setările de stocare ale browserului și încearcă din nou.')
    }
  }

  function editContent(key, value) {
    setContentDraft({ ...textFields, [key]: value })
    setContentMessage('')
  }

  function toggleTheme() {
    const value = theme.value === 'green' ? 'poster' : 'green'
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value)
      setTheme({ value, error: '' })
      setThemeMessage('')
    } catch {
      setThemeMessage('Nu am putut salva tema. Verifică setările de stocare ale browserului și încearcă din nou.')
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
          <section className="fund-card admin-card" aria-labelledby="admin-total-label">
            <section className="theme-control" aria-labelledby="theme-heading">
              <h2 id="theme-heading">Tema paginii</h2>
              <div className="theme-row">
                <span>Verde și portocaliu</span>
                <button className="theme-switch" type="button" role="switch" aria-label="Tema verde și portocaliu" aria-checked={theme.value === 'green'} aria-describedby="theme-status" onClick={toggleTheme}><span aria-hidden="true" /></button>
              </div>
              <p id="theme-status" className="form-description">Tema curentă: {theme.value === 'green' ? 'verde și portocaliu' : 'alb și magenta'}.</p>
              {theme.error && <p className="storage-error" role="alert">{theme.error}</p>}
              <p className="form-message" role="status">{themeMessage}</p>
            </section>
            <div className="card-divider donation-divider" />
            <p className="card-label" id="admin-total-label"><span className="status-dot" /> SUMA STRÂNSĂ PÂNĂ ACUM</p>
            {saved.total === null ? (
              <p className="storage-error" role="alert">{saved.error}</p>
            ) : (
              <>
                <p className="total admin-total" aria-live="polite">{formatAmount(saved.total)} <span>RON</span></p>
                <div className="card-divider" />
                <form onSubmit={(event) => updateTotal(event, 'set')} noValidate>
                  <label htmlFor="total-input">Modifică totalul</label>
                  <p className="form-description">Introdu noua sumă totală strânsă.</p>
                  <div className="form-row">
                    <div className="input-wrap">
                      <input id="total-input" type="text" inputMode="decimal" placeholder="Noul total" value={totalInput} onChange={(event) => { setTotalDraft(event.target.value); setMessage('') }} aria-describedby="form-message local-note" />
                      <span>RON</span>
                    </div>
                    <button type="submit">Salvează <span aria-hidden="true">↗</span></button>
                  </div>
                </form>
                <div className="card-divider donation-divider" />
                <form onSubmit={(event) => updateTotal(event, 'add')} noValidate>
                  <label htmlFor="increment-input">Adaugă o contribuție</label>
                  <p className="form-description">Adaugă o sumă la totalul existent.</p>
                  <div className="form-row">
                    <div className="input-wrap">
                      <input id="increment-input" type="text" inputMode="decimal" placeholder="Suma" value={incrementInput} onChange={(event) => { setIncrementInput(event.target.value); setMessage('') }} aria-describedby="form-message local-note" />
                      <span>RON</span>
                    </div>
                    <button type="submit">Adaugă <span aria-hidden="true">↗</span></button>
                  </div>
                </form>
                <p id="form-message" className="form-message" role="status">{message}</p>
              </>
            )}
            <div className="card-divider donation-divider" />
            <form onSubmit={updateGoal} noValidate>
              <label htmlFor="goal-input">Modifică obiectivul</label>
              {goal.value === null
                ? <p className="storage-error" role="alert">{goal.error}</p>
                : <p className="form-description">Obiectivul actual: <strong>{formatAmount(goal.value)} RON</strong>.</p>}
              <div className="form-row">
                <div className="input-wrap">
                  <input id="goal-input" type="text" inputMode="decimal" placeholder="Noul obiectiv" value={goalInput} onChange={(event) => { setGoalDraft(event.target.value); setGoalMessage('') }} aria-describedby="goal-message local-note" />
                  <span>RON</span>
                </div>
                <button type="submit">Salvează <span aria-hidden="true">↗</span></button>
              </div>
              <p id="goal-message" className="form-message" role="status">{goalMessage}</p>
            </form>
            <div className="card-divider donation-divider" />
            <form className="content-form" onSubmit={updateContent} noValidate>
              <h2>Textele paginii</h2>
              {content.error && <p className="storage-error" role="alert">{content.error}</p>}
              <label htmlFor="title-input">Titlu</label>
              <input id="title-input" className="text-input" value={textFields.title} onChange={(event) => editContent('title', event.target.value)} aria-describedby="content-message" />
              <label htmlFor="description-input">Descrierea cauzei</label>
              <textarea id="description-input" className="text-input" rows="3" value={textFields.description} onChange={(event) => editContent('description', event.target.value)} aria-describedby="content-message" />
              <button type="submit">Salvează textele <span aria-hidden="true">↗</span></button>
              <p id="content-message" className="form-message" role="status">{contentMessage}</p>
            </form>
            <p id="local-note" className="local-note"><span aria-hidden="true">✳</span> Totalul, obiectivul, textele și tema sunt salvate doar în acest browser. Pagina nu este protejată prin parolă și nu procesează plăți.</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className={`page${theme.value === 'green' ? ' theme-green' : ''}`}>
      <main className="main-content">
        <section className="campaign" aria-labelledby={content.value ? 'heading' : undefined}>
          {theme.error && <p className="storage-error" role="alert">{theme.error}</p>}
          {content.value
            ? <h1 id="heading">{titleBreak >= 0 && titleBreak < title.length - 1
              ? <>{title.slice(0, titleBreak + 1)}<em>{title.slice(titleBreak + 1)}</em></>
              : title}</h1>
            : <p className="storage-error" role="alert">{content.error}</p>}
          <p className="card-label" id="total-label"><span className="status-dot" /> SUMA STRÂNSĂ PÂNĂ ACUM</p>
          {saved.total === null ? (
            <p className="storage-error" role="alert">{saved.error}</p>
          ) : (
            <>
              <p className="total public-total" aria-live="polite">{formatAmount(saved.total)} <span>RON</span></p>
              {goal.value === null ? (
                <p className="storage-error" role="alert">{goal.error}</p>
              ) : <div className="campaign-progress">
                <div className="progress-details">
                  <span><strong className="progress-percent">{Math.round(saved.total / goal.value * 100)}%</strong> strâns</span>
                  <span className="progress-goal" aria-label={`Obiectiv: ${formatAmount(goal.value)} RON`}><strong>{formatAmount(goal.value)} RON</strong></span>
                </div>
                <div className="progress-track" role="progressbar" aria-label="Progres către obiectiv" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(Math.round(saved.total / goal.value * 100), 100)} aria-valuetext={`${formatAmount(saved.total)} RON din ${formatAmount(goal.value)} RON`}>
                  <div className="progress-fill" style={{ width: `${Math.min(saved.total / goal.value * 100, 100)}%` }} />
                </div>
                <p className="progress-message">{saved.total < goal.value
                  ? <>Mai sunt <strong>{formatAmount(goal.value - saved.total)} RON</strong> până la obiectiv.<br /><span className="progress-caption">Fiecare contribuție contează!</span></>
                  : <>Obiectiv atins! <strong>Împreună am reușit.</strong></>}</p>
              </div>}
            </>
          )}
          {content.value && <p className="intro-copy">{content.value.description}</p>}
        </section>
      </main>
    </div>
  )
}

export default App
