import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotFor } from '../src/scheduling/slots.ts';
import { dispatch } from '../src/scheduling/dispatch.ts';
import { workOrders } from '../src/db.ts';

test('a customer is quoted a window around the requested time', () => {
  const order = workOrders.find((w) => w.id === 'W-5001')!;
  const slot = slotFor(order);
  assert.equal(slot.window, '08:00 to 11:00');
  assert.equal(slot.date, '2026-09-02');
});

// JOB D. This previously asserted date '2026-09-03', which was the bug: the
// window opens at 23:30 on the 2nd, so that is the evening Trelawney have to be
// in. The old expectation was written from the output, not from the confirmation
// the customer receives.
test('customer slots use UK local time when the server runs in UTC', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'UTC';

  try {
    const order = workOrders.find((workOrder) => workOrder.id === 'W-5006')!;
    assert.deepEqual(slotFor(order), {
      workOrderId: 'W-5006',
      window: '23:30 to 02:15',
      date: '2026-09-02',
    });
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  }
});

test('dispatch only plans queued work', () => {
  const plan = dispatch(workOrders.map((w) => ({ ...w, status: 'DONE' as const })));
  assert.equal(plan.length, 0);
});

test('dispatch matches the required skill', () => {
  const plan = dispatch(workOrders);
  const backflow = plan.find((a) => a.workOrderId === 'W-5003');
  assert.equal(backflow?.engineerId, 'E-02');
});

test('dispatch plans one visit for differently typed versions of an address', () => {
  const ashfieldOrders = workOrders.filter(
    (order) => order.id === 'W-5001' || order.id === 'W-5002',
  ).map((order) => order.id === 'W-5001'
    ? { ...order, address: '  14 Ashfield   Row, Bristol  ' }
    : order);

  assert.deepEqual(
    dispatch(ashfieldOrders).map((assignment) => ({
      workOrderId: assignment.workOrderId,
      address: assignment.address,
    })),
    [{ workOrderId: 'W-5001', address: '  14 Ashfield   Row, Bristol  ' }],
  );
});

test('one van when two jobs fall on the same UK day either side of midnight UTC', () => {
  const address = '14 Ashfield Row, Bristol';
  const plan = dispatch([
    { id: 'W-A1', customerId: 'C-1001', address, requires: 'METER', requestedAt: '2026-09-02T23:30:00Z', durationMinutes: 60, status: 'QUEUED' },
    { id: 'W-A2', customerId: 'C-1001', address, requires: 'LEAK', requestedAt: '2026-09-03T08:00:00Z', durationMinutes: 60, status: 'QUEUED' },
  ]);
  assert.deepEqual(plan.map((a) => a.workOrderId), ['W-A1'], 'both are 3 Sept in BST');
});

test('no second van to an address a van is already going to', () => {
  const address = '14 Ashfield Row, Bristol';
  const plan = dispatch([
    { id: 'W-B1', customerId: 'C-1001', address, requires: 'METER', requestedAt: '2026-09-02T08:00:00Z', durationMinutes: 60, status: 'DISPATCHED', engineerId: 'E-01' },
    { id: 'W-B2', customerId: 'C-1001', address: '14, ashfield row, bristol.', requires: 'LEAK', requestedAt: '2026-09-02T08:30:00Z', durationMinutes: 90, status: 'QUEUED' },
  ]);
  assert.deepEqual(plan, [], 'W-B1 is already on the road');
});
