/**
 * OBV (Delta or regular)
 *
 * Delta volume OBV: cumulative sum of buy volume - sell volume, with buy volume = volume * (close - low) / range
 * and sell volume = volume * (high - close) / range (0 on a bar with no range); or the regular OBV: cumulative sum
 * of sign(change(close)) * volume. The OBV can be smoothed by a moving average (SMA / EMA / VWMA / WMA). The signal
 * line is a moving average of the same type (VWMA / WMA of the unsmoothed OBV); the signal is yellow when the OBV
 * is above it, red otherwise. Optional "irregularities" colour the OBV green / red when one side of the volume is
 * more than twice the other against the close direction. Regular divergences of the OBV pivots against the close
 * are drawn as lines between the pivots.
 *
 * Reference: "OBV (Delta or regular)" by GizmoTheInvestor
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ObvGizmoInputs {
  /** Moving average type of the smoothed OBV and of the signal line */
  choice: 'SMA' | 'EMA' | 'VWMA' | 'WMA';
  /** Delta volume OBV (true) or regular OBV (false) */
  cumOBV: boolean;
  /** Smooth the OBV line */
  fast: boolean;
  /** Moving average length of the smoothed OBV */
  smaFast: number;
  /** Moving average length of the signal line */
  smaSlow: number;
  /** Colour the OBV when one volume side is more than twice the other */
  irr: boolean;
  plotBull: boolean;
  plotBear: boolean;
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
}

export const defaultInputs: ObvGizmoInputs = {
  choice: 'VWMA',
  cumOBV: true,
  fast: false,
  smaFast: 20,
  smaSlow: 30,
  irr: false,
  plotBull: true,
  plotBear: true,
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
};

const DIV_GROUP = 'Irregulatorries / Divergences';

export const inputConfig: InputConfig[] = [
  { id: 'choice', type: 'string', title: 'Ma type', defval: 'VWMA', options: ['SMA', 'EMA', 'VWMA', 'WMA'] },
  { id: 'cumOBV', type: 'bool', title: 'Delta volume', defval: true },
  { id: 'fast', type: 'bool', title: 'Smoothed OBV', defval: false },
  { id: 'smaFast', type: 'int', title: 'Smoothed OBV length', defval: 20 },
  { id: 'smaSlow', type: 'int', title: 'Ma conversion', defval: 30 },
  { id: 'irr', type: 'bool', title: 'irregulatorries', defval: false, group: DIV_GROUP },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish divergence', defval: true },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish divergence', defval: true },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5, group: DIV_GROUP },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5, group: DIV_GROUP },
  { id: 'rangeUpper', type: 'int', title: 'Max Lookback Range', defval: 60, group: DIV_GROUP },
  { id: 'rangeLower', type: 'int', title: 'Min Lookback Range', defval: 5, group: DIV_GROUP },
];

const BULL_COL = String(color.new('#00ff00', 0));
const BEAR_COL = String(color.new('#ff0000', 0));
const NONE_COL = String(color.new('#ff00ee', 100));
const DOUBLE_BUY_COL = '#00ff00';
const DOUBLE_SELL_COL = '#ff0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'signal', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Regular Bullish', color: BULL_COL, lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'Regular Bearish', color: BEAR_COL, lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'OBV (Delta or regular)',
  shortTitle: 'OBV (Delta or regular)',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Ma = { step(v: number, volume: number): number; commit(): void };

/** One moving average of the study (SMA / EMA / VWMA / WMA) with a constant length */
function maStep(choice: ObvGizmoInputs['choice'], length: number): Ma {
  switch (choice) {
    case 'SMA': { const m = new WindowSma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'VWMA': {
      // ta.vwma = sma(source * volume) / sma(volume), na when the volume average is 0 or na
      const num = new WindowSma(length);
      const den = new WindowSma(length);
      return {
        step: (v, vol) => { const a = num.step(v * vol); const d = den.step(vol); return d === 0 || Number.isNaN(d) ? NaN : a / d; },
        commit: () => { num.commit(); den.commit(); },
      };
    }
    default: { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
  }
}

interface ObvVars {
  /** ta.valuewhen(found, x, 1): the last two values (older first) */
  plObv: readonly number[];
  plClose: readonly number[];
  phObv: readonly number[];
  phClose: readonly number[];
  /** _inRange(found[1]): ta.barssince(found[1] == true), na before the first true */
  plSince: number;
  phSince: number;
}

interface ObvRun extends BarRunState<ObvVars> {
  cum: ReturnType<typeof taStep.cum>;
  change: ReturnType<typeof taStep.change>;
  fastMa: Ma | null;
  slowMa: Ma;
  pl: PivotStep;
  ph: PivotStep;
  obv: number[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

/** ta.valuewhen history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (NaN before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<ObvGizmoInputs>): BarStudy<ObvRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbL, lbR, rangeLower, rangeUpper } = cfg;
  return {
    init() {
      const cum = taStep.cum();
      const change = taStep.change();
      const fastMa = cfg.fast ? maStep(cfg.choice, cfg.smaFast) : null;
      const slowMa = maStep(cfg.choice, cfg.smaSlow);
      const pl = new PivotStep(lbL, lbR, false);
      const ph = new PivotStep(lbL, lbR, true);
      const s: ObvRun = {
        cum, change, fastMa, slowMa, pl, ph, obv: [], plFound: [], phFound: [], plot0: [], plot1: [], plot2: [],
        plot3: [], steps: [cum, change, ...(fastMa ? [fastMa] : []), slowMa, pl, ph],
        vars: { plObv: [], plClose: [], phObv: [], phClose: [], plSince: NaN, phSince: NaN }, lists: [], series: [],
      };
      s.series = [s.obv, s.plFound, s.phFound, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      // buyVolume / sellVolume: (high == low) ? 0 : volume * (close - low) / (high - low), ... (high - close) / ...
      const buyVolume = eq(b.high, b.low) ? 0 : (vol * (b.close - b.low)) / (b.high - b.low);
      const sellVolume = eq(b.high, b.low) ? 0 : (vol * (b.high - b.close)) / (b.high - b.low);

      // obvChoice = cumOBV ? ta.cum(deltaVolume) : ta.cum(math.sign(ta.change(close)) * volume)
      const change = s.change.step(b.close);
      const obvChoice = s.cum.step(cfg.cumOBV ? buyVolume - sellVolume : Math.sign(change) * vol);
      const obv = s.fastMa ? s.fastMa.step(obvChoice, vol) : obvChoice;
      s.obv[i] = obv;
      // the signal: a VWMA / WMA of the unsmoothed OBV, an SMA / EMA of the OBV
      const smaObv = s.slowMa.step(cfg.choice === 'VWMA' || cfg.choice === 'WMA' ? obvChoice : obv, vol);

      const closePrev = i > 0 ? bars[i - 1].close : NaN;
      const doubleBuy = cfg.irr && gt(buyVolume, sellVolume * 2) && lt(b.close, closePrev);
      const doubleSell = cfg.irr && gt(sellVolume, buyVolume * 2) && ge(b.close, closePrev);
      s.plot0[i] = { time: b.time, value: obv, color: doubleBuy ? DOUBLE_BUY_COL : doubleSell ? DOUBLE_SELL_COL : color.blue };
      // smaObvColor = obv > smaObv ? color.yellow : color.red
      s.plot1[i] = { time: b.time, value: smaObv, color: gt(obv, smaObv) ? color.yellow : color.red };

      // Divergences
      const plFound = !isNaN(s.pl.step(i, obv));
      const phFound = !isNaN(s.ph.step(i, obv));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      const o = i - lbR >= 0 ? s.obv[i - lbR] : NaN;
      const c = i - lbR >= 0 ? bars[i - lbR].close : NaN;
      const v = s.vars;

      const plPrev = i > 0 && s.plFound[i - 1];
      v.plSince = plPrev ? 0 : isNaN(v.plSince) ? NaN : v.plSince + 1;
      const inRangePl = rangeLower <= v.plSince && v.plSince <= rangeUpper;
      if (plFound) {
        v.plObv = pushed(v.plObv, o);
        v.plClose = pushed(v.plClose, c);
      }
      const obvHL = ge(o, second(v.plObv)) && inRangePl;
      const priceLL = lt(c, second(v.plClose));
      const bullCond = cfg.plotBull && priceLL && obvHL && plFound;

      const phPrev = i > 0 && s.phFound[i - 1];
      v.phSince = phPrev ? 0 : isNaN(v.phSince) ? NaN : v.phSince + 1;
      const inRangePh = rangeLower <= v.phSince && v.phSince <= rangeUpper;
      if (phFound) {
        v.phObv = pushed(v.phObv, o);
        v.phClose = pushed(v.phClose, c);
      }
      const obvLH = le(o, second(v.phObv)) && inRangePh;
      const priceHH = gt(c, second(v.phClose));
      const bearCond = cfg.plotBear && priceHH && obvLH && phFound;

      // plot(found ? obv[lbR] : na, offset = -lbR, color = cond ? col : noneColor): the value of bar i is drawn on bar
      // i - lbR (bar i is the only writer of that point)
      if (i - lbR < 0) return;
      const time = barTime(bars, i - lbR);
      s.plot2[i - lbR] = { time, value: plFound ? o : NaN, color: bullCond ? BULL_COL : NONE_COL };
      s.plot3[i - lbR] = { time, value: phFound ? o : NaN, color: bearCond ? BEAR_COL : NONE_COL };
    },
    result(s, bars) {
      const m = Math.max(0, bars.length - lbR);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(0, m), plot3: s.plot3.slice(0, m) },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ObvGizmoInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ObvGizmoInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ObvGizmo = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
