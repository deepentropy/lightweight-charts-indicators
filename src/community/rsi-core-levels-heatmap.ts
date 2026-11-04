/**
 * RSI Core Levels Heatmap [BigBeluga]
 *
 * An RSI with an SMA signal line. The RSI line is coloured on a gradient from the bullish colour (RSI 30) to the
 * bearish colour (RSI 70). Square markers draw a heatmap ribbon in the pane: at 95 while the RSI is overbought
 * (>= 70), at 5 while it is oversold (<= 30) and at 50 while it is in the 40-60 squeeze zone; overbought / oversold
 * squares are also drawn above / below the price bars.
 *
 * Levels on the price chart: when the RSI crosses over its signal line below 50 (on a closed bar), the first bearish
 * candle among the last 11 bars gives a support level at its low (zone open to low); when the RSI crosses under its
 * signal line above 50, the first bullish candle gives a resistance level at its high (zone high to open). A zone that
 * overlaps an active zone is skipped. Each level is a line from that candle to the current bar with a label
 * "RSI: <RSI of that candle>". A close through the zone breaks the level: its label is deleted and the line turns
 * into a grey dashed line. On the last bar only the newest "Max Active Levels & Labels" active levels are kept. A
 * table shows the close and the nearest active resistance and support with their distances.
 *
 * The table border uses the chart background colour (chart context; fallback #0F0F0F).
 *
 * Reference: "RSI Core Levels Heatmap [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, color, str, callsite, getSourceSeries, line, label, resetDrawings, setDrawingBar,
  type Bar, type HLineConfig, type IndicatorResult, type InputConfig, type Label, type Line, type MarkerData,
  type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, TableCellData, TableData, TablePosition } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { backgroundColorOf, lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface RsiCoreLevelsHeatmapInputs {
  /** Active levels kept on the last bar */
  maxActiveLevels: number;
  /** RSI length */
  rsiLength: number;
  /** SMA length of the signal line */
  sigLength: number;
  sigColor: string;
  bullBaseColor: string;
  bearBaseColor: string;
  /** Show the squares of the 40-60 zone */
  showMidZone: boolean;
  midZoneColorInput: string;
  showTable: boolean;
  tablePos: 'top_right' | 'bottom_right' | 'top_left' | 'bottom_left';
}

export const defaultInputs: RsiCoreLevelsHeatmapInputs = {
  maxActiveLevels: 5,
  rsiLength: 14,
  sigLength: 14,
  sigColor: '#FF9800',
  bullBaseColor: '#04C370',
  bearBaseColor: '#FF0000',
  showMidZone: true,
  midZoneColorInput: '#FDD835',
  showTable: true,
  tablePos: 'top_right',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'maxActiveLevels', type: 'int', title: 'Max Active Levels & Labels', defval: 5, min: 1, group: 'Core Settings',
    tooltip: 'Maximum number of active lines and labels allowed on the price chart simultaneously before old ones are removed on the last bar.',
  },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1, tooltip: 'RSI Line Length.', group: 'Core Settings' },
  {
    id: 'sigLength', type: 'int', title: 'Signal Line Length', defval: 14, min: 1, group: 'Core Settings',
    tooltip: 'The smoothing period used to calculate the RSI Signal Line.',
  },
  {
    id: 'sigColor', type: 'color', title: 'Signal Line Color', defval: '#FF9800', group: 'Core Settings',
    tooltip: 'The color used to display the RSI Signal Line.',
  },
  {
    id: 'bullBaseColor', type: 'color', title: 'Bullish Base Color', defval: '#04C370', group: 'Color Theme',
    tooltip: 'The intense color used when RSI is heavily oversold.',
  },
  {
    id: 'bearBaseColor', type: 'color', title: 'Bearish Base Color', defval: '#FF0000', group: 'Color Theme',
    tooltip: 'The intense color used when RSI is heavily overbought.',
  },
  {
    id: 'showMidZone', type: 'bool', title: 'Show Midline Squeeze Zone', defval: true, group: 'Midline Settings',
    tooltip: 'Toggle the visibility of the neutral compression gradient area around the 50 line.',
  },
  {
    id: 'midZoneColorInput', type: 'color', title: 'Midline Zone Color', defval: '#FDD835', group: 'Midline Settings',
    tooltip: 'Choose the color for the neutral compression zone gradient.',
  },
  {
    id: 'showTable', type: 'bool', title: 'Show Dashboard Table', defval: true, group: 'Dashboard Settings',
    tooltip: 'Toggle the visibility of the closest levels dashboard.',
  },
  {
    id: 'tablePos', type: 'string', title: 'Table Position', defval: 'top_right', group: 'Dashboard Settings',
    options: ['top_right', 'bottom_right', 'top_left', 'bottom_left'],
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI (Gradiented)', color: '#04C370', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF9800', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid', price: 50, title: 'Middle Line', color: '#787B86', linestyle: 'dashed' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Overbought Track', style: 'square', location: 'absolute', color: '#FF0000', size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Midline Squeeze Track', style: 'square', location: 'absolute', color: '#FDD835', size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Oversold Track', style: 'square', location: 'absolute', color: '#04C370', size: 'tiny' },
  {
    id: 'shape3', kind: 'shape', title: 'Main Chart Overbought', style: 'square', location: 'abovebar', color: '#FF0000',
    size: 'tiny', forceOverlay: true,
  },
  {
    id: 'shape4', kind: 'shape', title: 'Main Chart Oversold', style: 'square', location: 'belowbar', color: '#04C370',
    size: 'tiny', forceOverlay: true,
  },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const metadata = {
  title: 'RSI Core Levels Heatmap [BigBeluga]',
  shortTitle: 'RSI Core Levels Heatmap [BigBeluga]',
  overlay: false,
};

/** Pine float comparisons: within 1e-10 is equal, na compares false */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;
/** color.black of Pine v6 */
const BLACK = '#363A45';
const le = (a: number, b: number) => a - b <= EPS;
const ge = (a: number, b: number) => b - a <= EPS;

interface BlockLevel {
  lvlLine: Line;
  lvlLabel: Label;
  topPrice: number;
  botPrice: number;
  isBull: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiCoreLevelsHeatmapInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const rsiSeries = ta.rsi(getSourceSeries(bars, 'close'), cfg.rsiLength);
  const rsi = rsiSeries.toArray().map((v) => v ?? NaN);
  const sig = ta.sma(rsiSeries, cfg.sigLength).toArray().map((v) => v ?? NaN);
  const bull = cfg.bullBaseColor;
  const bear = cfg.bearBaseColor;
  const mid = cfg.midZoneColorInput;
  const lastConfirmed = lastBarConfirmedOf(chart);

  // indicator(max_lines_count = 500); labels: default limit 50
  resetDrawings({ line: 500, label: 50 });

  const crossUp = callsite.crossover();
  const crossDown = callsite.crossunder();
  const activeBlocks: BlockLevel[] = [];

  const overlapping = (high: number, low: number) => activeBlocks.some((item) =>
    (le(high, item.topPrice) && ge(high, item.botPrice)) || (ge(low, item.botPrice) && le(low, item.topPrice))
    || (ge(high, item.topPrice) && le(low, item.botPrice)));

  const gradient = (v: number, lo: number, hi: number, c1: string, c2: string) =>
    String(color.from_gradient(v, lo, hi, c1, c2) ?? 'transparent');

  const pRsi: { time: number; value: number; color: string }[] = [];
  const pSig: { time: number; value: number; color: string }[] = [];
  const markers: MarkerData[] = [];
  let closestSup = NaN;
  let closestRes = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const r = rsi[i];
    const isLast = i === n - 1;
    const bullBlock = crossUp(r, sig[i]) && lt(r, 50);
    const bearBlock = crossDown(r, sig[i]) && gt(r, 50);

    // barstate.isconfirmed: historical bars are closed; the last bar may be live
    if (!isLast || lastConfirmed) {
      if (bullBlock) {
        for (let k = 0; k <= 10 && k <= i; k++) {
          const c = bars[i - k];
          if (lt(c.close, c.open)) {
            const top = c.open;
            const bot = c.low;
            if (!overlapping(top, bot)) {
              const dyn = gradient(rsi[i - k], 15, 50, bull, String(color.new(bull, 80)));
              const l = line.new(i - k, bot, i, bot, 'bar_index', 'none', dyn, 'solid', 2, true);
              const lb = label.new(i, bot, 'RSI: ' + str.tostring(rsi[i - k], '#.##'), 'bar_index', 'price',
                String(color.new(BLACK, 100)), 'label_left', dyn, 'normal', 'center', '', 'default', true);
              activeBlocks.push({ lvlLine: l, lvlLabel: lb, topPrice: top, botPrice: bot, isBull: true });
            }
            break;
          }
        }
      }
      if (bearBlock) {
        for (let k = 0; k <= 10 && k <= i; k++) {
          const c = bars[i - k];
          if (gt(c.close, c.open)) {
            const top = c.high;
            const bot = c.open;
            if (!overlapping(top, bot)) {
              const dyn = gradient(rsi[i - k], 50, 85, String(color.new(bear, 80)), bear);
              const l = line.new(i - k, top, i, top, 'bar_index', 'none', dyn, 'solid', 2, true);
              const lb = label.new(i, top, 'RSI: ' + str.tostring(rsi[i - k], '#.##'), 'bar_index', 'price',
                String(color.new(BLACK, 100)), 'label_left', dyn, 'normal', 'center', '', 'default', true);
              activeBlocks.push({ lvlLine: l, lvlLabel: lb, topPrice: top, botPrice: bot, isBull: false });
            }
            break;
          }
        }
      }
    }

    // Object array state lifecycle
    if (activeBlocks.length > 0) {
      for (let j = activeBlocks.length - 1; j >= 0; j--) {
        const item = activeBlocks[j];
        const broken = item.isBull ? lt(b.close, item.botPrice) : gt(b.close, item.topPrice);
        if (broken) {
          label.delete(item.lvlLabel);
          line.set_style(item.lvlLine, 'dashed');
          line.set_color(item.lvlLine, '#787B86');
          line.set_width(item.lvlLine, 1);
          activeBlocks.splice(j, 1);
        } else {
          line.set_x2(item.lvlLine, i);
          label.set_x(item.lvlLabel, i);
        }
      }
      if (isLast && activeBlocks.length > cfg.maxActiveLevels) {
        const toDelete = activeBlocks.length - cfg.maxActiveLevels;
        for (let j = 0; j < toDelete; j++) {
          const old = activeBlocks.shift()!;
          line.delete(old.lvlLine);
          label.delete(old.lvlLabel);
        }
      }
    }

    // Nearest support / resistance (only the last bar's values are used, by the table)
    if (isLast) {
      let minSup = NaN;
      let minRes = NaN;
      for (const item of activeBlocks) {
        if (item.isBull) {
          const dist = b.close - item.botPrice;
          if (ge(dist, 0) && (isNaN(minSup) || lt(dist, minSup))) {
            minSup = dist;
            closestSup = item.botPrice;
          }
        } else {
          const dist = item.topPrice - b.close;
          if (ge(dist, 0) && (isNaN(minRes) || lt(dist, minRes))) {
            minRes = dist;
            closestRes = item.topPrice;
          }
        }
      }
    }

    pRsi.push({ time: b.time, value: r, color: gradient(r, 30, 70, bull, bear) });
    pSig.push({ time: b.time, value: sig[i], color: cfg.sigColor });

    const isOverbought = ge(r, 70);
    const isOversold = le(r, 30);
    const isSqueeze = cfg.showMidZone && ge(r, 40) && le(r, 60);
    const colorOB = gradient(r, 70, 100, String(color.new(bear, 90)), String(color.new(bear, 0)));
    const colorOS = gradient(r, 0, 30, String(color.new(bull, 0)), String(color.new(bull, 90)));
    if (isOverbought) {
      markers.push({ id: 'shape0', time: b.time, position: 'atPriceMiddle', price: 95, shape: 'square', color: colorOB, size: 'tiny' });
    }
    if (isSqueeze) {
      const sq = lt(r, 50)
        ? gradient(r, 45, 50, String(color.new(mid, 100)), String(color.new(mid, 0)))
        : gradient(r, 50, 55, String(color.new(mid, 0)), String(color.new(mid, 100)));
      markers.push({ id: 'shape1', time: b.time, position: 'atPriceMiddle', price: 50, shape: 'square', color: sq, size: 'tiny' });
    }
    if (isOversold) {
      markers.push({ id: 'shape2', time: b.time, position: 'atPriceMiddle', price: 5, shape: 'square', color: colorOS, size: 'tiny' });
    }
    if (isOverbought) {
      markers.push({ id: 'shape3', time: b.time, position: 'aboveBar', shape: 'square', color: colorOB, size: 'tiny', forceOverlay: true });
    }
    if (isOversold) {
      markers.push({ id: 'shape4', time: b.time, position: 'belowBar', shape: 'square', color: colorOS, size: 'tiny', forceOverlay: true });
    }
  }
  setDrawingBar(null);

  // Dashboard table, made on the last bar
  const tables: TableData[] = [];
  if (cfg.showTable && n > 0) {
    const close = bars[n - 1].close;
    const white = '#FFFFFF';
    const cells: TableCellData[] = [];
    const cell = (column: number, row: number, text: string, textColor: string, bgColor?: string) =>
      cells.push({ column, row, text, textColor, textSize: 'normal', ...(bgColor ? { bgColor } : {}) });
    cell(0, 0, 'Level Type', white, '#4f5569');
    cell(1, 0, 'Price Value', white, '#4f5569');
    cell(2, 0, 'Distance (Points / %)', white, '#4f5569');
    cell(0, 1, 'Current Close', white);
    cell(1, 1, str.tostring(close, '#.##'), white);
    cell(2, 1, 'Pivot Center', white);
    if (!isNaN(closestRes)) {
      const pts = closestRes - close;
      const per = (pts / close) * 100;
      cell(0, 2, 'Nearest Resistance', bear);
      cell(1, 2, str.tostring(closestRes, '#.##'), white);
      cell(2, 2, str.tostring(pts, '#.##') + ' (' + str.tostring(per, '#.##') + '%)', bear);
    } else {
      cell(0, 2, 'Nearest Resistance', bear);
      cell(1, 2, 'None Active', white);
      cell(2, 2, '-', bear);
    }
    if (!isNaN(closestSup)) {
      const pts = close - closestSup;
      const per = (pts / close) * 100;
      cell(0, 3, 'Nearest Support', bull);
      cell(1, 3, str.tostring(closestSup, '#.##'), white);
      cell(2, 3, str.tostring(pts, '#.##') + ' (' + str.tostring(per, '#.##') + '%)', bull);
    } else {
      cell(0, 3, 'Nearest Support', bull);
      cell(1, 3, 'None Active', white);
      cell(2, 3, '-', bull);
    }
    tables.push({
      position: cfg.tablePos as TablePosition, columns: 3, rows: 4, cells,
      bgColor: String(color.new(BLACK, 30)), borderColor: backgroundColorOf(chart), borderWidth: 1,
    });
  }

  const T = (index: number) => bars[index].time;
  const lines: LineDrawingData[] = line.all().map((l) => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: l.width,
    ...(l.style === 'dashed' ? { style: 'dashed' as const } : {}), forceOverlay: true,
  }));
  const labels: LabelData[] = label.all().map((l) => ({
    time: T(l.x), price: l.y, text: l.text ?? '', color: String(color.new(BLACK, 100)), textColor: String(l.textcolor),
    style: 'label_left', forceOverlay: true,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: pRsi, plot1: pSig },
    hlines: [{ value: 50, options: { title: 'Middle Line', color: '#787B86', linestyle: 'dashed' } }],
    markers,
    lines,
    labels,
    tables,
  };
}

export const RsiCoreLevelsHeatmap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  shapeConfig,
  drawingKinds,
};
