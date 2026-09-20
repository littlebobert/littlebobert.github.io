# Karui landing page on Cloudflare Pages

Karui is built from this repository as a dedicated static Cloudflare Pages site.

## Build settings

- Pages project name: `karui`
- Pages hostname: `karui-9yt.pages.dev`
- Production branch: `master`
- Build command: `npm run build:karui-pages`
- Build output directory: `dist-karui`
- Root directory: repository root

The generated output is intentionally not committed.

## Local build

```bash
npm run build:karui-pages
```

## First deploy with Wrangler

```bash
npx wrangler pages project create karui --production-branch master
npm run build:karui-pages
npx wrangler pages deploy dist-karui --project-name karui --branch master
```

## Connect `karui.jp`

1. Add `karui.jp` as a site in Cloudflare.
2. In onamae.com, replace the domain's nameservers with the two nameservers Cloudflare assigns.
3. Wait for the Cloudflare zone status to become Active.
4. In Workers & Pages → `karui` → Custom domains, add `karui.jp`.
5. Add `www.karui.jp` too, then configure a redirect to `https://karui.jp/` if desired.

Cloudflare Pages requires the apex domain to use Cloudflare authoritative DNS. Review and recreate any existing MX, TXT, CAA, or other records before changing nameservers, especially if the domain is used for email.
