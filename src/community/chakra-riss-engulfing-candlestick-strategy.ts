/**
 * CHAKRA RISS ENGULFING CANDLESTICK STRATEGY
 *
 * An RSI of `len` bars (RMA of the gains and of the losses) colours the bars green above the up level and red below
 * the down level. BUY when the RSI moves above the up level with the close above the SMA 50 of the close; SELL when it
 * moves below the down level with the close below the SMA 50. A signal opens a trade when none is open (entry price =
 * close); the trade closes when the close reaches the previous low / high or 3 % from the entry price. While a trade
 * is open, the long and short stop loss (previous low / high) and take profit (entry +3 % / -3 %) levels are drawn.
 *
 * Reference: "CHAKRA RISS ENGULFING CANDLESTICK STRATEGY" by Tradewith_Riss
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChakraRissEngulfingCandlestickStrategyInputs {
  /** RSI length */
  len: number;
  /** RSI up level */
  len1: number;
  /** RSI down level */
  len2: number;
}

export const defaultInputs: ChakraRissEngulfingCandlestickStrategyInputs = {
  len: 8,
  len1: 50,
  len2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 8, min: 1 },
  { id: 'len1', type: 'int', title: 'UpLevel', defval: 50 },
  { id: 'len2', type: 'int', title: 'DownLevel', defval: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: color.black, lineWidth: 3 },
  { id: 'plot1', title: 'Stop Loss (Long)', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Take Profit (Long)', color: color.green, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Stop Loss (Short)', color: color.green, lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Take Profit (Short)', color: color.red, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'CHAKRA RISS ENGULFING CANDLESTICK STRATEGY',
  shortTitle: 'CHAKRA RISS',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface ChakraVars {
  /** var float entryPrice = na */
  entryPrice: number;
  /** var bool inTrade = false */
  inTrade: boolean;
}

interface ChakraRun extends BarRunState<ChakraVars> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  sma: WindowSma;
  rsi: number[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<ChakraRissEngulfingCandlestickStrategyInputs>): BarStudy<ChakraRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const up = taStep.rma(cfg.len);
      const down = taStep.rma(cfg.len);
      const sma = new WindowSma(50);
      const s: ChakraRun = {
        up, down, sma, rsi: [], plots: [[], [], [], [], []], markers: [], barColors: [],
        steps: [up, down, sma], vars: { entryPrice: NaN, inTrade: false }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors];
      s.series = [s.rsi, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // up = ta.rma(math.max(ta.change(close), 0), len); down = ta.rma(-math.min(ta.change(close), 0), len)
      // (math.max / math.min of na are na)
      const d = i > 0 ? b.close - bars[i - 1].close : NaN;
      const u = s.up.step(isNaN(d) ? NaN : Math.max(d, 0));
      const dn = s.down.step(isNaN(d) ? NaN : -Math.min(d, 0));
      // rsi = 100 - (100 / (1 + up / down)): plain divisions (down = 0 gives 100, 0 / 0 gives na)
      const rsi = 100 - 100 / (1 + u / dn);
      s.rsi[i] = rsi;
      const out = s.sma.step(b.close);

      const isGreen = gt(rsi, cfg.len1);
      const isRed = lt(rsi, cfg.len2);
      if (isGreen) s.barColors.push({ time: b.time, color: color.green });
      else if (isRed) s.barColors.push({ time: b.time, color: color.red });

      const prevRsi = i > 0 ? s.rsi[i - 1] : NaN;
      const buySignal = isGreen && le(prevRsi, cfg.len1) && gt(b.close, out);
      const sellSignal = isRed && ge(prevRsi, cfg.len2) && lt(b.close, out);
      // plotshape(buySignal, style = shape.labelup, location = location.belowbar, color = color.green, text = "BUY")
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: '#2962FF', size: 'auto' });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: '#2962FF', size: 'auto' });
      }

      // Levels use the entry price of the previous bar (computed before the entry update)
      const longStopLoss = i > 0 ? bars[i - 1].low : NaN;
      const longTakeProfit = v.entryPrice * 1.03;
      const shortStopLoss = i > 0 ? bars[i - 1].high : NaN;
      const shortTakeProfit = v.entryPrice * 0.97;

      if (buySignal && !v.inTrade) {
        v.entryPrice = b.close;
        v.inTrade = true;
      }
      if (sellSignal && !v.inTrade) {
        v.entryPrice = b.close;
        v.inTrade = true;
      }
      const longExit = le(b.close, longStopLoss) || ge(b.close, longTakeProfit);
      const shortExit = ge(b.close, shortStopLoss) || le(b.close, shortTakeProfit);
      if (longExit || shortExit) v.inTrade = false;

      const show = v.inTrade && !isNaN(v.entryPrice);
      const [p0, p1, p2, p3, p4] = s.plots;
      p0[i] = { time: b.time, value: out, color: color.black };
      p1[i] = { time: b.time, value: show ? longStopLoss : NaN, color: color.red };
      p2[i] = { time: b.time, value: show ? longTakeProfit : NaN, color: color.green };
      p3[i] = { time: b.time, value: show ? shortStopLoss : NaN, color: color.green };
      p4[i] = { time: b.time, value: show ? shortTakeProfit : NaN, color: color.red };
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4 },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChakraRissEngulfingCandlestickStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ChakraRissEngulfingCandlestickStrategyInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ChakraRissEngulfingCandlestickStrategy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
