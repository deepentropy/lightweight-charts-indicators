/**
 * Inverse Fisher Transform COMBO [Stoch + RSI + CCI + MFI]
 *
 * Four oscillators, each scaled around 0 (0.1 * (CCI / 4), 0.1 * (RSI - 50), 0.1 * (Stoch - 50),
 * 0.1 * (MFI - 50)), smoothed with a WMA and passed through the inverse Fisher transform
 * IFT(x) = (e^(2x) - 1) / (e^(2x) + 1), which maps them to -1..1. The MFI is built from hlc3 and the volume
 * (sums of the money flow of the up and down bars). The average line is the mean of the four transforms.
 * Each line shows only when its option is on (by default only the CCI line) and where its value is not 0.
 * Levels at 0.5 and -0.5.
 *
 * Reference: "Inverse Fisher Transform COMBO" by KivancOzbilgic (creator John Ehlers)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: author @KivancOzbilgic, creator John EHLERS
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IFTStochRSICCIInputs {
  /** Show the IFT of the Stochastic */
  showSto: boolean;
  /** Show the IFT of the RSI */
  showRsi: boolean;
  /** Show the IFT of the CCI */
  showCci: boolean;
  /** Show the IFT of the MFI */
  showMfi: boolean;
  /** Show the average of the four IFT lines */
  showAverage: boolean;
  cciLength: number;
  /** WMA smoothing length */
  wmaLength: number;
  rsiLength: number;
  stochLength: number;
  mfiLength: number;
}

export const defaultInputs: IFTStochRSICCIInputs = {
  showSto: false,
  showRsi: false,
  showCci: true,
  showMfi: false,
  showAverage: false,
  cciLength: 5,
  wmaLength: 9,
  rsiLength: 5,
  stochLength: 5,
  mfiLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'showSto', type: 'bool', title: 'Show INVERSE FISHER TRANSFORM on STOCHASTIC Line?', defval: false },
  { id: 'showRsi', type: 'bool', title: 'Show INVERSE FISHER TRANSFORM on RSI Line?', defval: false },
  { id: 'showCci', type: 'bool', title: 'Show INVERSE FISHER TRANSFORM on CCI Line?', defval: true },
  { id: 'showMfi', type: 'bool', title: 'Show INVERSE FISHER TRANSFORM on MFI Line?', defval: false },
  { id: 'showAverage', type: 'bool', title: 'Show INVERSE FISHER TRANSFORM AVERAGE Line?', defval: false },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 5 },
  { id: 'wmaLength', type: 'int', title: 'Smoothing Length', defval: 9 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 5 },
  { id: 'stochLength', type: 'int', title: 'STOCH Length', defval: 5 },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AVERAGE', color: '#9C27B0', lineWidth: 3 },
  { id: 'plot1', title: 'STOCH', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'CCIv2', color: '#FF5252', lineWidth: 3 },
  { id: 'plot3', title: 'RSI', color: '#363A45', lineWidth: 2 },
  { id: 'plot4', title: 'MFI', color: '#9C27B0', lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 0.5, title: 'Level', color: '#FF5252', linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.5, title: 'Level', color: '#4CAF50', linestyle: 'dashed' },
];

export const metadata = {
  title: 'Inverse Fisher Transform COMBO',
  shortTitle: 'IFTCOMBO',
  overlay: false,
};

const EPS = 1e-10;
const ift = (x: number): number => (Math.exp(2 * x) - 1) / (Math.exp(2 * x) + 1);
const num = (v: number | null | undefined): number => (v == null ? NaN : v);

type Point = { time: number; value: number };

interface IftRun extends BarRunState<Record<string, never>> {
  cci: ReturnType<typeof taStep.cci>;
  rsi: ReturnType<typeof taStep.rsi>;
  stoch: ReturnType<typeof taStep.stoch>;
  up: WindowSum;
  lo: WindowSum;
  wmas: ReturnType<typeof taStep.wma>[];
  src: number[];
  plots: Point[][];
}

function study(inputs: Partial<IFTStochRSICCIInputs>): BarStudy<IftRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // plot(show and x ? x : na): a float in a condition is false when na or 0
  const line = (show: boolean, time: number, v: number): Point => ({ time, value: show && Number.isFinite(v) && v !== 0 ? v : NaN });
  return {
    init() {
      const s: IftRun = {
        cci: taStep.cci(cfg.cciLength), rsi: taStep.rsi(cfg.rsiLength), stoch: taStep.stoch(cfg.stochLength),
        up: new WindowSum(cfg.mfiLength), lo: new WindowSum(cfg.mfiLength),
        wmas: [taStep.wma(), taStep.wma(), taStep.wma(), taStep.wma()], src: [], plots: [[], [], [], [], []],
        vars: {}, steps: [], lists: [], series: [],
      };
      s.steps = [s.cci, s.rsi, s.stoch, s.up, s.lo, ...s.wmas];
      s.series = [s.src, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const wmaOf = (k: number, v: number) => ift(num(s.wmas[k].step(v, cfg.wmaLength)));
      // CCI of the close
      const cci = num(s.cci.step(b.close));
      const inv1 = wmaOf(0, 0.1 * (cci / 4));
      // RSI
      const rsi = num(s.rsi.step(b.close));
      const inv2 = wmaOf(1, 0.1 * (rsi - 50));
      // Stochastic
      const stoch = num(s.stoch.step(b.close, b.high, b.low));
      const invLine = wmaOf(2, 0.1 * (stoch - 50));
      // MFI: change(hlc3) <= 0 ? 0 : hlc3, Pine comparisons (equal within 1e-10; an na change on the first bar
      // counts on both sides)
      const src = (b.high + b.low + b.close) / 3;
      s.src[i] = src;
      const ch = i > 0 ? src - s.src[i - 1] : NaN;
      const vol = num(b.volume);
      const up = num(s.up.step(vol * (ch <= EPS ? 0 : src)));
      const lo = num(s.lo.step(vol * (ch >= -EPS ? 0 : src)));
      const mfi = 100.0 - 100.0 / (1.0 + up / lo);
      const inv3 = wmaOf(3, 0.1 * (mfi - 50));
      const avg = (inv1 + inv2 + invLine + inv3) / 4;
      s.plots[0][i] = line(cfg.showAverage, time, avg);
      s.plots[1][i] = line(cfg.showSto, time, invLine);
      s.plots[2][i] = line(cfg.showCci, time, inv1);
      s.plots[3][i] = line(cfg.showRsi, time, inv2);
      s.plots[4][i] = line(cfg.showMfi, time, inv3);
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [
          { value: 0.5, options: { color: '#FF5252', linestyle: 'dashed' as const, title: 'Level' } },
          { value: -0.5, options: { color: '#4CAF50', linestyle: 'dashed' as const, title: 'Level' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IFTStochRSICCIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IFTStochRSICCIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IFTStochRSICCI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
