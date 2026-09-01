import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, lineTotal, outstandingFor, vatRateFor, vatBandsFor } from '../src/invoices/calc.ts';
import { invoices, payments, type Invoice } from '../src/db.ts';
import { sum } from '../src/shared/money.ts';

test('line totals multiply quantity by unit price', () => {
  assert.equal(lineTotal({ description: 'x', quantity: 41, unitPence: 218, kind: 'SUPPLY' }), 8938);
});

test('invoice totals are calculated for every invoice', () => {
  for (const invoice of invoices) {
    totalFor(invoice);
  }
});

test('outstanding balance ignores paid invoices', () => {
  const owed = outstandingFor('C-1001', invoices, payments);
  assert.equal(owed, 0);
});

test('commercial invoice totals', () => {
  const invoice = invoices.find((i) => i.id === 'INV-9002')!;
  assert.deepEqual(totalFor(invoice), {
    net: 245000,
    vat: 3400,
    total: 248400,
  });
});

test('outstanding balance includes VAT', () => {
  assert.equal(outstandingFor('C-1002', invoices, payments), 248400);
});

// Payments carry dates so the past stays the past. Trelawney's Q2 bill is not
// settled, and asking what they owed in July must not be answered with today.
test('outstanding can be asked as at a past date', () => {
  assert.equal(outstandingFor('C-1001', invoices, payments, '2026-07-15'), 11338, 'not yet paid on 15 July');
  assert.equal(outstandingFor('C-1001', invoices, payments, '2026-07-28'), 0, 'the money landed on the 28th');
});

test('legacy paper invoices carry the postage surcharge', () => {
  const paper: Invoice = {
    id: 'INV-0001',
    customerId: 'C-1001',
    issued: '2018-03-01',
    source: 'LEGACY_PAPER',
    lines: [{ description: 'Metered supply', quantity: 10, unitPence: 100, kind: 'SUPPLY' }],
  };
  assert.equal(totalFor(paper).total, 1150);
});

// JOB A: the vatable base is still a guess. This pins what the code does today
// so the diff is visible when Sandra's rule arrives. Not an endorsement of it.
test('PROVISIONAL: engineer work is standard rated, water supply is not', () => {
  assert.equal(vatRateFor({ description: 'Call out', quantity: 1, unitPence: 100, kind: 'SERVICE' }), 20);
  assert.equal(vatRateFor({ description: 'Supply', quantity: 1, unitPence: 100, kind: 'SUPPLY' }), 0);
});

test('vat bands split an invoice by rate and reconcile with its totals', () => {
  const invoice = invoices.find((i) => i.id === 'INV-9003')!;
  assert.deepEqual(vatBandsFor(invoice), [
    { rate: 0, net: 9594, vat: 0 },
    { rate: 20, net: 14000, vat: 2800 },
  ]);
  for (const each of invoices) {
    const bands = vatBandsFor(each);
    assert.equal(sum(bands.map((b) => b.net)), totalFor(each).net, `${each.id} net`);
    assert.equal(sum(bands.map((b) => b.vat)), totalFor(each).vat, `${each.id} vat`);
  }
});
