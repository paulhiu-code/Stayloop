import { supabase, type Property } from './supabase';
import { normalizeAmenities } from './property';

/**
 * Host listing data layer.
 *
 * Everything here is RLS-safe: inserts/updates are scoped to the authenticated host via
 * `host_id = auth.uid()` policies that already exist on the `properties` table. A listing is a
 * "draft" while `is_active = false` and goes "live" when `is_active = true` (which is also what the
 * public search filters on), so no schema change is required for draft support.
 */

export type PropertyTypeValue =
  | 'house'
  | 'apartment'
  | 'condo'
  | 'villa'
  | 'cabin'
  | 'cottage'
  | 'townhouse'
  | 'loft'
  | 'other';

export const PROPERTY_TYPE_OPTIONS: {
  value: PropertyTypeValue;
  label: string;
  icon: string;
}[] = [
  { value: 'house', label: 'House', icon: '🏠' },
  { value: 'apartment', label: 'Apartment', icon: '🏢' },
  { value: 'condo', label: 'Condo', icon: '🏬' },
  { value: 'villa', label: 'Villa', icon: '🏘️' },
  { value: 'cabin', label: 'Cabin', icon: '🌲' },
  { value: 'cottage', label: 'Cottage', icon: '🏡' },
  { value: 'townhouse', label: 'Townhouse', icon: '🏙️' },
  { value: 'loft', label: 'Loft', icon: '🛋️' },
  { value: 'other', label: 'Other', icon: '✨' },
];

export type PlaceTypeValue = 'entire' | 'private_room' | 'shared_room';

export const PLACE_TYPE_OPTIONS: {
  value: PlaceTypeValue;
  label: string;
  description: string;
}[] = [
  {
    value: 'entire',
    label: 'An entire place',
    description: 'Guests have the whole place to themselves.',
  },
  {
    value: 'private_room',
    label: 'A private room',
    description: 'Guests have a private room and share some common spaces.',
  },
  {
    value: 'shared_room',
    label: 'A shared room',
    description: 'Guests sleep in a room or common area that may be shared.',
  },
];

export const AMENITY_GROUPS: { group: string; items: string[] }[] = [
  {
    group: 'Essentials',
    items: ['Fast Wi-Fi', 'Kitchen', 'Washer', 'Dryer', 'Air conditioning', 'Heating', 'Dedicated workspace', 'TV'],
  },
  {
    group: 'Features',
    items: ['Pool', 'Hot tub', 'Free parking', 'EV charger', 'Crib', 'Gym', 'BBQ grill', 'Fireplace', 'Patio', 'Outdoor dining'],
  },
  {
    group: 'Location',
    items: ['Beachfront', 'Waterfront', 'Ski-in/ski-out', 'Mountain view', 'Lake access'],
  },
  {
    group: 'Safety',
    items: ['Smoke alarm', 'Carbon monoxide alarm', 'Fire extinguisher', 'First aid kit'],
  },
  {
    group: 'Stay policies',
    items: ['Self check-in', 'Pet friendly', 'Smoking allowed', 'Events allowed'],
  },
];

export const ALL_AMENITIES = AMENITY_GROUPS.flatMap((section) => section.items);

/** Working shape for the wizard. Mirrors the columns the wizard is allowed to write. */
export type ListingDraft = {
  id?: string;
  title: string;
  description: string;
  property_type: PropertyTypeValue;
  place_type: PlaceTypeValue;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  max_guests: number;
  base_price: number;
  cleaning_fee: number;
  amenities: string[];
  house_rules: string;
  images: string[];
  instant_book: boolean;
  min_nights: number;
  max_nights: number;
  is_active: boolean;
};

/**
 * `place_type` and `beds` are not first-class columns in the base schema, so we round-trip them
 * through the flexible `pms_integration` jsonb blob under a `stayloop` namespace. This keeps the
 * wizard lossless without requiring a migration.
 */
type StayLoopMeta = {
  place_type?: PlaceTypeValue;
  beds?: number;
};

export function blankDraft(): ListingDraft {
  return {
    title: '',
    description: '',
    property_type: 'house',
    place_type: 'entire',
    address: '',
    city: '',
    state: '',
    country: 'United States',
    postal_code: '',
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    max_guests: 2,
    base_price: 150,
    cleaning_fee: 75,
    amenities: [],
    house_rules: '',
    images: [],
    instant_book: true,
    min_nights: 1,
    max_nights: 365,
    is_active: false,
  };
}

function readMeta(property: Pick<Property, 'pms_integration'>): StayLoopMeta {
  const raw = property.pms_integration as Record<string, unknown> | null;
  const meta = raw?.stayloop as StayLoopMeta | undefined;
  return meta ?? {};
}

export function propertyToDraft(property: Property): ListingDraft {
  const meta = readMeta(property);
  return {
    id: property.id,
    title: property.title ?? '',
    description: property.description ?? '',
    property_type: (property.property_type as PropertyTypeValue) ?? 'house',
    place_type: meta.place_type ?? 'entire',
    address: property.address ?? '',
    city: property.city ?? '',
    state: property.state ?? '',
    country: property.country ?? 'United States',
    postal_code: property.postal_code ?? '',
    bedrooms: Number(property.bedrooms ?? 1),
    beds: Number(meta.beds ?? property.bedrooms ?? 1),
    bathrooms: Number(property.bathrooms ?? 1),
    max_guests: Number(property.max_guests ?? 2),
    base_price: Number(property.base_price ?? 0),
    cleaning_fee: Number(property.cleaning_fee ?? 0),
    amenities: normalizeAmenities(property.amenities),
    house_rules: property.house_rules ?? '',
    images: Array.isArray(property.images) ? (property.images as string[]) : [],
    instant_book: Boolean(property.instant_book),
    min_nights: Number(property.min_nights ?? 1),
    max_nights: Number(property.max_nights ?? 365),
    is_active: Boolean(property.is_active),
  };
}

/** Columns we write to `properties`. `pms_integration` carries the StayLoop-only extras. */
function draftToRow(draft: ListingDraft, hostId: string) {
  const meta: StayLoopMeta = { place_type: draft.place_type, beds: draft.beds };
  return {
    host_id: hostId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    property_type: draft.property_type,
    address: draft.address.trim(),
    city: draft.city.trim(),
    state: draft.state.trim(),
    country: draft.country.trim() || 'United States',
    postal_code: draft.postal_code.trim() || null,
    bedrooms: Math.max(0, Math.round(draft.bedrooms)),
    bathrooms: Math.max(0, draft.bathrooms),
    max_guests: Math.max(1, Math.round(draft.max_guests)),
    base_price: Math.max(0, Number(draft.base_price) || 0),
    cleaning_fee: Math.max(0, Number(draft.cleaning_fee) || 0),
    amenities: draft.amenities,
    house_rules: draft.house_rules.trim() || null,
    images: draft.images,
    instant_book: draft.instant_book,
    min_nights: Math.max(1, Math.round(draft.min_nights)),
    max_nights: Math.max(draft.min_nights, Math.round(draft.max_nights)),
    is_active: draft.is_active,
    pms_integration: { stayloop: meta },
  };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Please sign in to manage listings.');
  return userId;
}

export async function getHostListings(): Promise<Property[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('host_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((property) => ({
    ...property,
    amenities: normalizeAmenities(property.amenities),
  })) as Property[];
}

export async function getListing(id: string): Promise<Property | null> {
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, amenities: normalizeAmenities(data.amenities) } as Property;
}

/** Insert a new listing row. Defaults to draft unless the caller flags it active. */
export async function createDraftListing(draft: ListingDraft): Promise<Property> {
  const userId = await requireUserId();
  const row = draftToRow({ ...draft, is_active: draft.is_active ?? false }, userId);
  const { data, error } = await supabase.from('properties').insert(row).select('*').single();
  if (error) throw error;
  return { ...data, amenities: normalizeAmenities(data.amenities) } as Property;
}

export async function updateListing(id: string, draft: ListingDraft): Promise<Property> {
  const userId = await requireUserId();
  const row = draftToRow(draft, userId);
  const { data, error } = await supabase
    .from('properties')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('host_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return { ...data, amenities: normalizeAmenities(data.amenities) } as Property;
}

/** Create when there is no id yet, otherwise update. Used by the wizard's Save & exit. */
export async function saveListing(draft: ListingDraft): Promise<Property> {
  if (draft.id) return updateListing(draft.id, draft);
  return createDraftListing(draft);
}

export async function setListingActive(id: string, isActive: boolean): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('properties')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('host_id', userId);
  if (error) throw error;
}

export const publishListing = (id: string) => setListingActive(id, true);
export const unpublishListing = (id: string) => setListingActive(id, false);

export async function deleteListing(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('properties').delete().eq('id', id).eq('host_id', userId);
  if (error) throw error;
}

export const PROPERTY_IMAGE_BUCKET = 'property-images';

/**
 * Upload a photo to Supabase Storage and return its public URL. Falls back to a clear error so the
 * wizard can offer URL-paste when the bucket has not been provisioned yet.
 */
export async function uploadListingImage(file: File): Promise<string> {
  const userId = await requireUserId();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(PROPERTY_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from(PROPERTY_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export type CompletenessItem = { key: string; label: string; done: boolean };

/** Airbnb-style checklist used by the hub and the wizard's review step. */
export function listingCompleteness(draft: ListingDraft): {
  items: CompletenessItem[];
  percent: number;
  readyToPublish: boolean;
} {
  const items: CompletenessItem[] = [
    { key: 'type', label: 'Property & place type', done: Boolean(draft.property_type && draft.place_type) },
    {
      key: 'location',
      label: 'Location',
      done: Boolean(draft.address.trim() && draft.city.trim() && draft.state.trim()),
    },
    { key: 'basics', label: 'Guests, beds & baths', done: draft.max_guests >= 1 && draft.bedrooms >= 0 && draft.bathrooms >= 0 },
    { key: 'amenities', label: 'At least 2 amenities', done: draft.amenities.length >= 2 },
    { key: 'photos', label: 'At least 1 photo', done: draft.images.length >= 1 },
    { key: 'title', label: 'Title', done: draft.title.trim().length >= 5 },
    { key: 'description', label: 'Description', done: draft.description.trim().length >= 20 },
    { key: 'price', label: 'Nightly price', done: Number(draft.base_price) > 0 },
  ];

  const done = items.filter((item) => item.done).length;
  const percent = Math.round((done / items.length) * 100);
  return { items, percent, readyToPublish: done === items.length };
}
