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
