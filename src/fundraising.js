export const STORAGE_KEY = 'ionut-fundraiser-total-bani'
export const GOAL_STORAGE_KEY = 'fundraiser-goal-bani'
export const CONTENT_STORAGE_KEY = 'fundraiser-content'
export const THEME_STORAGE_KEY = 'fundraiser-theme'
export const INITIAL_TOTAL = 153200
export const GOAL = 300000
export const DEFAULT_THEME = 'poster'
export const MAX_MILESTONES = 12
export const DEFAULT_CONTENT = {
  title: 'Două cauze. Două povești. Un singur obiectiv.',
  description: '',
  encouragement: 'Fiecare contribuție contează!',
}
const formatter = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 })

export function validMilestones(value) {
  return Array.isArray(value) && value.length <= MAX_MILESTONES
    && value.every(item => item && typeof item === 'object' && !Array.isArray(item)
      && Object.keys(item).length === 2 && typeof item.label === 'string'
      && item.label.trim().length > 0 && item.label.length <= 80
      && Number.isSafeInteger(item.amount) && item.amount > 0)
    && new Set(value.map(item => item.amount)).size === value.length
}

export function formatAmount(bani) {
  return formatter.format(bani / 100)
}

export function formatInputAmount(bani) {
  const digits = String(bani).padStart(3, '0')
  const whole = digits.slice(0, -2).replace(/^0+(?=\d)/, '')
  const fraction = digits.slice(-2).replace(/0$/, '')
  return fraction === '0' ? whole : `${whole},${fraction}`
}

export function readLegacyAmounts(initialized, storage) {
  const result = {}
  for (const [name, key] of [['total', STORAGE_KEY], ['goal', GOAL_STORAGE_KEY]]) {
    const stored = initialized[name] ? null : storage.getItem(key)
    if (stored === null) {
      result[name] = { found: false, draft: null, error: '' }
      continue
    }
    let value
    try {
      value = JSON.parse(stored)
    } catch {
      value = null
    }
    const valid = Number.isSafeInteger(value) && (name === 'total' ? value >= 0 : value > 0)
    result[name] = valid
      ? { found: true, draft: formatInputAmount(value), error: '' }
      : { found: true, draft: null, error: 'Suma salvată în acest browser nu este validă. Introdu o valoare corectă.' }
  }
  return result
}

export function parseAmount(value) {
  const match = value.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/)
  if (!match) return null
  const bani = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
  return Number.isSafeInteger(bani) ? bani : null
}

export function parseDonation(value) {
  const bani = parseAmount(value)
  return bani !== null && bani > 0 ? bani : null
}
