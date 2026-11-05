/**
 * Support Resistance - Dynamic
 *
 * On each new pivot high / low the script reads the pivots of the last `prd` bars, newest first (at most 40). For
 * each pivot that is not yet part of a channel it builds a channel of +- `ChannelW` percent of the high-low range of
 * the period around the pivot price and counts the free pivots inside it. A channel with at least `nump` pivots
 * makes its pivot price a support / resistance level and takes its pivots. Each level is a line across the chart
 * with a price label next to the last bar; two more lines and labels mark the highest and the lowest pivot of the
 * period. The plot `RS_level` (not displayed) is the level that the close has just crossed.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Resistance Broken' on the bars whose close crosses above a level
 * (close[1] at or below it), 'Support Broken' on the bars whose close crosses below a level; the messages keep the
 * {{close}} and {{plot("RS_level")}} placeholders.
 *
 * Chart context (optional third argument): the label prices are rounded to the price tick of the symbol, read
 * from the context (`mintick`). Without it the tick is 0.01.
 *
 * Reference: "Support Resistance - Dynamic" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) LonesomeTheBlue
 */

import { taStep, str, math, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { mintickOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupportResistanceDynamicInputs {
  /** Period for Pivot Points */
  rb: number;
  /** Loopback Period */
  prd: number;
  /** S/R strength: pivots needed in a channel */
  nump: number;
  /** Channel Width % */
  channelW: number;
  /** Label Location +- (0: the last bar, negative: bars before it, positive: bars after it) */
  labelLocation: number;
  /** Line Style */
  linestyle: 'Solid' | 'Dotted' | 'Dashed';
  /** Line Color */
  lineColor: string;
  /** Draw Highest/Lowest Pivots in Period */
  drawhl: boolean;
  /** Show Point Points */
  showpp: boolean;
}

// Colours of the original Pine version
const BLUE = '#2196F3';
const RED = '#FF5252';
const LIME = '#00E676';
const BLACK = '#363A45';
const SILVER = '#B2B5BE';

export const defaultInputs: SupportResistanceDynamicInputs = {
  rb: 10,
  prd: 284,
  nump: 2,
  channelW: 10,
  labelLocation: 10,
  linestyle: 'Dashed',
  lineColor: BLUE,
  drawhl: true,
  showpp: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rb', type: 'int', title: 'Period for Pivot Points', defval: 10, min: 10 },
  { id: 'prd', type: 'int', title: 'Loopback Period', defval: 284, min: 100, max: 500 },
  { id: 'nump', type: 'int', title: 'S/R strength', defval: 2, min: 1 },
  { id: 'channelW', type: 'int', title: 'Channel Width %', defval: 10, min: 5 },
  {
    id: 'labelLocation', type: 'int', title: 'Label Location +-', defval: 10,
    tooltip: '0 means last bar. for example if you set it -5 then label is shown on last 5. bar. + means future bars',
  },
  { id: 'linestyle', type: 'string', title: 'Line Style', defval: 'Dashed', options: ['Solid', 'Dotted', 'Dashed'] },
  { id: 'lineColor', type: 'color', title: 'Line Color', defval: BLUE },
  { id: 'drawhl', type: 'bool', title: 'Draw Highest/Lowest Pivots in Period', defval: true },
  { id: 'showpp', type: 'bool', title: 'Show Point Points', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RS_level', color: BLUE, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Support Resistance - Dynamic',
  shortTitle: 'Support Resistance - Dynamic',
  overlay: true,
};

const { le, ge, gt, lt } = compare;
/** Pine bool(x) of a number: false for na and 0 */
const truthy = (v: number) => !Number.isNaN(v) && v !== 0;

type Result = IndicatorResult & { markers: MarkerData[]; labels: LabelData[]; lines: LineDrawingData[] } & { alerts: AlertConditionState[] };

interface SrdVars {
  highestph: number;
  lowestpl: number;
  /** var sr_levs: the levels of the last pivot bar (21 slots; a new array on each pivot bar) */
  srLevs: readonly number[];
  /** State of the lines: they are drawn again on each pivot bar */
  linesBar: number;
  lineHighest: number;
  lineLowest: number;
}

interface SrdRun extends BarRunState<SrdVars> {
  phStep: PivotStep;
  plStep: PivotStep;
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  /** ta.pivothigh(high, rb, rb) / ta.pivotlow(low, rb, rb) of each bar */
  ph: number[];
  pl: number[];
  rsLevel: { time: number; value: number }[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<SupportResistanceDynamicInputs>): BarStudy<SrdRun, Result> {
  const { rb, prd, nump, channelW, labelLocation, linestyle, lineColor, drawhl, showpp } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: SrdRun = {
        phStep: new PivotStep(rb, rb, true), plStep: new PivotStep(rb, rb, false),
        highest: taStep.highest(), lowest: taStep.lowest(),
        ph: [], pl: [], rsLevel: [], flags: [[], []], times: [[], []], markers: [],
        steps: [],
        vars: {
          highestph: NaN, lowestpl: NaN, srLevs: new Array(21).fill(NaN), linesBar: -1, lineHighest: NaN,
          lineLowest: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.phStep, s.plStep, s.highest, s.lowest];
      s.lists = [...s.times, s.markers];
      s.series = [s.ph, s.pl, s.rsLevel, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const ph = s.ph;
      const pl = s.pl;
      ph[i] = s.phStep.step(i, b.high);
      pl[i] = s.plStep.step(i, b.low);
      // na until `prd` bars exist: no level before that
      const prdhighest = s.highest.step(b.high, prd);
      const prdlowest = s.lowest.step(b.low, prd);
      const H = (k: number) => (k >= 0 ? bars[k].high : NaN);
      const L = (k: number) => (k >= 0 ? bars[k].low : NaN);
      const isPh = truthy(ph[i]);
      const isPl = truthy(pl[i]);

      // plotshape(ph and showpp, text = "PH", style = shape.labeldown, color = color.new(color.white, 100),
      //   textcolor = color.red, location = location.abovebar, offset = -rb) and the same with "PL" below the bar
      if (showpp && i - rb >= 0) {
        if (isPh) {
          s.markers.push({ time: bars[i - rb].time, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255, 255, 255, 0)', text: 'PH', textColor: RED });
        }
        if (isPl) {
          s.markers.push({ time: bars[i - rb].time, position: 'belowBar', shape: 'labelUp', color: 'rgba(255, 255, 255, 0)', text: 'PL', textColor: LIME });
        }
      }

      if (isPh || isPl) {
        const cwidth = ((prdhighest - prdlowest) * channelW) / 100;
        const srLevels: number[] = new Array(21).fill(NaN);
        // availability of the pivots (false: used in a channel)
        const aas: boolean[] = new Array(41).fill(true);
        let highestph = prdlowest;
        let lowestpl = prdhighest;
        const nzv = (x: number, d: number) => (Number.isNaN(x) ? d : x);
        let countpp = 0;
        // the last pivots have more priority: newest first
        for (let x = 0; x <= prd; x++) {
          if (i - x < 0) break;
          const phx = ph[i - x];
          const plx = pl[i - x];
          if (Number.isNaN(phx) && Number.isNaN(plx)) continue;
          highestph = Math.max(highestph, nzv(phx, prdlowest), nzv(plx, prdlowest));
          lowestpl = Math.min(lowestpl, nzv(phx, prdhighest), nzv(plx, prdhighest));
          countpp += 1;
          if (countpp > 40) break;
          if (!aas[countpp]) continue;
          const base = truthy(phx) ? H(i - x - rb) : L(i - x - rb);
          const upl = base + cwidth;
          const dnl = base - cwidth;
          // the pivots that are in this channel
          const tmp: boolean[] = new Array(41).fill(true);
          let cnt = 0;
          let tpoint = 0;
          for (let xx = 0; xx <= prd; xx++) {
            if (i - xx < 0) break;
            const phxx = ph[i - xx];
            const plxx = pl[i - xx];
            if (Number.isNaN(phxx) && Number.isNaN(plxx)) continue;
            let chg = false;
            cnt += 1;
            if (cnt > 40) break;
            if (aas[cnt]) {
              if (!Number.isNaN(phxx)) {
                const hx = H(i - xx - rb);
                if (le(hx, upl) && ge(hx, dnl)) {
                  tpoint += 1;
                  chg = true;
                }
              }
              if (!Number.isNaN(plxx)) {
                const lx = L(i - xx - rb);
                if (le(lx, upl) && ge(lx, dnl)) {
                  tpoint += 1;
                  chg = true;
                }
              }
            }
            if (chg && cnt < 41) tmp[cnt] = false;
          }
          if (tpoint >= nump) {
            for (let g = 0; g <= 40; g++) if (!tmp[g]) aas[g] = false;
            if (truthy(phx) && countpp < 21) srLevels[countpp] = H(i - x - rb);
            if (truthy(plx) && countpp < 21) srLevels[countpp] = L(i - x - rb);
          }
        }
        v.highestph = highestph;
        v.lowestpl = lowestpl;
        v.srLevs = srLevels;
        v.linesBar = i;
        v.lineHighest = highestph;
        v.lineLowest = lowestpl;
      }

      // The level that the close crosses on this bar (the last one in the list)
      const close = b.close;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      let rsLevel = NaN;
      let resistanceBroken = false;
      let supportBroken = false;
      for (const lev of v.srLevs) {
        if (!truthy(lev)) continue;
        if (le(close1, lev) && gt(close, lev)) {
          resistanceBroken = true;
          rsLevel = lev;
        }
        if (ge(close1, lev) && lt(close, lev)) {
          supportBroken = true;
          rsLevel = lev;
        }
      }
      s.rsLevel[i] = { time: b.time, value: rsLevel };
      s.flags[0][i] = resistanceBroken;
      s.flags[1][i] = supportBroken;
      if (resistanceBroken) s.times[0].push(b.time as number);
      if (supportBroken) s.times[1].push(b.time as number);
    },
    result(s, bars, chart) {
      const n = bars.length;
      const { highestph, lowestpl, srLevs, linesBar, lineHighest, lineLowest } = s.vars;
      // Lines of the last pivot bar and labels of the last bar
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      if (n > 0) {
        const interval = barInterval(bars);
        const style = linestyle === 'Solid' ? 'solid' : linestyle === 'Dotted' ? 'dotted' : 'dashed';
        if (linesBar >= 1) {
          const time1 = bars[linesBar - 1].time;
          const time2 = bars[linesBar].time;
          if (drawhl) {
            for (const price of [lineHighest, lineLowest]) {
              if (Number.isFinite(price)) {
                lines.push({ time1, price1: price, time2, price2: price, extend: 'both', color: BLUE, style: 'dashed', width: 1 });
              }
            }
          }
          for (const lev of srLevs) {
            if (truthy(lev)) lines.push({ time1, price1: lev, time2, price2: lev, extend: 'both', color: lineColor, style, width: 2 });
          }
        }
        const close = bars[n - 1].close;
        const labelTime = barTime(bars, n - 1 + labelLocation, interval);
        for (const lev of srLevs) {
          if (!truthy(lev)) continue;
          labels.push({
            time: labelTime, price: lev, text: str.tostring(math.round_to_mintick(lev, mintickOf(chart))), color: LIME, textColor: BLACK,
            style: ge(close, lev) ? 'label_up' : 'label_down',
          });
        }
        if (drawhl) {
          const time = barTime(bars, n - 1 + labelLocation + Math.sign(labelLocation) * 20, interval);
          if (Number.isFinite(highestph)) {
            labels.push({ time, price: highestph, text: 'Highest PH ' + str.tostring(highestph), color: SILVER, textColor: BLACK, style: 'label_down' });
          }
          if (Number.isFinite(lowestpl)) {
            labels.push({ time, price: lowestpl, text: 'Lowest PL ' + str.tostring(lowestpl), color: SILVER, textColor: BLACK, style: 'label_up' });
          }
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.rsLevel.slice() },
        markers: s.markers.slice(),
        labels,
        lines,
        // alertcondition(resistance_broken, 'Resistance Broken', ...) / alertcondition(support_broken, 'Support Broken', ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupportResistanceDynamicInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupportResistanceDynamicInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Resistance Broken', message: 'Resistance Broken, Close Price: {{close}}, Resistance level = {{plot("RS_level")}}' },
  { id: 'alert1', title: 'Support Broken', message: 'Support Broken, Close Price: {{close}}, Support level = {{plot("RS_level")}}' },
];

export const SupportResistanceDynamic = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
