/**
 * Dynamic Trend Bands
 *
 * Base line: a double Hull moving average of close, HMA(HMA(close, length - 10), length). The upper and lower bands
 * are the base +/- ATR(100) * distance. The lower band is drawn only while it is not below its value `size` bars
 * ago (rising or flat), as two lines (current value and value `size` bars ago) with a fill between them and a
 * middle line; the upper band is drawn only while it is not above its value `size` bars ago (falling or flat).
 * Optional orange bar colours mark a high above a falling upper band or a low below a rising lower band.
 * The Pine input "Source" is not used by the Pine calculation (the double HMA uses close), as in Pine.
 *
 * Reference: "Dynamic Trend Bands [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicTrendBandsInputs {
  /** Double HMA length (the inner HMA uses length - 10) */
  length: number;
  /** Pine input "Source": not used by the Pine calculation */
  src: SourceType;
  /** ATR(100) multiplier of the band distance */
  multi: number;
  /** Band size: bars back for the band comparison and the second band line */
  bandSize: number;
  colUp: string;
  colMid: string;
  colDn: string;
  /** Momentum shift bar colours */
  barsCol: boolean;
  /** Fill between the band lines */
  fill: boolean;
}

export const defaultInputs: DynamicTrendBandsInputs = {
  length: 40,
  src: 'close',
  multi: 2.0,
  bandSize: 2,
  colUp: '#20bfaf',
  colMid: '#aeaeae',
  colDn: '#c12176',
  barsCol: false,
  fill: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 40, min: 11 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'multi', type: 'float', title: 'Distance', defval: 2.0, step: 0.1 },
  { id: 'bandSize', type: 'int', title: 'Size', defval: 2, min: 2, max: 8 },
  { id: 'colUp', type: 'color', title: 'Up Color', defval: '#20bfaf' },
  { id: 'colMid', type: 'color', title: 'Middle Color', defval: '#aeaeae' },
  { id: 'colDn', type: 'color', title: 'Down Color', defval: '#c12176' },
  { id: 'barsCol', type: 'bool', title: 'Momentum Shift', defval: false },
  { id: 'fill', type: 'bool', title: 'Fill Color', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Double HMA', color: '#aeaeae', lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band 1', color: '#20bfaf', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Lower Band 2', color: '#20bfaf', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Upper Band 1', color: '#c12176', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Upper Band 2', color: '#c12176', lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Upper Bands Middle line', color: '#c12176', lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Lower Bands Middle line', color: '#20bfaf', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Dynamic Trend Bands [ChartPrime]',
  shortTitle: 'Dynamic Trend Bands',
  overlay: true,
};

/** Pine a >= b: false only when b - a > 1e-10 (float comparison tolerance); false when a value is na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
/** Pine a <= b */
const le = (a: number, b: number) => ge(b, a);
/** Pine a > b: true only when a - b > 1e-10 */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface DtbRun extends BarRunState<Record<string, never>> {
  hma1: ReturnType<typeof taStep.hma>;
  hma2: ReturnType<typeof taStep.hma>;
  atr: ReturnType<typeof taStep.atr>;
  upper: number[];
  lower: number[];
  lowerBand: number[];
  lowerBand1: number[];
  upperBand: number[];
  upperBand1: number[];
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<DynamicTrendBandsInputs>): BarStudy<DtbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bs = cfg.bandSize;
  const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);
  // middle lines: upper_band1[band_size - int(band_size / 2)], lower_band1[...]
  const mid = bs - Math.trunc(bs / 2);
  return {
    init() {
      // base = ta.hma(ta.hma(close, length - 10), length)
      const hma1 = taStep.hma(cfg.length - 10);
      const hma2 = taStep.hma(cfg.length);
      // dist = ta.atr(100) * multi
      const atr = taStep.atr(100);
      const s: DtbRun = {
        hma1, hma2, atr, upper: [], lower: [], lowerBand: [], lowerBand1: [], upperBand: [], upperBand1: [],
        plots: [[], [], [], [], [], [], []], barColors: [], steps: [hma1, hma2, atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.upper, s.lower, s.lowerBand, s.lowerBand1, s.upperBand, s.upperBand1, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const base = s.hma2.step(s.hma1.step(b.close));
      const atr = s.atr.step(b.high, b.low, b.close);
      const upper = base + atr * cfg.multi;
      const lower = base - atr * cfg.multi;
      s.upper[i] = upper;
      s.lower[i] = lower;

      // lower_band = lower >= lower[band_size] ? lower[band_size] : na; lower_band1 = ... ? lower : na
      // upper_band = upper <= upper[band_size] ? upper[band_size] : na; upper_band1 = ... ? upper : na
      const lb = at(s.lower, i - bs);
      const lowOk = ge(lower, lb);
      const lowerBand = lowOk ? lb : NaN;
      const lowerBand1 = lowOk ? lower : NaN;
      const ub = at(s.upper, i - bs);
      const upOk = le(upper, ub);
      const upperBand = upOk ? ub : NaN;
      const upperBand1 = upOk ? upper : NaN;
      s.lowerBand[i] = lowerBand;
      s.lowerBand1[i] = lowerBand1;
      s.upperBand[i] = upperBand;
      s.upperBand1[i] = upperBand1;

      const time = b.time;
      const p = s.plots;
      p[0][i] = { time, value: base, color: cfg.colMid };
      p[1][i] = { time, value: lowerBand1, color: cfg.colUp };
      p[2][i] = { time, value: lowerBand, color: cfg.colUp };
      p[3][i] = { time, value: upperBand, color: cfg.colDn };
      p[4][i] = { time, value: upperBand1, color: cfg.colDn };
      p[5][i] = { time, value: at(s.upperBand1, i - mid), color: cfg.colDn };
      p[6][i] = { time, value: at(s.lowerBand1, i - mid), color: cfg.colUp };

      // switch: upper_band1 <= upper_band1[2] and high > upper_band => color.orange
      //         lower_band >= lower_band[2] and low < lower_band => color.orange; default #ff980000
      let c = '#ff980000';
      if (le(upperBand1, at(s.upperBand1, i - 2)) && gt(b.high, upperBand)) c = color.orange;
      else if (ge(lowerBand, at(s.lowerBand, i - 2)) && gt(lowerBand, b.low)) c = color.orange;
      // barcolor(color, display = bars_col ? display.all : display.none)
      if (cfg.barsCol) s.barColors.push({ time, color: c });
    },
    result(s, bars) {
      const n = bars.length;
      const colUp1 = String(color.new(cfg.colUp, 50));
      const colDn1 = String(color.new(cfg.colDn, 50));
      const p = s.plots;
      let fills: NonNullable<IndicatorResult['fills']> = [];
      if (cfg.fill) {
        const upFill = new Array<string | null>(n).fill(colUp1);
        const dnFill = new Array<string | null>(n).fill(colDn1);
        // fill(pl1, pl, lower_band1, lower_band, col_up1, col_up1); fill(ph1, ph, upper_band, upper_band1, col_dn1, col_dn1)
        // display = filll ? display.all : display.none
        fills = [
          { plot1: 'plot2', plot2: 'plot1', gradient: { topValue: s.lowerBand1.slice(), bottomValue: s.lowerBand.slice(), topColor: upFill, bottomColor: upFill } },
          { plot1: 'plot4', plot2: 'plot3', gradient: { topValue: s.upperBand.slice(), bottomValue: s.upperBand1.slice(), topColor: dnFill, bottomColor: dnFill } },
        ];
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
          plot6: p[6].slice(),
        },
        fills,
        markers: [],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicTrendBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicTrendBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicTrendBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
