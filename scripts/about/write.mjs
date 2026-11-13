/**
 * Writes src/about.json: a short plain-English summary of every registry entry (what it computes, how to read it,
 * its main inputs), written by Claude (Claude Code CLI, `claude -p`) from the entry's own code, inputs and outputs.
 * The texts are our own: never copied from the original scripts' descriptions. check.mjs checks them.
 *
 *   node scripts/about/write.mjs                     # every entry without a text (resumes)
 *   node scripts/about/write.mjs --ids rsi,macd      # these entries (rewritten)
 *   node scripts/about/write.mjs --redo              # the entries check.mjs flagged (scripts/about/flagged.json)
 *   options: --limit N, --jobs 3, --model sonnet
 * Needs dist/ (npm run build). Failed batches go to scripts/about/failed.log and are retried on the next run.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT, facts, readAbout, registry, sourceOf, writeAbout } from './common.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const JOBS = Number(arg('jobs', 3));
const MODEL = arg('model', 'sonnet');
const LIMIT = Number(arg('limit', Infinity));
/** Source characters per call, and per entry (the head holds the inputs and the calculation). */
const BATCH_CHARS = 60_000;
const ENTRY_CHARS = 20_000;
const BATCH_MAX = 8;
const FAILED = join(ROOT, 'scripts', 'about', 'failed.log');

const RULES = `You write the short help text of technical indicators in a charting app. For each indicator below you get its
id, name, category, where it draws, its inputs (title, default), its outputs (plots and levels), its alerts and its
TypeScript source (a port of a Pine Script indicator; the source may be cut).

For each one write one text of 2 or 3 sentences, 250 to 350 characters (never more than 400), in plain English:
1. what it computes (from the code: the calculation, not the name);
2. how a trader reads it (what its lines, colours, levels, markers or crossings mean, as the code draws them);
3. its main inputs with their defaults, when they matter.

Rules:
- Describe only what the code does. Never invent a level, a signal, an input or a default the code does not have.
- Your own words: do not copy comments, tooltips or the original author's description; no author or script names.
- Leave out colour, style and display inputs; name colours in words, never as codes.
- No markdown, no lists, no quotes around names, no "This indicator", no advice, no claims of accuracy or profit.
- Name inputs and outputs by their exact titles as given.

Answer with one JSON object only, no other text:
{"<id>": {"text": "<the text>", "names": ["<every input, output, level or alert title the text names, exactly as given; not option values>"]}, ...}`;

function claudeExe() {
  const exe = join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  return existsSync(exe) ? exe : 'claude';
}

function ask(prompt) {
  return new Promise((resolve, reject) => {
    const p = spawn(claudeExe(), ['-p', '--model', MODEL, '--system-prompt', 'You write indicator help texts. Output only the JSON asked for.', '--tools', '', '--setting-sources', '', '--strict-mcp-config'], {
      cwd: tmpdir(),
      env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => p.kill(), 15 * 60_000);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`));
    });
    p.stdin.end(prompt, 'utf8');
  });
}

function promptOf(batch) {
  const parts = batch.map((e) => {
    const f = facts(e);
    const src = sourceOf(e);
    const cut = src.length > ENTRY_CHARS ? `${src.slice(0, ENTRY_CHARS)}\n// …(cut: ${src.length - ENTRY_CHARS} more characters)` : src;
    if (f.inputs.length > 40) f.inputs = [...f.inputs.slice(0, 40), `…${f.inputs.length - 40} more`];
    return `### ${e.id}\n${JSON.stringify(f)}\n\`\`\`ts\n${cut}\n\`\`\``;
  });
  return `${RULES}\n\n${parts.join('\n\n')}`;
}

function parse(text, batch) {
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const out = {};
  for (const e of batch) {
    const v = json[e.id];
    if (v && typeof v.text === 'string' && v.text.trim()) out[e.id] = { text: v.text.trim(), names: Array.isArray(v.names) ? v.names : [] };
  }
  return out;
}

function batches(entries) {
  const out = [];
  let cur = [];
  let size = 0;
  for (const e of entries) {
    const n = Math.min(sourceOf(e).length, ENTRY_CHARS);
    if (cur.length && (cur.length >= BATCH_MAX || size + n > BATCH_CHARS)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(e);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

const all = await registry();
const about = readAbout();
let todo;
if (arg('ids')) {
  const ids = new Set(arg('ids').split(','));
  todo = all.filter((e) => ids.has(e.id));
} else if (process.argv.includes('--redo')) {
  const flagged = new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, 'scripts', 'about', 'flagged.json'), 'utf8'))));
  todo = all.filter((e) => flagged.has(e.id));
} else {
  todo = all.filter((e) => !about[e.id]);
}
todo = todo.slice(0, LIMIT);
const queue = batches(todo);
console.log(`${todo.length} entries in ${queue.length} calls, ${JOBS} at a time (${MODEL})`);

let done = 0;
const t0 = Date.now();
async function worker() {
  for (let b = queue.shift(); b; b = queue.shift()) {
    try {
      const got = parse(await ask(promptOf(b)), b);
      Object.assign(about, got);
      writeAbout(about);
      const missing = b.filter((e) => !got[e.id]).map((e) => e.id);
      if (missing.length) appendFileSync(FAILED, `${new Date().toISOString()} missing ${missing.join(',')}\n`);
      done += Object.keys(got).length;
    } catch (err) {
      appendFileSync(FAILED, `${new Date().toISOString()} ${b.map((e) => e.id).join(',')}: ${String(err.message ?? err).replace(/\s+/g, ' ')}\n`);
    }
    const min = (Date.now() - t0) / 60_000;
    console.log(`${done}/${todo.length} written, ${min.toFixed(1)} min`);
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));
