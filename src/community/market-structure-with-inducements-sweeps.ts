/**
 * Market Structure with Inducements & Sweeps [LuxAlgo]
 *
 * Swings: a bar is a swing high when its high is above the highest high of the `len` bars after it (a swing low
 * when its low is below the lowest low), and highs and lows alternate. Two swing sets are used: a long one ("CHoCH
 * Detection Period") and a short one ("IDM Detection Period").
 * - CHoCH (change of character): a close above the latest long swing high turns the structure bullish, a close
 *   below the latest long swing low turns it bearish. A dashed line runs from the swing to the bar of the close.
 * - IDM (inducement): in a bullish structure, the first low below the latest short swing low (dotted line); the
 *   mirror in a bearish structure.
 * - BOS (break of structure): after an inducement, a close beyond the trailing maximum (bullish) or minimum
 *   (bearish) reached since the change of character (solid line).
 * - Sweep: a high above the trailing maximum with a close back below it (bullish structure), or the mirror: a dotted
 *   line with an "x".
 * On the last bar three more lines with their labels show the levels in progress: the level whose break would change
 * the character, the level of the next break of structure and the inducement level still open (15 bars to the right).
 * The long swings are drawn as circles on their bar. At most 500 lines and 500 labels are kept.
 *
 * Reference: "Market Structure with Inducements & Sweeps [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketStructureWithInducementsSweepsInputs {
  /** Bars after a swing of the long set */
  len: number;
  /** Bars after a swing of the short set */
  shortLen: number;
  bullCss: string;
  bearCss: string;
  showChoch: boolean;
  showBos: boolean;
  showIdm: boolean;
  idmCss: string;
  showSweeps: boolean;
  sweepsCss: string;
  showCircles: boolean;
}

export const defaultInputs: MarketStructureWithInducementsSweepsInputs = {
  len: 50,
  shortLen: 3,
  bullCss: '#089981',
  bearCss: '#ff5252',
  showChoch: true,
  showBos: true,
  showIdm: true,
  idmCss: '#787B86',
  showSweeps: true,
  sweepsCss: '#787B86',
  showCircles: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'CHoCH Detection Period', defval: 50 },
  { id: 'shortLen', type: 'int', title: 'IDM Detection Period', defval: 3 },
  { id: 'bullCss', type: 'color', title: 'Bullish Elements', defval: '#089981', group: 'Style' },
  { id: 'bearCss', type: 'color', title: 'Bearish Elements', defval: '#ff5252', group: 'Style' },
  { id: 'showChoch', type: 'bool', title: 'Show CHoCH', defval: true, group: 'Style' },
  { id: 'showBos', type: 'bool', title: 'Show BOS', defval: true, group: 'Style' },
  { id: 'showIdm', type: 'bool', title: 'Show Inducements', defval: true, inline: 'idm', group: 'Style' },
  { id: 'idmCss', type: 'color', title: '', defval: '#787B86', inline: 'idm', group: 'Style' },
  { id: 'showSweeps', type: 'bool', title: 'Show Sweeps', defval: true, inline: 'sweeps', group: 'Style' },
  { id: 'sweepsCss', type: 'color', title: '', defval: '#787B86', inline: 'sweeps', group: 'Style' },
  { id: 'showCircles', type: 'bool', title: 'Show Swings', defval: true, group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Swing High', color: String(color.new('#ff5252', 50)), lineWidth: 5, style: 'circles' },
  { id: 'plot1', title: 'Swing Low', color: String(color.new('#089981', 50)), lineWidth: 5, style: 'circles' },
];

export const metadata = {
  title: 'Market Structure with Inducements & Sweeps [LuxAlgo]',
  shortTitle: 'LuxAlgo - Market Structure with Inducements & Sweeps',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
/** color.gray of Pine version 5 (the bearish inducement has this fixed colour) */
const GRAY = '#787B86';
/** Text colour of a label that was given none (Pine version 5) */
const DEFAULT_TEXT = '#363A45';
/** Colour of a line that was given none */
const DEFAULT_LINE = '#2962FF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string | null;
  style: 'solid' | 'dashed' | 'dotted';
}
interface Lb {
  x: number;
  y: number;
  text: string;
  textColor: string | null;
  style: 'label_down' | 'label_up';
  size?: 'tiny';
}


type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'labels' | 'lines'> & { labels: LabelData[]; lines: LineDrawingData[] };

/** Kept drawings of `total` created ones: when a creation brings the count above max + 5, the oldest (not held) are
 *  deleted until max remain */
function keptCount(total: number): number {
  return total <= MAX_OBJECTS + 5 ? total : MAX_OBJECTS + ((total - (MAX_OBJECTS + 6)) % 6);
}

interface MsVars {
  /** swings(len) / swings(shortLen): os (na until the first swing), the bar of the latest swing high / low */
  lOs: number;
  lTx: number;
  lBx: number;
  sOs: number;
  sTx: number;
  sBx: number;
  os: number;
  topCrossed: boolean;
  btmCrossed: boolean;
  max: number;
  min: number;
  maxX1: number;
  minX1: number;
  topy: number;
  btmy: number;
  stopCrossed: boolean;
  sbtmCrossed: boolean;
  /** fixnan(stop), fixnan(sbtm) */
  stopy: number;
  sbtmy: number;
}

interface MsRun extends BarRunState<MsVars> {
  lUpper: WindowExtreme;
  lLower: WindowExtreme;
  sUpper: WindowExtreme;
  sLower: WindowExtreme;
  plot0: Point[];
  plot1: Point[];
  /** The drawings created after the three held ones of each list, in creation order */
  lines: Ln[];
  labels: Lb[];
}

function study(inputs: Partial<MarketStructureWithInducementsSweepsInputs>): BarStudy<MsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = Math.trunc(cfg.len);
  const shortLen = Math.trunc(cfg.shortLen);
  const { bullCss, bearCss, idmCss, sweepsCss } = cfg;
  const highCss = String(color.new(bearCss, 50));
  const lowCss = String(color.new(bullCss, 50));
  /** A level line from bar x to the current bar i with its label in the middle */
  const level = (
    s: MsRun, i: number, x: number, y: number, css: string, style: Ln['style'], text: string, labelStyle: Lb['style'], tiny = true,
  ) => {
    s.lines.push({ x1: x, y1: y, x2: i, y2: y, color: css, style });
    // int(math.avg(n, x))
    s.labels.push({ x: Math.trunc((i + x) / 2), y, text, textColor: css, style: labelStyle, ...(tiny ? { size: 'tiny' as const } : {}) });
  };
  return {
    init() {
      // the length checks of ta.highest / ta.lowest
      taCore.highest([], len);
      taCore.highest([], shortLen);
      const lUpper = new WindowExtreme(false, len);
      const lLower = new WindowExtreme(true, len);
      const sUpper = new WindowExtreme(false, shortLen);
      const sLower = new WindowExtreme(true, shortLen);
      const s: MsRun = {
        lUpper, lLower, sUpper, sLower, plot0: [], plot1: [], lines: [], labels: [],
        steps: [lUpper, lLower, sUpper, sLower],
        vars: {
          lOs: NaN, lTx: NaN, lBx: NaN, sOs: NaN, sTx: NaN, sBx: NaN,
          os: 0, topCrossed: false, btmCrossed: false, max: NaN, min: NaN, maxX1: NaN, minX1: NaN, topy: NaN, btmy: NaN,
          stopCrossed: false, sbtmCrossed: false, stopy: NaN, sbtmy: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.lines, s.labels];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;

      // swings(len): a bar is a swing high when its high is above the highest high of the len bars after it
      // var os = 0, then os := ... : os[1]: na from the first bar until the first swing
      let top: number;
      let btm: number;
      {
        const upper = s.lUpper.step(b.high);
        const lower = s.lLower.step(b.low);
        const before = v.lOs;
        const back = i >= len ? bars[i - len] : null;
        const h = back ? back.high : NaN;
        const l = back ? back.low : NaN;
        v.lOs = gt(h, upper) ? 0 : lt(l, lower) ? 1 : before;
        // os[1] != 0 is false while os[1] is na
        const isTop = v.lOs === 0 && !isNaN(before) && before !== 0;
        const isBtm = v.lOs === 1 && !isNaN(before) && before !== 1;
        if (isTop) v.lTx = i - len;
        if (isBtm) v.lBx = i - len;
        top = isTop ? h : NaN;
        btm = isBtm ? l : NaN;
      }
      // swings(shortLen)
      let stop: number;
      let sbtm: number;
      {
        const upper = s.sUpper.step(b.high);
        const lower = s.sLower.step(b.low);
        const before = v.sOs;
        const back = i >= shortLen ? bars[i - shortLen] : null;
        const h = back ? back.high : NaN;
        const l = back ? back.low : NaN;
        v.sOs = gt(h, upper) ? 0 : lt(l, lower) ? 1 : before;
        const isTop = v.sOs === 0 && !isNaN(before) && before !== 0;
        const isBtm = v.sOs === 1 && !isNaN(before) && before !== 1;
        if (isTop) v.sTx = i - shortLen;
        if (isBtm) v.sBx = i - shortLen;
        stop = isTop ? h : NaN;
        sbtm = isBtm ? l : NaN;
      }

      // plot(showCircles ? top : na, offset = -len): the swing confirmed on bar i is drawn on bar i - len (the only
      // writer of that slot; the last len bars keep na)
      s.plot0[i] = { time: b.time, value: NaN, color: highCss };
      s.plot1[i] = { time: b.time, value: NaN, color: lowCss };
      if (i - len >= 0) {
        const t = bars[i - len].time;
        s.plot0[i - len] = { time: t, value: cfg.showCircles ? top : NaN, color: highCss };
        s.plot1[i - len] = { time: t, value: cfg.showCircles ? btm : NaN, color: lowCss };
      }

      const osBefore = i > 0 ? v.os : NaN;
      const maxBefore = v.max;
      const minBefore = v.min;
      const topx = v.lTx;
      const btmx = v.lBx;
      const stopx = v.sTx;
      const sbtmx = v.sBx;

      // CHoCH detection
      if (truthy(top)) {
        v.topy = top;
        v.topCrossed = false;
      }
      if (truthy(btm)) {
        v.btmy = btm;
        v.btmCrossed = false;
      }
      if (gt(b.close, v.topy) && !v.topCrossed) {
        v.os = 1;
        v.topCrossed = true;
      }
      if (lt(b.close, v.btmy) && !v.btmCrossed) {
        v.os = 0;
        v.btmCrossed = true;
      }

      // os != os[1]
      if (!isNaN(osBefore) && v.os !== osBefore) {
        v.max = b.high;
        v.min = b.low;
        v.maxX1 = i;
        v.minX1 = i;
        v.stopCrossed = false;
        v.sbtmCrossed = false;
        if (v.os === 1 && cfg.showChoch) level(s, i, topx, v.topy, bullCss, 'dashed', 'CHoCH', 'label_down');
        else if (cfg.showChoch) level(s, i, btmx, v.btmy, bearCss, 'dashed', 'CHoCH', 'label_up');
      }

      if (!isNaN(stop)) v.stopy = stop;
      if (!isNaN(sbtm)) v.sbtmy = sbtm;

      // Bullish IDM and BOS
      if (lt(b.low, v.sbtmy) && !v.sbtmCrossed && v.os === 1 && ne(v.sbtmy, v.btmy)) {
        if (cfg.showIdm) level(s, i, sbtmx, v.sbtmy, idmCss, 'dotted', 'IDM', 'label_up');
        v.sbtmCrossed = true;
      }
      if (gt(b.close, v.max) && v.sbtmCrossed && v.os === 1) {
        if (cfg.showBos) level(s, i, v.maxX1, v.max, bullCss, 'solid', 'BOS', 'label_down');
        v.sbtmCrossed = false;
      }

      // Bearish IDM (always gray) and BOS
      if (gt(b.high, v.stopy) && !v.stopCrossed && v.os === 0 && ne(v.stopy, v.topy)) {
        if (cfg.showIdm) level(s, i, stopx, v.stopy, GRAY, 'dotted', 'IDM', 'label_down');
        v.stopCrossed = true;
      }
      if (lt(b.close, v.min) && v.stopCrossed && v.os === 0) {
        if (cfg.showBos) level(s, i, v.minX1, v.min, bearCss, 'solid', 'BOS', 'label_up');
        v.stopCrossed = false;
      }

      // Sweeps
      if (gt(b.high, v.max) && lt(b.close, v.max) && v.os === 1 && i - v.maxX1 > 1 && cfg.showSweeps) {
        level(s, i, v.maxX1, v.max, sweepsCss, 'dotted', 'x', 'label_down', false);
      }
      if (lt(b.low, v.min) && gt(b.close, v.min) && v.os === 0 && i - v.minX1 > 1 && cfg.showSweeps) {
        level(s, i, v.minX1, v.min, sweepsCss, 'dotted', 'x', 'label_up', false);
      }

      // Trailing max / min (math.max / math.min give na while max / min is na)
      v.max = isNaN(v.max) ? NaN : Math.max(b.high, v.max);
      v.min = isNaN(v.min) ? NaN : Math.min(b.low, v.min);
      if (gt(v.max, maxBefore)) v.maxX1 = i;
      if (lt(v.min, minBefore)) v.minX1 = i;
    },
    result(s, bars) {
      const n = bars.length;
      const v = s.vars;
      const lines: Ln[] = [];
      const labels: Lb[] = [];
      if (n > 0) {
        // Extensions: created on the first bar without coordinates, held by `var` variables (never deleted by the
        // limit of max_lines_count / max_labels_count, but they count)
        const extChoch: Ln = { x1: NaN, y1: NaN, x2: NaN, y2: NaN, color: DEFAULT_LINE, style: 'dashed' };
        const extBos: Ln = { x1: NaN, y1: NaN, x2: NaN, y2: NaN, color: DEFAULT_LINE, style: 'solid' };
        const extIdm: Ln = { x1: NaN, y1: NaN, x2: NaN, y2: NaN, color: idmCss, style: 'dotted' };
        const extChochLbl: Lb = { x: NaN, y: NaN, text: 'CHoCH', textColor: DEFAULT_TEXT, style: 'label_down', size: 'tiny' };
        const extBosLbl: Lb = { x: NaN, y: NaN, text: 'BOS', textColor: DEFAULT_TEXT, style: 'label_down', size: 'tiny' };
        const extIdmLbl: Lb = { x: NaN, y: NaN, text: 'IDM', textColor: idmCss, style: 'label_down', size: 'tiny' };

        // barstate.islast: the state at the end of the last bar
        const i = n - 1;
        const bull = v.os === 1;
        if (cfg.showChoch) {
          const [x, y, css] = bull ? [v.lBx, v.btmy, bearCss] : [v.lTx, v.topy, bullCss];
          Object.assign(extChoch, { x1: x, y1: y, x2: i, y2: y, color: css });
          Object.assign(extChochLbl, { x: i, y, style: bull ? 'label_up' : 'label_down', textColor: css });
        }
        if (cfg.showBos) {
          const [x, y, css] = bull ? [v.maxX1, v.max, bullCss] : [v.minX1, v.min, bearCss];
          Object.assign(extBos, { x1: x, y1: y, x2: i, y2: y, color: css });
          Object.assign(extBosLbl, { x: i, y, style: bull ? 'label_down' : 'label_up', textColor: css });
        }
        if (!(bull ? v.sbtmCrossed : v.stopCrossed) && cfg.showIdm) {
          const [x, y] = bull ? [v.sBx, v.sbtmy] : [v.sTx, v.stopy];
          Object.assign(extIdm, { x1: x, y1: y, x2: i + 15, y2: y, color: idmCss });
          Object.assign(extIdmLbl, { x: i + 15, y, style: bull ? 'label_up' : 'label_down', textColor: idmCss });
        } else {
          extIdm.color = null;
          extIdmLbl.textColor = null;
        }
        // the held ones first, then the newest of the others
        lines.push(extChoch, extBos, extIdm);
        labels.push(extChochLbl, extBosLbl, extIdmLbl);
        const keptLines = keptCount(3 + s.lines.length) - 3;
        const keptLabels = keptCount(3 + s.labels.length) - 3;
        for (let k = s.lines.length - keptLines; k < s.lines.length; k++) lines.push(s.lines[k]);
        for (let k = s.labels.length - keptLabels; k < s.labels.length; k++) labels.push(s.labels[k]);
      }

      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // an object with an na coordinate is not drawn
        lines: lines.filter((l) => !isNaN(l.x1) && !isNaN(l.x2) && !isNaN(l.y1) && !isNaN(l.y2)).map((l) => ({
          time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: l.color ?? 'transparent',
          ...(l.style !== 'solid' ? { style: l.style } : {}),
        })),
        labels: labels.filter((l) => !isNaN(l.x) && !isNaN(l.y)).map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: 'transparent', textColor: l.textColor ?? 'transparent', style: l.style,
          ...(l.size ? { size: l.size } : {}),
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketStructureWithInducementsSweepsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureWithInducementsSweepsInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MarketStructureWithInducementsSweeps = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
