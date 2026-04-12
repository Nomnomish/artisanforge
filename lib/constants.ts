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
 */

// -----------------------------------------------------------------------------
// STRIPE COMMISSION
// The platform's cut of every sale, taken via Stripe's application_fee_amount.
// TODO: Decide this value before Phase 4 begins.
// Typical marketplace range: 5–15%. Current placeholder: 10%.
// Example: 0.10 = 10% — platform keeps $1.00 on a $10.00 sale.
// -----------------------------------------------------------------------------
export const PLATFORM_COMMISSION_RATE = 0.10

// -----------------------------------------------------------------------------
// FILE UPLOAD LIMITS
// Enforced in both the upload component (client) and upload API route (server).
// -----------------------------------------------------------------------------
export const MAX_3D_FILE_SIZE_BYTES = 100 * 1024 * 1024   // 100 MB
export const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024  // 20 MB

// -----------------------------------------------------------------------------
// ACCEPTED FILE TYPES
// Used for client-side validation in the dropzone and server-side MIME checking.
// -----------------------------------------------------------------------------
export const ACCEPTED_3D_TYPES = [
  'model/stl',
  'model/obj',
  'model/gltf-binary',
] as const

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
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
