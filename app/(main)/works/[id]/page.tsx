/**
 * app/(main)/works/[id]/page.tsx
 *
 * Work detail page — server-rendered for SEO and Open Graph sharing.
 *
 * - Fetches the work, its files, and the creator's profile server-side.
 * - Returns 404 if the work doesn't exist, is unpublished, and the viewer
 *   is not the owner.
 * - Renders <ModelViewer> if a GLB/OBJ preview file exists.
 * - Renders an image gallery if the work has image files.
 * - Generates Open Graph metadata for social sharing.
 * - Download button is a placeholder — purchase gate added in Phase 4.
 *
 * Deviation: users join uses explicit FK name 'users!works_user_id_fkey'
 * because PostgREST found two paths between works and users (via works_user_id_fkey
 * and via likes). Must be explicit to avoid PGRST201 ambiguity error.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import ModelViewer from '@/components/work/ModelViewer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
}

// ── Open Graph metadata ───────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: work } = await supabase
    .from('works')
    .select('title, description, work_files(thumbnail_url, public_url, file_type)')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (!work) {
    return { title: 'Work not found — ArtisanForge' }
  }

  // Use the first thumbnail as the OG image, falling back to the first public image
  const files = (work.work_files ?? []) as Array<{
    thumbnail_url: string | null
    public_url: string | null
    file_type: string
  }>

  const ogImage =
    files.find((f) => f.thumbnail_url)?.thumbnail_url ??
    files.find((f) => ['png', 'jpg', 'webp'].includes(f.file_type))?.public_url ??
    null

  return {
    title: `${work.title} — ArtisanForge`,
    description: work.description ?? 'View this work on ArtisanForge.',
    openGraph: {
      title: work.title,
      description: work.description ?? 'View this work on ArtisanForge.',
      ...(ogImage ? { images: [{ url: ogImage, width: 800, height: 800 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: work.title,
      description: work.description ?? 'View this work on ArtisanForge.',
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WorkDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // ── Fetch current user (may be null for guests) ────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch work with creator profile and files ──────────────────────────────
  // Note: 'users!works_user_id_fkey' is required — PostgREST finds two paths
  // between works and users (direct FK + via likes) and requires disambiguation.
  const { data: work } = await supabase
    .from('works')
    .select(`
      id,
      title,
      description,
      category,
      tags,
      like_count,
      comment_count,
      is_published,
      created_at,
      user_id,
      users!works_user_id_fkey (
        username,
        avatar_url
      ),
      work_files (
        id,
        file_type,
        public_url,
        thumbnail_url,
        is_download_file,
        file_size_bytes
      )
    `)
    .eq('id', id)
    .single()

  // 404 if not found, or unpublished and viewer is not the owner
  if (!work) notFound()
  if (!work.is_published && work.user_id !== user?.id) notFound()

  const isOwner = user?.id === work.user_id

  // ── Separate files by purpose ──────────────────────────────────────────────
  type WorkFileRow = {
    id: string
    file_type: string
    public_url: string | null
    thumbnail_url: string | null
    is_download_file: boolean
    file_size_bytes: number | null
  }

  const allFiles = (work.work_files ?? []) as WorkFileRow[]
  const previewFile = allFiles.find(
    (f) => !f.is_download_file && ['glb', 'obj'].includes(f.file_type)
  )
  const imageFiles = allFiles.filter(
    (f) => !f.is_download_file && ['png', 'jpg', 'webp'].includes(f.file_type)
  )
  const downloadFile = allFiles.find((f) => f.is_download_file)

  // Creator profile — Supabase returns joined rows as object or array
  const creator = Array.isArray(work.users) ? work.users[0] : work.users

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Unpublished banner for owner */}
      {!work.is_published && isOwner && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          This work is saved as a draft and is only visible to you.
        </div>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
        {/* ── Left column: preview ──────────────────────────────────────── */}
        <div className="lg:col-span-3">
          {previewFile?.public_url ? (
            <ModelViewer
              src={previewFile.public_url}
              alt={work.title}
              className="h-80 w-full lg:h-[480px]"
            />
          ) : imageFiles.length > 0 ? (
            <div className="space-y-3">
              {imageFiles.map((img) =>
                img.public_url ? (
                  <div
                    key={img.id}
                    className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100"
                  >
                    <Image
                      src={img.thumbnail_url ?? img.public_url}
                      alt={work.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      priority
                    />
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center rounded-xl bg-gray-100 lg:h-[480px]">
              <p className="text-sm text-gray-400">No preview available</p>
            </div>
          )}
        </div>

        {/* ── Right column: metadata ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category badge */}
          <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {work.category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 leading-snug">{work.title}</h1>

          {/* Creator */}
          {creator && (
            <Link
              href={`/${creator.username}`}
              className="flex items-center gap-3 group"
            >
              {creator.avatar_url ? (
                <Image
                  src={creator.avatar_url}
                  alt={creator.username}
                  width={36}
                  height={36}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {creator.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600">
                {creator.username}
              </span>
            </Link>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>♥ {work.like_count} likes</span>
            <span>💬 {work.comment_count} comments</span>
          </div>

          {/* Description */}
          {work.description && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {work.description}
            </p>
          )}

          {/* Tags */}
          {work.tags && work.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {work.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/search?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Download — placeholder until Phase 4 purchase gate */}
          {downloadFile && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Download file
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 uppercase">
                    {downloadFile.file_type}
                  </p>
                  {downloadFile.file_size_bytes && (
                    <p className="text-xs text-gray-400">
                      {formatBytes(downloadFile.file_size_bytes)}
                    </p>
                  )}
                </div>
                {/* Phase 4: replace this button with a purchase/download flow */}
                <button
                  disabled
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
                >
                  Download
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Purchasing available in a future update.
              </p>
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2">You created this work</p>
              <Link
                href={`/works/${work.id}/edit`}
                className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit work
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
