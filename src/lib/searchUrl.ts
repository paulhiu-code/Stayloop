import type { SearchFilters, SearchSort } from './search';
import { applyCategoryPreset } from './search';
import { stayCategories } from '../data/showcase';

const SORT_VALUES: SearchSort[] = ['recommended', 'price_asc', 'price_desc', 'rating', 'newest'];

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseList(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseSort(value: string | null): SearchSort | undefined {
  if (!value) return undefined;
  return SORT_VALUES.includes(value as SearchSort) ? (value as SearchSort) : undefined;
}

function isStayCategory(value: string): value is (typeof stayCategories)[number] {
  return (stayCategories as readonly string[]).includes(value);
}

export function parseSearchParams(input: string | URLSearchParams): SearchFilters {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input;
  const category = params.get('category')?.trim() || undefined;

  const filters: SearchFilters = {
    where: params.get('where')?.trim() || undefined,
    checkIn: params.get('checkIn') || undefined,
    checkOut: params.get('checkOut') || undefined,
    guests: parseNumber(params.get('guests')),
    minPrice: parseNumber(params.get('minPrice')),
    maxPrice: parseNumber(params.get('maxPrice')),
    propertyTypes: parseList(params.get('propertyTypes')),
    amenities: parseList(params.get('amenities')),
    instantBook: parseBoolean(params.get('instantBook')),
    sort: parseSort(params.get('sort')),
    page: parseNumber(params.get('page')),
  };

  if (category && isStayCategory(category)) {
    const preset = applyCategoryPreset(category);
    return {
      ...filters,
      ...preset,
      category,
      guests: preset.guests ?? filters.guests ?? 1,
    };
  }

  return filters;
}

export function serializeSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.where?.trim()) params.set('where', filters.where.trim());
  if (filters.checkIn) params.set('checkIn', filters.checkIn);
  if (filters.checkOut) params.set('checkOut', filters.checkOut);
  if (filters.guests && filters.guests > 0) params.set('guests', String(filters.guests));
  if (filters.minPrice != null && filters.minPrice >= 0) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null && filters.maxPrice >= 0) params.set('maxPrice', String(filters.maxPrice));
  if (filters.category?.trim()) {
    params.set('category', filters.category.trim());
  } else {
    if (filters.propertyTypes?.length) params.set('propertyTypes', filters.propertyTypes.join(','));
    if (filters.amenities?.length) params.set('amenities', filters.amenities.join(','));
  }
  if (filters.instantBook != null) params.set('instantBook', String(filters.instantBook));
  if (filters.sort && filters.sort !== 'recommended') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));

  return params;
}

export function buildSearchPath(filters: SearchFilters, basePath = '/search'): string {
  const query = serializeSearchParams(filters).toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function searchParamsFromLocation(location: Pick<Location, 'search'>): SearchFilters {
  return parseSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search);
}
