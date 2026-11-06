/**
 * ICT & RTM Price Action Indicator
 *
 * Supply zone = highest high of 50 bars, demand zone = lowest low of 50 bars (both plotted). A bullish reversal bar
 * closes above its SMA(length) and above the demand zone, a bearish reversal bar closes below the SMA and below the
 * supply zone. A reversal is confirmed on the next bar when that bar closes in the same direction (close > open or
 * close < open) and the reversal bar had a volume above minVolumeFactor times the 20-bar average volume. A state
 * (in buy / in sell) gives "BUY" and "SELL" labels: a buy when no state is open, a switch from buy to sell on a
 * bearish confirmation and from sell to buy on a bullish confirmation. A "TRADE" triangle marks a confirmation
 * beyond the zone while no state is open.
 *
 * Reference: "ICT & RTM Price Action Indicator" by behradmojtahedi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IctRtmPriceActionIndicatorInputs {
  /** Moving average length */
  length: number;
  /** Minimum volume factor */
  minVolumeFactor: number;
}

export const defaultInputs: IctRtmPriceActionIndicatorInputs = {
  length: 14,
  minVolumeFactor: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'طول میانگین متحرک', defval: 14, min: 1 },
  { id: 'minVolumeFactor', type: 'float', title: 'ضریب حداقل حجم', defval: 1.5, min: 1.0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'نواحی عرضه', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'نواحی تقاضا', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'ICT & RTM Price Action Indicator',
  shortTitle: 'ICT & RTM Price Action Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface IctVars {
  /** var bool isInBuy = false / var bool isInSell = false */
  isInBuy: boolean;
  isInSell: boolean;
  /** bullishReversal[1], bearishReversal[1] (na on bar 0: false), volumeFilter[1] */
  prevBullRev: boolean;
  prevBearRev: boolean;
  prevVolFilter: boolean;
}

interface IctRun extends BarRunState<IctVars> {
  sma: WindowSma;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  avgVol: WindowSma;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<IctRtmPriceActionIndicatorInputs>): BarStudy<IctRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, minVolumeFactor } = cfg;

  return {
    init() {
      const sma = new WindowSma(length);
      const highest = new WindowExtreme(false, 50);
      const lowest = new WindowExtreme(true, 50);
      const avgVol = new WindowSma(20);
      const s: IctRun = {
        sma, highest, lowest, avgVol, plot0: [], plot1: [], markers: [],
        steps: [sma, highest, lowest, avgVol],
        vars: { isInBuy: false, isInSell: false, prevBullRev: false, prevBearRev: false, prevVolFilter: false },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const smaValue = s.sma.step(b.close);
      const supplyZone = s.highest.step(b.high);
      const demandZone = s.lowest.step(b.low);
      const volume = b.volume ?? NaN;
      const avgVolume = s.avgVol.step(volume);
      s.plot0[i] = { time: t, value: supplyZone };
      s.plot1[i] = { time: t, value: demandZone };

      const volumeFilter = gt(volume, avgVolume * minVolumeFactor);
      const bullishReversal = gt(b.close, smaValue) && gt(b.close, demandZone);
      const bearishReversal = lt(b.close, smaValue) && lt(b.close, supplyZone);
      const bullishConfirm = v.prevBullRev && gt(b.close, b.open) && v.prevVolFilter;
      const bearishConfirm = v.prevBearRev && lt(b.close, b.open) && v.prevVolFilter;
      const buyExit = bearishConfirm;
      const sellExit = bullishConfirm;

      let showBuySignal = false;
      let showSellSignal = false;
      if (bullishConfirm && !v.isInBuy && !v.isInSell) {
        v.isInBuy = true;
        v.isInSell = false;
        showBuySignal = true;
      }
      if (buyExit && v.isInBuy) {
        v.isInBuy = false;
        if (bearishConfirm) {
          v.isInSell = true;
          showSellSignal = true;
        }
      }
      if (sellExit && v.isInSell) {
        v.isInSell = false;
        if (bullishConfirm) {
          v.isInBuy = true;
          showBuySignal = true;
        }
      }
      const showCombinedSignal = (bullishConfirm && gt(b.close, demandZone) && !v.isInBuy && !v.isInSell)
        || (bearishConfirm && lt(b.close, supplyZone) && !v.isInSell && !v.isInBuy);

      // plotshape(..., location.belowbar / abovebar, shape.labelup / labeldown / triangledown), default text colour
      if (showBuySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
      }
      if (showSellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
      }
      if (showCombinedSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleDown', color: color.blue, text: 'TRADE', textColor: color.blue });
      }

      v.prevBullRev = bullishReversal;
      v.prevBearRev = bearishReversal;
      v.prevVolFilter = volumeFilter;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IctRtmPriceActionIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IctRtmPriceActionIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const IctRtmPriceActionIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
