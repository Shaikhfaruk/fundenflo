import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE_DIR = join(ROOT, 'src');
const MAX_STEP = 4;
const UTILITY = /(?:^|[\s"'`:])-?(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me)-(\d+(?:\.\d+)?|\[[^\]]+\])(?=[\s"'`]|$)/g;

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
});

const violations = [];
for (const file of files(SOURCE_DIR)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    for (const match of line.matchAll(UTILITY)) {
      const value = match[2];
      const tooLarge = value.startsWith('[') ? !/^\[(?:[0-3](?:\.\d+)?px|0\.\d+rem|1px|2px|3px)\]$/.test(value) : Number(value) > MAX_STEP;
      if (tooLarge) violations.push(`${relative(ROOT, file)}:${index + 1} ${match[0].trim()}`);
    }
  });
}
if (violations.length > 0) process.stdout.write(`Margins and paddings must stay at *-${MAX_STEP} or below:\n${violations.map((line) => `  ${line}`).join('\n')}\n`);
else process.stdout.write(`Spacing check passed (margins and paddings at *-${MAX_STEP} or below)\n`);
process.exitCode = violations.length > 0 ? 1 : 0;
