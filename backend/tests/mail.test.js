import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWinnerMailHandler } from '../../supabase/functions/winner-mail/handler.js'
import { smtpFailureStatus, winnerMessage } from '../../supabase/functions/winner-mail/message.js'

const payload = {
  title: 'Study No. 01', amount_cents: 1551, name: 'A bidder', email: 'bidder@example.com',
  donation_url: 'https://www.neddsuncomfortablechallenge.com/fundraisers/sujaljoshi/challenge-2026',
  collection_note: 'Collection at the State Library on Friday 30 October 2026 from 1:00 pm to 1:55 pm (Sydney time).',
}
const secret = 'a'.repeat(64)
const request = () => new Request('https://example.com/winner-mail', { method: 'POST', headers: { 'x-auction-secret': secret } })

test('winner email includes exact amount, fundraising link, unframed warning, and confirmed collection details', () => {
  const message = winnerMessage(payload)
  assert.match(message.from, /sujaljoshi77@gmail.com/)
  assert.equal(message.to, 'bidder@example.com')
  assert.match(message.text, /exactly \$15\.51 AUD/)
  assert.ok(message.text.includes(payload.donation_url))
  assert.match(message.text, /YOUR ARTWORK IS UNFRAMED\. NO FRAME IS INCLUDED/)
  assert.ok(message.text.includes(payload.collection_note))
  assert.doesNotMatch(message.text, /wait for the confirmed collection details|to be confirmed/)
})

test('an unauthorized invocation cannot finalize, read contacts, or send emails', async () => {
  const handler = createWinnerMailHandler({
    env: () => secret, rpc: () => assert.fail('unauthorized database call'),
    createTransport: () => assert.fail('unauthorized mail transport'),
  })
  const response = await handler(new Request('https://example.com'))
  assert.equal(response.status, 401)
})

test('missing mail configuration finalizes without claiming a message', async () => {
  const calls = []
  const handler = createWinnerMailHandler({
    env: name => name === 'AUCTION_CRON_SECRET' ? secret : undefined,
    rpc: name => calls.push(name), createTransport: () => assert.fail('unconfigured mail'),
  })
  assert.equal((await handler(request())).status, 503)
  assert.deepEqual(calls, ['finalize_auction'])
})

test('successful delivery is recorded and the response never includes bidder contact details', async () => {
  const calls = []
  let claimed = false
  let sent
  const handler = createWinnerMailHandler({
    env: name => name === 'AUCTION_CRON_SECRET' ? secret : 'app-password',
    rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === 'claim_winner_email' && !claimed) {
        claimed = true
        return { artwork_id: 'study-1', claim_token: 'token', payload }
      }
      return null
    },
    createTransport: () => ({ sendMail: async message => { sent = message; return { accepted: [payload.email], messageId: 'id' } }, close() {} }),
  })
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.match(sent.text, /UNFRAMED/)
  assert.equal(calls.find(call => call.name === 'finish_winner_email').args.p_status, 'accepted')
  assert.doesNotMatch(await response.text(), /bidder@example/)
})

test('SMTP refusals retry; unknown delivery after a disconnect requires review', () => {
  assert.equal(smtpFailureStatus({ command: 'AUTH', code: 'EAUTH' }), 'pending')
  assert.equal(smtpFailureStatus({ responseCode: 451, command: 'DATA' }), 'pending')
  assert.equal(smtpFailureStatus({ code: 'ECONNECTION', command: 'DATA' }), 'needs_review')
  assert.equal(smtpFailureStatus({ code: 'EENVELOPE' }), 'needs_review')
})

test('uncertain SMTP outcomes are recorded for review without leaking the error message', async () => {
  let claimed = false
  let finish
  const handler = createWinnerMailHandler({
    env: name => name === 'AUCTION_CRON_SECRET' ? secret : 'app-password',
    rpc: async (name, args) => {
      if (name === 'claim_winner_email' && !claimed) {
        claimed = true
        return { artwork_id: 'study-1', claim_token: 'token', payload }
      }
      if (name === 'finish_winner_email') finish = args
      return null
    },
    createTransport: () => ({ sendMail: async () => { throw new Error('Sensitive smtp auth and bidder@example.com') }, close() {} }),
  })
  assert.equal((await handler(request())).status, 200)
  assert.equal(finish.p_status, 'needs_review')
  assert.doesNotMatch(finish.p_error, /bidder@example|Sensitive smtp/)
})
