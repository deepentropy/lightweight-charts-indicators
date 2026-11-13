# AGENTS.md

Technical indicators for lightweight-charts, built on `oakscriptjs`. To find, call, draw, add or test an indicator,
read the skill first: [skills/lightweight-charts-indicators/SKILL.md](skills/lightweight-charts-indicators/SKILL.md).

## Layout

| Path | Content |
|---|---|
| `src/index.ts` | Public entry: named exports of every module and `indicatorRegistry` (split in `registryPart*` arrays) |
| `src/standard/` | Built-in indicators (one module each) |
| `src/community/` | Ports of community scripts (file name = registry id) |
| `src/candlestick-port/` | Candlestick patterns and their runner |
| `src/render/` | `IndicatorRenderer` (`lightweight-charts-indicators/render`) |
| `src/chart-context.ts`, `src/other-symbol.ts`, `src/alert-states.ts`, ... | Shared helpers (`lightweight-charts-indicators/helpers`) |
| `src/style-outputs*.ts`, `src/reference-names.ts`, `src/value-formats.ts` | Generated tables: do not edit by hand |
| `docs/INDICATOR_INVENTORY*.md` | Catalogue |
| `src/about.json`, `scripts/about/` | Help text of every entry (the `./about` entry) and the scripts that write and check them |
| `tests/unit/` | Unit suite (seeded bars, no network) |
| `tests/reference-regression/`, `tests/regression/` | Reference suites (local or private data) |
| `skills/lightweight-charts-indicators/` | Agent guide and its tested examples (shipped in the package) |
| `example/` | Demo page (`npm run dev:example`) |

## Commands

```bash
npm ci                    # install
npm run typecheck         # tsc on src/ and on the skill examples
npm test                  # unit suite
npm run build             # dist/ (esm, cjs, render, helpers, types, sources)
npm run test:reference    # reference regression (needs tests/reference-regression/data/)
npm run test:pinesuite    # reference CSV comparison (needs PINESUITE_TOKEN)
```

## Conventions

- An indicator module exports `defaultInputs`, `inputConfig`, `plotConfig`, `metadata`, `calculate` and one module
  object; it is registered in `src/index.ts` with a unique kebab-case id and `overlay` equal to `metadata.overlay`.
- `calculate(bars, inputs?, chart?)` is pure and returns one point per bar for every declared plot (`NaN` = no value).
- Ports follow their original script; a deliberate difference is commented in the code.
- Every new indicator gets a unit test and a help text (`node scripts/about/write.mjs`, then `node scripts/about/check.mjs`);
  typecheck, tests and build pass before a commit.
- Do not bump `version` (in `package.json` and `src/index.ts`) or tag outside a release: a `v*` tag publishes.
