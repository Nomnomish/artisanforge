'use client'

/**
 * components/profile/ProfileEditForm.tsx
 *
 * Client Component for the edit profile page (/settings/profile).
 *
 * Handles three fields:
 *   username — text input, validated client + server side
 *   bio      — textarea, max 300 chars
 *   avatar   — file input, uploads directly to Supabase Storage on select
 *              (no form submit needed for avatar — uploads immediately)
 *
 * Avatar upload:
 *   Path: avatars/{user_id}/avatar.{ext}
 *   Uses the browser Supabase client — RLS policies on the avatars bucket
 *   enforce ownership. After upload, saves the public URL to users.avatar_url.
 *
 * Username + bio:
 *   Submitted via the updateProfile server action passed as a prop.
 *   Server action handles uniqueness check and DB update.
 *   Returns { error: string } on failure, null on success.
 */

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileEditFormProps {
  userId: string
  initialUsername: string
  initialBio: string
  initialAvatarUrl: string | null
  updateProfile: (formData: FormData) => Promise<{ error: string } | null>
}

// Only these extensions are accepted for avatars
const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfileEditForm({
  userId,
  initialUsername,
  initialBio,
  initialAvatarUrl,
  updateProfile,
}: ProfileEditFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Text field state
  const [username, setUsername] = useState(initialUsername)
  const [bio, setBio] = useState(initialBio)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Avatar upload
  // ---------------------------------------------------------------------------

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError(null)

    // Client-side validation
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Avatar must be a PNG, JPEG, or WEBP image.')
      return
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('Avatar must be 5 MB or smaller.')
      return
    }

    setAvatarUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'webp'
    // Path convention: {user_id}/avatar.{ext}
    // Overwrites any existing avatar — no versioning needed
    const storagePath = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setAvatarError('Upload failed. Please try again.')
      setAvatarUploading(false)
      return
    }

    // Get the public URL and save it to users.avatar_url
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath)

    const { error: dbError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (dbError) {
      setAvatarError('Failed to save avatar. Please try again.')
      setAvatarUploading(false)
      return
    }

    // Add cache-busting param so the browser reloads the image immediately
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
    setAvatarUploading(false)
    // Refresh so the Navbar avatar updates
    router.refresh()
  }

  // ---------------------------------------------------------------------------
  // Text field submit
  // ---------------------------------------------------------------------------

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result?.error) {
        setFormError(result.error)
      } else {
        setFormSuccess(true)
        // Refresh so Navbar username updates
        router.refresh()
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const initials = initialUsername.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col gap-8 max-w-lg">

      {/* ------------------------------------------------------------------ */}
      {/* Avatar section */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex items-center gap-5">
        {/* Current avatar */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          aria-label="Change avatar"
          className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-indigo-100 group focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Your avatar"
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-indigo-600">
              {initials}
            </span>
          )}
          {/* Hover overlay */}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
            {avatarUploading ? 'Uploading…' : 'Change'}
          </span>
        </button>

        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {avatarUploading ? 'Uploading…' : 'Upload new avatar'}
          </button>
          <p className="text-xs text-gray-400 mt-0.5">PNG, JPEG, or WEBP — max 5 MB</p>
          {avatarError && <p className="text-xs text-red-600 mt-1">{avatarError}</p>}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleAvatarChange}
          className="hidden"
          aria-hidden
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Username + bio form */}
      {/* ------------------------------------------------------------------ */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-900 mb-1">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setFormSuccess(false)
            }}
            autoComplete="username"
            required
            maxLength={30}
            placeholder="your_username"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Letters, numbers, underscores, and hyphens only. Max 30 characters.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-900 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(e) => {
              setBio(e.target.value)
              setFormSuccess(false)
            }}
            rows={4}
            maxLength={300}
            placeholder="Tell people about your work, techniques, or inspirations…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">{bio.length}/300</p>
        </div>

        {/* Feedback */}
        {formError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}
        {formSuccess && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Profile updated.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
