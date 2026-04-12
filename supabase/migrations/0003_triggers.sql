-- =============================================================================
-- Migration: 0003_triggers.sql
-- Description: Postgres triggers for ArtisanForge
-- Contains: Trigger functions and trigger definitions
-- Depends on: 0001_initial_schema.sql, 0002_rls_policies.sql
--
-- Triggers defined here:
--   1. on_auth_user_created     — auto-creates public.users row on signup
--   2. on_like_change           — maintains works.like_count
--   3. on_comment_change        — maintains works.comment_count
--   4. on_follow_change         — maintains users.follower_count + following_count
-- =============================================================================


-- =============================================================================
-- TRIGGER 1: Auto-create public.users profile on signup
--
-- Fires: AFTER INSERT on auth.users (Supabase's internal auth table)
-- Why: Every user needs a public profile row. Doing this in a trigger
--      guarantees it happens atomically with signup — no orphaned auth
--      users without a profile, regardless of what happens in the app layer.
--
-- Username generation: uses the first part of the email address, strips
-- non-alphanumeric characters, and appends a short random suffix to avoid
-- collisions (e.g. "johndoe_a3f2"). This is a safe default — users can
-- update their username in /settings/profile.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix text;
begin
  -- Derive a base username from the email address prefix.
  -- Strips everything after @ and removes non-alphanumeric characters.
  base_username := lower(
    regexp_replace(
      split_part(new.email, '@', 1),
      '[^a-z0-9]', '', 'g'
    )
  );

  -- Ensure base username is not empty (edge case: email starts with special chars)
  if base_username = '' then
    base_username := 'user';
  end if;

  -- Truncate to 20 chars to leave room for suffix
  base_username := left(base_username, 20);

  -- Generate a 4-character random alphanumeric suffix to avoid collisions
  suffix := lower(substring(md5(random()::text) from 1 for 4));
  final_username := base_username || '_' || suffix;

  insert into public.users (id, username)
  values (new.id, final_username);

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auto-creates a public.users profile row when a new auth.users row is inserted on signup.';

-- Attach to auth.users — fires after every new signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- =============================================================================
-- TRIGGER 2: Maintain works.like_count
--
-- Fires: AFTER INSERT or DELETE on public.likes
-- Why: Storing like_count as a column avoids an expensive COUNT(*) query
--      every time a work card is rendered. The trigger keeps it accurate.
-- =============================================================================

create or replace function public.handle_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.works
    set like_count = like_count + 1
    where id = new.work_id;

  elsif (tg_op = 'DELETE') then
    update public.works
    set like_count = greatest(like_count - 1, 0)
    where id = old.work_id;
  end if;

  return null; -- Return value ignored for AFTER triggers
end;
$$;

comment on function public.handle_like_change() is
  'Increments or decrements works.like_count when a like is inserted or deleted.';

create trigger on_like_change
  after insert or delete on public.likes
  for each row
  execute function public.handle_like_change();


-- =============================================================================
-- TRIGGER 3: Maintain works.comment_count
--
-- Fires: AFTER INSERT or DELETE on public.comments
-- Same rationale as like_count — avoids COUNT(*) on every work page load.
-- =============================================================================

create or replace function public.handle_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.works
    set comment_count = comment_count + 1
    where id = new.work_id;

  elsif (tg_op = 'DELETE') then
    update public.works
    set comment_count = greatest(comment_count - 1, 0)
    where id = old.work_id;
  end if;

  return null;
end;
$$;

comment on function public.handle_comment_change() is
  'Increments or decrements works.comment_count when a comment is inserted or deleted.';

create trigger on_comment_change
  after insert or delete on public.comments
  for each row
  execute function public.handle_comment_change();


-- =============================================================================
-- TRIGGER 4: Maintain users.follower_count and users.following_count
--
-- Fires: AFTER INSERT or DELETE on public.follows
-- Two counts are updated per event:
--   - The followed user's follower_count (they gained/lost a follower)
--   - The follower's following_count (they are following one more/fewer creator)
-- =============================================================================

create or replace function public.handle_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    -- The followed user gains a follower
    update public.users
    set follower_count = follower_count + 1
    where id = new.following_id;

    -- The follower is now following one more person
    update public.users
    set following_count = following_count + 1
    where id = new.follower_id;

  elsif (tg_op = 'DELETE') then
    -- The followed user loses a follower
    update public.users
    set follower_count = greatest(follower_count - 1, 0)
    where id = old.following_id;

    -- The follower is now following one fewer person
    update public.users
    set following_count = greatest(following_count - 1, 0)
    where id = old.follower_id;
  end if;

  return null;
end;
$$;

comment on function public.handle_follow_change() is
  'Maintains follower_count and following_count on users when a follow is inserted or deleted.';

create trigger on_follow_change
  after insert or delete on public.follows
  for each row
  execute function public.handle_follow_change();
