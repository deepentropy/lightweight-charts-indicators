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
 *   - plotarrow down: confirmed TZ high (`arrows`, id arrow0, value -1, placed at the central bar high[h_right + 1])
 *   - plotarrow up: confirmed TZ low (`arrows`, id arrow1, value 1, placed at the central bar low[h_right + 1])
 *   - plot (percent_total_tz): hidden (transp=100) -- plot2
 *   - plot (percent_total_ptz): hidden (transp=100) -- plot3
 *   - plot (percent_ptz_resolved): hidden (transp=100) -- plot4
 *
 * Reference: "Transient Zones v1.1" by Jurij (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ArrowData } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
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

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[] };

interface TzVars {
  /** Confirmed TZ highs / lows counted up to the central bar of the last window (h_right bars back) */
  highTzCount: number;
  lowTzCount: number;
  /** PTZ highs / lows counted up to the bar */
  highPtzCount: number;
  lowPtzCount: number;
}

interface TzRun extends BarRunState<TzVars> {
  /** PTZ counts up to each bar */
  highPtzCum: number[];
  lowPtzCum: number[];
  channelHighPlot: Point[];
  channelLowPlot: Point[];
  /** % total TZ and % PTZ resolved of each bar, written h_right bars later (when its TZ flags are known) */
  pctTotalTzPlot: Point[];
  pctTotalPtzPlot: Point[];
  pctPtzResolvedPlot: Point[];
  markers: MarkerData[];
  arrows: ArrowData[];
}

function study(inputs: Partial<TransientZonesInputs>): BarStudy<TzRun, Result> {
  const { hLeft, hRight, samplePeriod, showPtz, showChannel } = { ...defaultInputs, ...inputs };
  // Confirmed TZ: central bar is highest/lowest in full (hLeft + hRight + 1) window
  const fullWindow = hLeft + hRight + 1;
  // TZ probability calc
  const pctTotalTz = (highTzCount: number, lowTzCount: number) => {
    const pctTzHigh = (highTzCount / samplePeriod) * 100;
    const pctTzLow = (lowTzCount / samplePeriod) * 100;
    return pctTzHigh + pctTzLow;
  };
  const pctResolved = (totalTz: number, totalPtz: number) => (totalPtz > 0 ? (1 - totalTz / totalPtz) * 100 : NaN);
  return {
    init() {
      const s: TzRun = {
        highPtzCum: [], lowPtzCum: [], channelHighPlot: [], channelLowPlot: [], pctTotalTzPlot: [],
        pctTotalPtzPlot: [], pctPtzResolvedPlot: [], markers: [], arrows: [], steps: [],
        vars: { highTzCount: 0, lowTzCount: 0, highPtzCount: 0, lowPtzCount: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.arrows];
      s.series = [
        s.highPtzCum, s.lowPtzCum, s.channelHighPlot, s.channelLowPlot, s.pctTotalTzPlot, s.pctTotalPtzPlot,
        s.pctPtzResolvedPlot,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      // Compute h_left_low (lowest low over previous hLeft bars) and h_left_high (highest high over previous hLeft bars)
      let hLeftLow = NaN;
      let hLeftHigh = NaN;
      // PTZ detection: newlow/newhigh
      let newLow = false;
      let newHigh = false;
      if (i >= hLeft) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let j = 1; j <= hLeft; j++) {
          if (bars[i - j].low < lo) lo = bars[i - j].low;
          if (bars[i - j].high > hi) hi = bars[i - j].high;
        }
        hLeftLow = lo;
        hLeftHigh = hi;
        newLow = bars[i].low <= hLeftLow;
        newHigh = bars[i].high >= hLeftHigh;
      }
      // Channel plots: Pine plots h_left_low and h_left_high as channel (silver)
      s.channelHighPlot[i] = { time, value: showChannel && i >= hLeft ? hLeftLow : NaN };
      s.channelLowPlot[i] = { time, value: showChannel && i >= hLeft ? hLeftHigh : NaN };

      // the window lowest / highest(h_left + h_right + 1) ending at this bar
      let centralIsHighest = false;
      let centralIsLowest = false;
      if (i >= fullWindow - 1) {
        let fullLow = Infinity;
        let fullHigh = -Infinity;
        for (let j = i - fullWindow + 1; j <= i; j++) {
          if (bars[j].low < fullLow) fullLow = bars[j].low;
          if (bars[j].high > fullHigh) fullHigh = bars[j].high;
        }
        const centralIdx = i - hRight;
        centralIsHighest = bars[centralIdx].high >= fullHigh;
        centralIsLowest = bars[centralIdx].low <= fullLow;
        // plotarrow(central_bar_is_highest ? -1 : 0, offset = -h_right - 1) / plotarrow(central_bar_is_lowest ? 1 : 0, ...):
        // on bar i the central bar is i - h_right - 1 and the window lowest / highest(h_left + h_right + 1) ends at i; the
        // offset draws the arrow on the central bar (a value 0 draws none)
        const c = i - hRight - 1;
        if (c >= 0) {
          if (bars[c].high >= fullHigh) s.arrows.push({ time: bars[c].time, id: 'arrow0', value: -1, color: '#EF5350' });
          if (bars[c].low <= fullLow) s.arrows.push({ time: bars[c].time, id: 'arrow1', value: 1, color: '#4CAF50' });
        }
      }

      // cumulative counts of PTZ highs and lows
      if (newHigh) v.highPtzCount++;
      if (newLow) v.lowPtzCount++;
      s.highPtzCum[i] = v.highPtzCount;
      s.lowPtzCum[i] = v.lowPtzCount;
      const pctPtzHigh = (v.highPtzCount / samplePeriod) * 100;
      const pctPtzLow = (v.lowPtzCount / samplePeriod) * 100;
      s.pctTotalPtzPlot[i] = { time, value: pctPtzHigh + pctPtzLow };

      // cumulative counts of confirmed TZ highs and lows: the flags of the central bar (h_right bars back) are known
      // on this bar, the only writer of its % values
      const c0 = i - hRight;
      if (c0 >= 0) {
        if (centralIsHighest) v.highTzCount++;
        if (centralIsLowest) v.lowTzCount++;
        const ct = bars[c0].time;
        s.pctTotalTzPlot[c0] = { time: ct, value: pctTotalTz(v.highTzCount, v.lowTzCount) };
        s.pctPtzResolvedPlot[c0] = {
          time: ct, value: pctResolved(v.highTzCount + v.lowTzCount, s.highPtzCum[c0] + s.lowPtzCum[c0]),
        };
      }

      // plotshape: PTZ triangles
      if (showPtz && i >= hLeft) {
        if (newHigh) s.markers.push({ time, position: 'aboveBar', shape: 'triangleUp', color: '#4CAF50' });
        if (newLow) s.markers.push({ time, position: 'belowBar', shape: 'triangleDown', color: '#EF5350' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const v = s.vars;
      // Hidden probability plots (transp=100 in Pine = fully transparent); the last h_right bars have no confirmed
      // TZ flag yet: their TZ counts stay at the count of the last central bar
      const pctTotalTzPlot = s.pctTotalTzPlot.slice();
      const pctPtzResolvedPlot = s.pctPtzResolvedPlot.slice();
      for (let j = Math.max(0, n - hRight); j < n; j++) {
        const time = bars[j].time;
        pctTotalTzPlot[j] = { time, value: pctTotalTz(v.highTzCount, v.lowTzCount) };
        pctPtzResolvedPlot[j] = { time, value: pctResolved(v.highTzCount + v.lowTzCount, s.highPtzCum[j] + s.lowPtzCum[j]) };
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.channelHighPlot.slice(),
          'plot1': s.channelLowPlot.slice(),
          'plot2': pctTotalTzPlot,
          'plot3': s.pctTotalPtzPlot.slice(),
          'plot4': pctPtzResolvedPlot,
        },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(192,192,192,0.08)' } }],
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TransientZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TransientZonesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TransientZones = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
