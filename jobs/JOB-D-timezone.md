# JOB D: a customer was given the wrong day

**Raised by:** Support (Marcus, 26 Aug)
**Queue age:** 2 days

Trelawney have a late backflow test booked and the confirmation we sent them has
the wrong date on it. Marcus checked the work order and the stored time is right,
so it is what we print that is wrong.

He says this is the same thing as W-4412, which has been closed twice as cannot
reproduce. Both reports came in the summer. Nobody has managed to make it happen
in the winter, and it has never once failed on the build box.

Everything the customer sees is UK local. Everything we store is UTC. Somewhere
those two are being treated as the same thing.

---

## Fixed, 1 Sep. Same root cause as W-4412.

`slotFor()` took `date` from the requested time but built `window` from the
padded start, an hour earlier. Those are the same UK date for most of the year.
They are not when the padding crosses midnight.

W-5006 is stored 2026-09-02T23:30Z. In BST that is 00:30 on the 3rd, so `date`
printed 2026-09-03, while the window opened at 23:30 on the 2nd. Trelawney were
told the 3rd for an appointment they had to be in for on the 2nd.

In GMT, 23:30 minus an hour is 22:30 the same day and nothing crosses midnight,
which is why it only ever came in over the summer. It never failed on the build
box because every date test used midday, and midday does not straddle anything.

The date is now taken from the start of the window, which is when the customer
has to be in. A window running past midnight belongs to the evening it started.

The existing test asserted the wrong date. It was written from the output rather
than from the confirmation the customer receives, which is how this stayed green
through two closures. Corrected, and the suite now passes under UTC,
Europe/London, America/New_York and Australia/Sydney.

### One more of the same, found while fixing this

`isWorkingDay()` had the identical fault and nobody had reported it, because
nothing in `src/` calls it yet. It read the weekend off the server clock with
`getDay()` and then looked the bank holiday up under a UTC key, so the two halves
were asking about different days:

- 2026-08-30T23:30Z is 31 August in London, the August bank holiday. It answered
  "working day" on a UK box.
- 2026-08-31T23:30Z is an ordinary Tuesday. It answered "bank holiday" everywhere.
- And it gave different answers on a UTC build box than on a UK one.

`addWorkingDays()` sat on top of that and stepped with `setDate()`, which is
server local time and so can lose or repeat a day across a clock change.

Both now work in UK calendar days. Fixed here rather than left for later because
it is the same mistake as this ticket, in the file the header comment already
warns about, and the next thing anyone builds on it will be payment due dates.
