-- Anonymous discovery must not evaluate the authenticated-only block helper.
-- Preserve migration 0045's RPC execution boundary and all authenticated filters.
alter policy demands_select_public_or_own on public.demands to authenticated;

create policy demands_select_anonymous_active
on public.demands for select to anon
using (
  status = 'ACTIVE'
  and (expires_at is null or expires_at > now())
  and (
    type <> 'BUY'
    or exists (
      select 1 from public.products p
      where p.id = demands.product_id
        and public.marketplace_product_allowed(p.canonical_name)
    )
  )
);
