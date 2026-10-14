-- Camera pilot catalog for DAN V1.
insert into public.products (canonical_name, brand, model, category, image_hue)
values
  ('Fujifilm X100VI', 'Fujifilm', 'X100VI', 'camera', 254),
  ('Fujifilm X100V', 'Fujifilm', 'X100V', 'camera', 250),
  ('Ricoh GR III', 'Ricoh', 'GR III', 'camera', 264),
  ('Ricoh GR IIIx', 'Ricoh', 'GR IIIx', 'camera', 270),
  ('Sony RX100 VII', 'Sony', 'RX100 VII', 'camera', 242)
on conflict (canonical_name) do nothing;
