/**
 * Trendline Breakouts With Targets [ChartPrime]
 *
 * Trendlines through the last two pivot highs (falling lines only) and the last two pivot lows (rising lines
 * only), drawn as a filled band below the line and extended 25, 50 or 75 bars after the last pivot. The band
 * width comes from a volatility value: min(ATR(30) * 0.3, close * 0.3 %) of 20 bars back, divided by 2.
 * A long signal is given when the close crosses above the falling pivot-high line, a short signal when it crosses
 * below the rising pivot-low line (no new signal while a trade is on). With "Show Targets" the script draws the
 * target (20 volatility units beyond the high / low of the signal bar) as a dashed line with a "Target" label. The
 * label turns green when the target is hit and red when the close goes through the stop on the other side.
 *
 * The script keeps its last 500 lines, 500 line fills and 50 labels (plus up to 5 more), as Pine does. The first
 * trendline of each kind starts at the script's initial time value (1 ms), far before the first bar.
 * The trendlines are placed by time (xloc.bar_time): their end is the pivot time plus 25, 50 or 75 times the
 * duration of the current bar. An end after the last bar is given as that time; it is not moved onto the trading
 * calendar of the symbol (weekends, holidays), which a port does not know.
 * The script computes the visible chart range but does not use it (the test is commented out in the source).
 *
 * Reference: "Trendline Breakouts With Targets [ Chartprime ]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import { ta, Series, color, compare, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData, MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface TrendlineBreakoutsWithTargetsInputs {
  period: number;
  /** Pivots on the wicks (high / low) or on the candle bodies */
  trendType: 'Wicks' | 'Body';
  /** Extension of the lines after the last pivot, in bars: '  25', '  50' or '  75' */
  extensions: '  25' | '  50' | '  75';
  lineCol1: string;
  showTargets: boolean;
}

export const defaultInputs: TrendlineBreakoutsWithTargetsInputs = {
  period: 10,
  trendType: 'Wicks',
  extensions: '  25',
  lineCol1: 'rgba(109,111,111,0.81)',
  showTargets: true,
};

const CORE = '➞ Core Settings 🔸';

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: '     Period     ➞', defval: 10, group: CORE, inline: '001' },
  { id: 'trendType', type: 'string', title: '     Type        ➞', defval: 'Wicks', options: ['Wicks', 'Body'], group: CORE, inline: '001' },
  { id: 'extensions', type: 'string', title: '     Extend    ➞', defval: '  25', options: ['  25', '  50', '  75'], group: CORE, inline: '001' },
  { id: 'lineCol1', type: 'color', title: '', defval: 'rgba(109,111,111,0.81)', group: CORE, inline: '001' },
  { id: 'showTargets', type: 'bool', title: 'Show Targets', defval: true, group: CORE, inline: '002' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Trendline Breakouts With Targets [ Chartprime ]',
  shortTitle: 'TBT [ Chartprime ]',
  overlay: true,
};

const MAX_LINES = 500;
const MAX_LABELS = 50;
const WHITE = '#FFFFFF';
const BLACK = '#363A45';
const TARGET = String(color.rgb(154, 103, 20));

/** A line as the script keeps it: x in bar indexes, or in ms with xloc.bar_time */
interface ScriptLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  byTime: boolean;
  color: string;
  width: number;
  style: 'solid' | 'dashed';
  deleted: boolean;
}
interface ScriptFill { line1: ScriptLine; line2: ScriptLine; color: string; deleted: boolean }
interface ScriptLabel { x: number; y: number; color: string; deleted: boolean }

/** Adds an object; above max + 5 live objects the oldest are deleted until max remain (Pine rule). */
function register<T extends { deleted: boolean }>(live: T[], obj: T, max: number): T[] {
  live.push(obj);
  if (live.length > max + 5) {
    for (const old of live.splice(0, live.length - max)) old.deleted = true;
  }
  return live;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendlineBreakoutsWithTargetsInputs> = {},
): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[]; linefills: LinefillData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const period = cfg.period;
  const n = bars.length;
  const { gt, lt, ge, le, ne } = compare;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ms = (i: number) => (i >= 0 ? bars[i].time * 1000 : NaN);

  // ExtenSwitcher: '  25' => 1, '  50' => 2, else 3
  const ext = cfg.extensions === '  25' ? 1 : cfg.extensions === '  50' ? 2 : 3;
  // Period / 2: an integer division in Pine v5
  const half = Math.trunc(period / 2);

  // Zband = math.min(ta.atr(30) * 0.3, close * (0.3 / 100))[20] / 2
  const atr = A(ta.atr(bars, 30));
  const zRaw = bars.map((b, i) => math.min(atr[i] * 0.3, b.close * (0.3 / 100)) as number);
  const zband = bars.map((_, i) => (i >= 20 ? zRaw[i - 20] / 2 : NaN));

  const wicks = cfg.trendType === 'Wicks';
  const srcHigh = new Series(bars, (b) => (wicks ? b.high : gt(b.close, b.open) ? b.close : b.open));
  const srcLow = new Series(bars, (b) => (wicks ? b.low : gt(b.close, b.open) ? b.open : b.close));
  const PH = A(ta.pivothigh(srcHigh, period, half));
  const PL = A(ta.pivotlow(srcLow, period, half));

  let lines: ScriptLine[] = [];
  let fills: ScriptFill[] = [];
  let labels: ScriptLabel[] = [];
  const newLine = (x1: number, y1: number, x2: number, y2: number, byTime: boolean, col: string, width = 1,
    style: 'solid' | 'dashed' = 'solid'): ScriptLine => {
    const l: ScriptLine = { x1, y1, x2, y2, byTime, color: col, width, style, deleted: false };
    lines = register(lines, l, MAX_LINES);
    return l;
  };
  // Line fills follow max_lines_count; a fill stays when one of its lines is deleted by that rule
  const newFill = (line1: ScriptLine, line2: ScriptLine, col: string) => {
    fills = register(fills, { line1, line2, color: col, deleted: false }, MAX_LINES);
  };

  const invisibleWhite = String(color.new_color(WHITE, 100));
  const invisibleBlack = String(color.new_color(BLACK, 100));
  const upFill = String(color.rgb(11, 139, 7, 53));
  const downFill = String(color.rgb(212, 46, 0, 54));

  // State of one Trendlines() call (the function runs on every bar)
  const trendState = () => ({ Start: 1, End: 0, TIME: 1, YEnd: 0, YStart: 0, Slope: 0, scr: NaN });
  const stH = trendState();
  const stL = trendState();
  if (n > 0) {
    // var line Line1 / Line2 / Line3 = line.new(na, na, na, na), for each of the two calls
    for (let k = 0; k < 6; k++) newLine(NaN, NaN, NaN, NaN, false, '#2962FF');
  }

  // Trendlines(src, timeIndex, dir); `tradeOnPrev` is the TradeisON[1] it reads. Returns whether the pivot value changed.
  const trendlines = (st: ReturnType<typeof trendState>, src: number, i: number, dir: boolean, tradeOnPrev: boolean): boolean => {
    const time = ms(i);
    const barTIME = time - ms(i - 1);
    const prevScr = st.scr;
    const scr = Number.isNaN(src) ? prevScr : src; // fixnan(src)
    st.scr = scr;
    const changed = ne(scr - prevScr, 0); // ta.change(SCR) != 0 (false when na)
    if (changed) {
      const prevTIME = st.TIME; // TIME[1]
      st.TIME = ms(i - half);
      st.YStart = prevScr;
      st.Start = prevTIME;
      st.Slope = (scr - st.YStart) / (st.TIME - st.Start);
    }
    const exTime = ext * barTIME * 25;
    st.End = st.TIME + exTime;
    st.YEnd = scr + exTime * st.Slope;

    if (changed && !tradeOnPrev) {
      // Slope * time < 0 ? (dir ? na : green) : (dir ? red : na)
      const falling = lt(st.Slope * time, 0);
      const lineCond = falling ? (dir ? null : upFill) : dir ? downFill : null;
      if (lineCond !== null) {
        const z = zband[i];
        const line1 = newLine(st.Start, st.YStart, st.End, st.YEnd, true, invisibleWhite);
        const line2 = newLine(st.Start, st.YStart - z * 2, st.End, st.YEnd - z * 2, true, invisibleBlack);
        const line3 = newLine(st.Start, st.YStart - z * 1, st.End, st.YEnd - z * 1, true, invisibleBlack);
        newFill(line3, line2, cfg.lineCol1);
        newFill(line3, line1, lineCond);
      }
    }
    return changed;
  };

  // var globals
  let tradeIsOn = false;
  let tradeOn2 = false;
  let longTrade = false;
  let shortTrade = false;
  let TP = 0;
  let SL = 0;
  let tpLine: ScriptLine | null = null;
  let LAB: ScriptLabel | null = null;
  let updatedX = 0;
  let updatedY = 0;
  let updatedSLP = 0;
  let updatedXLow = 0;
  let updatedYLow = 0;
  let updatedSLPLow = 0;
  const updatedYHist: number[] = new Array(n).fill(NaN);
  const updatedYLowHist: number[] = new Array(n).fill(NaN);

  const markers: MarkerData[] = [];
  const hitColor = String(color.rgb(6, 128, 10, 37));
  const stopColor = String(color.new_color(color.rgb(246, 7, 7), 70));
  const longMarker = String(color.rgb(46, 192, 6, 11));
  const shortMarker = String(color.rgb(241, 2, 2, 11));

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const time = ms(i);
    const barTIME = time - ms(i - 1);
    const z = zband[i];
    const tradeOnPrev = tradeIsOn; // value at the end of the previous bar

    // TradeisON[1] inside Trendlines(): the function runs before TradeisON is assigned on this bar, so the read
    // gives the value of two bars back (Pine variable history)
    const changedH = trendlines(stH, PH[i], i, false, tradeOn2);
    const changedL = trendlines(stL, PL[i], i, true, tradeOn2);
    tradeOn2 = tradeOnPrev;
    if (changedH) {
      updatedX = stH.Start;
      updatedY = stH.YStart;
      updatedSLP = stH.Slope;
    }
    if (changedL) {
      updatedXLow = stL.Start;
      updatedYLow = stL.YStart;
      updatedSLPLow = stL.Slope;
    }
    updatedYHist[i] = updatedY;
    updatedYLowHist[i] = updatedYLow;

    // CheckCross(close, StartTime, StartPrice, SLP): na unless the start price changed in the last Period bars
    const checkCross = (startTime: number, startPrice: number, hist: number[], slp: number): number => {
      const old = i >= period ? hist[i - period] : NaN;
      if (!ne(old, startPrice)) return NaN;
      const esTime = time - startTime;
      const current = startPrice + (esTime - 0 * barTIME) * slp;
      const previous = startPrice + (esTime - 1 * barTIME) * slp;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      return lt(prevClose, previous) && gt(bar.close, current)
        ? 1
        : gt(prevClose, previous - z * 0.1) && lt(bar.close, current - z * 0.1) ? -1 : 0;
    };
    const crossHigh = checkCross(updatedX, updatedY, updatedYHist, updatedSLP);
    const crossLow = checkCross(updatedXLow, updatedYLow, updatedYLowHist, updatedSLPLow);
    const long = !gt(updatedSLP * time, 0) && crossHigh === 1 && !tradeIsOn;
    const short = !lt(updatedSLPLow * time, 0) && crossLow === -1 && !tradeIsOn;
    const tradeFire = long || short;

    if (long && !tradeIsOn) {
      longTrade = true;
      shortTrade = false;
    }
    if (short && !tradeIsOn) {
      longTrade = false;
      shortTrade = true;
    }

    if (tradeFire && !tradeIsOn) {
      TP = long ? bar.high + z * 20 : bar.low - z * 20;
      SL = long ? bar.low - z * 20 : bar.high + z * 20;
      tradeIsOn = true;
      if (cfg.showTargets) {
        newLine(i, long ? bar.high : bar.low, i, TP, false, TARGET, 2, 'dashed');
        tpLine = newLine(i, TP, i + 2, TP, false, TARGET, 1, 'dashed');
        LAB = { x: i, y: TP, color: TARGET, deleted: false };
        labels = register(labels, LAB, MAX_LABELS);
      }
    }
    if (tradeIsOn) {
      if (tpLine && !tpLine.deleted) tpLine.x2 = i;
      if (LAB && !LAB.deleted) LAB.x = i + 1;
    }
    const setLabel = (c: string) => {
      if (LAB && !LAB.deleted) LAB.color = c;
    };
    if (longTrade && tradeIsOn) {
      if (ge(bar.high, TP)) {
        setLabel(hitColor);
        tradeIsOn = false;
      }
      if (le(bar.close, SL)) {
        setLabel(stopColor);
        tradeIsOn = false;
      }
    } else if (shortTrade && tradeIsOn) {
      if (le(bar.low, TP)) {
        setLabel(hitColor);
        tradeIsOn = false;
      }
      if (ge(bar.close, SL)) {
        setLabel(stopColor);
        tradeIsOn = false;
      }
    }

    // plotshape(Long and not TradeisON[1], ...) / plotshape(Short and not TradeisON[1], ...)
    if (long && !tradeOnPrev) {
      markers.push({ time: bar.time, position: 'belowBar', shape: 'labelUp', color: longMarker, text: '', textColor: WHITE, size: 'small' });
    }
    if (short && !tradeOnPrev) {
      markers.push({ time: bar.time, position: 'aboveBar', shape: 'labelDown', color: shortMarker, text: '', textColor: WHITE, size: 'small' });
    }
  }

  // Objects alive after the last bar. A line with an na point is not drawn; a fill needs its two lines.
  const interval = barInterval(bars);
  const drawn = (l: ScriptLine) => !l.deleted && ![l.x1, l.y1, l.x2, l.y2].some((v) => Number.isNaN(v));
  const toLine = (l: ScriptLine): LineDrawingData => ({
    time1: l.byTime ? l.x1 / 1000 : barTime(bars, l.x1, interval), price1: l.y1,
    time2: l.byTime ? l.x2 / 1000 : barTime(bars, l.x2, interval), price2: l.y2,
    color: l.color, width: l.width, style: l.style,
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines: lines.filter(drawn).map(toLine),
    linefills: fills
      .filter((f) => !f.deleted && drawn(f.line1) && drawn(f.line2))
      .map((f) => ({ line1: toLine(f.line1), line2: toLine(f.line2), color: f.color })),
    labels: labels
      .filter((l) => !l.deleted && !Number.isNaN(l.y))
      .map((l) => ({
        time: barTime(bars, l.x, interval), price: l.y, text: 'Target', color: l.color, style: 'label_left' as const,
        size: 'small' as const, textColor: WHITE,
      })),
  };
}

export const TrendlineBreakoutsWithTargets = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
