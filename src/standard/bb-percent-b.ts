/**
 * Bollinger Bands %B Indicator
 *
 * Shows where price is relative to the Bollinger Bands.
 * %B = (Price - Lower Band) / (Upper Band - Lower Band)
 * Values above 1 = price above upper band, below 0 = price below lower band
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BBPercentBInputs {
  /** Period length */
  length: number;
  /** Price source */
  src: SourceType;
  /** Standard deviation multiplier */
  mult: number;
}

export const defaultInputs: BBPercentBInputs = {
  length: 20,
  src: 'close',
  mult: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1, tooltip: 'The time period to be used in calculating the SMA which creates the base for the Upper and Lower Bands' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', tooltip: 'Determines what data from each bar will be used in calculations.' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50, tooltip: 'The number of Standard Deviations away from the SMA that the Upper and Lower Bands should be.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bollinger Bands %b', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_top',   price: 100, color: 'transparent', linestyle: 'solid', title: '' },
  { id: 'hline_upper', price: 1, color: '#F2364580', linestyle: 'dashed', title: 'Overbought' },
  { id: 'hline_mid',   price: 0.5, color: '#2962FF80', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 0, color: '#08998180', linestyle: 'dashed', title: 'Oversold' },
  { id: 'hline_bottom', price: -100, color: 'transparent', linestyle: 'solid', title: '' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_ob', plot1: 'hline_top', plot2: 'hline_upper', color: '#F2364519' },
  { id: 'fill_mid', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF19' },
  { id: 'fill_os', plot1: 'hline_lower', plot2: 'hline_bottom', color: '#08998119' },
];

export const metadata = {
  title: 'Bollinger Bands %b',
  shortTitle: 'BB %b',
  overlay: false,
};

interface BbpRun extends BarRunState<Record<string, never>> {
  basis: WindowSma;
  dev: WindowStdev;
  plotData: { time: number; value: number }[];
}

function study(inputs: Partial<BBPercentBInputs>): BarStudy<BbpRun, IndicatorResult> {
  const { length, src, mult } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const basis = new WindowSma(length);
      const dev = new WindowStdev(length);
      const s: BbpRun = { basis, dev, plotData: [], steps: [basis, dev], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const basis = s.basis.step(v);
      const dev = s.dev.step(v) * mult;
      const u = basis + dev;
      const l = basis - dev;

      // %B = (src - lower) / (upper - lower)
      s.plotData[i] = { time: b.time as number, value: u === l ? NaN : (v - l) / (u - l) };
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
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBPercentBInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BBPercentBInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BBPercentB = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
