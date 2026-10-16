# Internal workspace — data contract

The Internal view is a demonstration. It keeps its records in one browser
(`localStorage["teal.ws"]`). This document describes those records as the contract a
real internal service would serve, so that the screens can move onto that service
without being redesigned.

[`SECURITY.md`](../SECURITY.md) sets out what the service must enforce: sign-in,
server-side roles, protected storage and an audit trail held by the server.

Everything here is the shape the page reads and writes today, taken from
`index.html`. Field names are the page's own.

## Sources of truth

| Data | Owner today | Owner in production |
|---|---|---|
| Catalogue: families, platforms, sources, objectives, modules, materials, applications, fitment, pricing rules | `data.json`, a reviewed commit to this repository | Product-data service. `data.json` stays the public, approved subset |
| Configuration and its revisions | The visitor's browser (`teal.cfg`, `teal.saved`) | Configuration service, when a configuration is shared with TEAL |
| Product lifecycle, costs, suppliers, trials, releases, enquiries, cost baseline, audit | The visitor's browser (`teal.ws`) | Internal service, behind sign-in |
| Component identities, CAD status | `assets/cad/manifest.json` | Engineering BOM / PLM |

## Common rules

- **Timestamps** (`ts`, `updated`, `created`) are milliseconds since the Unix epoch.
- **Money** is in Indian rupees (`cur: "INR"`), as a number per machine. A cost with no
  value is `null`, never `0`.
- **Roles** are the keys of `ROLES`: `sales`, `appeng`, `design`, `pm`, `procurement`,
  `finance`, `management`, `admin`. The page stores the role that made a change. The
  service must take it from the signed-in user, not from the request.
- **Demonstration records** carry `demo: true`. They are created only by Settings →
  Load demonstration records, and removed together. A service must never persist one.
- **Import:** an imported file is reduced to this shape before use. Records that are
  not objects are dropped, and photographs that are not image data URLs are dropped.
  Every value is shown as text.

## Configuration

| Field | Type | Notes |
|---|---|---|
| `id` | `TC-` + 6 hex digits | Assigned when the platform is first chosen. Random, not sequential |
| `rev` | integer ≥ 1 | Every change makes a new revision. Undo moves between revisions; a change after an undo drops the redo branch |
| `from` | `"TC-xxxxxx rN"` or null | Set when the configuration was copied from someone else's link |
| `hist` | `[{rev, ts, snap}]` | Latest 60 revisions |
| `snap` | JSON string | `{plat, app, src, pw, lens, mods:{key:true}, sw, extra:{key:true}, notes, target}`. Keys refer to the catalogue |
| fingerprint | 8 hex digits | 32-bit FNV-1a hash of `snap`. The same selection always gives the same fingerprint. It is computed, not stored |

The share link carries the selection, plus `id` and `r`. A link whose `id` is not
`TC-` followed by six hex digits is ignored.

## Workspace records (`teal.ws`)

```
{ v: 1,
  products:  { <platformKey>: Product },
  costs:     { <componentId> | "cat:<category>": Cost },
  suppliers: { <componentId>: [Supplier] },
  trials:    [Trial],
  releases:  { <configurationId>: Release },
  enquiries: [Enquiry],
  baseline:  Baseline | null,
  audit:     [AuditEntry] }          // newest first, latest 400
```

### Product (lifecycle record per platform)

| Field | Type | Notes |
|---|---|---|
| `status` | `Concept` · `Prototype` · `Application Validation` · `Pilot` · `Released` · `Deprecated` · `""` | `""` means not recorded |
| `owner` | text | Product owner |
| `rev` | text | Product revision, e.g. `B.2` |
| `actions` | text | Outstanding actions, one per line |
| `updated` | timestamp | |

### Cost

Keyed by component ID, as drawn in the 3D model and listed in the manifest, or by
`cat:<category>` for costs held per category: assembly, integration, testing,
packaging, other.

| Field | Type | Notes |
|---|---|---|
| `unit` | number ≥ 0 or null | INR per machine |
| `cur` | `"INR"` | |
| `src` | text | **Required when `unit` is set.** Quotation reference and date. A cost without a source cannot be reviewed |
| `supplier`, `origin`, `lead` | text | Lead time in weeks |
| `sourcing` | `Not sourced` · `RFQ issued` · `Quoted` · `Approved` · `Single source` · `Obsolete risk` · `""` | |
| `cat` | `purchased` · `fab` · `elec` · `asm` · `integ` · `test` · `pack` · `other` | Defaults from the component's group |
| `updated` | timestamp | |

Derived figures, not stored:
- **Completeness:** priced lines out of all lines, per category.
- **Total.**
- **Gross margin:** `(price − cost) / price`. Shown only when every line is priced.
- **Variance** to the baseline.

In production the server computes margin and returns it only to roles allowed to see
it.

### Supplier

| Field | Type | Notes |
|---|---|---|
| `name` | text | Required |
| `pn` | text | Manufacturer part number |
| `lead` | text | Weeks |
| `status` | `Candidate` · `Qualified` · `Approved` · `Rejected` | `Approved` only by a role that may approve substitutions |
| `doc` | `https://` URL or `""` | Other schemes are refused |
| `alt` | boolean | Approved alternative to the primary part |
| `ts`, `by` | timestamp, role | |

A substitution is never inferred from a matching category. It needs an approved
supplier record.

### Trial

| Field | Type | Notes |
|---|---|---|
| `id` | text | `TRQ-…` when it came from a customer trial request |
| `plat`, `app` | catalogue keys | `appName` is a copy of the application's name |
| `ref`, `material`, `thick`, `geom`, `req`, `params`, `recipe`, `owner`, `date` | text | `material` is required |
| `inspect`, `accept`, `achieved`, `issues` | text | Inspection method and results, acceptance criteria, achieved result, open issues |
| `status` | `Requested` · `Planned` · `In progress` · `Tested` · `Approved` · `Rejected` | Approval needs a role that may approve trials, plus `inspect`, `accept` and `achieved` |
| `approvedBy` | role | |
| `photos` | up to 3 `data:image/jpeg;base64,…` | Reduced to at most 480 px. A service would store files and hold references |
| `cfg`, `srcName`, `optics` | text | The configuration the trial was requested against |
| `created`, `updated` | timestamp | |

### Release (per configuration)

| Field | Type | Notes |
|---|---|---|
| `state` | `Draft` · `In Review` · `Approved` · `Released` · `Deprecated` | |
| `owner`, `reviewer` | text | |
| `released` | `{rev, snap, ts}` or absent | The frozen released revision. Later edits make new working revisions and never change this |
| `log` | `[{ts, rev, from, to, owner, reviewer, role, note}]` | Newest first |

Transitions:

| From | To |
|---|---|
| Draft | In Review |
| In Review | Approved, Draft |
| Approved | Released, Draft |
| Released | Deprecated |

Each transition has conditions:
- **In Review** needs an owner.
- **Approved** and **Released** need a reviewer. For Approved, the reviewer must not
  be the owner.
- Any transition except a return to Draft needs a change description.
- Approved, Released and Deprecated need a role that may approve.

The service must enforce all of these. The page checks them only on screen.

### Enquiry

| Field | Type | Notes |
|---|---|---|
| `id` | `EQ-…` (quotation) or `TRQ-…` (trial) | |
| `type` | `quote` · `trial` | |
| `org`, `name`, `email` | text | Required by the request form |
| `country`, `phone` | text | |
| `cfg`, `hash`, `desig` | text | Configuration reference, fingerprint, designation |
| `app`, `process`, `qty`, `when`, `target`, `budget` | text | Quotation fields |
| `material`, `thick`, `shape`, `result`, `inspection`, `samples` | text | Trial fields |
| `message`, `attachments` | text | Attachment **names** only. The files are never read |
| `status` | `New` · `Technical Review` · `Application Trial` · `Quotation Preparation` · `Submitted` · `Won` · `Lost` · `On Hold` | |
| `owner`, `next`, `quote` | text | Owner, next action, quotation reference |
| `note` | text | `Prepared in this browser — not sent by the site` |
| `ts`, `updated` | timestamp | |

The record is personal data. It falls under the retention and access rules in
`SECURITY.md`.

### Baseline and audit

- `baseline`: `{total, ts, ref}`. The approved cost total, when it was set, and the
  configuration revision it was set against. Set only by a role that may approve.
- `audit[]`: `{ts, role, action, rec, detail}`. In production the server writes it,
  append-only, with the before and after values. The page's copy can be edited by
  whoever holds the browser, and is not evidence of anything.

## Service interface (proposed)

The adapter in `index.html` is three functions:
- `wsData()` — read
- `wsSave()` — persist
- `wsAudit()` — append an audit entry

A service replaces them with calls like the ones below. The screens render
synchronously today, so moving them onto a service means fetching before render. The
records themselves stay the same.

| Call | Who | Notes |
|---|---|---|
| `GET /catalogue` | Public | The approved `data.json` |
| `POST /enquiries` | Public, rate-limited, with spam protection | Returns `201` and the enquiry ID. **Only then** may the page say the request was sent. Attachments are uploaded to scanned storage |
| `GET/PUT /products/{platform}` | Internal | |
| `GET/PUT /costs/{component}` | Roles with `cost` / `editCost` | Margin fields are returned only to roles with `margin` |
| `GET/POST/PATCH /components/{component}/suppliers` | Internal; `Approved` needs `approveSub` | |
| `GET/POST/PATCH /trials`, `POST /trials/{id}/approve` | Internal; approve needs `approveTrial` | |
| `GET /releases/{configuration}`, `POST /releases/{configuration}/transitions` | Internal; the server checks the transition rules above | |
| `GET/PATCH /enquiries` | Roles that see Customer Enquiries: Sales, Application Engineer, Product Manager, Management, Administrator | |
| `GET /audit` | Administrator | Read-only. The server writes it |
