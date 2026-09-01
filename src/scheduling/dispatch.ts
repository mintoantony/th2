import { engineers, type Engineer, type WorkOrder } from '../db.ts';
import { sameDay } from '../shared/dates.ts';

export interface Assignment {
  workOrderId: string;
  engineerId: string;
  address: string;
  startsAt: string;
}

function canDo(engineer: Engineer, order: WorkOrder): boolean {
  return engineer.skills.includes(order.requires);
}

// Addresses are typed in by whoever takes the call, so punctuation is noise.
// Abbreviations are deliberately left alone: Rd and Row are not the same street
// and guessing they are would merge two real visits into one.
function canonicalAddress(address: string): string {
  return address.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

// One visit per address per day. Sending two vans to the same house on the same
// morning is the single biggest source of complaints on the support queue.
function alreadyVisiting(address: string, when: Date, planned: Assignment[]): boolean {
  return planned.some(
    (a) => canonicalAddress(a.address) === canonicalAddress(address)
      && sameDay(new Date(a.startsAt), when),
  );
}

export function dispatch(orders: WorkOrder[]): Assignment[] {
  // Work that is already on a van still occupies that address for the day. It
  // was being skipped before the guard ever saw it, which is how a second van
  // got sent to a house we were already visiting.
  const onTheRoad: Assignment[] = orders
    .filter((order) => order.status === 'DISPATCHED')
    .map((order) => ({
      workOrderId: order.id,
      engineerId: order.engineerId ?? '',
      address: order.address,
      startsAt: order.requestedAt,
    }));

  const planned: Assignment[] = [];

  for (const order of orders) {
    if (order.status !== 'QUEUED') continue;
    const when = new Date(order.requestedAt);

    if (alreadyVisiting(order.address, when, [...onTheRoad, ...planned])) continue;

    const engineer = engineers.find((e) => canDo(e, order));
    if (!engineer) continue;

    planned.push({
      workOrderId: order.id,
      engineerId: engineer.id,
      address: order.address,
      startsAt: order.requestedAt,
    });
  }

  return planned;
}
