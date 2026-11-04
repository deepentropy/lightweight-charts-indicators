/**
 * AsiaSessionHighLowMidLines
 *
 * Marks a session ("Session", 18:00 to 02:00 by default, read in the exchange time zone). While the session runs,
 * its running high and low are drawn as lines from the first bar of the session to 8 hours after the current bar,
 * with the middle line ("MA Level" colour, style and width) and a box from the session start to the current bar;
 * these are drawn again on every bar of the session. When a session starts, the high and low lines of the previous
 * session are drawn again (they stay on the chart), with the box of the previous session (from its first to its last
 * bar) and its middle line in the level colour, which lasts until the second bar of the new session.
 * Session strings without days are Monday to Friday in this version of the language (an overnight session belongs
 * to the day it ends): no session ends on a Saturday or a Sunday.
 * The original keeps the default object limits (50 lines, 50 boxes): the oldest are deleted.
 * Chart values (optional third argument of calculate): the exchange time zone from the context (UTC without it).
 *
 * Reference: "AsiaSessionHighLowMidLines" by marekmajer
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  line, box, time as pineTime, resetDrawings, setDrawingBar, varDrawing, drawingOutputs, barInterval,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Box,
} from 'oakscriptjs';
import type { BoxData, LineDrawingData } from '../types';
import { timezoneOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

type StyleCode = 'sol' | 'dot' | 'dsh' | 'ab' | 'al' | 'ar';

export interface AsiaSessionHighLowMidLinesInputs {
  /** Session */
  tradeRange: string;
  /** Level Color */
  rColor: string;
  /** Level Style */
  rStyle: StyleCode;
  /** Level Width */
  rWidth: number;
  /** MA Level Color */
  mColor: string;
  /** MA Level Style */
  mStyle: StyleCode;
  /** MA Level Width */
  mWidth: number;
  /** Background Color */
  bgColor: string;
}

export const defaultInputs: AsiaSessionHighLowMidLinesInputs = {
  tradeRange: '1800-0200',
  rColor: '#00BCD4',
  rStyle: 'sol',
  rWidth: 1,
  mColor: '#FF9800',
  mStyle: 'sol',
  mWidth: 1,
  bgColor: 'rgba(0, 188, 212, 0.3)',
};

const STYLE_OPTIONS: StyleCode[] = ['sol', 'dot', 'dsh', 'ab', 'al', 'ar'];

export const inputConfig: InputConfig[] = [
  { id: 'tradeRange', type: 'session', title: 'Session', defval: '1800-0200' },
  { id: 'rColor', type: 'color', title: 'Level Color', defval: '#00BCD4' },
  { id: 'rStyle', type: 'string', title: 'Level Style', defval: 'sol', options: STYLE_OPTIONS },
  { id: 'rWidth', type: 'int', title: 'Level Width', defval: 1 },
  { id: 'mColor', type: 'color', title: 'MA Level Color', defval: '#FF9800' },
  { id: 'mStyle', type: 'string', title: 'MA Level Style', defval: 'sol', options: STYLE_OPTIONS },
  { id: 'mWidth', type: 'int', title: 'MA Level Width', defval: 1 },
  { id: 'bgColor', type: 'color', title: 'Background Color', defval: 'rgba(0, 188, 212, 0.3)' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box'];

export const metadata = {
  title: 'AsiaSessionHighLowMidLines',
  shortTitle: 'AsiaSessionHighLowMidLines',
  overlay: true,
};

/** line.style_* values of the inputs */
const LINE_STYLE = {
  sol: 'solid', dot: 'dotted', dsh: 'dashed', ab: 'arrow_both', al: 'arrow_left', ar: 'arrow_right',
} as const;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export function calculate(
  bars: Bar[],
  inputs: Partial<AsiaSessionHighLowMidLinesInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tz = timezoneOf(chart);
  const rStyle = LINE_STYLE[cfg.rStyle] ?? 'solid';
  const mStyle = LINE_STYLE[cfg.mStyle] ?? 'solid';
  // a session without days is Monday to Friday in this version of the language
  const session = cfg.tradeRange.includes(':') ? cfg.tradeRange : `${cfg.tradeRange}:23456`;
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;
  const barMs = barInterval(bars) * ms;

  resetDrawings({ line: 50, box: 50, label: 50 });
  // var line / box variables of the script (they hold their objects)
  const l01 = varDrawing<Line>();
  const l02 = varDrawing<Line>();
  const l01s1 = varDrawing<Line>();
  const l02s1 = varDrawing<Line>();
  const maLine = varDrawing<Line>();
  const box1 = varDrawing<Box>();
  const boxCur = varDrawing<Box>();

  let refHigh = NaN;
  let refLow = NaN;
  let x = NaN;
  let prevAllowed = false;
  let l01x1 = NaN, l01x2 = NaN, l01y1 = NaN, l01y2 = NaN;
  let l02x1 = NaN, l02x2 = NaN, l02y1 = NaN, l02y2 = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const t = b.time * ms;
    // timeIsAllowed = not na(time(timeframe.period, tradeRange))
    const allowed = pineTime.inSession(t, session, tz, barMs);
    const newSession = allowed && !prevAllowed;
    refHigh = newSession ? b.high : allowed && prevAllowed ? (gt(b.high, refHigh) ? b.high : refHigh) : refHigh;
    refLow = newSession ? b.low : allowed && prevAllowed ? (lt(b.low, refLow) ? b.low : refLow) : refLow;
    if (newSession) x = t;

    // previous session
    if (newSession) {
      l01s1.value = line.new(l01x1, l01y1, l01x2, l01y2, 'bar_time', 'none', cfg.rColor, rStyle, cfg.rWidth);
      l02s1.value = line.new(l02x1, l02y1, l02x2, l02y2, 'bar_time', 'none', cfg.rColor, rStyle, cfg.rWidth);
      boxCur.value = box.new(l01x1, l01y1, l01x2 - EIGHT_HOURS, l02y2, '#FFFFFF', 0, 'solid', 'none', 'bar_time', cfg.bgColor);
      // maType == "Static": int / int of the times is an integer division in this version
      maLine.value = line.new(Math.floor((l01x1 + l02x1) / 2), (l01y1 + l02y1) / 2, Math.floor((l01x2 + l02x2) / 2),
        (l01y2 + l02y2) / 2, 'bar_time', 'none', cfg.rColor, rStyle, cfg.rWidth);
    }

    // current session
    if (allowed && !newSession) {
      if (l01.value) line.delete(l01.value);
      if (l02.value) line.delete(l02.value);
      if (maLine.value) line.delete(maLine.value);
      if (box1.value) box.delete(box1.value);
      l01.value = line.new(x, refHigh, t + EIGHT_HOURS, refHigh, 'bar_time', 'none', cfg.rColor, rStyle, cfg.rWidth);
      l02.value = line.new(x, refLow, t + EIGHT_HOURS, refLow, 'bar_time', 'none', cfg.rColor, rStyle, cfg.rWidth);
      maLine.value = line.new(x, (refHigh + refLow) / 2, t + EIGHT_HOURS, (refHigh + refLow) / 2, 'bar_time', 'none',
        cfg.mColor, mStyle, cfg.mWidth);
      box1.value = box.new(x, refHigh, t, refLow, '#FFFFFF', 0, 'solid', 'none', 'bar_time', cfg.bgColor);
    }

    // set previous values (valuewhen(cond, ..., 0) inside the block of cond: the current values)
    if (!allowed && prevAllowed && !newSession) {
      const a = l01.value;
      const c = l02.value;
      l01x1 = a ? line.get_x1(a) : NaN;
      l01x2 = a ? line.get_x2(a) : NaN;
      l01y1 = a ? line.get_y1(a) : NaN;
      l01y2 = a ? line.get_y2(a) : NaN;
      l02x1 = c ? line.get_x1(c) : NaN;
      l02x2 = c ? line.get_x2(c) : NaN;
      l02y1 = c ? line.get_y1(c) : NaN;
      l02y2 = c ? line.get_y2(c) : NaN;
    }
    prevAllowed = allowed;
  }
  setDrawingBar(null);

  const out = drawingOutputs(bars);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: out.lines ?? [],
    boxes: out.boxes ?? [],
  };
}

export const AsiaSessionHighLowMidLines = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
