/**
 * Shared by write.mjs and check.mjs: the registry entries (from dist/, so run `npm run build` first), the source file
 * of each entry, and the about texts file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ABOUT_FILE = join(ROOT, 'src', 'about.json');

export async function registry() {
  const { indicatorRegistry } = await import(pathToFileURL(join(ROOT, 'dist', 'index.mjs')).href);
  return indicatorRegistry;
}

/** Registry id -> `src/standard/<file>.ts` (the entry's `calculate: <alias>.calculate` and the alias's import). */
function standardFiles() {
  const index = readFileSync(join(ROOT, 'src', 'index.ts'), 'utf8');
  const aliasFile = new Map();
  for (const m of index.matchAll(/^import \* as (\w+) from '\.\/standard\/([\w-]+)';/gm)) aliasFile.set(m[1], m[2]);
  const out = new Map();
  for (const m of index.matchAll(/\n\s*\{\s*\n\s*id: '([^']+)',\s*\n\s*group: 'standard',([\s\S]*?)\n\s*calculate: (\w+)\.calculate,/g)) {
    const file = aliasFile.get(m[3]);
    if (file) out.set(m[1], join(ROOT, 'src', 'standard', `${file}.ts`));
  }
  return out;
}

/** The source file of an entry, or null. Candlestick ids name their pattern file with or without its direction. */
export function sourceFileOf(entry, std = (sourceFileOf.std ??= standardFiles())) {
  if (entry.group === 'standard') return std.get(entry.id) ?? null;
  if (entry.group === 'community') return join(ROOT, 'src', 'community', `${entry.id}.ts`);
  const dir = join(ROOT, 'src', 'candlestick-port', 'patterns');
  for (const f of [entry.id, `${entry.id}-bullish`, `${entry.id}-bearish`]) if (existsSync(join(dir, `${f}.ts`))) return join(dir, `${f}.ts`);
  return join(ROOT, 'src', 'candlestick-port', 'all-patterns.ts');
}

export function sourceOf(entry) {
  const f = sourceFileOf(entry);
  return f && existsSync(f) ? readFileSync(f, 'utf8') : '';
}

/** What the indicator shows and takes, as the generator and the check see it. */
export function facts(entry) {
  const inputs = (entry.inputConfig ?? []).map((i) => ({ title: i.title ?? i.id, default: i.defval ?? entry.defaultInputs?.[i.id], ...(i.options ? { options: i.options } : {}) }));
  const outputs = [
    ...(entry.plotConfig ?? []).map((p) => p.title ?? p.id),
    ...(entry.hlineConfig ?? []).map((h) => `${h.title ?? h.id} (level ${h.price})`),
    ...[...(entry.resultHlineConfig ?? []), ...(entry.shapeConfig ?? [])].map((x) => x?.title).filter(Boolean),
  ];
  const alerts = (entry.alertConditions ?? []).map((a) => a.title);
  return { id: entry.id, name: entry.name, category: entry.category, pane: entry.overlay ? 'price pane' : 'own pane', inputs, outputs, alerts };
}

/** Every title a text may name: inputs, outputs (plots, markers, fills, bar colours), levels, alerts. */
export function titles(entry) {
  const of = (list) => (Array.isArray(list) ? list : []).map((x) => x?.title ?? x?.id);
  return [
    ...of(entry.inputConfig),
    ...of(entry.plotConfig),
    ...of(entry.hlineConfig),
    ...of(entry.resultHlineConfig),
    ...of(entry.shapeConfig),
    ...of(entry.fillConfig),
    ...of(entry.barColorConfig),
    ...of(entry.alertConditions),
  ].filter((t) => typeof t === 'string' && t);
}

export function readAbout() {
  return existsSync(ABOUT_FILE) ? JSON.parse(readFileSync(ABOUT_FILE, 'utf8')) : {};
}

/** Sorted by id, one entry per line: diffs stay readable. */
export function writeAbout(about) {
  const ids = Object.keys(about).sort();
  writeFileSync(ABOUT_FILE, `{\n${ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(about[id])}`).join(',\n')}\n}\n`);
}
