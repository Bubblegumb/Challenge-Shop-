import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement, act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

test('recovery form handles mismatches, invalid codes, password update and return to sign-in', async context => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://gallery.example.invalid/#recovery' })
  const originals = new Map()
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://auction.example.invalid'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
  })
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(dom.window.document.querySelector('#root'))
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body)
    calls.push({ url, ...options })
    if (url.endsWith('/verify')) return body.token === '000000'
      ? Response.json({ error_code: 'otp_expired' }, { status: 403 })
      : Response.json({ access_token: 'test-recovery-token' })
    return Response.json({})
  })
  try {
    const Page = (await server.ssrLoadModule('/src/pages/RecoveryPage.jsx')).default
    await act(async () => root.render(createElement(Page)))
    const input = (name, value) => { dom.window.document.querySelector(`[name="${name}"]`).value = value }
    const submit = async () => act(async () => {
      dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    })
    input('email', 'owner@example.invalid')
    await submit()
    assert.match(dom.window.document.body.textContent, /If an account exists/)
    input('code', '000000')
    input('password', 'new-password-123')
    input('confirmation', 'different-password')
    await submit()
    assert.match(dom.window.document.body.textContent, /passwords do not match/)
    assert.equal(calls.length, 1)
    input('confirmation', 'new-password-123')
    await submit()
    assert.match(dom.window.document.body.textContent, /invalid or expired/)
    assert.equal(calls.filter(call => call.url.endsWith('/user')).length, 0)
    input('code', '123456')
    await submit()
    assert.match(dom.window.document.body.textContent, /password has been updated/)
    const update = calls.find(call => call.url.endsWith('/user'))
    assert.equal(update.method, 'PUT')
    assert.equal(update.headers.Authorization, 'Bearer test-recovery-token')
    assert.ok(calls.some(call => call.url.endsWith('/logout')))
    assert.equal(dom.window.document.querySelector('input[type="password"]'), null)
    assert.equal(dom.window.localStorage.length, 0)
    assert.equal(dom.window.document.querySelector('[role="status"] a').getAttribute('href'), '#owner')
  } finally {
    await act(async () => root.unmount())
    await server.close()
    dom.window.close()
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
