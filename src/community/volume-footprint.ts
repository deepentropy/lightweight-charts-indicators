/**
 * Volume Footprint [LuxAlgo]
 *
 * Intra-bar volume profile showing distribution at price levels.
 * Divides each bar's range into intervals and distributes volume
 * across levels proportionally based on tick data accumulation.
 * Outputs BoxData[] for volume segments at each price level.
 *
 * Reference: TradingView "Volume Footprint [LuxAlgo]" by LuxAlgo
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, BarColorData, LineDrawingData } from '../types';

export interface VolumeFootprintInputs {
  method: string;
  length: number;
  percent: boolean;
  displayType: string;
}

export const defaultInputs: VolumeFootprintInputs = {
  method: 'Atr',
  length: 14,
  percent: false,
  displayType: 'Candle',
};

export const inputConfig: InputConfig[] = [
  { id: 'method', type: 'string', title: 'Interval Size Method', defval: 'Atr', options: ['Atr', 'Manual'] },
  { id: 'length', type: 'float', title: 'Length / Manual Size', defval: 14, min: 1 },
  { id: 'percent', type: 'bool', title: 'As Percentage', defval: false },
  { id: 'displayType', type: 'string', title: 'Display Type', defval: 'Candle', options: ['Candle', 'Regular', 'Gradient'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchor', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Volume Footprint',
  shortTitle: 'VFP',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeFootprintInputs> = {}): IndicatorResult & { boxes: BoxData[]; barColors: BarColorData[]; lines: LineDrawingData[] } {
  const { method, length, percent, displayType } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // ATR for interval sizing
  const atrLen = Math.min(Math.round(length), n);
  const atrArr = ta.atr(bars, atrLen).toArray();

  // For the Pine script, on each confirmed bar it:
  // 1. Divides the bar's range (high-low) into k intervals
  // 2. For historical bars, distributes total volume across intervals proportionally
  //    (since we don't have real tick data, we simulate by distributing based on
  //     proximity of close to each interval)
  // 3. Draws boxes for each interval

  const boxes: BoxData[] = [];
  const barColors: BarColorData[] = [];
  const lines: LineDrawingData[] = [];
  const plot0: { time: number; value: number }[] = [];

  // Color constants
  const bull = '#089981';
  const bear = '#f23645';
  const colA = '#bbd9fb';
  const colB = '#0c3299';
  const regCol = '#bbd9fb';

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const t = bar.time;
    const r = bar.high - bar.low;

    plot0.push({ time: t, value: NaN });

    // Bar color for trend direction
    const isBullBar = bar.close > bar.open;
    barColors.push({ time: t, color: isBullBar ? bull : bear });

    // Vertical high-to-low line per bar in Regular/Gradient modes (Pine: line.new(n,high,n,low,...))
    if (displayType !== 'Candle' && r > 0 && i >= atrLen) {
      lines.push({
        time1: t, price1: bar.high,
        time2: t, price2: bar.low,
        color: isBullBar ? bull : bear,
        width: 3,
      });
    }

    if (r <= 0 || i < atrLen) continue;

    const size = method === 'Atr' ? (atrArr[i] ?? r) : length;
    if (size <= 0) continue;

    const k = Math.round(r / size) + 1;
    if (k < 1 || k > 100) continue; // safety cap

    const vol = bar.volume ?? 0;

    // Distribute volume across intervals
    // For historical data, we approximate by distributing volume based on
    // a simple model: more volume near close price
    const intervalVols: number[] = new Array(k).fill(0);
    if (vol > 0) {
      // Weight each interval by proximity to close
      let totalWeight = 0;
      for (let j = 0; j < k; j++) {
        const btm = bar.low + (j / k) * r;
        const top = bar.low + ((j + 1) / k) * r;
        const mid = (btm + top) / 2;
        // Use gaussian-like weighting centered on close
        const dist = Math.abs(mid - bar.close) / (r || 1);
        const w = Math.exp(-dist * dist * 2) + 0.1; // ensure all intervals get some volume
        intervalVols[j] = w;
        totalWeight += w;
      }
      // Normalize to total volume
      for (let j = 0; j < k; j++) {
        intervalVols[j] = (intervalVols[j] / totalWeight) * vol;
      }
    }

    // Get next bar time for box right edge (or estimate)
    const nextTime = i + 1 < n ? bars[i + 1].time : t + (i > 0 ? t - bars[i - 1].time : 60);

    for (let j = 0; j < k; j++) {
      const btm = bar.low + (j / k) * r;
      const top = bar.low + ((j + 1) / k) * r;
      const sum = intervalVols[j];

      let bgColor: string;
      let borderColor: string;
      const textColor = '#808080';

      if (displayType === 'Candle') {
        bgColor = isBullBar ? `${bull}80` : `${bear}80`; // 50% transparency
        borderColor = isBullBar ? bull : bear;
      } else if (displayType === 'Gradient') {
        // Gradient from colA to colB based on sum/volume ratio
        const ratio = vol > 0 ? Math.min(1, sum / vol) : 0;
        const rA = parseInt(colA.slice(1, 3), 16);
        const gA = parseInt(colA.slice(3, 5), 16);
        const bA = parseInt(colA.slice(5, 7), 16);
        const rB = parseInt(colB.slice(1, 3), 16);
        const gB = parseInt(colB.slice(3, 5), 16);
        const bB = parseInt(colB.slice(5, 7), 16);
        const rr = Math.round(rA + (rB - rA) * ratio);
        const gg = Math.round(gA + (gB - gA) * ratio);
        const bb = Math.round(bA + (bB - bA) * ratio);
        bgColor = `rgb(${rr},${gg},${bb})`;
        borderColor = bgColor;
      } else {
        // Regular
        bgColor = regCol;
        borderColor = '#808080';
      }

      const txt = percent
        ? (vol > 0 ? `${(sum / vol * 100).toFixed(1)}%` : '0%')
        : sum.toFixed(sum >= 1 ? 0 : 5);

      boxes.push({
        time1: t,
        price1: top,
        time2: nextTime,
        price2: btm,
        bgColor,
        borderColor,
        borderWidth: 1,
        text: txt,
        textColor,
        textSize: 'tiny',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    boxes,
    barColors,
    lines,
  };
}

export const VolumeFootprint = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
