/**
 * Pring Special K|a2m
 *
 * Martin Pring's Special K: a weighted sum of twelve SMAs of rates of change of the source (ROC 10 / 15 / 50 / 65 /
 * 75 / 100 / 130 / 195 bars, SMA 10 to 530 bars, weights 1 to 4). The line is green at or above 0, red below.
 * An optional smoothing MA (SMA / EMA / RMA / WMA / VWMA) of the line, or an SMA with Bollinger Bands (hidden band
 * lines with a fill), and a dotted zero line.
 *
 * Reference: "Pring Special K|a2m" by ask2maniish
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type SmoothingType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface PringSpecialKA2mInputs {
  src: SourceType;
  /** Smoothing type */
  maType: SmoothingType;
  /** Smoothing length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: PringSpecialKA2mInputs = {
  src: 'close',
  maType: 'SMA',
  maLength: 20,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', group: 'Smoothing',
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 20, group: 'Smoothing' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PSK', color: '#0ebb23', lineWidth: 2 },
  { id: 'plot1', title: 'Smoothing MA', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'Upper Band', color: color.green, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Band', color: color.green, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Pring Special K|a2m',
  shortTitle: 'Pring Special K|a2m',
  overlay: false,
};

/** Pine float comparison a >= b: false when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/** (ROC length, SMA length, weight) of the twelve terms, in the Pine order */
const TERMS: ReadonlyArray<[number, number, number]> = [
  [10, 10, 1], [10, 15, 2], [10, 20, 3], [15, 30, 4],
  [50, 40, 1], [65, 65, 2], [75, 75, 3], [100, 100, 4],
  [130, 195, 1], [130, 265, 2], [130, 390, 3], [195, 530, 4],
];

type Point = { time: number; value: number; color: string };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface PskRun extends BarRunState<Record<string, never>> {
  /** ta.roc(src, r) of each distinct length (the same values for the terms with the same length) */
  rocs: ReturnType<typeof taStep.roc>[];
  smas: WindowSma[];
  ma: Ma | null;
  dev: WindowStdev | null;
  plots: Point[][];
}

const ROC_LENGTHS = [...new Set(TERMS.map(([r]) => r))];
const ROC_OF_TERM = TERMS.map(([r]) => ROC_LENGTHS.indexOf(r));

function study(inputs: Partial<PringSpecialKA2mInputs>): BarStudy<PskRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // Smoothing (the MA type is a constant input: the switch runs one branch on every bar)
  const enableMA = cfg.maType !== 'None';
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  const maStep = (): Ma | null => {
    const len = cfg.maLength;
    switch (cfg.maType) {
      case 'None': return null;
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return taStep.vwma(len);
      default: { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const rocValues = new Array<number>(ROC_LENGTHS.length);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: PskRun = {
        rocs: ROC_LENGTHS.map((r) => taStep.roc(r)), smas: TERMS.map(([, len]) => new WindowSma(len)),
        ma: enableMA ? maStep() : null, dev: isBB ? new WindowStdev(cfg.maLength) : null,
        plots: Array.from({ length: 4 }, () => []), steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.rocs, ...s.smas, ...(s.ma ? [s.ma] : []), ...(s.dev ? [s.dev] : [])];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = value(b);
      for (let k = 0; k < s.rocs.length; k++) rocValues[k] = s.rocs[k].step(v);
      // psk = sma(roc(src, 10), 10) + sma(roc(src, 10), 15) * 2 + ... (left to right: the first term has no weight)
      let psk = NaN;
      for (let k = 0; k < TERMS.length; k++) {
        const w = TERMS[k][2];
        const x = s.smas[k].step(rocValues[ROC_OF_TERM[k]]);
        const term = w === 1 ? x : x * w;
        psk = k === 0 ? term : psk + term;
      }
      const smoothingMA = s.ma ? s.ma.step(psk, b.volume ?? NaN) : NaN;
      const smoothingStDev = s.dev ? s.dev.step(psk) * cfg.bbMult : NaN;
      const p = s.plots;
      // pskColor = psk >= 0 ? #0ebb23 : #ff0000
      p[0][i] = { time, value: fin(psk), color: ge(psk, 0) ? '#0ebb23' : '#ff0000' };
      p[1][i] = { time, value: fin(smoothingMA), color: color.blue };
      p[2][i] = { time, value: isBB ? fin(smoothingMA + smoothingStDev) : NaN, color: color.green };
      p[3][i] = { time, value: isBB ? fin(smoothingMA - smoothingStDev) : NaN, color: color.green };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      // fill(bbUpperBand, bbLowerBand, color.new(color.green, 90), "BB Fill", display = isBB ? display.all : display.none)
      // The fill is always declared (Style settings); without the bands (display.none) it draws nothing
      const fills = [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'BB Fill' },
        colors: new Array<string>(n).fill(isBB ? String(color.new(color.green, 90)) : 'transparent') }];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        hlines: [{ value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dotted' } }],
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PringSpecialKA2mInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PringSpecialKA2mInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PringSpecialKA2m = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
