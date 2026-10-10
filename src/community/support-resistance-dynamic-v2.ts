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
 * The original rounds the levels with the symbol price tick (syminfo.mintick). Bars carry no symbol info: the port
 * uses a tick of 0.01.
 *
 * Reference: "Support Resistance - Dynamic v2" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) LonesomeTheBlue
 */

import { ta, str, math, compare, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';

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
/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;

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

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistanceDynamicV2Inputs> = {},
): IndicatorResult & { markers: MarkerData[]; labels: LabelData[]; lines: LineDrawingData[] } {
  const {
    prd, ppsrc, maxNumPP, channelW, maxNumSR, minStrength, labelLoc, lineStyle, lineWidth, resistanceColor, supportColor, showPP,
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const src1 = new Series(bars, (b) => (ppsrc === 'High/Low' ? b.high : Math.max(b.close, b.open)));
  const src2 = new Series(bars, (b) => (ppsrc === 'High/Low' ? b.low : Math.min(b.close, b.open)));
  const phArr = ta.pivothigh(src1, prd, prd).toArray();
  const plArr = ta.pivotlow(src2, prd, prd).toArray();
  // Maximum channel width: a share of the 300-bar range (na for the first 299 bars: no pivot fits a channel)
  const highest = ta.highest(new Series(bars, (b) => b.high), 300).toArray();
  const lowest = ta.lowest(new Series(bars, (b) => b.low), 300).toArray();

  const markers: MarkerData[] = [];
  const pivotVals: number[] = [];
  let srUp: number[] = [];
  let srDn: number[] = [];
  // Levels drawn on the last pivot bar (the lines and labels of older pivot bars are deleted)
  let levels: number[] = [];
  let levelsBar = -1;

  for (let i = 0; i < n; i++) {
    const ph = phArr[i] ?? NaN;
    const pl = plArr[i] ?? NaN;
    // Pine bool(x): false for na and 0
    const isPh = !Number.isNaN(ph) && ph !== 0;
    const isPl = !Number.isNaN(pl) && pl !== 0;

    // plotshape(ph and showpp, text = 'H', style = shape.labeldown, color = na, textcolor = color.red,
    //   location = location.abovebar, offset = -prd) and the same with 'L' / labelup / color.lime / belowbar
    if (showPP && i - prd >= 0) {
      if (isPh) markers.push({ time: bars[i - prd].time, position: 'aboveBar', shape: 'labelDown', color: 'transparent', text: 'H', textColor: RED });
      if (isPl) markers.push({ time: bars[i - prd].time, position: 'belowBar', shape: 'labelUp', color: 'transparent', text: 'L', textColor: LIME });
    }

    if (!isPh && !isPl) continue;

    pivotVals.unshift(isPh ? ph : pl);
    if (pivotVals.length > maxNumPP) pivotVals.pop();

    const cwidth = ((highest[i] ?? NaN) - (lowest[i] ?? NaN)) * channelW / 100;
    srUp = [];
    srDn = [];
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

    levels = srUp.map((up, x) => math.round_to_mintick((up + srDn[x]) / 2, MINTICK));
    levelsBar = i;
  }

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
    markers,
    labels,
    lines,
  };
}

export const SupportResistanceDynamicV2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
