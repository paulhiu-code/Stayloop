import { Eye, MoveLeft, Search } from 'lucide-react';

const variations = [
  {
    id: 'wander',
    name: 'Wander',
    tagline: 'Dark luxury, minimal',
    description:
      'Clean monochrome palette, editorial spacing, and image-first layouts inspired by high-end stay brands. Understated typography lets the photography lead.',
    swatches: ['#0a0a0a', '#404040', '#fafafa'],
    accents: ['Monochrome', 'Inter typeface', 'Compact hero', 'Subtle motion'],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    tagline: 'Editorial warmth',
    description:
      'A warmer, magazine-style direction with terracotta and sage accents, serif display headlines, and generous rounded cards for an inviting, boutique feel.',
    swatches: ['#b85c38', '#3d5a4c', '#f5f0e8'],
    accents: ['Terracotta + sage', 'Serif headlines', 'Rounded cards', 'Rich badges'],
  },
] as const;

type VariationsPageProps = {
  onEnterHome?: () => void;
};

export default function VariationsPage({ onEnterHome }: VariationsPageProps) {
  function handleBack() {
    if (onEnterHome) {
      onEnterHome();
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
        <button type="button" onClick={handleBack} className="btn-ghost">
          <MoveLeft className="h-4 w-4" />
          Back to site
        </button>

        <header className="mt-8">
          <p className="section-label">StayLoop · Client Preview</p>
          <h1 className="section-title text-4xl sm:text-5xl">Choose a design direction</h1>
          <p className="section-copy mt-4">
            Two live style variations of the StayLoop platform. Open either to explore the full site
            — switch themes anytime using the floating control in the bottom-right corner.
          </p>
        </header>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {variations.map((v) => (
            <article key={v.id} className="card-surface overflow-hidden">
              <div
                className="flex h-40 items-end gap-3 p-6"
                style={{ background: 'linear-gradient(135deg, ' + v.swatches.join(', ') + ')' }}
              >
                {v.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-8 w-8 rounded-full border border-white/40"
                    style={{ background: color }}
                  />
                ))}
              </div>

              <div className="p-6">
                <p className="section-label">{v.tagline}</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">{v.name}</h2>
                <p className="mt-3 text-ink-muted leading-7">{v.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {v.accents.map((accent) => (
                    <span
                      key={accent}
                      className="rounded-pill bg-page-muted px-3 py-1 text-xs font-medium text-ink-muted"
                    >
                      {accent}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={'/?theme=' + v.id} className="btn-primary">
                    <Eye className="h-4 w-4" />
                    View home
                  </a>
                  <a href={'/search?theme=' + v.id} className="btn-secondary">
                    <Search className="h-4 w-4" />
                    View search
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-ink-subtle">
          Tip: append <code className="rounded bg-page-muted px-1.5 py-0.5 text-ink">?theme=wander</code>{' '}
          or <code className="rounded bg-page-muted px-1.5 py-0.5 text-ink">?theme=atlas</code> to any
          StayLoop URL to force a variation.
        </p>
      </div>
    </div>
  );
}
