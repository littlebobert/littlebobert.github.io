# Portfolio backend

Cloudflare Worker for portfolio submissions, moderation, approved content, contact messages, and visitor counting.

## Resources

- Worker: `portfolio-backend`
- D1 binding: `DB` (`portfolio-backend`)
- Public URL: `https://portfolio-backend.justin-garcia.workers.dev`
- Secrets: `TURNSTILE_SECRET`, `VISITOR_HASH_SALT`

The Turnstile site key is public and lives in `../../index.js`. Secret values are stored only in Cloudflare.

## Local checks

```bash
npm install
npm test
npx wrangler d1 migrations apply portfolio-backend --local
npm run dev
```

Turnstile test keys can be used for local browser testing. Never put the production Turnstile secret in `.dev.vars`.

## Deploy

```bash
npx wrangler d1 migrations apply portfolio-backend --remote
npx wrangler deploy
```

For automatic deploys, connect `littlebobert/littlebobert.github.io` under the Worker's **Settings → Builds**:

- Production branch: `master`
- Root directory: `workers/portfolio-backend`
- Deploy command: `npx wrangler deploy`
- Watch paths: `workers/portfolio-backend/**`

## Product click analytics

Product landing pages send an anonymous aggregate event to `POST /api/v1/product-click`
when a primary download or TestFlight link is clicked. D1 stores only the product,
action, total click count, and first/last click timestamps. Raw IP addresses and user
agents are not stored. The existing rate limiter uses the request IP transiently to
limit abuse.

Totals are visible in the Access-protected `/admin` dashboard under **Product download clicks**.
Apply D1 migrations before deploying Worker code that uses a new schema.

## In-person guestbook

People at events sign with a finger at `https://onemorething.tokyo/sign` (`sign.html` and
`sign.js` in the site). The QR code for that URL is `assets/sign-qr.svg`, made by
`swift scripts/generate-sign-qr.swift`, which also writes `src/sign-qr.js` for the live page.

- `/admin/live` (behind Cloudflare Access, like `/admin`) is the page to keep open on your phone:
  start an event, show the QR code, and each new signature takes over the screen and redraws
  itself. Approve or reject from there or from `/admin`.
- One event runs at a time, for 12 hours unless ended. Signatures are attached to the running
  event on the server; without one they still arrive, just without an event.
- `POST /api/submissions/signature` takes ink in a 400×200 box (`validateInk`), with its own rate
  limit (`SIGNATURE_RATE_LIMITER`, 30 a minute per address) since a venue's Wi-Fi puts many
  signers behind one address. `GET /api/v1/sign/current` names the running event;
  `GET /api/content/signatures` lists approved signatures for the Guestbook.

To try it locally, run `node test/local-server.mjs` (in-memory database, Turnstile always passes,
`/admin` always signed in) and serve the site on port 8788; localhost pages use it automatically
(`signature-ink.js`).

## Admin access

Create a Cloudflare Access self-hosted application for:

```text
portfolio-backend.justin-garcia.workers.dev/admin*
```

Allow only the site owner's email. Add the resulting Access values to the Worker as plain environment variables:

- `TEAM_DOMAIN=https://<team-name>.cloudflareaccess.com`
- `POLICY_AUD=<application-audience-tag>`

The Worker independently validates every `Cf-Access-Jwt-Assertion` before serving `/admin` or its API.

## Data migration

Generate an idempotent seed from the checked-in static JSON:

```bash
npm run seed -- <current-visitor-count>
npx wrangler d1 execute portfolio-backend --remote --file seed.sql
```

`seed.sql` is ignored. Existing content uses `INSERT OR IGNORE`, and the counter uses the larger of the current and imported values.
