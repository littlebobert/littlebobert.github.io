import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Umete's link preview, laid out like Karui's: the glass icon, the name, the pitch, and
// the iPhone screen of a form Umete filled, since X no longer shows a link's title under
// the image. The screen is the landing page's first carousel shot.
//
//     node scripts/build-umete-social.mjs
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'umete-glass-icon.png');
const screenPath = path.join(rootDirectory, 'assets', 'umete-landing-fill.webp');
const outputPath = path.join(rootDirectory, 'assets', 'umete-social.png');
const width = 1200;
const height = 630;
const iconSize = 112;
const iconCornerRadius = 26;
const screenWidth = 400;
const screenTop = 56;
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

// The shot predates the glass icon: Umete's sheet in it still shows the old one, an
// 84-pixel tile at (102, 1038) of the 900-pixel-wide shot, so the glass icon goes on top.
const sheetIconSize = 84;
const sheetIcon = await sharp(await readFile(iconPath))
  .resize(sheetIconSize, sheetIconSize)
  .composite([{ input: Buffer.from(`<svg width="${sheetIconSize}" height="${sheetIconSize}"><rect width="${sheetIconSize}" height="${sheetIconSize}" rx="19" fill="#fff"/></svg>`), blend: 'dest-in' }])
  .png()
  .toBuffer();
const shot = await sharp(await readFile(screenPath))
  .composite([{ input: sheetIcon, left: 102, top: 1038 }])
  .png()
  .toBuffer();

// The phone runs off the bottom edge.
const screen = await sharp(shot).resize({ width: screenWidth }).png().toBuffer();
const { height: screenHeight } = await sharp(screen).metadata();
const croppedScreen = await sharp(screen)
  .extract({ left: 0, top: 0, width: screenWidth, height: Math.min(screenHeight, height - screenTop) })
  .toBuffer();

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
    { input: croppedScreen, left: width - screenWidth - 70, top: screenTop },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
