/**
 * Smooth RSI [MarktQuant]
 *
 * The RSI of the high, open, low and close over `length` bars, drawn as candles (open = RSI of the open, high = RSI
 * of the high, low = RSI of the low, close = RSI of the close). The trend colour is green when the average of the
 * four RSIs is above 50 and the average rate of change of the four prices over `lengthc` bars is positive, red when
 * the average RSI is below 50 and the average rate of change is negative, and keeps its last value otherwise (white
 * at the start). It colours the RSI candles, the price bars and a copy of the price candles on the price pane. An
 * optional line draws the average rate of change + 50, filled to 50.
 *
 * Reference: "Smooth RSI [MarktQuant]" by MarktQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MarktQuant
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar,
} from 'oakscriptjs';
import type { BarColorData, MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SmoothRSIInputs {
  /** RSI length */
  length: number;
  /** RoC length */
  lengthc: number;
  /** Show the RSI candles */
  showRsi: boolean;
  /** Show the RoC line and its fill */
  showRoc: boolean;
}

export const defaultInputs: SmoothRSIInputs = {
  length: 28,
  lengthc: 28,
  showRsi: true,
  showRoc: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI', defval: 28 },
  { id: 'lengthc', type: 'int', title: 'RoC Length', defval: 28 },
  { id: 'showRsi', type: 'bool', title: 'Show RSI', defval: true },
  { id: 'showRoc', type: 'bool', title: 'Show RoC', defval: false },
];

const ROC_UP = color.rgb(117, 186, 255, 50);
const ROC_DOWN = color.rgb(255, 183, 75, 48);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RoC Plot', color: ROC_UP, lineWidth: 2, visible: 'showRoc' },
  { id: 'plot1', title: 'Mid Threshold', color: '#2962ff', lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_low', price: 30, title: 'Low Threshold', color: '#08b60e67', linestyle: 'dashed' },
  { id: 'hline_high', price: 70, title: 'High Threshold', color: '#ea00006d', linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Mid Threshold', color: '#eb61048b', linestyle: 'dashed' },
];

export const metadata = {
  title: 'Smooth RSI [MarktQuant]',
  shortTitle: 'Smooth RSI [MarktQuant]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>;
};

interface SmoothRsiRun extends BarRunState<{ colss: string }> {
  rsi: ReturnType<typeof taStep.rsi>[];
  roc: ReturnType<typeof taStep.roc>[];
  rsiCandles: PlotCandleData[];
  chartCandles: PlotCandleData[];
  barColors: BarColorData[];
  rocPlot: { time: number; value: number; color: string }[];
  midPlot: { time: number; value: number }[];
  fillColors: string[];
}

function study(inputs: Partial<SmoothRSIInputs>): BarStudy<SmoothRsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // high, open, low, close
      const rsi = [0, 1, 2, 3].map(() => taStep.rsi(cfg.length));
      const roc = [0, 1, 2, 3].map(() => taStep.roc(cfg.lengthc));
      // var color colss = color.white
      const s: SmoothRsiRun = {
        rsi, roc, rsiCandles: [], chartCandles: [], barColors: [], rocPlot: [], midPlot: [], fillColors: [],
        steps: [...rsi, ...roc], vars: { colss: color.white }, lists: [], series: [],
      };
      s.lists = [s.rsiCandles];
      s.series = [s.chartCandles, s.barColors, s.rocPlot, s.midPlot, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const c1 = s.rsi[0].step(b.high);
      const c2 = s.rsi[1].step(b.open);
      const c3 = s.rsi[2].step(b.low);
      const c4 = s.rsi[3].step(b.close);
      const c1c = s.roc[0].step(b.high);
      const c2c = s.roc[1].step(b.open);
      const c3c = s.roc[2].step(b.low);
      const c4c = s.roc[3].step(b.close);

      const sum = (c1 + c2 + c3 + c4) / 4;
      const sumc = (c1c + c2c + c3c + c4c) / 4;
      const rocc = gt(sumc, 0) ? ROC_UP : lt(sumc, 0) ? ROC_DOWN : null;
      const bul = gt(sum, 50) && gt(sumc, 0);
      const ber = lt(sum, 50) && lt(sumc, 0);
      if (bul) s.vars.colss = color.rgb(0, 197, 89);
      if (ber) s.vars.colss = color.rgb(225, 15, 0);
      const colss = s.vars.colss;

      s.barColors[i] = { time: t, color: colss };
      // plotcandle(c2, c1, c3, c4, ...): no candle when a value is na; display = d1 ? display.all : display.none
      if (cfg.showRsi && !isNaN(c1) && !isNaN(c2) && !isNaN(c3) && !isNaN(c4)) {
        s.rsiCandles.push({ time: t, open: c2, high: c1, low: c3, close: c4, color: colss, wickColor: colss,
          borderColor: colss });
      }
      // plotcandle(open, high, low, close, ..., force_overlay = true)
      s.chartCandles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: colss,
        wickColor: colss, borderColor: colss, forceOverlay: true };
      s.rocPlot[i] = { time: t, value: sumc + 50, color: rocc ?? 'transparent' };
      s.midPlot[i] = { time: t, value: 50 };
      // color.new(rocc, 90): color.new(na, 90) is black with transparency 90
      s.fillColors[i] = String(color.new(rocc ?? '#000000', 90));
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.rocPlot.slice(), plot1: s.midPlot.slice() },
        hlines: [
          { value: 30, options: { title: 'Low Threshold', color: '#08b60e67', linestyle: 'dashed' } },
          { value: 70, options: { title: 'High Threshold', color: '#ea00006d', linestyle: 'dashed' } },
          { value: 50, options: { title: 'Mid Threshold', color: '#eb61048b', linestyle: 'dashed' } },
        ],
        // fill(l1, mid, color.new(rocc, 90), display = d3 ? display.all : display.none), untitled ("Plots Background"):
        // FillData has no display option, so the hidden fill is given with transparent colours (listed, draws nothing)
        fills: [{
          plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' },
          colors: cfg.showRoc ? s.fillColors.slice() : s.fillColors.map(() => 'transparent'),
        }],
        markers: [],
        barColors: s.barColors.slice(),
        plotCandles: { rsiCandles: s.rsiCandles.slice(), chartCandles: s.chartCandles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmoothRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmoothRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
export const SmoothRSI = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
