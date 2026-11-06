/**
 * Volume Profile [LuxAlgo]
 *
 * Volume profile of the last "Lookback" bars, drawn on the last bar. The range between the highest high and the
 * lowest low of these bars is cut into "Row Size" rows. A bar gives its whole volume to every row that its range
 * crosses. Each row is a horizontal line whose length is its volume against the largest row volume, in percent of
 * the lookback ("Width"). The rows start at the oldest bar of the lookback and grow to the right, or start at the
 * last bar and grow to the left with "Flip Histogram". The row with the largest volume is the point of control: a
 * dotted line through its middle over the whole lookback. With "Gradient" the row colour comes from a fixed scale
 * of 100 colours, by the row length.
 * "Show Rolling POC" plots the middle of the largest row of every bar.
 *
 * These are the drawings of the last bar: they move when a bar is added. Nothing is drawn with fewer bars than
 * "Lookback".
 *
 * Reference: "Volume Profile [LUX]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright LuxAlgo
 */

import { array, compare, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeProfileInputs {
  /** Lookback */
  length: number;
  /** Row Size */
  row: number;
  /** Show Rolling POC */
  showRpoc: boolean;
  /** Width (% of the box) */
  width: number;
  /** Bar Width */
  barWidth: number;
  /** Flip Histogram */
  flip: boolean;
  /** Gradient */
  grad: boolean;
  /** Rows Solid Color */
  solid: string;
  /** POC Solid Color */
  pocColor: string;
}

export const defaultInputs: VolumeProfileInputs = {
  length: 500,
  row: 200,
  showRpoc: false,
  width: 50,
  barWidth: 2,
  flip: false,
  grad: true,
  solid: '#2157f3',
  pocColor: '#ff5d00',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'length', type: 'int', title: 'Lookback', defval: 500, min: 1, max: 1000, group: 'Basic',
    tooltip: 'Number of most recent bars to use for the calculation of the volume profile',
  },
  {
    id: 'row', type: 'int', title: 'Row Size', defval: 200, min: 1, max: 500, group: 'Basic',
    tooltip: 'Determines the number of rows used for the calculation of the volume profile',
  },
  {
    id: 'showRpoc', type: 'bool', title: 'Show Rolling POC', defval: false, group: 'Basic',
    tooltip: 'Determines whether to display the rolling POC of the volume profile',
  },
  {
    id: 'width', type: 'int', title: 'Width (% of the box)', defval: 50, min: 1, max: 100, group: 'Style',
    tooltip: 'Determines the length of the bars relative to the Lookback value',
  },
  { id: 'barWidth', type: 'int', title: 'Bar Width', defval: 2, group: 'Style', tooltip: 'Width of each bar' },
  {
    id: 'flip', type: 'bool', title: 'Flip Histogram', defval: false, group: 'Style',
    tooltip: 'Flip the histogram, when enabled, the histogram base will be located at the most recent candle',
  },
  {
    id: 'grad', type: 'bool', title: 'Gradient', defval: true, group: 'Style',
    tooltip: 'Allows to color the volume profile bars with a gradient, with a color intensity determined by the length of each bar',
  },
  {
    id: 'solid', type: 'color', title: 'Rows Solid Color', defval: '#2157f3', group: 'Style',
    tooltip: 'Color of each bar when "Gradient" is disabled',
  },
  {
    id: 'pocColor', type: 'color', title: 'POC Solid Color', defval: '#ff5d00', group: 'Style',
    tooltip: 'Color of the POC when "Gradient" is disabled',
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rolling POC', color: '#ff1100', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Profile [LUX]',
  shortTitle: 'Volume Profile [LuxAlgo]',
  overlay: true,
};

/** Colour scale of the rows (100 colours, from the shortest to the longest row) */
const VOL_CSS = [
  '#1E152A', '#1E162B', '#1F182C', '#1F192E', '#201B2F', '#211C31', '#211E32', '#222034', '#222135', '#232337',
  '#242438', '#24263A', '#25273B', '#25293D', '#262B3E', '#272C3F', '#272E41', '#282F42', '#283144', '#293245',
  '#2A3447', '#2A3648', '#2B374A', '#2B394B', '#2C3A4D', '#2D3C4E', '#2D3D50', '#2E3F51', '#2E4153', '#2F4254',
  '#304455', '#304557', '#314758', '#32495A', '#324A5B', '#334C5D', '#334D5E', '#344F60', '#355061', '#355263',
  '#365464', '#365566', '#375767', '#385868', '#385A6A', '#395B6B', '#395D6D', '#3A5F6E', '#3B6070', '#3B6271',
  '#3C6373', '#3C6574', '#3D6676', '#3E6877', '#3E6A79', '#3F6B7A', '#3F6D7C', '#406E7D', '#41707E', '#417180',
  '#427381', '#427583', '#437684', '#447886', '#447987', '#457B89', '#467D8A', '#467E8C', '#47808D', '#47818F',
  '#488390', '#498491', '#498693', '#4A8894', '#4A8996', '#4B8B97', '#4C8C99', '#4C8E9A', '#4D8F9C', '#4D919D',
  '#4E939F', '#4F94A0', '#4F96A2', '#5097A3', '#5099A5', '#519AA6', '#529CA7', '#529EA9', '#539FAA', '#53A1AC',
  '#54A2AD', '#55A4AF', '#55A5B0', '#56A7B2', '#56A9B3', '#57AAB5', '#58ACB6', '#58ADB8', '#59AFB9', '#5AB1BB',
];
const POC_GRADIENT = '#5AB1BB';

/** Row volumes of the `length` bars that end on bar i; undefined before `length` bars (highest / lowest are na) */
function profile(bars: Bar[], i: number, length: number, row: number): { levels: number[]; sumv: number[] } | undefined {
  if (i < length - 1) return undefined;
  let highest = -Infinity;
  let lowest = Infinity;
  for (let k = 0; k < length; k++) {
    highest = Math.max(highest, bars[i - k].high);
    lowest = Math.min(lowest, bars[i - k].low);
  }
  const levels: number[] = [];
  for (let j = 0; j <= row; j++) levels.push(lowest + (j / row) * (highest - lowest));
  // sum := high[k] > levels[j] and low[k] < levels[j + 1] ? sum + volume[k] : sum
  // The rows crossed by a bar are consecutive (the levels do not decrease): jLo .. jHi
  const sumv: number[] = new Array(row).fill(0);
  const scale = row / (highest - lowest);
  for (let k = 0; k < length; k++) {
    const b = bars[i - k];
    const v = b.volume ?? NaN;
    const guess = (p: number) => {
      const g = Math.floor((p - lowest) * scale);
      return g >= 0 ? Math.min(g, row - 1) : 0; // also for a NaN guess (a flat range)
    };
    let jHi = guess(b.high);
    while (jHi < row - 1 && compare.gt(b.high, levels[jHi + 1])) jHi++;
    while (jHi >= 0 && !compare.gt(b.high, levels[jHi])) jHi--;
    let jLo = guess(b.low);
    while (jLo > 0 && compare.lt(b.low, levels[jLo])) jLo--;
    while (jLo < row && !compare.lt(b.low, levels[jLo + 1])) jLo++;
    for (let j = jLo; j <= jHi; j++) sumv[j] += v;
  }
  return { levels, sumv };
}

type Result = IndicatorResult & { lines: LineDrawingData[] };

interface VolumeProfileRun extends BarRunState<Record<string, never>> {
  plot0: { time: number; value: number }[];
}

function study(inputs: Partial<VolumeProfileInputs>): BarStudy<VolumeProfileRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, row } = cfg;
  return {
    init() {
      const s: VolumeProfileRun = { plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      // Rolling POC: avg(Alvl, Blvl), the two levels of the first row with the largest volume
      s.plot0[i] = { time: bars[i].time as number, value: NaN };
      if (cfg.showRpoc && i >= length - 1) {
        const p = profile(bars, i, length, row);
        if (!p) return;
        const idx = array.indexof(p.sumv, array.max(p.sumv));
        if (idx < 0) throw new Error(`Index ${idx} is out of bounds, array size is ${p.levels.length}`);
        s.plot0[i].value = (p.levels[idx] + p.levels[idx + 1]) / 2;
      }
    },
    result(s, bars) {
      const n = bars.length;
      const last = n - 1;
      // The lines of the last bar (built from the bars on each update: they move when a bar is added)
      const lines: LineDrawingData[] = [];
      const p = n > 0 ? profile(bars, last, length, row) : undefined;
      if (p) {
        const interval = barInterval(bars);
        const time = (x: number) => barTime(bars, x, interval);
        const max = array.max(p.sumv);
        let poc: LineDrawingData | undefined;
        for (let j = 0; j < row; j++) {
          const mult = p.sumv[j] / max;
          if (Number.isNaN(mult)) continue; // a line with an na coordinate is not drawn
          const get = p.levels[j];
          const len = math.round(((length * cfg.width) / 100) * mult);
          const [x1, x2] = cfg.flip ? [last, last - len] : [last - length + 1, last - length + len];
          lines.push({
            time1: time(x1), price1: get, time2: time(x2), price2: get,
            color: cfg.grad ? VOL_CSS[math.round(mult * 99)] : cfg.solid, width: cfg.barWidth,
          });
          if (compare.eq(mult, 1)) {
            const avg = (get + p.levels[j + 1]) / 2;
            const [px1, px2] = cfg.flip ? [last, last - length + 1] : [last - length + 1, last];
            poc = {
              time1: time(px1), price1: avg, time2: time(px2), price2: avg,
              color: cfg.grad ? POC_GRADIENT : cfg.pocColor, style: 'dotted', width: cfg.barWidth,
            };
          }
        }
        if (poc) lines.push(poc);
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        lines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeProfileInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeProfileInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeProfile = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
