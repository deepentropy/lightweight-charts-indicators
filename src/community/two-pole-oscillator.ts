/**
 * Two-Pole Oscillator [BigBeluga]
 *
 * The close minus its 25-bar SMA is normalised as a z-score (minus its own 25-bar SMA, divided by its 25-bar
 * standard deviation), then smoothed twice by an exponential filter of "Filter Length" (a two-pole filter that starts
 * on the first value). The oscillator is coloured by its direction against its value 4 bars back, with a gradient fill
 * between the two.
 *
 * Signals: a buy is a cross of the oscillator above its value 4 bars back below 0, a sell a cross below it above 0
 * (on closed bars). Each signal draws two circles on the oscillator and, on the price pane, a label at the low minus
 * the 100-bar average range (buy) or the high plus it (sell), a label with that price and, with "Levels" on, a dashed
 * level line that runs until the next signal or until a low (high) crosses it, which draws a cross mark there.
 * At most 500 lines and 500 labels are kept. Levels at +-1 and +-0.5 and a zero line drawn every other bar, with
 * gradient fills from the zero line, in the chart foreground colour.
 *
 * Reference: "Two-Pole Oscillator [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, color, str, line, label, callsite, Series, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type FillConfig, type IndicatorResult, type InputConfig, type Line, type PlotConfig, type ShapeConfig,
  type MarkerData,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { foregroundColorOf, lastBarConfirmedOf } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface TwoPoleOscillatorInputs {
  /** Length of the two-pole filter */
  length: number;
  /** Draw the level lines of the signals */
  disp_lvl: boolean;
  up_color: string;
  dn_color: string;
}

export const defaultInputs: TwoPoleOscillatorInputs = {
  length: 15,
  disp_lvl: true,
  up_color: '#55ffda',
  dn_color: '#8c5bff',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Filter Length', defval: 15, min: 1 },
  { id: 'disp_lvl', type: 'bool', title: 'Levels', defval: true },
  { id: 'up_color', type: 'color', title: '', defval: '#55ffda', inline: 'color' },
  { id: 'dn_color', type: 'color', title: '', defval: '#8c5bff', inline: 'color' },
];

const FG = foregroundColorOf();

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Level 1', color: String(color.new(FG, 80)), lineWidth: 1 },
  { id: 'plot1', title: 'Level 0.5', color: String(color.new(FG, 50)), lineWidth: 1 },
  { id: 'plot2', title: 'Zero', color: FG, lineWidth: 1 },
  { id: 'plot3', title: 'Level -0.5', color: String(color.new(FG, 50)), lineWidth: 1 },
  { id: 'plot4', title: 'Level -1', color: String(color.new(FG, 80)), lineWidth: 1 },
  { id: 'plot5', title: 'Two-Pole', color: '#55ffda', lineWidth: 1 },
  { id: 'plot6', title: 'Two-Pole [4]', color: '#2962ff', lineWidth: 1, display: 'none' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot2', title: 'Plots Background', topColor: String(color.new(FG, 80)) },
  { id: 'fill1', plot1: 'plot4', plot2: 'plot2', title: 'Plots Background', bottomColor: String(color.new(FG, 80)) },
  { id: 'fill2', plot1: 'plot5', plot2: 'plot6', title: 'Plots Background' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Buy', style: 'circle', location: 'absolute', color: '#2962ff', size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Buy', style: 'circle', location: 'absolute', color: '#2962ff', size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Sell', style: 'circle', location: 'absolute', color: '#2962ff', size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'Sell', style: 'circle', location: 'absolute', color: '#2962ff', size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Two-Pole Oscillator [BigBeluga]',
  shortTitle: 'Two-Pole Oscillator [BigBeluga]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

type Pt = { time: number; value: number; color?: string };

/** Pine `na` as a colour argument */
const NA_COLOR = null as unknown as string;

export function calculate(
  bars: Bar[],
  inputs: Partial<TwoPoleOscillatorInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const fg = foregroundColorOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const up = cfg.up_color;
  const dn = cfg.dn_color;

  const close = new Series(bars, (b) => b.close);
  const sma1 = ta.sma(close, 25).toArray().map((v) => v ?? NaN);
  const dev = Series.fromArray(bars, bars.map((b, i) => b.close - sma1[i]));
  const devSma = ta.sma(dev, 25).toArray().map((v) => v ?? NaN);
  const devStd = ta.stdev(dev, 25).toArray().map((v) => v ?? NaN);
  const area = ta.sma(new Series(bars, (b) => b.high - b.low), 100).toArray().map((v) => v ?? NaN);

  resetDrawings({ line: 500, label: 500 });
  const buyLine = varDrawing<Line>();
  const sellLine = varDrawing<Line>();
  const crossSignalUp = callsite.crossover();
  const crossSignalDn = callsite.crossunder();
  const crossBuyLevel = callsite.crossunder();
  const crossSellLevel = callsite.crossover();
  const y1Of = (l: Line | undefined) => (l ? line.get_y1(l) : NaN);

  const alpha = 2.0 / (cfg.length + 1);
  let smooth1 = NaN;
  let smooth2 = NaN;
  const twoP: number[] = [];

  const up50 = color.new(up, 50);
  const dn50 = color.new(dn, 50);
  const fg80 = String(color.new(fg, 80));
  const fg50 = String(color.new(fg, 50));
  const fg30 = color.new(fg, 30);
  const clear = color.new(color.black, 100);

  const p: Pt[][] = [[], [], [], [], [], [], []];
  const markers: MarkerData[] = [];
  const topValue: number[] = [];
  const bottomValue: number[] = [];
  const topColor: Array<string | null> = [];
  const bottomColor: Array<string | null> = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const confirmed = i < n - 1 || lastConfirmed;

    // f_two_pole_filter(sma_n1, length)
    const source = ((b.close - sma1[i]) - devSma[i]) / devStd[i];
    // na() is also true for an infinite value
    smooth1 = !Number.isFinite(smooth1) ? source : (1 - alpha) * smooth1 + alpha * source;
    smooth2 = !Number.isFinite(smooth2) ? smooth1 : (1 - alpha) * smooth2 + alpha * smooth1;
    const tp = Number.isFinite(smooth2) ? smooth2 : NaN;
    twoP.push(smooth2);
    const tpp = i >= 4 ? twoP[i - 4] : NaN;

    // an na colour of color.from_gradient is passed as null (oakScriptJS #191)
    const buyCol1 = color.from_gradient(smooth2, -1, 0.5, up, NA_COLOR);
    const buyCol2 = color.from_gradient(smooth2, -1, 0.5, up50, NA_COLOR);
    const sellCol1 = color.from_gradient(smooth2, -0.5, 1, NA_COLOR, dn);
    const sellCol2 = color.from_gradient(smooth2, -0.5, 1, NA_COLOR, dn50);
    const col = gt(smooth2, tpp)
      ? color.from_gradient(smooth2, -1, 1, up, color.new(up, 0))
      : color.from_gradient(smooth2, -1, 1, color.new(dn, 0), dn);

    const buy = crossSignalUp(smooth2, tpp) && lt(smooth2, 0) && confirmed;
    const sell = crossSignalDn(smooth2, tpp) && gt(smooth2, 0) && confirmed;

    if (buy) {
      sellLine.value = undefined;
      const y = b.low - area[i];
      if (cfg.disp_lvl) {
        buyLine.value = line.new(i, y, i, y, 'bar_index', 'none', buyCol1, 'dashed', 1, true);
      }
      label.new(i, y, '', 'bar_index', 'price', buyCol1, 'label_up', undefined, 'tiny', undefined, undefined,
        undefined, true);
      label.new(i, b.low - area[i] * 1.5, str.tostring(y), 'bar_index', 'price', clear, 'label_up', fg30, 'small',
        undefined, undefined, undefined, true);
    }

    const buyY = y1Of(buyLine.value);
    if (crossBuyLevel(b.low, buyY) && confirmed) {
      label.new(i, buyY, '✖', 'bar_index', 'price', color.new(up, 100), 'label_center', up, 'large', undefined,
        undefined, undefined, true);
      buyLine.value = undefined;
    }

    if (sell) {
      buyLine.value = undefined;
      const y = b.high + area[i];
      if (cfg.disp_lvl) {
        sellLine.value = line.new(i, y, i, y, 'bar_index', 'none', sellCol1, 'dashed', 1, true);
      }
      label.new(i, y, '', 'bar_index', 'price', sellCol1, 'label_down', undefined, 'tiny', undefined, undefined,
        undefined, true);
      label.new(i, b.high + area[i] * 1.5, str.tostring(b.high + area[i]), 'bar_index', 'price', clear, 'label_down',
        fg30, 'small', undefined, undefined, undefined, true);
    }

    const sellY = y1Of(sellLine.value);
    if (crossSellLevel(b.high, sellY) && confirmed) {
      label.new(i, sellY, '✖', 'bar_index', 'price', color.new(dn, 100), 'label_center', dn, 'large', undefined,
        undefined, undefined, true);
      sellLine.value = undefined;
    }

    // switch: not na(buy_line) => set_x2, not na(sell_line) => set_x2
    if (buyLine.value) line.set_x2(buyLine.value, i);
    else if (sellLine.value) line.set_x2(sellLine.value, i);

    if (buy && !isNaN(tp)) {
      markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: tp, shape: 'circle', color: String(buyCol2), size: 'small' });
      markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: tp, shape: 'circle', color: String(buyCol1), size: 'tiny' });
    }
    if (sell && !isNaN(tp)) {
      markers.push({ id: 'shape2', time: t, position: 'atPriceMiddle', price: tp, shape: 'circle', color: String(sellCol2), size: 'small' });
      markers.push({ id: 'shape3', time: t, position: 'atPriceMiddle', price: tp, shape: 'circle', color: String(sellCol1), size: 'tiny' });
    }

    p[0].push({ time: t, value: 1, color: fg80 });
    p[1].push({ time: t, value: 0.5, color: fg50 });
    // color.new(bar_index % 2 == 0 ? chart.fg_color : na, 0): an na colour is black here
    p[2].push({ time: t, value: 0, color: String(color.new(i % 2 === 0 ? fg : NA_COLOR, 0)) });
    p[3].push({ time: t, value: -0.5, color: fg50 });
    p[4].push({ time: t, value: -1, color: fg80 });
    p[5].push({ time: t, value: tp, color: String(col) });
    p[6].push({ time: t, value: Number.isFinite(tpp) ? tpp : NaN });

    topValue.push(tp);
    bottomValue.push(Number.isFinite(tpp) ? tpp : NaN);
    topColor.push(String(col));
    bottomColor.push(null);
  }
  setDrawingBar(null);

  const constant = (v: number) => bars.map(() => v);
  const same = <T>(v: T) => bars.map(() => v);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: p[0], plot1: p[1], plot2: p[2], plot3: p[3], plot4: p[4], plot5: p[5], plot6: p[6] },
    fills: [
      // fill(p11, p00, 2, -1, color.new(chart.fg_color, 80), na)
      { id: 'fill0', plot1: 'plot0', plot2: 'plot2', options: { title: 'Plots Background' }, gradient: {
        topValue: constant(2), bottomValue: constant(-1), topColor: same<string | null>(fg80), bottomColor: same<string | null>(null) } },
      // fill(p_1, p00, 1, -2, na, color.new(chart.fg_color, 80))
      { id: 'fill1', plot1: 'plot4', plot2: 'plot2', options: { title: 'Plots Background' }, gradient: {
        topValue: constant(1), bottomValue: constant(-2), topColor: same<string | null>(null), bottomColor: same<string | null>(fg80) } },
      // fill(p1, p2, two_p, two_pp, color, na)
      { id: 'fill2', plot1: 'plot5', plot2: 'plot6', options: { title: 'Plots Background' }, gradient: {
        topValue, bottomValue, topColor, bottomColor } },
    ],
    markers,
    ...drawingOutputs(bars),
  };
}

export const TwoPoleOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  drawingKinds,
};
