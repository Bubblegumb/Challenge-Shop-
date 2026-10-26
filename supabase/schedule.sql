-- First enable Cron (pg_cron) and pg_net in the Supabase dashboard.
-- Add a Vault secret named auction_cron_secret matching AUCTION_CRON_SECRET.
-- Run this after deploying winner-mail. Re-running updates these named jobs.
select cron.schedule('nedsshop-finalize', '* * * * *',
  'select public.finalize_auction()');

select cron.schedule('nedsshop-winner-emails', '* * * * *', $$
  select net.http_post(
    url := 'https://nfiillxbnvkbwciknjll.supabase.co/functions/v1/winner-mail',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auction-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'auction_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
