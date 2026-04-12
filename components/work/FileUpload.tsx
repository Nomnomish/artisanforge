'use client'

/**
 * components/work/FileUpload.tsx
 *
 * Reusable file upload component used in the work creation wizard.
 * Renders a drag-and-drop zone, validates the file client-side,
 * uploads to /api/upload via XHR (for progress tracking), and
 * calls onUploadComplete with the returned work_files row.
 *
 * Used twice in the wizard:
 *   - purpose="preview"  → accepts GLB, OBJ only (browser-renderable)
 *   - purpose="download" → accepts STL, OBJ, GLB (the file buyers receive)
 *   - purpose="image"    → accepts PNG, JPEG, WEBP
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  ACCEPTED_PREVIEW_TYPES,
  ACCEPTED_DOWNLOAD_TYPES,
  ACCEPTED_IMAGE_TYPES,
  MAX_3D_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

type FilePurpose = 'preview' | 'download' | 'image'

// Matches the shape of a work_files row returned by the upload route
export interface WorkFile {
  id: string
  work_id: string
  file_type: string
  storage_path: string
  public_url: string | null
  thumbnail_url: string | null
  is_download_file: boolean
  file_size_bytes: number
  created_at: string
}

interface FileUploadProps {
  workId: string
  purpose: FilePurpose
  label: string          // e.g. "Preview file (GLB or OBJ)"
  hint: string           // e.g. "Renders in-browser for visitors"
  onUploadComplete: (workFile: WorkFile) => void
  onRemove?: () => void
  disabled?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES: Record<FilePurpose, readonly string[]> = {
  preview:  ACCEPTED_PREVIEW_TYPES,
  download: ACCEPTED_DOWNLOAD_TYPES,
  image:    ACCEPTED_IMAGE_TYPES,
}

const MAX_SIZE: Record<FilePurpose, number> = {
  preview:  MAX_3D_FILE_SIZE_BYTES,
  download: MAX_3D_FILE_SIZE_BYTES,
  image:    MAX_IMAGE_FILE_SIZE_BYTES,
}

const PURPOSE_LABELS: Record<FilePurpose, string> = {
  preview:  'GLB or OBJ',
  download: 'STL, OBJ, or GLB',
  image:    'PNG, JPEG, or WEBP',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FileUpload({
  workId,
  purpose,
  label,
  hint,
  onUploadComplete,
  onRemove,
  disabled = false,
}: FileUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<WorkFile | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Upload via XHR for progress tracking ────────────────────────────────────
  const uploadFile = useCallback((file: File) => {
    setUploading(true)
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('work_id', workId)
    formData.append('file_purpose', purpose)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      setUploading(false)
      if (xhr.status === 201) {
        try {
          const workFile: WorkFile = JSON.parse(xhr.responseText)
          setUploadedFile(workFile)
          setProgress(100)
          onUploadComplete(workFile)
        } catch {
          setError('Upload succeeded but response was unreadable. Please try again.')
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText)
          setError(body.error ?? 'Upload failed. Please try again.')
        } catch {
          setError('Upload failed. Please try again.')
        }
      }
    })

    xhr.addEventListener('error', () => {
      setUploading(false)
      setError('Network error during upload. Please check your connection and try again.')
    })

    xhr.addEventListener('abort', () => {
      setUploading(false)
      setError('Upload was cancelled.')
    })

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }, [workId, purpose, onUploadComplete])

  // ── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (rejectedFiles && (rejectedFiles as unknown[]).length > 0) {
      const accepted = PURPOSE_LABELS[purpose]
      setError(`Invalid file. Accepted formats: ${accepted}. Check the file type and size.`)
      return
    }
    if (acceptedFiles.length === 0) return
    uploadFile(acceptedFiles[0])
  }, [uploadFile, purpose])

  // Build the accept object react-dropzone expects: { 'mime/type': ['.ext'] }
  const acceptedMimes = ACCEPTED_TYPES[purpose]
  const accept = Object.fromEntries(
    acceptedMimes.map((mime) => [mime, []])
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize: MAX_SIZE[purpose],
    multiple: false,
    disabled: disabled || uploading || !!uploadedFile,
  })

  // ── Remove handler ──────────────────────────────────────────────────────────
  const handleRemove = () => {
    setUploadedFile(null)
    setProgress(0)
    setError(null)
    onRemove?.()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Label row */}
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>

      {/* Uploaded state */}
      {uploadedFile ? (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-green-600">✓</span>
            <div>
              <p className="text-sm font-medium text-green-900">
                {uploadedFile.storage_path.split('/').pop()}
              </p>
              <p className="text-xs text-green-700">
                {formatBytes(uploadedFile.file_size_bytes)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-green-700 underline hover:text-green-900"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={[
              'cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
              isDragActive
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-300 bg-white hover:border-indigo-300 hover:bg-gray-50',
              (disabled || uploading) ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Uploading…</p>
                {/* Progress bar */}
                <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{progress}%</p>
              </div>
            ) : isDragActive ? (
              <p className="text-sm text-indigo-600">Drop the file here…</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Drag and drop, or{' '}
                  <span className="font-medium text-indigo-600">browse</span>
                </p>
                <p className="text-xs text-gray-400">
                  {PURPOSE_LABELS[purpose]} · Max {formatBytes(MAX_SIZE[purpose])}
                </p>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </>
      )}
    </div>
  )
}
