/**
 * app/(main)/search/page.tsx
 * Search results page — /search
 *
 * Server Component. Handles two query modes:
 *   ?q=dragon        — Postgres full-text search via search_vector tsvector column
 *   ?tag=miniatures  — Postgres array containment via tags @> operator
 *
 * Both hit GIN indexes created in 0001_initial_schema.sql:
 *   works_search_idx on search_vector
 *   works_tags_idx on tags
 *
 * The search input that navigates here lives in the Navbar (Task 4).
 * This page is a pure results page — no client-side search state.
 *
 * If both ?q and ?tag are present, ?q takes precedence.
 * If neither is present, a prompt is shown instead of results.
 */

import { createClient } from '@/lib/supabase/server'
import WorkCard, { WorkCardSkeleton } from '@/components/work/WorkCard'
import type { WorkCardWork } from '@/components/work/WorkCard'
import type { Metadata } from 'next'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    tag?: string
  }>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q, tag } = await searchParams

  if (q) {
    return {
      title: `"${q}" — ArtisanForge`,
      description: `Search results for "${q}" on ArtisanForge.`,
    }
  }
  if (tag) {
    return {
      title: `#${tag} — ArtisanForge`,
      description: `Works tagged #${tag} on ArtisanForge.`,
    }
  }
  return {
    title: 'Search — ArtisanForge',
    description: 'Search for works and creators on ArtisanForge.',
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, tag } = await searchParams

  // Trim and sanitise inputs — Supabase will handle SQL-level escaping, but
  // we want to avoid sending empty strings to the query.
  const query = q?.trim() || undefined
  const tagParam = tag?.trim() || undefined

  const hasSearch = Boolean(query || tagParam)

  // ------------------------------------------------------------------
  // Query
  // ------------------------------------------------------------------
  let works: WorkCardWork[] = []

  if (hasSearch) {
    const supabase = await createClient()

    let dbQuery = supabase
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
      .limit(48) // generous cap — no pagination on search for MVP

    if (query) {
      // Full-text search using the pre-built tsvector column.
      // 'websearch' type mirrors Google syntax: quoted phrases, - exclusions.
      dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' })
    } else if (tagParam) {
      // Array containment: works where tags @> ARRAY[tagParam]
      // Hits the GIN index on tags.
      dbQuery = dbQuery.contains('tags', [tagParam])
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('[SearchPage] query error:', error.message)
    }

    works = (data ?? []) as unknown as WorkCardWork[]
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">

      {/* Header */}
      <SearchHeader query={query} tag={tagParam} count={works.length} hasSearch={hasSearch} />

      {/* Results */}
      {!hasSearch ? (
        <SearchPrompt />
      ) : works.length === 0 ? (
        <EmptyState query={query} tag={tagParam} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchHeader({
  query,
  tag,
  count,
  hasSearch,
}: {
  query: string | undefined
  tag: string | undefined
  count: number
  hasSearch: boolean
}) {
  if (!hasSearch) {
    return (
      <h1 className="text-xl font-semibold text-gray-900">Search</h1>
    )
  }

  if (query) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900">
          Results for <span className="text-indigo-600">&ldquo;{query}&rdquo;</span>
        </h1>
        {count > 0 && (
          <p className="text-sm text-gray-500">{count} work{count !== 1 ? 's' : ''} found</p>
        )}
      </div>
    )
  }

  if (tag) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900">
          Works tagged <span className="text-indigo-600">#{tag}</span>
        </h1>
        {count > 0 && (
          <p className="text-sm text-gray-500">{count} work{count !== 1 ? 's' : ''}</p>
        )}
      </div>
    )
  }

  return null
}

function SearchPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <span className="text-4xl">🔍</span>
      <p className="text-gray-500 text-sm max-w-xs">
        Use the search bar above to find works by title, description, or tag.
      </p>
    </div>
  )
}

function EmptyState({
  query,
  tag,
}: {
  query: string | undefined
  tag: string | undefined
}) {
  const message = query
    ? `No works found for "${query}". Try different keywords.`
    : `No works tagged #${tag} yet.`

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <span className="text-4xl">🎨</span>
      <p className="text-gray-500 text-sm max-w-xs">{message}</p>
    </div>
  )
}
