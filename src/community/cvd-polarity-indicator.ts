/**
 * CVD Polarity Indicator (Rolling Smoothed)
 *
 * Rolling CVD: the bar volume is signed by the candle direction (close >= open: +volume, else -volume) and summed
 * over the last `cumulationLength` bars (cum(x) - cum(x)[length], 0 while not available). The polarity of a bar is
 * +volume when the rolling CVD rises and -volume when it falls, on a bar with close != open; 0 when the candle or
 * the CVD change is flat. The polarity is summed over the last `polarityLength` bars, with an EMA of `emaLength`
 * bars.
 *
 * Reference: "CVD Polarity Indicator (Rolling Smoothed)" by Cruiser
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CvdPolarityIndicatorInputs {
  /** Number of bars of the rolling CVD sum */
  cumulationLength: number;
  /** Number of bars of the rolling polarity sum */
  polarityLength: number;
  /** EMA length of the smoothed polarity */
  emaLength: number;
}

export const defaultInputs: CvdPolarityIndicatorInputs = {
  cumulationLength: 14,
  polarityLength: 14,
  emaLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'cumulationLength', type: 'int', title: 'CVD Cumulation Length', defval: 14, min: 1 },
  { id: 'polarityLength', type: 'int', title: 'Polarity Rolling Length', defval: 14, min: 1 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 10, min: 1 },
];

const POLARITY_COLOR = String(color.new(color.blue, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Polarity (Rolling Smoothed)', color: POLARITY_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'CVD Polarity Indicator (Rolling Smoothed)',
  shortTitle: 'CVD Polarity Indicator (Rolling Smoothed)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

interface CvdRun extends BarRunState<Record<string, never>> {
  cvdCumStep: ReturnType<typeof taStep.cum>;
  polarityCumStep: ReturnType<typeof taStep.cum>;
  ema: ReturnType<typeof taStep.ema>;
  cvdCum: number[];
  cvd: number[];
  polarityCum: number[];
  plot0: Point[];
  plot1: Point[];
}

// nz(x[len], 0): 0 before bar len (and for an na value)
const nzBack = (a: number[], i: number, len: number) => (i - len >= 0 && !isNaN(a[i - len]) ? a[i - len] : 0);

function study(inputs: Partial<CvdPolarityIndicatorInputs>): BarStudy<CvdRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const cvdCumStep = taStep.cum();
      const polarityCumStep = taStep.cum();
      const ema = taStep.ema(cfg.emaLength);
      const s: CvdRun = {
        cvdCumStep, polarityCumStep, ema, cvdCum: [], cvd: [], polarityCum: [], plot0: [], plot1: [],
        steps: [cvdCumStep, polarityCumStep, ema], vars: {}, lists: [], series: [],
      };
      s.series = [s.cvdCum, s.cvd, s.polarityCum, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      // volDelta = close - open >= 0 ? volume : -volume; cvd = cum(volDelta) - nz(cum(volDelta)[cumulationLength], 0)
      const volDelta = ge(b.close - b.open, 0) ? vol : -vol;
      s.cvdCum[i] = s.cvdCumStep.step(volDelta);
      const cvd = s.cvdCum[i] - nzBack(s.cvdCum, i, cfg.cumulationLength);
      s.cvd[i] = cvd;

      // Per-bar polarity
      const cvdChange = i > 0 ? cvd - s.cvd[i - 1] : NaN;
      const barDir = b.close - b.open;
      let polarity: number;
      if (gt(barDir, 0) && gt(cvdChange, 0)) polarity = vol;
      else if (lt(barDir, 0) && lt(cvdChange, 0)) polarity = -vol;
      else if (gt(barDir, 0) && lt(cvdChange, 0)) polarity = -vol;
      else if (lt(barDir, 0) && gt(cvdChange, 0)) polarity = vol;
      else polarity = 0.0;

      // polaritySmoothed = cum(polarity) - nz(cum(polarity)[polarityLength], 0); EMA of it
      s.polarityCum[i] = s.polarityCumStep.step(polarity);
      const smoothed = s.polarityCum[i] - nzBack(s.polarityCum, i, cfg.polarityLength);
      const emaLine = s.ema.step(smoothed);
      s.plot0[i] = { time: b.time, value: smoothed, color: POLARITY_COLOR };
      s.plot1[i] = { time: b.time, value: emaLine, color: color.orange };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CvdPolarityIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CvdPolarityIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CvdPolarityIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
