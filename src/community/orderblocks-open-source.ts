/**
 * Orderblocks (Nephew_Sam_)
 *
 * Finds fractal highs and lows (3-bar fractals, or 5-bar fractals) and keeps the fractals that are not broken yet.
 * When the close (or the low / high, "HL") goes past a fractal low, the script looks back from the current bar to the
 * fractal bar (at most 500 bars) for the bullish candle with the highest high: that candle is a bearish order block.
 * When the price goes past a fractal high, the bearish candle with the lowest low is a bullish order block. With the
 * FVG filter on, the order block must be followed by a fair value gap that starts at most "Max bars" after it.
 * Each order block gets two short lines (xloc bar time, "Length of lines" chart bars long): the high and the open
 * (Body) or the low (Wick) for a bearish block, the low and the open or the high for a bullish block. A bearish block
 * ends when the high reaches both lines, a bullish block when the low reaches both lines (the lines are deleted when
 * "Delete lines after fill" is on). The fractal points can be shown as triangles. At most 100 lines are kept.
 * A small table at the bottom left shows the author name.
 *
 * Reference: "Orderblocks (Nephew_Sam_) - Open source" by nephew_sam_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, line, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Line, type MarkerData, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe } from '../anchor-period';
import type { ChartContext } from '../chart-context';

export interface OrderblocksOpenSourceInputs {
  /** Section title of the original (no effect) */
  temp0: boolean;
  /** Show the fractal points */
  showFractals: boolean;
  /** 3-bar or 5-bar fractals */
  filterFractal: '3' | '5';
  /** Section title of the original (no effect) */
  temp1: boolean;
  /** Fractal broken by the close or by the high / low */
  findObType: 'Close' | 'HL';
  /** Keep only the order blocks followed by a fair value gap */
  filterFvgs: boolean;
  /** Maximum bars between the order block and the gap */
  fvgDistance: number;
  /** Second line at the open (Body) or at the wick end (Wick) */
  lineHeight: 'Body' | 'Wick';
  /** Delete the lines when the price reaches them */
  delLines: boolean;
  /** Section title of the original (no effect) */
  temp3: boolean;
  lines_style: 'Solid' | 'Dashed' | 'Dotted';
  /** Line length in chart bars */
  line_length: number;
  linesWidth: number;
  bear_line_color: string;
  bull_line_color: string;
}

export const defaultInputs: OrderblocksOpenSourceInputs = {
  temp0: false,
  showFractals: false,
  filterFractal: '3',
  temp1: false,
  findObType: 'Close',
  filterFvgs: true,
  fvgDistance: 3,
  lineHeight: 'Body',
  delLines: true,
  temp3: false,
  lines_style: 'Solid',
  line_length: 5,
  linesWidth: 2,
  bear_line_color: '#FF5252',
  bull_line_color: '#2962FF',
};

export const inputConfig: InputConfig[] = [
  { id: 'temp0', type: 'bool', title: '••••••••••••••••••• Fractals ••••••••••••••••••••••', defval: false },
  { id: 'showFractals', type: 'bool', title: 'Show Fractal Points ?', defval: false },
  { id: 'filterFractal', type: 'string', title: 'Filter 3/5 bar fractal', defval: '3', options: ['3', '5'] },
  { id: 'temp1', type: 'bool', title: '••••••••••••••••••• Orderblocks •••••••••••••••••••', defval: false },
  { id: 'findObType', type: 'string', title: 'Find OB after fractal break of close/HL', defval: 'Close', options: ['Close', 'HL'] },
  { id: 'filterFvgs', type: 'bool', title: 'Filter only OB that follow with FVG ?', defval: true },
  { id: 'fvgDistance', type: 'int', title: 'Max bars between the OB and FVG', defval: 3, min: 1, max: 6 },
  { id: 'lineHeight', type: 'string', title: 'Line Height', defval: 'Body', options: ['Body', 'Wick'] },
  { id: 'delLines', type: 'bool', title: 'Delete lines after fill ?', defval: true },
  { id: 'temp3', type: 'bool', title: '•••••••••••••••••••• Styles ••••••••••••••••••••••••', defval: false },
  { id: 'lines_style', type: 'string', title: 'Lines style', defval: 'Solid', options: ['Solid', 'Dashed', 'Dotted'] },
  { id: 'line_length', type: 'int', title: 'Length of lines', defval: 5, min: 1, max: 100 },
  { id: 'linesWidth', type: 'int', title: 'Lines Width ?', defval: 2, min: 1, max: 4 },
  { id: 'bear_line_color', type: 'color', title: 'Bear OB Line color', defval: '#FF5252' },
  { id: 'bull_line_color', type: 'color', title: 'Bull OB Line color', defval: '#2962FF' },
];

export const plotConfig: PlotConfig[] = [];

/** v5 colour constants: color.red, color.blue */
const RED = '#FF5252';
const BLUE = '#2962FF';

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Fractal High', style: 'triangledown', location: 'abovebar', color: RED, size: 'auto' },
  { id: 'shape1', kind: 'shape', title: 'Fractal Low', style: 'triangleup', location: 'belowbar', color: BLUE, size: 'auto' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'table'];

export const metadata = {
  title: 'Orderblocks (Nephew_Sam_)',
  shortTitle: 'Orderblocks (Nephew_Sam_)',
  overlay: true,
};

/** bars_back of the original: the longest look-back of the order block search */
const BARS_BACK = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const le = (a: number, b: number) => a - b <= EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** resolutionInMinutes(): the chart timeframe in minutes */
function resolutionInMinutes(tf: string): number {
  const m = /^(\d*)([SDWM]?)$/.exec(tf);
  if (!m) return NaN;
  const mult = m[1] === '' ? 1 : Number(m[1]);
  switch (m[2]) {
    case 'S': return mult * (1 / 60);
    case '': return mult;
    case 'D': return mult * 60 * 24;
    case 'W': return mult * 60 * 24 * 7;
    default: return mult * 60 * 24 * 30.4375;
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderblocksOpenSourceInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const three = cfg.filterFractal === '3';
  const byClose = cfg.findObType === 'Close';
  const body = cfg.lineHeight === 'Body';
  const lineStyle = cfg.lines_style === 'Solid' ? 'solid' : cfg.lines_style === 'Dashed' ? 'dashed' : 'dotted';
  const lineLength = cfg.line_length;
  const width = cfg.linesWidth;
  const bearColor = cfg.bear_line_color;
  const bullColor = cfg.bull_line_color;
  const fvgDistance = cfg.fvgDistance;
  const toMs = n > 0 && bars[0].time >= 1e12 ? 1 : 1000;
  const resMs = resolutionInMinutes(chartTimeframe(bars, chart)) * 60 * 1000;

  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const open = bars.map((b) => b.open);
  const close = bars.map((b) => b.close);
  const time = bars.map((b) => b.time * toMs);

  resetDrawings({ line: 100 });
  const markers: MarkerData[] = [];

  const fractalHighs: number[] = [];
  const fractalHighTimes: number[] = [];
  const fractalLows: number[] = [];
  const fractalLowTimes: number[] = [];
  const line1: Line[] = [];
  const line2: Line[] = [];
  const line3: Line[] = [];
  const line4: Line[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const at = (arr: number[], k: number) => (i - k >= 0 ? arr[i - k] : NaN);
    const H = (k: number) => at(high, k);
    const L = (k: number) => at(low, k);

    // isRegularFractal / isBWFractal
    const fractalHigh = three
      ? lt(H(0), H(1)) && (lt(H(2), H(1)) || (eq(H(2), H(1)) && lt(H(3), H(2))))
      : lt(H(0), H(2)) && lt(H(1), H(2)) && lt(H(3), H(2)) && lt(H(4), H(2));
    const fractalLow = three
      ? gt(L(0), L(1)) && (gt(L(2), L(1)) || (eq(L(2), L(1)) && gt(L(3), L(2))))
      : gt(L(0), L(2)) && gt(L(1), L(2)) && gt(L(3), L(2)) && gt(L(4), L(2));
    const off = three ? 1 : 2;

    if (fractalHigh) {
      fractalHighs.push(H(off));
      fractalHighTimes.push(at(time, off));
    }
    if (fractalLow) {
      fractalLows.push(L(off));
      fractalLowTimes.push(at(time, off));
    }

    // f_timeFrom('bar', line_length, 'chart', idx)
    const timeTo = (idx: number) => Math.trunc(at(time, idx) + resMs * lineLength);

    // Bearish loop
    for (let f = fractalLows.length - 1; f >= 0; f--) {
      if (lt(byClose ? close[i] : low[i], fractalLows[f])) {
        let idx = 0;
        let max = low[i];
        let gapIndex = 0;
        for (let k = 0; k <= BARS_BACK; k++) {
          const bearishGap = lt(at(close, k + 1), at(low, k + 2)) && lt(at(high, k), at(low, k + 2));
          if (at(time, k) < fractalLowTimes[f]) break;
          if (gt(at(close, k), at(open, k)) && gt(at(high, k), max)) {
            idx = k;
            max = at(high, k);
          }
          if (bearishGap && gt(at(high, k), max)) gapIndex = k + 2;
        }
        const filterFvg = cfg.filterFvgs ? gapIndex > 0 && idx - gapIndex >= 0 && idx - gapIndex <= fvgDistance : true;
        if (idx !== 0 && filterFvg) {
          const to = timeTo(idx);
          const loc = body ? at(open, idx) : at(low, idx);
          line1.push(line.new(at(time, idx), at(high, idx), to, at(high, idx), 'bar_time', undefined, bearColor, lineStyle, width));
          line2.push(line.new(at(time, idx), loc, to, loc, 'bar_time', undefined, bearColor, lineStyle, width));
        }
        fractalLows.splice(f, 1);
        fractalLowTimes.splice(f, 1);
      }
    }

    // Bullish loop
    for (let f = fractalHighs.length - 1; f >= 0; f--) {
      if (gt(byClose ? close[i] : high[i], fractalHighs[f])) {
        let idx = 0;
        let min = low[i];
        let gapIndex = 0;
        for (let k = 0; k <= BARS_BACK; k++) {
          const bullishGap = gt(at(close, k + 1), at(high, k + 2)) && gt(at(low, k), at(high, k + 2));
          if (at(time, k) < fractalHighTimes[f]) break;
          if (lt(at(close, k), at(open, k)) && lt(at(low, k), min)) {
            idx = k;
            min = at(low, k);
          }
          if (bullishGap) gapIndex = k + 2;
        }
        const filterFvg = cfg.filterFvgs ? gapIndex > 0 && idx - gapIndex >= 0 && idx - gapIndex <= fvgDistance : true;
        if (idx !== 0 && filterFvg) {
          const to = timeTo(idx);
          const loc = body ? at(open, idx) : at(high, idx);
          line3.push(line.new(at(time, idx), at(low, idx), to, at(low, idx), 'bar_time', undefined, bullColor, lineStyle, width));
          line4.push(line.new(at(time, idx), loc, to, loc, 'bar_time', undefined, bullColor, lineStyle, width));
        }
        fractalHighs.splice(f, 1);
        fractalHighTimes.splice(f, 1);
      }
    }

    // Delete lines
    for (let k = line1.length - 1; k >= 0; k--) {
      if (ge(high[i], line.get_y1(line1[k])) && ge(high[i], line.get_y1(line2[k]))) {
        if (cfg.delLines) {
          line.delete(line1[k]);
          line.delete(line2[k]);
        }
        line1.splice(k, 1);
        line2.splice(k, 1);
      }
    }
    for (let k = line3.length - 1; k >= 0; k--) {
      if (le(low[i], line.get_y1(line3[k])) && le(low[i], line.get_y1(line4[k]))) {
        if (cfg.delLines) {
          line.delete(line3[k]);
          line.delete(line4[k]);
        }
        line3.splice(k, 1);
        line4.splice(k, 1);
      }
    }

    // Fractal points (offset -1 or -2)
    if (cfg.showFractals && i - off >= 0) {
      if (fractalHigh) {
        markers.push({ id: 'shape0', time: bars[i - off].time, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'auto' });
      }
      if (fractalLow) {
        markers.push({ id: 'shape1', time: bars[i - off].time, position: 'belowBar', shape: 'triangleUp', color: BLUE, size: 'auto' });
      }
    }

    // Watermark
    if (i === n - 1) {
      const tb = table.new('bottom_left', 1, 2);
      table.cell(tb, 0, 0, '@Nephew_Sam_', undefined, undefined, String(color.new('#787B86', 50)), undefined, undefined, 'small');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars, toMs === 1 ? 'ms' : 's'),
  };
}

export const OrderblocksOpenSource = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, drawingKinds,
};
