/**
 * types/model-viewer.d.ts
 *
 * Global JSX type declaration for the @google/model-viewer web component.
 * Tells TypeScript that <model-viewer> is a valid HTML element.
 *
 * Uses the React.JSX namespace which is required when compilerOptions.jsx
 * is set to "react-jsx" (the Next.js default).
 */

import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          alt?: string
          ar?: boolean
          'ar-modes'?: string
          'camera-controls'?: boolean
          'touch-action'?: string
          'shadow-intensity'?: string
          'environment-image'?: string
          loading?: string
          reveal?: string
          style?: React.CSSProperties
        },
        HTMLElement
      >
    }
  }
}
