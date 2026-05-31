import { supabase, type Property } from './supabase';

export type ManualPropertyInput = {
  title: string;
  description: string;
  property_type: Property['property_type'];
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  base_price: number;
  cleaning_fee?: number;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  min_nights?: number;
  imageUrls?: string[];
  house_rules?: string;
};

const PROPERTY_TYPES: Property['property_type'][] = [
  'house',
  'apartment',
  'condo',
  'villa',
  'cabin',
  'cottage',
  'townhouse',
  'loft',
  'other',
];

export function isPropertyType(value: string): value is Property['property_type'] {
  return PROPERTY_TYPES.includes(value as Property['property_type']);
}

export { PROPERTY_TYPES };

export async function createManualProperty(
  hostId: string,
  input: ManualPropertyInput
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert({
      host_id: hostId,
      title: input.title.trim(),
      description: input.description.trim(),
      property_type: input.property_type,
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      country: input.country.trim(),
      postal_code: input.postal_code?.trim() || null,
      base_price: input.base_price,
      cleaning_fee: input.cleaning_fee ?? 0,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      max_guests: input.max_guests,
      min_nights: input.min_nights ?? 1,
      max_nights: 365,
      amenities: [],
      images: input.imageUrls?.filter(Boolean) ?? [],
      house_rules: input.house_rules?.trim() || null,
      instant_book: false,
      is_active: true,
      pms_integration: {
        provider: 'manual',
        source: 'stayloop',
        created_at: new Date().toISOString(),
      },
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create property');
  }

  return data as Property;
}
