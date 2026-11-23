import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAmount, formatInputAmount, parseAmount, parseDonation } from './fundraising.js'

test('formats saved totals as editable values without grouping separators', () => {
  for (const bani of [0, 1, 10, 123, 153200, 9007199254740991]) {
    assert.equal(parseAmount(formatInputAmount(bani)), bani)
  }
})

test('allows setting the total to zero while increments must be positive', () => {
  assert.equal(parseAmount('0'), 0)
  assert.equal(parseAmount('0,00'), 0)
  assert.equal(parseAmount('123,45'), 12345)
  assert.equal(parseAmount('-1'), null)
  assert.equal(parseDonation('0'), null)
})

test('parses positive RON amounts exactly into bani', () => {
  assert.equal(parseDonation('12'), 1200)
  assert.equal(parseDonation(' 12,5 '), 1250)
  assert.equal(parseDonation('0.01'), 1)
  assert.equal(parseDonation('1.23'), 123)
})

test('rejects invalid, nonpositive and unsafe donations', () => {
  for (const value of ['', '0', '-1', '1.234', '1e3', '1,2,3', '90071992547410']) {
    assert.equal(parseDonation(value), null, value)
  }
})

test('formats whole and fractional RON amounts for Romanian readers', () => {
  assert.equal(formatAmount(153200), '1.532')
  assert.equal(formatAmount(153201), '1.532,01')
})
