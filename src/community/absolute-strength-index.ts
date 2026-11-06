/**
 * Absolute Strength Index [ASI]
 *
 * The one-bar returns of the last `Returns Lookback` bars are sorted; the return at the top percentile is the winner
 * threshold and the return at the bottom percentile the loser threshold. The return over the whole lookback is
 * normalised between them: ASI = (return - loser) / (winner - loser) * 2 - 1. A moving average of the ASI is the
 * signal line; bands at +8 / -8 with a background fill, gradient fills beyond +5 / -5, and optional divergences
 * (ASI at its lowest / highest of a lookback while the price makes a lower low / higher high).
 * Alerts (alertcondition, `alerts` of the result): 'Regular Bullish Divergence' / 'Regular Bearish Divergence', true
 * on the bars of a Bull / Bear divergence label (only with "Divergence" on).
 *
 * Reference: "Absolute Strength Index [ASI] (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type ASIMAType = 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'HMA';

export interface AbsoluteStrengthIndexInputs {
  /** Number of one-bar returns in the distribution, and length of the current return */
  returnLookback: number;
  /** Top percentile (winners) */
  topPercentile: number;
  /** Bottom percentile (losers) */
  bottomPercentile: number;
  /** Signal line type */
  maType: ASIMAType;
  /** Signal line length */
  maLength: number;
  asiColor: string;
  maAsiColor: string;
  /** Colour of the bands and of the band fill */
  fillColor: string;
  /** Overbought gradient colour */
  obColor: string;
  /** Oversold gradient colour */
  osColor: string;
  /** Detect divergences */
  calculateDivergence: boolean;
  /** Divergence lookback */
  lookback: number;
  bearColor: string;
  bullColor: string;
  textColor: string;
}

export const defaultInputs: AbsoluteStrengthIndexInputs = {
  returnLookback: 15,
  topPercentile: 0.15,
  bottomPercentile: 0.15,
  maType: 'SMA',
  maLength: 14,
  asiColor: color.blue,
  maAsiColor: color.yellow,
  fillColor: '#94def0',
  obColor: color.lime,
  osColor: color.red,
  calculateDivergence: false,
  lookback: 20,
  bearColor: color.red,
  bullColor: color.green,
  textColor: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'returnLookback', type: 'int', title: 'Returns Lookback', defval: 15, min: 3 },
  { id: 'topPercentile', type: 'float', title: 'Top Percentile (Winners)', defval: 0.15, min: 0.05, max: 0.3, step: 0.01 },
  { id: 'bottomPercentile', type: 'float', title: 'Bottom Percentile (Losers)', defval: 0.15, min: 0.05, max: 0.3, step: 0.01 },
  { id: 'maType', type: 'string', title: 'Signal Line', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'RMA', 'HMA'] },
  { id: 'maLength', type: 'int', title: 'Signal Length', defval: 14 },
  { id: 'asiColor', type: 'color', title: 'ASI', defval: color.blue },
  { id: 'maAsiColor', type: 'color', title: 'ASI-based MA', defval: color.yellow },
  { id: 'fillColor', type: 'color', title: 'Bands', defval: '#94def0' },
  { id: 'obColor', type: 'color', title: 'Overbought', defval: color.lime },
  { id: 'osColor', type: 'color', title: 'Oversold', defval: color.red },
  { id: 'calculateDivergence', type: 'bool', title: 'Divergence', defval: false },
  { id: 'lookback', type: 'int', title: 'lookback', defval: 20, min: 1 },
  { id: 'bearColor', type: 'color', title: 'Bearish', defval: color.red },
  { id: 'bullColor', type: 'color', title: 'Bullish', defval: color.green },
  { id: 'textColor', type: 'color', title: 'Text', defval: color.white },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ASI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'ASI-based MA', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Middle', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'ASI Bullish Divergence', color: color.green, lineWidth: 2 },
  { id: 'plot4', title: 'ASI Bearish Divergence', color: color.red, lineWidth: 2 },
];

/** hline(8 / 0 / -8) with the default colours (the result `hlines` carry the input colours) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 8, title: 'ASI Upper Band', color: '#94def0', linestyle: 'dashed' },
  { id: 'hline_mid', price: 0, title: 'ASI Middle Band', color: String(color.new('#94def0', 50)), linestyle: 'dashed' },
  { id: 'hline_lower', price: -8, title: 'ASI Lower Band', color: '#94def0', linestyle: 'dashed' },
];

/** fill(ASIUpperBand, ASILowerBand, color.new(fillColor, 90)) with the default colour */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: String(color.new('#94def0', 90)), title: 'ASI Background Fill' },
];

export const metadata = {
  title: 'Absolute Strength Index [ASI] (Zeiierman)',
  shortTitle: 'Absolute Strength Index [ASI] (Zeiierman)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface AsiVars {
  prevASILow: number;
  prevPriceLow: number;
  prevASIHigh: number;
  prevPriceHigh: number;
}

interface AsiRun extends BarRunState<AsiVars> {
  ma: Ma | null;
  lowest: ReturnType<typeof taStep.lowest>;
  highest: ReturnType<typeof taStep.highest>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bullPlot: Point[];
  bearPlot: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** The signal line machine of the MA type (null: an unknown type, na) */
function maStep(maType: ASIMAType, length: number): Ma | null {
  switch (maType) {
    case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'EMA': return taStep.ema(length);
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'RMA': return taStep.rma(length);
    case 'HMA': return taStep.hma(length);
    default: return null;
  }
}

function study(inputs: Partial<AbsoluteStrengthIndexInputs>): BarStudy<AsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.returnLookback;
  return {
    init() {
      const ma = maStep(cfg.maType, cfg.maLength);
      const lowest = taStep.lowest();
      const highest = taStep.highest();
      const s: AsiRun = {
        ma, lowest, highest, plot0: [], plot1: [], plot2: [], bullPlot: [], bearPlot: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [...(ma ? [ma] : []), ...(cfg.calculateDivergence ? [lowest, highest] : [])],
        vars: { prevASILow: NaN, prevPriceLow: NaN, prevASIHigh: NaN, prevPriceHigh: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, s.bullPlot, s.bearPlot, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const close = (j: number) => bars[j].close;
      // for i = 1 to returnLookback: if not na(close[i]) and not na(close[i + 1]): push(close[i] / close[i + 1] - 1)
      const returns: number[] = [];
      for (let i = 1; i <= L; i++) {
        if (b - i - 1 < 0) continue;
        const c0 = close(b - i);
        const c1 = close(b - i - 1);
        if (isNaN(c0) || isNaN(c1)) continue;
        // a close of 0 gives +-infinity (x / 0) or na (0 / 0), as in Pine
        returns.push(c0 / c1 - 1);
      }
      let value = 0.0; // ASI = 0.0
      if (returns.length > 0) {
        // array.sort(order.ascending): -infinity first, +infinity after the numbers, na last
        const sorted = [...returns].sort((x, y) => (isNaN(x) ? (isNaN(y) ? 0 : 1) : isNaN(y) ? -1 : x === y ? 0 : x - y));
        const size = sorted.length;
        const winnerIndex = Math.ceil(size * (1 - cfg.topPercentile)) - 1;
        const loserIndex = Math.ceil(size * cfg.bottomPercentile) - 1;
        const thresholdWinner = winnerIndex >= 0 && winnerIndex < size ? sorted[winnerIndex] : 0;
        const thresholdLoser = loserIndex >= 0 && loserIndex < size ? sorted[loserIndex] : 0;
        // currentReturn = close / close[returnLookback] - 1 (na before bar returnLookback; x / 0 is +-infinity)
        const currentReturn = b - L >= 0 ? close(b) / close(b - L) - 1 : NaN;
        const range = thresholdWinner - thresholdLoser;
        // not na(currentReturn) (false for +-infinity) and (thresholdWinner - thresholdLoser) != 0 (na != 0 is false,
        // infinity != 0 is true)
        if (Number.isFinite(currentReturn) && !isNaN(range) && range !== 0) {
          value = ((currentReturn - thresholdLoser) / range) * 2 - 1;
        } else {
          value = 0;
        }
      }
      const asi = value;
      const smoothingMA = s.ma ? s.ma.step(asi) : NaN;

      const bar = bars[b];
      const t = bar.time;
      const v = s.vars;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      // Divergence (ta.lowest / ta.highest run on every bar when the input is on)
      if (cfg.calculateDivergence) {
        const lowestAsi = s.lowest.step(asi, cfg.lookback);
        const highestAsi = s.highest.step(asi, cfg.lookback);
        // isASILow = ASI == ta.lowest(ASI, lookback)
        const isASILow = asi === lowestAsi;
        plFound = isASILow;
        if (isASILow) {
          bullCond = !isNaN(v.prevASILow) && gt(asi, v.prevASILow) && lt(bar.low, v.prevPriceLow);
          v.prevASILow = asi;
          v.prevPriceLow = bar.low;
        }
        // isASIHigh = ASI == ta.highest(ASI, lookback)
        const isASIHigh = asi === highestAsi;
        phFound = isASIHigh;
        if (isASIHigh) {
          bearCond = !isNaN(v.prevASIHigh) && lt(asi, v.prevASIHigh) && gt(bar.high, v.prevPriceHigh);
          v.prevASIHigh = asi;
          v.prevPriceHigh = bar.high;
        }
      }
      s.flags[0][b] = bullCond;
      s.flags[1][b] = bearCond;
      if (bullCond) s.times[0].push(t as number);
      if (bearCond) s.times[1].push(t as number);
      s.plot0[b] = { time: t, value: asi, color: cfg.asiColor };
      s.plot1[b] = { time: t, value: smoothingMA, color: cfg.maAsiColor };
      // midLinePlot = plot(0, color = na, display = display.none)
      s.plot2[b] = { time: t, value: 0 };
      // plot(plFound ? ASI : na, linewidth = 2, color = bullCond ? bullColor : na, display = display.pane)
      s.bullPlot[b] = { time: t, value: plFound ? asi : NaN, color: bullCond ? cfg.bullColor : 'transparent' };
      s.bearPlot[b] = { time: t, value: phFound ? asi : NaN, color: bearCond ? cfg.bearColor : 'transparent' };
      // plotshape(bullCond ? ASI : na, text = "Bull", style = shape.labelup, location = location.absolute)
      if (bullCond) {
        s.markers.push({ time: t, position: 'atPriceBottom', price: asi, shape: 'labelUp', color: cfg.bullColor,
          text: 'Bull', textColor: cfg.textColor });
      }
      // plotshape(bearCond ? ASI : na, text = "Bear", style = shape.labeldown, location = location.absolute)
      if (bearCond) {
        s.markers.push({ time: t, position: 'atPriceTop', price: asi, shape: 'labelDown', color: cfg.bearColor,
          text: 'Bear', textColor: cfg.textColor });
      }
    },
    result(s, bars) {
      const n = bars.length;
      // fill(ASIPlot, midLinePlot, 8, 5, top_color = color.new(obColor, 0), bottom_color = color.new(obColor, 100))
      // fill(ASIPlot, midLinePlot, -5, -8, top_color = color.new(osColor, 100), bottom_color = color.new(osColor, 0))
      const obTop = String(color.new(cfg.obColor, 0));
      const obBottom = String(color.new(cfg.obColor, 100));
      const osTop = String(color.new(cfg.osColor, 100));
      const osBottom = String(color.new(cfg.osColor, 0));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 1 },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: s.plot2.slice(),
          plot3: s.bullPlot.slice(),
          plot4: s.bearPlot.slice(),
        },
        hlines: [
          { value: 8, options: { title: 'ASI Upper Band', color: cfg.fillColor, linestyle: 'dashed' } },
          { value: 0, options: { title: 'ASI Middle Band', color: String(color.new(cfg.fillColor, 50)), linestyle: 'dashed' } },
          { value: -8, options: { title: 'ASI Lower Band', color: cfg.fillColor, linestyle: 'dashed' } },
        ],
        fills: [
          // fill(ASIUpperBand, ASILowerBand, color = color.new(fillColor, 90))
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'ASI Background Fill' },
            colors: new Array<string>(n).fill(String(color.new(cfg.fillColor, 90))) },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Overbought Gradient Fill' },
            gradient: { topValue: new Array(n).fill(8), bottomValue: new Array(n).fill(5),
              topColor: new Array(n).fill(obTop), bottomColor: new Array(n).fill(obBottom) } },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Oversold Gradient Fill' },
            gradient: { topValue: new Array(n).fill(-5), bottomValue: new Array(n).fill(-8),
              topColor: new Array(n).fill(osTop), bottomColor: new Array(n).fill(osBottom) } },
        ],
        markers: s.markers.slice(),
        // alertcondition(bullCond, ...) / alertcondition(bearCond, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AbsoluteStrengthIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AbsoluteStrengthIndexInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence' },
];

export const AbsoluteStrengthIndex = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
