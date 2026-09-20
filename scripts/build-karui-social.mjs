import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'karui-icon.png');
const outputPath = path.join(rootDirectory, 'assets', 'karui-social.png');
const icon = await sharp(await readFile(iconPath))
  .resize(340, 340, { fit: 'cover' })
  .png()
  .toBuffer();

const background = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#ffffff"/>
</svg>
`);

await sharp(background)
  .composite([{ input: icon, left: 430, top: 145 }])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
