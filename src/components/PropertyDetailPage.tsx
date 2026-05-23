import { useEffect, useState } from 'react';
import { ArrowLeft, Bath, Bed, Loader2, MapPin, Users } from 'lucide-react';
import { supabase, type Property } from '../lib/supabase';
import BookingWidget from './BookingWidget';

type PropertyDetailPageProps = {
  propertyId: string;
  onClose: () => void;
  onCheckout: (path: string) => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
};

export default function PropertyDetailPage({
  propertyId,
  onClose,
  onCheckout,
  isAuthenticated,
  onRequireAuth,
}: PropertyDetailPageProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function loadProperty() {
      setLoading(true);
      setError('');

      try {
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .eq('is_active', true)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) {
          setError('This listing is not available.');
          return;
        }

        setProperty(data as Property);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load this stay.');
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading stay...
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <button onClick={onClose} className="mb-6 inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <p className="text-rose-700">{error || 'Listing not found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const images =
    property.images.length > 0
      ? property.images
      : ['https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200'];
  const hero = images[activeImage] || images[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={onClose} className="inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back to stays
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="overflow-hidden rounded-[2rem] bg-gray-100">
              <img src={hero} alt={property.title} className="aspect-[16/10] w-full object-cover" />
            </div>

            {images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={[
                      'h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2',
                      index === activeImage ? 'border-orange-500' : 'border-transparent',
                    ].join(' ')}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">
                {property.property_type.replace(/_/g, ' ')}
              </p>
              <h1 className="mt-2 text-4xl font-extrabold text-gray-900">{property.title}</h1>
              <div className="mt-3 flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>
                  {property.city}, {property.state}, {property.country}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-5 text-sm text-gray-700">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  {property.max_guests} guests
                </span>
                <span className="inline-flex items-center gap-2">
                  <Bed className="h-4 w-4 text-orange-600" />
                  {property.bedrooms} bedrooms
                </span>
                <span className="inline-flex items-center gap-2">
                  <Bath className="h-4 w-4 text-orange-600" />
                  {property.bathrooms} baths
                </span>
              </div>

              <div className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-6">
                <h2 className="text-2xl font-extrabold text-gray-900">About this stay</h2>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-gray-600">{property.description}</p>
              </div>

              {property.amenities.length > 0 && (
                <div className="mt-6 rounded-[2rem] border border-gray-200 bg-white p-6">
                  <h2 className="text-2xl font-extrabold text-gray-900">Amenities</h2>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {property.amenities.map((amenity) => (
                      <li key={amenity} className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                        {amenity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {property.house_rules && (
                <div className="mt-6 rounded-[2rem] border border-gray-200 bg-white p-6">
                  <h2 className="text-2xl font-extrabold text-gray-900">House rules</h2>
                  <p className="mt-4 whitespace-pre-wrap leading-7 text-gray-600">{property.house_rules}</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <BookingWidget
              property={property}
              isAuthenticated={isAuthenticated}
              onRequireAuth={onRequireAuth}
              onReserve={onCheckout}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
