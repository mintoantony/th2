import type { Customer, Invoice } from '../db.ts';
import { format, sum, type Pence } from '../shared/money.ts';
import { totalFor } from './calc.ts';

export interface StatementInvoice {
  id: string;
  issued: string;
  paid: boolean;
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

// `issued` is a plain YYYY-MM-DD string and these comparisons are string
// comparisons on purpose. Parsing them into Dates would drag the UTC and UK
// local problem into billing, and an issue date has no time of day to get wrong.
function issuedWithin(issued: string, period: StatementPeriod): boolean {
  if (period.from !== null && issued < period.from) return false;
  if (period.to !== null && issued > period.to) return false;
  return true;
}

export function statementFor(
  customer: Customer,
  allInvoices: Invoice[],
  period: StatementPeriod = ALL_TIME,
): CustomerStatement {
  const theirs = allInvoices.filter((invoice) => invoice.customerId === customer.id);

  // What they still owed when the period opened. With no `from` there is no
  // earlier history to bring forward.
  const broughtForward = period.from === null
    ? 0
    : sum(
      theirs
        .filter((invoice) => invoice.issued < period.from! && !invoice.paid)
        .map((invoice) => totalFor(invoice).total),
    );

  const statementInvoices = theirs
    .filter((invoice) => issuedWithin(invoice.issued, period))
    .sort((a, b) => a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id))
    .map((invoice) => ({
      id: invoice.id,
      issued: invoice.issued,
      paid: invoice.paid,
      ...totalFor(invoice),
    }));

  const invoiced = sum(statementInvoices.map((invoice) => invoice.total));
  const paid = sum(
    statementInvoices.filter((invoice) => invoice.paid).map((invoice) => invoice.total),
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
