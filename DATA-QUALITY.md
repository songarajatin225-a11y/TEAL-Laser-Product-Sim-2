# Value-store data quality

Audit of `data.json` — the catalogue, fitment, recommendation and pricing tables
the configurator runs on. Re-run at any time:

```
node tests/validate-data.mjs          # human-readable
node tests/validate-data.mjs --json   # for tooling
```

It exits non-zero on any CRITICAL or HIGH finding, so it can gate a commit or a
CI job. The checks mirror the configurator's own rules — `powersFor()` and
`modFits()` are reproduced exactly — so a finding means the configurator would
misbehave, not that a style rule was broken.

## Result — 2026-10-15

**22 platforms · 12 sources · 5 objectives · 26 modules · 4 extras · 27 rules**

| Severity | Count | Meaning |
|---|---|---|
| Critical | **0** | could produce a wrong configuration, price or technical representation |
| High | **0** | affects selection or compatibility, or omits needed information |
| Medium | 5 | reduces usability or content quality |
| Low | 0 | cosmetic |

Every cross-reference resolves: each platform's family, sources, objectives,
default source, default objective, default power, per-source power classes,
standard modules and industries exist; every application's material and
recommended source exist, and the recommended source and power are ones that
platform can actually fit; every fitment rule, recommendation rule and price is
well-formed. No standard module is excluded by its own fitment rule.

The catalogue embedded in `index.html` (used when the page is opened from disk)
was compared table by table against `data.json`: all 14 tables are identical, so
the hosted and local experiences show the same machines. The end-to-end suite
re-checks this on every run.

## Findings that need a TEAL decision

These are flagged, not changed. Each is an engineering or product decision, and
resolving it by guesswork would put an unverified claim into the catalogue.

| Severity | Record | Finding | Decision needed |
|---|---|---|---|
| Medium | `SRC.blue` | Catalogued but offered on no platform — it can never be selected | Which platform takes a blue diode source, or remove it |
| Medium | `SRC.femto` | Catalogued but offered on no platform | Which platform takes the femtosecond source, or remove it |
| Medium | `SRC.diode` | Catalogued but offered on no platform | Which platform takes the direct-diode source, or remove it |
| Medium | `MAT.sic` | Silicon carbide is in the material database but no application uses it | Add the SiC application it was intended for, or remove it |
| Medium | `SRC.co293` | Display name "Sealed RF CO₂" is identical to `SRC.co2`; only the wavelength differs | Confirm a distinguishing name, e.g. "Sealed RF CO₂ (9.3 µm)" |

## Documentation discrepancy

The README's opening paragraph describes the source catalogue as containing
"4 f-theta objectives, 25 automation modules". The data holds **5** objectives
(F100, F163, F230, F254, F420) and **26** modules. Either the 2026 catalogue has
4 and 25 and the data has gained one of each, or the README is stale. Neither has
been changed; confirm against the current catalogue revision.

## Commercial data

Every price in the value store — platform bases, module, software and extra
prices, source premiums and the five pricing levers — is classed **Estimate** in
the configurator's Data provenance tab: extrapolated from a single supplied anchor
(the CO₂ PCB dual-head at about ₹65.6 L ex-works), not TEAL procurement data. The
new commercial breakdown labels every priced line accordingly. Supplier names and
part numbers are not held in the value store, so the BOM has no columns for them
rather than columns of blanks.

One rule is hard-coded rather than held as data: the large-field objective uplift
applies to the key `f420` by name inside `priceLines()`. If objectives are renamed
or another large-field objective is added, that rule will not follow. Moving it to
a per-objective field in `LENS` would make it data.
