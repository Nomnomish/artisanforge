/**
 * app/(main)/settings/profile/page.tsx
 *
 * Edit profile page — /settings/profile
 *
 * Server Component. Fetches current profile and passes it to ProfileEditForm.
 * Redirects to /login if unauthenticated.
 *
 * Server action `updateProfile`:
 *   - Validates username format (letters, numbers, underscores, hyphens, max 30)
 *   - Checks username uniqueness against the users table
 *   - Updates username and bio on the users row
 *   - Returns { error: string } on failure, null on success
 *
 * Avatar upload is handled client-side in ProfileEditForm via the Supabase
 * browser client — no server action needed (RLS enforces ownership).
 */

'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileEditForm from '@/components/profile/ProfileEditForm'

// ---------------------------------------------------------------------------
// Server action — update username and bio
// ---------------------------------------------------------------------------

async function updateProfile(formData: FormData): Promise<{ error: string } | null> {
  'use server'

  const rawUsername = (formData.get('username') as string | null)?.trim() ?? ''
  const rawBio = (formData.get('bio') as string | null)?.trim() ?? ''

  // ── Validate username format ──────────────────────────────────────────────
  if (!rawUsername) {
    return { error: 'Username is required.' }
  }
  if (rawUsername.length > 30) {
    return { error: 'Username must be 30 characters or fewer.' }
  }
  // Letters, numbers, underscores, hyphens only
  if (!/^[a-zA-Z0-9_-]+$/.test(rawUsername)) {
    return { error: 'Username can only contain letters, numbers, underscores, and hyphens.' }
  }

  // ── Validate bio length ───────────────────────────────────────────────────
  if (rawBio.length > 300) {
    return { error: 'Bio must be 300 characters or fewer.' }
  }

  const supabase = await createClient()

  // ── Get current user ──────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to update your profile.' }
  }

  // ── Check username uniqueness (skip if unchanged) ─────────────────────────
  const { data: currentProfile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()

  const usernameChanged = currentProfile?.username !== rawUsername

  if (usernameChanged) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', rawUsername)
      .maybeSingle()

    if (existing) {
      return { error: `The username "${rawUsername}" is already taken.` }
    }
  }

  // ── Update the profile ────────────────────────────────────────────────────
  const { error: dbError } = await supabase
    .from('users')
    .update({
      username: rawUsername,
      bio: rawBio || null, // store null for empty bio rather than empty string
    })
    .eq('id', user.id)

  if (dbError) {
    console.error('[updateProfile] db error:', dbError.message)
    return { error: 'Failed to save changes. Please try again.' }
  }

  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function EditProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('username, bio, avatar_url')
    .eq('id', user.id)
    .single()

  // Should never happen if the Phase 1 trigger is working — but guard anyway
  if (!profile) redirect('/login')

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update your public profile information.
        </p>
      </div>

      <ProfileEditForm
        userId={user.id}
        initialUsername={profile.username}
        initialBio={profile.bio ?? ''}
        initialAvatarUrl={profile.avatar_url}
        updateProfile={updateProfile}
      />
    </main>
  )
}
