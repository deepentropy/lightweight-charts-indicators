/**
 * Support Resistance - Dynamic v2
 *
 * Keeps the last pivot highs / lows (`maxNumPP` values). On each new pivot it groups the pivots into channels not
 * wider than `channelW` percent of the 300-bar range, counts the pivots of each channel (its strength) and keeps the
 * `maxNumSR` strongest channels that do not overlap. The middle of each channel, rounded to the price tick, is a
 * support / resistance level: a line across the chart and a label with the level and its distance to the close in
 * percent. Lines and labels take the resistance colour when the level is at or above the close, else the support
 * colour. Optional 'H' / 'L' marks on the pivot bars.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Resistance Broken' on the bars whose close crosses above a level
 * (close[1] at or below it), 'Support Broken' on the bars whose close crosses below a level, 'Support or Resistance
 * Broken' on both.
 *
 * Chart values read: the symbol price tick (the levels are rounded to it). Without a chart context the tick is 0.01.
 *
 * Reference: "Support Resistance - Dynamic v2" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) LonesomeTheBlue
 */

import { taStep, str, math, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData, LineDrawingData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupportResistanceDynamicV2Inputs {
  /** Pivot Period */
  prd: number;
  /** Source */
  ppsrc: 'High/Low' | 'Close/Open';
  /** Maximum Number of Pivot */
  maxNumPP: number;
  /** Maximum Channel Width % */
  channelW: number;
  /** Maximum Number of S/R */
  maxNumSR: number;
  /** Minimum Strength */
  minStrength: number;
  /** Label Location (bars after the last bar; negative: bars before it) */
  labelLoc: number;
  /** Line Style */
  lineStyle: 'Solid' | 'Dotted' | 'Dashed';
  /** Line Width */
  lineWidth: number;
  /** Resistance Color */
  resistanceColor: string;
  /** Support Color */
  supportColor: string;
  /** Show Point Points */
  showPP: boolean;
}

// Colours of the original Pine version: color.red #FF5252, color.lime #00E676, color.white, color.black #363A45
const RED = '#FF5252';
const LIME = '#00E676';
const WHITE = '#FFFFFF';
const BLACK = '#363A45';

export const defaultInputs: SupportResistanceDynamicV2Inputs = {
  prd: 10,
  ppsrc: 'High/Low',
  maxNumPP: 20,
  channelW: 10,
  maxNumSR: 5,
  minStrength: 2,
  labelLoc: 20,
  lineStyle: 'Dashed',
  lineWidth: 2,
  resistanceColor: RED,
  supportColor: LIME,
  showPP: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'Pivot Period', defval: 10, min: 4, max: 30, group: 'Setup' },
  { id: 'ppsrc', type: 'string', title: 'Source', defval: 'High/Low', options: ['High/Low', 'Close/Open'], group: 'Setup' },
  { id: 'maxNumPP', type: 'int', title: ' Maximum Number of Pivot', defval: 20, min: 5, max: 100, group: 'Setup' },
  { id: 'channelW', type: 'int', title: 'Maximum Channel Width %', defval: 10, min: 1, group: 'Setup' },
  { id: 'maxNumSR', type: 'int', title: ' Maximum Number of S/R', defval: 5, min: 1, max: 10, group: 'Setup' },
  { id: 'minStrength', type: 'int', title: ' Minimum Strength', defval: 2, min: 1, max: 10, group: 'Setup' },
  {
    id: 'labelLoc', type: 'int', title: 'Label Location', defval: 20, group: 'Colors',
    tooltip: 'Positive numbers reference future bars, negative numbers reference histical bars',
  },
  { id: 'lineStyle', type: 'string', title: 'Line Style', defval: 'Dashed', options: ['Solid', 'Dotted', 'Dashed'], group: 'Colors' },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 4, group: 'Colors' },
  { id: 'resistanceColor', type: 'color', title: 'Resistance Color', defval: RED, group: 'Colors' },
  { id: 'supportColor', type: 'color', title: 'Support Color', defval: LIME, group: 'Colors' },
  { id: 'showPP', type: 'bool', title: 'Show Point Points', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support Resistance - Dynamic v2',
  shortTitle: 'SRv2',
  overlay: true,
};

type Result = IndicatorResult & { markers: MarkerData[]; labels: LabelData[]; lines: LineDrawingData[] } & { alerts: AlertConditionState[] };

interface SrVars {
  /** The last pivot values (newest first), changed in place: copyVars copies it */
  pivotVals: number[];
  /** Levels drawn on the last pivot bar (a new array on each pivot bar; the lines and labels of older pivot bars are deleted) */
  levels: number[];
  levelsBar: number;
}

interface SrRun extends BarRunState<SrVars> {
  mintick: number;
  ph: PivotStep;
  pl: PivotStep;
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SupportResistanceDynamicV2Inputs>): BarStudy<SrRun, Result> {
  const {
    prd, ppsrc, maxNumPP, channelW, maxNumSR, minStrength, labelLoc, lineStyle, lineWidth, resistanceColor, supportColor, showPP,
  } = { ...defaultInputs, ...inputs };
  return {
    init(_bars, chart) {
      const ph = new PivotStep(prd, prd, true);
      const pl = new PivotStep(prd, prd, false);
      const highest = taStep.highest();
      const lowest = taStep.lowest();
      const s: SrRun = {
        // syminfo.mintick
        mintick: mintickOf(chart),
        ph, pl, highest, lowest, markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [ph, pl, highest, lowest],
        vars: { pivotVals: [], levels: [], levelsBar: -1 },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const ph = s.ph.step(i, ppsrc === 'High/Low' ? b.high : Math.max(b.close, b.open));
      const pl = s.pl.step(i, ppsrc === 'High/Low' ? b.low : Math.min(b.close, b.open));
      // Maximum channel width: a share of the 300-bar range (na for the first 299 bars: no pivot fits a channel)
      const highest = s.highest.step(b.high, 300);
      const lowest = s.lowest.step(b.low, 300);
      // Pine bool(x): false for na and 0
      const isPh = !Number.isNaN(ph) && ph !== 0;
      const isPl = !Number.isNaN(pl) && pl !== 0;

      // plotshape(ph and showpp, text = 'H', style = shape.labeldown, color = na, textcolor = color.red,
      //   location = location.abovebar, offset = -prd) and the same with 'L' / labelup / color.lime / belowbar
      if (showPP && i - prd >= 0) {
        if (isPh) s.markers.push({ time: bars[i - prd].time, position: 'aboveBar', shape: 'labelDown', color: 'transparent', text: 'H', textColor: RED });
        if (isPl) s.markers.push({ time: bars[i - prd].time, position: 'belowBar', shape: 'labelUp', color: 'transparent', text: 'L', textColor: LIME });
      }

      if (isPh || isPl) {
        const pivotVals = v.pivotVals;
        pivotVals.unshift(isPh ? ph : pl);
        if (pivotVals.length > maxNumPP) pivotVals.pop();

        const cwidth = (highest - lowest) * channelW / 100;
        const srUp: number[] = [];
        const srDn: number[] = [];
        const srStrength: number[] = [];

        for (let x = 0; x < pivotVals.length; x++) {
          // get_sr_vals(x): the channel around pivot x and its number of pivots
          let lo = pivotVals[x];
          let hi = lo;
          let strength = 0;
          for (let y = 0; y < pivotVals.length; y++) {
            const cpp = pivotVals[y];
            const wdth = compare.le(cpp, lo) ? hi - cpp : cpp - lo;
            if (compare.le(wdth, cwidth)) {
              if (compare.le(cpp, hi)) lo = Math.min(lo, cpp);
              else hi = Math.max(hi, cpp);
              strength += 1;
            }
          }

          // check_sr(hi, lo, strength): the first kept channel that overlaps is removed when it is not stronger,
          // else the new channel is dropped
          let keep = true;
          for (let k = 0; k < srUp.length; k++) {
            const inUp = compare.ge(srUp[k], lo) && compare.le(srUp[k], hi);
            const inDn = compare.ge(srDn[k], lo) && compare.le(srDn[k], hi);
            if (inUp || inDn) {
              if (strength >= srStrength[k]) {
                srStrength.splice(k, 1);
                srUp.splice(k, 1);
                srDn.splice(k, 1);
              } else {
                keep = false;
              }
              break;
            }
          }
          if (!keep) continue;

          // find_loc(strength): position in the list sorted by strength (strongest first)
          let loc = srStrength.length;
          for (let k = srStrength.length - 1; k >= 0; k--) {
            if (strength <= srStrength[k]) break;
            loc = k;
          }
          if (loc < maxNumSR && strength >= minStrength) {
            srStrength.splice(loc, 0, strength);
            srUp.splice(loc, 0, hi);
            srDn.splice(loc, 0, lo);
            if (srStrength.length > maxNumSR) {
              srStrength.pop();
              srUp.pop();
              srDn.pop();
            }
          }
        }

        v.levels = srUp.map((up, x) => math.round_to_mintick((up + srDn[x]) / 2, s.mintick));
        v.levelsBar = i;
      }

      // f_crossed_over() / f_crossed_under() on every bar, with the levels of the last pivot bar
      const close = b.close;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      let over = false;
      let under = false;
      for (const mid of v.levels) {
        if (compare.le(close1, mid) && compare.gt(close, mid)) over = true;
        if (compare.ge(close1, mid) && compare.lt(close, mid)) under = true;
      }
      const flags = [over, under, over || under];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    copyVars: (v) => ({ ...v, pivotVals: v.pivotVals.slice() }),
    result(s, bars) {
      const n = bars.length;
      const { levels, levelsBar } = s.vars;
      // Lines and labels alive after the last bar. Every bar updates the label text, position and colours and the
      // line colour with the close of that bar.
      const labels: LabelData[] = [];
      const lines: LineDrawingData[] = [];
      if (n > 0 && levelsBar >= 0) {
        const close = bars[n - 1].close;
        const interval = barInterval(bars);
        const style = lineStyle === 'Dashed' ? 'dashed' : lineStyle === 'Solid' ? 'solid' : 'dotted';
        const labelTime = barTime(bars, n - 1 + labelLoc, interval);
        for (const mid of levels) {
          const above = compare.ge(mid, close);
          const rate = 100 * (mid - close) / close;
          if (Number.isFinite(labelTime) && Number.isFinite(mid)) {
            labels.push({
              time: labelTime, price: mid, text: str.tostring(mid) + '(' + str.tostring(rate, '#.##') + '%)',
              color: above ? RED : LIME, textColor: above ? WHITE : BLACK, style: above ? 'label_down' : 'label_up',
            });
          }
          if (Number.isFinite(mid)) {
            lines.push({
              time1: bars[levelsBar].time, price1: mid, time2: bars[levelsBar - 1].time, price2: mid,
              extend: 'both', color: above ? resistanceColor : supportColor, style, width: lineWidth,
            });
          }
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        labels,
        lines,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupportResistanceDynamicV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupportResistanceDynamicV2Inputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Resistance Broken', message: 'Resistance Broken' },
  { id: 'alert1', title: 'Support Broken', message: 'Support Broken' },
  { id: 'alert2', title: 'Support or Resistance Broken', message: 'Support or Resistance Broken' },
];

export const SupportResistanceDynamicV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
