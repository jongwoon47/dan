-- Explicit staging Live Demand seed.
-- Refuses to run unless the same Postgres session set dan.seed_target=staging.
-- Does not create auth users. An existing staging profile is required.

do $guard$
begin
  if current_setting('dan.seed_target', true) is distinct from 'staging' then
    raise exception 'REFUSED: staging seed requires dan.seed_target=staging';
  end if;
end
$guard$;

insert into public.products (canonical_name, brand, model, category, image_hue)
values
  ('Sony A7 IV', 'Sony', 'A7 IV', 'camera', 195),
  ('iPhone 15 Pro', 'Apple', 'iPhone 15 Pro', 'electronics', 210),
  ('MacBook Pro 14 M4', 'Apple', 'MacBook Pro 14 M4', 'electronics', 250),
  ('Herman Miller Aeron Chair', 'Herman Miller', 'Aeron', 'furniture', 28),
  ('Sony FE 24-70mm F2.8 GM II', 'Sony', 'FE 24-70mm F2.8 GM II', 'lens', 210)
on conflict (canonical_name) do nothing;

do $demands$
declare
  v_user uuid;
begin
  select id into v_user
  from public.profiles
  order by created_at
  limit 1;

  if v_user is null then
    raise exception 'NEEDS USER: sign up one staging account before seeding Live Demands';
  end if;

  insert into public.demands (
    user_id,
    type,
    title,
    description,
    category,
    budget,
    location,
    status,
    product_id,
    max_price,
    condition_preference,
    trade_method,
    fulfillment_options,
    expires_at
  )
  select
    v_user,
    'BUY',
    p.canonical_name,
    'Staging Live Demand. Created only by the explicit staging seed.',
    p.category,
    case p.canonical_name
      when 'Sony A7 IV' then 2800000
      when 'iPhone 15 Pro' then 1200000
      when 'MacBook Pro 14 M4' then 2400000
      when 'Herman Miller Aeron Chair' then 900000
      else 2600000
    end,
    '서울',
    'ACTIVE',
    p.id,
    case p.canonical_name
      when 'Sony A7 IV' then 2800000
      when 'iPhone 15 Pro' then 1200000
      when 'MacBook Pro 14 M4' then 2400000
      when 'Herman Miller Aeron Chair' then 900000
      else 2600000
    end,
    'any',
    'meetup',
    '[{"mode":"MEETUP","place":{"publicLabel":"서울"}}]'::jsonb,
    now() + interval '7 days'
  from public.products p
  where p.canonical_name in (
    'Sony A7 IV',
    'iPhone 15 Pro',
    'MacBook Pro 14 M4',
    'Herman Miller Aeron Chair',
    'Sony FE 24-70mm F2.8 GM II'
  )
  and not exists (
    select 1
    from public.demands d
    where d.user_id = v_user
      and d.product_id = p.id
      and d.type = 'BUY'
      and d.status = 'ACTIVE'
  );
end
$demands$;
