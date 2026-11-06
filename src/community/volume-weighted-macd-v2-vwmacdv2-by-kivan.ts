/**
 * Volume Weighted MACD V2 (VWMACDV2)
 *
 * MACD of volume weighted averages: fastMA = ema(volume * close, fast) / ema(volume, fast), slowMA the same with the
 * slow period, vwmacd = fastMA - slowMA, signal = ema(vwmacd, signal period), histogram = vwmacd - signal. A line at
 * 0. Plot colours are those of a Pine version 3 script (transparency 35).
 *
 * Reference: "VOLUME WEIGHTED MACD V2" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: created by Buff DORMEIER; author: KIVANC @fr3762 on twitter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWeightedMacdV2VwmacdV2ByKivanInputs {
  /** Fast period */
  fastperiod: number;
  /** Slow period */
  slowperiod: number;
  /** Signal period */
  signalperiod: number;
}

export const defaultInputs: VolumeWeightedMacdV2VwmacdV2ByKivanInputs = {
  fastperiod: 12,
  slowperiod: 26,
  signalperiod: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastperiod', type: 'int', title: 'fastperiod', defval: 12, min: 1, max: 500 },
  { id: 'slowperiod', type: 'int', title: 'slowperiod', defval: 26, min: 1, max: 500 },
  { id: 'signalperiod', type: 'int', title: 'signalperiod', defval: 9, min: 1, max: 500 },
];

/** Pine version 3 plot colours: transparency 35 */
const V3 = (c: string) => String(color.new(c, 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMACD', color: V3('#0000FF'), lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: V3('#FF0000'), lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: V3('#008000'), lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'Zero', color: V3('#000000'), lineWidth: 1 },
];

export const metadata = {
  title: 'VOLUME WEIGHTED MACD V2',
  shortTitle: 'VWMACDV2',
  overlay: false,
};

type Point = { time: number; value: number };
type Ema = ReturnType<typeof taStep.ema>;

interface VwmacdRun extends BarRunState<Record<string, never>> {
  fastNum: Ema;
  fastDen: Ema;
  slowNum: Ema;
  slowDen: Ema;
  sig: Ema;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<VolumeWeightedMacdV2VwmacdV2ByKivanInputs>): BarStudy<VwmacdRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fastNum = taStep.ema(cfg.fastperiod);
      const fastDen = taStep.ema(cfg.fastperiod);
      const slowNum = taStep.ema(cfg.slowperiod);
      const slowDen = taStep.ema(cfg.slowperiod);
      const sig = taStep.ema(cfg.signalperiod);
      const s: VwmacdRun = {
        fastNum, fastDen, slowNum, slowDen, sig, plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [fastNum, fastDen, slowNum, slowDen, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      const vc = vol * b.close;
      // plain divisions: 0 / 0 is na, as Pine
      const fastMA = (s.fastNum.step(vc) ?? NaN) / (s.fastDen.step(vol) ?? NaN);
      const slowMA = (s.slowNum.step(vc) ?? NaN) / (s.slowDen.step(vol) ?? NaN);
      const vwmacd = fastMA - slowMA;
      const signal = s.sig.step(vwmacd) ?? NaN;
      s.plot0[i] = { time: b.time, value: fin(vwmacd) };
      s.plot1[i] = { time: b.time, value: fin(signal) };
      s.plot2[i] = { time: b.time, value: fin(vwmacd - signal) };
      s.plot3[i] = { time: b.time, value: 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedMacdV2VwmacdV2ByKivanInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedMacdV2VwmacdV2ByKivanInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeWeightedMacdV2VwmacdV2ByKivan = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
