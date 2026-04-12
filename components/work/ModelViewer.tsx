'use client'
/**
 * components/work/ModelViewer.tsx
 *
 * Dynamic wrapper around ModelViewerInner with ssr: false.
 * This is the file the rest of the app imports — never import
 * ModelViewerInner directly.
 *
 * Why dynamic + ssr: false?
 * @google/model-viewer is a browser web component. It references
 * browser-only APIs (WebGL, ResizeObserver, etc.) that don't exist
 * in Node.js. If Next.js tries to server-render it the build will crash.
 * next/dynamic with ssr: false skips server rendering entirely for this
 * component and only loads it in the browser.
 *
 * Usage:
 *   import ModelViewer from '@/components/work/ModelViewer'
 *   <ModelViewer src={publicUrl} className="h-96 w-full" />
 */

import dynamic from 'next/dynamic'

const ModelViewer = dynamic(
  () => import('./ModelViewerInner'),
  {
    ssr: false,
    // Shown while the dynamic import is resolving (before the browser
    // has loaded the ModelViewerInner bundle)
    loading: () => (
      <div className="flex items-center justify-center rounded-lg bg-gray-100">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
          <p className="text-xs text-gray-400">Loading 3D preview…</p>
        </div>
      </div>
    ),
  }
)

export default ModelViewer
