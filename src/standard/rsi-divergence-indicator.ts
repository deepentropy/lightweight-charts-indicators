/**
 * RSI Divergence Indicator
 *
 * RSI (ta.rsi of the source) with divergences found on its pivots. A pivot low / high of the RSI is known
 * `Pivot Lookback Right` bars after its bar; it is compared with the previous RSI pivot of the same kind when the
 * pivot found before it is between `Min of Lookback Range` and `Max of Lookback Range` bars back:
 * - Regular Bullish: RSI higher low, price lower low (on the lows of the pivot bars)
 * - Hidden Bullish: RSI lower low, price higher low
 * - Regular Bearish: RSI lower high, price higher high (on the highs of the pivot bars)
 * - Hidden Bearish: RSI higher high, price lower high
 * Each kind draws a line through the RSI pivots (transparent unless the divergence is found and its "Plot" input is
 * on) and a label on the pivot bar. The lines and labels are drawn `Pivot Lookback Right` bars back (Pine offset).
 *
 * Based on the standard RSI Divergence Indicator.
 *
 * Not ported: the Timeframe setting of indicator(timeframe = "") (the chart timeframe is used), the alert conditions.
 */

import {
  taStep, compare,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData, OutputDecl, OutputValues } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiDivergenceIndicatorInputs {
  /** RSI Period */
  len: number;
  /** RSI Source */
  src: SourceType;
  /** Pivot Lookback Right */
  lbR: number;
  /** Pivot Lookback Left */
  lbL: number;
  /** Max of Lookback Range */
  rangeUpper: number;
  /** Min of Lookback Range */
  rangeLower: number;
  /** Plot Bullish */
  plotBull: boolean;
  /** Plot Hidden Bullish */
  plotHiddenBull: boolean;
  /** Plot Bearish */
  plotBear: boolean;
  /** Plot Hidden Bearish */
  plotHiddenBear: boolean;
}

export const defaultInputs: RsiDivergenceIndicatorInputs = {
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
  { id: 'len', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5, display: 'data_window' },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5, display: 'data_window' },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60, display: 'data_window' },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5, display: 'data_window' },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true, display: 'data_window' },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false, display: 'data_window' },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true, display: 'data_window' },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false, display: 'data_window' },
];

// Pine v6 colours: color.green #4CAF50, color.red #F23645; hidden colours color.new(c, 80) (alpha byte 51)
const BULL_COLOR = '#4CAF50';
const BEAR_COLOR = '#F23645';
const HIDDEN_BULL_COLOR = '#4CAF5033';
const HIDDEN_BEAR_COLOR = '#F2364533';
// noneColor = color.new(color.white, 100)
const NONE_COLOR = '#FFFFFF00';
// textColor = color.white
const TEXT_COLOR = '#FFFFFF';

// The divergence lines: display = display.pane, offset = -lbR (applied to the point times)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Regular Bullish', color: BULL_COLOR, lineWidth: 2, display: 'pane' },
  { id: 'plot2', title: 'Hidden Bullish', color: HIDDEN_BULL_COLOR, lineWidth: 2, display: 'pane' },
  { id: 'plot3', title: 'Regular Bearish', color: BEAR_COLOR, lineWidth: 2, display: 'pane' },
  { id: 'plot4', title: 'Hidden Bearish', color: HIDDEN_BEAR_COLOR, lineWidth: 2, display: 'pane' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid', price: 50, title: 'Middle Line', color: '#787B86', linestyle: 'dotted', linewidth: 1 },
  { id: 'hline_ob', price: 70, title: 'Overbought', color: '#787B86', linestyle: 'dotted', linewidth: 1 },
  { id: 'hline_os', price: 30, title: 'Oversold', color: '#787B86', linestyle: 'dotted', linewidth: 1 },
];

// fill(obLevel, osLevel, title = "Background", color = color.rgb(33, 150, 243, 90))
export const fillConfig: FillConfig[] = [
  { id: 'fill_background', plot1: 'hline_ob', plot2: 'hline_os', color: '#2196F31A', title: 'Background' },
];

export const metadata = {
  title: 'RSI Divergence Indicator',
  shortTitle: 'RSI Divergence Indicator',
  overlay: false,
};

type PlotPoint = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; outputValues: OutputValues; alerts: AlertConditionState[] };
type Label = { time: number; value: number };

interface RdiVars {
  /** _inRange(found[1]): ta.barssince(found[1] == true) */
  plSince: number;
  phSince: number;
}

interface RdiRun extends BarRunState<RdiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  pl: PivotStep;
  ph: PivotStep;
  /** ta.valuewhen(found, x[lbR], 1): osc and low of the pivot lows, osc and high of the pivot highs */
  vw: ReturnType<typeof taStep.valuewhen>[];
  osc: number[];
  plFound: boolean[];
  phFound: boolean[];
  /** RSI, then the bull, hidden bull, bear and hidden bear lines */
  plots: PlotPoint[][];
  markers: MarkerData[];
  /** bullLabel, hiddenBullLabel, bearLabel, hiddenBearLabel */
  labels: Label[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RsiDivergenceIndicatorInputs>): BarStudy<RdiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbR, lbL, rangeUpper, rangeLower } = cfg;
  const value = barSource(cfg.src);
  const inRange = (since: number) => compare.le(rangeLower, since) && compare.le(since, rangeUpper);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.len);
      const pl = new PivotStep(lbL, lbR, false);
      const ph = new PivotStep(lbL, lbR, true);
      const vw = [0, 1, 2, 3].map(() => taStep.valuewhen(1));
      const s: RdiRun = {
        rsi, pl, ph, vw, osc: [], plFound: [], phFound: [], plots: [[], [], [], [], []], markers: [],
        labels: [[], [], [], []], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [rsi, pl, ph, ...vw], vars: { plSince: NaN, phSince: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.labels, ...s.times];
      s.series = [s.osc, s.plFound, s.phFound, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // osc = ta.rsi(src, len)
      const o = s.rsi.step(value(b));
      s.osc[i] = o;
      s.plots[0][i] = { time: b.time, value: o };
      // plFound = na(ta.pivotlow(osc, lbL, lbR)) ? false : true (same for the highs)
      const plFound = !Number.isNaN(s.pl.step(i, o));
      const phFound = !Number.isNaN(s.ph.step(i, o));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      // _inRange(cond) => bars = ta.barssince(cond == true); rangeLower <= bars and bars <= rangeUpper
      // inRangePl = _inRange(plFound[1]): called on every bar (plFound[1] is false on the first bar)
      v.plSince = i > 0 && s.plFound[i - 1] ? 0 : Number.isNaN(v.plSince) ? NaN : v.plSince + 1;
      v.phSince = i > 0 && s.phFound[i - 1] ? 0 : Number.isNaN(v.phSince) ? NaN : v.phSince + 1;
      const inRangePl = inRange(v.plSince);
      const inRangePh = inRange(v.phSince);

      // osc[lbR], low[lbR], high[lbR]
      const oscR = i >= lbR ? s.osc[i - lbR] : NaN;
      const lowR = i >= lbR ? bars[i - lbR].low : NaN;
      const highR = i >= lbR ? bars[i - lbR].high : NaN;
      // ta.valuewhen(plFound, osc[lbR], 1) ... : the values of the previous pivot
      const prevOscPl = s.vw[0].step(plFound, oscR);
      const prevLowPl = s.vw[1].step(plFound, lowR);
      const prevOscPh = s.vw[2].step(phFound, oscR);
      const prevHighPh = s.vw[3].step(phFound, highR);

      // Regular Bullish: oscHL = osc[lbR] > valuewhen(...) and inRangePl; priceLL = low[lbR] < valuewhen(...)
      const oscHL = compare.gt(oscR, prevOscPl) && inRangePl;
      const priceLL = compare.lt(lowR, prevLowPl);
      const bullCond = cfg.plotBull && priceLL && oscHL && plFound;
      // Hidden Bullish: oscLL = osc[lbR] < valuewhen(...) and inRangePl; priceHL = low[lbR] > valuewhen(...)
      const oscLL = compare.lt(oscR, prevOscPl) && inRangePl;
      const priceHL = compare.gt(lowR, prevLowPl);
      const hiddenBullCond = cfg.plotHiddenBull && priceHL && oscLL && plFound;
      // Regular Bearish: oscLH = osc[lbR] < valuewhen(...) and inRangePh; priceHH = high[lbR] > valuewhen(...)
      const oscLH = compare.lt(oscR, prevOscPh) && inRangePh;
      const priceHH = compare.gt(highR, prevHighPh);
      const bearCond = cfg.plotBear && priceHH && oscLH && phFound;
      // Hidden Bearish: oscHH = osc[lbR] > valuewhen(...) and inRangePh; priceLH = high[lbR] < valuewhen(...)
      const oscHH = compare.gt(oscR, prevOscPh) && inRangePh;
      const priceLH = compare.lt(highR, prevHighPh);
      const hiddenBearCond = cfg.plotHiddenBear && priceLH && oscHH && phFound;
      // bullCondAlert, hiddenBullCondAlert, bearCondAlert, hiddenBearCondAlert
      const at = b.time as number;
      const flags = [priceLL && oscHL && plFound, priceHL && oscLL && plFound, priceHH && oscLH && phFound, priceLH && oscHH && phFound];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(at);
      }

      // The label shapes' series (cond ? osc[lbR] : na) on the bar they are computed on.
      if (Number.isFinite(oscR)) {
        if (bullCond) s.labels[0].push({ time: at, value: oscR });
        if (hiddenBullCond) s.labels[1].push({ time: at, value: oscR });
        if (bearCond) s.labels[2].push({ time: at, value: oscR });
        if (hiddenBearCond) s.labels[3].push({ time: at, value: oscR });
      }

      // offset = -lbR: the value of bar i is drawn on bar i - lbR; bar i sets its own point to na first (bar i + lbR,
      // the only other writer of it, comes later)
      const p = s.plots;
      for (let k = 1; k <= 4; k++) p[k][i] = { time: b.time, value: NaN };
      const j = i - lbR;
      if (j < 0 || j >= bars.length) return;
      const time = bars[j].time;
      // plot(plFound ? osc[lbR] : na, color = bullCond ? bullColor : noneColor) ...
      const plValue = plFound ? oscR : NaN;
      const phValue = phFound ? oscR : NaN;
      p[1][j] = { time, value: plValue, color: bullCond ? BULL_COLOR : NONE_COLOR };
      p[2][j] = { time, value: plValue, color: hiddenBullCond ? HIDDEN_BULL_COLOR : NONE_COLOR };
      p[3][j] = { time, value: phValue, color: bearCond ? BEAR_COLOR : NONE_COLOR };
      p[4][j] = { time, value: phValue, color: hiddenBearCond ? HIDDEN_BEAR_COLOR : NONE_COLOR };

      // plotshape(cond ? osc[lbR] : na, style = shape.labelup / labeldown, location = location.absolute)
      if (!Number.isFinite(oscR)) return;
      if (bullCond) {
        s.markers.push({ time, position: 'atPriceBottom', price: oscR, shape: 'labelUp', color: BULL_COLOR, text: ' Bull ', textColor: TEXT_COLOR, id: 'bullLabel' });
      }
      if (hiddenBullCond) {
        s.markers.push({ time, position: 'atPriceBottom', price: oscR, shape: 'labelUp', color: BULL_COLOR, text: ' H Bull ', textColor: TEXT_COLOR, id: 'hiddenBullLabel' });
      }
      if (bearCond) {
        s.markers.push({ time, position: 'atPriceTop', price: oscR, shape: 'labelDown', color: BEAR_COLOR, text: ' Bear ', textColor: TEXT_COLOR, id: 'bearLabel' });
      }
      if (hiddenBearCond) {
        s.markers.push({ time, position: 'atPriceTop', price: oscR, shape: 'labelDown', color: BEAR_COLOR, text: ' H Bear ', textColor: TEXT_COLOR, id: 'hiddenBearLabel' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
        },
        markers: s.markers.slice(),
        outputValues: {
          bullLabel: s.labels[0].slice(), hiddenBullLabel: s.labels[1].slice(), bearLabel: s.labels[2].slice(),
          hiddenBearLabel: s.labels[3].slice(),
        },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiDivergenceIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiDivergenceIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** Reference alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar' },
  { id: 'alert1', title: 'Hidden Bullish Divergence', message: 'Found a new Hidden Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar' },
  { id: 'alert2', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar' },
  { id: 'alert3', title: 'Hidden Bearish Divergence', message: 'Found a new Hidden Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar' },
];

/** Reference outputs: the RSI, then each divergence line followed by its label. */
export const outputs: OutputDecl[] = [
  { kind: 'plot', id: 'plot0' },
  { kind: 'plot', id: 'plot1' },
  { kind: 'shape', id: 'bullLabel', title: 'Regular Bullish Label' },
  { kind: 'plot', id: 'plot2' },
  { kind: 'shape', id: 'hiddenBullLabel', title: 'Hidden Bullish Label' },
  { kind: 'plot', id: 'plot3' },
  { kind: 'shape', id: 'bearLabel', title: 'Regular Bearish Label' },
  { kind: 'plot', id: 'plot4' },
  { kind: 'shape', id: 'hiddenBearLabel', title: 'Hidden Bearish Label' },
];

export const RsiDivergenceIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, outputs, alertConditions };
