/**
 * MADZ - Moving Average Deviation Z-Score
 *
 * The percentage deviation of the close from a moving average of the source, (close - ma) / ma, is turned into a
 * z-score over `Z-Score Lookback Period` bars ((x - sma) / stdev; a zero stdev is replaced by 0.000001) and smoothed
 * with a volume-weighted moving average. The line is green below the oversold level, red above the overbought level
 * and gray otherwise. Optional dynamic bands at +-3 standard deviations of MADZ; the background is red / green when
 * MADZ is beyond them.
 *
 * Reference: "MADZ - Moving Average Deviation Z-Score" by MiesOnCharts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MiesOnCharts
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MadzMaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'HMA' | 'RMA';

export interface MadzMovingAverageDeviationZScoreInputs {
  /** Moving average length */
  length: number;
  /** Moving average source */
  src: SourceType;
  /** Moving average type */
  maType: MadzMaType;
  /** Number of bars of the z-score */
  lookback: number;
  /** VWMA length of the z-score */
  smoothLength: number;
  obLevel: number;
  osLevel: number;
  /** Standard deviation length of the dynamic bands */
  dynLength: number;
  showDynBands: boolean;
  /** Background colour when MADZ is beyond the dynamic bands */
  showExtreme: boolean;
}

export const defaultInputs: MadzMovingAverageDeviationZScoreInputs = {
  length: 150,
  src: 'close',
  maType: 'VWMA',
  lookback: 85,
  smoothLength: 14,
  obLevel: 1.5,
  osLevel: -1.5,
  dynLength: 60,
  showDynBands: false,
  showExtreme: true,
};

const G_MA = 'Moving Average Settings';
const G_Z = 'Z-Score & Smoothing';
const G_LEVELS = 'Threshold Levels';
const G_DISPLAY = 'Display Options';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 150, min: 1, group: G_MA },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: G_MA },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'VWMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'HMA', 'RMA'], group: G_MA },
  { id: 'lookback', type: 'int', title: 'Z-Score Lookback Period', defval: 85, min: 1, group: G_Z,
    tooltip: 'Number of bars used to calculate the Z-Score (longer = smoother, shorter = more reactive)' },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Period', defval: 14, min: 1, group: G_Z },
  { id: 'obLevel', type: 'float', title: 'Overbought Level (+%)', defval: 1.5, step: 0.01, group: G_LEVELS },
  { id: 'osLevel', type: 'float', title: 'Oversold Level (-%)', defval: -1.5, step: 0.01, group: G_LEVELS },
  { id: 'dynLength', type: 'int', title: 'Dynamic Bands Length', defval: 60, min: 1, group: G_DISPLAY },
  { id: 'showDynBands', type: 'bool', title: 'Show Dynamic Extreme Bands', defval: false, group: G_DISPLAY },
  { id: 'showExtreme', type: 'bool', title: 'Highlight Extreme Zones (Background)', defval: true, group: G_DISPLAY },
];

const OB_COLOR = String(color.rgb(255, 0, 0));
const OS_COLOR = String(color.rgb(0, 255, 21));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MADZ', color: color.gray, lineWidth: 2 },
  { id: 'plot1', title: 'Dynamic OB Band', color: OB_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Dynamic OS Band', color: OS_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Midline', color: color.white, lineWidth: 1 },
  { id: 'plot4', title: 'Overbought', color: OB_COLOR, lineWidth: 1, style: 'circles' },
  { id: 'plot5', title: 'Oversold', color: OS_COLOR, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'MADZ - Moving Average Deviation Z-Score',
  shortTitle: 'MADZ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface MadzRun extends BarRunState<Record<string, never>> {
  ma: Ma;
  mean: WindowSma;
  sd: WindowStdev;
  madz: ReturnType<typeof taStep.vwma>;
  valSd: WindowStdev;
  plots: Point[][];
  bgColors: BgColorData[];
}

const OB_BG = String(color.new(OB_COLOR, 50));
const OS_BG = String(color.new(OS_COLOR, 50));
const NO_BG = String(color.new(color.black, 100));

function study(inputs: Partial<MadzMovingAverageDeviationZScoreInputs>): BarStudy<MadzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const maStep = (): Ma => {
    const len = cfg.length;
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return taStep.vwma(len);
      case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      default: { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: MadzRun = {
        ma: maStep(), mean: new WindowSma(cfg.lookback), sd: new WindowStdev(cfg.lookback), madz: taStep.vwma(cfg.smoothLength), valSd: new WindowStdev(cfg.dynLength),
        plots: Array.from({ length: 6 }, () => []), bgColors: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ma, s.mean, s.sd, s.madz, s.valSd];
      s.series = [...s.plots, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const volume = b.volume ?? NaN;
      const ma = s.ma.step(value(b), volume);
      // percDev = (close - ma) / ma (a plain division)
      const percDev = (b.close - ma) / ma;
      // zscore(percDev, lookback): stdDev == 0 ? 0.000001 : stdDev
      const mean = s.mean.step(percDev);
      const sd = s.sd.step(percDev);
      const rawZ = (percDev - mean) / (eq(sd, 0) ? 0.000001 : sd);
      const madz = s.madz.step(rawZ, volume);
      const valSd = s.valSd.step(madz);
      const valOb = valSd * 3;
      const valOs = -valSd * 3;
      if (cfg.showExtreme) {
        const c = gt(madz, valOb) ? OB_BG : lt(madz, valOs) ? OS_BG : NO_BG;
        s.bgColors[i] = { time, color: c };
      }
      const lineColor = lt(madz, cfg.osLevel) ? OS_COLOR : gt(madz, cfg.obLevel) ? OB_COLOR : color.gray;
      const p = s.plots;
      p[0][i] = { time, value: fin(madz), color: lineColor };
      p[1][i] = { time, value: cfg.showDynBands ? fin(valOb) : NaN, color: OB_COLOR };
      p[2][i] = { time, value: cfg.showDynBands ? fin(valOs) : NaN, color: OS_COLOR };
      p[3][i] = { time, value: 0, color: color.white };
      p[4][i] = { time, value: cfg.obLevel, color: OB_COLOR };
      p[5][i] = { time, value: cfg.osLevel, color: OS_COLOR };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        bgColors: cfg.showExtreme ? s.bgColors.slice() : [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MadzMovingAverageDeviationZScoreInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MadzMovingAverageDeviationZScoreInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MadzMovingAverageDeviationZScore = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
