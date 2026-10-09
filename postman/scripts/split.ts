import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { COLLECTION_DIR, COLLECTION_FILE, displayName, FOLDER_FILE, type PostmanFolder, type PostmanRequestItem } from './build.ts';

const source = process.argv[2];
if (!source) {
  process.stderr.write('Usage: pnpm postman:split <exported-collection.json>\n');
  process.exit(1);
}

type ExportedCollection = PostmanFolder & { info: unknown; auth?: unknown; event?: unknown; variable?: unknown };

const isFolder = (entry: PostmanFolder | PostmanRequestItem): entry is PostmanFolder => Array.isArray((entry as PostmanFolder).item);
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const pad = (index: number) => String(index).padStart(2, '0');

function existingNames(dir: string): Map<string, string> {
  if (!existsSync(dir)) return new Map();
  return new Map(readdirSync(dir).filter((entry) => entry !== FOLDER_FILE).map((entry) => [displayName(entry), entry]));
}

function nextIndex(names: Map<string, string>): number {
  const numbers = [...names.values()].map((entry) => Number.parseInt(entry, 10)).filter(Number.isFinite);
  return (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
}

function writeFolder(dir: string, folder: PostmanFolder) {
  mkdirSync(dir, { recursive: true });
  const { item, name: _name, ...meta } = folder;
  if (Object.keys(meta).length > 0) writeJson(join(dir, FOLDER_FILE), meta);
  const names = existingNames(dir);
  let index = nextIndex(names);
  for (const entry of item) {
    const known = names.get(entry.name);
    if (isFolder(entry)) {
      const folderName = known ?? `${pad(index++)} ${entry.name}`;
      names.set(entry.name, folderName);
      writeFolder(join(dir, folderName), entry);
      continue;
    }
    const fileName = known ?? `${pad(index++)} ${entry.name}.json`;
    names.set(entry.name, fileName);
    writeJson(join(dir, fileName), entry);
  }
}

const exported = JSON.parse(readFileSync(source, 'utf8')) as ExportedCollection;
const { item, info, auth, event, variable } = exported;
writeJson(join(COLLECTION_DIR, COLLECTION_FILE), { info, auth, event, variable });
writeFolder(COLLECTION_DIR, { name: '', item });
process.stdout.write(`Split ${source} into ${COLLECTION_DIR}\n`);
