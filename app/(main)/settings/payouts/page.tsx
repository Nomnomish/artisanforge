/**
 * app/(main)/settings/payouts/page.tsx
 * Stripe Connect onboarding and payout status page.
 *
 * Handles three URL states:
 * - ?refresh=true  — Account Link expired. Generates a new one and redirects to Stripe.
 * - ?success=true  — Creator returned from Stripe. Retrieves real account status
 *                    from Stripe API and updates the DB before rendering.
 * - (no params)    — Normal load. Shows current status from DB.
 *
 * Task 2 will add richer status UI: balance display, Express dashboard link,
 * restricted-state instructions. This page is the foundation.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import ConnectButton from '@/components/stripe/ConnectButton'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps Stripe account fields to our stripe_account_status enum */
function computeAccountStatus(account: {
  charges_enabled: boolean
  payouts_enabled: boolean
}): string {
  if (account.charges_enabled && account.payouts_enabled) return 'active'
  if (account.charges_enabled && !account.payouts_enabled) return 'restricted'
  return 'pending'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PayoutsPageProps {
  searchParams: Promise<{ refresh?: string; success?: string }>
}

export default async function PayoutsPage({ searchParams }: PayoutsPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // 1. Auth guard — redirect to login if not authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Fetch creator's current profile
  const { data: profile } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_account_status')
    .eq('id', user.id)
    .single()

  const stripeAccountId = profile?.stripe_account_id ?? null
  let stripeAccountStatus = profile?.stripe_account_status ?? 'not_connected'

  // 3. Handle ?refresh=true — Account Link expired, generate a fresh one
  if (params.refresh === 'true' && stripeAccountId) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${siteUrl}/settings/payouts?refresh=true`,
        return_url: `${siteUrl}/settings/payouts?success=true`,
        type: 'account_onboarding',
      })
      redirect(accountLink.url)
    } catch {
      // If link generation fails, fall through and render the page normally
      // so the creator can try again manually
    }
  }

  // 4. Handle ?success=true — retrieve real account status from Stripe and update DB
  if (params.success === 'true' && stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(stripeAccountId)
      const newStatus = computeAccountStatus(account)

      await supabase
        .from('users')
        .update({ stripe_account_status: newStatus })
        .eq('id', user.id)

      stripeAccountStatus = newStatus
    } catch {
      // If Stripe retrieval fails, keep the status from DB and render normally
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your Stripe account to receive payments from sales on ArtisanForge.
        </p>
      </div>

      {/* Not connected */}
      {stripeAccountStatus === 'not_connected' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">Connect your bank account</h2>
          <p className="mt-2 text-sm text-gray-600">
            ArtisanForge uses Stripe to send payouts directly to your bank account.
            Setup takes about 5 minutes and is handled securely by Stripe.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>ArtisanForge keeps a 6% platform fee on each sale</li>
            <li>The remaining 94% is transferred to your Stripe account</li>
            <li>Stripe's standard payout schedule applies (typically 2 business days)</li>
          </ul>
          <div className="mt-6">
            <ConnectButton />
          </div>
        </div>
      )}

      {/* Pending — onboarding started but not complete */}
      {stripeAccountStatus === 'pending' && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-base font-semibold text-yellow-800">Verification in progress</h2>
          <p className="mt-2 text-sm text-yellow-700">
            Your Stripe account is set up but Stripe is still verifying your information.
            This usually takes 1–2 business days. You can also continue your onboarding
            if you haven&apos;t completed all the required steps.
          </p>
          <div className="mt-6">
            <ConnectButton label="Continue Stripe setup" />
          </div>
        </div>
      )}

      {/* Active — fully verified, ready to receive payouts */}
      {stripeAccountStatus === 'active' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-base font-semibold text-green-800">Payouts active</h2>
          </div>
          <p className="mt-2 text-sm text-green-700">
            Your Stripe account is verified and ready to receive payouts.
            {/* TODO (Task 2): Add balance display and Express dashboard link here */}
          </p>
        </div>
      )}

      {/* Restricted — Stripe needs more information */}
      {stripeAccountStatus === 'restricted' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-semibold text-red-800">Action required</h2>
          <p className="mt-2 text-sm text-red-700">
            Stripe needs additional information before payouts can be enabled.
            Click below to complete the required steps in your Stripe account.
          </p>
          <div className="mt-6">
            <ConnectButton label="Complete Stripe verification" />
          </div>
        </div>
      )}
    </div>
  )
}
