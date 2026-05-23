import { BadgeCheck, Bath, Bed, CalendarCheck, MapPin, Star, Users } from 'lucide-react';
import type { Property } from '../lib/supabase';
import type { ShowcaseProperty } from '../data/showcase';

type PropertyCardData = Property | ShowcaseProperty;

function getPropertyMeta(property: PropertyCardData) {
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
}: {
  property: PropertyCardData;
  onViewStay?: (propertyId: string) => void;
}) {
  const mainImage = property.images[0] || 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200';
  const meta = getPropertyMeta(property);
  const canNavigate = 'host_id' in property && Boolean(onViewStay);

  return (
    <article
      className="group cursor-pointer bg-white rounded-[2rem] overflow-hidden border border-gray-200 hover:border-orange-300 transition-all duration-500 shadow-lg hover:shadow-2xl transform hover:-translate-y-2"
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
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={mainImage}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80"></div>
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xl border border-white/50">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-gray-900">{meta.rating.toFixed(2)}</span>
          </div>
        </div>
        {property.instant_book && (
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-white/20">
            <CalendarCheck className="h-3.5 w-3.5" />
            Instant book
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
          {meta.badges.slice(0, 2).map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-gray-800 shadow-lg backdrop-blur"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-orange-600" />
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <span className="font-bold uppercase tracking-[0.18em] text-orange-600">{meta.collection}</span>
          <span className="text-gray-500">{meta.reviewCount} reviews</span>
        </div>

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors duration-300">
              {property.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {property.city}, {property.state}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 mb-5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium">{property.max_guests} guests</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Bed className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium">{property.bedrooms} bed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Bath className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium">{property.bathrooms} bath</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {property.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {amenity}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-5 border-t border-gray-200">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">${property.base_price}</span>
              <span className="text-sm text-gray-500 font-medium">/ night</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canNavigate) onViewStay?.(property.id);
            }}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            View stay
          </button>
        </div>
      </div>
    </article>
  );
}
