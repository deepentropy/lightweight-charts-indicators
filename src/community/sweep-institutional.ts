/**
 * Sweep institutional
 *
 * Swing points are pivots with 20 bars on each side. A bullish sweep (swing failure) is a bar whose low goes under
 * the last swing low while its open and close stay above it, whose low is the lowest low of 20 bars and whose 20-bar
 * lowest close is not under the swing low. When the next three closes stay above the swing low (and at least
 * "Cooldown Period" bars passed since the last bullish signal) the script marks the sweep bar with a "Sweep" shape
 * and draws a line from the swing low to the sweep bar. Bearish sweeps are the mirror on the swing highs.
 *
 * "Show Swings?" draws the last swing high and the last swing low (those that were not a sweep bar themselves) as a
 * line that runs 5 bars after the current bar, with a triangle and a "Swing H" / "Swing L" text (the last 3 of each
 * side are kept). After a close crosses over the swing high (under the swing low), the line stops 4 bars back once
 * 4 more bars stayed fully above (below) it.
 *
 * Reference: "Sweep institutional" by Algoryze
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © algoryze
 */

import {
  ta, callsite, Series, line, label, resetDrawings, setDrawingBar, varDrawing,
  type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

type LineStyleName = 'Solid' | 'Dotted' | 'Dashed';

export interface SweepInstitutionalInputs {
  /** Bars after a signal before the next signal of the same side */
  cooldownPeriod: number;
  showSwing: boolean;
  swingClr: string;
  bullWidth: number;
  bullStyle: LineStyleName;
  bullColor: string;
  bearWidth: number;
  bearStyle: LineStyleName;
  bearColor: string;
}

export const defaultInputs: SweepInstitutionalInputs = {
  cooldownPeriod: 10,
  showSwing: true,
  swingClr: '#363A45',
  bullWidth: 1,
  bullStyle: 'Dashed',
  bullColor: '#00897B',
  bearWidth: 1,
  bearStyle: 'Dashed',
  bearColor: '#880E4F',
};

const STYLES: LineStyleName[] = ['Solid', 'Dotted', 'Dashed'];

export const inputConfig: InputConfig[] = [
  { id: 'cooldownPeriod', type: 'int', title: 'Cooldown Period', defval: 10, min: 0, group: 'Settings' },
  { id: 'showSwing', type: 'bool', title: 'Show Swings?', defval: true, inline: 's_1', group: 'Swing Detaction' },
  { id: 'swingClr', type: 'color', title: '', defval: '#363A45', inline: 's_1', group: 'Swing Detaction' },
  { id: 'bullWidth', type: 'int', title: 'Line Width:', defval: 1, group: 'Bullish Sweep' },
  { id: 'bullStyle', type: 'string', title: 'Line Style:', defval: 'Dashed', options: STYLES, group: 'Bullish Sweep' },
  { id: 'bullColor', type: 'color', title: 'Bullish Color:', defval: '#00897B', group: 'Bullish Sweep' },
  { id: 'bearWidth', type: 'int', title: 'Line Width:', defval: 1, group: 'Bearish Sweep' },
  { id: 'bearStyle', type: 'string', title: 'Line Style:', defval: 'Dashed', options: STYLES, group: 'Bearish Sweep' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color:', defval: '#880E4F', group: 'Bearish Sweep' },
];

export const plotConfig: PlotConfig[] = [];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Shapes', style: 'xcross', location: 'belowbar', color: '#00897B' },
  { id: 'shape1', kind: 'shape', title: 'Shapes', style: 'xcross', location: 'abovebar', color: '#880E4F' },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Sweep', message: '{{ticker}} Bullish Sweep, Price:{{close}}' },
  { id: 'alert1', title: 'Bearish Sweep', message: '{{ticker}} Bearish Sweep, Price:{{close}}' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Sweep institutional',
  shortTitle: 'Sweep institutional',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
const LB_LEFT = 20;
const LB_RIGHT = 20;
/** plotshape(offset = -3) */
const SHAPE_OFFSET = -3;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !lt(a, b);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

const lineStyle = (s: string): 'solid' | 'dotted' | 'dashed' => (s === 'Solid' ? 'solid' : s === 'Dotted' ? 'dotted' : 'dashed');

export function calculate(
  bars: Bar[],
  inputs: Partial<SweepInstitutionalInputs> = {},
): Omit<IndicatorResult, 'labels' | 'lines'> & {
  labels: LabelData[]; lines: LineDrawingData[]; markers: MarkerData[]; alerts: AlertConditionState[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const cooldown = Math.trunc(cfg.cooldownPeriod);
  const { showSwing, swingClr, bullColor, bearColor } = cfg;
  const bullWidth = Math.trunc(cfg.bullWidth);
  const bearWidth = Math.trunc(cfg.bearWidth);
  const bullStyle = lineStyle(cfg.bullStyle);
  const bearStyle = lineStyle(cfg.bearStyle);

  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const close = new Series(bars, (b) => b.close);
  const pLow = ta.pivotlow(low, LB_LEFT, LB_RIGHT).toArray();
  const pHigh = ta.pivothigh(high, LB_LEFT, LB_RIGHT).toArray();
  const lp = ta.lowest(low, LB_LEFT).toArray();
  const hp = ta.highest(high, LB_LEFT).toArray();
  const highestClose = ta.highest(close, LB_LEFT).toArray();
  const lowestClose = ta.lowest(close, LB_LEFT).toArray();

  // ta.valuewhen(not na(pivot), low[lbRight] / high[lbRight] / bar_index[lbRight], 0)
  const pLowVal = new Array<number>(n).fill(NaN);
  const pHighVal = new Array<number>(n).fill(NaN);
  const prevLowIndex = new Array<number>(n).fill(NaN);
  const prevHighIndex = new Array<number>(n).fill(NaN);
  const bullishSFP = new Array<boolean>(n).fill(false);
  const bearishSFP = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    const isPl = !isNaN(pLow[i] ?? NaN);
    const isPh = !isNaN(pHigh[i] ?? NaN);
    pLowVal[i] = isPl ? bars[i - LB_RIGHT].low : i > 0 ? pLowVal[i - 1] : NaN;
    prevLowIndex[i] = isPl ? i - LB_RIGHT : i > 0 ? prevLowIndex[i - 1] : NaN;
    pHighVal[i] = isPh ? bars[i - LB_RIGHT].high : i > 0 ? pHighVal[i - 1] : NaN;
    prevHighIndex[i] = isPh ? i - LB_RIGHT : i > 0 ? prevHighIndex[i - 1] : NaN;
    const b = bars[i];
    const pl = pLowVal[i];
    const ph = pHighVal[i];
    bullishSFP[i] = lt(b.low, pl) && gt(b.close, pl) && gt(b.open, pl) && eq(b.low, lp[i]) && ge(lowestClose[i], pl);
    bearishSFP[i] = gt(b.high, ph) && lt(b.close, ph) && lt(b.open, ph) && eq(b.high, hp[i]) && ge(ph, highestClose[i]);
  }

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });
  const bullLine = varDrawing<Line>();
  const bearLine = varDrawing<Line>();
  const highLine = varDrawing<Line>();
  const lowLine = varDrawing<Line>();
  const swingHighLbl = varDrawing<Label>();
  const swingLowLbl = varDrawing<Label>();
  const swingHighLblTxt = varDrawing<Label>();
  const swingLowLblTxt = varDrawing<Label>();
  const swingHighArr: Label[] = [];
  const swingHighTextArr: Label[] = [];
  const swingLowArr: Label[] = [];
  const swingLowTextArr: Label[] = [];

  let bullSignalIndex = 0;
  let bearSignalIndex = 0;
  let swingLowVal = NaN;
  let swingHighVal = NaN;
  let swingLowCounter = 0;
  let swingHighCounter = 0;
  let isSwingLowCheck = false;
  let isSwingHighCheck = false;
  let stopPrintingLow = false;
  let stopPrintingHigh = false;
  const lowCross = callsite.crossunder();
  const highCross = callsite.crossover();

  const markers: MarkerData[] = [];
  const bullCondFlags = new Array<boolean>(n).fill(false);
  const bearCondFlags = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const closeAbove = (k: number) => i - k >= 0 && gt(bars[i - k].close, pLowVal[i - k]);
    const closeBelow = (k: number) => i - k >= 0 && lt(bars[i - k].close, pHighVal[i - k]);
    const bullCond = i >= 3 && bullishSFP[i - 3] && closeAbove(0) && closeAbove(1) && closeAbove(2)
      && i >= bullSignalIndex + cooldown;
    const bearCond = i >= 3 && bearishSFP[i - 3] && closeBelow(0) && closeBelow(1) && closeBelow(2)
      && i >= bearSignalIndex + cooldown;
    bullCondFlags[i] = bullCond;
    bearCondFlags[i] = bearCond;

    // Check Swing H/L Stopper
    if (lt(b.high, swingLowVal) && isSwingLowCheck) swingLowCounter += 1;
    if (gt(b.low, swingHighVal) && isSwingHighCheck) swingHighCounter += 1;
    if (lowCross(b.close, swingLowVal) && !isSwingLowCheck) {
      isSwingLowCheck = true;
      swingLowCounter = 1;
    }
    if (highCross(b.close, swingHighVal) && !isSwingHighCheck) {
      isSwingHighCheck = true;
      swingHighCounter = 1;
    }
    if (swingLowCounter === 5 && isSwingLowCheck) {
      stopPrintingLow = true;
      isSwingLowCheck = false;
      if (lowLine.value) line.set_x2(lowLine.value, i - 4);
    }
    if (swingHighCounter === 5 && isSwingHighCheck) {
      stopPrintingHigh = true;
      isSwingHighCheck = false;
      if (highLine.value) line.set_x2(highLine.value, i - 4);
    }

    // Draw sweep lines
    if (bullCond) {
      bullSignalIndex = i;
      bullLine.value = line.new(prevLowIndex[i], pLowVal[i], i - 3, pLowVal[i], 'bar_index', 'none', bullColor, bullStyle, bullWidth);
    }
    if (bearCond) {
      bearSignalIndex = i;
      bearLine.value = line.new(prevHighIndex[i], pHighVal[i], i - 3, pHighVal[i], 'bar_index', 'none', bearColor, bearStyle, bearWidth);
    }

    if (swingHighArr.length >= 3) {
      label.delete(swingHighArr.shift()!);
      label.delete(swingHighTextArr.shift()!);
    }
    if (swingLowArr.length >= 3) {
      label.delete(swingLowArr.shift()!);
      label.delete(swingLowTextArr.shift()!);
    }

    // Draw range lines
    if (showSwing) {
      if (!stopPrintingHigh && highLine.value) line.set_x2(highLine.value, i + 5);
      if (!stopPrintingLow && lowLine.value) line.set_x2(lowLine.value, i + 5);
    }

    if (showSwing && !isNaN(pHigh[i] ?? NaN) && !bearishSFP[i - LB_RIGHT]) {
      const p = bars[i - LB_RIGHT].high;
      stopPrintingHigh = false;
      swingHighVal = p;
      if (highLine.value) line.delete(highLine.value);
      highLine.value = line.new(i - LB_RIGHT, p, i + 10, p, 'bar_index', 'none', swingClr, 'solid', 2);
      swingHighLbl.value = label.new(i - LB_RIGHT, p, '', 'bar_index', 'abovebar', swingClr, 'triangledown', swingClr, 'auto');
      swingHighLblTxt.value = label.new(i - LB_RIGHT, p, 'Swing\nH', 'bar_index', 'abovebar', swingClr, 'none', swingClr, 'small');
      swingHighArr.push(swingHighLbl.value);
      swingHighTextArr.push(swingHighLblTxt.value);
    }
    if (showSwing && !isNaN(pLow[i] ?? NaN) && !bullishSFP[i - LB_RIGHT]) {
      const p = bars[i - LB_RIGHT].low;
      stopPrintingLow = false;
      swingLowVal = p;
      if (lowLine.value) line.delete(lowLine.value);
      lowLine.value = line.new(i - LB_RIGHT, p, i + 10, p, 'bar_index', 'none', swingClr, 'solid', 2);
      swingLowLbl.value = label.new(i - LB_RIGHT, p, '', 'bar_index', 'belowbar', swingClr, 'triangleup', swingClr, 'auto');
      swingLowLblTxt.value = label.new(i - LB_RIGHT, p, 'Swing\nL', 'bar_index', 'belowbar', swingClr, 'none', swingClr, 'small');
      swingLowArr.push(swingLowLbl.value);
      swingLowTextArr.push(swingLowLblTxt.value);
    }

    // plotshape(bullCond / bearCond, text = 'Sweep', offset = -3)
    if (i + SHAPE_OFFSET >= 0) {
      const time = bars[i + SHAPE_OFFSET].time;
      if (bullCond) {
        markers.push({ id: 'shape0', time, position: 'belowBar', shape: 'xcross', color: bullColor, text: 'Sweep', textColor: bullColor });
      }
      if (bearCond) {
        markers.push({ id: 'shape1', time, position: 'aboveBar', shape: 'xcross', color: bearColor, text: 'Sweep', textColor: bearColor });
      }
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const css = (c: unknown) => (c === undefined || c === null ? 'transparent' : String(c));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines: line.all().map((l) => ({
      time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: css(l.color), width: l.width ?? 1,
      ...(l.style && l.style !== 'solid' ? { style: l.style as 'dashed' | 'dotted' } : {}),
    })),
    labels: label.all().map((l) => ({
      time: T(l.x), price: l.y, yloc: l.yloc, text: l.text ?? '', color: css(l.color), textColor: css(l.textcolor),
      style: l.style as 'triangleup' | 'triangledown' | 'none', size: (l.size ?? 'normal') as 'auto' | 'small',
    })),
    alerts: alertStates(alertConditions, bars, [bullishSFP, bearishSFP]),
  };
}

export const SweepInstitutional = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  alertConditions,
  drawingKinds,
};
