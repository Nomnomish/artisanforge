'use client'

/**
 * components/profile/FollowButton.tsx
 *
 * Follow / Unfollow button for creator profile pages.
 *
 * Phase 3 behaviour:
 *   - Optimistic UI: button state flips immediately on click
 *   - After the Supabase write succeeds, calls router.refresh() to re-run
 *     the Server Component and sync the server-side follower_count (updated
 *     by the DB trigger). No client-side count arithmetic needed.
 *   - On error: reverts optimistic state.
 *
 * Phase 6 will replace router.refresh() with full optimistic count animation
 * and add the followers/following sub-pages.
 *
 * Auth:
 *   Calls supabase.auth.getUser() on click. Unauthenticated users are
 *   redirected to /login rather than failing silently.
 *   Self-following is prevented server-side by RLS and client-side by the
 *   parent page (FollowButton is not rendered when viewing own profile).
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface FollowButtonProps {
  targetUserId: string
  initialIsFollowing: boolean
}

export default function FollowButton({ targetUserId, initialIsFollowing }: FollowButtonProps) {
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isLoading, setIsLoading] = useState(false)
  const inFlight = useRef(false)

  async function handleClick() {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)

    const supabase = createClient()

    // Check auth before doing anything
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      inFlight.current = false
      setIsLoading(false)
      router.push('/login')
      return
    }

    // Optimistic flip
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)

    let error

    if (wasFollowing) {
      // Unfollow — delete the row
      ;({ error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId))
    } else {
      // Follow — insert a row
      ;({ error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetUserId }))
    }

    if (error) {
      // Revert optimistic update on failure
      console.error('[FollowButton] error:', error.message)
      setIsFollowing(wasFollowing)
    } else {
      // Refresh the Server Component to sync follower_count from DB trigger
      router.refresh()
    }

    inFlight.current = false
    setIsLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isFollowing ? 'Unfollow this creator' : 'Follow this creator'}
      aria-pressed={isFollowing}
      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60 ${
        isFollowing
          ? 'border border-gray-300 bg-white text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
    >
      {isLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
