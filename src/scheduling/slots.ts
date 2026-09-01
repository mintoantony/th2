import { formatSlotDate, formatSlotTime } from '../shared/dates.ts';
import type { WorkOrder } from '../db.ts';

export interface Slot {
  workOrderId: string;
  // What we tell the customer. UK local time.
  window: string;
  date: string;
}

// W-4412, third report, JOB D. Root cause found: `date` was taken from the
// requested time while `window` was built from the padded start, and in BST
// those are different UK dates. A job stored at 23:30Z is 00:30 BST the next
// day, so we printed that next day beside a window opening at 23:30 on this
// one. In GMT the padding never crosses midnight, which is why it only ever
// came in over the summer and never once failed on the build box.
const WINDOW_PADDING_MINUTES = 60;

// The customer is given a window, not a time: the requested time, minus an hour,
// through the requested time plus the job length plus an hour.
export function slotFor(order: WorkOrder): Slot {
  const start = new Date(order.requestedAt);
  const from = new Date(start.getTime() - WINDOW_PADDING_MINUTES * 60_000);
  const to = new Date(
    start.getTime() + (order.durationMinutes + WINDOW_PADDING_MINUTES) * 60_000,
  );

  // The date has to be the one the window opens on, because that is when the
  // customer has to be in. A window that runs past midnight still belongs to
  // the evening it started.
  return {
    workOrderId: order.id,
    window: `${formatSlotTime(from)} to ${formatSlotTime(to)}`,
    date: formatSlotDate(from),
  };
}

export function slotsFor(orders: WorkOrder[]): Slot[] {
  return orders.map(slotFor);
}
