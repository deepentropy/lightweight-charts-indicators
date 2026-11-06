/**
 * Asian & London Session High/Low
 *
 * Session times in the fixed time zone Europe/Sofia: Asian 00:00 - 08:00, London 09:00 - 16:30 of the bar day.
 * The high and the low of the bars that open in each session are tracked (kept between sessions); all four values
 * are reset to na on the bars that open at or after 16:30 Europe/Sofia. The bar open time decides: on daily bars
 * this is the session open time of the bar.
 *
 * Reference: "Asian & London Session High/Low" by NikolayBorisov
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, time as ptime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AsianLondonSessionHighLowInputs {}

export const defaultInputs: AsianLondonSessionHighLowInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Asian High', color: color.fuchsia, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Asian Low', color: color.fuchsia, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'London High', color: color.orange, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'London Low', color: color.orange, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Asian & London Session High/Low',
  shortTitle: 'Asian & London Session High/Low',
  overlay: true,
};

const TZ = 'Europe/Sofia';

type Point = { time: number; value: number };

interface SessionVars {
  aH: number;
  aL: number;
  lH: number;
  lL: number;
}

interface SessionRun extends BarRunState<SessionVars> {
  asianHigh: Point[];
  asianLow: Point[];
  londonHigh: Point[];
  londonLow: Point[];
}

function study(): BarStudy<SessionRun, IndicatorResult> {
  return {
    init() {
      const s: SessionRun = {
        asianHigh: [], asianLow: [], londonHigh: [], londonLow: [],
        steps: [], vars: { aH: NaN, aL: NaN, lH: NaN, lL: NaN }, lists: [], series: [],
      };
      s.series = [s.asianHigh, s.asianLow, s.londonHigh, s.londonLow];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // Pine `time`: bar open time in milliseconds
      const t = b.time * 1000;
      const y = ptime.year(t, TZ);
      const m = ptime.month(t, TZ);
      const d = ptime.dayofmonth(t, TZ);
      const asianStart = ptime.timestamp(TZ, y, m, d, 0, 0);
      const asianEnd = ptime.timestamp(TZ, y, m, d, 8, 0);
      const londonStart = ptime.timestamp(TZ, y, m, d, 9, 0);
      const londonEnd = ptime.timestamp(TZ, y, m, d, 16, 30);
      const inAsian = t >= asianStart && t < asianEnd;
      const inLondon = t >= londonStart && t < londonEnd;
      if (inAsian) {
        v.aH = isNaN(v.aH) ? b.high : Math.max(v.aH, b.high);
        v.aL = isNaN(v.aL) ? b.low : Math.min(v.aL, b.low);
      }
      if (inLondon) {
        v.lH = isNaN(v.lH) ? b.high : Math.max(v.lH, b.high);
        v.lL = isNaN(v.lL) ? b.low : Math.min(v.lL, b.low);
      }
      // Reset after 16:30
      if (t >= ptime.timestamp(TZ, y, m, d, 16, 30)) {
        v.aH = NaN;
        v.aL = NaN;
        v.lH = NaN;
        v.lL = NaN;
      }
      s.asianHigh[i] = { time: b.time, value: v.aH };
      s.asianLow[i] = { time: b.time, value: v.aL };
      s.londonHigh[i] = { time: b.time, value: v.lH };
      s.londonLow[i] = { time: b.time, value: v.lL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.asianHigh.slice(),
          plot1: s.asianLow.slice(),
          plot2: s.londonHigh.slice(),
          plot3: s.londonLow.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<AsianLondonSessionHighLowInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<AsianLondonSessionHighLowInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const AsianLondonSessionHighLow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
