import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type Database } from '@/types/database'

/**
 * Server-side Supabase client.
 * Use this in Server Components, API route handlers, and Server Actions.
 * Reads the user session from cookies — never exposes the service role key.
 *
 * NOTE: This uses the anon key, which respects RLS policies.
 * For operations that need to bypass RLS (e.g. admin writes in API routes),
 * create a separate admin client using SUPABASE_SERVICE_ROLE_KEY in that
 * route handler only — never import it here.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can only be
            // set in middleware or route handlers. This is safe to ignore
            // because middleware handles session refresh on every request.
          }
        },
      },
    }
  )
}
