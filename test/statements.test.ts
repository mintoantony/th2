import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Customer, Invoice, Payment } from '../src/db.ts';
import { statementFor } from '../src/invoices/statement.ts';

const customer: Customer = {
  id: 'C-2001',
  name: 'Test Customer',
  address: '1 Test Road',
  accountType: 'COMMERCIAL',
  vatRegistered: true,
};

function invoice(id: string, issued: string, lines: Invoice['lines']): Invoice {
  return { id, customerId: customer.id, issued, source: 'WEB', lines };
}

function payment(id: string, invoiceId: string, received: string, amountPence: number): Payment {
  return { id, invoiceId, received, amountPence };
}

const supply = [{ description: 'Metered supply', quantity: 2, unitPence: 100, kind: 'SUPPLY' as const }];
const service = [{ description: 'Engineer visit', quantity: 1, unitPence: 100, kind: 'SERVICE' as const }];

test('statement orders invoices and separates paid from outstanding totals', () => {
  const ledger = [invoice('INV-2', '2026-07-01', service), invoice('INV-1', '2026-04-01', supply)];
  const settled = [payment('PAY-1', 'INV-1', '2026-04-20', 200)];

  assert.deepEqual(statementFor(customer, ledger, settled), {
    customer: { id: 'C-2001', name: 'Test Customer', address: '1 Test Road' },
    period: { from: null, to: null },
    invoices: [
      { id: 'INV-1', issued: '2026-04-01', paid: true, balance: 0, net: 200, vat: 0, total: 200 },
      { id: 'INV-2', issued: '2026-07-01', paid: false, balance: 120, net: 100, vat: 20, total: 120 },
    ],
    totals: { broughtForward: 0, net: 300, vat: 20, invoiced: 320, paid: 200, outstanding: 120 },
    display: {
      broughtForward: '£0.00',
      invoiced: '£3.20',
      paid: '£2.00',
      outstanding: '£1.20',
    },
  });
});

test('a period brings forward what was owed before it and carries the rest out', () => {
  const ledger = [invoice('INV-0', '2026-01-01', supply), invoice('INV-2', '2026-07-01', service)];
  const statement = statementFor(customer, ledger, [], { from: '2026-05-01', to: '2026-09-30' });

  assert.deepEqual(statement.invoices.map((each) => each.id), ['INV-2'], 'only the period');
  assert.equal(statement.totals.broughtForward, 200);
  assert.equal(statement.totals.invoiced, 120);
  assert.equal(statement.totals.outstanding, 320, 'brought forward plus unpaid in period');
});

// This is the whole reason payments carry a date.
test('a historic statement does not change when a later payment arrives', () => {
  const q2 = { from: '2026-04-01', to: '2026-06-30' };
  const ledger = [invoice('INV-1', '2026-04-01', supply)];

  const atTheTime = statementFor(customer, ledger, [], q2);
  const settledInQ3 = statementFor(customer, ledger, [payment('PAY-1', 'INV-1', '2026-08-15', 200)], q2);

  assert.equal(atTheTime.totals.outstanding, 200);
  assert.equal(settledInQ3.totals.outstanding, 200, 'Q3 money must not rewrite Q2');
  assert.equal(settledInQ3.invoices[0].paid, false, 'it was not paid as at 30 June');

  // ...and it does show up in the quarter it actually landed in.
  const q3 = statementFor(customer, ledger, [payment('PAY-1', 'INV-1', '2026-08-15', 200)], { from: '2026-07-01', to: '2026-09-30' });
  assert.equal(q3.totals.broughtForward, 200);
  assert.equal(q3.totals.paid, 200);
  assert.equal(q3.totals.outstanding, 0);
});

test('a part payment leaves the rest owed', () => {
  const ledger = [invoice('INV-1', '2026-04-01', supply)];
  const statement = statementFor(customer, ledger, [payment('PAY-1', 'INV-1', '2026-04-20', 75)]);

  assert.equal(statement.invoices[0].paid, false);
  assert.equal(statement.invoices[0].balance, 125);
  assert.equal(statement.totals.outstanding, 125);
});
