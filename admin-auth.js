import { createHash, timingSafeEqual } from 'node:crypto'
import { next } from '@vercel/functions'

export function authenticationError(request) {
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    console.error('ADMIN_PASSWORD is not configured')
    return new Response('Admin authentication is not configured.', { status: 503 })
  }

  const authorization = request.headers.get('authorization') || ''
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)
  const credentials = match ? Buffer.from(match[1], 'base64').toString('utf8') : ''
  const separator = credentials.indexOf(':')
  const username = credentials.slice(0, separator)
  const suppliedPassword = separator < 0 ? '' : credentials.slice(separator + 1)
  const digest = value => createHash('sha256').update(value).digest()

  if (username === 'admin' && timingSafeEqual(digest(suppliedPassword), digest(password))) {
    return null
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Fundraiser admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

export default function adminAuth(request) {
  return authenticationError(request) ?? next()
}
