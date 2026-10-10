import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-kaketa');

await import('../scripts/build-kaketa-pages.mjs');

async function readOutputFile(relativePath) {
  return readFile(path.join(outputDirectory, relativePath), 'utf8');
}

test('builds every Kaketa clean route', async () => {
  const [homePage, privacyPage, supportPage, changelogPage, acknowledgementsPage] = await Promise.all([
    readOutputFile('index.html'),
    readOutputFile('privacy/index.html'),
    readOutputFile('support/index.html'),
    readOutputFile('changelog/index.html'),
    readOutputFile('acknowledgements/index.html'),
  ]);

  assert.match(homePage, /<h1>Kaketa<\/h1>/);
  assert.match(privacyPage, /Privacy Policy/);
  assert.match(supportPage, /Support/);
  assert.match(changelogPage, /kaketa-changelog:start/);
  assert.match(acknowledgementsPage, /KanjiVG/);

  for (const page of [homePage, privacyPage, supportPage, changelogPage, acknowledgementsPage]) {
    assert.match(page, /href="\/sasu-common\.css\?v=\d+"/);
    assert.match(page, /src="\/kaketa-language\.js\?v=\d+"/);
    assert.match(page, /href="\/assets\/kaketa-favicon\.png\?v=1"/);
    assert.match(page, /href="\/privacy"/);
    assert.match(page, /href="\/support"/);
    assert.match(page, /href="\/changelog"/);
    assert.match(page, /href="\/acknowledgements"/);
    assert.doesNotMatch(page, /href="kaketa[-a-z]*\.html"/);
    assert.match(page, /data-label-fil=/);
  }
  for (const page of [privacyPage, supportPage, changelogPage, acknowledgementsPage]) {
    assert.match(page, /href="\/"/);
  }
});

test('copies the shared files and assets', async () => {
  await readOutputFile('sasu-common.css');
  await readOutputFile('kaketa-language.js');
  await readOutputFile('_headers');
  await readFile(path.join(outputDirectory, 'assets/kaketa-icon.png'));
});
