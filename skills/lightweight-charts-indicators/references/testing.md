# Testing indicators

Three vitest configurations, plus the type check.

## Unit suite: `npm test`

Config `vitest.config.ts`: every `tests/**/*.test.ts` except `tests/regression/` and `tests/reference-regression/`.
No network, no secrets: bars are built in code from seeded random walks. CI runs it with `npm run typecheck` on every
push and pull request to `main`.

What it covers:

| Files | Checks |
|---|---|
| `tests/unit/registry.test.ts` | Unique ids; `overlay` equals `metadata.overlay`; every `active` condition names an existing input |
| `tests/unit/community-*.test.ts`, `standard-*.test.ts`, ... | Per indicator: outputs on fixed bars (value ranges, plot counts, markers, alerts, colours) |
| `tests/unit/*.expected.json` + `*.helpers.ts` | Snapshot of output counts (`summarize()` in `community-top100.helpers.ts`: finite points per plot, number of markers, fills, drawings, ...) on fixed seeded bars |
| `tests/sources.test.ts` | Every standard entry has a published source that imports only `oakscriptjs` and the helpers entry and computes what the registry computes |
| `tests/unit/render*.test.ts` | The renderer on a fake chart (series, panes, primitives, overrides) |
| `tests/unit/skill-examples.test.ts` | The examples of this guide run and give sane output; the links of the guide exist |
| `tests/unit/version.test.ts` | `version` in `src/index.ts` equals `package.json` |

Run one file while working: `npx vitest run tests/unit/<file>.test.ts`.

### A test for a new indicator

Use the seeded bars of `makeBars(count, stepSeconds)` (`tests/unit/community-top100.helpers.ts`) or a local seeded
walk, then assert what must hold whatever the data:

- the entry exists in `indicatorRegistry` with the expected `group`, `category` and `overlay`;
- every `plotConfig` id is in `result.plots` with one point per bar and increasing times;
- values stay in their range (an oscillator between its bounds, a band above its basis);
- markers, fills and colours name declared outputs and appear on the bars where the condition holds (recompute the
  condition in the test from the bars when it is simple);
- the result changes when an input changes, and a `bool` input that hides an output hides it;
- for other symbols: a context whose `bars()` gives seeded bars (`fixtureContext()` in
  `community-other-symbols.helpers.ts`), and the `MissingSymbolDataError` without it.

`tests/unit/skill-examples.test.ts` (in the repository) is a compact model. The `.expected.json`
snapshots are rewritten only when a change of output is intended.

## Reference regression suite: `npm run test:reference`

Config `vitest.reference.config.ts`, files `tests/reference-regression/*.test.ts` (8 parallel parts plus the
candlestick patterns). It compares each indicator with reference outputs computed for its original script on the same
bars: plot values (1e-12 absolute / 1e-6 relative), colours (plots, fills, bars, backgrounds, candles), gradients and
markers, bar by bar. Each fixture stores the number of equal bars accepted per check; a check fails only when an
indicator gives fewer equal bars than accepted (more is an improvement). Candlestick patterns must stay fully equal.

The data (`tests/reference-regression/data/`) is local and git-ignored, and the fixture builder is not in the
repository: without the folder the suite is skipped. After an intended improvement the fixtures are rebuilt by the
maintainers so the new counts become the accepted ones. Details: `tests/reference-regression/README.md`.

## Reference CSV suite: `npm run test:pinesuite`

Config `vitest.regression.config.ts`, file `tests/regression/pinesuite-regression.test.ts`. For each standard
indicator mapped in `tests/regression/indicator-mapping.json` (`dataFile`, `exportName`, optional `tolerance`,
`skipInitial`, `normalize`, `skipTest`), it fetches a reference CSV from a private repository, runs the named export
of `src/index.ts` with default inputs on the CSV bars and compares every non-hidden plot with the CSV columns
(tolerance 2e-6 after 100 warm-up bars by default). Needs `PINESUITE_TOKEN`; skipped without it.

## Type check: `npm run typecheck`

`tsc --noEmit` on `src/`, then `tsc -p tsconfig.skills.json` on the guide's examples (they import the package by
name, mapped to `src/index.ts`). A change of the public types that breaks an example fails here.

## Before a commit

```bash
npm run typecheck
npm test
npm run build
```
