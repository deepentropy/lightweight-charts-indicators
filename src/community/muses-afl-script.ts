/**
 * L1 Filter Sig
 *
 * L1 proximal filter: a prediction z[1] + v[1] is pulled toward the source by mu; the step from z[1] is shrunk by a
 * threshold of ATR(200) * multiplier (soft thresholding: steps smaller than the threshold give a velocity of 0).
 * The trend is 1 while the filter rises, -1 while it falls. The filter and the source are coloured by the trend
 * with a fill between them; BUY / SELL arrows mark the trend changes.
 *
 * Alerts (alertcondition, `alerts` of the result): "Buy Alert" (buySignal) and "Sell Alert" (sellSignal).
 *
 * Reference: "Muses afl script" by mostafa47ab (indicator title "L1 Filter Sig")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'L1 Filter BUY Signal!' },
  { id: 'alert1', title: 'Sell Alert', message: 'L1 Filter SELL Signal!' },
];

export interface MusesAflScriptInputs {
  src: SourceType;
  /** ATR multiplier of the threshold */
  atrMult: number;
  /** Pull of the prediction toward the source (0..1) */
  mu: number;
  showSignals: boolean;
}

export const defaultInputs: MusesAflScriptInputs = {
  src: 'close',
  atrMult: 1.5,
  mu: 0.6,
  showSignals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'atrMult', type: 'float', title: 'ATR Mult', defval: 1.5, min: 0, step: 0.1 },
  { id: 'mu', type: 'float', title: 'μ', defval: 0.6, min: 0, max: 1, step: 0.1 },
  { id: 'showSignals', type: 'bool', title: 'Signals', defval: true },
];

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: BULL_COLOR, lineWidth: 3 },
  { id: 'plot1', title: 'Src', color: BULL_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'L1 Filter Sig',
  shortTitle: 'L1Filter',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface MusesVars {
  /** v (its value of the previous bar) */
  v: number;
  /** The trend: z > z[1] -> 1, z < z[1] -> -1, else unchanged */
  tr: number;
}

interface MusesRun extends BarRunState<MusesVars> {
  atr: ReturnType<typeof taStep.atr>;
  z: number[];
  trend: number[];
  zData: Point[];
  srcData: Point[];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MusesAflScriptInputs>): BarStudy<MusesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(200);
      const s: MusesRun = {
        atr, z: [], trend: [], zData: [], srcData: [], fillColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [atr], vars: { v: 0.0, tr: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.z, s.trend, s.zData, s.srcData, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const z = s.z;
      const trend = s.trend;
      const st = s.vars;
      const threshold = s.atr.step(b.high, b.low, b.close) * cfg.atrMult;
      if (i === 0) z[i] = src;
      else {
        const zPrev = z[i - 1];
        const vPrev = st.v; // v[1]
        const zPred = zPrev + vPrev;
        const zTemp = zPred + cfg.mu * (src - zPred);
        const diff = zTemp - zPrev;
        if (gt(Math.abs(diff), threshold)) st.v = Math.sign(diff) * (Math.abs(diff) - threshold);
        else st.v = 0.0;
        z[i] = zPrev + st.v;
      }
      // trend: z > z[1] -> 1, z < z[1] -> -1, else unchanged
      const zp = i > 0 ? z[i - 1] : NaN;
      if (gt(z[i], zp)) st.tr = 1;
      else if (lt(z[i], zp)) st.tr = -1;
      trend[i] = st.tr;

      // buySignal = showSignals and upChange / sellSignal = showSignals and downChange
      let buy = false;
      let sell = false;
      if (i >= 1 && cfg.showSignals) {
        buy = trend[i] === 1 && trend[i - 1] === -1;
        sell = trend[i] === -1 && trend[i - 1] === 1;
        if (buy) {
          s.markers.push({ time: b.time, position: 'belowBar', shape: 'arrowUp', color: BULL_COLOR, size: 'large',
            text: 'BUY', textColor: '#2962FF' });
        }
        if (sell) {
          s.markers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: BEAR_COLOR, size: 'large',
            text: 'SELL', textColor: '#2962FF' });
        }
      }
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(b.time as number);
      if (sell) s.times[1].push(b.time as number);

      const zColor = trend[i] === 1 ? BULL_COLOR : BEAR_COLOR;
      s.zData[i] = { time: b.time, value: z[i], color: zColor };
      s.srcData[i] = { time: b.time, value: src, color: String(color.new(zColor, 0)) };
      // fill(plotZ, plotSrc, color = color.new(zColor, 90))
      s.fillColors[i] = String(color.new(zColor, 90));
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.zData.slice(), plot1: s.srcData.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MusesAflScriptInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MusesAflScriptInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MusesAflScript = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
