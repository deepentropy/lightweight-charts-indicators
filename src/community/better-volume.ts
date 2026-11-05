/**
 * Better Volume Indicator
 *
 * Splits the volume of each bar into a buy part v1 and a sell part v2 from the true range and the open / close, then
 * builds 20 measures (volume, volume times range, volume per range, on one bar and on two bars). A bar is "climax
 * up" (red), "climax down" (white), "churn" (green), "climax churn" (dark magenta) or "low volume" (yellow) when one
 * of these measures is the highest or the lowest of the last `length` bars, else cyan. The volume columns take that
 * colour, with an SMA of the volume; with "enableBarColors" the bars are coloured instead and the two plots are
 * hidden.
 *
 * Version 1 plots have a default transparency of 35: the colours have an alpha of 0.65.
 *
 * Reference: "Better Volume Indicator [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BetterVolumeInputs {
  /** Lookback */
  length: number;
  enableBarColors: boolean;
  use2Bars: boolean;
  lowVol: boolean;
  climaxUp: boolean;
  climaxDown: boolean;
  churn: boolean;
  climaxChurn: boolean;
}

export const defaultInputs: BetterVolumeInputs = {
  length: 8,
  enableBarColors: false,
  use2Bars: true,
  lowVol: true,
  climaxUp: true,
  climaxDown: true,
  churn: true,
  climaxChurn: true,
};

// Untitled inputs keep their variable names as titles
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback', defval: 8 },
  { id: 'enableBarColors', type: 'bool', title: 'enableBarColors', defval: false },
  { id: 'use2Bars', type: 'bool', title: 'use2Bars', defval: true },
  { id: 'lowVol', type: 'bool', title: 'lowVol', defval: true },
  { id: 'climaxUp', type: 'bool', title: 'climaxUp', defval: true },
  { id: 'climaxDown', type: 'bool', title: 'climaxDown', defval: true },
  { id: 'churn', type: 'bool', title: 'churn', defval: true },
  { id: 'climaxChurn', type: 'bool', title: 'climaxChurn', defval: true },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const LOW_VOL_COLOR = V1('#FFFF00'); // yellow
const CLIMAX_UP_COLOR = V1('#FF0000'); // red
const CLIMAX_DOWN_COLOR = V1('#FFFFFF'); // white
const CHURN_COLOR = V1('#008000'); // green
const CLIMAX_CHURN_COLOR = V1('#8B008B');
const DEF_COLOR = V1('#00FFFF');
const ORANGE = V1('#FF7F00');

export const plotConfig: PlotConfig[] = [
  { id: 'vol', title: 'Volume', color: DEF_COLOR, lineWidth: 1, style: 'columns' },
  { id: 'sma', title: 'SMA', color: ORANGE, lineWidth: 2 },
];

export const metadata = {
  title: 'Better Volume Indicator [LazyBear]',
  shortTitle: 'BVI_LB',
  overlay: false,
};

/** Pine float comparisons within 1e-10 (na and +-infinity compare false for ==) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };
type Window = { step(value: number, length: number): number; commit(): void };

interface BviRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  hh2: Window;
  ll2: Window;
  /** ta.highest / ta.lowest of the measures, in the order of the measures used */
  win: Window[];
  sma: ReturnType<typeof taStep.sma>;
  v1: number[];
  v2: number[];
  v3: number[];
  volPlot: Point[];
  smaPlot: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<BetterVolumeInputs>): BarStudy<BviRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  const use2 = cfg.use2Bars;
  const show = !cfg.enableBarColors;
  // measures: lowest of v3, highest of v4..v7, lowest of v8..v11, highest of v12, lowest of v13, highest of v14, v15,
  // lowest of v16..v22
  const isHigh = [false, true, true, true, true, false, false, false, false, true, false, true, true, false, false, false, false, false, false, false];
  return {
    init() {
      const s: BviRun = {
        tr: taStep.tr(false), hh2: taStep.highest(), ll2: taStep.lowest(),
        win: isHigh.map((h) => (h ? taStep.highest() : taStep.lowest())), sma: taStep.sma(),
        v1: [], v2: [], v3: [], volPlot: [], smaPlot: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.tr, s.hh2, s.ll2, ...s.win, s.sma];
      s.lists = [s.barColors];
      s.series = [s.v1, s.v2, s.v3, s.volPlot, s.smaPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { open, close } = b;
      // range = tr (na on the first bar)
      const r = s.tr.step(b.high, b.low, close);
      const v = b.volume ?? NaN;
      const hh2 = s.hh2.step(b.high, 2);
      const ll2 = s.ll2.step(b.low, 2);
      // Operator precedence of the original kept as written (plain divisions: x / 0 is +-infinity, 0 / 0 na)
      const v1 = ge(close, open)
        ? v * (r / ((2 + (r * r) / 10) * r + (open - close)))
        : v * (((r + close - open) / (2 + (r * r) / 10)) * r + (close - open));
      const v2 = v - v1;
      const p1 = i > 0 ? s.v1[i - 1] : NaN;
      const p2 = i > 0 ? s.v2[i - 1] : NaN;
      const p3 = i > 0 ? s.v3[i - 1] : NaN;
      const v3 = v1 + v2;
      s.v1[i] = v1;
      s.v2[i] = v2;
      s.v3[i] = v3;
      const v4 = v1 * r;
      const v5 = (v1 - v2) * r;
      const v6 = v2 * r;
      const v7 = (v2 - v1) * r;
      // range != 0 is false when range is na
      const nz0 = !Number.isNaN(r) && r !== 0;
      const v8 = nz0 ? v1 / r : 1;
      const v9 = nz0 ? (v1 - v2) / r : 1;
      const v10 = nz0 ? v2 / r : 1;
      const v11 = nz0 ? (v2 - v1) / r : 1;
      const v12 = nz0 ? v3 / r : 1;
      const v13 = use2 ? v3 + p3 : 1;
      const r2 = hh2 - ll2;
      const v14 = use2 ? (v1 + p1) * r2 : 1;
      const v15 = use2 ? (v1 + p1 - v2 - p2) * r2 : 1;
      const v16 = use2 ? (v2 + p2) * r2 : 1;
      const v17 = use2 ? (v2 + p2 - v1 - p1) * r2 : 1;
      // highest(high, 2) != lowest(low, 2): false when one of them is na
      const two = use2 && !Number.isNaN(hh2) && !Number.isNaN(ll2) && !eq(hh2, ll2);
      const v18 = two ? (v1 + p1) / r2 : 1;
      const v19 = two ? (v1 + p1 - v2 - p2) / r2 : 1;
      const v20 = two ? (v2 + p2) / r2 : 1;
      const v21 = two ? (v2 + p2 - v1 - p1) / r2 : 1;
      const v22 = two ? v13 / r2 : 1;
      const w = s.win;
      const m = (k: number, x: number) => eq(x, w[k].step(x, len));
      const e3 = m(0, v3), e4 = m(1, v4), e5 = m(2, v5), e6 = m(3, v6), e7 = m(4, v7), e8 = m(5, v8), e9 = m(6, v9);
      const e10 = m(7, v10), e11 = m(8, v11), e12 = m(9, v12), e13 = m(10, v13), e14 = m(11, v14), e15 = m(12, v15);
      const e16 = m(13, v16), e17 = m(14, v17), e18 = m(15, v18), e19 = m(16, v19), e20 = m(17, v20), e21 = m(18, v21);
      const e22 = m(19, v22);
      const sma = s.sma.step(v, len);

      const up = gt(close, open);
      const dn = gt(open, close);
      const up1 = i > 0 && gt(bars[i - 1].close, bars[i - 1].open);
      const dn1 = i > 0 && gt(bars[i - 1].open, bars[i - 1].close);
      const c1 = e3;
      const c2 = e4 && up;
      const c3 = e5 && up;
      const c4 = e6 && dn;
      const c5 = e7 && dn;
      const c6 = e8 && dn;
      const c7 = e9 && dn;
      const c8 = e10 && up;
      const c9 = e11 && up;
      const c10 = e12;
      const c11 = use2 && e13 && up && up1;
      const c12 = use2 && e14 && up && up1;
      const c13 = use2 && e15 && up && dn1;
      const c14 = use2 && e16 && dn && dn1;
      const c15 = use2 && e17 && dn && dn1;
      const c16 = use2 && e18 && dn && dn1;
      const c17 = use2 && e19 && up && dn1;
      const c18 = use2 && e20 && up && up1;
      const c19 = use2 && e21 && up && up1;
      const c20 = use2 && e22;

      // (churn and c10 or c20) is ((churn and c10) or c20)
      const c0 = cfg.climaxUp && (c2 || c3 || c8 || c9 || c12 || c13 || c18 || c19)
        ? CLIMAX_UP_COLOR
        : cfg.climaxDown && (c4 || c5 || c6 || c7 || c14 || c15 || c16 || c17)
          ? CLIMAX_DOWN_COLOR
          : (cfg.churn && c10) || c20 ? CHURN_COLOR : DEF_COLOR;
      const vColor = cfg.climaxChurn && (c10 || c20) && (c2 || c3 || c4 || c5 || c6 || c7 || c8 || c9)
        ? CLIMAX_CHURN_COLOR
        : cfg.lowVol && (c1 || c11) ? LOW_VOL_COLOR : c0;

      s.volPlot[i] = { time: b.time, value: show ? v : NaN, color: vColor };
      s.smaPlot[i] = { time: b.time, value: show ? sma : NaN };
      if (cfg.enableBarColors) s.barColors.push({ time: b.time, color: vColor });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { vol: s.volPlot.slice(), sma: s.smaPlot.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BetterVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BetterVolumeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BetterVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
