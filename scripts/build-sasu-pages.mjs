import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-sasu');

const siteFiles = [
  '_headers',
  'appcast.xml',
  'sasu-common.css',
  'sasu-common.js',
  'sasu-invite.html',
  'sasu.html',
  'style.css',
  'theme.js',
];

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  siteFiles.map((file) =>
    cp(path.join(rootDirectory, file), path.join(outputDirectory, file)),
  ),
);

await cp(
  path.join(rootDirectory, 'assets'),
  path.join(outputDirectory, 'assets'),
  { recursive: true },
);

await cp(
  path.join(rootDirectory, 'sasu.html'),
  path.join(outputDirectory, 'index.html'),
);

console.log(`Built Sasu Pages site in ${outputDirectory}`);
