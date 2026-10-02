import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-shadan');
const assetsDirectory = path.join(outputDirectory, 'assets');
const privacyDirectory = path.join(outputDirectory, 'privacy');
const specsDirectory = path.join(outputDirectory, 'specs');
const supportDirectory = path.join(outputDirectory, 'support');
const acknowledgementsDirectory = path.join(outputDirectory, 'acknowledgements');
const changelogDirectory = path.join(outputDirectory, 'changelog');

const siteFiles = [
  '_headers',
  'product-click-tracking.js',
  'sasu-common.css',
  // Sparkle feed the app checks at https://shadan.jp/shadan-appcast.xml.
  'shadan-appcast.xml',
];

const assetFiles = [
  'shadan-favicon.png',
  'shadan-icon.png',
  'shadan-social.png',
  'shadan-demo.mp4',
  'shadan-demo-poster.jpg',
];

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(assetsDirectory, { recursive: true }),
  mkdir(privacyDirectory, { recursive: true }),
  mkdir(specsDirectory, { recursive: true }),
  mkdir(supportDirectory, { recursive: true }),
  mkdir(acknowledgementsDirectory, { recursive: true }),
  mkdir(changelogDirectory, { recursive: true }),
]);

await Promise.all(
  siteFiles.map((file) =>
    cp(path.join(rootDirectory, file), path.join(outputDirectory, file)),
  ),
);

// Served at shadan.jp/llms.txt for AI agents; the portfolio has its own llms.txt.
await cp(path.join(rootDirectory, 'shadan-llms.txt'), path.join(outputDirectory, 'llms.txt'));

await Promise.all(
  assetFiles.map((file) =>
    cp(path.join(rootDirectory, 'assets', file), path.join(assetsDirectory, file)),
  ),
);

function createDeployedPage(source) {
  return source
    .replaceAll('href="sasu-common.css', 'href="/sasu-common.css')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('poster="assets/', 'poster="/assets/')
    .replaceAll('data-src-en="assets/', 'data-src-en="/assets/')
    .replaceAll('data-src-ja="assets/', 'data-src-ja="/assets/')
    .replaceAll('href="shadan.html"', 'href="/"')
    .replaceAll('href="shadan-privacy.html"', 'href="/privacy"')
    .replaceAll('href="shadan-specs.html"', 'href="/specs"')
    .replaceAll('href="shadan-support.html"', 'href="/support"')
    .replaceAll(
      'href="shadan-acknowledgements.html"',
      'href="/acknowledgements"',
    )
    .replaceAll('href="shadan-changelog.html"', 'href="/changelog"');
}

const [homeSource, privacySource, supportSource, acknowledgementsSource, changelogSource, specsSource] =
  await Promise.all([
    readFile(path.join(rootDirectory, 'shadan.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'shadan-privacy.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'shadan-support.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'shadan-acknowledgements.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'shadan-changelog.html'), 'utf8'),
    readFile(path.join(rootDirectory, 'shadan-specs.html'), 'utf8'),
  ]);
const homePage = createDeployedPage(homeSource);
const privacyPage = createDeployedPage(privacySource);
const supportPage = createDeployedPage(supportSource);
const acknowledgementsPage = createDeployedPage(acknowledgementsSource);
const changelogPage = createDeployedPage(changelogSource);
const specsPage = createDeployedPage(specsSource);

await Promise.all([
  writeFile(path.join(outputDirectory, 'index.html'), homePage),
  writeFile(path.join(outputDirectory, 'specs.html'), specsPage),
  writeFile(path.join(specsDirectory, 'index.html'), specsPage),
  writeFile(path.join(outputDirectory, 'shadan.html'), homePage),
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

console.log(`Built Shadan Pages site in ${outputDirectory}`);
