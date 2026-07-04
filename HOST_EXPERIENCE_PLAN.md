# StayLoop Host Experience — Analysis & Implementation Plan

**Goal:** Deliver an onboarding + hosting experience that is frictionless and as professional as
Airbnb / Vrbo, covering the full "soup to nuts" pathway: sign up → become a host → connect
payouts (Stripe Connect/Express) → create a listing (with **no** PMS required) → publish → manage.

**Status legend:** ✅ shipped in this effort · 🔜 recommended next · ⛔ blocked on external creds

---

## 1. Current-state audit (what exists today)

| Area | File(s) | State before this work |
|------|---------|------------------------|
| Auth / signup | `AuthModal.tsx`, `AuthContext.tsx` | ✅ Solid. Email+password + Google OAuth, guest/host intent, referral code. Host intent sets `user_type='both'`. |
| Host marketing page | `HostsPage.tsx` | ✅ Good copy. But **"Start listing" only opens the auth modal** — no destination after signup. |
| Stripe payout onboarding | `HostOnboarding.tsx`, `server/handlers/payments.js`, `api/stripe/connect/*` | 🔶 Backend fully implemented (Express + Vercel routes: create-account, onboarding-link, account-status). **Frontend auto-fires the redirect on mount** — abrupt, no context, no way to opt in. |
| Stripe payout status | `HostDashboard.tsx` | ✅ Functional status page (charges/payouts/details). |
| Listing creation | — | ⛔ **Does not exist.** Dashboard "Add Property" / "List Your First Property" buttons have **no `onClick`**. PRD `PROP-001` (wizard) & `PROP-006` (photos) = "Planned". |
| Photo upload | — | ⛔ No Supabase Storage bucket; `properties.images` is written only by PMS sync. |
| Listing management | `Dashboard.tsx` | 🔶 Read-only list of properties; no edit / publish / unpublish (`PROP-102` = Planned). |
| PMS import path | `PMSSettings.tsx`, `lib/pms.ts` | ✅ OwnerRez/Guesty sync exists (the "I already have software" path). |
| DB schema | `migrations/…initial_schema.sql` | ✅ `properties` table already has every column the wizard needs; RLS insert/update/delete policies for `host_id = auth.uid()` are in place. |

### The core gap
A brand-new host who does **not** use a PMS has **no way to create a listing**. This is the single
biggest hole and the primary focus of this plan. The pathway simply dead-ends at two buttons that do
nothing.

---

## 2. Benchmark: Airbnb's "Become a host" flow

Airbnb structures listing creation into **three phases** (verified against Airbnb's official
"How to get started" resource + 2026 host setup guides):

1. **Tell us about your place** — property type → place type (entire/private/shared) → location
   (address + map) → basics (guests, bedrooms, beds, bathrooms).
2. **Make it stand out** — amenities → photos (≥5 recommended) → title (≤50 chars, lead with the
   best feature) → description.
3. **Finish up & publish** — pricing (nightly + cleaning), instant-book, min/max nights, house
   rules → review → publish.

Supporting principles we adopt:
- **Save & exit at any time** (draft persistence); hosts "prepare at their own pace."
- **Progress is always visible**; each step is short and single-focus.
- **Publishing and payouts are decoupled** — you can build a listing before finishing payout setup,
  but you can't *go live / accept money* until Stripe payouts are enabled.
- **Price tips / guidance** inline (we ship lightweight helper copy; live comps are 🔜).

---

## 3. Target experience (end-to-end pathway)

```
                       ┌─────────────────────── Guest site (unchanged) ───────────────────────┐
Header "List your place"                                                                        
        │                                                                                        
        ▼                                                                                        
   HostsPage ──"Start hosting"──▶ [signed in?]──no──▶ AuthModal (host intent) ──▶ back to hub    
        │                              │yes                                                       
        ▼                              ▼                                                          
                         ┌──────────  Become-a-Host Hub  /become-a-host  ──────────┐             
                         │  Airbnb-style progress checklist:                        │             
                         │   1. Account created            ✅ (auto)                 │             
                         │   2. Create your first listing  ▶ Listing Wizard         │             
                         │   3. Set up payouts (Stripe)    ▶ Payout step            │             
                         │   4. Publish & go live          ▶ Publish                │             
                         └───────────────────────────────────────────────────────────┘          
                              │                         │                                         
                              ▼                         ▼                                         
                    Listing Wizard /host/new     Payout setup /host-onboarding                   
                    (3 phases, save & exit)       (Stripe Express account link)                   
                              │                         │                                         
                              ▼                         ▼                                         
                    Draft saved to `properties`   Stripe status → HostDashboard                  
                              │                                                                   
                              ▼                                                                   
                    Publish (needs payouts enabled) ──▶ live in search                           
```

---

## 4. Implementation plan (this effort)

### 4.1 Data layer — `src/lib/listing.ts`  ✅
Typed CRUD over Supabase `properties` (RLS-safe, host-scoped) + Storage:
- `PROPERTY_TYPE_OPTIONS`, `PLACE_TYPE_OPTIONS`, grouped `AMENITY_GROUPS` (50+ options).
- `ListingDraft` shape + `blankDraft()`.
- `createDraftListing`, `getHostListings`, `getListing`, `updateListing`,
  `publishListing`, `unpublishListing`, `deleteListing`.
- `uploadListingImage(file)` → Supabase Storage bucket `property-images`, returns public URL;
  URL-paste fallback so it degrades gracefully without storage.
- `listingCompleteness(draft)` → checklist booleans + percent for the hub/wizard.
- Draft = `is_active:false`; Published = `is_active:true`. (No new column needed → no runtime
  dependency on an un-applied migration.)

### 4.2 Storage — `supabase/migrations/…_property_images_storage.sql`  ✅
Create public-read `property-images` bucket; authenticated users may upload/update/delete only
within their own `{auth.uid()}/…` prefix. (Must be applied to Supabase; photo upload degrades to
URL-paste until then.)

### 4.3 Listing Wizard — `src/components/host/ListingWizard.tsx` (+ `PhotoUploader.tsx`)  ✅
Airbnb's 3 phases, broken into focused steps with a sticky progress bar, Back/Next, inline
validation, and **Save & exit** (persists draft). Reused for **create** and **edit**.

### 4.4 Become-a-Host Hub — `src/components/host/BecomeHostHub.tsx`  ✅
Progress checklist tying the whole journey together; resumes drafts; deep-links to wizard, payouts,
and publish. Landing for the host CTA.

### 4.5 Refined payout step — `HostOnboarding.tsx`  ✅
Replace auto-redirect with a clear, opt-in "Set up secure payouts with Stripe" screen (what/why,
one button, graceful "not configured yet" state). Backend untouched.

### 4.6 Wiring — `App.tsx`, `Header.tsx`, `Dashboard.tsx`, `HostsPage.tsx`  ✅
New routes `/become-a-host`, `/host/new`, `/host/listing/:id/edit`. Dead Dashboard buttons now open
the wizard; property rows get Edit + publish/unpublish + live/draft badges. `HostsPage` CTA routes
to the hub (or auth first).

---

## 5. Explicitly out of scope / next steps (🔜)

- **Live Stripe end-to-end**: needs real `STRIPE_SECRET_KEY` + Connect enabled (⛔ external). Code
  paths are complete and testable once keys exist.
- Map/geocoding autocomplete for the address step (currently structured manual entry).
- Live "price tips" from local comps (we ship static guidance).
- Host calendar/availability editor UI (`CAL-001`), booking accept/decline (`BOOK-102`).
- ID verification, STR-permit attestations, insurance prompts (Airbnb trust layer).
- Applying the storage migration + `supabase functions deploy` in the live project.

---

## 6. Testing strategy

- **Type/lint/build**: `npm run typecheck`, `npm run lint`, `npm run build` must pass.
- **Manual (browser, placeholder Supabase)**: exercise the full UI pathway — hub checklist, all
  wizard steps, validation, photo URL fallback, Save & exit, payout screen, Dashboard wiring.
  DB writes require real Supabase creds (⛔) and are verified structurally + via the RLS-safe query
  builders.
