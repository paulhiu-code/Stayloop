import { Palette } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { THEMES } from '../themes/config';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="theme-switcher fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-3">
      {open && (
        <div className="w-72 overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-elevated backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Demo styles</p>
          <p className="mt-1 text-sm text-ink-muted">Switch themes for client review. Choice persists in URL and local storage.</p>

          <div className="mt-4 space-y-2">
            {THEMES.map((option) => {
              const active = theme === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                      : 'border-border bg-page-muted hover:border-brand/40',
                  ].join(' ')}
                >
                  <span
                    className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-sm"
                    style={{ background: option.swatch }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 rounded-lg bg-page-muted px-3 py-2 text-[0.7rem] leading-5 text-ink-muted">
            Shareable link: add <code className="rounded bg-surface px-1 py-0.5 text-ink">?theme=wander</code> or{' '}
            <code className="rounded bg-surface px-1 py-0.5 text-ink">?theme=atlas</code>
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-elevated transition hover:border-brand/40 hover:shadow-card"
        aria-expanded={open}
        aria-label="Toggle theme switcher"
      >
        <Palette className="h-4 w-4 text-brand" />
        {THEMES.find((option) => option.id === theme)?.label ?? 'Theme'}
      </button>
    </div>
  );
}
