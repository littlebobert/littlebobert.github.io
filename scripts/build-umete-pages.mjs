import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds the umete.jp site into dist-umete/: the Umete pages at clean routes, with the
// shared stylesheet, the language script, and the assets they use. The Sparkle appcast
// is published both under its old name and as /appcast.xml, the Mac app's feed URL.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-umete');
const assetsDirectory = path.join(outputDirectory, 'assets');

const siteFiles = [
  '_headers',
  'sasu-common.css',
  'umete-language.js',
  'umete-animated-icon.css',
  'umete-animated-icon.js',
  // Inks the seals in; it's Karui's, shared.
  'karui-seal-ink.js',
  'ume-appcast.xml',
];

const assetFiles = [
  'ume-icon.png',
  // The glass icon, small for the favicon and full-bleed for the home screen.
  'umete-glass-favicon.png',
  'umete-glass-icon.png',
  'umete-social.png',
  // The landing page's header icon: the glass animation, its still, and its first frame.
  'umete-icon-sketch.mp4',
  'umete-icon-sketch.jpg',
  'umete-icon-sketch-first.jpg',
  // The landing page's carousel, from the Umete repository's AppStoreScreenshots.
  'umete-landing-fill.webp',
  'umete-landing-remembers.webp',
  'umete-landing-private.webp',
  // The 空欄を埋めて seal beside the hero, and large on /hanko, from generate-umete-seal.swift.
  'umete-seal-tagline.png',
  'umete-seal-tagline-large.png',
  // The maker's photo and name seal, shared with Karui's page.
  'karui-developer.jpg',
  'karui-seal.png',
];

// Source page → the routes it is served at. ume.html stays for links made before the
// site moved to umete.jp.
const pages = [
  ['ume.html', ['index.html', 'ume.html']],
  ['ume-privacy.html', ['privacy.html', 'privacy/index.html']],
  ['ume-support.html', ['support.html', 'support/index.html']],
  ['ume-changelog.html', ['changelog.html', 'changelog/index.html']],
  ['ume-specs.html', ['specs.html', 'specs/index.html']],
  ['ume-acknowledgements.html', ['acknowledgements.html', 'acknowledgements/index.html']],
  ['ume-technotes.html', ['technotes.html', 'technotes/index.html']],
  ['ume-technote-un001.html', ['technotes/un001.html', 'technotes/un001/index.html']],
  ['ume-hanko.html', ['hanko.html', 'hanko/index.html']],
];

export function createDeployedPage(source) {
  return source
    .replaceAll('href="sasu-common.css', 'href="/sasu-common.css')
    .replaceAll('src="umete-language.js', 'src="/umete-language.js')
    .replaceAll('href="umete-animated-icon.css', 'href="/umete-animated-icon.css')
    .replaceAll('src="umete-animated-icon.js', 'src="/umete-animated-icon.js')
    .replaceAll('src="karui-seal-ink.js', 'src="/karui-seal-ink.js')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('srcset="assets/', 'srcset="/assets/')
    .replaceAll('href="ume.html"', 'href="/"')
    .replaceAll('href="ume-privacy.html"', 'href="/privacy"')
    .replaceAll('href="ume-support.html"', 'href="/support"')
    .replaceAll('href="ume-changelog.html"', 'href="/changelog"')
    .replaceAll('href="ume-specs.html"', 'href="/specs"')
    .replaceAll('href="ume-acknowledgements.html"', 'href="/acknowledgements"')
    .replaceAll('href="ume-technotes.html"', 'href="/technotes"')
    .replaceAll('href="ume-technote-un001.html"', 'href="/technotes/un001"')
    .replaceAll('href="ume-hanko.html"', 'href="/hanko"');
}

// Sparkle release notes referenced from the appcast.
const releaseNotes = (await readdir(rootDirectory)).filter((file) => /^Ume(?:te)?-.*\.md$/.test(file));

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(assetsDirectory, { recursive: true });
await Promise.all(
  [...siteFiles, ...releaseNotes].map((file) =>
    cp(path.join(rootDirectory, file), path.join(outputDirectory, file)),
  ),
);
await Promise.all(
  assetFiles.map((file) => cp(path.join(rootDirectory, 'assets', file), path.join(assetsDirectory, file))),
);
await cp(path.join(rootDirectory, 'ume-appcast.xml'), path.join(outputDirectory, 'appcast.xml'));
// Served at umete.jp/llms.txt for AI agents; the portfolio has its own llms.txt.
await cp(path.join(rootDirectory, 'umete-llms.txt'), path.join(outputDirectory, 'llms.txt'));
// A Japanese version of every page at /ja/…, for search engines and AI assistants, as on
// karui.jp: each page's translations live in data-label-*/data-alt-*/data-aria-label-*
// attributes, which umete-language.js swaps in after load, so crawlers only ever saw
// English. The build does the same swap ahead of time. Each version names the other with
// hreflang and its own canonical URL, and the language button goes to the other version
// (umete-language.js reads data-language-pages). English pages keep their addresses and
// still switch in place for visitors whose browser or last choice is Japanese.
const routeOf = (outputs) => (outputs[0] === 'index.html' ? '' : outputs[0].replace(/\.html$/, ''));
const englishPath = (route) => `/${route}`;
const japanesePath = (route) => (route ? `/ja/${route}` : '/ja');
const absolute = (pagePath) => `https://umete.jp${pagePath}`;
const localizedRoutes = new Set(pages.map(([, outputs]) => routeOf(outputs)));

// The value of a double-quoted attribute in an opening tag, or undefined.
function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

// The opening tag with the attribute set, replacing it or adding it before the >.
function withAttribute(tag, name, value) {
  const pattern = new RegExp(`(\\s${name}=")[^"]*(")`);
  if (pattern.test(tag)) return tag.replace(pattern, (_, start, end) => `${start}${value}${end}`);
  return tag.replace(/\s*\/?>$/, (end) => ` ${name}="${value}"${end}`);
}

// What umete-language.js does in the browser, done to the HTML: an element's text, or a
// meta element's content, becomes its data-label-ja, and so on for alt and aria-label.
// Labeled elements hold only text, so the text runs to the closing tag.
export function translateToJapanese(html) {
  let output = html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-(?:label|alt|aria-label)-en="[^"]*"[^>]*>/g, (tag, name) => {
    let result = tag;
    for (const [data, target] of [['alt', 'alt'], ['aria-label', 'aria-label']]) {
      const value = attribute(tag, `data-${data}-ja`);
      if (attribute(tag, `data-${data}-en`) !== undefined && value !== undefined) result = withAttribute(result, target, value);
    }
    const label = attribute(tag, 'data-label-ja');
    if (label !== undefined && name.toLowerCase() === 'meta') result = withAttribute(result, 'content', label);
    return label !== undefined && name.toLowerCase() !== 'meta' ? `${result}\u0000${label}\u0000` : result;
  });
  // Swap the text up to each closing tag for the label marked above.
  output = output.replace(/\u0000([^\u0000]*)\u0000[^<]*/g, (_, label) => label.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  // The <title> isn't labeled, so it takes the og:title's translation.
  const ogTitle = html.match(/<meta property="og:title"[^>]*>/)?.[0];
  const title = ogTitle && attribute(ogTitle, 'data-label-ja');
  if (title !== undefined) output = output.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  return output
    .replace(/<html lang="[a-z]+">/, '<html lang="ja">')
    .replace('<button class="language-switch" type="button" aria-label="日本語に切り替える">日本語</button>',
      '<button class="language-switch" type="button" aria-label="Switch to English">English</button>');
}

// hreflang for both versions after the canonical link, and the canonical, og:url, and
// the language button's targets for this version.
function withLanguageVersions(html, route, language) {
  const paths = { en: englishPath(route), ja: japanesePath(route) };
  const own = absolute(paths[language]);
  const alternates = [
    `  <link rel="alternate" hreflang="en" href="${absolute(paths.en)}">`,
    `  <link rel="alternate" hreflang="ja" href="${absolute(paths.ja)}">`,
    `  <link rel="alternate" hreflang="x-default" href="${absolute(paths.en)}">`,
  ].join('\n');
  const pagesAttribute = ` data-language-pages='${JSON.stringify(paths)}'${language === 'ja' ? ' data-page-language="ja"' : ''}`;
  const output = html
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${own}">\n${alternates}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${own}$2`)
    .replace(/<html lang="([a-z]+)">/, `<html lang="$1"${pagesAttribute}>`);
  if (!output.includes('hreflang="ja"') || !output.includes('data-language-pages')) throw new Error(`No canonical link or <html> tag for ${route || 'home'}`);
  return output;
}

// On a Japanese page, links to another page go to its Japanese version.
function withJapaneseLinks(html) {
  return html.replace(/href="\/([a-z0-9/-]*)(#[^"]*)?"/g, (link, route, hash = '') =>
    (localizedRoutes.has(route) ? `href="${japanesePath(route)}${hash}"` : link));
}

await Promise.all(
  pages.map(async ([source, outputs]) => {
    const route = routeOf(outputs);
    const deployed = createDeployedPage(await readFile(path.join(rootDirectory, source), 'utf8'));
    const english = withLanguageVersions(deployed, route, 'en');
    const japanese = withLanguageVersions(withJapaneseLinks(translateToJapanese(deployed)), route, 'ja');
    const japaneseOutputs = route ? [`ja/${route}.html`, `ja/${route}/index.html`] : ['ja.html', 'ja/index.html'];
    await Promise.all([
      ...outputs.map((output) => [output, english]),
      ...japaneseOutputs.map((output) => [output, japanese]),
    ].map(async ([output, html]) => {
      const target = path.join(outputDirectory, output);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, html);
    }));
  }),
);

// For search engines and AI assistants, as on karui.jp. Without a top-level 404.html,
// Cloudflare Pages treats the site as a single-page app and answers every address,
// robots.txt and sitemap.xml included, with the home page and a 200. robots.txt lets
// every crawler in and points them at the sitemap, which lists each page at its clean
// route; the build fails if a listed route wasn't built.
await writeFile(
  path.join(outputDirectory, '404.html'),
  createDeployedPage(await readFile(path.join(rootDirectory, 'umete-404.html'), 'utf8')),
);
const sitemapRoutes = ['', 'specs', 'privacy', 'support', 'changelog', 'technotes', 'technotes/un001', 'acknowledgements', 'hanko'];
const sitemapPaths = sitemapRoutes.flatMap((route) => [englishPath(route), japanesePath(route)]);
await Promise.all(
  sitemapPaths.map((pagePath) => readFile(path.join(outputDirectory, pagePath, 'index.html'))),
);
await writeFile(path.join(outputDirectory, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapPaths.map((pagePath) => `  <url><loc>${absolute(pagePath)}</loc></url>`),
  '</urlset>',
  '',
].join('\n'));
await writeFile(path.join(outputDirectory, 'robots.txt'), [
  '# umete.jp is public: search engines and AI assistants are welcome.',
  'User-agent: *',
  'Allow: /',
  '',
  'Sitemap: https://umete.jp/sitemap.xml',
  '',
].join('\n'));

console.log(`Built Umete Pages site in ${outputDirectory}`);
