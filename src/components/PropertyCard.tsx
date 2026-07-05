import { BadgeCheck, Bath, Bed, CalendarCheck, MapPin, Star, Users } from 'lucide-react';
import type { Property } from '../lib/supabase';
import type { ShowcaseProperty } from '../data/showcase';
import { normalizeAmenities } from '../lib/property';

type PropertyCardData = Property | ShowcaseProperty;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PropertyCardSearchContext = {
  totalPrice?: number;
  nights?: number;
  avgRating?: number;
  reviewCount?: number;
};

function getPropertyMeta(property: PropertyCardData, searchContext?: PropertyCardSearchContext) {
  if (searchContext?.avgRating != null || searchContext?.reviewCount != null) {
    return {
      rating: searchContext.avgRating ?? 4.9,
      reviewCount: searchContext.reviewCount ?? 0,
      collection: 'rating' in property ? property.collection : property.property_type.replace(/_/g, ' '),
      badges: 'badges' in property ? property.badges : property.is_active ? ['Verified'] : [],
    };
  }

  if ('rating' in property) {
    return {
      rating: property.rating,
      reviewCount: property.reviewCount,
      collection: property.collection,
      badges: property.badges,
    };
  }

  return {
    rating: 4.9,
    reviewCount: 50,
    collection: property.property_type.replace(/_/g, ' '),
    badges: property.is_active ? ['Verified'] : [],
  };
}

export default function PropertyCard({
  property,
  onViewStay,
  searchContext,
}: {
  property: PropertyCardData;
  onViewStay?: (propertyId: string) => void;
  searchContext?: PropertyCardSearchContext;
}) {
  const mainImage = property.images[0] || 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200';
  const amenities = normalizeAmenities(property.amenities);
  const meta = getPropertyMeta(property, searchContext);
  const canNavigate = UUID_PATTERN.test(property.id) && Boolean(onViewStay);
  const showStayTotal = searchContext?.totalPrice != null && searchContext.nights != null && searchContext.nights > 0;

  return (
    <article
      className="property-card group"
      onClick={() => {
        if (canNavigate) onViewStay?.(property.id);
      }}
      onKeyDown={(event) => {
        if (canNavigate && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onViewStay?.(property.id);
        }
      }}
      role={canNavigate ? 'button' : undefined}
      tabIndex={canNavigate ? 0 : undefined}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-page-muted">
        <img src={mainImage} alt={property.title} className="property-card-image" />
        <div className="theme-atlas-only absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80" />

        <div className="absolute right-4 top-4 rounded-control border border-border bg-surface/95 px-3 py-1.5 shadow-card backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-ink">{meta.rating.toFixed(1)}</span>
          </div>
        </div>

        {property.instant_book && (
          <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-control bg-success px-3 py-1.5 text-xs font-semibold text-brand-foreground">
            <CalendarCheck className="h-3.5 w-3.5" />
            Instant book
          </div>
        )}

        <div className="theme-atlas-only absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
          {meta.badges.slice(0, 2).map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 rounded-pill bg-surface/90 px-3 py-1.5 text-xs font-bold text-ink shadow-card backdrop-blur"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-brand" />
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium capitalize text-ink-muted">{meta.collection}</span>
          <span className="text-ink-subtle">{meta.reviewCount} reviews</span>
        </div>

        <h3 className="text-lg font-semibold text-ink transition group-hover:text-brand">{property.title}</h3>

        <div className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
          <MapPin className="h-4 w-4 text-ink-subtle" />
          <span>
            {property.city}, {property.state}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-ink-subtle" />
            {property.max_guests} guests
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bed className="h-4 w-4 text-ink-subtle" />
            {property.bedrooms} bed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath className="h-4 w-4 text-ink-subtle" />
            {property.bathrooms} bath
          </span>
        </div>

        <div className="theme-atlas-only mt-4 flex flex-wrap gap-2">
          {amenities.slice(0, 3).map((amenity) => (
            <span key={amenity} className="rounded-pill bg-page-muted px-3 py-1 text-xs font-semibold text-ink-muted">
              {amenity}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-5">
          <div>
            {showStayTotal ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-ink">${Math.round(searchContext!.totalPrice!)}</span>
                  <span className="text-sm text-ink-muted">
                    total · {searchContext!.nights} night{searchContext!.nights === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-subtle">${property.base_price} / night</p>
              </>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-ink">${property.base_price}</span>
                <span className="text-sm text-ink-muted">/ night</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canNavigate) onViewStay?.(property.id);
            }}
            className="btn-primary !px-4 !py-2.5 theme-wander-only !rounded-control !text-sm"
          >
            View
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canNavigate) onViewStay?.(property.id);
            }}
            className="btn-primary theme-atlas-only !px-5 !py-2.5 !text-sm"
          >
            View stay
          </button>
        </div>
      </div>
    </article>
  );
}
