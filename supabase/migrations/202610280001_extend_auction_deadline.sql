begin;

alter table auction_private.settings
  alter column closes_at set default '2026-10-28 23:59:00+11';

update auction_private.settings
set closes_at = '2026-10-28 23:59:00+11'
where id;

commit;
