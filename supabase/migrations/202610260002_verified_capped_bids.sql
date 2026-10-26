begin;

-- Preserve existing leaders rather than silently reducing or deleting old bids.
do $$
begin
  if exists(select 1 from auction_private.highest_bids where amount_cents > 7500) then
    raise exception 'EXISTING_BIDS_ABOVE_CAP: review bids above $75 before applying this migration';
  end if;
end;
$$;

alter table auction_private.highest_bids drop constraint if exists highest_bids_bid_cap_check;
alter table auction_private.highest_bids add constraint highest_bids_bid_cap_check
  check (amount_cents <= 7500);

create or replace function public.auction_snapshot()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'closes_at', s.closes_at,
    'server_time', clock_timestamp(),
    'accepting_bids', s.accepting_bids,
    'closed', clock_timestamp() >= s.closes_at,
    'bid_cap_cents', 7500,
    'lots', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'starting_price_cents', a.starting_price_cents,
      'highest_amount_cents', b.amount_cents, 'bid_cap_cents', 7500,
      'locked', coalesce(b.amount_cents >= 7500, false)
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
  verified_email text;
  time_now timestamptz;
  email_key text;
begin
  if p_amount_cents is null or p_amount_cents < 1000 or p_amount_cents > 7500
    or name is null or length(name) not between 1 and 100 or name ~ '[[:cntrl:]]'
    or email is null or length(email) > 254 or email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
    or p_request_id is null or coalesce(p_website, '') <> '' then
    raise exception 'INVALID_BID';
  end if;

  -- A browser flag or user-editable metadata cannot prove email ownership.
  select lower(btrim(u.email)) into verified_email from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null;
  if verified_email is null or verified_email <> email then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  email_key := md5(email);
  perform pg_advisory_xact_lock(hashtextextended(email_key, 0));
  -- Competing $75 requests serialize here; only the first can become the leader.
  select * into artwork from auction_private.artworks where id = p_artwork_id for update;
  if not found then raise exception 'INVALID_BID'; end if;
  select * into leader from auction_private.highest_bids where artwork_id = p_artwork_id;

  if leader.request_id = p_request_id then
    if leader.amount_cents <> p_amount_cents or leader.bidder_name <> name or leader.bidder_email <> email then
      raise exception 'REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('accepted', true, 'amount_cents', leader.amount_cents,
      'locked', leader.amount_cents >= 7500);
  end if;

  time_now := clock_timestamp();
  select * into settings from auction_private.settings where id;
  if time_now >= settings.closes_at or artwork.finalized then raise exception 'AUCTION_CLOSED'; end if;
  if not settings.accepting_bids then raise exception 'AUCTION_NOT_OPEN'; end if;
  if leader.amount_cents >= 7500 then raise exception 'ARTWORK_LOCKED'; end if;
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
  return jsonb_build_object('accepted', true, 'amount_cents', p_amount_cents,
    'locked', p_amount_cents >= 7500);
end;
$$;

revoke all on function public.auction_snapshot() from public;
grant execute on function public.auction_snapshot() to anon, authenticated;
revoke all on function public.submit_bid(text, integer, text, text, uuid, text) from public, anon;
grant execute on function public.submit_bid(text, integer, text, text, uuid, text) to authenticated;

commit;
