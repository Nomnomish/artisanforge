'use client'

/**
 * components/feed/FeedClient.tsx
 *
 * Client-side shell for the feed page. Owns:
 *   - Tab UI (New / Popular)
 *   - Category filter chips
 *   - Infinite scroll (Intersection Observer + Supabase .range())
 *
 * Receives `initialWorks` (first 12 results) from the Server Component parent.
 * The parent renders this component with a `key={tab-category}` prop, so any
 * tab or category change causes a full remount — cleaning scroll state and
 * resetting `works` to the fresh `initialWorks` from the server. No stale
 * data, no manual reset logic needed.
 *
 * Subsequent page fetches use the Supabase browser client directly.
 * Pagination is offset-based (.range()). Known limitation: works can appear
 * twice across pages if like counts change mid-session (Popular tab). Accepted
 * for MVP — a cursor-based approach can replace this post-launch.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import WorkCard, { WorkCardSkeleton, type WorkCardWork } from '@/components/work/WorkCard'
import { CATEGORIES } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 12
const POPULAR_WINDOW_DAYS = 30

// ---------------------------------------------------------------------------
// Fetch helper (module-level — no closure over state)
// ---------------------------------------------------------------------------

/**
 * Fetches a page of works using the browser Supabase client.
 * Mirrors the server-side query in page.tsx exactly.
 *
 * @param tab       'new' | 'popular'
 * @param category  category id string, or undefined for all
 * @param page      0-indexed page number
 */
async function fetchWorks(
  tab: string,
  category: string | undefined,
  page: number,
): Promise<WorkCardWork[]> {
  const supabase = createClient()

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

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
    .range(from, to)

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
    console.error('[FeedClient] fetchWorks error:', error.message)
    return []
  }

  return (data ?? []) as unknown as WorkCardWork[]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeedClientProps {
  initialWorks: WorkCardWork[]
  tab: string
  category: string | undefined
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FeedClient({ initialWorks, tab, category }: FeedClientProps) {
  const router = useRouter()

  // Works accumulate as pages load. Start with the SSR initial batch.
  const [works, setWorks] = useState<WorkCardWork[]>(initialWorks)
  // Next page to fetch (page 0 already loaded via SSR)
  const [page, setPage] = useState(1)
  // False when the last fetch returned fewer than PAGE_SIZE results
  const [hasMore, setHasMore] = useState(initialWorks.length === PAGE_SIZE)
  const [isFetching, setIsFetching] = useState(false)

  // Sentinel div at the bottom of the grid — watched by IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------------------
  // Infinite scroll
  // ------------------------------------------------------------------

  const loadNextPage = useCallback(async () => {
    if (isFetching || !hasMore) return
    setIsFetching(true)

    const next = await fetchWorks(tab, category, page)

    setWorks((prev) => [...prev, ...next])
    setPage((p) => p + 1)
    setHasMore(next.length === PAGE_SIZE)
    setIsFetching(false)
  }, [isFetching, hasMore, tab, category, page])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage()
        }
      },
      { rootMargin: '200px' }, // start loading 200px before the sentinel is visible
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadNextPage])

  // ------------------------------------------------------------------
  // URL navigation helpers
  // ------------------------------------------------------------------

  function buildUrl(newTab: string, newCategory: string | undefined): string {
    const params = new URLSearchParams()
    if (newTab !== 'new') params.set('tab', newTab)
    if (newCategory) params.set('category', newCategory)
    const qs = params.toString()
    return qs ? `/?${qs}` : '/'
  }

  function handleTabChange(newTab: string) {
    router.push(buildUrl(newTab, category))
  }

  function handleCategoryChange(newCategory: string | undefined) {
    router.push(buildUrl(tab, newCategory))
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const isNew = tab !== 'popular'

  return (
    <div className="flex flex-col gap-4">

      {/* ---------------------------------------------------------------- */}
      {/* Tabs */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['new', 'popular'] as const).map((t) => {
          const active = (t === 'new' && isNew) || (t === 'popular' && !isNew)
          return (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t === 'new' ? 'New' : 'Popular'}
            </button>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Category filter chips */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        {/* "All" chip */}
        <button
          onClick={() => handleCategoryChange(undefined)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !category
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>

        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(category === cat.id ? undefined : cat.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              category === cat.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Popular tab notice */}
      {/* ---------------------------------------------------------------- */}
      {!isNew && (
        <p className="text-xs text-gray-400">
          Most-liked works from the past {POPULAR_WINDOW_DAYS} days.
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Works grid */}
      {/* ---------------------------------------------------------------- */}
      {works.length === 0 && !isFetching ? (
        <EmptyState tab={tab} category={category} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {works.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
            {/* Skeleton tiles appended while the next page loads */}
            {isFetching &&
              Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <WorkCardSkeleton key={`skeleton-${i}`} />
              ))}
          </div>

          {/* Sentinel — triggers the next page load when it enters the viewport */}
          {hasMore && <div ref={sentinelRef} className="h-4" aria-hidden />}

          {/* End-of-feed notice */}
          {!hasMore && works.length > 0 && (
            <p className="text-center text-xs text-gray-400 py-6">
              You&apos;ve seen everything. Upload something of your own?
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  tab,
  category,
}: {
  tab: string
  category: string | undefined
}) {
  const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label

  const message =
    tab === 'popular' && category
      ? `No popular ${categoryLabel} works in the last 30 days.`
      : tab === 'popular'
      ? 'No popular works in the last 30 days.'
      : category
      ? `No ${categoryLabel} works yet — be the first to upload.`
      : 'No works yet — be the first to upload.'

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <span className="text-4xl">🎨</span>
      <p className="text-gray-500 text-sm max-w-xs">{message}</p>
    </div>
  )
}
