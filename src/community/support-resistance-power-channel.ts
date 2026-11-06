/**
 * Support and Resistance Power Channel [ChartPrime]
 *
 * A channel drawn on the last bar from the highest high and the lowest low of the last `length` bars.
 * Resistance zone: highest high +- atr(200) / 2. Support zone: lowest low +- atr(200) / 2. A dotted line marks the
 * middle of the range, a cross marks the bar of the highest high and of the lowest low. The zones show the number
 * of falling bars ("Sell Power") and of rising bars ("Buy Power") of the window. A diamond marks each bar whose low
 * leaves the support zone upwards or whose high leaves the resistance zone downwards.
 *
 * All outputs are drawings of the last bar (lines, boxes, labels). The script keeps at most 12 labels.
 * The original uses the chart foreground colour for the texts: the port reads it from the chart context (third
 * argument of calculate) and uses #DBDBDB, the foreground colour of a dark chart, without it.
 *
 * Reference: "Support and Resistance Power Channel [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) ChartPrime
 */

import { taStep, str, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, BoxData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupportResistancePowerChannelInputs {
  /** Window in bars */
  length: number;
  /** Bars drawn after the last bar */
  extend: number;
  /** Top (resistance) colour */
  topColor: string;
  /** Bottom (support) colour */
  bottomColor: string;
}

export const defaultInputs: SupportResistancePowerChannelInputs = {
  length: 130,
  extend: 30,
  topColor: '#E040FB',
  bottomColor: '#00E676',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 130 },
  { id: 'extend', type: 'int', title: 'extend', defval: 30, min: 20, max: 100 },
  { id: 'topColor', type: 'color', title: 'Top', defval: '#E040FB', inline: 'col' },
  { id: 'bottomColor', type: 'color', title: 'Bottom', defval: '#00E676', inline: 'col' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support and Resistance Power Channel [ChartPrime]',
  shortTitle: 'S&R Power [ChartPrime]',
  overlay: true,
};

/** Pine: indicator(max_labels_count = 12) */
const MAX_LABELS = 12;
/** Pine color.gray */
const GRAY = '#787B86';

type Result = IndicatorResult & { labels: LabelData[]; lines: LineDrawingData[]; boxes: BoxData[] };

interface PowerRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  /** ta.atr(200) of each bar */
  atrs: number[];
}

function study(inputs: Partial<SupportResistancePowerChannelInputs>): BarStudy<PowerRun, Result> {
  return {
    init() {
      const atr = taStep.atr(200);
      const s: PowerRun = { atr, atrs: [], steps: [atr], vars: {}, lists: [], series: [] };
      s.series = [s.atrs];
      return s;
    },
    bar(s, i, bars) {
      s.atrs[i] = s.atr.step(bars[i].high, bars[i].low, bars[i].close);
    },
    // the drawings of the last bar (barstate.islast), from the last `length` bars
    result: (s, bars, chart) => lastBar(bars, inputs, chart, s.atrs),
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupportResistancePowerChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistancePowerChannelInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

function lastBar(
  bars: Bar[],
  inputs: Partial<SupportResistancePowerChannelInputs>,
  chart: ChartContext | undefined,
  atrs: number[],
): Result {
  /** chart.fg_color (#DBDBDB, the foreground colour of a dark chart, without a chart context) */
  const FG_COLOR = foregroundColorOf(chart);
  const { length, extend, topColor, bottomColor } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const labels: LabelData[] = [];
  const lines: LineDrawingData[] = [];
  const boxes: BoxData[] = [];
  const result = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    labels,
    lines,
    boxes,
  });
  if (n === 0) return result();

  const last = n - 1;
  const interval = barInterval(bars);
  const timeOf = (index: number) => barTime(bars, index, interval);
  // Pine: a label / line / box with an na coordinate or on a bar before the first bar is not drawn
  const drawn = (...v: number[]) => v.every(Number.isFinite);
  // Pine keeps at most max_labels_count labels: a creation that brings the count above max + 5 deletes the oldest
  // labels until max remain
  const addLabel = (index: number, label: Omit<LabelData, 'time'>) => {
    labels.push({ time: timeOf(index), ...label });
    if (labels.length > MAX_LABELS + 5) labels.splice(0, labels.length - MAX_LABELS);
  };

  // barstate.islast: high[i] / low[i] of the last `length` bars (na before the first bar)
  const hi = (i: number) => (last - i >= 0 ? bars[last - i].high : NaN);
  const lo = (i: number) => (last - i >= 0 ? bars[last - i].low : NaN);
  let max = NaN;
  let min = NaN;
  for (let i = 0; i < length; i++) {
    if (!Number.isNaN(hi(i)) && !(max >= hi(i))) max = hi(i);
    if (!Number.isNaN(lo(i)) && !(min <= lo(i))) min = lo(i);
  }
  const mid = (max + min) / 2;

  addLabel(last + extend + 15, { price: max, text: str.tostring(max, '🡅 #.##'), color: 'transparent', style: 'label_center', textColor: FG_COLOR });
  addLabel(last + extend + 15, { price: min, text: str.tostring(min, '🡇 #.##'), color: 'transparent', style: 'label_center', textColor: FG_COLOR });
  addLabel(last + extend, { price: mid, text: str.tostring(mid, '🡆 #.##'), color: 'transparent', style: 'label_left', textColor: GRAY });
  if (drawn(timeOf(last - length), mid)) {
    lines.push({ time1: timeOf(last - length), price1: mid, time2: timeOf(last + extend), price2: mid, color: GRAY, style: 'dotted' });
  }

  // array.indexof: the first (most recent) bar within 1e-10 of the extreme
  let indexOfMax = -1;
  let indexOfMin = -1;
  for (let i = 0; i < length; i++) {
    if (indexOfMax < 0 && compare.eq(hi(i), max)) indexOfMax = i;
    if (indexOfMin < 0 && compare.eq(lo(i), min)) indexOfMin = i;
  }
  addLabel(last - indexOfMax, { price: max, text: '✖', color: 'transparent', textColor: topColor, size: 'normal', style: 'label_center' });
  addLabel(last - indexOfMin, { price: min, text: '✖', color: 'transparent', textColor: bottomColor, size: 'normal', style: 'label_center' });

  // atr = ta.atr(200) * 0.5
  const atr = (atrs[last] ?? NaN) * 0.5;
  const left = timeOf(last - length);
  if (drawn(left, max + atr)) {
    lines.push({ time1: left, price1: max + atr, time2: timeOf(last + extend + 30), price2: max + atr, color: topColor, style: 'solid' });
  }
  if (drawn(left, min - atr)) {
    lines.push({ time1: left, price1: min - atr, time2: timeOf(last + extend + 30), price2: min - atr, color: bottomColor, style: 'solid' });
  }

  // power(): rising and falling bars of the window
  let buy = 0;
  let sell = 0;
  for (let i = 0; i < length && last - i >= 0; i++) {
    const b = bars[last - i];
    if (compare.gt(b.close, b.open)) buy++;
    if (compare.lt(b.close, b.open)) sell++;
  }
  // The "Sell Power" text is on the resistance zone, the "Buy Power" text on the support zone
  const zone = (top: number, bottom: number, base: string, text: string) => {
    if (!drawn(left, top, bottom)) return;
    boxes.push({
      time1: left, price1: top, time2: timeOf(last + extend), price2: bottom,
      borderColor: 'transparent', bgColor: String(color.new(base, 80)),
      text, textColor: FG_COLOR, textHAlign: 'left', textSize: 'normal',
    });
  };
  zone(max + atr, max - atr, topColor, str.tostring(sell, '            Sell Power: #'));
  zone(min + atr, min - atr, bottomColor, str.tostring(buy, '            Buy Power: #'));

  // signals(): top of the support zone and bottom of the resistance zone
  const top = min + atr;
  const bot = max - atr;
  for (let i = 0; i < length; i++) {
    const low1 = lo(i);
    const low2 = lo(i > 0 ? i + 1 : i);
    const high1 = hi(i);
    const high2 = hi(i > 0 ? i + 1 : i);
    if (compare.gt(low1, top) && compare.le(low2, top)) {
      addLabel(last - i, { price: low2, text: '◈', textColor: bottomColor, color: 'transparent', style: 'label_up', size: 'large' });
    }
    if (compare.lt(high1, bot) && compare.ge(high2, bot)) {
      addLabel(last - i, { price: high2, text: '◈', textColor: topColor, color: 'transparent', style: 'label_down', size: 'large' });
    }
  }

  // Labels with an na coordinate are not drawn
  const visible = labels.filter((l) => drawn(l.time, l.price));
  labels.length = 0;
  labels.push(...visible);
  return result();
}

export const SupportResistancePowerChannel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
