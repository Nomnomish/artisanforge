-- =============================================================================
-- Migration: 0002_rls_policies.sql
-- Description: Row Level Security policies for all ArtisanForge tables
-- Depends on: 0001_initial_schema.sql
--
-- TESTING INSTRUCTIONS (run each section in Supabase dashboard SQL editor):
-- After running this migration, test every policy using the instructions
-- in the comments above each table's policies.
-- =============================================================================


-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- Enabling RLS with no policies = total lockout (no reads or writes for anyone).
-- The policies below open up exactly what should be accessible and nothing more.
-- =============================================================================
alter table public.users          enable row level security;
alter table public.works          enable row level security;
alter table public.work_files     enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.follows        enable row level security;
alter table public.likes          enable row level security;
alter table public.comments       enable row level security;
alter table public.notifications  enable row level security;
alter table public.reports        enable row level security;


-- =============================================================================
-- USERS
-- Read: Public — anyone can view profiles (needed for feed, search, profile pages)
-- Update: Self only — users can only edit their own profile
-- Insert: Handled by trigger in 0003_triggers.sql (runs as superuser, bypasses RLS)
-- Delete: Cascade from auth.users deletion — no direct delete policy needed
--
-- TEST:
--   As anon: SELECT * FROM public.users; → should return rows
--   As user A: UPDATE public.users SET bio='x' WHERE id = <user_B_id>; → should fail
--   As user A: UPDATE public.users SET bio='x' WHERE id = <user_A_id>; → should succeed
-- =============================================================================
create policy "users_select_public"
  on public.users for select
  using (true);

create policy "users_update_self"
  on public.users for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);


-- =============================================================================
-- WORKS
-- Read: Public if published; owner sees their own drafts too
-- Insert/Update/Delete: Owner only
--
-- TEST:
--   As anon: SELECT * FROM public.works WHERE is_published = true; → should return rows
--   As anon: SELECT * FROM public.works WHERE is_published = false; → should return 0 rows
--   As owner: SELECT * FROM public.works WHERE user_id = auth.uid(); → all (drafts too)
--   As user B: UPDATE public.works SET title='x' WHERE user_id = <user_A_id>; → should fail
-- =============================================================================
create policy "works_select_published_or_owner"
  on public.works for select
  using (
    is_published = true
    or (select auth.uid()) = user_id
  );

create policy "works_insert_owner"
  on public.works for insert
  with check ((select auth.uid()) = user_id);

create policy "works_update_owner"
  on public.works for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "works_delete_owner"
  on public.works for delete
  using ((select auth.uid()) = user_id);


-- =============================================================================
-- WORK FILES
-- Read: Readable if parent work is published, or viewer owns the parent work
-- Insert/Update/Delete: Owner of the parent work only
-- Note: No user_id column here — ownership determined by joining to works
--
-- TEST:
--   As anon: SELECT wf.* FROM public.work_files wf
--            JOIN public.works w ON w.id = wf.work_id
--            WHERE w.is_published = true; → should return rows
--   As anon: SELECT * FROM public.work_files WHERE work_id = <draft_work_id>; → 0 rows
-- =============================================================================
create policy "work_files_select_published_or_owner"
  on public.work_files for select
  using (
    exists (
      select 1 from public.works
      where works.id = work_files.work_id
      and (
        works.is_published = true
        or works.user_id = (select auth.uid())
      )
    )
  );

create policy "work_files_insert_owner"
  on public.work_files for insert
  with check (
    exists (
      select 1 from public.works
      where works.id = work_files.work_id
      and works.user_id = (select auth.uid())
    )
  );

create policy "work_files_update_owner"
  on public.work_files for update
  using (
    exists (
      select 1 from public.works
      where works.id = work_files.work_id
      and works.user_id = (select auth.uid())
    )
  );

create policy "work_files_delete_owner"
  on public.work_files for delete
  using (
    exists (
      select 1 from public.works
      where works.id = work_files.work_id
      and works.user_id = (select auth.uid())
    )
  );


-- =============================================================================
-- PRODUCTS
-- Read: Public if active; owner sees their own inactive products too
-- Insert/Update/Delete: Owner only
--
-- TEST:
--   As anon: SELECT * FROM public.products WHERE is_active = true; → should return rows
--   As anon: SELECT * FROM public.products WHERE is_active = false; → 0 rows
--   As owner: SELECT * FROM public.products WHERE user_id = auth.uid(); → all (active + inactive)
-- =============================================================================
create policy "products_select_active_or_owner"
  on public.products for select
  using (
    is_active = true
    or (select auth.uid()) = user_id
  );

create policy "products_insert_owner"
  on public.products for insert
  with check ((select auth.uid()) = user_id);

create policy "products_update_owner"
  on public.products for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "products_delete_owner"
  on public.products for delete
  using ((select auth.uid()) = user_id);


-- =============================================================================
-- ORDERS
-- Read: Buyer sees their own orders; sellers see orders containing their products
-- Insert: Authenticated users only (buyer creates the order at checkout)
-- Update: No policy — only service role (API route webhook handler) updates orders.
--         Service role bypasses RLS entirely — no policy needed here.
-- Delete: No policy — orders are never deleted
--
-- TEST:
--   As buyer: SELECT * FROM public.orders WHERE buyer_id = auth.uid(); → own orders only
--   As user C (not buyer or seller): SELECT * FROM public.orders; → 0 rows
-- =============================================================================
create policy "orders_select_buyer_or_seller"
  on public.orders for select
  using (
    (select auth.uid()) = buyer_id
    or exists (
      select 1 from public.order_items
      where order_items.order_id = orders.id
      and order_items.seller_id = (select auth.uid())
    )
  );

create policy "orders_insert_authenticated"
  on public.orders for insert
  with check ((select auth.uid()) = buyer_id);


-- =============================================================================
-- ORDER ITEMS
-- Read: Buyer (via parent order) or seller of the item
-- Insert/Update: No policy — service role only (created and updated in API routes)
-- Delete: No policy — order items are never deleted
--
-- TEST:
--   As seller: SELECT * FROM public.order_items WHERE seller_id = auth.uid(); → own items
--   As buyer: SELECT oi.* FROM public.order_items oi
--             JOIN public.orders o ON o.id = oi.order_id
--             WHERE o.buyer_id = auth.uid(); → their purchased items
--   As random user: SELECT * FROM public.order_items; → 0 rows
-- =============================================================================
create policy "order_items_select_buyer_or_seller"
  on public.order_items for select
  using (
    (select auth.uid()) = seller_id
    or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.buyer_id = (select auth.uid())
    )
  );


-- =============================================================================
-- FOLLOWS
-- Read: Public — follow relationships are visible to all
-- Insert: Self only — you can only create follows as yourself (follower_id = you)
-- Delete: Self only — you can only unfollow as yourself
--
-- TEST:
--   As anon: SELECT * FROM public.follows; → should return rows
--   As user A: INSERT INTO public.follows (follower_id, following_id)
--              VALUES (<user_B_id>, <user_C_id>); → should fail (not your follower_id)
-- =============================================================================
create policy "follows_select_public"
  on public.follows for select
  using (true);

create policy "follows_insert_self"
  on public.follows for insert
  with check ((select auth.uid()) = follower_id);

create policy "follows_delete_self"
  on public.follows for delete
  using ((select auth.uid()) = follower_id);


-- =============================================================================
-- LIKES
-- Read: Public — like counts and who liked are visible to all
-- Insert: Self only — you can only like as yourself
-- Delete: Self only — you can only unlike as yourself
--
-- TEST:
--   As anon: SELECT * FROM public.likes; → should return rows
--   As user A: INSERT INTO public.likes (user_id, work_id)
--              VALUES (<user_B_id>, <work_id>); → should fail
-- =============================================================================
create policy "likes_select_public"
  on public.likes for select
  using (true);

create policy "likes_insert_self"
  on public.likes for insert
  with check ((select auth.uid()) = user_id);

create policy "likes_delete_self"
  on public.likes for delete
  using ((select auth.uid()) = user_id);


-- =============================================================================
-- COMMENTS
-- Read: Public — comments on published works are visible to all
-- Insert: Authenticated users only, and user_id must match the commenter
-- Delete: Own comments only
-- Update: No policy — comments cannot be edited in Gen1
--
-- TEST:
--   As anon: SELECT * FROM public.comments; → should return rows
--   As user A: INSERT INTO public.comments (work_id, user_id, content)
--              VALUES (<id>, <user_B_id>, 'x'); → should fail (user_id mismatch)
--   As user A: DELETE FROM public.comments WHERE user_id = <user_B_id>; → should fail
-- =============================================================================
create policy "comments_select_public"
  on public.comments for select
  using (true);

create policy "comments_insert_authenticated"
  on public.comments for insert
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

create policy "comments_delete_own"
  on public.comments for delete
  using ((select auth.uid()) = user_id);


-- =============================================================================
-- NOTIFICATIONS
-- Read: Recipient only — you only see your own notifications
-- Update: Recipient only — for marking notifications as read
-- Insert: No policy — service role only (inserted by triggers in 0003)
-- Delete: No policy — notifications are not deleted in Gen1
--
-- TEST:
--   As user A: SELECT * FROM public.notifications WHERE user_id = auth.uid(); → own only
--   As user A: SELECT * FROM public.notifications WHERE user_id = <user_B_id>; → 0 rows
-- =============================================================================
create policy "notifications_select_recipient"
  on public.notifications for select
  using ((select auth.uid()) = user_id);

create policy "notifications_update_recipient"
  on public.notifications for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- =============================================================================
-- REPORTS
-- Read: Reporter sees their own; admin sees all
-- Insert: Authenticated users only
-- Update: Admin only (changing status: pending → reviewed → resolved)
-- Delete: No policy — reports are never deleted
--
-- TEST:
--   As reporter: SELECT * FROM public.reports WHERE reporter_id = auth.uid(); → own reports
--   As random user: SELECT * FROM public.reports WHERE reporter_id = <other_id>; → 0 rows
--   As admin: SELECT * FROM public.reports; → all reports
-- =============================================================================
create policy "reports_select_own_or_admin"
  on public.reports for select
  using (
    (select auth.uid()) = reporter_id
    or exists (
      select 1 from public.users
      where users.id = (select auth.uid())
      and users.is_admin = true
    )
  );

create policy "reports_insert_authenticated"
  on public.reports for insert
  with check ((select auth.uid()) is not null);

create policy "reports_update_admin"
  on public.reports for update
  using (
    exists (
      select 1 from public.users
      where users.id = (select auth.uid())
      and users.is_admin = true
    )
  );
