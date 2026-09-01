# JOB C: customers want a statement, not four invoices

**Raised by:** Trelawney Foods, via account management (5 Aug)
**Queue age:** 23 days

Their finance team asked for "a statement like our other suppliers send" because
they are reconciling four separate invoice PDFs by hand every quarter.

We do not have anything like this. The front end team say they can render whatever
we give them as long as it comes off an endpoint.

Nobody has agreed what goes on it.

---

## Built, 1 Sep. Quarterly period and balances.

`GET /customers/:id/statement?from=YYYY-MM-DD&to=YYYY-MM-DD`. Both ends optional
and inclusive. With no period it behaves exactly as before, so nothing the front
end already calls changes.

What is on it: the customer, the invoices issued in the period with net, VAT and
total, a brought forward balance, invoiced and paid for the period, the carried
forward balance, and formatted values so the front end does not have to divide by
a hundred. That covers the actual complaint, which was reconciling four invoice
PDFs by hand every quarter.

Issue dates are compared as YYYY-MM-DD strings, deliberately. Parsing them into
Dates would drag the UTC and UK local problem in JOB D into billing, and an issue
date has no time of day to get wrong.

### Known limitation, worth raising with account management

**A statement for a past period is not reproducible.** `Invoice.paid` is a
boolean and there is nowhere to record when something was paid. So the brought
forward balance is worked out from what is unpaid *now*, not from what was unpaid
when the period opened. An invoice raised in Q1, still owed at the end of Q2 and
settled in Q3, will show as paid if you re-run the Q2 statement today, and the
brought forward figure will be too low.

For the quarter you are currently in this is right. For any historic quarter it
drifts, and it will not agree with a statement printed at the time.

Fixing it properly means replacing the `paid` boolean with payment records
carrying dates and amounts. That also unlocks partial payments and 30/60/90
ageing, which is the next thing a finance team normally asks for. Not done here
because it changes the data model, `outstandingFor()` and the seed data, and
nobody has asked for it yet.
