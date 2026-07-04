/*
  Pure, dependency-free iCalendar (RFC 5545) helpers for StayLoop's universal
  channel sync. Kept free of Deno/runtime APIs so it can be unit-tested directly.

  - `generateICalendar` builds a VCALENDAR of all-day VEVENT blocks (what a channel
    like Airbnb/VRBO reads from our export URL).
  - `parseICalendar` reads an external .ics feed (Airbnb/VRBO/PMS export) into event
    ranges.
  - `expandNights` turns an event range into the individual nights to block, using
    iCal all-day semantics where DTEND is exclusive (the checkout/departure day).
*/

export interface ICalEvent {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exclusive, per iCal all-day semantics)
  summary: string;
}

export interface ICalBlock {
  uid: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD (exclusive)
  summary?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatICalDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

export function addDaysISO(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function eachNightISO(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  let cursor = checkIn;
  // checkOut is exclusive: the last blocked night is checkOut - 1.
  while (cursor < checkOut) {
    nights.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return nights;
}

// Escape per RFC 5545 3.3.11 for TEXT values (summary etc.).
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Fold lines to <=75 octets per RFC 5545 3.1 (CRLF + single leading space).
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return chunks.join('\r\n');
}

export function generateICalendar(opts: {
  calendarName: string;
  productId?: string;
  blocks: ICalBlock[];
  now?: Date;
}): string {
  const prodId = opts.productId ?? '-//StayLoop//Channel Sync//EN';
  const dtstamp =
    formatICalDate(opts.now ?? new Date()) + 'T000000Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
  ];

  for (const block of opts.blocks) {
    const startCompact = block.checkIn.replace(/-/g, '');
    const endCompact = block.checkOut.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${block.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${startCompact}`);
    lines.push(`DTEND;VALUE=DATE:${endCompact}`);
    lines.push(`SUMMARY:${escapeText(block.summary ?? 'Reserved')}`);
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// Unfold continuation lines (leading space/tab) per RFC 5545 3.1.
function unfold(text: string): string[] {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

// Extract the YYYY-MM-DD date portion from a DTSTART/DTEND value which may be a
// DATE (20260704) or DATE-TIME (20260704T150000Z / local).
function parseDateValue(raw: string): string | null {
  const match = raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseICalendar(text: string): ICalEvent[] {
  const lines = unfold(text);
  const events: ICalEvent[] = [];

  let inEvent = false;
  let uid = '';
  let start: string | null = null;
  let end: string | null = null;
  let startIsDateTime = false;
  let summary = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      start = null;
      end = null;
      startIsDateTime = false;
      summary = '';
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (start) {
        // DATE-TIME events (rare, e.g. hourly holds) are inclusive of the end
        // instant; treat missing/short end as a single night.
        let normalizedEnd = end;
        if (!normalizedEnd) {
          normalizedEnd = addDaysISO(start, 1);
        } else if (startIsDateTime && normalizedEnd <= start) {
          normalizedEnd = addDaysISO(start, 1);
        }
        events.push({
          uid: uid || `${start}_${normalizedEnd}`,
          start,
          end: normalizedEnd,
          summary,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const name = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1).trim();
    const propName = name.split(';')[0].toUpperCase();

    if (propName === 'UID') {
      uid = value;
    } else if (propName === 'DTSTART') {
      start = parseDateValue(value);
      startIsDateTime = /T\d{2}/.test(value);
    } else if (propName === 'DTEND') {
      end = parseDateValue(value);
    } else if (propName === 'SUMMARY') {
      summary = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
    }
  }

  return events;
}

// Turn parsed events into concrete blocks (checkIn inclusive, checkOut exclusive).
export function eventsToBlocks(events: ICalEvent[]): ICalBlock[] {
  return events.map((event) => ({
    uid: event.uid,
    checkIn: event.start,
    checkOut: event.end,
    summary: event.summary,
  }));
}

// Collect every blocked night across a set of events (deduped, sorted).
export function collectBlockedNights(events: ICalEvent[]): string[] {
  const nights = new Set<string>();
  for (const event of events) {
    for (const night of eachNightISO(event.start, event.end)) {
      nights.add(night);
    }
  }
  return [...nights].sort();
}
