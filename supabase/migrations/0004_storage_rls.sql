-- 0004_storage_rls.sql
-- Storage RLS policies for works-public and works-private buckets
-- Files are namespaced by user_id: storage/works-public/{user_id}/{filename}

-- ============================================================
-- works-public bucket
-- ============================================================

-- Anyone can read public files (thumbnails, preview GLB/OBJ, images)
create policy "works-public: public read"
on storage.objects for select
using (bucket_id = 'works-public');

-- Authenticated users can upload to their own folder only
create policy "works-public: owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'works-public'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can update their own files
create policy "works-public: owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'works-public'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can delete their own files
create policy "works-public: owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'works-public'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- works-private bucket
-- ============================================================

-- No public read — signed URLs are generated server-side and bypass RLS
-- Authenticated users can upload to their own folder only
create policy "works-private: owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'works-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can update their own files
create policy "works-private: owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'works-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can delete their own files
create policy "works-private: owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'works-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can read their own private files directly (for signed URL generation)
create policy "works-private: owner select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'works-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);
