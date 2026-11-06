/**
 * Weis Wave Volume
 *
 * As the original: a Renko-like close (the box size from "Renko Assignment Method": the ATR over "Value" bars, the
 * value itself, or the close divided by it) moves to the bar's high / low (by "Price Source") when it leaves the box
 * around the previous Renko close; the wave direction is up when it rises, down when it falls, else unchanged. The
 * volume (the true range with "Use True Range instead of Volume" Always, or Auto without volume) is summed while the
 * direction does not change and restarts on a change (divided by the bar count with "Normalize"). Columns green
 * while the direction is up, red otherwise (transparency 75); negative in a down wave with "Oscillating".
 *
 * Reference: "Weis Wave Volume" (community)
 */

import { color, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** color=directionIsUp ? color.new(color.green, 75) : color.new(color.red, 75) */
const UP = String(color.new(color.green, 75));
const DOWN = String(color.new(color.red, 75));

export interface WeisWaveVolumeInputs {
  methodType: string;
  methodValue: number;
  priceSource: string;
  useTrueRange: string;
  isOscillating: boolean;
  normalize: boolean;
}

export const defaultInputs: WeisWaveVolumeInputs = {
  methodType: 'ATR',
  methodValue: 14.0,
  priceSource: 'Close',
  useTrueRange: 'Auto',
  isOscillating: false,
  normalize: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'methodType', type: 'string', title: 'Renko Assignment Method', defval: 'ATR', options: ['ATR', 'Traditional', 'Part of Price'] },
  { id: 'methodValue', type: 'float', title: 'Value', defval: 14.0, min: 0 },
  { id: 'priceSource', type: 'string', title: 'Price Source', defval: 'Close', options: ['Close', 'Open / Close', 'High / Low'] },
  { id: 'useTrueRange', type: 'string', title: 'Use True Range instead of Volume', defval: 'Auto', options: ['Always', 'Auto', 'Never'] },
  { id: 'isOscillating', type: 'bool', title: 'Oscillating', defval: false },
  { id: 'normalize', type: 'bool', title: 'Normalize', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Wave Volume', color: UP, lineWidth: 3, style: 'columns' },
];

export const metadata = {
  title: 'Weis Wave Volume',
  shortTitle: 'WWV',
  overlay: false,
};

const fin = (v: number | undefined | null): v is number => v !== undefined && v !== null && Number.isFinite(v);

type Point = { time: number; value: number; color: string };

interface WaveVars {
  prevCurr: number;
  prevDir: number;
  prevVol: number;
  prevCount: number;
}

interface WaveRun extends BarRunState<WaveVars> {
  tr: ReturnType<typeof taStep.tr>;
  atr: ReturnType<typeof taStep.atr> | null;
  plot0: Point[];
}

function study(inputs: Partial<WeisWaveVolumeInputs>): BarStudy<WaveRun, IndicatorResult> {
  const { methodType, methodValue, priceSource, useTrueRange, isOscillating, normalize } = { ...defaultInputs, ...inputs };
  const useClose = priceSource === 'Close';
  const useOpenClose = priceSource === 'Open / Close' || useClose;
  return {
    init() {
      const tr = taStep.tr(false);
      const atr = methodType === 'ATR' ? taStep.atr(Math.round(methodValue)) : null;
      const s: WaveRun = {
        tr, atr, plot0: [], steps: atr ? [tr, atr] : [tr],
        vars: { prevCurr: NaN, prevDir: NaN, prevVol: NaN, prevCount: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const tr = s.tr.step(b.high, b.low, b.close);
      const atr = s.atr ? s.atr.step(b.high, b.low, b.close) : NaN;
      const volume = fin(b.volume) ? b.volume : NaN;
      let vol = useTrueRange === 'Always' || (useTrueRange === 'Auto' && !fin(volume)) ? tr : volume;
      const op = useClose ? b.close : b.open;
      const hi = useOpenClose ? (b.close >= op ? b.close : op) : b.high;
      const lo = useOpenClose ? (b.close <= op ? b.close : op) : b.low;
      const box = methodType === 'ATR' ? atr : methodType === 'Part of Price' ? b.close / methodValue : methodValue;

      const prevclose = fin(v.prevCurr) ? v.prevCurr : 0;
      const currclose = hi > prevclose + box ? hi : lo < prevclose - box ? lo : prevclose;
      const direction = currclose > prevclose ? 1 : currclose < prevclose ? -1 : (fin(v.prevDir) ? v.prevDir : 0);
      // ta.change(direction) != 0 (na on the first bar: false)
      const changed = i > 0 && direction - v.prevDir !== 0;

      let barcount = 1;
      if (!changed && normalize) barcount = v.prevCount + barcount;
      if (!changed) vol = v.prevVol + vol;
      const res = barcount > 1 ? vol / barcount : vol;

      const value = isOscillating && direction < 0 ? -res : res;
      s.plot0[i] = { time: b.time, value: fin(value) ? value : NaN, color: direction > 0 ? UP : DOWN };
      v.prevCurr = currclose;
      v.prevDir = direction;
      v.prevVol = vol;
      v.prevCount = barcount;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WeisWaveVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WeisWaveVolumeInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WeisWaveVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
