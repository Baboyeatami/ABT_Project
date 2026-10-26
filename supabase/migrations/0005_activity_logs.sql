-- ABT Hotel & Restaurant Management Platform
-- Activity / audit log: records who did what, on which hotel, with full
-- before/after row snapshots. Service-role writes; RLS keeps tenants isolated.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_hotel_idx on public.activity_logs(hotel_id);
create index if not exists activity_logs_user_idx on public.activity_logs(user_id);
create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

alter table public.activity_logs enable row level security;
grant all on public.activity_logs to service_role;
revoke all on public.activity_logs from public, anon, authenticated;

create policy "activity_logs_select_admin" on public.activity_logs for select using (public.is_platform_admin());
create policy "activity_logs_select_hotel" on public.activity_logs for select using (
  public.get_my_hotel_id() is not null
  and public.get_my_role() <> 'unassigned'
  and public.get_my_hotel_id() = hotel_id
);
