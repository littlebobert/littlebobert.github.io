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
  // The landing page keeps only the current-version label; entries live on /changelog.
  assert.doesNotMatch(pages[0], /karui-changelog:start/);
  assert.match(pages[0], /data-karui-current-version/);
});

test('publishes llms.txt with links to pages that exist', async () => {
  const llms = await readOutputFile('llms.txt');
  assert.match(llms, /^# Karui\n\n> /);
  const routes = [...llms.matchAll(/\]\(https:\/\/karui\.jp\/([a-z]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(routes, ['', 'changelog', 'support', 'privacy', 'acknowledgements']);
  for (const route of routes) {
    await readOutputFile(route ? `${route}/index.html` : 'index.html');
  }
  assert.match(await readOutputFile('_headers'), /\/llms\.txt\n\s+Content-Type: text\/plain; charset=utf-8/);
});
