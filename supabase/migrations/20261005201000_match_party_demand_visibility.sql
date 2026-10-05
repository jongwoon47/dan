-- Keep request context readable to both parties after a response is accepted.
-- Public discovery remains ACTIVE-only; this adds access only when the viewer is
-- a buyer/seller on a persisted match for that exact demand.

drop policy if exists demands_select_public_or_own on public.demands;
create policy demands_select_public_or_own
on public.demands for select
using (
  user_id = auth.uid()
  or (
    status = 'ACTIVE'
    and (expires_at is null or expires_at > now())
    and (
      auth.uid() is null
      or not public.interaction_blocked_with(user_id)
    )
    and (
      type <> 'BUY'
      or exists (
        select 1
        from public.products p
        where p.id = demands.product_id
          and public.marketplace_product_allowed(p.canonical_name)
      )
    )
  )
  or exists (
    select 1
    from public.matches m
    where m.demand_id = demands.id
      and auth.uid() in (m.buyer_id, m.seller_id)
  )
);
