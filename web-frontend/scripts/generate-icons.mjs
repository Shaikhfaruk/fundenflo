import { resolve } from 'node:path';

import sharp from 'sharp';

const PUBLIC = resolve(import.meta.dirname, '../public');
const ASSETS = resolve(import.meta.dirname, '../assets/brand');
const SOURCE = resolve(ASSETS, 'logo.png');
const SOURCE_WHITE = resolve(ASSETS, 'logo-white.png');
const NAVY = '#0a192f';
const MARK_REGION_RATIO = 0.27;
const ICON_MARK_RATIO = 0.62;
const MASKABLE_MARK_RATIO = 0.5;
const LOGO_WIDTH = 1200;

const meta = await sharp(SOURCE).metadata();
const markRegion = await sharp(SOURCE).extract({ left: 0, top: 0, width: Math.round(meta.width * MARK_REGION_RATIO), height: meta.height }).png().toBuffer();
const mark = await sharp(markRegion).trim().png().toBuffer();

await sharp(mark).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(resolve(PUBLIC, 'brand/mark.png'));
await sharp(SOURCE).trim().resize({ width: LOGO_WIDTH }).webp({ quality: 90 }).toFile(resolve(PUBLIC, 'brand/logo.webp'));
await sharp(SOURCE_WHITE).trim().resize({ width: LOGO_WIDTH }).webp({ quality: 90 }).toFile(resolve(PUBLIC, 'brand/logo-white.webp'));

async function icon(size, ratio, rounded) {
  const glyph = await sharp(mark).resize(Math.round(size * ratio), Math.round(size * ratio), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const radius = Math.round(size * 0.22);
  const background = rounded
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${NAVY}"/></svg>`)
    : Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${NAVY}"/></svg>`);
  return sharp(background).composite([{ input: glyph, gravity: 'center' }]).png();
}

const outputs = [
  ['icons/icon-192.png', 192, ICON_MARK_RATIO, true],
  ['icons/icon-512.png', 512, ICON_MARK_RATIO, true],
  ['icons/maskable-512.png', 512, MASKABLE_MARK_RATIO, false],
  ['icons/apple-touch-icon.png', 180, ICON_MARK_RATIO, false],
  ['icons/favicon-48.png', 48, 0.7, true],
];
for (const [file, size, ratio, rounded] of outputs) await (await icon(size, ratio, rounded)).toFile(resolve(PUBLIC, file));

process.stdout.write(`Wrote logo, mark and ${outputs.length} icons from the brand logo\n`);
