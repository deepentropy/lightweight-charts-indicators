/**
 * Anchored VWAP with Buy/Sell Signals
 *
 * Volume-weighted average of hlc3 from the anchor date: the sums of volume and of volume * hlc3 start on the first
 * bar whose open time is at or after the anchor (na before it). A BUY label is drawn when the close crosses over the
 * AVWAP, a SELL label when it crosses under, with a light green / red background on these bars.
 *
 * Reference: "Anchored VWAP with Buy/Sell Signals" by kmootoo89
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AnchoredVwapWithBuySellSignalsInputs {
  /** Anchor date (UNIX ms, Pine input.time) */
  anchorDate: number;
}

/** timestamp('2023-10-01 00:00') (UTC) */
const DEFAULT_ANCHOR = Date.UTC(2023, 9, 1);

export const defaultInputs: AnchoredVwapWithBuySellSignalsInputs = {
  anchorDate: DEFAULT_ANCHOR,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchorDate', type: 'time', title: 'Anchor Date', defval: DEFAULT_ANCHOR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AVWAP', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Anchored VWAP with Buy/Sell Signals',
  shortTitle: 'Anchored VWAP with Buy/Sell Signals',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type Point = { time: number; value: number; color: string };

interface AvwapVars {
  /** var float cumulative_volume = na */
  cumVol: number;
  /** var float cumulative_price_volume = na */
  cumPv: number;
}

interface AvwapRun extends BarRunState<AvwapVars> {
  buy: ReturnType<typeof taStep.crossover>;
  sell: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AnchoredVwapWithBuySellSignalsInputs>): BarStudy<AvwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyBg = String(color.new(color.green, 90));
  const sellBg = String(color.new(color.red, 90));
  return {
    init() {
      const buy = taStep.crossover();
      const sell = taStep.crossunder();
      const s: AvwapRun = {
        buy, sell, plot0: [], markers: [], bgColors: [], steps: [buy, sell], lists: [], series: [],
        vars: { cumVol: NaN, cumPv: NaN },
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      if (b.time * 1000 >= cfg.anchorDate) {
        // nz(cumulative) + volume (an na volume gives na, and the sums restart from 0 on the next bar)
        v.cumVol = (isNaN(v.cumVol) ? 0 : v.cumVol) + (b.volume ?? NaN);
        v.cumPv = (isNaN(v.cumPv) ? 0 : v.cumPv) + ((b.volume ?? NaN) * (b.high + b.low + b.close)) / 3;
      } else {
        v.cumVol = NaN;
        v.cumPv = NaN;
      }
      // A plain division: x / 0 is +-infinity (0 / 0 na); the crossings use it, the plot shows na
      const avwap = v.cumPv / v.cumVol;
      const buy = s.buy.step(b.close, avwap);
      const sell = s.sell.step(b.close, avwap);

      const time = b.time;
      // plotshape(buy_signal, 'Buy Signal', location.belowbar, color.green, shape.labelup, text = 'BUY', size.small);
      // no textcolor: the Pine default text colour (color.blue)
      if (buy) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue, size: 'small' });
      }
      if (sell) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue, size: 'small' });
      }
      // bgcolor(buy_signal ? color.new(color.green, 90) : na); bgcolor(sell_signal ? color.new(color.red, 90) : na)
      if (buy) s.bgColors.push({ time, color: buyBg });
      if (sell) s.bgColors.push({ time, color: sellBg });
      s.plot0[i] = { time: time as number, value: Number.isFinite(avwap) ? avwap : NaN, color: color.blue };
    },
    copyVars: (v) => ({ ...v }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AnchoredVwapWithBuySellSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AnchoredVwapWithBuySellSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AnchoredVwapWithBuySellSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
