/**
 * Institutional OrderBlock Pressure (IOBP)
 *
 * A bullish order block is a bar that makes a new `Pivot Length`-bar high (its high at or above the highest high of
 * the window ending on the bar before) with a close above the close before; a bearish order block makes a new
 * `Pivot Length`-bar low with a lower close. With "Use Volume Pivot" the bar must also confirm a volume pivot low
 * (bullish) or a volume pivot high (bearish) of `Pivot Length` bars on each side. Two blocks of the same side in a row
 * are not repeated: a side is marked again only after a block of the other side. Each block is marked with a circle.
 *
 * Each block draws horizontal zone lines from its bar: the wick level (low of a bullish block, high of a bearish
 * block), the mid level, or the full range (high, low and mid), and a price label at the right end. The lines run to
 * the current bar ("Extend Lines"), or stop when a bar trades through them (the label is then removed). At most
 * `Max Lines Displayed / 2` + 1 zones are kept per side. Trend colouring paints a line with the bearish colour while
 * the close is below it, else with the bullish colour. The price in the labels is rounded to the symbol tick (chart
 * context; 0.01 without it).
 *
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Order Block Alert' / 'Bearish Order Block Alert' on the
 * bars of the circles; 'Bearish OB Line Crossed Up' / 'Down' and 'Bullish OB Line Crossed Up' / 'Down': as in the
 * original, one crossing state shared by both sides and kept from bar to bar, set by each zone in the loop over the
 * zones (the high above / the low below the zone's high level for the bearish side, its low level for the bullish
 * side; false for a zone without that line), read after the loop of the bearish zones and after the loop of the
 * bullish zones: the state left by the last zone of that loop, or the state before it when the side has no zone.
 *
 * Reference: "Institutional OrderBlock Pressure" by RickSimpson
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ RickSimpson
 */

import {
  ta, str, math, Series, line, label, resetDrawings, setDrawingBar,
  type Line, type Label, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { barInterval, barTime } from '../bar-time';
import { mintickOf, type ChartContext } from '../chart-context';

export type IobpLineStyle = '⎯⎯⎯' | '----' | '····';

export interface InstitutionalOrderblockPressureInputs {
  displayLabels: boolean;
  length: number;
  useVolume: boolean;
  bullishOrderBlockColor: string;
  bearishOrderBlockColor: string;
  displaySupportResistance: boolean;
  displayPriceLevels: boolean;
  lineDisplayStyle: 'Wick' | 'Average' | 'Full Range';
  maxDisplayedLines: number;
  enableTrendColoring: boolean;
  useCandleBody: boolean;
  lineThickness: number;
  lineStyleOption: IobpLineStyle;
  extendSupportResistance: boolean;
}

const SOLID: IobpLineStyle = '⎯⎯⎯';
const DASHED: IobpLineStyle = '----';
const DOTTED: IobpLineStyle = '····';

export const defaultInputs: InstitutionalOrderblockPressureInputs = {
  displayLabels: true,
  length: 5,
  useVolume: false,
  bullishOrderBlockColor: '#07A896',
  bearishOrderBlockColor: '#E81E1E',
  displaySupportResistance: true,
  displayPriceLevels: true,
  lineDisplayStyle: 'Wick',
  maxDisplayedLines: 20,
  enableTrendColoring: false,
  useCandleBody: false,
  lineThickness: 1,
  lineStyleOption: SOLID,
  extendSupportResistance: true,
};

const G = 'Order Block Settings';
export const inputConfig: InputConfig[] = [
  { id: 'displayLabels', type: 'bool', title: 'Display Order Block Labels', defval: true, group: G,
    tooltip: 'Display labels for detected Order Blocks on the chart.' },
  { id: 'length', type: 'int', title: 'Pivot Length', defval: 5, min: 1, group: G,
    tooltip: 'The number of bars to the left and right of a pivot point for it to be considered a high/low.' },
  { id: 'useVolume', type: 'bool', title: 'Use Volume Pivot', defval: false, group: G,
    tooltip: 'Use volume pivots to determine Order Blocks. Requires volume data.' },
  { id: 'bullishOrderBlockColor', type: 'color', title: 'Bullish Order Block', defval: '#07A896', group: G, inline: 'css',
    tooltip: 'Color for Bullish Order Blocks.' },
  { id: 'bearishOrderBlockColor', type: 'color', title: 'Bearish Order Block', defval: '#E81E1E', group: G, inline: 'css',
    tooltip: 'Color for Bearish Order Blocks.' },
  { id: 'displaySupportResistance', type: 'bool', title: 'Show Support & Resistance Lines', defval: true, group: G,
    tooltip: 'Toggle to display or hide the Bullish/Bearish Order Block Lines.' },
  { id: 'displayPriceLevels', type: 'bool', title: 'Show Line Price Levels', defval: true, group: G,
    tooltip: 'Toggle to display or hide the price level next to the Bullish/Bearish Order Block Lines.' },
  { id: 'lineDisplayStyle', type: 'string', title: 'Line Display Style', defval: 'Wick', options: ['Wick', 'Average', 'Full Range'],
    group: G, tooltip: 'Select the style of the Bullish/Bearish Order Block Lines.' },
  { id: 'maxDisplayedLines', type: 'int', title: 'Max Lines Displayed', defval: 20, min: 1, max: 500, group: G,
    tooltip: 'Maximum number of lines to display on the chart.' },
  { id: 'enableTrendColoring', type: 'bool', title: 'Enable Trend-Based Line Coloring', defval: false, group: G,
    tooltip: 'Color lines based on the trend (support/resistance).' },
  { id: 'useCandleBody', type: 'bool', title: 'Use Candle Body', defval: false, group: G,
    tooltip: 'Use the candle body (open and close) instead of the wick (high and low) for calculations.' },
  { id: 'lineThickness', type: 'int', title: 'Line Thickness', defval: 1, min: 1, max: 3, group: G, inline: 'line style',
    tooltip: 'Thickness of the Bullish/Bearish Order Block Lines.' },
  { id: 'lineStyleOption', type: 'string', title: 'Line Style', defval: SOLID, options: [SOLID, DASHED, DOTTED], group: G,
    inline: 'line style', tooltip: 'Style of the Bullish/Bearish Order Block Lines.' },
  { id: 'extendSupportResistance', type: 'bool', title: 'Extend Lines', defval: true, group: G,
    tooltip: 'Extend the support/resistance lines to the right of the chart.' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Institutional OrderBlock Pressure',
  shortTitle: 'IOBP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** The label texts of the loop start with non-breaking spaces (43 for the bearish label, 42 for the bullish one) */
const BEAR_PREFIX = ' '.repeat(43) + 'Bearish OB - ';
const BULL_PREFIX = ' '.repeat(42) + 'Bullish OB - ';

/** ZoneInformation: the zones of one side (an na line or label is null) */
interface Zones {
  highLines: Array<Line | null>;
  lowLines: Array<Line | null>;
  midLines: Array<Line | null>;
  evaluated: boolean[];
  highLabels: Array<Label | null>;
  midLabels: Array<Label | null>;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InstitutionalOrderblockPressureInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers' | 'lines' | 'labels'> & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[] }
  & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const count = bars.length;
  const length = Math.trunc(cfg.length);
  const mintick = mintickOf(chart);
  const bullCol = cfg.bullishOrderBlockColor;
  const bearCol = cfg.bearishOrderBlockColor;
  // mapLineStyle(): a switch without a default (na style for another text)
  const lineStyle = cfg.lineStyleOption === SOLID ? 'solid' : cfg.lineStyleOption === DASHED ? 'dashed'
    : cfg.lineStyleOption === DOTTED ? 'dotted' : undefined;
  const wickStyle = cfg.lineDisplayStyle === 'Wick';
  const avgStyle = cfg.lineDisplayStyle === 'Average';
  const fullStyle = cfg.lineDisplayStyle === 'Full Range';
  // maxDisplayedLines / 2: an input int divided by a literal is a float division
  const maxZones = cfg.maxDisplayedLines / 2;

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const hh = ta.highest(highS, length).toArray();
  const ll = ta.lowest(lowS, length).toArray();
  const volS = new Series(bars, (b) => b.volume ?? NaN);
  const vph = cfg.useVolume ? ta.pivothigh(volS, length, length).toArray() : [];
  const vpl = cfg.useVolume ? ta.pivotlow(volS, length, length).toArray() : [];

  resetDrawings({ line: 500, label: 500 });
  const markers: MarkerData[] = [];
  const upper: Zones = { highLines: [], lowLines: [], midLines: [], evaluated: [], highLabels: [], midLabels: [] };
  const lower: Zones = { highLines: [], lowLines: [], midLines: [], evaluated: [], highLabels: [], midLabels: [] };
  let lastState = NaN;
  // var CrossoverStatus crossoverStatus: one state for both sides, kept from bar to bar
  const crossover = { up: false, down: false };
  // isBullishOrderBlock, isBearishOrderBlock, bearish line crossed up / down, bullish line crossed up / down
  const flags: boolean[][] = [[], [], [], [], [], []];

  // createZoneLine()
  const zoneLine = (i: number, value: number, isWick: boolean, isAverage: boolean): Line | null => {
    if (!cfg.displaySupportResistance) return null;
    if ((wickStyle && isWick) || (avgStyle && isAverage) || fullStyle) return line.new(i, value, i, value);
    return null;
  };
  // The zone labels get their text again on every bar from prices that do not change: each price is formatted once
  // (-0 is not cached, the map does not tell it from 0)
  const priceTexts = new Map<number, string>();
  const priceText = (v: number) => {
    let text = priceTexts.get(v);
    if (text === undefined) {
      text = str.tostring(math.round_to_mintick(v, mintick) as number);
      if (!Object.is(v, -0)) priceTexts.set(v, text);
    }
    return text;
  };
  // createPriceLabel()
  const priceLabel = (i: number, value: number, col: string, prefix: string): Label | null => {
    if (!(cfg.displaySupportResistance && cfg.displayPriceLevels)) return null;
    const text = prefix + ' - ' + priceText(value);
    return label.new(i, value, text, 'bar_index', 'price', undefined, 'none', col);
  };
  const y1 = (l: Line | null) => (l ? line.get_y1(l) : NaN);
  // getTrendLineColor(): the bearish colour while the close is below the line
  const trendColor = (v: number, sideCol: string, close: number) => (cfg.enableTrendColoring ? (lt(close, v) ? bearCol : bullCol) : sideCol);

  const addZone = (z: Zones, hi: Line | null, lo: Line | null, mid: Line | null, lHigh: Label | null, lMid: Label | null) => {
    if (z.highLines.length > maxZones) {
      const a = z.highLines.shift();
      if (a) line.delete(a);
      const b = z.lowLines.shift();
      if (b) line.delete(b);
      const c = z.midLines.shift();
      if (c) line.delete(c);
      z.evaluated.shift();
      const d = z.highLabels.shift();
      if (d) label.delete(d);
      const e = z.midLabels.shift();
      if (e) label.delete(e);
    }
    z.highLines.push(hi);
    z.lowLines.push(lo);
    z.midLines.push(mid);
    z.evaluated.push(cfg.extendSupportResistance);
    z.highLabels.push(lHigh);
    z.midLabels.push(lMid);
  };

  /** The loop over the zones of one side: style, colours, label text and position, crossing and extension */
  const updateZones = (z: Zones, i: number, bearish: boolean) => {
    if (!(z.lowLines.length > 0 || z.midLines.length > 0)) return;
    const b = bars[i];
    const sideCol = bearish ? bearCol : bullCol;
    for (let k = 0; k < z.lowLines.length; k++) {
      const up = z.highLines[k];
      const lo = z.lowLines[k];
      const mid = z.midLines[k];
      const lHigh = z.highLabels[k];
      const lMid = z.midLabels[k];
      const evaluated = z.evaluated[k];
      for (const l of [up, lo, mid]) {
        if (!l) continue;
        if (lineStyle) line.set_style(l, lineStyle);
        line.set_width(l, cfg.lineThickness);
      }
      const upCol = trendColor(y1(up), sideCol, b.close);
      const loCol = trendColor(y1(lo), sideCol, b.close);
      const midCol = trendColor(y1(mid), sideCol, b.close);
      if (up) line.set_color(up, upCol);
      if (lo) line.set_color(lo, loCol);
      if (mid) line.set_color(mid, midCol);
      // the label of the high level (bearish) / low level (bullish) takes the colour of that line
      if (lHigh) label.set_textcolor(lHigh, bearish ? upCol : loCol);
      if (lMid) label.set_textcolor(lMid, midCol);

      const ref = bearish ? up : lo;
      if (wickStyle || fullStyle) {
        if (lHigh) {
          label.set_text(lHigh, (bearish ? BEAR_PREFIX : BULL_PREFIX) + priceText(y1(ref)));
          label.set_size(lHigh, 'small');
          label.set_x(lHigh, i);
        }
      } else if (avgStyle) {
        if (lMid) {
          label.set_text(lMid, (bearish ? BEAR_PREFIX : BULL_PREFIX) + priceText(y1(mid)));
          label.set_size(lMid, 'small');
          label.set_x(lMid, i);
        }
      }

      // crossoverStatus.crossedUp := high > line.get_y1(...) / crossedDown := low < line.get_y1(...)
      crossover.up = gt(b.high, y1(ref));
      crossover.down = lt(b.low, y1(ref));
      const crossedDown = crossover.down;
      if (crossedDown && !evaluated) {
        z.evaluated[k] = true;
        if (lHigh) label.delete(lHigh);
        if (lMid) label.delete(lMid);
      } else if (cfg.extendSupportResistance ? evaluated : !evaluated) {
        if (up) line.set_x2(up, i);
        if (lo) line.set_x2(lo, i);
        if (mid) line.set_x2(mid, i);
      }
    }
  };

  for (let i = 0; i < count; i++) {
    setDrawingBar(i, i === count - 1);
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const hh1 = i > 0 ? hh[i - 1] : NaN;
    const ll1 = i > 0 ? ll[i - 1] : NaN;
    let bull = ge(b.high, hh1) && le(b.high, hh[i]) && gt(b.close, prevClose);
    let bear = le(b.low, ll1) && ge(b.low, ll[i]) && lt(b.close, prevClose);
    if (cfg.useVolume) {
      bull = bull && !isNaN(vpl[i]);
      bear = bear && !isNaN(vph[i]);
    }
    const isBull = bull && (isNaN(lastState) || lastState !== 1);
    const isBear = bear && (isNaN(lastState) || lastState !== -1);
    if (isBull) lastState = 1;
    else if (isBear) lastState = -1;
    flags[0].push(isBull);
    flags[1].push(isBear);

    if (cfg.displayLabels && isBull) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: bullCol, size: 'tiny' });
    }
    if (cfg.displayLabels && isBear) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: bearCol, size: 'tiny' });
    }

    const highPrice = cfg.useCandleBody ? Math.max(b.open, b.close) : b.high;
    const lowPrice = cfg.useCandleBody ? Math.min(b.open, b.close) : b.low;
    const midPrice = (highPrice + lowPrice) / 2;

    // Resistance zones
    if (isBear) {
      const hi = zoneLine(i, highPrice, true, false);
      const lo = zoneLine(i, lowPrice, false, false);
      const mid = zoneLine(i, midPrice, false, true);
      let lHigh: Label | null = null;
      let lMid: Label | null = null;
      if (wickStyle || fullStyle) lHigh = priceLabel(i, highPrice, bearCol, 'Bearish OB');
      else if (avgStyle) lMid = priceLabel(i, midPrice, bearCol, 'Bearish OB');
      addZone(upper, hi, lo, mid, lHigh, lMid);
    }
    updateZones(upper, i, true);
    flags[2].push(crossover.up);
    flags[3].push(crossover.down);

    // Support zones
    if (isBull) {
      const hi = zoneLine(i, highPrice, false, false);
      const lo = zoneLine(i, lowPrice, true, false);
      const mid = zoneLine(i, midPrice, false, true);
      let lLow: Label | null = null;
      let lMid: Label | null = null;
      if (wickStyle || fullStyle) lLow = priceLabel(i, lowPrice, bullCol, 'Bullish OB');
      else if (avgStyle) lMid = priceLabel(i, midPrice, bullCol, 'Bullish OB');
      addZone(lower, hi, lo, mid, lLow, lMid);
    }
    updateZones(lower, i, false);
    flags[4].push(crossover.up);
    flags[5].push(crossover.down);
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines: line.all().map((l) => ({
      time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color ?? '#2962FF'),
      width: l.width ?? 1, ...(l.style && l.style !== 'solid' ? { style: l.style } : {}),
    })),
    labels: label.all().map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', style: 'none' as const, textColor: String(l.textcolor),
      size: (l.size ?? 'normal') as LabelData['size'],
    })),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Order Block Alert', message: 'Bullish Order Block Detected!' },
  { id: 'alert1', title: 'Bearish Order Block Alert', message: 'Bearish Order Block Detected!' },
  { id: 'alert2', title: 'Bearish OB Line Crossed Up', message: 'Bearish OB line has been crossed up!' },
  { id: 'alert3', title: 'Bearish OB Line Crossed Down', message: 'Bearish OB line has been crossed down!' },
  { id: 'alert4', title: 'Bullish OB Line Crossed Up', message: 'Bullish OB line has been crossed up!' },
  { id: 'alert5', title: 'Bullish OB Line Crossed Down', message: 'Bullish OB line has been crossed down!' },
];

export const InstitutionalOrderblockPressure = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
