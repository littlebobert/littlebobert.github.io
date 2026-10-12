import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Umete's social preview: the app icon centered on white, matching Kaketa's.
// The icon file is a macOS-style icon with transparent padding, so trim it to
// the rounded square before sizing it like the other products' previews.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'ume-icon.png');
const outputPath = path.join(rootDirectory, 'assets', 'umete-social.png');
const width = 1200;
const height = 630;
const iconSize = 340;

const icon = await sharp(await sharp(await readFile(iconPath)).trim({ threshold: 1 }).png().toBuffer())
  .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
  .composite([{ input: icon, left: (width - iconSize) / 2, top: Math.round((height - iconSize) / 2) }])
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
