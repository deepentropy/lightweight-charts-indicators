/**
 * KERPD Noise Filter
 *
 * Merges two noise measures over `length` bars, both scaled by 100: the Kaufman efficiency ratio
 * |close - close[length]| / sum(|close - close[1]|), and the inverted price density
 * (highest high - lowest low) / sum(high - low). The merge is their average. It is drawn aqua when it is at or
 * above the noise threshold (quiet) and blue when it is at or below it (loud), with a tape below zero (0 to -3)
 * filled in the same colours. Two area plots show a background noise baseline (efficiency * baseline) and a
 * buoyancy level ((100 - efficiency) * calibration).
 *
 * Reference: "KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density" by SensitiveSuit
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KERPDNoiseFilterInputs {
  /** Length of the efficiency ratio and of the price density */
  length: number;
  /** Noise threshold (%) */
  threshold: number;
  /** Background noise baseline (decimal %) */
  baseline: number;
  /** Background noise buoyancy calibration (decimal %) */
  calibration: number;
}

export const defaultInputs: KERPDNoiseFilterInputs = {
  length: 20,
  threshold: 35,
  baseline: 0.35,
  calibration: 0.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20 },
  { id: 'threshold', type: 'int', title: 'Noise Threshold %', defval: 35 },
  { id: 'baseline', type: 'float', title: 'Background Noise Baseline Decimal %', defval: 0.35, step: 0.025 },
  { id: 'calibration', type: 'float', title: 'Background Noise Bouyancy Calibration Decimal %', defval: 0.35 },
];

const AQUA = String(color.new(color.aqua, 0));
const AQUA_NONE = String(color.new(color.aqua, 100));
const BLUE = String(color.new(color.blue, 0));
const BLUE_NONE = String(color.new(color.blue, 100));
const BASELINE_COL = String(color.new(color.white, 50));
const BUOYANCY_COL = String(color.new(color.teal, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KERPD Noise Filter Quiet', color: AQUA, lineWidth: 2 },
  { id: 'plot1', title: 'KERPD Noise Filter Loud', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'KERPD Background Noise Baseline %', color: BASELINE_COL, lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'KERPD Background Noise Bouyancy %', color: BUOYANCY_COL, lineWidth: 1, style: 'area' },
  { id: 'plot4', title: 'KERPD Tape Top Line', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'KERPD Bottom Line', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'KERPD Noise Filter',
  shortTitle: 'KERPD Noise Filter',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

const close = (bars: Bar[], j: number) => (j >= 0 ? bars[j].close : NaN);
const high = (bars: Bar[], j: number) => (j >= 0 ? bars[j].high : NaN);
const low = (bars: Bar[], j: number) => (j >= 0 ? bars[j].low : NaN);

interface KerpdRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  plots: Point[][];
  fillColors: string[];
}

function study(inputs: Partial<KERPDNoiseFilterInputs>): BarStudy<KerpdRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, threshold, baseline, calibration } = cfg;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // denoPD = ta.highest(high, length) - ta.lowest(low, length)
      const hh = new WindowExtreme(false, length);
      const ll = new WindowExtreme(true, length);
      const s: KerpdRun = { hh, ll, plots: [[], [], [], [], [], []], fillColors: [], steps: [hh, ll], vars: {}, lists: [], series: [] };
      s.series = [...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const hh = s.hh.step(bar.high);
      const ll = s.ll.step(bar.low);
      // KER(close, length, false): er = math.abs(close - close[length]) / sum(math.abs(close[k] - close[k + 1]))
      const a = Math.abs(close(bars, i) - close(bars, i - length));
      let b = 0.0;
      for (let k = 0; k <= length - 1; k++) b = b + Math.abs(close(bars, i - k) - close(bars, i - k - 1));
      const er = a / b;
      // normresultkauf = (resultkauf - 0) / (100 - 0) * 100 * 100
      const normKer = ((er - 0) / (100 - 0)) * 100 * 100;
      // numerPD := numerPD + high[k] - low[k]
      let numerPD = 0.0;
      for (let k = 0; k <= length - 1; k++) numerPD = numerPD + high(bars, i - k) - low(bars, i - k);
      const densoPD = hh - ll;
      const resultPD = numerPD / densoPD;
      const invertedPD = 1 / resultPD;
      const normPD = ((invertedPD - 0) / (100 - 0)) * 100 * 100;
      const merge = (normKer + normPD) / 2;

      const time = bar.time;
      const p = s.plots;
      // plot(KERPDmerge, color = KERPDthreshold <= KERPDmerge ? color.new(color.aqua, 0) : color.new(color.aqua, 100))
      p[0][i] = { time, value: fin(merge), color: le(threshold, merge) ? AQUA : AQUA_NONE };
      // plot(KERPDmerge, color = KERPDthreshold >= KERPDmerge ? color.new(color.blue, 0) : color.new(color.blue, 100))
      p[1][i] = { time, value: fin(merge), color: ge(threshold, merge) ? BLUE : BLUE_NONE };
      // horzline = normresultkauf * KERPDdybaseline (style_area)
      p[2][i] = { time, value: fin(normKer * baseline), color: BASELINE_COL };
      // horzlinea = (100 - normresultkauf) * KERPDdycal (style_area)
      p[3][i] = { time, value: fin((100 - normKer) * calibration), color: BUOYANCY_COL };
      // KERPDtop = plot(0, display = display.none), KERPDbtm = plot(-3, display = display.none)
      p[4][i] = { time, value: 0 };
      p[5][i] = { time, value: -3 };
      // fill(KERPDtop, KERPDbtm, title = 'KERPD Tape', color = KERPDmerge >= KERPDthreshold ? aqua
      //   : KERPDmerge < KERPDthreshold ? blue : na)
      s.fillColors[i] = ge(merge, threshold) ? AQUA : lt(merge, threshold) ? BLUE : 'transparent';
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        fills: [{ plot1: 'plot4', plot2: 'plot5', colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KERPDNoiseFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KERPDNoiseFilterInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const KERPDNoiseFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
