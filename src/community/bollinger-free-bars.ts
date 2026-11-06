/**
 * Bollinger Free Bars
 *
 * Bollinger Bands (SMA of the source +- stdev * multiplier). A bar whose open and close are both above the upper
 * band (below the lower band) gets a blue triangle above (below) the bar; a bar whose high and low are both above
 * the upper band (below the lower band) gets a red (green) flag above (below) the bar. The two bands are drawn.
 *
 * Reference: "Bollinger Free Bars" by pkuliyi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BollingerFreeBarsInputs {
  /** Period (周期) */
  length: number;
  /** Standard deviation multiplier (标准差倍数) */
  mult: number;
  /** Source (数据源) */
  src: SourceType;
}

export const defaultInputs: BollingerFreeBarsInputs = {
  length: 20,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: '周期', defval: 20 },
  { id: 'mult', type: 'float', title: '标准差倍数', defval: 2.0 },
  { id: 'src', type: 'source', title: '数据源', defval: 'close' },
];

const UPPER_COLOR = String(color.new('#2196F3', 70));
const LOWER_COLOR = String(color.new('#FF9800', 70));
const HALF_COLOR = String(color.new(color.blue, 0));
const UP_FLAG_COLOR = String(color.new(color.red, 0));
const DN_FLAG_COLOR = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: UPPER_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: LOWER_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger Free Bars',
  shortTitle: 'Bollinger Free Bars',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface BfbRun extends BarRunState<Record<string, never>> {
  basis: WindowSma;
  dev: WindowStdev;
  upperData: Point[];
  lowerData: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<BollingerFreeBarsInputs>): BarStudy<BfbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const basis = new WindowSma(cfg.length);
      const dev = new WindowStdev(cfg.length);
      const s: BfbRun = { basis, dev, upperData: [], lowerData: [], markers: [], steps: [basis, dev], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.upperData, s.lowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const basis = s.basis.step(v);
      const dev = s.dev.step(v);
      const u = basis + dev * cfg.mult;
      const l = basis - dev * cfg.mult;
      s.upperData[i] = { time: b.time, value: u, color: UPPER_COLOR };
      s.lowerData[i] = { time: b.time, value: l, color: LOWER_COLOR };
      // Plotshape order: Half Upper, Half Lower, Complete Upper, Complete Lower (all size.small)
      if (gt(b.open, u) && gt(b.close, u)) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: HALF_COLOR, size: 'small' });
      }
      if (lt(b.open, l) && lt(b.close, l)) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: HALF_COLOR, size: 'small' });
      }
      if (gt(b.high, u) && gt(b.low, u)) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'flag', color: UP_FLAG_COLOR, size: 'small' });
      }
      if (lt(b.high, l) && lt(b.low, l)) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'flag', color: DN_FLAG_COLOR, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.upperData.slice(), plot1: s.lowerData.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BollingerFreeBarsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BollingerFreeBarsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BollingerFreeBars = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
