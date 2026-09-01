import { percentOf, sum, type Pence } from '../shared/money.ts';
import type { Invoice, LineItem } from '../db.ts';

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

export function outstandingFor(customerId: string, all: Invoice[]): Pence {
  return sum(
    all.filter((i) => i.customerId === customerId && !i.paid).map((i) => totalFor(i).total),
  );
}
