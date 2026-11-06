/**
 * Volume-Based RSI Color Indicator with MAs
 *
 * RSI of the close. The RSI line is red when the RSI is at or above the overbought level and the volume is above
 * the SMA of the volume (RSI length) times the high volume multiplier, green when the RSI is at or below the
 * oversold level with the same high volume, blue otherwise. A long and a short moving average (SMA or EMA) of the
 * RSI, and horizontal lines at the overbought and oversold levels.
 *
 * Reference: "Volume-Based RSI Color Indicator with MAs" by Riccardo02
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Riccardo02
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VolumeBasedRsiMaType = 'SMA' | 'EMA';

export interface VolumeBasedRsiColorIndicatorWithMasInputs {
  /** RSI length (also the length of the volume SMA) */
  lengthRSI: number;
  /** Level at or above which the RSI is overbought */
  overboughtLevel: number;
  /** Level at or below which the RSI is oversold */
  oversoldLevel: number;
  /** High volume: volume above SMA(volume) * multiplier */
  highVolumeMultiplier: number;
  /** Long moving average length */
  maLength200: number;
  /** Short moving average length */
  maLength20: number;
  /** Moving average type */
  maType: VolumeBasedRsiMaType;
}

export const defaultInputs: VolumeBasedRsiColorIndicatorWithMasInputs = {
  lengthRSI: 14,
  overboughtLevel: 70,
  oversoldLevel: 30,
  highVolumeMultiplier: 2.0,
  maLength200: 200,
  maLength20: 20,
  maType: 'SMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthRSI', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'overboughtLevel', type: 'int', title: 'Overbought Level', defval: 70 },
  { id: 'oversoldLevel', type: 'int', title: 'Oversold Level', defval: 30 },
  { id: 'highVolumeMultiplier', type: 'float', title: 'High Volume Multiplier', defval: 2.0 },
  { id: 'maLength200', type: 'int', title: 'Long MA Length', defval: 200 },
  { id: 'maLength20', type: 'int', title: 'Short MA Length', defval: 20 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA'] },
];

const ORANGE = String(color.new(color.orange, 0));
const PURPLE = String(color.new(color.purple, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: '200 MA', color: ORANGE, lineWidth: 1 },
  { id: 'plot2', title: '20 MA', color: PURPLE, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume-Based RSI Color Indicator with MAs',
  shortTitle: 'VBRCI_MAs',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number): number; commit(): void };

interface VbrRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  avgVolume: WindowSma;
  ma200: Ma;
  ma20: Ma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<VolumeBasedRsiColorIndicatorWithMasInputs>): BarStudy<VbrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // The MA type is an input (constant): the selected branch runs on every bar
  const ma = (len: number): Ma => (cfg.maType === 'SMA' ? new WindowSma(len) : taStep.ema(len));
  return {
    init() {
      const rsi = taStep.rsi(cfg.lengthRSI);
      const avgVolume = new WindowSma(cfg.lengthRSI);
      const ma200 = ma(cfg.maLength200);
      const ma20 = ma(cfg.maLength20);
      const s: VbrRun = {
        rsi, avgVolume, ma200, ma20, plot0: [], plot1: [], plot2: [],
        steps: [rsi, avgVolume, ma200, ma20], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const rsi = s.rsi.step(b.close);
      const volume = b.volume ?? NaN;
      const avgVolume = s.avgVolume.step(volume);
      const ma200 = s.ma200.step(rsi);
      const ma20 = s.ma20.step(rsi);
      const highVolume = gt(volume, avgVolume * cfg.highVolumeMultiplier);
      const c = ge(rsi, cfg.overboughtLevel) && highVolume ? color.red
        : le(rsi, cfg.oversoldLevel) && highVolume ? color.green : color.blue;
      s.plot0[i] = { time: b.time, value: rsi, color: c };
      s.plot1[i] = { time: b.time, value: ma200, color: ORANGE };
      s.plot2[i] = { time: b.time, value: ma20, color: PURPLE };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: s.plot2.slice(),
        },
        hlines: [
          { value: cfg.overboughtLevel, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
          { value: cfg.oversoldLevel, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeBasedRsiColorIndicatorWithMasInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeBasedRsiColorIndicatorWithMasInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeBasedRsiColorIndicatorWithMas = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
