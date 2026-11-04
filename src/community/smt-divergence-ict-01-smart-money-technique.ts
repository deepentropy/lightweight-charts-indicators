/**
 * SMT Divergence ICT 01 (Smart Money Technique)
 *
 * Divergence between the chart symbol and a second symbol at the swing points of the chart. A swing high / low is a
 * pivot of `n` bars on each side of the chart high / low; at each one the port keeps the chart price and the price of
 * the second symbol (its high / low on the same bar, `request.security(Sym, timeframe.period, ...)`), with the
 * last two swings of each side:
 * - top (bearish) divergence: the last two swing highs are less than 30 bars apart, the last one less than 30 bars
 *   ago, both prices of the second symbol above 0, and one symbol makes a higher high while the other makes a lower
 *   high;
 * - bottom (bullish) divergence: the same rule on the swing lows.
 * On every bar where a divergence holds, a black dashed line joins the two swings and a "+SMT" (green, label up) /
 * "-SMT" (red, label down) label marks the last swing, once in the indicator pane (prices of the second symbol) and
 * once on the price chart (chart prices, `force_overlay`). At most 500 lines and 500 labels are kept. The pane also
 * draws the candles of the second symbol (teal when close >= open, else red).
 *
 * The bars of the second symbol come from the chart context (`requiredSymbols`, `bars` accessor, with its calendar
 * from `symbolInfo`); without them the port throws a MissingSymbolDataError.
 *
 * Reference: "SMT Divergence ICT 01 [TradingFinder] Smart Money Technique" by TradingFinder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab
 */

import {
  ta, Series, label, line, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Label, type Line,
} from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe } from '../anchor-period';
import { symbolBarsOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { otherSymbolChart, securityOther } from '../other-symbol';

export interface SmtDivergenceIct01SmartMoneyTechniqueInputs {
  /** Second Symbol */
  sym: string;
  /** Divergence Fractal Periods */
  n: number;
  bullLine: boolean;
  bullLabel: boolean;
  bearLine: boolean;
  bearLabel: boolean;
}

export const defaultInputs: SmtDivergenceIct01SmartMoneyTechniqueInputs = {
  sym: 'XAUUSD',
  n: 2,
  bullLine: true,
  bullLabel: true,
  bearLine: true,
  bearLabel: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'sym', type: 'symbol', title: 'Second Symbol', defval: 'XAUUSD' },
  { id: 'n', type: 'int', title: 'Divergence Fractal Periods', defval: 2, min: 1, group: 'Logic Setting' },
  { id: 'bullLine', type: 'bool', title: 'Show SMT Divergence Line from the Bottom.', defval: true },
  { id: 'bullLabel', type: 'bool', title: 'Show SMT Divergence Label from the Bottom.', defval: true },
  { id: 'bearLine', type: 'bool', title: 'Show SMT Divergence Line from the Top.', defval: true },
  { id: 'bearLabel', type: 'bool', title: 'Show SMT Divergence Label from the Top.', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [{ id: 'candle0', title: 'PlotCandle' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'SMT Divergence ICT 01 [TradingFinder] Smart Money Technique',
  shortTitle: 'TFlab SMT',
  overlay: false,
};

const TEAL = '#089981';
const RED_CANDLE = '#f23645';
// color.black of Pine version 5
const BLACK = '#363A45';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const WHITE = '#FFFFFF';
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > 1e-10);

/** Bars of the second symbol on the chart timeframe (`timeframe.period`) */
export function requiredSymbols(
  inputs: Partial<SmtDivergenceIct01SmartMoneyTechniqueInputs> = {},
  chart?: ChartContext,
): SymbolRequest[] {
  const { sym } = { ...defaultInputs, ...inputs };
  return [{ symbol: sym, timeframe: chartTimeframe([], chart) }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SmtDivergenceIct01SmartMoneyTechniqueInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { n } = cfg;
  const len = bars.length;
  const ms = chart?.timeUnit === 'ms' || (len > 0 && bars[0].time >= 1e12);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const S = (a: number[]) => Series.fromArray(bars, a);

  // [Open, High, Low, Close] = request.security(Sym, timeframe.period, [open, high, low, close])
  const [other] = symbolBarsOf([{ symbol: cfg.sym, timeframe: chartTimeframe(bars, chart) }], chart);
  const idx = securityOther(bars, other, '', otherSymbolChart(bars, chart), { other: chart?.symbolInfo?.(cfg.sym) });
  const pick = (f: (b: Bar) => number) => idx.map((k) => (k >= 0 ? f(other[k]) : NaN));
  const oOpen = pick((b) => b.open);
  const oHigh = pick((b) => b.high);
  const oLow = pick((b) => b.low);
  const oClose = pick((b) => b.close);

  // UpPivot = bool(ta.pivothigh(n, n)), DownPivot = bool(ta.pivotlow(n, n)): na and 0 are false
  const ph = A(ta.pivothigh(S(bars.map((b) => b.high)), n, n));
  const pl = A(ta.pivotlow(S(bars.map((b) => b.low)), n, n));
  const up = ph.map((v) => (!Number.isNaN(v) && v !== 0 ? 1 : 0));
  const down = pl.map((v) => (!Number.isNaN(v) && v !== 0 ? 1 : 0));
  const back = (a: number[]) => a.map((_v, i) => (i - n >= 0 ? a[i - n] : NaN));
  const barIdx = back(bars.map((_b, i) => i));
  const vw = (cond: number[], src: number[], occ: number) => A(ta.valuewhen(S(cond), S(src), occ));

  const highLastPrice = vw(up, back(bars.map((b) => b.high)), 0);
  const highPerPrice = vw(up, back(bars.map((b) => b.high)), 1);
  const highLastHist = vw(up, back(oHigh), 0);
  const highPerHist = vw(up, back(oHigh), 1);
  const highLastBar = vw(up, barIdx, 0);
  const highPerBar = vw(up, barIdx, 1);
  const lowLastPrice = vw(down, back(bars.map((b) => b.low)), 0);
  const lowPerPrice = vw(down, back(bars.map((b) => b.low)), 1);
  const lowLastHist = vw(down, back(oLow), 0);
  const lowPerHist = vw(down, back(oLow), 1);
  const lowLastBar = vw(down, barIdx, 0);
  const lowPerBar = vw(down, barIdx, 1);

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });
  // var line / label of the Drawing() function
  const beLine = varDrawing<Line>();
  const buLine = varDrawing<Line>();
  const beLabel = varDrawing<Label>();
  const buLabel = varDrawing<Label>();
  const beLineOnChart = varDrawing<Line>();
  const buLineOnChart = varDrawing<Line>();
  const beLabelOnChart = varDrawing<Label>();
  const buLabelOnChart = varDrawing<Label>();

  const candles: PlotCandleData[] = [];
  for (let i = 0; i < len; i++) {
    setDrawingBar(i, i === len - 1);
    // Bearish divergence
    const hlb = highLastBar[i];
    const hpb = highPerBar[i];
    const timeConditionBear = hlb + 30 > i;
    let lastBearish = false;
    if (gt(highLastHist[i], 0) && gt(highPerHist[i], 0) && timeConditionBear && hlb - hpb < 30) {
      lastBearish = (gt(highLastPrice[i], highPerPrice[i]) && lt(highLastHist[i], highPerHist[i]))
        || (lt(highLastPrice[i], highPerPrice[i]) && gt(highLastHist[i], highPerHist[i]));
    }
    // Bullish divergence
    const llb = lowLastBar[i];
    const lpb = lowPerBar[i];
    const timeConditionBull = llb + 30 > i;
    let lastBullish = false;
    if (gt(lowLastHist[i], 0) && gt(lowPerHist[i], 0) && timeConditionBull && llb - lpb < 30) {
      lastBullish = (lt(lowLastPrice[i], lowPerPrice[i]) && gt(lowLastHist[i], lowPerHist[i]))
        || (gt(lowLastPrice[i], lowPerPrice[i]) && lt(lowLastHist[i], lowPerHist[i]));
    }

    // Drawing(Bull_Line, Bear_Line, Bull_Label, Bear_Label)
    if (lastBullish) {
      if (cfg.bullLine) {
        buLine.value = line.new(lpb, lowPerHist[i], llb, lowLastHist[i], 'bar_index', 'none', BLACK, 'dashed', 1);
        buLineOnChart.value = line.new(lpb, bars[lpb].low, llb, bars[llb].low, 'bar_index', 'none', BLACK, 'dashed', 1, true);
      }
      if (cfg.bullLabel) {
        buLabel.value = label.new(llb, lowLastHist[i], '+SMT', 'bar_index', 'price', GREEN, 'label_up', WHITE, 'tiny');
        buLabelOnChart.value = label.new(llb, bars[llb].low, '+SMT', 'bar_index', 'price', GREEN, 'label_up', WHITE, 'tiny',
          undefined, undefined, undefined, true);
      }
    }
    if (lastBearish) {
      if (cfg.bearLine) {
        beLine.value = line.new(hpb, highPerHist[i], hlb, highLastHist[i], 'bar_index', 'none', BLACK, 'dashed', 1);
        beLineOnChart.value = line.new(hpb, bars[hpb].high, hlb, bars[hlb].high, 'bar_index', 'none', BLACK, 'dashed', 1, true);
      }
      if (cfg.bearLabel) {
        beLabel.value = label.new(hlb, highLastHist[i], '-SMT', 'bar_index', 'price', RED, 'label_down', WHITE, 'tiny');
        beLabelOnChart.value = label.new(hlb, bars[hlb].high, '-SMT', 'bar_index', 'price', RED, 'label_down', WHITE, 'tiny',
          undefined, undefined, undefined, true);
      }
    }

    // plotcandle(Open, High, Low, Close, color = Close >= Open ? #089981 : #f23645, wickcolor, bordercolor)
    const c = ge(oClose[i], oOpen[i]) ? TEAL : RED_CANDLE;
    candles.push({
      time: bars[i].time, open: oOpen[i], high: oHigh[i], low: oLow[i], close: oClose[i],
      color: c, wickColor: c, borderColor: c,
    });
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars, ms ? 'ms' : 's');
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candle0: candles },
    ...drawn,
  };
}

export const SmtDivergenceIct01SmartMoneyTechnique = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, drawingKinds, requiredSymbols,
};
