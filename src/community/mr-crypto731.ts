/**
 * Enhanced MACD with Strong Buy/Sell Signals
 *
 * MACD of the close (EMA(fast) - EMA(slow)), its EMA signal line and the histogram MACD - signal. A strong buy is a
 * crossover of the MACD over the signal line while the MACD is above 0; a strong sell is a crossunder while the MACD
 * is below 0. Each signal draws a triangle at the bottom / top of the pane and a background colour.
 *
 * Reference: "Enhanced MACD with Strong Buy/Sell Signals" by Ali_Smith
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Ali_Smith
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MrCrypto731Inputs {
  fastLength: number;
  slowLength: number;
  signalSmoothing: number;
}

export const defaultInputs: MrCrypto731Inputs = {
  fastLength: 12,
  slowLength: 26,
  signalSmoothing: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26 },
  { id: 'signalSmoothing', type: 'int', title: 'MACD Signal Smoothing', defval: 9 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Line', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'MACD Histogram', color: color.gray, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Enhanced MACD with Strong Buy/Sell Signals',
  shortTitle: 'MACD Signals',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface MrCryptoRun extends BarRunState<Record<string, never>> {
  macd: ReturnType<typeof taStep.macd>;
  macdLine: number[];
  signalLine: number[];
  macdData: Point[];
  signalData: Point[];
  histData: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

const buyBg = String(color.new(color.lime, 80));
const sellBg = String(color.new(color.red, 80));

function study(inputs: Partial<MrCrypto731Inputs>): BarStudy<MrCryptoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const macd = taStep.macd(cfg.fastLength, cfg.slowLength, cfg.signalSmoothing);
      const s: MrCryptoRun = {
        macd, macdLine: [], signalLine: [], macdData: [], signalData: [], histData: [], markers: [], bgColors: [],
        steps: [macd], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.macdLine, s.signalLine, s.macdData, s.signalData, s.histData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const [m, sig] = s.macd.step(b.close);
      const macdLine = s.macdLine;
      const signalLine = s.signalLine;
      macdLine[i] = m;
      signalLine[i] = sig;
      const histogram = m - sig;
      // ta.crossover / ta.crossunder compare exactly (a tie on the previous bar counts; na compares false)
      const crossover = i > 0 && macdLine[i] > signalLine[i] && macdLine[i - 1] <= signalLine[i - 1];
      const crossunder = i > 0 && macdLine[i] < signalLine[i] && macdLine[i - 1] >= signalLine[i - 1];
      const strongBuy = crossover && gt(macdLine[i], 0);
      const strongSell = crossunder && lt(macdLine[i], 0);
      // plotshape(strongBuySignal, location.bottom, color.lime, shape.triangleup, size.small, text = "🚀")
      if (strongBuy) {
        s.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: color.lime, size: 'small', text: '🚀', textColor: color.blue });
      }
      // plotshape(strongSellSignal, location.top, color.red, shape.triangledown, size.small, text = "🔻")
      if (strongSell) {
        s.markers.push({ time: t, position: 'top', shape: 'triangleDown', color: color.red, size: 'small', text: '🔻', textColor: color.blue });
      }
      // bgcolor(strongBuySignal ? color.new(color.lime, 80) : na); bgcolor(strongSellSignal ? color.new(color.red, 80) : na)
      // (both can not be true on the same bar)
      if (strongBuy) s.bgColors.push({ time: t, color: buyBg });
      if (strongSell) s.bgColors.push({ time: t, color: sellBg });
      s.macdData[i] = { time: t, value: m, color: color.green };
      s.signalData[i] = { time: t, value: sig, color: color.red };
      s.histData[i] = { time: t, value: histogram, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.macdData.slice(), plot1: s.signalData.slice(), plot2: s.histData.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MrCrypto731Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MrCrypto731Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MrCrypto731 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
