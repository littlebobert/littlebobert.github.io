import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputDirectory = path.join(rootDirectory, 'dist-karui');

await import('../scripts/build-karui-pages.mjs');

async function readOutputFile(relativePath) {
  return readFile(path.join(outputDirectory, relativePath), 'utf8');
}

test('builds every Karui clean route', async () => {
  const [homePage, privacyPage, supportPage, acknowledgementsPage] =
    await Promise.all([
      readOutputFile('index.html'),
      readOutputFile('privacy/index.html'),
      readOutputFile('support/index.html'),
      readOutputFile('acknowledgements/index.html'),
    ]);

  assert.match(acknowledgementsPage, /<h1[^>]*>Acknowledgements<\/h1>/);
  assert.notEqual(acknowledgementsPage, homePage);

  for (const page of [homePage, privacyPage, supportPage]) {
    assert.match(page, /href="\/acknowledgements"/);
    assert.doesNotMatch(page, /href="karui-acknowledgements\.html"/);
  }

  assert.match(acknowledgementsPage, /href="\/sasu-common\.css\?v=\d+"/);
  assert.match(acknowledgementsPage, /href="\/assets\/karui-favicon\.png\?v=2"/);
  assert.match(acknowledgementsPage, /src="\/assets\/karui-icon-sketch\.jpg\?v=\d+"/);
  assert.match(acknowledgementsPage, /href="\/"/);
  assert.match(acknowledgementsPage, /href="\/privacy"/);
  assert.match(acknowledgementsPage, /href="\/support"/);
});

test('builds the Karui for Mac page at /mac and links it from the home page', async () => {
  const [homePage, macPage] = await Promise.all([readOutputFile('index.html'), readOutputFile('mac/index.html')]);
  // Out of beta: the title alone.
  assert.match(macPage, /<h1[^>]*><span[^>]*>Karui for Mac<\/span><\/h1>/);
  assert.doesNotMatch(macPage, /beta-badge/);
  assert.match(macPage, /href="\/"/);
  assert.match(macPage, /href="\/privacy"/);
  assert.match(macPage, /src="\/assets\/karui-icon-sketch\.jpg\?v=\d+"/);
  assert.doesNotMatch(macPage, /href="karui\.html"/);
  assert.match(homePage, /href="\/mac"/);
  // The Mac demo: two screens of the window, in English and Japanese.
  assert.match(macPage, /<img class="karui-demo-shot is-current" src="\/assets\/karui-mac-demo-en-1\.jpg\?v=\d+" data-src-en="\/assets\/karui-mac-demo-en-1\.jpg\?v=\d+" data-src-ja="\/assets\/karui-mac-demo-ja-1\.jpg\?v=\d+"/);
  assert.strictEqual(macPage.match(/class="karui-demo-shot/g).length, 2);
  await Promise.all(['en', 'ja'].flatMap((language) => [1, 2].map((screen) => readOutputFile(`assets/karui-mac-demo-${language}-${screen}.jpg`))));
  assert.doesNotMatch(homePage, /href="karui-mac\.html"/);
});

test('builds the changelog page and links to it from every page', async () => {
  const pages = await Promise.all(
    ['index.html', 'privacy/index.html', 'support/index.html', 'acknowledgements/index.html'].map(readOutputFile),
  );
  const changelogPage = await readOutputFile('changelog/index.html');
  assert.equal(await readOutputFile('changelog.html'), changelogPage);

  assert.match(changelogPage, /<h1[^>]*>Changelog<\/h1>/);
  assert.match(changelogPage, /<!-- karui-changelog:start -->[\s\S]*data-karui-build=[\s\S]*<!-- karui-changelog:end -->/);
  assert.match(changelogPage, /<link rel="canonical" href="https:\/\/karui\.jp\/changelog">/);
  for (const route of ['/', '/privacy', '/support', '/acknowledgements']) {
    assert.match(changelogPage, new RegExp(`href="${route}"`));
  }

  for (const page of pages) {
    assert.match(page, /href="\/changelog"/);
    assert.doesNotMatch(page, /href="karui-changelog\.html"/);
  }
  // The landing page shows no version (the App Store does); entries live on /changelog.
  assert.doesNotMatch(pages[0], /karui-changelog:start/);
  assert.doesNotMatch(pages[0], /data-karui-current-version/);
  // Downloads are counted by App Store Connect, so the site doesn't track clicks.
  assert.doesNotMatch(pages[0], /product-click-tracking|data-product=/);
  // Tapping the icon opens a full-screen QR code for showing the site in person, on its
  // own page, /qr; old karui.jp/#qr links are sent there.
  assert.match(pages[0], /<a href="\/qr" class="karui-qr-trigger"/);
  // The demo: four screens from the iPhone Duo recording, each with its caption below, the
  // first with a clip over its still; no label above it and no App Store screenshots.
  assert.doesNotMatch(pages[0], /karui-demo-label/);
  // Beside each Download button, the iPhones spam filtering needs, so nobody installs it on an
  // iPhone without Apple Intelligence expecting spam filtering; iOS 27 isn't mentioned, since the
  // App Store won't install it on anything older. Under the top one, the price and privacy. The full list is in Tech Specs.
  assert.match(pages[0], /<div class="small-note karui-price-note"><span data-label-en="Free, with no subscriptions\. "[^>]*>Free, with no subscriptions\. <\/span><a href="\/privacy" data-label-en="Private"/);
  assert.strictEqual(pages[0].match(/height="40"><\/a><span class="karui-requirements" data-label-en="Spam filtering needs iPhone 15 Pro or later\."/g).length, 2);
  // Download again at the end, after Privacy.
  // As Apple's App Store badge, in the page's language.
  assert.strictEqual(pages[0].match(/<a class="karui-app-store-badge" href="https:\/\/apps\.apple\.com\/app\/karui-notifications\/id6814134614"><img src="\/assets\/karui-app-store-badge-en\.svg\?v=\d+"[^>]*data-src-de="\/assets\/karui-app-store-badge-de\.svg\?v=\d+"[^>]*alt="Download on the App Store"/g).length, 2);
  assert.doesNotMatch(pages[0], /<a class="download-link"/);
  for (const [file, language] of [['ja/index.html', 'ja'], ['ko/index.html', 'ko'], ['de/index.html', 'de']]) {
    assert.strictEqual((await readOutputFile(file)).match(new RegExp(`<img src="/assets/karui-app-store-badge-${language}\\.svg\\?v=\\d+"`, 'g')).length, 2, file);
  }
  assert.match(pages[0], /<div class="karui-demo" role="group" aria-roledescription="carousel"/);
  assert.match(pages[0], /<img class="karui-demo-shot is-current" src="\/assets\/karui-demo-en-1\.jpg\?v=\d+" data-src-en="\/assets\/karui-demo-en-1\.jpg\?v=\d+" data-src-ja="\/assets\/karui-demo-ja-1\.jpg\?v=\d+"/);
  assert.strictEqual(pages[0].match(/class="karui-demo-shot/g).length, 4);
  assert.strictEqual(pages[0].match(/<p class="karui-demo-caption/g).length, 4);
  assert.strictEqual(pages[0].match(/<video/g).length, 2);
  assert.match(pages[0], /<span class="karui-icon-shape"><img src="\/assets\/karui-icon-sketch\.jpg\?v=\d+"[^>]*><video src="\/assets\/karui-icon-sketch\.mp4\?v=\d+" muted loop playsinline/);
  assert.match(pages[0], /<video class="karui-demo-clip" src="\/assets\/karui-demo-en-sort\.mp4\?v=\d+" data-src-en="\/assets\/karui-demo-en-sort\.mp4\?v=\d+" data-src-ja="\/assets\/karui-demo-ja-sort\.mp4\?v=\d+"[^>]* muted loop playsinline/);
  assert.doesNotMatch(pages[0], /karui-shot-|shot-viewer/);
  assert.match(pages[0], /data-src-ko="\/assets\/karui-demo-ko-1\.jpg\?v=\d+"/);
  await Promise.all(['en', 'ja', 'ko'].map((language) => readFile(path.join(outputDirectory, 'assets', `karui-demo-${language}-sort.mp4`))));
  for (const language of ['en', 'ja', 'ko']) {
    for (const screen of [1, 2, 3, 4]) await readFile(path.join(outputDirectory, 'assets', `karui-demo-${language}-${screen}.jpg`));
  }
  assert.match(pages[0], /location\.hash === '#qr'/);
  assert.doesNotMatch(pages[0], /karui-qr-morph/);
  const qrPage = await readOutputFile('qr/index.html');
  assert.match(qrPage, /<link rel="canonical" href="https:\/\/karui\.jp\/qr">/);
  assert.match(qrPage, /<section class="karui-qr" id="qr"/);
  assert.match(qrPage, /<img src="\/assets\/karui-qr\.png\?v=2"/);
  assert.match(qrPage, /<a class="karui-qr-close" href="\/"/);
  // It opens on the 通知をかるく seal that turns into a code, then swipes to the
  // ガルシア one, then the icon code.
  assert.equal(qrPage.match(/<div class="karui-qr-morph">/g).length, 2);
  assert.ok(qrPage.indexOf('karui-qr-seal-tagline-name.png') < qrPage.indexOf('karui-qr-seal-name.png'));
  assert.ok(qrPage.indexOf('karui-qr-seal-name.png') < qrPage.indexOf('karui-qr.png'));
  assert.match(qrPage, /src="\/assets\/karui-qr-seal-tagline-name\.png\?v=6"/);
  assert.match(qrPage, /src="\/assets\/karui-qr-seal-name\.png\?v=6"/);
  assert.match(qrPage, /src="\/assets\/karui-qr-seal\.png\?v=4"/);
  assert.doesNotMatch(qrPage, /karui-qr-hanko/);
  assert.match(pages[0], /class="karui-maker-seal" src="\/assets\/karui-seal\.png/);
  // Tapping the seal opens it large with an explanation on its own page, /seal.
  assert.match(pages[0], /<a href="\/seal" class="karui-seal-trigger"/);
  const sealPage = await readOutputFile('seal/index.html');
  assert.match(sealPage, /<link rel="canonical" href="https:\/\/karui\.jp\/seal">/);
  assert.match(sealPage, /src="\/assets\/karui-seal-large\.png/);
  assert.match(sealPage, /<a class="karui-hanko-close" href="\/"/);
  assert.doesNotMatch(pages[0], /karui-seal-view/);
  // The 通知をかるく seal beside the hero inks in, and tapping it opens it large on its
  // own page, /hanko, which inks in the same way.
  assert.match(pages[0], /<a href="\/hanko" class="karui-hero-seal"[^>]*><img src="\/assets\/karui-seal-tagline\.png/);
  assert.match(pages[0], /<script src="\/karui-seal-ink\.js\?v=1"><\/script>/);
  const hankoPage = await readOutputFile('hanko/index.html');
  assert.match(hankoPage, /<link rel="canonical" href="https:\/\/karui\.jp\/hanko">/);
  assert.match(hankoPage, /src="\/assets\/karui-seal-tagline-large\.png/);
  assert.match(hankoPage, /<script src="\/karui-seal-ink\.js\?v=1"><\/script>/);
  assert.match(hankoPage, /<a class="karui-hanko-close" href="\/"/);
  assert.match(await readOutputFile('karui-seal-ink.js'), /window\.karuiInkIn = /);
  assert.doesNotMatch(qrPage, /data-label-en="QR Code"/);
});

test('publishes llms.txt with links to pages that exist', async () => {
  const llms = await readOutputFile('llms.txt');
  assert.match(llms, /^# Karui\n\n> /);
  const routes = [...llms.matchAll(/\]\(https:\/\/karui\.jp\/([a-z0-9/-]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(routes, ['guides/unwanted-notifications', 'guides/unsent-messages', 'specs', 'technotes/kn001', 'technotes/kn002', 'technotes/kn004', 'technotes/kn005', 'technotes/kn006', 'technotes/kn007', '', 'changelog', 'support', 'privacy', 'technotes', 'guides', 'acknowledgements']);
  for (const route of routes) {
    await readOutputFile(route ? `${route}/index.html` : 'index.html');
  }
  assert.match(await readOutputFile('_headers'), /\/llms\.txt\n\s+Content-Type: text\/plain; charset=utf-8/);
});

test('builds Tech Specs and the Technical Notes, linked from every page', async () => {
  const specsPage = await readOutputFile('specs/index.html');
  const technotesPage = await readOutputFile('technotes/index.html');
  const kn001Page = await readOutputFile('technotes/kn001/index.html');
  const kn002Page = await readOutputFile('technotes/kn002/index.html');
  const kn004Page = await readOutputFile('technotes/kn004/index.html');
  const kn005Page = await readOutputFile('technotes/kn005/index.html');
  const kn006Page = await readOutputFile('technotes/kn006/index.html');
  const kn007Page = await readOutputFile('technotes/kn007/index.html');

  assert.match(specsPage, /<h1[^>]*>Tech Specs<\/h1>/);
  assert.match(technotesPage, /<h1[^>]*>Technical Notes<\/h1>/);
  assert.match(kn001Page, /<h1[^>]*>KN001: Measuring the Background Rate Limit of Apple’s On-Device Foundation Model<\/h1>/);
  assert.match(kn001Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn001">/);
  assert.match(kn001Page, /src="\/assets\/karui-icon-sketch\.jpg\?v=\d+"/);
  assert.match(technotesPage, /href="\/technotes\/kn001"/);
  assert.match(technotesPage, /href="\/technotes\/kn002"/);
  assert.match(kn002Page, /<h1[^>]*>KN002: Accessing Private Cloud Compute in an App Through Shortcuts<\/h1>/);
  assert.match(kn002Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn002">/);
  assert.match(kn001Page, /href="\/technotes\/kn002"/);
  assert.doesNotMatch(technotesPage, /kn003/);
  assert.match(technotesPage, /href="\/technotes\/kn004"/);
  assert.match(kn004Page, /<h1[^>]*>KN004: Verifying What Karui Sends Off Your iPhone<\/h1>/);
  assert.match(kn004Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn004">/);
  assert.match(kn004Page, /href="\/technotes\/kn002"/);
  assert.match(technotesPage, /href="\/technotes\/kn005"/);
  assert.match(kn005Page, /<h1[^>]*>KN005: Translating Notifications Before a Two-Second Deadline<\/h1>/);
  assert.match(kn005Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn005">/);
  assert.match(technotesPage, /href="\/technotes\/kn006"/);
  assert.match(kn006Page, /<h1[^>]*>KN006: Apple’s Private Cloud Compute vs\. Claude Opus 5\.5, etc\. for Categorizing Notifications<\/h1>/);
  assert.match(kn006Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn006">/);
  assert.match(kn006Page, /href="\/technotes\/kn004"/);
  assert.match(technotesPage, /href="\/technotes\/kn007"/);
  assert.match(kn007Page, /<h1[^>]*>KN007: Measuring Phone Checks With the Screen Time API<\/h1>/);
  assert.match(kn007Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn007">/);
  assert.match(kn007Page, /<figure class="karui-viz" id="kn007-chart">/);
  assert.match(kn007Page, /<noscript><img src="\/assets\/karui-kn007-phone-checks-en\.png"/);
  assert.match(specsPage, /href="\/technotes\/kn001"/);

  // The lightning talk lives beside the notes, linked from the notes' page only.
  const talkPage = await readOutputFile('technotes/lightning-talk/index.html');
  assert.match(talkPage, /<h1[^>]*>Lightning Talk: Apple Intelligence in the Background<\/h1>/);
  assert.match(talkPage, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/lightning-talk">/);
  assert.equal([...talkPage.matchAll(/class="karui-slide"/g)].length, 4);
  // Projected, a link does nothing: the slides name their sources without linking them.
  const slidesStart = talkPage.indexOf('class="karui-talk"');
  assert.doesNotMatch(talkPage.slice(slidesStart, talkPage.indexOf('</section>', slidesStart)), /<a /);
  assert.match(technotesPage, /href="\/technotes\/lightning-talk"[^>]*>Lightning Talk: Apple Intelligence in the Background</);
  for (const page of [kn001Page, kn005Page, talkPage]) {
    assert.doesNotMatch(page, /href="\/technotes\/lightning-talk"/);
  }

  const pages = await Promise.all(
    ['index.html', 'privacy/index.html', 'support/index.html', 'acknowledgements/index.html', 'changelog/index.html'].map(readOutputFile),
  );
  for (const page of pages) {
    assert.match(page, /href="\/specs"/);
    assert.match(page, /href="\/technotes"/);
    assert.doesNotMatch(page, /href="\/technotes\/lightning-talk"/);
    assert.doesNotMatch(page, /href="karui-(specs|technotes|technote-kn001)\.html"/);
  }
  for (const page of [specsPage, technotesPage, kn001Page, kn002Page, kn004Page, kn005Page, kn006Page, kn007Page, talkPage]) {
    assert.doesNotMatch(page, /href="karui-[a-z0-9-]+\.html"/);
  }
});

test('copies every asset a built page refers to', async () => {
  const files = await readdir(outputDirectory, { recursive: true });
  const pages = await Promise.all(files.filter((file) => file.endsWith('.html')).map(readOutputFile));
  const assets = new Set(pages.flatMap((page) => [...page.matchAll(/"\/assets\/([^"?]+)/g)].map((match) => match[1])));
  assert.ok(assets.has('karui-app-icon.png'));
  for (const asset of assets) {
    await access(path.join(outputDirectory, 'assets', asset));
  }
});

test('publishes robots.txt, a sitemap of built pages, and a real 404 page', async () => {
  const robots = await readOutputFile('robots.txt');
  assert.match(robots, /^User-agent: \*\nAllow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/karui\.jp\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /Disallow/);

  const sitemap = await readOutputFile('sitemap.xml');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const routes = [...sitemap.matchAll(/<loc>https:\/\/karui\.jp\/([a-z0-9/-]*)<\/loc>/g)].map((match) => match[1]);
  assert.ok(routes.includes('') && routes.includes('specs') && routes.includes('technotes/kn007'));
  assert.ok(!routes.includes('qr'));
  for (const route of routes) {
    await readOutputFile(route ? `${route}/index.html` : 'index.html');
  }

  const notFound = await readOutputFile('404.html');
  assert.match(notFound, /<meta name="robots" content="noindex">/);
  assert.match(notFound, /href="\/"/);
  assert.match(notFound, /href="\/sasu-common\.css\?v=\d+"/);
});

test('describes Karui in schema.org structured data on the home page', async () => {
  const homePage = await readOutputFile('index.html');
  const blocks = [...homePage.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@type'], 'SoftwareApplication');
  assert.equal(data.name, 'Karui');
  assert.equal(data.url, 'https://karui.jp/');
  assert.equal(data.offers.price, '0');
  assert.match(data.downloadUrl, /^https:\/\/apps\.apple\.com\/app\/karui-notifications\/id6814134614$/);
});

// The labeled elements of a built page, as [opening tag, text or content].
function labeledElements(page) {
  return [...page.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-label-en="[^"]*"[^>]*>/g)].map((match) => {
    const [tag, name] = match;
    if (name.toLowerCase() === 'meta') return [tag, tag.match(/\scontent="([^"]*)"/)[1]];
    const rest = page.slice(match.index + tag.length);
    return [tag, rest.slice(0, rest.indexOf(`</${name}>`))];
  });
}

test('builds a page per language with every label translated ahead of time', async () => {
  const pages = [
    ['ja/index.html', 'ja'], ['ko/index.html', 'ko'], ['de/index.html', 'de'],
    ['ja/specs/index.html', 'ja'], ['ja/privacy/index.html', 'ja'], ['ja/changelog/index.html', 'ja'],
    ['ja/technotes/kn006/index.html', 'ja'], ['ja/mac/index.html', 'ja'],
  ];
  for (const [file, language] of pages) {
    const page = await readOutputFile(file);
    assert.match(page, new RegExp(`<html lang="${language}">`), file);
    const elements = labeledElements(page);
    assert.ok(elements.length > 0, file);
    for (const [tag, text] of elements) {
      const label = tag.match(new RegExp(`\\sdata-label-${language}="([^"]*)"`))?.[1];
      if (label === undefined) continue;
      assert.equal(text, tag.startsWith('<meta') ? label : label.replaceAll('<', '&lt;').replaceAll('>', '&gt;'), `${file}: ${tag.slice(0, 80)}`);
    }
    assert.match(page, new RegExp(`setLanguage\\('${language}', false\\);`), file);
    assert.doesNotMatch(page, /setLanguage\(localStorage\.getItem\('karui-language'\)/, file);
  }
  const japaneseHome = await readOutputFile('ja/index.html');
  assert.match(japaneseHome, /<title>Karui：送信取り消しされたメッセージも読める。迷惑通知は消音。<\/title>/);
  assert.match(japaneseHome, /<option value="ja" selected>/);
  assert.match(await readOutputFile('ja/specs/index.html'), /aria-label="Switch to English">English<\/button>/);
});

test('links every language version with hreflang, its own canonical URL, and the switch', async () => {
  const englishHome = await readOutputFile('index.html');
  for (const [code, href] of [['en', '/'], ['ja', '/ja'], ['ko', '/ko'], ['de', '/de'], ['x-default', '/']]) {
    assert.match(englishHome, new RegExp(`<link rel="alternate" hreflang="${code}" href="https://karui\\.jp${href}">`));
  }
  assert.match(englishHome, /<link rel="canonical" href="https:\/\/karui\.jp\/">/);
  assert.match(englishHome, /setLanguage\(localStorage\.getItem\('karui-language'\) \|\| preferredLanguage\(\), false\);/);
  assert.match(englishHome, /languageSelect\.addEventListener\('change', \(\) => switchLanguage\(languageSelect\.value\)\);/);

  const japaneseSpecs = await readOutputFile('ja/specs/index.html');
  assert.match(japaneseSpecs, /<link rel="canonical" href="https:\/\/karui\.jp\/ja\/specs">/);
  assert.match(japaneseSpecs, /<meta property="og:url" content="https:\/\/karui\.jp\/ja\/specs"/);
  assert.match(japaneseSpecs, /<link rel="alternate" hreflang="en" href="https:\/\/karui\.jp\/specs">/);
  assert.match(japaneseSpecs, /const languagePages = \{"en":"\/specs","ja":"\/ja\/specs"\};/);
  assert.match(japaneseSpecs, /href="\/ja\/privacy"/);
  assert.doesNotMatch(japaneseSpecs, /href="\/privacy"/);

  // Korean and German exist only for the home page, so its links go to the English pages.
  const koreanHome = await readOutputFile('ko/index.html');
  assert.match(koreanHome, /href="\/privacy"/);
  assert.doesNotMatch(koreanHome, /href="\/ko\/privacy"/);

  const sitemap = await readOutputFile('sitemap.xml');
  for (const loc of ['https://karui.jp/ja', 'https://karui.jp/ko', 'https://karui.jp/de', 'https://karui.jp/ja/technotes/kn007']) {
    assert.match(sitemap, new RegExp(`<loc>${loc.replaceAll('.', '\\.')}</loc>`));
  }
});

test('builds the guides in English and Japanese, linked from every page footer', async () => {
  for (const [route, title, japaneseTitle] of [
    ['guides/unwanted-notifications', 'How to Stop Unwanted Notifications on iPhone', 'iPhoneの迷惑通知を止める方法'],
    ['guides/unsent-messages', 'How to See Unsent Messages on iPhone', 'iPhoneで送信取り消しされたメッセージを見る方法'],
  ]) {
    const english = await readOutputFile(`${route}/index.html`);
    const japanese = await readOutputFile(`ja/${route}/index.html`);
    assert.match(english, new RegExp(`<h1[^>]*>${title}</h1>`));
    assert.match(japanese, new RegExp(`<title>${japaneseTitle}</title>`));
    assert.match(japanese, new RegExp(`<h1[^>]*>${japaneseTitle}</h1>`));
    assert.match(english, /href="https:\/\/apps\.apple\.com\/app\/karui-notifications\/id6814134614"/);
    assert.match(english, /href="\/guides"/);
    assert.match(japanese, /href="\/ja\/guides"/);
  }
  assert.match(await readOutputFile('guides/index.html'), /href="\/guides\/unsent-messages"/);
  for (const file of ['index.html', 'specs/index.html', 'support/index.html', 'technotes/kn007/index.html']) {
    assert.match(await readOutputFile(file), /<p class="footer-links">.*href="\/guides"/, file);
  }
  assert.match(await readOutputFile('ja/index.html'), /href="\/ja\/guides"/);
  assert.match(await readOutputFile('ko/index.html'), />가이드</);
});

test('publishes latest-release.json for the portfolio desk accessory without pending builds or no-changes lines', async () => {
  const [distRaw, rootRaw, headers] = await Promise.all([
    readOutputFile('latest-release.json'),
    readFile(path.join(rootDirectory, 'data', 'karui-latest.json'), 'utf8'),
    readOutputFile('_headers'),
  ]);
  assert.equal(distRaw, rootRaw);
  const release = JSON.parse(distRaw);
  assert.match(release.version, /^\d+\.\d+(?:\.\d+)?$/);
  assert.ok(release.date.length > 0);
  assert.ok(release.notes.en.length > 0);
  assert.equal(release.notes.en.length, release.notes.ja.length);
  for (const note of [...release.notes.en, ...release.notes.ja]) {
    assert.doesNotMatch(note, /No changes since the previous build|前のビルドからの変更はありません/);
    assert.doesNotMatch(note, /&(?:quot|apos|amp|lt|gt|#x?[0-9a-f]+);/i);
  }
  assert.match(headers, /\/latest-release\.json[\s\S]*Access-Control-Allow-Origin: \*/);
});
