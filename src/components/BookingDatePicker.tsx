import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateOnly, parseDateOnly } from '../lib/booking';

type BookingDatePickerProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  unavailableDates: Set<string>;
  checkIn: string | null;
  checkOut: string | null;
  minDate?: string;
  onSelectDate: (date: string) => void;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isBetween(date: string, start: string | null, end: string | null) {
  if (!start || !end) return false;
  return date > start && date < end;
}

export default function BookingDatePicker({
  month,
  onMonthChange,
  unavailableDates,
  checkIn,
  checkOut,
  minDate,
  onSelectDate,
}: BookingDatePickerProps) {
  const firstDay = startOfMonth(month);
  const leadingEmpty = firstDay.getDay();
  const totalDays = daysInMonth(month);
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = formatDateOnly(new Date());
  const minSelectable = minDate || today;

  const cells: Array<{ key: string; date: string | null }> = [];
  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push({ key: `empty-${i}`, date: null });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    cells.push({ key: formatDateOnly(date), date: formatDateOnly(date) });
  }

  function shiftMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    onMonthChange(next);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-gray-900">{monthLabel}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.date) {
            return <span key={cell.key} className="h-10" />;
          }

          const unavailable = unavailableDates.has(cell.date);
          const disabled = unavailable || cell.date < minSelectable;
          const selected = cell.date === checkIn || cell.date === checkOut;
          const inRange = isBetween(cell.date, checkIn, checkOut);

          return (
            <button
              key={cell.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(cell.date!)}
              className={[
                'h-10 rounded-xl text-sm font-semibold transition',
                disabled ? 'cursor-not-allowed text-gray-300' : 'text-gray-900 hover:bg-orange-50',
                selected ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600' : '',
                inRange && !selected ? 'bg-orange-100 text-orange-900' : '',
              ].join(' ')}
            >
              {parseDateOnly(cell.date).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
