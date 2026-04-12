/**
 * app/(main)/works/new/page.tsx
 * Work creation wizard — /works/new
 *
 * Server component wrapper. Auth check happens inside the wizard via
 * the Supabase client — unauthenticated users will see an error on
 * Step 1 → Step 2 if somehow they reach this page without being logged in.
 * Middleware already redirects unauthenticated users away from /works/new.
 */

import WorkCreationWizard from '@/components/work/WorkCreationWizard'

export const metadata = {
  title: 'Upload a Work — ArtisanForge',
}

export default function NewWorkPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Upload a Work</h1>
        <p className="mt-1 text-sm text-gray-500">
          Share your art with the ArtisanForge community.
        </p>
      </div>
      <WorkCreationWizard />
    </main>
  )
}
