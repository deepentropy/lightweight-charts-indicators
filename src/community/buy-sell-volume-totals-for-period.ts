/**
 * Buy/Sell Volume Totals for Period
 *
 * Splits the volume of each bar into a buy part, volume * (close - low) / (high - low), and a sell part,
 * volume * (high - close) / (high - low) (0 on a bar with high == low). From the start time (and up to the end time
 * when "Use End Time?" is on) the parts are summed; outside the period the totals are 0. Columns show the volume
 * and the buy part; the background is green while the buy total is above the sell total, red otherwise, and only
 * inside the period. Three empty characters at the top carry the buy total, the sell total and their ratio.
 *
 * Reference: "Buy/Sell Volume Totals for Period" by vace117
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type Bar, type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';

export interface BuySellVolumeTotalsForPeriodInputs {
  /** Start of the period (ms) */
  startTime: number;
  /** Use the end time */
  useEndTime: boolean;
  /** End of the period (ms) */
  endTime: number;
}

export const defaultInputs: BuySellVolumeTotalsForPeriodInputs = {
  startTime: 1639094400000, // timestamp("10 Dec 2021")
  useEndTime: false,
  endTime: 1641254400000, // timestamp("04 Jan 2022")
};

export const inputConfig: InputConfig[] = [
  { id: 'startTime', type: 'time', title: 'Start Time', defval: 1639094400000 },
  { id: 'useEndTime', type: 'bool', title: 'Use End Time?', defval: false },
  { id: 'endTime', type: 'time', title: 'End Time', defval: 1641254400000 },
];

// Pine v4 colours
const GREEN = '#4CAF50';
const RED = '#FF5252';
const YELLOW = '#FFEB3B';
const TEAL = '#00897B';
const BG_GREEN = 'rgba(76, 175, 80, 0.3)'; // color.new(color.green, 70)
const BG_RED = 'rgba(255, 82, 82, 0.3)'; // color.new(color.red, 70)

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BUY+SELL V', color: RED, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'BUY V', color: TEAL, lineWidth: 1, style: 'columns' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Total Buy Volume', char: '', location: 'top', color: GREEN },
  { id: 'char1', kind: 'char', title: 'Total Sell Volume', char: '', location: 'top', color: RED },
  { id: 'char2', kind: 'char', title: 'Total Buy/Sell Ratio', char: '', location: 'top', color: YELLOW },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const metadata = {
  title: 'Buy/Sell Volume Totals for Period',
  shortTitle: 'Buy/Sell Volume Totals for Period',
  overlay: false,
  format: 'volume',
  precision: 3,
};

/** Pine float comparisons (1e-10) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(bars: Bar[], inputs: Partial<BuySellVolumeTotalsForPeriodInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const chars = [GREEN, RED, YELLOW];

  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time * ms;
    const inDateRange = cfg.useEndTime ? t >= cfg.startTime && t <= cfg.endTime : t >= cfg.startTime;
    if (!inDateRange) {
      totalBuyVolume = 0;
      totalSellVolume = 0;
    }
    const vol = b.volume ?? NaN;
    const flat = eq(b.high, b.low);
    const buyVolume = flat ? 0 : (vol * (b.close - b.low)) / (b.high - b.low);
    const sellVolume = flat ? 0 : (vol * (b.high - b.close)) / (b.high - b.low);
    if (inDateRange) {
      totalBuyVolume += buyVolume;
      totalSellVolume += sellVolume;
    }
    const ratio = gt(totalSellVolume, 0) ? totalBuyVolume / totalSellVolume : 0;
    const isAccumulation = gt(totalBuyVolume, totalSellVolume);

    // plotchar(..., location.top): na and 0 draw no character
    [totalBuyVolume, totalSellVolume, ratio].forEach((v, k) => {
      if (Number.isFinite(v) && v !== 0) {
        markers.push({
          id: `char${k}`, time: b.time, position: 'top', shape: 'circle', color: 'transparent', text: '',
          textColor: chars[k],
        });
      }
    });

    plot0.push({ time: b.time, value: Number.isFinite(vol) ? vol : NaN });
    plot1.push({ time: b.time, value: Number.isFinite(buyVolume) ? buyVolume : NaN });
    // bgcolor(color.new(accDistrColor, inDateRange ? 70 : 100)): transparent outside the period
    if (inDateRange) bgColors.push({ id: 'bgcolor0', time: b.time, color: isAccumulation ? BG_GREEN : BG_RED });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
    bgColors,
  } as IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] };
}

export const BuySellVolumeTotalsForPeriod = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  barColorConfig,
};
