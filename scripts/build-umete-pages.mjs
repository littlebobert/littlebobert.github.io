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
  'product-click-tracking.js',
  'sasu-common.css',
  'umete-language.js',
  'ume-appcast.xml',
];

const assetFiles = [
  'ume-icon.png',
  'umete-social.png',
  // The landing page's carousel, from the Umete repository's AppStoreScreenshots.
  'umete-landing-fill.webp',
  'umete-landing-remembers.webp',
  'umete-landing-private.webp',
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
];

export function createDeployedPage(source) {
  return source
    .replaceAll('href="sasu-common.css', 'href="/sasu-common.css')
    .replaceAll('src="umete-language.js', 'src="/umete-language.js')
    .replaceAll('src="product-click-tracking.js', 'src="/product-click-tracking.js')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('href="ume.html"', 'href="/"')
    .replaceAll('href="ume-privacy.html"', 'href="/privacy"')
    .replaceAll('href="ume-support.html"', 'href="/support"')
    .replaceAll('href="ume-changelog.html"', 'href="/changelog"')
    .replaceAll('href="ume-specs.html"', 'href="/specs"')
    .replaceAll('href="ume-acknowledgements.html"', 'href="/acknowledgements"');
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

console.log(`Built Umete Pages site in ${outputDirectory}`);
