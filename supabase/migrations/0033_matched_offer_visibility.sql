-- Keep Quick Offer context readable to both deal parties after OPEN -> MATCHED.
-- Also allow signed access to the seller's Quick Offer photo for the matched buyer.

drop policy if exists sell_intents_select_open_or_own on public.sell_intents;
create policy sell_intents_select_open_or_own
on public.sell_intents for select
to authenticated
using (
  user_id = auth.uid()
  or (
    status = 'OPEN'
    and not public.interaction_blocked_with(user_id)
  )
  or exists (
    select 1
    from public.matches m
    where m.sell_intent_id = sell_intents.id
      and auth.uid() in (m.buyer_id, m.seller_id)
  )
);

drop policy if exists ownerships_select_own_or_open_sell on public.ownerships;
create policy ownerships_select_own_or_open_sell
on public.ownerships for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.sell_intents s
    where s.ownership_id = ownerships.id
      and (
        (
          s.status = 'OPEN'
          and not public.interaction_blocked_with(s.user_id)
        )
        or exists (
          select 1
          from public.matches m
          where m.sell_intent_id = s.id
            and auth.uid() in (m.buyer_id, m.seller_id)
        )
      )
  )
);

drop policy if exists dan_v1_evidence_select_parties on storage.objects;
create policy dan_v1_evidence_select_parties
on storage.objects for select
to authenticated
using (
  bucket_id = 'dan-v1-evidence'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.sell_intents s
      where s.quick_photo_url = 'storage://dan-v1-evidence/' || storage.objects.name
        and (
          (
            s.status = 'OPEN'
            and not public.interaction_blocked_with(s.user_id)
          )
          or s.user_id = auth.uid()
          or exists (
            select 1
            from public.matches m
            where m.sell_intent_id = s.id
              and auth.uid() in (m.buyer_id, m.seller_id)
          )
        )
    )
    or exists (
      select 1
      from public.deal_evidence e
      join public.matches m on m.id = e.match_id
      where e.possession_photo_url = 'storage://dan-v1-evidence/' || storage.objects.name
        and auth.uid() in (m.buyer_id, m.seller_id)
    )
  )
);
