'use client'

/**
 * components/layout/NavSearch.tsx
 *
 * Search input for the Navbar. Client Component — needs useRouter for
 * navigation and useSearchParams to pre-populate the input when the
 * user is already on the /search page.
 *
 * On submit (Enter or form submit): navigates to /search?q=[value]
 * On clear (Escape or × button): clears the input
 *
 * Must be wrapped in <Suspense> by the parent because useSearchParams()
 * requires it in Next.js App Router.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function NavSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Pre-populate from ?q= so the input reflects the active search
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  // Keep input in sync if the user navigates (e.g. browser back/forward)
  useEffect(() => {
    setValue(searchParams.get('q') ?? '')
  }, [searchParams])

  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setValue('')
      inputRef.current?.blur()
    }
  }

  function handleClear() {
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-md" role="search">
      <div className="relative flex items-center">
        {/* Search icon */}
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

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search works, creators…"
          autoComplete="off"
          aria-label="Search ArtisanForge"
          className="w-full pl-9 pr-8 py-2 text-sm text-gray-900 bg-gray-100 rounded-lg border border-transparent placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        />

        {/* Clear button — only shown when there is a value */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2.5 flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
}
