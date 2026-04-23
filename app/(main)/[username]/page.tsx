/**
 * app/(main)/[username]/page.tsx
 *
 * Creator profile page — /[username]
 *
 * Server Component. Data fetching strategy:
 *   1. Fetch profile by username (single indexed query — fast).
 *      404 immediately if not found.
 *   2. Fetch works + auth user in parallel (both independent of each other).
 *   3. If viewer is authenticated and not the profile owner, check follow status.
 *      (Sequential after step 2, but only runs for authenticated non-owners.)
 *
 * Works grid uses WorkCard — includes users!works_user_id_fkey join for
 * WorkCard compatibility (required per Phase 2 FK disambiguation rule).
 *
 * Follow button:
 *   - Own profile → "Edit Profile" link shown instead
 *   - Authenticated visitor → FollowButton with real initialIsFollowing value
 *   - Unauthenticated visitor → FollowButton with initialIsFollowing=false
 *     (redirects to /login on click)
 *
 * Phase 6 TODO: follower/following counts link to sub-pages
 * Phase 6 TODO: active products section below the works grid
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import WorkCard, { WorkCardWork } from '@/components/work/WorkCard'
import FollowButton from '@/components/profile/FollowButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ username: string }>
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('username, bio')
    .eq('username', username)
    .single()

  if (!profile) {
    return { title: 'Profile not found — ArtisanForge' }
  }

  return {
    title: `${profile.username} — ArtisanForge`,
    description: profile.bio ?? `View ${profile.username}'s works on ArtisanForge.`,
    openGraph: {
      title: `${profile.username} — ArtisanForge`,
      description: profile.bio ?? `View ${profile.username}'s works on ArtisanForge.`,
    },
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params
  const supabase = await createClient()

  // ── Step 1: fetch profile ─────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('id, username, bio, avatar_url, follower_count, following_count')
    .eq('username', username)
    .single()

  if (!profile) notFound()

  // ── Step 2: works + auth user in parallel ─────────────────────────────────
  const [worksResult, { data: { user } }] = await Promise.all([
    supabase
      .from('works')
      .select(`
        id,
        title,
        category,
        tags,
        like_count,
        created_at,
        users!works_user_id_fkey (username, avatar_url),
        work_files (thumbnail_url)
      `)
      .eq('user_id', profile.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(24),
    supabase.auth.getUser(),
  ])

  const works = (worksResult.data ?? []) as unknown as WorkCardWork[]
  const isOwnProfile = user?.id === profile.id

  // ── Step 3: follow status (authenticated non-owners only) ─────────────────
  let initialIsFollowing = false
  if (user && !isOwnProfile) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .maybeSingle()
    initialIsFollowing = followRow !== null
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">

      {/* ------------------------------------------------------------------ */}
      {/* Profile header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10">

        {/* Avatar */}
        <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-indigo-100">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.username}
              fill
              sizes="80px"
              className="object-cover"
              priority
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-indigo-600">
              {profile.username.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>

            {/* Action button */}
            {isOwnProfile ? (
              <Link
                href="/settings/profile"
                className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit profile
              </Link>
            ) : (
              <FollowButton
                targetUserId={profile.id}
                initialIsFollowing={initialIsFollowing}
              />
            )}
          </div>

          {/* Follower / following counts */}
          {/* Phase 6 TODO: wrap these in Links to /[username]/followers and /[username]/following */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              <span className="font-semibold text-gray-900">{profile.follower_count}</span>{' '}
              {profile.follower_count === 1 ? 'follower' : 'followers'}
            </span>
            <span>
              <span className="font-semibold text-gray-900">{profile.following_count}</span>{' '}
              following
            </span>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-gray-600 leading-relaxed max-w-lg whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Works grid */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Works{works.length > 0 && <span className="ml-2 text-gray-400">({works.length})</span>}
        </h2>

        {works.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <span className="text-4xl">🎨</span>
            <p className="text-sm text-gray-500">
              {isOwnProfile
                ? "You haven't published any works yet."
                : `${profile.username} hasn't published any works yet.`}
            </p>
            {isOwnProfile && (
              <Link
                href="/works/new"
                className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Upload your first work
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {works.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </section>

      {/* Phase 6 TODO: active products section */}

    </main>
  )
}
