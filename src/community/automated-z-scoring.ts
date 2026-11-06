/**
 * Automated Z-scoring
 *
 * Z-score of the source over `length` bars: (src - sma(src, length)) / stdev(src, length). The line is blue above
 * zero and purple otherwise; a gradient fill from the line (line colour) to zero (transparent) follows it.
 *
 * Reference: "Automated Z-scoring - [JTCAPITAL]" by JTCapitalNL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JTCapitalNL
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AutomatedZScoringInputs {
  /** Length of the mean and standard deviation */
  length: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: AutomatedZScoringInputs = {
  length: 3000,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 3000 },
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
];

const BULL = color.rgb(49, 132, 228);
const BEAR = color.rgb(132, 3, 158);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: BULL, lineWidth: 3 },
  { id: 'plot1', title: 'Zero', color: BULL, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Automated Z-scoring - [JTCAPITAL]',
  shortTitle: 'Automated Z-scoring - [JTCAPITAL]',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color: string };

interface ZRun extends BarRunState<Record<string, never>> {
  stdev: WindowStdev;
  sma: WindowSma;
  zValue: number[];
  lineColor: string[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<AutomatedZScoringInputs>): BarStudy<ZRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.src);
  const value = (z: number) => (Number.isFinite(z) ? z : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const stdev = new WindowStdev(cfg.length);
      const sma = new WindowSma(cfg.length);
      const s: ZRun = {
        stdev, sma, zValue: [], lineColor: [], plot0: [], plot1: [],
        steps: [stdev, sma], vars: {}, lists: [], series: [],
      };
      s.series = [s.zValue, s.lineColor, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = source(b);
      const stdev = s.stdev.step(v);
      const mean = s.sma.step(v);
      // zscore = (src - mean) / stdev: a plain division (x / 0 is +-infinity, used by the comparison)
      const zscore = (v - mean) / stdev;
      const lineColor = gt(zscore, 0) ? BULL : BEAR;
      s.zValue[i] = value(zscore);
      s.lineColor[i] = lineColor;
      // plot1 = plot(zscore, color = lineColor, linewidth = 3)
      s.plot0[i] = { time: b.time, value: value(zscore), color: lineColor };
      // plot12 = plot(0, color = lineColor, display = display.none)
      s.plot1[i] = { time: b.time, value: 0, color: lineColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [
          // fill(plot1, plot12, top_value = zscore, bottom_value = 0, top_color = lineColor,
          //      bottom_color = color.new(color.black, 100))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Z-Score Fill' },
            gradient: {
              topValue: s.zValue.slice(),
              bottomValue: new Array<number>(n).fill(0),
              topColor: s.lineColor.slice(),
              bottomColor: new Array<string | null>(n).fill(String(color.new(color.black, 100))),
            } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutomatedZScoringInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutomatedZScoringInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AutomatedZScoring = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
