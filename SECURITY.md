# Security

## What this site is

The configurator is a static site: `index.html`, `data.json`, `access.json` and the
files under `assets/`, served by GitHub Pages. Everything in the repository and
everything the page loads is **public**: anyone who knows the address of a file can
download it, including the JavaScript and the data. The site has:
- no server
- no user accounts
- no API
- no secret: the passkey check ships salted verifiers, never a passkey

Its only outbound request is Google Fonts.

## Access passkeys: what they do, and what they cannot

Since v16.0 the page opens with a passkey form. There are two passkeys.

| Passkey | Opens | Internal switch in the header |
|---|---|---|
| Customer | The Customer view | Not shown |
| Internal | The Customer and Internal views, and the value store | Shown |

- Without a passkey the page shows only the form. Nothing else is visible.
- A customer session never sees the Internal option. Staff reach it from
  **Staff access** in the footer's fine print, which asks for the internal passkey.
- **Lock**, beside it, ends the session.
- A session lasts for the browser tab. *Remember on this device* keeps it until Lock.
- Five wrong passkeys in a row make the form wait 30 seconds.

**How it is built.** No passkey is stored anywhere. For each one the site holds a
random salt and a verifier: SHA-256 of the key that PBKDF2-HMAC-SHA256 (210,000
iterations) derives from the passkey. The page derives the same key from what is
typed and compares. A session keeps that derived key, not the passkey, so writing a
"signed in" flag into browser storage opens nothing. The verifiers are in
`access.json` and, identically, in the block of `index.html` marked `ACCESS`.

**What it cannot do.** This keeps casual visitors out. It is **not a security
boundary**, and nothing confidential may be put behind it:

- The files are public. `data.json` can be downloaded by its address without any
  passkey. The form covers the page; it does not protect the data.
- The check runs in the visitor's browser. Someone who edits the page there, with the
  browser's developer tools, can skip it.
- The verifiers are public, so a short or guessable passkey can be found by trying
  candidates offline. Use long random passkeys. The tool refuses anything under ten
  characters.
- A shared passkey does not identify anyone. Everyone with the customer passkey is the
  same visitor. One person's access cannot be withdrawn without changing the passkey
  for all.
- The 30-second wait applies to one browser tab. It slows a person, not a program.

Real access control needs a server that checks the user before it sends anything. See
[What a real internal workspace needs](#what-a-real-internal-workspace-needs).

**Changing the passkeys.** Run one of these, then commit `access.json` and
`index.html`:

```
node tools/access/set-passkeys.mjs --customer "<new key>" --internal "<new key>"
node tools/access/set-passkeys.mjs --generate        # two random keys, printed once
node tools/access/set-passkeys.mjs --check "<key>"   # which view a key opens
```

Changing a passkey ends every session opened with the old one. Give passkeys to
people directly. Never put one in the repository, an issue or a pull request.

## The Internal view is a demonstration

The Internal view holds nothing that needs protecting. It is a **demonstration
workspace**:
- It works on the public catalogue, and on records typed into the visitor's own browser.
- Its role selector previews what each role would see. It does not grant anything.
- A banner on every Internal screen says so, and says the passkey is not a security
  control.

v15.0 removed the old admin PIN. It was `teal2026`, shipped in plain text in
`data.json`, so anyone could read it. The passkeys of v16.0 differ in one respect: the
passkey itself is not in the files. The limits above still apply.

## What the public build contains, and must never contain

**Contains:**
- the catalogue (*TEAL Laser Automation Solutions — Product Catalogue, 2026
  Edition*), as `data.json`
- budget prices. Every one is classed *Estimate*, extrapolated from a single supplied
  anchor price. They are not procurement data. If TEAL considers any customer-facing
  budget figure confidential, remove it from `data.json` before publishing
- parametric 3D geometry, and the CAD manifest of publicly listed candidate sources

**Must never contain**, in `data.json`, in `index.html`, in any file under
`assets/`, or in the repository's history:
- supplier costs or quotations, labour rates, margins
- unreleased designs or drawings, restricted CAD
- customer records or enquiries
- passwords, API keys, tokens or any other credential

`assets/cad/restricted/` is git-ignored for CAD that cannot be redistributed.

The end-to-end suite checks that the old PIN and its prompt are gone from the page
and the data, and that the access block holds only salts and verifiers. It cannot
check for confidential numbers, because it cannot tell them from estimates. That is a
review step before every `data.json` commit.

The suite never uses the real passkeys. Its own server answers `access.json` with
verifiers for two throw-away keys.

## What is kept in the browser

All of it stays in the visitor's browser, unencrypted. None of it is sent anywhere.
Everything is in `localStorage` except the access session, which is in
`sessionStorage` unless *Remember on this device* was ticked.

| Key | Holds |
|---|---|
| `teal.cfg` | The working configuration's ID, revisions (latest 60) and autosave time |
| `teal.saved`, `teal.hist` | Saved configurations and the History list |
| `teal.ws` | Internal workspace records: product lifecycle, costs, suppliers, trials, enquiries, releases, the cost baseline and the audit log (latest 400 entries) |
| `teal.draft` | A recoverable draft of value-store edits |
| `teal.theme`, `teal.view`, `teal.lite`, `teal.eng` | Theme, view and role preview, lite rendering, engineering mode |
| `teal.missions`, `teal.seenAdvisor` | Mission scores; whether the advisor has been offered |
| `teal.access` | The access session: which view it opens, and the key derived from the passkey. Not the passkey |
| `teal.gatewait` | When the passkey form may be tried again after five wrong attempts |

What this means in practice:
- Anyone with access to that browser profile can read these records.
- Do not type confidential supplier prices or customer data into the Internal view on
  a shared or public computer. The cost editor says so where it asks for them.
- **Settings & Audit → Clear** deletes the workspace records. Clearing the site's data
  in the browser deletes all of it.

## Customer requests

A quotation or trial request is **not submitted** by the site, because there is
nothing to submit it to. It becomes one of:
- an email draft in the visitor's own mail app
- a CSV row
- text to copy

The form says so before and after. A copy is kept in the visitor's own browser.

No enquiry address is configured in this build. If one is added (`CONTACT.email` in
`index.html`), it will be public.

Attachments are listed by file name only. The files are never read or uploaded.

## Untrusted input

Workspace records can come from someone else, through an imported workspace file.
So the workspace escapes every record value before writing it into the page.

The end-to-end suite checks this. It injects markup into every field of every record
type, then renders all ten workspace screens and opens the detail and edit views of
the affected rows. The check fails if anything runs or any element is created.

Catalogue values come from `data.json`, which is committed to the repository and
treated as reviewed content. A `data.json` received from someone else is opened in
the value store for review, and should be read like code before it is committed.

## What a real internal workspace needs

The screens read and write through one adapter (`WSDB` in `index.html`), so they can
move onto a service without being rewritten. The service, not the page, must provide
all of the following. [`docs/INTERNAL-DATA.md`](docs/INTERNAL-DATA.md) gives the data
contract.

1. **A separate, authenticated deployment.** Serve the internal application from a
   host that requires sign-in before any page or script is served. Use the company's
   identity provider (OIDC or SAML single sign-on, with multi-factor authentication).
   Do not add internal data to this public site behind the passkey form or any other
   client-side check: anything shipped to the browser is readable.
2. **Authorisation on the server.** Check every API call against the user's role,
   using least privilege. The role preview's permission matrix (Settings & Audit) is a
   starting point:

   | Role | Sees costs | Sees margins | Edits costs | Approves |
   |---|---|---|---|---|
   | Sales | — | — | — | — |
   | Application Engineer | — | — | — | Trials |
   | Design Engineer | — | — | — | Substitutions |
   | Product Manager | Yes | Yes | — | Releases |
   | Procurement | Yes | — | Yes | — |
   | Finance | Yes | Yes | Yes | — |
   | Management | Yes | Yes | — | — |
   | Administrator | Yes | Yes | Yes | Releases, trials, substitutions |

   Hide cost and margin fields **in the API response**, not just on screen.
   Separation of duties must be enforced on the server: a reviewer must not be the
   owner. Today the page checks this only on screen.
3. **Protected storage.** Encrypt data at rest. Back it up. Set retention rules for
   customer contact data under the applicable data-protection law. For India, that is
   the Digital Personal Data Protection Act, 2023.
4. **An append-only audit trail held by the server.** Record who, when, what, and the
   values before and after. The browser's audit log is a local convenience and can be
   edited by whoever holds the browser.
5. **Secrets management.** Keep CRM, email and storage credentials in the server's
   secret store, never in the page or the repository.
6. **Real submission.** An enquiry is shown as submitted only after the CRM or mail
   service has confirmed it. Attachments are uploaded to scanned storage, with type
   and size limits.
7. **Transport and browser hardening.** Use HTTPS only, with a Content Security
   Policy. Use CSRF protection on state-changing calls, and session cookies marked
   `Secure`, `HttpOnly` and `SameSite`.

## Reporting a problem

If you find confidential data in this repository, or a way to make the page run code
it was not written to run, contact the repository owner privately rather than opening
a public issue.
