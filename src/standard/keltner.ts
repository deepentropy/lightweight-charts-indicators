/**
 * Keltner Channels (KC) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Volatility-based envelope set above and below an exponential moving average.
 * Uses ATR (Average True Range) to set channel distance.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * Keltner Channels indicator input parameters
 */
export interface KeltnerInputs {
  /** EMA period length */
  length: number;
  /** ATR multiplier */
  mult: number;
  /** Price source */
  src: SourceType;
  /** Use exponential MA (true) or simple MA (false) */
  useEMA: boolean;
  /** Bands style: ATR, True Range, or Range */
  bandsStyle: 'Average True Range' | 'True Range' | 'Range';
  /** ATR period length */
  atrLength: number;
}

/**
 * Default input values matching the standard indicator defaults
 */
export const defaultInputs: KeltnerInputs = {
  length: 20,
  mult: 2,
  src: 'close',
  useEMA: true,
  bandsStyle: 'Average True Range',
  atrLength: 10,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'useEMA', type: 'bool', title: 'Use Exponential MA', defval: true, display: 'none' },
  { id: 'bandsStyle', type: 'string', title: 'Bands Style', defval: 'Average True Range', options: ['Average True Range', 'True Range', 'Range'], display: 'none' },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 10, display: 'none' },
];

/**
 * Plot configuration - order matches CSV: Upper, Basis, Lower
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Basis', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Keltner Channels',
  shortTitle: 'KC',
  overlay: true,
};

/**
 * Calculate Keltner Channels indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<KeltnerInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

type Point = { time: any; value: number };
type Avg = { step(v: number): number; commit(): void };
type Range = { step(b: Bar): number; commit(): void };

interface KeltnerRun extends BarRunState<Record<string, never>> {
  basis: Avg;
  range: Range;
  upperData: Point[];
  basisData: Point[];
  lowerData: Point[];
}

function study(inputs: Partial<KeltnerInputs>): BarStudy<KeltnerRun, IndicatorResult> {
  const { length, mult, src, useEMA, bandsStyle, atrLength } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // Calculate basis (moving average)
      const basis: Avg = useEMA ? taStep.ema(length) : new WindowSma(length);
      // Calculate range based on bands style
      let range: Range;
      switch (bandsStyle) {
        case 'True Range': {
          const m = taStep.tr(true); // True Range without averaging
          range = { step: (b) => m.step(b.high, b.low, b.close), commit: () => m.commit() };
          break;
        }
        case 'Range': {
          const m = taStep.rma(length); // RMA of high-low range
          range = { step: (b) => m.step(b.high - b.low), commit: () => m.commit() };
          break;
        }
        case 'Average True Range':
        default: {
          const m = taStep.atr(atrLength);
          range = { step: (b) => m.step(b.high, b.low, b.close), commit: () => m.commit() };
          break;
        }
      }
      const s: KeltnerRun = {
        basis, range, upperData: [], basisData: [], lowerData: [], steps: [basis, range], vars: {}, lists: [], series: [],
      };
      s.series = [s.upperData, s.basisData, s.lowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const basis = s.basis.step(value(b));
      const rangema = s.range.step(b);
      // Calculate upper and lower bands
      const upper = basis + rangema * mult;
      const lower = basis - rangema * mult;
      // Plot format - order: Upper, Basis, Lower (matching CSV)
      s.upperData[i] = { time: b.time, value: upper ?? NaN };
      s.basisData[i] = { time: b.time, value: basis ?? NaN };
      s.lowerData[i] = { time: b.time, value: lower ?? NaN };
    },
    result(s) {
      const fills: FillData[] = [
        { plot1: 'plot0', plot2: 'plot2', options: { color: '#2196F3', transp: 95, title: 'Background' } },
      ];
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.upperData.slice(),
          'plot1': s.basisData.slice(),
          'plot2': s.lowerData.slice(),
        },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KeltnerInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Keltner Channels indicator module
 */
export const KeltnerChannels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
