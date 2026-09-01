import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Customer, Invoice } from '../src/db.ts';
import { statementFor } from '../src/invoices/statement.ts';

const customer: Customer = {
  id: 'C-2001',
  name: 'Test Customer',
  address: '1 Test Road',
  accountType: 'COMMERCIAL',
  vatRegistered: true,
};

function invoice(id: string, issued: string, paid: boolean, lines: Invoice['lines']): Invoice {
  return { id, customerId: customer.id, issued, source: 'WEB', paid, lines };
}

const supply = [{ description: 'Metered supply', quantity: 2, unitPence: 100, kind: 'SUPPLY' as const }];
const service = [{ description: 'Engineer visit', quantity: 1, unitPence: 100, kind: 'SERVICE' as const }];

test('statement orders invoices and separates paid from outstanding totals', () => {
  const ledger = [invoice('INV-2', '2026-07-01', false, service), invoice('INV-1', '2026-04-01', true, supply)];

  assert.deepEqual(statementFor(customer, ledger), {
    customer: { id: 'C-2001', name: 'Test Customer', address: '1 Test Road' },
    period: { from: null, to: null },
    invoices: [
      { id: 'INV-1', issued: '2026-04-01', paid: true, net: 200, vat: 0, total: 200 },
      { id: 'INV-2', issued: '2026-07-01', paid: false, net: 100, vat: 20, total: 120 },
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
  const ledger = [
    invoice('INV-0', '2026-01-01', false, supply),  // owed before the period opens
    invoice('INV-2', '2026-07-01', false, service), // raised inside it
  ];

  const statement = statementFor(customer, ledger, { from: '2026-05-01', to: '2026-09-30' });

  assert.deepEqual(statement.invoices.map((each) => each.id), ['INV-2'], 'only the period');
  assert.equal(statement.totals.broughtForward, 200);
  assert.equal(statement.totals.invoiced, 120);
  assert.equal(statement.totals.outstanding, 320, 'brought forward plus unpaid in period');
  assert.equal(statement.display.outstanding, '£3.20');
});
