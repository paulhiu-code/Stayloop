import { CalendarDays, Minus, Plus, Search, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDateOnly, parseDateOnly } from '../../lib/booking';
import type { SearchFilters } from '../../lib/search';
import BookingDatePicker from '../BookingDatePicker';

type SearchBarProps = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  variant?: 'hero' | 'compact';
  className?: string;
};

function formatDateLabel(value?: string) {
  if (!value) return null;
  return parseDateOnly(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateRange(checkIn?: string, checkOut?: string) {
  const start = formatDateLabel(checkIn);
  const end = formatDateLabel(checkOut);
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – Add checkout`;
  return 'Add dates';
}

function formatGuestsLabel(guests?: number) {
  if (!guests || guests <= 1) return '1 guest';
  return `${guests} guests`;
}

export default function SearchBar({
  filters,
  onChange,
  onSearch,
  variant = 'compact',
  className = '',
}: SearchBarProps) {
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const datesRef = useRef<HTMLDivElement>(null);
  const guestsRef = useRef<HTMLDivElement>(null);

  const guests = filters.guests || 1;
  const isHero = variant === 'hero';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (datesRef.current && !datesRef.current.contains(target)) setDatesOpen(false);
      if (guestsRef.current && !guestsRef.current.contains(target)) setGuestsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelectDate(date: string) {
    const { checkIn, checkOut } = filters;

    if (!checkIn || (checkIn && checkOut)) {
      onChange({ ...filters, checkIn: date, checkOut: undefined });
      return;
    }

    if (date <= checkIn) {
      onChange({ ...filters, checkIn: date, checkOut: undefined });
      return;
    }

    onChange({ ...filters, checkOut: date });
    setDatesOpen(false);
  }

  function clearDates(event: React.MouseEvent) {
    event.stopPropagation();
    onChange({ ...filters, checkIn: undefined, checkOut: undefined });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSearch();
  }

  const shellClass = isHero ? 'search-shell search-shell-hero' : 'search-shell';

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className={shellClass}>
        <div className="grid items-stretch overflow-visible rounded-[1rem] md:grid-cols-[1.35fr_auto_0.95fr_auto_0.85fr_auto_auto]">
          <label className="search-field">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1">
              <span className="search-label">Where</span>
              <input
                type="text"
                value={filters.where || ''}
                onChange={(event) => onChange({ ...filters, where: event.target.value })}
                placeholder="Where to?"
                className="mt-1 w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-subtle"
              />
            </span>
          </label>

          <div className="hidden h-11 w-px self-center bg-border md:block" aria-hidden="true" />

          <div ref={datesRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setDatesOpen((open) => !open);
                setGuestsOpen(false);
              }}
              className="search-field w-full border-t border-border md:border-t-0"
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 text-left">
                <span className="search-label">Dates</span>
                <span className="search-value">{formatDateRange(filters.checkIn, filters.checkOut)}</span>
              </span>
              {(filters.checkIn || filters.checkOut) && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={clearDates}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      clearDates(event as unknown as React.MouseEvent);
                    }
                  }}
                  className="rounded-full p-1 text-ink-subtle hover:bg-page-muted hover:text-ink"
                  aria-label="Clear dates"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </button>

            {datesOpen && (
              <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-2rem,22rem)] shadow-elevated">
                <BookingDatePicker
                  month={month}
                  onMonthChange={setMonth}
                  unavailableDates={new Set()}
                  checkIn={filters.checkIn || null}
                  checkOut={filters.checkOut || null}
                  minDate={formatDateOnly(new Date())}
                  onSelectDate={handleSelectDate}
                />
              </div>
            )}
          </div>

          <div className="hidden h-11 w-px self-center bg-border md:block" aria-hidden="true" />

          <div ref={guestsRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setGuestsOpen((open) => !open);
                setDatesOpen(false);
              }}
              className="search-field w-full border-t border-border md:border-t-0"
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 text-left">
                <span className="search-label">Guests</span>
                <span className="search-value">{formatGuestsLabel(guests)}</span>
              </span>
            </button>

            {guestsOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-card border border-border bg-surface p-4 shadow-elevated">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">Guests</p>
                    <p className="text-xs text-ink-muted">Ages 13+</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={guests <= 1}
                      onClick={() => onChange({ ...filters, guests: Math.max(1, guests - 1) })}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
                      aria-label="Decrease guests"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-bold">{guests}</span>
                    <button
                      type="button"
                      disabled={guests >= 16}
                      onClick={() => onChange({ ...filters, guests: Math.min(16, guests + 1) })}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
                      aria-label="Increase guests"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="hidden h-11 w-px self-center bg-border md:block" aria-hidden="true" />

          <div className="border-t border-border p-2 md:border-t-0">
            <button type="submit" className="btn-primary h-full min-h-12 w-full md:w-auto">
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
