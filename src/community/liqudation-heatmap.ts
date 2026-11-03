/**
 * Liquidation HeatMap [BigBeluga]
 *
 * Liquidity zones at the swing points of the last 500 bars. A pivot high or low with 2 bars on each side
 * (ta.pivothigh(2, 2) / ta.pivotlow(2, 2)) gives a box on the bar where it is found and on the 2 bars after: above
 * the high of the bar 2 bars back (from that high to high + ATR) for a pivot high, below the low (from low - ATR to
 * the low) for a pivot low, where ATR = (ATR(200) * k) of 2 bars back, k = 0.2 on 60-minute and higher minute
 * charts, 0.25 on other minute charts, 0.2 on daily charts, 0.4 else. The box colour is a heat colour of the volume of
 * 2 bars back against the volumes of the last 500 bars (transparent to "Min" up to their average, then "Min" to
 * "Max" up to their maximum; the candle size * 100 replaces the volume while the total volume is 1 or less). Every
 * bar extends the boxes of the list to itself; a bar whose range crosses the middle of a box takes it out of the
 * list (it stays on the chart where it ended). A table on the right shows the colour scale with the maximum volume.
 *
 * As the original, the list starts with 500 empty entries and a removal inside the `for ... in` loop skips the
 * next box of the list.
 *
 * Chart values read: the chart timeframe (ATR factor) and the chart foreground colour (scale texts; dark theme
 * #DBDBDB without a context).
 *
 * Reference: "Liquidation HeatMap [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, str, color, array, timeframe, Series, box, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';

export interface LiqudationHeatmapInputs {
  maxCol: string;
  minCol: string;
}

export const defaultInputs: LiqudationHeatmapInputs = {
  maxCol: '#FFEB3B',
  minCol: '#00E676',
};

export const inputConfig: InputConfig[] = [
  { id: 'maxCol', type: 'color', title: 'Max', defval: '#FFEB3B', inline: 'L', group: 'Liquidation Color' },
  { id: 'minCol', type: 'color', title: 'Min', defval: '#00E676', inline: 'L', group: 'Liquidation Color' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'table'];

export const metadata = {
  title: 'Liquidation HeatMap [BigBeluga]',
  shortTitle: 'Liquidation HeatMap [BigBeluga]',
  overlay: true,
};

/** bars_amount of the script */
const BARS_AMOUNT = 500;
const NA_COLOR = 'transparent';

/** Pine float comparisons (within 1e-10; na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<LiqudationHeatmapInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const fg = foregroundColorOf(chart);
  const minCol90 = String(color.new(cfg.minCol, 90));
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  resetDrawings({ box: 500 });
  if (n === 0) return base;

  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);
  const A = (s: Series) => s.toArray().map(num);
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const ph = A(ta.pivothigh(highS, 2, 2));
  const pl = A(ta.pivotlow(lowS, 2, 2));
  const atr200 = A(ta.atr(bars, 200));
  // atr_multi = timeframe.multiplier >= 60 ? 0.2 : timeframe.isminutes ? 0.25 : timeframe.isdaily ? 0.2 : 0.4
  const tf = chartTimeframe(bars, chart);
  const info = tf ? timeframe.info(tf) : null;
  const atrMulti = info === null ? 0.4 : info.multiplier >= 60 ? 0.2 : info.isminutes ? 0.25 : info.isdaily ? 0.2 : 0.4;

  // volume_data(): var array of 500 na values; push the bar volume (candle size * 100 while ta.cum(volume) <= 1),
  // shift when above 500
  const vol = array.new_float(BARS_AMOUNT);
  const volData: number[] = new Array(n);
  let cum = 0;
  // var array<box> liquid_zones = array.new<box>(500): 500 na entries
  const zones: (Box | null)[] = new Array(BARS_AMOUNT).fill(null);
  const lastIndex = n - 1;
  const at = (v: number[], i: number) => (i >= 0 ? v[i] : NaN);

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const v = num(b.volume);
    cum = Number.isNaN(v) ? cum : cum + v;
    volData[i] = le(cum, 1) ? (b.high - b.low) * 100 : v;
    array.push(vol, volData[i]);
    if (array.size(vol) > BARS_AMOUNT) array.shift(vol);

    if (lastIndex - i < BARS_AMOUNT) {
      setDrawingBar(i, i === lastIndex);
      const atr = at(atr200, i - 2) * atrMulti;
      const volValue = at(volData, i - 2);
      const avg = num(array.avg(vol));
      const liquidityCol = le(volValue, avg)
        ? String(color.from_gradient(volValue, 0, avg, null as unknown as string, minCol90))
        : String(color.from_gradient(volValue, avg, num(array.max(vol)), minCol90, cfg.maxCol));

      if (!Number.isNaN(ph[i]) || !Number.isNaN(at(ph, i - 1)) || !Number.isNaN(at(ph, i - 2))) {
        const h2 = bars[i - 2].high;
        zones.push(box.new(i - 2, h2 + atr, i, h2, NA_COLOR, undefined, undefined, undefined, undefined, liquidityCol));
      }
      if (!Number.isNaN(pl[i]) || !Number.isNaN(at(pl, i - 1)) || !Number.isNaN(at(pl, i - 2))) {
        const l2 = bars[i - 2].low;
        zones.push(box.new(i - 2, l2, i, l2 - atr, NA_COLOR, undefined, undefined, undefined, undefined, liquidityCol));
      }

      // for box_id in liquid_zones: a removal shifts the list, so the next box is skipped
      for (let k = 0; k < zones.length; k++) {
        const z = zones[k];
        if (z === null) continue; // na box: the setter does nothing and the middle is na
        box.set_right(z, i);
        const mid = (box.get_bottom(z) + box.get_top(z)) / 2;
        if (gt(b.high, mid) && lt(b.low, mid)) {
          box.set_right(z, i);
          zones.splice(zones.indexOf(z), 1);
        }
      }
    }
  }

  // draw_scale(0, vol.max()) on the last bar
  const max = num(array.max(vol));
  const scale = table.new('middle_right', 1, 100);
  for (let k = 0; k <= 22; k++) {
    const text = k === 0 ? `${str.tostring(max, 'volume')}\n\nMAX` : k === 22 ? `MIN\n\n${str.tostring(0, 'volume')}` : '';
    const bg = k === 0 || k === 22 ? NA_COLOR : String(color.from_gradient(22 - k, 0, 22, minCol90, cfg.maxCol));
    table.cell(scale, 0, k, text, undefined, undefined, fg, undefined, undefined, 'small', bg);
  }
  setDrawingBar(null);

  return { ...base, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const LiqudationHeatmap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
