/**
 * Nadaraya-Watson Envelope [LuxAlgo]
 *
 * A Gaussian kernel regression of the source with an envelope of the mean absolute error * mult around it.
 *
 * Repainting mode (default): the regression is computed on the last bar only, over the last 500 bars (each point
 * is the kernel-weighted mean of these bars). It is drawn with lines (one segment out of two: a dashed look), and a
 * label marks each bar where the source crosses out of the envelope. A table cell says "Repainting Mode Enabled".
 * These are the drawings of the last bar: they change when a bar is added.
 *
 * Non-repainting mode: the end point of the regression (kernel weights of the last 500 bars) on each bar, plotted
 * with the envelope of the 499-bar mean absolute error; label markers where the close crosses the envelope.
 *
 * The original keeps at most 500 lines (max_lines_count): 500 empty lines of the first bar are replaced by the 500
 * segments of the last bar.
 *
 * Reference: "Nadaraya-Watson Envelope [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, array, compare, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData, LineDrawingData, TableData } from '../types';
import { barTime } from '../bar-time';

export interface NadarayaWatsonEnvelopeInputs {
  /** Bandwidth of the Gaussian kernel */
  h: number;
  /** Multiplier of the mean absolute error */
  mult: number;
  src: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'hlcc4';
  /** Repainting Smoothing */
  repaint: boolean;
  upCss: string;
  dnCss: string;
}

// Pine v5 colours: color.teal #00897B, color.red #FF5252
export const defaultInputs: NadarayaWatsonEnvelopeInputs = {
  h: 8,
  mult: 3,
  src: 'close',
  repaint: true,
  upCss: '#00897B',
  dnCss: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'h', type: 'float', title: 'Bandwidth', defval: 8, min: 0 },
  { id: 'mult', type: 'float', title: 'mult', defval: 3, min: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  {
    id: 'repaint', type: 'bool', title: 'Repainting Smoothing', defval: true,
    tooltip: 'Repainting is an effect where the indicators historical output is subject to change over time. Disabling repainting will cause the indicator to output the endpoints of the calculations',
  },
  { id: 'upCss', type: 'color', title: 'Colors', defval: '#00897B', inline: 'inline1', group: 'Style' },
  { id: 'dnCss', type: 'color', title: '', defval: '#FF5252', inline: 'inline1', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#00897B', lineWidth: 1 },
  { id: 'plot1', title: 'Lower', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'Nadaraya-Watson Envelope [LuxAlgo]',
  shortTitle: 'LuxAlgo - Nadaraya-Watson Envelope',
  overlay: true,
};

/** Pine max_lines_count; a creation that brings the count above max + 5 deletes the oldest lines until max remain */
const MAX_LINES = 500;
/** Bars of the kernel window (and Pine max_bars_back) */
const WINDOW = 500;

/** Pine `for i = a to b`: counts down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

type RawLine = { x1: number; y1: number; x2: number; y2: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<NadarayaWatsonEnvelopeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[]; tables: TableData[] } {
  const { h, mult, src: srcName, repaint, upCss, dnCss } = { ...defaultInputs, ...inputs };
  const count = bars.length;
  const src = getSourceSeries(bars, srcName).toArray().map((v) => v ?? NaN);
  // src[k] on bar i (na before the first bar)
  const at = (i: number, k: number) => (i - k >= 0 ? src[i - k] : NaN);
  // Gaussian window
  const gauss = (x: number, bw: number) => Math.exp(-(Math.pow(x, 2) / (bw * bw * 2)));

  const markers: MarkerData[] = [];
  const upper: number[] = new Array(count).fill(NaN);
  const lower: number[] = new Array(count).fill(NaN);

  // Lines alive, oldest first (Pine object limit)
  const liveLines: RawLine[] = [];
  const newLine = (l: RawLine) => {
    liveLines.push(l);
    if (liveLines.length > MAX_LINES + 5) liveLines.splice(0, liveLines.length - MAX_LINES);
  };
  const labels: LabelData[] = [];

  if (count > 0 && repaint) {
    // if barstate.isfirst and repaint: 500 x line.new(na, na, na, na)
    for (let i = 0; i < WINDOW; i++) newLine({ x1: NaN, y1: NaN, x2: NaN, y2: NaN });
  }

  if (!repaint) {
    // End point method: out = sum(src[i] * coefs[i], i = 0..499) / sum(coefs); na until 500 bars exist
    const coefs: number[] = [];
    for (let i = 0; i < WINDOW; i++) coefs.push(gauss(i, h));
    const den = array.sum(coefs);
    const out: number[] = new Array(count);
    const err: number[] = new Array(count);
    for (let b = 0; b < count; b++) {
      let o = 0;
      for (let i = 0; i < WINDOW; i++) o += at(b, i) * coefs[i];
      out[b] = o / den;
      err[b] = Math.abs(src[b] - out[b]);
    }
    const sma = ta.sma(Series.fromArray(bars, err), WINDOW - 1).toArray();
    for (let b = 0; b < count; b++) {
      const mae = (sma[b] ?? NaN) * mult;
      upper[b] = out[b] + mae;
      lower[b] = out[b] - mae;
    }
    // Crossing arrows: plotshape(ta.crossunder(close, out - mae) ? low : na, shape.labelup, location.absolute,
    //   color(na), text = '▲', textcolor = upCss, size = size.tiny) and the crossover with '▼' on the high
    const closeS = new Series(bars, (b) => b.close);
    const under = ta.crossunder(closeS, Series.fromArray(bars, lower)).toArray();
    const over = ta.crossover(closeS, Series.fromArray(bars, upper)).toArray();
    for (let b = 0; b < count; b++) {
      if (under[b]) {
        markers.push({
          time: bars[b].time, position: 'atPriceBottom', price: bars[b].low, shape: 'labelUp', color: 'transparent',
          text: '▲', textColor: upCss, size: 'tiny',
        });
      }
      if (over[b]) {
        markers.push({
          time: bars[b].time, position: 'atPriceTop', price: bars[b].high, shape: 'labelDown', color: 'transparent',
          text: '▼', textColor: dnCss, size: 'tiny',
        });
      }
    }
  }

  if (count > 0 && repaint) {
    // Last bar: n = bar_index
    const n = count - 1;
    const last = Math.min(WINDOW - 1, n - 1);
    if (last < 0) {
      // for i = 0 to -1 counts down and reads src[-1]
      throw new Error('Nadaraya-Watson Envelope: the repainting mode needs at least 2 bars (negative history index).');
    }
    const nwe: number[] = [];
    let sae = 0;
    let y2 = NaN;
    let y1 = NaN;
    // Compute and set NWE point
    for (const i of pineRange(0, last)) {
      let sum = 0;
      let sumw = 0;
      // Compute weighted mean
      for (const j of pineRange(0, last)) {
        const w = gauss(i - j, h);
        sum += at(n, j) * w;
        sumw += w;
      }
      y2 = sum / sumw;
      sae += Math.abs(at(n, i) - y2);
      nwe.push(y2);
    }
    sae = (sae / last) * mult;
    for (const i of pineRange(0, last)) {
      if (i % 2) {
        newLine({ x1: n - i + 1, y1: y1 + sae, x2: n - i, y2: nwe[i] + sae, color: upCss });
        newLine({ x1: n - i + 1, y1: y1 - sae, x2: n - i, y2: nwe[i] - sae, color: dnCss });
      }
      const s0 = at(n, i);
      const s1 = at(n, i + 1);
      // label.new(n - i, src[i], '▼', color = color(na), style = label.style_label_down, textcolor = dnCss,
      //   textalign = text.align_center)
      if (compare.gt(s0, nwe[i] + sae) && compare.lt(s1, nwe[i] + sae)) {
        labels.push({
          time: bars[n - i].time, price: s0, text: '▼', color: 'transparent', style: 'label_down', textColor: dnCss,
          textAlign: 'center',
        });
      }
      if (compare.lt(s0, nwe[i] - sae) && compare.gt(s1, nwe[i] - sae)) {
        labels.push({
          time: bars[n - i].time, price: s0, text: '▲', color: 'transparent', style: 'label_up', textColor: upCss,
          textAlign: 'center',
        });
      }
      y1 = nwe[i];
    }
  }

  // A line with an na coordinate is not drawn
  const lines: LineDrawingData[] = [];
  for (const l of liveLines) {
    if (![l.x1, l.y1, l.x2, l.y2].every(Number.isFinite)) continue;
    const line: LineDrawingData = { time1: barTime(bars, l.x1), price1: l.y1, time2: barTime(bars, l.x2), price2: l.y2 };
    if (l.color !== undefined) line.color = l.color;
    lines.push(line);
  }

  // Dashboard: table.new(position.top_right, 1, 1, bgcolor = #1e222d, border_color = #373a46, border_width = 1,
  //   frame_color = #373a46, frame_width = 1); the cell only in repainting mode
  const tables: TableData[] = count > 0
    ? [{
      position: 'top_right',
      columns: 1,
      rows: 1,
      cells: repaint ? [{ row: 0, column: 0, text: 'Repainting Mode Enabled', textColor: '#FFFFFF', textSize: 'small' }] : [],
      bgColor: '#1e222d',
      frameColor: '#373a46',
      frameWidth: 1,
      borderColor: '#373a46',
      borderWidth: 1,
    }]
    : [];

  const point = (b: Bar, v: number, c: string) => ({ time: b.time, value: Number.isFinite(v) ? v : NaN, color: c });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': bars.map((b, i) => point(b, upper[i], upCss)),
      'plot1': bars.map((b, i) => point(b, lower[i], dnCss)),
    },
    markers,
    lines,
    labels,
    tables,
  };
}

export const NadarayaWatsonEnvelope = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
