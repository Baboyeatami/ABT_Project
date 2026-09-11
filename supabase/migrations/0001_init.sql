-- ABT Hotel & Restaurant Management Platform
-- Base schema: tables + Row-Level Security + auto-provisioning on signup.
-- Run this in the Supabase SQL Editor or via `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id integer primary key default 1,
  admin_emails text[] not null default '{}',
  allowed_domains text[] not null default '{g.cjc.edu.ph}'
);

insert into public.platform_settings (id, admin_emails, allowed_domains)
values (1, '{}', '{g.cjc.edu.ph}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  currency text not null default 'PHP',
  owner_user_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'unassigned',
  hotel_id uuid references public.hotels(id) on delete set null,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  description text,
  capacity int not null default 1,
  base_rate numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_type_id uuid references public.room_types(id) on delete set null,
  room_number text not null,
  floor text,
  rate numeric(12,2),
  status text not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  unique (hotel_id, room_number)
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  id_type text,
  id_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  check_in date not null,
  check_out date not null,
  adults int not null default 1,
  children int not null default 0,
  status text not null default 'pending',
  deposit numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.stay_sessions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  table_number text not null,
  capacity int not null default 2,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  unique (hotel_id, table_number)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  table_id uuid references public.dining_tables(id) on delete set null,
  stay_session_id uuid references public.stay_sessions(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  order_type text not null default 'dine_in',
  status text not null default 'open',
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text,
  quantity int not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.folio_charges (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  stay_session_id uuid references public.stay_sessions(id) on delete set null,
  source text not null default 'manual',
  description text,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  stay_session_id uuid references public.stay_sessions(id) on delete set null,
  invoice_number text not null,
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'unpaid',
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12,2) not null,
  method text not null default 'cash',
  reference text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers for Row-Level Security (read from auth.users app_metadata)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = auth.uid()),
    'unassigned'
  );
$$;

create or replace function public.get_my_hotel_id()
returns uuid language sql stable security definer set search_path = public as $$
  select nullif(
    (select u.raw_app_meta_data ->> 'hotel_id' from auth.users u where u.id = auth.uid()),
    ''
  )::uuid;
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_my_role() = 'platform_admin';
$$;

create or replace function public.can_read_hotel(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or (public.get_my_hotel_id() = h and public.get_my_role() <> 'unassigned');
$$;

create or replace function public.can_write_hotel(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or (public.get_my_hotel_id() = h and public.get_my_role() in ('owner','front_desk','kitchen','cashier'));
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security policies
-- ---------------------------------------------------------------------------
alter table public.platform_settings enable row level security;
alter table public.hotels enable row level security;
alter table public.profiles enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.stay_sessions enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.dining_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.folio_charges enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

-- platform_settings: readable by any signed-in user, only admin writes
create policy "settings_select" on public.platform_settings for select using (auth.role() = 'authenticated');
create policy "settings_admin" on public.platform_settings for all using (public.is_platform_admin());

-- hotels
create policy "hotels_select" on public.hotels for select using (public.can_read_hotel(id));
create policy "hotels_insert" on public.hotels for insert with check (public.can_write_hotel(id));
create policy "hotels_update" on public.hotels for update using (public.can_write_hotel(id));
create policy "hotels_delete" on public.hotels for delete using (public.can_write_hotel(id));

-- profiles
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or public.can_read_hotel(hotel_id));
create policy "profiles_update" on public.profiles for update using (id = auth.uid() or public.is_platform_admin());

-- generic tenant tables: owner + staff read, owner/admin write
do $$
declare t text;
begin
  foreach t in array array['room_types','rooms','guests','reservations','stay_sessions',
                            'menu_categories','menu_items','dining_tables','orders',
                            'order_items','folio_charges','invoices','payments']
  loop
    execute format('create policy %I on public.%I for select using (public.can_read_hotel(hotel_id));', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (public.can_write_hotel(hotel_id));', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (public.can_write_hotel(hotel_id));', t||'_update', t);
    execute format('create policy %I on public.%I for delete using (public.can_write_hotel(hotel_id));', t||'_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger (hotels)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hotels_set_updated_at on public.hotels;
create trigger hotels_set_updated_at before update on public.hotels
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision on first signup (Google OAuth / any signup)
-- Creates a blank hotel for school accounts and stores role + hotel_id in
-- the user's app_metadata so RLS works immediately.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_settings record;
  v_is_admin boolean;
  v_role text := 'unassigned';
  v_hotel_id uuid := null;
begin
  v_domain := split_part(coalesce(new.email, ''), '@', 2);
  select * into v_settings from public.platform_settings where id = 1;

  v_is_admin := coalesce(new.email, '') = any(coalesce(v_settings.admin_emails, '{}'));

  if v_is_admin then
    v_role := 'platform_admin';
    v_hotel_id := null;
  elsif v_domain = any(coalesce(v_settings.allowed_domains, '{}')) then
    v_role := 'owner';
    insert into public.hotels (name, owner_user_id, currency)
    values ('My Hotel', new.id, 'PHP')
    returning id into v_hotel_id;
  end if;

  insert into public.profiles (id, role, hotel_id, display_name, email)
  values (
    new.id,
    v_role,
    v_hotel_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, profiles.display_name);

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', v_role, 'hotel_id', v_hotel_id)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
