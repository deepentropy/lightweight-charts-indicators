/**
 * Adapter: fits the oakscriptjs candlestick port (PatternDef + patternScript)
 * to this repo's `calculate(bars, inputs, chart): IndicatorResult` registry convention.
 *
 * Each pattern runs through `executeScript(() => patternScript(def), bars, inputs)`, which returns the
 * IndicatorResult shape of this package (markers, bgColors, barColors); the result is passed through.
 * `createRun` is the live run of the same script (oakscriptjs `createScriptRun`): an update resumes from the forming
 * bar of the previous one and gives the result of `calculate` on the same bars (#23).
 */
import { createScriptRun, executeScript, type AlertConditionConfig, type ScriptRunResult } from 'oakscriptjs/script';
import type { ChartContext } from '../chart-context';
import type { IndicatorRun } from '../live-run';
import type { Bar, IndicatorResult, InputConfig, PlotConfig } from 'oakscriptjs';
import type { BarColorData, BgColorData, MarkerData } from '../types';
import { patternScript } from './pattern-runner';
import { ALL_PATTERNS } from './registry';
import { allPatternsScript } from './all-patterns';

export type PortResult = IndicatorResult & {
  markers: MarkerData[];
  bgColors: BgColorData[];
  barColors: BarColorData[];
};

/** The script result, with the marker and colour arrays always present. */
function convert(run: ScriptRunResult): PortResult {
  const r = run.result;
  return { ...r, markers: r.markers ?? [], bgColors: r.bgColors ?? [], barColors: r.barColors ?? [] };
}

/** Indicator object shape expected by the registry (mirrors the native patterns). */
export interface PortIndicator {
  metadata: { title: string; shortTitle: string; overlay: boolean };
  inputConfig: InputConfig[];
  plotConfig: PlotConfig[];
  defaultInputs: Record<string, unknown>;
  /** The script's alertcondition() declarations; the result's `alerts` gives the bars on which each one is true. */
  alertConditions: AlertConditionConfig[];
  calculate: (bars: Bar[], inputs?: Record<string, unknown>, chart?: ChartContext) => PortResult;
  /** The live run of the script: each update calculates the bars from the forming bar of the previous one */
  createRun: (inputs?: Record<string, unknown>, chart?: ChartContext) => IndicatorRun<PortResult>;
}

/** Two synthetic bars are enough to harvest the declared inputs/plots/metadata. */
const PROBE_BARS: Bar[] = [
  { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 100 },
];

function buildIndicator(body: () => void, shortName: string): PortIndicator {
  const probe = executeScript(body, PROBE_BARS, {});
  return {
    metadata: {
      title: probe.metadata.title,
      shortTitle: probe.metadata.shortTitle ?? shortName,
      overlay: probe.metadata.overlay,
    },
    inputConfig: probe.inputConfig as InputConfig[],
    plotConfig: probe.plotConfig as PlotConfig[],
    defaultInputs: probe.defaultInputs,
    alertConditions: probe.alertConfig,
    calculate: (bars, inputs = {}, chart) => convert(executeScript(body, bars, inputs, chart)),
    createRun: (inputs = {}, chart = {}) => {
      const run = createScriptRun(body, inputs, chart);
      return {
        update(bars: Bar[], next?: ChartContext) {
          const u = run.update(bars, next);
          return Object.assign(convert(u), { from: u.from });
        },
        get fullRunReason() {
          return run.fullRunReason;
        },
      };
    },
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
  const indicator = buildIndicator(() => patternScript(def), def.shortName);
  candlestickPortIndicators[meta.id] = indicator;
  return { id: meta.id, exportName: meta.exportName, indicator };
});

/** The composite "*All Candlestick Patterns*" indicator (all patterns, family toggles, Pattern Type filter). */
export const candlestickPortAllPatterns: PortEntry = {
  id: 'all-patterns',
  exportName: 'AllPatterns',
  indicator: buildIndicator(allPatternsScript, 'All Patterns'),
};
