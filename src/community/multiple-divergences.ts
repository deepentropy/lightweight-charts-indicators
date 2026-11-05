/**
 * Multiple Divergences NON-REPAINT
 *
 * Counts, as the original, how many of 10 oscillators show each kind of divergence on the bar: RSI 14, MACD
 * 12 / 26 / 9 line and histogram, Momentum 10, CCI 10, OBV, Stochastic 14 smoothed by an SMA 3, DI oscillator
 * (fixnan(100 * rma(change(high) + change(low), 14) / rma(tr, 14))), volume weighted MACD (VWMA 12 - VWMA 26) and
 * Chaikin Money Flow 21, each with its check box. Per oscillator (each from the first bar where it exists, na where
 * it divides by zero):
 * - plFound / phFound: pivotlow / pivothigh of the oscillator (lbL left, lbR right; found on the bar lbR bars after
 *   the pivot, na values skipped);
 * - regular bullish: plFound, low[lbR] below and osc[lbR] above their values on the pivot low found before
 *   (valuewhen(plFound, x, 1)), and barssince(plFound[1]) between the min and max of the lookback range;
 *   hidden bullish: low[lbR] above and osc[lbR] below; regular / hidden bearish: the same on the pivot highs (high
 *   higher and osc lower / high lower and osc higher).
 *
 * Markers (plotshape, location absolute, as the original): one label per kind and count, "1" to "8" and "8+" for
 * more than 8 (a count above 8 is shown whatever the minimum count), under the pivot low (low[lbR] - 5 ticks) for
 * the bullish kinds and over the pivot high (high[lbR] + 5 ticks) for the bearish kinds, on the bar that confirms
 * the pivot (lbR bars earlier with "Repaint or not?"); teal regular bullish, red regular bearish, green hidden
 * bullish, orange hidden bearish. The symbol tick (`syminfo.mintick`) comes from the chart context.
 *
 * Reference: "Multiple Divergences NON-REPAINT" by PeterO
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MultipleDivergencesInputs {
  /** Repaint or not? (the shapes lbR bars back) */
  offset: boolean;
  minDivCount: number;
  lbR: number;
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
  calcmacd: boolean;
  calcmacda: boolean;
  calcrsi: boolean;
  calcstoc: boolean;
  calccci: boolean;
  calcmom: boolean;
  calcobv: boolean;
  calcdi: boolean;
  calcvwmacd: boolean;
  calccmf: boolean;
}

export const defaultInputs: MultipleDivergencesInputs = {
  offset: false,
  minDivCount: 2,
  lbR: 1,
  lbL: 3,
  rangeUpper: 60,
  rangeLower: 1,
  plotBull: true,
  plotHiddenBull: true,
  plotBear: true,
  plotHiddenBear: true,
  calcmacd: true,
  calcmacda: true,
  calcrsi: true,
  calcstoc: true,
  calccci: true,
  calcmom: true,
  calcobv: true,
  calcdi: true,
  calcvwmacd: true,
  calccmf: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'offset', type: 'bool', title: 'Repaint or not?', defval: false },
  { id: 'minDivCount', type: 'int', title: 'Minimum Div Count to Display', defval: 2, min: 1, max: 10 },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 1, min: 1 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 3, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 1, min: 1 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: true },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: true },
  { id: 'calcmacd', type: 'bool', title: 'MACD', defval: true },
  { id: 'calcmacda', type: 'bool', title: 'MACD Histogram', defval: true },
  { id: 'calcrsi', type: 'bool', title: 'RSI', defval: true },
  { id: 'calcstoc', type: 'bool', title: 'Stochastic', defval: true },
  { id: 'calccci', type: 'bool', title: 'CCI', defval: true },
  { id: 'calcmom', type: 'bool', title: 'Momentum', defval: true },
  { id: 'calcobv', type: 'bool', title: 'OBV', defval: true },
  { id: 'calcdi', type: 'bool', title: 'Diosc', defval: true },
  { id: 'calcvwmacd', type: 'bool', title: 'VWmacd', defval: true },
  { id: 'calccmf', type: 'bool', title: 'Chaikin Money Flow', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dummy', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Multiple Divergences',
  shortTitle: 'Multi Div',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

/** The state of one oscillator in `vars.osc` (OSC_FIELDS slots from 10 * k) */
const PL_OSC0 = 0, PL_OSC1 = 1, PL_LOW0 = 2, PL_LOW1 = 3, PH_OSC0 = 4, PH_OSC1 = 5, PH_HIGH0 = 6, PH_HIGH1 = 7;
const LAST_PL = 8, LAST_PH = 9;
const OSC_FIELDS = 10;

interface DivVars {
  /** Per oscillator: valuewhen(found, x, 1) histories (older first) and the last found bars (-1: none) */
  osc: Float64Array;
  /** obv (cum) and fixnan(diosc) */
  obv: number;
  diosc: number;
}

interface DivRun extends BarRunState<DivVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema12: ReturnType<typeof taStep.ema>;
  ema26: ReturnType<typeof taStep.ema>;
  signal: ReturnType<typeof taStep.ema>;
  mom: ReturnType<typeof taStep.mom>;
  cci: ReturnType<typeof taStep.cci>;
  stoch: ReturnType<typeof taStep.stoch>;
  stk: ReturnType<typeof taStep.sma>;
  rmaDi: ReturnType<typeof taStep.rma>;
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  vwma12: ReturnType<typeof taStep.vwma>;
  vwma26: ReturnType<typeof taStep.vwma>;
  cmfNum: ReturnType<typeof taStep.sma>;
  cmfDen: ReturnType<typeof taStep.sma>;
  pl: PivotStep[];
  ph: PivotStep[];
  /** The values of the 10 oscillators by bar */
  oscs: number[][];
  plot0: { time: number; value: number }[];
  markers: MarkerData[];
}

function study(inputs: Partial<MultipleDivergencesInputs>): BarStudy<DivRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { minDivCount, lbR, lbL, rangeUpper, rangeLower, plotBull, plotHiddenBull, plotBear, plotHiddenBear } = cfg;
  const div = (a: number, b: number) => (b === 0 ? NaN : a / b); // x / 0 is na in Pine
  // In the order of the original's counting: rsi, macd, deltamacd, moment, cci, obv, stk, diosc, vwmacd, cmf
  const on = [
    cfg.calcrsi, cfg.calcmacd, cfg.calcmacda, cfg.calcmom, cfg.calccci, cfg.calcobv, cfg.calcstoc, cfg.calcdi,
    cfg.calcvwmacd, cfg.calccmf,
  ];
  const at = (arr: number[], i: number) => (i >= 0 ? arr[i] : NaN);

  // ---- Markers ----
  // The original has one plotshape per kind and count: "1" to "8" and "8+" (more than 8) for the regular bullish
  // (shape0-shape8), regular bearish (shape9-shape17), hidden bullish (shape18-shape26) and hidden bearish
  // (shape27-shape35) divergences. Shape k (1-8) shows when count == k and mindivcount < k + 1; "8+" when
  // count > 8 and mindivcount < 11 (always: mindivcount is at most 10). Price: low[lbR] - voffset (labelup) /
  // high[lbR] + voffset (labeldown), voffset = 5 * syminfo.mintick; offset = -off (lbR bars back with "Repaint or
  // not?" on)
  let voffset = NaN;
  const off = cfg.offset ? lbR : 0;
  const shown = (count: number) => count > 8 || (count >= 1 && count >= minDivCount);
  const label = (count: number) => (count > 8 ? '8+' : String(count));
  const shapeId = (first: number, count: number) => `shape${first + Math.min(count, 9) - 1}`;
  const teal = '#00897B', red = '#FF5252', green = '#4CAF50', orange = '#FF9800';
  const osc = new Array<number>(10);

  return {
    init(_bars, chart) {
      voffset = 5 * mintickOf(chart);
      const st = new Float64Array(10 * OSC_FIELDS).fill(NaN);
      for (let k = 0; k < 10; k++) {
        st[k * OSC_FIELDS + LAST_PL] = -1;
        st[k * OSC_FIELDS + LAST_PH] = -1;
      }
      const s: DivRun = {
        rsi: taStep.rsi(14), ema12: taStep.ema(12), ema26: taStep.ema(26), signal: taStep.ema(9), mom: taStep.mom(10),
        cci: taStep.cci(10), stoch: taStep.stoch(14), stk: taStep.sma(), rmaDi: taStep.rma(14), tr: taStep.tr(),
        trur: taStep.rma(14), vwma12: taStep.vwma(12), vwma26: taStep.vwma(26), cmfNum: taStep.sma(), cmfDen: taStep.sma(),
        // plFound(_osc) = not na(pivotlow(_osc, lbL, lbR)), phFound(_osc) = not na(pivothigh(_osc, lbL, lbR))
        pl: on.map(() => new PivotStep(lbL, lbR, false)),
        ph: on.map(() => new PivotStep(lbL, lbR, true)),
        oscs: on.map(() => []), plot0: [], markers: [],
        steps: [], vars: { osc: st, obv: 0, diosc: NaN }, lists: [], series: [],
      };
      s.steps = [
        s.rsi, s.ema12, s.ema26, s.signal, s.mom, s.cci, s.stoch, s.stk, s.rmaDi, s.tr, s.trur, s.vwma12, s.vwma26,
        s.cmfNum, s.cmfDen, ...s.pl, ...s.ph,
      ];
      s.lists = [s.markers];
      s.series = [...s.oscs, s.plot0];
      return s;
    },
    copyVars: (v) => ({ ...v, osc: v.osc.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const volume = b.volume ?? 0;
      const prev = i > 0 ? bars[i - 1] : undefined;

      // ---- The 10 oscillators of the original (na until their windows are full) ----
      // rsi = rsi(close, 14)
      osc[0] = s.rsi.step(close);
      // [macd, signal, deltamacd] = macd(close, 12, 26, 9)
      const macd = s.ema12.step(close) - s.ema26.step(close);
      osc[1] = macd;
      osc[2] = macd - s.signal.step(macd);
      // moment = mom(close, 10)
      osc[3] = s.mom.step(close);
      // cci = cci(close, 10)
      osc[4] = s.cci.step(close);
      // obv = cum(change(close) > 0 ? volume : change(close) < 0 ? -volume : 0 * volume)
      const ch = prev ? close - prev.close : NaN;
      v.obv = (i > 0 ? v.obv : 0) + (ch > 0 ? volume : ch < 0 ? -volume : 0);
      osc[5] = v.obv;
      // stk = sma(stoch(close, high, low, 14), 3)
      osc[6] = s.stk.step(s.stoch.step(close, b.high, b.low), 3);
      // DI = change(high) - (-change(low)), trur = rma(tr, 14), diosc = fixnan(100 * rma(DI, 14) / trur)
      const di = prev ? (b.high - prev.high) + (b.low - prev.low) : NaN;
      const rmaDi = s.rmaDi.step(di);
      const trur = s.trur.step(s.tr.step(b.high, b.low, close));
      const d = div(100 * rmaDi, trur);
      if (Number.isFinite(d)) v.diosc = d;
      osc[7] = v.diosc;
      // vwmacd = vwma(close, 12) - vwma(close, 26)
      osc[8] = s.vwma12.step(close, volume) - s.vwma26.step(close, volume);
      // Cmfm = ((close - low) - (high - close)) / (high - low), Cmfv = Cmfm * volume, cmf = sma(Cmfv, 21) / sma(volume, 21)
      const cmfv = div((close - b.low) - (b.high - close), b.high - b.low) * volume;
      osc[9] = div(s.cmfNum.step(cmfv, 21), s.cmfDen.step(volume, 21));
      for (let k = 0; k < 10; k++) s.oscs[k][i] = osc[k];

      // Per-bar counts: posdivergence, negdivergence, posdivergencehidden, negdivergencehidden
      let regBullCount = 0, regBearCount = 0, hidBullCount = 0, hidBearCount = 0;
      const lowR = i - lbR >= 0 ? bars[i - lbR].low : NaN;
      const highR = i - lbR >= 0 ? bars[i - lbR].high : NaN;
      const st = v.osc;
      for (let k = 0; k < 10; k++) {
        if (!on[k]) continue;
        const o = k * OSC_FIELDS;
        const pl = !Number.isNaN(s.pl[k].step(i, osc[k]));
        const ph = !Number.isNaN(s.ph[k].step(i, osc[k]));
        const oscR = at(s.oscs[k], i - lbR);
        // barssince(found[1] == true): bars since the bar after the last found bar
        const lastPl = st[o + LAST_PL], lastPh = st[o + LAST_PH];
        const plSince = i > 0 && lastPl >= 0 ? i - (lastPl + 1) : NaN;
        const phSince = i > 0 && lastPh >= 0 ? i - (lastPh + 1) : NaN;
        // valuewhen(found, x, 1): x on the found bar before the latest one (the latest is the current bar when found)
        if (pl) { st[o + PL_OSC0] = st[o + PL_OSC1]; st[o + PL_OSC1] = oscR; st[o + PL_LOW0] = st[o + PL_LOW1]; st[o + PL_LOW1] = lowR; }
        if (ph) { st[o + PH_OSC0] = st[o + PH_OSC1]; st[o + PH_OSC1] = oscR; st[o + PH_HIGH0] = st[o + PH_HIGH1]; st[o + PH_HIGH1] = highR; }
        const plRange = rangeLower <= plSince && plSince <= rangeUpper;
        const phRange = rangeLower <= phSince && phSince <= rangeUpper;
        // valuewhen(..., 1): the value one occurrence back (na until two occurrences)
        const vwPlOsc = st[o + PL_OSC0], vwPlLow = st[o + PL_LOW0], vwPhOsc = st[o + PH_OSC0], vwPhHigh = st[o + PH_HIGH0];
        // bullCond: priceLL and oscHL and plFound
        if (plotBull && lowR < vwPlLow && oscR > vwPlOsc && plRange && pl) regBullCount++;
        // bearCond: priceHH and oscLH and phFound
        if (plotBear && highR > vwPhHigh && oscR < vwPhOsc && phRange && ph) regBearCount++;
        // hiddenBullCond: priceHL and oscLL and plFound
        if (plotHiddenBull && lowR > vwPlLow && oscR < vwPlOsc && plRange && pl) hidBullCount++;
        // hiddenBearCond: priceLH and oscHH and phFound
        if (plotHiddenBear && highR < vwPhHigh && oscR > vwPhOsc && phRange && ph) hidBearCount++;
        if (pl) st[o + LAST_PL] = i;
        if (ph) st[o + LAST_PH] = i;
      }

      // ---- Generate markers ----
      const p = i - lbR; // the pivot bar
      const t = i - off; // the bar the shape is drawn on
      if (p >= 0 && t >= 0) {
        const time = bars[t].time;
        const lowP = bars[p].low;
        const highP = bars[p].high;
        if (shown(regBullCount)) {
          s.markers.push({ time, position: 'atPriceBottom', price: lowP - voffset, shape: 'labelUp', color: teal,
            textColor: '#FFFFFF', text: label(regBullCount), id: shapeId(0, regBullCount) });
        }
        if (shown(regBearCount)) {
          s.markers.push({ time, position: 'atPriceTop', price: highP + voffset, shape: 'labelDown', color: red,
            textColor: '#FFFFFF', text: label(regBearCount), id: shapeId(9, regBearCount) });
        }
        if (shown(hidBullCount)) {
          s.markers.push({ time, position: 'atPriceBottom', price: lowP - voffset, shape: 'labelUp', color: green,
            textColor: '#FFFFFF', text: label(hidBullCount), id: shapeId(18, hidBullCount) });
        }
        if (shown(hidBearCount)) {
          s.markers.push({ time, position: 'atPriceTop', price: highP + voffset, shape: 'labelDown', color: orange,
            textColor: '#FFFFFF', text: label(hidBearCount), id: shapeId(27, hidBearCount) });
        }
      }

      // Dummy plot (overlay indicator needs at least one plot)
      s.plot0[i] = { time: b.time, value: NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MultipleDivergencesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MultipleDivergencesInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const MultipleDivergences = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
