import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-karui');
const assetsDirectory = path.join(outputDirectory, 'assets');
const privacyDirectory = path.join(outputDirectory, 'privacy');
const supportDirectory = path.join(outputDirectory, 'support');
const acknowledgementsDirectory = path.join(outputDirectory, 'acknowledgements');
const changelogDirectory = path.join(outputDirectory, 'changelog');
const macDirectory = path.join(outputDirectory, 'mac');
const specsDirectory = path.join(outputDirectory, 'specs');
const technotesDirectory = path.join(outputDirectory, 'technotes');
const kn001Directory = path.join(technotesDirectory, 'kn001');
const kn002Directory = path.join(technotesDirectory, 'kn002');
const kn004Directory = path.join(technotesDirectory, 'kn004');
const kn005Directory = path.join(technotesDirectory, 'kn005');
const kn006Directory = path.join(technotesDirectory, 'kn006');
const kn007Directory = path.join(technotesDirectory, 'kn007');
const lightningTalkDirectory = path.join(technotesDirectory, 'lightning-talk');

const siteFiles = [
  '_headers',
  'sasu-common.css',
  'karui-seal-ink.js',
  'karui-animated-icon.css',
  'karui-animated-icon.js',
];

const assetFiles = [
  'karui-favicon.png',
  // The glass icon: the pages' favicon, home screen icon, and the social card's source.
  'karui-glass-favicon.png',
  'karui-glass-icon.png',
  'karui-developer.jpg',
  'karui-icon.png',
  'karui-icon-sketch.jpg',
  'karui-icon-sketch.mp4',
  // The lightning talk's What is Karui slide.
  'karui-app-icon.png',
  'karui-qr.png',
  'karui-qr-seal.png',
  'karui-qr-seal-name.png',
  'karui-qr-seal.json',
  'karui-qr-seal-tagline-name.png',
  'karui-qr-seal-tagline.json',
  'karui-seal.png',
  'karui-seal-large.png',
  'karui-seal-tagline.png',
  'karui-seal-tagline-large.png',
  'karui-social.png',
  // Apple's Download on the App Store badge, black, in each language the home page has.
  ...['en', 'ja', 'ko', 'de'].map((language) => `karui-app-store-badge-${language}.svg`),
  // KN004's App Privacy Report screenshot.
  'karui-kn004-privacy-report.jpg',
  'karui-kn004-privacy-report-icloud.jpg',
  // KN007's chart as a picture, for browsers without JavaScript.
  'karui-kn007-phone-checks-en.png',
  // The lightning talk's recording, and its first frame until it plays.
  'karui-lightning-talk.mp4',
  'karui-lightning-talk-poster.jpg',
  // The demo's four screens, in each language.
  ...['en', 'ja', 'ko'].flatMap((language) => [1, 2, 3, 4].map((screen) => `karui-demo-${language}-${screen}.jpg`)),
  // The first screen's clip of notifications sorting themselves, in each language.
  ...['en', 'ja', 'ko'].map((language) => `karui-demo-${language}-sort.mp4`),
  // Karui for Mac's two screens in a MacBook Air, in each language.
  ...['en', 'ja'].flatMap((language) => [1, 2].map((screen) => `karui-mac-demo-${language}-${screen}.jpg`)),
];

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(assetsDirectory, { recursive: true }),
  mkdir(privacyDirectory, { recursive: true }),
  mkdir(supportDirectory, { recursive: true }),
  mkdir(acknowledgementsDirectory, { recursive: true }),
  mkdir(changelogDirectory, { recursive: true }),
  mkdir(macDirectory, { recursive: true }),
  mkdir(path.join(outputDirectory, 'hanko'), { recursive: true }),
  mkdir(path.join(outputDirectory, 'seal'), { recursive: true }),
  mkdir(path.join(outputDirectory, 'qr'), { recursive: true }),
  mkdir(specsDirectory, { recursive: true }),
  mkdir(kn001Directory, { recursive: true }),
  mkdir(kn002Directory, { recursive: true }),
  mkdir(kn004Directory, { recursive: true }),
  mkdir(kn005Directory, { recursive: true }),
  mkdir(kn006Directory, { recursive: true }),
  mkdir(kn007Directory, { recursive: true }),
  mkdir(lightningTalkDirectory, { recursive: true }),
  mkdir(path.join(outputDirectory, 'guides', 'unwanted-notifications'), { recursive: true }),
  mkdir(path.join(outputDirectory, 'guides', 'unsent-messages'), { recursive: true }),
  mkdir(path.join(outputDirectory, 'known-issues'), { recursive: true }),
]);

await Promise.all(
  siteFiles.map((file) =>
    cp(path.join(rootDirectory, file), path.join(outputDirectory, file)),
  ),
);

// Served at karui.jp/llms.txt for AI agents; the portfolio has its own llms.txt.
await cp(path.join(rootDirectory, 'karui-llms.txt'), path.join(outputDirectory, 'llms.txt'));

await Promise.all(
  assetFiles.map((file) =>
    cp(path.join(rootDirectory, 'assets', file), path.join(assetsDirectory, file)),
  ),
);

function createDeployedPage(source) {
  return source
    .replaceAll('href="sasu-common.css', 'href="/sasu-common.css')
    .replaceAll('src="karui-seal-ink.js', 'src="/karui-seal-ink.js')
    .replaceAll('href="karui-animated-icon.css', 'href="/karui-animated-icon.css')
    .replaceAll('src="karui-animated-icon.js', 'src="/karui-animated-icon.js')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('data-src-en="assets/', 'data-src-en="/assets/')
    .replaceAll('data-src-ja="assets/', 'data-src-ja="/assets/')
    .replaceAll('data-src-ko="assets/', 'data-src-ko="/assets/')
    .replaceAll('data-src-de="assets/', 'data-src-de="/assets/')
    .replaceAll('poster="assets/', 'poster="/assets/')
    .replaceAll('data-poster-en="assets/', 'data-poster-en="/assets/')
    .replaceAll('data-poster-ja="assets/', 'data-poster-ja="/assets/')
    .replaceAll('href="karui.html"', 'href="/"')
    .replaceAll('href="karui-privacy.html"', 'href="/privacy"')
    .replaceAll('href="karui-support.html"', 'href="/support"')
    .replaceAll('href="karui-known-issues.html"', 'href="/known-issues"')
    .replaceAll(
      'href="karui-acknowledgements.html"',
      'href="/acknowledgements"',
    )
    .replaceAll('href="karui-changelog.html"', 'href="/changelog"')
    .replaceAll('href="karui-mac.html"', 'href="/mac"')
    .replaceAll('href="karui-hanko.html"', 'href="/hanko"')
    .replaceAll('href="karui-seal.html"', 'href="/seal"')
    .replaceAll('href="karui-qr.html"', 'href="/qr"')
    .replaceAll('href="karui-specs.html"', 'href="/specs"')
    .replaceAll('href="karui-technotes.html"', 'href="/technotes"')
    .replaceAll('href="karui-technote-kn001.html"', 'href="/technotes/kn001"')
    .replaceAll('href="karui-technote-kn002.html"', 'href="/technotes/kn002"')
    .replaceAll('href="karui-technote-kn004.html"', 'href="/technotes/kn004"')
    .replaceAll('href="karui-technote-kn005.html"', 'href="/technotes/kn005"')
    .replaceAll('href="karui-technote-kn006.html"', 'href="/technotes/kn006"')
    .replaceAll('href="karui-technote-kn007.html"', 'href="/technotes/kn007"')
    .replaceAll('href="karui-lightning-talk.html"', 'href="/technotes/lightning-talk"')
    .replaceAll('href="karui-guides.html"', 'href="/guides"')
    .replaceAll('href="karui-guide-unwanted-notifications.html"', 'href="/guides/unwanted-notifications"')
    .replaceAll('href="karui-guide-unsent-messages.html"', 'href="/guides/unsent-messages"');
}

const [homeSource, privacySource, supportSource, acknowledgementsSource, changelogSource] =
  await Promise.all([
    readFile(path.join(rootDirectory, 'karui.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'karui-privacy.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'karui-support.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'karui-acknowledgements.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'karui-changelog.html'), 'utf8'),
  ]);
const homePage = createDeployedPage(homeSource);
const privacyPage = createDeployedPage(privacySource);
const supportPage = createDeployedPage(supportSource);
const acknowledgementsPage = createDeployedPage(acknowledgementsSource);
const changelogPage = createDeployedPage(changelogSource);

await Promise.all([
  writeFile(path.join(outputDirectory, 'index.html'), homePage),
  writeFile(path.join(outputDirectory, 'karui.html'), homePage),
  writeFile(path.join(outputDirectory, 'privacy.html'), privacyPage),
  writeFile(path.join(privacyDirectory, 'index.html'), privacyPage),
  writeFile(path.join(outputDirectory, 'support.html'), supportPage),
  writeFile(path.join(supportDirectory, 'index.html'), supportPage),
  writeFile(
    path.join(outputDirectory, 'acknowledgements.html'),
    acknowledgementsPage,
  ),
  writeFile(
    path.join(acknowledgementsDirectory, 'index.html'),
    acknowledgementsPage,
  ),
  writeFile(path.join(outputDirectory, 'changelog.html'), changelogPage),
  writeFile(path.join(changelogDirectory, 'index.html'), changelogPage),
]);

// Karui for Mac, Tech Specs, the Technical Notes and the lightning talk beside them, and
// the /hanko, /seal, and /qr pages, each at a clean route.
const technicalPages = [
  ['karui-mac.html', ['mac.html', 'mac/index.html']],
  ['karui-hanko.html', ['hanko.html', 'hanko/index.html']],
  ['karui-seal.html', ['seal.html', 'seal/index.html']],
  ['karui-qr.html', ['qr.html', 'qr/index.html']],
  ['karui-known-issues.html', ['known-issues.html', 'known-issues/index.html']],
  ['karui-specs.html', ['specs.html', 'specs/index.html']],
  ['karui-technotes.html', ['technotes.html', 'technotes/index.html']],
  ['karui-technote-kn001.html', ['technotes/kn001.html', 'technotes/kn001/index.html']],
  ['karui-technote-kn002.html', ['technotes/kn002.html', 'technotes/kn002/index.html']],
  ['karui-technote-kn004.html', ['technotes/kn004.html', 'technotes/kn004/index.html']],
  ['karui-technote-kn005.html', ['technotes/kn005.html', 'technotes/kn005/index.html']],
  ['karui-technote-kn006.html', ['technotes/kn006.html', 'technotes/kn006/index.html']],
  ['karui-technote-kn007.html', ['technotes/kn007.html', 'technotes/kn007/index.html']],
  ['karui-lightning-talk.html', ['technotes/lightning-talk.html', 'technotes/lightning-talk/index.html']],
  // Guides: answers to questions people ask about iPhone notifications.
  ['karui-guides.html', ['guides.html', 'guides/index.html']],
  ['karui-guide-unwanted-notifications.html', ['guides/unwanted-notifications.html', 'guides/unwanted-notifications/index.html']],
  ['karui-guide-unsent-messages.html', ['guides/unsent-messages.html', 'guides/unsent-messages/index.html']],
];
await Promise.all(
  technicalPages.map(async ([source, outputs]) => {
    const page = createDeployedPage(await readFile(path.join(rootDirectory, source), 'utf8'));
    await Promise.all(outputs.map((output) => writeFile(path.join(outputDirectory, output), page)));
  }),
);

// A page per language, for search engines and AI assistants: each page's translations
// live in data-label-*/data-alt-*/data-src-*/data-aria-label-* attributes, which its
// script swaps in after load, so crawlers only ever saw English. The build does the same
// swap ahead of time: Japanese for every page at /ja/…, and Korean and German for the
// home page, the only one translated into them, at /ko and /de. Every version names the
// others with hreflang and its own canonical URL, and the language switch goes to the
// other version instead of swapping in place. The English pages keep their addresses
// and still switch in place for visitors whose browser or last choice is another language.
const localizedPages = [
  { source: 'karui.html', route: '', languages: ['ja', 'ko', 'de'], outputs: ['index.html', 'karui.html'] },
  { source: 'karui-privacy.html', route: 'privacy', languages: ['ja'] },
  { source: 'karui-support.html', route: 'support', languages: ['ja'] },
  { source: 'karui-acknowledgements.html', route: 'acknowledgements', languages: ['ja'] },
  { source: 'karui-changelog.html', route: 'changelog', languages: ['ja'] },
  ...technicalPages.map(([source, outputs]) => ({ source, route: outputs[0].replace(/\.html$/, ''), languages: ['ja'] })),
];

const englishPath = (route) => `/${route}`;
const languagePath = (language, route) => (route ? `/${language}/${route}` : `/${language}`);
const absolute = (pagePath) => `https://karui.jp${pagePath}`;
const pagePaths = (page) => Object.fromEntries([
  ['en', englishPath(page.route)],
  ...page.languages.map((language) => [language, languagePath(language, page.route)]),
]);

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

// What each page's setLanguage does in the browser, done to the HTML: an element's text,
// or a meta element's content, becomes its data-label-<language>, and so on for alt, src
// and aria-label. Labeled elements hold only text, so the text runs to the closing tag.
function translate(html, language) {
  const suffix = `-${language}`;
  let output = html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-(?:label|alt|src|aria-label)-en="[^"]*"[^>]*>/g, (tag, name) => {
    let result = tag;
    for (const [data, target] of [['alt', 'alt'], ['src', 'src'], ['aria-label', 'aria-label']]) {
      const value = attribute(tag, `data-${data}${suffix}`);
      if (attribute(tag, `data-${data}-en`) !== undefined && value !== undefined) result = withAttribute(result, target, value);
    }
    const label = attribute(tag, `data-label${suffix}`);
    if (label !== undefined && name.toLowerCase() === 'meta') result = withAttribute(result, 'content', label);
    return label !== undefined && name.toLowerCase() !== 'meta' ? `${result}\u0000${label}\u0000` : result;
  });
  // Swap the text up to each closing tag for the label marked above.
  output = output.replace(/\u0000([^\u0000]*)\u0000[^<]*/g, (_, label) => label.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  // The <title> isn't labeled, so it takes the og:title's translation, where there is one.
  const ogTitle = html.match(/<meta property="og:title"[^>]*>/)?.[0];
  const title = ogTitle && attribute(ogTitle, `data-label${suffix}`);
  if (title !== undefined) output = output.replace(/<title>[^<]*<\/title>/, `<title>${title.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</title>`);
  return output.replace(/<html lang="[a-z]+">/, `<html lang="${language}">`);
}

// hreflang for every version, after the canonical link; the canonical and og:url name
// this version.
function withAlternates(html, page, language) {
  const paths = pagePaths(page);
  const own = absolute(paths[language] === '/' ? '/' : paths[language]);
  const alternates = [
    ...Object.entries(paths).map(([code, pagePath]) => `  <link rel="alternate" hreflang="${code}" href="${absolute(pagePath)}">`),
    `  <link rel="alternate" hreflang="x-default" href="${absolute(paths.en)}">`,
  ].join('\n');
  return html
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${own}">\n${alternates}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${own}$2`);
}

// Links to another page go to its version in this language when it has one.
function withLanguageLinks(html, language) {
  const routes = new Set(localizedPages.filter((page) => page.languages.includes(language)).map((page) => page.route));
  return html.replace(/href="\/([a-z0-9/-]*)(#[^"]*)?"/g, (link, route, hash = '') =>
    (routes.has(route) ? `href="${languagePath(language, route)}${hash}"` : link));
}

// The language switch goes to the page in the chosen language, remembering the choice;
// it still swaps in place where there's no such page, or it's the page already showing.
function withLanguageSwitching(html, page, language) {
  const paths = JSON.stringify(pagePaths(page));
  const switching = [
    `    const languagePages = ${paths};`,
    '    function switchLanguage(language) {',
    "      const normalized = (pagePath) => pagePath.replace(/(\\/index)?\\.html$|\\/$/, '') || '/';",
    '      const target = languagePages[language];',
    '      if (!target || normalized(target) === normalized(location.pathname)) { setLanguage(language); return; }',
    "      localStorage.setItem('karui-language', language);",
    '      location.href = target + location.hash;',
    '    }',
    '',
  ].join('\n');
  let output = html
    .replace("    languageSwitch.addEventListener('click', () => setLanguage(currentLanguage === 'ja' ? 'en' : 'ja'));", (line) => `${switching}${line.replace('() => setLanguage(', '() => switchLanguage(')}`)
    .replace("    languageSelect.addEventListener('change', () => setLanguage(languageSelect.value));", (line) => `${switching}${line.replace('() => setLanguage(', '() => switchLanguage(')}`);
  if (!output.includes('switchLanguage(')) throw new Error(`No language switch found in ${page.source}`);
  if (language !== 'en') {
    const start = "    setLanguage(localStorage.getItem('karui-language') || preferredLanguage(), false);";
    if (!output.includes(start)) throw new Error(`No language setup found in ${page.source}`);
    output = output
      .replace(start, `    setLanguage('${language}', false);`)
      .replace('<button class="language-switch" type="button" aria-label="日本語に切り替える">日本語</button>', '<button class="language-switch" type="button" aria-label="Switch to English">English</button>')
      .replace(`<option value="${language}">`, `<option value="${language}" selected>`);
  }
  return output;
}

await Promise.all(
  localizedPages.map(async (page) => {
    const deployed = createDeployedPage(await readFile(path.join(rootDirectory, page.source), 'utf8'));
    const englishOutputs = page.outputs ?? [`${page.route}.html`, `${page.route}/index.html`];
    const english = withLanguageSwitching(withAlternates(deployed, page, 'en'), page, 'en');
    await Promise.all(englishOutputs.map((output) => writeFile(path.join(outputDirectory, output), english)));
    await Promise.all(
      page.languages.map(async (language) => {
        const localized = withLanguageSwitching(withAlternates(withLanguageLinks(translate(deployed, language), language), page, language), page, language);
        const outputs = page.route
          ? [`${language}/${page.route}.html`, `${language}/${page.route}/index.html`]
          : [`${language}.html`, `${language}/index.html`];
        await Promise.all(outputs.map(async (output) => {
          await mkdir(path.dirname(path.join(outputDirectory, output)), { recursive: true });
          await writeFile(path.join(outputDirectory, output), localized);
        }));
      }),
    );
  }),
);

// For search engines and AI assistants. robots.txt lets every crawler in and points them
// at the sitemap, which lists each page at its clean route; the build fails if a listed
// route wasn't built. The 404 page also matters: without a top-level 404.html,
// Cloudflare Pages treats the site as a single-page app and answers every address,
// robots.txt and sitemap.xml included, with the home page and a 200.
const sitemapRoutes = [
  '',
  'specs',
  'mac',
  'support',
  'known-issues',
  'privacy',
  'changelog',
  'technotes',
  'technotes/kn001',
  'technotes/kn002',
  'technotes/kn004',
  'technotes/kn005',
  'technotes/kn006',
  'technotes/kn007',
  'technotes/lightning-talk',
  'guides',
  'guides/unwanted-notifications',
  'guides/unsent-messages',
  'acknowledgements',
  'hanko',
  'seal',
];
await Promise.all(
  sitemapRoutes.map((route) => readFile(path.join(outputDirectory, route, 'index.html'))),
);
// Each page's other-language versions follow it in the sitemap.
const sitemapPaths = sitemapRoutes.flatMap((route) => {
  const page = localizedPages.find((candidate) => candidate.route === route);
  return [englishPath(route), ...(page?.languages ?? []).map((language) => languagePath(language, route))];
});
await Promise.all(
  sitemapPaths.map((pagePath) => readFile(path.join(outputDirectory, pagePath === '/' ? 'index.html' : `${pagePath}/index.html`))),
);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapPaths.map((pagePath) => `  <url><loc>${absolute(pagePath)}</loc></url>`),
  '</urlset>',
  '',
].join('\n');
const robots = [
  '# karui.jp is public: search engines and AI assistants are welcome.',
  'User-agent: *',
  'Allow: /',
  '',
  'Sitemap: https://karui.jp/sitemap.xml',
  '',
].join('\n');
// What the portfolio's Featured App desk accessory (karui-desk.js) shows: the newest
// App Store release (never Pending Release), with any builds since the previous App Store
// release folded in and "No changes since the previous build." items omitted. Written both
// to karui.jp/latest-release.json (rebuilt on every push) and data/karui-latest.json.
function decodeHtml(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function extractLatestRelease(changelogHtml) {
  const startMarker = '<!-- karui-changelog:start -->';
  const endMarker = '<!-- karui-changelog:end -->';
  const start = changelogHtml.indexOf(startMarker);
  const end = changelogHtml.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Missing karui-changelog markers');

  const section = changelogHtml.slice(start + startMarker.length, end);
  const builds = section
    .split(/(?=<h2 data-karui-build=")/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('<h2 data-karui-build="'))
    .map((chunk) => {
      const heading = chunk.match(/<h2 data-karui-build="[^"]*">([\s\S]*?)<\/h2>/)?.[1] ?? '';
      const badge = heading.match(/<span class="store-badge(?:\s+([^"]*))?"/);
      const version = decodeHtml(heading.replace(/<span[\s\S]*$/, '')).trim().replace(/\s*\(\d+\)$/, '');
      const dateTag = chunk.match(/<span class="release-date"[^>]*>/)?.[0] ?? '';
      const dateText = chunk.match(/<span class="release-date"[^>]*>([^<]*)<\/span>/)?.[1] ?? '';
      const date = decodeHtml(attribute(dateTag, 'data-label-en') ?? dateText).trim();
      const notes = { en: [], ja: [] };
      for (const [, attrs, inner] of chunk.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)) {
        const openTag = `<li${attrs}>`;
        if (/\bno-changes\b/.test(attribute(openTag, 'class') ?? '')) continue;
        const en = attribute(openTag, 'data-label-en') !== undefined
          ? decodeHtml(attribute(openTag, 'data-label-en')).trim()
          : decodeHtml(inner.replace(/<[^>]+>/g, '')).trim();
        const ja = attribute(openTag, 'data-label-ja') !== undefined
          ? decodeHtml(attribute(openTag, 'data-label-ja')).trim()
          : decodeHtml(translate(`${openTag}${inner}</li>`, 'ja').replace(/<[^>]+>/g, '')).trim();
        if (en) notes.en.push(en);
        if (ja) notes.ja.push(ja);
      }
      return {
        version,
        date,
        hasBadge: Boolean(badge),
        isPending: Boolean(badge?.[1]?.split(/\s+/).includes('pending')),
        notes,
      };
    });

  const liveIndex = builds.findIndex((build) => build.hasBadge && !build.isPending);
  if (liveIndex < 0 || !builds[liveIndex].version) {
    throw new Error('No live App Store release found in karui-changelog.html');
  }
  const live = builds[liveIndex];
  const notes = { en: [], ja: [] };
  for (const build of builds.slice(liveIndex)) {
    if (build !== live && build.hasBadge) break;
    notes.en.push(...build.notes.en);
    notes.ja.push(...build.notes.ja);
  }
  return { version: live.version, date: live.date, notes };
}

const latestReleaseJson = `${JSON.stringify(extractLatestRelease(changelogSource), null, 2)}\n`;

await Promise.all([
  writeFile(path.join(outputDirectory, 'sitemap.xml'), sitemap),
  writeFile(path.join(outputDirectory, 'robots.txt'), robots),
  writeFile(path.join(outputDirectory, 'latest-release.json'), latestReleaseJson),
  writeFile(path.join(rootDirectory, 'data', 'karui-latest.json'), latestReleaseJson),
  writeFile(
    path.join(outputDirectory, '404.html'),
    createDeployedPage(await readFile(path.join(rootDirectory, 'karui-404.html'), 'utf8')),
  ),
]);

console.log(`Built Karui Pages site in ${outputDirectory}`);
