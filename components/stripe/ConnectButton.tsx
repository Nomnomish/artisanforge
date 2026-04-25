'use client'

/**
 * components/stripe/ConnectButton.tsx
 * "Connect with Stripe" button for the /settings/payouts page.
 *
 * POSTs to /api/stripe/connect/onboard, receives a short-lived Stripe Account
 * Link URL, and redirects the creator to Stripe's hosted onboarding flow.
 *
 * Uses a useRef in-flight guard (Phase 3 rule) to prevent double-clicks from
 * creating duplicate Stripe accounts.
 */

import { useRef, useState } from 'react'


interface ConnectButtonProps {
  /** Label override — defaults to "Connect with Stripe" */
  label?: string
}

export default function ConnectButton({ label = 'Connect with Stripe' }: ConnectButtonProps) {
  const inFlight = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.url) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      // Redirect to Stripe's hosted onboarding flow.
      // We use window.location.href (full navigation) rather than Next.js router.push
      // because Stripe's onboarding is an external URL outside our app.
      window.location.href = data.url

    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Redirecting to Stripe…' : label}
      </button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
