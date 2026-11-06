/**
 * TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals
 *
 * Traders Dynamic Index on the RSI of the close: volatility bands = SMA(RSI, band length) +/- 1.6185 * standard
 * deviation, their middle (MBL), a fast price line (SMA of the RSI over "Slow MA on RSI" bars, RSI PL) and a signal
 * line (SMA over "Fast MA on RSI" bars, TSL Signal) with a green / red cloud between the two. Long / short labels
 * (bottom / top of the pane) mark crosses of the price line over / under the signal line when the signal line is
 * above / below both the MBL and 50; the background is lime while the price line is above the MBL. RSI divergences
 * (pivots of a second RSI, lookback left / right): regular and hidden bullish / bearish lines and labels, drawn
 * `lbR` bars back on the pivot.
 * Alerts (alertcondition, `alerts` of the result): Long, Short, RSI Crosses Yellow (price line over the MBL).
 *
 * Reference: "TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals" by ZyadaCharts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Credits to LazyBear and JustUncleL.. more features added by ZyadaCharts
 */

import {
  taStep, color,
  type Bar, type BarColorConfig, type FillConfig, type FillData, type HLineConfig, type IndicatorResult,
  type InputConfig, type PlotConfig, type ShapeConfig, type SourceType,
} from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TdiTradersDynamicIndexRsiDivergencesBuyInputs {
  /** RSI Period of the TDI */
  rsiPeriod: number;
  bandLength: number;
  /** Fast MA on RSI (signal line length) */
  lengthrsipl: number;
  /** Slow MA on RSI (price line length) */
  lengthtradesl: number;
  /** RSI Period of the divergences */
  len: number;
  /** RSI Source of the divergences */
  src: SourceType;
  lbR: number;
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: TdiTradersDynamicIndexRsiDivergencesBuyInputs = {
  rsiPeriod: 14,
  bandLength: 34,
  lengthrsipl: 7,
  lengthtradesl: 2,
  len: 14,
  src: 'close',
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'bandLength', type: 'int', title: 'Band Length', defval: 34, min: 1 },
  { id: 'lengthrsipl', type: 'int', title: 'Fast MA on RSI', defval: 7, min: 0 },
  { id: 'lengthtradesl', type: 'int', title: 'Slow MA on RSI', defval: 2, min: 1 },
  { id: 'len', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

/** Pine v4 colours */
const RED = '#FF5252';
const ORANGE = '#FF9800';
const GREEN = '#4CAF50';
const LIME = '#00E676';
const WHITE = '#FFFFFF';
const BAND = String(color.new('#12bcc9', 60));
const MBL = String(color.new(ORANGE, 40));
const RSI_PL = String(color.new(LIME, 30));
const TSL = String(color.new(RED, 60));
const CLOUD_UP = String(color.new(GREEN, 80));
const CLOUD_DN = String(color.new(RED, 80));
const BG = String(color.new(LIME, 95));
const HIDDEN_BULL = String(color.new(GREEN, 80));
const HIDDEN_BEAR = String(color.new(RED, 80));
const NONE = String(color.new(WHITE, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VB Channel High', color: BAND, lineWidth: 2 },
  { id: 'plot1', title: 'VB Channel Low', color: BAND, lineWidth: 2 },
  { id: 'plot2', title: 'MBL', color: MBL, lineWidth: 2 },
  { id: 'plot3', title: 'RSI PL', color: RSI_PL, lineWidth: 2 },
  { id: 'plot4', title: 'TSL Signal', color: TSL, lineWidth: 2 },
  { id: 'plot5', title: 'Regular Bullish', color: GREEN, lineWidth: 2, offset: -5 },
  { id: 'plot6', title: 'Hidden Bullish', color: HIDDEN_BULL, lineWidth: 2, offset: -5 },
  { id: 'plot7', title: 'Regular Bearish', color: RED, lineWidth: 2, offset: -5 },
  { id: 'plot8', title: 'Hidden Bearish', color: HIDDEN_BEAR, lineWidth: 2, offset: -5 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 30, title: 'Level', color: RED, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline1', price: 50, title: 'Level', color: ORANGE, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline2', price: 70, title: 'Level', color: GREEN, linestyle: 'dotted', linewidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot4', title: 'Plots Background', palette: [CLOUD_UP, CLOUD_DN] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Shapes', style: 'labelup', location: 'bottom', color: LIME, size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Shapes', style: 'labeldown', location: 'top', color: RED, size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Regular Bullish Label', style: 'labelup', location: 'absolute', color: GREEN, text: ' Bull ', textcolor: WHITE, offset: -5 },
  { id: 'shape3', kind: 'shape', title: 'Hidden Bullish Label', style: 'labelup', location: 'absolute', color: GREEN, text: ' H Bull ', textcolor: WHITE, offset: -5 },
  { id: 'shape4', kind: 'shape', title: 'Regular Bearish Label', style: 'labeldown', location: 'absolute', color: RED, text: ' Bear ', textcolor: WHITE, offset: -5 },
  { id: 'shape5', kind: 'shape', title: 'Hidden Bearish Label', style: 'labeldown', location: 'absolute', color: RED, text: ' H Bear ', textcolor: WHITE, offset: -5 },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long', message: 'Crossover' },
  { id: 'alert1', title: 'Short', message: 'Crossunder' },
  { id: 'alert2', title: 'RSI Crosses Yellow', message: 'rsi crosses mid' },
];

export const metadata = {
  title: 'TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals',
  shortTitle: 'TDI + RSI Div',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers' | 'bgColors'> & { markers: MarkerData[]; bgColors: BgColorData[]; alerts: AlertConditionState[] };

interface TdiDivVars {
  /** barssince(plFound[1] == true), barssince(phFound[1] == true) */
  plBars: number;
  phBars: number;
  /** valuewhen(plFound, x, 1): the values of the pivot before */
  plOsc: number;
  plLow: number;
  phOsc: number;
  phHigh: number;
}

interface TdiDivRun extends BarRunState<TdiDivVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: WindowSma;
  sd: WindowStdev;
  mbbS: WindowSma;
  mabS: WindowSma;
  xUp: ReturnType<typeof taStep.crossover>;
  xDn: ReturnType<typeof taStep.crossunder>;
  xMid: ReturnType<typeof taStep.crossover>;
  oscS: ReturnType<typeof taStep.rsi>;
  pl: PivotStep;
  ph: PivotStep;
  osc: number[];
  plFound: boolean[];
  phFound: boolean[];
  plots: Point[][];
  regBull: Point[];
  hidBull: Point[];
  regBear: Point[];
  hidBear: Point[];
  fillColors: string[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TdiTradersDynamicIndexRsiDivergencesBuyInputs>): BarStudy<TdiDivRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbR, lbL, rangeUpper, rangeLower } = cfg;
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // the length checks of ta.sma and ta.stdev
      taStep.sma().step(0, cfg.bandLength);
      taStep.stdev().step(0, cfg.bandLength);
      taStep.sma().step(0, cfg.lengthrsipl);
      taStep.sma().step(0, cfg.lengthtradesl);
      const s: TdiDivRun = {
        rsi: taStep.rsi(cfg.rsiPeriod), ma: new WindowSma(cfg.bandLength), sd: new WindowStdev(cfg.bandLength),
        mbbS: new WindowSma(cfg.lengthrsipl), mabS: new WindowSma(cfg.lengthtradesl),
        xUp: taStep.crossover(), xDn: taStep.crossunder(), xMid: taStep.crossover(),
        oscS: taStep.rsi(cfg.len), pl: new PivotStep(lbL, lbR, false), ph: new PivotStep(lbL, lbR, true),
        osc: [], plFound: [], phFound: [], plots: [[], [], [], [], []], regBull: [], hidBull: [], regBear: [], hidBear: [],
        fillColors: [], markers: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { plBars: NaN, phBars: NaN, plOsc: NaN, plLow: NaN, phOsc: NaN, phHigh: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.ma, s.sd, s.mbbS, s.mabS, s.xUp, s.xDn, s.xMid, s.oscS, s.pl, s.ph];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [
        s.osc, s.plFound, s.phFound, ...s.plots, s.regBull, s.hidBull, s.regBear, s.hidBear, s.fillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // TDI
      const r = s.rsi.step(b.close);
      const ma = s.ma.step(r);
      const sd = s.sd.step(r);
      const up = ma + 1.6185 * sd;
      const dn = ma - 1.6185 * sd;
      const mid = (up + dn) / 2;
      const mbb = s.mbbS.step(r);
      const mab = s.mabS.step(r);
      const xUp = s.xUp.step(mab, mbb);
      const xDn = s.xDn.step(mab, mbb);
      const xMid = s.xMid.step(mab, mid);
      s.plots[0][i] = { time, value: fin(up) };
      s.plots[1][i] = { time, value: fin(dn) };
      s.plots[2][i] = { time, value: fin(mid) };
      s.plots[3][i] = { time, value: fin(mab) };
      s.plots[4][i] = { time, value: fin(mbb) };

      // Divergences
      const o0 = s.oscS.step(value(b));
      s.osc[i] = o0;
      const plFound = !Number.isNaN(s.pl.step(i, o0));
      const phFound = !Number.isNaN(s.ph.step(i, o0));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      s.fillColors[i] = gt(mab, mbb) ? CLOUD_UP : CLOUD_DN;
      const long1 = xUp && gt(mbb, mid) && gt(mbb, 50);
      const short1 = xDn && lt(mbb, mid) && lt(mbb, 50);
      const flags = s.flags;
      flags[0][i] = long1;
      flags[1][i] = short1;
      flags[2][i] = xMid;
      for (let k = 0; k < 3; k++) if (flags[k][i]) s.times[k].push(time as number);
      if (long1) s.markers.push({ id: 'shape0', time, position: 'bottom', shape: 'labelUp', color: LIME, size: 'tiny' });
      if (short1) s.markers.push({ id: 'shape1', time, position: 'top', shape: 'labelDown', color: RED, size: 'tiny' });
      if (gt(mab, mid)) s.bgColors.push({ id: 'bgcolor0', time, color: BG });

      if (i > 0 && s.plFound[i - 1]) v.plBars = 0;
      else if (!Number.isNaN(v.plBars)) v.plBars++;
      if (i > 0 && s.phFound[i - 1]) v.phBars = 0;
      else if (!Number.isNaN(v.phBars)) v.phBars++;
      const plInRange = rangeLower <= v.plBars && v.plBars <= rangeUpper;
      const phInRange = rangeLower <= v.phBars && v.phBars <= rangeUpper;

      // The divergence lines are drawn lbR bars back (offset -lbR): bar i sets its own point to na and the point of
      // bar i - lbR (the only writer of that slot), so a new price of the forming bar writes both again
      s.regBull[i] = { time, value: NaN };
      s.hidBull[i] = { time, value: NaN };
      s.regBear[i] = { time, value: NaN };
      s.hidBear[i] = { time, value: NaN };
      const k = i - lbR; // the pivot bar (osc[lbR]), where the offset -lbR draws
      if (k >= 0 && k < i) {
        const kt = bars[k].time;
        s.regBull[k] = { time: kt, value: NaN };
        s.hidBull[k] = { time: kt, value: NaN };
        s.regBear[k] = { time: kt, value: NaN };
        s.hidBear[k] = { time: kt, value: NaN };
      }
      if (plFound) {
        const o = s.osc[k];
        const low = bars[k].low;
        const bullCond = cfg.plotBull && lt(low, v.plLow) && gt(o, v.plOsc) && plInRange;
        const hiddenBullCond = cfg.plotHiddenBull && gt(low, v.plLow) && lt(o, v.plOsc) && plInRange;
        s.regBull[k] = { time: bars[k].time, value: o, color: bullCond ? GREEN : NONE };
        s.hidBull[k] = { time: bars[k].time, value: o, color: hiddenBullCond ? HIDDEN_BULL : NONE };
        if (bullCond) s.markers.push({ id: 'shape2', time: bars[k].time, position: 'atPriceBottom', price: o, shape: 'labelUp', color: GREEN, text: ' Bull ', textColor: WHITE });
        if (hiddenBullCond) s.markers.push({ id: 'shape3', time: bars[k].time, position: 'atPriceBottom', price: o, shape: 'labelUp', color: GREEN, text: ' H Bull ', textColor: WHITE });
        v.plOsc = o;
        v.plLow = low;
      }
      if (phFound) {
        const o = s.osc[k];
        const high = bars[k].high;
        const bearCond = cfg.plotBear && gt(high, v.phHigh) && lt(o, v.phOsc) && phInRange;
        const hiddenBearCond = cfg.plotHiddenBear && lt(high, v.phHigh) && gt(o, v.phOsc) && phInRange;
        s.regBear[k] = { time: bars[k].time, value: o, color: bearCond ? RED : NONE };
        s.hidBear[k] = { time: bars[k].time, value: o, color: hiddenBearCond ? HIDDEN_BEAR : NONE };
        if (bearCond) s.markers.push({ id: 'shape4', time: bars[k].time, position: 'atPriceTop', price: o, shape: 'labelDown', color: RED, text: ' Bear ', textColor: WHITE });
        if (hiddenBearCond) s.markers.push({ id: 'shape5', time: bars[k].time, position: 'atPriceTop', price: o, shape: 'labelDown', color: RED, text: ' H Bear ', textColor: WHITE });
        v.phOsc = o;
        v.phHigh = high;
      }
    },
    result(s, bars) {
      const n = bars.length;
      // Markers in time order (the divergence labels are drawn lbR bars back)
      const markers = s.markers.slice().sort((a, b) => a.time - b.time);
      const fills: FillData[] = [
        { id: 'fill0', plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' }, colors: s.fillColors.slice() },
      ];
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0, plot1, plot2, plot3, plot4,
          plot5: s.regBull.slice(), plot6: s.hidBull.slice(), plot7: s.regBear.slice(), plot8: s.hidBear.slice(),
        },
        hlines: [
          { value: 30, options: { title: 'Level', color: RED, linestyle: 'dotted', linewidth: 1 } },
          { value: 50, options: { title: 'Level', color: ORANGE, linestyle: 'dotted', linewidth: 1 } },
          { value: 70, options: { title: 'Level', color: GREEN, linestyle: 'dotted', linewidth: 1 } },
        ],
        fills,
        markers,
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TdiTradersDynamicIndexRsiDivergencesBuyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TdiTradersDynamicIndexRsiDivergencesBuyInputs> = {},
): Omit<IndicatorResult, 'markers' | 'bgColors'> & { markers: MarkerData[]; bgColors: BgColorData[]; alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TdiTradersDynamicIndexRsiDivergencesBuy = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, shapeConfig, barColorConfig,
  alertConditions,
};
