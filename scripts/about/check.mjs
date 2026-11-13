/**
 * Checks src/about.json against the registry and the code; the entries that fail go to scripts/about/flagged.json
 * (id -> reasons) for `node scripts/about/write.mjs --redo`.
 * - every registry entry has a text, of 80 to 500 characters, without markdown (formulas may use * and |);
 * - every name the text gives is a title of the entry (input, output, level, alert), an input's option or default, or a
 *   string literal of its code (titles given at run time);
 * - every number in the text is in the entry (its name, defaults, levels) or in its source;
 * - no colour codes; no author, origin or sales wording.
 *
 *   node scripts/about/check.mjs            # summary + flagged.json
 *   node scripts/about/check.mjs --sample 90 # also prints a random sample to read
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readAbout, registry, sourceOf, titles } from './common.mjs';

const all = await registry();
const about = readAbout();
const flagged = {};
const flag = (id, why) => (flagged[id] ??= []).push(why);
/** Titles compare without emoji, styled letters (𝗕𝗼𝗹𝗱), case or extra spaces. */
const norm = (s) => s.normalize('NFKC').replace(/\p{Extended_Pictographic}|\p{Mn}|\p{Cf}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const BANNED = /\b(tradingview|pine ?script|author|copyright|guarantee[ds]?|profitable|accurate|best indicator|buy now)\b|this indicator/i;

for (const e of all) {
  const a = about[e.id];
  if (!a) {
    flag(e.id, 'no text');
    continue;
  }
  const t = a.text;
  if (t.length < 80 || t.length > 500) flag(e.id, `length ${t.length}`);
  if (/\*\*|`|#{2,}|^\s*-\s/m.test(t)) flag(e.id, 'markdown');
  if (/#[0-9a-f]{6}\b/i.test(t)) flag(e.id, 'colour code');
  if (BANNED.test(t)) flag(e.id, `wording: ${t.match(BANNED)[0]}`);
  const own = new Set(titles(e).map(norm));
  for (const i of e.inputConfig ?? []) for (const v of [...(i.options ?? []), i.defval]) if (typeof v === 'string') own.add(norm(v));
  const src = sourceOf(e);
  const literal = (n) => [`'${n}'`, `"${n}"`, `\`${n}`].some((q) => src.includes(q));
  for (const n of a.names) {
    const name = String(n).replace(/ \(level [^)]*\)$/, '');
    if (!own.has(norm(name)) && !literal(name) && !norm(src).includes(norm(name))) flag(e.id, `unknown name: ${n}`);
  }
  const known = `${e.name} ${e.shortName} ${JSON.stringify(e.inputConfig ?? [])} ${JSON.stringify(e.hlineConfig ?? [])} ${JSON.stringify(e.defaultInputs ?? {})} ${src}`;
  const nums = new Set(known.match(/\d+(?:\.\d+)?/g) ?? []);
  for (const n of t.match(/(?<![\w.])\d+(?:\.\d+)?/g) ?? []) {
    const plain = n.replace(/\.0+$/, '');
    if (!nums.has(n) && !nums.has(plain) && !nums.has(`${plain}.0`) && !['0', '1', '2', '3', '100'].includes(plain)) flag(e.id, `number not in code: ${n}`);
  }
}

writeFileSync(join(ROOT, 'scripts', 'about', 'flagged.json'), JSON.stringify(flagged, null, 1));
const reasons = {};
for (const list of Object.values(flagged)) for (const r of list) reasons[r.split(':')[0].replace(/ \d+$/, '')] = (reasons[r.split(':')[0].replace(/ \d+$/, '')] ?? 0) + 1;
const texts = Object.values(about).map((a) => a.text.length).sort((x, y) => x - y);
console.log(`${all.length} entries, ${Object.keys(about).length} texts (median ${texts[texts.length >> 1] ?? 0} characters), ${Object.keys(flagged).length} flagged`);
console.log(reasons);

const k = process.argv.indexOf('--sample');
if (k > 0) {
  const ids = Object.keys(about).filter((id) => !flagged[id]);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (const id of ids.slice(0, Number(process.argv[k + 1]))) console.log(`\n${id}: ${about[id].text}`);
}
