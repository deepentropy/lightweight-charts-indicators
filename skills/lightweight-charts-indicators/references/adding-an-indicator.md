# Adding an indicator

Start from the closest tested example in [../examples/](../examples/): they have the exact module shape of the files
in `src/`, plus a `registryEntry` constant showing the object to add to the registry.

## File layout

| Group | File | Registry |
|---|---|---|
| `standard` | `src/standard/<name>.ts` | `src/index.ts`, extra rules below |
| `community` | `src/community/<id>.ts` (file name = registry id) | `src/index.ts` |
| `candlestick` | `src/candlestick-port/patterns/<id>.ts` (a `PatternDef`) | `src/candlestick-port/registry.ts`, then `candlestickEntries()` in `src/index.ts` |

Library modules a port may use: `../types` (output types), `../chart-context` (context accessors such as
`mintickOf`, `timezoneOf`, `nowOf`, `visibleRangeOf`, `symbolBarsOf`), `../alert-states` (`alertStates`,
`crossedOver`, `crossedUnder`), `../anchor-period` (higher-timeframe periods), `../other-symbol` (`securityOther`,
`securityLowerTf`), `../lower-tf-volume`, `../bar-time`. Everything else comes from `oakscriptjs`.

## Module anatomy

In this order, as in every file of `src/standard` and `src/community`:

1. **Header comment**: what it computes, the meaning of its outputs. For a port: `Reference: "<original title>" by
   <author>` and the licence of the original (`Licence: Mozilla Public License 2.0, as the original Pine script
   (https://mozilla.org/MPL/2.0/).` when it is MPL), plus its copyright notice when it has one.
2. **`export interface <Name>Inputs`** with a doc comment per field.
3. **`export const defaultInputs: <Name>Inputs`**.
4. **`export const inputConfig: InputConfig[]`**: one row per input, `id` = the key in `defaultInputs`, `defval` =
   the same default. Keep the original's order, titles, `group`, `inline`, `tooltip`, `min` / `max` / `step`,
   `options`. Use `active: { input: 'maType', ne: 'None' }` (or `eq`, `not`, `any`, `all`) for inputs that only
   matter with another input's value.
5. **`export const plotConfig: PlotConfig[]`**: one row per line plot, usually ids `plot0`, `plot1`, ... in the
   original's declaration order. Optional `hlineConfig`, `fillConfig`, `alertConditions`, `outputs`.
6. **`export const metadata = { title, shortTitle, overlay }`**.
7. **`export function calculate(bars: Bar[], inputs: Partial<<Name>Inputs> = {}, chart?: ChartContext)`**.
8. **`export const <Name> = { calculate, metadata, defaultInputs, inputConfig, plotConfig, ... }`**.
9. Optional `export function requiredSymbols(inputs, chart)` when it reads other symbols.

## calculate

- Merge first: `const cfg = { ...defaultInputs, ...inputs }`.
- Compute with `oakscriptjs`: `getSourceSeries(bars, src)`, `ta.sma / ema / rma / wma / atr / stdev / highest /
  lowest / wpr / rsi / ...` on `Series`, `Series` arithmetic (`add`, `sub`, `mul`, `div`), `.toArray()` to get
  `(number | null)[]`. Plain loops over arrays are fine when the original has bar-by-bar state.
- Return `metadata: { title, shorttitle, overlay }` (lower-case `shorttitle` in the result) and `plots` with **one
  point per bar for every `plotConfig` id**, `time: bars[i].time`, `value: NaN` where the original has `na`.
- Pure: no globals, no clock (use `nowOf(chart)`), no network. Same bars and inputs give the same result.
- Port faithfully: when the original has a quirk, keep it and say so in a comment; do not fix behaviour silently.

## Outputs

| Output | Declare | Return in the result |
|---|---|---|
| Line plot | `plotConfig` row (`style`, `lineWidth`, `color`, `display: 'none'` for a hidden anchor of a fill, `offset`, `forceOverlay`) | `plots[id]`; a per-bar `color` on points; `palette` on the row when the colours come from a fixed set |
| Level | `hlineConfig` row (`id`, `price`, `linestyle`, ...) | nothing; or `hlines` when the level follows the inputs |
| Fill between hlines | `fillConfig` row with hline ids | nothing (or `fills` when it changes with the inputs) |
| Fill between plots | `fillConfig` row (`id`, `title`, `color` or `palette`) for the settings | `fills: [{ id, plot1, plot2, options: { title, color }, colors? , gradient? }]`, same `id` |
| Shape / character marker | `shapeConfig` row on the registry entry | `markers` with `id` = its row, `position` (`aboveBar`, `belowBar`, `atPriceTop`, ...), `shape` (`arrowUp`, `labelDown`, `circle`, ...) |
| Arrow | `arrowConfig` | `arrows` |
| Bar / background colour | `barColorConfig` | `barColors` / `bgColors` (`{ id?, time, color }`) |
| Candles / bars | `plotCandleConfig` | `plotCandles` / `plotBars` by id |
| Drawings | `drawingKinds` (`label`, `line`, `box`, `linefill`, `polyline`, `table`) | `labels`, `lines`, `boxes`, `linefills`, `polylines`, `tables` (objects alive after the last bar) |

`plotConfig[].visible` may name an input (or a key of the result's `visibility` object): the renderer shows the
plot only while that value is true.

## Alerts

Declare `export const alertConditions: AlertConditionDecl[]` (`id`, `title`, `message`) and return
`alerts: alertStates(alertConditions, bars, [flagsOfCondition0, flagsOfCondition1, ...])` (one boolean per bar per
condition, from `../alert-states`). Register the module in the `ALERT_MODULES` map of `src/index.ts` so the entry
gets its `alertConditions` (add `hasAlertFunction: true` and an `alertCalls` result for `alert()` calls).

## Chart context and other symbols

- Read the context only through the accessors of `../chart-context` (they apply the fallbacks).
- Other symbols: export `requiredSymbols(inputs, chart)` returning `{ symbol, timeframe }[]`, get the bars with
  `symbolBarsOf(requests, chart)` (throws `MissingSymbolDataError` listing all of them) and align them on the chart
  bars with `securityOther` / `securityOtherValues` (re-exported by `../other-symbol`). Add
  `requiredSymbols: mod.requiredSymbols` to the registry entry.
- Visible range: read it with `visibleRangeOf(bars, chart)` and set `usesVisibleRange: true` on the entry.

## Registration

In `src/index.ts`:

1. Next to the imports of its group:
   `import * as fooBarIndicator from './community/foo-bar';`,
   `export { FooBar, calculate as calculateFooBar } from './community/foo-bar';`,
   `export type { FooBarInputs } from './community/foo-bar';`.
2. An entry in one of the `registryPart*` arrays (none may exceed 250 entries: one larger literal is too complex for
   the type checker, TS2590; start a new part and add it to `indicatorRegistry` when needed):
   `id`, `group`, `name`, `shortName`, `description?`, `category`, `overlay` (= `metadata.overlay`), `metadata`,
   `inputConfig`, `plotConfig`, the optional declarations (`hlineConfig`, `fillConfig`, `shapeConfig`, `outputs`,
   `requiredSymbols`, `usesVisibleRange`), `defaultInputs: { ...mod.defaultInputs }`, `calculate: mod.calculate`.
3. `ALERT_MODULES` when it has alerts.

Extra rules for the **standard** group (`scripts/build-sources.mjs` turns each standard module into a published
JavaScript source and `tests/sources.test.ts` runs it):

- import it as `import * as x from './standard/<file>';`;
- write the entry with `id: '...',` then `group: 'standard',` on the next line, and `calculate: x.calculate,`;
- value imports only from `oakscriptjs` and the helper modules `../chart-context`, `../anchor-period`,
  `../other-symbol`, `../lower-tf-volume`, `../bar-time`, `../alert-states` (type-only imports are fine).

The tables `src/reference-names.ts`, `src/value-formats.ts`, `src/style-outputs.ts` and
`src/style-outputs-community.ts` are generated from reference metadata of the originals. Do not add rows by hand
without that source: declare the outputs of a new indicator on its module and entry.

## Catalogue and counts

- Community port: add its row to `docs/INDICATOR_INVENTORY_COMMUNITY.md` (alphabetical, same columns: name, id,
  category, pane, author, check) and update the summary counts.
- Standard indicator: mark it in `docs/INDICATOR_INVENTORY.md`.
- When the total changes, update the counts in `README.md` and in the `description` of `package.json`.

## Checklist

- [ ] `inputConfig` ids equal the `defaultInputs` keys, `defval` equals the default.
- [ ] Every `plotConfig` id is in `result.plots` with one point per bar, times equal to the bar times.
- [ ] Fills and markers name declared plots, hlines and shape rows.
- [ ] `overlay` of the entry equals `metadata.overlay`; the id is unique.
- [ ] A unit test with seeded bars ([testing.md](testing.md)).
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass.
