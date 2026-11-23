export const STORAGE_KEY = 'ionut-fundraiser-total-bani'
export const GOAL_STORAGE_KEY = 'fundraiser-goal-bani'
export const CONTENT_STORAGE_KEY = 'fundraiser-content'
export const THEME_STORAGE_KEY = 'fundraiser-theme'
export const INITIAL_TOTAL = 153200
export const GOAL = 300000
export const DEFAULT_CONTENT = {
  title: 'Un vis, o minge, o comunitate.',
  description: 'Ajută-l pe Bobi Simion să reprezinte România la Campionatul Mondial de Tenis de Masă.',
}
const formatter = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 })

export function formatAmount(bani) {
  return formatter.format(bani / 100)
}

export function formatInputAmount(bani) {
  const digits = String(bani).padStart(3, '0')
  const whole = digits.slice(0, -2).replace(/^0+(?=\d)/, '')
  const fraction = digits.slice(-2).replace(/0$/, '')
  return fraction === '0' ? whole : `${whole},${fraction}`
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
