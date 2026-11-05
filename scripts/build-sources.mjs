/**
 * Builds `dist/sources.mjs` (+ `.d.ts`): the source code of every standard (built-in) indicator as a plain
 * JavaScript module that a host can show, copy and run as a user script. Each source is its `src/standard/*.ts` file
 * with the types removed, the library's relative helper imports pointed at `lightweight-charts-indicators/helpers`,
 * the titles the registry gives the study (reference-names.ts) in its metadata, and its Style-settings declarations
 * (style-outputs.ts) after the module's own.
 *
 *   node scripts/build-sources.mjs            -> writes dist/sources.mjs + dist/sources.d.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HELPERS_SPEC = 'lightweight-charts-indicators/helpers';
/** Library modules a standard source may import, given to scripts by the helpers entry. */
const HELPER_MODULES = new Set(['chart-context', 'anchor-period', 'other-symbol', 'lower-tf-volume', 'bar-time', 'alert-states', 'live-run']);

/** Registry id -> `src/standard/<file>.ts`, read from the registry in src/index.ts (entry `id` + its module alias). */
export function standardFiles(indexSource) {
  const aliasFile = new Map();
  for (const m of indexSource.matchAll(/^import \* as (\w+) from '\.\/standard\/([\w-]+)';/gm)) aliasFile.set(m[1], m[2]);
  const out = new Map();
  const entryRe = /\n\s*\{\s*\n\s*id: '([^']+)',\s*\n\s*group: 'standard',([\s\S]*?)\n\s*calculate: (\w+)\.calculate,/g;
  for (const m of indexSource.matchAll(entryRe)) {
    const file = aliasFile.get(m[3]);
    if (file) out.set(m[1], file);
  }
  return out;
}

/** The reference names table of reference-names.ts (id -> [title, shortTitle]). */
export function referenceNames(namesSource) {
  const out = new Map();
  for (const m of namesSource.matchAll(/^\s*"([^"]+)": \["((?:[^"\\]|\\.)*)", "((?:[^"\\]|\\.)*)"\],?$/gm)) {
    out.set(m[1], [JSON.parse(`"${m[2]}"`), JSON.parse(`"${m[3]}"`)]);
  }
  return out;
}

/** The Style-settings table of style-outputs.ts (id -> declarations). */
export function styleOutputs(stylesSource) {
  const out = new Map();
  for (const m of stylesSource.matchAll(/^  "([^"]+)": (\{.*\}),\r?$/gm)) out.set(m[1], JSON.parse(m[2]));
  return out;
}

/**
 * Statements that give a source the Style declarations of its registry entry (what style-apply.ts does to the
 * entry): plots not listed, hline titles, fills, shapes, background / bar colours, candles, drawing kinds.
 */
export function styleStatements(js, decl) {
  // (a JSDoc type may precede the declaration on its line)
  const has = (name) => new RegExp(`\\bconst ${name}\\b`).test(js);
  const json = (v) => JSON.stringify(v);
  const lines = [];
  if (decl.hiddenPlots?.length) lines.push(`for (const p of plotConfig) if (${json(decl.hiddenPlots)}.includes(p.id)) p.editable = false;`);
  if (decl.plotPalettes) lines.push(`for (const p of plotConfig) if (${json(decl.plotPalettes)}[p.id]) p.palette = ${json(decl.plotPalettes)}[p.id];`);
  if (decl.hlines && has('hlineConfig')) lines.push(`for (const h of hlineConfig) Object.assign(h, ${json(decl.hlines)}[h.id] ?? {});`);
  if (decl.fills?.length) {
    if (has('fillConfig')) {
      lines.push(`for (const d of ${json(decl.fills)}) {`, '  const f = fillConfig.find((x) => x.id === d.id);', '  if (f) Object.assign(f, d);', '  else fillConfig.push(d);', '}');
    } else lines.push(`export const fillConfig = ${json(decl.fills)};`);
  }
  if (decl.shapes?.length && !has('shapeConfig')) lines.push(`export const shapeConfig = ${json(decl.shapes)};`);
  if (decl.markerDrawing && !has('markerDrawing')) lines.push(`export const markerDrawing = ${json(decl.markerDrawing)};`);
  if (decl.barColors?.length && !has('barColorConfig')) lines.push(`export const barColorConfig = ${json(decl.barColors)};`);
  if (decl.candles && has('plotCandleConfig')) lines.push(`for (const c of plotCandleConfig) Object.assign(c, ${json(decl.candles)}[c.id] ?? {});`);
  if (decl.drawings?.length && !has('drawingKinds')) lines.push(`export const drawingKinds = ${json(decl.drawings)};`);
  return lines.length ? `\n// Style settings of the study: the outputs a user can style and their defaults.\n${lines.join('\n')}\n` : '';
}

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * The TypeScript source with its types kept as JSDoc, so the JavaScript type-checks as the TypeScript did (an
 * editor checking JS sees no error where the literal types were erased, e.g. `src: 'close'` read as a string):
 * interfaces and type aliases -> `@typedef` (one block before the first statement after the imports), typed
 * variables -> `@type`. Imported types become `import('<module>').Name` (library-internal ones `any`).
 */
export function withJsDocTypes(tsSource) {
  const sf = ts.createSourceFile('source.ts', tsSource, ts.ScriptTarget.ES2022, true);
  const imported = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const spec = st.moduleSpecifier.text;
    const named = st.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) imported.set(el.name.text, { spec, name: (el.propertyName ?? el.name).text });
    }
  }
  const moduleOf = (spec) => {
    if (spec.startsWith('oakscriptjs')) return spec;
    const m = spec.match(/^\.\.\/([\w-]+)$/);
    return m && HELPER_MODULES.has(m[1]) ? HELPERS_SPEC : null;
  };
  const typeText = (node) => {
    // Identifiers of the type (not property names, not inside string literals) that were imported.
    const edits = [];
    const visit = (n) => {
      const id = ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName) ? n.typeName
        : ts.isExpressionWithTypeArguments(n) && ts.isIdentifier(n.expression) ? n.expression : null;
      if (id) {
        const im = imported.get(id.text);
        if (im) {
          const mod = moduleOf(im.spec);
          edits.push([id.getStart(sf), id.getEnd(), mod ? `import('${mod}').${im.name}` : 'any']);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    let text = tsSource.slice(node.getStart(sf), node.getEnd());
    const base = node.getStart(sf);
    for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) text = text.slice(0, s - base) + r + text.slice(e - base);
    // A type that reads another library file cannot be written for the script: none.
    if (/import\(\s*['"]\./.test(text)) return null;
    // One line, comments dropped (a JSDoc type cannot hold them).
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  };
  const typedefs = [];
  const inserts = [];
  const visit = (n) => {
    if (ts.isInterfaceDeclaration(n)) {
      const members = n.members.map((m) => (typeText(m) ?? `${m.name?.getText(sf) ?? ''}: any`).replace(/[;,]$/, '')).join('; ');
      const bases = (n.heritageClauses ?? []).flatMap((h) => h.types.map((t) => typeText(t) ?? 'any'));
      typedefs.push(`@typedef {${[...bases, `{ ${members} }`].join(' & ')}} ${n.name.text}`);
    } else if (ts.isTypeAliasDeclaration(n) && !n.typeParameters) {
      typedefs.push(`@typedef {${typeText(n.type) ?? 'any'}} ${n.name.text}`);
    } else if (ts.isVariableStatement(n) && n.declarationList.declarations.length === 1) {
      const d = n.declarationList.declarations[0];
      let t = d.type && typeText(d.type);
      // `const x = f<T>(...)`: the type argument is erased with the types, keep it as the call's return type.
      const init = d.initializer;
      if (!t && init && ts.isCallExpression(init) && init.typeArguments?.length && ts.isIdentifier(init.expression)) {
        const args = init.typeArguments.map((a) => typeText(a));
        if (args.every(Boolean)) t = `ReturnType<typeof ${init.expression.text}<${args.join(', ')}>>`;
      }
      if (t) inserts.push([n.getStart(sf), `/** @type {${t}} */ `]);
    } else if ((ts.isFunctionDeclaration(n) && n.name) || ts.isArrowFunction(n)) {
      if (!n.typeParameters) {
        const tags = [];
        for (const p of n.parameters) {
          const t = p.type && ts.isIdentifier(p.name) && typeText(p.type);
          if (t) tags.push(`@param {${t}${p.questionToken || p.initializer ? '=' : ''}} ${p.name.text}`);
        }
        const r = n.type && typeText(n.type);
        if (r) tags.push(`@returns {${r}}`);
        if (tags.length) inserts.push([n.getStart(sf), `/** ${tags.join(' ')} */ `]);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (typedefs.length) {
    const first = sf.statements.find((s) => !ts.isImportDeclaration(s) && !ts.isInterfaceDeclaration(s) && !ts.isTypeAliasDeclaration(s));
    if (first) inserts.push([first.getStart(sf), `/**\n${typedefs.map((t) => ` * ${t}`).join('\n')}\n */\n`]);
  }
  let out = tsSource;
  for (const [pos, text] of inserts.sort((a, b) => b[0] - a[0])) out = out.slice(0, pos) + text + out.slice(pos);
  return out;
}

/** JavaScript source of one standard indicator file. `names`: [title, shortTitle] the registry shows, if any;
 *  `styles`: its Style-settings declarations, if any. */
export function scriptSource(tsSource, names, styles) {
  const js = ts.transpileModule(withJsDocTypes(tsSource), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: false },
  }).outputText;
  let out = js
    // Relative helper imports -> the helpers entry (type-only ones are gone after the transpile).
    .replace(/from '\.\.\/([\w-]+)';/g, (whole, mod) => (HELPER_MODULES.has(mod) ? `from '${HELPERS_SPEC}';` : whole))
    // 4-space indents of the TypeScript printer -> 2 spaces, as the library sources are written.
    .replace(/^( {4})+/gm, (lead) => ' '.repeat(lead.length / 2))
    .replace(/\n+$/, '\n');
  const rel = out.match(/from '\.\.?\/[^']*'/);
  if (rel) throw new Error(`relative import left in a built-in source: ${rel[0]}`);
  if (names) {
    out = out.replace(/(export const metadata = \{[\s\S]*?\n\};)/, (block) =>
      block
        .replace(/(\n\s*title: )(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/, `$1${quote(names[0])}`)
        .replace(/(\n\s*shortTitle: )(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/, `$1${quote(names[1])}`),
    );
  }
  if (styles) out += styleStatements(out, styles);
  return out;
}

/** id -> JavaScript source of every standard indicator. */
export function buildSources(root = ROOT) {
  const index = readFileSync(join(root, 'src/index.ts'), 'utf8');
  const names = referenceNames(readFileSync(join(root, 'src/reference-names.ts'), 'utf8'));
  const styles = styleOutputs(readFileSync(join(root, 'src/style-outputs.ts'), 'utf8'));
  const sources = {};
  for (const [id, file] of standardFiles(index)) {
    sources[id] = scriptSource(readFileSync(join(root, 'src/standard', `${file}.ts`), 'utf8'), names.get(id), styles.get(id));
  }
  return sources;
}

const DTS = `/**
 * Source code of the built-in (standard) indicators, by registry id: plain JavaScript modules in the convention of the
 * library (metadata, inputConfig, plotConfig, defaultInputs, calculate) that import from \`oakscriptjs\` and
 * \`${HELPERS_SPEC}\`. A host can show one, or run a copy of it as a user script.
 */
export declare const builtinSources: Readonly<Record<string, string>>;
/** Source code of the built-in indicator \`id\` (registry id), undefined when it has none. */
export declare function builtinSource(id: string): string | undefined;
`;

function main() {
  const sources = buildSources();
  const body =
    `// Generated by scripts/build-sources.mjs from src/standard: do not edit.\n` +
    `export const builtinSources = Object.freeze(${JSON.stringify(sources, null, 0)});\n` +
    `export function builtinSource(id) {\n  return Object.prototype.hasOwnProperty.call(builtinSources, id) ? builtinSources[id] : undefined;\n}\n`;
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist/sources.mjs'), body);
  writeFileSync(join(ROOT, 'dist/sources.d.ts'), DTS);
  console.log(`dist/sources.mjs: ${Object.keys(sources).length} built-in sources`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
