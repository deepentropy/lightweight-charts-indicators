/**
 * Nadaraya-Watson Regression Liquidity Sweeps
 *
 * A Nadaraya-Watson estimate of the close (Gaussian kernel weights exp(-i^2 / (2 * bandwidth^2)) over the last
 * `lookback` closes). Its slope divided by the standard deviation of the slope over `norm_len` bars, smoothed by a WMA,
 * is the oscillator; an EMA of it is the signal line. The oscillator is drawn as two fills (gradient fill between the
 * oscillator and the part beyond +-2, and a plain fill between the zero line and that part). On the price pane: a band
 * candle around the estimate (offset by the smoothed ATR), price candles coloured by the oscillator, momentum
 * weakening dots (signal crosses on the wrong side of zero), rebound triangles (the close crosses the estimate) and
 * liquidity levels: a line at the swing high (low) of the phase above (below) the signal when the oscillator crosses
 * under (over) its signal above (below) zero, extended until the close crosses it or a new level starts. At most 500
 * lines are kept.
 * `chart.fg_color` / `chart.bg_color` come from the chart context (fallbacks #DBDBDB / #0F0F0F).
 *
 * Reference: "Nadaraya-Watson Regression Liquidity Sweeps [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  ta, math, color, Series, line, resetDrawings, setDrawingBar, varDrawing,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type Line, type MarkerData, type PlotCandleData,
  type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { StudyDrawingKind } from '../style-outputs';
import { backgroundColorOf, foregroundColorOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface NadarayaWatsonRegressionLiquiditySweepsInputs {
  /** Normalization Length */
  norm_len: number;
  /** Nadaraya-Watson Bandwidth */
  nw_bandwidth: number;
  /** Nadaraya-Watson Lookback */
  nw_lookback: number;
  /** Oscillator Smoothing Length */
  osc_smooth_len: number;
  /** Signal Length */
  signal_len: number;
  /** ATR Length */
  atr_len: number;
  /** Volatility Smoothing Length */
  vol_smooth_len: number;
  /** Use Swing Points */
  use_tip: boolean;
  /** Show Nadaraya-Watson Band Candles */
  show_nw_band_candles: boolean;
  /** Show Bar Colour Candles */
  show_bar_color_candles: boolean;
  /** Show Oscillator Signal Line */
  show_signal_line: boolean;
  /** Show Momentum Weakening Signals */
  show_momentum_signals: boolean;
  /** Show Rebound Signals */
  show_rebound_signals: boolean;
  /** Bullish Colour */
  green: string;
  /** Bearish Colour */
  red: string;
}

export const defaultInputs: NadarayaWatsonRegressionLiquiditySweepsInputs = {
  norm_len: 100,
  nw_bandwidth: 30,
  nw_lookback: 140,
  osc_smooth_len: 21,
  signal_len: 14,
  atr_len: 14,
  vol_smooth_len: 21,
  use_tip: true,
  show_nw_band_candles: true,
  show_bar_color_candles: true,
  show_signal_line: true,
  show_momentum_signals: true,
  show_rebound_signals: true,
  green: '#00ffbb',
  red: '#ff1100',
};

const G_REG = 'Regression';
const G_OSC = 'Oscillator';
const G_VOL = 'Volatility';
const G_LVL = 'Liquidity Levels';
const G_APP = 'Appearance';

export const inputConfig: InputConfig[] = [
  { id: 'norm_len', type: 'int', title: 'Normalization Length', defval: 100, min: 1, group: G_OSC,
    tooltip: 'Controls the standard deviation window used to normalize the Nadaraya-Watson slope. Increasing it makes oscillator scaling more stable and slower to adapt; decreasing it makes scaling adapt faster but can make the oscillator more reactive and noisy.' },
  { id: 'nw_bandwidth', type: 'int', title: 'Nadaraya-Watson Bandwidth', defval: 30, min: 1, group: G_REG,
    tooltip: 'Controls the width of the Nadaraya-Watson kernel. Increasing it makes the regression smoother and slower to turn; decreasing it makes the regression track price more closely but can add noise.' },
  { id: 'nw_lookback', type: 'int', title: 'Nadaraya-Watson Lookback', defval: 140, min: 1, group: G_REG,
    tooltip: 'Controls how many historical bars are included in the Nadaraya-Watson estimate. Increasing it uses more history for a more stable curve; decreasing it focuses more on recent price action and reacts faster.' },
  { id: 'osc_smooth_len', type: 'int', title: 'Oscillator Smoothing Length', defval: 21, min: 1, group: G_OSC,
    tooltip: 'Controls the WMA smoothing applied to the normalized slope oscillator. Increasing it makes the oscillator smoother with fewer sharp turns; decreasing it makes the oscillator more responsive but choppier.' },
  { id: 'signal_len', type: 'int', title: 'Signal Length', defval: 14, min: 1, group: G_OSC,
    tooltip: 'Controls the EMA length of the oscillator signal line. Increasing it makes signal crosses slower and less frequent; decreasing it makes crosses happen earlier and more often.' },
  { id: 'atr_len', type: 'int', title: 'ATR Length', defval: 14, min: 1, group: G_VOL,
    tooltip: 'Controls the ATR window used for the price overlay volatility offset. Increasing it makes volatility measurement smoother; decreasing it makes the overlay react faster to recent range expansion or contraction.' },
  { id: 'vol_smooth_len', type: 'int', title: 'Volatility Smoothing Length', defval: 21, min: 1, group: G_VOL,
    tooltip: 'Controls the smoothing applied to ATR before it is used in the overlay. Increasing it creates a steadier volatility offset; decreasing it makes the offset expand and contract more quickly.' },
  { id: 'use_tip', type: 'bool', title: 'Use Swing Points', defval: true, group: G_LVL,
    tooltip: 'When enabled, liquidity levels are anchored to the highest high or lowest low reached during the active oscillator phase. When disabled, new levels are anchored to the current bar high or low when the signal event occurs.' },
  { id: 'show_nw_band_candles', type: 'bool', title: 'Show Nadaraya-Watson Band Candles', defval: true, group: G_APP,
    tooltip: 'When enabled, plots the Nadaraya-Watson volatility band as overlay candles. Disabling it hides the band candles without changing calculations, levels, signals, or alerts.' },
  { id: 'show_bar_color_candles', type: 'bool', title: 'Show Bar Colour Candles', defval: true, group: G_APP,
    tooltip: 'When enabled, redraws price candles with oscillator-based bullish or bearish colours using plotcandle. Disabling it leaves the chart\'s normal candles visually unchanged.' },
  { id: 'show_signal_line', type: 'bool', title: 'Show Oscillator Signal Line', defval: true, group: G_APP,
    tooltip: 'When enabled, displays the EMA signal line of the oscillator. Disabling it hides the signal line but keeps signal-cross logic active.' },
  { id: 'show_momentum_signals', type: 'bool', title: 'Show Momentum Weakening Signals', defval: true, group: G_APP,
    tooltip: 'When enabled, displays the small momentum weakening dots on the chart. Disabling it hides those visual markers without affecting alert conditions.' },
  { id: 'show_rebound_signals', type: 'bool', title: 'Show Rebound Signals', defval: true, group: G_APP,
    tooltip: 'When enabled, displays bullish and bearish rebound markers around the Nadaraya-Watson value. Disabling it hides those visual markers without affecting calculations.' },
  { id: 'green', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: G_APP,
    tooltip: 'Sets the bullish color used for positive oscillator fills, bullish price overlay coloring, lower liquidity levels, and bullish momentum events.' },
  { id: 'red', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: G_APP,
    tooltip: 'Sets the bearish color used for negative oscillator fills, bearish price overlay coloring, upper liquidity levels, and bearish momentum events.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: color.blue, lineWidth: 2, display: 'none' },
  { id: 'plot1', title: 'Signal Line', color: String(color.new('#DBDBDB', 50)), lineWidth: 1 },
  { id: 'plot2', title: 'Overflow', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Zero Line', color: '#DBDBDB', lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot2', title: 'Oscillator Fill' },
  { id: 'fill1', plot1: 'plot3', plot2: 'plot2', title: 'Oscillator Fill' },
];

/** plotchar() declarations: the markers of the result with the same `id` belong to them */
export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Weakening Bullish Momentum', char: '●', location: 'abovebar', color: '#00ffbb', size: 'tiny' },
  { id: 'char1', kind: 'char', title: 'Weakening Bearish Momentum', char: '●', location: 'belowbar', color: '#ff1100', size: 'tiny' },
  { id: 'char2', kind: 'char', title: 'Bullish Rebound', char: '▲', location: 'absolute', color: '#00ffbb', size: 'tiny' },
  { id: 'char3', kind: 'char', title: 'Bearish Rebound', char: '▼', location: 'absolute', color: '#ff1100', size: 'tiny' },
];

/** plotcandle() declarations: the result's plotCandles keys */
export const plotCandleConfig = [
  { id: 'candle0', title: 'Nadaraya-Watson Band' },
  { id: 'candle1', title: 'Price' },
];

export const drawingKinds: StudyDrawingKind[] = ['line'];

/** The original's alertconditions (no message: the default text) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Weakening Bullish Momentum', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Weakening Bearish Momentum', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Bullish Signal Cross', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Bearish Signal Cross', message: 'Alert Fired!' },
  { id: 'alert4', title: 'Bullish Zero Cross', message: 'Alert Fired!' },
  { id: 'alert5', title: 'Bearish Zero Cross', message: 'Alert Fired!' },
  { id: 'alert6', title: 'New Upper Liquidity Sweep Level', message: 'Alert Fired!' },
  { id: 'alert7', title: 'New Lower Liquidity Sweep Level', message: 'Alert Fired!' },
  { id: 'alert8', title: 'Upper Liquidity Sweep Level Swept', message: 'Alert Fired!' },
  { id: 'alert9', title: 'Lower Liquidity Sweep Level Swept', message: 'Alert Fired!' },
];

export const metadata = {
  title: 'Nadaraya-Watson Regression Liquidity Sweeps [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Nadaraya-Watson Regression Liquidity',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<NadarayaWatsonRegressionLiquiditySweepsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]>; lines: LineDrawingData[];
  alerts: AlertConditionState[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (values: number[]) => Series.fromArray(bars, values);
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const { green, red } = cfg;

  // nw(close, nw_bandwidth, nw_lookback): sum of src[i] * w over i = 0 .. lookback - 1 (na while src[i] is na)
  const h2 = 2.0 * math.pow(cfg.nw_bandwidth, 2);
  const weights: number[] = [];
  for (let i = 0; i <= cfg.nw_lookback - 1; i++) weights.push(math.exp(-math.pow(i, 2) / h2));
  const nwVal = bars.map((_b, k) => {
    let num = 0.0;
    let den = 0.0;
    for (let i = 0; i < weights.length; i++) {
      num += (k - i >= 0 ? bars[k - i].close : NaN) * weights[i];
      den += weights[i];
    }
    return num / den;
  });
  const nwSlope = nwVal.map((v, i) => (i > 0 ? v - nwVal[i - 1] : NaN));
  const slopeStd = A(ta.stdev(S(nwSlope), cfg.norm_len));
  const oscRaw = nwSlope.map((v, i) => v / slopeStd[i]);
  const oscSeries = ta.wma(S(oscRaw), cfg.osc_smooth_len);
  const osc = A(oscSeries);
  const signalSeries = ta.ema(oscSeries, cfg.signal_len);
  const signal = A(signalSeries);
  const volatility = A(ta.sma(ta.atr(bars, cfg.atr_len), cfg.vol_smooth_len));

  const con1 = ta.crossunder(oscSeries, signalSeries).toArray();
  const con2 = ta.crossover(oscSeries, signalSeries).toArray();
  const zeroUp = ta.crossover(oscSeries, 0).toArray();
  const zeroDown = ta.crossunder(oscSeries, 0).toArray();

  const pseudoTransp = (c: string, transp: number) => color.from_gradient(transp, 0, 100, c, bg);
  const greenLight = pseudoTransp(green, 80);
  const greenStrong = pseudoTransp(green, 30);
  const redStrong = pseudoTransp(red, 30);
  const redLight = pseudoTransp(red, 80);

  let aboveTipPrice = NaN;
  let aboveTipBar = NaN;
  let belowTipPrice = NaN;
  let belowTipBar = NaN;
  let prevAbove = false;
  let prevBelow = false;
  const activeLine = varDrawing<Line>();
  let activeLinePrice = NaN;
  let activeLineType = 0;

  const flags: boolean[][] = Array.from({ length: 10 }, () => new Array(n).fill(false));
  const ovf: number[] = new Array(n).fill(0);
  const markers: MarkerData[] = [];
  const band: PlotCandleData[] = [];
  const price: PlotCandleData[] = [];
  const fillA: string[] = [];
  const fillB: string[] = [];

  resetDrawings({ line: 500 });
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const o = osc[i];
    const c1 = con1[i] === 1;
    const c2 = con2[i] === 1;
    const aboveSignal = gt(o, signal[i]);
    const belowSignal = gt(signal[i], o);

    if (aboveSignal) {
      if (!prevAbove) {
        aboveTipPrice = b.high;
        aboveTipBar = i;
      } else if (Number.isNaN(aboveTipPrice) || gt(b.high, aboveTipPrice)) {
        aboveTipPrice = b.high;
        aboveTipBar = i;
      }
    }
    if (belowSignal) {
      if (!prevBelow) {
        belowTipPrice = b.low;
        belowTipBar = i;
      } else if (Number.isNaN(belowTipPrice) || gt(belowTipPrice, b.low)) {
        belowTipPrice = b.low;
        belowTipBar = i;
      }
    }
    prevAbove = aboveSignal;
    prevBelow = belowSignal;

    const drawUpper = gt(o, 0) && c1;
    const drawLower = gt(0, o) && c2;
    const drawNew = drawUpper || drawLower;
    const hasLine = activeLine.value !== undefined && activeLine.value !== null;
    const upperSwept = hasLine && activeLineType === 1 && gt(b.close, activeLinePrice);
    const lowerSwept = hasLine && activeLineType === -1 && gt(activeLinePrice, b.close);

    if (hasLine && activeLineType !== 0) {
      line.set_x2(activeLine.value as Line, i);
      const crossed = activeLineType === 1 ? gt(b.close, activeLinePrice) : gt(activeLinePrice, b.close);
      if (crossed || drawNew) activeLineType = 0;
    }
    if (drawUpper) {
      const levelPrice = cfg.use_tip && !Number.isNaN(aboveTipPrice) ? aboveTipPrice : b.high;
      const levelBar = cfg.use_tip && !Number.isNaN(aboveTipBar) ? aboveTipBar : i;
      activeLine.value = line.new(levelBar, levelPrice, i, levelPrice, 'bar_index', 'none', red, 'solid', 2, true);
      activeLinePrice = levelPrice;
      activeLineType = 1;
    }
    if (drawLower) {
      const levelPrice = cfg.use_tip && !Number.isNaN(belowTipPrice) ? belowTipPrice : b.low;
      const levelBar = cfg.use_tip && !Number.isNaN(belowTipBar) ? belowTipBar : i;
      activeLine.value = line.new(levelBar, levelPrice, i, levelPrice, 'bar_index', 'none', green, 'solid', 2, true);
      activeLinePrice = levelPrice;
      activeLineType = -1;
    }

    const nw = nwVal[i];
    const vol = volatility[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const bullRebound = gt(o, 0) && gt(nw, prevClose) && gt(b.close, nw);
    const bearRebound = gt(0, o) && gt(prevClose, nw) && gt(nw, b.close);

    flags[0][i] = drawUpper;
    flags[1][i] = drawLower;
    flags[2][i] = c2;
    flags[3][i] = c1;
    flags[4][i] = zeroUp[i] === 1;
    flags[5][i] = zeroDown[i] === 1;
    flags[6][i] = drawUpper;
    flags[7][i] = drawLower;
    flags[8][i] = upperSwept;
    flags[9][i] = lowerSwept;

    // ovf = osc > 2 ? overflow : osc < -2 ? -overflow : 0, overflow = max(|osc| - 2, 0)
    const overflow = Number.isNaN(o) ? NaN : Math.max(Math.abs(o) - 2, 0);
    ovf[i] = gt(o, 2) ? overflow : gt(-2, o) ? -overflow : 0;

    const col = gt(o, 0)
      ? color.from_gradient(o, 0, 3, greenLight, greenStrong)
      : color.from_gradient(o, -3, 0, redStrong, redLight);
    const colStr = col ? String(col) : 'transparent';
    fillA.push(colStr);
    fillB.push(gt(o, 0) ? green : red);

    // plotcandle "Nadaraya-Watson Band": bordercolor na, wickcolor color.new(col_, 70)
    if (cfg.show_nw_band_candles) {
      band.push({
        time: b.time, open: nw + (gt(o, 0) ? -vol : vol), high: gt(0, o) ? b.high : nw, low: gt(o, 0) ? b.low : nw,
        close: nw, color: colStr, borderColor: 'transparent',
        wickColor: col ? String(color.new(col, 70)) : 'transparent', forceOverlay: true,
      });
    } else {
      band.push({ time: b.time, open: NaN, high: NaN, low: NaN, close: NaN, forceOverlay: true });
    }
    if (cfg.show_bar_color_candles) {
      price.push({
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: colStr, wickColor: colStr, borderColor: colStr, forceOverlay: true,
      });
    } else {
      price.push({ time: b.time, open: NaN, high: NaN, low: NaN, close: NaN, forceOverlay: true });
    }

    if (cfg.show_momentum_signals && drawUpper) {
      markers.push({ id: 'char0', time: b.time, position: 'aboveBar', shape: 'circle', char: '●', color: green, size: 'tiny', forceOverlay: true });
    }
    if (cfg.show_momentum_signals && drawLower) {
      markers.push({ id: 'char1', time: b.time, position: 'belowBar', shape: 'circle', char: '●', color: red, size: 'tiny', forceOverlay: true });
    }
    const bullPrice = cfg.show_rebound_signals && bullRebound ? nw - vol * 1.5 : NaN;
    if (!Number.isNaN(bullPrice)) {
      markers.push({ id: 'char2', time: b.time, position: 'atPriceMiddle', price: bullPrice, shape: 'circle', char: '▲', color: green, size: 'tiny', forceOverlay: true });
    }
    const bearPrice = cfg.show_rebound_signals && bearRebound ? nw + vol * 1.5 : NaN;
    if (!Number.isNaN(bearPrice)) {
      markers.push({ id: 'char3', time: b.time, position: 'atPriceMiddle', price: bearPrice, shape: 'circle', char: '▼', color: red, size: 'tiny', forceOverlay: true });
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const lines: LineDrawingData[] = line.all().map((l) => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: 2, forceOverlay: true,
  }));

  const signalColor = cfg.show_signal_line ? String(color.new(fg, 50)) : 'transparent';
  const pts = (values: number[], col?: string) => values.map((value, i) => ({
    time: bars[i].time, value: Number.isFinite(value) ? value : NaN, ...(col ? { color: col } : {}),
  }));
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot0', plot2: 'plot2', options: { title: 'Oscillator Fill' }, colors: fillA },
    { id: 'fill1', plot1: 'plot3', plot2: 'plot2', options: { title: 'Oscillator Fill' }, colors: fillB },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: pts(osc, color.blue),
      plot1: pts(signal, signalColor),
      plot2: pts(ovf),
      plot3: pts(new Array(n).fill(0), fg),
    },
    fills,
    plotCandles: { candle0: band, candle1: price },
    markers,
    lines,
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const NadarayaWatsonRegressionLiquiditySweeps = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, plotCandleConfig, drawingKinds,
  alertConditions,
};
