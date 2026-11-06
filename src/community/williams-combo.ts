/**
 * Bill Williams. Alligator, Fractals & Res-Sup combined (by vlkvr)
 *
 * Alligator: 3 SMMA (RMA) lines on HL2 drawn forward: Lips (5, offset 3), Teeth (8, offset 5), Jaw (13, offset 8).
 * Fractals: Pine 5-clause rule with period n (equal highs/lows allowed before the fractal bar), shape drawn with
 * offset -2.
 * Resistance: valuewhen(high >= highest(high, lengthRS), high, 0); Support: valuewhen(low <= lowest(low, lengthRS),
 * low, 0). Pine plots the value on every bar and gives it an na colour on the bars where it changes.
 *
 * Reference: "Bill Williams. Alligator, Fractals & Res-Sup combined" by vlkvr (Pine v3)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WilliamsComboInputs {
  lipsLength: number;
  teethLength: number;
  jawLength: number;
  lipsOffset: number;
  teethOffset: number;
  jawOffset: number;
  n: number;
  showRS: boolean;
  lengthRS: number;
}

export const defaultInputs: WilliamsComboInputs = {
  lipsLength: 5,
  teethLength: 8,
  jawLength: 13,
  lipsOffset: 3,
  teethOffset: 5,
  jawOffset: 8,
  n: 2,
  showRS: true,
  lengthRS: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'lipsLength', type: 'int', title: '🐲 Lips Length', defval: 5 },
  { id: 'teethLength', type: 'int', title: '🐲 Teeth Length', defval: 8 },
  { id: 'jawLength', type: 'int', title: '🐲 Jaw Length', defval: 13 },
  { id: 'lipsOffset', type: 'int', title: '🐲 Lips Offset', defval: 3 },
  { id: 'teethOffset', type: 'int', title: '🐲 Teeth Offset', defval: 5 },
  { id: 'jawOffset', type: 'int', title: '🐲 Jaw Offset', defval: 8 },
  { id: 'n', type: 'int', title: '📌 Period', defval: 2, min: 2 },
  { id: 'showRS', type: 'bool', title: '⤒⤓ Show Res-Sup', defval: true },
  { id: 'lengthRS', type: 'int', title: '⤒⤓ Res-Sup Length', defval: 13 },
];

// Pine v3 colours: green #008000, red #FF0000, blue #0000FF (transp 75), olive #808000, maroon #800000 (transp 25)
const LIPS_COL = '#00800040';
const TEETH_COL = '#FF000040';
const JAW_COL = '#0000FF40';
const OLIVE = '#808000bf';
const MAROON = '#800000bf';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '🐲 Jaw', color: JAW_COL, lineWidth: 1 },
  { id: 'plot1', title: '🐲 Teeth', color: TEETH_COL, lineWidth: 1 },
  { id: 'plot2', title: '🐲 Lips', color: LIPS_COL, lineWidth: 1 },
  { id: 'plot3', title: '⤒ Resistance', color: OLIVE, lineWidth: 1 },
  { id: 'plot4', title: '⤓ Support', color: MAROON, lineWidth: 1 },
];

export const metadata = {
  title: 'Williams Alligator + Fractals',
  shortTitle: 'WilliamsCombo',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface WilliamsVars {
  /** valuewhen(...) of the resistance and the support */
  highRS: number;
  lowRS: number;
}

interface WilliamsRun extends BarRunState<WilliamsVars> {
  jaw: ReturnType<typeof taStep.rma>;
  teeth: ReturnType<typeof taStep.rma>;
  lips: ReturnType<typeof taStep.rma>;
  hh: WindowExtreme;
  ll: WindowExtreme;
  jawRaw: number[];
  teethRaw: number[];
  lipsRaw: number[];
  plot3: Point[];
  plot4: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<WilliamsComboInputs>): BarStudy<WilliamsRun, Result> {
  const { lipsLength, teethLength, jawLength, lipsOffset, teethOffset, jawOffset, n: period, showRS, lengthRS } =
    { ...defaultInputs, ...inputs };

  // Fractals (Pine source, literally): h(k) = high[k], NaN before the first bar (comparisons with na are false).
  const upFractalAt = (bars: Bar[], i: number): boolean => {
    const h = (k: number) => (i - k >= 0 ? bars[i - k].high : NaN);
    const c = h(period);
    return (h(period + 2) < c && h(period + 1) < c && h(period - 1) < c && h(period - 2) < c) ||
      (h(period + 3) < c && h(period + 2) < c && h(period + 1) === c && h(period - 1) < c && h(period - 2) < c) ||
      (h(period + 4) < c && h(period + 3) < c && h(period + 2) === c && h(period + 1) <= c && h(period - 1) < c && h(period - 2) < c) ||
      (h(period + 5) < c && h(period + 4) < c && h(period + 3) === c && h(period + 2) === c && h(period + 1) <= c && h(period - 1) < c && h(period - 2) < c) ||
      (h(period + 6) < c && h(period + 5) < c && h(period + 4) === c && h(period + 3) <= c && h(period + 2) === c && h(period + 1) <= c && h(period - 1) < c && h(period - 2) < c);
  };
  const dnFractalAt = (bars: Bar[], i: number): boolean => {
    const l = (k: number) => (i - k >= 0 ? bars[i - k].low : NaN);
    const c = l(period);
    return (l(period + 2) > c && l(period + 1) > c && l(period - 1) > c && l(period - 2) > c) ||
      (l(period + 3) > c && l(period + 2) > c && l(period + 1) === c && l(period - 1) > c && l(period - 2) > c) ||
      (l(period + 4) > c && l(period + 3) > c && l(period + 2) === c && l(period + 1) >= c && l(period - 1) > c && l(period - 2) > c) ||
      (l(period + 5) > c && l(period + 4) > c && l(period + 3) === c && l(period + 2) === c && l(period + 1) >= c && l(period - 1) > c && l(period - 2) > c) ||
      (l(period + 6) > c && l(period + 5) > c && l(period + 4) === c && l(period + 3) >= c && l(period + 2) === c && l(period + 1) >= c && l(period - 1) > c && l(period - 2) > c);
  };

  return {
    init() {
      // Pine smma: na(smma[1]) ? sma(src, length) : (smma[1] * (length - 1) + src) / length  (= RMA)
      const jaw = taStep.rma(jawLength);
      const teeth = taStep.rma(teethLength);
      const lips = taStep.rma(lipsLength);
      const hh = new WindowExtreme(false, lengthRS);
      const ll = new WindowExtreme(true, lengthRS);
      const s: WilliamsRun = {
        jaw, teeth, lips, hh, ll, jawRaw: [], teethRaw: [], lipsRaw: [], plot3: [], plot4: [], markers: [],
        steps: [jaw, teeth, lips, hh, ll], vars: { highRS: NaN, lowRS: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.jawRaw, s.teethRaw, s.lipsRaw, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const hl2 = (b.high + b.low) / 2;
      s.jawRaw[i] = s.jaw.step(hl2);
      s.teethRaw[i] = s.teeth.step(hl2);
      s.lipsRaw[i] = s.lips.step(hl2);
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);

      // plotshape(..., offset = -2): drawn 2 bars before the bar where the fractal is found
      if (i >= 2 && upFractalAt(bars, i)) {
        s.markers.push({ time: bars[i - 2].time, position: 'aboveBar', shape: 'triangleUp', color: OLIVE });
      }
      if (i >= 2 && dnFractalAt(bars, i)) {
        s.markers.push({ time: bars[i - 2].time, position: 'belowBar', shape: 'triangleDown', color: MAROON });
      }

      const prevHighRS = v.highRS;
      const prevLowRS = v.lowRS;
      // Pine: highRS = valuewhen(high >= highest(high, lengthRS), high, 0) (highest is na on the first lengthRS - 1 bars)
      if (b.high >= hh) v.highRS = b.high;
      if (b.low <= ll) v.lowRS = b.low;
      const { highRS, lowRS } = v;

      // Pine: series = showRS and highRS ? highRS : na; color = highRS != highRS[1] ? na : olive
      // (a comparison with na is na, so the colour stays olive on the first bar with a value)
      const resOn = showRS && !isNaN(highRS) && highRS !== 0;
      const supOn = showRS && !isNaN(lowRS) && lowRS !== 0;
      const resChanged = !isNaN(prevHighRS) && highRS !== prevHighRS;
      const supChanged = !isNaN(prevLowRS) && lowRS !== prevLowRS;
      s.plot3[i] = resOn
        ? { time: b.time, value: highRS, color: resChanged ? 'transparent' : OLIVE }
        : { time: b.time, value: NaN };
      s.plot4[i] = supOn
        ? { time: b.time, value: lowRS, color: supChanged ? 'transparent' : MAROON }
        : { time: b.time, value: NaN };
    },
    result(s, bars) {
      const n = bars.length;
      // Pine plot(..., offset = k): the value of bar i is drawn on bar i + k. The last k values fall on the k bars after
      // the last bar (times of these future bars).
      const interval = barInterval(bars);
      const shifted = (arr: number[], offset: number) =>
        Array.from({ length: n + Math.max(0, offset) }, (_, i) => {
          const j = i - offset;
          const v = j >= 0 && j < n ? arr[j] : NaN;
          return { time: barTime(bars, i, interval), value: v ?? NaN };
        });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': shifted(s.jawRaw, jawOffset),
          'plot1': shifted(s.teethRaw, teethOffset),
          'plot2': shifted(s.lipsRaw, lipsOffset),
          'plot3': s.plot3.slice(),
          'plot4': s.plot4.slice(),
        },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WilliamsComboInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WilliamsComboInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const WilliamsCombo = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
