begin;

create table public.ai_insight_cache (
  cache_key text primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  request_id uuid not null default gen_random_uuid(),
  response jsonb,
  expires_at timestamptz not null
);
create index ai_insight_cache_hotel_idx on public.ai_insight_cache(hotel_id);
create index ai_insight_cache_expiry_idx on public.ai_insight_cache(expires_at);

create table public.ai_usage (
  bucket text primary key,
  usage_day date not null,
  requests integer not null default 0 check (requests >= 0),
  minute_start timestamptz not null,
  minute_requests integer not null default 0 check (minute_requests >= 0)
);

alter table public.ai_insight_cache enable row level security;
alter table public.ai_usage enable row level security;
revoke all on public.ai_insight_cache, public.ai_usage from public, anon, authenticated;
grant all on public.ai_insight_cache, public.ai_usage to service_role;

create function public.ai_hotel_snapshot(p_hotel_id uuid, p_days integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_since timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if p_days not in (7, 30) then raise exception 'Invalid reporting period'; end if;
  v_end := ((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC';
  v_since := v_end - make_interval(days => p_days);
  select jsonb_build_object(
    'currency', h.currency,
    'period_start', (v_since at time zone 'UTC')::date,
    'period_end', (v_end at time zone 'UTC')::date - 1,
    'days', p_days,
    'rooms_total', (select count(*) from public.rooms where hotel_id = h.id),
    'rooms_occupied', (select count(*) from public.rooms where hotel_id = h.id and status = 'occupied'),
    'rooms_maintenance', (select count(*) from public.rooms where hotel_id = h.id and status = 'maintenance'),
    'reservations_created', (select count(*) from public.reservations where hotel_id = h.id and created_at >= v_since and created_at < v_end),
    'restaurant_sales', (select coalesce(sum(total), 0) from public.orders where hotel_id = h.id and status <> 'cancelled' and created_at >= v_since and created_at < v_end),
    'invoiced', (select coalesce(sum(total), 0) from public.invoices where hotel_id = h.id and status <> 'void' and created_at >= v_since and created_at < v_end),
    'collected', (select coalesce(sum(amount), 0) from public.payments where hotel_id = h.id and created_at >= v_since and created_at < v_end),
    'outstanding', (select coalesce(sum(greatest(total - amount_paid, 0)), 0) from public.invoices where hotel_id = h.id and status <> 'void')
  ) into v_result from public.hotels h where h.id = p_hotel_id;
  return v_result;
end;
$$;

create function public.ai_claim_request(p_user_id uuid, p_hotel_id uuid, p_cache_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_cache public.ai_insight_cache%rowtype;
  v_global public.ai_usage%rowtype;
  v_user public.ai_usage%rowtype;
  v_day date := (now() at time zone 'UTC')::date;
  v_minute timestamptz := date_trunc('minute', now());
  v_request uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(42719004);
  delete from public.ai_insight_cache where expires_at <= now();
  delete from public.ai_usage where usage_day < v_day;
  select * into v_cache from public.ai_insight_cache where cache_key = p_cache_key and hotel_id = p_hotel_id;
  if found then
    if v_cache.response is not null then return jsonb_build_object('status', 'cached', 'response', v_cache.response); end if;
    return jsonb_build_object('status', 'busy');
  end if;

  insert into public.ai_usage(bucket, usage_day, minute_start)
  values ('global', v_day, v_minute), ('user:' || p_user_id::text, v_day, v_minute)
  on conflict (bucket) do nothing;
  select * into v_global from public.ai_usage where bucket = 'global';
  select * into v_user from public.ai_usage where bucket = 'user:' || p_user_id::text;
  if v_global.requests >= 30 or v_user.requests >= 5 then return jsonb_build_object('status', 'daily_limit'); end if;
  if v_global.minute_start = v_minute and v_global.minute_requests >= 2 then return jsonb_build_object('status', 'minute_limit'); end if;
  update public.ai_usage set requests = requests + 1,
    minute_requests = case when minute_start = v_minute then minute_requests + 1 else 1 end,
    minute_start = v_minute
  where bucket in ('global', 'user:' || p_user_id::text);
  insert into public.ai_insight_cache(cache_key, hotel_id, request_id, expires_at)
  values (p_cache_key, p_hotel_id, v_request, now() + interval '90 seconds');
  return jsonb_build_object('status', 'claimed', 'request_id', v_request);
end;
$$;

revoke execute on function public.ai_hotel_snapshot(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ai_claim_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ai_hotel_snapshot(uuid, integer) to service_role;
grant execute on function public.ai_claim_request(uuid, uuid, text) to service_role;

commit;
