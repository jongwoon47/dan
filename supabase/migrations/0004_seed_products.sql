-- Seed catalog products (idempotent by canonical_name)

insert into public.products (canonical_name, brand, model, category, image_hue)
values
  ('iPhone 15 Pro', 'Apple', 'iPhone 15 Pro', 'electronics', 210),
  ('MacBook Pro 14 M4', 'Apple', 'MacBook Pro 14 M4', 'electronics', 250),
  ('Sony A7 IV', 'Sony', 'A7 IV', 'camera', 195),
  ('Nintendo Switch OLED', 'Nintendo', 'Switch OLED', 'electronics', 340),
  ('AirPods Pro 2', 'Apple', 'AirPods Pro 2', 'electronics', 220),
  ('Sony FE 24-70mm F2.8 GM II', 'Sony', 'FE 24-70mm F2.8 GM II', 'lens', 210)
on conflict (canonical_name) do nothing;
