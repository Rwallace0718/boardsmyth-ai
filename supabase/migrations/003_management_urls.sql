alter table public.subscriptions add column if not exists management_cancel_url text;
alter table public.subscriptions add column if not exists management_update_url text;
