import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  generateICalendar,
  parseICalendar,
  eachNightISO,
  addDaysISO,
  collectBlockedNights,
  eventsToBlocks,
} from './ical.ts';

Deno.test('eachNightISO treats checkout as exclusive', () => {
  assertEquals(eachNightISO('2026-07-04', '2026-07-07'), [
    '2026-07-04',
    '2026-07-05',
    '2026-07-06',
  ]);
  assertEquals(eachNightISO('2026-07-04', '2026-07-04'), []);
});

Deno.test('addDaysISO handles month/year rollover', () => {
  assertEquals(addDaysISO('2026-07-31', 1), '2026-08-01');
  assertEquals(addDaysISO('2026-12-31', 1), '2027-01-01');
});

Deno.test('generateICalendar produces valid all-day VEVENTs', () => {
  const ics = generateICalendar({
    calendarName: 'StayLoop — Beach House',
    blocks: [
      { uid: 'booking-1@stayloop', checkIn: '2026-07-04', checkOut: '2026-07-07', summary: 'Reserved' },
    ],
    now: new Date('2026-07-01T00:00:00Z'),
  });

  assert(ics.startsWith('BEGIN:VCALENDAR'));
  assert(ics.includes('END:VCALENDAR'));
  assert(ics.includes('BEGIN:VEVENT'));
  assert(ics.includes('UID:booking-1@stayloop'));
  assert(ics.includes('DTSTART;VALUE=DATE:20260704'));
  assert(ics.includes('DTEND;VALUE=DATE:20260707'));
  // CRLF line endings per RFC 5545.
  assert(ics.includes('\r\n'));
});

Deno.test('round-trip: generated calendar parses back to the same block', () => {
  const ics = generateICalendar({
    calendarName: 'Test',
    blocks: [
      { uid: 'a@stayloop', checkIn: '2026-08-10', checkOut: '2026-08-14', summary: 'Reserved' },
    ],
  });
  const events = parseICalendar(ics);
  assertEquals(events.length, 1);
  assertEquals(events[0].start, '2026-08-10');
  assertEquals(events[0].end, '2026-08-14');
  assertEquals(events[0].uid, 'a@stayloop');
  assertEquals(collectBlockedNights(events), [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
  ]);
});

Deno.test('parseICalendar handles Airbnb-style export with folded lines', () => {
  const airbnb = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'DTEND;VALUE=DATE:20260920',
    'DTSTART;VALUE=DATE:20260918',
    'UID:1234567890abcdef@airbnb.com',
    'SUMMARY:Reserved (Not available)',
    'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservatio',
    ' ns/details/HMABCDEFGH',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const events = parseICalendar(airbnb);
  assertEquals(events.length, 1);
  assertEquals(events[0].start, '2026-09-18');
  assertEquals(events[0].end, '2026-09-20');
  assertEquals(events[0].summary, 'Reserved (Not available)');
});

Deno.test('parseICalendar handles DATE-TIME values and missing DTEND', () => {
  const feed = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:dt@vrbo',
    'DTSTART:20260701T150000Z',
    'DTEND:20260701T110000Z',
    'SUMMARY:Blocked',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');

  const events = parseICalendar(feed);
  assertEquals(events.length, 1);
  assertEquals(events[0].start, '2026-07-01');
  // end <= start for a datetime block -> normalized to a single night.
  assertEquals(events[0].end, '2026-07-02');
});

Deno.test('eventsToBlocks maps fields correctly', () => {
  const blocks = eventsToBlocks([
    { uid: 'x', start: '2026-01-01', end: '2026-01-03', summary: 'Reserved' },
  ]);
  assertEquals(blocks, [
    { uid: 'x', checkIn: '2026-01-01', checkOut: '2026-01-03', summary: 'Reserved' },
  ]);
});

Deno.test('multiple overlapping events dedupe nights', () => {
  const events = parseICalendar(
    generateICalendar({
      calendarName: 'Test',
      blocks: [
        { uid: 'a', checkIn: '2026-03-01', checkOut: '2026-03-04' },
        { uid: 'b', checkIn: '2026-03-03', checkOut: '2026-03-05' },
      ],
    })
  );
  assertEquals(collectBlockedNights(events), [
    '2026-03-01',
    '2026-03-02',
    '2026-03-03',
    '2026-03-04',
  ]);
});
