/**
 * next-sitemap.config.js
 *
 * Generates public/sitemap.xml and public/robots.txt as a postbuild step.
 * Add to package.json scripts: "postbuild": "next-sitemap"
 *
 * Dynamic routes (works, profiles) are fetched from Supabase using the
 * public anon key — only published works and existing users are included.
 *
 * Environment variables:
 *   NEXT_PUBLIC_SITE_URL         — canonical domain (add to .env.local + Vercel)
 *   NEXT_PUBLIC_SUPABASE_URL     — already set
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — already set
 *
 * Local builds: dotenv loads .env.local so the postbuild script can read vars.
 * Vercel builds: env vars are injected by the platform — dotenv is a no-op.
 *
 * Generated files (public/sitemap.xml, public/robots.txt) are build artifacts.
 * Add them to .gitignore if you prefer not to commit them:
 *   public/sitemap*.xml
 *   public/robots.txt
 *
 * @vercel/og dynamic OG images: deferred post-launch. Text-based generateMetadata
 * is in place on all public pages and satisfies the Phase 3 milestone.
 */

// Load .env.local for local builds — no-op on Vercel (vars injected by platform)
try {
  require('dotenv').config({ path: '.env.local' })
} catch {
  // dotenv unavailable — env vars provided by environment (Vercel, CI, etc.)
}

const { createClient } = require('@supabase/supabase-js')

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://artisanforge-brown.vercel.app' // fallback to known Vercel URL

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,

  generateRobotsTxt: true,

  // Routes excluded from the sitemap — auth flows, settings, admin, upload
  exclude: [
    '/settings',
    '/settings/*',
    '/admin',
    '/admin/*',
    '/works/new',
    '/auth/*',
    '/login',
    '/signup',
  ],

  // ---------------------------------------------------------------------------
  // Dynamic routes — fetched from Supabase at build time
  // ---------------------------------------------------------------------------
  additionalPaths: async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[next-sitemap] Supabase env vars missing — dynamic routes skipped.')
      return []
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch published works and all usernames in parallel
    const [worksResult, usersResult] = await Promise.all([
      supabase
        .from('works')
        .select('id, updated_at')
        .eq('is_published', true)
        .order('updated_at', { ascending: false }),
      supabase
        .from('users')
        .select('username, created_at')
        .order('created_at', { ascending: false }),
    ])

    if (worksResult.error) {
      console.warn('[next-sitemap] works fetch error:', worksResult.error.message)
    }
    if (usersResult.error) {
      console.warn('[next-sitemap] users fetch error:', usersResult.error.message)
    }

    const paths = []

    // Work detail pages — /works/[id]
    for (const work of worksResult.data ?? []) {
      paths.push({
        loc: `/works/${work.id}`,
        lastmod: work.updated_at ?? new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.7,
      })
    }

    // Creator profile pages — /[username]
    for (const user of usersResult.data ?? []) {
      paths.push({
        loc: `/${user.username}`,
        lastmod: user.created_at ?? new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.6,
      })
    }

    return paths
  },

  // ---------------------------------------------------------------------------
  // robots.txt
  // ---------------------------------------------------------------------------
  robotsTxtOptions: {
    policies: [
      {
        // Allow all crawlers on public content
        userAgent: '*',
        allow: '/',
        disallow: [
          '/settings',
          '/admin',
          '/works/new',
          '/auth',
          '/login',
          '/signup',
        ],
      },
    ],
    additionalSitemaps: [
      `${SITE_URL}/sitemap.xml`,
    ],
  },
}
