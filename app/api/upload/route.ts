/**
 * app/api/upload/route.ts
 * Handles all file uploads for a work.
 *
 * Accepts a multipart FormData POST with:
 *   - file: the file to upload
 *   - work_id: the UUID of the work this file belongs to
 *   - file_purpose: 'preview' | 'download' | 'image'
 *
 * Preview files → works-public bucket (GLB, OBJ only)
 * Download files → works-private bucket (any accepted download type)
 * Image files → works-public bucket (PNG, JPG, WEBP) + thumbnail generated via sharp
 *
 * Files are namespaced as: {user_id}/{work_id}/{filename}
 * Returns the inserted work_files row as JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import {
  ACCEPTED_PREVIEW_TYPES,
  ACCEPTED_DOWNLOAD_TYPES,
  ACCEPTED_IMAGE_TYPES,
  MAX_3D_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from '@/lib/constants'

// Thumbnail dimensions for image uploads
const THUMBNAIL_SIZE = 800

export async function POST(request: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // ── 2. Parse FormData ──────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 }
    )
  }

  const file = formData.get('file') as File | null
  const workId = formData.get('work_id') as string | null
  const filePurpose = formData.get('file_purpose') as 'preview' | 'download' | 'image' | null

  if (!file || !workId || !filePurpose) {
    return NextResponse.json(
      { error: 'Missing required fields: file, work_id, file_purpose' },
      { status: 400 }
    )
  }

  if (!['preview', 'download', 'image'].includes(filePurpose)) {
    return NextResponse.json(
      { error: 'file_purpose must be preview, download, or image' },
      { status: 400 }
    )
  }

  // ── 3. Validate file type and size by purpose ──────────────────────────────
  const mimeType = file.type
  const fileSizeBytes = file.size

  if (filePurpose === 'preview') {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const validByMime = (ACCEPTED_PREVIEW_TYPES as readonly string[]).includes(mimeType)
  const validByExt = ['glb', 'obj'].includes(ext ?? '')
  if (!validByMime && !validByExt) {
    return NextResponse.json(
      { error: 'Preview files must be GLB or OBJ format' },
      { status: 422 }
    )
  }
  if (fileSizeBytes > MAX_3D_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Preview file exceeds 100 MB limit' },
      { status: 422 }
    )
  }
}

  if (filePurpose === 'download') {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const validByMime = (ACCEPTED_DOWNLOAD_TYPES as readonly string[]).includes(mimeType)
  const validByExt = ['glb', 'obj', 'stl'].includes(ext ?? '')
  if (!validByMime && !validByExt) {
    return NextResponse.json(
      { error: 'Download file type not supported' },
      { status: 422 }
    )
  }
    if (fileSizeBytes > MAX_3D_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Download file exceeds 100 MB limit' },
        { status: 422 }
      )
    }
  }

  if (filePurpose === 'image') {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json(
        { error: 'Image files must be PNG, JPEG, or WEBP' },
        { status: 422 }
      )
    }
    if (fileSizeBytes > MAX_IMAGE_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image file exceeds 20 MB limit' },
        { status: 422 }
      )
    }
  }

  // ── 4. Determine storage bucket and path ───────────────────────────────────
  // Preview and image files go to the public bucket.
  // Download files go to the private bucket.
  const bucket = filePurpose === 'download' ? 'works-private' : 'works-public'

  // Sanitise filename: replace spaces and special chars, keep extension
  const sanitisedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()

  const storagePath = `${user.id}/${workId}/${sanitisedName}`

  // ── 5. Upload file to Supabase Storage ────────────────────────────────────
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return NextResponse.json(
      { error: 'Failed to upload file to storage' },
      { status: 500 }
    )
  }

  // ── 6. Resolve public URL (public bucket files only) ──────────────────────
  let publicUrl: string | null = null
  if (bucket === 'works-public') {
    const { data: urlData } = supabase.storage
      .from('works-public')
      .getPublicUrl(storagePath)
    publicUrl = urlData.publicUrl
  }

  // ── 7. Generate thumbnail for image files ─────────────────────────────────
  let thumbnailUrl: string | null = null

  if (filePurpose === 'image') {
    try {
      const thumbnailBuffer = await sharp(Buffer.from(fileBuffer))
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'cover',       // crop to fill square — no letterboxing
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer()

      const thumbnailName = sanitisedName.replace(/\.[^.]+$/, '_thumb.webp')
      const thumbnailPath = `${user.id}/${workId}/${thumbnailName}`

      const { error: thumbError } = await supabase.storage
        .from('works-public')
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/webp',
          upsert: false,
        })

      if (thumbError) {
        // Non-fatal — log but continue. The original image is still usable.
        console.error('Thumbnail generation error:', thumbError)
      } else {
        const { data: thumbUrlData } = supabase.storage
          .from('works-public')
          .getPublicUrl(thumbnailPath)
        thumbnailUrl = thumbUrlData.publicUrl
      }
    } catch (sharpError) {
      // Non-fatal — sharp failure should not block the upload
      console.error('Sharp processing error:', sharpError)
    }
  }

  // ── 8. Derive file_type from MIME ──────────────────────────────────────────
  const extToFileType: Record<string, string> = {
  'glb': 'glb',
  'obj': 'obj',
  'stl': 'stl',
  'png': 'png',
  'jpg': 'jpg',
  'jpeg': 'jpg',
  'webp': 'webp',
}
const fileExt = file.name.split('.').pop()?.toLowerCase() ?? ''
const fileType = extToFileType[fileExt] ?? 'unknown'
  // ── 9. Insert work_files row ───────────────────────────────────────────────
  const { data: workFile, error: dbError } = await supabase
    .from('work_files')
    .insert({
      work_id: workId,
      file_type: fileType,
      storage_path: storagePath,
      public_url: publicUrl,
      thumbnail_url: thumbnailUrl,
      is_download_file: filePurpose === 'download',
      file_size_bytes: fileSizeBytes,
    })
    .select()
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    // Attempt to clean up the orphaned storage file
    await supabase.storage.from(bucket).remove([storagePath])
    return NextResponse.json(
      { error: 'Failed to save file record' },
      { status: 500 }
    )
  }

  // ── 10. Return the new work_files row ──────────────────────────────────────
  return NextResponse.json(workFile, { status: 201 })
}
