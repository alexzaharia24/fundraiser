import assert from 'node:assert/strict'
import { test } from 'node:test'
import adminAuth from './admin-auth.js'

test('admin access requires the configured password', () => {
  const previous = process.env.ADMIN_PASSWORD
  process.env.ADMIN_PASSWORD = 'test-password'
  const request = credentials => new Request('https://example.com/admin', {
    headers: credentials ? { authorization: `Basic ${Buffer.from(credentials).toString('base64')}` } : {},
  })

  try {
    assert.equal(adminAuth(request()).status, 401)
    assert.equal(adminAuth(request('admin:wrong')).status, 401)
    assert.equal(adminAuth(request('other:test-password')).status, 401)
    assert.equal(adminAuth(request('admin:test-password')).headers.get('x-middleware-next'), '1')
    delete process.env.ADMIN_PASSWORD
    assert.equal(adminAuth(request('admin:test-password')).status, 503)
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = previous
  }
})
