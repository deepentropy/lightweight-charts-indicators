/**
 * LuckyFX RBtrader strategy
 *
 * Reversal-bar signals. A bullish signal is a bull bar after a bear bar (a bearish signal the opposite) with filters
 * that can each be switched off: the current body between min and max times the previous body, the previous bar
 * not a doji (wicks >= 2 x body), the current body not engulfing (body > previous body + previous wick), the bars 2
 * to N + 1 back in the same direction as the previous bar, the current range >= the mean range of the previous
 * bars, and optionally the current wick longer than the previous wick. Triangles below / above the bar.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Signal' and 'Bearish Signal', true on the bars of each
 * signal.
 *
 * Reference: "LuckyFX RBtrader strategy" by luckykoshti
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RbtStrategyInputs {
  enablePrevCandles: boolean;
  /** Bars 2 .. N + 1 back must have the direction of the previous bar (0 = no check of older bars) */
  samePrevCandles: number;
  enableBodyPercent: boolean;
  bodyPercentMin: number;
  bodyPercentMax: number;
  ignoreDoji: boolean;
  enableMeanRange: boolean;
  meanLength: number;
  ignoreEngulf: boolean;
  enableWickCompare: boolean;
}

export const defaultInputs: RbtStrategyInputs = {
  enablePrevCandles: true,
  samePrevCandles: 2,
  enableBodyPercent: true,
  bodyPercentMin: 0.3,
  bodyPercentMax: 3.0,
  ignoreDoji: true,
  enableMeanRange: true,
  meanLength: 5,
  ignoreEngulf: true,
  enableWickCompare: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'enablePrevCandles', type: 'bool', title: 'Check: Prev Candles Same Dir?', defval: true },
  { id: 'samePrevCandles', type: 'int', title: 'Prev Candles Same (0–4)', defval: 2, min: 0, max: 4 },
  { id: 'enableBodyPercent', type: 'bool', title: 'Check: Cur > % Prev Body?', defval: true },
  { id: 'bodyPercentMin', type: 'float', title: 'Body % Min (0.3)', defval: 0.3, min: 0.3, max: 2.0, step: 0.05 },
  { id: 'bodyPercentMax', type: 'float', title: 'Body % Max (3.0)', defval: 3.0, min: 0.3, max: 3.0, step: 0.05 },
  { id: 'ignoreDoji', type: 'bool', title: 'Ignore if Prev is Doji', defval: true },
  { id: 'enableMeanRange', type: 'bool', title: 'Check: Cur >= Mean Full Candle?', defval: true },
  { id: 'meanLength', type: 'int', title: 'Mean Candle Range (2-50)', defval: 5, min: 2, max: 50 },
  { id: 'ignoreEngulf', type: 'bool', title: 'Ignore if Engulfing (Body Size)', defval: true },
  { id: 'enableWickCompare', type: 'bool', title: 'Check: Cur wick > Prev wick (on/off)', defval: false },
];

/** No plot(): the outputs are the two plotshape markers */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'LuckyFX RBtrader strategy',
  shortTitle: 'LuckyFX RBtrader strategy',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface RbtRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RbtStrategyInputs>): BarStudy<RbtRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullColor = 'rgb(38, 129, 11)';
  const bearColor = 'rgb(226, 10, 10)';
  return {
    init() {
      const s: RbtRun = { markers: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const O = (j: number) => (j >= 0 ? bars[j].open : NaN);
      const H = (j: number) => (j >= 0 ? bars[j].high : NaN);
      const L = (j: number) => (j >= 0 ? bars[j].low : NaN);
      const C = (j: number) => (j >= 0 ? bars[j].close : NaN);
      // close > open ? 1 : close < open ? -1 : 0 (na compares false: 0)
      const dir = (j: number) => (gt(C(j), O(j)) ? 1 : lt(C(j), O(j)) ? -1 : 0);
      const { open, high, low, close } = bars[i];
      const prevOpen = O(i - 1);
      const prevClose = C(i - 1);
      const prevBody = Math.abs(prevClose - prevOpen);
      const prevUpperWick = H(i - 1) - Math.max(prevOpen, prevClose);
      const prevLowerWick = Math.min(prevOpen, prevClose) - L(i - 1);
      const prevIsDoji = ge(prevUpperWick + prevLowerWick, 2 * prevBody);
      const prevIsBull = gt(prevClose, prevOpen);
      const prevIsBear = lt(prevClose, prevOpen);

      const curBody = Math.abs(close - open);
      const curRange = high - low;
      const isBull = gt(close, open);
      const isBear = lt(close, open);
      const isBullishEngulf = gt(curBody, prevBody + prevUpperWick);
      const isBearishEngulf = gt(curBody, prevBody + prevLowerWick);
      const curUpperWick = high - Math.max(open, close);
      const curLowerWick = Math.min(open, close) - low;

      // for i = 1 to mean_length: sum_range += high[i] - low[i] (na before the first bar)
      let sumRange = 0;
      for (let k = 1; k <= cfg.meanLength; k++) sumRange += H(i - k) - L(i - k);
      const meanPrevRange = sumRange / cfg.meanLength;
      const isCurRangeBigEnough = !cfg.enableMeanRange || ge(curRange, meanPrevRange);

      const prevDir = prevIsBull ? 1 : prevIsBear ? -1 : 0;
      let match = true;
      if (cfg.samePrevCandles > 0) {
        for (let k = 2; k <= cfg.samePrevCandles + 1; k++) match = match && dir(i - k) === prevDir;
      }
      const lastNSameAsPrev = !cfg.enablePrevCandles || (prevDir !== 0 && match);

      const bodyPercentOk = !cfg.enableBodyPercent
        || (gt(curBody, cfg.bodyPercentMin * prevBody) && lt(curBody, cfg.bodyPercentMax * prevBody));
      const wickCondition = !cfg.enableWickCompare
        || (isBull && gt(curLowerWick, prevLowerWick)) || (isBear && gt(curUpperWick, prevUpperWick));
      const dojiOk = !cfg.ignoreDoji || !prevIsDoji;

      const bull = isBull && prevIsBear && bodyPercentOk && dojiOk && (!cfg.ignoreEngulf || !isBullishEngulf)
        && lastNSameAsPrev && isCurRangeBigEnough && wickCondition;
      const bear = isBear && prevIsBull && bodyPercentOk && dojiOk && (!cfg.ignoreEngulf || !isBearishEngulf)
        && lastNSameAsPrev && isCurRangeBigEnough && wickCondition;

      s.flags[0][i] = bull;
      s.flags[1][i] = bear;
      if (bull) s.times[0].push(bars[i].time as number);
      if (bear) s.times[1].push(bars[i].time as number);
      const t = bars[i].time;
      // plotshape(bull_bigger_than_bear, "Bullish Signal", shape.triangleup, location.belowbar, size.small)
      if (bull) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: bullColor, size: 'small' });
      // plotshape(bear_bigger_than_bull, "Bearish Signal", shape.triangledown, location.abovebar, size.small)
      if (bear) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: bearColor, size: 'small' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        // alertcondition(bull_bigger_than_bear, "Bullish Signal") / alertcondition(bear_bigger_than_bull, "Bearish Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RbtStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RbtStrategyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Signal', message: 'Bullish > Bearish Setup' },
  { id: 'alert1', title: 'Bearish Signal', message: 'Bearish > Bullish Setup' },
];

export const RbtStrategy = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
