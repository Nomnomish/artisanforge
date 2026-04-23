import { Suspense } from 'react'
import Link from 'next/link'
import { type User } from '@supabase/supabase-js'
import LogoutButton from './LogoutButton'
import NavSearch from './NavSearch'

interface NavbarProps {
  user: User | null
  profile: { username: string; avatar_url: string | null } | null
}

/**
 * Navbar — server component.
 * Receives user and profile from the parent layout (already fetched server-side).
 * Logout action is handled by the LogoutButton client component.
 * Search is handled by NavSearch (client component) wrapped in Suspense.
 * useSearchParams() inside NavSearch requires the Suspense boundary.
 */
export default function Navbar({ user, profile }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex-shrink-0 text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
          >
            ArtisanForge
          </Link>

          {/*
            Search bar — NavSearch is a Client Component (uses useRouter +
            useSearchParams). Suspense fallback matches the static placeholder
            appearance so there is no layout shift while the client hydrates.
          */}
          <Suspense fallback={<SearchFallback />}>
            <NavSearch />
          </Suspense>

          {/* Right side — auth state */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user && profile ? (
              <>
                {/* Upload link */}
                <Link
                  href="/works/new"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload
                </Link>
                {/* Profile link */}
                <Link
                  href={`/${profile.username}`}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block">{profile.username}</span>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Suspense fallback — matches NavSearch's static appearance
// ---------------------------------------------------------------------------

function SearchFallback() {
  return (
    <div className="flex-1 max-w-md">
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-3 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <div className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 rounded-lg text-gray-500">
          Search works, creators…
        </div>
      </div>
    </div>
  )
}
