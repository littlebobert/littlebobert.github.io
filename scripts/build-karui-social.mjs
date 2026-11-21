import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The card: icon, name, pitch, the 通知をかるく seal and the History
// screen, since X no longer shows a link's title under the image.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'karui-icon.png');
const screenPath = path.join(rootDirectory, 'assets', 'karui-demo-en-1.jpg');
const sealPath = path.join(rootDirectory, 'assets', 'karui-seal-tagline-large.png');
const outputPath = path.join(rootDirectory, 'assets', 'karui-social.png');
const width = 1200;
const height = 630;
const iconSize = 112;
const iconCornerRadius = 26;
const screenWidth = 440;
const screenTop = 70;
const sealHeight = 300;

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

// The screen runs off the bottom edge.
const screen = await sharp(await readFile(screenPath)).resize({ width: screenWidth }).toBuffer();
const { height: screenHeight } = await sharp(screen).metadata();
const croppedScreen = await sharp(screen)
  .extract({ left: 0, top: 0, width: screenWidth, height: Math.min(screenHeight, height - screenTop) })
  .toBuffer();

// Multiplied so the seal's white paper drops out and only the ink shows.
const seal = await sharp(await readFile(sealPath)).resize({ height: sealHeight }).png().toBuffer();

const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="80" y="318" font-family="Verdana" font-weight="bold" font-size="92" fill="#0E1530">Karui</text>
  <text x="82" y="388" font-family="Verdana" font-size="34" fill="#1B2A5C">Spam filter for iPhone</text>
  <text x="82" y="433" font-family="Verdana" font-size="34" fill="#1B2A5C">notifications.</text>
  <text x="82" y="526" font-family="Verdana" font-size="24" fill="#5A6380">Privately with Apple Intelligence.</text>
</svg>
`);

await sharp(background)
  .composite([
    { input: icon, left: 80, top: 96 },
    { input: croppedScreen, left: width - screenWidth - 50, top: screenTop },
    { input: seal, left: 580, top: 200, blend: 'multiply' },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
