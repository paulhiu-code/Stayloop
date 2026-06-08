# StayLoop Design Review Workflow

This document describes how to preview design alternatives for stakeholder review **without shipping changes to production**.

## Overview

| Layer | Purpose |
|-------|---------|
| **Git branches** | One branch per design direction |
| **Vercel Preview URLs** | Unlisted deploy per branch/PR |
| **Design Lab (`/design-lab`)** | Hub to compare variants and copy share links |
| **Variant tokens (`data-variant`)** | CSS-level theming without touching business logic |

Production (`stay-loop.co`) stays on `main` until a design branch is explicitly merged.

---

## Quick start: present a design to stakeholders

### 1. Create a design branch

From latest `main`:

```bash
git checkout main
git pull origin main
git checkout -b design/homepage-editorial-v1
```

**Branch naming convention:**

```
design/<surface>-<concept>-v<n>
```

Examples:
- `design/homepage-editorial-v1`
- `design/hero-minimal-v2`
- `design/search-pill-v1`

### 2. Implement styling-only changes

On the design branch:

1. Register the variant in `src/lib/designVariants.ts`
2. Add token overrides in `src/index.css` under `[data-variant='your-variant-id']`
3. Update only Tailwind classes / CSS — do not change data bindings, API calls, or state logic

### 3. Open a Draft PR

```bash
git push -u origin design/homepage-editorial-v1
```

Open a **Draft** pull request against `main`. Vercel automatically builds a preview deployment.

### 4. Share the preview URL

In the PR, copy the **Vercel Preview** link (pattern):

```
https://stayloop-git-design-homepage-editorial-v1-<team>.vercel.app
```

Share with stakeholders along with direct surface links:

| Surface | URL |
|---------|-----|
| Design Lab | `/design-lab` |
| Homepage | `/?variant=<variant-id>` |
| Search | `/search?guests=1&variant=<variant-id>` |

The Design Lab page includes one-click copy buttons for each link.

### 5. Collect feedback and decide

- Record feedback in PR comments
- Iterate on the same branch, or create `v2` branch if direction diverges significantly
- **Merge only the winning branch** into `main`
- Close/delete losing branches

---

## Design Lab access

The Design Lab is available when **any** of these are true:

| Environment | Access |
|-------------|--------|
| Local dev (`npm run dev`) | Always |
| Vercel Preview (`*-git-*-*.vercel.app`) | Automatic |
| Explicit flag | `VITE_DESIGN_LAB=true` in Vercel Preview env |

Production (`stay-loop.co`) does **not** expose `/design-lab` unless `VITE_DESIGN_LAB` is set (leave unset on Production).

### Optional: enable Design Lab on all preview builds

In Vercel → Project → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_DESIGN_LAB` | `true` | Preview only |

---

## Adding a new variant (developer checklist)

When starting a new design experiment on a branch:

### 1. Extend the variant type

In `src/lib/designVariants.ts`:

```ts
export type DesignVariantId = 'control' | 'editorial';

export const DESIGN_VARIANTS = {
  control: { /* existing */ },
  editorial: {
    id: 'editorial',
    name: 'Editorial Warmth',
    description: 'Serif headlines, softer gradients, increased whitespace.',
    branch: 'design/homepage-editorial-v1',
    status: 'review',
    surfaces: ['Homepage', 'Hero', 'Property cards'],
  },
};
```

### 2. Add CSS token overrides

In `src/index.css`:

```css
[data-variant='editorial'] {
  --color-brand-500: 234 88 12;
  --color-accent-500: 190 24 93;
  --font-display: 'Fraunces', ui-serif, Georgia, serif;
  --radius-card: 1.5rem;
}
```

### 3. Apply tokens in components (gradually)

Prefer semantic utilities where available:

- `text-brand-600` instead of `text-orange-600`
- `rounded-card` instead of `rounded-[2rem]`
- `.btn-primary`, `.section-label`, `.card-surface` component classes

Existing hard-coded classes continue to work; migrate surfaces as you touch them.

### 4. Load fonts (if needed)

Add font links in `index.html` or use `@import` in `index.css` for the variant.

---

## Supabase auth on preview URLs

For sign-in flows on preview deployments, add the preview domain pattern to Supabase Auth → URL Configuration → Redirect URLs:

```
https://*.vercel.app/**
```

Or add specific preview URLs as needed.

---

## Cleanup policy

After a design decision:

1. Merge the winner into `main`
2. Close losing PRs
3. Delete `design/*` branches within 2 weeks
4. Archive or remove losing variant entries from `designVariants.ts` (set `status: 'archived'`)

---

## What not to do

- Do not merge design experiments directly to `main` without stakeholder sign-off
- Do not run production A/B tests until a direction is approved
- Do not change business logic, API integrations, or state management in design branches
- Do not set `VITE_DESIGN_LAB=true` on the Production Vercel environment

---

## File reference

| File | Role |
|------|------|
| `src/lib/designVariants.ts` | Variant registry, URL parsing, preview detection |
| `src/contexts/DesignVariantContext.tsx` | Applies `data-variant` to `<html>`, syncs `?variant=` |
| `src/components/design-lab/DesignLabPage.tsx` | Stakeholder hub with shareable links |
| `src/components/design-lab/DesignPreviewBanner.tsx` | Preview indicator on non-production deploys |
| `src/index.css` | CSS custom properties per variant |
| `tailwind.config.js` | Semantic token mapping (`brand`, `accent`, `surface`) |
