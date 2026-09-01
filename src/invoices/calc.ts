import { percentOf, sum, type Pence } from '../shared/money.ts';
import type { Invoice, LineItem, Payment } from '../db.ts';

export interface InvoiceTotal {
  net: Pence;
  vat: Pence;
  total: Pence;
}

export type VatRate = 0 | 20;

export interface VatBand {
  rate: VatRate;
  net: Pence;
  vat: Pence;
}

const STANDARD_VAT_PERCENT = 20;

export function lineTotal(line: LineItem): Pence {
  return line.quantity * line.unitPence;
}

// UNCONFIRMED. Finance hold the real rule; see jobs/JOB-A-vat.md. What is here
// is the guess made in 74eda1a: engineer work is standard rated, all water
// supply is zero rated. That is very likely wrong for at least one live account.
// Water supplied to a business in Divisions 1-5 of the 1980 SIC is standard
// rated, so C-1002 Trelawney Foods, a food manufacturer, is probably being
// under-charged on its supply lines. Deciding that needs the customer and not
// just the line, so expect this to take a second argument. The rule lives here
// and only here: change it and totals, bands, statements and balances follow.
export function vatRateFor(line: LineItem): VatRate {
  return line.kind === 'SERVICE' ? STANDARD_VAT_PERCENT : 0;
}

// Paper invoices carried a printing and postage charge that the web product
// never had. Kept so historic invoices still reconcile.
function legacySurcharge(invoice: Invoice): Pence {
  if (invoice.source === 'LEGACY_PAPER') {
    return 150;
  }
  return 0;
}

// A VAT invoice has to show the net and the VAT for every rate it charges at.
// Rounding happens once per band, not per line, so the printed bands always add
// up to the printed total. Ordered by rate, so zero rated prints first.
export function vatBandsFor(invoice: Invoice): VatBand[] {
  const netByRate = new Map<VatRate, Pence>();
  const add = (rate: VatRate, amount: Pence) =>
    netByRate.set(rate, (netByRate.get(rate) ?? 0) + amount);

  for (const line of invoice.lines) {
    add(vatRateFor(line), lineTotal(line));
  }

  // The surcharge has never been treated as vatable. Left in the zero band so
  // the bands still reconcile with the invoice net.
  const surcharge = legacySurcharge(invoice);
  if (surcharge > 0) {
    add(0, surcharge);
  }

  return [...netByRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, net]) => ({ rate, net, vat: percentOf(net, rate) }));
}

export function totalFor(invoice: Invoice): InvoiceTotal {
  const bands = vatBandsFor(invoice);
  const net = sum(bands.map((band) => band.net));
  const vat = sum(bands.map((band) => band.vat));
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
