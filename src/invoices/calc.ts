import { percentOf, sum, type Pence } from '../shared/money.ts';
import type { Invoice, LineItem } from '../db.ts';

export interface InvoiceTotal {
  net: Pence;
  vat: Pence;
  total: Pence;
}

const STANDARD_VAT_PERCENT = 20;

export function lineTotal(line: LineItem): Pence {
  return line.quantity * line.unitPence;
}

// Paper invoices carried a printing and postage charge that the web product
// never had. Kept so historic invoices still reconcile.
function legacySurcharge(invoice: Invoice): Pence {
  if (invoice.source === 'LEGACY_PAPER') {
    return 150;
  }
  return 0;
}

export function totalFor(invoice: Invoice): InvoiceTotal {
  const net = sum(invoice.lines.map(lineTotal)) + legacySurcharge(invoice);
  const vatable = sum(
    invoice.lines.filter((line) => line.kind === 'SERVICE').map(lineTotal),
  );
  const vat = percentOf(vatable, STANDARD_VAT_PERCENT);
  return { net, vat, total: net + vat };
}

export function outstandingFor(customerId: string, all: Invoice[]): Pence {
  return sum(
    all.filter((i) => i.customerId === customerId && !i.paid).map((i) => totalFor(i).total),
  );
}
