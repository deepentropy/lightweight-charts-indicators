/**
 * Builds `dist/about.mjs` (+ `.d.ts`): the short help text of every registry entry (src/about.json, written by
 * scripts/about/write.mjs and checked by scripts/about/check.mjs), as its own entry so a host loads it only when
 * it shows or explains an indicator.
 *
 *   node scripts/build-about.mjs            -> writes dist/about.mjs + dist/about.d.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const about = JSON.parse(readFileSync(join(ROOT, 'src', 'about.json'), 'utf8'));
const texts = Object.fromEntries(Object.keys(about).sort().map((id) => [id, about[id].text]));

mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(
  join(ROOT, 'dist', 'about.mjs'),
  `/** Registry id -> what the indicator computes, how to read it and its main inputs (plain English, at most 500 characters). */\n` +
    `export const indicatorAbout = ${JSON.stringify(texts)};\n` +
    `/** The help text of a registry entry, undefined for an id without one. */\n` +
    `export function aboutIndicator(id) {\n  return Object.prototype.hasOwnProperty.call(indicatorAbout, id) ? indicatorAbout[id] : undefined;\n}\n`,
);
writeFileSync(
  join(ROOT, 'dist', 'about.d.ts'),
  `/** Registry id -> what the indicator computes, how to read it and its main inputs (plain English, at most 500 characters). */\n` +
    `export declare const indicatorAbout: Readonly<Record<string, string>>;\n` +
    `/** The help text of a registry entry, undefined for an id without one. */\n` +
    `export declare function aboutIndicator(id: string): string | undefined;\n`,
);
console.log(`about: ${Object.keys(texts).length} texts`);
