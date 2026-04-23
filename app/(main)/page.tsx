/**
 * app/(main)/page.tsx
 * Feed page — home route (/)
 *
 * Server Component. Runs the initial works query (page 0) server-side so
 * the feed renders with real content on first load (SSR). Passes results
 * to FeedClient which owns all interactive behaviour.
 *
 * URL params:
 *   ?tab=new        — New tab (default, most recent works)
 *   ?tab=popular    — Popular tab (most-liked in last 30 days)
 *   ?category=slug  — Filter by category id (optional)
 *
 * The `key` prop on <FeedClient> causes it to fully remount whenever the
 * tab or category changes, cleanly resetting infinite scroll state and
 * replacing works with the fresh SSR batch.
 *
 * Popular tab scoring decision (Phase 3):
 *   Formula: ORDER BY like_count DESC WHERE created_at > NOW() - 30 days
 *   Rationale: Simple proxy that produces a sensible result at MVP scale.
 *   A time-decay formula (e.g. Hacker News gravity) can replace this
 *   post-launch once there is enough content to surface the difference.
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import FeedClient from '@/components/feed/FeedClient'
import type { WorkCardWork } from '@/components/work/WorkCard'

// ---------------------------------------------------------------------------
// Metadata — static, does not depend on dynamic data
// ---------------------------------------------------------------------------
// @vercel/og dynamic OG image: deferred post-launch.
// Text-based metadata satisfies the Phase 3 milestone.
export const metadata: Metadata = {
  title: 'ArtisanForge — 3D models, painted minis, and digital art',
  description:
    'Discover and purchase works from independent creators — 3D models, painted miniatures, digital art, and print-on-demand products.',
  openGraph: {
    title: 'ArtisanForge — 3D models, painted minis, and digital art',
    description:
      'Discover and purchase works from independent creators — 3D models, painted miniatures, digital art, and print-on-demand products.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArtisanForge — 3D models, painted minis, and digital art',
    description:
      'Discover and purchase works from independent creators — 3D models, painted miniatures, digital art, and print-on-demand products.',
  },
}

// ---------------------------------------------------------------------------
// Constants (must match FeedClient.tsx)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 12
const POPULAR_WINDOW_DAYS = 30

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface FeedPageProps {
  searchParams: Promise<{
    tab?: string
    category?: string
  }>
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { tab: rawTab, category } = await searchParams

  // Normalise tab: only 'popular' is a valid non-default value
  const tab = rawTab === 'popular' ? 'popular' : 'new'

  // ------------------------------------------------------------------
  // Initial query (SSR — page 0 only)
  // ------------------------------------------------------------------
  const supabase = await createClient()

  let query = supabase
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
    .eq('is_published', true)
    .order(tab === 'popular' ? 'like_count' : 'created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  if (tab === 'popular') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - POPULAR_WINDOW_DAYS)
    query = query.gte('created_at', cutoff.toISOString())
  }

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    console.error('[FeedPage] initial query error:', error.message)
  }

  const initialWorks = (data ?? []) as unknown as WorkCardWork[]

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/*
        key causes FeedClient to fully remount when tab or category changes.
        This resets all scroll/pagination state and starts fresh with the
        new initialWorks from the server query above.
      */}
      <FeedClient
        key={`${tab}-${category ?? 'all'}`}
        initialWorks={initialWorks}
        tab={tab}
        category={category}
      />
    </div>
  )
}
