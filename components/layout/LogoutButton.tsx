'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * LogoutButton — client component.
 * Must be a client component because it calls Supabase Auth from the browser
 * and uses useRouter to redirect after logout.
 * Kept intentionally minimal — just the logout action.
 */
export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh() // Clear server component cache so navbar updates
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
    >
      Sign out
    </button>
  )
}
