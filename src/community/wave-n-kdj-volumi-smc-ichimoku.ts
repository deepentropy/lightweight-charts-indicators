/**
 * Wave N + KDJ + Volumi + SMC + Ichimoku
 *
 * KDJ: rsv = (close - lowest(low, 9)) / (highest(high, 9) - lowest(low, 9)) * 100, K = sma(rsv, 3),
 * D = sma(K, 3), J = 3K - 2D. An N wave up is a higher high and higher low followed by a high above the previous
 * high (N wave down: the mirror). BUY: N wave up, J > 50, volume above its 20-bar EMA and close above the
 * Kijun-sen; SELL: the mirror. Early warnings mark J crossing 50. The background shows BUY / SELL bars; the
 * Ichimoku Tenkan-sen (9), Kijun-sen (26), Senkou Span A and Span B (52) are drawn without offset.
 *
 * Reference: "Wave N + KDJ + Volumi + SMC + Ichimoku" by Nikus63
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Nikus63
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export type WaveNKdjVolumiSmcIchimokuInputs = Record<string, never>;

export const defaultInputs: WaveNKdjVolumiSmcIchimokuInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan-sen', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Kijun-sen', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Senkou Span A', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Senkou Span B', color: color.maroon, lineWidth: 1 },
];

export const metadata = {
  title: 'Wave N + KDJ + Volumi + SMC + Ichimoku',
  shortTitle: 'Wave N + KDJ + Volumi + SMC + Ichimoku',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface WaveRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme[];
  ll: WindowExtreme[];
  K: WindowSma;
  D: WindowSma;
  emaVol: ReturnType<typeof taStep.ema>;
  earlyUp: ReturnType<typeof taStep.crossover>;
  earlyDown: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

/** ta.highest(high, len) / ta.lowest(low, len) lengths: KDJ 9, Ichimoku 9, 26, 52 (one call each) */
const LENGTHS = [9, 9, 26, 52];

function study(): BarStudy<WaveRun, Result> {
  const buyBg = String(color.new(color.green, 80));
  const sellBg = String(color.new(color.red, 80));
  return {
    init() {
      const s: WaveRun = {
        hh: LENGTHS.map((l) => new WindowExtreme(false, l)), ll: LENGTHS.map((l) => new WindowExtreme(true, l)),
        K: new WindowSma(3), D: new WindowSma(3), emaVol: taStep.ema(20),
        earlyUp: taStep.crossover(), earlyDown: taStep.crossunder(), plots: [[], [], [], []], markers: [], bgColors: [],
        vars: {}, steps: [], lists: [], series: [],
      };
      s.steps = [...s.hh, ...s.ll, s.K, s.D, s.emaVol, s.earlyUp, s.earlyDown];
      s.lists = [s.markers, s.bgColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hi = (k: number) => s.hh[k].step(b.high);
      // KDJ; a plain division (x / 0 is +-infinity, 0 / 0 na; ta.sma skips them)
      const hh = hi(0);
      const ll = s.ll[0].step(b.low);
      const rsv = ((b.close - ll) / (hh - ll)) * 100;
      const K = s.K.step(rsv);
      const D = s.D.step(K);
      const J = 3 * K - 2 * D;

      const emaVol = s.emaVol.step(b.volume ?? NaN) ?? NaN;

      // Ichimoku (no offset)
      const mid = (k: number) => (hi(k) + s.ll[k].step(b.low)) / 2;
      const conversionLine = mid(1);
      const baseLine = mid(2);
      const leadingSpanA = (conversionLine + baseLine) / 2;
      const leadingSpanB = mid(3);

      const earlyUp = s.earlyUp.step(J, 50);
      const earlyDown = s.earlyDown.step(J, 50);

      const h1 = i >= 1 ? bars[i - 1].high : NaN;
      const h2 = i >= 2 ? bars[i - 2].high : NaN;
      const l1 = i >= 1 ? bars[i - 1].low : NaN;
      const l2 = i >= 2 ? bars[i - 2].low : NaN;
      const nWaveUp = lt(h2, h1) && gt(l1, l2) && gt(b.high, h1);
      const nWaveDown = gt(l2, l1) && lt(h1, h2) && lt(b.low, l1);
      const aboveVol = gt(b.volume ?? NaN, emaVol);
      const buy = nWaveUp && gt(J, 50) && aboveVol && gt(b.close, baseLine);
      const sell = nWaveDown && lt(J, 50) && aboveVol && lt(b.close, baseLine);
      if (buy) s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
      if (sell) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
      if (earlyUp) s.markers.push({ time: b.time, position: 'belowBar', shape: 'cross', color: color.green, size: 'tiny' });
      if (earlyDown) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: color.red, size: 'tiny' });
      // bgcolor(buySignal ? green 80 : na); bgcolor(sellSignal ? red 80 : na)
      if (buy) s.bgColors.push({ time: b.time, color: buyBg });
      if (sell) s.bgColors.push({ time: b.time, color: sellBg });

      s.plots[0][i] = { time: b.time, value: conversionLine, color: color.blue };
      s.plots[1][i] = { time: b.time, value: baseLine, color: color.red };
      s.plots[2][i] = { time: b.time, value: leadingSpanA, color: color.green };
      s.plots[3][i] = { time: b.time, value: leadingSpanB, color: color.maroon };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<WaveNKdjVolumiSmcIchimokuInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<WaveNKdjVolumiSmcIchimokuInputs> = {}): Result {
  return fullResult(createRun().update(bars));
}

export const WaveNKdjVolumiSmcIchimoku = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
