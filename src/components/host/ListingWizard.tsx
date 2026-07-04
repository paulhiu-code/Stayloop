import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  Minus,
  Plane,
  Plus,
} from 'lucide-react';
import {
  AMENITY_GROUPS,
  PLACE_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  blankDraft,
  getListing,
  listingCompleteness,
  propertyToDraft,
  publishListing,
  saveListing,
  type ListingDraft,
  type PlaceTypeValue,
  type PropertyTypeValue,
} from '../../lib/listing';
import { PhotoUploader } from './PhotoUploader';

export type ListingWizardProps = {
  listingId?: string;
  onExit: () => void;
  onPublished: (propertyId: string) => void;
};

const PHASES = [
  { name: 'Tell us about your place', steps: [0, 1, 2, 3] },
  { name: 'Make it stand out', steps: [4, 5, 6] },
  { name: 'Finish up & publish', steps: [7, 8, 9] },
] as const;

const TOTAL_STEPS = 10;

function getPhaseName(stepIndex: number): string {
  if (stepIndex <= 3) return PHASES[0].name;
  if (stepIndex <= 6) return PHASES[1].name;
  return PHASES[2].name;
}

/** Fill percentage (0-100) for one of the three phase progress segments. */
function segmentFill(phaseIndex: number, stepIndex: number): number {
  const { steps } = PHASES[phaseIndex];
  const done = stepIndex + 1 - steps[0];
  return Math.max(0, Math.min(1, done / steps.length)) * 100;
}

function getStepTitle(stepIndex: number): string {
  const titles = [
    'Which of these best describes your place?',
    'What type of place will guests have?',
    'Where is your place located?',
    'Share some basics about your place',
    'Tell guests what your place has to offer',
    'Add some photos of your place',
    'Now, let\'s give your place a title',
    'Set your nightly price',
    'Review your booking settings',
    'Review and publish',
  ];
  return titles[stepIndex] ?? '';
}

function validateStep(stepIndex: number, draft: ListingDraft): string | null {
  switch (stepIndex) {
    case 2:
      if (!draft.address.trim() || !draft.city.trim() || !draft.state.trim()) {
        return 'Please enter your street address, city, and state.';
      }
      return null;
    case 3:
      if (draft.max_guests < 1) return 'You need room for at least 1 guest.';
      if (draft.bedrooms < 0 || draft.beds < 0 || draft.bathrooms < 0) {
        return 'Bedrooms, beds, and bathrooms cannot be negative.';
      }
      return null;
    case 6:
      if (!draft.title.trim()) return 'Please add a title for your listing.';
      return null;
    case 7:
      if (Number(draft.base_price) <= 0) return 'Set a nightly price greater than $0.';
      return null;
    default:
      return null;
  }
}

type StepperRowProps = {
  label: string;
  value: number;
  min: number;
  step?: number;
  onChange: (value: number) => void;
};

function StepperRow({ label, value, min, step = 1, onChange }: StepperRowProps) {
  const decrement = () => onChange(Math.max(min, Math.round((value - step) * 10) / 10));
  const increment = () => onChange(Math.round((value + step) * 10) / 10);

  const displayValue = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-4 last:border-b-0">
      <span className="text-base font-medium text-gray-900">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center text-base font-semibold text-gray-900">{displayValue}</span>
        <button
          type="button"
          onClick={increment}
          aria-label={`Increase ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:border-gray-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type FieldLabelProps = {
  htmlFor: string;
  children: React.ReactNode;
};

function FieldLabel({ htmlFor, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-gray-700">
      {children}
    </label>
  );
}

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100';

export default function ListingWizard({ listingId, onExit, onPublished }: ListingWizardProps) {
  const [draft, setDraft] = useState<ListingDraft>(blankDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(Boolean(listingId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    const id = listingId;
    if (!id) return;

    let cancelled = false;

    async function load(listingIdToLoad: string) {
      setLoading(true);
      setLoadError(null);
      try {
        const property = await getListing(listingIdToLoad);
        if (cancelled) return;
        if (!property) {
          setLoadError('Listing not found.');
          return;
        }
        setDraft(propertyToDraft(property));
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load listing.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(id);
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const completeness = useMemo(() => listingCompleteness(draft), [draft]);
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  const updateDraft = useCallback((patch: Partial<ListingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setStepError(null);
  }, []);

  const handleSaveAndExit = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveListing(draft);
      setDraft((current) => ({ ...current, id: saved.id }));
      onExit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save listing.');
    } finally {
      setSaving(false);
    }
  }, [draft, onExit]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const saved = await saveListing({ ...draft, is_active: false });
      await publishListing(saved.id!);
      onPublished(saved.id!);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Unable to publish listing.');
    } finally {
      setPublishing(false);
    }
  }, [draft, onPublished]);

  const goNext = useCallback(() => {
    const error = validateStep(stepIndex, draft);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setStepIndex((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }, [draft, stepIndex]);

  const goBack = useCallback(() => {
    setStepError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">
          <h2 className="text-xl font-extrabold text-gray-900">Couldn&apos;t load listing</h2>
          <p className="mt-3 text-sm text-rose-600">{loadError}</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  const titleChars = draft.title.length;
  const titleOverSoftCap = titleChars > 50;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 shadow-sm">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-950">StayLoop</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveAndExit()}
            disabled={saving}
            className="shrink-0 rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save & exit'
            )}
          </button>
        </div>
        <div className="mx-auto flex max-w-5xl gap-2 px-4 pb-3 sm:px-6">
          {PHASES.map((phase, index) => (
            <div key={phase.name} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-300"
                style={{ width: `${segmentFill(index, stepIndex)}%` }}
              />
            </div>
          ))}
        </div>
        {saveError && (
          <p className="mx-auto max-w-2xl px-4 pb-2 text-sm text-rose-600 sm:px-6">{saveError}</p>
        )}
      </header>

      <main className="flex flex-1 overflow-y-auto">
        <div className="m-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-600">
              {getPhaseName(stepIndex)}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              {getStepTitle(stepIndex)}
            </h1>
          </div>
        {stepIndex === 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {PROPERTY_TYPE_OPTIONS.map((option) => {
              const selected = draft.property_type === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateDraft({ property_type: option.value as PropertyTypeValue })}
                  className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-5 text-left transition hover:border-orange-300 hover:shadow-sm ${
                    selected ? 'border-orange-500 ring-2 ring-orange-100' : 'border-gray-200'
                  }`}
                >
                  <Icon className={`h-7 w-7 ${selected ? 'text-orange-600' : 'text-gray-700'}`} />
                  <span className="text-sm font-bold text-gray-900">{option.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {stepIndex === 1 && (
          <div className="space-y-3">
            {PLACE_TYPE_OPTIONS.map((option) => {
              const selected = draft.place_type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateDraft({ place_type: option.value as PlaceTypeValue })}
                  className={`w-full rounded-2xl border-2 bg-white p-5 text-left transition hover:border-orange-200 ${
                    selected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200'
                  }`}
                >
                  <p className="font-bold text-gray-900">{option.label}</p>
                  <p className="mt-1 text-sm text-gray-600">{option.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {stepIndex === 2 && (
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <FieldLabel htmlFor="address">Street address</FieldLabel>
              <input
                id="address"
                value={draft.address}
                onChange={(event) => updateDraft({ address: event.target.value })}
                className={inputClassName}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <input
                  id="city"
                  value={draft.city}
                  onChange={(event) => updateDraft({ city: event.target.value })}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="state">State / Province</FieldLabel>
                <input
                  id="state"
                  value={draft.state}
                  onChange={(event) => updateDraft({ state: event.target.value })}
                  className={inputClassName}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="postal_code">Postal code</FieldLabel>
                <input
                  id="postal_code"
                  value={draft.postal_code}
                  onChange={(event) => updateDraft({ postal_code: event.target.value })}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                <input
                  id="country"
                  value={draft.country}
                  onChange={(event) => updateDraft({ country: event.target.value })}
                  className={inputClassName}
                />
              </div>
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="rounded-3xl bg-white px-6 py-2 shadow-sm">
            <StepperRow
              label="Guests"
              value={draft.max_guests}
              min={1}
              onChange={(max_guests) => updateDraft({ max_guests })}
            />
            <StepperRow
              label="Bedrooms"
              value={draft.bedrooms}
              min={0}
              onChange={(bedrooms) => updateDraft({ bedrooms })}
            />
            <StepperRow
              label="Beds"
              value={draft.beds}
              min={0}
              onChange={(beds) => updateDraft({ beds })}
            />
            <StepperRow
              label="Bathrooms"
              value={draft.bathrooms}
              min={0}
              step={0.5}
              onChange={(bathrooms) => updateDraft({ bathrooms })}
            />
          </div>
        )}

        {stepIndex === 4 && (
          <div className="space-y-8">
            {AMENITY_GROUPS.map((group) => (
              <section key={group.group}>
                <h3 className="mb-3 text-base font-extrabold text-gray-900">{group.group}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((amenity) => {
                    const selected = draft.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => {
                          const amenities = selected
                            ? draft.amenities.filter((item) => item !== amenity)
                            : [...draft.amenities, amenity];
                          updateDraft({ amenities });
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selected
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'
                        }`}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {stepIndex === 5 && (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <PhotoUploader
              images={draft.images}
              onChange={(images) => updateDraft({ images })}
            />
          </div>
        )}

        {stepIndex === 6 && (
          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Lead with your strongest feature and location.</p>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <span
                  className={`text-xs font-medium ${titleOverSoftCap ? 'text-amber-600' : 'text-gray-500'}`}
                >
                  {titleChars}/50
                </span>
              </div>
              <input
                id="title"
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                className={inputClassName}
                placeholder="Cozy cabin with mountain views"
              />
              {titleOverSoftCap && (
                <p className="mt-1 text-xs text-amber-600">
                  Titles over 50 characters may be truncated in search results.
                </p>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <span className="text-xs font-medium text-gray-500">{draft.description.length} characters</span>
              </div>
              <textarea
                id="description"
                value={draft.description}
                onChange={(event) => updateDraft({ description: event.target.value })}
                rows={8}
                className={`${inputClassName} resize-y`}
                placeholder="Describe what makes your place special…"
              />
            </div>
          </div>
        )}

        {stepIndex === 7 && (
          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <FieldLabel htmlFor="base_price">Nightly price (USD)</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  $
                </span>
                <input
                  id="base_price"
                  type="number"
                  min={0}
                  step={1}
                  value={draft.base_price}
                  onChange={(event) => updateDraft({ base_price: Number(event.target.value) })}
                  className={`${inputClassName} pl-8`}
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="cleaning_fee">Cleaning fee (USD)</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  $
                </span>
                <input
                  id="cleaning_fee"
                  type="number"
                  min={0}
                  step={1}
                  value={draft.cleaning_fee}
                  onChange={(event) => updateDraft({ cleaning_fee: Number(event.target.value) })}
                  className={`${inputClassName} pl-8`}
                />
              </div>
            </div>
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Guests pay a 5% service fee on top of your nightly rate. You keep 90% of the booking total
              (StayLoop charges a 10% host fee).
            </p>
          </div>
        )}

        {stepIndex === 8 && (
          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-4">
              <div>
                <p className="font-bold text-gray-900">Instant Book</p>
                <p className="text-sm text-gray-600">Guests can book without waiting for your approval.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.instant_book}
                onClick={() => updateDraft({ instant_book: !draft.instant_book })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  draft.instant_book ? 'bg-orange-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    draft.instant_book ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="min_nights">Minimum nights</FieldLabel>
                <input
                  id="min_nights"
                  type="number"
                  min={1}
                  value={draft.min_nights}
                  onChange={(event) => updateDraft({ min_nights: Number(event.target.value) })}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="max_nights">Maximum nights</FieldLabel>
                <input
                  id="max_nights"
                  type="number"
                  min={draft.min_nights}
                  value={draft.max_nights}
                  onChange={(event) => updateDraft({ max_nights: Number(event.target.value) })}
                  className={inputClassName}
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="house_rules">House rules</FieldLabel>
              <textarea
                id="house_rules"
                value={draft.house_rules}
                onChange={(event) => updateDraft({ house_rules: event.target.value })}
                rows={5}
                className={`${inputClassName} resize-y`}
                placeholder="Quiet hours, no parties, check-in instructions…"
              />
            </div>
          </div>
        )}

        {stepIndex === 9 && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-gray-900">Listing completeness</h3>
                <span className="text-2xl font-extrabold text-orange-600">{completeness.percent}%</span>
              </div>
              <ul className="space-y-3">
                {completeness.items.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 text-sm">
                    {item.done ? (
                      <Check className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-gray-300" />
                    )}
                    <span className={item.done ? 'text-gray-900' : 'text-gray-500'}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!completeness.readyToPublish && (
              <p className="text-sm text-gray-600">
                Complete the remaining items above before publishing:{' '}
                <span className="font-semibold text-gray-900">
                  {completeness.items
                    .filter((item) => !item.done)
                    .map((item) => item.label)
                    .join(', ')}
                </span>
              </p>
            )}

            {publishError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {publishError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={!completeness.readyToPublish || publishing}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Publishing…
                </span>
              ) : (
                'Publish listing'
              )}
            </button>
          </div>
        )}

        {stepError && (
          <p className="mt-4 text-sm font-medium text-rose-600">{stepError}</p>
        )}
        </div>
      </main>

      {!isLastStep && (
        <footer className="sticky bottom-0 z-20 border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className={`inline-flex items-center gap-1 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 ${
                stepIndex === 0 ? 'invisible' : ''
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-orange-600 hover:to-rose-600"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      )}

      {isLastStep && (
        <footer className="sticky bottom-0 z-20 border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
