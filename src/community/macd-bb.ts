/**
 * AK MACD BB Indicator
 *
 * MACD histogram enclosed by Bollinger Bands.
 * BB applied to MACD histogram for overbought/oversold detection.
 *
 * Reference: "AK MACD BB INDICATOR" by Algokid
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACDBBInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  bbLength: number;
  bbMult: number;
  src: SourceType;
}

export const defaultInputs: MACDBBInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  bbLength: 10,
  bbMult: 1.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Periods', defval: 10, min: 1 },
  { id: 'bbMult', type: 'float', title: 'Deviations', defval: 1.0, min: 0.01, step: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#26A69A', lineWidth: 3, style: 'circles' },
  { id: 'plot1', title: 'BB Upper', color: '#808080', lineWidth: 2 },
  { id: 'plot2', title: 'BB Lower', color: '#808080', lineWidth: 2 },
  { id: 'plot3', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'AK MACD BB',
  shortTitle: 'MACDBB',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface MacdBbRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  basis: WindowSma;
  dev: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<MACDBBInputs>): BarStudy<MacdBbRun, Result> {
  const { fastLength, slowLength, bbLength, bbMult, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(slowLength, bbLength);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const basis = new WindowSma(bbLength);
      const dev = new WindowStdev(bbLength);
      const s: MacdBbRun = {
        fast, slow, basis, dev, plot0: [], plot1: [], plot2: [], plot3: [], barColors: [],
        steps: [fast, slow, basis, dev], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = value(b);
      const m = s.fast.step(v) - s.slow.step(v);

      // BB on MACD (Pine applies BB directly to macd, not histogram)
      const basis = s.basis.step(m);
      const dev = s.dev.step(m) * bbMult;
      const u = basis + dev;
      const l = basis - dev;

      if (i < warmup || m == null) s.plot0[i] = { time, value: NaN };
      else s.plot0[i] = { time, value: m, color: (u != null && m >= u) ? '#00FF00' : '#FF0000' };
      const early = i < warmup;
      s.plot1[i] = { time, value: early || u == null ? NaN : u };
      s.plot2[i] = { time, value: early || l == null ? NaN : l };
      s.plot3[i] = { time, value: early || basis == null ? NaN : basis };

      // Pine barcolor: macd > Upper => yellow; macd < Lower => aqua
      if (!early) {
        if (m > u) s.barColors.push({ time, color: '#FFEB3B' });
        else if (m < l) s.barColors.push({ time, color: '#00BCD4' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        hlines: [{ value: 0, options: { color: '#FF7F00', linestyle: 'solid' as const, title: 'Zeroline' } }],
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(33, 150, 243, 0.15)' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDBBInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDBBInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MACDBB = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
