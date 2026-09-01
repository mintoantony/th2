import { createServer } from 'node:http';
import { customers, invoices, workOrders } from './db.ts';
import { totalFor, outstandingFor } from './invoices/calc.ts';
import { statementFor, ALL_TIME, type StatementPeriod } from './invoices/statement.ts';
import { dispatch } from './scheduling/dispatch.ts';
import { slotsFor } from './scheduling/slots.ts';
import { format } from './shared/money.ts';

const PORT = Number(process.env.PORT ?? 4310);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Statement periods are read straight off the query string as YYYY-MM-DD and
// compared as strings. Neither end is required; both are inclusive.
function readPeriod(url: URL): StatementPeriod | { error: string } {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value !== null && !ISO_DATE.test(value)) {
      return { error: `${name} must be a date in the form YYYY-MM-DD` };
    }
  }
  if (from !== null && to !== null && from > to) {
    return { error: 'from must not be after to' };
  }

  return from === null && to === null ? ALL_TIME : { from, to };
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

export const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length === 0) {
    return json(res, 200, {
      service: 'Thornbury Systems billing and scheduling',
      version: '3.11.2',
      routes: [
        'GET /customers',
        'GET /customers/:id',
        'GET /customers/:id/invoices',
        'GET /customers/:id/statement',
        'GET /invoices/:id',
        'GET /work-orders',
        'GET /dispatch',
        'GET /slots',
      ],
    });
  }

  if (parts[0] === 'customers' && parts.length === 1) {
    return json(res, 200, customers);
  }

  if (parts[0] === 'customers' && parts.length === 2) {
    const customer = customers.find((c) => c.id === parts[1]);
    if (!customer) return json(res, 404, { error: 'no such customer' });
    return json(res, 200, {
      ...customer,
      outstanding: format(outstandingFor(customer.id, invoices)),
    });
  }

  if (parts[0] === 'customers' && parts.length === 3 && parts[2] === 'invoices') {
    return json(res, 200, invoices.filter((i) => i.customerId === parts[1]));
  }

  if (parts[0] === 'customers' && parts.length === 3 && parts[2] === 'statement') {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET');
      return json(res, 405, { error: 'method not allowed' });
    }
    const customer = customers.find((candidate) => candidate.id === parts[1]);
    if (!customer) return json(res, 404, { error: 'no such customer' });
    const period = readPeriod(url);
    if ('error' in period) return json(res, 400, period);
    return json(res, 200, statementFor(customer, invoices, period));
  }

  if (parts[0] === 'invoices' && parts.length === 2) {
    const invoice = invoices.find((i) => i.id === parts[1]);
    if (!invoice) return json(res, 404, { error: 'no such invoice' });
    const totals = totalFor(invoice);
    return json(res, 200, { ...invoice, ...totals, display: format(totals.total) });
  }

  if (parts[0] === 'work-orders') {
    return json(res, 200, workOrders);
  }

  if (parts[0] === 'dispatch') {
    return json(res, 200, dispatch(workOrders));
  }

  if (parts[0] === 'slots') {
    return json(res, 200, slotsFor(workOrders));
  }

  return json(res, 404, { error: 'no such route', path: url.pathname });
});

if (process.argv[1]?.endsWith('server.ts')) {
  server.listen(PORT, () => {
    console.log(`Thornbury Systems listening on http://localhost:${PORT}`);
  });
}
