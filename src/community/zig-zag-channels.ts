/**
 * Zig Zag Channels [LuxAlgo]
 *
 * A zig-zag on closing prices with a channel around each leg. A close that is above the highest close of the
 * `length` bars after it is a top; a close below the lowest close of the `length` bars after it is a bottom. A top
 * or a bottom is known `length` bars later. When the state changes, a line joins the previous swing (its high or
 * low) to the new one, and two dotted lines parallel to it show the largest distance of the candle bodies above and
 * below that line. A label gives the price of each swing and a circle marks it (plot shifted `length` bars back).
 *
 * "Extend To Last Bar" draws, on the last bar, a line from the latest swing to the current close with its two
 * extremities, extended to the right.
 *
 * At most 500 lines and 500 labels are kept.
 *
 * Reference: "Zig Zag Channels [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZigZagChannelsInputs {
  length: number;
  extend: boolean;
  showExt: boolean;
  showLabels: boolean;
  upcol: string;
  midcol: string;
  dncol: string;
}

export const defaultInputs: ZigZagChannelsInputs = {
  length: 100,
  extend: true,
  showExt: true,
  showLabels: true,
  upcol: '#ff1100',
  midcol: '#ff5d00',
  dncol: '#2157f3',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 100 },
  { id: 'extend', type: 'bool', title: 'Extend To Last Bar', defval: true },
  { id: 'showExt', type: 'bool', title: 'Show Extremities', defval: true },
  { id: 'showLabels', type: 'bool', title: 'Show Labels', defval: true },
  { id: 'upcol', type: 'color', title: 'Upper Extremity Color', defval: '#ff1100', group: 'Style' },
  { id: 'midcol', type: 'color', title: 'Zig Zag Color', defval: '#ff5d00', group: 'Style' },
  { id: 'dncol', type: 'color', title: 'Lower Extremity Color', defval: '#2157f3', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  // offset = -length (the default length is 100); the points are already shifted
  { id: 'plot0', title: 'Circles', color: '#2196F3', lineWidth: 1, style: 'circles', offset: -100 },
];

export const metadata = {
  title: 'Zig Zag Channels [LuxAlgo]',
  shortTitle: 'Zig Zag Channels [LuxAlgo]',
  overlay: true,
};

/** study(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dotted: boolean;
  extendRight: boolean;
}
interface Lb {
  x: number;
  y: number;
  text: string;
  textColor: string;
  style: 'label_down' | 'label_up';
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'labels' | 'lines'> & { labels: LabelData[]; lines: LineDrawingData[] };

/**
 * Drawings kept of `total` created in order: when a creation brings the count above max + 5, the oldest are deleted
 * until max remain
 */
const keptCount = (total: number): number => (total <= MAX_OBJECTS + 5 ? total : MAX_OBJECTS + ((total - MAX_OBJECTS - 6) % 6));

interface ZzVars {
  os: number;
  valtop: number;
  valbtm: number;
  btmN: number;
  topN: number;
}

interface ZzRun extends BarRunState<ZzVars> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  /** Every line and label created (the limit is applied in the result) */
  lines: Ln[];
  labels: Lb[];
  /** plot0 points of bars length.. (bar i draws on bar i - length) */
  plot0: { index: number; value: number; color: string }[];
}

function study(inputs: Partial<ZigZagChannelsInputs>): BarStudy<ZzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = Math.trunc(cfg.length);
  return {
    init() {
      const upper = new WindowExtreme(false, length);
      const lower = new WindowExtreme(true, length);
      const s: ZzRun = {
        upper, lower, lines: [], labels: [], plot0: [],
        steps: [upper, lower],
        // os: na until the first top or bottom
        vars: { os: NaN, valtop: NaN, valbtm: NaN, btmN: NaN, topN: NaN },
        lists: [], series: [],
      };
      s.lists = [s.lines, s.labels, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const n = bars.length;
      const v = s.vars;
      const newLine = (x1: number, y1: number, x2: number, y2: number, color: string, dotted = false, extendRight = false) => {
        s.lines.push({ x1, y1, x2, y2, color, dotted, extendRight });
      };

      /** Largest distance of the candle bodies above and below the line from `from` (bar `first`) to `to` */
      const spread = (first: number, count: number, from: number, to: number): [number, number] => {
        let up = 0;
        let dn = 0;
        for (let k = 0; k < count; k++) {
          const point = from + (k / (count - 1)) * (to - from);
          const b = bars[first - k];
          up = Math.max(Math.max(b.close, b.open) - point, up);
          dn = Math.max(point - Math.min(b.close, b.open), dn);
        }
        return [up, dn];
      };

      const close = bars[i].close;
      const upper = s.upper.step(close);
      const lower = s.lower.step(close);
      const back = i >= length ? bars[i - length] : null;
      const srcBack = back ? back.close : NaN;
      const prevOs = v.os;
      v.os = gt(srcBack, upper) ? 0 : lt(srcBack, lower) ? 1 : prevOs;
      const os = v.os;
      // `os[1] != 1` is false while os[1] is na
      const btm = os === 1 && !isNaN(prevOs) && prevOs !== 1;
      const top = os === 0 && !isNaN(prevOs) && prevOs !== 0;
      if (btm) v.btmN = i;
      if (top) v.topN = i;
      const len = Math.abs(v.btmN - v.topN);

      if (btm || top) {
        const price = btm ? back!.low : back!.high;
        const other = btm ? v.valtop : v.valbtm;
        if (btm) v.valbtm = price;
        else v.valtop = price;
        const [up, dn] = isNaN(len) ? [0, 0] : spread(i - length, len, price, other);
        const x1 = i - len - length;
        const x2 = i - length;
        newLine(x1, other, x2, price, cfg.midcol);
        if (cfg.showExt) {
          newLine(x1, other + up, x2, price + up, cfg.upcol, true);
          newLine(x1, other - dn, x2, price - dn, cfg.dncol, true);
        }
        if (cfg.showLabels) {
          s.labels.push({
            x: x2, y: price, text: str.tostring(price, '#.####'), textColor: btm ? cfg.dncol : cfg.upcol,
            style: btm ? 'label_up' : 'label_down',
          });
        }
      }

      // barstate.islast (the last bar is calculated again on each update)
      if (i === n - 1 && cfg.extend) {
        const src = bars[i].close;
        const swingN = os === 1 ? v.btmN : v.topN;
        const x1 = swingN - length;
        const y1 = os === 1 ? v.valbtm : v.valtop;
        const count = i - swingN + length;
        const [up, dn] = isNaN(count) ? [0, 0] : spread(i, count, src, y1);
        newLine(x1, y1, i, src, cfg.midcol, false, true);
        if (cfg.showExt) {
          newLine(x1, y1 + up, i, src + up, cfg.upcol, true, true);
          newLine(x1, y1 - dn, i, src - dn, cfg.dncol, true, true);
        }
      }

      // plot(btm ? low[length] : top ? high[length] : na, offset = -length): the value of bar i is drawn on bar i - length
      if (i >= length) {
        s.plot0.push({ index: i - length, value: btm ? back!.low : top ? back!.high : NaN, color: btm ? cfg.dncol : cfg.upcol });
      }
    },
    result(s, bars) {
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      const lines = s.lines.slice(s.lines.length - keptCount(s.lines.length));
      const labels = s.labels.slice(s.labels.length - keptCount(s.labels.length));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.map((p): Point => ({ time: T(p.index), value: p.value, color: p.color })) },
        // a line with an na coordinate is not drawn
        lines: lines.filter((l) => !isNaN(l.x1) && !isNaN(l.y1) && !isNaN(l.y2)).map((l) => ({
          time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: l.color,
          ...(l.dotted ? { style: 'dotted' as const } : {}),
          ...(l.extendRight ? { extend: 'right' as const } : {}),
        })),
        labels: labels.map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: '#00000000', textColor: l.textColor, style: l.style,
          textAlign: 'left' as const, size: 'small' as const,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZigZagChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZigZagChannelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ZigZagChannels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
