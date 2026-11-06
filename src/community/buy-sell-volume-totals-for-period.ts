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
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Result = IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] };

interface BuySellVars {
  totalBuyVolume: number;
  totalSellVolume: number;
}

interface BuySellRun extends BarRunState<BuySellVars> {
  /** Time unit of the bars (seconds: 1000) */
  ms: number;
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<BuySellVolumeTotalsForPeriodInputs>): BarStudy<BuySellRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const chars = [GREEN, RED, YELLOW];
  const timeUnit = (bars: Bar[]) => (bars.length > 0 && bars[0].time < 1e12 ? 1000 : 1);
  return {
    // the time unit of the first bar
    key: (bars) => String(timeUnit(bars)),
    init(bars) {
      const s: BuySellRun = {
        ms: timeUnit(bars), plot0: [], plot1: [], markers: [], bgColors: [],
        steps: [], vars: { totalBuyVolume: 0, totalSellVolume: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time * s.ms;
      const inDateRange = cfg.useEndTime ? t >= cfg.startTime && t <= cfg.endTime : t >= cfg.startTime;
      if (!inDateRange) {
        v.totalBuyVolume = 0;
        v.totalSellVolume = 0;
      }
      const vol = b.volume ?? NaN;
      const flat = eq(b.high, b.low);
      const buyVolume = flat ? 0 : (vol * (b.close - b.low)) / (b.high - b.low);
      const sellVolume = flat ? 0 : (vol * (b.high - b.close)) / (b.high - b.low);
      if (inDateRange) {
        v.totalBuyVolume += buyVolume;
        v.totalSellVolume += sellVolume;
      }
      const totalBuyVolume = v.totalBuyVolume;
      const totalSellVolume = v.totalSellVolume;
      const ratio = gt(totalSellVolume, 0) ? totalBuyVolume / totalSellVolume : 0;
      const isAccumulation = gt(totalBuyVolume, totalSellVolume);

      // plotchar(..., location.top): na and 0 draw no character
      for (let k = 0; k < 3; k++) {
        const x = k === 0 ? totalBuyVolume : k === 1 ? totalSellVolume : ratio;
        if (Number.isFinite(x) && x !== 0) {
          s.markers.push({
            id: `char${k}`, time: b.time, position: 'top', shape: 'circle', color: 'transparent', text: '',
            textColor: chars[k],
          });
        }
      }

      s.plot0[i] = { time: b.time, value: Number.isFinite(vol) ? vol : NaN };
      s.plot1[i] = { time: b.time, value: Number.isFinite(buyVolume) ? buyVolume : NaN };
      // bgcolor(color.new(accDistrColor, inDateRange ? 70 : 100)): transparent outside the period
      if (inDateRange) s.bgColors.push({ id: 'bgcolor0', time: b.time, color: isAccumulation ? BG_GREEN : BG_RED });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuySellVolumeTotalsForPeriodInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuySellVolumeTotalsForPeriodInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars)) as IndicatorResult;
}

export const BuySellVolumeTotalsForPeriod = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  barColorConfig,
};
