/**
 * Creator profile page — /[username]
 * Placeholder for Phase 3. Will show avatar, bio, follower counts,
 * published works grid, and active products.
 */
export default function ProfilePage({
  params,
}: {
  params: { username: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">@{params.username}</h2>
      <p className="text-gray-500 text-sm">Creator profile — coming in Phase 3.</p>
    </div>
  )
}
