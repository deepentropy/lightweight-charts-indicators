/**
 * Buying Selling Volume
 *
 * Splits volume into buying and selling components based on price position
 * within the bar range. Plots: Volume, BuyVolume, SellVolume, BuyVolume%,
 * SellVolume%, VolumeIndex. Pressure columns show dominant as positive,
 * counterforce as negative.
 *
 * Reference: "Buying Selling Volume" by ceyhun (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BuyingSellVolumeInputs {
  vnLen: number;
}

export const defaultInputs: BuyingSellVolumeInputs = {
  vnLen: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'vnLen', type: 'int', title: 'Volume Index Length', defval: 1, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'volume', title: 'Volume', color: '#787B86', lineWidth: 3, style: 'columns' },
  { id: 'buyVol', title: 'BuyVolume', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'sellVol', title: 'SellVolume', color: '#EF5350', lineWidth: 1, style: 'columns' },
  { id: 'buyPct', title: 'BuyVolume%', color: '#4CAF50', lineWidth: 1, style: 'circles' },
  { id: 'sellPct', title: 'SellVolume%', color: '#EF5350', lineWidth: 1, style: 'circles' },
  { id: 'volIndex', title: 'VolumeIndex', color: '#00FFFF', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Buying Selling Volume',
  shortTitle: 'BSVol',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface BsvRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<BuyingSellVolumeInputs>): BarStudy<BsvRun, Result> {
  const { vnLen } = { ...defaultInputs, ...inputs };
  const warmup = 20;
  return {
    init() {
      const ema = taStep.ema(20);
      const s: BsvRun = {
        ema, plots: [[], [], [], [], [], []], barColors: [], steps: [ema], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // BV = volume * (close - low) / (high - low); SV = volume * (high - close) / (high - low)
      const volume = b.volume ?? 0;
      const range = b.high - b.low;
      const bv = range === 0 ? 0 : volume * (b.close - b.low) / range;
      const sv = range === 0 ? 0 : volume * (b.high - b.close) / range;

      // RAW Pressure Volume Calculations
      const vol = Math.max(b.volume ?? 0, 1);
      const tp = bv + sv;
      const bpv = tp === 0 ? 0 : (bv / tp) * vol;
      const spv = tp === 0 ? 0 : (sv / tp) * vol;

      // Conditional columns: dominant positive, counterforce negative
      const bpCon = bpv > spv ? bpv : -Math.abs(bpv);
      const spCon = spv > bpv ? spv : -Math.abs(spv);

      // BuyVolume% and SellVolume%
      const total = bv + sv;
      const buyPct = total === 0 ? 50 : 100 * bv / total;
      const sellPct = total === 0 ? 50 : 100 * sv / total;

      // Volume Index: VN = vol / ema(vol, 20)
      const volEma20 = s.ema.step(vol);
      const vn = (volEma20 ?? 1) === 0 ? 0 : vol / (volEma20 ?? 1);

      const p = s.plots;
      // Volume plot: colored by bar direction
      p[0]![i] = { time, value: vol, color: b.close >= b.open ? 'rgba(76,175,80,0.30)' : 'rgba(244,67,54,0.30)' };
      p[1]![i] = { time, value: bpCon, color: '#26A69A' };
      p[2]![i] = { time, value: spCon, color: '#EF5350' };
      p[3]![i] = { time, value: buyPct, color: '#4CAF50' };
      p[4]![i] = { time, value: sellPct, color: '#EF5350' };
      if (i < warmup) {
        p[5]![i] = { time, value: NaN };
      } else {
        const isUp = b.close > b.open;
        const color = vn > vnLen && isUp ? '#00FFFF' : vn > vnLen ? 'rgba(158,158,158,0.90)' : 'rgba(255,255,0,0.90)';
        p[5]![i] = { time, value: vn, color };
      }

      // barcolor: blue when buy > sell, purple when sell > buy, gray otherwise
      if (bpCon > spCon) s.barColors.push({ time, color: '#2196F3' });
      else if (spCon > bpCon) s.barColors.push({ time, color: '#9C27B0' });
      else s.barColors.push({ time, color: '#787B86' });
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          volume: p[0]!.slice(),
          buyVol: p[1]!.slice(),
          sellVol: p[2]!.slice(),
          buyPct: p[3]!.slice(),
          sellPct: p[4]!.slice(),
          volIndex: p[5]!.slice(),
        },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyingSellVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuyingSellVolumeInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyingSellVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
