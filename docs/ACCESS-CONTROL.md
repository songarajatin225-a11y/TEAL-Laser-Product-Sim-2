# Real access control for the configurator

The passkey form keeps casual visitors out. It cannot protect data, because the site
is public files: `data.json` can be downloaded by its address. See
[`SECURITY.md`](../SECURITY.md).

If prices, internal records or the site itself must be private, put the site behind a
host that checks the visitor **before** it sends any file. No change to the
configurator is needed for any option below. Per-customer access with expiry also
needs one of them, because only a server can tell visitors apart.

## Options

| Option | Who signs in | Per-person access and expiry | Effort |
|---|---|---|---|
| Cloudflare Access in front of the site | Company accounts (Microsoft, Google) or one-time email codes for customers | Yes: allow lists by email or domain, session length, instant removal | About an hour. Needs a domain on Cloudflare |
| Azure Static Web Apps | Microsoft Entra ID accounts; invited guests | Yes, by role and invitation | A few hours |
| GitHub Pages on a private repository | GitHub accounts with access to the repository | Only GitHub users; no customers | Needs GitHub Enterprise Cloud |
| Netlify or Vercel password protection | One shared password | No | Minutes. Needs a paid plan |

## Recommended: Cloudflare Access

1. Serve the site from your own hostname, for example `configurator.example.com`,
   with the DNS on Cloudflare. GitHub Pages can stay the origin.
2. In Cloudflare Zero Trust, add a **self-hosted application** for that hostname.
3. Add a policy for staff: allow your company's email domain through your identity
   provider.
4. Add a policy for customers: allow named email addresses, with **one-time PIN**
   sign-in. Each customer gets a code by email; no passwords to share.
5. Set the session length. To end one customer's access, remove their address.
6. Restrict the GitHub Pages origin so it cannot be reached directly: either make the
   repository private and deploy with Cloudflare Pages, or keep the origin address
   unpublished and accept that it is obscurity.

With this in place the passkey form can be kept as a second step or removed.

## What it changes inside the configurator

Nothing must change. Two things become possible once a server knows who the visitor
is, and both are described in [`INTERNAL-DATA.md`](INTERNAL-DATA.md):

- the Internal workspace can read and write shared records through a service, in
  place of this browser's storage;
- quotation and trial requests can be submitted, in place of an email draft.
