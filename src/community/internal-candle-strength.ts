/**
 * Internal Candle Strength [LuxAlgo]
 *
 * Each chart bar is cut into rows of "Row Size" (Auto: 0.1 x ATR(200) rounded to the tick, at least one row). For each
 * row the lower-timeframe bars ("Timeframe", default 1 minute) whose range crosses the row give the strength
 * 50 x (sum of (close - open)) / (sum of |close - open|) + 50 (0 to 100 %): a box with the strength as its text (red
 * to teal gradient) and a line at the bottom of each row, plus a line at the top of the bar. The chart candles are
 * drawn again as wicks from the open to the close (teal up, red down). A table shows the row size in use and the
 * optimal (auto) row size. At most 500 lines and 500 boxes are kept.
 *
 * The lower-timeframe bars come from the chart context (`requiredSymbols`, `bars` accessor); without them the port
 * throws a MissingSymbolDataError. A timeframe equal to the chart timeframe uses the chart bars; a timeframe above
 * the chart timeframe throws.
 *
 * Reference: "Internal Candle Strength [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, math, timeframe, array, line, box, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe } from '../anchor-period';
import { mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';

export interface InternalCandleStrengthInputs {
  /** Lower timeframe of the intrabars */
  timeframeInput: string;
  /** Row size (price) when Auto is off */
  sizeInput: number;
  /** Auto row size: 0.1 x ATR(200) */
  autoInput: boolean;
}

export const defaultInputs: InternalCandleStrengthInputs = {
  timeframeInput: '1',
  sizeInput: 20,
  autoInput: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'timeframeInput', type: 'timeframe', title: 'Timeframe', defval: '1' },
  { id: 'sizeInput', type: 'float', title: 'Row Size', defval: 20, inline: 'size' },
  { id: 'autoInput', type: 'bool', title: 'Auto', defval: true, inline: 'size' },
];

// No plot(): candles (plotcandle), boxes, lines and a table
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [{ id: 'candle0', title: 'PlotCandle' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box', 'table'];

export const metadata = {
  title: 'Internal Candle Strength [LuxAlgo]',
  shortTitle: 'LuxAlgo - Internal Candle Strength',
  overlay: true,
};

const RED = '#F23645';
const TEAL = '#089981';
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

function lowerTimeframeRequested(ltf: string, chartTf: string): boolean {
  return ltf !== '' && timeframe.in_seconds(ltf) !== timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on "Timeframe" (none when it is the chart timeframe). */
export function requiredSymbols(inputs: Partial<InternalCandleStrengthInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = chartTimeframe([], chart);
  if (tf === '' || !lowerTimeframeRequested(cfg.timeframeInput, tf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.timeframeInput }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InternalCandleStrengthInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const ms = chart?.timeUnit === 'ms' || (n > 0 && bars[0].time >= 1e12);

  // request.security_lower_tf(syminfo.tickerid, timeframeInput, [open, high, low, close])
  const chartTf = chartTimeframe(bars, chart) || '1D';
  const ltf = cfg.timeframeInput;
  if (ltf !== '' && timeframe.in_seconds(ltf) > timeframe.in_seconds(chartTf)) {
    throw new Error(`Internal Candle Strength: the timeframe "${ltf}" is above the chart timeframe "${chartTf}"`);
  }
  let ltfBars: Bar[] = bars;
  let ranges: Array<[number, number]> = bars.map((_b, i) => [i, i + 1]);
  if (n > 0 && lowerTimeframeRequested(ltf, chartTf)) {
    [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: ltf }], chart);
    ranges = securityLowerTf(bars, ltfBars, ltf, otherSymbolChart(bars, chart),
      { other: { timezone: chart?.timezone, session: chart?.session } });
  }

  const atr = ta.atr(bars, 200).toArray().map((v) => v ?? NaN);
  const boxBg = String(color.new('#5d606b', 80));
  const tableText = String(color.new('#FFFFFF', 50));

  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS });
  // var table t_able = table.new(position.bottom_right, 2, 2, ...)
  const tAble = table.new('bottom_right', 2, 2, '#1e222d', '#373a46', 1, '#373a46', 1);

  const candles: PlotCandleData[] = [];
  let parsedSize = NaN;
  let volatility = NaN;
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    volatility = math.round_to_mintick(0.1 * atr[i], mintick) as number;
    parsedSize = cfg.autoInput ? volatility : cfg.sizeInput;
    const rows = (b.high - b.low) / parsedSize;
    // math.round of an infinite quotient (row size 0 on the first bars of a symbol with a coarse tick) is na in
    // Pine: no rows on that bar, as with an na row size
    const idx = Number.isFinite(rows) ? Math.max(Math.round(rows), 1) : NaN;
    const [from, to] = ranges[i];

    let min = b.low;
    let max = b.low;
    let css = 'transparent';
    // for i = 0 to idx - 1 (no loop when idx is na)
    for (let r = 0; r <= idx - 1; r++) {
      max += (b.high - b.low) / idx;
      const num = array.new_float();
      const den = array.new_float();
      for (let k = from; k < to; k++) {
        const ib = ltfBars[k];
        if (gt(ib.high, min) && lt(ib.low, max)) {
          const diff = ib.close - ib.open;
          array.push(num, diff);
          array.push(den, Math.abs(diff));
        }
      }
      const strength = 50 * (array.sum(num) / array.sum(den)) + 50;
      css = Number.isFinite(strength) ? String(color.from_gradient(strength, 0, 100, RED, TEAL)) : 'transparent';
      box.new(i, max, i + 1, min, 'transparent', 1, 'solid', 'none', 'bar_index', boxBg,
        str.tostring(strength, 'percent'), 'auto', css);
      line.new(i, min, i + 1, min, 'bar_index', 'none', css);
      min = max;
    }
    line.new(i, min, i + 1, min, 'bar_index', 'none', css);

    candles.push({
      time: b.time, open: b.open, high: Math.max(b.close, b.open), low: Math.min(b.close, b.open), close: b.open,
      color: '#00000000', borderColor: '#00000000', wickColor: gt(b.close, b.open) ? TEAL : RED,
    });
  }

  if (n > 0) {
    table.cell(tAble, 0, 0, 'Current Row Size', undefined, undefined, tableText, undefined, undefined, 'auto');
    table.cell(tAble, 0, 1, 'Optimal Row Size', undefined, undefined, tableText, undefined, undefined, 'auto');
    table.cell(tAble, 1, 0, str.tostring(parsedSize), undefined, undefined, tableText, undefined, undefined, 'auto');
    table.cell(tAble, 1, 1, str.tostring(volatility), undefined, undefined, tableText, undefined, undefined, 'auto');
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

export const InternalCandleStrength = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, drawingKinds, requiredSymbols,
};
