import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MESSAGES_DIR = resolve(import.meta.dirname, '../src/messages');
const SOURCE_LOCALE = 'en';
const TARGETS = ['hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'or'];
const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const BATCH_SIZE = 100;
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
const PROTECTED = /<span class="notranslate">\{([A-Za-z0-9_]+)\}<\/span>/g;

const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!apiKey) {
  process.stderr.write('Set GOOGLE_TRANSLATE_API_KEY to translate the message catalogue.\n');
  process.exit(1);
}

const requested = process.argv.slice(2).filter((arg) => TARGETS.includes(arg));
const targets = requested.length > 0 ? requested : TARGETS;
const read = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

const flatten = (value, prefix = '', out = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') out[path] = child;
    else flatten(child, path, out);
  }
  return out;
};

const unflatten = (flat) => {
  const root = {};
  for (const [path, text] of Object.entries(flat)) {
    const keys = path.split('.');
    let node = root;
    for (const key of keys.slice(0, -1)) node = node[key] ??= {};
    node[keys.at(-1)] = text;
  }
  return root;
};

const decode = (text) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function translate(texts, target) {
  const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q: texts.map((text) => text.replace(PLACEHOLDER, '<span class="notranslate">{$1}</span>')), source: SOURCE_LOCALE, target, format: 'html' }),
  });
  if (!response.ok) throw new Error(`Translation API ${response.status}: ${await response.text()}`);
  const body = await response.json();
  return body.data.translations.map((item) => decode(item.translatedText.replace(PROTECTED, '{$1}')));
}

const source = flatten(read(resolve(MESSAGES_DIR, `${SOURCE_LOCALE}.json`), {}));
const stateFile = resolve(MESSAGES_DIR, 'translation-state.json');
const state = read(stateFile, {});

for (const target of targets) {
  const file = resolve(MESSAGES_DIR, `${target}.json`);
  const current = flatten(read(file, {}));
  const known = state[target] ?? {};
  const pending = Object.keys(source).filter((key) => !current[key] || known[key] !== hash(source[key]));
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const keys = pending.slice(start, start + BATCH_SIZE);
    const translated = await translate(keys.map((key) => source[key]), target);
    keys.forEach((key, index) => {
      current[key] = translated[index];
      known[key] = hash(source[key]);
    });
  }
  const next = Object.fromEntries(Object.keys(source).map((key) => [key, current[key] ?? source[key]]));
  writeFileSync(file, `${JSON.stringify(unflatten(next), null, 2)}\n`);
  state[target] = Object.fromEntries(Object.keys(source).map((key) => [key, known[key]]));
  process.stdout.write(`${target}: ${pending.length} strings translated, ${Object.keys(source).length - pending.length} kept\n`);
}

writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
const available = TARGETS.filter((target) => existsSync(resolve(MESSAGES_DIR, `${target}.json`)));
writeFileSync(resolve(MESSAGES_DIR, 'available-locales.ts'), `export const TRANSLATED_LOCALES = [${available.map((locale) => `'${locale}'`).join(', ')}] as const;\n`);
