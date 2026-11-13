# Finding and calling indicators

Code for everything below: [../examples/call-indicator.ts](../examples/call-indicator.ts) (tested).

## Catalogue

The registry (`indicatorRegistry`, exported by the main entry, built in `src/index.ts`) holds every indicator. The
`docs/` files are readable views of it:

| File | Content | Ids |
|---|---|---|
| `docs/INDICATOR_INVENTORY.md` | Standard indicators by complexity score, with status; a "Built-in studies" table with their source files | No: search the registry by name |
| `docs/INDICATOR_INVENTORY_COMMUNITY.md` | Every community port: name, **Id**, category, pane (`price` / `own`), author of the original, comparison batch | Yes (`Id` column) |
| `docs/INDICATOR_INVENTORY_CANDLESTICK.md` | The candlestick patterns and their signal (bullish, bearish, neutral) | No: ids are the kebab-case names, e.g. `engulfing-bullish`, `all-patterns` |

The README lists the standard indicators by category.

Groups (`entry.group`) and where their code lives:

| Group | Source | Content |
|---|---|---|
| `standard` | `src/standard/<file>.ts` | Built-in indicators (RSI, MACD, Bollinger Bands, VWAP, pivots, ...) with the inputs of their originals |
| `community` | `src/community/<id>.ts` | Ports of community PineScript scripts (licence and author in the file header) |
| `candlestick` | `src/candlestick-port/` | Candlestick patterns, one entry per pattern plus `all-patterns` |

Categories (`entry.category`): `Moving Averages`, `Momentum`, `Volatility`, `Volume`, `Trend`, `Oscillators`,
`Channels & Bands`, `Candlestick Patterns`.

Ids are unique, kebab-case and stable (a host stores them in saved layouts). A standard id is short (`sma`, `bb`,
`rsi`, `macd`, `vwap`); a community id is the slug of the original title (`atr-bands`, `ut-bot`).

## Registry entry

`IndicatorRegistryEntry` (exported type). The fields you read most:

| Field | Meaning |
|---|---|
| `id`, `group`, `category` | See above |
| `name`, `shortName`, `description?` | Full title (lists), short title (legend), one sentence (standard group only; the help text of every entry is in `lightweight-charts-indicators/about`) |
| `overlay` | `true`: price pane; `false`: own pane |
| `metadata` | `{ title, shortTitle, overlay }` of the module |
| `inputConfig` | One row per input, see [Inputs](#inputs) |
| `defaultInputs` | `{ [inputId]: default }` |
| `plotConfig` | One row per line plot: `id`, `title`, `color`, `lineWidth?`, `style?` (`line`, `stepline`, `histogram`, `area`, `circles`, `columns`, `cross`, `linebr`, ...), `display?`, `offset?`, `histbase?`, `linestyle?`, `forceOverlay?`, `palette?`, `visible?`, `editable?` |
| `hlineConfig?` | Horizontal levels: `id`, `price`, `title?`, `color?`, `linestyle?`, `linewidth?` |
| `fillConfig?` | Fills: `id`, `plot1`, `plot2` (plot or hline ids), `color?`, `title?`, `palette?` |
| `shapeConfig?`, `arrowConfig?`, `barColorConfig?`, `plotCandleConfig?`, `drawingKinds?` | Declarations of markers, arrows, bar / background colours, candles and drawing kinds (for a settings UI) |
| `outputs?` | Outputs in the order the original numbers them for alert messages |
| `format?` | Value format: `{ type: 'price' \| 'volume' \| 'percent', precision? }`; unset = the symbol's price format |
| `alertConditions?`, `hasAlertFunction?` | See [Alerts](#alerts) |
| `requiredSymbols?(inputs, chart)` | Other symbols the indicator needs, see [Other symbols](#other-symbols) |
| `usesVisibleRange?` | Depends on the visible bars, see [Chart context](#chart-context) |
| `calculate(bars, inputs?, chart?)` | Returns the result |

Each module also exports its pieces (`export { RSI, calculate as calculateRSI } from './standard/rsi'`), so
`RSI.calculate(bars, { length: 14 })` works too. Prefer the registry: it adds the reference names, value formats,
style declarations and alert conditions to the entries.

## Inputs

`InputConfig` rows (type from `oakscriptjs`), in the order and grouping of the original's settings:

| Field | Meaning |
|---|---|
| `id` | Key in the inputs object |
| `type` | `int`, `float`, `bool`, `string` (with `options` for a list), `text_area`, `source`, `color`, `timeframe`, `session`, `time` (UNIX ms), `symbol` |
| `defval` | Default (same as `defaultInputs[id]`) |
| `title`, `tooltip` | Label and help text |
| `min`, `max`, `step`, `options` | Limits and choices |
| `group`, `inline` | Section header; inputs with the same `inline` share a row |
| `display` | Where the value shows outside the dialog |
| `active` | Condition on other inputs (greyed out when false); evaluate it with `isInputActive()` from `oakscriptjs`. An inactive input still reaches `calculate` |

`source` inputs take `open`, `high`, `low`, `close`, `hl2`, `hlc3`, `ohlc4`, `hlcc4` (some indicators also `volume`).
`timeframe` values are strings such as `'60'`, `'1D'`, `'1W'`; an empty string is the chart timeframe.

## Result

`calculate` returns an `IndicatorResult` (type from `oakscriptjs`). Only `metadata` and `plots` are always there.

| Key | Shape |
|---|---|
| `plots` | `{ [plotId]: { time, value, color? }[] }`, usually one point per bar (a shifted plot can have fewer, or points after the last bar: match by `time`), `NaN` = no value; `color` overrides the plot colour on that bar |
| `hlines` | `{ value, options: { title, color, linestyle, linewidth } }[]`: levels of an indicator without `hlineConfig` (they can follow the inputs) |
| `fills` | `{ id?, plot1, plot2, options: { color, transp, title }, colors?: string[], gradient? }[]`: fills between plots (or hlines); `colors[i]` per bar, `'transparent'` = nothing on that bar |
| `markers` | `{ time, position, shape, color, text?, textColor?, size?, price?, id? }[]` (plotshape / plotchar); `id` names its `shapeConfig` row |
| `arrows` | `{ time, id, value, color }[]` (plotarrow) |
| `barColors`, `bgColors` | `{ time, color, id? }[]` |
| `plotCandles`, `plotBars` | `{ [id]: { time, open, high, low, close, color? }[] }` |
| `labels`, `lines`, `boxes`, `linefills`, `polylines`, `tables` | Drawing objects alive after the last bar |
| `alerts`, `alertCalls` | See [Alerts](#alerts) |
| `outputValues` | Values of shape / character / arrow outputs by id (for alert placeholders) |

Several indicators return extra keys (for example `visibility`, flags that drive which plots are shown); the
renderer reads them, other code can ignore them.

## Chart context

Third argument of `calculate`, every field optional (`ChartContext`, exported type): `timeframe` (`'15'`, `'1D'`),
`timezone` (exchange IANA zone), `session` (`'0930-1600'`), `sessionType` (`regular` / `extended`), `tickerid`
(`'EXCHANGE:SYMBOL'`), `mintick`, `symbolType`, `currency`, `foregroundColor`, `backgroundColor`, `now` (ms),
`lastBarConfirmed`, `leftVisibleBarTime` / `rightVisibleBarTime` (ms), `bars`, `symbolInfo`. Without them an
indicator falls back to tick 0.01, UTC, the dark theme colours, the computer clock and closed bars.

An entry with `usesVisibleRange: true` draws from the visible bars: pass the visible range and calculate again when
the user scrolls or zooms.

## Other symbols

Entries with `requiredSymbols` read bars of other symbols or other timeframes. The host gives them through
`chart.bars(symbol, timeframe)` (same time unit as the chart bars) and `chart.symbolInfo(symbol)` (time zone and
session of that symbol). Call `entry.requiredSymbols(inputs, chart)` to preload them. When bars are missing
`calculate` throws `MissingSymbolDataError` (exported) whose `requests` lists every `{ symbol, timeframe }` needed:
load them and calculate again (`runWithOtherSymbols()` in the example).

## Alerts

- `entry.alertConditions`: the conditions the indicator declares (`id`, `title`, `message`). The result's `alerts`
  has, per condition, `times` (bar times where it is true) and `triggered` (true on the last bar).
- `entry.hasAlertFunction`: the indicator emits alert calls; the result's `alertCalls` lists `{ time, message, freq }`.

## Drawing a result

`lightweight-charts-indicators/render` (ES module, needs `lightweight-charts` 5):

- `new IndicatorRenderer(chart, { paneIndex, mainSeries })`. Overlay entries draw in pane 0, the others in
  `paneIndex`. `mainSeries` (the price series) is needed for bar colours and for markers placed next to the bars.
- `renderer.render(entry, result, bars, options)` draws plots, hlines, fills, markers, arrows, bar and background
  colours, candles, labels, lines, boxes, linefills, polylines and tables. It accepts a registry entry or any object
  with `overlay`, `plotConfig`, `hlineConfig?`, `fillConfig?`, `arrowConfig?`.
- Options: `inputs` (plots whose `visible` names an input follow it), `plots` (per plot id: `visible`, `color`,
  `lineWidth`, `style`, `palette`), `lastValueVisible`, `titleVisible`, `priceLineVisible`, `precision`,
  `autoscale: false` (keep out of the price autoscale), `reuseSeries: true` (live update of the same indicator).
- `renderer.series()` lists the series it created (plot series first, in `plotConfig` order); `renderer.clear()`
  removes them and the pane it emptied.

Plot fills come from the result's `fills`; fills between two hlines come from the result or, when it has none,
from `entry.fillConfig`. Levels come from `entry.hlineConfig`, else from the result's `hlines`.

## Host integration

How a charting app uses the library in production:

- **Menus without the code.** The library is several megabytes. Build a manifest of `[id, name, shortName, group]`
  at build time for lists and search, and `import('lightweight-charts-indicators')` on first use.
- **Inputs.** Store only the user's changes per study; calculate with `{ ...entry.defaultInputs, ...changes }`.
- **One layer per study instance** (`rsi#2` resolves to the entry `rsi`): its own `IndicatorRenderer`, and its own
  pane when `entry.overlay` is false.
- **Errors stay local.** Wrap `calculate` in `try`: on `MissingSymbolDataError` mark the study loading, fetch the
  requests, calculate again when they arrive; any other error marks that study failed without breaking the chart.
- **Chart context.** Build it from the symbol and chart state (timeframe, time zone, session, tick, visible range in
  ms) and give `bars` / `symbolInfo` from the app's own cache.
- **Study on study.** A `source` input that names another study's output is resolved with `setSourceResolver()` from
  `oakscriptjs`, set around the `calculate` call and reset after it.
- **Style settings.** Overrides of fills are matched to `fillConfig` by `id` (else by `plot1` / `plot2` and title);
  markers, bar and background colours by the `id` of their declaration.

## Source code of the standard indicators

`lightweight-charts-indicators/sources` gives `builtinSource(id)`: the plain JavaScript source of a standard
indicator, importing only `oakscriptjs` and `lightweight-charts-indicators/helpers`. Load it on demand (about 500 kB).

## Help texts

`lightweight-charts-indicators/about` gives `aboutIndicator(id)` (and the `indicatorAbout` table): for every registry
entry, 2 or 3 plain English sentences on what it computes, how to read it and its main inputs (at most 500
characters). Load it on demand (about 600 kB). The texts are written from each entry's code by
`scripts/about/write.mjs` and checked by `scripts/about/check.mjs` (names and numbers they give are the entry's).
