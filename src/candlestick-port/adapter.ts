/**
 * Adapter: fits the oakscriptjs candlestick port (PatternDef + patternScript)
 * to this repo's `calculate(bars, inputs): IndicatorResult` registry convention.
 *
 * Each pattern runs through `executeScript(() => patternScript(def), bars, inputs)`.
 * The script produces oakscriptjs-native outputs (markers with location/style,
 * lowercase bgcolors/barcolors); this module converts them to the local
 * MarkerData / BgColorData / BarColorData shapes the example renderer consumes.
 */
import { executeScript, type ScriptRunResult } from 'oakscriptjs/script';
import type { Bar, IndicatorResult, InputConfig, PlotConfig } from 'oakscriptjs';
import type { BarColorData, BgColorData, MarkerData } from '../types';
import { patternScript, type PatternDef } from './pattern-runner';
import { ALL_PATTERNS } from './registry';

/** oakscriptjs MarkerLocation -> local marker position. */
const POSITION: Record<string, MarkerData['position']> = {
  abovebar: 'aboveBar',
  belowbar: 'belowBar',
  top: 'aboveBar',
  bottom: 'belowBar',
  absolute: 'inBar',
};

/** oakscriptjs ShapeStyle -> local marker shape. */
const SHAPE: Record<string, MarkerData['shape']> = {
  arrowup: 'arrowUp',
  arrowdown: 'arrowDown',
  triangleup: 'triangleUp',
  triangledown: 'triangleDown',
  circle: 'circle',
  square: 'square',
  cross: 'cross',
  xcross: 'xcross',
  diamond: 'diamond',
  flag: 'flag',
  labelup: 'labelUp',
  labeldown: 'labelDown',
};

export type PortResult = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  bgColors: BgColorData[];
  barColors: BarColorData[];
};

/** Converts an oakscriptjs script result into the repo's local render shapes. */
function convert(run: ScriptRunResult): PortResult {
  const r = run.result;
  const markers: MarkerData[] = (r.markers ?? []).map((m) => ({
    time: m.time as number,
    position: POSITION[m.location] ?? 'aboveBar',
    shape: SHAPE[m.style as string] ?? 'square',
    color: m.color ?? '#2962FF',
    text: m.text ?? m.char,
  }));
  const bgColors: BgColorData[] = (r.bgcolors ?? []).map((b) => ({
    time: b.time as number,
    color: b.color,
  }));
  const barColors: BarColorData[] = (r.barcolors ?? []).map((b) => ({
    time: b.time as number,
    color: b.color,
  }));
  return {
    metadata: r.metadata,
    plots: r.plots,
    hlines: r.hlines,
    fills: r.fills,
    markers,
    bgColors,
    barColors,
  };
}

/** Indicator object shape expected by the registry (mirrors the native patterns). */
export interface PortIndicator {
  metadata: { title: string; shortTitle: string; overlay: boolean };
  inputConfig: InputConfig[];
  plotConfig: PlotConfig[];
  defaultInputs: Record<string, unknown>;
  calculate: (bars: Bar[], inputs?: Record<string, unknown>) => PortResult;
}

/** Two synthetic bars are enough to harvest the declared inputs/plots/metadata. */
const PROBE_BARS: Bar[] = [
  { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 100 },
];

function buildIndicator(def: PatternDef): PortIndicator {
  const probe = executeScript(() => patternScript(def), PROBE_BARS, {});
  return {
    metadata: {
      title: probe.metadata.title,
      shortTitle: probe.metadata.shortTitle ?? def.shortName,
      overlay: probe.metadata.overlay,
    },
    inputConfig: probe.inputConfig as InputConfig[],
    plotConfig: probe.plotConfig as PlotConfig[],
    defaultInputs: probe.defaultInputs,
    calculate: (bars, inputs = {}) => convert(executeScript(() => patternScript(def), bars, inputs)),
  };
}

/**
 * Pattern id + public export name per entry, in the exact order of ALL_PATTERNS.
 * Ids and export names are kept identical to the previous native patterns so the
 * registry and the package's public API stay stable.
 */
const PATTERN_META: { id: string; exportName: string }[] = [
  { id: 'abandoned-baby-bearish', exportName: 'AbandonedBabyBearish' },
  { id: 'abandoned-baby-bullish', exportName: 'AbandonedBabyBullish' },
  { id: 'dark-cloud-cover', exportName: 'DarkCloudCover' },
  { id: 'doji', exportName: 'Doji' },
  { id: 'doji-star-bearish', exportName: 'DojiStarBearish' },
  { id: 'doji-star-bullish', exportName: 'DojiStarBullish' },
  { id: 'downside-tasuki-gap', exportName: 'DownsideTasukiGap' },
  { id: 'dragonfly-doji', exportName: 'DragonflyDoji' },
  { id: 'engulfing-bearish', exportName: 'EngulfingBearish' },
  { id: 'engulfing-bullish', exportName: 'EngulfingBullish' },
  { id: 'evening-doji-star', exportName: 'EveningDojiStar' },
  { id: 'evening-star', exportName: 'EveningStar' },
  { id: 'falling-three-methods', exportName: 'FallingThreeMethods' },
  { id: 'falling-window', exportName: 'FallingWindow' },
  { id: 'gravestone-doji', exportName: 'GravestoneDoji' },
  { id: 'hammer', exportName: 'Hammer' },
  { id: 'hanging-man', exportName: 'HangingMan' },
  { id: 'harami-bearish', exportName: 'HaramiBearish' },
  { id: 'harami-bullish', exportName: 'HaramiBullish' },
  { id: 'harami-cross-bearish', exportName: 'HaramiCrossBearish' },
  { id: 'harami-cross-bullish', exportName: 'HaramiCrossBullish' },
  { id: 'inverted-hammer', exportName: 'InvertedHammer' },
  { id: 'kicking-bearish', exportName: 'KickingBearish' },
  { id: 'kicking-bullish', exportName: 'KickingBullish' },
  { id: 'long-lower-shadow', exportName: 'LongLowerShadow' },
  { id: 'long-upper-shadow', exportName: 'LongUpperShadow' },
  { id: 'marubozu-black', exportName: 'MarubozuBlack' },
  { id: 'marubozu-white', exportName: 'MarubozuWhite' },
  { id: 'morning-doji-star', exportName: 'MorningDojiStar' },
  { id: 'morning-star', exportName: 'MorningStar' },
  { id: 'on-neck', exportName: 'OnNeck' },
  { id: 'piercing', exportName: 'Piercing' },
  { id: 'rising-three-methods', exportName: 'RisingThreeMethods' },
  { id: 'rising-window', exportName: 'RisingWindow' },
  { id: 'shooting-star', exportName: 'ShootingStar' },
  { id: 'spinning-top-black', exportName: 'SpinningTopBlack' },
  { id: 'spinning-top-white', exportName: 'SpinningTopWhite' },
  { id: 'three-black-crows', exportName: 'ThreeBlackCrows' },
  { id: 'three-white-soldiers', exportName: 'ThreeWhiteSoldiers' },
  { id: 'tri-star-bearish', exportName: 'TriStarBearish' },
  { id: 'tri-star-bullish', exportName: 'TriStarBullish' },
  { id: 'tweezer-bottom', exportName: 'TweezerBottom' },
  { id: 'tweezer-top', exportName: 'TweezerTop' },
  { id: 'upside-tasuki-gap', exportName: 'UpsideTasukiGap' },
];

if (PATTERN_META.length !== ALL_PATTERNS.length) {
  throw new Error(
    `candlestick-port: PATTERN_META (${PATTERN_META.length}) and ALL_PATTERNS (${ALL_PATTERNS.length}) are out of sync`
  );
}

export interface PortEntry {
  id: string;
  exportName: string;
  indicator: PortIndicator;
}

/** id -> indicator object, for the public named exports. */
export const candlestickPortIndicators: Record<string, PortIndicator> = {};

/** Ordered registry entries built from the port. */
export const candlestickPortEntries: PortEntry[] = ALL_PATTERNS.map((def, i) => {
  const meta = PATTERN_META[i];
  const indicator = buildIndicator(def);
  candlestickPortIndicators[meta.id] = indicator;
  return { id: meta.id, exportName: meta.exportName, indicator };
});
