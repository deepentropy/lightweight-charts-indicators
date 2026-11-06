/**
 * Pivot Breakout with Trend Zones
 *
 * The last pivot high (left / right bars) and the last pivot low are drawn as crosses, shifted by the line offset.
 * The first close above the last pivot high (once per pivot) is a breakout up: a white candle, and the trend turns
 * up. The first close below the last pivot low is a breakout down: a black candle, and the trend turns down. The
 * other candles are teal in an uptrend and red in a downtrend (red before the first breakout). Candles have no wick
 * and no border colour.
 *
 * Reference: "Pivot Breakout with Trend Zones" by dreamaker7
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©author dreamaker7
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData, PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface PivotBreakoutWithTrendZonesInputs {
  /** Left bars of the pivot high */
  leftLenH: number;
  /** Right bars of the pivot high */
  rightLenH: number;
  /** Left bars of the pivot low */
  leftLenL: number;
  /** Right bars of the pivot low */
  rightLenL: number;
  /** Colour the candles (breakouts and trend zones) */
  showColorFill: boolean;
  /** Offset of the pivot lines (bars, <= 0) */
  lineOffset: number;
}

export const defaultInputs: PivotBreakoutWithTrendZonesInputs = {
  leftLenH: 9,
  rightLenH: 9,
  leftLenL: 9,
  rightLenL: 9,
  showColorFill: true,
  lineOffset: -9,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftLenH', type: 'int', title: 'Left Bars (High)', defval: 9 },
  { id: 'rightLenH', type: 'int', title: 'Right Bars (High)', defval: 9 },
  { id: 'leftLenL', type: 'int', title: 'Left Bars (Low)', defval: 9 },
  { id: 'rightLenL', type: 'int', title: 'Right Bars (Low)', defval: 9 },
  { id: 'showColorFill', type: 'bool', title: 'Enable Candle Color Fill', defval: true,
    tooltip: 'Enable pivot breakout candles and trend zone coloring' },
  { id: 'lineOffset', type: 'int', title: 'Line Offset', defval: -9, min: -50, max: 0 },
];

const HIGH_COL = 'rgba(206, 130, 130, 0.5)'; // color.rgb(206, 130, 130, 50)
const LOW_COL = '#557b9bcc';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot High', color: HIGH_COL, lineWidth: 1, style: 'cross' },
  { id: 'plot1', title: 'Pivot Low', color: LOW_COL, lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Pivot Breakout with Trend Zones',
  shortTitle: 'Pivot Breakout with Trend Zones',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface PivotBreakoutVars {
  /** var float trailHigh = na, var float trailLow = na */
  trailHigh: number;
  trailLow: number;
  breachedHigh: boolean;
  breachedLow: boolean;
  inUptrend: boolean;
  /** var color candleColor = na */
  candleColor: string;
}

interface PivotBreakoutRun extends BarRunState<PivotBreakoutVars> {
  phStep: PivotStep;
  plStep: PivotStep;
  trailHighArr: number[];
  trailLowArr: number[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<PivotBreakoutWithTrendZonesInputs>): BarStudy<PivotBreakoutRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const defaultUpColor = '#26A69A';
  const defaultDownColor = '#EF5350';
  const breakoutHigh = color.white;
  const breakoutLow = color.black;
  return {
    init() {
      const phStep = new PivotStep(cfg.leftLenH, cfg.rightLenH, true);
      const plStep = new PivotStep(cfg.leftLenL, cfg.rightLenL, false);
      const s: PivotBreakoutRun = {
        phStep, plStep, trailHighArr: [], trailLowArr: [], candles: [],
        steps: [phStep, plStep],
        vars: { trailHigh: NaN, trailLow: NaN, breachedHigh: false, breachedLow: false, inUptrend: false, candleColor: 'transparent' },
        lists: [], series: [],
      };
      s.series = [s.trailHighArr, s.trailLowArr, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // ta.pivothigh(high, leftLenH, rightLenH), ta.pivotlow(low, leftLenL, rightLenL)
      const ph = s.phStep.step(i, b.high);
      const pl = s.plStep.step(i, b.low);
      if (!isNaN(ph)) v.trailHigh = ph;
      if (!isNaN(pl)) v.trailLow = pl;
      const trailHigh = v.trailHigh;
      const trailLow = v.trailLow;
      s.trailHighArr[i] = trailHigh;
      s.trailLowArr[i] = trailLow;

      // Reset the breakout status on a new pivot
      if (!isNaN(trailHigh) && eq(ph, trailHigh)) v.breachedHigh = false;
      if (!isNaN(trailLow) && eq(pl, trailLow)) v.breachedLow = false;

      const breakHigh = !isNaN(trailHigh) && gt(b.close, trailHigh) && !v.breachedHigh;
      const breakLow = !isNaN(trailLow) && lt(b.close, trailLow) && !v.breachedLow;
      if (breakHigh) {
        v.breachedHigh = true;
        v.inUptrend = true;
      }
      if (breakLow) {
        v.breachedLow = true;
        v.inUptrend = false;
      }

      if (cfg.showColorFill) {
        if (breakHigh) v.candleColor = breakoutHigh;
        else if (breakLow) v.candleColor = breakoutLow;
        else v.candleColor = v.inUptrend ? defaultUpColor : defaultDownColor;
      } else {
        v.candleColor = 'transparent';
      }
      // plotcandle(open, high, low, close, color = candleColor, wickcolor = na, bordercolor = na)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: v.candleColor,
        wickColor: 'transparent', borderColor: 'transparent' };
    },
    result(s, bars) {
      const n = bars.length;
      // plot(..., offset = lineOffset): the value of bar i is drawn on bar i + lineOffset
      const interval = barInterval(bars);
      const off = cfg.lineOffset;
      const shifted = (vals: number[], c: string): Point[] => {
        const out: Point[] = [];
        for (let i = 0; i < n; i++) {
          const j = i + off;
          if (j < 0) continue;
          out.push({ time: barTime(bars, j, interval), value: vals[i], color: c });
        }
        return out;
      };
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: shifted(s.trailHighArr, HIGH_COL),
          plot1: shifted(s.trailLowArr, LOW_COL),
        },
        markers: [],
        plotCandles: { plotcandle0: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotBreakoutWithTrendZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PivotBreakoutWithTrendZonesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PivotBreakoutWithTrendZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
