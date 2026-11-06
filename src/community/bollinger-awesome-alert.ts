/**
 * Bollinger Awesome Alert R1.1 by JustUncleL
 *
 * Overlay=true: Bollinger Bands on price (basis/upper/lower with fill),
 * plus a fast EMA line. Buy/Sell signals when fast EMA crosses BB basis
 * combined with Awesome Oscillator direction.
 *
 * Pine plots:
 *   plot0: bb_basis (red, linewidth 2)
 *   plot1: bb_upper (blue, linewidth 1)  -- "ubi"
 *   plot2: bb_lower (blue, linewidth 1)  -- "lbi"
 *   plot3: bb_sqz_upper (hidden, transp 100)  -- "usqzi"
 *   plot4: bb_sqz_lower (hidden, transp 100)  -- "lsqzi"
 *   plot5: fast_ma (black, linewidth 2)
 *
 * Pine fills:
 *   fill(ubi, lbi) -- center channel, silver transp 90
 *   fill(ubi, usqzi) -- squeeze band upper, dynamic white/blue transp 50
 *   fill(lbi, lsqzi) -- squeeze band lower, dynamic white/blue transp 50
 *
 * Pine plotshape:
 *   break_down -> arrowDown aboveBar red "Sell"
 *   break_up   -> arrowUp belowBar green "Buy"
 *
 * Alerts (alertcondition, `alerts` of the result): 'BBAWE Alert' (break down or break up), 'BBAWE Sell' (break down),
 * 'BBAWE Buy' (break up), from the original's expressions on every bar.
 *
 * Reference: "Bollinger Awesome Alert R1.1 by JustUncleL"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BBAWE Alert', message: 'BBAWE Alert close={{close}}' },
  { id: 'alert1', title: 'BBAWE Sell', message: 'SELL close={{close}}' },
  { id: 'alert2', title: 'BBAWE Buy', message: 'BUY close={{close}}' },
];

export interface BollingerAwesomeAlertInputs {
  bbUseEma: boolean;
  bbFilter: boolean;
  sqzFilter: boolean;
  bbLength: number;
  bbMult: number;
  fastMaLen: number;
  aoSlow: number;
  aoFast: number;
  sqzLength: number;
  sqzThreshold: number;
}

export const defaultInputs: BollingerAwesomeAlertInputs = {
  bbUseEma: false,
  bbFilter: false,
  sqzFilter: false,
  bbLength: 20,
  bbMult: 2.0,
  fastMaLen: 3,
  aoSlow: 34,
  aoFast: 5,
  sqzLength: 100,
  sqzThreshold: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbUseEma', type: 'bool', title: 'Use EMA for Bollinger Band', defval: false },
  { id: 'bbFilter', type: 'bool', title: 'Filter Buy/Sell with BB', defval: false },
  { id: 'sqzFilter', type: 'bool', title: 'Filter Buy/Sell with BB squeeze', defval: false },
  { id: 'bbLength', type: 'int', title: 'Bollinger Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'Base Multiplier', defval: 2.0, min: 0.5, step: 0.1 },
  { id: 'fastMaLen', type: 'int', title: 'Fast EMA length', defval: 3, min: 2 },
  { id: 'aoSlow', type: 'int', title: 'Awesome Length Slow', defval: 34, min: 1 },
  { id: 'aoFast', type: 'int', title: 'Awesome Length Fast', defval: 5, min: 1 },
  { id: 'sqzLength', type: 'int', title: 'BB Relative Squeeze Length', defval: 100, min: 5 },
  { id: 'sqzThreshold', type: 'int', title: 'BB Squeeze Threshold %', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis Line', color: '#F44336', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band Inner', color: '#2196F3', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band Inner', color: '#2196F3', lineWidth: 1 },
  { id: 'plot3', title: 'Hide Sqz Upper', color: '#FFFFFF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Hide Sqz Lower', color: '#FFFFFF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Fast EMA', color: '#000000', lineWidth: 2 },
];

export const metadata = {
  title: 'Bollinger Awesome Alert R1.1',
  shortTitle: 'BBAWE',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface BbaRun extends BarRunState<Record<string, never>> {
  basis: Ma;
  dev: WindowStdev;
  fast: Ma;
  atr: ReturnType<typeof taStep.atr>;
  aoFastMa: WindowSma;
  aoSlowMa: WindowSma;
  avgSpreadPine: WindowSma;
  basisArr: number[];
  fastArr: number[];
  aoArr: number[];
  spreadArr: number[];
  plots: Point[][];
  sqzFillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BollingerAwesomeAlertInputs>): BarStudy<BbaRun, Result> {
  const { bbUseEma, bbFilter, sqzFilter, bbLength, bbMult, fastMaLen, aoSlow, aoFast, sqzLength, sqzThreshold } = { ...defaultInputs, ...inputs };
  const hl2 = barSource('hl2');
  const warmup = Math.max(bbLength, aoSlow);
  return {
    init() {
      // BB basis: EMA or SMA
      const basis: Ma = bbUseEma ? taStep.ema(bbLength) : new WindowSma(bbLength);
      const s: BbaRun = {
        basis,
        dev: new WindowStdev(bbLength),
        // Fast EMA
        fast: taStep.ema(fastMaLen),
        // ATR(14) for squeeze band offset
        atr: taStep.atr(14),
        // Awesome Oscillator: SMA(hl2, fast) - SMA(hl2, slow)
        aoFastMa: new WindowSma(aoFast),
        aoSlowMa: new WindowSma(aoSlow),
        avgSpreadPine: new WindowSma(sqzLength),
        basisArr: [], fastArr: [], aoArr: [], spreadArr: [],
        plots: [[], [], [], [], [], []],
        sqzFillColors: [], markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.basis, s.dev, s.fast, s.atr, s.aoFastMa, s.aoSlowMa, s.avgSpreadPine];
      s.lists = [s.markers, ...s.times];
      s.series = [s.basisArr, s.fastArr, s.aoArr, s.spreadArr, ...s.plots, s.sqzFillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time;
      const close = b.close;
      const basis = s.basis.step(close);
      const dev = s.dev.step(close) * bbMult;
      const upper = basis + dev;
      const lower = basis - dev;
      const fast = s.fast.step(close);
      const atr14 = s.atr.step(b.high, b.low, close);
      const v = hl2(b);
      const ao = s.aoFastMa.step(v) - s.aoSlowMa.step(v);
      s.basisArr[i] = basis;
      s.fastArr[i] = fast;
      s.aoArr[i] = ao;

      // AO direction: >= 0 ? (rising ? 1 : 2) : (rising ? -1 : -2)
      const aoPrev = i > 0 ? s.aoArr[i - 1]! : null;
      let aoDir: number;
      if (ao == null || aoPrev == null) aoDir = 0;
      else if (ao >= 0) aoDir = ao > aoPrev ? 1 : 2;
      else aoDir = ao > aoPrev ? -1 : -2;

      // BB spread and squeeze
      const spread = (upper != null && lower != null) ? upper - lower : 0;
      s.spreadArr[i] = spread;
      let avgSpread: number;
      if (i < sqzLength - 1) avgSpread = 0;
      else {
        let sum = 0;
        for (let j = 0; j < sqzLength; j++) sum += s.spreadArr[i - j]!;
        avgSpread = sum / sqzLength;
      }
      const bbSqueeze = avgSpread !== 0 ? (spread / avgSpread) * 100 : 0;

      // Calculate squeeze band offsets: bb_offset = atr(14) * 0.5
      // bb_sqz_upper = bb_upper + bb_offset, bb_sqz_lower = bb_lower - bb_offset
      const offset = (atr14 ?? 0) * 0.5;
      const sqzUpper = upper != null ? upper + offset : NaN;
      const sqzLower = lower != null ? lower - offset : NaN;

      const hide = i < warmup;
      s.plots[0]![i] = { time, value: (hide || basis == null) ? NaN : basis };
      s.plots[1]![i] = { time, value: (hide || upper == null) ? NaN : upper };
      s.plots[2]![i] = { time, value: (hide || lower == null) ? NaN : lower };
      s.plots[3]![i] = { time, value: (hide || isNaN(sqzUpper)) ? NaN : sqzUpper };
      s.plots[4]![i] = { time, value: (hide || isNaN(sqzLower)) ? NaN : sqzLower };
      s.plots[5]![i] = { time, value: (i < fastMaLen || fast == null) ? NaN : fast };

      // Dynamic squeeze fill colors: white when bb_squeeze > threshold, blue when not
      // Pine: fill(ubi, usqzi, color=bb_squeeze > sqz_threshold ? color.white : color.blue, transp=50)
      // Pine: fill(lbi, lsqzi, color=bb_squeeze > sqz_threshold ? color.white : color.blue, transp=50)
      if (hide) s.sqzFillColors[i] = 'rgba(0,0,0,0)';
      else if (bbSqueeze > sqzThreshold) s.sqzFillColors[i] = 'rgba(255,255,255,0.50)'; // white transp 50
      else s.sqzFillColors[i] = 'rgba(33,150,243,0.50)'; // blue transp 50

      // Buy/Sell signals
      if (i >= warmup + 1) {
        const fastCur = fast;
        const fastPrev = s.fastArr[i - 1];
        const basisCur = basis;
        const basisPrev = s.basisArr[i - 1];
        if (!(fastCur == null || fastPrev == null || basisCur == null || basisPrev == null)) {
          // crossover(fast_ma, bb_basis): fast was <= basis, now >
          const crossUp = fastPrev <= basisPrev && fastCur > basisCur;
          // crossunder(fast_ma, bb_basis): fast was >= basis, now <
          const crossDown = fastPrev >= basisPrev && fastCur < basisCur;

          // Buy: crossover + close > basis + AO direction rising (|AO| == 1)
          // + optional bb_filter (close < upper) + optional sqz_filter (squeeze > threshold)
          if (crossUp && close > basisCur && Math.abs(aoDir) === 1) {
            if (!bbFilter || close < (upper ?? Infinity)) {
              if (!sqzFilter || bbSqueeze > sqzThreshold) {
                s.markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: '#4CAF50', text: 'Buy' });
              }
            }
          }

          // Sell: crossunder + close < basis + AO direction falling (|AO| == 2)
          // + optional bb_filter (close > lower) + optional sqz_filter (squeeze > threshold)
          if (crossDown && close < basisCur && Math.abs(aoDir) === 2) {
            if (!bbFilter || close > (lower ?? -Infinity)) {
              if (!sqzFilter || bbSqueeze > sqzThreshold) {
                s.markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: '#F44336', text: 'Sell' });
              }
            }
          }
        }
      }

      // Alert conditions, the original's break_down / break_up on every bar (AO direction with an na previous value: 2 /
      // -2; bb_squeeze = spread / sma(spread, sqz_length) * 100, na until the average exists)
      const num = (x: number | null | undefined) => x ?? NaN;
      const avgSpreadPine = s.avgSpreadPine.step(num(upper) - num(lower));
      let aoAbs: number;
      if (isNaN(num(ao))) aoAbs = NaN;
      else aoAbs = i > 0 && ao > num(s.aoArr[i - 1]) ? 1 : 2;
      const squeezeOk = !sqzFilter || ((num(upper) - num(lower)) / avgSpreadPine) * 100 > sqzThreshold;
      const pf = i > 0 ? s.fastArr[i - 1] ?? NaN : NaN;
      const pb = i > 0 ? s.basisArr[i - 1] ?? NaN : NaN;
      const fv = fast ?? NaN;
      const bv = basis ?? NaN;
      const xUnder = fv < bv && pf >= pb;
      const xOver = fv > bv && pf <= pb;
      const breakDown = xUnder && close < num(basis) && aoAbs === 2 && (!bbFilter || close > num(lower)) && squeezeOk;
      const breakUp = xOver && close > num(basis) && aoAbs === 1 && (!bbFilter || close < num(upper)) && squeezeOk;
      // alertcondition(break_down or break_up, "BBAWE Alert"), (break_down, "BBAWE Sell"), (break_up, "BBAWE Buy")
      const any = breakDown || breakUp;
      s.flags[0]![i] = any;
      s.flags[1]![i] = breakDown;
      s.flags[2]![i] = breakUp;
      if (any) s.times[0]!.push(time as number);
      if (breakDown) s.times[1]!.push(time as number);
      if (breakUp) s.times[2]!.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const sqzFillColors = s.sqzFillColors.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0]!.slice(), 'plot1': p[1]!.slice(), 'plot2': p[2]!.slice(), 'plot3': p[3]!.slice(), 'plot4': p[4]!.slice(), 'plot5': p[5]!.slice() },
        fills: [
          // fill(ubi, lbi) -- center channel silver transp 90
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(192,192,192,0.10)' } },
          // fill(ubi, usqzi) -- squeeze indication upper band, dynamic white/blue transp 50
          { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(33,150,243,0.50)' }, colors: sqzFillColors },
          // fill(lbi, lsqzi) -- squeeze indication lower band, dynamic white/blue transp 50
          { plot1: 'plot2', plot2: 'plot4', options: { color: 'rgba(33,150,243,0.50)' }, colors: sqzFillColors },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BollingerAwesomeAlertInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BollingerAwesomeAlertInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BollingerAwesomeAlert = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
