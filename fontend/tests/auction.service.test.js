import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server
let auction

before(async () => {
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
  auction = await server.ssrLoadModule('/src/services/auction.js')
})

after(async () => { await server?.close() })

test('password recovery verifies a recovery code before updating the authenticated user', async context => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options })
    return Response.json(url.endsWith('/verify') ? { access_token: 'recovery-token' } : {})
  })
  await auction.requestPasswordRecovery(' Owner@Example.invalid ')
  const token = await auction.verifyRecoveryCode(' Owner@Example.invalid ', ' 123456 ')
  await auction.updateRecoveredPassword('new-test-password', token)
  assert.equal(calls[0].url, 'https://auction.example.invalid/auth/v1/recover')
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'owner@example.invalid' })
  assert.deepEqual(JSON.parse(calls[1].body), { email: 'owner@example.invalid', token: '123456', type: 'recovery' })
  assert.equal(calls[2].url, 'https://auction.example.invalid/auth/v1/user')
  assert.equal(calls[2].method, 'PUT')
  assert.equal(calls[2].headers.Authorization, 'Bearer recovery-token')
  assert.deepEqual(JSON.parse(calls[2].body), { password: 'new-test-password' })
})

test('recovery cannot proceed with invalid codes or missing session tokens', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error_code: 'otp_expired' }, { status: 403 }))
  await assert.rejects(auction.verifyRecoveryCode('owner@example.invalid', '000000'), /invalid or expired/)
  context.mock.method(globalThis, 'fetch', async () => Response.json({}))
  await assert.rejects(auction.verifyRecoveryCode('owner@example.invalid', '123456'), /could not be verified/)
})

test('requesting a bid code sends only the normalized email and never submits a bid', async context => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options })
    return Response.json({})
  })
  await auction.requestBidCode(' Person@Example.invalid ')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://auction.example.invalid/auth/v1/otp')
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'person@example.invalid', create_user: true })
  assert.equal(calls[0].headers.Authorization, undefined)
})

test('a verified code produces an in-memory access token that authorizes the bid', async context => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options })
    return Response.json(url.endsWith('/verify') ? { access_token: 'verified-test-token' } : { accepted: true })
  })
  const token = await auction.verifyBidCode(' Person@Example.invalid ', ' 123456 ')
  assert.equal(token, 'verified-test-token')
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'person@example.invalid', token: '123456', type: 'email' })
  const bid = { p_artwork_id: 'study-1', p_amount_cents: 7500, p_request_id: 'fixed-request' }
  await auction.placeBid(bid, token)
  assert.equal(calls[1].url, 'https://auction.example.invalid/rest/v1/rpc/submit_bid')
  assert.equal(calls[1].headers.Authorization, 'Bearer verified-test-token')
  assert.deepEqual(JSON.parse(calls[1].body), bid)
})

test('a bid without a verified token is rejected before any network call', async context => {
  context.mock.method(globalThis, 'fetch', () => assert.fail('unverified bid reached the network'))
  await assert.rejects(auction.placeBid({ p_amount_cents: 7500 }), /Verify your email address/)
})

test('invalid or expired verification codes receive a useful generic error', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error_code: 'otp_expired', msg: 'private provider detail' }, { status: 403 }))
  await assert.rejects(auction.verifyBidCode('person@example.invalid', '123456'), error => {
    assert.match(error.message, /invalid or expired/)
    assert.doesNotMatch(error.message, /private provider detail/)
    return true
  })
})

test('a verification response without an access token cannot authorize a bid', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ user: { email: 'person@example.invalid' } }))
  await assert.rejects(auction.verifyBidCode('person@example.invalid', '123456'), /could not be completed/)
})

test('email send throttling prompts the bidder to wait', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error_code: 'over_email_send_rate_limit' }, { status: 429 }))
  await assert.rejects(auction.requestBidCode('person@example.invalid'), /wait a moment/)
})

test('a locked artwork receives a clear error even with a verified token', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'ARTWORK_LOCKED' }, { status: 400 }))
  await assert.rejects(auction.placeBid({}, 'verified-test-token'), error => {
    assert.equal(error.code, 'ARTWORK_LOCKED')
    assert.match(error.message, /secured at \$75 AUD/)
    assert.equal(error.uncertain, false)
    return true
  })
})

test('expired bid authorization requires email verification again', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'JWT expired' }, { status: 401 }))
  await assert.rejects(auction.placeBid({}, 'expired-test-token'), error => {
    assert.equal(error.code, 'EMAIL_NOT_VERIFIED')
    assert.match(error.message, /Verify your email address/)
    return true
  })
})

test('a lost bid response is marked uncertain so the same request can be retried', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network interrupted') })
  await assert.rejects(auction.placeBid({}, 'verified-test-token'), error => {
    assert.equal(error.uncertain, true)
    return true
  })
})

test('an incomplete response never reports a bid as accepted', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({}))
  await assert.rejects(auction.placeBid({}, 'verified-test-token'), error => {
    assert.equal(error.uncertain, true)
    assert.match(error.message, /could not be confirmed/)
    return true
  })
})
