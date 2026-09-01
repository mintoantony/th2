import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.ts';

let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('customer statement combines invoices and account totals', async () => {
  const response = await fetch(`${baseUrl}/customers/C-1002/statement`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    customer: {
      id: 'C-1002',
      name: 'Trelawney Foods Ltd',
      address: 'Unit 6, Severnside Park, Avonmouth',
    },
    invoices: [
      {
        id: 'INV-9002',
        issued: '2026-07-01',
        paid: false,
        net: 245000,
        vat: 3400,
        total: 248400,
      },
    ],
    period: { from: null, to: null },
    totals: {
      broughtForward: 0,
      net: 245000,
      vat: 3400,
      invoiced: 248400,
      paid: 0,
      outstanding: 248400,
    },
    display: {
      broughtForward: '£0.00',
      invoiced: '£2,484.00',
      paid: '£0.00',
      outstanding: '£2,484.00',
    },
  });
});

test('a statement can be asked for one quarter', async () => {
  const response = await fetch(`${baseUrl}/customers/C-1004/statement?from=2026-01-01&to=2026-03-31`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.period, { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(body.invoices, [], 'their only invoice was issued in April');
});

test('a statement rejects a period it cannot read', async () => {
  const response = await fetch(`${baseUrl}/customers/C-1002/statement?from=last%20April`);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'from must be a date in the form YYYY-MM-DD' });
});

test('customer statement reports an unknown customer', async () => {
  const response = await fetch(`${baseUrl}/customers/unknown/statement`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'no such customer' });
});

test('customer statement rejects non-GET requests', async () => {
  const response = await fetch(`${baseUrl}/customers/C-1002/statement`, {
    method: 'POST',
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(await response.json(), { error: 'method not allowed' });
});
