/**
 * Auto Trendline Indicator (based on fractals) [DojiEmoji]
 *
 * Automatically draws trend lines by connecting consecutive fractals (pivot highs/lows).
 * Detects HH/HL/LH/LL patterns from consecutive fractals and plots markers.
 * Recent lines are colored purple, historical lines are gray.
 * Optional markers where the close crosses the most recent upper/lower trendline.
 * Alerts (alertcondition, `alerts` of the result): 'New trendline formed' (a new fractal) and 'Upper/lower trendline
 * crossed' (the close crosses one of the two most recent trendlines, whether the crosses are shown or not).
 *
 * Reference: "Auto Trendline [DojiEmoji]" (community, Pine v5)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AutoTrendlineInputs {
  fractalPeriod: number;
  colHL: string;
  showHL: boolean;
  colLL: string;
  showLL: boolean;
  colLH: string;
  showLH: boolean;
  colHH: string;
  showHH: boolean;
  lnColRecent: string;
  lnWidthRecent: string;
  lnColPrev: string;
  lnWidthPrev: string;
  maxPairs: number;
  extend: string;
  showCrosses: boolean;
}

// Pine v5 colours: color.blue #2962FF, color.gray #787B86, color.red #FF5252,
// color.purple #9C27B0
export const defaultInputs: AutoTrendlineInputs = {
  fractalPeriod: 10,
  colHL: '#2962FF',
  showHL: true,
  colLL: '#787B86',
  showLL: false,
  colLH: '#FF5252',
  showLH: true,
  colHH: '#787B86',
  showHH: false,
  lnColRecent: '#9C27B0',
  lnWidthRecent: 'Width 1',
  lnColPrev: 'rgba(120,123,134,0.5)',
  lnWidthPrev: 'Width 1',
  maxPairs: 1,
  extend: 'Right',
  showCrosses: false,
};

const WIDTHS = ['Width 1', 'Width 2'];

export const inputConfig: InputConfig[] = [
  { id: 'fractalPeriod', type: 'int', title: 'Fractal Period', defval: 10, min: 2 },
  { id: 'colHL', type: 'color', title: 'Plot: HL', defval: '#2962FF' },
  { id: 'showHL', type: 'bool', title: 'HL', defval: true },
  { id: 'colLL', type: 'color', title: 'Plot: LL', defval: '#787B86' },
  { id: 'showLL', type: 'bool', title: 'LL', defval: false },
  { id: 'colLH', type: 'color', title: 'Plot: LH', defval: '#FF5252' },
  { id: 'showLH', type: 'bool', title: 'LH', defval: true },
  { id: 'colHH', type: 'color', title: 'Plot: HH', defval: '#787B86' },
  { id: 'showHH', type: 'bool', title: 'HH', defval: false },
  { id: 'lnColRecent', type: 'color', title: 'Recent Line', defval: '#9C27B0' },
  // Pine title '' (same inline row as 'Recent Line')
  { id: 'lnWidthRecent', type: 'string', title: 'Recent Line Width', defval: 'Width 1', options: WIDTHS },
  { id: 'lnColPrev', type: 'color', title: 'Historical Line', defval: 'rgba(120,123,134,0.5)' },
  { id: 'lnWidthPrev', type: 'string', title: 'Historical Line Width', defval: 'Width 1', options: WIDTHS },
  { id: 'maxPairs', type: 'int', title: 'Max pair of lines', defval: 1, min: 1, max: 250 },
  { id: 'extend', type: 'string', title: 'Which way to extend lines', defval: 'Right', options: ['Right', 'Both ways'] },
  { id: 'showCrosses', type: 'bool', title: 'Show crosses', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Trendline [DojiEmoji]',
  shortTitle: 'AutoTL',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TrendLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface AtlVars {
  // var recent_dn1/up1/dn2/up2 and their bar indexes
  recentDn1: number;
  iRecentDn1: number;
  recentDn2: number;
  iRecentDn2: number;
  recentUp1: number;
  iRecentUp1: number;
  recentUp2: number;
  iRecentUp2: number;
  yUpPrev: number;
  yDnPrev: number;
}

interface AtlRun extends BarRunState<AtlVars> {
  phStep: PivotStep;
  plStep: PivotStep;
  phArr: number[];
  plArr: number[];
  upLines: TrendLine[];
  downLines: TrendLine[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** Pine: plotshape(..., style = shape.circle, size = size.tiny, color = na, textcolor = col): only the text */
function marker(markers: MarkerData[], bars: Bar[], id: string, bar: number, text: string, above: boolean, color: string): void {
  if (bar < 0) return;
  markers.push({
    id, time: bars[bar].time, position: above ? 'aboveBar' : 'belowBar', shape: 'circle',
    color: 'transparent', text, textColor: color, size: 'tiny',
  });
}

function study(inputs: Partial<AutoTrendlineInputs>): BarStudy<AtlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { fractalPeriod: nPeriod, maxPairs } = cfg;
  const extendDir: 'right' | 'both' = cfg.extend === 'Both ways' ? 'both' : 'right';
  const widthOf = (s: string) => (s === 'Width 2' ? 2 : 1);
  const widthRecent = widthOf(cfg.lnWidthRecent);
  const widthPrev = widthOf(cfg.lnWidthPrev);
  return {
    init() {
      // Pine: ph = ta.pivothigh(n, n)[1]: the value appears on the confirmation bar (pivot bar + n) and [1] shifts it
      // one more bar. The fractal is at bar_index - n - 1 with price high[n + 1] / low[n + 1].
      const phStep = new PivotStep(nPeriod, nPeriod, true);
      const plStep = new PivotStep(nPeriod, nPeriod, false);
      const s: AtlRun = {
        phStep, plStep, phArr: [], plArr: [], upLines: [], downLines: [], markers: [], flags: [[], []], times: [[], []],
        steps: [phStep, plStep],
        vars: {
          recentDn1: NaN, iRecentDn1: NaN, recentDn2: NaN, iRecentDn2: NaN,
          recentUp1: NaN, iRecentUp1: NaN, recentUp2: NaN, iRecentUp2: NaN,
          yUpPrev: NaN, yDnPrev: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.upLines, s.downLines, s.markers, ...s.times];
      s.series = [s.phArr, s.plArr, ...s.flags];
      return s;
    },
    bar(s, t, bars) {
      const v = s.vars;
      const markers = s.markers;
      s.phArr[t] = s.phStep.step(t, bars[t].high);
      s.plArr[t] = s.plStep.step(t, bars[t].low);
      const ph = t >= 1 ? s.phArr[t - 1] ?? NaN : NaN;
      const pl = t >= 1 ? s.plArr[t - 1] ?? NaN : NaN;
      const upfract = !Number.isNaN(ph);
      const downfract = !Number.isNaN(pl);
      const fractBar = t - nPeriod - 1;
      // alertcondition(not na(ph) or not na(pl), "New trendline formed")
      const newFlag = upfract || downfract;

      if (downfract) {
        v.recentDn2 = v.recentDn1; v.iRecentDn2 = v.iRecentDn1;
        v.recentDn1 = bars[fractBar].low; v.iRecentDn1 = fractBar;
        s.downLines.push({ x1: v.iRecentDn2, y1: v.recentDn2, x2: v.iRecentDn1, y2: v.recentDn1 });
      }
      if (upfract) {
        v.recentUp2 = v.recentUp1; v.iRecentUp2 = v.iRecentUp1;
        v.recentUp1 = bars[fractBar].high; v.iRecentUp1 = fractBar;
        s.upLines.push({ x1: v.iRecentUp2, y1: v.recentUp2, x2: v.iRecentUp1, y2: v.recentUp1 });
      }

      // Comparisons with na are false: no marker for the first fractal nor for two equal fractals
      const hh = upfract && v.recentUp1 > v.recentUp2;
      const lh = upfract && v.recentUp1 < v.recentUp2;
      const hl = downfract && v.recentDn1 > v.recentDn2;
      const ll = downfract && v.recentDn1 < v.recentDn2;
      // plotshape(..., offset = -n - 1)
      if (cfg.showHH && hh) marker(markers, bars, 'shape0', fractBar, 'HH', true, cfg.colHH);
      if (cfg.showLH && lh) marker(markers, bars, 'shape1', fractBar, 'LH', true, cfg.colLH);
      if (cfg.showLL && ll) marker(markers, bars, 'shape2', fractBar, 'LL', false, cfg.colLL);
      if (cfg.showHL && hl) marker(markers, bars, 'shape3', fractBar, 'HL', false, cfg.colHL);

      // Price of the line through the two most recent fractals at the current bar, then ta.cross(close, y)
      const mDn = (v.recentDn2 - v.recentDn1) / (v.iRecentDn2 - v.iRecentDn1);
      const yDn = mDn * t + v.recentDn1 - mDn * v.iRecentDn1;
      const mUp = (v.recentUp2 - v.recentUp1) / (v.iRecentUp2 - v.iRecentUp1);
      const yUp = mUp * t + v.recentUp1 - mUp * v.iRecentUp1;
      let crossUpper = false, crossLower = false;
      if (t >= 1) {
        const c = bars[t].close;
        const c1 = bars[t - 1].close;
        // ta.cross: na operands give false; exact comparisons (ta.cross does not use the 1e-10 tolerance)
        const cross = (y: number, y1: number) =>
          !Number.isNaN(y) && !Number.isNaN(y1) && ((c > y && c1 <= y1) || (c < y && c1 >= y1));
        crossUpper = cross(yUp, v.yUpPrev);
        crossLower = cross(yDn, v.yDnPrev);
      }
      // alertcondition(cross_upper or cross_lower, "Upper/lower trendline crossed")
      const crossFlag = crossUpper || crossLower;
      if (cfg.showCrosses && crossUpper) {
        markers.push({ id: 'shape4', time: bars[t].time, position: 'belowBar', shape: 'xcross', color: 'rgba(41,98,255,0.5)', size: 'small' });
      }
      if (cfg.showCrosses && crossLower) {
        markers.push({ id: 'shape5', time: bars[t].time, position: 'aboveBar', shape: 'xcross', color: 'rgba(255,82,82,0.5)', size: 'small' });
      }
      v.yUpPrev = yUp;
      v.yDnPrev = yDn;

      s.flags[0][t] = newFlag;
      s.flags[1][t] = crossFlag;
      if (newFlag) s.times[0].push(bars[t].time as number);
      if (crossFlag) s.times[1].push(bars[t].time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const markers = s.markers.slice().sort((a, b) => a.time - b.time);

      // drop_and_roll: keep max_tl / 2 = maxPairs lines per side; the newest has the recent colour and width
      const lines: LineDrawingData[] = [];
      const addLines = (all: TrendLine[]) => {
        const kept = all.slice(-maxPairs);
        kept.forEach((tl, i) => {
          // A line from the first fractal has no older end (na): it is not drawn
          if (Number.isNaN(tl.x1)) return;
          const isRecent = i === kept.length - 1;
          lines.push({
            time1: bars[tl.x1].time,
            price1: tl.y1,
            time2: bars[tl.x2].time,
            price2: tl.y2,
            color: isRecent ? cfg.lnColRecent : cfg.lnColPrev,
            width: isRecent ? widthRecent : widthPrev,
            style: 'dashed',
            extend: extendDir,
          });
        });
      };
      addLines(s.upLines);
      addLines(s.downLines);

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines,
        markers,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoTrendlineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoTrendlineInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New trendline formed', message: 'New trendline formed' },
  { id: 'alert1', title: 'Upper/lower trendline crossed', message: 'Upper/lower trendline crossed' },
];

export const AutoTrendline = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
