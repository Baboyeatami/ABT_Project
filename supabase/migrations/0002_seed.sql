-- Sample/demo data for every hotel in the platform.
-- Each student's hotel gets starter rooms, a menu, and dining tables so the
-- platform is usable immediately. Re-running is safe (guarded by existence).
-- Run this in the Supabase SQL Editor after 0001_init.sql.

do $$
declare
  h record;
  rt_standard uuid;
  rt_deluxe uuid;
  rt_family uuid;
begin
  for h in select id from public.hotels loop

    -- Room types (only if this hotel has none)
    if not exists (select 1 from public.room_types where hotel_id = h.id) then
      insert into public.room_types (hotel_id, name, description, capacity, base_rate)
      values (h.id, 'Standard', 'Cozy room with a single bed', 1, 1500)
      returning id into rt_standard;

      insert into public.room_types (hotel_id, name, description, capacity, base_rate)
      values (h.id, 'Deluxe', 'Queen bed with city view', 2, 2500)
      returning id into rt_deluxe;

      insert into public.room_types (hotel_id, name, description, capacity, base_rate)
      values (h.id, 'Family', 'Two beds for the whole family', 4, 4000)
      returning id into rt_family;

      insert into public.rooms (hotel_id, room_type_id, room_number, floor, rate, status)
      values
        (h.id, rt_standard, '101', '1', 1500, 'available'),
        (h.id, rt_standard, '102', '1', 1500, 'available'),
        (h.id, rt_deluxe,   '201', '2', 2500, 'available'),
        (h.id, rt_deluxe,   '202', '2', 2500, 'available'),
        (h.id, rt_family,   '301', '3', 4000, 'available'),
        (h.id, rt_family,   '302', '3', 4000, 'maintenance');
    end if;

    -- Menu categories + items (only if this hotel has none)
    if not exists (select 1 from public.menu_categories where hotel_id = h.id) then
      insert into public.menu_categories (hotel_id, name, sort_order)
      values
        (h.id, 'Breakfast', 1),
        (h.id, 'Mains', 2),
        (h.id, 'Drinks', 3);

      insert into public.menu_items (hotel_id, category_id, name, price, available)
      select
        h.id, c.id, mi.name, mi.price, true
      from (values
        ('Breakfast', 'Filipino Breakfast', 180),
        ('Breakfast', 'Pancakes & Syrup', 160),
        ('Mains', 'Chicken Adobo', 220),
        ('Mains', 'Sinigang na Baboy', 200),
        ('Mains', 'Beef Steak', 320),
        ('Drinks', 'Fresh Mango Shake', 120),
        ('Drinks', 'Iced Tea', 60),
        ('Drinks', 'Barako Coffee', 90)
      ) as mi(cat, name, price)
      join public.menu_categories c on c.hotel_id = h.id and c.name = mi.cat;
    end if;

    -- Dining tables (only if this hotel has none)
    if not exists (select 1 from public.dining_tables where hotel_id = h.id) then
      insert into public.dining_tables (hotel_id, table_number, capacity, status)
      values
        (h.id, 'T1', 2, 'available'),
        (h.id, 'T2', 2, 'available'),
        (h.id, 'T3', 4, 'available'),
        (h.id, 'T4', 4, 'available'),
        (h.id, 'T5', 6, 'available');
    end if;

  end loop;
end $$;
