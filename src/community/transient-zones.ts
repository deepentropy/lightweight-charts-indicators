/**
 * Transient Zones v1.1
 *
 * PTZ (Potential Transient Zones) using lookback highs/lows with channel display,
 * plus confirmed TZ detection when a central bar is the extreme over a full window.
 *
 * Pine plots reproduced:
 *   - plot (channel_high): lowest low over h_left bars (silver) -- plot0
 *   - plot (channel_low): highest high over h_left bars (silver) -- plot1
 *   - plotshape triangleup: PTZ new high (green, above bar)
 *   - plotshape triangledown: PTZ new low (red, below bar)
 *   - plotarrow down: confirmed TZ high (placed at central bar)
 *   - plotarrow up: confirmed TZ low (placed at central bar)
 *   - plot (percent_total_tz): hidden (transp=100) -- plot2
 *   - plot (percent_total_ptz): hidden (transp=100) -- plot3
 *   - plot (percent_ptz_resolved): hidden (transp=100) -- plot4
 *
 * Reference: TradingView "Transient Zones v1.1" by Jurij (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TransientZonesInputs {
  hLeft: number;
  hRight: number;
  samplePeriod: number;
  showPtz: boolean;
  showChannel: boolean;
}

export const defaultInputs: TransientZonesInputs = {
  hLeft: 10,
  hRight: 10,
  samplePeriod: 5000,
  showPtz: true,
  showChannel: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'hLeft', type: 'int', title: 'H left', defval: 10, min: 1 },
  { id: 'hRight', type: 'int', title: 'H right', defval: 10, min: 1 },
  { id: 'samplePeriod', type: 'int', title: 'Sample bars for % TZ', defval: 5000, min: 1 },
  { id: 'showPtz', type: 'bool', title: 'Show PTZ', defval: true },
  { id: 'showChannel', type: 'bool', title: 'Show channel', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Channel High', color: '#C0C0C0', lineWidth: 1 },
  { id: 'plot1', title: 'Channel Low', color: '#C0C0C0', lineWidth: 1 },
  { id: 'plot2', title: '% Total TZ', color: '#000000', lineWidth: 1 },
  { id: 'plot3', title: '% Total PTZ', color: '#000080', lineWidth: 1 },
  { id: 'plot4', title: '% PTZ Resolved', color: '#808080', lineWidth: 1 },
];

export const metadata = {
  title: 'Transient Zones v1.1',
  shortTitle: 'TZ',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TransientZonesInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { hLeft, hRight, samplePeriod, showPtz, showChannel } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute h_left_low (lowest low over previous hLeft bars) and h_left_high (highest high over previous hLeft bars)
  const hLeftLow: number[] = new Array(n).fill(NaN);
  const hLeftHigh: number[] = new Array(n).fill(NaN);
  for (let i = hLeft; i < n; i++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 1; j <= hLeft; j++) {
      if (bars[i - j].low < lo) lo = bars[i - j].low;
      if (bars[i - j].high > hi) hi = bars[i - j].high;
    }
    hLeftLow[i] = lo;
    hLeftHigh[i] = hi;
  }

  // PTZ detection: newlow/newhigh
  const newLow: boolean[] = new Array(n).fill(false);
  const newHigh: boolean[] = new Array(n).fill(false);
  for (let i = hLeft; i < n; i++) {
    newLow[i] = bars[i].low <= hLeftLow[i];
    newHigh[i] = bars[i].high >= hLeftHigh[i];
  }

  // Channel plots: Pine plots h_left_low and h_left_high as channel (silver)
  const channelHighPlot = bars.map((b, i) => ({
    time: b.time,
    value: showChannel && i >= hLeft ? hLeftLow[i] : NaN,
  }));
  const channelLowPlot = bars.map((b, i) => ({
    time: b.time,
    value: showChannel && i >= hLeft ? hLeftHigh[i] : NaN,
  }));

  // Confirmed TZ: central bar is highest/lowest in full (hLeft + hRight + 1) window
  const fullWindow = hLeft + hRight + 1;
  const centralIsHighest: boolean[] = new Array(n).fill(false);
  const centralIsLowest: boolean[] = new Array(n).fill(false);
  for (let i = fullWindow - 1; i < n; i++) {
    const centralIdx = i - hRight;
    const centralLow = bars[centralIdx].low;
    const centralHigh = bars[centralIdx].high;
    let fullLow = Infinity;
    let fullHigh = -Infinity;
    for (let j = i - fullWindow + 1; j <= i; j++) {
      if (bars[j].low < fullLow) fullLow = bars[j].low;
      if (bars[j].high > fullHigh) fullHigh = bars[j].high;
    }
    centralIsHighest[centralIdx] = centralHigh >= fullHigh;
    centralIsLowest[centralIdx] = centralLow <= fullLow;
  }

  // TZ probability calc
  // cumulative counts of confirmed TZ highs and lows
  let highTzCount = 0;
  let lowTzCount = 0;
  let highPtzCount = 0;
  let lowPtzCount = 0;
  const percentTotalTz: number[] = new Array(n).fill(NaN);
  const percentTotalPtz: number[] = new Array(n).fill(NaN);
  const percentPtzResolved: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (centralIsHighest[i]) highTzCount++;
    if (centralIsLowest[i]) lowTzCount++;
    if (newHigh[i]) highPtzCount++;
    if (newLow[i]) lowPtzCount++;

    const totalTz = highTzCount + lowTzCount;
    const totalPtz = highPtzCount + lowPtzCount;
    const pctTzHigh = (highTzCount / samplePeriod) * 100;
    const pctTzLow = (lowTzCount / samplePeriod) * 100;
    percentTotalTz[i] = pctTzHigh + pctTzLow;

    const pctPtzHigh = (highPtzCount / samplePeriod) * 100;
    const pctPtzLow = (lowPtzCount / samplePeriod) * 100;
    percentTotalPtz[i] = pctPtzHigh + pctPtzLow;

    percentPtzResolved[i] = totalPtz > 0 ? (1 - totalTz / totalPtz) * 100 : NaN;
  }

  // Hidden probability plots (transp=100 in Pine = fully transparent)
  const pctTotalTzPlot = bars.map((b, i) => ({ time: b.time, value: percentTotalTz[i] }));
  const pctTotalPtzPlot = bars.map((b, i) => ({ time: b.time, value: percentTotalPtz[i] }));
  const pctPtzResolvedPlot = bars.map((b, i) => ({ time: b.time, value: percentPtzResolved[i] }));

  // Markers
  const markers: MarkerData[] = [];

  // plotshape: PTZ triangles
  if (showPtz) {
    for (let i = hLeft; i < n; i++) {
      if (newHigh[i]) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleUp', color: '#4CAF50' });
      }
      if (newLow[i]) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleDown', color: '#EF5350' });
      }
    }
  }

  // plotarrow: confirmed TZ arrows (placed at central bar via offset in Pine)
  for (let i = 0; i < n; i++) {
    if (centralIsHighest[i]) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'TZ' });
    }
    if (centralIsLowest[i]) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#4CAF50', text: 'TZ' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': channelHighPlot,
      'plot1': channelLowPlot,
      'plot2': pctTotalTzPlot,
      'plot3': pctTotalPtzPlot,
      'plot4': pctPtzResolvedPlot,
    },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(192,192,192,0.08)' } }],
    markers,
  };
}

export const TransientZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
