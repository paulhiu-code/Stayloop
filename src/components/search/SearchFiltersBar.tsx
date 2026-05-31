import { ChevronDown, SlidersHorizontal, Zap } from 'lucide-react';
import { useState } from 'react';
import {
  COMMON_AMENITIES,
  PROPERTY_TYPE_OPTIONS,
  SORT_OPTIONS,
  type SearchFilters,
  type SearchSort,
} from '../../lib/search';

type SearchFiltersBarProps = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  resultCount?: number;
};

export default function SearchFiltersBar({ filters, onChange, resultCount }: SearchFiltersBarProps) {
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);

  const selectedTypes = new Set(filters.propertyTypes || []);
  const selectedAmenities = new Set(filters.amenities || []);

  function togglePropertyType(value: string) {
    const next = new Set(selectedTypes);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ ...filters, page: 1, propertyTypes: next.size ? Array.from(next) : undefined });
  }

  function toggleAmenity(value: string) {
    const next = new Set(selectedAmenities);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ ...filters, page: 1, amenities: next.size ? Array.from(next) : undefined });
  }

  function updatePrice(field: 'minPrice' | 'maxPrice', raw: string) {
    const parsed = raw === '' ? undefined : Number(raw);
    onChange({
      ...filters,
      page: 1,
      [field]: parsed != null && Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  return (
    <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-lg">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <SlidersHorizontal className="h-4 w-4 text-orange-600" />
          Refine results
          {resultCount != null && (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              {resultCount} stays
            </span>
          )}
        </div>

        <label className="relative min-w-[12rem]">
          <span className="sr-only">Sort by</span>
          <select
            value={filters.sort || 'recommended'}
            onChange={(event) =>
              onChange({ ...filters, page: 1, sort: event.target.value as SearchSort })
            }
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-gray-900 outline-none transition hover:border-orange-300 focus:border-orange-400"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-end">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Min price
            </span>
            <input
              type="number"
              min={0}
              placeholder="Any"
              value={filters.minPrice ?? ''}
              onChange={(event) => updatePrice('minPrice', event.target.value)}
              className="w-28 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-orange-400"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Max price
            </span>
            <input
              type="number"
              min={0}
              placeholder="Any"
              value={filters.maxPrice ?? ''}
              onChange={(event) => updatePrice('maxPrice', event.target.value)}
              className="w-28 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-orange-400"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Property type</p>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPE_OPTIONS.map((option) => {
              const active = selectedTypes.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePropertyType(option.value)}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md'
                      : 'border border-gray-200 bg-gray-50 text-gray-700 hover:border-orange-300 hover:bg-orange-50',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...filters, page: 1, instantBook: filters.instantBook ? undefined : true })}
          className={[
            'inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition',
            filters.instantBook
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
              : 'border border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50',
          ].join(' ')}
        >
          <Zap className="h-4 w-4" />
          Instant book
        </button>
      </div>

      <div className="relative mt-5 border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={() => setAmenitiesOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 transition hover:border-orange-300 hover:bg-orange-50/50"
        >
          <span>
            Amenities
            {selectedAmenities.size > 0 && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                {selectedAmenities.size} selected
              </span>
            )}
          </span>
          <ChevronDown
            className={['h-4 w-4 text-gray-400 transition', amenitiesOpen ? 'rotate-180' : ''].join(' ')}
          />
        </button>

        {amenitiesOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMON_AMENITIES.map((amenity) => {
              const active = selectedAmenities.has(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md'
                      : 'border border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50',
                  ].join(' ')}
                >
                  {amenity}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
