/**
 * app/api/stripe/connect/onboard/route.ts
 * POST /api/stripe/connect/onboard
 *
 * Creates a Stripe Express account for the authenticated creator (if they don't
 * have one yet) and returns a short-lived Stripe Account Link URL. The client
 * redirects the creator to that URL to complete Stripe's hosted onboarding flow.
 *
 * On return from Stripe, the creator lands on /settings/payouts?success=true
 * or /settings/payouts?refresh=true (if the link expired).
 *
 * Security:
 * - Requires authenticated session — returns 401 if not logged in.
 * - Uses the Supabase server client (cookie-based auth) for DB writes.
 *   The creator is updating their own row, so standard RLS allows this.
 * - STRIPE_SECRET_KEY is server-only — never reaches the client.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()

  // 1. Verify the creator is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get the creator's current profile row
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_account_status')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  try {
    let stripeAccountId = profile.stripe_account_id

    // 3. Create a new Stripe Express account if the creator doesn't have one yet.
    //    If they already have an account_id (e.g. they started onboarding before),
    //    we skip creation and generate a fresh account link for the existing account.
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: {
          supabase_user_id: user.id,
        },
      })

      stripeAccountId = account.id

      // Save the account ID and set initial status to 'pending'
      const { error: updateError } = await supabase
        .from('users')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_account_status: 'pending',
        })
        .eq('id', user.id)

      if (updateError) {
        // If we can't save the account ID, the creator would be orphaned from
        // their Stripe account. Return an error so they can try again.
        console.error('Failed to save stripe_account_id:', updateError)
        return NextResponse.json(
          { error: 'Failed to save account. Please try again.' },
          { status: 500 }
        )
      }
    }

    // 4. Create a short-lived Account Link URL.
    //    refresh_url: where Stripe sends the creator if the link expires.
    //    return_url:  where Stripe sends the creator after completing (or skipping) onboarding.
    //    Both must be absolute URLs — we use NEXT_PUBLIC_SITE_URL set in Phase 3.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/settings/payouts?refresh=true`,
      return_url: `${siteUrl}/settings/payouts?success=true`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })

  } catch (err) {
    console.error('Stripe Connect onboard error:', err)
    return NextResponse.json(
      { error: 'Failed to create Stripe onboarding link. Please try again.' },
      { status: 500 }
    )
  }
}
