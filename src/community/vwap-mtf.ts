/**
 * VWAP MTF (Multi Timeframe)
 *
 * A VWAP of hl2 that restarts at each period of the timeframe input (a week by default): the sums of hl2 * volume
 * and of the volume start again on the first chart bar of a new period. The period of a bar is the start time of
 * its higher-timeframe bar (`security(tickerid, TimeFrame, time)`, version 1: every chart bar of a period gets the
 * value of that period). Before the first period change the sums are na (version 1 self-references start at na).
 * The VWAP is drawn as green circles when the close is above it, else red. Options: the VWAP of the previous period
 * at its last bar (circles, green when the close is above it) and bar colours with the VWAP colour.
 *
 * Version 1 plots have a default transparency of 35: the colours have an alpha of 0.65.
 *
 * Chart values (optional third argument of calculate): the periods follow the exchange calendar of the symbol (time
 * zone and session); without them the UTC rule of anchor-period.ts.
 *
 * Reference: "VWAP MTF" by TheYangGuizi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { securityStarts } from '../anchor-period';

export interface VwapMtfInputs {
  /** Timeframe of the VWAP periods */
  timeFrame: string;
  /** Show barcolors */
  showBcol: boolean;
  /** Show previous VWAP close */
  showPrevVWAP: boolean;
}

export const defaultInputs: VwapMtfInputs = {
  timeFrame: 'W',
  showBcol: false,
  showPrevVWAP: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'timeFrame', type: 'string', title: 'TimeFrame', defval: 'W' },
  { id: 'showBcol', type: 'bool', title: 'Show barcolors', defval: false },
  { id: 'showPrevVWAP', type: 'bool', title: 'Show previous VWAP close', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const GREEN = V1('#008000');
const RED = V1('#FF0000');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: GREEN, lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Plot', color: GREEN, lineWidth: 1, style: 'circles' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const metadata = {
  title: 'VWAP MTF',
  shortTitle: 'VWAP MTF',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<VwapMtfInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  // start = security(tickerid, TimeFrame, time); newSession = change(start) (na on the first bar: no new session)
  const start = securityStarts(bars, cfg.timeFrame, chart);

  const prevPlot: { time: number; value: number; color: string }[] = [];
  const vwapPlot: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  let vwapsum = NaN;
  let volumesum = NaN;
  let prevwap = NaN;
  let prevVwap = NaN; // myvwap[1]
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const newSession = i > 0 && start[i] !== start[i - 1];
    const hl2 = (b.high + b.low) / 2;
    const vol = b.volume ?? NaN;
    vwapsum = newSession ? hl2 * vol : vwapsum + hl2 * vol;
    volumesum = newSession ? vol : volumesum + vol;
    const myvwap = vwapsum / volumesum;
    const coloring = gt(b.close, myvwap) ? GREEN : RED;
    if (newSession) prevwap = prevVwap;
    prevVwap = myvwap;
    const prevValue = cfg.showPrevVWAP ? prevwap : NaN;
    prevPlot.push({ time: b.time, value: Number.isFinite(prevValue) ? prevValue : NaN, color: gt(b.close, prevwap) ? GREEN : RED });
    vwapPlot.push({ time: b.time, value: Number.isFinite(myvwap) ? myvwap : NaN, color: coloring });
    if (cfg.showBcol) barColors.push({ id: 'barcolor0', time: b.time, color: coloring });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: prevPlot, plot1: vwapPlot },
    barColors,
  };
}

export const VwapMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig };
