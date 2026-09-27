import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputDirectory = path.join(rootDirectory, 'dist-shadan');

await import('../scripts/build-shadan-pages.mjs');

async function readOutputFile(relativePath) {
  return readFile(path.join(outputDirectory, relativePath), 'utf8');
}

test('builds every Shadan clean route', async () => {
  const [homePage, privacyPage, supportPage, acknowledgementsPage] =
    await Promise.all([
      readOutputFile('index.html'),
      readOutputFile('privacy/index.html'),
      readOutputFile('support/index.html'),
      readOutputFile('acknowledgements/index.html'),
    ]);

  assert.match(homePage, /<h1>Shadan<\/h1>/);
  assert.match(acknowledgementsPage, /<h1[^>]*>Acknowledgements<\/h1>/);
  assert.notEqual(acknowledgementsPage, homePage);

  for (const page of [homePage, privacyPage, supportPage]) {
    assert.match(page, /href="\/acknowledgements"/);
    assert.doesNotMatch(page, /href="shadan-acknowledgements\.html"/);
  }

  for (const [route, page] of [['privacy', privacyPage], ['support', supportPage], ['acknowledgements', acknowledgementsPage]]) {
    assert.match(page, new RegExp(`<link rel="canonical" href="https://shadan\\.jp/${route}">`));
  }
  assert.match(homePage, /<link rel="canonical" href="https:\/\/shadan\.jp\/">/);

  assert.match(acknowledgementsPage, /href="\/sasu-common\.css\?v=4"/);
  assert.match(acknowledgementsPage, /href="\/assets\/shadan-favicon\.png\?v=1"/);
  assert.match(acknowledgementsPage, /src="\/assets\/shadan-icon\.png\?v=1"/);
  assert.match(acknowledgementsPage, /href="\/"/);
  assert.match(acknowledgementsPage, /href="\/privacy"/);
  assert.match(acknowledgementsPage, /href="\/support"/);

  for (const asset of ['shadan-favicon.png', 'shadan-icon.png', 'shadan-social.png']) {
    await readFile(path.join(outputDirectory, 'assets', asset));
  }
});

test('builds the changelog page and links to it from every page', async () => {
  const pages = await Promise.all(
    ['index.html', 'privacy/index.html', 'support/index.html', 'acknowledgements/index.html'].map(readOutputFile),
  );
  const changelogPage = await readOutputFile('changelog/index.html');
  assert.equal(await readOutputFile('changelog.html'), changelogPage);

  assert.match(changelogPage, /<h1[^>]*>Changelog<\/h1>/);
  assert.match(changelogPage, /<!-- shadan-changelog:start -->[\s\S]*<!-- shadan-changelog:end -->/);
  assert.match(changelogPage, /<link rel="canonical" href="https:\/\/shadan\.jp\/changelog">/);
  for (const route of ['/', '/specs', '/privacy', '/support', '/acknowledgements']) {
    assert.match(changelogPage, new RegExp(`href="${route}"`));
  }

  for (const page of pages) {
    assert.match(page, /href="\/changelog"/);
    assert.doesNotMatch(page, /href="shadan-changelog\.html"/);
  }
  // The landing page keeps only the current-version label; entries live on /changelog.
  assert.doesNotMatch(pages[0], /shadan-changelog:start/);
  assert.match(pages[0], /data-shadan-current-version/);
});

test('landing page has a demo section and a coming-soon button or a tracked download link', async () => {
  const homePage = await readOutputFile('index.html');
  assert.match(homePage, /<section class="shadan-demo"/);
  assert.match(homePage, /<video src="\/assets\/shadan-demo\.mp4\?v=1" poster="\/assets\/shadan-demo-poster\.jpg\?v=1" controls/);
  await readOutputFile('assets/shadan-demo.mp4');
  await readOutputFile('assets/shadan-demo-poster.jpg');
  // Before the first release: a grey "Coming soon" button and no tracked link.
  // After scripts/update-site.py in the Shadan repo: a tracked GitHub download.
  const withoutComments = homePage.replace(/<!--[\s\S]*?-->/g, '');
  const download = withoutComments.match(/<a class="download-link" data-product="shadan"[^>]*>/);
  if (download) {
    assert.match(download[0], /data-product-action="download-macos"/);
    assert.match(download[0], /href="https:\/\/github\.com\/littlebobert\/shadan-releases\/releases\/download\/([^/"]+)\/Shadan-\1-mac\.zip"/);
    assert.doesNotMatch(withoutComments, /is-coming-soon"/);
  } else {
    assert.match(withoutComments, /<span class="download-link is-coming-soon"/);
  }
  assert.match(homePage, /<script src="product-click-tracking\.js"><\/script>/);
  await readOutputFile('product-click-tracking.js');
});

test('publishes the Sparkle appcast with no-cache XML headers', async () => {
  const appcast = await readOutputFile('shadan-appcast.xml');
  assert.equal(appcast, await readFile(path.join(rootDirectory, 'shadan-appcast.xml'), 'utf8'));
  assert.match(appcast, /xmlns:sparkle="http:\/\/www\.andymatuschak\.org\/xml-namespaces\/sparkle"/);
  assert.match(appcast, /<title>Shadan<\/title>/);
  assert.match(appcast, /<link>https:\/\/shadan\.jp\/<\/link>/);
  assert.match(
    await readOutputFile('_headers'),
    /\/shadan-appcast\.xml\n\s+Cache-Control: no-cache\n\s+Content-Type: application\/xml; charset=utf-8/,
  );
});

test('publishes llms.txt with links to pages that exist', async () => {
  const llms = await readOutputFile('llms.txt');
  assert.match(llms, /^# Shadan\n\n> /);
  const routes = [...llms.matchAll(/\]\(https:\/\/shadan\.jp\/([a-z]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(routes, ['', 'specs', 'changelog', 'support', 'privacy', 'acknowledgements']);
  for (const route of routes) {
    await readOutputFile(route ? `${route}/index.html` : 'index.html');
  }
  assert.match(await readOutputFile('_headers'), /\/llms\.txt\n\s+Content-Type: text\/plain; charset=utf-8/);
});

test('builds the tech specs page at /specs, linked from every page', async () => {
  const specsPage = await readOutputFile('specs/index.html');
  assert.match(specsPage, /<h1[^>]*>Tech Specs<\/h1>/);
  assert.match(specsPage, /<link rel="canonical" href="https:\/\/shadan\.jp\/specs">/);
  assert.match(specsPage, /About 97%|about 97%/);
  for (const file of ['index.html', 'privacy/index.html', 'support/index.html', 'changelog/index.html', 'acknowledgements/index.html']) {
    const page = await readOutputFile(file);
    assert.match(page, /href="\/specs"/, file);
    assert.doesNotMatch(page, /href="shadan-specs\.html"/, file);
  }
});
