# JOB B: two vans to the same house

**Raised by:** Support (Marcus, 21 Aug)
**Queue age:** 7 days

Mrs Whitcombe had two engineers turn up on the same morning, half an hour apart,
one for the meter and one for the leak. She was not happy and it is not the first
time. Marcus says it happens most weeks.

There is a check in the dispatcher that is supposed to stop this. Either it is not
running or it is not catching it.

The addresses in our system are typed in by whoever takes the call.

---

## Fixed, 1 Sep

Three causes, not one. The check was running; it just could not see most of it.

1. **`sameDay()` compared UTC dates.** "One visit per address per day" means the
   day the customer lives in. Between 23:00 and midnight UTC in summer, UK local
   is already tomorrow, so two jobs on the same UK day looked like different days
   and both went out. Now compares UK dates.
2. **The guard only saw what the current run had planned.** Orders already
   `DISPATCHED` were skipped before the guard ever looked at them, so a van
   already on its way to a house did not stop a second one being sent. This is
   the one that made it happen most weeks. Dispatch now counts work on the road.
3. **`canonicalAddress()` only handled case and spacing.** Any comma or full stop
   defeated it, and the addresses are typed by whoever takes the call.
   Punctuation is now stripped.

Abbreviations are deliberately still not matched. "Ashfield Rd" and "Ashfield
Row" may be two real streets, and merging them would cancel a real visit.

Worth knowing: cause 1 was also dropping work. W-5006, Trelawney's out of hours
backflow test, shares an address with W-5003 and sat on the same UTC day, so the
old check suppressed it. It never appeared in the plan at all. It does now.
