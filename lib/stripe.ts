/**
 * lib/stripe.ts
 * Server-only Stripe client. Import this in API routes only.
 *
 * Rules:
 * - STRIPE_SECRET_KEY is a server-only secret. This file must never be imported
 *   in any file with 'use client' or in any component under /components.
 * - All Stripe API calls (PaymentIntents, Connect accounts, etc.) go through
 *   this singleton instance.
 * - The client-side publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) is
 *   used separately in the checkout page via @stripe/stripe-js. It does not
 *   belong here.
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil',
  typescript: true,
})
