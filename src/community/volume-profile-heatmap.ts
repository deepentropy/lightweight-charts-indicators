/**
 * Volume Profile Heatmap [KEYALGOS]
 *
 * On every bar a volume profile of the last `lookback` bars: the range from the lowest low to the highest high is cut
 * into `numRows` rows, and the volume of each bar (all bars, or only up / down bars) is shared equally between the
 * rows its low..high range touches. The POC is the row with the most volume; the value area grows from the POC
 * towards the larger neighbour row until it holds `vaPercent` % of the volume (VAH / VAL). The rows are drawn as
 * bands between 25 transparent level lines, filled with a gradient from the low volume colour to the high volume
 * colour by the row volume / max row volume. When the range is not positive (warm-up, flat market) every level is
 * the close.
 *
 * Reference: "Volume Profile Heatmap [KEYALGOS]" by KeyAlgos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Visuals & Gradient Logic: Original. Performance Optimizations & Architecture: Credited to
 * u/Mess_Hot (Reddit)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeProfileHeatmapInputs {
  /** Number of bars of the volume profile */
  lookback: number;
  /** Profile rows (10..24) */
  numRows: number;
  /** Value area % */
  vaPercent: number;
  /** Volume of all bars ('Both'), of up bars ('Bullish') or of down bars ('Bearish') */
  volumeType: 'Both' | 'Bullish' | 'Bearish';
  colorHighVol: string;
  colorLowVol: string;
  colorPoc: string;
  colorVah: string;
  colorExtreme: string;
  showPoc: boolean;
  showVaLines: boolean;
  showExtremes: boolean;
}

const DEF_HIGH_VOL = String(color.new('#FF0000', 60));
// Pine input default color.new(#FFFFE0, 90): Pine stores an input.color default with an alpha of 2 decimals
// (rgba(255,255,224,0.1)) and the script receives the alpha byte round(255 * 0.1) = 26 (0x1A), where
// color.new(#FFFFE0, 90) inside a script has the byte 25 (oakscriptjs #122).
const DEF_LOW_VOL = '#FFFFE01A';

export const defaultInputs: VolumeProfileHeatmapInputs = {
  lookback: 100,
  numRows: 24,
  vaPercent: 68,
  volumeType: 'Both',
  colorHighVol: DEF_HIGH_VOL,
  colorLowVol: DEF_LOW_VOL,
  colorPoc: color.orange,
  colorVah: color.blue,
  colorExtreme: color.gray,
  showPoc: true,
  showVaLines: true,
  showExtremes: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 100, min: 10, max: 300 },
  { id: 'numRows', type: 'int', title: 'Profile Rows (Max 24)', defval: 24, min: 10, max: 24 },
  { id: 'vaPercent', type: 'int', title: 'Value Area %', defval: 68, min: 5, max: 95 },
  { id: 'volumeType', type: 'string', title: 'Volume Type', defval: 'Both', options: ['Both', 'Bullish', 'Bearish'] },
  { id: 'colorHighVol', type: 'color', title: 'High Volume Color', defval: DEF_HIGH_VOL },
  { id: 'colorLowVol', type: 'color', title: 'Low Volume Color', defval: DEF_LOW_VOL },
  { id: 'colorPoc', type: 'color', title: 'POC Line', defval: color.orange },
  { id: 'colorVah', type: 'color', title: 'VAH/VAL Lines', defval: color.blue },
  { id: 'colorExtreme', type: 'color', title: 'Extreme Lines', defval: color.gray },
  { id: 'showPoc', type: 'bool', title: 'Show POC', defval: true },
  { id: 'showVaLines', type: 'bool', title: 'Show Value Area Lines', defval: true },
  { id: 'showExtremes', type: 'bool', title: 'Show Profile Extremes', defval: true },
];

const LEVELS = 25;
const LEVEL_COLOR = String(color.new(color.gray, 100));

export const plotConfig: PlotConfig[] = [
  // plot(lK, '', color = color.new(color.gray, 100), editable = false): the band edges (untitled in Pine)
  ...Array.from({ length: LEVELS }, (_v, k): PlotConfig => ({ id: `plot${k}`, title: `Level ${k}`, color: LEVEL_COLOR, lineWidth: 1 })),
  { id: 'plot25', title: 'POC', color: color.orange, lineWidth: 2 },
  { id: 'plot26', title: 'VAH', color: color.blue, lineWidth: 1 },
  { id: 'plot27', title: 'VAL', color: color.blue, lineWidth: 1 },
  { id: 'plot28', title: 'High', color: color.gray, lineWidth: 1, style: 'linebr' },
  { id: 'plot29', title: 'Low', color: color.gray, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Volume Profile Heatmap [KEYALGOS]',
  shortTitle: 'Volume Profile Heatmap [KEYALGOS]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };

interface VphRun extends BarRunState<Record<string, never>> {
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  plots: Point[][];
  fillColors: string[][];
}

function study(inputs: Partial<VolumeProfileHeatmapInputs>): BarStudy<VphRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lookback, numRows, vaPercent, volumeType } = cfg;
  const levelCount = numRows - 1;
  // the rows: every row is written again on every bar (both branches) before it is read
  const volumes: number[] = new Array(numRows).fill(0.0);
  return {
    init() {
      const highest = taStep.highest();
      const lowest = taStep.lowest();
      const s: VphRun = {
        highest, lowest, plots: Array.from({ length: 30 }, () => []), fillColors: Array.from({ length: LEVELS - 1 }, () => []),
        steps: [highest, lowest], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots, ...s.fillColors];
      return s;
    },
    bar(s, b, bars) {
      const vol = (i: number) => bars[i].volume ?? NaN;
      // The cache and the rows are written again on every bar (both branches): no state is carried between bars
      let cachedPoc = 0.0;
      let cachedVah = 0.0;
      let cachedVal = 0.0;
      let cachedHigh = 0.0;
      let cachedLow = 0.0;
      let cachedMaxVol = 0.0;
      let maxVol = 0.0;
      let pocIdx = 0;
      const bar = bars[b];
      // ta.highest(lookback) / ta.lowest(lookback): high / low (run on every bar: barstate.isnew is true on history)
      const profileHigh = s.highest.step(bar.high, lookback);
      const profileLow = s.lowest.step(bar.low, lookback);
      const priceRange = profileHigh - profileLow;

      if (gt(priceRange, 0)) {
        for (let r = 0; r < numRows; r++) volumes[r] = 0.0;
        const rowHeight = priceRange / numRows;

        // Build the histogram: bar i bars ago, i = 0 .. lookback - 1
        for (let i = 0; i < lookback; i++) {
          const j0 = b - i;
          const c = j0 >= 0 ? bars[j0] : undefined;
          let includeVol = false;
          if (volumeType === 'Both') includeVol = true;
          else if (volumeType === 'Bullish') includeVol = c !== undefined && gt(c.close, c.open);
          else if (volumeType === 'Bearish') includeVol = c !== undefined && lt(c.close, c.open);
          const v = j0 >= 0 ? vol(j0) : NaN;
          if (includeVol && gt(v, 0) && c !== undefined) {
            let startRow = Math.trunc(Math.floor((c.low - profileLow) / rowHeight));
            let endRow = Math.trunc(Math.ceil((c.high - profileLow) / rowHeight));
            // Clamp to the rows
            startRow = Math.max(0, Math.min(startRow, levelCount));
            endRow = Math.max(0, Math.min(endRow, levelCount));
            const volPerRow = v / (endRow - startRow + 1);
            for (let j = startRow; j <= endRow; j++) volumes[j] = volumes[j] + volPerRow;
          }
        }

        // array.max (skips na), array.indexof (first element == max, Pine ==)
        maxVol = NaN;
        for (const x of volumes) if (!isNaN(x) && (isNaN(maxVol) || x > maxVol)) maxVol = x;
        pocIdx = volumes.findIndex((x) => eq(x, maxVol));
        // Not reached (the max is an element of the array); kept as in Pine
        if (pocIdx === -1) pocIdx = Math.trunc(numRows / 2);

        const pocLevel = profileLow + pocIdx * rowHeight;
        let totalVol = 0;
        for (const x of volumes) totalVol += x;
        const targetVol = (totalVol * vaPercent) / 100.0;
        let vaUp = pocIdx;
        let vaDown = pocIdx;
        let accVol = maxVol;
        let safety = 0;
        while (lt(accVol, targetVol) && (vaUp < levelCount || vaDown > 0) && safety < numRows) {
          safety += 1;
          const vUp = vaUp < levelCount ? volumes[vaUp + 1] : 0.0;
          const vDown = vaDown > 0 ? volumes[vaDown - 1] : 0.0;
          if (ge(vUp, vDown) && vaUp < levelCount) {
            vaUp += 1;
            accVol += vUp;
          } else if (vaDown > 0) {
            vaDown -= 1;
            accVol += vDown;
          } else {
            break;
          }
        }
        if (vaUp < vaDown) {
          vaUp = pocIdx;
          vaDown = pocIdx;
        }
        cachedPoc = pocLevel;
        cachedVah = profileLow + vaUp * rowHeight;
        cachedVal = profileLow + vaDown * rowHeight;
        cachedHigh = profileHigh;
        cachedLow = profileLow;
        cachedMaxVol = maxVol;
      } else {
        // Flat market handling (also the warm-up, where the range is na)
        cachedPoc = bar.close;
        cachedVah = bar.close;
        cachedVal = bar.close;
        cachedHigh = bar.close;
        cachedLow = bar.close;
        cachedMaxVol = 0.0;
        for (let r = 0; r < numRows; r++) volumes[r] = 0.0;
      }

      // Heatmap
      const plotRange = cachedHigh - cachedLow;
      const rowHeightCalc = gt(plotRange, 0) ? plotRange / numRows : 0.0;
      const t = bar.time;
      for (let k = 0; k < LEVELS; k++) {
        s.plots[k][b] = { time: t, value: cachedLow + k * rowHeightCalc, color: LEVEL_COLOR };
      }
      for (let k = 0; k < LEVELS - 1; k++) {
        // getRowColor(k)
        let c: string;
        if (k >= numRows || k < 0) c = LEVEL_COLOR;
        else {
          const ratio = gt(cachedMaxVol, 0) ? volumes[k] / cachedMaxVol : 0.0;
          c = String(color.from_gradient(ratio, 0.0, 1.0, cfg.colorLowVol, cfg.colorHighVol));
        }
        s.fillColors[k][b] = c;
      }
      s.plots[25][b] = { time: t, value: cfg.showPoc ? cachedPoc : NaN, color: cfg.colorPoc };
      s.plots[26][b] = { time: t, value: cfg.showVaLines ? cachedVah : NaN, color: cfg.colorVah };
      s.plots[27][b] = { time: t, value: cfg.showVaLines ? cachedVal : NaN, color: cfg.colorVah };
      s.plots[28][b] = { time: t, value: cfg.showExtremes ? cachedHigh : NaN, color: cfg.colorExtreme };
      s.plots[29][b] = { time: t, value: cfg.showExtremes ? cachedLow : NaN, color: cfg.colorExtreme };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      // fill(pK, pK+1, color = getRowColor(K), title = 'Band K')
      const fills = s.fillColors.map((colors, k) => ({
        plot1: `plot${k}`, plot2: `plot${k + 1}`, options: { title: `Band ${k}` }, colors: colors.slice(),
      }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeProfileHeatmapInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeProfileHeatmapInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeProfileHeatmap = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
