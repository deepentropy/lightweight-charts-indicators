/**
 * Shock Percentile Moving Average | NAL
 *
 * The percent rank of the one-bar change of the close over a lookback gates an EMA of the close: the line takes the
 * EMA value only on bars where the rank is above the gate, and holds its previous value on other bars. The state is
 * bullish when the line rises (and, with the slope gate, its percentage change over the slope lookback is above the
 * slope gate), bearish when it falls, and is kept otherwise. The line, the candles and the bars take the state colour.
 *
 * Reference: "Shock Percentile Moving Average | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ShockPercentileMovingAverageNalInputs {
  /** Colour set: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  /** EMA length */
  length: number;
  /** Number of bars used to rank the one-bar change */
  lookback: number;
  /** Minimum percent rank for the line to update */
  gate: number;
  /** Bullish state needs the slope above the slope gate */
  useSlope: boolean;
  /** Slope lookback (bars) */
  slopeLen: number;
  /** Slope gate (%) */
  slopeGate: number;
}

export const defaultInputs: ShockPercentileMovingAverageNalInputs = {
  colMode: 'Standard',
  length: 30,
  lookback: 30,
  gate: 50,
  useSlope: true,
  slopeLen: 9,
  slopeGate: 0.75,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'length', type: 'int', title: 'Baseline Length', defval: 30 },
  { id: 'lookback', type: 'int', title: 'Percentrank Lookback', defval: 30, min: 2 },
  { id: 'gate', type: 'int', title: '% Gate', defval: 50, min: 0, max: 99 },
  { id: 'useSlope', type: 'bool', title: 'Use Slope Gate?', defval: true },
  { id: 'slopeLen', type: 'int', title: 'Slope Lookback (bars)', defval: 9 },
  { id: 'slopeGate', type: 'float', title: '% Slope Gate', defval: 0.75, step: 0.1 },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Shock Percentile Moving Average', color: STANDARD_UP, lineWidth: 2 },
];

export const metadata = {
  title: 'Shock Percentile Moving Average | NAL',
  shortTitle: 'Shock Percentile MA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> };

interface ShockVars {
  /** NAL := ... nz(NAL[1], 0) */
  nal: number;
}

interface ShockRun extends BarRunState<ShockVars> {
  per: ReturnType<typeof taStep.percentrank>;
  ema: ReturnType<typeof taStep.ema>;
  spma: number[];
  plot0: Point[];
  candles: PlotCandleData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<ShockPercentileMovingAverageNalInputs>): BarStudy<ShockRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(0, 96, 175)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];
  return {
    init() {
      const s: ShockRun = {
        per: taStep.percentrank(cfg.lookback), ema: taStep.ema(cfg.length), spma: [], plot0: [], candles: [],
        barColors: [], vars: { nal: 0 }, steps: [], lists: [], series: [],
      };
      s.steps = [s.per, s.ema];
      s.series = [s.spma, s.plot0, s.candles, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const spma = s.spma;
      // f_SPMA: Ret = close - close[1]; Per = ta.percentrank(Ret, lookback); Gate = Per > gate; ta.ema(close, length)
      const ret = i > 0 ? b.close - bars[i - 1].close : NaN;
      const per = s.per.step(ret) ?? NaN;
      const ema = s.ema.step(b.close) ?? NaN;
      // MA := na(MA[1]) ? emaValue : Gate ? emaValue : MA[1]
      const prev = i > 0 ? spma[i - 1] : NaN;
      spma[i] = isNaN(prev) ? ema : gt(per, cfg.gate) ? ema : prev;

      const back = i >= cfg.slopeLen ? spma[i - cfg.slopeLen] : NaN;
      // SlopePer = (SPMA - SPMA[SlopeLen]) / SPMA[SlopeLen] * 100: a plain division
      const slopePer = ((spma[i] - back) / back) * 100;
      const slopeOk = cfg.useSlope ? gt(slopePer, cfg.slopeGate) : true;
      // NAL := SPMA > SPMA[1] and (UseSlope ? SlopeGate : true) ? 1 : SPMA < SPMA[1] ? -1 : nz(NAL[1], 0)
      const nal = gt(spma[i], prev) && slopeOk ? 1 : lt(spma[i], prev) ? -1 : s.vars.nal;
      s.vars.nal = nal;
      const col = nal === 1 ? colUp : nal === -1 ? colDn : colNu;
      // plotcandle(open, high, low, close, "Candles", col, col, bordercolor = col, display = display.pane,
      //            force_overlay = true)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: col, wickColor: col, borderColor: col, forceOverlay: true };
      // barcolor(col)
      s.barColors[i] = { time: b.time, color: col };
      // plot(SPMA, "Shock Percentile Moving Average", color = col, linewidth = 2)
      s.plot0[i] = { time: b.time, value: Number.isFinite(spma[i]) ? spma[i] : NaN, color: col };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        plotCandles: { candles: s.candles.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ShockPercentileMovingAverageNalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ShockPercentileMovingAverageNalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ShockPercentileMovingAverageNal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
