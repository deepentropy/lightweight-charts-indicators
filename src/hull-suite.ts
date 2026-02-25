/**
 * Hull Suite
 *
 * Three Hull MA variants: HMA, EHMA (EMA-based), THMA (Triple).
 * Outputs MHULL (current) and SHULL (2-bar lag) for band/cloud display.
 *
 * Reference: TradingView "Hull Suite by InSilico"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface HullSuiteInputs {
  source: SourceType;
  mode: string;
  length: number;
}

export const defaultInputs: HullSuiteInputs = {
  source: 'close',
  mode: 'Hma',
  length: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'mode', type: 'string', title: 'Hull Variation', defval: 'Hma', options: ['Hma', 'Ehma', 'Thma'] },
  { id: 'length', type: 'int', title: 'Length', defval: 55, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MHULL', color: '#00ff00', lineWidth: 2 },
  { id: 'plot1', title: 'SHULL', color: '#00ff00', lineWidth: 2 },
];

export const metadata = {
  title: 'Hull Suite',
  shortTitle: 'HS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<HullSuiteInputs> = {}): IndicatorResult {
  const { source, mode, length } = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, source);
  const sqrtLen = Math.round(Math.sqrt(length));

  let hullArr: number[];

  if (mode === 'Ehma') {
    // EHMA: ema(2*ema(src, len/2) - ema(src, len), sqrt(len))
    const halfEma = ta.ema(src, Math.max(1, Math.floor(length / 2)));
    const fullEma = ta.ema(src, length);
    const diff = halfEma.mul(2).sub(fullEma);
    hullArr = ta.ema(diff, Math.max(1, sqrtLen)).toArray().map((v) => v ?? NaN);
  } else if (mode === 'Thma') {
    // THMA: wma(wma(src, len/3)*3 - wma(src, len/2) - wma(src, len), len)
    const halfLen = Math.max(1, Math.floor(length / 2));
    const thirdLen = Math.max(1, Math.floor(length / 3));
    const wma3 = ta.wma(src, thirdLen);
    const wmaHalf = ta.wma(src, halfLen);
    const wmaFull = ta.wma(src, length);
    const diff = wma3.mul(3).sub(wmaHalf).sub(wmaFull);
    hullArr = ta.wma(diff, length).toArray().map((v) => v ?? NaN);
  } else {
    // HMA: wma(2*wma(src, len/2) - wma(src, len), sqrt(len))
    hullArr = ta.hma(src, length).toArray().map((v) => v ?? NaN);
  }

  const warmup = length;
  const mhull = hullArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const shull = hullArr.map((v, i) => ({ time: bars[i].time, value: i < warmup + 2 ? NaN : hullArr[i - 2] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': mhull, 'plot1': shull },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: '#00ff00' } }],
  };
}

export const HullSuite = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
