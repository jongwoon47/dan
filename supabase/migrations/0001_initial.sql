-- DAN initial schema (demands-first)
-- Compatible with Supabase Auth (auth.users)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products (BUY catalog / aggregation key — not camera-specific)
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  brand text,
  model text,
  category text not null default 'other'
    check (category in ('electronics','camera','lens','furniture','camping','other')),
  image_hue integer not null default 200,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- demands (center of DAN)
-- ---------------------------------------------------------------------------
create table public.demands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('BUY','BORROW','TASK','SERVICE')),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  category text not null,
  budget numeric(12,0) not null check (budget > 0),
  location text not null default '',
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','MATCHED','CLOSED','EXPIRED')),
  product_id uuid references public.products (id) on delete set null,
  -- BUY-specific (null for non-BUY)
  max_price numeric(12,0) check (max_price is null or max_price > 0),
  condition_preference text check (
    condition_preference is null
    or condition_preference in ('sealed','like_new','lightly_used','any')
  ),
  trade_method text check (
    trade_method is null or trade_method in ('meetup','shipping','any')
  ),
  -- BORROW / TASK / SERVICE detail fields
  item_name text,
  start_at timestamptz,
  end_at timestamptz,
  task_description text,
  service_description text,
  preferred_at timestamptz,
  due_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demands_buy_requires_product check (
    type <> 'BUY' or (product_id is not null and max_price is not null)
  ),
  constraint demands_buy_budget_matches_max check (
    type <> 'BUY' or budget = max_price
  )
);

create index demands_status_type_idx on public.demands (status, type, created_at desc);
create index demands_user_idx on public.demands (user_id, created_at desc);
create index demands_product_active_idx on public.demands (product_id)
  where status = 'ACTIVE' and type = 'BUY';

-- One ACTIVE BUY demand per (user, product)
create unique index demands_active_buy_user_product_uidx
  on public.demands (user_id, product_id)
  where type = 'BUY' and status = 'ACTIVE' and product_id is not null;

-- ---------------------------------------------------------------------------
-- ownerships (BUY)
-- ---------------------------------------------------------------------------
create table public.ownerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  condition text not null check (condition in ('sealed','like_new','lightly_used')),
  status text not null default 'OWNED' check (status in ('OWNED','RELEASED')),
  created_at timestamptz not null default now()
);

create unique index ownerships_owned_user_product_uidx
  on public.ownerships (user_id, product_id)
  where status = 'OWNED';

-- ---------------------------------------------------------------------------
-- sell_intents (BUY)
-- ---------------------------------------------------------------------------
create table public.sell_intents (
  id uuid primary key default gen_random_uuid(),
  ownership_id uuid not null references public.ownerships (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  minimum_price numeric(12,0) not null check (minimum_price > 0),
  status text not null default 'OPEN'
    check (status in ('OPEN','PAUSED','MATCHED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sell_intents_open_ownership_uidx
  on public.sell_intents (ownership_id)
  where status = 'OPEN';

-- ---------------------------------------------------------------------------
-- responses (generic fulfillment intent)
-- ---------------------------------------------------------------------------
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands (id) on delete cascade,
  responder_id uuid not null references public.profiles (id) on delete cascade,
  response_type text not null default 'FULFILL'
    check (response_type in ('FULFILL','OFFER','OTHER')),
  message text not null default '',
  offered_price numeric(12,0) check (offered_price is null or offered_price > 0),
  status text not null default 'OPEN'
    check (status in ('OPEN','ACCEPTED','WITHDRAWN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint responses_not_self check (true) -- enforced via trigger below
);

create unique index responses_open_demand_responder_uidx
  on public.responses (demand_id, responder_id)
  where status = 'OPEN';

create or replace function public.enforce_response_not_self()
returns trigger
language plpgsql
as $$
declare
  demand_owner uuid;
begin
  select user_id into demand_owner from public.demands where id = new.demand_id;
  if demand_owner is null then
    raise exception 'demand not found';
  end if;
  if demand_owner = new.responder_id then
    raise exception 'cannot respond to own demand';
  end if;
  return new;
end;
$$;

create trigger trg_responses_not_self
before insert or update on public.responses
for each row execute function public.enforce_response_not_self();

-- ---------------------------------------------------------------------------
-- matches (persisted intentional states ONLY — never POTENTIAL)
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands (id) on delete cascade,
  sell_intent_id uuid references public.sell_intents (id) on delete set null,
  response_id uuid references public.responses (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  status text not null
    check (status in ('BUYER_INTERESTED','SELLER_ACCEPTED','CONNECTED','DECLINED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_not_self check (buyer_id <> seller_id),
  constraint matches_has_source check (
    sell_intent_id is not null or response_id is not null
  ),
  constraint matches_no_potential check (status <> 'POTENTIAL')
);

create unique index matches_demand_sell_uidx
  on public.matches (demand_id, sell_intent_id)
  where sell_intent_id is not null;

create unique index matches_demand_response_uidx
  on public.matches (demand_id, response_id)
  where response_id is not null;

create index matches_party_idx on public.matches (buyer_id, seller_id, status);

-- ---------------------------------------------------------------------------
-- Aggregated BUY demand view (derived — not materialized rows)
-- ---------------------------------------------------------------------------
create or replace view public.buy_demand_aggregates
with (security_invoker = true)
as
select
  p.id as product_id,
  count(distinct d.user_id)::integer as seeker_count,
  min(d.max_price)::numeric as min_price,
  max(d.max_price)::numeric as max_price,
  round(avg(d.max_price))::numeric as avg_price,
  max(d.max_price)::numeric as highest_intent_price,
  count(*) filter (
    where d.created_at >= now() - interval '7 days'
  )::integer as recent_7d_delta
from public.products p
join public.demands d
  on d.product_id = p.id
 and d.type = 'BUY'
 and d.status = 'ACTIVE'
 and (d.expires_at is null or d.expires_at > now())
group by p.id;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();
create trigger trg_demands_updated before update on public.demands
for each row execute function public.set_updated_at();
create trigger trg_sell_intents_updated before update on public.sell_intents
for each row execute function public.set_updated_at();
create trigger trg_responses_updated before update on public.responses
for each row execute function public.set_updated_at();
create trigger trg_matches_updated before update on public.matches
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'DAN user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
