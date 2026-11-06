/**
 * Community MoneyLine
 *
 * An ATR trailing stop on Heikin-Ashi prices (or plain prices). Long stop = close - ATR * depth, short stop =
 * close + ATR * depth; each stop only moves in the trend direction while the previous close is beyond the previous
 * stop. The trend turns bearish when the low breaks below the previous stop and bullish when the high breaks above it;
 * an optional momentum filter also asks the close to be below / above an EMA. The line (green / red) breaks on a flip
 * bar, a cloud fills the space between the line and the close, and labels mark the flips.
 *
 * Reference: "Community MoneyLine" by rafstar_kaczmarek
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CommunityMoneylineInputs {
  /** ATR length */
  atrPeriod: number;
  /** ATR multiplier of the stop distance */
  multiplier: number;
  /** Use Heikin-Ashi close / high / low */
  useHA: boolean;
  /** Label distance from the stop, in ATR */
  offsetMult: number;
  /** A flip also needs the close below (bearish) / above (bullish) the EMA */
  filterNoise: boolean;
  /** Length of the filter EMA (of the close) */
  emaLength: number;
}

export const defaultInputs: CommunityMoneylineInputs = {
  atrPeriod: 7,
  multiplier: 3.5,
  useHA: true,
  offsetMult: 0.6,
  filterNoise: false,
  emaLength: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Sensitivity', defval: 7, min: 1 },
  { id: 'multiplier', type: 'float', title: 'Trend Depth', defval: 3.5, step: 0.1 },
  { id: 'useHA', type: 'bool', title: 'Use Heikin Ashi Smoothing', defval: true },
  { id: 'offsetMult', type: 'float', title: 'Label Offset', defval: 0.6, step: 0.1 },
  { id: 'filterNoise', type: 'bool', title: 'Enable Momentum Filter', defval: false },
  { id: 'emaLength', type: 'int', title: 'Filter EMA Length', defval: 50, min: 1 },
];

const LINE_BULL = String(color.new(color.green, 0));
const LINE_BEAR = String(color.new(color.red, 0));
const FILL_BULL = String(color.new(color.green, 85));
const FILL_BEAR = String(color.new(color.red, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MoneyLine', color: LINE_BULL, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Price Reference', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Community MoneyLine',
  shortTitle: 'Community MoneyLine',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface MoneylineVars {
  haOpen: number;
  haClosePrev: number;
  /** price_close[1] */
  priceClosePrev: number;
  /** var float trailStop = na (its value at the start of a bar is trailStop[1]) */
  trailStop: number;
  /** var bool isBullish = true */
  isBullish: boolean;
}

interface MoneylineRun extends BarRunState<MoneylineVars> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number }[];
  fillColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<CommunityMoneylineInputs>): BarStudy<MoneylineRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(cfg.emaLength);
      const atr = taStep.atr(cfg.atrPeriod);
      const s: MoneylineRun = {
        ema, atr, plot0: [], plot1: [], fillColors: [], markers: [], steps: [ema, atr],
        vars: { haOpen: NaN, haClosePrev: NaN, priceClosePrev: NaN, trailStop: NaN, isBullish: true },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const filterEma = s.ema.step(b.close);
      const atrValue = s.atr.step(b.high, b.low, b.close);
      // Heikin-Ashi: haOpen := na(haOpen[1]) ? (open + close) / 2 : (haOpen[1] + haClose[1]) / 2
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      const haOpen = i === 0 ? (b.open + b.close) / 2 : (v.haOpen + v.haClosePrev) / 2;
      v.haOpen = haOpen;
      const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
      const haLow = Math.min(b.low, Math.min(haOpen, haClose));
      const priceClose = cfg.useHA ? haClose : b.close;
      const priceHigh = cfg.useHA ? haHigh : b.high;
      const priceLow = cfg.useHA ? haLow : b.low;

      const atr = atrValue * cfg.multiplier;
      let longStop = priceClose - atr;
      let shortStop = priceClose + atr;
      const prevStop = v.trailStop; // trailStop[1]
      const priceClosePrev = v.priceClosePrev;
      // if not (trailStop[1] != trailStop[1]): na != na is false in Pine, so this block runs on every bar
      longStop = gt(priceClosePrev, prevStop) ? Math.max(longStop, prevStop) : longStop;
      shortStop = lt(priceClosePrev, prevStop) ? Math.min(shortStop, prevStop) : shortStop;

      // prevIsBullish = bar_index > 0 ? isBullish[1] : true equals the current var value: the else branch keeps it
      let isBullish = v.isBullish;
      let flipTriggered = false;
      if (isBullish && lt(priceLow, prevStop)) {
        if (!cfg.filterNoise || lt(b.close, filterEma)) {
          isBullish = false;
          flipTriggered = true;
        }
      } else if (!isBullish && gt(priceHigh, prevStop)) {
        if (!cfg.filterNoise || gt(b.close, filterEma)) {
          isBullish = true;
          flipTriggered = true;
        }
      }
      v.isBullish = isBullish;
      const trailStop = isBullish ? longStop : shortStop;
      v.trailStop = trailStop;
      const displayStop = flipTriggered ? NaN : trailStop;

      s.plot0[i] = { time: b.time, value: Number.isFinite(displayStop) ? displayStop : NaN, color: isBullish ? LINE_BULL : LINE_BEAR };
      s.plot1[i] = { time: b.time, value: b.close };
      s.fillColors[i] = isBullish ? FILL_BULL : FILL_BEAR;

      // plotshape(..., style = shape.labelup / labeldown, location = location.absolute, size = size.small)
      const labelBuffer = atrValue * cfg.offsetMult;
      if (flipTriggered) {
        const price = isBullish ? trailStop - labelBuffer : trailStop + labelBuffer;
        if (Number.isFinite(price)) {
          s.markers.push(isBullish
            ? { time: b.time, position: 'atPriceBottom', price, shape: 'labelUp', color: color.green, text: 'Bullish', textColor: color.white, size: 'small' }
            : { time: b.time, position: 'atPriceTop', price, shape: 'labelDown', color: color.red, text: 'Bearish', textColor: color.white, size: 'small' });
        }
      }

      v.haClosePrev = haClose;
      v.priceClosePrev = priceClose;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(mlPlot, pricePlot, color = fillColor, title = 'MoneyLine Cloud')
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'MoneyLine Cloud' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CommunityMoneylineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CommunityMoneylineInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CommunityMoneyline = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
