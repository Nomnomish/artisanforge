/**
 * Search page — /search
 * Placeholder for Phase 3. Will become full-text search over works
 * using the search_vector tsvector column and GIN index.
 */
export default function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Search</h2>
      <p className="text-gray-500 text-sm">Coming in Phase 3 — full-text search across works and creators.</p>
    </div>
  )
}
