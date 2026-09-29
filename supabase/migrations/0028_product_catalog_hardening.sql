-- Product catalog hardening for open-catalog DAN.
-- Canonicalizes free-form product names on the server, prevents direct client
-- catalog inserts, and broadens supported secondhand categories.

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (
    category in (
      'electronics',
      'computer',
      'gaming',
      'audio',
      'camera',
      'lens',
      'home_appliance',
      'furniture',
      'fashion',
      'shoes',
      'watches_accessories',
      'sports',
      'outdoor',
      'camping',
      'hobby_collectible',
      'baby_kids',
      'books_media',
      'musical_instrument',
      'beauty',
      'pet',
      'tools',
      'auto',
      'other'
    )
  );

create or replace function public.canonical_product_key(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_raw, '')));
begin
  v := replace(v, '프로 맥스', 'promax');
  v := replace(v, '프로맥스', 'promax');
  v := replace(v, '플레이스테이션', 'playstation');
  v := replace(v, '후지필름', 'fujifilm');
  v := replace(v, '닌텐도', 'nintendo');
  v := replace(v, '아이폰', 'iphone');
  v := replace(v, '에어팟', 'airpods');
  v := replace(v, '맥북', 'macbook');
  v := replace(v, '갤럭시', 'galaxy');
  v := replace(v, '소니', 'sony');
  v := replace(v, '캐논', 'canon');
  v := replace(v, '니콘', 'nikon');
  v := replace(v, '리코', 'ricoh');
  v := replace(v, '스위치', 'switch');
  v := replace(v, '울트라', 'ultra');
  v := replace(v, '프로', 'pro');
  v := replace(v, '맥스', 'max');

  return regexp_replace(v, '[^a-z0-9가-힣]+', '', 'g');
end;
$$;

alter table public.products
  add column if not exists product_match_key text;

update public.products
set product_match_key = public.canonical_product_key(canonical_name)
where product_match_key is null
   or product_match_key = '';

alter table public.products
  alter column product_match_key set not null;

create index if not exists products_match_key_idx
  on public.products (product_match_key);

create or replace function public.set_product_match_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.canonical_name := regexp_replace(trim(new.canonical_name), '[[:space:]]+', ' ', 'g');
  new.product_match_key := public.canonical_product_key(new.canonical_name);

  if char_length(new.product_match_key) < 2 then
    raise exception 'product name is too short';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_match_key on public.products;
create trigger trg_products_match_key
before insert or update of canonical_name on public.products
for each row execute function public.set_product_match_key();

create or replace function public.ensure_product(
  p_name text,
  p_category text
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g');
  v_key text;
  v_category text := lower(trim(coalesce(p_category, 'other')));
  v_row public.products%rowtype;
  v_hue integer;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'product name must be between 2 and 120 characters';
  end if;

  if not (
    v_category = any (
      array[
        'electronics','computer','gaming','audio','camera','lens',
        'home_appliance','furniture','fashion','shoes','watches_accessories',
        'sports','outdoor','camping','hobby_collectible','baby_kids',
        'books_media','musical_instrument','beauty','pet','tools','auto','other'
      ]::text[]
    )
  ) then
    raise exception 'unsupported product category';
  end if;

  v_key := public.canonical_product_key(v_name);
  if char_length(v_key) < 2 then
    raise exception 'product name is too short';
  end if;

  -- Serialize same-key creation so two buyers cannot create duplicate catalog
  -- rows at the same time even before a unique index exists for legacy data.
  perform pg_advisory_xact_lock(hashtext(v_key)::bigint);

  select *
  into v_row
  from public.products
  where product_match_key = v_key
  order by created_at asc, id asc
  limit 1;

  if found then
    return v_row;
  end if;

  v_hue := 180 + mod(abs(hashtext(v_key)::bigint), 160)::integer;

  insert into public.products (
    canonical_name,
    brand,
    model,
    category,
    image_hue,
    product_match_key
  )
  values (
    v_name,
    null,
    v_name,
    v_category,
    v_hue,
    v_key
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Catalog creation goes through ensure_product so canonicalization and locking
-- cannot be bypassed by an ordinary authenticated client.
drop policy if exists products_insert_authenticated on public.products;
revoke insert on public.products from authenticated;

revoke all on function public.ensure_product(text, text) from public;
grant execute on function public.ensure_product(text, text) to authenticated;
grant execute on function public.canonical_product_key(text) to authenticated;
