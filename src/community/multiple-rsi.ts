/**
 * Multiple RSI
 *
 * Three RSI lines of the close (fast, medium, slow lengths). The fast line is green when it is at or above the medium
 * line (else yellow), the medium line blue when it is at or above the slow line (else orange), the slow line aqua when
 * the three lines are in order fast >= medium >= slow (else red). Triangles at the bottom of the pane mark the
 * crossovers / crossunders of the medium line and the slow line. Dotted lines at the overbought, 50 and oversold
 * levels with a light fill between them.
 *
 * Reference: "Multiple RSI" by PrasadJoshi12
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PrasadJoshi12
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MultipleRsiInputs {
  /** Fast RSI length */
  fastRSILength: number;
  /** Medium RSI length */
  mediumRSILength: number;
  /** Slow RSI length */
  slowRSILength: number;
  /** Overbought level (hline) */
  overBoughtLevel: number;
  /** Oversold level (hline) */
  overSoldLevel: number;
  /** Dark theme: gray level lines (else black) */
  darkTheme: boolean;
}

export const defaultInputs: MultipleRsiInputs = {
  fastRSILength: 8,
  mediumRSILength: 12,
  slowRSILength: 16,
  overBoughtLevel: 70,
  overSoldLevel: 30,
  darkTheme: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastRSILength', type: 'int', title: 'Fast RSI', defval: 8 },
  { id: 'mediumRSILength', type: 'int', title: 'Medium RSI', defval: 12 },
  { id: 'slowRSILength', type: 'int', title: 'Slow RSI', defval: 16 },
  { id: 'overBoughtLevel', type: 'int', title: 'Default Overbought level', defval: 70 },
  { id: 'overSoldLevel', type: 'int', title: 'Default Oversold level', defval: 30 },
  { id: 'darkTheme', type: 'bool', title: 'Is Dark Theme', defval: true },
];

// display = display.all - display.status_line on every plot (drawn in the pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast RSI', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Midum RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'Slow RSI', color: color.aqua, lineWidth: 1 },
];

/** hline(70 / 50 / 30, color = gray (dark theme), linestyle = dotted) with the default inputs */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, title: 'Overbought Level', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_mid', price: 50, title: 'Middle Level', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_os', price: 30, title: 'Oversold Level', color: color.gray, linestyle: 'dotted' },
];

const FILL_COLOR = String(color.new('#cc8cb3', 90));

/** fill(hline_30, hline_50) and fill(hline_50, hline_70), color.new(#cc8cb3, 90) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_low', plot1: 'hline_os', plot2: 'hline_mid', color: FILL_COLOR, title: 'Hlines Background' },
  { id: 'fill_high', plot1: 'hline_mid', plot2: 'hline_ob', color: FILL_COLOR, title: 'Hlines Background' },
];

export const metadata = {
  title: 'Multiple RSI',
  shortTitle: 'MultiRSI',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color: string };
type Rsi = ReturnType<typeof taStep.rsi>;

interface MrsiVars {
  prevMedium: number;
  prevSlow: number;
}

interface MrsiRun extends BarRunState<MrsiVars> {
  rsiFast: Rsi;
  rsiMedium: Rsi;
  rsiSlow: Rsi;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<MultipleRsiInputs>): BarStudy<MrsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsiFast = taStep.rsi(cfg.fastRSILength);
      const rsiMedium = taStep.rsi(cfg.mediumRSILength);
      const rsiSlow = taStep.rsi(cfg.slowRSILength);
      // ta.crossover / ta.crossunder compare exactly (no 1e-10), with the last bar where both values were not na
      const st: MrsiRun = {
        rsiFast, rsiMedium, rsiSlow, plot0: [], plot1: [], plot2: [], markers: [],
        steps: [rsiFast, rsiMedium, rsiSlow], vars: { prevMedium: NaN, prevSlow: NaN }, lists: [], series: [],
      };
      st.lists = [st.markers];
      st.series = [st.plot0, st.plot1, st.plot2];
      return st;
    },
    bar(st, i, bars) {
      const v = st.vars;
      const close = bars[i].close;
      const f = st.rsiFast.step(close);
      const m = st.rsiMedium.step(close);
      const s = st.rsiSlow.step(close);
      const fastUp = ge(f, m);
      const mediumUp = ge(m, s);
      const slowUp = ge(f, m) && ge(m, s) && ge(f, s);
      const t = bars[i].time;
      st.plot0[i] = { time: t, value: f, color: fastUp ? color.green : color.yellow };
      st.plot1[i] = { time: t, value: m, color: mediumUp ? color.blue : color.orange };
      st.plot2[i] = { time: t, value: s, color: slowUp ? color.aqua : color.red };

      if (!isNaN(m) && !isNaN(s)) {
        const crossedOver = m > s && v.prevMedium <= v.prevSlow;
        const crossedUnder = m < s && v.prevMedium >= v.prevSlow;
        // plotshape(..., style = shape.triangleup / triangledown, location = location.bottom, size = size.tiny)
        if (crossedOver) st.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: color.fuchsia, size: 'tiny' });
        if (crossedUnder) st.markers.push({ time: t, position: 'bottom', shape: 'triangleDown', color: color.red, size: 'tiny' });
        v.prevMedium = m;
        v.prevSlow = s;
      }
    },
    result(st) {
      // var HlineColor = DarkTheme ? color.gray : color.black
      const hlineColor = cfg.darkTheme ? color.gray : color.black;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: st.plot0.slice(), plot1: st.plot1.slice(), plot2: st.plot2.slice() },
        hlines: [
          { value: cfg.overBoughtLevel, options: { title: 'Overbought Level', color: hlineColor, linestyle: 'dotted' } },
          { value: 50, options: { title: 'Middle Level', color: hlineColor, linestyle: 'dotted' } },
          { value: cfg.overSoldLevel, options: { title: 'Oversold Level', color: hlineColor, linestyle: 'dotted' } },
        ],
        fills: [
          { plot1: 'hline_os', plot2: 'hline_mid', options: { title: 'Hlines Background', color: FILL_COLOR } },
          { plot1: 'hline_mid', plot2: 'hline_ob', options: { title: 'Hlines Background', color: FILL_COLOR } },
        ],
        markers: st.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MultipleRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MultipleRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MultipleRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
