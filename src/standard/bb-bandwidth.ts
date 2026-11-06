/**
 * Bollinger BandWidth Indicator
 *
 * Measures the width of Bollinger Bands as a percentage of the basis.
 * BBW = ((Upper - Lower) / Basis) * 100
 * Useful for identifying squeezes (low values) and expansions (high values).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BBBandWidthInputs {
  /** Period length */
  length: number;
  /** Price source */
  src: SourceType;
  /** Standard deviation multiplier */
  mult: number;
  /** Highest expansion lookback length */
  expansionLength: number;
  /** Lowest contraction lookback length */
  contractionLength: number;
}

export const defaultInputs: BBBandWidthInputs = {
  length: 20,
  src: 'close',
  mult: 2,
  expansionLength: 125,
  contractionLength: 125,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1, tooltip: 'The time period to be used in calculating the SMA which creates the base for the Upper and Lower Bands' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', tooltip: 'Determines what data from each bar will be used in calculations.' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50, tooltip: 'The number of Standard Deviations away from the SMA that the Upper and Lower Bands should be.' },
  { id: 'expansionLength', type: 'int', title: 'Highest Expansion Length', defval: 125, min: 1, tooltip: 'The Highest Expansion plot displays the highest value that BBW had in the last N bars, where N is the length specified by this input.', display: 'none' },
  { id: 'contractionLength', type: 'int', title: 'Lowest Contraction Length', defval: 125, min: 1, tooltip: 'The Lowest Contraction plot displays the lowest value that BBW had in the last N bars, where N is the length specified by this input.', display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bollinger BandWidth', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Highest Expansion', color: '#F2364580', lineWidth: 1 },
  { id: 'plot2', title: 'Lowest Contraction', color: '#08998180', lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger BandWidth',
  shortTitle: 'BBW',
  overlay: false,
};

type Point = { time: number; value: number };

interface BbwRun extends BarRunState<Record<string, never>> {
  basis: WindowSma;
  dev: WindowStdev;
  high: WindowExtreme;
  low: WindowExtreme;
  bbwData: Point[];
  highData: Point[];
  lowData: Point[];
}

// Plots treat infinity as na
const plotValue = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? NaN : v);

function study(inputs: Partial<BBBandWidthInputs>): BarStudy<BbwRun, IndicatorResult> {
  const { length, src, mult, expansionLength, contractionLength } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const basis = new WindowSma(length);
      const dev = new WindowStdev(length);
      // ta.highest / ta.lowest: na on the first length - 1 bars
      const high = new WindowExtreme(false, expansionLength);
      const low = new WindowExtreme(true, contractionLength);
      const s: BbwRun = {
        basis, dev, high, low, bbwData: [], highData: [], lowData: [],
        steps: [basis, dev, high, low], vars: {}, lists: [], series: [],
      };
      s.series = [s.bbwData, s.highData, s.lowData];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const v = value(bars[i]);
      const b = s.basis.step(v);
      const d = s.dev.step(v) * mult;
      const u = b + d;
      const l = b - d;
      // BBW = ((upper - lower) / basis) * 100
      // Pine division: non-zero / 0 is +-infinity, 0 / 0 is na
      let bbw: number;
      if (u == null || l == null || b == null || isNaN(u) || isNaN(l) || isNaN(b)) {
        bbw = NaN;
      } else {
        const w = u - l;
        bbw = b === 0 ? (w === 0 ? NaN : (w > 0 ? Infinity : -Infinity)) : (w / b) * 100;
      }
      s.bbwData[i] = { time: t, value: plotValue(bbw) };
      s.highData[i] = { time: t, value: plotValue(s.high.step(bbw)) };
      s.lowData[i] = { time: t, value: plotValue(s.low.step(bbw)) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.bbwData.slice(),
          'plot1': s.highData.slice(),
          'plot2': s.lowData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBBandWidthInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BBBandWidthInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BBBandWidth = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
