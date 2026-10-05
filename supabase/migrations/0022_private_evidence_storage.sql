-- DAN V1 private evidence media.
-- Database stores stable storage:// references, never base64 image payloads.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dan-v1-evidence',
  'dan-v1-evidence',
  false,
  1048576,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dan_v1_evidence_insert_own on storage.objects;
create policy dan_v1_evidence_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'dan-v1-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists dan_v1_evidence_update_own on storage.objects;
create policy dan_v1_evidence_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'dan-v1-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'dan-v1-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists dan_v1_evidence_delete_own on storage.objects;
create policy dan_v1_evidence_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'dan-v1-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
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
        and (s.status = 'OPEN' or s.user_id = auth.uid())
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
