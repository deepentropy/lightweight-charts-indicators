/**
 * LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)
 *
 * Five SMAs of the close (100, 48, 36, 24, 12). A BUY triangle is drawn when the close is above all five SMAs and
 * every filter passes: ATR(14) above 0.8 times its 100-bar SMA, a body larger than 35 % of the range, volume above
 * 0.8 times its 50-bar SMA, a range larger than 0.4 ATR, a distance of more than 0.2 ATR from every SMA,
 * RSI(14) above 55 and ADX(14, 14) above 20. A SELL triangle is the mirror (close below all SMAs, RSI below 45).
 * After a signal, the next one needs more than 10 bars.
 *
 * Reference: "LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)" by jonesdaniel2112
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AllInOneMaStackScalperInputs {}

export const defaultInputs: AllInOneMaStackScalperInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 100', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'MA 48', color: color.orange, lineWidth: 2 },
  { id: 'plot2', title: 'MA 36', color: color.purple, lineWidth: 2 },
  { id: 'plot3', title: 'MA 24', color: color.green, lineWidth: 2 },
  { id: 'plot4', title: 'MA 12', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)',
  shortTitle: 'LTF MA Stack Breakout (Ultra Filtered, ADX tuple fix)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface StackVars {
  /** var int lastSignalBar = na */
  lastSignalBar: number;
}

interface StackRun extends BarRunState<StackVars> {
  smas: WindowSma[];
  atr: ReturnType<typeof taStep.atr>;
  atrAvg: WindowSma;
  volMA: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  dmi: ReturnType<typeof taStep.dmi>;
  plots: Point[][];
  markers: MarkerData[];
}

const MA_LENGTHS = [100, 48, 36, 24, 12];
const MA_COLORS = [color.blue, color.orange, color.purple, color.green, color.red];

function study(): BarStudy<StackRun, Result> {
  const minBars = 10;
  return {
    init() {
      const s: StackRun = {
        smas: MA_LENGTHS.map((l) => new WindowSma(l)), atr: taStep.atr(14), atrAvg: new WindowSma(100),
        volMA: new WindowSma(50), rsi: taStep.rsi(14), dmi: taStep.dmi(14, 14),
        plots: MA_LENGTHS.map(() => []), markers: [],
        steps: [], vars: { lastSignalBar: NaN }, lists: [], series: [],
      };
      s.steps = [...s.smas, s.atr, s.atrAvg, s.volMA, s.rsi, s.dmi];
      s.lists = [s.markers];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const mas = s.smas.map((m) => m.step(b.close));
      // ATR filter
      const atr = s.atr.step(b.high, b.low, b.close);
      const atrAvg = s.atrAvg.step(atr);
      // Volume filter: vol = na(volume) ? 1 : volume
      const vol = b.volume === undefined || b.volume === null || isNaN(b.volume) ? 1 : b.volume;
      const volMA = s.volMA.step(vol);
      const rsi = s.rsi.step(b.close);
      const [, , adx] = s.dmi.step(b.high, b.low, b.close);

      const validATR = gt(atr, atrAvg * 0.8);
      const body = Math.abs(b.close - b.open);
      const candleRange = b.high - b.low;
      // A plain division: a zero range is skipped by the left side of the lazy `and`
      const isStrongCandle = gt(candleRange, 0) && gt(body / candleRange, 0.35);
      const validVol = gt(vol, volMA * 0.8);
      const isBigCandle = gt(candleRange, atr * 0.4);
      const aboveAll = mas.every((m) => gt(b.close, m));
      const belowAll = mas.every((m) => lt(b.close, m));
      const minDist = atr * 0.2;
      const farFromAllMAs = mas.every((m) => gt(Math.abs(b.close - m), minDist));
      const rsiBuy = gt(rsi, 55);
      const rsiSell = lt(rsi, 45);
      const trendActive = gt(adx, 20);
      // bar_index - lastSignalBar > minBars: integers (the bar_index origin does not change the difference)
      const spaced = isNaN(v.lastSignalBar) || i - v.lastSignalBar > minBars;
      const common = validATR && isStrongCandle && validVol && isBigCandle && farFromAllMAs && trendActive && spaced;
      const buySignal = aboveAll && common && rsiBuy;
      const sellSignal = belowAll && common && rsiSell;
      if (buySignal || sellSignal) v.lastSignalBar = i;

      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small',
          text: 'BUY', textColor: '#2962FF' });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small',
          text: 'SELL', textColor: '#2962FF' });
      }
      for (let k = 0; k < mas.length; k++) s.plots[k][i] = { time: b.time, value: mas[k], color: MA_COLORS[k] };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<AllInOneMaStackScalperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<AllInOneMaStackScalperInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(_inputs).update(bars));
}

export const AllInOneMaStackScalper = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
