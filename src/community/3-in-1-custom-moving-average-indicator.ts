/**
 * 3-in-1 Custom Moving Average Indicator
 *
 * Bollinger Bands (basis = SMA / EMA / RMA / WMA / VWMA of the source, bands at +- stdev * multiplier) with a
 * transparent fill, and three moving averages (EMA or SMA) of a second source. MA1 and MA2 are yellow when the close
 * is at or above them, red otherwise; MA3 is black and hidden by default. Each group has its own plot offset.
 * Alert (alertcondition, `alerts` of the result): 'Spike Alert', true on the bars whose |close - open| / open * 100
 * is at least the candle move %.
 *
 * Reference: "3-in-1 Custom Moving Average Indicator" by Mr-Fish
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Mr-Fish
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type BbMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
type MaType = 'SMA' | 'EMA';

export interface ThreeInOneCustomMovingAverageIndicatorInputs {
  showBB: boolean;
  /** Bollinger Bands length */
  bbLength: number;
  /** Basis moving average type */
  bbType: BbMaType;
  bbSource: SourceType;
  /** Standard deviation multiplier */
  bbMult: number;
  /** Plot offset of the bands */
  bbOffset: number;
  /** Source of the moving averages */
  src: SourceType;
  /** Plot offset of the moving averages */
  offset: number;
  plot1: boolean;
  type1: MaType;
  len1: number;
  plot2: boolean;
  type2: MaType;
  len2: number;
  plot3: boolean;
  type3: MaType;
  len3: number;
  /** Candle move % of the spike alert (the 'Spike Alert' condition only) */
  alertPct: number;
}

export const defaultInputs: ThreeInOneCustomMovingAverageIndicatorInputs = {
  showBB: true,
  bbLength: 26,
  bbType: 'SMA',
  bbSource: 'close',
  bbMult: 2.0,
  bbOffset: 0,
  src: 'close',
  offset: 0,
  plot1: true,
  type1: 'EMA',
  len1: 21,
  plot2: true,
  type2: 'EMA',
  len2: 55,
  plot3: false,
  type3: 'EMA',
  len3: 100,
  alertPct: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBB', type: 'bool', title: 'Show Bollinger Bands', defval: true },
  { id: 'bbLength', type: 'int', title: 'Length', defval: 26, min: 1 },
  { id: 'bbType', type: 'string', title: 'Basis MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'bbSource', type: 'source', title: 'Source', defval: 'close' },
  { id: 'bbMult', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001, max: 50 },
  { id: 'bbOffset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'plot1', type: 'bool', title: 'Plot MA1', defval: true },
  { id: 'type1', type: 'string', title: 'Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'len1', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'plot2', type: 'bool', title: 'Plot MA2', defval: true },
  { id: 'type2', type: 'string', title: 'Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'len2', type: 'int', title: 'Length', defval: 55, min: 1 },
  { id: 'plot3', type: 'bool', title: 'Plot MA3', defval: false },
  { id: 'type3', type: 'string', title: 'Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'len3', type: 'int', title: 'Length', defval: 100, min: 1 },
  { id: 'alertPct', type: 'float', title: 'Candle Move %', defval: 2.0, min: 0.1, max: 5000 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#858585', lineWidth: 1 },
  { id: 'plot1', title: 'Lower', color: '#858585', lineWidth: 1 },
  { id: 'plot2', title: 'MA1', color: color.yellow, lineWidth: 1 },
  { id: 'plot3', title: 'MA2', color: color.yellow, lineWidth: 1 },
  { id: 'plot4', title: 'MA3', color: color.black, lineWidth: 1 },
];

export const metadata = {
  title: 'Custom MAs V_4.0 ',
  shortTitle: 'MAs_V_4.0',
  overlay: true,
};

/** Pine float comparison a >= b: false when a < b by more than 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface ThreeInOneRun extends BarRunState<Record<string, never>> {
  basis: Ma | null;
  dev: WindowStdev | null;
  mas: Ma[];
  /** Per bar: upper, lower, ma1, ma2, ma3, the colours of ma1 / ma2 */
  upper: number[];
  lower: number[];
  ma1: number[];
  ma2: number[];
  ma3: number[];
  col1: string[];
  col2: string[];
  /** plot(..., offset = k <= 0): the points from bar -k, point i + k written by bar i (its only writer) */
  shiftedBb: Point[][];
  shiftedMa: Point[][];
  spike: boolean[];
  times: number[];
}

function study(inputs: Partial<ThreeInOneCustomMovingAverageIndicatorInputs>): BarStudy<ThreeInOneRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bbValue = barSource(cfg.bbSource);
  const value = barSource(cfg.src);
  const bbK = cfg.bbOffset;
  const maK = cfg.offset;
  // Moving averages: type == "EMA" ? ta.ema(src, len) : ta.sma(src, len)
  const maStep = (type: MaType, len: number): Ma => {
    if (type === 'EMA') { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    const m = new WindowSma(len);
    return { step: (v) => m.step(v), commit: () => m.commit() };
  };
  const basisStep = (): Ma => {
    switch (cfg.bbType) {
      case 'EMA': { const m = taStep.ema(cfg.bbLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(cfg.bbLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.bbLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(cfg.bbLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = new WindowSma(cfg.bbLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const grey = () => '#858585';
  const black = () => color.black;
  return {
    fullRunReason: () => (isBarSource(cfg.src) && (!cfg.showBB || isBarSource(cfg.bbSource)) ? null : 'source of another study'),
    init() {
      // Bollinger Bands (calculated only when enabled)
      const basis = cfg.showBB ? basisStep() : null;
      const dev = cfg.showBB ? new WindowStdev(cfg.bbLength) : null;
      const mas = [maStep(cfg.type1, cfg.len1), maStep(cfg.type2, cfg.len2), maStep(cfg.type3, cfg.len3)];
      const s: ThreeInOneRun = {
        basis, dev, mas, upper: [], lower: [], ma1: [], ma2: [], ma3: [], col1: [], col2: [],
        shiftedBb: [[], []], shiftedMa: [[], [], []], spike: [], times: [],
        steps: [...(basis ? [basis] : []), ...(dev ? [dev] : []), ...mas], vars: {}, lists: [], series: [],
      };
      s.lists = [s.times];
      s.series = [s.upper, s.lower, s.ma1, s.ma2, s.ma3, s.col1, s.col2, s.spike];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      if (s.basis && s.dev) {
        const x = bbValue(b);
        const basis = s.basis.step(x, b.volume ?? NaN);
        const sd = s.dev.step(x);
        s.upper[i] = basis + sd * cfg.bbMult;
        s.lower[i] = basis - sd * cfg.bbMult;
      } else {
        s.upper[i] = NaN;
        s.lower[i] = NaN;
      }
      const x = value(b);
      const m1 = s.mas[0].step(x, NaN);
      const m2 = s.mas[1].step(x, NaN);
      s.ma1[i] = m1;
      s.ma2[i] = m2;
      s.ma3[i] = s.mas[2].step(x, NaN);
      s.col1[i] = ge(b.close, m1) ? color.yellow : color.red;
      s.col2[i] = ge(b.close, m2) ? color.yellow : color.red;

      // movePct = math.abs(close - open) / open * 100; spike = movePct >= alertPct
      const spike = ge(Math.abs(b.close - b.open) / b.open * 100, cfg.alertPct);
      s.spike[i] = spike;
      if (spike) s.times.push(b.time as number);

      // plot(..., offset = k <= 0): the value of bar i is drawn on bar i + k, an earlier bar (point i + k of the plot)
      if (bbK <= 0 && i + bbK >= 0) {
        const time = bars[i + bbK].time;
        s.shiftedBb[0][i + bbK] = { time, value: cfg.showBB ? s.upper[i] : NaN, color: '#858585' };
        s.shiftedBb[1][i + bbK] = { time, value: cfg.showBB ? s.lower[i] : NaN, color: '#858585' };
      }
      if (maK <= 0 && i + maK >= 0) {
        const time = bars[i + maK].time;
        s.shiftedMa[0][i + maK] = { time, value: cfg.plot1 ? m1 : NaN, color: s.col1[i] };
        s.shiftedMa[1][i + maK] = { time, value: cfg.plot2 ? m2 : NaN, color: s.col2[i] };
        s.shiftedMa[2][i + maK] = { time, value: cfg.plot3 ? s.ma3[i] : NaN, color: color.black };
      }
    },
    result(s, bars) {
      const n = bars.length;
      // plot(..., offset = k > 0): the value (and colour) of bar i is drawn on bar i + k (after the last bar: the bar
      // interval of the whole set), built from the values of every bar
      const interval = bbK > 0 || maK > 0 ? barInterval(bars) : 0;
      const shifted = (show: boolean, values: number[], colorAt: (i: number) => string, k: number): Point[] => {
        const out: Point[] = [];
        for (let i = 0; i < n; i++) {
          if (i + k < 0) continue;
          out.push({ time: barTime(bars, i + k, interval), value: show ? values[i] : NaN, color: colorAt(i) });
        }
        return out;
      };
      const kept = (points: Point[], k: number): Point[] => {
        points.length = Math.max(0, n + k);
        return points.slice();
      };
      const bb = bbK > 0
        ? [shifted(cfg.showBB, s.upper, grey, bbK), shifted(cfg.showBB, s.lower, grey, bbK)]
        : s.shiftedBb.map((p) => kept(p, bbK));
      const ma = maK > 0
        ? [
            shifted(cfg.plot1, s.ma1, (i) => s.col1[i], maK),
            shifted(cfg.plot2, s.ma2, (i) => s.col2[i], maK),
            shifted(cfg.plot3, s.ma3, black, maK),
          ]
        : s.shiftedMa.map((p) => kept(p, maK));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: bb[0], plot1: bb[1], plot2: ma[0], plot3: ma[1], plot4: ma[2] },
        // fill(bbUpper, bbLower, color = color.new(#858585, 100)): fully transparent
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: String(color.new('#858585', 100)) } }],
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.spike[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<ThreeInOneCustomMovingAverageIndicatorInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ThreeInOneCustomMovingAverageIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Spike Alert', message: 'Price moved {{close}} from open by threshold %' },
];

export const ThreeInOneCustomMovingAverageIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
