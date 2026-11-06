/**
 * Moving Average Shift
 *
 * MA with configurable offset (shifted forward or backward in time).
 *
 * Reference: "Moving Average Shift" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAShiftInputs {
  length: number;
  maType: string;
  offset: number;
  src: SourceType;
}

export const defaultInputs: MAShiftInputs = {
  length: 20,
  maType: 'sma',
  offset: 0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema', 'wma'] },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'MA Glow', color: 'rgba(41,98,255,0.2)', lineWidth: 7 },
  { id: 'osc', title: 'Oscillator', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'oscTop', title: 'Osc Top', color: 'transparent', lineWidth: 0 },
  { id: 'oscZero', title: 'Osc Zero', color: 'transparent', lineWidth: 0 },
  { id: 'oscBot', title: 'Osc Bottom', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Moving Average Shift',
  shortTitle: 'MAS',
  overlay: true,
};

type Ma = { step(v: number): number; commit(): void };

function applyMA(length: number, maType: string): Ma {
  switch (maType) {
    case 'ema': return taStep.ema(length);
    case 'wma': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    default: return new WindowSma(length);
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> };

interface MAShiftRun extends BarRunState<Record<string, never>> {
  ma: Ma;
  hma: ReturnType<typeof taStep.hma>;
  maArr: number[];
  diffArr: number[];
  oscArr: number[];
  oscCol: string[];
  plot: Point[];
  glowPlot: Point[];
  oscPlot: Point[];
  barColors: BarColorData[];
  candles: PlotCandleData[];
  markers: MarkerData[];
}

const oscLen = 15;
const oscThreshold = 0.5;

function study(inputs: Partial<MAShiftInputs>): BarStudy<MAShiftRun, Result> {
  const { length, maType, offset, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // a negative offset draws the MA of later bars: bar k is calculated when bar k - offset is known (in full runs)
  const delay = Math.max(0, -offset);

  /** The outputs of bar k, with the MA of the first `known` bars */
  const outputs = (s: MAShiftRun, k: number, bars: Bar[], known: number) => {
    const b = bars[k];
    const time = b.time;
    const srcIdx = k - offset;
    const maVal = srcIdx >= 0 && srcIdx < known && srcIdx >= length ? (s.maArr[srcIdx] ?? NaN) : NaN;
    s.plot[k] = { time, value: maVal };
    // Glow plot: same MA data with wider line (rendered behind via reduced opacity in plotConfig)
    s.glowPlot[k] = { time, value: maVal };

    // barcolor: color bars based on source >= MA (Pine: barcolor(color) where color = source >= MA ? bullCol : bearCol)
    // plotcandle: overlay candles colored by trend (Pine: plotcandle(open,high,low,close,color=color,...))
    const srcVal = value(b);
    if (!isNaN(maVal)) {
      const col = (srcVal ?? 0) >= maVal ? '#17a297' : '#FF9800';
      s.barColors.push({ time, color: col });
      s.candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close, color: col, borderColor: col, wickColor: col });
    }

    // markers: diamond shapes on oscillator crossover signals
    // Pine: osc = hma(change(diff/perc_r, osc_len), 10) with sig_up/sig_dn on crossover/crossunder of osc vs osc[2]
    // Simplified: use diff = source - MA, then approximate the oscillator direction
    const diffArr = s.diffArr;
    diffArr[k] = !isNaN(maVal) ? (srcVal ?? 0) - maVal : NaN;
    // Compute change of diff over osc_len=15 bars, smoothed with HMA(10)
    let change: number;
    if (k >= oscLen && !isNaN(diffArr[k]) && !isNaN(diffArr[k - oscLen]) && diffArr[k - oscLen] !== 0) {
      // Normalize by a rolling percentile proxy (max abs diff over lookback)
      let maxAbsDiff = 0;
      for (let j = Math.max(0, k - 100); j <= k; j++) {
        if (!isNaN(diffArr[j])) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(diffArr[j]));
      }
      const normDiff = maxAbsDiff > 0 ? diffArr[k] / maxAbsDiff : 0;
      const normDiffPrev = maxAbsDiff > 0 ? diffArr[k - oscLen] / maxAbsDiff : 0;
      change = normDiff - normDiffPrev;
    } else {
      change = NaN;
    }
    const oscArr = s.oscArr;
    const osc = s.hma.step(change);
    oscArr[k] = osc;
    if (k >= 2) {
      const osc2 = oscArr[k - 2] ?? NaN;
      const prevOsc = oscArr[k - 1] ?? NaN;
      const prevOsc2 = oscArr[k - 3] ?? NaN;
      if (!(isNaN(osc) || isNaN(osc2) || isNaN(prevOsc))) {
        // crossover(osc, osc[2]) and osc < -threshold -> sig_up (diamond below bar)
        if (prevOsc <= prevOsc2 && osc > osc2 && osc < -oscThreshold) {
          s.markers.push({ time, position: 'belowBar', shape: 'diamond', color: '#1dd1c2', text: 'Up' });
        }
        // crossunder(osc, osc[2]) and osc > threshold -> sig_dn (diamond above bar)
        if (prevOsc >= prevOsc2 && osc < osc2 && osc > oscThreshold) {
          s.markers.push({ time, position: 'aboveBar', shape: 'diamond', color: '#FFEB3B', text: 'Dn' });
        }
      }
    }

    // Build oscillator plots for fills
    const prev = oscArr[k - 1] ?? NaN;
    if (isNaN(osc)) s.oscPlot[k] = { time, value: NaN };
    else {
      // Color per Pine: osc > 0 ? (rising ? up1 : up2) : (falling ? dn1 : dn2)
      let col: string;
      if (osc > 0) col = osc > prev ? '#1dd1c2' : '#17a297';
      else col = osc < prev ? '#FFEB3B' : '#FF9800';
      s.oscPlot[k] = { time, value: osc, color: col };
    }
    // Pine: osc_col = osc > 0 ? (osc > osc[1] ? osc_col_up1 : osc_col_up2) : (osc < osc[1] ? osc_col_dn1 : osc_col_dn2)
    // (v6 palette: osc_col_dn1 = color.yellow #FDD835, osc_col_dn2 = color.orange #FF9800)
    const prevCol = k > 0 ? (oscArr[k - 1] ?? NaN) : NaN;
    s.oscCol[k] = osc > 0 ? (osc > prevCol ? '#1DD1C2' : '#17A297') : (osc < prevCol ? '#FDD835' : '#FF9800');
  };

  return {
    fullRunReason: () => (!isBarSource(src) ? 'source of another study' : delay > 0 ? 'negative offset: the last bars read later bars' : null),
    init() {
      const s: MAShiftRun = {
        ma: applyMA(length, maType), hma: taStep.hma(10), maArr: [], diffArr: [], oscArr: [], oscCol: [], plot: [],
        glowPlot: [], oscPlot: [], barColors: [], candles: [], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ma, s.hma];
      s.lists = [s.barColors, s.candles, s.markers];
      s.series = [s.maArr, s.diffArr, s.oscArr, s.oscCol, s.plot, s.glowPlot, s.oscPlot];
      return s;
    },
    bar(s, i, bars) {
      s.maArr[i] = s.ma.step(value(bars[i]));
      const k = i - delay;
      if (k >= 0) outputs(s, k, bars, i + 1);
    },
    result(s, bars) {
      const n = bars.length;
      // the last bars of a negative offset (full runs only): the MA of the bars after the last one is na
      // (the step of the last bar, not committed by the run, is final here)
      if (delay > 0 && n - 1 - delay >= 0) s.hma.commit();
      for (let k = Math.max(0, n - delay); k < n; k++) {
        outputs(s, k, bars, n);
        s.hma.commit();
      }
      const oscTopPlot = bars.map(b => ({ time: b.time, value: oscThreshold }));
      const oscZeroPlot = bars.map(b => ({ time: b.time, value: 0 }));
      const oscBotPlot = bars.map(b => ({ time: b.time, value: -oscThreshold }));
      const oscCol = s.oscCol;
      // color.new(osc_col, t): alpha byte of transparency t
      const withTransp = (t: number) => {
        const aa = Math.round((100 - t) * 2.55).toString(16).padStart(2, '0').toUpperCase();
        return oscCol.map((c) => c + aa);
      };
      const constant = (v: number) => new Array<number>(n).fill(v);

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot.slice(), 'plot1': s.glowPlot.slice(), 'osc': s.oscPlot.slice(), 'oscTop': oscTopPlot, 'oscZero': oscZeroPlot, 'oscBot': oscBotPlot },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        plotCandles: { candle0: s.candles.slice() },
        fills: [
          // fill(p1, p0, top, 0, color.new(osc_col, 70), color.new(osc_col, 100))
          {
            plot1: 'oscTop', plot2: 'oscZero',
            gradient: { topValue: constant(oscThreshold), bottomValue: constant(0), topColor: withTransp(70), bottomColor: withTransp(100) },
          },
          // fill(p2, p0, 0, bot, color.new(osc_col, 100), color.new(osc_col, 80))
          {
            plot1: 'oscBot', plot2: 'oscZero',
            gradient: { topValue: constant(0), bottomValue: constant(-oscThreshold), topColor: withTransp(100), bottomColor: withTransp(80) },
          },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAShiftInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAShiftInputs> = {}): Omit<IndicatorResult, 'markers'> {
  return fullResult(createRun(inputs).update(bars));
}

export const MAShift = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
