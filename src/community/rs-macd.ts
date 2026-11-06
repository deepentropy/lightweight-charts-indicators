/**
 * rs_MACD (Moving Average Convergence and Divergence)
 *
 * MACD of the source (default ohlc4): macd = ema(src, fast) - ema(src, slow), signal = sma(macd, signal length),
 * histogram = macd - signal. The histogram is drawn as an area and as circles (dark when it does not rise); the MACD
 * is green when it is above the signal and not falling, else light red; the signal is red when it is above the MACD
 * and not rising, else light green. Horizontal line at 0. The original script draws on the price pane.
 *
 * Reference: "rs_MACD" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos.
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsMacdInputs {
  /** Source of the moving averages */
  source: SourceType;
  /** EMA length of the fast average */
  fastLength: number;
  /** EMA length of the slow average */
  slowLength: number;
  /** SMA length of the signal line */
  signalLength: number;
}

export const defaultInputs: RsMacdInputs = {
  source: 'ohlc4',
  fastLength: 12,
  slowLength: 24,
  signalLength: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source:', defval: 'ohlc4' },
  { id: 'fastLength', type: 'int', title: 'Fast Length:', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length:', defval: 24, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length:', defval: 6, min: 1 },
];

const HIST_AREA = String(color.rgb(99, 124, 150, 80));
const HIST_DOWN = '#455669';
const HIST_UP = '#91a3b5';
const MACD_LIGHT = '#fda8a8';
const SIGNAL_LIGHT = '#a8fdab';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: HIST_AREA, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'Histogram Line', color: HIST_UP, lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'MACD', color: color.green, lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Signal', color: color.red, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Moving Average Convergence and Divergence',
  shortTitle: 'MACD',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

type Point = { time: number; value: number; color: string };

interface RsMacdRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: WindowSma;
  macd: number[];
  signal: number[];
  hist: number[];
  plots: Point[][];
}

function study(inputs: Partial<RsMacdInputs>): BarStudy<RsMacdRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: RsMacdRun = {
        fast: taStep.ema(cfg.fastLength), slow: taStep.ema(cfg.slowLength), sig: new WindowSma(cfg.signalLength),
        macd: [], signal: [], hist: [], plots: [[], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.sig];
      s.series = [s.macd, s.signal, s.hist, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = value(b);
      const macd = s.fast.step(v) - s.slow.step(v);
      const signal = s.sig.step(macd);
      const hist = macd - signal;
      s.macd[i] = macd;
      s.signal[i] = signal;
      s.hist[i] = hist;
      const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);
      // c1 = macd > signal and macd >= macd[1] ? color.green : #fda8a8
      const c1 = gt(macd, signal) && ge(macd, prev(s.macd)) ? color.green : MACD_LIGHT;
      // c2 = signal > macd and signal <= signal[1] ? color.red : #a8fdab
      const c2 = gt(signal, macd) && le(signal, prev(s.signal)) ? color.red : SIGNAL_LIGHT;
      // c3 = hist <= hist[1] ? #455669 : #91a3b5
      const c3 = le(hist, prev(s.hist)) ? HIST_DOWN : HIST_UP;
      s.plots[0][i] = { time: t, value: hist, color: HIST_AREA };
      s.plots[1][i] = { time: t, value: hist, color: c3 };
      s.plots[2][i] = { time: t, value: macd, color: c1 };
      s.plots[3][i] = { time: t, value: signal, color: c2 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        // hline(0): Pine defaults (colour #787B86, dashed, width 1)
        hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsMacdInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RsMacd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
