'use client'

/**
 * components/work/ModelViewerInner.tsx
 *
 * The real @google/model-viewer implementation.
 * This file is BROWSER ONLY — never import it directly.
 * Always import from ModelViewer.tsx which wraps this with ssr: false.
 *
 * @google/model-viewer renders GLB and OBJ files interactively in-browser.
 * AR is enabled on supported mobile devices automatically via the ar attribute.
 */

import { useEffect, useRef, useState } from 'react'

interface ModelViewerInnerProps {
  src: string
  alt?: string
  className?: string
}

export default function ModelViewerInner({
  src,
  alt = '3D model preview',
  className = '',
}: ModelViewerInnerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const viewerRef = useRef<HTMLElement>(null)

  // Register the @google/model-viewer web component on mount.
  // The import itself triggers registration — no return value needed.
  useEffect(() => {
    import('@google/model-viewer').catch(() => {
      setHasError(true)
    })
  }, [])

  // Attach load and error event listeners to the web component element.
  // These are native DOM events, not React synthetic events, so we use
  // addEventListener rather than onClick-style props.
  useEffect(() => {
    const el = viewerRef.current
    if (!el) return

    const handleLoad = () => setIsLoading(false)
    const handleError = () => {
      setIsLoading(false)
      setHasError(true)
    }

    el.addEventListener('load', handleLoad)
    el.addEventListener('error', handleError)

    return () => {
      el.removeEventListener('load', handleLoad)
      el.removeEventListener('error', handleError)
    }
  }, [])

  if (hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 text-center ${className}`}
      >
        <p className="text-sm font-medium text-red-700">Failed to load 3D preview</p>
        <p className="mt-1 text-xs text-red-500">
          The file may be corrupted or in an unsupported format.
        </p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Skeleton shown while model is loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
            <p className="text-xs text-gray-400">Loading 3D model…</p>
          </div>
        </div>
      )}

      {/* The model-viewer web component */}
      <model-viewer
        ref={viewerRef}
        src={src}
        alt={alt}
        camera-controls
        ar
        ar-modes="webxr scene-viewer quick-look"
        touch-action="pan-y"
        shadow-intensity="1"
        environment-image="neutral"
        loading="eager"
        reveal="auto"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#374151',
          borderRadius: '0.5rem',
        }}
      />
    </div>
  )
}
