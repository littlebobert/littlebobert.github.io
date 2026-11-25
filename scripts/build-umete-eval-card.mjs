import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// An image for sharing Umete's form test on X (16:9, 1600 x 900): one sentence with the
// test's numbers with AI matching on, Umete 0.5.3, and where the forms came from. The numbers come
// from the Umete repository's eval (eval/run.js --ai openai), on all 220 forms, learned
// answers; UN001 has the method.
//
//     node scripts/build-umete-eval-card.mjs [OUTPUT.png]
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'umete-glass-icon.png');
const outputPath = path.resolve(process.argv[2] ?? path.join(rootDirectory, 'assets', 'umete-eval-card.png'));
const width = 1600;
const height = 900;
const ink = '#28251f';
const green = '#3f4d28';
const muted = '#6b665c';

const iconSize = 72;
const icon = await sharp(await readFile(iconPath))
  .resize(iconSize, iconSize)
  .composite([{ input: Buffer.from(`<svg width="${iconSize}" height="${iconSize}"><rect width="${iconSize}" height="${iconSize}" rx="16" fill="#fff"/></svg>`), blend: 'dest-in' }])
  .png()
  .toBuffer();

// One sentence a stranger can read at a glance, then the test behind it.
const left = 110;
const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${left + iconSize + 22}" y="163" font-family="Verdana" font-weight="bold" font-size="40" fill="${ink}">Umete</text>
  <text x="${left}" y="330" font-family="Verdana" font-weight="bold" font-size="70" fill="${ink}">Fills <tspan fill="${green}">85%</tspan> of a form in one tap,</text>
  <text x="${left}" y="430" font-family="Verdana" font-weight="bold" font-size="70" fill="${ink}">and <tspan fill="${green}">99.3%</tspan> of what it fills is right.</text>
  <rect x="${left}" y="500" width="${width - left * 2}" height="2" fill="#e3e1da"/>
  <text x="${left}" y="580" font-family="Verdana" font-size="36" fill="${ink}">Tested on 220 real checkout and sign-up forms.</text>
  <text x="${left}" y="632" font-family="Verdana" font-size="36" fill="${ink}">No passwords or card numbers filled.</text>
  <text x="${left}" y="770" font-family="Verdana" font-size="28" fill="${muted}">Saved pages from Chromium’s and Firefox’s own autofill tests: Walmart, Costco, Best Buy,</text>
  <text x="${left}" y="812" font-family="Verdana" font-size="28" fill="${muted}">and forms in 13 other languages. Umete 0.5.3 with AI matching. Method: umete.jp/technotes/un001</text>
</svg>
`);

await sharp(background)
  .composite([{ input: icon, left: Math.round(left), top: 112 }])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
