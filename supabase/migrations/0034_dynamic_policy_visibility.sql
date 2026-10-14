-- Apply marketplace restriction changes immediately to discovery.
-- Owners keep access to their own historical demand, but public catalog/feed
-- hides a product as soon as operators restrict it.

grant execute on function public.marketplace_product_allowed(text) to anon;

drop policy if exists products_select_all on public.products;
create policy products_select_all
on public.products for select
using (public.marketplace_product_allowed(canonical_name));

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
);

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
    where d.updated_at >= now() - interval '7 days'
  )::integer as recent_7d_delta
from public.products p
join public.demands d
  on d.product_id = p.id
 and d.type = 'BUY'
 and d.status = 'ACTIVE'
 and d.expires_at > now()
 and public.is_phone_verified_for_live_demand(d.user_id)
where public.marketplace_product_allowed(p.canonical_name)
group by p.id;
