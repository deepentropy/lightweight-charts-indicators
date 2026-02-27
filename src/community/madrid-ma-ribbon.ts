/**
 * Madrid Moving Average Ribbon
 *
 * Eighteen moving averages (5 through 90, step 5) creating a ribbon.
 * Supports SMA and EMA types. Colors based on direction and position vs MA 100 reference.
 * Lime=uptrend, Green=reentry, Red=downtrend, Maroon=reversal warning.
 *
 * Reference: TradingView "Madrid Moving Average Ribbon" (TV#416/417)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MadridMaRibbonInputs {
  maType: string;
  src: SourceType;
}

export const defaultInputs: MadridMaRibbonInputs = {
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['sma', 'ema'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const lengths = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];
// Gradient from bright green (fast) to dark red (slow)
const colors = [
  '#64DD17', '#76FF03', '#AEEA00', '#C6FF00', '#FFD600',
  '#FFAB00', '#FF6D00', '#FF3D00', '#DD2C00', '#B71C1C',
  '#880E4F', '#AD1457', '#C62828', '#D32F2F', '#E53935',
  '#F44336', '#EF5350', '#E57373',
];

export const plotConfig: PlotConfig[] = lengths.map((len, idx) => ({
  id: `plot${idx}`,
  title: `MA ${len}`,
  color: colors[idx],
  lineWidth: idx === 0 || idx === 17 ? 3 : 1,
}));

export const metadata = {
  title: 'Madrid MA Ribbon',
  shortTitle: 'MAR',
  overlay: true,
};

// Pine maColor: lime if rising AND above ma100, maroon if falling AND above ma100,
// red if falling AND below ma100, green if rising AND below ma100, gray otherwise
function maColor(maVal: number, prevMaVal: number, ma100Val: number): string {
  const diff = maVal - prevMaVal;
  if (diff >= 0 && maVal > ma100Val) return '#00FF00'; // LIME
  if (diff < 0 && maVal > ma100Val) return '#800000';  // MAROON
  if (diff <= 0 && maVal < ma100Val) return '#FF0000';  // RED (RUBI)
  if (diff >= 0 && maVal < ma100Val) return '#008000';  // GREEN
  return '#808080'; // GRAY
}

export function calculate(bars: Bar[], inputs: Partial<MadridMaRibbonInputs> = {}): IndicatorResult {
  const { maType, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const maFn = maType === 'ema' ? ta.ema : ta.sma;
  const warmup = lengths[lengths.length - 1]; // 90

  // Compute ma100 reference for color logic
  const ma100Arr = maFn(source, 100).toArray();

  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};

  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = maFn(source, lengths[idx]).toArray();
    plots[`plot${idx}`] = arr.map((v, i) => {
      if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
      const prev = (i > 0 && arr[i - 1] != null) ? arr[i - 1]! : v;
      const ref = ma100Arr[i] ?? v;
      return { time: bars[i].time, value: v, color: maColor(v, prev, ref) };
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const MadridMaRibbon = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
