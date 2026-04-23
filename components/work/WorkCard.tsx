/**
 * components/work/WorkCard.tsx
 *
 * Display card for a single work. Used in the feed, search results, and
 * creator profile grids. Pure display component — no data fetching.
 *
 * Props shape mirrors the Supabase query result shape:
 *   works row + users!works_user_id_fkey (username, avatar_url)
 *   + work_files (thumbnail_url for the preview image)
 *
 * Phase 3: LikeButton always receives initialIsLiked={false} on feed cards.
 * Pre-fetching per-card like status would require N queries for N cards.
 * The work detail page passes the real initialIsLiked value from a server query.
 */

import Link from 'next/link'
import Image from 'next/image'
import { CATEGORIES } from '@/lib/constants'
import type { CategoryId } from '@/lib/constants'
import LikeButton from './LikeButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The minimal shape WorkCard needs from a works row + joined relations.
 * Typed explicitly rather than deriving from Database types so callers can
 * pass a subset — e.g. profile page queries may not fetch every column.
 */
export interface WorkCardWork {
  id: string
  title: string
  category: CategoryId
  tags: string[] | null
  like_count: number
  created_at: string
  /** Joined via users!works_user_id_fkey */
  users: {
    username: string
    avatar_url: string | null
  } | null
  /** First preview work_file row, or null if none uploaded */
  work_files: {
    thumbnail_url: string | null
  }[] | null
}

interface WorkCardProps {
  work: WorkCardWork
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the human-readable label for a category id. */
function getCategoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
}

/** Returns initials from a username for the avatar fallback. */
function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

// ---------------------------------------------------------------------------
// WorkCard
// ---------------------------------------------------------------------------

export default function WorkCard({ work }: WorkCardProps) {
  const thumbnailUrl = work.work_files?.[0]?.thumbnail_url ?? null
  const username = work.users?.username ?? 'unknown'
  const avatarUrl = work.users?.avatar_url ?? null
  const categoryLabel = getCategoryLabel(work.category)

  return (
    <article className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">

      {/* ------------------------------------------------------------------ */}
      {/* Thumbnail */}
      {/* ------------------------------------------------------------------ */}
      <Link href={`/works/${work.id}`} className="relative block aspect-square overflow-hidden bg-gray-100 flex-shrink-0">

        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={work.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* Placeholder when no thumbnail exists */
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-gray-400 text-xs font-medium tracking-wide uppercase">No preview</span>
          </div>
        )}

        {/* Category badge — top-left overlay */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-black/60 text-white backdrop-blur-sm">
          {categoryLabel}
        </span>

      </Link>

      {/* ------------------------------------------------------------------ */}
      {/* Card body */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2 p-3 flex-1">

        {/* Title */}
        <Link
          href={`/works/${work.id}`}
          className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-indigo-600 transition-colors"
        >
          {work.title}
        </Link>

        {/* Creator row */}
        <Link
          href={`/${username}`}
          className="flex items-center gap-1.5 min-w-0 group/creator"
        >
          {/* Avatar */}
          <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-indigo-100">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={username}
                fill
                sizes="20px"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                {getInitials(username)}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 truncate group-hover/creator:text-indigo-600 transition-colors">
            {username}
          </span>
        </Link>

        {/* Tags */}
        {work.tags && work.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {work.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag}
                href={`/search?tag=${encodeURIComponent(tag)}`}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Like button — compact variant, initialIsLiked always false on feed */}
        <div className="mt-auto pt-1">
          <LikeButton
            workId={work.id}
            initialCount={work.like_count}
            initialIsLiked={false}
            variant="compact"
          />
        </div>

      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// WorkCardSkeleton
// ---------------------------------------------------------------------------
// Used in Suspense boundaries and loading states on the feed, search,
// and profile pages while data is being fetched.

export function WorkCardSkeleton() {
  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      {/* Thumbnail placeholder */}
      <div className="aspect-square bg-gray-200" />
      {/* Body placeholder */}
      <div className="flex flex-col gap-2 p-3">
        {/* Title lines */}
        <div className="h-3 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        {/* Creator row */}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="h-2.5 bg-gray-200 rounded-full w-1/3" />
        </div>
        {/* Tags */}
        <div className="flex gap-1 mt-1">
          <div className="h-4 w-12 bg-gray-200 rounded" />
          <div className="h-4 w-10 bg-gray-200 rounded" />
        </div>
        {/* Like count */}
        <div className="flex items-center gap-1 mt-2">
          <div className="w-3.5 h-3.5 bg-gray-200 rounded-full" />
          <div className="h-2.5 w-6 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}
