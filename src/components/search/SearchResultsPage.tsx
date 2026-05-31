import { Loader2, MapPin, SearchX, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  applyCategoryToFilters,
  clearCategoryIfManualEdit,
  searchHeading,
  searchProperties,
  type SearchFilters,
  type SearchResultProperty,
} from '../../lib/search';
import { buildSearchPath, parseSearchParams } from '../../lib/searchUrl';
import Header from '../Header';
import PropertyCard from '../PropertyCard';
import SearchBar from './SearchBar';
import CategoryPills from './CategoryPills';
import SearchFiltersBar from './SearchFiltersBar';

type SearchResultsPageProps = {
  onViewStay: (propertyId: string) => void;
  onNavigateHome: () => void;
  onShowAuth?: () => void;
  initialFilters?: SearchFilters;
};

function filtersFromLocation(initialFilters?: SearchFilters): SearchFilters {
  if (initialFilters) return { page: 1, ...initialFilters };
  return { page: 1, ...parseSearchParams(window.location.search) };
}

function syncUrl(filters: SearchFilters) {
  const path = buildSearchPath(filters);
  window.history.replaceState({}, '', path);
}

export default function SearchResultsPage({
  onViewStay,
  onNavigateHome,
  onShowAuth,
  initialFilters,
}: SearchResultsPageProps) {
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(() => filtersFromLocation(initialFilters));
  const [activeFilters, setActiveFilters] = useState<SearchFilters>(() => filtersFromLocation(initialFilters));
  const [properties, setProperties] = useState<SearchResultProperty[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadResults = useCallback(async (filters: SearchFilters, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    setError('');

    try {
      const result = await searchProperties(filters);
      setProperties((current) => (append ? [...current, ...result.properties] : result.properties));
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to load search results.');
      if (!append) {
        setProperties([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    syncUrl(activeFilters);
    loadResults(activeFilters);
  }, [activeFilters, loadResults]);

  function runSearch(nextDraft = draftFilters) {
    const nextFilters = { ...nextDraft, page: 1 };
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
  }

  function updateDraftFilters(next: SearchFilters) {
    setDraftFilters(clearCategoryIfManualEdit(draftFilters, next));
  }

  function updateFilters(next: SearchFilters) {
    const cleared = clearCategoryIfManualEdit(draftFilters, next);
    setDraftFilters(cleared);
    setActiveFilters(cleared);
  }

  function loadMore() {
    if (!hasMore || loadingMore) return;
    const nextFilters = { ...activeFilters, page: (activeFilters.page || 1) + 1 };
    setActiveFilters(nextFilters);
    setDraftFilters(nextFilters);
    loadResults(nextFilters, true);
  }

  function applyCategory(category: string) {
    const nextFilters = applyCategoryToFilters(draftFilters, category);
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
  }

  const heading = searchHeading(activeFilters);
  const subtitleParts = [
    activeFilters.checkIn && activeFilters.checkOut ? `${activeFilters.checkIn} to ${activeFilters.checkOut}` : null,
    activeFilters.guests ? `${activeFilters.guests} guest${activeFilters.guests === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <Header
        onShowAuth={onShowAuth || (() => undefined)}
        onShowDashboard={() => undefined}
        onNavigate={() => onNavigateHome()}
      />

      <section className="border-b border-orange-100 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Search stays</p>
            <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">{heading}</h1>
            {subtitleParts.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 text-orange-500" />
                {subtitleParts.join(' · ')}
              </p>
            )}
          </div>

          <SearchBar filters={draftFilters} onChange={updateDraftFilters} onSearch={() => runSearch()} />

          <CategoryPills
            className="mt-4"
            activeCategory={activeFilters.category}
            onSelect={applyCategory}
          />
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <SearchFiltersBar
            filters={draftFilters}
            onChange={updateFilters}
            resultCount={loading ? undefined : totalCount}
          />
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="mb-4 aspect-[4/3] rounded-2xl bg-gray-200" />
                <div className="mb-2 h-6 rounded bg-gray-200" />
                <div className="h-4 w-2/3 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : properties.length > 0 ? (
          <>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">Results</p>
                <h2 className="mt-2 text-2xl font-extrabold text-gray-900">
                  {totalCount} {totalCount === 1 ? 'stay' : 'stays'} found
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onViewStay={onViewStay}
                  searchContext={{
                    totalPrice: property.total_price ?? undefined,
                    nights: property.nights ?? undefined,
                    avgRating: property.avg_rating ?? undefined,
                    reviewCount: property.review_count ?? undefined,
                  }}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-8 py-4 text-base font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Load more stays
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[2rem] border border-orange-100 bg-white px-8 py-20 text-center shadow-xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg">
              <SearchX className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900">No stays match your search</h3>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              Try widening your dates, adjusting price filters, or searching a nearby destination.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const cleared: SearchFilters = { page: 1 };
                  setDraftFilters(cleared);
                  setActiveFilters(cleared);
                }}
                className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-rose-600"
              >
                <Sparkles className="h-4 w-4" />
                Browse featured stays
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
