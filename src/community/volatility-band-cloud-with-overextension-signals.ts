/**
 * Volatility Band Cloud with Overextension Signals
 *
 * An SMA basis of the source with inner and outer bands at basis +- deviation * stdev over the same length. The
 * bands are filled as a cloud (extension zones between the inner and outer bands, neutral zones between the inner
 * bands and the basis). An "Upper" triangle above the bar marks a source crossover of the upper outer band, a
 * "Lower" triangle below the bar a source crossunder of the lower outer band.
 *
 * Reference: "Volatility Band Cloud with Overextension Signals" by Retire_by_50
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export interface VolatilityBandCloudWithOverextensionSignalsInputs {
  /** Basis length */
  length: number;
  source: SourceType;
  innerDeviation: number;
  outerDeviation: number;
  showCenterLine: boolean;
  showBandCloud: boolean;
  showMarkers: boolean;
}

export const defaultInputs: VolatilityBandCloudWithOverextensionSignalsInputs = {
  length: 100,
  source: 'close',
  innerDeviation: 1.0,
  outerDeviation: 2.5,
  showCenterLine: true,
  showBandCloud: true,
  showMarkers: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Basis Length', defval: 100, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'innerDeviation', type: 'float', title: 'Inner Band Deviation', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'outerDeviation', type: 'float', title: 'Outer Band Deviation', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'showCenterLine', type: 'bool', title: 'Show Center Line?', defval: true },
  { id: 'showBandCloud', type: 'bool', title: 'Show Volatility Cloud?', defval: true },
  { id: 'showMarkers', type: 'bool', title: 'Show Overextension Markers?', defval: true },
];

const UPPER_INNER_COL = String(color.rgb(255, 120, 120));
const LOWER_INNER_COL = String(color.rgb(90, 190, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Outer Band', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Inner Band', color: UPPER_INNER_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Center Line', color: color.blue, lineWidth: 2 },
  { id: 'plot3', title: 'Lower Inner Band', color: LOWER_INNER_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Lower Outer Band', color: color.lime, lineWidth: 2 },
];

export const metadata = {
  title: 'Volatility Band Cloud with Overextension Signals',
  shortTitle: 'VB Cloud Signals',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface VbcRun extends BarRunState<Record<string, never>> {
  basis: WindowSma;
  dev: WindowStdev;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<VolatilityBandCloudWithOverextensionSignalsInputs>): BarStudy<VbcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const basis = new WindowSma(cfg.length);
      const dev = new WindowStdev(cfg.length);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: VbcRun = {
        basis, dev, over, under, plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], markers: [],
        steps: [basis, dev, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const src = value(bars[i]);
      const basis = s.basis.step(src);
      const dev = s.dev.step(src);
      const upperOuter = basis + cfg.outerDeviation * dev;
      const upperInner = basis + cfg.innerDeviation * dev;
      const lowerInner = basis - cfg.innerDeviation * dev;
      const lowerOuter = basis - cfg.outerDeviation * dev;

      // ta.crossover(source, upperOuterBand) / ta.crossunder(source, lowerOuterBand)
      const upperTag = s.over.step(src, upperOuter);
      const lowerTag = s.under.step(src, lowerOuter);

      s.plot0[i] = { time, value: upperOuter, color: color.red };
      s.plot1[i] = { time, value: upperInner, color: UPPER_INNER_COL };
      s.plot2[i] = { time, value: cfg.showCenterLine ? basis : NaN, color: color.blue };
      s.plot3[i] = { time, value: lowerInner, color: LOWER_INNER_COL };
      s.plot4[i] = { time, value: lowerOuter, color: color.lime };

      if (!cfg.showMarkers) return;
      // plotshape(showMarkers and upperBandTag, 'Upper', shape.triangledown, location.abovebar, color.red, size.small)
      if (upperTag) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'Upper',
          textColor: color.red, size: 'small' });
      }
      // plotshape(showMarkers and lowerBandTag, 'Lower', shape.triangleup, location.belowbar, color.green, size.small)
      if (lowerTag) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, text: 'Lower',
          textColor: color.green, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      // fill(..., color = showBandCloud ? color.new(c, t) : na)
      const fillCol = (c: string, tr: number) => new Array<string>(n).fill(cfg.showBandCloud ? String(color.new(c, tr)) : 'transparent');
      const fills = [
        { plot1: 'plot0', plot2: 'plot1', options: { title: 'Upper Extension Zone' }, colors: fillCol(color.red, 88) },
        { plot1: 'plot1', plot2: 'plot2', options: { title: 'Upper Neutral Zone' }, colors: fillCol(color.red, 95) },
        { plot1: 'plot2', plot2: 'plot3', options: { title: 'Lower Neutral Zone' }, colors: fillCol(color.green, 95) },
        { plot1: 'plot3', plot2: 'plot4', options: { title: 'Lower Extension Zone' }, colors: fillCol(color.green, 88) },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: s.plot2.slice(),
          plot3: s.plot3.slice(),
          plot4: s.plot4.slice(),
        },
        fills,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityBandCloudWithOverextensionSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolatilityBandCloudWithOverextensionSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolatilityBandCloudWithOverextensionSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
