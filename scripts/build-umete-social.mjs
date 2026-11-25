import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Umete's link preview, laid out like Karui's: the glass icon, the name, the pitch, and
// the closed iPhone Duo's screen of a form Umete filled, since X no longer shows a link's
// title under the image. The screen is the landing page's first carousel shot.
//
//     node scripts/build-umete-social.mjs [--linkedin DIR]
//
// With --linkedin, also writes LinkedIn's Featured thumbnail into DIR, matching Karui's
// there: the glass icon small and centered on white, since LinkedIn crops the square to
// a wide box and a larger icon loses its top and bottom.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'umete-glass-icon.png');
const screenPath = path.join(rootDirectory, 'assets', 'umete-landing-fill.webp');
const outputPath = path.join(rootDirectory, 'assets', 'umete-social.png');
const width = 1200;
const height = 630;
const iconSize = 112;
const iconCornerRadius = 26;
// The app's colors: its ink and the plum's leaf green.
const ink = '#28251f';
const green = '#3f4d28';
const muted = '#6b665c';

const roundedCornerMask = Buffer.from(`
<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${iconSize}" height="${iconSize}" rx="${iconCornerRadius}" fill="#ffffff"/>
</svg>
`);
const icon = await sharp(await readFile(iconPath))
  .resize(iconSize, iconSize, { fit: 'cover' })
  .composite([{ input: roundedCornerMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

// The landing page's first carousel shot: the whole closed iPhone Duo.
const screenHeight = 560;
const screen = await sharp(await readFile(screenPath)).resize({ height: screenHeight }).png().toBuffer();
const { width: screenWidth } = await sharp(screen).metadata();
const screenTop = Math.round((height - screenHeight) / 2);

const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="80" y="318" font-family="Verdana" font-weight="bold" font-size="92" fill="${ink}">Umete</text>
  <text x="82" y="388" font-family="Verdana" font-size="34" fill="${green}">Autofills complete forms in Safari</text>
  <text x="82" y="433" font-family="Verdana" font-size="34" fill="${green}">on iPhone, iPad, and Mac.</text>
  <text x="82" y="526" font-family="Verdana" font-size="24" fill="${muted}">Private, free, and no sign-up.</text>
</svg>
`);

await sharp(background)
  .composite([
    { input: icon, left: 80, top: 96 },
    { input: screen, left: width - screenWidth - 70, top: screenTop },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);

const linkedinIndex = process.argv.indexOf('--linkedin');
if (linkedinIndex !== -1) {
  const directory = path.resolve(process.argv[linkedinIndex + 1] ?? '.');
  const featuredPath = path.join(directory, 'umete-linkedin-featured.png');
  const featuredSize = 1200;
  const featuredIconSize = 420;
  const featuredIcon = await sharp(await readFile(iconPath))
    .resize(featuredIconSize, featuredIconSize)
    .composite([{ input: Buffer.from(`<svg width="${featuredIconSize}" height="${featuredIconSize}"><rect width="${featuredIconSize}" height="${featuredIconSize}" rx="${Math.round(featuredIconSize * 0.225)}" fill="#fff"/></svg>`), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const offset = (featuredSize - featuredIconSize) / 2;
  await sharp({ create: { width: featuredSize, height: featuredSize, channels: 3, background: '#ffffff' } })
    .composite([{ input: featuredIcon, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toFile(featuredPath);
  console.log(`Created ${featuredPath}`);
}
