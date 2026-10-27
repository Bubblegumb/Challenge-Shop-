begin;

alter table auction_private.settings
  alter column collection_note set default 'Collection at the State Library on Friday 30 October 2026 from 1:00 pm to 1:55 pm (Sydney time).';

update auction_private.settings
set collection_note = 'Collection at the State Library on Friday 30 October 2026 from 1:00 pm to 1:55 pm (Sydney time).'
where id;

commit;
