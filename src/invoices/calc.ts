import { percentOf, sum, type Pence } from '../shared/money.ts';
import type { Invoice, LineItem, Payment } from '../db.ts';

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

// Everything below takes an optional `asAt`, a YYYY-MM-DD UK date, and ignores
// money that arrived after it. That is the whole point of holding payments with
// dates: asking what was owed at the end of a past quarter has to give the same
// answer today as it did then. Leave it out and you get the position now.
function receivedBy(payment: Payment, asAt: string | null): boolean {
  return asAt === null || payment.received <= asAt;
}

export function paidFor(
  invoiceId: string,
  payments: Payment[],
  asAt: string | null = null,
): Pence {
  return sum(
    payments
      .filter((payment) => payment.invoiceId === invoiceId && receivedBy(payment, asAt))
      .map((payment) => payment.amountPence),
  );
}

// What is still owed on one invoice. Can go negative if a customer overpays,
// which is left as-is rather than clamped: an overpayment is a real thing and
// hiding it would only move the discrepancy somewhere harder to find.
export function balanceFor(
  invoice: Invoice,
  payments: Payment[],
  asAt: string | null = null,
): Pence {
  return totalFor(invoice).total - paidFor(invoice.id, payments, asAt);
}

// Settled, not merely paid something towards.
export function isPaid(
  invoice: Invoice,
  payments: Payment[],
  asAt: string | null = null,
): boolean {
  return balanceFor(invoice, payments, asAt) <= 0;
}

export function outstandingFor(
  customerId: string,
  all: Invoice[],
  payments: Payment[],
  asAt: string | null = null,
): Pence {
  const theirs = all.filter((invoice) => invoice.customerId === customerId);
  const billed = asAt === null ? theirs : theirs.filter((invoice) => invoice.issued <= asAt);
  return sum(billed.map((invoice) => balanceFor(invoice, payments, asAt)));
}
