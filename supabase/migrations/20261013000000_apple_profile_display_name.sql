-- Prefer Apple/Google name metadata when creating profiles for social sign-up.
-- Apple only returns the person's name on the first authorization; later
-- sign-ins rely on Auth user_metadata that we persist client-side.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(
      trim(
        concat_ws(
          ' ',
          nullif(trim(new.raw_user_meta_data->>'given_name'), ''),
          nullif(trim(new.raw_user_meta_data->>'family_name'), '')
        )
      ),
      ''
    ),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'DAN user'
  );

  insert into public.profiles (id, auth_user_id, display_name)
  values (new.id, new.id, left(v_name, 80));

  return new;
end;
$$;
