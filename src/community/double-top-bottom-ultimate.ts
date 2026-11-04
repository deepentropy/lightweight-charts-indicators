/**
 * Double Top/Bottom - Ultimate (OS)
 *
 * A zig-zag of "length" bars: a bar whose high is the highest high of the last length bars is a high pivot, a bar
 * whose low is the lowest low a low pivot (a bar that is both keeps the direction before). A new pivot in the same
 * direction replaces the last one when it goes further. A pivot beyond the pivot two back of the same side has a
 * direction of +-2 (higher high / lower low), else +-1. The last 10 pivots are kept.
 *
 * Pattern: on every bar the three confirmed pivots before the latest one are tested. A lower high after a low after a
 * higher high is a double top, a higher low after a high after a lower low a double bottom, when the risk (distance
 * to the outer pivot) is less than "MaxRiskPerReward" % of risk + reward (distance to the middle pivot). Each pattern
 * draws its three lines and a label "Double Top" / "Double Bottom" with the risk percentage; a pattern on the next bar
 * with the same outer pivot replaces it. After a pattern, a cross of the middle pivot price confirms it and a cross of
 * the outer pivot price invalidates it (a dashed break line from the pivot; one per pivot). On the last bar, dashed
 * resistance and support lines extend left from the two pivots of the latest pattern, the zig-zag pivots get HH / LH
 * / HL / LL labels (zig-zag lines with "showZigzag") and a table counts the patterns, confirmations and
 * invalidations (cell colours by the confirmation ratio).
 *
 * Alerts (alertcondition, `alerts` of the result): Double Bottom, Double Bottom Confirmation, Double Bottom
 * Invalidation, Double Top, Double Top Confirmation, Double Top Invalidation.
 *
 * Reference: "Double Top/Bottom - Ultimate (OS)" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HeWhoMustNotBeNamed
 */

import {
  ta, str, color, line, label, table, callsite, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface DoubleTopBottomUltimateInputs {
  /** Bars of the high / low pivot windows */
  length: number;
  /** Draw the zig-zag lines on the last bar */
  showZigzag: boolean;
  /** Draw the pivot labels on the last bar */
  showPivots: boolean;
  /** Draw the statistics table */
  showStats: boolean;
  bullishColor: string;
  bullTrapColor: string;
  bearishColor: string;
  bearTrapColor: string;
  textColor: string;
  /** Largest risk, in % of risk + reward */
  MaxRiskPerReward: number;
  /** Show the risk percentage in the pattern labels */
  DisplayRiskPerReward: boolean;
}

export const defaultInputs: DoubleTopBottomUltimateInputs = {
  length: 10,
  showZigzag: false,
  showPivots: true,
  showStats: true,
  bullishColor: '#4CAF50',
  bullTrapColor: '#FF9800',
  bearishColor: '#FF5252',
  bearTrapColor: '#00E676',
  textColor: '#363A45',
  MaxRiskPerReward: 30,
  DisplayRiskPerReward: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 10, min: 5, step: 5 },
  { id: 'showZigzag', type: 'bool', title: 'showZigzag', defval: false },
  { id: 'showPivots', type: 'bool', title: 'showPivots', defval: true },
  { id: 'showStats', type: 'bool', title: 'showStats', defval: true },
  { id: 'bullishColor', type: 'color', title: 'bullishColor', defval: '#4CAF50' },
  { id: 'bullTrapColor', type: 'color', title: 'bullTrapColor', defval: '#FF9800' },
  { id: 'bearishColor', type: 'color', title: 'bearishColor', defval: '#FF5252' },
  { id: 'bearTrapColor', type: 'color', title: 'bearTrapColor', defval: '#00E676' },
  { id: 'textColor', type: 'color', title: 'textColor', defval: '#363A45' },
  { id: 'MaxRiskPerReward', type: 'int', title: 'MaxRiskPerReward', defval: 30, min: 5, max: 100, step: 5 },
  { id: 'DisplayRiskPerReward', type: 'bool', title: 'DisplayRiskPerReward', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Double Bottom', message: 'Probable double bottom observed for {{ticker}} on {{interval}} timeframe' },
  { id: 'alert1', title: 'Double Bottom Confirmation', message: 'Double bottom confirmation observed for {{ticker}} on {{interval}} timeframe' },
  { id: 'alert2', title: 'Double Bottom Invalidation', message: 'Double bottom invalidation observed for {{ticker}} on {{interval}} timeframe' },
  { id: 'alert3', title: 'Double Top', message: 'Probable double top observed for {{ticker}} on {{interval}} timeframe' },
  { id: 'alert4', title: 'Double Top Confirmation', message: 'Double top confirmation observed for {{ticker}} on {{interval}} timeframe' },
  { id: 'alert5', title: 'Double Top Invalidation', message: 'Double top invalidation observed for {{ticker}} on {{interval}} timeframe' },
];

export const metadata = {
  title: 'Double Top/Bottom - Ultimate (OS)',
  shortTitle: 'W/M - Ultimate(OS)',
  overlay: true,
};

/** study(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
const MAX_ARRAY_SIZE = 10;

// Pine v4 colour constants
const BLACK = '#363A45';
const WHITE = '#FFFFFF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
/** A float used as a bool before v6: na and 0 are false */
const truthy = (x: number) => !Number.isNaN(x) && x !== 0;

export function calculate(
  bars: Bar[],
  inputs: Partial<DoubleTopBottomUltimateInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { bullishColor, bullTrapColor, bearishColor, bearTrapColor, textColor } = cfg;

  const hb = ta.highestbars(new Series(bars, (b) => b.high), cfg.length).toArray();
  const lb = ta.lowestbars(new Series(bars, (b) => b.low), cfg.length).toArray();

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });

  const zzValues: number[] = [];
  const zzIndexes: number[] = [];
  const zzDir: number[] = [];
  // var doubleTopBottom* = array.new_*(3): na values
  const dtbValues = [NaN, NaN, NaN];
  const dtbIndexes = [NaN, NaN, NaN];
  const dtbDir = [NaN, NaN, NaN];
  const lineArray: Line[] = [];
  const labelArray: Label[] = [];

  // the four crossings run only in their ternary branch: one call site each
  const topConfirm = callsite.crossunder();
  const topInvalid = callsite.crossover();
  const bottomConfirm = callsite.crossover();
  const bottomInvalid = callsite.crossunder();

  let dirPrev = NaN;
  let latestDoubleTop = false;
  let latestDoubleBottom = false;
  let isBullish = false;
  let doubleTopCount = 0;
  let doubleBottomCount = 0;
  let prevBase: Line | null = null;
  let prevL1: Line | null = null;
  let prevL2: Line | null = null;
  let prevLabel: Label | null = null;
  // lresbreak[1] / lsupbreak[1]: the value of the last run of their block
  let lastResBreak: Line | null = null;
  let lastSupBreak: Line | null = null;
  let dtConfCount = 0;
  let dbConfCount = 0;
  let dtInvCount = 0;
  let dbInvCount = 0;

  const flags: boolean[][] = Array.from({ length: 6 }, () => new Array(n).fill(false));

  const addToArray = (value: number, index: number, dir: number) => {
    const mult = zzValues.length < 2 ? 1 : gt(dir * value, dir * zzValues[1]) ? 2 : 1;
    zzIndexes.unshift(index);
    zzValues.unshift(value);
    zzDir.unshift(dir * mult);
    if (zzIndexes.length > MAX_ARRAY_SIZE) {
      zzIndexes.pop();
      zzValues.pop();
      zzDir.pop();
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const isLast = i === n - 1;

    // zigzag(length): pivots(length)
    const ph = hb[i] === 0 ? b.high : NaN;
    const pl = lb[i] === 0 ? b.low : NaN;
    const dir = truthy(ph) && Number.isNaN(pl) ? 1 : truthy(pl) && Number.isNaN(ph) ? -1 : dirPrev;
    const dirchanged = truthy(dir - dirPrev);
    dirPrev = dir;
    if (truthy(ph) || truthy(pl)) {
      const value = dir === 1 ? ph : pl;
      if (zzValues.length === 0 || dirchanged) {
        addToArray(value, i, dir);
      } else if ((dir === 1 && gt(value, zzValues[0])) || (dir === -1 && lt(value, zzValues[0]))) {
        zzValues.shift();
        zzIndexes.shift();
        zzDir.shift();
        addToArray(value, i, dir);
      }
    }

    // calculate_double_pattern()
    let doubleTop = false;
    let doubleBottom = false;
    if (zzValues.length >= 4) {
      const value = zzValues[1];
      const lvalue = zzValues[2];
      const llvalue = zzValues[3];
      const highLow = zzDir[1];
      const lhighLow = zzDir[2];
      const llhighLow = zzDir[3];
      const risk = Math.abs(value - llvalue);
      const reward = Math.abs(value - lvalue);
      const riskPerReward = (risk * 100) / (risk + reward);
      if (highLow === 1 && llhighLow === 2 && lt(lhighLow, 0) && lt(riskPerReward, cfg.MaxRiskPerReward)) doubleTop = true;
      if (highLow === -1 && llhighLow === -2 && gt(lhighLow, 0) && lt(riskPerReward, cfg.MaxRiskPerReward)) doubleBottom = true;
      if (doubleTop || doubleBottom) {
        for (let k = 0; k < 3; k++) {
          dtbValues[k] = zzValues[k + 1];
          dtbIndexes[k] = zzIndexes[k + 1];
          dtbDir[k] = zzDir[k + 1];
        }
      }
    }

    const [index, lindex, llindex] = dtbIndexes;
    const [value, lvalue, llvalue] = dtbValues;

    // get_crossover_info()
    latestDoubleTop = doubleTop ? true : doubleBottom ? false : latestDoubleTop;
    latestDoubleBottom = doubleBottom ? true : doubleTop ? false : latestDoubleBottom;
    const doubleTopConfirmation = latestDoubleTop
      ? (topConfirm(b.low, lvalue) ? 1 : topInvalid(b.high, llvalue) ? -1 : 0) : 0;
    const doubleBottomConfirmation = latestDoubleBottom
      ? (bottomConfirm(b.high, lvalue) ? 1 : bottomInvalid(b.low, llvalue) ? -1 : 0) : 0;

    // draw_double_pattern()
    isBullish = doubleTop || doubleBottom ? doubleTop : isBullish;
    const risk = Math.abs(value - llvalue);
    const reward = Math.abs(value - lvalue);
    const riskPerReward = (risk * 100) / (risk + reward);
    const patternColor = doubleTop ? bearishColor : bullishColor;
    const base = line.new(index, value, llindex, llvalue, 'bar_index', 'none', patternColor, 'solid', 2);
    const l1 = line.new(index, value, lindex, lvalue, 'bar_index', 'none', patternColor, 'dotted', 2);
    const l2 = line.new(lindex, lvalue, llindex, llvalue, 'bar_index', 'none', patternColor, 'dotted', 2);
    const labelText = (doubleTop ? 'Double Top' : 'Double Bottom') +
      (cfg.DisplayRiskPerReward ? ' RR - ' + str.tostring(riskPerReward) : '');
    const baseLabel = label.new(index, value, labelText, 'bar_index', doubleTop ? 'abovebar' : 'belowbar',
      patternColor, doubleTop ? 'label_down' : 'label_up', textColor, 'normal');
    if (!(doubleTop || doubleBottom)) {
      line.delete(base);
      line.delete(l1);
      line.delete(l2);
      label.delete(baseLabel);
    }
    doubleTopCount = doubleTop ? doubleTopCount + 1 : doubleTopCount;
    doubleBottomCount = doubleBottom ? doubleBottomCount + 1 : doubleBottomCount;
    // a deleted line has an na x2: only two patterns in a row with the same outer pivot
    if (prevBase && line.get_x2(base) === line.get_x2(prevBase)) {
      line.delete(prevBase);
      line.delete(prevL1!);
      line.delete(prevL2!);
      label.delete(prevLabel!);
      doubleTopCount = doubleTop ? doubleTopCount - 1 : doubleTopCount;
      doubleBottomCount = doubleBottom ? doubleBottomCount - 1 : doubleBottomCount;
    }
    prevBase = base;
    prevL1 = l1;
    prevL2 = l2;
    prevLabel = baseLabel;

    if (isLast) {
      line.new(i, lvalue, lindex, lvalue, 'bar_index', 'left', isBullish ? bearishColor : bullishColor, 'dashed', 2);
      line.new(i, llvalue, llindex, llvalue, 'bar_index', 'left', isBullish ? bullishColor : bearishColor, 'dashed', 2);
    }

    let dtConf = doubleTopConfirmation > 0 ? 1 : 0;
    let dbConf = doubleBottomConfirmation > 0 ? 1 : 0;
    let dtInv = doubleTopConfirmation < 0 ? 1 : 0;
    let dbInv = doubleBottomConfirmation < 0 ? 1 : 0;
    if (doubleTopConfirmation !== 0 || doubleBottomConfirmation !== 0) {
      if (doubleTopConfirmation > 0 || doubleBottomConfirmation > 0) {
        let lresbreak: Line | null = line.new(lindex, lvalue, i, lvalue, 'bar_index', 'none',
          isBullish ? bearishColor : bullishColor, 'dashed', 2);
        if (lastResBreak && line.get_x1(lastResBreak) === line.get_x1(lresbreak)) {
          dtConf = 0;
          dbConf = 0;
          dtInv = 0;
          dbInv = 0;
          line.delete(lresbreak);
          lresbreak = lastResBreak;
        }
        lastResBreak = lresbreak;
      } else if (doubleTopConfirmation < 0 || doubleBottomConfirmation < 0) {
        let lsupbreak: Line | null = line.new(llindex, llvalue, i, llvalue, 'bar_index', 'none',
          isBullish ? bullishColor : bearishColor, 'dashed', 2);
        if (lastSupBreak && line.get_x1(lastSupBreak) === line.get_x1(lsupbreak)) {
          dtInv = 0;
          dbInv = 0;
          dtConf = 0;
          dbConf = 0;
          line.delete(lsupbreak);
          lsupbreak = lastSupBreak;
        }
        lastSupBreak = lsupbreak;
      }
    }
    dtConfCount += dtConf;
    dbConfCount += dbConf;
    dtInvCount += dtInv;
    dbInvCount += dbInv;

    flags[0][i] = doubleBottom;
    flags[1][i] = doubleBottomConfirmation > 0;
    flags[2][i] = doubleBottomConfirmation < 0;
    flags[3][i] = doubleTop;
    flags[4][i] = doubleTopConfirmation > 0;
    flags[5][i] = doubleTopConfirmation < 0;

    // var stats = table.new(position.top_right, 5, 5, border_width = 1)
    if (isLast) {
      const stats = table.new('top_right', 5, 5, undefined, undefined, undefined, undefined, 1);
      if (cfg.showStats) {
        const colorWorst = color.rgb(255, 153, 51);
        const colorBest = color.rgb(51, 204, 51);
        const colorBad = color.rgb(255, 204, 153);
        const colorGood = color.rgb(204, 255, 204);
        const colorNeutral = color.rgb(255, 255, 204);
        const dtPercent = dtConfCount + dtInvCount === 0 ? 0.5 : dtConfCount / (dtConfCount + dtInvCount);
        const dbPercent = dbConfCount + dbInvCount === 0 ? 0.5 : dbConfCount / (dbConfCount + dbInvCount);
        const ge = (a: number, x: number) => !lt(a, x);
        const pick = (p: number) => (ge(p, 0.8) ? colorBest : ge(p, 0.6) ? colorGood : ge(p, 0.4) ? colorNeutral
          : ge(p, 0.2) ? colorBad : colorWorst);
        const dtColor = pick(dtPercent);
        const dbColor = pick(dbPercent);
        const head = (c: number, r: number, text: string) =>
          table.cell(stats, c, r, text, undefined, undefined, WHITE, undefined, undefined, 'auto', BLACK);
        const num = (c: number, r: number, x: number, bg: string) =>
          table.cell(stats, c, r, str.tostring(x), undefined, undefined, BLACK, undefined, undefined, 'auto', bg);
        head(0, 0, '');
        head(0, 1, 'Double Top');
        head(0, 2, 'Double Bottom');
        head(1, 0, 'Count');
        head(2, 0, 'Confirmation');
        head(3, 0, 'Invalidation');
        num(1, 1, doubleTopCount, dtColor);
        num(1, 2, doubleBottomCount, dbColor);
        num(2, 1, dtConfCount, dtColor);
        num(3, 1, dtInvCount, dtColor);
        num(2, 2, dbConfCount, dbColor);
        num(3, 2, dbInvCount, dbColor);
      }
    }

    if (isLast && zzIndexes.length > 1) {
      const size = zzIndexes.length;
      for (let x = 0; x <= size - 1; x++) {
        const k = size - 1 - x;
        const pIndex = zzIndexes[k];
        const pValue = zzValues[k];
        const highLow = zzDir[k];
        const labelText = highLow === 2 ? 'HH' : highLow === 1 ? 'LH' : highLow === -1 ? 'HL' : 'LL';
        const labelColor = highLow === 2 ? bullishColor : highLow === 1 ? bullTrapColor
          : highLow === -1 ? bearTrapColor : bearishColor;
        const labelStyle = gt(highLow, 0) ? 'label_down' : 'label_up';
        if (cfg.showPivots) {
          const l = label.new(pIndex, pValue, labelText, 'bar_index', 'price', labelColor, labelStyle, textColor, 'tiny');
          labelArray.unshift(l);
          if (labelArray.length > 100) label.delete(labelArray.pop()!);
        }
        if (k < size - 1 && cfg.showZigzag) {
          const l = line.new(pIndex, pValue, zzIndexes[k + 1], zzValues[k + 1], 'bar_index', 'none', labelColor,
            'solid', 2);
          lineArray.unshift(l);
          if (lineArray.length > 100) line.delete(lineArray.pop()!);
        }
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const DoubleTopBottomUltimate = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
};
