import { MapPin, Users, Bed, Bath, Star } from 'lucide-react';
import { Property } from '../lib/supabase';

export default function PropertyCard({ property }: { property: Property }) {
  const mainImage = property.images[0] || 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200';

  return (
    <div className="group cursor-pointer bg-white rounded-3xl overflow-hidden border border-gray-200 hover:border-orange-300 transition-all duration-500 shadow-lg hover:shadow-2xl transform hover:-translate-y-2">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={mainImage}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xl border border-white/50">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-gray-900">4.9</span>
          </div>
        </div>
        {property.instant_book && (
          <div className="absolute top-4 left-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-white/20">
            ⚡ Instant Book
          </div>
        )}
      </div>

      <div className="p-6">
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
            <span className="font-medium">{property.max_guests}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Bed className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium">{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Bath className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium">{property.bathrooms}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-5 border-t border-gray-200">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">${property.base_price}</span>
              <span className="text-sm text-gray-500 font-medium">/ night</span>
            </div>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
