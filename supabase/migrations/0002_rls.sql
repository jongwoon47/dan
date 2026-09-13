-- RLS policies for DAN (anon key + authenticated user only)

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.demands enable row level security;
alter table public.ownerships enable row level security;
alter table public.sell_intents enable row level security;
alter table public.responses enable row level security;
alter table public.matches enable row level security;

-- profiles
create policy profiles_select_authenticated
  on public.profiles for select to authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- products: public catalog readable by anyone
create policy products_select_all
  on public.products for select
  using (true);

create policy products_insert_authenticated
  on public.products for insert to authenticated
  with check (true);

-- demands: ACTIVE (+ not expired) public read; own write
create policy demands_select_public_or_own
  on public.demands for select
  using (
    (
      status = 'ACTIVE'
      and (expires_at is null or expires_at > now())
    )
    or user_id = auth.uid()
  );

create policy demands_insert_own
  on public.demands for insert to authenticated
  with check (user_id = auth.uid());

create policy demands_update_own
  on public.demands for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy demands_delete_own
  on public.demands for delete to authenticated
  using (user_id = auth.uid());

-- ownerships: own rows, or rows backing an OPEN sell intent (for candidate checks)
create policy ownerships_select_own_or_open_sell
  on public.ownerships for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sell_intents s
      where s.ownership_id = ownerships.id
        and s.status = 'OPEN'
    )
  );

create policy ownerships_insert_own
  on public.ownerships for insert to authenticated
  with check (user_id = auth.uid());

create policy ownerships_update_own
  on public.ownerships for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- sell_intents: owner + demand-compatible buyers may need to see OPEN intents
-- for candidate computation. Allow authenticated users to read OPEN intents.
create policy sell_intents_select_open_or_own
  on public.sell_intents for select to authenticated
  using (status = 'OPEN' or user_id = auth.uid());

create policy sell_intents_insert_own
  on public.sell_intents for insert to authenticated
  with check (user_id = auth.uid());

create policy sell_intents_update_own
  on public.sell_intents for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- responses: demand owner + responder
create policy responses_select_parties
  on public.responses for select to authenticated
  using (
    responder_id = auth.uid()
    or exists (
      select 1 from public.demands d
      where d.id = demand_id and d.user_id = auth.uid()
    )
  );

create policy responses_insert_own
  on public.responses for insert to authenticated
  with check (responder_id = auth.uid());

create policy responses_update_own_or_demand_owner
  on public.responses for update to authenticated
  using (
    responder_id = auth.uid()
    or exists (
      select 1 from public.demands d
      where d.id = demand_id and d.user_id = auth.uid()
    )
  )
  with check (
    responder_id = auth.uid()
    or exists (
      select 1 from public.demands d
      where d.id = demand_id and d.user_id = auth.uid()
    )
  );

-- matches: only parties
create policy matches_select_parties
  on public.matches for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Direct insert/update of matches is denied; use RPCs (security definer)
-- No insert/update/delete policies for authenticated on matches.
