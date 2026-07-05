import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bath,
  Bed,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { supabase, type Property } from '../lib/supabase';
import { normalizeAmenities } from '../lib/property';
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
  const [galleryOpen, setGalleryOpen] = useState(false);

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

        setProperty({ ...(data as Property), amenities: normalizeAmenities(data.amenities) });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load this stay.');
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [propertyId]);

  const images =
    property && property.images.length > 0
      ? property.images
      : ['https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200'];

  useEffect(() => {
    if (!galleryOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setGalleryOpen(false);
      if (event.key === 'ArrowRight') setActiveImage((index) => (index + 1) % images.length);
      if (event.key === 'ArrowLeft') setActiveImage((index) => (index - 1 + images.length) % images.length);
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [galleryOpen, images.length]);

  if (loading) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading stay...
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="page-shell px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <button onClick={onClose} className="btn-ghost mb-6 !px-0">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="card-surface p-8 text-center">
            <p className="text-rose-600">{error || 'Listing not found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  function openGallery(index: number) {
    setActiveImage(index);
    setGalleryOpen(true);
  }

  function scrollToBooking() {
    document.getElementById('booking-widget')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const sideImages = images.slice(1, 5);

  return (
    <div className="page-shell pb-24 lg:pb-0">
      <div className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={onClose} className="btn-ghost !px-0">
            <ArrowLeft className="h-4 w-4" />
            Back to stays
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-content px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <p className="section-label capitalize">{property.property_type.replace(/_/g, ' ')}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl lg:text-4xl">{property.title}</h1>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="h-4 w-4 text-ink-subtle" />
            <span>
              {property.city}, {property.state}, {property.country}
            </span>
          </div>
        </div>

        {/* Photo gallery */}
        {images.length === 1 ? (
          <button
            type="button"
            onClick={() => openGallery(0)}
            className="block w-full overflow-hidden rounded-card bg-page-muted"
          >
            <img src={images[0]} alt={property.title} className="h-[16rem] w-full object-cover sm:h-[24rem] lg:h-[28rem]" />
          </button>
        ) : (
          <>
            {/* Mobile: single hero with count */}
            <button
              type="button"
              onClick={() => openGallery(0)}
              className="relative block w-full overflow-hidden rounded-card bg-page-muted md:hidden"
            >
              <img src={images[0]} alt={property.title} className="h-[16rem] w-full object-cover" />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-pill bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                <LayoutGrid className="h-3.5 w-3.5" />
                {images.length} photos
              </span>
            </button>

            {/* Desktop: mosaic */}
            <div className="relative hidden h-[24rem] gap-2 md:grid md:grid-cols-2 lg:h-[28rem]">
              <button
                type="button"
                onClick={() => openGallery(0)}
                className="group relative overflow-hidden rounded-l-card bg-page-muted"
              >
                <img
                  src={images[0]}
                  alt={property.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              </button>
              <div className="grid grid-cols-2 grid-rows-2 gap-2">
                {sideImages.map((image, index) => {
                  const realIndex = index + 1;
                  const isLastVisible = index === sideImages.length - 1;
                  const roundClass =
                    index === 1 ? 'rounded-tr-card' : index === 3 ? 'rounded-br-card' : '';
                  return (
                    <button
                      key={`${image}-${realIndex}`}
                      type="button"
                      onClick={() => openGallery(realIndex)}
                      className={`group relative overflow-hidden bg-page-muted ${roundClass}`}
                    >
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                      {isLastVisible && images.length > 5 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
                          +{images.length - 5} more
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => openGallery(0)}
                className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-control border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-elevated transition hover:bg-page-muted"
              >
                <LayoutGrid className="h-4 w-4" />
                Show all photos
              </button>
            </div>
          </>
        )}

        {/* Body */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_384px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border pb-6 text-sm text-ink">
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" />
                {property.max_guests} guests
              </span>
              <span className="inline-flex items-center gap-2">
                <Bed className="h-4 w-4 text-brand" />
                {property.bedrooms} bedrooms
              </span>
              <span className="inline-flex items-center gap-2">
                <Bath className="h-4 w-4 text-brand" />
                {property.bathrooms} baths
              </span>
            </div>

            <section className="border-b border-border py-6">
              <h2 className="text-xl font-semibold text-ink">About this stay</h2>
              <p className="mt-3 whitespace-pre-wrap leading-7 text-ink-muted">{property.description}</p>
            </section>

            {property.amenities.length > 0 && (
              <section className="border-b border-border py-6">
                <h2 className="text-xl font-semibold text-ink">What this place offers</h2>
                <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {property.amenities.map((amenity) => (
                    <li key={amenity} className="flex items-center gap-3 text-sm text-ink">
                      <Check className="h-4 w-4 shrink-0 text-brand" />
                      {amenity}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {property.house_rules && (
              <section className="py-6">
                <h2 className="text-xl font-semibold text-ink">House rules</h2>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-ink-muted">{property.house_rules}</p>
              </section>
            )}
          </div>

          <div id="booking-widget" className="lg:sticky lg:top-24 lg:self-start">
            <BookingWidget
              property={property}
              isAuthenticated={isAuthenticated}
              onRequireAuth={onRequireAuth}
              onReserve={onCheckout}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4">
          <div>
            <span className="text-lg font-semibold text-ink">${property.base_price}</span>
            <span className="text-sm text-ink-muted"> / night</span>
          </div>
          <button type="button" onClick={scrollToBooking} className="btn-primary">
            Check availability
          </button>
        </div>
      </div>

      {/* Full-screen photo lightbox */}
      {galleryOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
          <div className="flex items-center justify-between px-4 py-4 text-white sm:px-6">
            <span className="text-sm font-medium">
              {activeImage + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
              className="inline-flex items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              <X className="h-5 w-5" />
              Close
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 sm:px-16">
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveImage((index) => (index - 1 + images.length) % images.length)}
                className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <img
              src={images[activeImage]}
              alt={`${property.title} photo ${activeImage + 1}`}
              className="max-h-[80vh] max-w-full rounded-card object-contain"
            />
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveImage((index) => (index + 1) % images.length)}
                className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-4 sm:justify-center sm:px-6">
              {images.map((image, index) => (
                <button
                  key={`${image}-thumb-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    index === activeImage ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
