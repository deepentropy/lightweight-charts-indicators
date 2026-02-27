/**
 * Sell / Buy Rates
 *
 * Volume-weighted buy/sell pressure using linear regression.
 * Splits each bar's volume into up/down components using wick/body ratios,
 * then plots linreg(volup - voldown, period) as a single histogram.
 * 4-color: lime (positive rising), green (positive falling),
 * red (negative falling), maroon (negative rising).
 *
 * Reference: TradingView "Sell / Buy Rates" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

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

export function calculate(bars: Bar[], inputs: Partial<SellBuyRatesInputs> = {}): IndicatorResult {
  const { period } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Pine: _rate(cond) => 0.5 * (tw + bw + (cond ? 2 * body : 0)) / (tw + bw + body)
  // volup = volume * _rate(open <= close)
  // voldown = volume * _rate(open >= close)
  const diffArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const { open, high, low, close, volume: vol } = bars[i];
    const v = vol ?? 0;
    const tw = high - Math.max(open, close);
    const bw = Math.min(open, close) - low;
    const body = Math.abs(close - open);
    const denom = tw + bw + body;

    if (denom === 0) {
      diffArr[i] = 0;
    } else {
      const rateUp = 0.5 * (tw + bw + (open <= close ? 2 * body : 0)) / denom;
      const rateDn = 0.5 * (tw + bw + (open >= close ? 2 * body : 0)) / denom;
      diffArr[i] = v * rateUp - v * rateDn;
    }
  }

  // Pine: rate = linreg(volup - voldown, prd, 0)
  const diffSeries = new Series(bars, (_b, i) => diffArr[i]);
  const rateArr = ta.linreg(diffSeries, period, 0).toArray();

  const warmup = period;

  // Pine: falling(rate, 5) means rate has been falling for 5 consecutive bars
  // Pine: rising(rate, 5) means rate has been rising for 5 consecutive bars
  const plot0 = bars.map((b, i) => {
    const rate = rateArr[i];
    if (i < warmup || rate == null || isNaN(rate)) {
      return { time: b.time, value: NaN };
    }

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

    return { time: b.time, value: rate, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const SellBuyRates = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
