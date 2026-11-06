/**
 * WaveFunction MACD
 *
 * MACD line = fast MA - slow MA of the close (SMA, EMA or WMA). A phase angle comes from a detrended close:
 * detrender = close - ema(close, 4); phase = ema(detrender - ema(detrender, 4), 4); angle = atan(phase / close) in
 * degrees, smoothed by an EMA. Energy = MACD * cos(smoothed angle); the signal line is an EMA of the energy and the
 * histogram is energy - signal, coloured by sign and direction. Dots mark the crossings of the MACD line and the
 * signal line.
 *
 * Reference: "WaveFunction MACD (TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This indicator is created under TechnoBlooms - Innovating Trading Indicators and Strategies.
 * All rights reserved. Unauthorized copying or distribution is prohibited. © TechnoBlooms
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type WaveFunctionMacdMaType = 'SMA' | 'EMA' | 'WMA';

export interface WaveFunctionMacdInputs {
  /** Moving average type of the fast / slow MAs */
  maType: WaveFunctionMacdMaType;
  fastLength: number;
  slowLength: number;
  /** EMA length of the signal line */
  signalLength: number;
  /** EMA length of the phase angle */
  phaseSmoothing: number;
}

export const defaultInputs: WaveFunctionMacdInputs = {
  maType: 'WMA',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  phaseSmoothing: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'WMA', options: ['SMA', 'EMA', 'WMA'] },
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing Length', defval: 9 },
  { id: 'phaseSmoothing', type: 'int', title: 'Phase Shift Smoothing Length', defval: 5 },
];

const MACD_COLOR = String(color.rgb(33, 243, 226));
const SIGNAL_COLOR = String(color.rgb(211, 12, 255));
const STRONG_BULL = String(color.rgb(180, 198, 22));
const WEAK_BULL = String(color.rgb(223, 246, 19));
const STRONG_BEAR = '#bf1e7c';
const WEAK_BEAR = '#ff0f9b';
const BULL_DOT = String(color.rgb(51, 255, 0));
const BEAR_DOT = String(color.rgb(255, 0, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Quantum MACD Line', color: MACD_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Phase Signal Line', color: SIGNAL_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Energy Histogram', color: color.gray, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Bullish Dot', color: BULL_DOT, lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Bearish Dot', color: BEAR_DOT, lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'WaveFunction MACD (TechnoBlooms)',
  shortTitle: 'WaveFunction MACD (TechnoBlooms)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: Bar['time']; value: number; color?: string };

interface WfmVars {
  /** histogram[1] */
  prevH: number;
}

interface WfmRun extends BarRunState<WfmVars> {
  fast: (v: number) => number;
  slow: (v: number) => number;
  ema4: ReturnType<typeof taStep.ema>;
  detrenderEma: ReturnType<typeof taStep.ema>;
  phaseEma: ReturnType<typeof taStep.ema>;
  smoothedPhase: ReturnType<typeof taStep.ema>;
  signal: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
}

function study(inputs: Partial<WaveFunctionMacdInputs>): BarStudy<WfmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const ma = (length: number, steps: Committable[]): ((v: number) => number) => {
    switch (cfg.maType) {
      case 'SMA': { const m = new WindowSma(length); steps.push(m); return (v) => m.step(v); }
      case 'EMA': { const m = taStep.ema(length); steps.push(m); return (v) => m.step(v); }
      default: { const m = taStep.wma(); steps.push(m); return (v) => m.step(v, length); }
    }
  };
  return {
    init() {
      const steps: Committable[] = [];
      // Core MACD
      const fast = ma(cfg.fastLength, steps);
      const slow = ma(cfg.slowLength, steps);
      const ema4 = taStep.ema(4);
      const detrenderEma = taStep.ema(4);
      const phaseEma = taStep.ema(4);
      const smoothedPhase = taStep.ema(cfg.phaseSmoothing);
      const signal = taStep.ema(cfg.signalLength);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      steps.push(ema4, detrenderEma, phaseEma, smoothedPhase, signal, over, under);
      const s: WfmRun = {
        fast, slow, ema4, detrenderEma, phaseEma, smoothedPhase, signal, over, under,
        plots: [[], [], [], [], []], steps, vars: { prevH: NaN }, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const macdLine = s.fast(close) - s.slow(close);

      // Phase shift: detrender = close - ema(close, 4); phaseComponent = ema(detrender - ema(detrender, 4), 4)
      const detrender = close - s.ema4.step(close);
      const detrenderEma = s.detrenderEma.step(detrender);
      const phaseComponent = s.phaseEma.step(detrender - detrenderEma);
      // phaseShift = math.atan(phaseComponent / close) * (180 / math.pi)
      const phaseShift = Math.atan(phaseComponent / close) * (180 / Math.PI);
      const smoothedPhase = s.smoothedPhase.step(phaseShift);

      // energy = macdLine * math.cos(smoothedPhase * math.pi / 180); signalLine = ema(energy, signalLength)
      const energy = macdLine * Math.cos((smoothedPhase * Math.PI) / 180);
      const signalLine = s.signal.step(energy);
      const h = energy - signalLine;

      // ta.crossover / ta.crossunder (exact comparisons, with the last bar where both values were not na)
      const bullishCross = s.over.step(macdLine, signalLine);
      const bearishCross = s.under.step(macdLine, signalLine);

      const prevH = i > 0 ? v.prevH : NaN;
      v.prevH = h;
      const isBullish = gt(h, 0);
      const isBearish = lt(h, 0);
      const isRising = gt(h, prevH);
      const isFalling = lt(h, prevH);
      const histColor = isBullish && isRising ? STRONG_BULL
        : isBullish && isFalling ? WEAK_BULL
          : isBearish && isFalling ? STRONG_BEAR
            : isBearish && isRising ? WEAK_BEAR
              : color.gray;
      const p = s.plots;
      p[0][i] = { time: t, value: macdLine };
      p[1][i] = { time: t, value: signalLine };
      p[2][i] = { time: t, value: h, color: histColor };
      p[3][i] = { time: t, value: bullishCross ? macdLine : NaN };
      p[4][i] = { time: t, value: bearishCross ? macdLine : NaN };
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((x) => x.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4 },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WaveFunctionMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WaveFunctionMacdInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WaveFunctionMacd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
