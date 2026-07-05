import { ReceiptText, ShieldCheck, SlidersHorizontal, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { applyCategoryToFilters, clearCategoryIfManualEdit, type SearchFilters } from '../lib/search';
import SearchBar from './search/SearchBar';
import CategoryPills from './search/CategoryPills';

type HeroProps = {
  onSearch: (filters: SearchFilters) => void;
};

const heroImage =
  'https://images.pexels.com/photos/457881/pexels-photo-457881.jpeg?auto=compress&cs=tinysrgb&w=1800';

export default function Hero({ onSearch }: HeroProps) {
  const [filters, setFilters] = useState<SearchFilters>({ guests: 1 });

  function handleCategory(category: string) {
    const next = applyCategoryToFilters(filters, category);
    setFilters(next);
    onSearch(next);
  }

  function handleFiltersChange(next: SearchFilters) {
    setFilters(clearCategoryIfManualEdit(filters, next));
  }

  const features = [
    { icon: ShieldCheck, title: 'Verified stays', copy: 'Reviewed details and photos.' },
    { icon: SlidersHorizontal, title: 'Flexible booking', copy: 'Instant book or request.' },
    { icon: ReceiptText, title: 'No surprise totals', copy: 'Fees shown before checkout.' },
  ];

  return (
    <section className="hero-shell">
      <div className="absolute inset-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover object-center" />
        <div className="hero-overlay" />
      </div>

      <div className="relative mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="theme-wander-only max-w-3xl">
          <p className="hero-badge">Luxury vacation rentals · 24/7 support</p>
          <h1 className="hero-title mt-8">Find your happy place</h1>
          <p className="hero-copy mt-6">
            Only the best homes, expertly operated. Compare stays with clear pricing and real booking support.
          </p>

          <SearchBar
            variant="hero"
            className="mt-10 max-w-4xl"
            filters={filters}
            onChange={handleFiltersChange}
            onSearch={() => onSearch(filters)}
          />

          <CategoryPills
            variant="hero"
            className="mt-6"
            activeCategory={filters.category}
            onSelect={handleCategory}
          />
        </div>

        <div className="theme-atlas-only grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="hero-badge">
              <Sparkles className="h-4 w-4 text-brand-soft" />
              Stays with verified details, flexible booking, and clear fees
            </div>

            <h1 className="hero-title mt-8">Book the stay that makes the trip.</h1>
            <p className="hero-copy mt-8">
              StayLoop helps travelers compare homes, hotel rooms, cabins, and unique stays with upfront pricing and real
              booking support.
            </p>

            <SearchBar
              variant="hero"
              className="mt-10 max-w-5xl"
              filters={filters}
              onChange={handleFiltersChange}
              onSearch={() => onSearch(filters)}
            />

            <CategoryPills
              variant="hero"
              className="mt-8"
              activeCategory={filters.category}
              onSelect={handleCategory}
            />
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[3rem] bg-brand/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <img
                src="https://images.unsplash.com/photo-1762529716272-b316f61502e7?auto=format&fit=crop&w=1400&q=80"
                alt="Modern coastal living room with neutral sofa and plants"
                className="h-[34rem] w-full rounded-[2rem] object-cover"
              />
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-surface-inverse/80 px-4 py-3 shadow-xl backdrop-blur">
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand-soft">This weekend, your way</p>
                  <h2 className="mt-0.5 truncate font-display text-base font-semibold text-hero-foreground">
                    Beach houses, cabins &amp; city stays
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-ink">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold">4.94</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="theme-wander-only mt-14 grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-card border border-white/10 bg-white/5 p-5 backdrop-blur">
                <Icon className="h-6 w-6 text-hero-foreground" />
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-hero-muted">{feature.copy}</p>
              </div>
            );
          })}
        </div>

        <div className="theme-atlas-only mt-16 grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="feature-tile">
                <Icon className="h-8 w-8 text-brand-soft" />
                <h3 className="mt-5 text-xl font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-hero-muted">{feature.copy}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
