/**
 * ADX with Shaded Zone
 *
 * Hand-written DMI: true range = max(high - low, |high - close[1]|, |low - close[1]|), +DM = max(change(high), 0),
 * -DM = max(-change(low), 0) (not exclusive, as the Pine script), each smoothed with an RMA of `length`.
 * +DI = 100 * RMA(+DM) / RMA(TR), -DI = 100 * RMA(-DM) / RMA(TR), DX = 100 * |+DI - -DI| / (+DI + -DI),
 * ADX = RMA(DX). Dotted levels at 20 and 25; a grey background on the bars where the ADX is below 25.
 *
 * Reference: "ADX with Shaded Zone" by MathThomas
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdxWithShadedZoneInputs {
  /** RMA length of the true range, the directional movements and the DX */
  length: number;
}

export const defaultInputs: AdxWithShadedZoneInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ADX Length', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '+DI', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: '-DI', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'ADX', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'ADX with Shaded Zone',
  shortTitle: 'ADX with Shaded Zone',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };
type Rma = ReturnType<typeof taStep.rma>;

interface AdxRun extends BarRunState<Record<string, never>> {
  smoothTR: Rma;
  smoothPlusDM: Rma;
  smoothMinusDM: Rma;
  adx: Rma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AdxWithShadedZoneInputs>): BarStudy<AdxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // math.max / math.abs of na is na
  const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  const shade = String(color.new(color.gray, 85));
  return {
    init() {
      const smoothTR = taStep.rma(cfg.length);
      const smoothPlusDM = taStep.rma(cfg.length);
      const smoothMinusDM = taStep.rma(cfg.length);
      const adx = taStep.rma(cfg.length);
      const s: AdxRun = {
        smoothTR, smoothPlusDM, smoothMinusDM, adx, plot0: [], plot1: [], plot2: [], bgColors: [],
        steps: [smoothTR, smoothPlusDM, smoothMinusDM, adx], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const highLow = b.high - b.low;
      const highClose = Math.abs(b.high - prevClose);
      const lowClose = Math.abs(b.low - prevClose);
      const tr = max(max(highLow, highClose), lowClose);
      // ta.change(high) / ta.change(low): na on bar 0
      const chHigh = i > 0 ? b.high - bars[i - 1].high : NaN;
      const chLow = i > 0 ? b.low - bars[i - 1].low : NaN;
      const plusDM = max(chHigh, 0);
      const minusDM = max(-chLow, 0);

      const smoothTR = s.smoothTR.step(tr);
      const smoothPlusDM = s.smoothPlusDM.step(plusDM);
      const smoothMinusDM = s.smoothMinusDM.step(minusDM);

      // Plain divisions: x / 0 is +-infinity, 0 / 0 is na (ta.rma skips the infinite values like na)
      const plusDI = (100 * smoothPlusDM) / smoothTR;
      const minusDI = (100 * smoothMinusDM) / smoothTR;
      const dx = (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
      const adx = s.adx.step(dx);

      // bgcolor((adx < 25) ? color.new(color.gray, 85) : na, title = "Shaded Zone (20-25)")
      if (lt(adx, 25)) s.bgColors.push({ time: b.time, color: shade });
      s.plot0[i] = { time: b.time, value: fin(plusDI), color: color.green };
      s.plot1[i] = { time: b.time, value: fin(minusDI), color: color.red };
      s.plot2[i] = { time: b.time, value: fin(adx), color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 20, options: { title: '20 Level', color: color.red, linestyle: 'dotted' } },
          { value: 25, options: { title: '25 Level', color: color.green, linestyle: 'dotted' } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdxWithShadedZoneInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdxWithShadedZoneInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdxWithShadedZone = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
