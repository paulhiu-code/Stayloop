import { Check, Copy, ExternalLink, FlaskConical, GitBranch, Link2, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDesignVariant } from '../../contexts/DesignVariantContext';
import {
  DEFAULT_DESIGN_VARIANT,
  listDesignVariants,
  withVariantParam,
  type DesignVariantId,
} from '../../lib/designVariants';

const PREVIEW_SURFACES = [
  { label: 'Homepage', path: '/' },
  { label: 'Search', path: '/search?guests=1' },
  { label: 'Hosts', path: '/hosts' },
  { label: 'Partners', path: '/partners' },
] as const;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

function statusStyles(status: string) {
  switch (status) {
    case 'baseline':
      return 'bg-slate-100 text-slate-700';
    case 'review':
      return 'bg-orange-100 text-orange-800';
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function DesignLabPage({ onClose }: { onClose: () => void }) {
  const { variant, setVariant } = useDesignVariant();
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);

    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);

    return () => {
      document.head.removeChild(robots);
    };
  }, []);

  const variants = listDesignVariants();

  function previewUrl(path: string, variantId: DesignVariantId) {
    return `${origin}${withVariantParam(path, variantId)}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <header className="border-b border-orange-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">StayLoop</p>
              <h1 className="text-2xl font-extrabold text-slate-950">Design Lab</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50"
          >
            Back to site
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-orange-100 bg-white/90 p-8 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950">Share preview links with stakeholders</h2>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                Each design experiment lives on its own Git branch. Vercel deploys that branch to an unlisted preview URL.
                Use this page to compare variants and copy direct links for client review — nothing ships to production until
                you merge the winning branch.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['1. Branch', 'Create `design/<surface>-<concept>-v1` from `main`.'],
              ['2. Preview', 'Open the PR and copy the Vercel Preview URL.'],
              ['3. Decide', 'Merge only the approved branch into `main`.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center gap-3">
            <Palette className="h-5 w-5 text-orange-600" />
            <h2 className="text-xl font-extrabold text-slate-950">Available variants on this deployment</h2>
          </div>

          <div className="grid gap-5">
            {variants.map((entry) => {
              const isActive = entry.id === variant;

              return (
                <article
                  key={entry.id}
                  className={`rounded-[2rem] border p-6 shadow-lg transition ${
                    isActive
                      ? 'border-orange-300 bg-white ring-2 ring-orange-200'
                      : 'border-slate-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-extrabold text-slate-950">{entry.name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusStyles(entry.status)}`}>
                          {entry.status}
                        </span>
                        {isActive && (
                          <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-2 max-w-2xl text-slate-600">{entry.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <GitBranch className="h-4 w-4" />
                          Branch: <code className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{entry.branch}</code>
                        </span>
                        <span>Surfaces: {entry.surfaces.join(', ')}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setVariant(entry.id)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                        isActive
                          ? 'bg-orange-500 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50'
                      }`}
                    >
                      {isActive ? 'Selected' : 'Preview variant'}
                    </button>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {PREVIEW_SURFACES.map((surface) => {
                      const url = previewUrl(surface.path, entry.id);
                      return (
                        <div
                          key={`${entry.id}-${surface.label}`}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{surface.label}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{url}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <CopyButton value={url} label={`${entry.name} ${surface.label} link`} />
                            <a
                              href={withVariantParam(surface.path, entry.id)}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Open
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-dashed border-orange-200 bg-white/70 p-6">
          <h2 className="text-lg font-extrabold text-slate-950">Adding the first design variant</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This deployment currently ships with the <strong>control</strong> baseline only. When we start the first
            experiment together, we will create a branch like <code>design/homepage-editorial-v1</code>, register the new
            variant in <code>src/lib/designVariants.ts</code>, and add token overrides in <code>src/index.css</code>.
            Stakeholders will review that branch&apos;s Vercel preview URL before anything merges to production.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Current preview origin: <code className="rounded bg-slate-100 px-2 py-0.5">{origin || '…'}</code>
            {variant !== DEFAULT_DESIGN_VARIANT ? (
              <>
                {' '}
                · Active variant: <code className="rounded bg-slate-100 px-2 py-0.5">{variant}</code>
              </>
            ) : null}
          </p>
        </section>
      </main>
    </div>
  );
}
