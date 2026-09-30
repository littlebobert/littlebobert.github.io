import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

  assert.match(acknowledgementsPage, /href="\/sasu-common\.css\?v=4"/);
  assert.match(acknowledgementsPage, /href="\/assets\/karui-favicon\.png\?v=1"/);
  assert.match(acknowledgementsPage, /src="\/assets\/karui-icon\.png\?v=2"/);
  assert.match(acknowledgementsPage, /href="\/"/);
  assert.match(acknowledgementsPage, /href="\/privacy"/);
  assert.match(acknowledgementsPage, /href="\/support"/);
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
  // karui.jp/#qr, or tapping the icon, opens a full-screen QR code for showing the site in person.
  assert.match(pages[0], /<section class="karui-qr" id="qr"/);
  assert.match(pages[0], /<img src="\/assets\/karui-qr\.png\?v=1"/);
  // #qr opens on the 通知を軽く seal that turns into a code, then swipes to the
  // ガルシア one, then the icon code.
  assert.equal(pages[0].match(/<div class="karui-qr-morph">/g).length, 2);
  assert.ok(pages[0].indexOf('karui-qr-seal-tagline-name.png') < pages[0].indexOf('karui-qr-seal-name.png'));
  assert.ok(pages[0].indexOf('karui-qr-seal-name.png') < pages[0].indexOf('karui-qr.png'));
  assert.match(pages[0], /src="\/assets\/karui-qr-seal-tagline-name\.png\?v=1"/);
  assert.match(pages[0], /src="\/assets\/karui-qr-seal-name\.png\?v=3"/);
  assert.match(pages[0], /src="\/assets\/karui-qr-seal\.png\?v=3"/);
  assert.doesNotMatch(pages[0], /karui-qr-hanko/);
  assert.match(pages[0], /class="karui-maker-seal" src="\/assets\/karui-seal\.png/);
  // Tapping the seal opens it large with an explanation at #seal.
  assert.match(pages[0], /<a href="#seal" class="karui-seal-trigger"/);
  assert.match(pages[0], /<section class="karui-seal-view" id="seal"/);
  assert.match(pages[0], /src="\/assets\/karui-seal-large\.png/);
  // The 通知を軽く seal beside the hero inks in, and tapping it opens it large on its
  // own page, /hanko, which inks in the same way.
  assert.match(pages[0], /<a href="\/hanko" class="karui-hero-seal"[^>]*><img src="\/assets\/karui-seal-tagline\.png/);
  assert.match(pages[0], /<script src="\/karui-seal-ink\.js\?v=1"><\/script>/);
  const hankoPage = await readOutputFile('hanko/index.html');
  assert.match(hankoPage, /<link rel="canonical" href="https:\/\/karui\.jp\/hanko">/);
  assert.match(hankoPage, /src="\/assets\/karui-seal-tagline-large\.png/);
  assert.match(hankoPage, /<script src="\/karui-seal-ink\.js\?v=1"><\/script>/);
  assert.match(hankoPage, /<a class="karui-hanko-close" href="\/"/);
  assert.match(await readOutputFile('karui-seal-ink.js'), /window\.karuiInkIn = /);
  assert.match(pages[0], /<a href="#qr" class="karui-qr-trigger"/);
  assert.doesNotMatch(pages[0], /data-label-en="QR Code"/);
});

test('publishes llms.txt with links to pages that exist', async () => {
  const llms = await readOutputFile('llms.txt');
  assert.match(llms, /^# Karui\n\n> /);
  const routes = [...llms.matchAll(/\]\(https:\/\/karui\.jp\/([a-z0-9/]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(routes, ['specs', 'technotes/kn001', '', 'changelog', 'support', 'privacy', 'acknowledgements']);
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
  const kn003Page = await readOutputFile('technotes/kn003/index.html');
  const kn004Page = await readOutputFile('technotes/kn004/index.html');
  const kn005Page = await readOutputFile('technotes/kn005/index.html');

  assert.match(specsPage, /<h1[^>]*>Tech Specs<\/h1>/);
  assert.match(technotesPage, /<h1[^>]*>Technical Notes<\/h1>/);
  assert.match(kn001Page, /<h1[^>]*>KN001: Measuring the Background Rate Limit of Apple’s On-Device Foundation Model<\/h1>/);
  assert.match(kn001Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn001">/);
  assert.match(kn001Page, /src="\/assets\/karui-icon\.png\?v=2"/);
  assert.match(technotesPage, /href="\/technotes\/kn001"/);
  assert.match(technotesPage, /href="\/technotes\/kn002"/);
  assert.match(kn002Page, /<h1[^>]*>KN002: Accessing Private Cloud Compute in an App Through Shortcuts<\/h1>/);
  assert.match(kn002Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn002">/);
  assert.match(kn001Page, /href="\/technotes\/kn002"/);
  assert.match(technotesPage, /href="\/technotes\/kn003"/);
  assert.match(kn003Page, /<h1[^>]*>KN003: Getting Reliable Answers from the On-Device Apple Foundation Model<\/h1>/);
  assert.match(kn003Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn003">/);
  assert.match(technotesPage, /href="\/technotes\/kn004"/);
  assert.match(kn004Page, /<h1[^>]*>KN004: Verifying What Karui Sends Off Your iPhone<\/h1>/);
  assert.match(kn004Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn004">/);
  assert.match(kn004Page, /href="\/technotes\/kn002"/);
  assert.match(technotesPage, /href="\/technotes\/kn005"/);
  assert.match(kn005Page, /<h1[^>]*>KN005: Translating Notifications Before a Two-Second Deadline<\/h1>/);
  assert.match(kn005Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn005">/);
  assert.match(kn005Page, /href="\/technotes\/kn004"/);
  assert.match(specsPage, /href="\/technotes\/kn001"/);

  const pages = await Promise.all(
    ['index.html', 'privacy/index.html', 'support/index.html', 'acknowledgements/index.html', 'changelog/index.html'].map(readOutputFile),
  );
  for (const page of pages) {
    assert.match(page, /href="\/specs"/);
    assert.match(page, /href="\/technotes"/);
    assert.doesNotMatch(page, /href="karui-(specs|technotes|technote-kn001)\.html"/);
  }
  for (const page of [specsPage, technotesPage, kn001Page, kn002Page, kn003Page, kn004Page, kn005Page]) {
    assert.doesNotMatch(page, /href="karui-[a-z0-9-]+\.html"/);
  }
});
