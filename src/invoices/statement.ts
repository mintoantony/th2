import type { Customer, Invoice, Payment } from '../db.ts';
import { format, sum, type Pence } from '../shared/money.ts';
import { balanceFor, isPaid, totalFor } from './calc.ts';

export interface StatementInvoice {
  id: string;
  issued: string;
  // Both are as at the end of the period, not as at today. Re-running last
  // quarter's statement has to show last quarter's position.
  paid: boolean;
  balance: Pence;
  net: Pence;
  vat: Pence;
  total: Pence;
}

// Inclusive at both ends. Null means open ended, which is what you get when the
// caller asks for no period at all.
export interface StatementPeriod {
  from: string | null;
  to: string | null;
}

export interface CustomerStatement {
  customer: Pick<Customer, 'id' | 'name' | 'address'>;
  period: StatementPeriod;
  invoices: StatementInvoice[];
  totals: {
    broughtForward: Pence;
    net: Pence;
    vat: Pence;
    invoiced: Pence;
    paid: Pence;
    outstanding: Pence;
  };
  display: {
    broughtForward: string;
    invoiced: string;
    paid: string;
    outstanding: string;
  };
}

export const ALL_TIME: StatementPeriod = { from: null, to: null };

// Issue dates and payment dates are both plain YYYY-MM-DD strings, and these are
// string comparisons on purpose. Parsing them into Dates would drag the UTC and
// UK local problem into billing, and neither has a time of day to get wrong.
function withinPeriod(date: string, period: StatementPeriod): boolean {
  if (period.from !== null && date < period.from) return false;
  if (period.to !== null && date > period.to) return false;
  return true;
}

export function statementFor(
  customer: Customer,
  allInvoices: Invoice[],
  allPayments: Payment[],
  period: StatementPeriod = ALL_TIME,
): CustomerStatement {
  const theirs = allInvoices.filter((invoice) => invoice.customerId === customer.id);
  const theirIds = new Set(theirs.map((invoice) => invoice.id));
  const theirPayments = allPayments.filter((payment) => theirIds.has(payment.invoiceId));

  // What was owed when the period opened: everything billed before it, less
  // everything received before it. Both halves are date bounded, which is what
  // makes a historic statement come out the same today as it did at the time.
  // The old version asked which invoices are unpaid *now*, so an invoice settled
  // after the period had already closed silently vanished from this figure.
  const broughtForward = period.from === null
    ? 0
    : sum(theirs.filter((invoice) => invoice.issued < period.from!).map((invoice) => totalFor(invoice).total))
      - sum(theirPayments.filter((payment) => payment.received < period.from!).map((payment) => payment.amountPence));

  const statementInvoices = theirs
    .filter((invoice) => withinPeriod(invoice.issued, period))
    .sort((a, b) => a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id))
    .map((invoice) => ({
      id: invoice.id,
      issued: invoice.issued,
      paid: isPaid(invoice, theirPayments, period.to),
      balance: balanceFor(invoice, theirPayments, period.to),
      ...totalFor(invoice),
    }));

  const invoiced = sum(statementInvoices.map((invoice) => invoice.total));
  // Money received during the period, whichever invoice it was against. A
  // payment settling an older invoice still belongs on this statement.
  const paid = sum(
    theirPayments
      .filter((payment) => withinPeriod(payment.received, period))
      .map((payment) => payment.amountPence),
  );
  const outstanding = broughtForward + invoiced - paid;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
    },
    period,
    invoices: statementInvoices,
    totals: {
      broughtForward,
      net: sum(statementInvoices.map((invoice) => invoice.net)),
      vat: sum(statementInvoices.map((invoice) => invoice.vat)),
      invoiced,
      paid,
      outstanding,
    },
    display: {
      broughtForward: format(broughtForward),
      invoiced: format(invoiced),
      paid: format(paid),
      outstanding: format(outstanding),
    },
  };
}
