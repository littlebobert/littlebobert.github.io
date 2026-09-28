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

  assert.match(specsPage, /<h1[^>]*>Tech Specs<\/h1>/);
  assert.match(technotesPage, /<h1[^>]*>Technical Notes<\/h1>/);
  assert.match(kn001Page, /<h1[^>]*>KN001: Foundation Models in the Background<\/h1>/);
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
  assert.match(kn004Page, /<h1[^>]*>KN004: Verifying That Karui Makes No Network Connections<\/h1>/);
  assert.match(kn004Page, /<link rel="canonical" href="https:\/\/karui\.jp\/technotes\/kn004">/);
  assert.match(kn004Page, /href="\/technotes\/kn002"/);
  assert.match(specsPage, /href="\/technotes\/kn001"/);

  const pages = await Promise.all(
    ['index.html', 'privacy/index.html', 'support/index.html', 'acknowledgements/index.html', 'changelog/index.html'].map(readOutputFile),
  );
  for (const page of pages) {
    assert.match(page, /href="\/specs"/);
    assert.match(page, /href="\/technotes"/);
    assert.doesNotMatch(page, /href="karui-(specs|technotes|technote-kn001)\.html"/);
  }
  for (const page of [specsPage, technotesPage, kn001Page, kn002Page, kn003Page, kn004Page]) {
    assert.doesNotMatch(page, /href="karui-[a-z0-9-]+\.html"/);
  }
});
