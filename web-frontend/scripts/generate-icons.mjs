import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';

const ICON_DIR = resolve(import.meta.dirname, '../public/icons');
const MASTER = readFileSync(resolve(ICON_DIR, 'favicon.svg'));
const BACKGROUND = '#0b7a56';
const MASKABLE_GLYPH_RATIO = 0.72;

const plain = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of plain) await sharp(MASTER).resize(size, size).png().toFile(resolve(ICON_DIR, file));

const MASKABLE_SIZE = 512;
const glyph = await sharp(MASTER).resize(Math.round(MASKABLE_SIZE * MASKABLE_GLYPH_RATIO)).png().toBuffer();
await sharp({ create: { width: MASKABLE_SIZE, height: MASKABLE_SIZE, channels: 4, background: BACKGROUND } }).composite([{ input: glyph, gravity: 'center' }]).png().toFile(resolve(ICON_DIR, 'maskable-512.png'));

process.stdout.write(`Wrote ${plain.length + 1} icons to public/icons\n`);
