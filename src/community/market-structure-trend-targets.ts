/**
 * Market Structure Trend Targets [ChartPrime]
 *
 * Pivot highs and lows (Length bars on each side) give the last swing levels, each marked with a line. When the high
 * crosses above the last swing high, the trend turns up: the level line is drawn up to that bar and a label in the
 * middle of it shows the entry price of the first break ("4.4 △"), then the number of the next breaks in the same
 * direction (or their change in percent from the first one with "Display %"). A cross of the low under the last
 * swing low does the same downwards. A trailing stop follows the trend: the SMA(10) of the 40-bar median of the close
 * minus (up trend) or plus (down trend) the mean of the highest and lowest SMA(50) of twice the bar range over 200
 * bars; it is cut (na) on a trend change and on bars where the price is on the wrong side of it. "△" / "▽" labels mark
 * the trend changes and "◈" labels the bars where the price touches the stop again. The stop is filled with a
 * gradient towards hl2 and the candles take the trend colour.
 *
 * Chart values (optional third argument of calculate): the label text colour (chart foreground colour).
 *
 * Reference: "Market Structure Trend Targets [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import {
  ta, str, color, callsite, Series, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface MarketStructureTrendTargetsInputs {
  /** Bars on each side of a pivot */
  length: number;
  /** Show the change of each break from the first one in percent */
  display_per: boolean;
  /** Show the trailing stop, its fill and the "◈" labels */
  display_stop: boolean;
  col_up: string;
  col_dn: string;
}

export const defaultInputs: MarketStructureTrendTargetsInputs = {
  length: 10,
  display_per: false,
  display_stop: true,
  col_up: '#54b6d4',
  col_dn: '#cf3737',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 2, max: 30 },
  { id: 'display_per', type: 'bool', title: 'Display %', defval: false },
  { id: 'display_stop', type: 'bool', title: 'Display Trailing Stop', defval: true },
  { id: 'col_up', type: 'color', title: '+', defval: '#54b6d4', inline: 'col' },
  { id: 'col_dn', type: 'color', title: '-', defval: '#cf3737', inline: 'col' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: '#2962ff', lineWidth: 1, style: 'linebr', visible: 'display_stop' },
  { id: 'plot1', title: 'Plot', color: '#2962ff', lineWidth: 5, style: 'linebr', visible: 'display_stop' },
  { id: 'plot2', title: 'Plot', color: 'rgba(0,0,0,0)', lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [{ id: 'fill0', plot1: 'plot0', plot2: 'plot2', title: 'Plots Background' }];

export const plotCandleConfig = [{ id: 'candles', title: 'Candles Trend' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Market Structure Trend Targets [ChartPrime]',
  shortTitle: 'Market Structure TT [ChartPrime]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureTrendTargetsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { display_per, display_stop, col_up, col_dn } = cfg;
  const length = Math.trunc(cfg.length);
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (values: number[]) => Series.fromArray(bars, values);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const fg = foregroundColorOf(chart);

  const ph = A(ta.pivothigh(S(high), length, length));
  const pl = A(ta.pivotlow(S(low), length, length));

  // market_structure(): called once per bar, so its `var` variables and ta calls are those of the script
  const source = A(ta.sma(S(bars.map((b) => b.high - b.low)), 50)).map((v) => v * 2);
  const source1 = A(ta.sma(ta.median(S(bars.map((b) => b.close)), 40), 10));
  const hiSrc = A(ta.highest(S(source), 200));
  const loSrc = A(ta.lowest(S(source), 200));
  const volatility = hiSrc.map((v, i) => (v + loSrc[i]) / 2);

  resetDrawings({ line: 500, label: 500 });
  let upper = NaN;
  let lower = NaN;
  let upperCount = 0;
  let lowerCount = 0;
  let upperIndex = 0;
  let lowerIndex = 0;
  let trend: boolean | null = null; // var trend = bool(na)
  let lineH: Line | null = null;
  let lineL: Line | null = null;
  let priceEnterUp = 0; // var price_enter = 0. (one per block)
  let priceEnterDn = 0;
  const crossUpper = callsite.crossover();
  const crossLower = callsite.crossunder();

  const trendLine = new Array<number>(n).fill(NaN);
  const trendArr: (boolean | null)[] = new Array(n).fill(null);
  const colours = new Array<string>(n);

  // first pass: the bar-by-bar state (labels need the trend line crossings, computed on the whole series below)
  const touchUp = new Array<boolean>(n).fill(false);
  const touchDn = new Array<boolean>(n).fill(false);
  const lowCross = callsite.crossover();
  const highCross = callsite.crossunder();

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (!isNaN(ph[i])) {
      upperIndex = i - length;
      upper = high[i - length];
      lineH = line.new(upperIndex, upper, upperIndex, upper, 'bar_index', 'none', col_up);
    }
    if (!isNaN(pl[i])) {
      lowerIndex = i - length;
      lower = low[i - length];
      lineL = line.new(lowerIndex, lower, lowerIndex, lower, 'bar_index', 'none', col_dn);
    }

    if (crossUpper(high[i], upper)) {
      upperCount += 1;
      // int index = bar_index - (bar_index - upper_index) / 2: a float division, the label x is the truncated value
      const index = Math.trunc(i - (i - upperIndex) / 2);
      const y1 = lineH ? line.get_y1(lineH) : NaN;
      if (upperCount === 1) priceEnterUp = y1;
      const percent = (y1 - priceEnterUp) / priceEnterUp * 100;
      const txt = upperCount === 1
        ? str.tostring(priceEnterUp, '#.# △')
        : (display_per ? str.tostring(percent, 'percent') : str.tostring(upperCount - 1));
      label.new(index, y1, txt, 'bar_index', 'price', 'transparent', 'label_down', fg);
      if (lineH) line.set_x2(lineH, i);
      lineH = null;
      upper = NaN;
      lowerCount = 0;
      trend = true;
    }

    if (crossLower(low[i], lower)) {
      lowerCount += 1;
      const index = Math.trunc(i - (i - lowerIndex) / 2);
      const y1 = lineL ? line.get_y1(lineL) : NaN;
      if (lowerCount === 1) priceEnterDn = y1;
      const percent = (y1 - priceEnterDn) / priceEnterDn * 100;
      const txt = lowerCount === 1
        ? str.tostring(priceEnterDn, '#.# ▽')
        : (display_per ? str.tostring(percent, 'percent') : str.tostring(lowerCount - 1));
      label.new(index, y1, txt, 'bar_index', 'price', 'transparent', 'label_up', fg);
      if (lineL) line.set_x2(lineL, i);
      lineL = null;
      lower = NaN;
      upperCount = 0;
      trend = false;
    }

    // an na trend is false in a condition
    const tl = trend === true ? source1[i] - volatility[i] : source1[i] + volatility[i];
    trendLine[i] = tl;
    trendArr[i] = trend;
    const col = trend === true ? col_up : col_dn;
    colours[i] = col;
    const isUp = trend === true;
    const wasUp = i > 0 && trendArr[i - 1] === true;

    // v5 `and` is not lazy: both crossings run on every bar
    const lc = lowCross(low[i], tl);
    const hc = highCross(high[i], tl);
    // if trend and ta.crossover(low, trend_line) and display_stop and not (trend and not trend[1])
    touchUp[i] = isUp && lc && display_stop && !(isUp && !wasUp);
    // if not trend and ta.crossunder(high, trend_line) and display_stop and not (trend[1] and not trend)
    touchDn[i] = !isUp && hc && display_stop && !(wasUp && !isUp);
    if (touchUp[i] && i > 0) {
      label.new(i - 1, low[i - 1], '◈', 'bar_index', 'price', 'transparent', 'label_up', col);
    }
    if (touchDn[i] && i > 0) {
      label.new(i - 1, high[i - 1], '◈', 'bar_index', 'price', 'transparent', 'label_down', col);
    }
    if (isUp && !wasUp) {
      label.new(i, tl, '△', 'bar_index', 'price', 'transparent', 'label_center', col, 'large');
    }
    if (!isUp && wasUp) {
      label.new(i, tl, '▽', 'bar_index', 'price', 'transparent', 'label_center', col, 'large');
    }
  }
  setDrawingBar(null);

  // stop_loss := ta.change(trend) ? na : high > stop_loss and not trend ? na : low < stop_loss and trend ? na : stop_loss
  const stop = trendLine.map((tl, i) => {
    const t = trendArr[i] === true;
    const changed = i > 0 && (trendArr[i] ?? false) !== (trendArr[i - 1] ?? false);
    if (changed) return NaN;
    if (gt(high[i], tl) && !t) return NaN;
    if (lt(low[i], tl) && t) return NaN;
    return tl;
  });

  const fade = display_stop ? 90 : 100;
  const pts = (values: number[], cols: (i: number) => string) =>
    values.map((v, i) => ({ time: bars[i].time, value: Number.isFinite(v) ? v : NaN, color: cols(i) }));
  const hl2 = bars.map((b) => (b.high + b.low) / 2);

  const fills: FillData[] = [{
    id: 'fill0', plot1: 'plot0', plot2: 'plot2', options: { title: 'Plots Background' },
    gradient: {
      topValue: stop,
      bottomValue: hl2,
      topColor: colours.map((c) => String(color.new(c, fade))),
      bottomColor: new Array(n).fill(null),
    },
  }];

  const candles: PlotCandleData[] = bars.map((b, i) => {
    const c = String(color.new(colours[i], 50));
    return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: pts(stop, (i) => colours[i]),
      plot1: pts(stop, (i) => String(color.new(colours[i], 80))),
      plot2: pts(hl2, () => 'transparent'),
    },
    fills,
    plotCandles: { candles },
    ...drawingOutputs(bars),
  };
}

export const MarketStructureTrendTargets = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  plotCandleConfig,
  drawingKinds,
};
