-- =============================================================================
-- VYBZ: photo storage buckets and their access rules.
--
-- avatars      PUBLIC bucket. Profile photos, like most social apps. Anyone with
--              the (random, unguessable) link can view one. Path: <user_id>/<file>
-- post-images  PRIVATE bucket. Only members of the circle can read, and only via
--              short-lived signed URLs. Path: <circle_id>/<user_id>/<file>
--
-- Size and file-type limits are enforced by Storage itself, not just the app.
-- No UPDATE policies: files are never overwritten (every upload gets a new name).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('post-images', 'post-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when `folder` is the id of a circle the signed-in user belongs to.
-- Folder names come from user input, so a malformed id just means "no".
create function private.is_circle_member_folder(folder text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return private.is_circle_member(folder::uuid);
exception
  when invalid_text_representation then return false;
end;
$$;
revoke all on function private.is_circle_member_folder(text) from public, anon;
grant execute on function private.is_circle_member_folder(text) to authenticated;

-- avatars ----------------------------------------------------------------------
create policy "Upload avatars to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Needed so you can manage (list/delete) your own files. Viewing avatars goes
-- through the public URL and doesn't use this policy.
create policy "Manage your own avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Delete your own avatar files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- post-images ------------------------------------------------------------------
create policy "Members upload post photos to their circle" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and private.is_circle_member_folder((storage.foldername(name))[1])
  );

create policy "Members view their circle's post photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-images'
    and private.is_circle_member_folder((storage.foldername(name))[1])
  );

create policy "Delete your own post photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
