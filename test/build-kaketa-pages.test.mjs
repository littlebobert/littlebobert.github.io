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
  const [homePage, privacyPage, supportPage, changelogPage, acknowledgementsPage, technotesPage, kn001Page] = await Promise.all([
    readOutputFile('index.html'),
    readOutputFile('privacy/index.html'),
    readOutputFile('support/index.html'),
    readOutputFile('changelog/index.html'),
    readOutputFile('acknowledgements/index.html'),
    readOutputFile('technotes/index.html'),
    readOutputFile('technotes/kn001/index.html'),
  ]);

  assert.match(homePage, /<h1>Kaketa<\/h1>/);
  assert.match(privacyPage, /Privacy Policy/);
  assert.match(supportPage, /Support/);
  assert.match(changelogPage, /kaketa-changelog:start/);
  assert.match(acknowledgementsPage, /KanjiVG/);
  assert.match(technotesPage, /href="\/technotes\/kn001"/);
  assert.match(kn001Page, /KN001/);

  for (const page of [homePage, privacyPage, supportPage, changelogPage, acknowledgementsPage, technotesPage, kn001Page]) {
    assert.match(page, /href="\/sasu-common\.css\?v=\d+"/);
    assert.match(page, /src="\/kaketa-language\.js\?v=\d+"/);
    assert.match(page, /href="\/assets\/kaketa-favicon\.png\?v=1"/);
    assert.match(page, /href="\/privacy"/);
    assert.match(page, /href="\/support"/);
    assert.match(page, /href="\/changelog"/);
    assert.match(page, /href="\/acknowledgements"/);
    assert.match(page, /href="\/technotes"/);
    assert.doesNotMatch(page, /href="kaketa[-a-z]*\.html"/);
    assert.match(page, /data-label-fil=/);
  }
  for (const page of [privacyPage, supportPage, changelogPage, acknowledgementsPage, technotesPage, kn001Page]) {
    assert.match(page, /href="\/"/);
  }
});

test('copies the shared files and assets', async () => {
  await readOutputFile('sasu-common.css');
  await readOutputFile('kaketa-language.js');
  await readOutputFile('_headers');
  await readFile(path.join(outputDirectory, 'assets/kaketa-icon.png'));
  await readFile(path.join(outputDirectory, 'assets/kaketa-social.png'));
  for (const language of ['en', 'ja', 'fil']) {
    await readFile(path.join(outputDirectory, `assets/kaketa-landing-shot-${language}.webp`));
  }
});

test('publishes llms.txt with links to pages that exist', async () => {
  const llms = await readOutputFile('llms.txt');
  assert.match(llms, /^# Kaketa\n\n> /);
  const routes = [...llms.matchAll(/\]\(https:\/\/kaketa\.jp\/([a-z0-9/]*)\)/g)].map((match) => match[1]);
  assert.ok(routes.length >= 6);
  for (const route of routes) {
    await readOutputFile(route === '' ? 'index.html' : `${route}/index.html`);
  }
  assert.match(await readOutputFile('_headers'), /\/llms\.txt\n\s+Content-Type: text\/plain; charset=utf-8/);
});

test('the icon opens the QR page, whose seal turns into a tested code', async () => {
  const homePage = await readOutputFile('index.html');
  assert.match(homePage, /<a href="\/qr" class="kaketa-qr-trigger"/);
  const qrPage = await readOutputFile('qr/index.html');
  assert.match(qrPage, /<link rel="canonical" href="https:\/\/kaketa\.jp\/qr">/);
  assert.match(qrPage, /<img class="kaketa-qr-morph-final" src="\/assets\/kaketa-qr-seal\.png\?v=1"/);
  assert.match(qrPage, /<a class="kaketa-qr-close" href="\/"/);
  assert.match(qrPage, /src="\/kaketa-language\.js\?v=\d+"/);
  await readFile(path.join(outputDirectory, 'assets/kaketa-qr-seal.json'));
});
