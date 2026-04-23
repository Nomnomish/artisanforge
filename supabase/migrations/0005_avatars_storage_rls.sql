-- 0005_avatars_storage_rls.sql
-- RLS policies for the `avatars` Supabase Storage bucket.
--
-- Bucket characteristics:
--   Name:   avatars
--   Public: true  (images served via CDN without signed URLs)
--
-- File path convention: {user_id}/avatar.{ext}
--   e.g. 550e8400-e29b-41d4-a716-446655440000/avatar.webp
--
-- IMPORTANT: Create the bucket manually in the Supabase dashboard before
-- running this migration (Storage → New bucket → name: avatars, public: on).
-- This migration only creates the RLS policies — bucket creation is not
-- possible via SQL migration in Supabase.
--
-- Policy summary:
--   Public read   — anyone can read any avatar (required for feed cards, profiles)
--   Owner insert  — authenticated user can only upload into their own folder
--   Owner update  — authenticated user can only overwrite their own avatar
--   Owner delete  — authenticated user can only delete their own avatar

-- ---------------------------------------------------------------------------
-- Public read — anyone (including unauthenticated visitors) can read avatars
-- ---------------------------------------------------------------------------
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- Owner insert — user can only upload into their own {user_id}/ folder
-- ---------------------------------------------------------------------------
create policy "avatars: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Owner update — user can only overwrite files in their own folder
-- ---------------------------------------------------------------------------
create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Owner delete — user can only delete files in their own folder
-- ---------------------------------------------------------------------------
create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
