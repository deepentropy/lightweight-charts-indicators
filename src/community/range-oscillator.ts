/**
 * Range Oscillator (Zeiierman)
 *
 * A moving average of the close weighted by the relative bar-to-bar change over `length` bars; the oscillator is
 * 100 * (close - ma) / (ATR * multiplier), with ATR(2000) (ATR(200) while ATR(2000) is na). The trend is the side of
 * the close to the ma. The oscillator colour comes from a heat map: its last 100 values are split in `levels` levels
 * between their lowest and highest value, each level coloured by its touch count (gradient from the weak trend colour
 * at transparency 80 - count to the weak trend colour), and the level nearest to the oscillator gives the colour.
 * The transition colour is used on a trend flip or without a heat colour; strong colours when the close leaves
 * the range (ma +/- ATR * multiplier). Gradient fills between the oscillator and zero.
 *
 * Reference: "Range Oscillator (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RangeOscillatorInputs {
  /** Minimum range length */
  length: number;
  /** Range width multiplier */
  mult: number;
  /** Number of heat levels (2..100) */
  levels: number;
  /** Minimum touches per level */
  heatThresh: number;
  strongBullish: string;
  strongBearish: string;
  weakBearish: string;
  weakBullish: string;
  /** Transition colour */
  transitionZone: string;
}

export const defaultInputs: RangeOscillatorInputs = {
  length: 50,
  mult: 2.0,
  levels: 2,
  heatThresh: 1,
  strongBullish: '#09ff00',
  strongBearish: '#FF0000',
  weakBearish: color.maroon,
  weakBullish: color.green,
  transitionZone: color.blue,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Minimum Range Length', defval: 50, min: 1, step: 1 },
  { id: 'mult', type: 'float', title: 'Range Width Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'levels', type: 'int', title: 'Number of Heat Levels', defval: 2, min: 2, max: 100 },
  { id: 'heatThresh', type: 'int', title: 'Minimum Touches per Level', defval: 1, min: 1 },
  { id: 'strongBullish', type: 'color', title: 'Strong Bullish Color', defval: '#09ff00' },
  { id: 'strongBearish', type: 'color', title: 'Strong Bearish Color', defval: '#FF0000' },
  { id: 'weakBearish', type: 'color', title: 'Weak Bearish Color', defval: color.maroon },
  { id: 'weakBullish', type: 'color', title: 'Weak Bullish Color', defval: color.green },
  { id: 'transitionZone', type: 'color', title: 'Transition Color', defval: color.blue },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Range Oscillator', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'Zero', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Range Oscillator (Zeiierman)',
  shortTitle: 'Range Oscillator',
  overlay: false,
};

interface RangeOscVars {
  /** var int trendDir = 0 */
  dir: number;
}

interface RangeOscRun extends BarRunState<RangeOscVars> {
  atr2000: ReturnType<typeof taStep.atr>;
  atr200: ReturnType<typeof taStep.atr>;
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  close: number[];
  osc: number[];
  trendDir: number[];
  hi: number[];
  lo: number[];
  oscPlot: { time: number; value: number; color: string }[];
  oscColors: (string | null)[];
  zeroPlot: { time: number; value: number }[];
}

function study(inputs: Partial<RangeOscillatorInputs>): BarStudy<RangeOscRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, mult, levels, heatThresh } = cfg;
  return {
    init() {
      const s: RangeOscRun = {
        atr2000: taStep.atr(2000), atr200: taStep.atr(200), highest: taStep.highest(), lowest: taStep.lowest(),
        close: [], osc: [], trendDir: [], hi: [], lo: [], oscPlot: [], oscColors: [], zeroPlot: [],
        steps: [], vars: { dir: 0 }, lists: [], series: [],
      };
      s.steps = [s.atr2000, s.atr200, s.highest, s.lowest];
      s.series = [s.close, s.osc, s.trendDir, s.hi, s.lo, s.oscPlot, s.oscColors, s.zeroPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      const close = s.close;
      close[i] = c;
      // atrRaw = nz(ta.atr(2000), ta.atr(200)); rangeATR = atrRaw * mult
      const a2000 = s.atr2000.step(b.high, b.low, c) ?? NaN;
      const a200 = s.atr200.step(b.high, b.low, c) ?? NaN;
      const rangeATR = (isNaN(a2000) ? a200 : a2000) * mult;

      // weights: w = |close[k] - close[k + 1]| / close[k + 1], k = 0..length - 1 (na when a close is before bar 0)
      let sumWC = 0;
      let sumW = 0;
      for (let k = 0; k < length; k++) {
        const c0 = i - k >= 0 ? close[i - k] : NaN;
        const c1 = i - k - 1 >= 0 ? close[i - k - 1] : NaN;
        const w = Math.abs(c0 - c1) / c1;
        sumWC += c0 * w;
        sumW += w;
      }
      // ma = sumWeights != 0 ? sumWeightedClose / sumWeights : na (na != 0 is false)
      const ma = !isNaN(sumW) && sumW !== 0 ? sumWC / sumW : NaN;
      // trendDir := close > ma ? 1 : close < ma ? -1 : nz(trendDir[1])
      const dir = c > ma ? 1 : c < ma ? -1 : s.vars.dir;
      s.vars.dir = dir;
      s.trendDir[i] = dir;
      // osc = rangeATR != 0 ? 100 * (close - ma) / rangeATR : na
      const osc = !isNaN(rangeATR) && rangeATR !== 0 ? (100 * (c - ma)) / rangeATR : NaN;
      s.osc[i] = osc;

      // getHeatColor(osc, trendDir, ..., high_ser = osc, low_ser = osc, pointMode = true)
      const hi = s.highest.step(osc, 100) ?? NaN;
      const lo = s.lowest.step(osc, 100) ?? NaN;
      s.hi[i] = hi;
      s.lo[i] = lo;
      let heat: string | null = null;
      const rng = hi - lo;
      const step = rng > 0 ? rng / levels : NaN;
      if (!(isNaN(step) || step === 0)) {
        const weak = dir === 1 ? cfg.weakBullish : cfg.weakBearish;
        let minD = 1e10;
        for (let l = 0; l < levels; l++) {
          const lvl = lo + step * (l + 0.5);
          // touches: osc[j] in [lvl - step / 2, lvl + step / 2) over the last 100 bars (na never touches);
          // Pine float comparisons: a < b only when b - a > 1e-10, a >= b otherwise
          let cnt = 0;
          for (let j = 0; j < 100; j++) {
            const v = i - j >= 0 ? s.osc[i - j] : NaN;
            if (!(lvl - step / 2 - v > 1e-10) && lvl + step / 2 - v > 1e-10) cnt++;
          }
          // color.from_gradient(cnt, heatThresh, heatThresh + 10, color.new(cold, 80 - cnt), hot)
          const col = String(color.from_gradient(cnt, heatThresh, heatThresh + 10, color.new(weak, 80 - cnt), weak));
          const d = Math.abs(osc - lvl);
          if (d < minD) {
            minD = d;
            heat = col;
          }
        }
      }

      // noColorOnFlip = trendDir != trendDir[1]
      const flip = i > 0 && dir !== s.trendDir[i - 1];
      let oscColor = heat === null || flip ? cfg.transitionZone : heat;
      // breakUp = close > ma + rangeATR; breakDn = close < ma - rangeATR
      if (c > ma + rangeATR) oscColor = cfg.strongBullish;
      else if (c < ma - rangeATR) oscColor = cfg.strongBearish;
      s.oscPlot[i] = { time: b.time, value: osc, color: oscColor };
      s.oscColors[i] = oscColor;
      s.zeroPlot[i] = { time: b.time, value: 0 };
    },
    result(s, bars) {
      const n = bars.length;
      const none = new Array<string | null>(n).fill(null);
      const zeros = new Array<number>(n).fill(0);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.oscPlot.slice(),
          plot1: s.zeroPlot.slice(),
        },
        hlines: [
          { value: 100, options: { title: 'Upper Bound', color: color.gray, linestyle: 'dotted' } },
          { value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dotted' } },
          { value: -100, options: { title: 'Lower Bound', color: color.gray, linestyle: 'dotted' } },
        ],
        fills: [
          // fill(osc_, zero_, ta.highest(osc, 100), 0, oscColor, color(na))
          { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: s.hi.slice(), bottomValue: zeros, topColor: s.oscColors.slice(), bottomColor: none } },
          // fill(osc_, zero_, 0, ta.lowest(osc, 100), color(na), oscColor)
          { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: zeros, bottomValue: s.lo.slice(), topColor: none, bottomColor: s.oscColors.slice() } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RangeOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RangeOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RangeOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
