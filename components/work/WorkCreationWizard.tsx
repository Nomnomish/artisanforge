'use client'

/**
 * components/work/WorkCreationWizard.tsx
 *
 * Multi-step work creation wizard.
 *
 * Step 1 — Category: user picks a category. On Next, a draft works row is
 *           created in Supabase and the work_id is saved to localStorage.
 * Step 2 — Files: context-aware upload slots based on category.
 *           3D Models: preview file (GLB/OBJ, required) + download file (any, optional)
 *           All others: primary image (required) + download file (any, optional)
 * Step 3 — Details: title (required), description, tags via react-hook-form + zod.
 *           Suggested tags are shown as clickable pills, fetched from published
 *           works in the same category on mount (client-side flatten/dedup).
 *           Updates the works row in Supabase on Next.
 * Step 4 — Review & Publish: summary + Save as Draft or Publish buttons.
 *
 * Draft persistence: localStorage key 'artisanforge_work_draft' stores
 * workId, step, category, file IDs, title, description, tags.
 * On mount, if a draft exists, the user is offered to resume or start fresh.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, CategoryId } from '@/lib/constants'
import FileUpload, { WorkFile } from '@/components/work/FileUpload'

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'artisanforge_work_draft'
const STEPS = ['Category', 'Files', 'Details', 'Publish'] as const
type Step = 0 | 1 | 2 | 3

// Max suggested tags to display below the tags input
const MAX_SUGGESTIONS = 15

// ── Draft shape ───────────────────────────────────────────────────────────────

interface DraftState {
  workId: string
  step: Step
  category: CategoryId
  previewFile: WorkFile | null
  downloadFile: WorkFile | null
  title: string
  description: string
  tags: string
}

// ── Details form schema ───────────────────────────────────────────────────────

const detailsSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(120, 'Title must be 120 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer').optional(),
  // tags stays as a plain string in the form — split to string[] manually before saving
  tags: z.string().optional(),
})

type DetailsFormValues = z.infer<typeof detailsSchema>

// Convert the raw comma-separated tags string to a clean string array for Supabase
function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function saveDraft(draft: Partial<DraftState>) {
  try {
    const existing = loadDraft()
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...existing, ...draft }))
  } catch {
    // localStorage unavailable — continue silently
  }
}

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as DraftState) : null
  } catch {
    return null
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={[
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              i < current
                ? 'bg-indigo-600 text-white'
                : i === current
                ? 'border-2 border-indigo-600 text-indigo-600'
                : 'border-2 border-gray-300 text-gray-400',
            ].join(' ')}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span
            className={`text-xs ${
              i === current ? 'font-medium text-gray-900' : 'text-gray-400'
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px w-6 ${i < current ? 'bg-indigo-600' : 'bg-gray-300'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkCreationWizard() {
  const router = useRouter()
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(0)
  const [workId, setWorkId] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [previewFile, setPreviewFile] = useState<WorkFile | null>(null)
  const [downloadFile, setDownloadFile] = useState<WorkFile | null>(null)
  const [resumePrompt, setResumePrompt] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggested tags for Step 3 — populated once when the user reaches Step 2→3.
  // Fetched from the 50 most recent published works in the same category,
  // flattened and deduplicated client-side. No DB migration needed.
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])

  // Details form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { title: '', description: '', tags: '' },
  })

  const titleValue = watch('title')
  const tagsValue = watch('tags')

  // ── Draft resume prompt on mount ───────────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft()
    if (draft?.workId) {
      setResumePrompt(draft)
    }
  }, [])

  // ── Fetch suggested tags when category is known ────────────────────────────
  // Runs once when workId is set (Step 1 → 2) and category is confirmed.
  // Fetches tags from the 50 most recently published works in the category,
  // flattens the text[] arrays, deduplicates, and sorts alphabetically.
  useEffect(() => {
    if (!category || !workId) return

    async function fetchSuggestedTags() {
      const { data, error: fetchError } = await supabase
        .from('works')
        .select('tags')
        .eq('category', category!)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError || !data) return

      // Flatten all tags arrays, lowercase, deduplicate, sort, cap at max
      const all = data.flatMap((row) => row.tags ?? [])
      const unique = [...new Set(all.map((t) => t.toLowerCase()))].sort()
      setSuggestedTags(unique.slice(0, MAX_SUGGESTIONS))
    }

    fetchSuggestedTags()
  }, [category, workId, supabase])

  // ── Append a suggested tag to the current tags input value ────────────────
  // Skips tags that are already present. Appends with comma separator.
  const handleTagSuggestion = useCallback(
    (tag: string) => {
      const current = parseTags(tagsValue)
      if (current.includes(tag)) return // already in the list — no-op

      const updated = current.length > 0 ? `${tagsValue}, ${tag}` : tag
      setValue('tags', updated, { shouldValidate: false })
    },
    [tagsValue, setValue],
  )

  const resumeDraft = useCallback((draft: DraftState) => {
    setWorkId(draft.workId)
    setStep(draft.step)
    setCategory(draft.category)
    setPreviewFile(draft.previewFile)
    setDownloadFile(draft.downloadFile)
    setValue('title', draft.title)
    setValue('description', draft.description)
    setValue('tags', draft.tags)
    setResumePrompt(null)
  }, [setValue])

  const startFresh = useCallback(() => {
    clearDraft()
    setResumePrompt(null)
  }, [])

  // ── Step 1 → Step 2: create draft works row ────────────────────────────────
  const handleCategoryNext = useCallback(async () => {
    if (!category) return
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in to upload a work.')
      setLoading(false)
      return
    }

    const { data, error: dbError } = await supabase
      .from('works')
      .insert({
        user_id: user.id,
        title: 'Untitled Draft',
        category,
        is_published: false,
      })
      .select('id')
      .single()

    if (dbError || !data) {
      setError('Failed to create draft. Please try again.')
      setLoading(false)
      return
    }

    const newWorkId = data.id
    setWorkId(newWorkId)
    const newStep: Step = 1
    setStep(newStep)
    saveDraft({
      workId: newWorkId,
      step: newStep,
      category,
      previewFile: null,
      downloadFile: null,
      title: '',
      description: '',
      tags: '',
    })
    setLoading(false)
  }, [category, supabase])

  // ── Step 2 → Step 3: validate at least the required file is present ────────
  const handleFilesNext = useCallback(() => {
    setError(null)
    const needs3DPreview = category === '3d-models'
    if (needs3DPreview && !previewFile) {
      setError('A preview file (GLB or OBJ) is required for 3D Models.')
      return
    }
    if (!needs3DPreview && !previewFile) {
      setError('A primary image is required.')
      return
    }
    const newStep: Step = 2
    setStep(newStep)
    saveDraft({ step: newStep, previewFile, downloadFile })
  }, [category, previewFile, downloadFile])

  // ── Step 3 → Step 4: update works row with details ─────────────────────────
  const handleDetailsNext = handleSubmit(async (values) => {
    if (!workId) return
    setLoading(true)
    setError(null)

    const tags = parseTags(values.tags)

    const { error: dbError } = await supabase
      .from('works')
      .update({
        title: values.title,
        description: values.description ?? null,
        tags,
      })
      .eq('id', workId)

    if (dbError) {
      setError('Failed to save details. Please try again.')
      setLoading(false)
      return
    }

    const newStep: Step = 3
    setStep(newStep)
    saveDraft({
      step: newStep,
      title: values.title,
      description: values.description ?? '',
      tags: values.tags ?? '',
    })
    setLoading(false)
  })

  // ── Step 4: publish or save as draft ──────────────────────────────────────
  const handlePublish = useCallback(async (publish: boolean) => {
    if (!workId) return
    setLoading(true)
    setError(null)

    const { error: dbError } = await supabase
      .from('works')
      .update({ is_published: publish })
      .eq('id', workId)

    if (dbError) {
      setError('Failed to save. Please try again.')
      setLoading(false)
      return
    }

    clearDraft()
    router.push(`/works/${workId}`)
  }, [workId, supabase, router])

  // ── Resume prompt ──────────────────────────────────────────────────────────
  if (resumePrompt) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Resume your draft?</h2>
        <p className="text-sm text-gray-500 mb-6">
          You have an unfinished work in progress. Would you like to pick up where you left off?
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => resumeDraft(resumePrompt)}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Resume draft
          </button>
          <button
            onClick={startFresh}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Start fresh
          </button>
        </div>
      </div>
    )
  }

  // ── Step 1: Category ───────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="mx-auto max-w-lg">
        <StepIndicator current={0} />
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">What are you uploading?</h2>
          <p className="text-sm text-gray-500 mb-6">Choose the category that best fits your work.</p>

          <div className="space-y-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={[
                  'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
                  category === cat.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 text-xs text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleCategoryNext}
              disabled={!category || loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Files ──────────────────────────────────────────────────────────
  if (step === 1 && workId) {
    const is3D = category === '3d-models'

    return (
      <div className="mx-auto max-w-lg">
        <StepIndicator current={1} />
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload your files</h2>
          <p className="text-sm text-gray-500 mb-6">
            {is3D
              ? 'Add a preview file so visitors can view your model in-browser, and optionally a download file for buyers.'
              : 'Add a primary image for your work, and optionally a download file for buyers.'}
          </p>

          <div className="space-y-6">
            {/* Preview/image slot — required */}
            <FileUpload
              workId={workId}
              purpose={is3D ? 'preview' : 'image'}
              label={is3D ? 'Preview file (required)' : 'Primary image (required)'}
              hint={
                is3D
                  ? 'GLB or OBJ — renders interactively for visitors'
                  : 'PNG, JPEG, or WEBP — shown on your work page'
              }
              onUploadComplete={(wf) => {
                setPreviewFile(wf)
                saveDraft({ previewFile: wf })
              }}
              onRemove={() => {
                setPreviewFile(null)
                saveDraft({ previewFile: null })
              }}
            />

            {/* Download slot — optional */}
            <FileUpload
              workId={workId}
              purpose="download"
              label="Download file (optional)"
              hint={
                is3D
                  ? 'STL, OBJ, or GLB — the file buyers receive after purchase'
                  : 'Any format — the file buyers receive after purchase'
              }
              onUploadComplete={(wf) => {
                setDownloadFile(wf)
                saveDraft({ downloadFile: wf })
              }}
              onRemove={() => {
                setDownloadFile(null)
                saveDraft({ downloadFile: null })
              }}
            />
          </div>

          {error && <p className="mt-4 text-xs text-red-600">{error}</p>}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(0)}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleFilesNext}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Details ────────────────────────────────────────────────────────
  if (step === 2) {
    // Tags already entered by the user (parsed for dedup check in handleTagSuggestion)
    const currentTags = parseTags(tagsValue)

    return (
      <div className="mx-auto max-w-lg">
        <StepIndicator current={2} />
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Tell us about your work</h2>
          <p className="text-sm text-gray-500 mb-6">Add a title, description, and tags to help people discover it.</p>

          <form onSubmit={handleDetailsNext} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                {...register('title')}
                type="text"
                placeholder="e.g. Dragon Miniature — 28mm Scale"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="mt-1 flex justify-between">
                {errors.title ? (
                  <p className="text-xs text-red-600">{errors.title.message}</p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-gray-400">{titleValue?.length ?? 0}/120</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Describe your work — techniques used, scale, inspiration, print settings…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Tags
              </label>
              <input
                {...register('tags')}
                type="text"
                placeholder="dragon, fantasy, 28mm, fdm"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Separate tags with commas. {tagsValue ? tagsValue.split(',').filter(Boolean).length : 0} tag
                {tagsValue?.split(',').filter(Boolean).length === 1 ? '' : 's'} added.
              </p>

              {/* Suggested tags — only shown when suggestions exist */}
              {suggestedTags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Popular in this category:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTags.map((tag) => {
                      const alreadyAdded = currentTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagSuggestion(tag)}
                          disabled={alreadyAdded}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            alreadyAdded
                              ? 'bg-indigo-100 text-indigo-400 cursor-default'
                              : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                          }`}
                        >
                          #{tag}
                          {alreadyAdded && <span className="ml-1">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Next'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Step 4: Review & Publish ───────────────────────────────────────────────
  if (step === 3) {
    const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label ?? category
    const tagsRaw = watch('tags')
    const tagList = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

    return (
      <div className="mx-auto max-w-lg">
        <StepIndicator current={3} />
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Ready to share?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Review your work before publishing. You can always edit it later.
          </p>

          {/* Summary */}
          <div className="space-y-3 rounded-lg bg-gray-50 p-4 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="font-medium text-gray-900">{categoryLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Title</span>
              <span className="font-medium text-gray-900 max-w-[60%] text-right">{watch('title')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Preview file</span>
              <span className={`font-medium ${previewFile ? 'text-green-700' : 'text-red-500'}`}>
                {previewFile ? previewFile.storage_path.split('/').pop() : 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Download file</span>
              <span className="font-medium text-gray-900">
                {downloadFile ? downloadFile.storage_path.split('/').pop() : '—'}
              </span>
            </div>
            {tagList.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tags</span>
                <span className="font-medium text-gray-900 text-right max-w-[60%]">
                  {tagList.join(', ')}
                </span>
              </div>
            )}
          </div>

          {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => handlePublish(false)}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save as draft
            </button>
            <button
              onClick={() => handlePublish(true)}
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Publishing…' : 'Publish'}
            </button>
          </div>

          <div className="mt-3 flex justify-start">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-gray-400 underline hover:text-gray-600"
            >
              Back to details
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
