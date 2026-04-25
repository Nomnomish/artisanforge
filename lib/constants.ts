/**
 * lib/constants.ts
 * Platform-wide constants for ArtisanForge.
 *
 * Rules:
 * - PLATFORM_COMMISSION_RATE must never be hardcoded anywhere else in the codebase.
 *   Always import it from here when computing Stripe application_fee_amount.
 * - File size limits are enforced both client-side (upload component) and
 *   server-side (upload API route). Both must reference these constants.
 * - CATEGORIES is the single source of truth for all category IDs and labels.
 * - ACCEPTED_PREVIEW_TYPES and ACCEPTED_DOWNLOAD_TYPES replaced ACCEPTED_3D_TYPES
 *   in Phase 2. Preview files must be GLB or OBJ (browser-renderable). Download
 *   files can be any supported format including STL. STL→GLB conversion deferred to Gen2.
 */

// -----------------------------------------------------------------------------
// STRIPE COMMISSION
// The platform's cut of every sale, taken via Stripe's application_fee_amount.
// Confirmed at Phase 4 start: 6%. Revisit before launch based on beta creator feedback.
// Example: 0.06 = 6% — platform keeps $0.60 on a $10.00 sale.
// -----------------------------------------------------------------------------
export const PLATFORM_COMMISSION_RATE = 0.06

// -----------------------------------------------------------------------------
// FILE UPLOAD LIMITS
// Enforced in both the upload component (client) and upload API route (server).
// -----------------------------------------------------------------------------
export const MAX_3D_FILE_SIZE_BYTES = 100 * 1024 * 1024   // 100 MB
export const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024  // 20 MB

// -----------------------------------------------------------------------------
// ACCEPTED FILE TYPES
// ACCEPTED_PREVIEW_TYPES: files that render in-browser via @google/model-viewer.
//   GLB and OBJ only — STL is not browser-renderable. STL→GLB conversion is Gen2.
// ACCEPTED_DOWNLOAD_TYPES: files a buyer receives after purchase. Any format
//   the creator wants to distribute, including STL.
// ACCEPTED_IMAGE_TYPES: used for both work images and thumbnails.
// All three are enforced client-side (dropzone) and server-side (upload route).
// -----------------------------------------------------------------------------
export const ACCEPTED_PREVIEW_TYPES = [
  'model/gltf-binary', // .glb
  'model/obj',         // .obj
] as const

export const ACCEPTED_DOWNLOAD_TYPES = [
  'model/gltf-binary', // .glb
  'model/obj',         // .obj
  'model/stl',         // .stl
  'application/octet-stream', // fallback MIME for .stl files (common in browsers)
] as const

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

// All file types accepted anywhere on the platform (union — for generic checks)
export const ALL_ACCEPTED_TYPES = [
  ...ACCEPTED_PREVIEW_TYPES,
  ...ACCEPTED_DOWNLOAD_TYPES,
  ...ACCEPTED_IMAGE_TYPES,
] as const

// -----------------------------------------------------------------------------
// WORK CATEGORIES
// Single source of truth for all category IDs and display labels.
// id must match the check constraint in 0001_initial_schema.sql.
// -----------------------------------------------------------------------------
export const CATEGORIES = [
  { id: '3d-models',       label: '3D Models' },
  { id: 'painted-minis',   label: 'Painted Minis' },
  { id: 't-shirt-designs', label: 'T-Shirt Designs' },
  { id: 'traditional-art', label: 'Traditional Art' },
  { id: 'digital-art',     label: 'Digital Art' },
] as const

export type CategoryId = typeof CATEGORIES[number]['id']

// -----------------------------------------------------------------------------
// DOWNLOAD URL TTL
// Signed Supabase Storage URLs for purchased files expire after this duration.
// 3600 seconds = 1 hour. Adjust if buyers report expiry issues.
// -----------------------------------------------------------------------------
export const DOWNLOAD_URL_TTL_SECONDS = 3600