/**
 * OTT Oscillator (OTTO)
 *
 * OTT computed as oscillator: normalized difference between MA and OTT.
 * Positive when MA is above OTT (bullish), negative when below (bearish).
 *
 * Reference: TradingView "OTT Oscillator" (TV#493)
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface OTTOInputs {
  period: number;
  percent: number;
  src: SourceType;
}

export const defaultInputs: OTTOInputs = {
  period: 2,
  percent: 1.4,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'Percent', defval: 1.4, min: 0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OTTO', color: '#2962FF', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'OTT Oscillator',
  shortTitle: 'OTTO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OTTOInputs> = {}): IndicatorResult {
  const { period, percent, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  // VAR calculation
  const valpha = 2 / (period + 1);
  const mavg: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i] ?? 0;
    let vUD = 0;
    let vDD = 0;
    for (let j = Math.max(0, i - 8); j <= i; j++) {
      const cur = srcArr[j] ?? 0;
      const prev = j > 0 ? (srcArr[j - 1] ?? 0) : cur;
      if (cur > prev) vUD += cur - prev;
      if (cur < prev) vDD += prev - cur;
    }
    const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
    mavg[i] = i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * mavg[i - 1];
  }

  // OTT trailing stop logic
  const fark = mavg.map((v) => v * percent * 0.01);
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    longStop[i] = mavg[i] - fark[i];
    shortStop[i] = mavg[i] + fark[i];

    if (i > 0) {
      if (mavg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (mavg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && mavg[i] > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && mavg[i] < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    ott[i] = mavg[i] > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
  }

  const warmup = period + 9;

  // Oscillator = MA - OTT[2-bar lag]
  const plot0 = mavg.map((v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    const ottLag = ott[i - 2];
    const diff = v - ottLag;
    const color = diff > 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: diff, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const OTTO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
