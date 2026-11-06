/**
 * Premium Trade Zones (RSI Neon Pipe 14 / 21 / 50)
 *
 * Three RSIs of the source (14, 21 and 50 bars) and their mean, the "pipe". The pipe is drawn three times (widths
 * 10, 6 and 3, transparencies 78, 85 and 90) and the three RSI lines in thin lines; all take their "above" colour
 * when the mean is at or above 50, else their "below" colour. Two zone fills: from the 70 level to the no-trade top
 * and from the no-trade bottom to the 30 level. Guide lines at 80, 70, 30 and 20.
 *
 * Reference: "RSI Neon Pipe (14/21/50) — Trade Zones (Customizable)" by ENTRYLAB
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PremiumTradeZonesInputs {
  src: SourceType;
  len14: number;
  len21: number;
  len50: number;
  /** Show the zone fills */
  showZones: boolean;
  /** Not used by the outputs (the Pine script declares it without using it) */
  showZoneText: boolean;
  /** Not used by the outputs (the Pine script declares it without using it) */
  showBlobDots: boolean;
  ntzTop: number;
  ntzBot: number;
  /** Not used by the outputs (the Pine script declares it without using it) */
  textEvery: number;
  lvl80: number;
  lvl70: number;
  lvl30: number;
  lvl20: number;
  pipeUpCol: string;
  pipeDnCol: string;
  thread14UpCol: string;
  thread14DnCol: string;
  thread21UpCol: string;
  thread21DnCol: string;
  thread50UpCol: string;
  thread50DnCol: string;
  /** Not used by the outputs (the Pine script declares it without using it) */
  guideLineCol: string;
  zoneFillCol: string;
  zoneFillAlpha: number;
  /** Not used by the outputs (the Pine script declares it without using it) */
  ntzLabelBgCol: string;
  /** Not used by the outputs (the Pine script declares it without using it) */
  ntzLabelBgA: number;
  /** Not used by the outputs (the Pine script declares it without using it) */
  blobOuterCol: string;
  /** Not used by the outputs (the Pine script declares it without using it) */
  blobOuterA: number;
  /** Not used by the outputs (the Pine script declares it without using it) */
  blobInnerCol: string;
  /** Not used by the outputs (the Pine script declares it without using it) */
  blobInnerA: number;
}

export const defaultInputs: PremiumTradeZonesInputs = {
  src: 'close',
  len14: 14,
  len21: 21,
  len50: 50,
  showZones: true,
  showZoneText: true,
  showBlobDots: true,
  ntzTop: 57.0,
  ntzBot: 43.0,
  textEvery: 36,
  lvl80: 80.0,
  lvl70: 70.0,
  lvl30: 30.0,
  lvl20: 20.0,
  pipeUpCol: 'rgb(195, 60, 255)',
  pipeDnCol: 'rgb(40, 160, 255)',
  thread14UpCol: 'rgb(230, 110, 255)',
  thread14DnCol: 'rgb(90, 210, 255)',
  thread21UpCol: 'rgb(195, 60, 255)',
  thread21DnCol: 'rgb(40, 160, 255)',
  thread50UpCol: 'rgb(160, 40, 255)',
  thread50DnCol: 'rgb(20, 120, 255)',
  // input.color(color.new(color.white, 86)): the input stores alpha 0.14 (byte 36)
  guideLineCol: 'rgba(255, 255, 255, 0.14)',
  zoneFillCol: color.white,
  zoneFillAlpha: 94,
  ntzLabelBgCol: 'rgb(110, 35, 35)',
  ntzLabelBgA: 82,
  blobOuterCol: color.white,
  blobOuterA: 78,
  blobInnerCol: color.white,
  blobInnerA: 40,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len14', type: 'int', title: 'RSI 14', defval: 14 },
  { id: 'len21', type: 'int', title: 'RSI 21', defval: 21 },
  { id: 'len50', type: 'int', title: 'RSI 50', defval: 50 },
  { id: 'showZones', type: 'bool', title: 'Show zone backgrounds + lines', defval: true },
  // Not used by the outputs
  { id: 'showZoneText', type: 'bool', title: 'Show zone text boxes (Short / No / Long)', defval: true },
  // Not used by the outputs
  { id: 'showBlobDots', type: 'bool', title: 'Show 70 / 30 neon dots', defval: true },
  { id: 'ntzTop', type: 'float', title: 'No-trade top', defval: 57.0, step: 0.5 },
  { id: 'ntzBot', type: 'float', title: 'No-trade bottom', defval: 43.0, step: 0.5 },
  // Not used by the outputs
  { id: 'textEvery', type: 'int', title: 'Text spacing (bars)', defval: 36, min: 6 },
  { id: 'lvl80', type: 'float', title: 'lvl80', defval: 80.0 },
  { id: 'lvl70', type: 'float', title: 'lvl70', defval: 70.0 },
  { id: 'lvl30', type: 'float', title: 'lvl30', defval: 30.0 },
  { id: 'lvl20', type: 'float', title: 'lvl20', defval: 20.0 },
  { id: 'pipeUpCol', type: 'color', title: 'Pipe color above 50', defval: 'rgb(195, 60, 255)' },
  { id: 'pipeDnCol', type: 'color', title: 'Pipe color below 50', defval: 'rgb(40, 160, 255)' },
  { id: 'thread14UpCol', type: 'color', title: 'RSI 14 thread (above)', defval: 'rgb(230, 110, 255)' },
  { id: 'thread14DnCol', type: 'color', title: 'RSI 14 thread (below)', defval: 'rgb(90, 210, 255)' },
  { id: 'thread21UpCol', type: 'color', title: 'RSI 21 thread (above)', defval: 'rgb(195, 60, 255)' },
  { id: 'thread21DnCol', type: 'color', title: 'RSI 21 thread (below)', defval: 'rgb(40, 160, 255)' },
  { id: 'thread50UpCol', type: 'color', title: 'RSI 50 thread (above)', defval: 'rgb(160, 40, 255)' },
  { id: 'thread50DnCol', type: 'color', title: 'RSI 50 thread (below)', defval: 'rgb(20, 120, 255)' },
  // Not used by the outputs
  { id: 'guideLineCol', type: 'color', title: 'Guide lines color', defval: 'rgba(255, 255, 255, 0.14)' },
  { id: 'zoneFillCol', type: 'color', title: 'Zone fill', defval: color.white },
  { id: 'zoneFillAlpha', type: 'int', title: 'Zone fill transparency', defval: 94, min: 0, max: 100 },
  // Not used by the outputs
  { id: 'ntzLabelBgCol', type: 'color', title: 'No-trade label bg', defval: 'rgb(110, 35, 35)' },
  // Not used by the outputs
  { id: 'ntzLabelBgA', type: 'int', title: 'No-trade label transparency', defval: 82 },
  // Not used by the outputs
  { id: 'blobOuterCol', type: 'color', title: 'Blob outer', defval: color.white },
  // Not used by the outputs
  { id: 'blobOuterA', type: 'int', title: 'Blob outer alpha', defval: 78 },
  // Not used by the outputs
  { id: 'blobInnerCol', type: 'color', title: 'Blob inner', defval: color.white },
  // Not used by the outputs
  { id: 'blobInnerA', type: 'int', title: 'Blob inner alpha', defval: 40 },
];

const HIDDEN = String(color.new(color.white, 100));
const UP_GUIDE = String(color.rgb(152, 1, 246));
const DN_GUIDE = String(color.rgb(7, 220, 248));

// The Pine plots have no titles: short descriptive titles
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Zone Top', color: HIDDEN, lineWidth: 1 },
  { id: 'plot1', title: 'Upper Zone Bottom', color: HIDDEN, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Zone Top', color: HIDDEN, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Zone Bottom', color: HIDDEN, lineWidth: 1 },
  { id: 'plot4', title: 'Pipe Outer Glow', color: String(color.new('rgb(195, 60, 255)', 78)), lineWidth: 10 },
  { id: 'plot5', title: 'Pipe Inner Glow', color: String(color.new('rgb(195, 60, 255)', 85)), lineWidth: 6 },
  { id: 'plot6', title: 'Pipe Core', color: String(color.new('rgb(195, 60, 255)', 90)), lineWidth: 3 },
  { id: 'plot7', title: 'RSI 14', color: String(color.new('rgb(230, 110, 255)', 10)), lineWidth: 1 },
  { id: 'plot8', title: 'RSI 21', color: String(color.new('rgb(195, 60, 255)', 10)), lineWidth: 1 },
  { id: 'plot9', title: 'RSI 50', color: String(color.new('rgb(160, 40, 255)', 10)), lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Neon Pipe (14/21/50) — Trade Zones (Customizable)',
  shortTitle: 'RSI Neon Pipe (14/21/50) — Trade Zones (Customizable)',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

interface PtzRun extends BarRunState<Record<string, never>> {
  rsis: ReturnType<typeof taStep.rsi>[];
  /** The source values of another study (null: read from the bars) */
  ext: number[] | null;
  plots: Point[][];
  zCols: string[];
}

function study(inputs: Partial<PremiumTradeZonesInputs>): BarStudy<PtzRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const zone = (v: number) => (cfg.showZones ? v : NaN);
  // fill(upperFillTop, upperFillBot, zCol); fill(lowerFillTop, lowerFillBot, zCol)
  const zCol = String(color.new(cfg.zoneFillCol, cfg.zoneFillAlpha));

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init(bars) {
      const rsis = [taStep.rsi(cfg.len14), taStep.rsi(cfg.len21), taStep.rsi(cfg.len50)];
      const s: PtzRun = {
        rsis, ext: isBarSource(cfg.src) ? null : getSourceSeries(bars, cfg.src).toArray(),
        plots: Array.from({ length: 10 }, () => []), zCols: [],
        steps: [...rsis], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots, s.zCols];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const v = s.ext ? s.ext[i] : value(bars[i]);
      const num = (x: number) => (x === null || x === undefined ? NaN : x);
      const r14 = num(s.rsis[0].step(v));
      const r21 = num(s.rsis[1].step(v));
      const r50 = num(s.rsis[2].step(v));
      const mid = (r14 + r21 + r50) / 3;
      // isAbove = mid >= 50 (na is false: the "below" colours)
      const isAbove = ge(mid, 50);
      const pipeCol = isAbove ? cfg.pipeUpCol : cfg.pipeDnCol;
      const c14 = isAbove ? cfg.thread14UpCol : cfg.thread14DnCol;
      const c21 = isAbove ? cfg.thread21UpCol : cfg.thread21DnCol;
      const c50 = isAbove ? cfg.thread50UpCol : cfg.thread50DnCol;
      const p = s.plots;
      p[0][i] = { time: t, value: zone(cfg.lvl70) };
      p[1][i] = { time: t, value: zone(cfg.ntzTop) };
      p[2][i] = { time: t, value: zone(cfg.ntzBot) };
      p[3][i] = { time: t, value: zone(cfg.lvl30) };
      p[4][i] = { time: t, value: mid, color: String(color.new(pipeCol, 78)) };
      p[5][i] = { time: t, value: mid, color: String(color.new(pipeCol, 85)) };
      p[6][i] = { time: t, value: mid, color: String(color.new(pipeCol, 90)) };
      p[7][i] = { time: t, value: r14, color: String(color.new(c14, 10)) };
      p[8][i] = { time: t, value: r21, color: String(color.new(c21, 10)) };
      p[9][i] = { time: t, value: r50, color: String(color.new(c50, 10)) };
      s.zCols[i] = zCol;
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 10; k++) plots[`plot${k}`] = s.plots[k].slice();
      const zCols = s.zCols.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: cfg.lvl80, options: { title: 'Level', color: UP_GUIDE, linestyle: 'dashed' } },
          { value: cfg.lvl70, options: { title: 'Level', color: UP_GUIDE, linestyle: 'dashed' } },
          { value: cfg.lvl30, options: { title: 'Level', color: DN_GUIDE, linestyle: 'dashed' } },
          { value: cfg.lvl20, options: { title: 'Level', color: DN_GUIDE, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: zCols },
          { plot1: 'plot2', plot2: 'plot3', colors: zCols },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PremiumTradeZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PremiumTradeZonesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PremiumTradeZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
