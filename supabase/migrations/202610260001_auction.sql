begin;

create schema if not exists auction_private;
revoke all on schema auction_private from public, anon, authenticated;

create table if not exists auction_private.settings (
  id boolean primary key default true check (id),
  closes_at timestamptz not null default '2026-10-28 12:00:00+11',
  accepting_bids boolean not null default false,
  donation_url text not null default 'https://www.neddsuncomfortablechallenge.com/fundraisers/sujaljoshi/challenge-2026'
    check (donation_url ~ '^https://'),
  collection_note text not null default 'Collection is at the State Library during a one-hour window. The date, time and meeting point will be confirmed by email once the space is booked.'
);
insert into auction_private.settings(id) values (true) on conflict do nothing;

create table if not exists auction_private.artworks (
  id text primary key,
  title text not null,
  starting_price_cents integer not null default 1000 check (starting_price_cents = 1000),
  finalized boolean not null default false
);

-- Exactly one current leader per artwork. Higher bids replace these details.
create table if not exists auction_private.highest_bids (
  artwork_id text primary key references auction_private.artworks(id),
  amount_cents integer not null check (amount_cents between 1000 and 100000000),
  bidder_name text not null check (length(bidder_name) between 1 and 100),
  bidder_email text not null check (length(bidder_email) between 3 and 254),
  request_id uuid not null unique,
  accepted_at timestamptz not null default clock_timestamp(),
  donation_confirmed_at timestamptz
);

-- Throttling metadata contains no names or plaintext email addresses.
create table if not exists auction_private.bid_limits (
  email_hash text primary key,
  window_started timestamptz not null,
  last_bid_at timestamptz not null,
  bid_count integer not null
);
create table if not exists auction_private.owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists auction_private.email_jobs (
  artwork_id text primary key references auction_private.highest_bids(artwork_id),
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'needs_review')),
  attempts integer not null default 0,
  claim_token uuid,
  claimed_at timestamptz,
  available_at timestamptz not null default clock_timestamp(),
  payload jsonb,
  provider_message_id text,
  last_error text
);

alter table auction_private.settings enable row level security;
alter table auction_private.artworks enable row level security;
alter table auction_private.highest_bids enable row level security;
alter table auction_private.bid_limits enable row level security;
alter table auction_private.owners enable row level security;
alter table auction_private.email_jobs enable row level security;
revoke all on all tables in schema auction_private from public, anon, authenticated;

create or replace function public.auction_snapshot()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'closes_at', s.closes_at,
    'server_time', clock_timestamp(),
    'accepting_bids', s.accepting_bids,
    'closed', clock_timestamp() >= s.closes_at,
    'lots', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'starting_price_cents', a.starting_price_cents,
      'highest_amount_cents', b.amount_cents
    ) order by a.id) from auction_private.artworks a
      left join auction_private.highest_bids b on b.artwork_id = a.id), '[]'::jsonb)
  ) from auction_private.settings s where s.id;
$$;

create or replace function public.submit_bid(
  p_artwork_id text, p_amount_cents integer, p_name text, p_email text,
  p_request_id uuid, p_website text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  settings auction_private.settings;
  artwork auction_private.artworks;
  leader auction_private.highest_bids;
  limits auction_private.bid_limits;
  email text := lower(btrim(p_email));
  name text := btrim(p_name);
  time_now timestamptz;
  email_key text;
begin
  if p_amount_cents is null or p_amount_cents < 1000 or p_amount_cents > 100000000
    or name is null or length(name) not between 1 and 100 or name ~ '[[:cntrl:]]'
    or email is null or length(email) > 254 or email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
    or p_request_id is null or coalesce(p_website, '') <> '' then
    raise exception 'INVALID_BID';
  end if;

  email_key := md5(email);
  perform pg_advisory_xact_lock(hashtextextended(email_key, 0));
  select * into artwork from auction_private.artworks where id = p_artwork_id for update;
  if not found then raise exception 'INVALID_BID'; end if;
  select * into leader from auction_private.highest_bids where artwork_id = p_artwork_id;

  if leader.request_id = p_request_id then
    if leader.amount_cents <> p_amount_cents or leader.bidder_name <> name or leader.bidder_email <> email then
      raise exception 'REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('accepted', true, 'amount_cents', leader.amount_cents);
  end if;

  -- Read the clock AFTER acquiring the artwork lock; transaction start time is unsafe here.
  time_now := clock_timestamp();
  select * into settings from auction_private.settings where id;
  if time_now >= settings.closes_at or artwork.finalized then raise exception 'AUCTION_CLOSED'; end if;
  if not settings.accepting_bids then raise exception 'AUCTION_NOT_OPEN'; end if;
  if p_amount_cents < artwork.starting_price_cents or p_amount_cents <= coalesce(leader.amount_cents, 0) then
    raise exception 'BID_TOO_LOW';
  end if;
  select * into limits from auction_private.bid_limits where email_hash = email_key;
  if limits.last_bid_at > time_now - interval '3 seconds'
    or (limits.window_started > time_now - interval '1 hour' and limits.bid_count >= 20) then
    raise exception 'RATE_LIMITED';
  end if;
  insert into auction_private.bid_limits values (email_key, time_now, time_now, 1)
  on conflict (email_hash) do update set
    window_started = case when bid_limits.window_started <= time_now - interval '1 hour' then time_now else bid_limits.window_started end,
    bid_count = case when bid_limits.window_started <= time_now - interval '1 hour' then 1 else bid_limits.bid_count + 1 end,
    last_bid_at = time_now;

  insert into auction_private.highest_bids(artwork_id, amount_cents, bidder_name, bidder_email, request_id, accepted_at)
    values (p_artwork_id, p_amount_cents, name, email, p_request_id, time_now)
  on conflict (artwork_id) do update set amount_cents = excluded.amount_cents,
    bidder_name = excluded.bidder_name, bidder_email = excluded.bidder_email,
    request_id = excluded.request_id, accepted_at = excluded.accepted_at;
  return jsonb_build_object('accepted', true, 'amount_cents', p_amount_cents);
end;
$$;

create or replace function public.finalize_auction()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  artwork record;
  count_finalized integer := 0;
begin
  perform pg_advisory_xact_lock(260028);
  if clock_timestamp() < (select closes_at from auction_private.settings where id) then return 0; end if;
  for artwork in select id from auction_private.artworks where not finalized order by id for update loop
    update auction_private.artworks set finalized = true where id = artwork.id;
    insert into auction_private.email_jobs(artwork_id)
      select artwork_id from auction_private.highest_bids where artwork_id = artwork.id
      on conflict do nothing;
    count_finalized := count_finalized + 1;
  end loop;
  return count_finalized;
end;
$$;

create or replace function public.claim_winner_email()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  job auction_private.email_jobs;
  token uuid := gen_random_uuid();
  mail_payload jsonb;
begin
  -- SMTP cannot safely deduplicate a send that timed out after acceptance.
  update auction_private.email_jobs set status = 'needs_review', last_error = 'Previous send interrupted; check Gmail Sent before retrying.'
    where status = 'sending' and claimed_at < clock_timestamp() - interval '5 minutes';
  select * into job from auction_private.email_jobs
    where status = 'pending' and available_at <= clock_timestamp()
    order by available_at, artwork_id for update skip locked limit 1;
  if not found then return null; end if;
  select jsonb_build_object('artwork_id', a.id, 'title', a.title, 'amount_cents', b.amount_cents,
    'name', b.bidder_name, 'email', b.bidder_email, 'donation_url', s.donation_url,
    'collection_note', s.collection_note)
    into mail_payload from auction_private.artworks a
    join auction_private.highest_bids b on b.artwork_id = a.id
    cross join auction_private.settings s where a.id = job.artwork_id and s.id;
  update auction_private.email_jobs set status = 'sending', claim_token = token,
    claimed_at = clock_timestamp(), attempts = attempts + 1, payload = coalesce(payload, mail_payload)
    where artwork_id = job.artwork_id;
  return jsonb_build_object('artwork_id', job.artwork_id, 'claim_token', token,
    'payload', coalesce(job.payload, mail_payload));
end;
$$;

create or replace function public.finish_winner_email(
  p_artwork_id text, p_claim_token uuid, p_status text,
  p_message_id text default null, p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('accepted', 'pending', 'needs_review') then raise exception 'INVALID_STATUS'; end if;
  update auction_private.email_jobs set status = case when p_status = 'pending' and attempts >= 10 then 'needs_review' else p_status end,
    provider_message_id = p_message_id, last_error = left(p_error, 250), available_at = clock_timestamp() + interval '5 minutes'
    where artwork_id = p_artwork_id and status = 'sending' and claim_token = p_claim_token;
end;
$$;

create or replace function public.owner_results()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auction_private.owners where user_id = auth.uid()) then raise exception 'OWNER_ONLY'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'artwork_id', a.id, 'title', a.title, 'amount_cents', b.amount_cents,
    'bidder_name', b.bidder_name, 'bidder_email', b.bidder_email, 'finalized', a.finalized,
    'email_status', j.status, 'donation_confirmed_at', b.donation_confirmed_at
  ) order by a.id) from auction_private.artworks a
    left join auction_private.highest_bids b on b.artwork_id = a.id
    left join auction_private.email_jobs j on j.artwork_id = a.id), '[]'::jsonb);
end;
$$;

create or replace function public.owner_confirm_donation(p_artwork_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auction_private.owners where user_id = auth.uid()) then raise exception 'OWNER_ONLY'; end if;
  update auction_private.highest_bids set donation_confirmed_at = coalesce(donation_confirmed_at, clock_timestamp())
    where artwork_id = p_artwork_id and exists(select 1 from auction_private.artworks where id = p_artwork_id and finalized);
end;
$$;

revoke all on function public.auction_snapshot() from public;
revoke all on function public.submit_bid(text, integer, text, text, uuid, text) from public;
revoke all on function public.finalize_auction() from public, anon, authenticated;
revoke all on function public.claim_winner_email() from public, anon, authenticated;
revoke all on function public.finish_winner_email(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.owner_results() from public, anon;
revoke all on function public.owner_confirm_donation(text) from public, anon;
grant execute on function public.auction_snapshot(), public.submit_bid(text, integer, text, text, uuid, text) to anon, authenticated;
grant execute on function public.owner_results(), public.owner_confirm_donation(text) to authenticated;
grant execute on function public.finalize_auction(), public.claim_winner_email(), public.finish_winner_email(text, uuid, text, text, text) to service_role;

-- BEGIN GENERATED ARTWORKS: npm run sync:auction in fontend
insert into auction_private.artworks(id, title, starting_price_cents) values
  ('study-1', 'Study No. 01', 1000),
  ('study-2', 'Study No. 02', 1000),
  ('study-3', 'Study No. 03', 1000),
  ('study-4', 'Study No. 04', 1000),
  ('study-5', 'Study No. 05', 1000),
  ('study-6', 'Study No. 06', 1000),
  ('study-7', 'Study No. 07', 1000),
  ('study-8', 'Study No. 08', 1000),
  ('study-9', 'Study No. 09', 1000),
  ('study-10', 'Study No. 10', 1000),
  ('second-study-1', 'Unseen', 1000),
  ('second-study-2', 'Identity', 1000),
  ('second-study-3', 'Hope', 1000),
  ('second-study-4', 'The Door', 1000),
  ('second-study-5', 'A Window', 1000)
on conflict (id) do update set title = excluded.title;
-- END GENERATED ARTWORKS

commit;
