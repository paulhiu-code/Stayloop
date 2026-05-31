import { stayCategories } from '../data/showcase';
import { nightsBetween } from './booking';
import { supabase, type Property } from './supabase';

export type SearchSort = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export type SearchFilters = {
  where?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];
  amenities?: string[];
  instantBook?: boolean;
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
};

export type SearchResultProperty = Property & {
  avg_rating?: number | null;
  review_count?: number | null;
  total_price?: number | null;
  nights?: number | null;
};

export type SearchPropertiesResult = {
  properties: SearchResultProperty[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export const SEARCH_PAGE_SIZE = 12;

export const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
];

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'villa', label: 'Villa' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'loft', label: 'Loft' },
  { value: 'other', label: 'Other' },
] as const;

export const COMMON_AMENITIES = [
  'Fast Wi-Fi',
  'Parking',
  'Kitchen',
  'Pet friendly',
  'Pool',
  'Hot tub',
  'Workspace',
  'Beachfront',
  'Fireplace',
  'Washer',
  'Air conditioning',
  'Grill',
] as const;

/** Maps hero/search category pills to filters that match OwnerRez/PMS amenity strings in our DB. */
export const CATEGORY_PRESETS: Record<(typeof stayCategories)[number], Partial<SearchFilters>> = {
  'Entire homes': {
    amenities: ['Entire Home'],
  },
  'Pet friendly': {
    amenities: ['Allows pets'],
  },
  'Family homes': {
    propertyTypes: ['house'],
    guests: 4,
  },
  'Work trips': {
    amenities: ['Internet'],
  },
  'Hot tub stays': {
    amenities: ['Hot Tub'],
  },
  Cabins: {
    propertyTypes: ['cabin', 'cottage'],
  },
  'Mountain stays': {
    amenities: ['Mountain'],
  },
  'Beach houses': {
    amenities: ['Oceanfront'],
  },
};

type ReviewStatsRow = {
  property_id: string;
  avg_rating?: number | null;
  review_count?: number | null;
  average_rating?: number | null;
  total_reviews?: number | null;
};

function normalizeFilters(filters: SearchFilters): Required<Pick<SearchFilters, 'page' | 'pageSize' | 'sort'>> &
  SearchFilters {
  return {
    ...filters,
    page: Math.max(1, filters.page || 1),
    pageSize: filters.pageSize || SEARCH_PAGE_SIZE,
    sort: filters.sort || 'recommended',
  };
}

function rpcPayload(filters: ReturnType<typeof normalizeFilters>) {
  const offset = (filters.page - 1) * filters.pageSize;
  return {
    p_location: filters.where?.trim() || null,
    p_check_in: filters.checkIn || null,
    p_check_out: filters.checkOut || null,
    p_guests: filters.guests || 1,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_property_types: filters.propertyTypes?.length ? filters.propertyTypes : null,
    p_amenities: filters.amenities?.length ? filters.amenities : null,
    p_instant_book: filters.instantBook ?? null,
    p_sort: filters.sort,
    p_limit: filters.pageSize,
    p_offset: offset,
  };
}

function estimateTotalPrice(property: Property, checkIn?: string, checkOut?: string): number | null {
  if (!checkIn || !checkOut) return null;
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) return null;
  return property.base_price * nights + property.cleaning_fee;
}

function enrichProperty(
  property: Property,
  statsById: Map<string, ReviewStatsRow>,
  filters: ReturnType<typeof normalizeFilters>
): SearchResultProperty {
  const stats = statsById.get(property.id);
  const avgRating = stats?.avg_rating ?? stats?.average_rating ?? null;
  const reviewCount = stats?.review_count ?? stats?.total_reviews ?? null;
  const nights =
    filters.checkIn && filters.checkOut ? nightsBetween(filters.checkIn, filters.checkOut) : null;

  return {
    ...property,
    avg_rating: avgRating,
    review_count: reviewCount,
    nights,
    total_price: estimateTotalPrice(property, filters.checkIn, filters.checkOut),
  };
}

function applySort(properties: SearchResultProperty[], sort: SearchSort): SearchResultProperty[] {
  const sorted = [...properties];

  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => a.base_price - b.base_price);
    case 'price_desc':
      return sorted.sort((a, b) => b.base_price - a.base_price);
    case 'rating':
      return sorted.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
    case 'newest':
      return sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    default:
      return sorted;
  }
}

async function fetchReviewStats(propertyIds: string[]): Promise<Map<string, ReviewStatsRow>> {
  const statsById = new Map<string, ReviewStatsRow>();
  if (propertyIds.length === 0) return statsById;

  const { data, error } = await supabase
    .from('property_review_stats')
    .select('*')
    .in('property_id', propertyIds);

  if (error) {
    console.warn('Unable to load property_review_stats:', error.message);
    return statsById;
  }

  for (const row of (data || []) as ReviewStatsRow[]) {
    statsById.set(row.property_id, row);
  }

  return statsById;
}

function parseRpcResult(data: unknown, filters: ReturnType<typeof normalizeFilters>): SearchPropertiesResult | null {
  if (!data) return null;

  if (Array.isArray(data)) {
    const properties = data as SearchResultProperty[];
    return {
      properties,
      totalCount: properties.length,
      page: filters.page,
      pageSize: filters.pageSize,
      hasMore: properties.length >= filters.pageSize,
    };
  }

  if (typeof data === 'object') {
    const payload = data as {
      properties?: SearchResultProperty[];
      total_count?: number;
      totalCount?: number;
      page?: number;
      page_size?: number;
      pageSize?: number;
      has_more?: boolean;
      hasMore?: boolean;
    };

    const properties = payload.properties || [];
    const totalCount = payload.total_count ?? payload.totalCount ?? properties.length;
    const pageSize = payload.page_size ?? payload.pageSize ?? filters.pageSize;
    const page = payload.page ?? filters.page;
    const hasMore = payload.has_more ?? payload.hasMore ?? page * pageSize < totalCount;

    return { properties, totalCount, page, pageSize, hasMore };
  }

  return null;
}

async function searchPropertiesFallback(filters: ReturnType<typeof normalizeFilters>): Promise<SearchPropertiesResult> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  let query = supabase.from('properties').select('*', { count: 'exact' }).eq('is_active', true);

  if (filters.where?.trim()) {
    const term = filters.where.trim();
    query = query.or(
      `title.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,description.ilike.%${term}%`
    );
  }

  if (filters.guests) query = query.gte('max_guests', filters.guests);
  if (filters.minPrice != null) query = query.gte('base_price', filters.minPrice);
  if (filters.maxPrice != null) query = query.lte('base_price', filters.maxPrice);
  if (filters.propertyTypes?.length) query = query.in('property_type', filters.propertyTypes);
  if (filters.instantBook) query = query.eq('instant_book', true);

  for (const amenity of filters.amenities || []) {
    query = query.contains('amenities', [amenity]);
  }

  switch (filters.sort) {
    case 'price_asc':
      query = query.order('base_price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('base_price', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const properties = (data || []) as Property[];
  const statsById = await fetchReviewStats(properties.map((property) => property.id));
  let enriched = properties.map((property) => enrichProperty(property, statsById, filters));

  if (filters.sort === 'rating') {
    enriched = applySort(enriched, 'rating');
  }

  const totalCount = count ?? enriched.length;

  return {
    properties: enriched,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: filters.page * filters.pageSize < totalCount,
  };
}

export async function searchProperties(filters: SearchFilters = {}): Promise<SearchPropertiesResult> {
  const normalized = normalizeFilters(filters);

  try {
    const { data, error } = await supabase.rpc('search_properties', rpcPayload(normalized));

    if (error) throw error;

    const parsed = parseRpcResult(data, normalized);
    if (parsed) {
      const statsById = await fetchReviewStats(parsed.properties.map((property) => property.id));
      const properties = parsed.properties.map((property) => {
        const base = property as Property;
        const enriched = enrichProperty(base, statsById, normalized);
        return {
          ...enriched,
          avg_rating: property.avg_rating ?? enriched.avg_rating,
          review_count: property.review_count ?? enriched.review_count,
          total_price: property.total_price ?? enriched.total_price,
          nights: property.nights ?? enriched.nights,
        };
      });

      return {
        ...parsed,
        properties,
      };
    }
  } catch (error) {
    console.warn('search_properties RPC unavailable, using client fallback:', error);
  }

  try {
    return await searchPropertiesFallback(normalized);
  } catch (error) {
    console.error('Search fallback failed:', error);
    return {
      properties: [],
      totalCount: 0,
      page: normalized.page,
      pageSize: normalized.pageSize,
      hasMore: false,
    };
  }
}

export function applyCategoryPreset(category: string): Partial<SearchFilters> {
  return CATEGORY_PRESETS[category as keyof typeof CATEGORY_PRESETS] || {};
}

/** Apply a category pill without treating the label as a location search. */
export function applyCategoryToFilters(base: SearchFilters, category: string): SearchFilters {
  const preset = applyCategoryPreset(category);

  return {
    page: 1,
    guests: preset.guests ?? base.guests ?? 1,
    checkIn: base.checkIn,
    checkOut: base.checkOut,
    sort: base.sort,
    where: preset.where,
    propertyTypes: preset.propertyTypes,
    amenities: preset.amenities,
    instantBook: preset.instantBook,
    minPrice: undefined,
    maxPrice: undefined,
  };
}

export function mergeSearchFilters(base: SearchFilters, patch: Partial<SearchFilters>): SearchFilters {
  return {
    ...base,
    ...patch,
    propertyTypes: patch.propertyTypes ?? base.propertyTypes,
    amenities: patch.amenities ?? base.amenities,
  };
}
