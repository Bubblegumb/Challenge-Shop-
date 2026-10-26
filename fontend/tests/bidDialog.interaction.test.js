import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement, act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

let dom
let server
let BidDialog
let createRoot
const originalGlobals = new Map()

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://gallery.example.invalid/' })
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  ;({ createRoot } = await import('react-dom/client'))
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://auction.example.invalid'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-publishable-key'),
    },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
  })
  BidDialog = (await server.ssrLoadModule('/src/components/bidding/BidDialog.jsx')).default
})

after(async () => {
  await server?.close()
  dom?.window.close()
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

async function mount(context, options = {}) {
  const state = {
    highest: null,
    locked: false,
    sentEmails: [],
    verifiedEmails: [],
    submissions: [],
    acceptedMessages: [],
    loseFirstResponse: false,
    rejectFirstBid: false,
    ...options,
  }
  const snapshot = () => ({
    closes_at: new Date(Date.now() + 3600000).toISOString(),
    server_time: new Date().toISOString(),
    accepting_bids: true,
    closed: false,
    bid_cap_cents: 7500,
    lots: [{ id: 'study-1', highest_amount_cents: state.highest, locked: state.locked }],
  })
  context.mock.method(globalThis, 'fetch', async (url, request) => {
    const body = JSON.parse(request.body)
    if (url.endsWith('/auction_snapshot')) return Response.json(snapshot())
    if (url.endsWith('/otp')) {
      state.sentEmails.push(body.email)
      return Response.json({})
    }
    if (url.endsWith('/verify')) {
      state.verifiedEmails.push(body.email)
      return body.token === '123456'
        ? Response.json({ access_token: `token-for:${body.email}` })
        : Response.json({ error_code: 'otp_expired' }, { status: 403 })
    }
    if (url.endsWith('/submit_bid')) {
      state.submissions.push({ body, authorization: request.headers.Authorization })
      if (state.rejectFirstBid && state.submissions.length === 1) {
        state.highest = 2500
        return Response.json({ message: 'BID_TOO_LOW' }, { status: 400 })
      }
      if (state.loseFirstResponse && state.submissions.length === 1) {
        state.highest = body.p_amount_cents
        state.locked = state.highest === 7500
        throw new TypeError('Connection lost after the database accepted the bid')
      }
      if (state.locked && body.p_request_id !== state.submissions[0].body.p_request_id) {
        return Response.json({ message: 'ARTWORK_LOCKED' }, { status: 400 })
      }
      state.highest = body.p_amount_cents
      state.locked = state.highest === 7500
      return Response.json({ accepted: true, amount_cents: body.p_amount_cents, locked: state.locked })
    }
    assert.fail(`Unexpected network request: ${url}`)
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let auction = snapshot()
  function render() {
    root.render(createElement(BidDialog, {
      artwork: { id: 'study-1', title: 'Study No. 01', number: '01', collectionTitle: 'The first collection' },
      lot: auction.lots[0],
      closed: auction.closed,
      onClose() {},
      onAccepted(message, fresh) {
        if (message) state.acceptedMessages.push(message)
        if (fresh) { auction = fresh; render() }
      },
    }))
  }
  await act(async () => render())
  context.after(async () => {
    await act(async () => root.unmount())
    container.remove()
  })
  async function fill(name, value) {
    const input = container.querySelector(`input[name="${name}"]`)
    assert.ok(input, `${name} input must exist`)
    assert.equal(input.disabled, false, `${name} input must be editable`)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
  }
  async function submit() {
    await act(async () => {
      container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    })
  }
  async function details(amount = '75', email = 'bidder@example.invalid') {
    await fill('amount', amount)
    await fill('name', 'Local Test Bidder')
    await fill('email', email)
  }
  return { container, state, fill, submit, details }
}

test('requesting the verification code preserves the details and places no bid', async context => {
  const { container, state, details, submit } = await mount(context)
  await details()
  await submit()
  assert.deepEqual(state.sentEmails, ['bidder@example.invalid'])
  assert.equal(state.submissions.length, 0)
  assert.ok(container.querySelector('input[name="code"]'))
  assert.equal(container.querySelector('input[name="amount"]').value, '75')
  assert.equal(container.querySelector('input[name="email"]').disabled, true)
  assert.match(container.textContent, /does not reserve the artwork or place a bid/)
  const resend = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Resend code'))
  assert.equal(resend.disabled, true)
})

test('a wrong code places no bid, and a valid code submits with verified authorization', async context => {
  const { container, state, details, fill, submit } = await mount(context)
  await details('20')
  await submit()
  await fill('code', '999999')
  await submit()
  assert.equal(state.submissions.length, 0)
  assert.match(container.querySelector('[role="alert"]').textContent, /invalid or expired/)
  await fill('code', '123456')
  await submit()
  assert.equal(state.submissions.length, 1)
  assert.equal(state.submissions[0].authorization, 'Bearer token-for:bidder@example.invalid')
  assert.equal(state.submissions[0].body.p_amount_cents, 2000)
  assert.equal(state.submissions[0].body.p_email, 'bidder@example.invalid')
  assert.match(state.acceptedMessages[0], /may still be outbid/)
})

test('another bidder securing the artwork during verification blocks submission', async context => {
  const { container, state, details, fill, submit } = await mount(context)
  await details()
  await submit()
  state.highest = 7500
  state.locked = true
  await fill('code', '123456')
  await submit()
  assert.equal(state.submissions.length, 0)
  assert.equal(state.acceptedMessages.length, 0)
  assert.match(container.textContent, /secured at \$75/)
  assert.equal(container.querySelector('button[type="submit"]').disabled, true)
})

test('a lost accepted response retries the same request even after the artwork locks', async context => {
  const { container, state, details, fill, submit } = await mount(context, { loseFirstResponse: true })
  await details()
  await submit()
  await fill('code', '123456')
  await submit()
  assert.equal(state.submissions.length, 1)
  assert.equal(state.locked, true)
  assert.match(container.querySelector('button[type="submit"]').textContent, /Check bid result/)
  assert.equal(container.querySelector('button[type="submit"]').disabled, false)
  await submit()
  assert.equal(state.submissions.length, 2)
  assert.equal(state.submissions[0].body.p_request_id, state.submissions[1].body.p_request_id)
  assert.deepEqual(state.submissions[0].body, state.submissions[1].body)
  assert.equal(state.verifiedEmails.length, 1)
  assert.match(state.acceptedMessages[0], /secured for you/)
})

test('changing an email after verification requires a new code for the new address', async context => {
  const { container, state, details, fill, submit } = await mount(context, { rejectFirstBid: true })
  await details('20')
  await submit()
  await fill('code', '123456')
  await submit()
  assert.equal(state.submissions.length, 1)
  assert.match(container.querySelector('button[type="submit"]').textContent, /Place verified bid/)
  await fill('amount', '30')
  await fill('email', 'changed@example.invalid')
  assert.match(container.querySelector('button[type="submit"]').textContent, /Send verification code/)
  await submit()
  assert.equal(state.submissions.length, 1)
  assert.deepEqual(state.sentEmails, ['bidder@example.invalid', 'changed@example.invalid'])
  await fill('code', '123456')
  await submit()
  assert.equal(state.submissions.length, 2)
  assert.equal(state.submissions[1].body.p_email, 'changed@example.invalid')
  assert.equal(state.submissions[1].authorization, 'Bearer token-for:changed@example.invalid')
})
