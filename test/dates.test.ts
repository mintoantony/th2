import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWorkingDay, addWorkingDays, toDateKey } from '../src/shared/dates.ts';

test('weekends are not working days', () => {
  assert.equal(isWorkingDay(new Date('2026-09-05T12:00:00Z')), false);
  assert.equal(isWorkingDay(new Date('2026-09-06T12:00:00Z')), false);
});

test('bank holidays are not working days', () => {
  assert.equal(isWorkingDay(new Date('2026-12-25T12:00:00Z')), false);
});

test('adding working days skips the weekend', () => {
  const friday = new Date('2026-09-04T12:00:00Z');
  assert.equal(toDateKey(addWorkingDays(friday, 1)), '2026-09-07');
});

// These use 23:30, not midday. Every test above uses midday, and midday never
// crosses midnight, which is why this went unnoticed in the same way JOB D did.
test('working days are UK days, not UTC ones', () => {
  // 23:30Z on the 30th is already 00:30 on the 31st in London: a bank holiday.
  assert.equal(isWorkingDay(new Date('2026-08-30T23:30:00Z')), false, '31 Aug is a bank holiday');
  // 23:30Z on the 31st is 1 Sept in London: an ordinary Tuesday.
  assert.equal(isWorkingDay(new Date('2026-08-31T23:30:00Z')), true, '1 Sept is a working day');
});
