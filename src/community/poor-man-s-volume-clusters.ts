/**
 * Poor man's volume clusters
 *
 * The bars are cut into blocks of `Bars in profile block` bars (bar_index / block size). Each block is split into 15
 * price rows between its high and its low. A bar adds its volume, divided by the number of rows its range touches
 * and by the row height, to every row it touches; the rows are summed over the block. The row with the most volume
 * is the volume point of control (VPoC). The widest row of each block is averaged with an EMA of `Profile maximum
 * high pass filter size in bars` bars, and a row is drawn `floor(visual row width x row volume / average)` bars wide
 * (at most 28 bars).
 *
 * History blocks are drawn with plots shifted 2 blocks to the left (offset = -2 x block size): the block high and
 * low, 15 rows of alternate blocks in purple ("History 1") and 15 rows of the other blocks in teal ("History 2"),
 * and the VPoC as an orange diamond. The last three blocks (the current one, while it has more than 5 bars, and the
 * two before it) are drawn on the last bar with lines placed by time: block high / low, the 15 rows, and a VPoC
 * label for the two newest blocks. The rows of these blocks end at the close time of a bar (`time_close`).
 *
 * "Use custom volume source": the volume of another symbol on the chart timeframe
 * (`security(symbol, timeframe.period, volume, lookahead_on)`); its bars come from the chart context
 * (`requiredSymbols`, `bars` accessor), else the port throws a MissingSymbolDataError. An empty symbol is the chart
 * symbol.
 *
 * Chart values (optional third argument of calculate): the chart timeframe and the exchange calendar (close time of
 * the bars), the other symbol's bars and calendar.
 *
 * Reference: "Poor man's volume clusters" by IldarAkhmetgaleev
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) Ildar Akhmetgaleev (AkhIL), see https://github.com/akhilman/vol-poorofile
 */

import {
  ta, callsite, Series, timeframe, periodClose, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import { symbolBarsOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe, hasCalendar } from '../anchor-period';
import { otherSymbolChart, securityOtherValues } from '../other-symbol';
import type { StudyDrawingKind } from '../style-outputs';

export interface PoorManSVolumeClustersInputs {
  /** Bars in profile block */
  blockSize: number;
  /** Visual row width */
  visualRowWidth: number;
  /** Show volume point of control */
  showVpoc: boolean;
  /** Profile maximum high pass filter size in bars */
  filterSize: number;
  /** Use custom volume source */
  useCustomVolumeSource: boolean;
  /** Custom volume source symbol */
  volumeSourceSymbol: string;
}

export const defaultInputs: PoorManSVolumeClustersInputs = {
  blockSize: 15,
  visualRowWidth: 10.0,
  showVpoc: true,
  filterSize: 200,
  useCustomVolumeSource: false,
  volumeSourceSymbol: '',
};

export const inputConfig: InputConfig[] = [
  { id: 'blockSize', type: 'int', title: 'Bars in profile block', defval: 15, min: 10, max: 166 },
  { id: 'visualRowWidth', type: 'float', title: 'Visual row width', defval: 10.0, min: 10 },
  { id: 'showVpoc', type: 'bool', title: 'Show volume point of control', defval: true },
  { id: 'filterSize', type: 'int', title: 'Profile maximum high pass filter size in bars', defval: 200 },
  { id: 'useCustomVolumeSource', type: 'bool', title: 'Use custom volume source', defval: false },
  { id: 'volumeSourceSymbol', type: 'symbol', title: 'Custom volume source symbol', defval: '' },
];

/** v4 colour constants */
const BOUNDARY_COLOR = '#2196F3';
const PROFILE1_COLOR = '#9C27B0';
const PROFILE2_COLOR = '#00897B';
const VPOC_COLOR = '#FF9800';
/** v4 default label text colour */
const LABEL_TEXT = '#363A45';

const ROWS = 15;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'History block high', color: BOUNDARY_COLOR, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'History block low', color: BOUNDARY_COLOR, lineWidth: 1, style: 'linebr' },
  ...Array.from({ length: ROWS }, (_, r): PlotConfig => ({
    id: `plot${2 + r}`, title: `History 1 row ${r}`, color: PROFILE1_COLOR, lineWidth: 2, style: 'linebr',
  })),
  ...Array.from({ length: ROWS }, (_, r): PlotConfig => ({
    id: `plot${2 + ROWS + r}`, title: `History 2 row ${r}`, color: PROFILE2_COLOR, lineWidth: 2, style: 'linebr',
  })),
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'VPoC', style: 'diamond', location: 'absolute', color: VPOC_COLOR },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: "Poor man's volume clusters",
  shortTitle: 'PMVolClust',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);

/** Bars of another symbol the indicator needs: the custom volume source on the chart timeframe, when it is on. */
export function requiredSymbols(inputs: Partial<PoorManSVolumeClustersInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  if (!cfg.useCustomVolumeSource || cfg.volumeSourceSymbol.trim() === '') return [];
  return [{ symbol: cfg.volumeSourceSymbol, timeframe: chartTimeframe([], chart) }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PoorManSVolumeClustersInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { blockSize: bs, visualRowWidth, showVpoc, filterSize, useCustomVolumeSource, volumeSourceSymbol } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const at = (arr: number[], i: number) => (i >= 0 && i < n ? arr[i] : NaN);

  // custom_volume = use_custom_volume_source ? security(symbol, timeframe.period, volume, lookahead_on) : volume
  let volume = bars.map((b) => b.volume ?? NaN);
  if (useCustomVolumeSource && volumeSourceSymbol.trim() !== '') {
    const tf = chartTimeframe(bars, chart);
    const [other] = symbolBarsOf([{ symbol: volumeSourceSymbol, timeframe: tf }], chart);
    volume = securityOtherValues(bars, other, '', other.map((b) => b.volume ?? NaN), otherSymbolChart(bars, chart),
      { lookahead: true, other: chart?.symbolInfo?.(volumeSourceSymbol) });
  }

  // block_index = floor(bar_index / block_size), block_bar = bar_index % block_size
  const blockIndex = bars.map((_, i) => Math.floor(i / bs));
  const blockBar = bars.map((_, i) => i % bs);

  // rolling_high = highest(block_bar + 1), rolling_low = lowest(block_bar + 1)
  const hiSite = callsite.highest();
  const loSite = callsite.lowest();
  const rollingHigh = bars.map((_, i) => hiSite(high[i], blockBar[i] + 1));
  const rollingLow = bars.map((_, i) => loSite(low[i], blockBar[i] + 1));
  // block_high = rolling_high[block_bar + 1], block_low = rolling_low[block_bar + 1]
  const blockHigh = bars.map((_, i) => at(rollingHigh, i - blockBar[i] - 1));
  const blockLow = bars.map((_, i) => at(rollingLow, i - blockBar[i] - 1));
  const rowHeight = bars.map((_, i) => (blockHigh[i] - blockLow[i]) / ROWS);
  const rowLow = (r: number, i: number) => blockLow[i] + rowHeight[i] * r;
  const rowHigh = (r: number, i: number) => blockLow[i] + rowHeight[i] * (r + 1);
  const rowPrice = Array.from({ length: ROWS }, (_, r) => bars.map((_b, i) => (rowLow(r, i) + rowHigh(r, i)) / 2));

  // Row volumes of the bar block_size bars back, summed over the block
  const rowValue = Array.from({ length: ROWS }, () => new Array<number>(n).fill(NaN));
  const vpocPrice = new Array<number>(n).fill(NaN);
  const highestRow = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const j = i - bs;
    const hj = at(high, j);
    const lj = at(low, j);
    const vj = at(volume, j);
    let affected = 0;
    const v = new Array<number>(ROWS).fill(0);
    for (let r = 0; r < ROWS; r++) {
      if (gt(hj, rowLow(r, i)) && lt(lj, rowHigh(r, i))) {
        v[r] = vj;
        affected++;
      }
    }
    for (let r = 0; r < ROWS; r++) {
      let x = v[r] / affected / rowHeight[i];
      if (blockBar[i] !== 0) x = x + rowValue[r][i - 1];
      rowValue[r][i] = x;
    }
    if (blockBar[i] === bs - 1) {
      let hv = 0;
      for (let r = 0; r < ROWS; r++) {
        if (lt(hv, rowValue[r][i])) {
          hv = rowValue[r][i];
          vpocPrice[i] = rowPrice[r][i];
        }
      }
      highestRow[i] = hv;
    } else {
      highestRow[i] = at(highestRow, i - 1);
    }
  }
  const highestAvg = A(ta.ema(Series.fromArray(bars, highestRow), filterSize));
  // rowN_width = floor(visual_row_width * rowN_value / highest_row_value_avg[block_bar + 1])
  const rowWidth = rowValue.map((vals) => vals.map((x, i) => Math.floor(visualRowWidth * x / at(highestAvg, i - blockBar[i] - 1))));

  // History plots: offset = -block_size * 2 (the value of bar i is drawn on bar i - 2 x block size)
  const shift = 2 * bs;
  const series = (f: (i: number) => number, c: string) => {
    const out: { time: number; value: number; color: string }[] = [];
    for (let i = shift; i < n; i++) out.push({ time: bars[i - shift].time, value: f(i), color: c });
    return out;
  };
  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  // bounds_high_y = block_bar != block_size - 1 ? block_high[block_bar + 1] : na
  plots.plot0 = series((i) => (blockBar[i] !== bs - 1 ? at(blockHigh, i - blockBar[i] - 1) : NaN), BOUNDARY_COLOR);
  plots.plot1 = series((i) => (blockBar[i] !== bs - 1 ? at(blockLow, i - blockBar[i] - 1) : NaN), BOUNDARY_COLOR);
  const history = (k: number, r: number) => (i: number) => {
    // historyK_block_bar = (block_index + K) % 2 * block_size + block_bar
    const hb = ((blockIndex[i] + k) % 2) * bs + blockBar[i];
    const price = at(rowPrice[r], i - hb - 1);
    const width = Math.min(28, at(rowWidth[r], i - hb - 1));
    return le(hb, width) ? price : NaN;
  };
  for (let r = 0; r < ROWS; r++) plots[`plot${2 + r}`] = series(history(1, r), PROFILE1_COLOR);
  for (let r = 0; r < ROWS; r++) plots[`plot${2 + ROWS + r}`] = series(history(2, r), PROFILE2_COLOR);

  // plotshape(vpoc_y, "VPoC", location.absolute, VPOC_COLOR, shape.diamond, size.tiny, offset = -block_size * 2)
  const markers: MarkerData[] = [];
  if (showVpoc) {
    for (let i = shift; i < n; i++) {
      if (Number.isNaN(vpocPrice[i])) continue;
      markers.push({ time: bars[i - shift].time, position: 'atPriceMiddle', price: vpocPrice[i], shape: 'diamond',
        color: VPOC_COLOR, size: 'tiny', id: 'shape0' });
    }
  }

  // Last three blocks, drawn on the last bar (lines and labels placed by time, xloc.bar_time, in ms)
  resetDrawings({ line: 50, label: 50 });
  const isMs = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (isMs ? t : t * 1000);
  const chartTf = chartTimeframe(bars, chart);
  const tfMs = (timeframe.in_seconds(chartTf) || 0) * 1000;
  const context = chart && hasCalendar(chart)
    ? { timeframe: chartTf, timezone: chart.timezone!, session: chart.session!, regularSession: chart.regularSession, timeUnit: 'ms' as const }
    : null;
  // time_close of the bar `back` bars before the last bar (ms): the exchange calendar, else the bar time + timeframe
  const timeClose = (back: number) => {
    const t = toMs(bars[n - 1 - back].time);
    if (context) {
      try {
        const c = periodClose(t, chartTf, context);
        if (!Number.isNaN(c)) return c;
      } catch {
        // no calendar: the fallback below
      }
    }
    return t + tfMs;
  };
  const time = (back: number) => (back >= 0 && back < n ? toMs(bars[n - 1 - back].time) : NaN);

  if (n > 0) {
    const last = n - 1;
    setDrawingBar(last, true);
    const bb = blockBar[last];
    for (let k = 0; k < 3; k++) {
      const startI = bs * k + bb;
      const endI = Math.max(bs * k - (bs - bb) + 1, 0);
      const colorN = (at(blockIndex, last - endI) + 3) % 2;
      const blockColor = colorN === 0 ? PROFILE1_COLOR : colorN === 1 ? PROFILE2_COLOR : 'transparent';
      if (Number.isNaN(time(startI)) || !(startI - endI > 5)) continue;

      // high / low bounds (created at the high / low of the bar, then moved)
      const lowLine = line.new(last, high[last], last, high[last], 'bar_index', 'none', BOUNDARY_COLOR);
      const highLine = line.new(last, low[last], last, low[last], 'bar_index', 'none', BOUNDARY_COLOR);
      const bHigh = at(rollingHigh, last - endI);
      const bLow = at(rollingLow, last - endI);
      line.set_xloc(lowLine, time(startI), time(endI), 'bar_time');
      line.set_y1(lowLine, bLow);
      line.set_y2(lowLine, bLow);
      line.set_xloc(highLine, time(startI), time(endI), 'bar_time');
      line.set_y1(highLine, bHigh);
      line.set_y2(highLine, bHigh);

      // profile rows: bars from start_i down to end_i + 1 (a for loop counts down when start > end)
      const rh = (bHigh - bLow) / ROWS;
      const lo = Array.from({ length: ROWS }, (_, r) => bLow + rh * r);
      const hi = Array.from({ length: ROWS }, (_, r) => bLow + rh * (r + 1));
      const value = new Array<number>(ROWS).fill(0);
      const to = endI + 1;
      const step = startI >= to ? -1 : 1;
      for (let b = startI; step < 0 ? b >= to : b <= to; b += step) {
        const j = last - b;
        let affected = 0;
        const bv = new Array<number>(ROWS).fill(0);
        for (let r = 0; r < ROWS; r++) {
          if (lt(at(low, j), hi[r]) && gt(at(high, j), lo[r])) {
            bv[r] = at(volume, j);
            affected++;
          }
        }
        for (let r = 0; r < ROWS; r++) value[r] = value[r] + bv[r] / affected / rh;
      }
      const avgI = Math.min(startI + 1 + bs * (k + 2), last);
      const avg = at(highestAvg, last - avgI);
      const price = lo.map((l, r) => (l + hi[r]) / 2);
      const width = value.map((x) => Math.floor(visualRowWidth * x / avg));

      // vpoc
      let vpoc = NaN;
      let hv = 0;
      for (let r = 0; r < ROWS; r++) {
        if (lt(hv, value[r])) {
          hv = value[r];
          vpoc = price[r];
        }
      }

      // rows: from time[start_i] to time_close[max(start_i - width, 0)] (an na index reads the current bar)
      for (let r = 0; r < ROWS; r++) {
        const row = line.new(last, bars[last].close, last, bars[last].close, 'bar_index', 'none', undefined, undefined, 2);
        const back = Math.max(startI - width[r], 0);
        line.set_xloc(row, time(startI), timeClose(Number.isNaN(back) ? 0 : back), 'bar_time');
        line.set_y1(row, price[r]);
        line.set_y2(row, price[r]);
        line.set_color(row, blockColor);
      }

      // vpoc label of the two newest blocks
      if (k < 2 && showVpoc) {
        const lab = label.new(last, bars[last].close, '', 'bar_index', 'price', VPOC_COLOR, 'diamond', LABEL_TEXT, 'tiny');
        label.set_xloc(lab, time(startI + 1), 'bar_time');
        label.set_y(lab, vpoc);
      }
    }
    setDrawingBar(null);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    ...drawingOutputs(bars, isMs ? 'ms' : 's'),
  };
}

export const PoorManSVolumeClusters = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  requiredSymbols,
};
