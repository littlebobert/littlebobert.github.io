import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds the umete.jp site for Cloudflare Pages, mirroring the other product
// builds: the landing page becomes index.html, and the Sparkle appcast is
// published both under its current name and as /appcast.xml so the Mac app's
// feed URL can move to https://umete.jp/appcast.xml.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(rootDirectory, 'dist-umete');

const siteFiles = [
  '_headers',
  'product-click-tracking.js',
  'ume-appcast.xml',
  'ume.html',
  'sasu-common.css',
];

// Sparkle release notes referenced from the appcast.
const releaseNotes = (await readdir(rootDirectory)).filter((file) => /^Ume-.*\.md$/.test(file));

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  [...siteFiles, ...releaseNotes].map((file) =>
    cp(path.join(rootDirectory, file), path.join(outputDirectory, file)),
  ),
);

await cp(
  path.join(rootDirectory, 'assets'),
  path.join(outputDirectory, 'assets'),
  { recursive: true },
);

await cp(
  path.join(rootDirectory, 'ume.html'),
  path.join(outputDirectory, 'index.html'),
);

await cp(
  path.join(rootDirectory, 'ume-appcast.xml'),
  path.join(outputDirectory, 'appcast.xml'),
);

console.log(`Built Umete Pages site in ${outputDirectory}`);
