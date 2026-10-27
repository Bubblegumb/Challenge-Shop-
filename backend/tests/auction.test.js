import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
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
    create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    insert into auth.users(id, email, email_confirmed_at) values
      ('${owner}', 'owner@example.com', clock_timestamp()),
      ('${stranger}', 'stranger@example.com', clock_timestamp());
  `)
  const migrations = new URL('../../supabase/migrations/', import.meta.url)
  for (const filename of (await readdir(migrations)).filter(filename => filename.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(filename, migrations), 'utf8'))
  }
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
  const user = await db.query(`insert into auth.users(id, email, email_confirmed_at) values ($1,$2,clock_timestamp())
    on conflict (email) do update set email_confirmed_at = excluded.email_confirmed_at returning id`,
  [randomUUID(), email.trim().toLowerCase()])
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user.rows[0].id])
  const result = await asRole('authenticated', () => db.query(
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
  await assert.rejects(asRole('authenticated', () => db.query(
    'select public.submit_bid($1,$2,$3,$4,$5,$6)', ['study-1', 1000, 'Bot', 'bot@example.com', randomUUID(), 'spam'],
  )), /INVALID_BID/)
})

test('bids above $75 are rejected and cannot overwrite the leader', async () => {
  await bid(2000)
  await assert.rejects(bid(7501, 'over-cap@example.com'), /INVALID_BID/)
  await assert.rejects(bid(100000000, 'over-cap@example.com'), /INVALID_BID/)
  assert.equal((await db.query("select amount_cents from auction_private.highest_bids where artwork_id='study-1'")).rows[0].amount_cents, 2000)
  await assert.rejects(db.query("update auction_private.highest_bids set amount_cents=7501 where artwork_id='study-1'"), /highest_bids_bid_cap_check/)
})

test('upgrading refuses existing bids above the cap without altering or deleting them', async () => {
  await bid(2000)
  const migration = await readFile(new URL('../../supabase/migrations/202610260002_verified_capped_bids.sql', import.meta.url), 'utf8')
  await db.exec(`alter table auction_private.highest_bids drop constraint highest_bids_bid_cap_check;
    update auction_private.highest_bids set amount_cents=8000 where artwork_id='study-1';`)
  try {
    await assert.rejects(db.exec(migration), /EXISTING_BIDS_ABOVE_CAP/)
    await db.exec('rollback')
    const { rows } = await db.query("select amount_cents, bidder_email from auction_private.highest_bids where artwork_id='study-1'")
    assert.equal(rows[0].amount_cents, 8000)
    assert.equal(rows[0].bidder_email, 'first@example.com')
  } finally {
    await db.exec('rollback')
    await db.exec("update auction_private.highest_bids set amount_cents=2000 where artwork_id='study-1'")
    await db.exec(migration)
  }
})

test('the first $75 bid locks only its artwork and preserves its verified winner', async () => {
  const request = randomUUID()
  const accepted = await bid(7500, 'first-cap@example.com', 'First cap bidder', request)
  assert.equal(accepted.locked, true)
  await assert.rejects(bid(7500, 'later-cap@example.com'), /ARTWORK_LOCKED/)
  await assert.rejects(bid(7499, 'later-cap@example.com'), /ARTWORK_LOCKED/)
  const retry = await bid(7500, 'first-cap@example.com', 'First cap bidder', request)
  assert.equal(retry.accepted, true)
  assert.equal(retry.locked, true)
  await bid(1000, 'different-work@example.com', 'Other bidder', randomUUID(), 'study-2')
  const { rows } = await db.query("select bidder_email, amount_cents from auction_private.highest_bids where artwork_id='study-1'")
  assert.equal(rows[0].bidder_email, 'first-cap@example.com')
  assert.equal(rows[0].amount_cents, 7500)
  assert.equal((await db.query("select count(*)::int as n from auction_private.email_jobs")).rows[0].n, 0)
  assert.equal((await db.query("select finalized from auction_private.artworks where id='study-1'")).rows[0].finalized, false)
  const snapshot = (await asRole('anon', () => db.query('select public.auction_snapshot() as result'))).rows[0].result
  assert.equal(snapshot.bid_cap_cents, 7500)
  assert.equal(snapshot.lots.find(lot => lot.id === 'study-1').locked, true)
  assert.equal(snapshot.lots.find(lot => lot.id === 'study-2').locked, false)
})

test('anonymous visitors cannot bypass email verification by calling submit_bid directly', async () => {
  await assert.rejects(asRole('anon', () => db.query(
    'select public.submit_bid($1,$2,$3,$4,$5)', ['study-1', 1000, 'Unverified', 'first@example.com', randomUUID()],
  )), /permission denied/)
})

test('authenticated bids require an existing confirmed auth email matching the submitted address', async () => {
  const userId = randomUUID()
  await db.query('insert into auth.users(id,email) values ($1,$2)', [userId, 'not-confirmed@example.com'])
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId])
  const directBid = email => asRole('authenticated', () => db.query(
    'select public.submit_bid($1,$2,$3,$4,$5)', ['study-1', 1000, 'Unverified', email, randomUUID()],
  ))
  await assert.rejects(directBid('not-confirmed@example.com'), /EMAIL_NOT_VERIFIED/)
  await db.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1', [userId])
  await assert.rejects(directBid('victim@example.com'), /EMAIL_NOT_VERIFIED/)
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
  await assert.rejects(directBid('not-confirmed@example.com'), /EMAIL_NOT_VERIFIED/)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [randomUUID()])
  await assert.rejects(directBid('not-confirmed@example.com'), /EMAIL_NOT_VERIFIED/)
  assert.equal((await db.query('select count(*)::int as n from auction_private.highest_bids')).rows[0].n, 0)
})

test('verified auth email matching is normalized without trusting user metadata', async () => {
  await bid(1000, '  MixedCase@Example.com  ')
  assert.equal((await db.query('select bidder_email from auction_private.highest_bids')).rows[0].bidder_email, 'mixedcase@example.com')
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

test('the deadline migration extends existing settings to 11:59 pm Sydney and updates the default', async () => {
  await bid()
  await db.exec("update auction_private.settings set closes_at = '2026-10-28 12:00:00+11', accepting_bids = false")
  const migration = await readFile(new URL('../../supabase/migrations/202610280001_extend_auction_deadline.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  const { rows } = await asRole('anon', () => db.query('select public.auction_snapshot() as result'))
  assert.equal(new Date(rows[0].result.closes_at).toISOString(), '2026-10-28T12:59:00.000Z')
  assert.equal(rows[0].result.accepting_bids, false)
  assert.equal(rows[0].result.lots.find(lot => lot.id === 'study-1').highest_amount_cents, 1000)

  await db.exec('update auction_private.settings set closes_at = default')
  const settings = await db.query('select closes_at from auction_private.settings where id')
  assert.equal(settings.rows[0].closes_at.toISOString(), '2026-10-28T12:59:00.000Z')
})

test('bidding remains disabled until explicitly opened and email throttling is enforced', async () => {
  await db.exec('update auction_private.settings set accepting_bids = false')
  await assert.rejects(bid(), /AUCTION_NOT_OPEN/)
  await db.exec('update auction_private.settings set accepting_bids = true')
  await bid()
  await assert.rejects(bid(1100), /RATE_LIMITED/)
})

test('the collection migration updates the current note and default to Friday 30 October from 1:00 pm to 1:55 pm', async () => {
  await db.exec("update auction_private.settings set collection_note = 'Collection details to be confirmed.'")
  const migration = await readFile(new URL('../../supabase/migrations/202610280002_confirm_collection_details.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  const expected = 'Collection at the State Library on Friday 30 October 2026 from 1:00 pm to 1:55 pm (Sydney time).'
  const settings = await db.query('select collection_note from auction_private.settings where id')
  assert.equal(settings.rows[0].collection_note, expected)

  await db.exec('update auction_private.settings set collection_note = default')
  const defaults = await db.query('select collection_note from auction_private.settings where id')
  assert.equal(defaults.rows[0].collection_note, expected)
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
  assert.equal(claim.payload.collection_note, 'Collection at the State Library on Friday 30 October 2026 from 1:00 pm to 1:55 pm (Sydney time).')
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
