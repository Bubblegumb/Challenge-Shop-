import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

let db
const owner = '11111111-1111-4111-8111-111111111111'
const stranger = '22222222-2222-4222-8222-222222222222'

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    insert into auth.users values ('${owner}'), ('${stranger}');
  `)
  await db.exec(await readFile(new URL('../../supabase/migrations/202610260001_auction.sql', import.meta.url), 'utf8'))
})
after(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`reset role;
    truncate auction_private.highest_bids cascade;
    truncate auction_private.bid_limits, auction_private.owners;
    update auction_private.artworks set finalized = false;
    update auction_private.settings set accepting_bids = true, closes_at = clock_timestamp() + interval '1 hour';
    select set_config('request.jwt.claim.sub', '', false);
  `)
})

async function asRole(role, callback) {
  await db.exec(`set role ${role}`)
  try { return await callback() } finally { await db.exec('reset role') }
}

async function bid(amount = 1000, email = 'first@example.com', name = 'First bidder', request = randomUUID(), artwork = 'study-1') {
  const result = await asRole('anon', () => db.query(
    'select public.submit_bid($1, $2, $3, $4, $5) as result', [artwork, amount, name, email, request],
  ))
  return result.rows[0].result
}

test('every offered artwork starts at exactly $10 and the public snapshot contains no contact details', async () => {
  await bid()
  const { rows } = await asRole('anon', () => db.query('select public.auction_snapshot() as result'))
  assert.equal(rows[0].result.lots.length, 15)
  assert.ok(rows[0].result.lots.every(lot => lot.starting_price_cents === 1000))
  assert.equal(rows[0].result.lots.find(lot => lot.id === 'study-1').highest_amount_cents, 1000)
  assert.doesNotMatch(JSON.stringify(rows), /first@example|First bidder|bidder_email|bidder_name|request_id/)
})

test('a higher bid replaces the single record and removes the previous bidder contact details', async () => {
  await bid()
  await bid(1551, 'new@example.com', 'New bidder')
  const { rows } = await db.query('select * from auction_private.highest_bids')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].amount_cents, 1551)
  assert.equal(rows[0].bidder_email, 'new@example.com')
  assert.equal(rows[0].bidder_name, 'New bidder')
  assert.doesNotMatch(JSON.stringify(rows), /first@example|First bidder/)
})

test('equal and lower bids cannot replace the leader', async () => {
  await bid(1500)
  await assert.rejects(bid(1500, 'other@example.com'), /BID_TOO_LOW/)
  await assert.rejects(bid(1499, 'other@example.com'), /BID_TOO_LOW/)
  assert.equal((await db.query('select amount_cents from auction_private.highest_bids')).rows[0].amount_cents, 1500)
})

test('replaying the same request is safe, but changed details cannot reuse it', async () => {
  const request = randomUUID()
  await bid(1000, 'first@example.com', 'First bidder', request)
  assert.equal((await bid(1000, 'first@example.com', 'First bidder', request)).accepted, true)
  await assert.rejects(bid(2000, 'first@example.com', 'First bidder', request), /REQUEST_CONFLICT/)
  assert.equal((await db.query('select count(*)::int as n from auction_private.highest_bids')).rows[0].n, 1)
})

test('rejects invalid inputs, unknown artworks, and basic bot submissions', async () => {
  await assert.rejects(bid(999), /INVALID_BID/)
  await assert.rejects(bid(1000, 'invalid-email'), /INVALID_BID/)
  await assert.rejects(bid(1000, 'victim@example.com,other'), /INVALID_BID/)
  await assert.rejects(bid(1000, 'Name<victim@example.com>'), /INVALID_BID/)
  await assert.rejects(bid(1000, 'valid@example.com', ''), /INVALID_BID/)
  await assert.rejects(bid(1000, 'valid@example.com', 'A', randomUUID(), 'missing-artwork'), /INVALID_BID/)
  await assert.rejects(asRole('anon', () => db.query(
    'select public.submit_bid($1,$2,$3,$4,$5,$6)', ['study-1', 1000, 'Bot', 'bot@example.com', randomUUID(), 'spam'],
  )), /INVALID_BID/)
})

test('server-side cutoff works before finalization and new bids remain impossible after finalization', async () => {
  await bid()
  await db.exec("update auction_private.settings set closes_at = clock_timestamp()")
  await assert.rejects(bid(2000, 'late@example.com'), /AUCTION_CLOSED/)
  const snapshot = (await db.query('select public.auction_snapshot() as result')).rows[0].result
  assert.equal(snapshot.closed, true)
  await asRole('service_role', () => db.query('select public.finalize_auction()'))
  await db.exec("update auction_private.settings set closes_at = clock_timestamp() + interval '1 hour'")
  await assert.rejects(bid(2000, 'late@example.com'), /AUCTION_CLOSED/)
})

test('the approved timestamp is noon Sydney, equivalent to 01:00 UTC on 28 October', async () => {
  const { rows } = await db.query("select '2026-10-28 12:00:00+11'::timestamptz as closes_at")
  assert.equal(rows[0].closes_at.toISOString(), '2026-10-28T01:00:00.000Z')
})

test('bidding remains disabled until explicitly opened and email throttling is enforced', async () => {
  await db.exec('update auction_private.settings set accepting_bids = false')
  await assert.rejects(bid(), /AUCTION_NOT_OPEN/)
  await db.exec('update auction_private.settings set accepting_bids = true')
  await bid()
  await assert.rejects(bid(1100), /RATE_LIMITED/)
})

test('only an allowlisted owner can see contacts or confirm a donation', async () => {
  await bid()
  await assert.rejects(asRole('anon', () => db.query('select * from auction_private.highest_bids')), /permission denied/)
  await assert.rejects(asRole('anon', () => db.query('select public.owner_results()')), /permission denied/)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [stranger])
  await assert.rejects(asRole('authenticated', () => db.query('select public.owner_results()')), /OWNER_ONLY/)
  await assert.rejects(asRole('authenticated', () => db.query("select public.owner_confirm_donation('study-1')")), /OWNER_ONLY/)
  await db.query('insert into auction_private.owners values ($1)', [owner])
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner])
  const { rows } = await asRole('authenticated', () => db.query('select public.owner_results() as result'))
  assert.equal(rows[0].result.find(row => row.artwork_id === 'study-1').bidder_email, 'first@example.com')
})

test('only service role can finalize or access email jobs; repeated finalization produces one email per winner', async () => {
  await bid()
  await bid(3000, 'winner@example.com', 'Winner')
  await assert.rejects(asRole('anon', () => db.query('select public.finalize_auction()')), /permission denied/)
  await assert.rejects(asRole('authenticated', () => db.query('select public.claim_winner_email()')), /permission denied/)
  assert.equal((await asRole('service_role', () => db.query('select public.finalize_auction() as n'))).rows[0].n, 0)
  await db.exec("update auction_private.settings set closes_at = clock_timestamp() - interval '1 second'")
  await asRole('service_role', () => db.query('select public.finalize_auction()'))
  await asRole('service_role', () => db.query('select public.finalize_auction()'))
  const jobs = (await db.query('select * from auction_private.email_jobs')).rows
  assert.equal(jobs.length, 1)
  const claim = (await asRole('service_role', () => db.query('select public.claim_winner_email() as job'))).rows[0].job
  assert.equal(claim.payload.email, 'winner@example.com')
  assert.equal(claim.payload.amount_cents, 3000)
  assert.equal((await asRole('service_role', () => db.query('select public.claim_winner_email() as job'))).rows[0].job, null)
  await asRole('service_role', () => db.query('select public.finish_winner_email($1,$2,$3,$4,$5)',
    [claim.artwork_id, randomUUID(), 'accepted', 'wrong-worker', null]))
  assert.equal((await db.query('select status from auction_private.email_jobs')).rows[0].status, 'sending')
  await asRole('service_role', () => db.query('select public.finish_winner_email($1,$2,$3,$4,$5)',
    [claim.artwork_id, claim.claim_token, 'accepted', 'message-id', null]))
  assert.equal((await db.query('select status from auction_private.email_jobs')).rows[0].status, 'accepted')
})

test('interrupted SMTP jobs require owner review rather than sending a possible duplicate', async () => {
  await bid()
  await db.exec("update auction_private.settings set closes_at = clock_timestamp() - interval '1 second'")
  await db.query('select public.finalize_auction()')
  await db.query('select public.claim_winner_email()')
  await db.exec("update auction_private.email_jobs set claimed_at = clock_timestamp() - interval '6 minutes'")
  assert.equal((await db.query('select public.claim_winner_email() as job')).rows[0].job, null)
  assert.equal((await db.query('select status from auction_private.email_jobs')).rows[0].status, 'needs_review')
})
