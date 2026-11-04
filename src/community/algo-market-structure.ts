/**
 * Algo Market Structure (Nephew_Sam_)
 *
 * Market structure of the chart timeframe (or of a higher "Timeframe 1", read with lookahead as the original does).
 * On each new bar of that timeframe, the count of bars since its last bullish (bearish) candle drives the structure:
 * the highest high (lowest low) between the last structure point and the last candle of the other colour becomes a
 * new structure high (low) when it passes the previous one, or replaces the last one while the move goes on. Each
 * point gets a circle label and an "HH" / "LH" / "HL" / "LL" label; a new high also adds the lowest low between the
 * two last highs as a structure low (and the reverse). A valid higher high (lower low) draws:
 * - ILQ: a line at the last structure low (high), deleted when the price passes it
 * - TLQ: a line at the lower of the two last lows (higher of the two last highs); when the price breaks it the
 *   structure turns bearish (bullish) and a "BOS" line and label stay at the break; a close beyond a TLQ line also
 *   sets the structure direction
 * - EPA: a dashed line at the previous high (low); price efficiency is reached when the price comes back to it
 * - Extreme: a box from the body to the wick of the candle of the TLQ point, deleted when the price passes it
 * All of these reach 7 bars after the current bar. Valid trading range boxes (VTA) appear when the close leaves the
 * range of the last high and low after a HH-LL-HH (LL-HH-LL) sequence (Strict: four points) and are deleted when the
 * timeframe close passes them. MSU arrows (bottom of the pane) mark a bar that reaches back into the last swing, the
 * candles take the colours of the structure direction, a table (last bar) shows the timeframe, the direction, the
 * efficiency, the MSU and the VTA state. The x crosses of the 3-swing patterns are drawn only when the last separator
 * switch of the "Timeframe 1" group ("Change bar colors" line) is on, as in the original.
 *
 * Chart values (optional third argument of calculate): the chart timeframe (table text, bar duration of the 7-bar
 * projection) and, for a higher Timeframe 1, the exchange time zone and session (its periods). A Timeframe 1 below
 * the chart timeframe turns the structure off, as in the original.
 *
 * Reference: "Algo Market Structure (Nephew_Sam_)" by nephew_sam_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, timeframe, math, na, line, label, box, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type Box, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, higherTimeframeBars, periodChanges } from '../anchor-period';
import type { StudyDrawingKind } from '../style-outputs';

export interface AlgoMarketStructureInputs {
  tf1_useStructure: boolean;
  tf1_timeframe: string;
  tf1_min: string;
  tf1_div1: boolean;
  tf1_structureTopColor: string;
  tf1_structureBottomColor: string;
  tf1_structurelabelSize: string;
  tf1_showHhll: boolean;
  tf1_hhllBullColor: string;
  tf1_hhllBearColor: string;
  tf1_hhllLabelSize: string;
  tf1_div2: boolean;
  tf1_showIlq: boolean;
  tf1_ilqText: string;
  tf1_ilqStyle: string;
  tf1_ilqWidth: number;
  tf1_ilqCol: string;
  tf1_div3: boolean;
  tf1_showTlq: boolean;
  tf1_tlqText: string;
  tf1_showBos: boolean;
  tf1_tlqStyle: string;
  tf1_tlqWidth: number;
  tf1_tlqCol: string;
  tf1_div4: boolean;
  tf1_showEpa: boolean;
  tf1_epaText: string;
  tf1_epaDelete: boolean;
  tf1_epaStyle: string;
  tf1_epaWidth: number;
  tf1_epaCol: string;
  tf1_div5: boolean;
  tf1_showMsu: boolean;
  tf1_div6: boolean;
  tf1_showExtreme: boolean;
  tf1_extremeText: string;
  tf1_extremeCol: string;
  tf1_div7: boolean;
  tf1_showVta: boolean;
  tf1_strictVta: boolean;
  tf1_vtaText: string;
  tf1_vtaTopCol: string;
  tf1_vtaBottomCol: string;
  tf1_deleteVta: boolean;
  /** Separator switch; also turns on the pattern crosses (as in the original) */
  tf1_div8: boolean;
  tf1_changeBarCol: boolean;
  tf1_bullishBullBarCol: string;
  tf1_bullishBearBarCol: string;
  tf1_bearishBullBarCol: string;
  tf1_bearishBearBarCol: string;
  structure_show_table: boolean;
  structure_table_vertical: string;
  structure_table_horizontal: string;
  /** Indicator Start Date (UNIX ms) */
  indicator_start_time: number;
}

export const defaultInputs: AlgoMarketStructureInputs = {
  tf1_useStructure: true,
  tf1_timeframe: '',
  tf1_min: '',
  tf1_div1: false,
  tf1_structureTopColor: 'rgba(76,175,80,0.3)',
  tf1_structureBottomColor: 'rgba(76,175,80,0.3)',
  tf1_structurelabelSize: 'auto',
  tf1_showHhll: true,
  tf1_hhllBullColor: '#00E676',
  tf1_hhllBearColor: '#FF5252',
  tf1_hhllLabelSize: 'Small',
  tf1_div2: false,
  tf1_showIlq: true,
  tf1_ilqText: 'ILQ',
  tf1_ilqStyle: 'Solid',
  tf1_ilqWidth: 2,
  tf1_ilqCol: '#FF9800',
  tf1_div3: false,
  tf1_showTlq: true,
  tf1_tlqText: 'TLQ',
  tf1_showBos: true,
  tf1_tlqStyle: 'Solid',
  tf1_tlqWidth: 1,
  tf1_tlqCol: '#00E676',
  tf1_div4: false,
  tf1_showEpa: true,
  tf1_epaText: 'EPA',
  tf1_epaDelete: true,
  tf1_epaStyle: 'Dashed',
  tf1_epaWidth: 1,
  tf1_epaCol: '#2962ff',
  tf1_div5: false,
  tf1_showMsu: true,
  tf1_div6: false,
  tf1_showExtreme: true,
  tf1_extremeText: 'Extreme',
  tf1_extremeCol: 'rgba(120,123,134,0.2)',
  tf1_div7: false,
  tf1_showVta: true,
  tf1_strictVta: false,
  tf1_vtaText: 'Valid Trading Range',
  tf1_vtaTopCol: '#FF5252',
  tf1_vtaBottomCol: '#4CAF50',
  tf1_deleteVta: true,
  tf1_div8: false,
  tf1_changeBarCol: true,
  tf1_bullishBullBarCol: 'rgba(107,194,179,1)',
  tf1_bullishBearBarCol: 'rgba(53,141,131,1)',
  tf1_bearishBullBarCol: 'rgba(247,134,143,1)',
  tf1_bearishBearBarCol: 'rgba(193,81,95,1)',
  structure_show_table: true,
  structure_table_vertical: 'bottom',
  structure_table_horizontal: 'right',
  indicator_start_time: 1420146000000, // timestamp("02 Jan 2015 00:00 +0300")
};

const GRP_TF1 = '•••••••• Timeframe 1 Market Structure ••••••••';
const GRP_OTHER = '•••••••• Other Structure Settings ••••••••';
const SEP = '----------------------------------';
const STYLES = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'tf1_useStructure', type: 'bool', title: '', defval: true, inline: '1', group: GRP_TF1 },
  { id: 'tf1_timeframe', type: 'timeframe', title: 'Timeframe 1', defval: '', inline: '1', group: GRP_TF1 },
  { id: 'tf1_min', type: 'timeframe', title: 'Min', defval: '', inline: '1', group: GRP_TF1 },
  { id: 'tf1_div1', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_structureTopColor', type: 'color', title: 'Top', defval: 'rgba(76,175,80,0.3)', group: GRP_TF1, inline: '2' },
  { id: 'tf1_structureBottomColor', type: 'color', title: 'Bottom', defval: 'rgba(76,175,80,0.3)', group: GRP_TF1, inline: '2' },
  { id: 'tf1_structurelabelSize', type: 'string', title: 'Size', defval: 'auto', options: ['auto', 'Tiny', 'Small'], group: GRP_TF1, inline: '2' },
  { id: 'tf1_showHhll', type: 'bool', title: 'HH/LL Labels', defval: true, inline: '2b', group: GRP_TF1 },
  { id: 'tf1_hhllBullColor', type: 'color', title: 'Bull', defval: '#00E676', group: GRP_TF1, inline: '2b' },
  { id: 'tf1_hhllBearColor', type: 'color', title: 'Bear', defval: '#FF5252', group: GRP_TF1, inline: '2b' },
  { id: 'tf1_hhllLabelSize', type: 'string', title: 'Size', defval: 'Small', options: ['auto', 'Tiny', 'Small', 'Normal'], group: GRP_TF1, inline: '2b' },
  { id: 'tf1_div2', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_showIlq', type: 'bool', title: 'Show ILQ ?', defval: true, inline: '3', group: GRP_TF1 },
  { id: 'tf1_ilqText', type: 'string', title: 'Text', defval: 'ILQ', inline: '3', group: GRP_TF1 },
  { id: 'tf1_ilqStyle', type: 'string', title: 'Style', defval: 'Solid', options: STYLES, inline: '4', group: GRP_TF1 },
  { id: 'tf1_ilqWidth', type: 'int', title: 'Width', defval: 2, min: 1, max: 4, inline: '4', group: GRP_TF1 },
  { id: 'tf1_ilqCol', type: 'color', title: 'Col', defval: '#FF9800', inline: '4', group: GRP_TF1 },
  { id: 'tf1_div3', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_showTlq', type: 'bool', title: 'Show TLQ ?', defval: true, inline: '5', group: GRP_TF1 },
  { id: 'tf1_tlqText', type: 'string', title: 'Text', defval: 'TLQ', inline: '5', group: GRP_TF1 },
  { id: 'tf1_showBos', type: 'bool', title: 'Bos lines ?', defval: true, inline: '5', group: GRP_TF1 },
  { id: 'tf1_tlqStyle', type: 'string', title: 'Style', defval: 'Solid', options: STYLES, inline: '6', group: GRP_TF1 },
  { id: 'tf1_tlqWidth', type: 'int', title: 'Width', defval: 1, min: 1, max: 4, inline: '6', group: GRP_TF1 },
  { id: 'tf1_tlqCol', type: 'color', title: 'Col', defval: '#00E676', inline: '6', group: GRP_TF1 },
  { id: 'tf1_div4', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_showEpa', type: 'bool', title: 'Show EPA ?', defval: true, inline: '7', group: GRP_TF1 },
  { id: 'tf1_epaText', type: 'string', title: 'Text', defval: 'EPA', inline: '7', group: GRP_TF1 },
  { id: 'tf1_epaDelete', type: 'bool', title: 'Delete Unfilled', defval: true, inline: '7', group: GRP_TF1 },
  { id: 'tf1_epaStyle', type: 'string', title: 'Style', defval: 'Dashed', options: STYLES, inline: '8', group: GRP_TF1 },
  { id: 'tf1_epaWidth', type: 'int', title: 'Width', defval: 1, min: 1, max: 4, inline: '8', group: GRP_TF1 },
  { id: 'tf1_epaCol', type: 'color', title: 'Col', defval: '#2962ff', inline: '8', group: GRP_TF1 },
  { id: 'tf1_div5', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_showMsu', type: 'bool', title: 'Show MSU Arrows ?', defval: true, inline: '9', group: GRP_TF1 },
  { id: 'tf1_div6', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_showExtreme', type: 'bool', title: 'Show Extreme ?', defval: true, inline: '10', group: GRP_TF1 },
  { id: 'tf1_extremeText', type: 'string', title: 'Text', defval: 'Extreme', inline: '10', group: GRP_TF1 },
  { id: 'tf1_extremeCol', type: 'color', title: 'Col', defval: 'rgba(120,123,134,0.2)', inline: '10', group: GRP_TF1 },
  { id: 'tf1_div7', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  { id: 'tf1_showVta', type: 'bool', title: 'Show VTA ?', defval: true, inline: '11', group: GRP_TF1 },
  { id: 'tf1_strictVta', type: 'bool', title: 'Strict ?', defval: false, inline: '11', group: GRP_TF1 },
  { id: 'tf1_vtaText', type: 'string', title: 'Text', defval: 'Valid Trading Range', inline: '11', group: GRP_TF1 },
  { id: 'tf1_vtaTopCol', type: 'color', title: 'Top Col', defval: '#FF5252', inline: '12', group: GRP_TF1 },
  { id: 'tf1_vtaBottomCol', type: 'color', title: 'Bottom Col', defval: '#4CAF50', inline: '12', group: GRP_TF1 },
  { id: 'tf1_deleteVta', type: 'bool', title: 'Delete filled ?', defval: true, inline: '12', group: GRP_TF1 },
  { id: 'tf1_div8', type: 'bool', title: SEP, defval: false, group: GRP_TF1 },
  {
    id: 'tf1_changeBarCol', type: 'bool', title: 'Change bar colors (read tooltip)?', defval: true, inline: '13', group: GRP_TF1,
    tooltip: 'Right click on your indicator, then under visual order select bring to front.\n\nSelect only 1 timeframe at a time.',
  },
  { id: 'tf1_bullishBullBarCol', type: 'color', title: 'Bullish Bull', defval: 'rgba(107,194,179,1)', inline: '14', group: GRP_TF1 },
  { id: 'tf1_bullishBearBarCol', type: 'color', title: 'Bullish Bear', defval: 'rgba(53,141,131,1)', inline: '14', group: GRP_TF1 },
  { id: 'tf1_bearishBullBarCol', type: 'color', title: 'Bearish Bull', defval: 'rgba(247,134,143,1)', inline: '15', group: GRP_TF1 },
  { id: 'tf1_bearishBearBarCol', type: 'color', title: 'Bearish Bear', defval: 'rgba(193,81,95,1)', inline: '15', group: GRP_TF1 },
  { id: 'structure_show_table', type: 'bool', title: 'Table', defval: true, inline: '1', group: GRP_OTHER },
  { id: 'structure_table_vertical', type: 'string', title: '↕', defval: 'bottom', inline: '2', group: GRP_OTHER, options: ['top', 'middle', 'bottom'] },
  { id: 'structure_table_horizontal', type: 'string', title: '↔', defval: 'right', inline: '2', group: GRP_OTHER, options: ['left', 'center', 'right'] },
  {
    id: 'indicator_start_time', type: 'time', title: 'Indicator Start Date', defval: 1420146000000, group: GRP_OTHER,
    tooltip: 'You can set a recent time if structure has been in a long range',
  },
];

export const plotConfig: PlotConfig[] = [];

const RED = '#FF5252';
const LIME = '#00E676';
const GREEN = '#4CAF50';
/** color.black of this Pine version; also the default text colour of labels and table cells */
const BLACK = '#363A45';
const LABEL_TEXT = BLACK;

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Shapes', style: 'arrowdown', location: 'bottom', color: RED, size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Shapes', style: 'arrowup', location: 'bottom', color: LIME, size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Shapes', style: 'xcross', location: 'bottom', color: RED, size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Shapes', style: 'xcross', location: 'bottom', color: LIME, size: 'tiny' },
];

export const plotCandleConfig = [{ id: 'candles', title: 'Title' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'Algo Market Structure (Nephew_Sam_)',
  shortTitle: 'Algo Market Structure (Nephew_Sam_)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !eq(a, b);
const nz = (v: number) => (Number.isNaN(v) ? 0 : v);

const MIN = -9999999999999999999.0;
const MAX = 9999999999999999999.0;
const LABEL_SPACE = '          ';

const getLineStyle = (s: string): 'solid' | 'dashed' | 'dotted' => (s === 'Solid' ? 'solid' : s === 'Dashed' ? 'dashed' : 'dotted');
const getlabelSize = (s: string) =>
  s === 'auto' ? 'auto' : s === 'Tiny' ? 'tiny' : s === 'Small' ? 'small' : s === 'Normal' ? 'normal' : 'huge';

/** resolutionInMinutes() of the original for a timeframe string */
function minutesOf(tf: string): number {
  const info = timeframe.info(tf);
  const unit = info.isseconds ? 1 / 60 : info.isminutes ? 1 : info.isdaily ? 60 * 24 : info.isweekly ? 60 * 24 * 7
    : info.ismonthly ? 60 * 24 * 30.4375 : NaN;
  return info.multiplier * unit;
}

/** PineScript timeframe.period: "D" / "W" / "M" for a multiplier of 1 */
const periodText = (tf: string) => tf.replace(/^1([DWM])$/, '$1');

export function calculate(
  bars: Bar[],
  inputs: Partial<AlgoMarketStructureInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;
  const T = bars.map((b) => b.time * ms);
  const O = bars.map((b) => b.open);
  const H = bars.map((b) => b.high);
  const L = bars.map((b) => b.low);
  const C = bars.map((b) => b.close);
  const at = (arr: number[], i: number) => (i >= 0 && i < n ? arr[i] : NaN);

  const chartTf = n > 0 ? chartTimeframe(bars, chart) : '';
  const chartMin = chartTf === '' ? NaN : minutesOf(chartTf);
  const chartSec = chartTf === '' ? NaN : timeframe.in_seconds(chartTf);
  const tfMin = (tf: string) => (tf.trim() === '' ? chartMin : minutesOf(tf));

  // isHigherTimeframe(): the chart timeframe is above the given one
  const tf1 = cfg.tf1_timeframe;
  const notHigher = !(chartMin > tfMin(tf1));
  const minOk = chartMin >= tfMin(cfg.tf1_min);
  const sameTf = tf1.trim() === '' || tfMin(tf1) === chartMin;

  // request.security(syminfo.tickerid, tf1, ..., lookahead = barmerge.lookahead_on): the bar of tf1 that contains the
  // chart bar (its final values, the partial bar at the end); the chart series itself on the chart timeframe
  let hO = O, hH = H, hL = L, hC = C, hT = T;
  let group: number[] = bars.map((_, i) => i);
  let newbar: boolean[] = bars.map((_, i) => i > 0); // ta.change(time) > 0
  if (!sameTf && notHigher && n > 0) {
    const htf = higherTimeframeBars(bars, tf1, chart);
    hO = htf.htf.map((b) => b.open);
    hH = htf.htf.map((b) => b.high);
    hL = htf.htf.map((b) => b.low);
    hC = htf.htf.map((b) => b.close);
    hT = htf.htf.map((b) => b.time * ms);
    group = htf.group;
    newbar = periodChanges(bars, tf1, chart); // ta.change(time(tf1)) > 0
  }
  const hn = hO.length;
  const hat = (arr: number[], g: number) => (g >= 0 && g < hn ? arr[g] : NaN);
  // ta.barssince(tf1_lastBullCandle / tf1_lastBearCandle) on the bars of tf1
  const countBullH = new Array<number>(hn).fill(NaN);
  const countBearH = new Array<number>(hn).fill(NaN);
  {
    let lastBull = false;
    let lastBear = false;
    let bullAt = -1;
    let bearAt = -1;
    for (let g = 0; g < hn; g++) {
      const c1 = hat(hC, g - 1);
      const o1 = hat(hO, g - 1);
      if (gt(c1, o1)) { lastBull = true; lastBear = false; }
      if (lt(c1, o1)) { lastBull = false; lastBear = true; }
      if (lastBull) bullAt = g;
      if (lastBear) bearAt = g;
      countBullH[g] = bullAt < 0 ? NaN : g - bullAt;
      countBearH[g] = bearAt < 0 ? NaN : g - bearAt;
    }
  }

  // Candle helpers (history offsets of the chart bar i)
  let i = 0;
  const isNeutral = (k: number) => eq(at(O, i - k), at(C, i - k));
  const isBearish = (k: number) => (isNeutral(k) ? lt(at(C, i - k - 1), at(O, i - k - 1)) : lt(at(C, i - k), at(O, i - k)));
  const isBullish = (k: number) => (isNeutral(k) ? gt(at(C, i - k - 1), at(O, i - k - 1)) : gt(at(C, i - k), at(O, i - k)));

  // timesArray: the times of the bars up to the current one
  const firstIndexOfTime = new Map<number, number>();
  T.forEach((t, k) => { if (!firstIndexOfTime.has(t)) firstIndexOfTime.set(t, k); });
  const barIndexAtTime = (t: number): number => {
    const idx = Number.isNaN(t) ? undefined : firstIndexOfTime.get(t);
    let result: number;
    if (idx === undefined || idx > i) {
      // timeToBarIndex()
      const c0 = math.round((T[i] - t) / (1000 * chartSec));
      result = c0 <= 5000 ? Math.abs(math.round(c0)) : 5000;
    } else {
      result = i - idx;
    }
    return result <= 5000 ? Math.abs(math.round(result)) : 5000;
  };
  // a negative history offset cannot occur (the window ends at the current bar); it is read as na
  const findHighestBetweenTimes = (t1: number, t2: number, def: number): [number, number] => {
    let highest = def;
    let highestTime = t1;
    const s0 = barIndexAtTime(t1);
    const s1 = barIndexAtTime(t2);
    if (t1 > t2) {
      const from = isBullish(s1) ? s1 : s1 - 1;
      const to = isBearish(s0) ? s0 : s0 + 1;
      const step = from <= to ? 1 : -1;
      for (let k = from; step > 0 ? k <= to : k >= to; k += step) {
        const v = k < 0 ? NaN : at(H, i - k);
        if (gt(v, highest)) {
          highest = v;
          highestTime = k < 0 ? NaN : at(T, i - k);
        }
      }
    }
    return [highest, highestTime];
  };
  const findLowestBetweenTimes = (t1: number, t2: number, def: number): [number, number] => {
    let lowest = def;
    let lowestTime = t1;
    const s0 = barIndexAtTime(t1);
    const s1 = barIndexAtTime(t2);
    if (t1 > t2) {
      const from = isBearish(s1) ? s1 : s1 - 1;
      const to = isBullish(s0) ? s0 : s0 + 1;
      const step = from <= to ? 1 : -1;
      for (let k = from; step > 0 ? k <= to : k >= to; k += step) {
        const v = k < 0 ? NaN : at(L, i - k);
        if (lt(v, lowest)) {
          lowest = v;
          lowestTime = k < 0 ? NaN : at(T, i - k);
        }
      }
    }
    return [lowest, lowestTime];
  };

  const notNa = (o: object | undefined | null): o is object => o != null && !na(o);
  const deleteLine = (l: Line | undefined) => { if (notNa(l)) line.delete(l); };
  const deleteLabel = (l: Label | undefined) => { if (notNa(l)) label.delete(l); };
  const deleteBox = (b: Box | undefined) => { if (notNa(b)) box.delete(b); };
  const lineX1 = (l: Line | undefined) => (l ? line.get_x1(l) : NaN);
  const lineY1 = (l: Line | undefined) => (l ? line.get_y1(l) : NaN);

  resetDrawings({ line: 300, label: 300 });

  const pivotHighs: number[] = new Array(5).fill(MIN);
  const pivotHighsTime: number[] = new Array(5).fill(NaN);
  const pivotLows: number[] = new Array(5).fill(MAX);
  const pivotLowsTime: number[] = new Array(5).fill(NaN);
  const pivotHighLabel = varDrawing<Label>();
  const pivotLowLabel = varDrawing<Label>();
  const pivotHighHhllLabel = varDrawing<Label>();
  const pivotLowHhllLabel = varDrawing<Label>();
  let mostRecentBullCount1 = n > 0 ? T[0] : NaN;
  let mostRecentBearCount1 = n > 0 ? T[0] : NaN;
  let initialised = false;

  let isPriceEfficient = false;
  let structureDirection = 'bullish';
  let bottomTlqPrice = NaN;
  let topTlqPrice = NaN;
  let bottomIlqPrice = NaN;
  let topIlqPrice = NaN;
  const bottomIlqLine = varDrawing<Line>();
  const topIlqLine = varDrawing<Line>();
  const bottomIlqLabel = varDrawing<Label>();
  const topIlqLabel = varDrawing<Label>();
  const bottomTlqLine = varDrawing<Line>();
  const topTlqLine = varDrawing<Line>();
  const bottomTlqLabel = varDrawing<Label>();
  const topTlqLabel = varDrawing<Label>();
  const usedBosTimes: number[] = [];
  const bottomExtremeBox = varDrawing<Box>();
  const topExtremeBox = varDrawing<Box>();
  let prevBottomExtremeBox: Box | undefined;
  let prevTopExtremeBox: Box | undefined;
  let bearEpaPrice = NaN;
  let bullEpaPrice = NaN;
  const bearEpaLine = varDrawing<Line>();
  const bullEpaLine = varDrawing<Line>();
  const bearEpaLabel = varDrawing<Label>();
  const bullEpaLabel = varDrawing<Label>();
  const bottomVtaBoxes: Box[] = [];
  const topVtaBoxes: Box[] = [];
  const usedVtaTimes: number[] = [];
  let prevValidHH = false;
  let prevValidLL = false;

  const TRANSPARENT = String(color.new('#FFFFFF', 100));
  const extremeTextCol = String(color.new(cfg.tf1_extremeCol, 0));
  const includes = (arr: number[], v: number) => !Number.isNaN(v) && arr.some((x) => eq(x, v));

  const markers: MarkerData[] = [];
  const candles: PlotCandleData[] = [];
  let isUseLast = false;
  let isBullishMsu = false;
  let isBearishMsu = false;
  let isBullishVta = false;
  let isBearishVta = false;

  for (i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const g = group[i];
    const tf1_open = hat(hO, g), tf1_high = hat(hH, g), tf1_low = hat(hL, g), tf1_close = hat(hC, g), tf1_time = hat(hT, g);
    const tf1_open1 = hat(hO, g - 1), tf1_close1 = hat(hC, g - 1), tf1_time1 = hat(hT, g - 1);
    const countBull = hat(countBullH, g);
    const countBear = hat(countBearH, g);
    const isUse = notHigher && minOk && cfg.tf1_useStructure && T[i] > cfg.indicator_start_time;
    // _TimeTo = f_timeFrom(7)
    const timeTo = Math.trunc(T[i] + chartMin * 60 * 1000 * 7);
    const high = H[i], low = L[i], close = C[i], open = O[i];

    let isStructureHigh = false;
    let isStructureLow = false;
    const canPlot = newbar[i] && isUse;

    if (canPlot && !initialised) {
      pivotHighsTime.unshift(tf1_time);
      pivotHighs.unshift(tf1_high);
      pivotLowsTime.unshift(tf1_time);
      pivotLows.unshift(tf1_low);
      initialised = true;
    }

    if (canPlot) {
      // --- STRUCTURE HIGH ---
      if (countBull >= 1) {
        const t0 = gt(tf1_close1, tf1_open1) ? tf1_time1 : tf1_time;
        const [highest, highestTime] = findHighestBetweenTimes(t0, pivotHighsTime[0], MIN);
        if (countBull === 1) mostRecentBullCount1 = t0;
        if (gt(highest, pivotHighs[0])) {
          if ((countBull === 1 && ne(tf1_close1, tf1_open1))
            || (countBull > 1 && highestTime >= mostRecentBullCount1 && lt(tf1_close, tf1_open))) {
            isStructureHigh = true;
            pivotHighsTime.unshift(highestTime);
            pivotHighs.unshift(highest);
            pivotHighLabel.value = label.new(highestTime, highest, '', 'bar_time', 'price', cfg.tf1_structureTopColor, 'circle',
              LABEL_TEXT, getlabelSize(cfg.tf1_structurelabelSize));
            if (cfg.tf1_showHhll) {
              pivotHighHhllLabel.value = label.new(highestTime, highest, 'HH', 'bar_time', 'abovebar', undefined, 'none',
                cfg.tf1_hhllBullColor, getlabelSize(cfg.tf1_hhllLabelSize));
            }
            const [lowest, lowestTime] = findLowestBetweenTimes(pivotHighsTime[0], pivotHighsTime[1], MAX);
            if (!Number.isNaN(lowestTime) && !Number.isNaN(pivotLowsTime[0]) && lowestTime !== pivotLowsTime[0]) {
              pivotLowsTime.unshift(lowestTime);
              pivotLows.unshift(lowest);
              pivotLowLabel.value = label.new(lowestTime, lowest, '', 'bar_time', 'price', cfg.tf1_structureBottomColor, 'circle',
                LABEL_TEXT, getlabelSize(cfg.tf1_structurelabelSize));
              if (cfg.tf1_showHhll) {
                pivotLowHhllLabel.value = label.new(lowestTime, lowest, 'HL', 'bar_time', 'belowbar', undefined, 'none',
                  cfg.tf1_hhllBullColor, getlabelSize(cfg.tf1_hhllLabelSize));
              }
            }
          } else if (countBull > 1 && pivotHighsTime[0] >= mostRecentBullCount1 && lt(tf1_close, tf1_open)) {
            pivotHighsTime[0] = highestTime;
            pivotHighs[0] = highest;
            if (pivotHighLabel.value) label.delete(pivotHighLabel.value);
            pivotHighLabel.value = label.new(highestTime, highest, '', 'bar_time', 'price', cfg.tf1_structureTopColor, 'circle',
              LABEL_TEXT, getlabelSize(cfg.tf1_structurelabelSize));
            if (cfg.tf1_showHhll) {
              if (pivotHighHhllLabel.value) label.delete(pivotHighHhllLabel.value);
              pivotHighHhllLabel.value = label.new(highestTime, highest, 'HH', 'bar_time', 'abovebar', undefined, 'none',
                cfg.tf1_hhllBullColor, getlabelSize(cfg.tf1_hhllLabelSize));
            }
          }
        }
      }

      // --- STRUCTURE LOW ---
      if (countBear >= 1) {
        const t0 = lt(tf1_close1, tf1_open1) ? tf1_time1 : tf1_time;
        const [lowest, lowestTime] = findLowestBetweenTimes(t0, pivotLowsTime[0], MAX);
        if (countBear === 1) mostRecentBearCount1 = t0;
        if (lt(lowest, pivotLows[0])) {
          if ((countBear === 1 && ne(tf1_close1, tf1_open1))
            || (countBear > 1 && lowestTime >= mostRecentBearCount1 && gt(tf1_close, tf1_open))) {
            isStructureLow = true;
            pivotLowsTime.unshift(lowestTime);
            pivotLows.unshift(lowest);
            pivotLowLabel.value = label.new(lowestTime, lowest, '', 'bar_time', 'price', cfg.tf1_structureBottomColor, 'circle',
              LABEL_TEXT, getlabelSize(cfg.tf1_structurelabelSize));
            if (cfg.tf1_showHhll) {
              pivotLowHhllLabel.value = label.new(lowestTime, lowest, 'LL', 'bar_time', 'belowbar', undefined, 'none',
                cfg.tf1_hhllBearColor, getlabelSize(cfg.tf1_hhllLabelSize));
            }
            const [highest, highestTime] = findHighestBetweenTimes(pivotLowsTime[0], pivotLowsTime[1], MIN);
            if (!Number.isNaN(highestTime) && !Number.isNaN(pivotHighsTime[0]) && highestTime !== pivotHighsTime[0]) {
              pivotHighsTime.unshift(highestTime);
              pivotHighs.unshift(highest);
              pivotHighLabel.value = label.new(highestTime, highest, '', 'bar_time', 'price', cfg.tf1_structureTopColor, 'circle',
                LABEL_TEXT, getlabelSize(cfg.tf1_structurelabelSize));
              if (cfg.tf1_showHhll) {
                pivotHighHhllLabel.value = label.new(highestTime, highest, 'LH', 'bar_time', 'abovebar', undefined, 'none',
                  cfg.tf1_hhllBearColor, getlabelSize(cfg.tf1_hhllLabelSize));
              }
            }
          } else if (countBear > 1 && pivotLowsTime[0] >= mostRecentBearCount1 && gt(tf1_close, tf1_open)) {
            pivotLowsTime[0] = lowestTime;
            pivotLows[0] = lowest;
            if (pivotLowLabel.value) label.delete(pivotLowLabel.value);
            pivotLowLabel.value = label.new(lowestTime, lowest, '', 'bar_time', 'price', cfg.tf1_structureBottomColor, 'circle',
              LABEL_TEXT, getlabelSize(cfg.tf1_structurelabelSize));
            if (cfg.tf1_showHhll) {
              if (pivotLowHhllLabel.value) label.delete(pivotLowHhllLabel.value);
              pivotLowHhllLabel.value = label.new(lowestTime, lowest, 'LL', 'bar_time', 'belowbar', undefined, 'none',
                cfg.tf1_hhllBearColor, getlabelSize(cfg.tf1_hhllLabelSize));
            }
          }
        }
      }
    }

    const [ph0, ph1, ph2, ph3] = pivotHighs;
    const [pl0, pl1, pl2, pl3] = pivotLows;
    const [ph0Time, ph1Time] = pivotHighsTime;
    const [pl0Time, pl1Time] = pivotLowsTime;

    // --- STATS ---
    isBullishMsu = false;
    isBearishMsu = false;
    isBullishVta = false;
    isBearishVta = false;
    const isValidHH = structureDirection === 'bullish'
      ? isStructureHigh && gt(ph0, ph1) && gt(ph0, ph2)
      : isStructureHigh && gt(ph0, nz(topTlqPrice));
    const isValidLL = structureDirection === 'bearish'
      ? isStructureLow && lt(pl0, pl1) && lt(pl0, pl2)
      : isStructureLow && lt(pl0, nz(bottomTlqPrice));

    // --- ILQ ---
    if (cfg.tf1_showIlq) {
      if (canPlot) {
        if (isValidHH || isValidLL) {
          deleteLine(bottomIlqLine.value);
          deleteLine(topIlqLine.value);
          deleteLabel(bottomIlqLabel.value);
          deleteLabel(topIlqLabel.value);
        }
        if (isValidHH) {
          bottomIlqPrice = pl0;
          topIlqPrice = NaN;
          bottomIlqLine.value = line.new(pl0Time, pl0, timeTo, pl0, 'bar_time', 'none', cfg.tf1_ilqCol, getLineStyle(cfg.tf1_ilqStyle), cfg.tf1_ilqWidth);
          bottomIlqLabel.value = label.new(timeTo, pl0, cfg.tf1_ilqText + LABEL_SPACE, 'bar_time', 'price', undefined, 'none', cfg.tf1_ilqCol, 'normal');
        }
        if (isValidLL) {
          topIlqPrice = ph0;
          bottomIlqPrice = NaN;
          topIlqLine.value = line.new(ph0Time, ph0, timeTo, ph0, 'bar_time', 'none', cfg.tf1_ilqCol, getLineStyle(cfg.tf1_ilqStyle), cfg.tf1_ilqWidth);
          topIlqLabel.value = label.new(timeTo, ph0, cfg.tf1_ilqText + LABEL_SPACE, 'bar_time', 'price', undefined, 'none', cfg.tf1_ilqCol, 'normal');
        }
      }
      if (notNa(bottomIlqLine.value)) line.set_x2(bottomIlqLine.value, timeTo);
      if (notNa(bottomIlqLabel.value)) label.set_x(bottomIlqLabel.value, timeTo);
      if (notNa(bottomIlqLine.value) && lt(tf1_low, bottomIlqPrice)) {
        line.delete(bottomIlqLine.value);
        if (notNa(bottomIlqLabel.value)) label.delete(bottomIlqLabel.value);
      }
      if (notNa(topIlqLine.value)) line.set_x2(topIlqLine.value, timeTo);
      if (notNa(topIlqLabel.value)) label.set_x(topIlqLabel.value, timeTo);
      if (notNa(topIlqLine.value) && gt(tf1_high, topIlqPrice)) {
        line.delete(topIlqLine.value);
        if (notNa(topIlqLabel.value)) label.delete(topIlqLabel.value);
      }
    }

    // --- TLQ ---
    if (cfg.tf1_showTlq) {
      const bLine = bottomTlqLine.value;
      if (notNa(bLine)
        && (lt(low, bottomTlqPrice) || (prevValidHH && lt(at(L, i - 1), bottomTlqPrice))
          || (lt(at(L, i - 2), pl1) && lt(at(L, i - 2), pl2) && lt(at(L, i - 2), bottomTlqPrice)))
        && !includes(usedBosTimes, lineX1(bLine))) {
        structureDirection = 'bearish';
        bottomTlqPrice = NaN;
        usedBosTimes.unshift(lineX1(bLine));
        if (cfg.tf1_showBos) {
          line.new(lineX1(bLine), lineY1(bLine), T[i], lineY1(bLine), 'bar_time', 'none', RED);
          label.new(T[i], lineY1(bLine), 'BOS' + LABEL_SPACE, 'bar_time', 'price', undefined, 'none', RED, 'normal');
        }
        line.delete(bLine);
        if (notNa(bottomTlqLabel.value)) label.delete(bottomTlqLabel.value);
      }
      const tLine = topTlqLine.value;
      // the original tests the x1 of the BOTTOM TLQ line here
      if (notNa(tLine)
        && (gt(high, topTlqPrice) || (prevValidLL && gt(high, topTlqPrice))
          || (gt(at(H, i - 2), ph1) && gt(at(H, i - 2), ph2) && gt(at(H, i - 2), topTlqPrice)))
        && !includes(usedBosTimes, lineX1(bottomTlqLine.value))) {
        structureDirection = 'bullish';
        topTlqPrice = NaN;
        usedBosTimes.unshift(lineX1(tLine));
        if (cfg.tf1_showBos) {
          line.new(lineX1(tLine), lineY1(tLine), T[i], lineY1(tLine), 'bar_time', 'none', GREEN);
          label.new(T[i], lineY1(tLine), 'BOS' + LABEL_SPACE, 'bar_time', 'price', undefined, 'none', GREEN, 'normal');
        }
        line.delete(tLine);
        if (notNa(topTlqLabel.value)) label.delete(topTlqLabel.value);
      }
      if (lt(close, lineY1(topTlqLine.value))) structureDirection = 'bearish';
      if (gt(close, lineY1(bottomTlqLine.value))) structureDirection = 'bullish';

      if (canPlot) {
        if (isValidHH || isValidLL) {
          deleteLine(bottomTlqLine.value);
          deleteLine(topTlqLine.value);
          deleteLabel(bottomTlqLabel.value);
          deleteLabel(topTlqLabel.value);
        }
        if (isValidHH) {
          bottomTlqPrice = lt(pl1, pl0) ? pl1 : pl0;
          const bottomTlqTime = lt(pl1, pl0) ? pl1Time : pl0Time;
          topTlqPrice = NaN;
          if (!includes(usedBosTimes, bottomTlqTime)) {
            bottomTlqLine.value = line.new(bottomTlqTime, bottomTlqPrice, timeTo, bottomTlqPrice, 'bar_time', 'none', cfg.tf1_tlqCol,
              getLineStyle(cfg.tf1_tlqStyle), cfg.tf1_tlqWidth);
            bottomTlqLabel.value = label.new(timeTo, bottomTlqPrice, cfg.tf1_tlqText + LABEL_SPACE, 'bar_time', 'price', undefined, 'none',
              cfg.tf1_tlqCol, 'normal');
          }
        }
        if (isValidLL) {
          topTlqPrice = gt(ph1, ph0) ? ph1 : ph0;
          const topTlqTime = gt(ph1, ph0) ? ph1Time : ph0Time;
          bottomTlqPrice = NaN;
          if (!includes(usedBosTimes, topTlqTime)) {
            topTlqLine.value = line.new(topTlqTime, topTlqPrice, timeTo, topTlqPrice, 'bar_time', 'none', cfg.tf1_tlqCol,
              getLineStyle(cfg.tf1_tlqStyle), cfg.tf1_tlqWidth);
            topTlqLabel.value = label.new(timeTo, topTlqPrice, cfg.tf1_tlqText + LABEL_SPACE, 'bar_time', 'price', undefined, 'none',
              cfg.tf1_tlqCol, 'normal');
          }
        }
      }
      if (notNa(bottomTlqLine.value)) line.set_x2(bottomTlqLine.value, timeTo);
      if (notNa(bottomTlqLabel.value)) label.set_x(bottomTlqLabel.value, timeTo);
      if (notNa(topTlqLine.value)) line.set_x2(topTlqLine.value, timeTo);
      if (notNa(topTlqLabel.value)) label.set_x(topTlqLabel.value, timeTo);
    }

    // --- EXTREME ---
    if (cfg.tf1_showExtreme) {
      if (canPlot) {
        if (isValidHH || isValidLL) {
          deleteBox(bottomExtremeBox.value);
          deleteBox(topExtremeBox.value);
        }
        if (isValidHH) {
          const price = lt(pl1, pl0) ? pl1 : pl0;
          const t = lt(pl1, pl0) ? pl1Time : pl0Time;
          const biL = barIndexAtTime(t);
          const o = at(O, i - biL), c = at(C, i - biL);
          const lowestBody = gt(o, c) ? c : o;
          if (biL > 1) {
            bottomExtremeBox.value = box.new(t, lowestBody, timeTo, price, TRANSPARENT, 1, 'solid', 'none', 'bar_time', cfg.tf1_extremeCol,
              cfg.tf1_extremeText, 'small', extremeTextCol, 'right', 'top');
            deleteBox(prevBottomExtremeBox);
          }
        }
        if (isValidLL) {
          const price = gt(ph1, ph0) ? ph1 : ph0;
          const t = gt(ph1, ph0) ? ph1Time : ph0Time;
          const biH = barIndexAtTime(t);
          const o = at(O, i - biH), c = at(C, i - biH);
          const highestBody = lt(o, c) ? c : o;
          if (biH > 1) {
            topExtremeBox.value = box.new(t, price, timeTo, highestBody, TRANSPARENT, 1, 'solid', 'none', 'bar_time', cfg.tf1_extremeCol,
              cfg.tf1_extremeText, 'small', extremeTextCol, 'right', 'bottom');
            deleteBox(prevTopExtremeBox);
          }
        }
      }
      if (notNa(bottomExtremeBox.value)) box.set_right(bottomExtremeBox.value, timeTo);
      if (notNa(bottomExtremeBox.value) && lt(low, box.get_bottom(bottomExtremeBox.value))) deleteBox(bottomExtremeBox.value);
      if (notNa(topExtremeBox.value)) box.set_right(topExtremeBox.value, timeTo);
      if (notNa(topExtremeBox.value) && gt(high, box.get_top(topExtremeBox.value))) deleteBox(topExtremeBox.value);
    }

    // --- EPA ---
    if (cfg.tf1_showEpa) {
      if (canPlot) {
        if (isValidHH || isValidLL) {
          isPriceEfficient = false;
          if (cfg.tf1_epaDelete) {
            deleteLine(bearEpaLine.value);
            deleteLine(bullEpaLine.value);
            deleteLabel(bearEpaLabel.value);
            deleteLabel(bullEpaLabel.value);
          }
        }
        if (isValidLL) {
          bearEpaPrice = pl1;
          bullEpaPrice = NaN;
          bearEpaLine.value = line.new(pl1Time, pl1, timeTo, pl1, 'bar_time', 'none', cfg.tf1_epaCol, getLineStyle(cfg.tf1_epaStyle), cfg.tf1_epaWidth);
          bearEpaLabel.value = label.new(timeTo, pl1, cfg.tf1_epaText + LABEL_SPACE, 'bar_time', 'price', undefined, 'none', cfg.tf1_epaCol, 'normal');
        }
        if (isValidHH) {
          bullEpaPrice = ph1;
          bearEpaPrice = NaN;
          bullEpaLine.value = line.new(ph1Time, ph1, timeTo, ph1, 'bar_time', 'none', cfg.tf1_epaCol, getLineStyle(cfg.tf1_epaStyle), cfg.tf1_epaWidth);
          bullEpaLabel.value = label.new(timeTo, ph1, cfg.tf1_epaText + LABEL_SPACE, 'bar_time', 'price', undefined, 'none', cfg.tf1_epaCol, 'normal');
        }
      }
      if (notNa(bearEpaLine.value)) line.set_x2(bearEpaLine.value, timeTo);
      if (notNa(bearEpaLabel.value)) label.set_x(bearEpaLabel.value, timeTo);
      if (notNa(bearEpaLine.value) && gt(high, bearEpaPrice)) {
        isPriceEfficient = true;
        line.delete(bearEpaLine.value);
        if (notNa(bearEpaLabel.value)) label.delete(bearEpaLabel.value);
      }
      if (notNa(bullEpaLine.value)) line.set_x2(bullEpaLine.value, timeTo);
      if (notNa(bullEpaLabel.value)) label.set_x(bullEpaLabel.value, timeTo);
      if (notNa(bullEpaLine.value) && lt(low, bullEpaPrice)) {
        isPriceEfficient = true;
        line.delete(bullEpaLine.value);
        if (notNa(bullEpaLabel.value)) label.delete(bullEpaLabel.value);
      }
    }

    // --- MSU ---
    isBearishMsu = lt(ph0, ph1) && lt(pl0, pl1) && gt(high, ph0) && lt(high, ph1);
    isBullishMsu = gt(pl0, pl1) && gt(ph0, ph1) && lt(low, pl0) && gt(low, pl1);
    if (cfg.tf1_showMsu && isBearishMsu) {
      markers.push({ id: 'shape0', time: bars[i].time, position: 'bottom', shape: 'arrowDown', color: RED, size: 'tiny' });
    }
    if (cfg.tf1_showMsu && isBullishMsu) {
      markers.push({ id: 'shape1', time: bars[i].time, position: 'bottom', shape: 'arrowUp', color: LIME, size: 'tiny' });
    }

    // --- VTA ---
    const isStrictBottomVta = lt(pl1, pl2) && lt(pl0, pl1) && gt(ph0, ph1) && gt(close, ph0);
    const isStrictTopVta = gt(ph1, ph2) && gt(ph0, ph1) && lt(pl0, pl1) && lt(close, pl0);
    const isBottomVta = cfg.tf1_strictVta ? isStrictBottomVta : gt(ph0, ph1) && lt(pl0, pl1) && gt(close, ph0);
    const isTopVta = cfg.tf1_strictVta ? isStrictTopVta : lt(pl0, pl1) && gt(ph0, ph1) && lt(close, pl0);
    if (cfg.tf1_showVta) {
      if (isTopVta && !includes(usedVtaTimes, pl0Time) && ph0Time >= pl0Time) {
        usedVtaTimes.unshift(pl0Time);
        topVtaBoxes.unshift(box.new(pl0Time, ph0, timeTo, pl0, cfg.tf1_vtaTopCol, 1, 'solid', 'none', 'bar_time', TRANSPARENT,
          cfg.tf1_vtaText, 'small', cfg.tf1_vtaTopCol, 'right', 'top'));
      }
      if (isBottomVta && !includes(usedVtaTimes, ph0Time) && pl0Time >= ph0Time) {
        usedVtaTimes.unshift(ph0Time);
        bottomVtaBoxes.unshift(box.new(ph0Time, ph0, timeTo, pl0, cfg.tf1_vtaBottomCol, 1, 'solid', 'none', 'bar_time', TRANSPARENT,
          cfg.tf1_vtaText, 'small', cfg.tf1_vtaBottomCol, 'right', 'bottom'));
      }
      if (cfg.tf1_deleteVta) {
        for (let k = topVtaBoxes.length - 1; k >= 0; k--) {
          const b = topVtaBoxes[k];
          if (notNa(b) && gt(high, box.get_bottom(b)) && lt(close, box.get_top(b))) isBearishVta = true;
          if (notNa(b) && gt(tf1_close, box.get_top(b))) {
            topVtaBoxes.splice(k, 1);
            box.delete(b);
          }
        }
        for (let k = bottomVtaBoxes.length - 1; k >= 0; k--) {
          const b = bottomVtaBoxes[k];
          if (notNa(b) && lt(low, box.get_top(b)) && gt(close, box.get_bottom(b))) isBullishVta = true;
          if (notNa(b) && lt(tf1_close, box.get_bottom(b))) {
            bottomVtaBoxes.splice(k, 1);
            box.delete(b);
          }
        }
      }
    }

    // --- BAR COLOR ---
    let barcolor: string | null = null;
    if (isUse) {
      if (structureDirection === 'bullish' && gt(close, open)) barcolor = cfg.tf1_bullishBullBarCol;
      else if (structureDirection === 'bullish' && lt(close, open)) barcolor = cfg.tf1_bullishBearBarCol;
      else if (structureDirection === 'bearish' && gt(close, open)) barcolor = cfg.tf1_bearishBullBarCol;
      else if (structureDirection === 'bearish' && lt(close, open)) barcolor = cfg.tf1_bearishBearBarCol;
    }
    const cc = barcolor ?? 'transparent';
    candles.push({
      time: bars[i].time, open: cfg.tf1_changeBarCol ? open : NaN, high, low, close, color: cc, wickColor: cc, borderColor: cc,
    });

    // --- PATTERN ---
    const isBearishPattern = gt(ph2, ph3) && gt(ph1, ph2) && lt(ph0, ph1) && lt(pl1, pl2) && lt(pl0, pl1) && gt(close, pl0);
    const isBullishPattern = lt(pl2, pl3) && lt(pl1, pl2) && gt(pl0, pl1) && gt(ph1, ph2) && gt(ph0, ph1) && lt(close, ph0);
    if (cfg.tf1_div8 && isBearishPattern && structureDirection === 'bearish') {
      markers.push({ id: 'shape2', time: bars[i].time, position: 'bottom', shape: 'xcross', color: RED, size: 'tiny' });
    }
    if (cfg.tf1_div8 && isBullishPattern && structureDirection === 'bullish') {
      markers.push({ id: 'shape3', time: bars[i].time, position: 'bottom', shape: 'xcross', color: LIME, size: 'tiny' });
    }

    prevValidHH = isValidHH;
    prevValidLL = isValidLL;
    prevBottomExtremeBox = bottomExtremeBox.value;
    prevTopExtremeBox = topExtremeBox.value;
    isUseLast = isUse;
  }

  // --- DETAILS TABLE (last bar) ---
  if (n > 0 && cfg.structure_show_table) {
    const t = table.new(`${cfg.structure_table_vertical}_${cfg.structure_table_horizontal}` as Parameters<typeof table.new>[0], 6, 5,
      undefined, undefined, undefined, undefined, 3);
    const head = String(color.new(BLACK, 80));
    table.cell(t, 0, 0, '', undefined, undefined, BLACK, undefined, undefined, 'auto');
    table.cell(t, 0, 1, 'Structure', undefined, undefined, '#FFFFFF', undefined, undefined, 'auto', head);
    table.cell(t, 0, 2, 'Effeciency', undefined, undefined, '#FFFFFF', undefined, undefined, 'auto', head);
    table.cell(t, 0, 3, 'MSU', undefined, undefined, '#FFFFFF', undefined, undefined, 'auto', head);
    table.cell(t, 0, 4, 'VTA', undefined, undefined, '#FFFFFF', undefined, undefined, 'auto', head);
    if (isUseLast) {
      const tfText = tf1 === '' ? periodText(chartTf) : tf1;
      table.cell(t, 1, 0, tfText, undefined, undefined, GREEN, undefined, undefined, 'auto', String(color.new(GREEN, 90)));
      table.cell(t, 1, 1, structureDirection === 'bullish' ? 'Bullish ▲' : 'Bearish ▼', undefined, undefined,
        structureDirection === 'bullish' ? LIME : RED, undefined, undefined, 'auto');
      table.cell(t, 1, 2, isPriceEfficient ? 'Efficient ✓' : 'Inefficient 𐄂', undefined, undefined, isPriceEfficient ? LIME : RED, undefined, undefined, 'auto');
      table.cell(t, 1, 3, isBullishMsu ? 'MSU ▲' : isBearishMsu ? 'MSU ▼' : '', undefined, undefined, isBullishMsu ? LIME : RED, undefined, undefined, 'auto');
      table.cell(t, 1, 4, isBullishVta ? 'VTA ▲' : isBearishVta ? 'VTA ▼' : '', undefined, undefined, isBullishVta ? LIME : RED, undefined, undefined, 'auto');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    plotCandles: { candles },
    ...drawingOutputs(bars),
  };
}

export const AlgoMarketStructure = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, plotCandleConfig, drawingKinds,
};
