/**
 * Adaptive ML Trailing Stop [BOSWaves]
 *
 * An ATR trailing stop whose distance adapts to the Kaufman efficiency ratio (ER) of the close:
 * distance = ATR * baseMultiplier * (1 + (1 - ER) * adaptiveStrength), wider in ranging markets. A K-nearest-
 * neighbours model compares the last `knnFeatureLength` normalized closes with the same pattern `offset` bars back
 * (offset up to `knnLookback`) and takes the inverse-distance weighted share of the K nearest patterns that were
 * followed by a rise. The prediction (0 bearish .. 1 bullish), weighted by the neighbours' agreement, tightens the
 * long stop and widens the short stop (or the opposite). Both raw stops are smoothed with the KAMA smoothing
 * constant, then trail: the long stop only rises and the short stop only falls while the previous close stays on
 * their side. The trend turns up when the close passes the previous short stop and down when it falls below the
 * previous long stop. The active stop is drawn with a four-layer fill to the close, circles mark trend changes,
 * diamonds mark touches of the stop (with a cooldown), and the candles take the trend colour.
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal' and 'Short Signal', on the trend changes.
 *
 * Reference: "Adaptive ML Trailing Stop [BOSWaves]" by BOSWaves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BOSWaves
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveMLTrailingStopInputs {
  /** KAMA length (efficiency ratio period) */
  kamaLength: number;
  /** Fast period of the KAMA smoothing constant */
  fastLength: number;
  /** Slow period of the KAMA smoothing constant */
  slowLength: number;
  /** ATR period */
  atrPeriod: number;
  /** Base ATR multiplier */
  baseMultiplier: number;
  /** Adaptive strength (wider stops in ranging markets) */
  adaptiveStrength: number;
  /** Enable the KNN adjustment */
  knnEnabled: boolean;
  /** K neighbours */
  knnK: number;
  /** KNN lookback period (bars searched for similar patterns) */
  knnLookback: number;
  /** Pattern length */
  knnFeatureLength: number;
  /** KNN influence on the stop distance */
  knnWeight: number;
  /** Minimum number of bars between two diamonds */
  diamondCooldown: number;
  longColor: string;
  shortColor: string;
  showGradient: boolean;
}

export const defaultInputs: AdaptiveMLTrailingStopInputs = {
  kamaLength: 20,
  fastLength: 15,
  slowLength: 50,
  atrPeriod: 21,
  baseMultiplier: 2.5,
  adaptiveStrength: 1.0,
  knnEnabled: true,
  knnK: 7,
  knnLookback: 100,
  knnFeatureLength: 5,
  knnWeight: 0.2,
  diamondCooldown: 5,
  longColor: '#00ff88',
  shortColor: '#ff3366',
  showGradient: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'kamaLength', type: 'int', title: 'KAMA Length', defval: 20, min: 1 },
  { id: 'fastLength', type: 'int', title: 'Fast Period', defval: 15, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Period', defval: 50, min: 1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 21, min: 1 },
  { id: 'baseMultiplier', type: 'float', title: 'Base ATR Multiplier', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'adaptiveStrength', type: 'float', title: 'Adaptive Strength', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'knnEnabled', type: 'bool', title: 'Enable KNN', defval: true },
  { id: 'knnK', type: 'int', title: 'K Neighbors', defval: 7, min: 1, max: 20 },
  { id: 'knnLookback', type: 'int', title: 'KNN Lookback Period', defval: 100, min: 50, max: 500 },
  { id: 'knnFeatureLength', type: 'int', title: 'Pattern Length', defval: 5, min: 3, max: 20 },
  { id: 'knnWeight', type: 'float', title: 'KNN Influence', defval: 0.2, min: 0.0, max: 1.0, step: 0.1 },
  { id: 'diamondCooldown', type: 'int', title: 'Diamond Cooldown Bars', defval: 5, min: 1 },
  { id: 'longColor', type: 'color', title: 'Long Color', defval: '#00ff88' },
  { id: 'shortColor', type: 'color', title: 'Short Color', defval: '#ff3366' },
  { id: 'showGradient', type: 'bool', title: 'Show Gradient Fill', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop', color: '#00ff88', lineWidth: 3, style: 'linebr' },
  { id: 'plot1', title: 'Short Stop', color: '#ff3366', lineWidth: 3, style: 'linebr' },
  { id: 'plot2', title: 'Gradient Lower Band', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Gradient 25%', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Gradient 50%', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Gradient 75%', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Gradient Upper Band', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Adaptive ML Trailing Stop [BOSWaves]',
  shortTitle: 'Adaptive ML Trailing Stop [BOSWaves]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/**
 * One Pine ta.highest / ta.lowest call site that can run many times per bar (here inside the KNN loops); rule
 * found with probe plots of the normalized values:
 * - the source history has one slot per bar (a ring of len + 1 slots indexed by bar); each call overwrites the slot
 *   of the current bar, so earlier bars keep the value of their last call; a slot never written is skipped;
 * - the extreme is kept with its bar and replaced by a value that passes it (also by an earlier call of the same
 *   bar); the window of the last len bars is scanned again when the extreme is len bars old (the oldest bar wins
 *   a tie);
 * - an na source writes na, resets the extreme and returns na.
 * A class (not a closure) so that a live run can copy its state at the end of the last confirmed bar.
 */
class PineExtreme {
  private slot: number[];
  private ext = NaN;
  private extBar = -1;

  constructor(private readonly len: number, private readonly isLow: boolean, slot?: number[]) {
    this.slot = slot ?? new Array(len + 1).fill(NaN);
  }

  call(bar: number, x: number): number {
    const { len, isLow, slot } = this;
    const ring = len + 1;
    slot[bar % ring] = x;
    if (isNaN(x)) {
      this.ext = NaN;
      return NaN;
    }
    if (isNaN(this.ext) || bar - this.extBar >= len) {
      this.ext = NaN;
      for (let k = 0; k < len && bar - k >= 0; k++) {
        const v = slot[(bar - k) % ring];
        if (!isNaN(v) && (isNaN(this.ext) || (isLow ? v <= this.ext : v >= this.ext))) {
          this.ext = v;
          this.extBar = bar - k;
        }
      }
    } else if (isLow ? x < this.ext : x > this.ext) {
      this.ext = x;
      this.extBar = bar;
    }
    return bar < len - 1 ? NaN : this.ext;
  }

  clone(): PineExtreme {
    const c = new PineExtreme(this.len, this.isLow, this.slot.slice());
    c.ext = this.ext;
    c.extBar = this.extBar;
    return c;
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface AdaptiveVars {
  hiCur: PineExtreme;
  loCur: PineExtreme;
  hiHist: PineExtreme;
  loHist: PineExtreme;
  /** var float knnPrediction = 0.5, var float knnConfidence = 0.0 */
  prediction: number;
  confidence: number;
  smoothLong: number;
  smoothShort: number;
  /** var int trend = 0 */
  trend: number;
  lastLongDiamond: number;
  lastShortDiamond: number;
}

interface AdaptiveRun extends BarRunState<AdaptiveVars> {
  atr: ReturnType<typeof taStep.atr>;
  close: number[];
  longStop: number[];
  shortStop: number[];
  plots: Point[][];
  layers: string[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptiveMLTrailingStopInputs>): BarStudy<AdaptiveRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.kamaLength;
  const fastSC = 2.0 / (cfg.fastLength + 1);
  const slowSC = 2.0 / (cfg.slowLength + 1);
  const FL = cfg.knnFeatureLength;
  const K = cfg.knnK;
  const TRANSP = [85, 90, 95, 97];
  return {
    init() {
      const s: AdaptiveRun = {
        atr: taStep.atr(cfg.atrPeriod), close: [], longStop: [], shortStop: [],
        plots: Array.from({ length: 7 }, () => []), layers: TRANSP.map(() => []), markers: [], barColors: [],
        flags: [[], []], times: [[], []], steps: [],
        vars: {
          hiCur: new PineExtreme(FL, false), loCur: new PineExtreme(FL, true),
          hiHist: new PineExtreme(FL, false), loHist: new PineExtreme(FL, true),
          prediction: 0.5, confidence: 0.0, smoothLong: NaN, smoothShort: NaN, trend: 0,
          lastLongDiamond: -999, lastShortDiamond: -999,
        },
        lists: [], series: [],
      };
      s.steps = [s.atr];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.close, s.longStop, s.shortStop, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, hiCur: v.hiCur.clone(), loCur: v.loCur.clone(), hiHist: v.hiHist.clone(), loHist: v.loHist.clone() }),
    bar(s, b, bars) {
      const v = s.vars;
      const bar = bars[b];
      const close = s.close;
      close[b] = bar.close;
      const at = (a: number[], i: number) => (i >= 0 && i < a.length ? a[i] : NaN);

      // KAMA efficiency ratio and smoothing constant
      const change = Math.abs(close[b] - at(close, b - L));
      // math.sum(math.abs(close - close[1]), kamaLength): na while the window holds bar 0 (close[1] na)
      let volatility = NaN;
      if (b >= L) {
        volatility = 0;
        for (let k = 0; k < L; k++) volatility += Math.abs(close[b - k] - close[b - k - 1]);
      }
      // volatility != 0 ? change / volatility : 0 (na != 0 is false)
      const er = !isNaN(volatility) && Math.abs(volatility) > EPS ? change / volatility : 0;
      const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);

      // KNN pattern matching. normalize(src, len): priceRange > 0 ? (src - lowest) / priceRange : 0.5
      const normalize = (hi: PineExtreme, lo: PineExtreme, src: number) => {
        const highest = hi.call(b, src);
        const lowest = lo.call(b, src);
        const priceRange = highest - lowest;
        return gt(priceRange, 0) ? (src - lowest) / priceRange : 0.5;
      };
      if (cfg.knnEnabled && b > cfg.knnLookback) {
        const distances: number[] = [];
        const outcomes: number[] = [];
        for (let offset = FL; offset <= cfg.knnLookback; offset++) {
          // calcDistance(offset): Euclidean distance of the normalized patterns
          let sum = 0.0;
          for (let i = 0; i < FL; i++) {
            const currentNorm = normalize(v.hiCur, v.loCur, at(close, b - i));
            const historicalNorm = normalize(v.hiHist, v.loHist, at(close, b - i - offset));
            const diff = currentNorm - historicalNorm;
            sum += diff * diff;
          }
          const dist = Math.sqrt(sum);
          if (lt(dist, 999999.0)) {
            distances.push(dist);
            const past = at(close, b - offset);
            const futureReturn = (at(close, b - (offset - FL)) - past) / past;
            outcomes.push(gt(futureReturn, 0) ? 1.0 : 0.0);
          }
        }
        if (distances.length >= K) {
          const last = Math.min(K - 1, distances.length - 1);
          // selection sort of the K smallest distances
          for (let i = 0; i <= last; i++) {
            let minIdx = i;
            for (let j = i + 1; j <= distances.length - 1; j++) if (lt(distances[j], distances[minIdx])) minIdx = j;
            if (minIdx !== i) {
              [distances[i], distances[minIdx]] = [distances[minIdx], distances[i]];
              [outcomes[i], outcomes[minIdx]] = [outcomes[minIdx], outcomes[i]];
            }
          }
          let totalWeight = 0.0;
          let weightedSum = 0.0;
          for (let i = 0; i <= last; i++) {
            const w = gt(distances[i], 0) ? 1.0 / (distances[i] + 0.001) : 1.0;
            weightedSum += outcomes[i] * w;
            totalWeight += w;
          }
          v.prediction = gt(totalWeight, 0) ? weightedSum / totalWeight : 0.5;
          let bullish = 0;
          for (let i = 0; i <= Math.min(K - 1, outcomes.length - 1); i++) if (gt(outcomes[i], 0.5)) bullish += 1;
          v.confidence = Math.abs(bullish / Math.min(K, outcomes.length) - 0.5) * 2;
        }
      }

      // Adaptive trailing stop
      const atr = s.atr.step(bar.high, bar.low, bar.close);
      const adaptiveMultiplier = cfg.baseMultiplier * (1 + (1 - er) * cfg.adaptiveStrength);
      const knnAdjustment = cfg.knnEnabled ? (v.prediction - 0.5) * cfg.knnWeight * v.confidence : 0.0;
      const stopDistance = atr * adaptiveMultiplier;
      const rawLong = close[b] - stopDistance * (1 - knnAdjustment);
      const rawShort = close[b] + stopDistance * (1 + knnAdjustment);
      v.smoothLong = isNaN(v.smoothLong) ? rawLong : v.smoothLong + sc * (rawLong - v.smoothLong);
      v.smoothShort = isNaN(v.smoothShort) ? rawShort : v.smoothShort + sc * (rawShort - v.smoothShort);
      const prevLong = at(s.longStop, b - 1);
      const prevShort = at(s.shortStop, b - 1);
      const close1 = at(close, b - 1);
      // math.max / math.min with na give na
      const longStop = gt(close1, prevLong) ? Math.max(v.smoothLong, prevLong) : v.smoothLong;
      const shortStop = lt(close1, prevShort) ? Math.min(v.smoothShort, prevShort) : v.smoothShort;
      s.longStop[b] = longStop;
      s.shortStop[b] = shortStop;
      const prevTrend = v.trend;
      if (gt(close[b], prevShort)) v.trend = 1;
      else if (lt(close[b], prevLong)) v.trend = -1;
      const trend = v.trend;

      // Plots
      const time = bar.time;
      const up = trend === 1;
      const upperBand = cfg.showGradient ? (up ? close[b] : shortStop) : NaN;
      const lowerBand = cfg.showGradient ? (up ? longStop : close[b]) : NaN;
      const mid = (f: number) => (cfg.showGradient ? lowerBand + (upperBand - lowerBand) * f : NaN);
      const p = s.plots;
      // plot(trend == 1 ? longStop : na, "Long Stop", longColor, 3, plot.style_linebr)
      p[0][b] = { time, value: up ? longStop : NaN, color: cfg.longColor };
      // plot(trend == -1 ? shortStop : na, "Short Stop", shortColor, 3, plot.style_linebr)
      p[1][b] = { time, value: trend === -1 ? shortStop : NaN, color: cfg.shortColor };
      // gradPlot1..5 = plot(lowerBand / mid1 / mid2 / mid3 / upperBand, display = display.none)
      p[2][b] = { time, value: lowerBand };
      p[3][b] = { time, value: mid(0.25) };
      p[4][b] = { time, value: mid(0.5) };
      p[5][b] = { time, value: mid(0.75) };
      p[6][b] = { time, value: upperBand };
      TRANSP.forEach((transp, k) => {
        s.layers[k][b] = cfg.showGradient ? String(color.new(up ? cfg.longColor : cfg.shortColor, transp)) : 'transparent';
      });

      // Markers: plotshape order Buy Signal, Sell Signal, Long Stop Touch, Short Stop Touch
      const buy = trend === 1 && prevTrend === -1;
      const sell = trend === -1 && prevTrend === 1;
      // low <= longStop and low[1] > longStop[1] or math.abs(low - longStop) < atr * 0.5
      const lowPrev = b > 0 ? bars[b - 1].low : NaN;
      const highPrev = b > 0 ? bars[b - 1].high : NaN;
      const longTouchRaw = trend === 1
        && ((le(bar.low, longStop) && gt(lowPrev, prevLong)) || lt(Math.abs(bar.low - longStop), atr * 0.5));
      const shortTouchRaw = trend === -1
        && ((ge(bar.high, shortStop) && lt(highPrev, prevShort)) || lt(Math.abs(bar.high - shortStop), atr * 0.5));
      const longTouch = longTouchRaw && b - v.lastLongDiamond >= cfg.diamondCooldown;
      const shortTouch = shortTouchRaw && b - v.lastShortDiamond >= cfg.diamondCooldown;
      if (longTouch) v.lastLongDiamond = b;
      if (shortTouch) v.lastShortDiamond = b;
      if (buy) s.markers.push({ time, position: 'belowBar', shape: 'circle', color: cfg.longColor, size: 'small' });
      if (sell) s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: cfg.shortColor, size: 'small' });
      if (longTouch) s.markers.push({ time, position: 'belowBar', shape: 'diamond', color: cfg.longColor, size: 'small' });
      if (shortTouch) s.markers.push({ time, position: 'aboveBar', shape: 'diamond', color: cfg.shortColor, size: 'small' });
      // barcolor(trend == 1 ? longColor : shortColor, title = "Trend Candles")
      s.barColors.push({ time, color: up ? cfg.longColor : cfg.shortColor });
      // alertcondition(trend == 1 and prevTrend == -1, ...) / alertcondition(trend == -1 and prevTrend == 1, ...)
      [buy, sell].forEach((f, k) => {
        s.flags[k][b] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        // fill(gradPlot1, gradPlot2, ... 85), (2, 3, 90), (3, 4, 95), (4, 5, color.new(stopColor, 97))
        fills: [
          { plot1: 'plot2', plot2: 'plot3', colors: s.layers[0].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: s.layers[1].slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: s.layers[2].slice() },
          { plot1: 'plot5', plot2: 'plot6', colors: s.layers[3].slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveMLTrailingStopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveMLTrailingStopInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'KNN-KAMA Trailing Stop: Long Entry' },
  { id: 'alert1', title: 'Short Signal', message: 'KNN-KAMA Trailing Stop: Short Entry' },
];

export const AdaptiveMLTrailingStop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
