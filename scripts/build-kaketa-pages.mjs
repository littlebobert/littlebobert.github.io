import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds the kaketa.jp site into dist-kaketa/: the Kaketa pages at clean routes, with
// the shared stylesheet, the language script, and the assets they use.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-kaketa');
const assetsDirectory = path.join(outputDirectory, 'assets');

const siteFiles = ['_headers', 'sasu-common.css', 'kaketa-language.js'];

const assetFiles = [
  'kaketa-favicon.png',
  'kaketa-icon.png',
  'kaketa-social.png',
  'kaketa-apple-touch-icon.png',
  'kaketa-landing-shot-en.webp',
  'kaketa-landing-shot-ja.webp',
  'kaketa-landing-shot-fil.webp',
  'kaketa-qr-seal.png',
  'kaketa-qr-seal-name.png',
  'kaketa-qr-seal.json',
];

// Source page → the routes it is served at.
const pages = [
  ['kaketa.html', ['index.html', 'kaketa.html']],
  ['kaketa-privacy.html', ['privacy.html', 'privacy/index.html']],
  ['kaketa-support.html', ['support.html', 'support/index.html']],
  ['kaketa-changelog.html', ['changelog.html', 'changelog/index.html']],
  ['kaketa-acknowledgements.html', ['acknowledgements.html', 'acknowledgements/index.html']],
  ['kaketa-technotes.html', ['technotes.html', 'technotes/index.html']],
  ['kaketa-technote-kn001.html', ['technotes/kn001.html', 'technotes/kn001/index.html']],
  ['kaketa-qr.html', ['qr.html', 'qr/index.html']],
];

export function createDeployedPage(source) {
  return source
    .replaceAll('href="sasu-common.css', 'href="/sasu-common.css')
    .replaceAll('src="kaketa-language.js', 'src="/kaketa-language.js')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replace(/(data-src-\w+)="assets\//g, '$1="/assets/')
    .replaceAll('href="kaketa.html"', 'href="/"')
    .replaceAll('href="kaketa-privacy.html"', 'href="/privacy"')
    .replaceAll('href="kaketa-support.html"', 'href="/support"')
    .replaceAll('href="kaketa-changelog.html"', 'href="/changelog"')
    .replaceAll('href="kaketa-acknowledgements.html"', 'href="/acknowledgements"')
    .replaceAll('href="kaketa-technotes.html"', 'href="/technotes"')
    .replaceAll('href="kaketa-technote-kn001.html"', 'href="/technotes/kn001"')
    .replaceAll('href="kaketa-qr.html"', 'href="/qr"');
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(assetsDirectory, { recursive: true });
await Promise.all(
  siteFiles.map((file) => cp(path.join(rootDirectory, file), path.join(outputDirectory, file))),
);
await Promise.all(
  assetFiles.map((file) => cp(path.join(rootDirectory, 'assets', file), path.join(assetsDirectory, file))),
);
// Served at kaketa.jp/llms.txt for AI agents; the portfolio has its own llms.txt.
await cp(path.join(rootDirectory, 'kaketa-llms.txt'), path.join(outputDirectory, 'llms.txt'));
await Promise.all(
  pages.map(async ([source, outputs]) => {
    const page = createDeployedPage(await readFile(path.join(rootDirectory, source), 'utf8'));
    await Promise.all(
      outputs.map(async (output) => {
        const target = path.join(outputDirectory, output);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, page);
      }),
    );
  }),
);

console.log(`Built Kaketa Pages site in ${outputDirectory}`);
