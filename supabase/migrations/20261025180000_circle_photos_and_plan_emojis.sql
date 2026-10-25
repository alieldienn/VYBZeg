-- =============================================================================
-- VYBZ: circle photos and custom plan emojis.
--
-- circle-images  PUBLIC bucket, like avatars: a circle's cover photo can be
--                viewed by anyone with its (random, unguessable) link, so the
--                circle list, invites and notifications can show it simply.
--                Path: <circle_id>/<file>. Only the circle's owner and admins
--                (the people who may edit the circle) can add or remove files.
--
-- poll_options.emoji  The emoji the plan's creator picked for an option.
--                     Null means "use the category's emoji" (older plans).
-- =============================================================================

-- circles ----------------------------------------------------------------------
alter table public.circles add column image_path text;
alter table public.circles add constraint circle_image_path_owned check (
  image_path is null or image_path like (id::text || '/%')
);
grant update (image_path) on public.circles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('circle-images', 'circle-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when `folder` is the id of a circle the signed-in user owns or admins.
-- Folder names come from user input, so a malformed id just means "no".
create function private.is_circle_admin_folder(folder text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return private.is_circle_admin(folder::uuid);
exception
  when invalid_text_representation then return false;
end;
$$;
revoke all on function private.is_circle_admin_folder(text) from public, anon;
grant execute on function private.is_circle_admin_folder(text) to authenticated;

create policy "Circle admins upload circle photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'circle-images' and private.is_circle_admin_folder((storage.foldername(name))[1]));

-- Needed so admins can manage (list/delete) the files. Viewing goes through
-- the public URL and doesn't use this policy.
create policy "Circle admins manage circle photo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'circle-images' and private.is_circle_admin_folder((storage.foldername(name))[1]));

create policy "Circle admins delete circle photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'circle-images' and private.is_circle_admin_folder((storage.foldername(name))[1]));

-- poll options -----------------------------------------------------------------
alter table public.poll_options add column emoji text
  constraint option_emoji_length check (char_length(emoji) between 1 and 16);
grant insert (emoji) on public.poll_options to authenticated;

-- Same as before, plus each option's emoji.
create or replace function public.create_poll(
  p_circle_id uuid,
  p_question text,
  p_when_label text,
  p_closes_at timestamptz,
  p_options jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_poll_id uuid;
begin
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 6 then
    raise exception 'A plan needs between 2 and 6 options.' using errcode = '22023';
  end if;

  insert into public.polls (circle_id, question, when_label, closes_at)
  values (p_circle_id, btrim(p_question), nullif(btrim(p_when_label), ''), p_closes_at)
  returning id into v_poll_id;

  insert into public.poll_options (poll_id, option_text, category, detail, emoji, position)
  select
    v_poll_id,
    btrim(o ->> 'text'),
    coalesce(o ->> 'category', 'outing'),
    nullif(btrim(o ->> 'detail'), ''),
    nullif(btrim(o ->> 'emoji'), ''),
    (ord - 1)::smallint
  from jsonb_array_elements(p_options) with ordinality as t(o, ord);

  return v_poll_id;
end;
$$;
