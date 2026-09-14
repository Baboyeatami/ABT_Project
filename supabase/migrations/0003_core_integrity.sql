begin;

create or replace function public.sync_profile_claims()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update profiles set role=coalesce(new.raw_app_meta_data->>'role','unassigned'),hotel_id=nullif(new.raw_app_meta_data->>'hotel_id','')::uuid where id=new.id;
 return new;
end $$;
create trigger sync_profile_claims after update of raw_app_meta_data on auth.users for each row execute function public.sync_profile_claims();

-- Profile role changes are trusted server operations, never self-service.
drop policy if exists profiles_update on public.profiles;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_name_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.can_write_hotel(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
select public.is_platform_admin() or
  (public.get_my_hotel_id() = h and public.get_my_role() = 'owner');
$$;

create or replace function public.require_department(h uuid, roles text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not (public.is_platform_admin() or
    (public.get_my_hotel_id() = h and public.get_my_role() = any(roles))) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end;
$$;

do $$
declare t text; roles text[];
begin
  foreach t in array array['rooms','room_types','guests','reservations','stay_sessions','menu_categories','menu_items','dining_tables','orders','order_items','folio_charges','invoices','payments'] loop
    roles := case
      when t in ('rooms','room_types','guests','reservations','stay_sessions') then array['owner','front_desk']
      when t in ('menu_categories','menu_items') then array['owner','kitchen']
      when t in ('orders','order_items','dining_tables') then array['owner','kitchen','cashier']
      else array['owner','cashier'] end;
    execute format('drop policy if exists %I on public.%I', t||'_insert',t);
    execute format('drop policy if exists %I on public.%I', t||'_update',t);
    execute format('drop policy if exists %I on public.%I', t||'_delete',t);
    if t not in ('invoices','payments','stay_sessions') then
      execute format('create policy %I on public.%I for all to authenticated using (public.is_platform_admin() or (hotel_id = public.get_my_hotel_id() and public.get_my_role() = any(%L::text[]))) with check (public.is_platform_admin() or (hotel_id = public.get_my_hotel_id() and public.get_my_role() = any(%L::text[])))',t||'_department',t,roles,roles);
    end if;
  end loop;
end $$;

-- Database exclusion constraints serialize competing reservations.
create extension if not exists btree_gist;
alter table public.reservations add constraint reservation_dates check (check_out > check_in);
alter table public.reservations add constraint reservation_party check (adults > 0 and children >= 0 and deposit >= 0);
alter table public.reservations add constraint reservation_no_overlap
exclude using gist (room_id with =, daterange(check_in,check_out,'[)') with &&)
where (status in ('pending','confirmed','checked_in'));
create unique index one_open_room_stay on public.stay_sessions(room_id) where status = 'open';
create unique index one_active_stay_invoice on public.invoices(stay_session_id) where status <> 'void';
alter table public.invoices add column line_items jsonb;

-- Reject foreign keys that point into another student's hotel.
create or replace function public.check_tenant_reference()
returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid; valid boolean; i integer;
begin
 for i in 0..tg_nargs/2-1 loop
   target := nullif(to_jsonb(new)->>tg_argv[i*2],'')::uuid;
   if target is not null then
     execute format('select exists(select 1 from public.%I where id=$1 and hotel_id=$2)',tg_argv[i*2+1]) into valid using target,new.hotel_id;
     if not valid then raise exception 'Related record must belong to the same hotel'; end if;
   end if;
 end loop;
 return new;
end $$;
create trigger rooms_tenant before insert or update on rooms for each row execute function check_tenant_reference('room_type_id','room_types');
create trigger menu_tenant before insert or update on menu_items for each row execute function check_tenant_reference('category_id','menu_categories');
create trigger order_tenant before insert or update on orders for each row execute function check_tenant_reference('table_id','dining_tables','stay_session_id','stay_sessions','guest_id','guests');
create trigger order_item_tenant before insert or update on order_items for each row execute function check_tenant_reference('order_id','orders','menu_item_id','menu_items');
create trigger folio_tenant before insert or update on folio_charges for each row execute function check_tenant_reference('stay_session_id','stay_sessions');

create or replace function public.protect_occupied_room()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status <> 'occupied' and exists(select 1 from stay_sessions where room_id=new.id and status='open') then
   raise exception 'Check out the active stay before changing room availability';
 end if;
 return new;
end $$;
create trigger occupied_room_guard before update on rooms for each row execute function protect_occupied_room();

create or replace function public.validate_reservation()
returns trigger language plpgsql set search_path = public as $$
declare capacity integer;
begin
  if not exists(select 1 from guests where id=new.guest_id and hotel_id=new.hotel_id) then raise exception 'Select a guest from this hotel'; end if;
  select rt.capacity into capacity from rooms r left join room_types rt on rt.id=r.room_type_id where r.id=new.room_id and r.hotel_id=new.hotel_id;
  if not found then raise exception 'Select a room from this hotel'; end if;
  if capacity is not null and new.adults+new.children > capacity then raise exception 'Room capacity exceeded'; end if;
  if current_user = 'authenticated' and
    ((tg_op = 'INSERT' and new.status not in ('pending','confirmed')) or
     (tg_op = 'UPDATE' and (old.status in ('checked_in','checked_out') or new.status in ('checked_in','checked_out')))) then
    raise exception 'Use check-in/check-out workflow';
  end if;
  return new;
end $$;
create trigger reservation_validation before insert or update on public.reservations for each row execute function public.validate_reservation();

create or replace function public.change_stay(p_reservation uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r reservations; room rooms;
begin
  select * into strict r from reservations where id=p_reservation for update;
  perform require_department(r.hotel_id,array['owner','front_desk']);
  select * into strict room from rooms where id=r.room_id and hotel_id=r.hotel_id for update;
  if p_action='check_in' then
    if r.status not in ('pending','confirmed') or room.status <> 'available' then raise exception 'Reservation or room is not available for check-in'; end if;
    insert into stay_sessions(hotel_id,reservation_id,guest_id,room_id) values(r.hotel_id,r.id,r.guest_id,r.room_id);
    update rooms set status='occupied' where id=r.room_id;
    update reservations set status='checked_in' where id=r.id;
  elsif p_action='check_out' then
    if r.status <> 'checked_in' then raise exception 'Guest is not checked in'; end if;
    update stay_sessions set status='closed',check_out_at=now() where reservation_id=r.id and status='open';
    if not found then raise exception 'No active stay'; end if;
    update rooms set status='available' where id=r.room_id;
    update reservations set status='checked_out' where id=r.id;
  else raise exception 'Unknown stay action'; end if;
end $$;

create or replace function public.issue_invoice(p_stay uuid)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare s stay_sessions; inv invoices; nights integer; rate numeric; room_amount numeric; restaurant_amount numeric; restaurant_tax numeric; manual_amount numeric; lines jsonb;
begin
  select * into strict s from stay_sessions where id=p_stay for update;
  perform require_department(s.hotel_id,array['owner','cashier']);
  select * into inv from invoices where stay_session_id=s.id and status<>'void';
  if found then return inv; end if;
  select coalesce(r.rate,rt.base_rate,0) into rate from rooms r left join room_types rt on rt.id=r.room_type_id where r.id=s.room_id and r.hotel_id=s.hotel_id;
  select greatest(1,check_out-check_in) into nights from reservations where id=s.reservation_id;
  nights:=coalesce(nights,greatest(1,ceil(extract(epoch from (coalesce(s.check_out_at,now())-s.check_in_at))/86400)::integer));
  room_amount:=round(coalesce(rate,0)*nights,2);
  select coalesce(sum(subtotal),0),coalesce(sum(tax),0) into restaurant_amount,restaurant_tax from orders where stay_session_id=s.id and hotel_id=s.hotel_id and status<>'cancelled';
  select coalesce(sum(amount),0) into manual_amount from folio_charges where stay_session_id=s.id and hotel_id=s.hotel_id and source='manual';
  lines:=jsonb_build_array(jsonb_build_object('description',format('Room (%s nights)',nights),'source','room','amount',room_amount));
  select lines || coalesce(jsonb_agg(jsonb_build_object('description','Restaurant order '||id,'source','restaurant','amount',subtotal)),'[]'::jsonb) into lines from orders where stay_session_id=s.id and hotel_id=s.hotel_id and status<>'cancelled';
  select lines || coalesce(jsonb_agg(jsonb_build_object('description',description,'source','manual','amount',amount)),'[]'::jsonb) into lines from folio_charges where stay_session_id=s.id and hotel_id=s.hotel_id and source='manual';
  insert into invoices(hotel_id,stay_session_id,invoice_number,subtotal,tax,total,line_items)
  values(s.hotel_id,s.id,'INV-'||gen_random_uuid(),room_amount+restaurant_amount+manual_amount,round((room_amount+manual_amount)*0.12+restaurant_tax,2),room_amount+restaurant_amount+manual_amount+round((room_amount+manual_amount)*0.12+restaurant_tax,2),lines) returning * into inv;
  return inv;
end $$;

create or replace function public.record_payment(p_invoice uuid,p_amount numeric,p_method text,p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare inv invoices; paid numeric;
begin
  select * into strict inv from invoices where id=p_invoice for update;
  perform require_department(inv.hotel_id,array['owner','cashier']);
  if inv.status in ('void','paid') or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>inv.total-inv.amount_paid or p_method not in ('cash','card','gcash') then raise exception 'Invalid payment or amount exceeds balance'; end if;
  insert into payments(hotel_id,invoice_id,amount,method,reference) values(inv.hotel_id,inv.id,p_amount,p_method,p_reference);
  paid:=inv.amount_paid+p_amount;
  update invoices set amount_paid=paid,status=case when paid=total then 'paid' else 'partially_paid' end where id=inv.id;
end $$;

create or replace function public.void_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv invoices;
begin
 select * into strict inv from invoices where id=p_invoice for update;
 perform require_department(inv.hotel_id,array['owner','cashier']);
 if inv.amount_paid>0 then raise exception 'Paid invoices require a refund workflow'; end if;
 update invoices set status='void' where id=inv.id;
end $$;

revoke all on function public.change_stay(uuid,text), public.issue_invoice(uuid), public.record_payment(uuid,numeric,text,text), public.void_invoice(uuid) from public,anon;
grant execute on function public.change_stay(uuid,text), public.issue_invoice(uuid), public.record_payment(uuid,numeric,text,text), public.void_invoice(uuid) to authenticated;
commit;
