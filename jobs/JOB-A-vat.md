# JOB A: VAT is missing from invoices

**Raised by:** Finance (Sandra, 12 Aug)
**Queue age:** 16 days

Sandra says the totals we send out do not have VAT on them and she has been adding
it by hand in a spreadsheet since the web front end went live. Accounts want it on
the invoice itself.

She also mentioned something about not all of it being vatable but I did not write
down what she said. Her email is in the shared mailbox somewhere.

Needs to show on the invoice and in the outstanding balance.

---

## Status, 1 Sep

VAT reaches the invoice and the outstanding balance. What is on the invoice now:
`net`, `vat`, `total`, a `vatBands` breakdown (net and VAT per rate, as a VAT
invoice has to show), and formatted `displayTotals`. `/customers/:id/invoices`
carries totals too, so VAT is visible in the list and not only on the detail.

**Still open: the vatable base is a guess.** The code standard rates engineer
work and zero rates all water supply. Nobody confirmed that with Sandra.

If the usual rule applies — water to a business in Divisions 1-5 of the 1980 SIC
is standard rated — then C-1002 Trelawney Foods, a food manufacturer, is wrong:
its supply and standing charge are being zero rated. That is about £456 a quarter
on INV-9002 (balance shows £2,484.00; it would be £2,940.00). C-1004 Severn Vale
Academy is also COMMERCIAL and, being a school, stays zero rated — so
`accountType` on its own cannot express the rule. `vatRegistered` is no help
either: that governs what the customer reclaims, not what we charge.

Needed from Sandra's email:

1. Which customers' supply is standard rated. Trelawney at 20%, the Academy at 0%?
2. Do standing charges follow the supply they attach to?
3. Is any engineer work not at 20%?
4. One worked example from her spreadsheet, to use as the fixture.

The rule is isolated in `vatRateFor()` in `src/invoices/calc.ts`. Change it there
and totals, bands, statements and balances all follow. It will need the customer
passed in, not just the line.
