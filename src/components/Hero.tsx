import { CalendarDays, ReceiptText, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { stayCategories } from '../data/showcase';

export default function Hero({ onSearch }: { onSearch: (query: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 overflow-hidden text-white">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1557335200-a65f7f032602?auto=format&fit=crop&w=1800&q=80"
          alt=""
          className="h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_30%),linear-gradient(90deg,rgba(15,23,42,0.92)_0%,rgba(15,23,42,0.78)_45%,rgba(15,23,42,0.38)_100%)]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-orange-100 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-orange-300" />
              Stays with verified details, flexible booking, and clear fees
            </div>

            <h1 className="mt-8 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Book the stay that makes the trip.
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
              StayLoop helps travelers compare homes, hotel rooms, cabins, and unique stays with upfront pricing and real booking support.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 max-w-5xl">
              <div className="rounded-[2rem] border border-white/15 bg-white p-2 shadow-2xl shadow-orange-950/30">
                <div className="grid gap-2 lg:grid-cols-[1.3fr_1fr_0.85fr_auto]">
                  <label className="flex items-center gap-3 rounded-3xl px-5 py-4 text-left text-gray-900 hover:bg-orange-50">
                    <Search className="h-5 w-5 text-orange-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Where</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="City, beach, mountain, hotel"
                        className="mt-1 w-full bg-transparent text-base font-semibold text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </span>
                  </label>

                  <div className="flex items-center gap-3 rounded-3xl px-5 py-4 text-gray-900 hover:bg-orange-50">
                    <CalendarDays className="h-5 w-5 text-orange-600" />
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Dates</span>
                      <span className="mt-1 block text-base font-semibold">Add dates</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 rounded-3xl px-5 py-4 text-gray-900 hover:bg-orange-50">
                    <Users className="h-5 w-5 text-orange-600" />
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Guests</span>
                      <span className="mt-1 block text-base font-semibold">Add guests</span>
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="rounded-3xl bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-8 flex flex-wrap gap-3">
              {stayCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSearchQuery(category);
                    onSearch(category);
                  }}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:border-orange-300 hover:bg-orange-400/20"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-orange-400/30 to-rose-500/20 blur-3xl"></div>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <img
                src="https://images.pexels.com/photos/273204/pexels-photo-273204.jpeg?auto=compress&cs=tinysrgb&w=1400"
                alt="Austin skyline under a bright blue sky"
                className="h-[34rem] w-full rounded-[2rem] object-cover object-center"
              />
              <div className="absolute bottom-8 left-8 right-8 rounded-[2rem] border border-white/20 bg-slate-950/80 p-6 shadow-2xl backdrop-blur">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-200">This weekend in Austin</p>
                    <h2 className="mt-2 text-2xl font-extrabold">Sunny city stay near trails and music</h2>
                    <p className="mt-2 text-sm text-slate-300">Clear total before checkout. Trip details ready before arrival.</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-right text-gray-900">
                    <div className="flex items-center gap-1 text-sm font-bold">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      4.94
                    </div>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Guest favorite</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Verified stays',
              copy: 'Listing details, photos, amenities, and quality checks help you book with confidence.',
            },
            {
              icon: SlidersHorizontal,
              title: 'Flexible booking',
              copy: 'Support instant book and request-to-book stays so travelers can choose how they reserve.',
            },
            {
              icon: ReceiptText,
              title: 'No surprise totals',
              copy: 'See nightly rates, cleaning fees, and guest fees before you decide where to stay.',
            },
          ].map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.title} className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur">
                <Icon className="h-8 w-8 text-orange-300" />
                <h3 className="mt-5 text-xl font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{feature.copy}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
