/**
 * Sell / Buy Rates
 *
 * Volume-weighted buy/sell pressure using linear regression.
 * Splits each bar's volume into up/down components using wick/body ratios,
 * then plots linreg(volup - voldown, period) as a single histogram.
 * 4-color: lime (positive rising), green (positive falling),
 * red (negative falling), maroon (negative rising).
 *
 * Reference: "Sell / Buy Rates" by LonesomeTheBlue
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SellBuyRatesInputs {
  period: number;
}

export const defaultInputs: SellBuyRatesInputs = {
  period: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 34, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rate', color: '#26A69A', lineWidth: 2, style: 'columns' as any },
];

export const metadata = {
  title: 'Sell & Buy Rates',
  shortTitle: 'SBR',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface SbrRun extends BarRunState<Record<string, never>> {
  linreg: ReturnType<typeof taStep.linreg>;
  rateArr: number[];
  plot0: Point[];
}

function study(inputs: Partial<SellBuyRatesInputs>): BarStudy<SbrRun, IndicatorResult> {
  const { period } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const linreg = taStep.linreg(period, 0);
      const s: SbrRun = { linreg, rateArr: [], plot0: [], steps: [linreg], vars: {}, lists: [], series: [] };
      s.series = [s.rateArr, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      // Pine: _rate(cond) => 0.5 * (tw + bw + (cond ? 2 * body : 0)) / (tw + bw + body)
      // volup = volume * _rate(open <= close)
      // voldown = volume * _rate(open >= close)
      const { open, high, low, close, volume: vol, time } = bars[i];
      const v = vol ?? 0;
      const tw = high - Math.max(open, close);
      const bw = Math.min(open, close) - low;
      const body = Math.abs(close - open);
      const denom = tw + bw + body;
      let diff: number;
      if (denom === 0) {
        diff = 0;
      } else {
        const rateUp = 0.5 * (tw + bw + (open <= close ? 2 * body : 0)) / denom;
        const rateDn = 0.5 * (tw + bw + (open >= close ? 2 * body : 0)) / denom;
        diff = v * rateUp - v * rateDn;
      }

      // Pine: rate = linreg(volup - voldown, prd, 0)
      const rateArr = s.rateArr;
      const rate = s.linreg.step(diff);
      rateArr[i] = rate;

      const warmup = period;
      if (i < warmup || rate == null || isNaN(rate)) {
        s.plot0[i] = { time, value: NaN };
        return;
      }

      // Pine: falling(rate, 5) means rate has been falling for 5 consecutive bars
      // Pine: rising(rate, 5) means rate has been rising for 5 consecutive bars
      // Check falling(rate, 5): each of last 5 bars is less than its predecessor
      let isFalling = true;
      let isRising = true;
      for (let j = 0; j < 5; j++) {
        const idx = i - j;
        const prev = idx > 0 ? (rateArr[idx - 1] ?? 0) : 0;
        const curr = rateArr[idx] ?? 0;
        if (curr >= prev) isFalling = false;
        if (curr <= prev) isRising = false;
      }

      // Pine: rate > 0 ? (falling(rate, 5) ? green : lime) : rate < 0 ? (rising(rate, 5) ? maroon : red) : na
      let color: string;
      if (rate > 0) {
        color = isFalling ? '#008000' : '#00FF00'; // green : lime
      } else if (rate < 0) {
        color = isRising ? '#800000' : '#FF0000'; // maroon : red
      } else {
        color = '#787B86';
      }
      s.plot0[i] = { time, value: rate, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SellBuyRatesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SellBuyRatesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SellBuyRates = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
