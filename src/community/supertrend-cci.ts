/**
 * BEST Supertrend CCI
 *
 * Supertrend indicator that uses CCI as the direction filter instead of
 * the standard close-vs-supertrend comparison.
 *   Up   = hl2 - factor * ATR(pd)
 *   Down = hl2 + factor * ATR(pd)
 *   TrendUp ratchets up when CCI[1] > midLine, else resets.
 *   TrendDown ratchets down when CCI[1] < midLine, else resets.
 *   Trend = CCI > midLine ? 1 : CCI < midLine ? -1 : prev
 *   Line = Trend==1 ? TrendUp : TrendDown
 * Colored green when close >= line, red otherwise.
 *
 * Reference: TradingView "BEST Supertrend CCI" by Daveatt
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SupertrendCCIInputs {
  source: SourceType;
  cciPeriod: number;
  midLine: number;
  factor: number;
  pd: number;
}

export const defaultInputs: SupertrendCCIInputs = {
  source: 'close',
  cciPeriod: 28,
  midLine: 0,
  factor: 3,
  pd: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'cciPeriod', type: 'int', title: 'CCI Period', defval: 28, min: 1 },
  { id: 'midLine', type: 'int', title: 'CCI Mid Line Pivot', defval: 0 },
  { id: 'factor', type: 'float', title: '[ST] Factor', defval: 3, min: 1, max: 100, step: 0.1 },
  { id: 'pd', type: 'int', title: '[ST] PD (ATR Period)', defval: 3, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend CCI', color: '#26A69A', lineWidth: 4 },
];

export const metadata = {
  title: 'BEST Supertrend CCI',
  shortTitle: 'ST-CCI',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SupertrendCCIInputs> = {}): IndicatorResult {
  const { source, cciPeriod, midLine, factor, pd } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // CCI
  const srcSeries = getSourceSeries(bars, source);
  const cciArr = ta.cci(srcSeries, cciPeriod).toArray();

  // ATR
  const atrArr = ta.atr(bars, pd).toArray();

  // hl2
  const hl2: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    hl2[i] = (bars[i].high + bars[i].low) / 2;
  }

  // Supertrend with CCI filter
  const trendUp: number[] = new Array(n);
  const trendDown: number[] = new Array(n);
  const trend: number[] = new Array(n);
  const tsl: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const atrVal = atrArr[i];
    if (isNaN(atrVal)) {
      trendUp[i] = NaN;
      trendDown[i] = NaN;
      trend[i] = i > 0 ? trend[i - 1] : 1;
      tsl[i] = NaN;
      continue;
    }

    const up = hl2[i] - factor * atrVal;
    const dn = hl2[i] + factor * atrVal;

    // CCI[1] for ratchet logic
    const cciPrev = i > 0 ? cciArr[i - 1] : NaN;

    // TrendUp ratchets up when CCI[1] > midLine
    if (i === 0 || isNaN(trendUp[i - 1])) {
      trendUp[i] = up;
    } else {
      trendUp[i] = (!isNaN(cciPrev) && cciPrev > midLine)
        ? Math.max(up, trendUp[i - 1])
        : up;
    }

    // TrendDown ratchets down when CCI[1] < midLine
    if (i === 0 || isNaN(trendDown[i - 1])) {
      trendDown[i] = dn;
    } else {
      trendDown[i] = (!isNaN(cciPrev) && cciPrev < midLine)
        ? Math.min(dn, trendDown[i - 1])
        : dn;
    }

    // Trend direction from current CCI
    const cciCur = cciArr[i];
    if (!isNaN(cciCur) && cciCur > midLine) {
      trend[i] = 1;
    } else if (!isNaN(cciCur) && cciCur < midLine) {
      trend[i] = -1;
    } else {
      trend[i] = i > 0 ? trend[i - 1] : 1;
    }

    tsl[i] = trend[i] === 1 ? trendUp[i] : trendDown[i];
  }

  const warmup = Math.max(cciPeriod, pd);

  const plot0 = tsl.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = bars[i].close >= v ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: midLine, options: { color: '#787B86', linestyle: 'solid' as const, title: 'CCI Mid Line' } },
    ],
  };
}

export const SupertrendCCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
