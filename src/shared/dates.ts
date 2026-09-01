// Date helpers shared by billing and scheduling.
//
// Everything the customer sees is UK local time. Everything we store is UTC.
// The two are not the same thing for half the year and this file is where that
// keeps going wrong.

export const BANK_HOLIDAYS_2026 = [
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04',
  '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
];

const UK_TIME_ZONE = 'Europe/London';
const UK_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const UK_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// What the customer is told their appointment time is.
export function formatSlotTime(d: Date): string {
  return UK_TIME_FORMAT.format(d);
}

export function formatSlotDate(d: Date): string {
  const parts = UK_DATE_FORMAT.formatToParts(d);
  const year = parts.find((part) => part.type === 'year')!.value;
  const month = parts.find((part) => part.type === 'month')!.value;
  const day = parts.find((part) => part.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

// The UTC date. Still useful for keying stored data, but it is NOT the day the
// customer is in: after 23:00 in summer the two have already diverged.
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Day of week for a UK calendar day, worked out from the date itself rather than
// from a Date object, so the answer cannot depend on where the server runs.
function dayOfWeek(ukDate: string): number {
  const [year, month, day] = ukDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Working days are UK days. This used to read the weekend off the server clock
// with getDay() and then look the bank holiday up under a UTC key, so a job at
// 23:30 in summer was tested against one day for the weekend and another for the
// holiday. It called the August bank holiday a working day in London, called an
// ordinary Tuesday a holiday everywhere, and gave different answers on a UTC box
// than on a UK one. Both halves now ask the same question of the same UK date.
export function isWorkingDay(d: Date): boolean {
  const ukDate = formatSlotDate(d);
  const day = dayOfWeek(ukDate);
  if (day === 0 || day === 6) return false;
  return !BANK_HOLIDAYS_2026.includes(ukDate);
}

// Steps whole UK calendar days, anchored at midday UTC so that adding a day can
// never land on a clock change and lose or repeat one. Returns midday UTC on the
// resulting UK day rather than preserving the time of day it was handed.
export function addWorkingDays(from: Date, n: number): Date {
  const DAY_MS = 24 * 60 * 60 * 1000;
  let cursor = Date.parse(`${formatSlotDate(from)}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    cursor += DAY_MS;
    if (isWorkingDay(new Date(cursor))) left--;
  }
  return new Date(cursor);
}

// A day means the day the customer is living in, so this compares UK dates and
// not UTC ones. Between 23:00 and midnight UTC in summer the two disagree, and
// dispatch was letting a second van through on exactly those.
export function sameDay(a: Date, b: Date): boolean {
  return formatSlotDate(a) === formatSlotDate(b);
}
