/**
 * Money Flow Extended
 *
 * Money Flow Index of hlc3 over `Length` bars, with a moving average (SMA / EMA / SMMA (RMA) / WMA / VWMA) of the
 * MFI. Bands at 80 / 50 / 20 with a background fill between 80 and 20, and gradient fills of the MFI above 80
 * (green) and below 20 (red). Regular divergences: an MFI pivot low (5 bars left, `Pivot Lookback` bars right) with a
 * higher MFI and a lower price low than at the previous pivot low (5 to 60 bars since the last pivot low) gives a
 * Bull label; an MFI pivot high with a lower MFI and a higher price high gives a Bear label. The divergence lines and
 * labels are drawn on the pivot bar (Pine offset = -lookbackRight).
 *
 * Alerts (alertcondition, `alerts` of the result): 'Regular Bullish Divergence' / 'Regular Bearish Divergence', true on
 * the bar on which the divergence is found (`Pivot Lookback` bars after the pivot).
 *
 * Reference: "Money Flow Extended" by alexrainman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, PivotStep, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export type MoneyFlowExtendedMAType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface MoneyFlowExtendedInputs {
  /** MFI length */
  length: number;
  /** Bars right of a pivot (the divergence shows this many bars later) */
  lookbackRight: number;
  /** Detect divergences */
  calculateDivergence: boolean;
  /** Moving average type */
  maTypeInput: MoneyFlowExtendedMAType;
  /** Moving average length */
  maLengthInput: number;
}

export const defaultInputs: MoneyFlowExtendedInputs = {
  length: 14,
  lookbackRight: 5,
  calculateDivergence: true,
  maTypeInput: 'SMA',
  maLengthInput: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1, max: 2000 },
  { id: 'lookbackRight', type: 'int', title: 'Pivot Lookback', defval: 5, min: 1, max: 5 },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: true },
  { id: 'maTypeInput', type: 'string', title: 'Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLengthInput', type: 'int', title: 'Length', defval: 14 },
];

const BAND = '#787B86';
const BAND_MID = String(color.new('#787B86', 50));
const BG_FILL = String(color.rgb(126, 87, 194, 90));
const NONE = String(color.new(color.white, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MF', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'Middle Line', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'MF-based MA', color: color.yellow, lineWidth: 1 },
  { id: 'plot3', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot4', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
];

/** hline(80 / 50 / 20); Pine's default hline style is dashed */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_overbought', price: 80, title: 'Overbought', color: BAND, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Middle Band', color: BAND_MID, linestyle: 'dashed' },
  { id: 'hline_oversold', price: 20, title: 'Oversold', color: BAND, linestyle: 'dashed' },
];

/** fill(overbought, oversold, color = color.rgb(126, 87, 194, 90), title = "Background") */
export const fillConfig: FillConfig[] = [
  { id: 'fill_background', plot1: 'hline_overbought', plot2: 'hline_oversold', color: BG_FILL, title: 'Background' },
];

export const metadata = {
  title: 'Money Flow Extended',
  shortTitle: 'MF',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

/** A sum within 1e-10 of 0 is 0 */
const zero = (x: number): number => (Math.abs(x) <= 1e-10 ? 0 : x);

/**
 * `ta.mfi(source, length)` with a constant length from {@link WindowSum}s of the money flow of the up and down bars
 * (the doubles of taStep.mfi, faster)
 */
class Mfi {
  private readonly upper: WindowSum;
  private readonly lower: WindowSum;
  private prev = NaN;
  private pending = NaN;
  private count = 0;
  private stepped = false;

  constructor(length: number) {
    if (Math.trunc(length) <= 0) {
      throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${Math.trunc(length).toFixed(1)}) in the 'mfi' function. It must be > 0.`);
    }
    this.upper = new WindowSum(length);
    this.lower = new WindowSum(length);
  }

  step(value: number, volume: number): number {
    this.stepped = true;
    this.pending = value;
    const change = this.count === 0 ? NaN : value - this.prev;
    const flow = volume * value;
    // PineScript change <= 0 / change >= 0 (false for na)
    const down = !Number.isNaN(change) && change <= 1e-10;
    const up = !Number.isNaN(change) && -change <= 1e-10;
    const u = zero(this.upper.step(down ? 0 : flow));
    const l = zero(this.lower.step(up ? 0 : flow));
    if (Number.isNaN(u) || Number.isNaN(l)) return NaN;
    if (l === 0) return 100;
    const ratio = 1 + u / l;
    return ratio === 0 ? NaN : 100 - 100 / ratio;
  }

  commit(): void {
    if (this.stepped) {
      this.stepped = false;
      this.prev = this.pending;
      this.count++;
    }
    this.upper.commit();
    this.lower.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface MfeVars {
  /** ta.valuewhen(found, x, 1): the last two values of x on the found bars (older first) */
  plMf: readonly number[];
  plLow: readonly number[];
  phMf: readonly number[];
  phHigh: readonly number[];
  /** ta.barssince(plFound[1]) (both _inRange calls use plFound[1]) */
  barsSince: number;
}

interface MfeRun extends BarRunState<MfeVars> {
  mfi: Mfi;
  ma: Ma | null;
  pl: PivotStep;
  ph: PivotStep;
  mf: number[];
  plFound: boolean[];
  plots: Point[][];
  bullPlot: Point[];
  bearPlot: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen history: the value added on a found bar */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length >= 2 ? h[h.length - 2]! : NaN);

function study(inputs: Partial<MoneyFlowExtendedInputs>): BarStudy<MfeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = cfg.lookbackRight;
  const lookbackLeft = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const len = cfg.maLengthInput;
  const maStep = (): Ma | null => {
    switch (cfg.maTypeInput) {
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return taStep.vwma(len);
      default: return null;
    }
  };
  return {
    init() {
      const s: MfeRun = {
        mfi: new Mfi(cfg.length), ma: maStep(), pl: new PivotStep(lookbackLeft, lb, false),
        ph: new PivotStep(lookbackLeft, lb, true), mf: [], plFound: [], plots: [[], [], []], bullPlot: [], bearPlot: [],
        markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { plMf: [], plLow: [], phMf: [], phHigh: [], barsSince: NaN }, lists: [], series: [],
      };
      s.steps = [s.mfi, ...(s.ma ? [s.ma] : []), ...(cfg.calculateDivergence ? [s.pl, s.ph] : [])];
      s.lists = [s.bullPlot, s.bearPlot, s.markers, ...s.times];
      s.series = [s.mf, s.plFound, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const volume = b.volume ?? NaN;
      // mf = ta.mfi(hlc3, length)
      const mf = s.mfi.step((b.high + b.low + b.close) / 3, volume);
      s.mf[i] = mf;
      const ma = s.ma ? s.ma.step(mf, volume) : NaN;
      s.plots[0][i] = { time, value: mf, color: '#7E57C2' };
      // midLinePlot = plot(50, color = na, editable = false, display = display.none)
      s.plots[1][i] = { time, value: 50 };
      s.plots[2][i] = { time, value: ma, color: color.yellow };

      // Divergence
      const m = i - lb >= 0 ? s.mf[i - lb] : NaN;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.calculateDivergence) {
        const v = s.vars;
        const pl = s.pl.step(i, mf);
        const ph = s.ph.step(i, mf);
        const prevPl = i > 0 && s.plFound[i - 1];
        if (prevPl) v.barsSince = 0;
        else if (!isNaN(v.barsSince)) v.barsSince++;
        const inRange = rangeLower <= v.barsSince && v.barsSince <= rangeUpper;

        plFound = !isNaN(pl);
        const lowLBR = i - lb >= 0 ? bars[i - lb].low : NaN;
        if (plFound) {
          v.plMf = pushed(v.plMf, m);
          v.plLow = pushed(v.plLow, lowLBR);
        }
        const mfiHL = gt(m, second(v.plMf)) && inRange;
        const priceLL = lt(lowLBR, second(v.plLow));
        bullCond = priceLL && mfiHL && plFound;

        phFound = !isNaN(ph);
        const highLBR = i - lb >= 0 ? bars[i - lb].high : NaN;
        if (phFound) {
          v.phMf = pushed(v.phMf, m);
          v.phHigh = pushed(v.phHigh, highLBR);
        }
        const mfiLH = lt(m, second(v.phMf)) && inRange;
        const priceHH = gt(highLBR, second(v.phHigh));
        bearCond = priceHH && mfiLH && phFound;
      }
      s.plFound[i] = plFound;

      if (i >= lb) {
        // offset = -lookbackRight: the value of bar i is drawn on bar i - lookbackRight
        const t = barTime(bars, i - lb);
        // plot(plFound ? mfiLBR : na, offset = -lookbackRight, linewidth = 2, color = bullCond ? bullColor : noneColor)
        s.bullPlot.push({ time: t, value: plFound ? m : NaN, color: bullCond ? color.green : NONE });
        s.bearPlot.push({ time: t, value: phFound ? m : NaN, color: bearCond ? color.red : NONE });
        // plotshape(bullCond ? mfiLBR : na, offset = -lookbackRight, text = " Bull ", shape.labelup, location.absolute,
        //   color = bullColor, textcolor = color.white)
        if (bullCond && !isNaN(m)) {
          s.markers.push({ time: t, position: 'atPriceBottom', price: m, shape: 'labelUp', color: color.green, text: ' Bull ',
            textColor: color.white });
        }
        if (bearCond && !isNaN(m)) {
          s.markers.push({ time: t, position: 'atPriceTop', price: m, shape: 'labelDown', color: color.red, text: ' Bear ',
            textColor: color.white });
        }
      }
      // alertcondition(bullCond, 'Regular Bullish Divergence') / alertcondition(bearCond, 'Regular Bearish Divergence')
      [bullCond, bearCond].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.bullPlot.slice(),
          plot4: s.bearPlot.slice(),
        },
        hlines: [
          { value: 80, options: { title: 'Overbought', color: BAND, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Middle Band', color: BAND_MID, linestyle: 'dashed' } },
          { value: 20, options: { title: 'Oversold', color: BAND, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_overbought', plot2: 'hline_oversold', options: { title: 'Background' },
            colors: new Array<string>(n).fill(BG_FILL) },
          // fill(mfiPlot, midLinePlot, 100, 80, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Overbought Gradient Fill' },
            gradient: { topValue: new Array(n).fill(100), bottomValue: new Array(n).fill(80),
              topColor: new Array(n).fill(String(color.new(color.green, 0))),
              bottomColor: new Array(n).fill(String(color.new(color.green, 100))) } },
          // fill(mfiPlot, midLinePlot, 20, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Oversold Gradient Fill' },
            gradient: { topValue: new Array(n).fill(20), bottomValue: new Array(n).fill(0),
              topColor: new Array(n).fill(String(color.new(color.red, 100))),
              bottomColor: new Array(n).fill(String(color.new(color.red, 0))) } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MoneyFlowExtendedInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MoneyFlowExtendedInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence, `Pivot Lookback` number of bars to the left of the current bar.' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence, `Pivot Lookback` number of bars to the left of the current bar.' },
];

export const MoneyFlowExtended = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
