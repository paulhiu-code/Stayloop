# StayLoop PMS Channel Integration — Research & Build Plan

> Goal: let a host who runs their properties through a Property Management System
> (OwnerRez, Guesty, or Hostaway) connect that account to StayLoop and have it
> behave exactly like an Airbnb/VRBO channel connection — real-time, two-way,
> double-booking-safe — and ideally cleaner than the incumbents.

This document is the synthesis of dedicated research into the three PMS APIs, the
Airbnb/VRBO channel model, and a gap analysis of the code already in this repo. It
defines the target architecture and a phased, testable build.

---

## 1. Mental model: StayLoop is a *spoke*, the PMS is the *hub*

The single most important architectural insight from the research: in the
professional vacation-rental ecosystem the **PMS is the source of truth** and each
booking channel (Airbnb, VRBO, Booking.com, and now StayLoop) is a **spoke**.

```
                    ┌──────────────────────────────┐
                    │  PMS (OwnerRez/Guesty/         │
                    │  Hostaway)  ── SOURCE OF TRUTH │
                    └───────────────┬────────────────┘
             PUSH ARI + content     │      PULL / receive reservations
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
    ┌────────┐                  ┌────────┐                  ┌──────────┐
    │ Airbnb │                  │  VRBO  │                  │ StayLoop │  ← we build this spoke
    └────────┘                  └────────┘                  └──────────┘
```

We do **not** try to consume the Airbnb or VRBO APIs — their terms forbid competing
channels, and it is the wrong direction anyway. Instead we replicate the *channel
side* of the contract that Airbnb/VRBO expose to PMS vendors:

1. **Inbound (PMS → StayLoop):** import listings, availability, rates, and existing
   reservations; keep them fresh via webhooks + scheduled polling.
2. **Outbound (StayLoop → PMS):** when a guest books on StayLoop, create/record the
   reservation in the PMS and block those nights so every other channel updates.
3. **Live availability check at checkout** before confirming, to beat sync lag —
   exactly what VRBO/Airbnb do against the PMS.

---

## 2. PMS capability matrix (what is actually possible)

| Capability | OwnerRez | Guesty | Hostaway |
|---|---|---|---|
| Per-host auth (self-serve) | PAT (`pt_`) / OAuth Auth-Code | OAuth **client_credentials** (Open API) | OAuth **client_credentials** (Public API) |
| Token lifetime | 30d (OAuth) / long-lived PAT | **24h**, no refresh token | up to 24 months |
| List/import listings | ✅ v2/v1 | ✅ `GET /listings` | ✅ `GET /listings` |
| Import reservations | ✅ `GET /v2/bookings` | ✅ `GET /reservations` | ✅ `GET /reservations` |
| Import calendar/pricing | ✅ v1 pricing + availability | ✅ calendar API | ✅ `GET /listings/{id}/calendar` |
| **Create reservation (push)** | ⚠️ **Channel API only** (partner); App API cannot create confirmed bookings | ✅ `POST /reservations` (Open API, BE activation required) | ✅ `POST /reservations` with `channelId: 2020` (partner) |
| **Block calendar (push)** | ✅ quote `hold_dates` / spot rates | ✅ `PUT calendar status:unavailable` | ✅ `PUT calendar isAvailable:0` |
| Webhooks | ✅ Basic-Auth signed | ✅ **Svix HMAC** (`svix-*` headers) | ✅ optional Basic-Auth |
| First-class "channel" program | Channel Integration API (`partnerhelp@ownerrez.com`) | Gated OTA program (`partnerships@guesty.com`) | Partner Channel `channelId 2020` (self-serve) |
| Rate limit | 300 / 5 min | 15/s · 120/min · 5000/h | 15/10s (IP) · 20/10s (acct) |

**Consequences for the build:**

- **Hostaway** is the best self-serve path to *full two-way parity* today: a host
  pastes an Account ID + API Key, we can read everything and `POST` real partner
  reservations (`channelId: 2020`).
- **Guesty** Open API supports reservation create + calendar block per host, but
  tokens live 24h (must cache + auto-refresh) and true OTA status is gated.
- **OwnerRez** App API (what we already use) **cannot create a confirmed booking** —
  it is designed to redirect the guest to an OwnerRez payment form. Since StayLoop
  collects payment itself via Stripe, our outbound to OwnerRez must **block the
  calendar** (quote `hold_dates`) until we obtain Channel-API partner status, which
  is the only sanctioned way to inject a fully-formed channel booking.
- **iCal** is the universal, zero-approval, provider-agnostic fallback for
  availability. It works with *every* PMS and also with raw Airbnb/VRBO calendars.
  It is the correct MVP for double-booking prevention.

---

## 3. Current state in this repo (gap analysis)

Already present:

- Tables `pms_connections`, `pms_property_mappings`, `pms_sync_logs`,
  `pms_webhook_events` (RLS-secured; provider limited to `ownerrez|guesty`).
- `pms-ownerrez-sync` — mature **inbound** sync (properties, bookings, pricing,
  availability, cleaning-fee quote, webhook fan-out).
- `pms-guesty-sync` — inbound listings/reservations/calendar; webhook handler is a
  no-op stub; no token refresh.
- `pms-webhook-receiver` — verifies a **custom** `x-stayloop-signature` HMAC and
  routes to the sync function.
- `pms-scheduled-sync` — cron, OwnerRez only.
- Frontend `PMSSettings.tsx` + `src/lib/pms.ts` — connect via pasted token, manual
  sync buttons, webhook URL copy.
- Bookings are created/confirmed server-side (`server/handlers/payments.js` +
  Stripe webhook `server/handlers/webhook.js`).

Gaps vs. the target:

1. **No outbound sync at all** — a StayLoop booking never reaches the PMS. (#1 need.)
2. **No Hostaway** support.
3. **Guesty** webhook is a stub; no 24h token refresh; no outbound.
4. **Webhook auth is wrong for real providers** — it checks a StayLoop-generated
   HMAC, but OwnerRez signs with Basic Auth, Guesty with Svix, Hostaway with Basic
   Auth. Real provider webhooks would be rejected.
5. **No iCal** import/export (the universal double-booking layer).
6. `pms_property_mappings.sync_direction` exists but is never honored.
7. **No live availability check at checkout** against the PMS.

---

## 4. Target architecture

### 4.1 Provider adapter abstraction

A single normalized interface, one adapter per provider, so sync/push code is
provider-agnostic:

```
ChannelAdapter
├─ auth(connection) -> token            (handles refresh/caching)
├─ listListings()   -> NormalizedListing[]
├─ getCalendar(id, range) -> NightState[]
├─ importReservations(range) -> NormalizedReservation[]
├─ createReservation(res)  -> { externalId } | { blockedOnly: true }
├─ blockCalendar(id, range) -> void
└─ verifyWebhook(req, secret) -> { valid, events[] }

Implementations: HostawayAdapter, GuestyAdapter, OwnerRezAdapter, ICalAdapter
```

Normalized domain types (already partly implied by our schema): `NormalizedListing`,
`NightState {date, available, price, minNights}`, `NormalizedReservation {externalId,
listingExternalId, checkIn, checkOut, guests, status, financials, guest}`.

### 4.2 Outbound flow (StayLoop booking → PMS)

```
Stripe payment_intent.succeeded
        │
        ▼
confirmBookingByPaymentIntent (server)
        │  enqueue outbound push (service-role call)
        ▼
Edge fn `pms-push-reservation`  (idempotent via pms_reservation_mappings)
        │
        ├─ Hostaway → POST /reservations channelId 2020  → store externalId
        ├─ Guesty   → POST /reservations status reserved → store externalId
        └─ OwnerRez → quote hold_dates (block) until Channel-API partner
        │
        ▼
availability blocked in PMS → PMS fans out ARI to Airbnb/VRBO/etc.
```

Idempotency: `pms_reservation_mappings (booking_id, pms_connection_id) UNIQUE`, plus
we pass the StayLoop booking id as the provider's external/tracking id so retries
never double-book.

### 4.3 Inbound flow (PMS → StayLoop)

- **Webhooks** (real-time) received at `pms-webhook-receiver`, verified per-provider,
  logged to `pms_webhook_events`, then dispatched to the provider sync function.
- **Scheduled polling** (`pms-scheduled-sync`) as a safety net (every ~15 min) for
  providers/events without reliable webhooks (e.g. Guesty calendar changes from
  reservations, Hostaway which lacks calendar webhooks).
- **iCal import** poll for the universal path.

### 4.4 Universal iCal channel (MVP, zero-approval)

- **Export:** every StayLoop property exposes a tokenised `.ics` URL
  (`channel-ical?action=export&property=<id>&token=<token>`) listing StayLoop
  bookings + blocks. Hosts paste this into Airbnb/VRBO/their PMS.
- **Import:** hosts register external `.ics` URLs (`channel_ical_feeds`); we poll and
  write blocked dates into `availability_calendar` with `source='ical'`.
- Availability-only, ~15–30 min lag, but works everywhere with no partnership.

### 4.5 Double-booking prevention

Defense in depth: (1) live availability check against the PMS at checkout for
API-connected providers; (2) immediate outbound block on booking; (3) inbound
webhooks + polling + iCal to catch external bookings; (4) DB overlap guard already in
`loadPropertyQuote`.

---

## 5. Data model changes

- `pms_connections.pms_provider` CHECK → add `hostaway`.
- `pms_connections`: add `sync_direction` (`inbound|outbound|two_way`, default
  `two_way`) and `webhook_secret` usage per provider.
- `availability_calendar.source` CHECK → add `ical`, `hostaway`.
- New `pms_reservation_mappings` — booking_id ↔ pms reservation id (outbound dedup).
- New `channel_ical_feeds` — external .ics feeds to import per property.
- `properties.ical_export_token` — unguessable token for the public export URL.

All new tables get RLS scoped to the owning host, mirroring existing PMS tables.

---

## 6. Phased delivery

**Phase 1 — Universal availability safety net (shippable now, no approvals)**
- iCal export + import, `channel_ical_feeds`, export tokens, poller. *(fully testable)*
- Hostaway added as a provider in schema + connect UI.

**Phase 2 — Hostaway full two-way (self-serve API)**
- Hostaway inbound sync (listings/reservations/calendar).
- Outbound `pms-push-reservation` (Hostaway `channelId 2020`), wired to booking
  confirm, idempotent.
- Hostaway webhook verification.

**Phase 3 — Guesty + OwnerRez outbound**
- Guesty Open API token refresh + outbound reservation/calendar block + Svix webhook
  verification.
- OwnerRez outbound calendar hold (quote `hold_dates`); pursue Channel-API partner
  status for true channel bookings.

**Phase 4 — Parity polish**
- Live availability check at checkout, unified messaging, per-mapping
  `sync_direction`, conflict resolution + monitoring dashboard.

**Partner applications to start in parallel:** OwnerRez Channel API
(`partnerhelp@ownerrez.com`), Guesty OTA (`partnerships@guesty.com`), Hostaway
marketplace listing.

---

## 7. Security & operational notes

- Webhook verification is **per-provider** (OwnerRez Basic-Auth, Guesty Svix HMAC,
  Hostaway Basic-Auth); never trust the generic custom-HMAC path for real providers.
- OAuth/API secrets live only in `pms_connections` columns already blocked from
  client `SELECT` (see security-hardening migrations); edge functions read them with
  the service role.
- Respect rate limits (esp. Hostaway 15/10s and Guesty token cap of 5/24h — cache
  tokens).
- Every sync writes a `pms_sync_logs` row; every webhook a `pms_webhook_events` row.

---

## 8. What this PR implements vs. plans

Implemented in this PR: schema for the above; the universal iCal channel
(export/import + poller) with unit tests; Hostaway inbound sync; the provider-
abstracted outbound push (`pms-push-reservation`) wired to booking confirmation;
per-provider webhook verification; and the frontend for Hostaway + iCal + sync
direction. Live end-to-end validation against real PMS accounts requires host
credentials and (for OwnerRez/Guesty channel status) partner approval, so those
paths are covered by unit tests + typed contracts and flagged for credentialed QA.
