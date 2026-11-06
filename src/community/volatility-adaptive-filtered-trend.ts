/**
 * Volatility Adaptive Filtered Trend
 *
 * An adaptive trend follows the source with a smoothing constant between a minimum and a maximum: the factor is the
 * mean of ATR / SMA(ATR) and |src - src[volLength]| / its SMA, halved and clamped to 0..1. The trend is smoothed
 * by an EMA, then by an Ehlers displacement-weighted filter (weights |ema[i] - ema[i + momentum]| over the filter
 * length; SMA when all weights are 0). Bands = trend * (1 +/- multiplier * stdev of the source returns, one bar
 * back). A close above the upper band starts a bullish regime, a close below the lower band a bearish regime:
 * LONG / SHORT markers on the changes, trend line, fill and bar colours by regime.
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal' / 'Short Signal' on the regime changes.
 *
 * Reference: "Volatility Adaptive Filtered Trend [SchizoQuant]" by SchizoQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SchizoQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityAdaptiveFilteredTrendInputs {
  src: SourceType;
  /** ATR and net change length */
  volLength: number;
  /** SMA length of the normalisation */
  normalLength: number;
  /** Minimum smoothing constant */
  minSC: number;
  /** Maximum smoothing constant */
  maxSC: number;
  /** EMA length applied to the adaptive trend */
  emaLength: number;
  /** Ehlers filter length */
  ehlersLength: number;
  /** Ehlers momentum length */
  ehlersMomentum: number;
  /** Return stdev length of the bands */
  bandVolLength: number;
  upperMult: number;
  lowerMult: number;
  showBands: boolean;
  showFill: boolean;
  showSignals: boolean;
  colorBars: boolean;
  longColor: string;
  shortColor: string;
}

const LONG_COLOR = String(color.rgb(57, 255, 20));
const SHORT_COLOR = String(color.rgb(138, 43, 226));

export const defaultInputs: VolatilityAdaptiveFilteredTrendInputs = {
  src: 'hlc3',
  volLength: 15,
  normalLength: 30,
  minSC: 0.084,
  maxSC: 0.33,
  emaLength: 5,
  ehlersLength: 9,
  ehlersMomentum: 2,
  bandVolLength: 22,
  upperMult: 2.0,
  lowerMult: 2.0,
  showBands: true,
  showFill: true,
  showSignals: true,
  colorBars: true,
  longColor: LONG_COLOR,
  shortColor: SHORT_COLOR,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'volLength', type: 'int', title: 'Volatility Length', defval: 15, min: 2 },
  { id: 'normalLength', type: 'int', title: 'Normalization Length', defval: 30, min: 5 },
  { id: 'minSC', type: 'float', title: 'Minimum Smoothing', defval: 0.084, min: 0.001, max: 1.0, step: 0.001 },
  { id: 'maxSC', type: 'float', title: 'Maximum Smoothing', defval: 0.33, min: 0.001, max: 1.0, step: 0.001 },
  { id: 'emaLength', type: 'int', title: 'EMA Smoothing', defval: 5, min: 1 },
  { id: 'ehlersLength', type: 'int', title: 'Filter Length', defval: 9, min: 2 },
  { id: 'ehlersMomentum', type: 'int', title: 'Momentum Length', defval: 2, min: 1 },
  { id: 'bandVolLength', type: 'int', title: 'Volatility Length', defval: 22, min: 2 },
  { id: 'upperMult', type: 'float', title: 'Upper Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lowerMult', type: 'float', title: 'Lower Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'showBands', type: 'bool', title: 'Show Bands', defval: true },
  { id: 'showFill', type: 'bool', title: 'Show Fill', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'longColor', type: 'color', title: 'Bullish Color', defval: LONG_COLOR },
  { id: 'shortColor', type: 'color', title: 'Bearish Color', defval: SHORT_COLOR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filtered Adaptive Trend', color: LONG_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Volatility Band', color: String(color.new(LONG_COLOR, 35)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Volatility Band', color: String(color.new(SHORT_COLOR, 35)), lineWidth: 1 },
];

export const metadata = {
  title: 'Volatility Adaptive Filtered Trend',
  shortTitle: 'Volatility Adaptive Filtered Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a != b false with na */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface VaftVars {
  /** adaptiveTrend of the bar before */
  adaptiveTrend: number;
  /** var int SQ = 0 */
  SQ: number;
}

interface VaftRun extends BarRunState<VaftVars> {
  atr: ReturnType<typeof taStep.atr>;
  atrBaseline: ReturnType<typeof taStep.sma>;
  changeBaseline: ReturnType<typeof taStep.sma>;
  emaTrend: ReturnType<typeof taStep.ema>;
  fallback: ReturnType<typeof taStep.sma>;
  sd: ReturnType<typeof taStep.stdev>;
  src: number[];
  ema: number[];
  sdArr: number[];
  sq: number[];
  plots: Point[][];
  fill: string[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VolatilityAdaptiveFilteredTrendInputs>): BarStudy<VaftRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const upperCol = String(color.new(cfg.longColor, 35));
  const lowerCol = String(color.new(cfg.shortColor, 35));
  const longFill = String(color.new(cfg.longColor, 90));
  const shortFill = String(color.new(cfg.shortColor, 90));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: VaftRun = {
        atr: taStep.atr(cfg.volLength), atrBaseline: taStep.sma(), changeBaseline: taStep.sma(),
        emaTrend: taStep.ema(cfg.emaLength), fallback: taStep.sma(), sd: taStep.stdev(),
        src: [], ema: [], sdArr: [], sq: [], plots: [[], [], []], fill: [], flags: [[], []], times: [[], []],
        markers: [], barColors: [],
        steps: [], vars: { adaptiveTrend: NaN, SQ: 0 }, lists: [], series: [],
      };
      s.steps = [s.atr, s.atrBaseline, s.changeBaseline, s.emaTrend, s.fallback, s.sd];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.src, s.ema, s.sdArr, s.sq, ...s.plots, s.fill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const src = value(b);
      s.src[i] = src;

      const atr = s.atr.step(b.high, b.low, b.close);
      const netChange = i - cfg.volLength >= 0 ? Math.abs(src - s.src[i - cfg.volLength]) : NaN;
      const atrBaseline = s.atrBaseline.step(atr, cfg.normalLength);
      const changeBaseline = s.changeBaseline.step(netChange, cfg.normalLength);

      // adaptiveTrend := na(adaptiveTrend[1]) ? src : adaptiveTrend[1] + adaptiveSC * (src - adaptiveTrend[1])
      // x != 0.0 ? a / x : 1.0 (na != 0 is false)
      const atrFactor = ne(atrBaseline, 0) ? atr / atrBaseline : 1.0;
      const changeFactor = ne(changeBaseline, 0) ? netChange / changeBaseline : 1.0;
      const combined = (atrFactor + changeFactor) * 0.5;
      const normalized = Math.max(0, Math.min(1, combined / 2));
      const sc = cfg.minSC + (cfg.maxSC - cfg.minSC) * normalized;
      const prev = v.adaptiveTrend;
      const adaptiveTrend = isNaN(prev) ? src : prev + sc * (src - prev);
      v.adaptiveTrend = adaptiveTrend;
      const emaTrend = s.emaTrend.step(adaptiveTrend);
      s.ema[i] = emaTrend;
      const fallback = s.fallback.step(emaTrend, cfg.ehlersLength);

      let num = 0;
      let sum = 0;
      for (let k = 0; k < cfg.ehlersLength; k++) {
        const cur = i - k >= 0 ? s.ema[i - k] : NaN;
        const ref = i - k - cfg.ehlersMomentum >= 0 ? s.ema[i - k - cfg.ehlersMomentum] : NaN;
        if (!isNaN(cur) && !isNaN(ref)) {
          const coef = Math.abs(cur - ref);
          num += coef * cur;
          sum += coef;
        }
      }
      const trendMA = gt(sum, 0) ? num / sum : fallback;

      // priceReturn = src[1] != 0.0 ? (src - src[1]) / src[1] : 0.0; volatility = ta.stdev(priceReturn, len)[1]
      const priceReturn = i > 0 && ne(s.src[i - 1], 0) ? (src - s.src[i - 1]) / s.src[i - 1] : 0.0;
      s.sdArr[i] = s.sd.step(priceReturn, cfg.bandVolLength);
      const vol = i > 0 ? s.sdArr[i - 1] : NaN;
      const upper = trendMA + cfg.upperMult * vol * trendMA;
      const lower = trendMA - cfg.lowerMult * vol * trendMA;
      if (gt(b.close, upper)) v.SQ = 1;
      else if (lt(b.close, lower)) v.SQ = -1;
      const sq = v.SQ;
      s.sq[i] = sq;

      const col = sq === 1 ? cfg.longColor : cfg.shortColor;
      // longSignal = SQ == 1 and SQ[1] != 1 (SQ[1] is na on the first bar: false)
      const prevSq = i > 0 ? s.sq[i - 1] : NaN;
      const long = sq === 1 && ne(prevSq, 1);
      const short = sq === -1 && ne(prevSq, -1);
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);
      if (cfg.showSignals && long) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.longColor, size: 'small',
          text: 'LONG', textColor: color.white });
      }
      if (cfg.showSignals && short) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.shortColor, size: 'small',
          text: 'SHORT', textColor: color.white });
      }
      if (cfg.colorBars) s.barColors.push({ time, color: col });

      s.plots[0][i] = { time, value: trendMA, color: col };
      s.plots[1][i] = { time, value: cfg.showBands ? upper : NaN, color: upperCol };
      s.plots[2][i] = { time, value: cfg.showBands ? lower : NaN, color: lowerCol };
      // fill(upperPlot, lowerPlot, "Volatility Band Fill", showFill ? color.new(col, 90) : na)
      s.fill[i] = cfg.showFill ? (sq === 1 ? longFill : shortFill) : 'transparent';
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Volatility Band Fill' }, colors: s.fill.slice() }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(longSignal) / alertcondition(shortSignal)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityAdaptiveFilteredTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityAdaptiveFilteredTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'Volatility Adaptive Filtered Trend Long Signal on {{ticker}}' },
  { id: 'alert1', title: 'Short Signal', message: 'Volatility Adaptive Filtered Trend Short Signal on {{ticker}}' },
];

export const VolatilityAdaptiveFilteredTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
