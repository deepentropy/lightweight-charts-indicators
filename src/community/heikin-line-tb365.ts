/**
 * Heikin Line - TB365 (Moving Average Exponential)
 *
 * EMA of the source, drawn with an optional bar offset. An optional smoothing moving average of the EMA (SMA,
 * SMA + Bollinger Bands, EMA, RMA, WMA or VWMA); with "SMA + Bollinger Bands", bands at the SMA +- the standard
 * deviation of the EMA times a multiplier, with a fill between them.
 *
 * Reference: "Heikin Line - TB365" by tradebot_365
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface HeikinLineTb365Inputs {
  /** EMA length */
  len: number;
  /** EMA source */
  src: SourceType;
  /** Plot offset of the EMA in bars */
  offset: number;
  /** Smoothing type */
  maType: MaType;
  /** Smoothing length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: HeikinLineTb365Inputs = {
  len: 9,
  src: 'close',
  offset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'data_window' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', group: 'Smoothing', display: 'data_window',
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'data_window' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing',
    display: 'data_window', tooltip: "Only applies when 'SMA + Bollinger Bands' is selected. Determines the distance between the SMA and the bands." },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.blue, lineWidth: 1 },
  // display = enableMA ? display.all : display.none (result.visibility.enableMA)
  { id: 'plot1', title: 'EMA-based MA', color: color.yellow, lineWidth: 1, visible: 'enableMA' },
  // display = isBB ? display.all : display.none (result.visibility.isBB)
  { id: 'plot2', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
];

const BB_FILL = String(color.new(color.green, 90));

/** fill(bbUpperBand, bbLowerBand, isBB ? color.new(color.green, 90) : na), shown with isBB */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot2', plot2: 'plot3', color: BB_FILL, title: 'Bollinger Bands Background Fill', visible: 'isBB' },
];

export const metadata = {
  title: 'Moving Average Exponential',
  shortTitle: 'EMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { visibility: Record<string, boolean> };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface HeikinRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  ma: Ma | null;
  dev: WindowStdev | null;
  out: number[];
  /** The EMA points of the bars with a drawn bar (written by the bar where the point is drawn) */
  emaPlot: Point[];
  maLine: Point[];
  upper: Point[];
  lower: Point[];
}

function study(inputs: Partial<HeikinLineTb365Inputs>): BarStudy<HeikinRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const offset = cfg.offset;
  // var enableMA / isBB: constant from the inputs
  const enableMA = cfg.maType !== 'None';
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  const maStep = (): Ma | null => {
    if (!enableMA) return null;
    const len = cfg.maLength;
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(len);
      default: { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // out = ta.ema(src, len)
      const ema = taStep.ema(cfg.len);
      const ma = maStep();
      // smoothingStDev = isBB ? ta.stdev(out, maLengthInput) * bbMultInput : na
      const dev = isBB ? new WindowStdev(cfg.maLength) : null;
      const s: HeikinRun = {
        ema, ma, dev, out: [], emaPlot: [], maLine: [], upper: [], lower: [],
        steps: [ema, ...(ma ? [ma] : []), ...(dev ? [dev] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [s.out, s.maLine, s.upper, s.lower];
      return s;
    },
    bar(s, k, bars) {
      const b = bars[k];
      const out = s.ema.step(value(b));
      s.out[k] = out;
      const ma = s.ma ? s.ma.step(out, b.volume ?? NaN) : NaN;
      const sd = s.dev ? s.dev.step(out) * cfg.bbMult : NaN;
      s.maLine[k] = { time: b.time, value: ma, color: color.yellow };
      s.upper[k] = { time: b.time, value: ma + sd, color: color.green };
      s.lower[k] = { time: b.time, value: ma - sd, color: color.green };
      // plot(out, "EMA", color.blue, offset = offset): the value of bar i is drawn on bar i + offset (point i + offset
      // for a negative offset, written by bar i; point i for a positive one, written by bar i + offset)
      if (offset <= 0) {
        const j = k + offset;
        if (j >= 0) s.emaPlot[j] = { time: bars[j].time, value: out, color: color.blue };
      } else {
        const i = k - offset;
        if (i >= 0) s.emaPlot[i] = { time: b.time, value: s.out[i], color: color.blue };
      }
    },
    result(s, bars) {
      const n = bars.length;
      let emaPlot: Point[];
      if (offset <= 0) {
        emaPlot = s.emaPlot.slice(0, Math.max(0, n + offset));
      } else {
        // the points drawn after the last bar: future bar times
        const first = Math.max(0, n - offset);
        emaPlot = s.emaPlot.slice(0, first);
        if (first < n) {
          const interval = barInterval(bars);
          for (let i = first; i < n; i++) emaPlot.push({ time: barTime(bars, i + offset, interval), value: s.out[i], color: color.blue });
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: emaPlot,
          plot1: s.maLine.slice(),
          plot2: s.upper.slice(),
          plot3: s.lower.slice(),
        },
        fills: [
          // fill(bbUpperBand, bbLowerBand, color = isBB ? color.new(color.green, 90) : na, display = isBB ? all : none)
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bollinger Bands Background Fill' },
            colors: new Array<string>(n).fill(isBB ? BB_FILL : 'transparent') },
        ],
        visibility: { enableMA, isBB },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HeikinLineTb365Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HeikinLineTb365Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HeikinLineTb365 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
