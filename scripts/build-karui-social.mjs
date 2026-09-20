import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'karui-icon.png');
const outputPath = path.join(rootDirectory, 'assets', 'karui-social.png');
const icon = await sharp(await readFile(iconPath))
  .resize(370, 370, { fit: 'cover' })
  .png()
  .toBuffer();

const background = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f7f8fa"/>
  <text x="60" y="190" fill="#17202a" font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif" font-size="76" font-weight="700">Karui</text>
  <text x="60" y="270" fill="#596574" font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif" font-size="39">Silence unwanted notifications.</text>
  <text x="60" y="322" fill="#596574" font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif" font-size="39">Reveal unsent messages.</text>
</svg>
`);

await sharp(background)
  .composite([{ input: icon, left: 690, top: 130 }])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
