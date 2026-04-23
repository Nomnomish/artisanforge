'use client'

/**
 * components/work/LikeButton.tsx
 *
 * Heart button with optimistic UI for liking / unliking a work.
 *
 * Optimistic pattern:
 *   1. Flip local isLiked + count immediately on click
 *   2. Fire Supabase INSERT or DELETE
 *   3. If the server returns an error, revert both values
 *   4. Button is disabled while a request is in-flight (prevents double-clicks)
 *
 * Auth:
 *   Calls supabase.auth.getUser() on click. If unauthenticated, redirects
 *   to /login rather than failing silently. We fetch the user here rather
 *   than receiving it as a prop so the component is self-contained and can
 *   be used anywhere without the parent needing to pass auth state.
 *
 * like_count accuracy:
 *   The DB trigger on the likes table increments / decrements works.like_count
 *   server-side. The client count shown here is optimistic — it stays in sync
 *   as long as no error occurs. On error it reverts to the pre-click value.
 *
 * variant:
 *   'compact' — small heart + number, used in WorkCard feed grid
 *   'full'    — larger heart button with label, used on work detail page
 *
 * Feed cards always receive initialIsLiked={false}.
 * The work detail page passes the real value from a server-side likes query.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LikeButtonProps {
  workId: string
  initialCount: number
  initialIsLiked: boolean
  variant?: 'compact' | 'full'
}

export default function LikeButton({
  workId,
  initialCount,
  initialIsLiked,
  variant = 'compact',
}: LikeButtonProps) {
  const router = useRouter()
  const [isLiked, setIsLiked] = useState(initialIsLiked)
  const [count, setCount] = useState(initialCount)
  // useRef rather than useState — we don't want a re-render when this flips,
  // just want to block concurrent clicks.
  const inFlight = useRef(false)

  async function handleClick(e: React.MouseEvent) {
    // Prevent the click from bubbling up to any parent <Link> (e.g. in WorkCard)
    e.preventDefault()
    e.stopPropagation()

    if (inFlight.current) return
    inFlight.current = true

    const supabase = createClient()

    // Check auth before doing anything
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      inFlight.current = false
      router.push('/login')
      return
    }

    // Optimistic update — flip state immediately before server round-trip
    const wasLiked = isLiked
    const prevCount = count
    setIsLiked(!wasLiked)
    setCount(wasLiked ? count - 1 : count + 1)

    let error

    if (wasLiked) {
      // Unlike — delete the row
      ;({ error } = await supabase
        .from('likes')
        .delete()
        .eq('work_id', workId)
        .eq('user_id', user.id))
    } else {
      // Like — insert a row
      ;({ error } = await supabase
        .from('likes')
        .insert({ work_id: workId, user_id: user.id }))
    }

    if (error) {
      // Revert optimistic update on failure
      console.error('[LikeButton] error:', error.message)
      setIsLiked(wasLiked)
      setCount(prevCount)
    }

    inFlight.current = false
  }

  // ── Compact variant (WorkCard) ──────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        aria-label={isLiked ? 'Unlike this work' : 'Like this work'}
        aria-pressed={isLiked}
        className="flex items-center gap-1 group/like"
      >
        <Heart
          className={`w-3.5 h-3.5 transition-colors ${
            isLiked
              ? 'fill-rose-500 stroke-rose-500'
              : 'stroke-gray-400 group-hover/like:stroke-rose-400'
          }`}
          strokeWidth={1.5}
        />
        <span
          className={`text-xs transition-colors ${
            isLiked ? 'text-rose-500' : 'text-gray-400 group-hover/like:text-rose-400'
          }`}
        >
          {count}
        </span>
      </button>
    )
  }

  // ── Full variant (work detail page) ────────────────────────────────────────
  return (
    <button
      onClick={handleClick}
      aria-label={isLiked ? 'Unlike this work' : 'Like this work'}
      aria-pressed={isLiked}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
        isLiked
          ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
          : 'border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500'
      }`}
    >
      <Heart
        className={`w-4 h-4 transition-colors ${
          isLiked ? 'fill-rose-500 stroke-rose-500' : 'stroke-current'
        }`}
        strokeWidth={1.5}
      />
      <span>{count} {count === 1 ? 'like' : 'likes'}</span>
    </button>
  )
}
