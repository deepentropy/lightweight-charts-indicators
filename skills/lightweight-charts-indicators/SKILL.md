---
name: lightweight-charts-indicators
description: Find, run, draw and add technical indicators with the lightweight-charts-indicators library (standard indicators, community PineScript ports and candlestick patterns that turn OHLCV bars into plots, fills, levels, markers and drawings, plus a renderer for lightweight-charts 5). Use when you need an indicator id, its inputs or outputs, when you calculate an indicator on price bars or draw its result on a chart, or when you add, port or test an indicator in this repository.
---

# lightweight-charts-indicators

A TypeScript library of indicators built on `oakscriptjs` (the PineScript runtime it depends on). Every indicator is a
pure function `calculate(bars, inputs?, chart?)` described by a registry entry: its id, inputs, plots, levels and
fills. `lightweight-charts-indicators/render` draws any result on a lightweight-charts 5 chart.

This guide ships with the package (`node_modules/lightweight-charts-indicators/skills/`), so it matches the installed
version. The files in [examples/](examples/) are compiled and run by the repository's tests: copy from them.

## Rules

1. **The registry is the source of truth.** `indicatorRegistry` (main entry) lists every indicator. Look ids, inputs
   and plots up there; never guess an id or an input key, and never keep your own copy of the list.
2. **Inputs are keyed by `inputConfig[].id`**, not by title. A missing key takes its default (`calculate` merges over
   `defaultInputs`), so pass only what you change; `{ ...entry.defaultInputs, ...inputs }` makes that explicit.
3. **Bars** are `{ time, open, high, low, close, volume? }`, oldest first, `time` in UNIX seconds (the lightweight-charts
   unit). Times the chart context gives in milliseconds (`leftVisibleBarTime`, `now`) are the exception.
4. **Plots are lists of points keyed by time**: `result.plots[plotId]` holds `{ time, value, color? }`, usually one per
   bar; a shifted plot can have fewer points, or points after the last bar. Match points to bars by `time`, not by
   index. `NaN` means no value (warm-up, hidden). Read plots by the ids of `entry.plotConfig`; show `title` to people.
5. **Overlay or own pane** is `entry.overlay`. Outputs with `forceOverlay` go to the price pane anyway.
6. **Pass a chart context** (third argument) when you know the symbol: tick, time zone, session, timeframe. Indicators
   that read other symbols declare `requiredSymbols` and throw `MissingSymbolDataError` until you give their bars;
   `usesVisibleRange` ones must be calculated again when the visible range changes.
7. **One `IndicatorRenderer` per indicator instance.** Each `render()` replaces what that instance drew.
8. **Generated tables are not hand-edited**: `src/style-outputs.ts`, `src/style-outputs-community.ts`,
   `src/reference-names.ts`, `src/value-formats.ts` come from reference metadata. A new indicator declares its own
   outputs on its module and registry entry instead.
9. **No external data in tests.** Unit tests build seeded bars in code; the reference suites need local or private
   data and are skipped without it.

## Use an indicator

1. **Find it.** Browse the catalogue in `docs/` (see [catalogue](references/catalogue-and-calling.md#catalogue)) or
   filter `indicatorRegistry` by `id`, `name`, `shortName`, `group` (`standard`, `community`, `candlestick`) or
   `category`. `searchIndicators()` in [examples/call-indicator.ts](examples/call-indicator.ts) does that.
2. **Read its entry.** `inputConfig` (keys, types, defaults, limits, options), `plotConfig` (plot ids, titles,
   colours, styles), `hlineConfig` / `fillConfig` (levels and fills), `overlay`, `requiredSymbols`,
   `alertConditions`. Field list: [entry fields](references/catalogue-and-calling.md#registry-entry).
3. **Calculate.** `entry.calculate(bars, { ...entry.defaultInputs, ...inputs }, chart)`; see `runIndicator()` and,
   for other symbols, `runWithOtherSymbols()` in [examples/call-indicator.ts](examples/call-indicator.ts).
4. **Read the result.** `plots` always; `fills`, `hlines`, `markers`, `barColors`, `bgColors`, `plotCandles`,
   `labels`, `lines`, `boxes`, `tables`, `alerts` when the indicator has them. Shapes:
   [result](references/catalogue-and-calling.md#result).
5. **Draw it** (optional) with `IndicatorRenderer` from `lightweight-charts-indicators/render`:
   [renderer](references/catalogue-and-calling.md#drawing-a-result).

A whole app consuming the library (lazy import, one layer per study, error handling) is described in
[host integration](references/catalogue-and-calling.md#host-integration).

## Add an indicator

Read [adding an indicator](references/adding-an-indicator.md) before you start, and copy the closest example:

| Example | Shows |
|---|---|
| [examples/trend-ema.ts](examples/trend-ema.ts) | Overlay, one plot coloured per bar with a `palette` |
| [examples/smoothed-williams-r.ts](examples/smoothed-williams-r.ts) | Own pane, two plots, `hlineConfig` levels and a `fillConfig` band |
| [examples/atr-channel.ts](examples/atr-channel.ts) | Several plots, fills between plots with per-bar colours, markers with `shapeConfig` |

Steps:

1. **Pick the group and file.** `src/standard/<name>.ts` for a built-in indicator, `src/community/<id>.ts` for a port of
   a community script. The id is kebab-case and unique in the registry.
2. **Write the module**: `defaultInputs` (typed `<Name>Inputs` interface), `inputConfig`, `plotConfig`, optional
   `hlineConfig` / `fillConfig` / `alertConditions`, `metadata` (`title`, `shortTitle`, `overlay`), `calculate`, and
   one module object (`export const Name = { calculate, metadata, ... }`).
3. **Make `calculate` pure**: merge the inputs over the defaults, compute with `oakscriptjs` (`ta.*`,
   `getSourceSeries`, `Series`), return one point per bar for every declared plot, `NaN` where there is no value.
4. **Register it in `src/index.ts`**: `import * as x from './community/<id>'`, the named exports, and an entry in a
   `registryPart*` array (at most 250 entries per part). `overlay` must equal `metadata.overlay`. Details and the
   extra rules of the standard group: [registration](references/adding-an-indicator.md#registration).
5. **List it** in the catalogue (`docs/INDICATOR_INVENTORY_COMMUNITY.md` for community ports).
6. **Test it** (next section), then `npm run build`.

## Test

| Command | Runs | Needs |
|---|---|---|
| `npm run typecheck` | `tsc` on `src/` and on the skill examples | nothing |
| `npm test` | Unit suite (`vitest.config.ts`): every `tests/**/*.test.ts` except the two reference suites | nothing (seeded bars) |
| `npm run test:reference` | Reference regression (`vitest.reference.config.ts`): equal bars against accepted counts | local data in `tests/reference-regression/data/` |
| `npm run test:pinesuite` | Reference CSV comparison (`vitest.regression.config.ts`) of mapped standard indicators | `PINESUITE_TOKEN` |

Add a unit test for every new indicator. What each suite checks and how to write a test:
[testing](references/testing.md).

## Common mistakes

- Passing input titles (`'RSI Length'`) instead of ids (`length`): unknown keys are ignored silently.
- Bar times in milliseconds: sessions, periods and drawings come out wrong. Use seconds.
- Reading `Object.values(result.plots)` by position: use the `plotConfig` ids, and the plot `time` for the bar.
- Expecting values from the first bar: moving windows start with `NaN`.
- Sharing one `IndicatorRenderer` between indicators: the second `render()` erases the first.
- Declaring a fill between plots only in `fillConfig`: the renderer draws plot fills from the result's `fills`.
- Forgetting `requiredSymbols` / `MissingSymbolDataError` handling: the indicator never draws.
- Growing a `registryPart*` array past 250 entries: larger literals hit TS2590 in `tsc`; start a new part.

## References

- [references/catalogue-and-calling.md](references/catalogue-and-calling.md): catalogue, ids, registry entry fields,
  inputs, result shapes, chart context, other symbols, alerts, renderer, host integration.
- [references/adding-an-indicator.md](references/adding-an-indicator.md): module anatomy, inputs, plots, levels,
  fills, markers, colours, drawings, alerts, registration, catalogue rows.
- [references/testing.md](references/testing.md): the unit, reference and regression suites.
- [examples/](examples/): the tested examples above, plus [call-indicator.ts](examples/call-indicator.ts).
