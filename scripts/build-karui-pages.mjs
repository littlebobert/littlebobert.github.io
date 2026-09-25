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

const siteFiles = [
  '_headers',
  'product-click-tracking.js',
  'sasu-common.css',
];

const assetFiles = [
  'karui-favicon.png',
  'karui-icon.png',
  'karui-social.png',
  ...['01-spam-filtering', '02-unsent-messages', '03-wake-me'].flatMap((shot) => [
    `karui-shot-${shot}-en.jpg`,
    `karui-shot-${shot}-ja.jpg`,
  ]),
];

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(assetsDirectory, { recursive: true }),
  mkdir(privacyDirectory, { recursive: true }),
  mkdir(supportDirectory, { recursive: true }),
  mkdir(acknowledgementsDirectory, { recursive: true }),
  mkdir(changelogDirectory, { recursive: true }),
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
    .replaceAll('href="sasu-common.css?v=4"', 'href="/sasu-common.css?v=4"')
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('data-src-en="assets/', 'data-src-en="/assets/')
    .replaceAll('data-src-ja="assets/', 'data-src-ja="/assets/')
    .replaceAll('href="karui.html"', 'href="/"')
    .replaceAll('href="karui-privacy.html"', 'href="/privacy"')
    .replaceAll('href="karui-support.html"', 'href="/support"')
    .replaceAll(
      'href="karui-acknowledgements.html"',
      'href="/acknowledgements"',
    )
    .replaceAll('href="karui-changelog.html"', 'href="/changelog"');
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

console.log(`Built Karui Pages site in ${outputDirectory}`);
