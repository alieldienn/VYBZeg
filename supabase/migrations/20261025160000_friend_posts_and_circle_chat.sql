-- =============================================================================
-- VYBZ: "All friends" posts and circle chat.
--
-- Posts
--   A post with circle_id = null is shared with all of its author's friends
--   (accepted friendships) instead of one circle. Its photo lives in the same
--   private `post-images` bucket under friends/<author_id>/<file>.
--
-- Chat
--   circle_messages holds the chat of each circle. Only members can read and
--   write it, and new messages are pushed to open screens through Realtime.
-- =============================================================================

-- posts ------------------------------------------------------------------------
alter table public.posts alter column circle_id drop not null;

alter table public.posts drop constraint post_image_path_owned;
alter table public.posts add constraint post_image_path_owned check (
  image_path is null
  or image_path like (coalesce(circle_id::text, 'friends') || '/' || author_id::text || '/%')
);

create index posts_friends_created_idx on public.posts (author_id, created_at desc) where circle_id is null;

-- Who may see a post with this circle and author: circle posts go to members,
-- "All friends" posts to the author and their friends.
create function private.can_view_post_of(p_circle_id uuid, p_author_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_circle_id is not null then private.is_circle_member(p_circle_id)
    else p_author_id = (select auth.uid()) or private.are_friends(p_author_id, (select auth.uid()))
  end;
$$;
revoke all on function private.can_view_post_of(uuid, uuid) from public, anon;
grant execute on function private.can_view_post_of(uuid, uuid) to authenticated;

-- Reactions and comments follow the post, so they pick this up automatically.
create or replace function private.can_view_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and private.can_view_post_of(p.circle_id, p.author_id)
  );
$$;

drop policy "Members read circle posts" on public.posts;
create policy "Members read circle posts, friends read friends posts" on public.posts
  for select to authenticated using (private.can_view_post_of(circle_id, author_id));

drop policy "Members post as themselves" on public.posts;
create policy "Post as yourself to your circles or your friends" on public.posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (circle_id is null or private.is_circle_member(circle_id))
  );

-- post-images: photos of "All friends" posts -----------------------------------

-- True when `folder` is your own id or the id of one of your friends.
-- Folder names come from user input, so a malformed id just means "no".
create function private.is_self_or_friend_folder(folder text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return folder::uuid = (select auth.uid()) or private.are_friends(folder::uuid, (select auth.uid()));
exception
  when invalid_text_representation then return false;
end;
$$;
revoke all on function private.is_self_or_friend_folder(text) from public, anon;
grant execute on function private.is_self_or_friend_folder(text) to authenticated;

drop policy "Members upload post photos to their circle" on storage.objects;
create policy "Upload post photos to your circle or your friends folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (
      (storage.foldername(name))[1] = 'friends'
      or private.is_circle_member_folder((storage.foldername(name))[1])
    )
  );

drop policy "Members view their circle's post photos" on storage.objects;
create policy "Members view circle photos, friends view friends photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-images'
    and (
      ((storage.foldername(name))[1] = 'friends' and private.is_self_or_friend_folder((storage.foldername(name))[2]))
      or private.is_circle_member_folder((storage.foldername(name))[1])
    )
  );

-- circle chat ------------------------------------------------------------------
create table public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null
    constraint message_length check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index circle_messages_circle_created_idx on public.circle_messages (circle_id, created_at desc);
create index circle_messages_author_idx on public.circle_messages (author_id);

revoke all on public.circle_messages from anon, authenticated;
grant select, delete on public.circle_messages to authenticated;
grant insert (circle_id, content) on public.circle_messages to authenticated;

alter table public.circle_messages enable row level security;

create policy "Members read their circle chat" on public.circle_messages
  for select to authenticated using (private.is_circle_member(circle_id));
create policy "Members send messages as themselves" on public.circle_messages
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_circle_member(circle_id));
create policy "Authors and circle admins delete messages" on public.circle_messages
  for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_circle_admin(circle_id));

-- Realtime checks the select policy above before sending a new message to anyone.
alter publication supabase_realtime add table public.circle_messages;
