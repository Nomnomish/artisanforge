import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'

/**
 * Main layout — wraps all pages in the (main) route group.
 * Auth pages (login, signup) use their own minimal layout via the (auth) group.
 *
 * Reads the current user session server-side so the Navbar can render
 * the correct state (logged in vs logged out) without a client-side flash.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the public profile if logged in (for avatar and username in nav)
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar user={user} profile={profile} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
