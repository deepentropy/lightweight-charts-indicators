/**
 * Pivot Levels [BigBeluga]
 *
 * Draws the latest pivot high and pivot low levels of four pivot lengths (5, 25, 50 and 100 bars on each side by
 * default) on the last bar:
 * - Each level is a line from its pivot bar to the last bar (extended both ways or to the right) with a wide,
 *   transparent copy behind it. Width grows with the pivot length (1 / 2 / 3 / 4, glow 3 / 7 / 10 / 15).
 * - Colour: support (green) when the low of the last bar is more than 1.5 x ATR(200) above the level, resistance
 *   (orange) when the high is more than that below it, else active (blue).
 * - A label 15 bars to the right of the last bar: price | volume of the 2 x length bars up to the bar that confirmed
 *   the pivot | that volume as a share of the volumes of all shown levels.
 *
 * Notes on the port:
 * - The label background is the chart background (chart context, dark theme colour without it).
 * - Bar indexes are counted from the first bar the port gets.
 *
 * Reference: "Pivot Levels [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  taStep, math, str, color, Series,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';
import { backgroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type LineStyleInput = '--' | '-' | '..';
type ExtendInput = 'Both' | 'Right';

export interface PivotLevelsInputs {
  /** Show the pivot 1 levels */
  pivot1: boolean;
  /** Pivot 1 length (bars on each side) */
  len1: number;
  style1: LineStyleInput;
  extendM1: ExtendInput;
  pivot2: boolean;
  len2: number;
  style2: LineStyleInput;
  extendM2: ExtendInput;
  pivot3: boolean;
  len3: number;
  style3: LineStyleInput;
  extendM3: ExtendInput;
  pivot4: boolean;
  len4: number;
  style4: LineStyleInput;
  extendM4: ExtendInput;
  /** Support colour */
  colorSup: string;
  /** Resistance colour */
  colorRes: string;
  /** Active level colour */
  colorActive: string;
}

export const defaultInputs: PivotLevelsInputs = {
  pivot1: true,
  len1: 5,
  style1: '--',
  extendM1: 'Both',
  pivot2: true,
  len2: 25,
  style2: '-',
  extendM2: 'Both',
  pivot3: true,
  len3: 50,
  style3: '-',
  extendM3: 'Both',
  pivot4: true,
  len4: 100,
  style4: '-',
  extendM4: 'Both',
  colorSup: 'rgb(30, 214, 125)',
  colorRes: '#eb7c14',
  colorActive: 'rgb(27, 133, 255)',
};

const STYLES: LineStyleInput[] = ['--', '-', '..'];
const EXTENDS: ExtendInput[] = ['Both', 'Right'];
const levelInputs = (k: number, len: number, style: LineStyleInput): InputConfig[] => [
  { id: `pivot${k}`, type: 'bool', title: `Pivot ${k}`, defval: true, inline: String(k) },
  { id: `len${k}`, type: 'int', title: '', defval: len, inline: String(k) },
  { id: `style${k}`, type: 'string', title: 'Style:', defval: style, options: STYLES, inline: String(k) },
  { id: `extendM${k}`, type: 'string', title: 'Extend:', defval: 'Both', options: EXTENDS, inline: String(k) },
];

export const inputConfig: InputConfig[] = [
  ...levelInputs(1, 5, '--'),
  ...levelInputs(2, 25, '-'),
  ...levelInputs(3, 50, '-'),
  ...levelInputs(4, 100, '-'),
  { id: 'colorSup', type: 'color', title: '', defval: 'rgb(30, 214, 125)', inline: 'colors' },
  { id: 'colorRes', type: 'color', title: '', defval: '#eb7c14', inline: 'colors' },
  { id: 'colorActive', type: 'color', title: '', defval: 'rgb(27, 133, 255)', inline: 'colors' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Pivot Levels [BigBeluga]',
  shortTitle: 'Pivot Levels [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** The latest pivot of one side: price, pivot bar, volume sum (ta.valuewhen(..., 0) of the script) */
interface PivotValue { level: number; start: number; vol: number }

type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] };

interface PivotLevelsVars {
  /** ta.valuewhen(not na(pivot), x, 0) of each level: [high side, low side] */
  latest: PivotValue[][];
  /** ATR(200) of the last bar */
  atr: number;
}

interface PivotLevelsRun extends BarRunState<PivotLevelsVars> {
  ph: PivotStep[];
  pl: PivotStep[];
  vols: WindowSum[];
  atr: ReturnType<typeof taStep.atr>;
}

const NO_PIVOT: PivotValue = { level: NaN, start: NaN, vol: NaN };

function study(inputs: Partial<PivotLevelsInputs>): BarStudy<PivotLevelsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lens = [cfg.len1, cfg.len2, cfg.len3, cfg.len4].map((v) => Math.trunc(v));
  return {
    init() {
      const ph = lens.map((len) => new PivotStep(len, len, true));
      const pl = lens.map((len) => new PivotStep(len, len, false));
      const vols = lens.map((len) => new WindowSum(len * 2));
      const atr = taStep.atr(200);
      return {
        ph, pl, vols, atr,
        steps: [...ph, ...pl, ...vols, atr],
        vars: { latest: lens.map(() => [NO_PIVOT, NO_PIVOT]), atr: NaN },
        lists: [], series: [],
      };
    },
    copyVars: (v) => ({ latest: v.latest.map((x) => x.slice()), atr: v.atr }),
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      v.atr = s.atr.step(b.high, b.low, b.close);
      // the length check of math.sum(volume, len * 2) (the same runtime error; WindowSum has none)
      if (i === 0) for (const len of lens) math.sum(new Series([], () => NaN), len * 2);
      for (let k = 0; k < 4; k++) {
        const len = lens[k];
        const vol = s.vols[k].step(b.volume ?? NaN);
        const h = s.ph[k].step(i, b.high);
        const l = s.pl[k].step(i, b.low);
        const j = i - len;
        if (!Number.isNaN(h)) v.latest[k][0] = { level: j >= 0 ? bars[j].high : NaN, start: j >= 0 ? j : NaN, vol };
        if (!Number.isNaN(l)) v.latest[k][1] = { level: j >= 0 ? bars[j].low : NaN, start: j >= 0 ? j : NaN, vol };
      }
    },
    result(s, bars, chart) {
      const n = bars.length;
      const result = { metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay }, plots: {} };
      if (n === 0) return { ...result, lines: [], labels: [] };
      const L = n - 1;
      const atr = s.vars.atr * 1.5;

      const levels = [1, 2, 3, 4].map((k) => {
        const len = lens[k - 1];
        const [H, Lo] = s.vars.latest[k - 1];
        return {
          len, H, L: Lo,
          display: cfg[`pivot${k}` as 'pivot1'],
          style: cfg[`style${k}` as 'style1'],
          extend: cfg[`extendM${k}` as 'extendM1'] === 'Both',
        };
      });
      // barstate.islast: total volume of the shown levels
      let tot = 0;
      for (const l of levels) if (l.display) tot += l.H.vol + l.L.vol;

      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      const bg = backgroundColorOf(chart);
      const lastLow = bars[L].low;
      const lastHigh = bars[L].high;
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      for (const l of levels) {
        if (!l.display) continue;
        const style = l.style === '--' ? 'dashed' : l.style === '..' ? 'dotted' : 'solid';
        const [len1, len2, len3] = lens;
        const width1 = l.len === len1 ? 1 : l.len === len2 ? 2 : l.len === len3 ? 3 : 4;
        const width2 = l.len === len1 ? 3 : l.len === len2 ? 7 : l.len === len3 ? 10 : 15;
        const H = l.H.level;
        const Lv = l.L.level;
        const color1 = gt(lastLow, H + atr) ? cfg.colorSup : lt(lastHigh, H - atr) ? cfg.colorRes : cfg.colorActive;
        const color2 = gt(lastLow, Lv + atr) ? cfg.colorSup : lt(lastHigh, Lv - atr) ? cfg.colorRes : cfg.colorActive;
        const extend = l.extend ? 'both' : 'right';
        const ln = (start: number, price: number, col: string, width: number, st: 'dashed' | 'dotted' | 'solid') => {
          // a line with an na coordinate is not drawn
          if (Number.isNaN(start) || Number.isNaN(price)) return;
          lines.push({
            time1: T(start), price1: price, time2: T(L), price2: price, color: col, width, extend,
            ...(st === 'solid' ? {} : { style: st }),
          });
        };
        ln(l.H.start, H, color1, width1, style);
        ln(l.L.start, Lv, color2, width1, style);
        ln(l.H.start, H, String(color.new(color1, 80)), width2, 'solid');
        ln(l.L.start, Lv, String(color.new(color2, 80)), width2, 'solid');
        const lbl = (price: number, vol: number, col: string) => {
          if (Number.isNaN(price)) return;
          labels.push({
            time: T(L + 15), price,
            text: `${str.tostring(price)} | ${str.tostring(vol, 'volume')} | ${str.tostring((vol / tot) * 100, 'percent')}`,
            textColor: col, color: bg, style: 'label_center', size: 'normal',
            tooltip: 'Price | Volume | Volume Distribution %',
          });
        };
        lbl(H, l.H.vol, color1);
        lbl(Lv, l.L.vol, color2);
      }

      return { ...result, lines, labels };
    },
  };
}


/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PivotLevelsInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const PivotLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
