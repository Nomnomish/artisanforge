import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

/**
 * OAuth callback route — /auth/callback
 *
 * This route is the redirect target after Google OAuth completes.
 * It receives a one-time `code` from the OAuth provider, exchanges it
 * for a Supabase session, sets the session cookie, and redirects the
 * user into the app.
 *
 * Also handles email confirmation links — Supabase sends the user to
 * this route after they click the confirmation link in their inbox.
 *
 * Flow:
 *   1. Google/email link redirects here with ?code=xxx
 *   2. exchangeCodeForSession() trades the code for a session
 *   3. Supabase sets the session cookie automatically
 *   4. User is redirected to the feed (/) or the originally requested URL
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` allows redirecting back to a protected page the user was trying to reach
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful auth — redirect to the feed or originally requested page
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If we get here: no code was provided or the exchange failed.
  // Redirect to login with an error indicator so the UI can show a message.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
