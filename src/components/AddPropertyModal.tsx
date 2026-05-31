import { FormEvent, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createManualProperty, PROPERTY_TYPES, type ManualPropertyInput } from '../lib/properties';

type AddPropertyModalProps = {
  hostId: string;
  onClose: () => void;
  onCreated: () => void;
};

const defaultForm: ManualPropertyInput = {
  title: '',
  description: '',
  property_type: 'house',
  address: '',
  city: '',
  state: '',
  country: 'US',
  base_price: 150,
  cleaning_fee: 0,
  bedrooms: 2,
  bathrooms: 1,
  max_guests: 4,
  min_nights: 1,
  imageUrls: [],
  house_rules: '',
};

export default function AddPropertyModal({ hostId, onClose, onCreated }: AddPropertyModalProps) {
  const [form, setForm] = useState<ManualPropertyInput>(defaultForm);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateField<K extends keyof ManualPropertyInput>(key: K, value: ManualPropertyInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!form.title.trim() || !form.description.trim() || !form.address.trim()) {
        throw new Error('Title, description, and address are required.');
      }

      await createManualProperty(hostId, {
        ...form,
        imageUrls: imageUrlInput
          .split('\n')
          .map((url) => url.trim())
          .filter(Boolean),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create property.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-600">Add property</p>
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">List on StayLoop directly</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              OwnerRez remains the primary sync path for beta. Use this form for manual listings or future direct-only hosts.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Title</span>
              <input
                required
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                placeholder="Lakefront cabin with dock"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Description</span>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                placeholder="Describe the space, neighborhood, and what guests will love."
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Property type</span>
              <select
                value={form.property_type}
                onChange={(e) => updateField('property_type', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Nightly rate (USD)</span>
              <input
                required
                type="number"
                min={1}
                value={form.base_price}
                onChange={(e) => updateField('base_price', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Street address</span>
              <input
                required
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">City</span>
              <input
                required
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">State</span>
              <input
                required
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Country</span>
              <input
                required
                value={form.country}
                onChange={(e) => updateField('country', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Cleaning fee</span>
              <input
                type="number"
                min={0}
                value={form.cleaning_fee}
                onChange={(e) => updateField('cleaning_fee', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Bedrooms</span>
              <input
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => updateField('bedrooms', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Bathrooms</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.bathrooms}
                onChange={(e) => updateField('bathrooms', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Max guests</span>
              <input
                type="number"
                min={1}
                value={form.max_guests}
                onChange={(e) => updateField('max_guests', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-gray-700">Photo URLs (one per line)</span>
              <textarea
                rows={3}
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                placeholder="https://..."
              />
            </label>
          </div>

          {error && <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-5 py-3 font-bold text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 font-bold text-white shadow-lg disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create listing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
