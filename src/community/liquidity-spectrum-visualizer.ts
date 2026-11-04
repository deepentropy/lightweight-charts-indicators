/**
 * Liquidity Spectrum Visualizer [BigBeluga]
 *
 * Volume bubbles and a volume profile of the last "LookBack" bars:
 * - Volume bubbles: a circle at hlc3 on each of the last "LookBack" bars, sized by the volume in standard deviations
 *   (volume / stdev(volume, 200): below 1 tiny, then small, normal, large, and huge from 4), coloured by the candle
 *   direction (green up, orange down) with a gradient from half transparent (0) to full colour (5). A bar with 4 or
 *   more deviations also gets a label with its volume.
 * - Volume profile (last bar): the high / low range of the last "LookBack" bars is cut into 100 bins; each bin adds
 *   the volume of the bars whose close is within one bin of it. The bins are boxes drawn left of the range (their
 *   length is the bin volume scaled to 50 bars), green below the last close and orange above it, inside a frame from
 *   the profile start to 5 bars after the last bar.
 * - Liquidity levels: a line from the profile to 5 bars after the last bar at the middle of each bin above half of
 *   the largest bin (wider above 35).
 * - The highest high and the lowest low of the range get a price label (one per bin, as in the original: the labels
 *   are created again for each of the 100 bins, at most 500 labels are kept).
 *
 * Notes on the port:
 * - The frame and the volume labels use the chart foreground colour (chart context, dark theme colour without it).
 * - The bubbles are markers (absolute price); "Display Volume Bubles" off hides them (display.none in the original).
 *
 * Reference: "Liquidity Spectrum Visualizer [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, str, color, array, Series, line, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData, PineSize } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, type ChartContext } from '../chart-context';

export interface LiquiditySpectrumVisualizerInputs {
  /** Bars of the bubbles and of the profile */
  lookback: number;
  /** Volume bubbles (and their labels) */
  volBubles: boolean;
  /** Volume profile boxes */
  volumePr: boolean;
  /** Liquidity level lines */
  liqLevels: boolean;
  /** Up colour */
  colUp: string;
  /** Down colour */
  colDn: string;
}

export const defaultInputs: LiquiditySpectrumVisualizerInputs = {
  lookback: 200,
  volBubles: true,
  volumePr: true,
  liqLevels: true,
  colUp: '#22b16c',
  colDn: '#dd7e2a',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'LookBack', defval: 200 },
  { id: 'volBubles', type: 'bool', title: 'Display Volume Bubles', defval: true },
  { id: 'volumePr', type: 'bool', title: 'Volume Profile', defval: true },
  { id: 'liqLevels', type: 'bool', title: 'Liquidity Levels', defval: true },
  { id: 'colUp', type: 'color', title: '', defval: '#22b16c', inline: 'colors' },
  { id: 'colDn', type: 'color', title: '', defval: '#dd7e2a', inline: 'colors' },
];

export const plotConfig: PlotConfig[] = [];

/** Default label / box text colour of this version of the language */
const V6_TEXT = '#ffffff';

const SIZES: PineSize[] = ['tiny', 'small', 'normal', 'large', 'huge'];

/** The five plotshape() calls (untitled in the original): one per bubble size */
export const shapeConfig: ShapeConfig[] = SIZES.map((size, k) => ({
  id: `shape${k}`, kind: 'shape' as const, title: `Volume Bubble ${size}`, style: 'circle' as const,
  location: 'absolute' as const, color: '#2962ff', size, editable: false,
}));

export const drawingKinds: StudyDrawingKind[] = ['label', 'box', 'line'];

export const metadata = {
  title: 'Liquidity Spectrum Visualizer [BigBeluga]',
  shortTitle: 'Liquidity Spectrum Visualizer [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10, na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => b - a > -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquiditySpectrumVisualizerInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const L = n - 1;
  const lookback = Math.trunc(cfg.lookback);
  const fg = foregroundColorOf(chart);
  const vol = bars.map((b) => b.volume ?? NaN);
  const stdev = ta.stdev(new Series(bars, (b) => b.volume ?? NaN), 200).toArray();
  const at = (i: number, f: (b: Bar) => number) => (i >= 0 ? f(bars[i]) : NaN);

  // indicator(max_boxes_count = 500, max_labels_count = 500), lines: the default 50
  resetDrawings({ line: 50, box: 500, label: 500 });
  const offset = -lookback - (cfg.volumePr ? 50 : 0);
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === L, L);
    const b = bars[i];
    const allow = L - i < lookback;
    const nVol = vol[i] / (stdev[i] ?? NaN);
    const cond = [lt(nVol, 1), ge(nVol, 1) && lt(nVol, 2), ge(nVol, 2) && lt(nVol, 3), ge(nVol, 3) && lt(nVol, 4), ge(nVol, 4)];

    if (i === L) {
      // barstate.islast: range of the last `lookback` bars
      const hl: number[] = [];
      for (let j = 0; j < lookback; j++) {
        hl.push(at(i - j, (x) => x.high));
        hl.push(at(i - j, (x) => x.low));
      }
      const max = array.max(hl);
      const min = array.min(hl);
      const bins: number[] = new Array(100).fill(0);
      const step = (max - min) / 100;
      for (let k = 0; k < bins.length; k++) {
        const lower = min + step * k;
        const upper = lower + step;
        for (let j = 0; j < lookback; j++) {
          const h = at(i - j, (x) => x.high);
          const l = at(i - j, (x) => x.low);
          if (eq(h, max)) label.new(i - j, h, str.tostring(h), 'bar_index', 'price', cfg.colDn, 'label_down', V6_TEXT);
          if (eq(l, min)) label.new(i - j, l, str.tostring(l), 'bar_index', 'price', cfg.colUp, 'label_up', V6_TEXT);
          const c = at(i - j, (x) => x.close);
          if (ge(c, lower - step) && le(c, upper + step)) bins[k] = bins[k] + (i - j >= 0 ? vol[i - j] : NaN);
        }
      }
      const binsMax = array.max(bins);
      for (let k = 0; k < bins.length; k++) {
        const lower = min + step * k;
        const upper = lower + step;
        const val = Math.trunc((bins[k] / binsMax) * 50);
        const mid = (upper + lower) / 2;
        const colResSup = gt(b.close, mid) ? cfg.colUp : cfg.colDn;
        if (cfg.volumePr) {
          const vpCol = color.from_gradient(val, 0, 50, String(color.new(colResSup, 90)), colResSup);
          box.new(i + offset, upper, i + val + offset, lower, 'transparent', undefined, undefined, undefined, undefined, vpCol, '', undefined,
            V6_TEXT);
        }
        if (gt(val, 25) && cfg.liqLevels) {
          const colorPocs = color.from_gradient(val, 25, 50, String(color.new(colResSup, 90)), colResSup);
          const width = lt(val, 35) ? 1 : gt(val, 35) ? 2 : gt(val, 45) ? 3 : 1;
          line.new(i + offset, mid, i + 5, mid, 'bar_index', 'none', colorPocs, 'solid', width);
        }
      }
      // box.delete(box.new(...)[1]): the box of the bar before is na here (the block runs on the last bar only)
      box.new(i + offset, max, i + 5, min, String(color.new(fg, 50)), 1, undefined, undefined, undefined, 'transparent', '', undefined,
        V6_TEXT);
    }

    if (cfg.volBubles && allow) {
      const colorr = gt(b.close, b.open) ? cfg.colUp : cfg.colDn;
      const gradientCol = color.from_gradient(nVol, 0, 5, String(color.new(colorr, 50)), colorr);
      const hlc3 = (b.high + b.low + b.close) / 3;
      cond.forEach((c, k) => {
        if (c) {
          markers.push({
            id: `shape${k}`, time: b.time, position: 'atPriceMiddle', price: hlc3, shape: 'circle', color: gradientCol,
            size: SIZES[k],
          });
        }
      });
      if (cond[4]) {
        label.new(i, hlc3, str.tostring(vol[i], 'volume'), 'bar_index', 'price', '#00000000', 'label_center', fg);
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars),
  };
}

export const LiquiditySpectrumVisualizer = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, drawingKinds,
};
