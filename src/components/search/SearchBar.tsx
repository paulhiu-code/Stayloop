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

  const shellClass = isHero
    ? 'rounded-[2rem] border border-white/40 bg-white/95 p-2 shadow-2xl shadow-slate-950/25 backdrop-blur-xl'
    : 'rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-lg';

  const fieldClass = isHero
    ? 'group flex cursor-text items-center gap-3 px-5 py-3 text-left text-slate-950 transition hover:bg-slate-50'
    : 'group flex cursor-text items-center gap-3 px-4 py-3 text-left text-slate-950 transition hover:bg-orange-50/60';

  const labelClass = isHero
    ? 'block text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-slate-500'
    : 'block text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-500';

  const valueClass = isHero
    ? 'mt-1 block text-[0.95rem] font-semibold text-slate-950'
    : 'mt-1 block text-[0.95rem] font-semibold text-gray-900';

  const inputClass = isHero
    ? 'mt-1 w-full bg-transparent text-[0.95rem] font-semibold text-slate-950 outline-none placeholder:text-slate-500'
    : 'mt-1 w-full bg-transparent text-[0.95rem] font-semibold text-gray-900 outline-none placeholder:text-gray-500';

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className={shellClass}>
        <div className="grid items-stretch overflow-visible rounded-[1.5rem] md:grid-cols-[1.35fr_auto_0.95fr_auto_0.85fr_auto_auto]">
          <label className={fieldClass}>
            <Search className="h-3.5 w-3.5 shrink-0 text-orange-600" />
            <span className="min-w-0 flex-1">
              <span className={labelClass}>Where</span>
              <input
                type="text"
                value={filters.where || ''}
                onChange={(event) => onChange({ ...filters, where: event.target.value })}
                placeholder="Where to?"
                className={inputClass}
              />
            </span>
          </label>

          <div className="hidden h-11 self-center md:block w-px bg-slate-200" aria-hidden="true" />

          <div ref={datesRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setDatesOpen((open) => !open);
                setGuestsOpen(false);
              }}
              className={`${fieldClass} w-full border-t border-slate-200 md:border-t-0`}
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-orange-600" />
              <span className="min-w-0 flex-1 text-left">
                <span className={labelClass}>Dates</span>
                <span className={valueClass}>{formatDateRange(filters.checkIn, filters.checkOut)}</span>
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
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear dates"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </button>

            {datesOpen && (
              <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-2rem,22rem)] shadow-2xl">
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

          <div className="hidden h-11 self-center md:block w-px bg-slate-200" aria-hidden="true" />

          <div ref={guestsRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setGuestsOpen((open) => !open);
                setDatesOpen(false);
              }}
              className={`${fieldClass} w-full border-t border-slate-200 md:border-t-0`}
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-orange-600" />
              <span className="min-w-0 flex-1 text-left">
                <span className={labelClass}>Guests</span>
                <span className={valueClass}>{formatGuestsLabel(guests)}</span>
              </span>
            </button>

            {guestsOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Guests</p>
                    <p className="text-xs text-gray-500">Ages 13+</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={guests <= 1}
                      onClick={() => onChange({ ...filters, guests: Math.max(1, guests - 1) })}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 disabled:opacity-40"
                      aria-label="Decrease guests"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-bold">{guests}</span>
                    <button
                      type="button"
                      disabled={guests >= 16}
                      onClick={() => onChange({ ...filters, guests: Math.min(16, guests + 1) })}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 disabled:opacity-40"
                      aria-label="Increase guests"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="hidden h-11 self-center md:block w-px bg-slate-200" aria-hidden="true" />

          <div className="border-t border-slate-200 p-2 md:border-t-0">
            <button
              type="submit"
              className="flex h-full min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 px-6 text-base font-extrabold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl md:w-auto"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
