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
const specsDirectory = path.join(outputDirectory, 'specs');
const technotesDirectory = path.join(outputDirectory, 'technotes');
const kn001Directory = path.join(technotesDirectory, 'kn001');
const kn002Directory = path.join(technotesDirectory, 'kn002');
const kn003Directory = path.join(technotesDirectory, 'kn003');
const kn004Directory = path.join(technotesDirectory, 'kn004');
const kn005Directory = path.join(technotesDirectory, 'kn005');

const siteFiles = [
  '_headers',
  'sasu-common.css',
  'karui-seal-ink.js',
];

const assetFiles = [
  'karui-favicon.png',
  'karui-developer.jpg',
  'karui-icon.png',
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
  ...['en', 'ja'].flatMap((language) => [`karui-demo-${language}.mp4`, `karui-demo-${language}.jpg`]),
];

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(assetsDirectory, { recursive: true }),
  mkdir(privacyDirectory, { recursive: true }),
  mkdir(supportDirectory, { recursive: true }),
  mkdir(acknowledgementsDirectory, { recursive: true }),
  mkdir(changelogDirectory, { recursive: true }),
  mkdir(path.join(outputDirectory, 'hanko'), { recursive: true }),
  mkdir(path.join(outputDirectory, 'seal'), { recursive: true }),
  mkdir(path.join(outputDirectory, 'qr'), { recursive: true }),
  mkdir(specsDirectory, { recursive: true }),
  mkdir(kn001Directory, { recursive: true }),
  mkdir(kn002Directory, { recursive: true }),
  mkdir(kn003Directory, { recursive: true }),
  mkdir(kn004Directory, { recursive: true }),
  mkdir(kn005Directory, { recursive: true }),
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
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('data-src-en="assets/', 'data-src-en="/assets/')
    .replaceAll('data-src-ja="assets/', 'data-src-ja="/assets/')
    .replaceAll('poster="assets/', 'poster="/assets/')
    .replaceAll('data-poster-en="assets/', 'data-poster-en="/assets/')
    .replaceAll('data-poster-ja="assets/', 'data-poster-ja="/assets/')
    .replaceAll('href="karui.html"', 'href="/"')
    .replaceAll('href="karui-privacy.html"', 'href="/privacy"')
    .replaceAll('href="karui-support.html"', 'href="/support"')
    .replaceAll(
      'href="karui-acknowledgements.html"',
      'href="/acknowledgements"',
    )
    .replaceAll('href="karui-changelog.html"', 'href="/changelog"')
    .replaceAll('href="karui-hanko.html"', 'href="/hanko"')
    .replaceAll('href="karui-seal.html"', 'href="/seal"')
    .replaceAll('href="karui-qr.html"', 'href="/qr"')
    .replaceAll('href="karui-specs.html"', 'href="/specs"')
    .replaceAll('href="karui-technotes.html"', 'href="/technotes"')
    .replaceAll('href="karui-technote-kn001.html"', 'href="/technotes/kn001"')
    .replaceAll('href="karui-technote-kn002.html"', 'href="/technotes/kn002"')
    .replaceAll('href="karui-technote-kn003.html"', 'href="/technotes/kn003"')
    .replaceAll('href="karui-technote-kn004.html"', 'href="/technotes/kn004"')
    .replaceAll('href="karui-technote-kn005.html"', 'href="/technotes/kn005"');
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

// Tech Specs, the Technical Notes, and the /hanko, /seal, and /qr pages, each at a clean route.
const technicalPages = [
  ['karui-hanko.html', ['hanko.html', 'hanko/index.html']],
  ['karui-seal.html', ['seal.html', 'seal/index.html']],
  ['karui-qr.html', ['qr.html', 'qr/index.html']],
  ['karui-specs.html', ['specs.html', 'specs/index.html']],
  ['karui-technotes.html', ['technotes.html', 'technotes/index.html']],
  ['karui-technote-kn001.html', ['technotes/kn001.html', 'technotes/kn001/index.html']],
  ['karui-technote-kn002.html', ['technotes/kn002.html', 'technotes/kn002/index.html']],
  ['karui-technote-kn003.html', ['technotes/kn003.html', 'technotes/kn003/index.html']],
  ['karui-technote-kn004.html', ['technotes/kn004.html', 'technotes/kn004/index.html']],
  ['karui-technote-kn005.html', ['technotes/kn005.html', 'technotes/kn005/index.html']],
];
await Promise.all(
  technicalPages.map(async ([source, outputs]) => {
    const page = createDeployedPage(await readFile(path.join(rootDirectory, source), 'utf8'));
    await Promise.all(outputs.map((output) => writeFile(path.join(outputDirectory, output), page)));
  }),
);

console.log(`Built Karui Pages site in ${outputDirectory}`);
