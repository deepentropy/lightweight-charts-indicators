/**
 * Bollinger Bands (Nadaraya Smoothed) | Flux Charts
 *
 * Bollinger bands of the typical price (hlc3), smoothed with a Gaussian kernel (Nadaraya-Watson weights).
 * - Four bands: sma(tp, 20) +- 'Deviation' (short) * stdev(tp, 20), sma(tp, 75) +- the same short deviation,
 *   sma(tp, 100) +- the medium deviation and sma(tp, 100) +- the long deviation. The band periods are fixed at 20,
 *   75 and 100 in the original: the three 'Period' inputs are not read.
 * - Each band is smoothed over its last 500 values: sum of band[i] * w(i) / sum(w) for i = 499 down to 0, with
 *   w(i) = exp(-i^2 / (2 h^2)) (h = 'Smoothing Factor'). The smoothed bands are na until 500 band values exist.
 * - Shown: the smoothed first upper band (bearish colour) and lower band (bullish colour), fills between the first
 *   and second bands (level 1) and between the second and third bands (level 2). The eight smoothed bands are hidden
 *   plots (anchors of the fills).
 * - Markers: a triangle above when the label source reaches the smoothed first upper band while its value one bar
 *   back was at or below it, a triangle below for the lower band (the lower test reads the upper source one bar back
 *   for its na test, as the original). The marker price is the source +- 1.01 * atr(300). With 'Pivots' the source
 *   is a pivot high / low of 4 bars on each side and the markers are drawn 4 bars back.
 * - 'Repaint Smoothing': on the last bar only, the first upper and lower bands are smoothed again with the kernel
 *   centred on each of the last 500 bars and drawn as line segments (one per two bars); the smoothed plots are then
 *   0 (hidden), the shown plots and the markers na.
 * - 'Band Breaks': alert() on each bar close above the smoothed upper band ("Upper Band Crossed on <ticker>") or
 *   below the smoothed lower band ("Lower Band Crossed on <ticker>"), once per bar close (`alertCalls`).
 *
 * The 'Line Width' input is not applied to the plot width (static width 2, its default).
 *
 * Reference: "Bollinger Bands (Nadaraya Smoothed) | Flux Charts" by fluxchart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fluxchart
 */

import {
  ta, color, Series, line, resetDrawings, setDrawingBar,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type MarkerData,
  type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { AlertCall, LineDrawingData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { tickerOf, type ChartContext } from '../chart-context';

export interface BollingerBandsFluxChartsInputs {
  /** Smoothing Factor: bandwidth h of the Gaussian kernel */
  h: number;
  /** Repaint Smoothing */
  repaint: boolean;
  /** Period (short): not read by the original */
  shortPeriod: number;
  /** Deviation (short): first and second bands */
  shortStdev: number;
  /** Period (medium): not read by the original */
  medPeriod: number;
  /** Deviation (medium): third band */
  medStdev: number;
  /** Period (long): not read by the original */
  longPeriod: number;
  /** Deviation (long): fourth band */
  longStdev: number;
  /** Label Source */
  labelSrc: 'Pivots' | 'Close' | 'High/Low';
  /** Labels */
  labels: boolean;
  /** Plot Lines */
  plots: boolean;
  /** Line Width (not applied: static width 2) */
  plotThickness: number;
  /** Level 1 Bands */
  bandsLvl1: boolean;
  /** Level 2 Bands */
  bandsLvl2: boolean;
  /** Bearish */
  palleteBear: string;
  /** Bullish */
  palleteBull: string;
  /** Transparency: Level 1 */
  alpha1: number;
  /** Level 2 */
  alpha2: number;
  /** Band Breaks (alert() calls) */
  notifs: boolean;
}

export const defaultInputs: BollingerBandsFluxChartsInputs = {
  h: 6,
  repaint: false,
  shortPeriod: 20,
  shortStdev: 3,
  medPeriod: 75,
  medStdev: 4,
  longPeriod: 100,
  longStdev: 4.25,
  labelSrc: 'Close',
  labels: true,
  plots: true,
  plotThickness: 2,
  bandsLvl1: true,
  bandsLvl2: true,
  palleteBear: '#FF5252',
  palleteBull: '#4CAF50',
  alpha1: 0.9,
  alpha2: 0.85,
  notifs: false,
};

const G_SMOOTH = 'smoothing';
const G_BOLL = 'Bollinger Bands Settings (Short, Medium, Long)';
const G_GRAPH = 'Plots and Labels';

export const inputConfig: InputConfig[] = [
  { id: 'h', type: 'float', title: 'Smoothing Factor', defval: 6, step: 0.5, group: G_SMOOTH,
    tooltip: 'The bandwith(h) used in the kernel of the Nadaraya-Watson estimator function.' },
  { id: 'repaint', type: 'bool', title: 'Repaint Smoothing', defval: false, group: G_SMOOTH,
    tooltip: 'This setting allows for repainting of the estimation' },
  { id: 'shortPeriod', type: 'int', title: 'Period', defval: 20, inline: 'short', group: G_BOLL },
  { id: 'shortStdev', type: 'float', title: 'Deviation', defval: 3, inline: 'short', group: G_BOLL },
  { id: 'medPeriod', type: 'int', title: 'Period', defval: 75, inline: 'med', group: G_BOLL },
  { id: 'medStdev', type: 'float', title: 'Deviation', defval: 4, inline: 'med', group: G_BOLL },
  { id: 'longPeriod', type: 'int', title: ' Period', defval: 100, inline: 'long', group: G_BOLL },
  { id: 'longStdev', type: 'float', title: 'Deviation', defval: 4.25, inline: 'long', group: G_BOLL },
  { id: 'labelSrc', type: 'string', title: 'Label Source', defval: 'Close', options: ['Pivots', 'Close', 'High/Low'],
    group: G_GRAPH,
    tooltip: 'The source used to determine if price is outside of the Bollinger Bands. The Pivots setting has a four bar delay.' },
  { id: 'labels', type: 'bool', title: 'Labels', defval: true, inline: 'label', group: G_GRAPH },
  { id: 'plots', type: 'bool', title: 'Plot Lines', defval: true, group: G_GRAPH },
  { id: 'plotThickness', type: 'int', title: 'Line Width', defval: 2, group: G_GRAPH },
  { id: 'bandsLvl1', type: 'bool', title: 'Level 1 Bands', defval: true, inline: 'bands', group: G_GRAPH },
  { id: 'bandsLvl2', type: 'bool', title: 'Level 2 Bands', defval: true, inline: 'bands', group: G_GRAPH },
  { id: 'palleteBear', type: 'color', title: 'Bearish', defval: '#FF5252', inline: 'theme', group: 'Color Theme' },
  { id: 'palleteBull', type: 'color', title: 'Bullish', defval: '#4CAF50', inline: 'theme', group: 'Color Theme' },
  { id: 'alpha1', type: 'float', title: 'Transparency: Level 1 ', defval: 0.9, min: 0.1, max: 1, step: 0.1, inline: 'alpha' },
  { id: 'alpha2', type: 'float', title: 'Level 2', defval: 0.85, min: 0.1, max: 1, step: 0.1, inline: 'alpha' },
  { id: 'notifs', type: 'bool', title: 'Band Breaks', defval: false, group: 'Notifications',
    tooltip: 'Recieve notifications when price goes above or below the first level.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed Upper Band 1', color: '#FF5252', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Smoothed Lower Band 1', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Smoothed Upper Band 2', color: '#FF5252', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Smoothed Lower Band 2', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Smoothed Upper Band 3', color: '#FF5252', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Smoothed Lower Band 3', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Smoothed Upper Band 4', color: '#FF5252', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Smoothed Lower Band 4', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Upper Band', color: '#FF5252', lineWidth: 2 },
  { id: 'plot9', title: 'Lower Band', color: '#4CAF50', lineWidth: 2 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot2', title: 'Upper Level 1', color: 'rgba(255, 82, 82, 0.1)', visible: 'bandsLvl1' },
  { id: 'fill1', plot1: 'plot1', plot2: 'plot3', title: 'Lower Level 1', color: 'rgba(76, 175, 80, 0.1)', visible: 'bandsLvl1' },
  { id: 'fill2', plot1: 'plot2', plot2: 'plot4', title: 'Upper Level 2', color: 'rgba(255, 82, 82, 0.15)', visible: 'bandsLvl2' },
  { id: 'fill3', plot1: 'plot3', plot2: 'plot5', title: 'Lower Level 2', color: 'rgba(76, 175, 80, 0.15)', visible: 'bandsLvl2' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Upper Band Test', style: 'triangledown', location: 'absolute', color: '#FF5252', size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Lower Band Test', style: 'triangleup', location: 'absolute', color: '#4CAF50', size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['line'];

/** The script calls alert() ('Band Breaks') */
export const hasAlertFunction = true;

export const metadata = {
  title: 'Bollinger Bands (Nadaraya Smoothed) | Flux Charts',
  shortTitle: 'Bollinger Bands (Nadaraya Smoothed) | Flux Charts',
  overlay: true,
};

/** indicator(max_lines_count = 500) */
const MAX_LINES = 500;
/** n = 499: the kernel covers the last 500 values */
const N = 499;
/** sens: pivot radius and the marker offset of the 'Pivots' source */
const SENS = 4;

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** guass_w(x, h) */
const gauss = (x: number, h: number) => Math.exp(-1 * ((x * x) / (2 * (h * h))));

export function calculate(
  bars: Bar[],
  inputs: Partial<BollingerBandsFluxChartsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { h, repaint } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // create_pallete(bear, bull, alpha1, alpha2)
  const bear = cfg.palleteBear;
  const bull = cfg.palleteBull;
  const shade1Bear = String(color.new(bear, 100 * cfg.alpha1));
  const shade1Bull = String(color.new(bull, 100 * cfg.alpha1));
  const shade2Bear = String(color.new(bear, 100 * cfg.alpha2));
  const shade2Bull = String(color.new(bull, 100 * cfg.alpha2));

  // tp = (high + low + close) / 3; bollingers(n, factor)
  const tpArr = bars.map((b) => (b.high + b.low + b.close) / 3);
  const tp = Series.fromArray(bars, tpArr);
  const bollingers = (len: number, factor: number): [number[], number[]] => {
    const basis = A(ta.sma(tp, len));
    const dev = A(ta.stdev(tp, len));
    return [basis.map((m, i) => m + factor * dev[i]), basis.map((m, i) => m - factor * dev[i])];
  };
  const [boluFirst, boldFirst] = bollingers(20, cfg.shortStdev);
  const [boluSecond, boldSecond] = bollingers(75, cfg.shortStdev);
  const [boluThird, boldThird] = bollingers(100, cfg.medStdev);
  const [boluFourth, boldFourth] = bollingers(100, cfg.longStdev);

  // running_nadaraya(src, n): the weights are made on the first bar
  const gk: number[] = [];
  for (let i = 0; i <= N; i++) gk.push(gauss(i, h));
  let gkSum = 0;
  for (const w of gk) gkSum += w;
  const running = (src: number[]): number[] =>
    src.map((_, bar) => {
      if (repaint) return 0;
      let smoothed = 0;
      for (let i = N; i >= 0; i--) {
        const v = bar - i >= 0 ? src[bar - i] : NaN;
        smoothed += v * (gk[i] / gkSum);
      }
      return smoothed;
    });
  const smU1 = running(boluFirst);
  const smD1 = running(boldFirst);
  const smU2 = running(boluSecond);
  const smD2 = running(boldSecond);
  const smU3 = running(boluThird);
  const smD3 = running(boldThird);
  const smU4 = running(boluFourth);
  const smD4 = running(boldFourth);

  // nadaraya(src, color): on the last bar when 'Repaint Smoothing' is on
  resetDrawings({ line: MAX_LINES });
  if (repaint && n > 0) {
    const last = n - 1;
    setDrawingBar(last, true);
    const nadaraya = (src: number[], col: string) => {
      const smoothed: number[] = [];
      for (let i = 0; i <= 499; i++) {
        let sum = 0;
        const w: number[] = [];
        for (let y = 0; y <= 499; y++) w.push(gauss(y - i, h));
        let wSum = 0;
        for (const x of w) wSum += x;
        for (let y = 0; y <= 499; y++) sum += (last - y >= 0 ? src[last - y] : NaN) * (w[y] / wSum);
        smoothed.push(sum);
        if (i % 2 === 0 && i !== 0) {
          // bar_index[k] is na before the first bar
          const x1 = last - (i - 1) >= 0 ? last - (i - 1) : NaN;
          const x2 = last - i >= 0 ? last - i : NaN;
          line.new(x1, smoothed[i - 1], x2, smoothed[i], 'bar_index', undefined, col, undefined, 2);
        }
      }
    };
    nadaraya(boluFirst, bear);
    nadaraya(boldFirst, bull);
    setDrawingBar(null);
  }

  // spacing = ta.atr(300); label sources and the history offset
  const spacing = A(ta.atr(bars, 300));
  const pivotHigh = A(ta.pivothigh(new Series(bars, (b) => b.high), SENS, SENS));
  const pivotLow = A(ta.pivotlow(new Series(bars, (b) => b.low), SENS, SENS));
  const pivots = cfg.labelSrc === 'Pivots';
  const upperSrc = pivots ? pivotHigh : cfg.labelSrc === 'Close' ? bars.map((b) => b.close) : bars.map((b) => b.high);
  const lowerSrc = pivots ? pivotLow : cfg.labelSrc === 'Close' ? bars.map((b) => b.close) : bars.map((b) => b.low);
  const offset = pivots ? SENS : 0;

  const markers: MarkerData[] = [];
  const alertCalls: AlertCall[] = [];
  const ticker = tickerOf(chart);
  for (let i = 0; i < n; i++) {
    const refU = i - offset >= 0 ? smU1[i - offset] : NaN;
    const refD = i - offset >= 0 ? smD1[i - offset] : NaN;
    const prevU = i > 0 ? upperSrc[i - 1] : NaN;
    const prevD = i > 0 ? lowerSrc[i - 1] : NaN;
    const up = upperSrc[i];
    const dn = lowerSrc[i];
    const upperTest = ge(up, refU) && (le(prevU, refU) || isNaN(prevU)) && !repaint ? up + spacing[i] * 1.01 : NaN;
    // the lower test reads na(band_test_upper_source[1]), as the original
    const lowerTest = le(dn, refD) && (ge(prevD, refD) || isNaN(prevU)) && !repaint ? dn - spacing[i] * 1.01 : NaN;
    const at = i - offset;
    if (cfg.labels && at >= 0) {
      if (!isNaN(upperTest)) {
        markers.push({ id: 'shape0', time: bars[at].time, position: 'atPriceMiddle', price: upperTest,
          shape: 'triangleDown', color: bear, size: 'tiny' });
      }
      if (!isNaN(lowerTest)) {
        markers.push({ id: 'shape1', time: bars[at].time, position: 'atPriceMiddle', price: lowerTest,
          shape: 'triangleUp', color: bull, size: 'tiny' });
      }
    }
    if (cfg.notifs) {
      const c = bars[i].close;
      if (gt(c, smU1[i])) {
        alertCalls.push({ time: bars[i].time as number, message: 'Upper Band Crossed on ' + ticker, freq: 'once_per_bar_close' });
      } else if (lt(c, smD1[i])) {
        alertCalls.push({ time: bars[i].time as number, message: 'Lower Band Crossed on ' + ticker, freq: 'once_per_bar_close' });
      }
    }
  }

  const pts = (values: number[], col?: string) =>
    values.map((v, i) => ({ time: bars[i].time, value: Number.isFinite(v) ? v : NaN, ...(col ? { color: col } : {}) }));
  const shown = !repaint && cfg.plots;
  const plots = {
    plot0: pts(smU1), plot1: pts(smD1), plot2: pts(smU2), plot3: pts(smD2),
    plot4: pts(smU3), plot5: pts(smD3), plot6: pts(smU4), plot7: pts(smD4),
    plot8: pts(shown ? smU1 : smU1.map(() => NaN), bear),
    plot9: pts(shown ? smD1 : smD1.map(() => NaN), bull),
  };

  const fill = (id: string, plot1: string, plot2: string, title: string, col: string): FillData =>
    ({ id, plot1, plot2, options: { title, color: col }, colors: bars.map(() => col) });
  const fills: FillData[] = [];
  if (cfg.bandsLvl1) {
    fills.push(fill('fill0', 'plot0', 'plot2', 'Upper Level 1', shade1Bear));
    fills.push(fill('fill1', 'plot1', 'plot3', 'Lower Level 1', shade1Bull));
  }
  if (cfg.bandsLvl2) {
    fills.push(fill('fill2', 'plot2', 'plot4', 'Upper Level 2', shade2Bear));
    fills.push(fill('fill3', 'plot3', 'plot5', 'Lower Level 2', shade2Bull));
  }

  // lines with an na coordinate are not drawn
  const t = (x: number) => bars[x].time as number;
  const lines: LineDrawingData[] = line.all()
    .filter((l) => !isNaN(l.x1) && !isNaN(l.x2) && !isNaN(l.y1) && !isNaN(l.y2))
    .map((l) => ({ time1: t(l.x1), price1: l.y1, time2: t(l.x2), price2: l.y2, color: String(l.color), width: 2 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    lines,
    alertCalls,
  };
}

export const BollingerBandsFluxCharts = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  drawingKinds,
  hasAlertFunction,
};
