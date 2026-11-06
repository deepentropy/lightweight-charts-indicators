/**
 * Quantitative Qualitative Estimation (QQE)
 *
 * FAST = EMA ("Smooth Factor") of the RSI. Its absolute bar-to-bar change is smoothed twice with a Wilder factor
 * (1 / RSI length, each smoothing starting from 0) and multiplied by the QQE factor (4.236 in the original) to give a
 * band above and below FAST. SLOW, the trailing line, starts at 0 and follows the original's rule on each bar: the
 * upper band when it is below the previous SLOW; the lower band when FAST crosses up through the previous SLOW or the
 * lower band is above it; the upper band when FAST crosses down through it; else the previous SLOW. FAST and SLOW
 * cross where the trend turns. With "Highlighter On/Off ?" the area between them is green when FAST is above and red
 * when it is below (default fill transparency 90); with "Show Crossing Signals?" Buy / Sell labels mark the crosses
 * (at SLOW x 0.995 / x 1.005). A circles plot at 50.
 * Alerts (alertcondition, `alerts` of the result): the original's five conditions, crosses of FAST with SLOW (any
 * cross, crossover, crossunder) and with 50.
 *
 * Reference: "Quantitative Qualitative Estimation" (QQE) by KivancOzbilgic
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface QQEInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  src: SourceType;
  /** Show Crossing Signals? (Buy / Sell labels) */
  showSignals: boolean;
  /** Highlighter On/Off ? (fill between FAST and SLOW) */
  highlighting: boolean;
}

export const defaultInputs: QQEInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.236,
  src: 'close',
  showSignals: true,
  highlighting: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'Smooth Factor', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.236, min: 0.01, step: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignals', type: 'bool', title: 'Show Crossing Signals?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

// Colour constants of Pine version 4
const MAROON = '#880E4F';
const BLUE = '#2196F3';
const GRAY = '#787B86';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FAST', color: MAROON, lineWidth: 2 },
  { id: 'plot1', title: 'SLOW', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Plot', color: GRAY, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Quantitative Qualitative Estimation',
  shortTitle: 'QQE',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number) => (isNaN(v) ? 0 : v);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QqeVars {
  wwma: number;
  atrRsi: number;
}

interface QqeRun extends BarRunState<QqeVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  fast: number[];
  slow: number[];
  plots: Point[][];
  upFillColors: string[];
  downFillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QQEInputs>): BarStudy<QqeRun, Result> {
  const { rsiLen, smoothFactor, qqeFactor, src, showSignals, highlighting } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const wwalpha = 1 / rsiLen;
  // fill(QQF, QQS, color = highlighting ? (QQEF > QQES ? color.green : na) : na): default fill transparency 90
  const greenFill = String(color.new(GREEN, 90));
  const redFill = String(color.new(RED, 90));
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: QqeRun = {
        rsi: taStep.rsi(rsiLen), ema: taStep.ema(smoothFactor), over: taStep.crossover(), under: taStep.crossunder(),
        fast: [], slow: [], plots: [[], [], []], upFillColors: [], downFillColors: [], markers: [],
        flags: [[], [], [], [], []], times: [[], [], [], [], []],
        steps: [], vars: { wwma: NaN, atrRsi: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.ema, s.over, s.under];
      s.lists = [s.markers, ...s.times];
      s.series = [s.fast, s.slow, ...s.plots, s.upFillColors, s.downFillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // RSII = QQEF = ema(rsi(src, length), SSF)
      const f = s.ema.step(s.rsi.step(value(b)));
      s.fast[i] = f;

      // TR = abs(RSII - RSII[1]); WWMA := wwalpha * TR + (1 - wwalpha) * nz(WWMA[1]);
      // ATRRSI := wwalpha * WWMA + (1 - wwalpha) * nz(ATRRSI[1]); QUP / QDN = QQEF +/- ATRRSI * 4.236
      // QQES := QUP < nz(QQES[1]) ? QUP : QQEF > nz(QQES[1]) and QQEF[1] < nz(QQES[1]) ? QDN : QDN > nz(QQES[1]) ? QDN
      //   : QQEF < nz(QQES[1]) and QQEF[1] > nz(QQES[1]) ? QUP : nz(QQES[1])
      const f1 = i > 0 ? s.fast[i - 1] : NaN;
      const tr = Math.abs(f - f1);
      v.wwma = wwalpha * tr + (1 - wwalpha) * nz(v.wwma);
      v.atrRsi = wwalpha * v.wwma + (1 - wwalpha) * nz(v.atrRsi);
      const qup = f + v.atrRsi * qqeFactor;
      const qdn = f - v.atrRsi * qqeFactor;
      const s1 = nz(i > 0 ? s.slow[i - 1] : NaN);
      const slow = lt(qup, s1) ? qup
        : gt(f, s1) && lt(f1, s1) ? qdn
          : gt(qdn, s1) ? qdn
            : lt(f, s1) && gt(f1, s1) ? qup
              : s1;
      s.slow[i] = slow;

      // buySignalr = crossover(QQEF, QQES), sellSignallr = crossunder(QQEF, QQES)
      const buy = !!s.over.step(f, slow);
      const sell = !!s.under.step(f, slow);

      s.plots[0][i] = { time, value: f };
      s.plots[1][i] = { time, value: slow };
      // plot(50, color = color.gray, style = 6): circles
      s.plots[2][i] = { time, value: 50 };
      s.upFillColors[i] = highlighting && gt(f, slow) ? greenFill : 'transparent';
      s.downFillColors[i] = highlighting && lt(f, slow) ? redFill : 'transparent';
      // plotshape(buySignalr and showsignals ? QQES * 0.995 : na, "Buy", location.absolute, shape.labelup, size.tiny)
      if (showSignals && buy && !isNaN(slow)) {
        s.markers.push({ id: 'shape0', time, position: 'atPriceBottom', price: slow * 0.995, shape: 'labelUp', color: GREEN,
          text: 'Buy', textColor: WHITE, size: 'tiny' });
      }
      // plotshape(sellSignallr and showsignals ? QQES * 1.005 : na, "Sell", location.absolute, shape.labeldown)
      if (showSignals && sell && !isNaN(slow)) {
        s.markers.push({ id: 'shape1', time, position: 'atPriceTop', price: slow * 1.005, shape: 'labelDown', color: RED,
          text: 'Sell', textColor: WHITE, size: 'tiny' });
      }
      // alertcondition(cross / crossover / crossunder(QQEF, QQES), crossover / crossunder(QQEF, 50))
      const up50 = f > 50 && f1 <= 50;
      const down50 = f < 50 && f1 >= 50;
      const fl = s.flags;
      fl[0][i] = buy || sell;
      fl[1][i] = buy;
      fl[2][i] = sell;
      fl[3][i] = up50;
      fl[4][i] = down50;
      for (let k = 0; k < 5; k++) if (fl[k][i]) s.times[k].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plots[0].slice(), 'plot1': s.plots[1].slice(), 'plot2': s.plots[2].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'UpTrend Highligter', color: greenFill }, colors: s.upFillColors.slice() },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'DownTrend Highligter', color: redFill }, colors: s.downFillColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QQEInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QQEInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'QQE Crossing Signal!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'QQE BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'QQE SELL SIGNAL!' },
  { id: 'alert3', title: 'Cross 50 Up Alert', message: 'QQE FAST Crossing 50 UP!' },
  { id: 'alert4', title: 'Cross 50 Down Alert', message: 'QQE FAST Crossing 50 DOWN!' },
];

export const QQE = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
