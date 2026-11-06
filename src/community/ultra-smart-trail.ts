/**
 * Ultra Smart Trail
 *
 * Trend Flow Line (TFL) = (2 * HMA + DWMA) / 3 of the close. The HMA length is int(length * 100 / 24 * 20 / 100)
 * (20 for a length of 24): wma(2 * wma(close, hmaLen / 2) - wma(close, hmaLen), floor(sqrt(hmaLen))). The DWMA is
 * wma(wma(close, w2), w1) with w1 = round(length / 3) and w2 = round((length - w1) / 3).
 * Two zones around the TFL: TFL +- multiplier * stdev(close, length) (inner and outer multipliers). In an uptrend
 * (TFL above its value `smooth` bars ago) the lower zone is drawn while the previous close is above the outer lower
 * band; otherwise the upper zone is drawn while the previous close is below the outer upper band. Gradient fills fill
 * each zone. The TFL is bullish when the close is at or above it in an uptrend, bearish when the close is at or below
 * it and not in an uptrend, else neutral.
 *
 * Reference: "Ultra Smart Trail" by Rathack
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Rathack
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UltraSmartTrailInputs {
  /** Show the Trend Flow Line */
  showTfl: boolean;
  /** TFL and standard deviation length */
  length: number;
  /** Lookback of the trend condition (TFL vs TFL `smooth` bars ago) */
  smooth: number;
  /** Multiplier of the inner deviation zone */
  multiplier1: number;
  /** Multiplier of the outer deviation zone */
  multiplier2: number;
  bullColor: string;
  bearColor: string;
  baseColor: string;
}

export const defaultInputs: UltraSmartTrailInputs = {
  showTfl: true,
  length: 24,
  smooth: 9,
  multiplier1: 0.618,
  multiplier2: 1.0,
  bullColor: '#0084ff',
  bearColor: '#ff9100',
  baseColor: '#787b86',
};

export const inputConfig: InputConfig[] = [
  { id: 'showTfl', type: 'bool', title: 'Trend Flow Line', defval: true },
  { id: 'length', type: 'int', title: 'Length', defval: 24, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 9, min: 1 },
  { id: 'multiplier1', type: 'float', title: 'Multiplier (inner)', defval: 0.618, min: 0.01, step: 0.05 },
  { id: 'multiplier2', type: 'float', title: 'Multiplier', defval: 1.0, min: 0.01, step: 0.05 },
  { id: 'bullColor', type: 'color', title: 'Bullish', defval: '#0084ff' },
  { id: 'bearColor', type: 'color', title: 'Bearish', defval: '#ff9100' },
  { id: 'baseColor', type: 'color', title: 'Base', defval: '#787b86' },
];

// display = display.all - display.status_line on every plot (drawn in the pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Level Upper 2', color: String(color.new('#ff9100', 50)), lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Level Lower 2', color: String(color.new('#0084ff', 50)), lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Level Upper', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Level Lower', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Trend Flow Line', color: '#787b86', lineWidth: 3 },
];

export const metadata = {
  title: 'Ultra Smart Trail',
  shortTitle: 'Ultra Smart Trail',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };

interface TrailRun extends BarRunState<Record<string, never>> {
  wHalf: WmaStepT;
  wFull: WmaStepT;
  hma: WmaStepT;
  dw2: WmaStepT;
  dw1: WmaStepT;
  sd: WindowStdev;
  tfl: number[];
  close: number[];
  upper1: number[];
  lower1: number[];
  upper2: number[];
  lower2: number[];
  plots: Point[][];
}

type WmaStepT = ReturnType<typeof taStep.wma>;

function study(inputs: Partial<UltraSmartTrailInputs>): BarStudy<TrailRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.length;
  const na = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);

  // _calcTrendFlowLine(close, iLength)
  const hmaLen = Math.trunc(((((L * 100) / 24) * 20) / 100));
  const w1 = Math.round(L / 3);
  const w2 = Math.round((L - w1) / 3);

  const bearHalf = String(color.new(cfg.bearColor, 50));
  const bullHalf = String(color.new(cfg.bullColor, 50));
  const bearClear = String(color.new(cfg.bearColor, 100));
  const bullClear = String(color.new(cfg.bullColor, 100));
  const bear80 = String(color.new(cfg.bearColor, 80));
  const bull80 = String(color.new(cfg.bullColor, 80));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    init() {
      // the length checks in the order of the original calls (wma, wma, wma, wma, wma, stdev)
      for (const len of [hmaLen / 2, hmaLen, Math.floor(Math.sqrt(hmaLen)), w2, w1]) taCore.wma([], len);
      const s: TrailRun = {
        wHalf: taStep.wma(), wFull: taStep.wma(), hma: taStep.wma(), dw2: taStep.wma(), dw1: taStep.wma(),
        sd: new WindowStdev(L), tfl: [], close: [], upper1: [], lower1: [], upper2: [], lower2: [], plots: Array.from({ length: 5 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.wHalf, s.wFull, s.hma, s.dw2, s.dw1, s.sd];
      s.series = [s.tfl, s.close, s.upper1, s.lower1, s.upper2, s.lower2, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const c = bars[i].close;
      s.close[i] = c;
      const diff = 2 * na(s.wHalf.step(c, hmaLen / 2)) - na(s.wFull.step(c, hmaLen));
      const hma = s.hma.step(diff, Math.floor(Math.sqrt(hmaLen)));
      const dwma = s.dw1.step(s.dw2.step(c, w2), w1);
      // math.avg(fHma_, fDwma_, fHma_)
      const tfl = (na(hma) + na(dwma) + na(hma)) / 3;
      s.tfl[i] = tfl;

      const sd = s.sd.step(c);
      const dev1 = cfg.multiplier1 * na(sd);
      const dev2 = cfg.multiplier2 * na(sd);
      const upper1 = tfl + dev1;
      const lower1 = tfl - dev1;
      const upper2 = tfl + dev2;
      const lower2 = tfl - dev2;
      s.upper1[i] = upper1;
      s.lower1[i] = lower1;

      const past = i - cfg.smooth >= 0 ? s.tfl[i - cfg.smooth] : NaN;
      // bUptrend = fTfl > fTfl[iSmooth]
      const up = gt(tfl, past);
      const tflColor = ge(c, tfl) && up ? cfg.bullColor : le(c, tfl) && !up ? cfg.bearColor : cfg.baseColor;
      const prevClose = i > 0 ? s.close[i - 1] : NaN;
      const notTooLow = gt(prevClose, lower2);
      const notTooHigh = lt(prevClose, upper2);
      const p = s.plots;
      p[0][i] = { time: t, value: !up && notTooHigh ? fin(upper2) : NaN, color: bearHalf };
      p[1][i] = { time: t, value: up && notTooLow ? fin(lower2) : NaN, color: bullHalf };
      p[2][i] = { time: t, value: !up && notTooHigh ? fin(upper1) : NaN, color: bearClear };
      p[3][i] = { time: t, value: up && notTooLow ? fin(lower1) : NaN, color: bullClear };
      p[4][i] = { time: t, value: cfg.showTfl ? fin(tfl) : NaN, color: tflColor };
      // upper2 / lower2 of the gradient fills
      s.upper2[i] = upper2;
      s.lower2[i] = lower2;
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills: [
          // fill(plotLevelLower2, plotLevelLower1, fLowerBand1, fLowerBand2, color.new(cBull, 100), color.new(cBull, 80))
          { plot1: 'plot1', plot2: 'plot3', options: { title: 'Smart Trail Lower' }, gradient: {
            topValue: s.lower1.slice(), bottomValue: s.lower2.slice(),
            topColor: new Array(n).fill(bullClear), bottomColor: new Array(n).fill(bull80) } },
          // fill(plotLevelUpper1, plotLevelUpper2, fUpperBand1, fUpperBand2, color.new(cBear, 100), color.new(cBear, 80))
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'Smart Trail Upper' }, gradient: {
            topValue: s.upper1.slice(), bottomValue: s.upper2.slice(),
            topColor: new Array(n).fill(bearClear), bottomColor: new Array(n).fill(bear80) } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UltraSmartTrailInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UltraSmartTrailInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const UltraSmartTrail = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
