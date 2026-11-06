/**
 * Elder Impulse System
 *
 * Colours the background of each bar after two measures of the source (the close, or the close of another
 * timeframe): green when both the EMA (length 13) and the MACD histogram (EMA 12 - EMA 26, minus the SMA 9 of that
 * difference) rise from the bar before, red when both fall, blue otherwise. The same colour can also paint the price
 * bars ("showColorBars", off by default). No line is plotted.
 *
 * Other timeframe ("useCustomResolution"): the bars of that timeframe are built from the chart bars (periods from
 * the UTC calendar and the bars, or the exchange calendar of the chart context, see src/anchor-period.ts). As in
 * the original (a version 1 script), every chart bar of a period gets the close of that period at its end (on past
 * bars the value of a period is known from its first bar; the last period is still open); the EMA and the
 * histogram are then computed on the chart bars. A timeframe below the chart timeframe needs data that the bars do
 * not carry: the port throws an Error.
 *
 * Reference: "Elder Impulse System [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear
 */

import {
  taStep, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ElderImpulseSystemInputs {
  /** Take the close of the timeframe below instead of the chart close */
  useCustomResolution: boolean;
  customResolution: string;
  /** Also colour the price bars */
  showColorBars: boolean;
  lengthEMA: number;
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: ElderImpulseSystemInputs = {
  useCustomResolution: false,
  customResolution: 'D',
  showColorBars: false,
  lengthEMA: 13,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'useCustomResolution', type: 'bool', title: 'useCustomResolution', defval: false },
  { id: 'customResolution', type: 'timeframe', title: 'customResolution', defval: 'D' },
  { id: 'showColorBars', type: 'bool', title: 'showColorBars', defval: false },
  { id: 'lengthEMA', type: 'int', title: 'lengthEMA', defval: 13 },
  { id: 'fastLength', type: 'int', title: 'fastLength', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'slowLength', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'signalLength', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Elder Impulse System [LazyBear]',
  shortTitle: 'EIS_LB',
  overlay: false,
};

// Colour constants of Pine version 1 (transp = 0)
const GREEN = '#008000';
const RED = '#FF0000';
const BLUE = '#0000FF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * security(tickerid, tf, close) on the chart symbol, version 1 rule: every chart bar of a period gets the close of
 * the period (no gaps).
 */
function securityClose(bars: Bar[], tf: string, context?: ChartContext): number[] {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return bars.map((b) => b.close);
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  return mapToChart(htf.map((b) => b.close), group, [], true, false);
}

type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] };

interface ElderRun extends BarRunState<Record<string, never>> {
  /** The higher-timeframe closes (custom resolution), else null (the chart close) */
  source: number[] | null;
  ema: ReturnType<typeof taStep.ema>;
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  signal: WindowSma;
  emaSeries: number[];
  hist: number[];
  bgColors: BgColorData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<ElderImpulseSystemInputs>): BarStudy<ElderRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    // every chart bar of a period gets the close of the whole period: a new bar changes the earlier bars of its period
    fullRunReason: () => (cfg.useCustomResolution ? 'close of the custom resolution period on every bar' : null),
    init(bars, chart) {
      // source = security(tickerid, useCustomResolution ? customResolution : period, close)
      const source = cfg.useCustomResolution ? securityClose(bars, cfg.customResolution, chart) : null;
      const ema = taStep.ema(cfg.lengthEMA);
      // calc_hist(source, fastLength, slowLength)
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const signal = new WindowSma(cfg.signalLength);
      const s: ElderRun = {
        source, ema, fast, slow, signal, emaSeries: [], hist: [], bgColors: [], barColors: [],
        steps: [ema, fast, slow, signal], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.barColors];
      s.series = [s.emaSeries, s.hist];
      return s;
    },
    bar(s, i, bars) {
      const src = s.source ? s.source[i] ?? NaN : bars[i].close;
      const emaSeries = s.ema.step(src) ?? NaN;
      const macd = (s.fast.step(src) ?? NaN) - (s.slow.step(src) ?? NaN);
      const signal = s.signal.step(macd) ?? NaN;
      const hist = macd - signal;
      s.emaSeries[i] = emaSeries;
      s.hist[i] = hist;
      // get_color(emaSeries, macdHist)
      const e1 = i > 0 ? s.emaSeries[i - 1] : NaN;
      const h1 = i > 0 ? s.hist[i - 1] : NaN;
      const gF = gt(emaSeries, e1) && gt(hist, h1);
      const rF = lt(emaSeries, e1) && lt(hist, h1);
      const c = gF ? GREEN : rF ? RED : BLUE;
      s.bgColors.push({ time: bars[i].time, color: c });
      if (cfg.showColorBars) s.barColors.push({ time: bars[i].time, color: c });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        bgColors: s.bgColors.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ElderImpulseSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ElderImpulseSystemInputs> = {}, chart?: ChartContext): IndicatorResult & {
  barColors: BarColorData[]; bgColors: BgColorData[];
} {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const IndicatorElderImpulseSystem = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
