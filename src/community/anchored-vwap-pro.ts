/**
 * Anchored VWAP Pro (Final Visibility Enhanced)
 *
 * VWAP anchored at a UTC date (00:00): from the first bar with time >= anchor, cumulative volume and cumulative
 * source * volume give vwap = sum(src * vol) / sum(vol). The deviation is the cumulative sum of
 * (src - vwap)^2 * vol (with the vwap of each bar), stdDev = sqrt(sum dev / sum vol). Two optional band pairs at
 * vwap +- multiplier * stdDev. Before the anchor all values are na.
 *
 * Reference: "Anchored VWAP Pro (Final Visibility Enhanced)" by ImmortalEmerson
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AnchoredVwapProBandStyle = 'Solid' | 'Dotted' | 'Dashed';

export interface AnchoredVwapProInputs {
  /** Anchor date (00:00 UTC) */
  anchorYear: number;
  anchorMonth: number;
  anchorDay: number;
  /** VWAP source */
  source: SourceType;
  vwapColor: string;
  /** Line width of the VWAP (the plot width is static: the default is used) */
  vwapWidth: number;
  showBand1: boolean;
  bandMult1: number;
  band1Color: string;
  band1Width: number;
  /** Plot style of band 1: Dotted = line with breaks, Dashed = circles, Solid = line (static plot style: default used) */
  band1Style: AnchoredVwapProBandStyle;
  showBand2: boolean;
  bandMult2: number;
  band2Color: string;
  band2Width: number;
  band2Style: AnchoredVwapProBandStyle;
}

export const defaultInputs: AnchoredVwapProInputs = {
  anchorYear: 2022,
  anchorMonth: 11,
  anchorDay: 21,
  source: 'hlc3',
  vwapColor: color.yellow,
  vwapWidth: 2,
  showBand1: true,
  bandMult1: 1.5,
  band1Color: color.aqua,
  band1Width: 2,
  band1Style: 'Dotted',
  showBand2: true,
  bandMult2: 2.5,
  band2Color: color.orange,
  band2Width: 2,
  band2Style: 'Solid',
};

const STYLES: AnchoredVwapProBandStyle[] = ['Solid', 'Dotted', 'Dashed'];

export const inputConfig: InputConfig[] = [
  { id: 'anchorYear', type: 'int', title: 'Anchor Year', defval: 2022 },
  { id: 'anchorMonth', type: 'int', title: 'Anchor Month', defval: 11 },
  { id: 'anchorDay', type: 'int', title: 'Anchor Day', defval: 21 },
  { id: 'source', type: 'source', title: 'VWAP Source', defval: 'hlc3' },
  { id: 'vwapColor', type: 'color', title: 'VWAP Line Color', defval: color.yellow },
  { id: 'vwapWidth', type: 'int', title: 'VWAP Line Width', defval: 2, min: 1, max: 5 },
  { id: 'showBand1', type: 'bool', title: 'Show Band 1', defval: true },
  { id: 'bandMult1', type: 'float', title: 'Band 1 Multiplier', defval: 1.5, min: 0.1 },
  { id: 'band1Color', type: 'color', title: 'Band 1 Color (High Contrast)', defval: color.aqua },
  { id: 'band1Width', type: 'int', title: 'Band 1 Width', defval: 2, min: 1, max: 5 },
  { id: 'band1Style', type: 'string', title: 'Band 1 Style', defval: 'Dotted', options: STYLES },
  { id: 'showBand2', type: 'bool', title: 'Show Band 2', defval: true },
  { id: 'bandMult2', type: 'float', title: 'Band 2 Multiplier', defval: 2.5, min: 0.1 },
  { id: 'band2Color', type: 'color', title: 'Band 2 Color (High Contrast)', defval: color.orange },
  { id: 'band2Width', type: 'int', title: 'Band 2 Width', defval: 2, min: 1, max: 5 },
  { id: 'band2Style', type: 'string', title: 'Band 2 Style', defval: 'Solid', options: STYLES },
];

// getStyle(): "Dotted" -> plot.style_linebr, "Dashed" -> plot.style_circles, else plot.style_line.
// Plot styles and widths come from inputs in Pine; PlotConfig is static, so the default inputs are used.
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchored VWAP', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band 1', color: color.aqua, lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Lower Band 1', color: color.aqua, lineWidth: 2, style: 'linebr' },
  { id: 'plot3', title: 'Upper Band 2', color: color.orange, lineWidth: 2, style: 'line' },
  { id: 'plot4', title: 'Lower Band 2', color: color.orange, lineWidth: 2, style: 'line' },
];

export const metadata = {
  title: 'Anchored VWAP Pro (Final Visibility Enhanced)',
  shortTitle: 'Anchored VWAP Pro (Final Visibility Enhanced)',
  overlay: true,
};

/** Pine nz(): na and +-infinity give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);
/** Plots show na for na and +-infinity */
const plotValue = (x: number) => (Number.isFinite(x) ? x : NaN);

type Point = { time: number; value: number; color?: string };

interface AvwapVars {
  cumVol: number;
  cumVolSrc: number;
  cumDev: number;
}

interface AvwapRun extends BarRunState<AvwapVars> {
  plots: Point[][];
}

function study(inputs: Partial<AnchoredVwapProInputs>): BarStudy<AvwapRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  // anchorTime = timestamp("Etc/UTC", year, month, day, 0, 0) (bar times are in seconds)
  const anchorTime = Date.UTC(cfg.anchorYear, cfg.anchorMonth - 1, cfg.anchorDay, 0, 0) / 1000;
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: AvwapRun = {
        plots: [[], [], [], [], []], steps: [],
        // var float cumVol = na, var float cumVolSrc = na, var float cumDev = na
        vars: { cumVol: NaN, cumVolSrc: NaN, cumDev: NaN },
        lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = value(b) ?? NaN;
      const volume = b.volume ?? NaN;
      const after = b.time >= anchorTime;
      if (after) {
        v.cumVol = nz(v.cumVol) + volume;
        v.cumVolSrc = nz(v.cumVolSrc) + src * volume;
      } else {
        v.cumVol = NaN;
        v.cumVolSrc = NaN;
      }
      const vwap = v.cumVolSrc / v.cumVol;
      const priceDev = Math.pow(src - vwap, 2) * volume;
      v.cumDev = after ? nz(v.cumDev) + priceDev : NaN;
      const stdDev = Math.sqrt(v.cumDev / v.cumVol);

      // the bands: vwap +- mult * stdDev
      const p = s.plots;
      const time = b.time;
      p[0][i] = { time, value: plotValue(vwap), color: cfg.vwapColor };
      p[1][i] = { time, value: plotValue(cfg.showBand1 ? vwap + 1 * cfg.bandMult1 * stdDev : NaN), color: cfg.band1Color };
      p[2][i] = { time, value: plotValue(cfg.showBand1 ? vwap + -1 * cfg.bandMult1 * stdDev : NaN), color: cfg.band1Color };
      p[3][i] = { time, value: plotValue(cfg.showBand2 ? vwap + 1 * cfg.bandMult2 * stdDev : NaN), color: cfg.band2Color };
      p[4][i] = { time, value: plotValue(cfg.showBand2 ? vwap + -1 * cfg.bandMult2 * stdDev : NaN), color: cfg.band2Color };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AnchoredVwapProInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AnchoredVwapProInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AnchoredVwapPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
