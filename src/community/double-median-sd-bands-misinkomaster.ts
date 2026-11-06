/**
 * Double Median SD Bands
 *
 * Bands of the source +- standard deviation (over `length` bars, biased or not) * multiplier, smoothed twice by a
 * median: first over round(length / 2) bars, then over round(sqrt(length)) bars. The source crossing over the upper
 * band starts an up trend (purple), crossing under the lower band starts a down trend (amber); before the first
 * signal the lines are white. The area between the bands has the trend colour.
 *
 * Reference: "Double Median SD Bands | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DoubleMedianSdBandsInputs {
  /** Length of the standard deviation */
  len: number;
  /** Band multiplier */
  mul: number;
  /** Source */
  src: SourceType;
  /** Biased (population) standard deviation; false: sample */
  bias: boolean;
}

export const defaultInputs: DoubleMedianSdBandsInputs = {
  len: 27,
  mul: 1.4,
  src: 'ohlc4',
  bias: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 27, min: 2, step: 1, group: 'DMSDB | MisinkoMaster' },
  { id: 'mul', type: 'float', title: 'Band Multiplier', defval: 1.4, min: 0, step: 0.01, group: 'DMSDB | MisinkoMaster' },
  { id: 'src', type: 'source', title: 'src', defval: 'ohlc4', group: 'DMSDB | MisinkoMaster' },
  { id: 'bias', type: 'bool', title: 'Use Biased SD?', defval: true, group: 'DMSDB | MisinkoMaster' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'Lower Band', color: color.white, lineWidth: 2 },
];

export const metadata = {
  title: 'Double Median SD Bands | MisinkoMaster',
  shortTitle: 'DMSDB | MisinkoMaster',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface DmsdbRun extends BarRunState<{ col: string; colT: string }> {
  sd: { step(v: number): number; commit(): void };
  mu: ReturnType<typeof taStep.median>;
  ml: ReturnType<typeof taStep.median>;
  dmu: ReturnType<typeof taStep.median>;
  dml: ReturnType<typeof taStep.median>;
  lx: ReturnType<typeof taStep.crossover>;
  sx: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

function study(inputs: Partial<DoubleMedianSdBandsInputs>): BarStudy<DmsdbRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  // hlen = math.abs(math.round(len / 2)); sqrtlen = math.abs(math.round(math.sqrt(len)))
  const hlen = Math.abs(Math.round(cfg.len / 2));
  const sqrtlen = Math.abs(Math.round(Math.sqrt(cfg.len)));

  const upLine = String(color.rgb(143, 0, 209));
  const upFill = String(color.rgb(143, 0, 209, 60));
  const downLine = String(color.rgb(255, 191, 0));
  const downFill = String(color.rgb(255, 191, 0, 60));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      let sd: DmsdbRun['sd'];
      if (cfg.bias) {
        sd = new WindowStdev(cfg.len);
      } else {
        const m = taStep.stdev();
        sd = { step: (v) => m.step(v, cfg.len, false), commit: () => m.commit() };
      }
      const mu = taStep.median(hlen);
      const ml = taStep.median(hlen);
      const dmu = taStep.median(sqrtlen);
      const dml = taStep.median(sqrtlen);
      const lx = taStep.crossover();
      const sx = taStep.crossunder();
      const s: DmsdbRun = {
        sd, mu, ml, dmu, dml, lx, sx, plot0: [], plot1: [], fillColors: [],
        // var col = color.white; var colT = color.white
        steps: [sd, mu, ml, dmu, dml, lx, sx], vars: { col: color.white, colT: color.white }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const sd = s.sd.step(src);
      const sdbu = src + sd * cfg.mul;
      const sdbl = src - sd * cfg.mul;
      const dmsdbu = s.dmu.step(s.mu.step(sdbu));
      const dmsdbl = s.dml.step(s.ml.step(sdbl));

      // L = ta.crossover(src, dmsdbu); S = ta.crossunder(src, dmsdbl) (exact comparisons)
      const l = s.lx.step(src, dmsdbu);
      const sh = s.sx.step(src, dmsdbl);
      const v = s.vars;
      if (l && !sh) {
        v.col = upLine;
        v.colT = upFill;
      }
      if (sh) {
        v.col = downLine;
        v.colT = downFill;
      }
      s.plot0[i] = { time: b.time, value: dmsdbu, color: v.col };
      s.plot1[i] = { time: b.time, value: dmsdbl, color: v.col };
      s.fillColors[i] = v.colT;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DoubleMedianSdBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DoubleMedianSdBandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DoubleMedianSdBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
