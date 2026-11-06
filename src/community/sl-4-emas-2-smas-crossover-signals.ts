/**
 * SL - 4 EMAs, 2 SMAs & Crossover Signals
 *
 * Four EMAs and two SMAs of the source. A BUY label marks a crossover of EMA 1 above EMA 2 when the four EMAs are in
 * rising order (EMA 1 > EMA 2 > EMA 3 > EMA 4), the close is above SMA 2, the RSI is above 50, every EMA is above its
 * previous value and the volume is above its 20-bar SMA. A SELL label marks the mirror case (crossunder, falling
 * order, close below SMA 2, RSI below 50, every EMA below its previous value, the same volume filter).
 *
 * Reference: "Enhanced 4EMA, 2SMA with Filters" by MVP202020205
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Sl4Emas2SmasCrossoverSignalsInputs {
  ema1Length: number;
  ema2Length: number;
  ema3Length: number;
  ema4Length: number;
  sma1Length: number;
  sma2Length: number;
  rsiPeriod: number;
  /** Source of the EMAs, SMAs and RSI */
  priceSource: SourceType;
}

export const defaultInputs: Sl4Emas2SmasCrossoverSignalsInputs = {
  ema1Length: 10,
  ema2Length: 21,
  ema3Length: 50,
  ema4Length: 100,
  sma1Length: 20,
  sma2Length: 200,
  rsiPeriod: 14,
  priceSource: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1Length', type: 'int', title: 'EMA 1 Length', defval: 10, min: 1 },
  { id: 'ema2Length', type: 'int', title: 'EMA 2 Length', defval: 21, min: 1 },
  { id: 'ema3Length', type: 'int', title: 'EMA 3 Length', defval: 50, min: 1 },
  { id: 'ema4Length', type: 'int', title: 'EMA 4 Length', defval: 100, min: 1 },
  { id: 'sma1Length', type: 'int', title: 'SMA 1 Length', defval: 20, min: 1 },
  { id: 'sma2Length', type: 'int', title: 'SMA 2 Length', defval: 200, min: 1 },
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14 },
  { id: 'priceSource', type: 'source', title: 'Price Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 2', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'EMA 3', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'EMA 4', color: color.orange, lineWidth: 2 },
  { id: 'plot4', title: 'SMA 1', color: color.purple, lineWidth: 3 },
  { id: 'plot5', title: 'SMA 2', color: color.white, lineWidth: 3 },
];

export const metadata = {
  title: 'Enhanced 4EMA, 2SMA with Filters',
  shortTitle: '4EMA2SMA+F',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Sma = WindowSma;
type Ema = ReturnType<typeof taStep.ema>;

interface Sl4Run extends BarRunState<Record<string, never>> {
  ema1: Ema;
  ema2: Ema;
  ema3: Ema;
  ema4: Ema;
  sma1: Sma;
  sma2: Sma;
  rsi: ReturnType<typeof taStep.rsi>;
  volSma: Sma;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  /** ema1..ema4, sma1, sma2 */
  values: number[][];
  plots: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<Sl4Emas2SmasCrossoverSignalsInputs>): BarStudy<Sl4Run, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.priceSource);
  const cur = new Array<number>(6);
  return {
    fullRunReason: () => (isBarSource(cfg.priceSource) ? null : 'source of another study'),
    init() {
      const s: Sl4Run = {
        ema1: taStep.ema(cfg.ema1Length), ema2: taStep.ema(cfg.ema2Length), ema3: taStep.ema(cfg.ema3Length),
        ema4: taStep.ema(cfg.ema4Length), sma1: new WindowSma(cfg.sma1Length), sma2: new WindowSma(cfg.sma2Length), rsi: taStep.rsi(cfg.rsiPeriod),
        volSma: new WindowSma(20), crossUp: taStep.crossover(), crossDown: taStep.crossunder(),
        values: Array.from({ length: 6 }, () => []), plots: Array.from({ length: 6 }, () => []), markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ema1, s.ema2, s.ema3, s.ema4, s.sma1, s.sma2, s.rsi, s.volSma, s.crossUp, s.crossDown];
      s.lists = [s.markers];
      s.series = [...s.values, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const ema1 = s.ema1.step(src);
      const ema2 = s.ema2.step(src);
      const ema3 = s.ema3.step(src);
      const ema4 = s.ema4.step(src);
      const sma1 = s.sma1.step(src);
      const sma2 = s.sma2.step(src);
      const rsiValue = s.rsi.step(src);
      const volSma = s.volSma.step(b.volume ?? NaN);
      // ta.crossover / ta.crossunder (exact comparisons, with the last bar where both values were not na)
      const crossUp = s.crossUp.step(ema1, ema2);
      const crossDown = s.crossDown.step(ema1, ema2);
      cur[0] = ema1;
      cur[1] = ema2;
      cur[2] = ema3;
      cur[3] = ema4;
      cur[4] = sma1;
      cur[5] = sma2;
      for (let k = 0; k < 6; k++) {
        s.values[k][i] = cur[k];
        s.plots[k][i] = { time: b.time, value: cur[k] };
      }
      const prev = (k: number) => (i > 0 ? s.values[k][i - 1] : NaN);

      const isBullishTrend = gt(ema1, ema2) && gt(ema2, ema3) && gt(ema3, ema4);
      const isBearishTrend = lt(ema1, ema2) && lt(ema2, ema3) && lt(ema3, ema4);
      const priceAboveLongTerm = gt(b.close, sma2);
      const priceBelowLongTerm = lt(b.close, sma2);
      const rsiBullish = gt(rsiValue, 50);
      const rsiBearish = lt(rsiValue, 50);
      const allSlopesUp = gt(ema1, prev(0)) && gt(ema2, prev(1)) && gt(ema3, prev(2)) && gt(ema4, prev(3));
      const allSlopesDn = lt(ema1, prev(0)) && lt(ema2, prev(1)) && lt(ema3, prev(2)) && lt(ema4, prev(3));
      const volumeFilter = gt(b.volume ?? NaN, volSma);
      const buySignal = crossUp && isBullishTrend && priceAboveLongTerm && rsiBullish && allSlopesUp && volumeFilter;
      const sellSignal = crossDown && isBearishTrend && priceBelowLongTerm && rsiBearish && allSlopesDn && volumeFilter;
      // plotshape(buySignal, "Buy Signal", location.belowbar, color.lime, shape.labelup, text = "BUY",
      //   textcolor = color.black, size = size.small)
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: color.black, size: 'small' });
      }
      // plotshape(sellSignal, "Sell Signal", location.abovebar, color.red, shape.labeldown, text = "SELL",
      //   textcolor = color.white, size = size.small)
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Sl4Emas2SmasCrossoverSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Sl4Emas2SmasCrossoverSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const Sl4Emas2SmasCrossoverSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
