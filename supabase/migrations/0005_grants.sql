-- Grants for anon browsing + authenticated mutations (Supabase defaults may already include these)

grant usage on schema public to anon, authenticated;

grant select on public.products to anon, authenticated;
grant select on public.demands to anon, authenticated;
grant select on public.buy_demand_aggregates to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.demands to authenticated;
grant select, insert, update on public.ownerships to authenticated;
grant select, insert, update on public.sell_intents to authenticated;
grant select, insert, update on public.responses to authenticated;
grant select on public.matches to authenticated;
grant insert on public.products to authenticated;

-- Matches are mutated only via security definer RPCs
grant execute on function public.express_buyer_interest(uuid, uuid) to authenticated;
grant execute on function public.seller_connect_match(uuid) to authenticated;
grant execute on function public.accept_response(uuid) to authenticated;
grant execute on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz) to authenticated;
