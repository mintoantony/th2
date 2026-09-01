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

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWorkingDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return !BANK_HOLIDAYS_2026.includes(toDateKey(d));
}

export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d)) left--;
  }
  return d;
}

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

export function sameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}
