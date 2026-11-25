import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// An image for sharing Umete's form test on X (16:9, 1600 x 900): the icon, one sentence
// with the test's numbers with AI matching on (Umete 0.5.4), where the forms came from,
// and the iPhone screen of a form Umete filled. The numbers come from the Umete
// repository's eval (eval/run.js --ai openai), all 220 forms, learned answers; UN001 has
// the method.
//
//     node scripts/build-umete-eval-card.mjs [OUTPUT.png]
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'umete-glass-icon.png');
const screenPath = path.join(rootDirectory, 'assets', 'umete-landing-fill.webp');
const outputPath = path.resolve(process.argv[2] ?? path.join(rootDirectory, 'assets', 'umete-eval-card.png'));
const width = 1600;
const height = 900;
const ink = '#28251f';
const green = '#3f4d28';
const muted = '#6b665c';
const left = 100;

function roundedMask(size, radius) {
  return Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`);
}

const iconSize = 200;
const icon = await sharp(await readFile(iconPath))
  .resize(iconSize, iconSize)
  .composite([{ input: roundedMask(iconSize, 45), blend: 'dest-in' }])
  .png()
  .toBuffer();

// The landing page's first carousel shot predates the glass icon: Umete's sheet in it
// still shows the old one, an 84-pixel tile at (102, 1038) of the 900-pixel-wide shot,
// so the glass icon goes on top, as in build-umete-social.mjs.
const sheetIcon = await sharp(await readFile(iconPath))
  .resize(84, 84)
  .composite([{ input: roundedMask(84, 19), blend: 'dest-in' }])
  .png()
  .toBuffer();
const shot = await sharp(await readFile(screenPath))
  .composite([{ input: sheetIcon, left: 102, top: 1038 }])
  .png()
  .toBuffer();

// The whole phone, as tall as the card allows.
const screenHeight = height - 90;
const screen = await sharp(shot).resize({ height: screenHeight }).png().toBuffer();
const { width: screenWidth } = await sharp(screen).metadata();
const screenTop = Math.round((height - screenHeight) / 2);
const screenLeft = width - screenWidth - 110;

const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <g font-family="Verdana" font-weight="bold" font-size="52" fill="${ink}">
    <text x="${left}" y="385">Umete automatically</text>
    <text x="${left}" y="455">fills <tspan fill="${green}">86%</tspan> of web form</text>
    <text x="${left}" y="525">fields, and <tspan fill="${green}">99.2%</tspan> of</text>
    <text x="${left}" y="595">what it fills is correct.</text>
  </g>
  <rect x="${left}" y="645" width="${screenLeft - left - 90}" height="2" fill="#e3e1da"/>
  <g font-family="Verdana" font-size="27" fill="${muted}">
    <text x="${left}" y="705">Tested on 220 real checkout and sign-up forms from</text>
    <text x="${left}" y="743">Chromium’s and Firefox’s own autofill tests: Walmart,</text>
    <text x="${left}" y="781">Costco, Best Buy, and forms in 13 other languages.</text>
    <text x="${left}" y="819">Umete 0.5.4, AI matching on. umete.jp/technotes/un001</text>
  </g>
</svg>
`);

await sharp(background)
  .composite([
    { input: icon, left, top: 85 },
    { input: screen, left: screenLeft, top: screenTop },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
