import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-karui');
const assetsDirectory = path.join(outputDirectory, 'assets');

const siteFiles = [
  '_headers',
  'product-click-tracking.js',
  'sasu-common.css',
];

const assetFiles = [
  'karui-favicon.png',
  'karui-icon.png',
  'karui-social.png',
];

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(assetsDirectory, { recursive: true });

await Promise.all(
  siteFiles.map((file) =>
    cp(path.join(rootDirectory, file), path.join(outputDirectory, file)),
  ),
);

await Promise.all(
  assetFiles.map((file) =>
    cp(path.join(rootDirectory, 'assets', file), path.join(assetsDirectory, file)),
  ),
);

await cp(
  path.join(rootDirectory, 'karui.html'),
  path.join(outputDirectory, 'index.html'),
);

await cp(
  path.join(rootDirectory, 'karui.html'),
  path.join(outputDirectory, 'karui.html'),
);

console.log(`Built Karui Pages site in ${outputDirectory}`);
