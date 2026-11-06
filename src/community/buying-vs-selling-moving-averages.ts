/**
 * Buying vs Selling Moving Averages (Scalp Meter)
 *
 * Splits the bar volume into buying and selling volume by the close position in the bar range:
 * buyVol = volume * (close - low) / (high - low), sellVol = volume * (high - close) / (high - low) (half and half
 * when the range is 0). Draws a moving average (EMA / SMA / WMA / VWMA / HMA) of each, the total volume as columns
 * (teal on an up bar, red on a down bar) and a fill between the two averages, teal when buying dominates, else red.
 *
 * Reference: "Buying vs Selling Moving Averages (Scalp Meter)" by codycolton97
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © codycolton97
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type BuyingVsSellingMaType = 'EMA' | 'SMA' | 'WMA' | 'VWMA' | 'HMA';

export interface BuyingVsSellingMovingAveragesInputs {
  maType: BuyingVsSellingMaType;
  /** MA length of the buying volume */
  buyLength: number;
  /** MA length of the selling volume */
  sellLength: number;
  /** Show the total volume histogram */
  showDelta: boolean;
}

export const defaultInputs: BuyingVsSellingMovingAveragesInputs = {
  maType: 'EMA',
  buyLength: 14,
  sellLength: 14,
  showDelta: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA', 'VWMA', 'HMA'] },
  { id: 'buyLength', type: 'int', title: 'Buying Volume MA Length', defval: 14, min: 1 },
  { id: 'sellLength', type: 'int', title: 'Selling Volume MA Length', defval: 14, min: 1 },
  { id: 'showDelta', type: 'bool', title: 'Show Volume Histogram', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Histogram', color: String(color.new(color.teal, 50)), style: 'columns' },
  { id: 'plot1', title: 'Buying Vol MA', color: String(color.new(color.teal, 0)), lineWidth: 2 },
  { id: 'plot2', title: 'Selling Vol MA', color: String(color.new(color.red, 0)), lineWidth: 2 },
  { id: 'plot3', title: 'Buying Vol MA (fill)', color: '#2962FF', display: 'none' },
  { id: 'plot4', title: 'Selling Vol MA (fill)', color: '#2962FF', display: 'none' },
];

export const metadata = {
  title: 'Volume Delta MA',
  shortTitle: 'Volume Delta MA',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface BvsRun extends BarRunState<Record<string, never>> {
  buy: Ma;
  sell: Ma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  fillColors: string[];
}

function study(inputs: Partial<BuyingVsSellingMovingAveragesInputs>): BarStudy<BvsRun, IndicatorResult> {
  const { maType, buyLength, sellLength, showDelta } = { ...defaultInputs, ...inputs };
  // ta.hma(src, 1) runs ta.wma(src, 0): a Pine runtime error
  const hmaError = (len: number) => maType === 'HMA' && Math.floor(len / 2) < 1;
  const calcMA = (len: number): Ma => {
    switch (maType) {
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(len);
      case 'HMA': {
        if (hmaError(len)) return { step: () => NaN, commit: () => {} };
        const m = taStep.hma(len);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      default: { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const up = String(color.new(color.teal, 50));
  const down = String(color.new(color.red, 50));
  const fillUp = String(color.new(color.teal, 85));
  const fillDown = String(color.new(color.red, 85));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const buy = calcMA(buyLength);
      const sell = calcMA(sellLength);
      const s: BvsRun = {
        buy, sell, plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], fillColors: [],
        steps: [buy, sell], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      if (hmaError(buyLength) || hmaError(sellLength)) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const candleRange = b.high - b.low;
      const buyRatio = gt(candleRange, 0) ? (b.close - b.low) / candleRange : 0.5;
      const sellRatio = gt(candleRange, 0) ? (b.high - b.close) / candleRange : 0.5;
      const buyMA = s.buy.step(volume * buyRatio, volume);
      const sellMA = s.sell.step(volume * sellRatio, volume);
      s.plot0[i] = { time: b.time, value: showDelta ? fin(volume) : NaN, color: ge(b.close, b.open) ? up : down };
      s.plot1[i] = { time: b.time, value: fin(buyMA) };
      s.plot2[i] = { time: b.time, value: fin(sellMA) };
      s.plot3[i] = { time: b.time, value: fin(buyMA) };
      s.plot4[i] = { time: b.time, value: fin(sellMA) };
      s.fillColors[i] = gt(buyMA, sellMA) ? fillUp : fillDown;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 50)), linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Dominance Fill' }, colors: s.fillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyingVsSellingMovingAveragesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyingVsSellingMovingAveragesInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyingVsSellingMovingAverages = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
