#!/usr/bin/env node
/* TEAL configurator — set the access passkeys.
 *
 *   node tools/access/set-passkeys.mjs --customer "<key>" --internal "<key>"
 *   node tools/access/set-passkeys.mjs --generate          # make two random keys and print them once
 *   node tools/access/set-passkeys.mjs --customer "<key>"  # change one, keep the other
 *   node tools/access/set-passkeys.mjs --check "<key>"     # say which view a key opens, change nothing
 *
 * The passkeys themselves are never written anywhere. What is stored — in
 * access.json and, identically, in the block of index.html marked ACCESS — is a
 * random salt per key and a verifier: SHA-256 of the PBKDF2-HMAC-SHA256 key
 * derived from the passkey. The page derives the same key from what is typed
 * and compares. Commit both files after running this.
 *
 * This keeps casual visitors out. It is not a security boundary: the site and
 * its data are public files, and anyone who edits the page in their browser can
 * skip the check. Do not put anything confidential behind it. See SECURITY.md.
 */
import { pbkdf2Sync, createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';

const ROOT = normalize(join(new URL('.', import.meta.url).pathname, '..', '..'));
const FILE = join(ROOT, 'access.json'), PAGE = join(ROOT, 'index.html');
const IT = 210000;

export const norm = k => String(k).normalize('NFKC').trim();
export function derive(key, saltHex, it = IT) { return pbkdf2Sync(norm(key), Buffer.from(saltHex, 'hex'), it, 32, 'sha256').toString('hex'); }
export function verifier(kHex) { return createHash('sha256').update(Buffer.from(kHex, 'hex')).digest('hex'); }
export function entry(key, it = IT) { const s = randomBytes(16).toString('hex'); return { s, v: verifier(derive(key, s, it)) }; }
export function build(customer, internal, it = IT) {
  return { _comment: 'Access verifiers for the TEAL configurator. No passkey is stored here — see tools/access/set-passkeys.mjs and SECURITY.md.',
           v: 1, it, customer: entry(customer, it), internal: entry(internal, it) };
}
/* a key people can read out and type: 4 groups of 4, no look-alike characters */
function randomKey() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out = '';
  for (const b of randomBytes(16)) out += A[b % 32];
  return out.match(/.{4}/g).join('-');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
  const cur = (() => { try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return null; } })();

  if (arg('check') != null) {
    if (!cur) { console.error('access.json not found.'); process.exit(1); }
    const hit = ['internal', 'customer'].filter(r => verifier(derive(arg('check'), cur[r].s, cur.it)) === cur[r].v);
    console.log(hit.length ? 'That key opens: ' + hit.join(' and ') + '.' : 'That key opens nothing.');
    process.exit(hit.length ? 0 : 1);
  }

  let customer = arg('customer'), internal = arg('internal');
  const gen = process.argv.includes('--generate');
  if (gen) { customer = customer || randomKey(); internal = internal || randomKey(); }
  if (!customer && !internal) { console.error('Give --customer and/or --internal, or --generate. See the header of this file.'); process.exit(1); }
  for (const [n, k] of [['customer', customer], ['internal', internal]]) {
    if (k == null) continue;
    if (norm(k).length < 10) { console.error(`The ${n} passkey is shorter than 10 characters. The verifier is public, so a short key can be guessed offline. Choose a longer one.`); process.exit(1); }
  }
  if (customer && internal && norm(customer) === norm(internal)) { console.error('The two passkeys must differ.'); process.exit(1); }
  if ((!customer || !internal) && !cur) { console.error('access.json does not exist yet — give both passkeys.'); process.exit(1); }

  const out = { _comment: 'Access verifiers for the TEAL configurator. No passkey is stored here — see tools/access/set-passkeys.mjs and SECURITY.md.',
                v: 1, it: IT,
                customer: customer ? entry(customer) : cur.customer,
                internal: internal ? entry(internal) : cur.internal };
  if (cur && cur.it !== IT && (!customer || !internal)) { console.error('The iteration count changed — set both passkeys again.'); process.exit(1); }

  writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n');
  const page = readFileSync(PAGE, 'utf8'), re = /\/\*ACCESS:BEGIN\*\/[\s\S]*?\/\*ACCESS:END\*\//;
  if (!re.test(page)) { console.error('index.html has no ACCESS block to update.'); process.exit(1); }
  const lit = JSON.stringify({ v: out.v, it: out.it, customer: out.customer, internal: out.internal });
  writeFileSync(PAGE, page.replace(re, '/*ACCESS:BEGIN*/' + lit + '/*ACCESS:END*/'));

  console.log('Updated access.json and the ACCESS block of index.html. Commit both.');
  if (gen || customer) console.log('  Customer passkey: ' + (gen && !arg('customer') ? customer : '(as given)'));
  if (gen || internal) console.log('  Internal passkey: ' + (gen && !arg('internal') ? internal : '(as given)'));
  if (gen) console.log('These are shown once and stored nowhere. Keep them somewhere safe.');
}
