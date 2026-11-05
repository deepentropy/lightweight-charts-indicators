/**
 * Harmonic Pattern Detection, Prediction, and Backtesting System
 *
 * Finds harmonic XABCD patterns (Gartley, Bat, Butterfly, Crab, Shark, Cypher), draws them and keeps the result of
 * the trade that each pattern gives.
 * - Potential patterns: for pivot lengths 3 to 20, the last confirmed pivot is point C; the script walks back
 *   through the pivots to find B, A and X. The legs must have the Fibonacci ratios of a pattern type (within the
 *   allowed error). A potential pattern is drawn with dotted lines and an arrow to the nearest level of its
 *   potential reversal zone (PRZ). It ends when price breaks point C or the far PRZ level, or after a time limit.
 * - Complete patterns: a pivot low / high that is a valid point D for a potential (or a pending) pattern completes
 *   it. With "Enter after Point C", a potential pattern also completes when price reaches its entry level.
 * - Score (0..1): weighted mean of the accuracy of the leg ratios, the closeness of the two closest PRZ levels and
 *   the closeness of point D to them.
 * - Trade: entry at the PRZ level (after C) or within a limit of D (after D), two targets and a stop. Each bar the
 *   pending patterns are checked for entry, targets, stop and time-out; markers and dotted lines show the events and
 *   the pattern label shows the state.
 * - Last bar: the PRZ, entry, stop, targets and a projected path of the latest pattern still in progress, and a
 *   table with the statistics per pattern type.
 * - At most 500 lines and 500 labels are kept (the oldest are removed).
 *
 * Imported libraries, written in this file (only the functions that the script uses): reees/TA (version 85, and
 * version 76 / 66 through the other libraries: same code), reees/Draw (27, and 26 through Obj_XABCD_Harmonic),
 * reees/Utilities (5), reees/Pattern (1, the point type), reees/Obj_XABCD_Harmonic (10), reees/Fibonacci (4).
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close), as "Alert for" selects: "Potential <name> is
 *   forming." when a potential pattern is added, "<name> has formed." when a complete pattern is added (name: "Bullish
 *   Gartley", "Bearish Bat", ...).
 *
 * Reference: "Harmonic Pattern Detection, Prediction, and Backtesting System" by reees
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © reees
 */

import {
  ta, str, math, array, color, Series, barInterval, barTime, line, label, linefill, resetDrawings, setDrawingBar,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { AlertCall, LabelData, LabelStyle, LineDrawingData, LinefillData, PineSize, TableCellData, TableData } from '../types';

type Target1 = '.382 AD' | '.5 AD' | '.618 AD' | '.382 XA' | '.5 XA' | '.618 XA' | '1.272 XA' | '1.618 XA' | '.382 CD' | '.5 CD'
  | '.618 CD' | '1.272 CD' | '1.618 CD' | 'A' | 'B' | 'C';
type Target2 = 'None' | '.618 AD' | '1.272 AD' | '1.618 AD' | '.618 XA' | '1.272 XA' | '1.618 XA' | '.618 CD' | '1.272 CD'
  | '1.618 CD' | 'A' | 'B' | 'C';
type EntryLevel = 'Nearest confluent PRZ level' | 'Farthest confluent PRZ level' | 'Between the two confluent PRZ levels'
  | 'Nearest PRZ level' | 'Farthest PRZ level';
type StopBasis = '% beyond X or D' | '% beyond Farthest PRZ level' | '% beyond Point D' | '% beyond entry'
  | '% of distance to target 1, beyond entry';

export interface HarmonicPatternDetectionPredictionAndInputs {
  /** Bullish */
  bullOn: boolean;
  /** Bearish */
  bearOn: boolean;
  /** Potential/Incomplete */
  incOn: boolean;
  /** Only high scoring */
  hsOn: boolean;
  /** Lookback bars */
  lookbackOn: boolean;
  /** Number of lookback bars */
  lookbackBars: number;
  gartOn: boolean;
  gartT1: Target1;
  gartT2: Target2;
  batOn: boolean;
  batT1: Target1;
  batT2: Target2;
  bflyOn: boolean;
  bflyT1: Target1;
  bflyT2: Target2;
  crabOn: boolean;
  crabT1: Target1;
  crabT2: Target2;
  sharkOn: boolean;
  sharkT1: Target1;
  sharkT2: Target2;
  cyphOn: boolean;
  cyphT1: Target1;
  cyphT2: Target2;
  /** Enter after Point C */
  enterAfterC: boolean;
  /** Enter at */
  enterAtC: EntryLevel;
  /** If score is above (entry after C) */
  scoreAboveC: number;
  /** Enter after Point D */
  enterAfterD: boolean;
  /** Enter at limit % away from D */
  enterLimitPctD: number;
  /** If score is above (entry after D) */
  scoreAboveD: number;
  /** Entry window (time limit), in pattern lengths */
  entryWindow: number;
  /** Stop */
  stopPct: number;
  /** Basis of the stop */
  stopBasis: StopBasis;
  /** Pattern validation length (# trailing bars) */
  validationLength: number;
  /** Allowed fib ratio error % */
  pctErr: number;
  /** Allowed leg length asymmetry % */
  pctAsym: number;
  /** Weight of the ratio error */
  weightErr: number;
  /** Pattern time limit, in pattern lengths */
  timeLimit: number;
  /** Weight of PRZ level confluence */
  weightPrz: number;
  /** Weight of point D / PRZ level confluence */
  weightD: number;
  /** Alert for: the alert() calls made (potential patterns, complete patterns or both) */
  alertType: 'Potential patterns' | 'Complete patterns' | 'Both';
  /** Bullish lines */
  bullLineColor: string;
  /** Bearish lines */
  bearLineColor: string;
  /** Bullish labels */
  bullLabelColor: string;
  /** Bearish labels */
  bearLabelColor: string;
  /** Label text */
  labelTextColor: string;
}

export const defaultInputs: HarmonicPatternDetectionPredictionAndInputs = {
  bullOn: true,
  bearOn: true,
  incOn: true,
  hsOn: true,
  lookbackOn: false,
  lookbackBars: 100,
  gartOn: true,
  gartT1: '.618 AD',
  gartT2: '1.272 AD',
  batOn: true,
  batT1: '.618 AD',
  batT2: '1.272 AD',
  bflyOn: true,
  bflyT1: '.618 AD',
  bflyT2: '1.272 AD',
  crabOn: true,
  crabT1: '.618 AD',
  crabT2: '1.618 AD',
  sharkOn: true,
  sharkT1: '.382 AD',
  sharkT2: 'C',
  cyphOn: true,
  cyphT1: '.618 CD',
  cyphT2: '1.618 XA',
  enterAfterC: true,
  enterAtC: 'Nearest confluent PRZ level',
  scoreAboveC: 90,
  enterAfterD: true,
  enterLimitPctD: 1.0,
  scoreAboveD: 90,
  entryWindow: 0.5,
  stopPct: 75,
  stopBasis: '% of distance to target 1, beyond entry',
  validationLength: 1,
  pctErr: 15.0,
  pctAsym: 250.0,
  weightErr: 4.0,
  timeLimit: 3,
  weightPrz: 2.0,
  weightD: 3.0,
  alertType: 'Both',
  bullLineColor: 'rgba(76, 175, 80, 0.8)',
  bearLineColor: 'rgba(255, 82, 82, 0.8)',
  bullLabelColor: 'rgba(76, 175, 80, 0.25)',
  bearLabelColor: 'rgba(255, 82, 82, 0.25)',
  labelTextColor: 'rgba(255, 255, 255, 0.8)',
};

const T1_OPTIONS = ['.382 AD', '.5 AD', '.618 AD', '.382 XA', '.5 XA', '.618 XA', '1.272 XA', '1.618 XA', '.382 CD', '.5 CD', '.618 CD',
  '1.272 CD', '1.618 CD', 'A', 'B', 'C'];
const T2_OPTIONS = ['None', '.618 AD', '1.272 AD', '1.618 AD', '.618 XA', '1.272 XA', '1.618 XA', '.618 CD', '1.272 CD', '1.618 CD', 'A',
  'B', 'C'];
const G_INC = 'Include';
const G_TYPES = 'Types & Targets';
const G_ENTRY = 'Entry/Stop';
const G_PATTERN = 'Pattern';
const G_DISPLAY = 'Display';
/** Seven no-break spaces: the indent of the sub-inputs of the original */
const INDENT = ' '.repeat(7);

const typeInputs = (key: string, title: string, inline: string, t1: string, t2: string): InputConfig[] => [
  { id: `${key}On`, type: 'bool', title, defval: true, inline, group: G_TYPES },
  { id: `${key}T1`, type: 'string', title: 'Target 1', defval: t1, options: T1_OPTIONS, inline, group: G_TYPES },
  { id: `${key}T2`, type: 'string', title: ' Target 2', defval: t2, options: T2_OPTIONS, inline, group: G_TYPES },
];

export const inputConfig: InputConfig[] = [
  { id: 'bullOn', type: 'bool', title: 'Bullish', defval: true, inline: 'type_b', group: G_INC },
  { id: 'bearOn', type: 'bool', title: 'Bearish', defval: true, inline: 'type_b', group: G_INC },
  { id: 'incOn', type: 'bool', title: 'Potential/Incomplete', defval: true, inline: 'type_b', group: G_INC },
  { id: 'hsOn', type: 'bool', title: 'Only high scoring', defval: true, inline: 'type_b', group: G_INC,
    tooltip: "Only show patterns that meet your 'If score is above' entry requirement." },
  { id: 'lookbackOn', type: 'bool', title: 'Lookback bars', defval: false, inline: 'h', group: G_INC },
  { id: 'lookbackBars', type: 'int', title: '', defval: 100, inline: 'h', group: G_INC },
  ...typeInputs('gart', 'Gartley:' + ' '.repeat(4), 'gart', '.618 AD', '1.272 AD'),
  ...typeInputs('bat', 'Bat:' + ' '.repeat(10), 'bat', '.618 AD', '1.272 AD'),
  ...typeInputs('bfly', 'Butterfly:' + ' '.repeat(2), 'bfly', '.618 AD', '1.272 AD'),
  ...typeInputs('crab', 'Crab:' + ' '.repeat(8), 'crab', '.618 AD', '1.618 AD'),
  ...typeInputs('shark', 'Shark:' + ' '.repeat(7), 'shark', '.382 AD', 'C'),
  ...typeInputs('cyph', 'Cypher:' + ' '.repeat(5), 'cyph', '.618 CD', '1.618 XA'),
  { id: 'enterAfterC', type: 'bool', title: 'Enter after Point C', defval: true, group: G_ENTRY },
  { id: 'enterAtC', type: 'string', title: INDENT + 'Enter at', defval: 'Nearest confluent PRZ level', group: G_ENTRY,
    options: ['Nearest confluent PRZ level', 'Farthest confluent PRZ level', 'Between the two confluent PRZ levels', 'Nearest PRZ level',
      'Farthest PRZ level'] },
  { id: 'scoreAboveC', type: 'float', title: INDENT + 'If score is above', defval: 90, group: G_ENTRY,
    tooltip: "A trade will only be entered if the pattern's score is above the specified value. Note that when entering a trade after Point C, we have an incomplete score because we can't yet measure Point D's confluence with the PRZ. Therefore the final pattern score may differ from the incomplete score at the time of entry. Set this to 0 if you wish to enter a trade on every pattern." },
  { id: 'enterAfterD', type: 'bool', title: 'Enter after Point D', defval: true, group: G_ENTRY },
  { id: 'enterLimitPctD', type: 'float', title: INDENT + 'Enter at limit % away from D', defval: 1.0, min: 0.0, step: 0.1, group: G_ENTRY,
    tooltip: "Enter the trade after a valid point D has been confirmed, up to the limit of this % away from Point D. E.g. for a bullish pattern (long entry), if this value is set to 5%, an entry will be placed at the best possible price up to 5% above point D. If 'Entry after Point C' is also set, the entry will be at whichever level is reached first. \n\nIf the entry level is not reached, the pattern will not be included in the Success Rate and Return % statistics." },
  { id: 'scoreAboveD', type: 'float', title: INDENT + 'If score is above', defval: 90, group: G_ENTRY,
    tooltip: "A trade will only be entered if the pattern's score is above the specified value. Set this to 0 if you wish to enter a trade on every pattern." },
  { id: 'entryWindow', type: 'float', title: INDENT + 'Entry window (time limit)', defval: 0.5, group: G_ENTRY,
    tooltip: "Time limit for order entry, specified in pattern lengths (e.g. '0.5' means half the total pattern length). If the time limit expires before the order is filled, it will be cancelled and no trade will be entered for the pattern." },
  { id: 'stopPct', type: 'float', title: 'Stop', defval: 75, min: 0.0, step: 1.0, inline: 'stop', group: G_ENTRY },
  { id: 'stopBasis', type: 'string', title: '', defval: '% of distance to target 1, beyond entry', inline: 'stop', group: G_ENTRY,
    options: ['% beyond X or D', '% beyond Farthest PRZ level', '% beyond Point D', '% beyond entry', '% of distance to target 1, beyond entry'],
    tooltip: "Set stop-loss % beyond the specified level. If price reaches this level before the first target is hit, or before the target timeout period expires, the pattern will be considered a failure.\n\n'% beyond X or D' = percentage below Point X or Point D, whichever is farther from entry\n\n'% of distance to target 1' = a percentage of the distance from the entry level to target 1. \n\n'% beyond entry' = percentage above/below the entry level. \n\n'% beyond Point D' = percentage above/below Point D. \n\n'beyond Farthest PRZ level' = percentage above/below the Farthest PRZ level" },
  { id: 'validationLength', type: 'int', title: 'Pattern validation length (# trailing bars)', defval: 1, min: 1, group: G_PATTERN,
    tooltip: 'The number of bars after pivot point D (or point C for incomplete patterns) before a pattern is considered valid. This affects how soon patterns will be drawn and entries can be placed.' },
  { id: 'pctErr', type: 'float', title: 'Allowed fib ratio error %', defval: 15.0, min: 0.0, max: 50.0, step: 1.0, inline: 'err', group: G_PATTERN },
  { id: 'pctAsym', type: 'float', title: 'Allowed leg length asymmetry %', defval: 250.0, min: 0.0, max: 1000.0, step: 1.0, inline: 'asym',
    group: G_PATTERN,
    tooltip: 'A leg is considered valid if its length (ΔX/number of bars) is within this % of the average length of the other legs in the pattern.' },
  { id: 'weightErr', type: 'float', title: 'Weight', defval: 4.0, min: 0.0, step: 0.1, inline: 'err', group: G_PATTERN,
    tooltip: 'A leg is considered valid if its retracement (ΔY) ratio is within this % of the defined harmonic ratio. Weight determines the weight of retracement % error in the total score calculation for a pattern.' },
  { id: 'timeLimit', type: 'float', title: 'Pattern time limit', defval: 3, min: 0.1, step: 0.1, group: G_PATTERN,
    tooltip: 'Time limit for a completed pattern to reach the projected targets. Value is specified in terms of total pattern length (point X to point D), i.e. a value of 1 will allow one pattern length to elapse before the pattern times out and can no longer be considered successful. Patterns that time out will not count towards the success rates in the results table.' },
  { id: 'weightPrz', type: 'float', title: 'Weight of PRZ level confluence', defval: 2.0, min: 0.0, step: 0.1, group: G_PATTERN,
    tooltip: 'Weight applied to Potential Reversal Zone fib level confluence in the total score calculation for a pattern. The closer together the two closest PRZ fib levels are, the higher the score.' },
  { id: 'weightD', type: 'float', title: 'Weight of point D / PRZ level confluence', defval: 3.0, min: 0.0, step: 0.1, group: G_PATTERN,
    tooltip: 'Weight applied to the confluence of point D with the Potential Reversal Zone levels in the total score calculation for a pattern. The closer point D is to either of the two confluent PRZ fib levels, the higher the score. ' },
  { id: 'alertType', type: 'string', title: 'Alert for', defval: 'Both', options: ['Potential patterns', 'Complete patterns', 'Both'],
    inline: 'alert', group: 'Alerts' },
  { id: 'bullLineColor', type: 'color', title: 'Bullish lines', defval: 'rgba(76, 175, 80, 0.8)', group: G_DISPLAY },
  { id: 'bearLineColor', type: 'color', title: 'Bearish lines', defval: 'rgba(255, 82, 82, 0.8)', group: G_DISPLAY },
  { id: 'bullLabelColor', type: 'color', title: 'Bullish labels', defval: 'rgba(76, 175, 80, 0.25)', group: G_DISPLAY },
  { id: 'bearLabelColor', type: 'color', title: 'Bearish labels', defval: 'rgba(255, 82, 82, 0.25)', group: G_DISPLAY },
  { id: 'labelTextColor', type: 'color', title: 'Label text', defval: 'rgba(255, 255, 255, 0.8)', group: G_DISPLAY },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Harmonic Pattern Detection, Prediction, and Backtesting System',
  shortTitle: 'Harmonics',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

// Colour constants of the Pine version of the script
const GREEN = '#4CAF50';
const RED = '#FF5252';
const WHITE = '#FFFFFF';
const GRAY = '#787B86';
const BLUE = '#2962FF';
const BLACK = '#363A45';

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10); na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const na = (v: number) => Number.isNaN(v);

/** Pine `for i = a to b`: counts down when a > b */
function* range(a: number, b: number): Generator<number> {
  if (a <= b) for (let i = a; i <= b; i++) yield i;
  else for (let i = a; i >= b; i--) yield i;
}

// ── reees/Fibonacci: fib_precise() and fib_from_string() ──
const F382 = math.round(0.3819660112501052, 16) as number;
const F618 = math.round(0.6180339887498948, 16) as number;
const F786 = math.round(0.7861513777574233, 16) as number;
const F886 = math.round(0.8866517793121622, 16) as number;
const F1272 = math.round(1.2720196495140689, 16) as number;
const F1414 = math.round(1.4142135623730950, 16) as number;
const F1618 = math.round(1.6180339887498948, 16) as number;
const F2618 = math.round(2.6180339887498948, 16) as number;
const FIB_FROM_STRING: Record<string, number> = {
  '.382': F382, '.5': 0.5, '.618': F618, '.786': F786, '.886': F886, '1.272': F1272, '1.414': F1414, '1.618': F1618, '2.618': F2618,
};

// ── reees/TA ──

type Flags = [boolean, boolean, boolean, boolean, boolean, boolean];

/** A ratio within the allowed % error of a harmonic ratio */
const within = (rat: number, f: number, pErr: number) => le(rat, f * (1 + pErr / 100)) && ge(rat, f * (1 - pErr / 100));

/** Validate the AB leg, per pattern type */
function testAb(ab: number, xa: number, pErr: number, types: Flags): Flags {
  const t: Flags = [false, false, false, false, false, false];
  const rat = ab / xa;
  if (types[0]) t[0] = within(rat, F618, pErr);
  if (types[1]) t[1] = within(rat, F382, pErr) || within(rat, 0.5, pErr);
  if (types[2]) t[2] = within(rat, F786, pErr);
  if (types[3]) t[3] = within(rat, F382, pErr) || within(rat, F618, pErr);
  if (types[4]) t[4] = lt(rat, 1); // no AB validation defined for shark
  if (types[5]) t[5] = within(rat, F382, pErr) || within(rat, F618, pErr);
  return t;
}

/** Validate the BC leg, per pattern type */
function testBc(bc: number, ab: number, pErr: number, types: Flags): Flags {
  const t: Flags = [false, false, false, false, false, false];
  const rat = bc / ab;
  const pass = within(rat, F886, pErr) || within(rat, F382, pErr);
  if (types[0]) t[0] = pass;
  if (types[1]) t[1] = pass;
  if (types[2]) t[2] = pass;
  if (types[3]) t[3] = pass;
  if (types[4]) t[4] = within(rat, 1.13, pErr) || within(rat, F1618, pErr);
  if (types[5]) t[5] = within(rat, F1272, pErr) || within(rat, F1414, pErr);
  return t;
}

/** test_cd(): validate the CD leg against the BC and XA legs (XC for the cypher), per pattern type */
function testCd(cd: number, bc: number, xa: number, xc: number, ad: number, pErr: number, types: Flags): Flags {
  const t: Flags = [false, false, false, false, false, false];
  const rat = cd / bc;
  const rat2 = ad / xa;
  const rat3 = cd / xc;
  if (types[0]) t[0] = (within(rat, F1272, pErr) || within(rat, F1618, pErr)) && within(rat2, F786, pErr);
  if (types[1]) t[1] = (within(rat, F1618, pErr) || within(rat, F2618, pErr)) && within(rat2, F886, pErr);
  if (types[2]) t[2] = (within(rat, F1618, pErr) || within(rat, F2618, pErr)) && (within(rat2, F1272, pErr) || within(rat2, F1618, pErr));
  if (types[3]) t[3] = (within(rat, 2.24, pErr) || within(rat, 3.618, pErr)) && within(rat2, F1618, pErr);
  if (types[4]) t[4] = (within(rat, F1618, pErr) || within(rat, 2.24, pErr)) && (within(rat2, F886, pErr) || within(rat2, 1.13, pErr));
  if (types[5]) t[5] = within(rat3, F786, pErr); // cypher point D retraces XC
  return t;
}

/** pat_xabcd_testSym(): each leg length against the average of the others (an na CD length makes every test false) */
function testSym(xax: number, abx: number, bcx: number, cdx: number, pAsym: number): boolean {
  const up = 1 + pAsym / 100;
  const down = 1 - pAsym / 100;
  if (!na(cdx) && (gt(cdx, ((xax + abx + bcx) / 3) * up) || lt(cdx, ((xax + abx + bcx) / 3) * down))) return false;
  if (gt(bcx, ((xax + abx + cdx) / 3) * up) || lt(bcx, ((xax + abx + cdx) / 3) * down)) return false;
  if (gt(abx, ((xax + bcx + cdx) / 3) * up) || lt(abx, ((xax + bcx + cdx) / 3) * down)) return false;
  if (gt(xax, ((abx + bcx + cdx) / 3) * up) || lt(xax, ((abx + bcx + cdx) / 3) * down)) return false;
  return true;
}

/** harmonic_xabcd_validateIncomplete(): the pattern types that the first 3 legs allow */
function validateIncomplete(
  xX: number, xY: number, aX: number, aY: number, bX: number, bY: number, cX: number, cY: number, pErr: number, pAsym: number, types: Flags,
): Flags | null {
  const xa = Math.abs(xY - aY);
  const ab = Math.abs(aY - bY);
  const bc = Math.abs(bY - cY);
  if (!testSym(Math.abs(xX - aX), Math.abs(aX - bX), Math.abs(bX - cX), NaN, pAsym)) return null;
  const t = testBc(bc, ab, pErr, testAb(ab, xa, pErr, types));
  return t.some((v) => v) ? t : null;
}

/** harmonic_xabcd_prz(): [near BC level, far BC level, near XA level, far XA level] of the potential reversal zone */
function harmonicPrz(type: number, xY: number, aY: number, bY: number, cY: number): [number, number, number, number] {
  let bcU = NaN;
  let bcL = NaN;
  let xaU = NaN;
  let xaL = NaN;
  const bc = cY - bY;
  const xa = aY - xY;
  const xc = cY - xY;
  if (type === 1) {
    bcU = cY - F1272 * bc;
    bcL = cY - F1618 * bc;
    xaU = aY - F786 * xa;
  } else if (type === 2) {
    bcU = cY - F1618 * bc;
    bcL = cY - F2618 * bc;
    xaU = aY - F886 * xa;
  } else if (type === 3) {
    bcU = cY - F1618 * bc;
    bcL = cY - F2618 * bc;
    xaU = aY - F1272 * xa;
    xaL = aY - F1618 * xa;
  } else if (type === 4) {
    bcU = cY - 2.24 * bc;
    bcL = cY - 3.618 * bc;
    xaU = aY - F1618 * xa;
  } else if (type === 5) {
    bcU = cY - F1618 * bc;
    bcL = cY - 2.24 * bc;
    xaU = aY - F886 * xa;
    xaL = aY - 1.13 * xa;
  } else if (type === 6) {
    xaU = cY - F786 * xc; // cypher uses retracement of XC
  }
  return [bcU, bcL, xaU, xaL];
}

/** harmonic_xabcd_przClosest(): the two closest PRZ levels [lower, higher] */
function przClosest(l1: number, l2: number, l3: number, l4: number): [number, number] {
  const a = [l1, l2, l3, l4].filter((v) => !na(v));
  let lL = NaN;
  let lH = NaN;
  if (a.length === 1) {
    lL = a[0];
    lH = a[0];
  } else if (a.length === 2) {
    lL = array.min(a);
    lH = array.max(a);
  } else if (a.length > 2) {
    array.sort(a);
    lL = a[0];
    lH = a[1];
    let ld = lH - lL;
    if (lt(a[2] - a[1], ld)) {
      ld = a[2] - a[1];
      lL = a[1];
      lH = a[2];
    }
    if (a.length === 4) {
      if (lt(a[3] - a[2], ld)) {
        lL = a[2];
        lH = a[3];
      }
    }
  }
  return [lL, lH];
}

/** harmonic_xabcd_przRange(): [upper, lower] PRZ levels */
function przRange(l1: number, l2: number, l3: number, l4: number): [number, number] {
  const a = [l1, l2, l3, l4];
  return [array.max(a), array.min(a)];
}

/** harmonic_xabcd_rAndE(): the ratio of two legs and its error against the harmonic ratio of the type */
function rAndE(type: number, l: 'xab' | 'abc' | 'bcd' | 'xad', l1: number, l2: number): [number, number] {
  const r = Math.abs(l1) / Math.abs(l2);
  const err = (f: number) => Math.abs(1 - r / f);
  // math.min gives na with an na argument
  const min = (a: number, b: number) => (na(a) || na(b) ? NaN : Math.min(a, b));
  let e = NaN;
  if (l === 'xab') {
    if (type === 1) e = err(F618);
    else if (type === 2) e = min(err(F382), err(0.5));
    else if (type === 3) e = err(F786);
    else if (type === 4) e = min(err(F382), err(F618));
    else if (type === 6) e = min(err(F382), err(F618));
  } else if (l === 'abc') {
    if (type === 5) e = min(err(1.13), err(F1618));
    else if (type === 6) e = min(err(F1272), err(F1414));
    else e = min(err(F382), err(F886));
  } else if (l === 'bcd') {
    if (type === 1) e = min(err(F1272), err(F1618));
    else if (type === 2) e = min(err(F1618), err(F2618));
    else if (type === 3) e = min(err(F1618), err(F2618));
    else if (type === 4) e = min(err(2.24), err(3.618));
    else if (type === 5) e = min(err(F1618), err(2.24));
  } else {
    if (type === 1) e = err(F786);
    else if (type === 2) e = err(F886);
    else if (type === 3) e = min(err(F1272), err(F1618));
    else if (type === 4) e = err(F1618);
    else if (type === 5) e = min(err(F886), err(1.13));
    else if (type === 6) e = err(F786);
  }
  return [r, e];
}

/**
 * harmonic_xabcd_score() and harmonic_xabcd_scoreTot(): [total score, average ratio error, point D error, PRZ
 * score]. The weight of the leg length asymmetry is 0 in the script, and the average deviation is not used.
 */
function harmonicScore(
  tp: number, xY: number, aY: number, bY: number, cY: number, dY: number, wE: number, wP: number, wD: number,
): [number, number, number, number] {
  const [, xbre] = rAndE(tp, 'xab', aY - bY, aY - xY);
  const [, acre] = rAndE(tp, 'abc', cY - bY, aY - bY);
  const [, bdre] = rAndE(tp, 'bcd', cY - dY, cY - bY);
  const [, xdre] = rAndE(tp, 'xad', tp === 6 ? cY - dY : aY - dY, tp === 6 ? cY - xY : aY - xY);
  const [bcN, bcF, xaN, xaF] = harmonicPrz(tp, xY, aY, bY, cY);
  // harmonic_xabcd_przScore(): closeness of the two closest PRZ levels, relative to the height of the XA leg
  const h = Math.abs(aY - xY);
  const [cpl1, cpl2] = przClosest(bcN, bcF, xaN, xaF);
  const przscore = 1 - (cpl2 - cpl1) / h;
  // harmonic_xabcd_eAvg()
  const eavg = array.avg([xbre, acre, bdre, xdre].filter((v) => !na(v)));
  // harmonic_xabcd_eD(): closeness of D to either of the two closest PRZ levels
  const dCpl = gt(Math.abs(cpl1 - dY), Math.abs(cpl2 - dY)) ? Math.abs(cpl2 - dY) : Math.abs(cpl1 - dY);
  const eD = dCpl / h;
  const wA = 0.0;
  let s: number;
  if (!na(eD)) {
    s = tp === 6
      ? (0 * wA + (1 - eavg) * wE + (1 - eD) * wD) / (wA + wE + wD)
      : (0 * wA + (1 - eavg) * wE + przscore * wP + (1 - eD) * wD) / (wA + wE + wP + wD);
  } else {
    s = tp === 6 ? (0 * wA + (1 - eavg) * wE) / (wA + wE) : (0 * wA + (1 - eavg) * wE + przscore * wP) / (wA + wE + wP);
  }
  return [s, eavg, eD, przscore];
}

/** resolveTarget(): the level of a target ("A", ".618 AD", ...; "None" gives na) */
function resolveTarget(tgt: string, xY: number, aY: number, bY: number, cY: number, dY: number): number {
  const a = tgt.split(' ');
  if (a.length === 1) return tgt === 'A' ? aY : tgt === 'B' ? bY : tgt === 'C' ? cY : NaN;
  const r = FIB_FROM_STRING[a[0]] ?? NaN;
  const b = a[1] === 'AD' ? aY - dY : a[1] === 'XA' ? aY - xY : a[1] === 'CD' ? cY - dY : NaN;
  return gt(b * r + dY, 0) ? b * r + dY : 0.0;
}

/** harmonic_xabcd_stop() */
function harmonicStop(
  stop: StopBasis, stopPct: number, bull: boolean, xY: number, dY: number, upper: number, lower: number, t1: number, eY: number,
): number {
  const e = na(eY) ? dY : eY;
  const pos = (v: number) => (gt(v, 0) ? v : 0.0);
  // math.min / math.max give na with an na argument
  const min = (a: number, b: number) => (na(a) || na(b) ? NaN : Math.min(a, b));
  const max = (a: number, b: number) => (na(a) || na(b) ? NaN : Math.max(a, b));
  if (bull) {
    if (stop === '% beyond Point D') return pos(dY * (1 - stopPct / 100));
    if (stop === '% beyond X or D') return pos(min(xY, dY) * (1 - stopPct / 100));
    if (stop === '% beyond entry') return pos(e * (1 - stopPct / 100));
    if (stop === '% of distance to target 1, beyond entry') return pos(e - (stopPct / 100) * (t1 - e));
    return pos(lower * (1 - stopPct / 100));
  }
  if (stop === '% beyond Point D') return dY * (1 + stopPct / 100);
  if (stop === '% beyond X or D') return max(xY, dY) * (1 + stopPct / 100);
  if (stop === '% beyond entry') return e * (1 + stopPct / 100);
  if (stop === '% of distance to target 1, beyond entry') return e + (stopPct / 100) * (e - t1);
  return upper * (1 + stopPct / 100);
}

/** harmonic_xabcd_fibDispTxt(): [AB/XA, BC/AB, CD/BC, AD/XA] theoretical ratios as text */
function fibDispTxt(tp: number): [string, string, string, string] {
  const rb = ['0.618', '0.382 | 0.5', '0.786', '0.382 | 0.618', 'NA', '0.382 | 0.618'][tp - 1];
  const rc = ['0.382 | 0.886', '0.382 | 0.886', '0.382 | 0.886', '0.382 | 0.886', '1.13 | 1.618', '1.272 | 1.414'][tp - 1];
  const rd1 = ['1.272 | 1.618', '1.618 | 2.618', '1.618 | 2.618', '2.24 | 3.618', '1.618 | 2.24', 'NA'][tp - 1];
  const rd2 = ['0.786', '0.886', '1.272 | 1.618', '1.618', '0.886 | 1.13', '0.786'][tp - 1];
  return [rb, rc, rd1, rd2];
}

/** harmonic_xabcd_symbol() */
const harmonicSymbol = (tp: number) => ['Ɠ', '🦇', '🦋', '🦀', '🦈', 'Ƈ'][tp - 1] ?? '';

// ── Objects ──

/** A bool that can be na */
type Tri = boolean | null;

type Ln = ReturnType<typeof line.new>;
type Lb = ReturnType<typeof label.new>;
type Fill = ReturnType<typeof linefill.new>;

/** reees/Pattern: point */
interface Pt { x: number; y: number }

/** reees/Obj_XABCD_Harmonic: xabcd_harmonic */
interface Pat {
  bull: boolean;
  /** 1 = Gartley, 2 = Bat, 3 = Butterfly, 4 = Crab, 5 = Shark, 6 = Cypher */
  tp: number;
  x: Pt; a: Pt; b: Pt; c: Pt; d: Pt;
  rXb: number; reXb: number; rAc: number; reAc: number; rBd: number; reBd: number; rXd: number; reXd: number;
  score: number; scoreEAvg: number; scorePrz: number; scoreED: number;
  przBN: number; przBF: number; przXN: number; przXF: number;
  t1Hit: Tri; t1: number; t2Hit: Tri; t2: number; sHit: Tri; stop: number;
  eHit: Tri; e: Pt; invalidD: Tri;
  pLines: Array<Ln | null>; pLabel: Lb | null;
  pid: string;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HarmonicPatternDetectionPredictionAndInputs> = {},
): IndicatorResult & {
  lines: LineDrawingData[]; linefills: LinefillData[]; labels: LabelData[]; tables: TableData[]; alertCalls: AlertCall[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lastBarIndex = n - 1;
  const tB = Math.trunc(cfg.validationLength);
  const { pctErr, pctAsym } = cfg;
  const typeOn: Flags = [cfg.gartOn, cfg.batOn, cfg.bflyOn, cfg.crabOn, cfg.sharkOn, cfg.cyphOn];
  const includeTps = [1, 2, 3, 4, 5, 6].filter((tp) => typeOn[tp - 1]);
  const target1 = (tp: number) => [cfg.gartT1, cfg.batT1, cfg.bflyT1, cfg.crabT1, cfg.sharkT1, cfg.cyphT1][tp - 1] ?? cfg.gartT1;
  const target2 = (tp: number) => [cfg.gartT2, cfg.batT2, cfg.bflyT2, cfg.crabT2, cfg.sharkT2, cfg.cyphT2][tp - 1] ?? cfg.gartT2;

  // Bar values with a history offset (na before the first bar)
  let bi = 0;
  const H = (k: number) => (bi - k >= 0 && k >= 0 ? bars[bi - k].high : NaN);
  const L = (k: number) => (bi - k >= 0 && k >= 0 ? bars[bi - k].low : NaN);

  // ── Drawings: in the library registry (max_lines_count = max_labels_count = 500; linefills follow
  // max_lines_count), which applies the count limit with its rules ──
  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });
  const newLine = (x1: number, y1: number, x2: number, y2: number, css: string, width = 1, style: NonNullable<LineDrawingData['style']> = 'solid'): Ln =>
    // a bar index with a fraction (a division of two bar counts) is truncated
    line.new(Math.trunc(x1), y1, Math.trunc(x2), y2, 'bar_index', 'none', css, style, width);
  const deleteLine = (l: Ln | null) => {
    if (l) line.delete(l);
  };
  const newLabel = (x: number, y: number, text: string, style: LabelStyle, css: string, textColor: string, size: PineSize, tooltip = ''): Lb =>
    label.new(Math.trunc(x), y, text, 'bar_index', 'price', css, style, textColor, size, undefined, tooltip);
  const deleteLabel = (l: Lb | null) => {
    if (l) label.delete(l);
  };
  const newFill = (line1: Ln | null, line2: Ln | null, css: string): Fill | null => (line1 && line2 ? linefill.new(line1, line2, css) : null);

  // ── Data structures of the script ──
  /** Completed patterns, by "a" (bullish) / "b" (bearish) + type */
  const completed: Record<string, Pat[]> = {};
  for (const side of ['a', 'b']) for (let tp = 1; tp <= 6; tp++) completed[side + tp] = [];
  const typeToArray = (bull: boolean, tp: number) => completed[(bull ? 'a' : 'b') + tp];
  let pending: Pat[] = [];
  let inc: Pat[] = [];
  const fullIpL: Lb[] = [];
  const fullIpLn: Ln[] = [];
  const fullIpLf: Fill[] = [];

  // ── reees/Obj_XABCD_Harmonic ──
  const fmt = (v: number, f?: string) => (f === undefined ? str.tostring(v) : str.tostring(v, f));
  const pidOf = (p: Pat) => `${fmt(p.tp)}_${fmt(p.x.x)}_${fmt(p.a.x)}_${fmt(p.b.x)}_${fmt(p.c.x)}_${fmt(p.d.x)}`;
  const getName = (p: Pat) =>
    (p.bull ? 'Bullish' : 'Bearish') + ' ' + (['Gartley', 'Bat', 'Butterfly', 'Crab', 'Shark', 'Cypher'][p.tp - 1] ?? 'Undefined harmonic');

  // alert(alertMsg(p), alert.freq_once_per_bar_close)
  const alertCalls: AlertCall[] = [];
  const alertMsg = (p: Pat) => (na(p.d.x) ? 'Potential ' + getName(p) + ' is forming.' : getName(p) + ' has formed.');
  const fireAlert = (p: Pat) =>
    alertCalls.push({ time: bars[bi].time as number, message: alertMsg(p), freq: 'once_per_bar_close' });

  /** init() with an explicit type: a new object, or `p` initialised again (its drawings are deleted) */
  const init = (
    xX: number, xY: number, aX: number, aY: number, bX: number, bY: number, cX: number, cY: number, dX: number, dY: number, tp: number,
    p: Pat | null = null,
  ): Pat | null => {
    let validType = tp > 0 && tp < 7 ? tp : NaN;
    const bull = lt(xY, aY);
    // validAbcd()
    const valid = bull
      ? gt(aY, bY) && gt(cY, bY) && (na(dY) ? true : gt(cY, dY))
      : lt(aY, bY) && lt(cY, bY) && (na(dY) ? true : lt(cY, dY));
    if (!valid) validType = NaN;
    if (na(validType)) return p;
    if (p) {
      // delete_drawings()
      for (const l of p.pLines) deleteLine(l);
      deleteLabel(p.pLabel);
    }
    const invalidD = p ? p.invalidD : null;
    const [xbr, xbre] = rAndE(validType, 'xab', aY - bY, aY - xY);
    const [acr, acre] = rAndE(validType, 'abc', cY - bY, aY - bY);
    const [bdr, bdre] = rAndE(validType, 'bcd', cY - dY, cY - bY);
    const [xdr, xdre] = rAndE(validType, 'xad', aY - dY, aY - xY);
    const [s, eavg, eD, przscore] = harmonicScore(validType, xY, aY, bY, cY, dY, cfg.weightErr, cfg.weightPrz, cfg.weightD);
    const [bcN, bcF, xaN, xaF] = harmonicPrz(validType, xY, aY, bY, cY);
    const values = {
      bull, tp: validType,
      x: { x: xX, y: xY }, a: { x: aX, y: aY }, b: { x: bX, y: bY }, c: { x: cX, y: cY }, d: { x: dX, y: dY },
      rXb: xbr, reXb: xbre, rAc: acr, reAc: acre,
      rBd: invalidD ? NaN : bdr, reBd: invalidD ? NaN : bdre, rXd: invalidD ? NaN : xdr, reXd: invalidD ? NaN : xdre,
      score: s, scoreEAvg: eavg, scorePrz: przscore, scoreED: invalidD ? NaN : eD,
      przBN: bcN, przBF: bcF, przXN: xaN, przXF: xaF,
      pLines: [] as Array<Ln | null>,
    };
    let obj: Pat;
    if (p) {
      obj = Object.assign(p, values);
    } else {
      obj = {
        ...values, t1Hit: null, t1: NaN, t2Hit: null, t2: NaN, sHit: null, stop: NaN, eHit: null, e: { x: NaN, y: NaN }, invalidD: null,
        pLabel: null, pid: '',
      };
    }
    obj.pid = pidOf(obj);
    return obj;
  };

  /** erase_pattern() */
  const erasePatternLines = (p: Pat) => {
    for (const l of p.pLines) deleteLine(l);
    p.pLines = [];
  };
  /** erasePattern() of the script: lines and label */
  const erasePattern = (p: Pat) => {
    erasePatternLines(p);
    deleteLabel(p.pLabel);
  };

  /** draw_pattern(), with reees/Draw xabcd() */
  const drawPatternLines = (p: Pat, clr: string) => {
    erasePatternLines(p);
    const [lower, higher] = przClosest(p.przBN, p.przBF, p.przXN, p.przXF);
    // potential point D for an incomplete pattern
    const iE = na(p.d.x) ? (p.bull ? higher : lower) : NaN;
    const lcol = String(color.new(clr, 20));
    const lfcol = String(color.new(p.bull ? GREEN : RED, 85));
    const complete = !na(p.d.x);
    const style = complete ? 'solid' : 'dotted';
    const avgX = Math.trunc(((p.a.x - p.x.x + (p.b.x - p.a.x) + (p.c.x - p.b.x)) / 3) * 1.5);
    const l1 = newLine(p.x.x, p.x.y, p.a.x, p.a.y, lcol, 3, style);
    const l2 = newLine(p.a.x, p.a.y, p.b.x, p.b.y, lcol, 3, style);
    const l3 = newLine(p.b.x, p.b.y, p.c.x, p.c.y, lcol, 3, style);
    const l4 = complete
      ? newLine(p.c.x, p.c.y, p.d.x, p.d.y, lcol, 3, style)
      : lt(iE, 0) ? null : newLine(p.c.x, p.c.y, p.c.x + avgX, iE, lcol, 2, 'arrow_right');
    const l5 = complete ? newLine(p.x.x, p.x.y, p.b.x, p.b.y, lcol, 2, style) : null;
    const l6 = complete ? newLine(p.b.x, p.b.y, p.d.x, p.d.y, lcol, 2, style) : null;
    if (complete) {
      newFill(l1, l5, lfcol);
      newFill(l3, l6, lfcol);
    }
    p.pLines = [l1, l2, l3, l4, l5, l6];
  };

  /** draw_label() */
  const drawLabel = (p: Pat, clr: string, txtClr: string, txt: string, tooltip: string) => {
    deleteLabel(p.pLabel);
    const lbstyle: LabelStyle = p.bull ? 'label_up' : 'label_down';
    let lbl: Lb;
    if (!na(p.d.x)) {
      lbl = newLabel(p.d.x, p.d.y, txt, lbstyle, clr, txtClr, 'small', tooltip);
    } else if (p.pLines.length > 0) {
      const l4 = p.pLines[3];
      // line.get_x2() / line.get_y2() of a deleted line are na
      lbl = l4
        ? newLabel(line.get_x2(l4), line.get_y2(l4), txt, lbstyle, clr, txtClr, 'small', tooltip)
        : newLabel(p.c.x, p.c.y, txt, lbstyle, clr, txtClr, 'small', tooltip);
    } else {
      lbl = newLabel(p.c.x, p.c.y, txt, lbstyle, clr, txtClr, 'small', tooltip);
    }
    p.pLabel = lbl;
  };

  // ── reees/Draw: markers ──
  const NO_BG = String(color.new(WHITE, 100));
  const eventLine = (x1: number, y1: number, x2: number, y2: number, bull: boolean) =>
    newLine(x1, y1, x2, y2, String(color.new(bull ? GREEN : RED, 30)), 1, 'dotted');
  /** eHitLbl(): entry marker and a dotted line from D */
  const eHitLbl = (x: number, e: number, dX: number, dY: number, bull: boolean, lOnly = false) => {
    if (!lOnly) newLabel(x, e, '🚪', 'none', NO_BG, BLACK, 'small', 'Entry @ ' + fmt(e, '#.#####'));
    eventLine(dX, dY, x, e, bull);
  };
  /** tHitLbl(): target marker and a dotted line from the entry */
  const tHitLbl = (x: number, tgt: number, eX: number, eY: number, bull: boolean) => {
    newLabel(x, tgt, '✅', 'none', NO_BG, BLACK, 'tiny', 'Hit target @ ' + fmt(tgt, '#.#####'));
    eventLine(eX, eY, x, tgt, bull);
  };
  /** sHitLbl(): stop marker and a dotted line from the entry */
  const sHitLbl = (x: number, s: number, eX: number, eY: number, bull: boolean) => {
    newLabel(x, s, '❌', 'none', NO_BG, BLACK, 'tiny', 'Hit stop @ ' + fmt(s, '#.#####'));
    eventLine(eX, eY, x, s, bull);
  };

  // ── Functions of the script ──
  /** Timeout period of a completed pattern */
  const tLimit = (xX: number, dX: number) => Math.trunc((dX - xX) * cfg.timeLimit);
  /** Timeout of an incomplete pattern: the longest CD leg that the asymmetry input allows */
  const incTLimit = (xX: number, cX: number) => Math.trunc(((cX - xX) / 3) * (1 + pctAsym / 100));
  /** Entry has timed out */
  const eTimeout = (xX: number, dX: number) => bi - dX > Math.trunc((dX - xX) * cfg.entryWindow);
  /** Pattern still active within the timeout period */
  const stillActive = (xX: number, dX: number) => bi - tLimit(xX, dX) <= dX && eTimeout(xX, dX) === false && !na(dX);
  /** The score is too low to enter a trade */
  const noEntry = (p: Pat) => (!na(p.d.x) ? lt(p.score, cfg.scoreAboveD / 100) : lt(p.score, cfg.scoreAboveC / 100));

  /** harmonic_xabcd_entry(): [nearest level, level after C, level after D] */
  const entry = (p: Pat): [number, number, number] => {
    if (noEntry(p)) return [NaN, NaN, NaN];
    const t = p.bull;
    const [bcN, bcF, xaN, xaF] = harmonicPrz(p.tp, p.x.y, p.a.y, p.b.y, p.c.y);
    const [lPrz, hPrz] = przClosest(bcN, bcF, xaN, xaF);
    const [u, l] = przRange(bcN, bcF, xaN, xaF);
    let afterD = NaN;
    let afterC = NaN;
    const dY = p.d.y;
    if (cfg.enterAfterD) afterD = na(dY) ? NaN : t ? dY * (1 + cfg.enterLimitPctD / 100) : dY * (1 - cfg.enterLimitPctD / 100);
    if (cfg.enterAfterC) {
      const lvl = cfg.enterAtC;
      afterC = lvl === 'Nearest confluent PRZ level' ? (t ? hPrz : lPrz)
        : lvl === 'Farthest confluent PRZ level' ? (t ? lPrz : hPrz)
          : lvl === 'Nearest PRZ level' ? (t ? u : l)
            : lvl === 'Farthest PRZ level' ? (t ? l : u)
              : hPrz - (hPrz - lPrz) / 2;
    }
    afterD = lt(afterD, 0) ? 0 : afterD;
    afterC = lt(afterC, 0) ? 0 : afterC;
    // with a value for both, the closest one
    const lvl = !na(afterD) && !na(afterC) ? (t ? Math.max(afterD, afterC) : Math.min(afterD, afterC)) : !na(afterD) ? afterD : afterC;
    return [lvl, afterC, afterD];
  };

  /** entryHit(): [hit (na: not yet), bar, level] */
  const entryHit = (p: Pat): [Tri, number, number] => {
    if (p.eHit !== null) return [p.eHit, p.e.x, p.e.y];
    if ((!na(p.d.x) && eTimeout(p.x.x, p.d.x)) || noEntry(p)) return [false, NaN, NaN];
    const [, afterC, afterD] = entry(p);
    // xabcd_entryHit()
    const { open, high, low } = bars[bi];
    const t = p.bull;
    const dX = p.d.x;
    let bar = NaN;
    let eLvl = NaN;
    let flag = false;
    if (cfg.enterAfterC && !na(afterC) && (na(dX) || bi < dX + tB)) {
      // entry between C and a valid point D: on the level when hit from the other side, else on the open
      if (t && le(low, afterC)) {
        flag = true;
        bar = bi;
        eLvl = gt(open, afterC) ? afterC : open;
      } else if (!t && ge(high, afterC)) {
        flag = true;
        bar = bi;
        eLvl = lt(open, afterC) ? afterC : open;
      }
    } else if (cfg.enterAfterD && !na(dX) && !na(afterD)) {
      if (t && le(low, afterD)) {
        flag = true;
        bar = bi;
        eLvl = gt(open, afterD) ? afterD : open;
      } else if (!t && ge(high, afterD)) {
        flag = true;
        bar = bi;
        eLvl = lt(open, afterD) ? afterD : open;
      }
    }
    if (!na(eLvl) && ((p.bull && lt(p.t1, eLvl)) || (!p.bull && gt(p.t1, eLvl)))) return [null, NaN, NaN];
    return [flag ? true : null, bar, eLvl];
  };

  /** tradeClosed(): target or stop hit on the current bar */
  const tradeClosed = (
    eX: number, eY: number, stop: number, t1h: Tri, t2h: Tri, t1: number, t2: number,
  ): [Tri, Tri, Tri, number, number, number, number] => {
    const { open, high, low, close } = bars[bi];
    let t1Hit: Tri = null;
    let t2Hit: Tri = null;
    let sHit: Tri = null;
    let t1x = NaN;
    let t1y = NaN;
    let t2x = NaN;
    let t2y = NaN;
    const onEntryBar = bi === eX;
    if (lt(stop, t1)) {
      // long
      if (t2h === null && ge(high, t2) && !na(t2) && (!onEntryBar || lt(open, eY) || ge(close, t2))) {
        t1x = bi;
        t1y = t1;
        t2x = bi;
        t2y = t2;
        t1Hit = true;
        t2Hit = true;
      } else if (t1h === null && ge(high, t1) && (!onEntryBar || lt(open, eY) || ge(close, t1))) {
        t1x = bi;
        t1y = t1;
        t1Hit = true;
      } else if ((t2h === null || t2h === false) && lt(low, stop) && (!onEntryBar || gt(open, stop) || le(close, stop))) {
        sHit = true;
        t1Hit = t1h ? true : false;
        t2Hit = false;
        if (t1Hit === false) {
          t1x = bi;
          t1y = stop;
        }
      } else {
        t1Hit = t1h;
        t2Hit = t2h;
      }
    } else if (t2h === null && le(low, t2) && !na(t2) && (!onEntryBar || gt(open, eY) || le(close, t2))) {
      t1x = bi;
      t1y = t1;
      t2x = bi;
      t2y = t2;
      t1Hit = true;
      t2Hit = true;
    } else if (t1h === null && le(low, t1) && (!onEntryBar || gt(open, eY) || le(close, t1))) {
      t1x = bi;
      t1y = t1;
      t1Hit = true;
    } else if ((t2h === null || t2h === false) && gt(high, stop) && (!onEntryBar || lt(open, stop) || ge(close, stop))) {
      sHit = true;
      t1Hit = t1h ? true : false;
      t2Hit = false;
      if (t1Hit === false) {
        t1x = bi;
        t1y = stop;
      }
    } else {
      t1Hit = t1h;
      t2Hit = t2h;
    }
    return [t1Hit, t2Hit, sHit, t1x, t1y, t2x, t2y];
  };

  /** success(): [target 1 hit, target 2 hit, stop hit, and the points of the hits] */
  const success = (p: Pat): [Tri, Tri, Tri, number, number, number, number] => {
    if (p.sHit || p.t2Hit) return [p.t1Hit, p.t2Hit, p.sHit, NaN, NaN, NaN, NaN];
    if (bi <= p.d.x + tLimit(p.x.x, p.d.x) && p.eHit) return tradeClosed(p.e.x, p.e.y, p.stop, p.t1Hit, p.t2Hit, p.t1, p.t2);
    return [p.t1Hit, p.t2Hit, p.sHit, NaN, NaN, NaN, NaN];
  };

  const successTxt = (p: Pat) => {
    const active = stillActive(p.x.x, p.d.x);
    if (p.t2Hit) return ' (Success - Target 1, Target 2)';
    if (p.t1Hit) return ' (Success - Target 1)';
    if (p.sHit) return ' (Failed)';
    if (noEntry(p) && active) return ' (No entry)';
    if ((p.eHit === false || p.eHit === null) && active === false) return ' (Missed entry)';
    if (p.eHit === null && active) return ' (Entry pending)';
    if (p.t1Hit === null && active) return ' (Targets pending)';
    return ' (Timed out)';
  };
  const ratToStr = (r: number) => (na(r) ? 'NA    ' : fmt(r, '0.000'));
  const reToStr = (r: number) => (na(r) ? 'NA    ' : fmt(r, '0.0') + '%');

  /** Tooltip of a completed pattern */
  const ttTxt = (p: Pat) => {
    const [rb, rc, rd1, rd2] = fibDispTxt(p.tp);
    const [, , e] = entry(p);
    const l1 = getName(p) + successTxt(p) + '\n\n';
    const l2 = (p.invalidD ? 'Incomplete' : 'Total') + ' Score:  ' + fmt(p.score * 100, '#.###') + '\n';
    const l3 = '   Leg retracement accuracy:  ' + fmt((1 - p.scoreEAvg) * 100, '#.##') + '%\n';
    const l42 = '   PRZ level confluence:  ' + (p.tp === 6 ? 'NA' : fmt(p.scorePrz * 100, '#.##') + '%') + '\n';
    const l43 = '   Point D confluence with PRZ:  ' + (p.invalidD ? 'NA (D unconfirmed)' : fmt((1 - p.scoreED) * 100, '#.##') + '%') + '\n';
    const l5 = '\n              Actual     % Err       Theoretical\n';
    const l6 = 'AB/XA     ' + fmt(p.rXb, '0.000') + '      ' + (p.tp === 5 ? 'NA     ' : fmt(p.reXb * 100, '00.0') + '%') + '      ' + rb + '\n';
    const l7 = 'BC/AB     ' + fmt(p.rAc, '0.000') + '      ' + fmt(p.reAc * 100, '00.0') + '%      ' + rc + '\n';
    const l8 = 'CD/BC     ' + ratToStr(p.rBd) + '      ' + (p.tp === 6 ? 'NA    ' : reToStr(p.reBd * 100)) + '       ' + rd1 + '\n';
    const l9 = (p.tp === 6 ? 'CD/XC     ' : 'AD/XA     ') + ratToStr(p.rXd) + '      ' + reToStr(p.reXd * 100) + '       ' + rd2 + '\n';
    const l91 = '\nTarget 1:  ' + fmt(p.t1, '#.#####') + '\nTarget 2:  ' + fmt(p.t2, '#.#####');
    const l92 = '\nEntry:  ' + fmt(na(p.e.y) ? e : p.e.y, '#.#####');
    const l93 = na(p.stop) ? '' : '\nStop:  ' + fmt(p.stop, '#.#####');
    return l1 + l2 + l3 + l42 + l43 + l5 + l6 + l7 + l8 + l9 + l92 + l93 + l91;
  };

  /** reees/Draw incTtTxt(): tooltip of an incomplete pattern */
  const incTtTxt = (p: Pat, e: number) => {
    const [rb, rc, rd1, rd2] = fibDispTxt(p.tp);
    const lvl = (v: number) => (lt(v, 0) ? '<0' : fmt(v, '#.#####'));
    const l1 = 'Potential ' + getName(p) + ' (' + fmt(p.score * 100, '#.##') + '%)\n\n';
    const l2 = '    Potential Reversal Zone:\n';
    const l21 = '     Entry:  ' + fmt(e, '#.#####') + '\n';
    const l211 = '        BC retracement (' + rd1 + ')\n';
    const l3 = '            Near:   ' + lvl(p.przBN) + '\n';
    const l4 = '            Far:     ' + lvl(p.przBF) + '\n';
    const l41 = '        XA retracement (' + rd2 + ')\n';
    const l42 = '            Near:   ' + lvl(p.przXN) + '\n';
    const l43 = '            Far:     ' + (!na(p.przXF) ? lvl(p.przXF) : 'N/A') + '\n';
    const l5 = '\n              Actual     % Err       Theoretical\n';
    const l6 = 'AB/XA     ' + fmt(p.rXb, '0.000') + '      ' + (p.tp === 5 ? 'NA    ' : fmt(p.reXb * 100, '00.0') + '%') + '      ' + rb + '\n';
    const l7 = 'BC/AB     ' + fmt(p.rAc, '0.000') + '      ' + fmt(p.reAc * 100, '00.0') + '%      ' + rc + '\n';
    const l8 = 'CD/BC      ' + 'TBD ' + '         -          ' + rd1 + '\n';
    const l9 = (p.tp === 6 ? 'CD/XC      ' : 'AD/XA      ') + 'TBD ' + '         -          ' + rd2 + '\n';
    return l1 + l2 + (na(e) ? '' : l21) + l211 + l3 + l4 + l41 + l42 + l43 + l5 + l6 + l7 + l8 + l9;
  };

  const status = (p: Pat) => {
    const active = stillActive(p.x.x, p.d.x);
    if (p.t2Hit) return ' ✅✅';
    if (p.t1Hit) return ' ✅';
    if (p.sHit) return ' ❌';
    if (active === false && (p.eHit === false || p.eHit === null)) return ' ⛔';
    if (active && noEntry(p)) return ' ⛔';
    if (active) return ' ⏳';
    return ' 🕝';
  };
  const lbTxt = (p: Pat, st: string) => harmonicSymbol(p.tp) + ' ' + fmt((math.round(p.score, 3) as number) * 100) + st;
  const incLbTxt = (p: Pat) => 'Potential ' + harmonicSymbol(p.tp) + ' (' + fmt(p.score * 100, '#.##') + ')';
  const labelCss = (p: Pat) => (p.bull ? cfg.bullLabelColor : cfg.bearLabelColor);

  const deleteInc = (pid: string) => {
    for (let j = 0; j < inc.length; j++) {
      const p = inc[j];
      if (pid === p.pid) {
        inc.splice(j, 1);
        erasePattern(p);
        break;
      }
    }
  };

  const drawPattern = (p: Pat) => {
    if (!(cfg.incOn || !na(p.d.x))) return;
    const complete = !na(p.d.x);
    const text = complete ? lbTxt(p, status(p)) : incLbTxt(p);
    const [, e] = entry(p);
    const tt = complete ? ttTxt(p) : incTtTxt(p, e);
    drawPatternLines(p, p.bull ? cfg.bullLineColor : cfg.bearLineColor);
    if (p.invalidD) {
      const l4 = p.pLines[3];
      if (l4) line.set_style(l4, 'dashed');
    }
    drawLabel(p, labelCss(p), cfg.labelTextColor, text, tt);
  };

  /** lowest() / highest() of the script: the extreme of low / high from `o` to `n` bars back (na when n < o) */
  const lowestSince = (count: number, o = 0) => {
    if (!(count >= o)) return NaN;
    let v = L(o);
    for (const i of range(o, count)) if (lt(L(i), v)) v = L(i);
    return v;
  };
  const highestSince = (count: number, o = 0) => {
    if (!(count >= o)) return NaN;
    let v = H(o);
    for (const i of range(o, count)) if (gt(H(i), v)) v = H(i);
    return v;
  };

  /** Not the same pattern as the last completed pattern of the same type */
  const notLast = (p: Pat) => {
    const comp = typeToArray(p.bull, p.tp);
    const last = comp.length === 0 ? null : comp[comp.length - 1];
    return last === null ? true : last.x.x !== p.x.x || last.a.x !== p.a.x || last.b.x !== p.b.x;
  };

  const addIncompletePattern = (t: boolean, types: Flags, xX: number, xY: number, aX: number, aY: number, bX: number, bY: number, cX: number, cY: number) => {
    const lowest = lowestSince(bi - cX);
    const highest = highestSince(bi - cX);
    // The pattern exists already (incomplete or pending)?
    let exists = false;
    const iN = inc.length;
    const iP = pending.length;
    for (let i = 0; i < iN; i++) {
      const p = inc[iN - 1 - i];
      if (p.x.x === xX && p.a.x === aX && p.b.x === bX) {
        if (p.c.x === cX) {
          exists = true;
        } else {
          // a new point C: the old incomplete pattern is deleted in favour of this one
          inc.splice(iN - 1 - i, 1);
          erasePattern(p);
        }
        break;
      }
    }
    if (!exists) {
      for (let i = 0; i < iP; i++) {
        const p = pending[iP - 1 - i];
        if (p.x.x === xX && p.a.x === aX && p.b.x === bX && p.c.x === cX) {
          exists = true;
          break;
        }
      }
    }
    if (exists) return;
    // one incomplete pattern per potential harmonic type
    for (let tp = 1; tp <= 6; tp++) {
      if (!types[tp - 1]) continue;
      const pat = init(xX, xY, aX, aY, bX, bY, cX, cY, NaN, NaN, tp);
      if (!pat) continue;
      const [, eC] = entry(pat);
      if (na(eC) || (t && lt(eC, lowest)) || (!t && gt(eC, highest))) {
        if (notLast(pat)) {
          inc.push(pat);
          if (cfg.incOn && (!na(eC) || !cfg.enterAfterC)) drawPattern(pat);
          if (cfg.alertType === 'Potential patterns' || cfg.alertType === 'Both') fireAlert(pat);
        }
      }
    }
  };

  const setTargets = (p: Pat) => {
    p.t1 = resolveTarget(target1(p.tp), p.x.y, p.a.y, p.b.y, p.c.y, p.d.y);
    p.t2 = resolveTarget(target2(p.tp), p.x.y, p.a.y, p.b.y, p.c.y, p.d.y);
  };
  const stopOf = (p: Pat) => {
    const [upper, lower] = przRange(p.przBN, p.przBF, p.przXN, p.przXF);
    return harmonicStop(cfg.stopBasis, cfg.stopPct, p.bull, p.x.y, p.d.y, upper, lower, p.t1, p.e.y);
  };
  const incPid = (p: Pat) => `${fmt(p.tp)}_${fmt(p.x.x)}_${fmt(p.a.x)}_${fmt(p.b.x)}_${fmt(p.c.x)}_${fmt(NaN)}`;

  /** deleteFip(): the drawings of the pattern in progress */
  const deleteFip = () => {
    for (const lbl of fullIpL) deleteLabel(lbl);
    fullIpL.length = 0;
    for (const ln of fullIpLn) deleteLine(ln);
    fullIpLn.length = 0;
    for (const lf of fullIpLf) linefill.delete(lf);
    fullIpLf.length = 0;
  };

  const removePending = (pid: string) => {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].pid === pid) {
        if (i === pending.length - 1) deleteFip();
        pending.splice(i, 1);
        break;
      }
    }
  };

  /** Draw a completed pattern and update the data structures */
  const addCompleted = (p: Pat, force: boolean) => {
    if (!(cfg.hsOn === false || noEntry(p) === false)) return;
    typeToArray(p.bull, p.tp).push(p);
    // delete the incomplete pattern, unless this pattern comes from it (entry after C)
    if (!force) {
      if (cfg.enterAfterD) deleteInc(incPid(p));
      p.invalidD = false;
    }
    setTargets(p);
    drawPattern(p);
    p.stop = stopOf(p);
    if (noEntry(p) === false) pending.push(p);
    // fire an alert if appropriate
    if (cfg.alertType === 'Complete patterns' || cfg.alertType === 'Both') fireAlert(p);
  };

  /** Add a pattern to the completed patterns, or update the last pattern of its type with a new point D */
  const addValidPattern = (p: Pat, force = false) => {
    let lasteH = false;
    let pat: Pat | null = null;
    const a = typeToArray(p.bull, p.tp);
    if (a.length > 0) {
      const last = a[a.length - 1];
      if (p.a.x !== last.a.x || p.b.x !== last.b.x || p.c.x !== last.c.x) {
        // A, B or C is different: a new pattern
        addCompleted(p, force);
        pat = p;
      } else if ((p.bull && lt(p.d.y, last.d.y)) || (!p.bull && gt(p.d.y, last.d.y))) {
        // same A, B, C and D beyond the D of the last pattern: replace it when the score is higher, the last D was
        // not confirmed, or the pattern comes from an entry after C
        if (le(last.score, p.score) || force || last.invalidD) {
          if (last.eHit) {
            // the entry of the last pattern was hit: keep it, with the new D
            lasteH = true;
            if (!force) last.invalidD = false;
            init(last.x.x, last.x.y, last.a.x, last.a.y, last.b.x, last.b.y, last.c.x, last.c.y, p.d.x, p.d.y, last.tp, last);
            last.stop = stopOf(last);
            drawPattern(last);
            setTargets(last);
            pat = last;
          } else {
            removePending(last.pid);
            erasePattern(a.pop()!);
            addCompleted(p, force);
            pat = p;
          }
        }
      }
    } else {
      addCompleted(p, force);
      pat = p;
    }

    if (!pat) return;
    if (lasteH) {
      eHitLbl(pat.e.x, pat.e.y, pat.d.x, pat.d.y, p.bull, true);
    } else {
      const [eHit, eX, eY] = entryHit(p);
      if (eHit) {
        pat.eHit = true;
        pat.e.x = eX;
        pat.e.y = eY;
        eHitLbl(eX, eY, pat.d.x, pat.d.y, pat.bull);
        drawLabel(p, labelCss(p), cfg.labelTextColor, lbTxt(p, status(p)), ttTxt(p));
      }
    }
  };

  const updatePendingPatterns = (): Pat[] => {
    const next: Pat[] = [];
    for (const ip of pending) {
      const [eH, eHx, eHy] = entryHit(ip);
      const limit = tLimit(ip.x.x, ip.d.x);
      const expired = bi === ip.d.x + limit + 1 || eH === false;
      const [t1h, t2h, sH, t1x, t1y, t2x, t2y] = success(ip);
      // no longer pending when the time has expired or nothing is left to update
      if (!(expired || (eH && (t2h !== null || t1h === false || sH)))) next.push(ip);
      // (an entry that failed, `eH == false`, is already in `expired`)
      const changed = expired
        || (eH && ((t1h !== null && ip.t1Hit === null) || (t2h !== null && ip.t2Hit === null)))
        || (eH !== null && ip.eHit !== null && eH !== ip.eHit) || (eH && ip.eHit === null)
        || sH;
      if (!changed) continue;
      if (eH !== null && ip.eHit === null) {
        ip.eHit = eH;
        ip.e.x = eHx;
        ip.e.y = eHy;
        eHitLbl(eHx, eHy, ip.d.x, ip.d.y, ip.bull);
      }
      if (t1h && ip.t1Hit === null) {
        ip.t1Hit = true;
        tHitLbl(t1x, t1y, eHx, eHy, ip.bull);
      } else if (t1h === false) {
        ip.t1Hit = false;
        sHitLbl(t1x, t1y, eHx, eHy, ip.bull); // the stop marker, only when no target was hit before
      }
      if (sH) ip.sHit = true;
      if (t2h) {
        ip.t2Hit = true;
        tHitLbl(t2x, t2y, eHx, eHy, ip.bull);
      }
      drawLabel(ip, labelCss(ip), cfg.labelTextColor, lbTxt(ip, status(ip)), ttTxt(ip));
    }
    return next;
  };

  const updateIncompletePatterns = (): Pat[] => {
    const next: Pat[] = [];
    const { high, low } = bars[bi];
    for (const p of inc.slice()) {
      const [upper, lower] = przRange(p.przBN, p.przBF, p.przXN, p.przXF);
      const limit = incTLimit(p.x.x, p.c.x);
      const [eH, eHx, eHy] = entryHit(p);
      if (eH && cfg.enterAfterC) {
        if (notLast(p)) {
          p.d.x = eHx;
          p.d.y = eHy;
          p.invalidD = true;
          erasePattern(p);
          addValidPattern(p, true);
        } else {
          erasePattern(p);
        }
      } else if (bi === p.c.x + limit + 1
        || (p.bull && (gt(high, p.c.y) || lt(low, lower)))
        || (!p.bull && (lt(low, p.c.y) || gt(high, upper)))) {
        // timed out or invalidated
        erasePattern(p);
      } else {
        next.push(p);
      }
    }
    return next;
  };

  /** A pivot is a valid point D of the pattern */
  const validD = (p: Pat, dX: number, dY: number): boolean => {
    if (!(dX <= incTLimit(p.x.x, p.c.x) + p.c.x)) return false;
    if (!testSym(p.a.x - p.x.x, p.b.x - p.a.x, p.c.x - p.b.x, p.d.x - p.c.x, pctAsym)) return false;
    const highest = highestSince(bi - p.c.x, 1);
    const lowest = lowestSince(bi - p.c.x, 1);
    // no intermediate high / low invalidates the CD leg
    if (!(((p.bull && le(dY, lowest)) || (!p.bull && ge(dY, highest))) && ((p.bull && ge(p.c.y, highest)) || (!p.bull && le(p.c.y, lowest))))) {
      return false;
    }
    const xa = Math.abs(p.x.y - p.a.y);
    const bc = Math.abs(p.b.y - p.c.y);
    const cd = Math.abs(p.c.y - dY);
    const ad = Math.abs(p.a.y - dY);
    const xc = Math.abs(p.x.y - p.c.y);
    const types = [1, 2, 3, 4, 5, 6].map((tp) => tp === p.tp) as Flags;
    return testCd(cd, bc, xa, xc, ad, pctErr, types).some((v) => v);
  };

  /** A pivot low / high `validation length` bars back that completes an incomplete or a pending pattern */
  const checkForValidD = () => {
    const x = bi - tB >= 0 ? bi - tB : NaN;
    let isLow = true;
    let isHigh = true;
    for (const i of range(0, tB - 1)) {
      if (lt(L(i), L(tB))) {
        isLow = false;
        break;
      }
    }
    if (isLow) {
      for (const i of range(tB + 1, tB + 3)) {
        if (lt(L(i), L(tB))) {
          isLow = false;
          break;
        }
      }
    }
    for (const i of range(0, tB - 1)) {
      if (gt(H(i), H(tB))) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) {
      for (const i of range(tB + 1, tB + 3)) {
        if (gt(H(i), H(tB))) {
          isHigh = false;
          break;
        }
      }
    }
    if (!(isLow || isHigh)) return;
    const found: Array<Pat | null> = [];
    for (const list of [inc, pending]) {
      for (const p of list) {
        if (isLow && p.bull && validD(p, x, L(tB))) {
          found.push(init(p.x.x, p.x.y, p.a.x, p.a.y, p.b.x, p.b.y, p.c.x, p.c.y, x, L(tB), p.tp));
        }
        if (isHigh && !p.bull && validD(p, x, H(tB))) {
          found.push(init(p.x.x, p.x.y, p.a.x, p.a.y, p.b.x, p.b.y, p.c.x, p.c.y, x, H(tB), p.tp));
        }
      }
    }
    for (const p of found) if (p) addValidPattern(p);
  };

  // ── reees/TA pat_xabcdIncomplete(): the pivots of each pivot length ──
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const pivots: Array<{ pl: number[]; ph: number[]; confLow: number[]; confHigh: number[] }> = [];
  for (let len = 3; len <= 20; len++) {
    pivots[len] = {
      pl: A(ta.pivotlow(lowSeries, len, len)),
      ph: A(ta.pivothigh(highSeries, len, len)),
      confLow: A(ta.pivotlow(lowSeries, len, 1)),
      confHigh: A(ta.pivothigh(highSeries, len, 1)),
    };
  }

  /** find_pattern(): a new XABC (potential) pattern for one pivot length */
  const findPattern = (len: number, t: boolean) => {
    const pv = pivots[len];
    const at = (arr: number[], k: number) => (bi - k >= 0 && k >= 0 ? arr[bi - k] : NaN);
    const conf = 1;
    const lb = len * 25 > bi ? bi : len * 25;
    let x = -1;
    let a = -1;
    let b = -1;
    let c = -1;
    let xY = 0.0;
    let aY = 0.0;
    let bY = 0.0;
    let cY = 0.0;
    let hSince = 0.0;
    let lSince = 0.0;
    let start = NaN;
    let found = false;
    // point C: the confirmed pivot is the extreme of the bars since
    let extreme = NaN;
    // plain loops instead of range(): this function runs 36 times per bar and the generator was a large part of it
    for (let i = 0; i <= len; i++) {
      if (t) {
        if (na(extreme) || gt(H(i), extreme)) extreme = H(i);
        const cv = at(pv.confHigh, i);
        if (!na(cv)) {
          if (ge(cv, extreme)) {
            c = bi - conf - i;
            cY = cv;
            start = conf + i;
          }
          break;
        }
      } else {
        if (na(extreme) || lt(L(i), extreme)) extreme = L(i);
        const cv = at(pv.confLow, i);
        if (!na(cv)) {
          if (le(cv, extreme)) {
            c = bi - conf - i;
            cY = cv;
            start = conf + i;
          }
          break;
        }
      }
    }
    if (c > -1) {
      const track = (k: number) => {
        if (gt(H(k), hSince)) hSince = H(k);
        if (lt(L(k), lSince) || eq(lSince, 0)) lSince = L(k);
      };
      // highest / lowest between C and the first potential pivot
      const trackStep = start <= len ? 1 : -1;
      for (let i = start; trackStep > 0 ? i <= len : i >= len; i += trackStep) track(i);
      // In a bullish pattern B and X are pivot lows and A is a pivot high; a bearish pattern is the mirror.
      // `same`: pivots of the kind of the point looked for; `other`: pivots of the other kind.
      // pivots of the bar looked at (set before each test)
      let ph = NaN;
      let pl = NaN;
      // looking for a low point (B and X of a bullish pattern, A of a bearish one)
      const lowPoint = (ref: number): 'break' | 'skip' | number => {
        if (gt(hSince, ref)) return 'break';
        if (!na(ph)) return gt(ph, ref) ? 'break' : 'skip';
        if (!na(pl)) {
          if (gt(pl, ref)) return 'break';
          if (lt(lSince, pl)) return 'break';
          return pl;
        }
        return 'skip';
      };
      // looking for a high point (A of a bullish pattern, B and X of a bearish one)
      const highPoint = (ref: number): 'break' | 'skip' | number => {
        if (lt(lSince, ref)) return 'break';
        if (!na(pl)) return lt(pl, ref) ? 'break' : 'skip';
        if (!na(ph)) {
          if (lt(ph, ref)) return 'break';
          if (gt(hSince, ph)) return 'break';
          return ph;
        }
        return 'skip';
      };
      const step = start <= lb ? 1 : -1;
      for (let i = start; step > 0 ? i <= lb : i >= lb; i += step) {
        track(i + len);
        ph = at(pv.ph, i);
        pl = at(pv.pl, i);
        if (b === -1) {
          const r = t ? lowPoint(cY) : highPoint(cY);
          if (r === 'break') break;
          if (r !== 'skip') {
            b = bi - i - len;
            bY = r;
            hSince = 0.0;
            lSince = 0.0;
          }
        } else if (a === -1) {
          const r = t ? highPoint(bY) : lowPoint(bY);
          if (r === 'break') break;
          if (r !== 'skip') {
            a = bi - i - len;
            aY = r;
            hSince = 0.0;
            lSince = 0.0;
          }
        } else if (x === -1) {
          const r = t ? lowPoint(aY) : highPoint(aY);
          if (r === 'break') break;
          if (r !== 'skip') {
            found = true;
            x = bi - i - len;
            xY = r;
            break;
          }
        }
      }
    }
    if (found && (cfg.lookbackOn === false || bi >= lastBarIndex - cfg.lookbackBars)) {
      const types = validateIncomplete(x, xY, a, aY, b, bY, c, cY, pctErr, pctAsym, typeOn);
      if (types) addIncompletePattern(t, types, x, xY, a, aY, b, bY, c, cY);
    }
  };

  // ── Main ──
  for (bi = 0; bi < n; bi++) {
    setDrawingBar(bi, bi === n - 1);
    inc = updateIncompletePatterns();
    pending = updatePendingPatterns();
    if (cfg.bullOn) for (let len = 3; len <= 20; len++) findPattern(len, true);
    if (cfg.bearOn) for (let len = 3; len <= 20; len++) findPattern(len, false);
    checkForValidD();
  }
  bi = n - 1;

  const tables: TableData[] = [];
  if (n > 0) {
    // ── drawFullInProgress(): the latest completed pattern, when it is still in progress ──
    if (pending.length > 0) {
      const last = pending[pending.length - 1];
      if (!na(last.d.x)) {
        const bb = lastBarIndex - last.d.x;
        const limit = tLimit(last.x.x, last.d.x);
        if (bb <= limit && noEntry(last) === false && (eTimeout(last.x.x, last.d.x) === false || last.eHit) && !last.t2Hit && !last.sHit) {
          deleteFip();
          const targetAt = (dY: number) => resolveTarget(target1(last.tp), last.x.y, last.a.y, last.b.y, last.c.y, dY);
          const bcNt = targetAt(last.przBN);
          const bcFt = targetAt(last.przBF);
          const xaNt = targetAt(last.przXN);
          const xaFt = targetAt(last.przXF);
          const [e] = entry(last);
          const entryLvl = na(last.e.y) ? e : last.e.y;
          xabcdInProgress(last, limit > 500 ? 500 : limit, entryLvl, bcNt, bcFt, xaNt, xaFt);
        } else {
          deleteFip();
        }
      }
    } else {
      deleteFip();
    }

    // ── printStats(): the results table ──
    const nR = includeTps.length + 3;
    const cells: TableCellData[] = [];
    // a cell without a text size has the size "auto" in this Pine version
    const cell = (column: number, row: number, text: string, small = true, align: 'center' | 'right' = 'center') => {
      cells.push({ column, row, text, textColor: WHITE, textHAlign: align, textSize: small ? 'small' : 'auto' });
    };
    cell(0, 0, ' ', false);
    ['Patterns', 'Trades', 'T1 Success', 'T2 Success', 'Avg Return %', 'Total Return %'].forEach((h, k) => cell(k + 1, 0, h));
    const pTot: number[] = [];
    const tTot: number[] = [];
    const t1Tot: number[] = [];
    const t2Tot: number[] = [];
    const arTot: number[] = [];
    const trTot: number[] = [];
    const pct = (v: number) => fmt(v, '#.##') + '%';
    let r = 0;
    for (const tp of includeTps) {
      r += 1;
      // rowValues(tp)
      const a1 = typeToArray(true, tp);
      const a2 = typeToArray(false, tp);
      const ra: number[] = [];
      let t1Count = 0;
      let t2Count = 0;
      let closed = 0;
      for (const [list, bull] of [[a1, true], [a2, false]] as Array<[Pat[], boolean]>) {
        for (const p of list) {
          if (!((p.t1Hit !== null || p.sHit) && p.eHit)) continue;
          const ret = (level: number) => (bull ? level / p.e.y - 1 : p.e.y / level - 1);
          if (p.t2Hit) {
            ra.push(ret(p.t2));
            t2Count += 1;
            t1Count += 1;
            closed += 1;
          } else if (p.t1Hit) {
            ra.push(ret(p.t1));
            t1Count += 1;
            closed += 1;
          } else if (p.sHit) {
            ra.push(ret(p.stop));
            closed += 1;
          }
        }
      }
      const tot = a1.length + a2.length;
      pTot.push(tot);
      tTot.push(closed);
      if (closed > 0) {
        t1Tot.push((t1Count / closed) * 100);
        t2Tot.push((t2Count / closed) * 100);
      }
      const avg = array.avg(ra);
      const sum = array.sum(ra);
      if (!na(avg)) arTot.push(avg * 100);
      if (!na(sum)) trTot.push(sum * 100);
      cell(0, r, '   ' + harmonicSymbol(tp) + '   ');
      cell(1, r, fmt(tot));
      cell(2, r, fmt(closed));
      cell(3, r, closed > 0 ? pct((t1Count / closed) * 100) : 'NA');
      cell(4, r, closed > 0 ? pct((t2Count / closed) * 100) : 'NA');
      cell(5, r, !na(avg) ? pct(avg * 100) : 'NA');
      cell(6, r, !na(sum) ? pct(sum * 100) : 'NA');
    }
    r += 1;
    const total = (v: number) => (!na(v) ? pct(v) : 'NA');
    cell(0, r, 'Total');
    cell(1, r, fmt(array.sum(pTot)));
    cell(2, r, fmt(array.sum(tTot)));
    cell(3, r, total(array.avg(t1Tot)));
    cell(4, r, total(array.avg(t2Tot)));
    cell(5, r, total(array.avg(arTot)));
    cell(6, r, total(array.sum(trTot)));
    r += 1;
    cell(0, r, '✅ = Success | ❌ = Failure | 🕝 = Timed out* | ⛔ = No entry* | ⏳ = In progress* \n*Not included in Success Rate/Return % statistics',
      true, 'right');
    tables.push({
      position: 'bottom_left', columns: 7, rows: nR, bgColor: String(color.new(BLACK, 30)), borderWidth: 1, cells,
      merges: [{ startColumn: 0, startRow: r, endColumn: 6, endRow: r }],
    });
  }

  /** reees/Draw xabcd_inProgress(): PRZ, entry, stop, targets and projected reversal paths of a pattern */
  function xabcdInProgress(last: Pat, limit: number, entryLvl: number, bcNt: number, bcFt: number, xaNt: number, xaFt: number): void {
    const { bull } = last;
    const dX = last.d.x;
    const dY = last.d.y;
    const { stop, t1, t2 } = last;
    // pat_colors()
    const red = String(color.new(RED, 50));
    const grn = String(color.new(GREEN, 50));
    const ccol = String(color.new(GRAY, 30));
    const cltxt = cfg.labelTextColor;
    const clbkg = String(color.new(BLUE, 100));
    const cproj = bull ? cfg.bullLineColor : cfg.bearLineColor;
    const cproj2 = bull ? grn : red;
    const przFill = String(color.new(RED, 80));
    const tgtFill = String(color.new(GREEN, 80));
    const midX = math.round(limit / 2) as number;
    const avgLeg = (math.round(dX - last.x.x) as number) / 4;
    const clamp = (v: number) => (lt(v, 0) ? 0 : v);
    const [bcN0, bcF0, xaN0, xaF0] = harmonicPrz(last.tp, last.x.y, last.a.y, last.b.y, last.c.y);
    const bcN = clamp(bcN0);
    const bcF = clamp(bcF0);
    const xaN = clamp(xaN0);
    const xaF = clamp(xaF0);
    const [highest, lowest] = przRange(bcN, bcF, xaN, xaF);
    const [lower, higher] = przClosest(bcN, bcF, xaN, xaF);
    const pH = highest - lowest;
    const ln = (l: Ln) => {
      fullIpLn.push(l);
      return l;
    };
    const lb = (x: number, y: number, text: string) => fullIpL.push(newLabel(x, y, text, 'label_center', clbkg, cltxt, 'tiny'));

    // Potential reversal zone: BC and XA retracement projections
    const prz: { high: Ln | null; low: Ln | null } = { high: null, low: null };
    const level = (v: number, width: number, fromX: number, fromY: number, labelX: number) => {
      if (na(v)) return;
      const l = ln(newLine(dX, v, dX + limit, v, red, width));
      ln(newLine(fromX, fromY, dX, v, ccol, 1, 'dotted'));
      lb(labelX, v, fmt(v, '#.#####'));
      if (eq(v, higher)) prz.high = l;
      else if (eq(v, lower)) prz.low = l;
    };
    level(bcN, 5, last.b.x, last.b.y, dX + midX);
    level(bcF, 5, last.b.x, last.b.y, dX + midX);
    level(xaN, 6, last.x.x, last.x.y, dX + Math.trunc(midX / 2));
    level(xaF, 6, last.x.x, last.x.y, dX + Math.trunc(midX / 2));
    if (prz.low !== null && prz.high !== null && prz.low !== prz.high) {
      const f = newFill(prz.low, prz.high, przFill);
      if (f) fullIpLf.push(f);
    }

    if (gt(stop, 0)) {
      ln(newLine(dX, stop, dX + limit, stop, red, 6));
      lb(dX + midX, stop, 'Stop:  ' + fmt(stop, '#.#####'));
    }
    // entry
    ln(newLine(dX, entryLvl, dX + limit, entryLvl, grn, 3, 'dotted'));

    // Reversal projections
    const distX = (p: number) => {
      const qLeg = math.round(avgLeg / 4) as number;
      const eLeg = math.round(avgLeg / 8) as number;
      const dist = Math.abs(p - dY) / pH;
      if (gt(dist, 0.75)) return avgLeg + qLeg + eLeg;
      if (gt(dist, 0.5)) return avgLeg + qLeg;
      if (gt(dist, 0.25)) return avgLeg + eLeg;
      if (gt(dist, 0.1)) return avgLeg;
      return 0;
    };
    const fromDLine = () => ln(newLine(dX, dY, dX + avgLeg, t1, cproj, 2, 'arrow_right'));
    const viaLine = (p: number, target: number) => {
      const d = distX(p);
      const x12 = dX + Math.trunc(d / 2);
      const x22 = x12 + d;
      if (ne(d, 0)) {
        ln(newLine(dX, dY, x12, p, cproj2, 2));
        ln(newLine(x12, p, x22, target, cproj2, 2, 'arrow_right'));
      }
    };
    const beyondD = (p: number) => (bull && gt(p, dY)) || (!bull && lt(p, dY));
    let fromD = false;
    if (!na(entryLvl)) {
      // the entry is decided: projections based on it
      if (beyondD(entryLvl)) {
        fromDLine();
        fromD = true;
      } else {
        viaLine(entryLvl, t1);
      }
    } else {
      // else projections based on the PRZ levels
      for (const [p, target, first] of [[bcN, bcNt, true], [bcF, bcFt, false], [xaN, xaNt, false], [xaF, xaFt, false]] as Array<[number, number, boolean]>) {
        if (na(p)) continue;
        if (beyondD(p)) {
          if (first || !fromD) {
            fromDLine();
            fromD = true;
          }
        } else {
          viaLine(p, target);
        }
      }
    }
    if (!fromD) fromDLine();

    // Targets
    const lT1 = ln(newLine(dX, t1, dX + limit, t1, grn, 5));
    lb(dX + midX, t1, 'T1:  ' + fmt(t1, '#.#####'));
    const lT2 = ln(newLine(dX, t2, dX + limit, t2, grn, 5));
    lb(dX + midX, t2, 'T2:  ' + fmt(t2, '#.#####'));
    const f = newFill(lT1, lT2, tgtFill);
    if (f) fullIpLf.push(f);
  }

  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const drawn = (l: Ln) => !na(l.x1) && !na(l.x2) && !na(l.y1) && !na(l.y2);
  const outLine = (l: Ln): LineDrawingData => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: l.width, style: l.style,
  });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    // an object with an na coordinate counts in the limit but is not drawn
    lines: line.all().filter(drawn).map(outLine),
    // a fill whose line was deleted is not drawn
    linefills: linefill.all().filter((f) => drawn(f.line1) && drawn(f.line2))
      .map((f) => ({ line1: outLine(f.line1), line2: outLine(f.line2), color: String(f.color) })),
    labels: label.all().filter((l) => !na(l.x) && !na(l.y)).map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color), textColor: String(l.textcolor),
      style: l.style as LabelStyle, size: l.size as PineSize,
      ...(l.tooltip ? { tooltip: l.tooltip } : {}),
    })),
    tables,
    alertCalls,
  };
}

export const hasAlertFunction = true;

export const HarmonicPatternDetectionPredictionAnd = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
