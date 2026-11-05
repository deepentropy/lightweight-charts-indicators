/**
 * Reversal Signals [LuxAlgo]
 *
 * Momentum phase: counts consecutive closes below the close of 4 bars before (bullish count) or not below it
 * (bearish count), from 1 to 9. A count of 9 completes the phase ("perfect" when the low of one of the last two bars
 * is at or below the lows of 2 and 3 bars back; mirrored for the bearish phase); a count stopped at 8 is an early
 * phase. A completed or early bullish phase sets a resistance level (highest high of 9 bars) kept until a close
 * above it; a bearish phase sets a support level (lowest low of 9 bars). Each phase also has a risk level.
 *
 * Trend exhaustion phase: starts on a completed perfect momentum phase and counts the closes at or below the low of
 * 2 bars before (at or above the high for the bearish phase) up to 13, with the count 13 delayed while the bar does
 * not pass the close of count 8. It gives a completion label (E) and target and risk levels.
 *
 * Trade setups (off by default): a completed phase followed by a price flip gives an L / S label with the stop and
 * the target in its tooltip, and optional warning labels on price flips against the setup. At most 500 labels are
 * kept.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): the trade setups, the crosses of the support /
 * resistance and risk levels, the phase completions and the start of a bullish / bearish momentum, with the messages
 * of the original (ticker from the chart context).
 *
 * The two "Overall Trend Mark" arrows (on the first bar of a resistance / support level) are hidden by default.
 * The prices in the label tooltips and alert messages use the price tick of the symbol: the port reads it from the
 * chart context (third argument) and uses 0.01 without it.
 *
 * Reference: "Reversal Signals [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, LabelData, MarkerData } from '../types';
import { mintickOf, tickerOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original calls alert() */
export const hasAlertFunction = true;

export interface ReversalSignalsInputs {
  /** Display of the momentum phases */
  bSh: 'Completed' | 'Detailed' | 'None';
  /** Support and resistance levels */
  srL: boolean;
  ptLT: 'Circles' | 'Step Line' | 'Step Line w/ Diamonds';
  /** Momentum phase risk levels */
  rsB: boolean;
  ptSR: 'Circles' | 'Step Line';
  /** Display of the trend exhaustion phases */
  eSh: 'Completed' | 'Detailed' | 'None';
  /** Trend exhaustion phase risk levels */
  rsE: boolean;
  /** Trend exhaustion phase target levels */
  ttE: boolean;
  /** Phase specific trade setup */
  tso: 'Momentum' | 'Exhaustion' | 'Qualified' | 'None';
  /** Price flips against the phase specific trade setups */
  war: boolean;
}

export const defaultInputs: ReversalSignalsInputs = {
  bSh: 'Completed',
  srL: true,
  ptLT: 'Step Line w/ Diamonds',
  rsB: false,
  ptSR: 'Circles',
  eSh: 'Completed',
  rsE: false,
  ttE: false,
  tso: 'None',
  war: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'bSh', type: 'string', title: 'Display Phases', defval: 'Completed', options: ['Completed', 'Detailed', 'None'], group: 'Momentum Phase' },
  { id: 'srL', type: 'bool', title: 'Support & Resistance Levels', defval: true, inline: 'bSh', group: 'Momentum Phase' },
  { id: 'ptLT', type: 'string', title: '', defval: 'Step Line w/ Diamonds', options: ['Circles', 'Step Line', 'Step Line w/ Diamonds'], inline: 'bSh', group: 'Momentum Phase' },
  { id: 'rsB', type: 'bool', title: 'Momentum Phase Risk Levels', defval: false, inline: 'bSh2', group: 'Momentum Phase' },
  { id: 'ptSR', type: 'string', title: '', defval: 'Circles', options: ['Circles', 'Step Line'], inline: 'bSh2', group: 'Momentum Phase' },
  { id: 'eSh', type: 'string', title: 'Display Phases', defval: 'Completed', options: ['Completed', 'Detailed', 'None'], group: 'Trend Exhaustion Phase' },
  { id: 'rsE', type: 'bool', title: 'Trend Exhaustion Phase Risk Levels', defval: false, group: 'Trend Exhaustion Phase' },
  { id: 'ttE', type: 'bool', title: 'Trend Exhaustion Phase Target Levels', defval: false, group: 'Trend Exhaustion Phase' },
  { id: 'tso', type: 'string', title: 'Phase Specific Trade Setup Options', defval: 'None', options: ['Momentum', 'Exhaustion', 'Qualified', 'None'], group: 'Trade Setups' },
  { id: 'war', type: 'bool', title: 'Price Flips against the Phase Specific Trade Setups', defval: false, group: 'Trade Setups' },
];

const RED = '#f23645';
const GREEN = '#089981';
const WHITE = '#ffffff';
const BLUE = '#2962ff';
const GRAY = '#787b86';
const CYAN = '#00bcd4';
/** noC = #00000000 */
const NO_COLOR = '#00000000';
/** color.yellow, color.blue and color.white of Pine v5 */
const YELLOW = '#FFEB3B';
const LABEL_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance Levels', color: String(color.new(RED, 50)), lineWidth: 2, style: 'steplinebr' },
  { id: 'plot1', title: 'Bullish Momentum Risk Levels', color: BLUE, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Support Levels', color: String(color.new(GREEN, 50)), lineWidth: 2, style: 'steplinebr' },
  { id: 'plot3', title: 'Bearish Momentum Risk Levels', color: BLUE, lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Bullish Exhaustion Target Levels', color: GRAY, lineWidth: 1, style: 'circles' },
  { id: 'plot5', title: 'Bullish Exhaustion Risk Levels', color: CYAN, lineWidth: 1, style: 'circles' },
  { id: 'plot6', title: 'Bearish Exhaustion Risk Levels', color: CYAN, lineWidth: 1, style: 'circles' },
  { id: 'plot7', title: 'Bearish Exhaustion Target Levels', color: GRAY, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Reversal Signals [LuxAlgo]',
  shortTitle: 'LuxAlgo - Reversal Signals',
  overlay: true,
};

/** indicator(max_labels_count = 500) */
const MAX_LABELS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

/** Subscript digits of the detailed counts */
const DIGITS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀', '₁₁', '₁₂'];

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers' | 'labels'> & { markers: MarkerData[]; labels: LabelData[]; alertCalls: AlertCall[] };

interface ReversalVars {
  bSC: number;
  bSH: number;
  bSL: number;
  sSC: number;
  sSH: number;
  sSL: number;
  bCC: number;
  bC8: number;
  bCHt: number;
  bCH: number;
  bCL: number;
  bCLt: number;
  fieldBCD: number;
  sCC: number;
  sC8: number;
  sCHt: number;
  sCH: number;
  sCL: number;
  sCLt: number;
  fieldSCT: number;
  bSCPrev: number;
  sSCPrev: number;
  bSR: number;
  sSS: number;
  bSD: number;
  sSD: number;
  pbSPrev: boolean;
  psSPrev: boolean;
  sbC: boolean;
  ssC: boolean;
  bCT: number;
  bCD: number;
  sCD: number;
  sCT: number;
  sbPF: boolean;
  bPFc: boolean;
  ssPF: boolean;
  sPFc: boolean;
  lTrd: boolean;
  sTrd: boolean;
  bBl9: number;
  bBp9: number;
  bB13: number;
  sBl9: number;
  sBp9: number;
  sB13: number;
}

interface ReversalRun extends BarRunState<ReversalVars> {
  hi: ReturnType<typeof taStep.highest>;
  lo: ReturnType<typeof taStep.lowest>;
  /** C.bCC / C.sCC at the end of each bar */
  bCCHist: number[];
  sCCHist: number[];
  plots: Point[][];
  markers: MarkerData[];
  /** Every label made (the last ones kept are chosen in result) */
  labels: LabelData[];
  alertCalls: AlertCall[];
}

/**
 * The labels kept of `all` (the labels made, oldest first): the original keeps the last 500 when a new label passes
 * 505, label by label
 */
function keptLabels(all: LabelData[]): LabelData[] {
  const total = all.length;
  const kept = total > MAX_LABELS + 5 ? MAX_LABELS + ((total - (MAX_LABELS + 6)) % 6) : total;
  return all.slice(total - kept);
}

function study(inputs: Partial<ReversalSignalsInputs>): BarStudy<ReversalRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { srL, rsB, rsE, ttE, tso, war } = cfg;

  const BnoShw = cfg.bSh !== 'None';
  const Bcmpltd = cfg.bSh === 'Completed';
  const noShw = cfg.eSh !== 'None';
  const cmpltd = cfg.eSh === 'Completed';
  const diamonds = cfg.ptLT.includes('Diamonds');
  const trdS = tso !== 'None';

  const bullPhase = String(color.new(GREEN, 25));
  const bearPhase = String(color.new(RED, 25));
  const bullPerfect8 = String(color.new(GREEN, 75));
  const bearPerfect8 = String(color.new(RED, 75));
  const bullExhaustion = String(color.new('#006400', 25));
  const bearExhaustion = String(color.new('#910000', 25));

  let tTxt = '';
  let tick = (x: number) => String(x);

  return {
    init(_bars, chart) {
      tTxt = tickerOf(chart);
      const mintick = mintickOf(chart);
      tick = (x: number) => str.tostring(x, 'mintick', mintick);
      const s: ReversalRun = {
        hi: taStep.highest(), lo: taStep.lowest(), bCCHist: [], sCCHist: [],
        plots: Array.from({ length: 8 }, () => []), markers: [], labels: [], alertCalls: [],
        steps: [],
        vars: {
          // Momentum phase (type trb): the counts are na until the first bar that resets them; trend exhaustion
          // phase (type tre); values of the bar before; trade setups; ta.valuewhen(cond, bar_index, 0 / 1)
          bSC: NaN,
          bSH: NaN,
          bSL: NaN,
          sSC: NaN,
          sSH: NaN,
          sSL: NaN,
          bCC: NaN,
          bC8: NaN,
          bCHt: NaN,
          bCH: NaN,
          bCL: NaN,
          bCLt: NaN,
          fieldBCD: NaN,
          sCC: NaN,
          sC8: NaN,
          sCHt: NaN,
          sCH: NaN,
          sCL: NaN,
          sCLt: NaN,
          fieldSCT: NaN,
          bSCPrev: NaN,
          sSCPrev: NaN,
          bSR: NaN,
          sSS: NaN,
          bSD: NaN,
          sSD: NaN,
          pbSPrev: false,
          psSPrev: false,
          sbC: false,
          ssC: false,
          bCT: NaN,
          bCD: NaN,
          sCD: NaN,
          sCT: NaN,
          sbPF: false,
          bPFc: false,
          ssPF: false,
          sPFc: false,
          lTrd: false,
          sTrd: false,
          bBl9: NaN,
          bBp9: NaN,
          bB13: NaN,
          sBl9: NaN,
          sBp9: NaN,
          sB13: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.hi, s.lo];
      s.lists = [s.markers, s.labels, s.alertCalls];
      s.series = [s.bCCHist, s.sCCHist, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      // the state of the bar before (written back at the end of the bar)
      let {
        bSC, bSH, bSL, sSC, sSH, sSL, bCC, bC8, bCHt, bCH, bCL, bCLt, fieldBCD, sCC, sC8, sCHt, sCH, sCL, sCLt,
        fieldSCT, bSCPrev, sSCPrev, bSR, sSS, bSD, sSD, pbSPrev, psSPrev, sbC, ssC, bCT, bCD, sCD, sCT, sbPF,
        bPFc, ssPF, sPFc, lTrd, sTrd, bBl9, bBp9, bB13, sBl9, sBp9, sB13
      } = v;
      const p = s.plots;
      const close = (k: number) => (k >= 0 ? bars[k].close : NaN);
      const high = (k: number) => (k >= 0 ? bars[k].high : NaN);
      const low = (k: number) => (k >= 0 ? bars[k].low : NaN);
      // ta.highest(high, 9), ta.lowest(low, 9)
      const sRi = s.hi.step(bars[i].high, 9);
      const sSi = s.lo.step(bars[i].low, 9);
      const b = bars[i];
      const time = b.time;
      const c = b.close;
      /** plotshape with a text and no visible body (digits of the detailed display) */
      const digit = (id: number, on: boolean, text: string, textColor: string, below: boolean, body = NO_COLOR) => {
        if (on) {
          s.markers.push({ id: `shape${id}`, time, position: below ? 'belowBar' : 'aboveBar', shape: 'labelDown', color: body, text, textColor });
        }
      };
      /** plotshape of a completed phase (size.tiny) */
      const phase = (id: number, on: boolean, up: boolean, body: string, text: string) => {
        if (!on) return;
        s.markers.push({
          id: `shape${id}`, time, position: up ? 'belowBar' : 'aboveBar', shape: up ? 'labelUp' : 'labelDown', color: body,
          ...(text ? { text } : {}), textColor: WHITE, size: 'tiny',
        });
      };

      // Momentum phase
      const con = lt(c, close(i - 4));
      if (con) {
        bSC = bSC === 9 ? 1 : bSC + 1;
        sSC = 0;
      } else {
        sSC = sSC === 9 ? 1 : sSC + 1;
        bSC = 0;
      }

      const pbS = (le(b.low, low(i - 3)) && le(b.low, low(i - 2))) || (le(low(i - 1), low(i - 3)) && le(low(i - 1), low(i - 2)));
      const detailed = BnoShw && !Bcmpltd;
      // Shape ids: the original's plotshape outputs in declaration order (shape0 ... shape53)
      for (let k = 1; k <= 7; k++) digit(k - 1, detailed && bSC === k, DIGITS[k - 1], GREEN, false);
      digit(7, detailed && bSC === 8 && !pbS, '₈', GREEN, false);
      digit(8, detailed && bSC === 8 && pbS, 'ᵖ\n₈', WHITE, false, bullPerfect8);
      phase(9, BnoShw && bSC === 9 && !pbS, true, bullPhase, '');
      phase(10, BnoShw && bSC === 9 && pbS, true, bullPhase, 'ᵖ');
      const bullEarly = bSCPrev === 8 && sSC === 1; // bC8
      phase(11, BnoShw && bullEarly, true, bullPhase, '');

      const bSR1 = bSR;
      bSR = bSC === 9 || bullEarly ? sRi : gt(c, bSR1) ? 0 : bSR1;
      p[0][i] = { time, value: srL && gt(bSR, 0) ? bSR : NaN };
      if (srL && gt(bSR, 0) && ne(bSR, bSR1) && diamonds) {
        s.markers.push({ id: 'shape12', time, position: 'atPriceMiddle', price: bSR, shape: 'diamond', color: RED, size: 'tiny' });
      }

      if (bSC === 1) bSL = b.low;
      if (bSC > 0) {
        bSL = Math.min(b.low, bSL);
        if (eq(b.low, bSL)) bSH = b.high;
      }
      const bSD1 = bSD;
      bSD = bSC === 9 ? 2 * bSL - bSH : lt(c, bSD1) || sSC === 9 ? 0 : bSD1;
      p[1][i] = { time, value: rsB && gt(bSD, 0) ? bSD : NaN };

      const psS = (ge(b.high, high(i - 3)) && ge(b.high, high(i - 2))) || (ge(high(i - 1), high(i - 3)) && ge(high(i - 1), high(i - 2)));
      for (let k = 1; k <= 7; k++) digit(12 + k, detailed && sSC === k, DIGITS[k - 1], RED, false);
      digit(20, detailed && sSC === 8 && !psS, '₈', RED, false);
      digit(21, detailed && sSC === 8 && psS, 'ᵖ\n₈', WHITE, false, bearPerfect8);
      phase(22, BnoShw && sSC === 9 && !psS, false, bearPhase, '');
      phase(23, BnoShw && sSC === 9 && psS, false, bearPhase, 'ᵖ');
      const bearEarly = sSCPrev === 8 && bSC === 1; // sC8
      phase(24, BnoShw && bearEarly, false, bearPhase, '');

      const sSS1 = sSS;
      sSS = sSC === 9 || bearEarly ? sSi : lt(c, sSS1) ? 0 : sSS1;
      p[2][i] = { time, value: srL && gt(sSS, 0) ? sSS : NaN };
      if (srL && gt(sSS, 0) && ne(sSS, sSS1) && diamonds) {
        s.markers.push({ id: 'shape25', time, position: 'atPriceMiddle', price: sSS, shape: 'diamond', color: GREEN, size: 'tiny' });
      }

      if (sSC === 1) sSH = b.high;
      if (sSC > 0) {
        sSH = Math.max(b.high, sSH);
        if (eq(b.high, sSH)) sSL = b.low;
      }
      const sSD1 = sSD;
      sSD = sSC === 9 ? 2 * sSH - sSL : gt(c, sSD1) || bSC === 9 ? 0 : sSD1;
      p[3][i] = { time, value: rsB && gt(sSD, 0) ? sSD : NaN };

      // Trend exhaustion phase - bullish
      const bCount = le(c, low(i - 2));
      const b13 = bCount && ge(b.low, bC8);
      const bCC1 = bCC; // C.bCC[1]
      if (bSC === 9 && bCC === 0 && (pbS || pbSPrev)) sbC = true;
      else if (sSC === 9 || bCC === 13 || gt(c, bSR)) sbC = false;

      bCC = sbC ? (bSC === 9 ? (bCount ? 1 : 0) : bCount ? bCC + 1 : bCC) : 0;
      if (bCC === 13 && b13) bCC -= 1;
      const bChanged = !isNaN(bCC) && !isNaN(bCC1) && bCC !== bCC1;
      if (bCC === 8 && bChanged) bC8 = c;

      const shwBC = noShw && !cmpltd && sbC && bChanged;
      for (let k = 1; k <= 12; k++) digit(25 + k, shwBC && bCC === k, DIGITS[k - 1], GREEN, true);
      digit(38, noShw && !cmpltd && sbC && bCC === bCC1 && bCC === 12 && b13, '₊', GREEN, true);
      phase(39, noShw && sbC && bChanged && bCC === 13, true, bullExhaustion, 'E');

      if (bCC === 1) {
        bCLt = b.low;
        bCHt = b.high;
      }
      if (sbC) {
        bCHt = Math.max(b.high, bCHt);
        bCLt = Math.min(b.low, bCLt);
        if (eq(b.high, bCHt)) bCL = b.low;
        if (eq(b.low, bCLt)) bCH = b.high;
      }

      // C.sCC is still the count of the bar before here
      const bCT1 = bCT;
      bCT = bCC === 13 ? 2 * bCHt - bCL : gt(c, bCT1) || (eq(fieldBCD, 0) && sCC === 13) ? 0 : bCT1;
      p[4][i] = { time, value: ttE && gt(bCT, 0) ? bCT : NaN };

      const bCD1 = bCD;
      bCD = bCC === 13 ? 2 * bCLt - bCH : lt(c, bCD1) || (eq(bCT, 0) && sCC === 13) ? 0 : bCD1;
      fieldBCD = bCD;
      p[5][i] = { time, value: rsE && gt(bCD, 0) ? bCD : NaN };

      // Trend exhaustion phase - bearish
      const sCount = ge(c, high(i - 2));
      const s13 = sCount && le(b.high, sC8);
      const sCC1 = sCC; // C.sCC[1]
      if (sSC === 9 && sCC === 0 && (psS || psSPrev)) ssC = true;
      else if (bSC === 9 || sCC === 13 || lt(c, sSS)) ssC = false;

      sCC = ssC ? (sSC === 9 ? (sCount ? 1 : 0) : sCount ? sCC + 1 : sCC) : 0;
      if (sCC === 13 && s13) sCC -= 1;
      const sChanged = !isNaN(sCC) && !isNaN(sCC1) && sCC !== sCC1;
      if (sCC === 8 && sChanged) sC8 = c;

      const shwSC = noShw && !cmpltd && ssC && sChanged;
      for (let k = 1; k <= 12; k++) digit(39 + k, shwSC && sCC === k, DIGITS[k - 1], RED, true);
      digit(52, noShw && !cmpltd && ssC && sCC === sCC1 && sCC === 12 && s13, '₊', RED, true);
      phase(53, noShw && ssC && sChanged && sCC === 13, false, bearExhaustion, 'E');

      if (sCC === 1) {
        sCLt = b.low;
        sCHt = b.high;
      }
      if (ssC) {
        sCHt = Math.max(b.high, sCHt);
        sCLt = Math.min(b.low, sCLt);
        if (eq(b.high, sCHt)) sCL = b.low;
        if (eq(b.low, sCLt)) sCH = b.high;
      }

      const sCD1 = sCD;
      sCD = sCC === 13 ? 2 * sCHt - sCL : gt(c, sCD1) || (eq(fieldSCT, 0) && bCC === 13) ? 0 : sCD1;
      p[6][i] = { time, value: rsE && gt(sCD, 0) ? sCD : NaN };

      const sCT1 = sCT;
      sCT = sCC === 13 ? 2 * sCLt - sCH : lt(c, sCT1) || (eq(sCD, 0) && bCC === 13) ? 0 : sCT1;
      fieldSCT = sCT;
      p[7][i] = { time, value: ttE && gt(sCT, 0) ? sCT : NaN };

      s.bCCHist[i] = bCC;
      s.sCCHist[i] = sCC;

      // Trade setups
      if (bSC === 9) {
        bBp9 = bBl9;
        bBl9 = i;
      }
      if (bCC === 13) bB13 = i;
      if (sSC === 9) {
        sBp9 = sBl9;
        sBl9 = i;
      }
      if (sCC === 13) sB13 = i;

      const c1 = close(i - 1);
      const c4 = close(i - 4);
      const c5 = close(i - 5);

      const sQC = sBl9 > sB13 && sB13 > sBp9 && sBp9 > bBl9;
      const sPFO = tso === 'Momentum' ? sSC === 9 || bearEarly
        : tso === 'Exhaustion' ? (i >= 5 && s.sCCHist[i - 5] === 13)
          : sSC === 9 && sQC;
      if (sPFO) ssPF = true;
      else if (sPFc) ssPF = false;
      sPFc = ssPF && lt(c, c4) && gt(c1, c5);

      if (sPFc && trdS) {
        const stop = tso === 'Exhaustion' ? sCD : sSD;
        const risky = eq(stop, 0);
        const sTT = 'Short Trade Setup' + (risky ? ' - Risky' : '') + '\n Signal : Completed ' + tso + ' plus Bearish Price Flip\n'
          + ' Stop    : ' + tick(risky ? b.high : stop)
          + '\n Target : ' + tick(tso === 'Exhaustion' ? sCT : sSS);
        s.labels.push({
          time, price: b.high, text: 'S', color: String(color.new(YELLOW, 25)), style: 'label_down', textColor: WHITE,
          size: 'small', tooltip: sTT + '\n\nnot a finacial advice, subject to high risk',
        });
        s.alertCalls.push({
          time, freq: 'once_per_bar',
          message: tTxt + ' : ' + sTT + '\n Price    : ' + tick(c) + '\n\nnot a finacial advice, subject to high risk',
        });
        sTrd = true;
        lTrd = false;
      }
      if (war && sTrd && lt(b.open, c) && sSC === 2 && !lTrd) {
        s.labels.push({
          time, price: b.low, text: '⚠️', color: String(color.new(YELLOW, 100)), style: 'label_up', textColor: YELLOW,
          size: 'large', tooltip: 'Warning\nbullish price flip detected',
        });
        sTrd = false;
      }
      if (war && sTrd && lt(b.open, c) && ((ne(sSD1, 0) && gt(c, sSD1)) || (ne(sCD1, 0) && gt(c, sCD1)))) {
        s.labels.push({
          time, price: b.low, text: '⚠️', color: String(color.new(YELLOW, 100)), style: 'label_up', textColor: YELLOW,
          size: 'large', tooltip: 'Critical Warning\nstop/risk level breached',
        });
        sTrd = false;
      }

      const bQC = bBl9 > bB13 && bB13 > bBp9 && bBp9 > sBl9;
      const bPFO = tso === 'Momentum' ? bSC === 9 || bullEarly
        : tso === 'Exhaustion' ? (i >= 5 && s.bCCHist[i - 5] === 13)
          : bSC === 9 && bQC;
      if (bPFO) sbPF = true;
      else if (bPFc) sbPF = false;
      bPFc = sbPF && gt(c, c4) && lt(c1, c5);

      if (bPFc && trdS) {
        const stop = tso === 'Exhaustion' ? bCD : bSD;
        const risky = eq(stop, 0);
        const lTT = 'Long Trade Setup' + (risky ? ' - Risky' : '') + '\n Signal : Completed ' + tso + ' plus Bullish Price Flip\n'
          + ' Stop    : ' + tick(risky ? b.low : stop)
          + '\n Target : ' + tick(tso === 'Exhaustion' ? bCT : bSR);
        s.labels.push({
          time, price: b.low, text: 'L', color: String(color.new(LABEL_BLUE, 25)), style: 'label_up', textColor: WHITE,
          size: 'small', tooltip: lTT + '\n\nnot a finacial advice, subject to high risk',
        });
        s.alertCalls.push({
          time, freq: 'once_per_bar',
          message: tTxt + ' : ' + lTT + '\n Price    : ' + tick(c) + '\n\nnot a finacial advice, subject to high risk',
        });
        lTrd = true;
        sTrd = false;
      }
      if (war && lTrd && gt(b.open, c) && bSC === 2 && !sTrd) {
        s.labels.push({
          time, price: b.high, text: '⚠️', color: String(color.new(LABEL_BLUE, 100)), style: 'label_down', textColor: YELLOW,
          size: 'large', tooltip: 'Warning\nbearish price flip detected',
        });
        lTrd = false;
      }
      if (war && lTrd && gt(b.open, c) && (lt(c, bSD1) || lt(c, bCD1))) {
        s.labels.push({
          time, price: b.high, text: '⚠️', color: String(color.new(LABEL_BLUE, 100)), style: 'label_down', textColor: YELLOW,
          size: 'large', tooltip: 'Critical Warning\nstop/risk level breached',
        });
        lTrd = false;
      }

      // Alerts: f_xLX(_p, _l) = (_l > _p and _l < _p[1]) or (_l < _p and _l > _p[1]) with _p = close
      const xLX = (l: number) => (gt(l, c) && lt(l, c1)) || (lt(l, c) && gt(l, c1));
      const pTxt = tick(c);
      const call = (message: string) => s.alertCalls.push({ time, message, freq: 'once_per_bar' });
      if (xLX(bSR) && srL) call(tTxt + ' crossing resistance level detected, price ' + tick(bSR));
      // `a or b and c` is `a or (b and c)`, as in the original
      if (xLX(bSD) || (xLX(sSD) && rsB)) call(tTxt + ' crossing momentum risk level detected, price ' + tick(bSD));
      if (xLX(sSS) && srL) call(tTxt + ' crossing support level detected, price ' + tick(sSS));
      if (xLX(bCD) || (xLX(sCD) && rsE)) call(tTxt + ' crossing trend exhaustion risk level detected, price ' + tick(bCD));
      if (bSC === 9 && cmpltd) call(tTxt + ' bullish momentum phase completion detected, price ' + pTxt);
      if (sSC === 9 && cmpltd) call(tTxt + ' bearish momentum phase completion detected, price ' + pTxt);
      if (bCC === 13 && cmpltd) call(tTxt + ' bullish trend exhaustion phase completion detected, price ' + pTxt);
      if (sCC === 13 && cmpltd) call(tTxt + ' bearish trend exhaustion phase completion detected, price ' + pTxt);
      if (gt(bSR, 0) && eq(bSR1, 0)) call(tTxt + ' bearish momentum detected, price ' + pTxt);
      if (gt(sSS, 0) && eq(sSS1, 0)) call(tTxt + ' bullish momentum detected, price ' + pTxt);

      // plotshape(bSR > 0 and bSR[1] == 0 ? bSR : na, 'Overall Bearish Trend Mark', shape.labeldown, location.absolute,
      // noC, 0, '⇩', rdC, size = size.small, display = display.none) and the bullish one at sSS (hidden by default)
      if (gt(bSR, 0) && eq(bSR1, 0)) {
        s.markers.push({ id: 'shape54', time, position: 'atPriceTop', price: bSR, shape: 'labelDown', color: NO_COLOR, text: '⇩', textColor: RED, size: 'small' });
      }
      if (gt(sSS, 0) && eq(sSS1, 0)) {
        s.markers.push({ id: 'shape55', time, position: 'atPriceBottom', price: sSS, shape: 'labelUp', color: NO_COLOR, text: '⇧', textColor: GREEN, size: 'small' });
      }

      bSCPrev = bSC;
      sSCPrev = sSC;
      pbSPrev = pbS;
      psSPrev = psS;
      v.bSC = bSC; v.bSH = bSH; v.bSL = bSL; v.sSC = sSC; v.sSH = sSH; v.sSL = sSL; v.bCC = bCC; v.bC8 = bC8; v.bCHt
      = bCHt; v.bCH = bCH; v.bCL = bCL; v.bCLt = bCLt; v.fieldBCD = fieldBCD; v.sCC = sCC; v.sC8 = sC8; v.sCHt =
      sCHt; v.sCH = sCH; v.sCL = sCL; v.sCLt = sCLt; v.fieldSCT = fieldSCT; v.bSCPrev = bSCPrev; v.sSCPrev =
      sSCPrev; v.bSR = bSR; v.sSS = sSS; v.bSD = bSD; v.sSD = sSD; v.pbSPrev = pbSPrev; v.psSPrev = psSPrev; v.sbC =
      sbC; v.ssC = ssC; v.bCT = bCT; v.bCD = bCD; v.sCD = sCD; v.sCT = sCT; v.sbPF = sbPF; v.bPFc = bPFc; v.ssPF =
      ssPF; v.sPFc = sPFc; v.lTrd = lTrd; v.sTrd = sTrd; v.bBl9 = bBl9; v.bBp9 = bBp9; v.bB13 = bB13; v.sBl9 = sBl9;
      v.sBp9 = sBp9; v.sB13 = sB13;
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(), plot7: p[7].slice(),
        },
        markers: s.markers.slice(),
        labels: keptLabels(s.labels),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ReversalSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ReversalSignalsInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const ReversalSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
