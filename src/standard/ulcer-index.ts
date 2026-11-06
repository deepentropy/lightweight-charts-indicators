/**
 * Ulcer Index (UI)
 *
 * Volatility/risk measure that only considers downside movement. It is the
 * square root of the mean of squared percentage drawdowns from the highest
 * source over the lookback window.
 *
 *   drawdown_i = 100 * (src - highest(src, length)) / highest(src, length)
 *   UI        = sqrt( sma(drawdown^2, length) )
 *
 * Based on the standard "Ulcer Index" indicator.
 */

import type { IndicatorResult, InputConfig, PlotConfig, HLineConfig, Bar, SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UlcerIndexInputs {
  /** Source */
  src: SourceType;
  /** Lookback length */
  length: number;
}

export const defaultInputs: UlcerIndexInputs = {
  src: 'close',
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ulcer Index', color: '#2962FF', lineWidth: 1 },
  // Reference: a hidden zero plot, the other side of the "Plots Background" fill
  { id: 'plot1', title: '', color: '#2962FF', lineWidth: 1, display: 'none', editable: false },
];

/** Reference: the "Zero" level (grey, dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: '#808080', linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'Ulcer Index',
  shortTitle: 'UI',
  overlay: false,
};

type Point = { time: number; value: number };

interface UlcerRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  meanSq: WindowSma;
  plotData: Point[];
  zero: Point[];
}

function study(inputs: Partial<UlcerIndexInputs>): BarStudy<UlcerRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const highest = new WindowExtreme(false, length);
      const meanSq = new WindowSma(length);
      const s: UlcerRun = { highest, meanSq, plotData: [], zero: [], steps: [highest, meanSq], vars: {}, lists: [], series: [] };
      s.series = [s.plotData, s.zero];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = value(bars[i]);
      const hi = s.highest.step(v);
      // Squared percentage drawdown from the running highest close.
      let drawdownSq = NaN;
      if (hi !== 0) {
        const dd = (100 * (v - hi)) / hi;
        drawdownSq = dd * dd;
      }
      const meanSq = s.meanSq.step(drawdownSq);
      s.plotData[i] = { time, value: !isNaN(meanSq) ? Math.sqrt(meanSq) : NaN };
      s.zero[i] = { time, value: 0 };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData.slice(),
          'plot1': s.zero.slice(),
        },
        // Reference: fill between the index and the zero plot
        fills: [{ id: 'fill_0', plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(33,150,243,0.1)', title: 'Plots Background' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UlcerIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UlcerIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const UlcerIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
