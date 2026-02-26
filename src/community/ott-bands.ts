/**
 * OTT Bands
 *
 * OTT with upper and lower percentage bands.
 * Support line (VAR MA) with upper band and lower band
 * derived from the OTT trailing stop percentage offsets.
 *
 * Reference: TradingView "OTT Bands" (TV#492)
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface OTTBandsInputs {
  period: number;
  percent: number;
  src: SourceType;
}

export const defaultInputs: OTTBandsInputs = {
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
  { id: 'plot0', title: 'Support', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'OTT Bands',
  shortTitle: 'OTTBands',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<OTTBandsInputs> = {}): IndicatorResult {
  const { period, percent, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  // VAR (Variable Index Dynamic Average) calculation
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

  // Support = OTT with 2-bar lag
  const plot0 = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: ott[i - 2] };
  });

  // Upper band = support + percent offset
  const plot1 = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    const support = ott[i - 2];
    return { time: bars[i].time, value: support * (200 + percent) / 200 };
  });

  // Lower band = support - percent offset
  const plot2 = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    const support = ott[i - 2];
    return { time: bars[i].time, value: support * (200 - percent) / 200 };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
  };
}

export const OTTBands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
