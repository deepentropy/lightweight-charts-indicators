/**
 * ICT Venom Trading Model [TradingFinder] SMC NY Session 2025Setup
 *
 * New York session model (sessions in the America/New_York time zone): the "Opening Range" session (08:00-09:30)
 * gives a high and a low (the high and low of its bars and of the first bar after it). Each opening range is marked
 * by two dashed vertical lines (its start and 1.5 hours later, extended both ways) and a "08:00 to 09:30 / New York
 * AM" label; when the "Trading Permit" session (09:30-17:00) starts, two dotted lines mark the range high and low
 * for half an hour.
 *
 * During the trading session, the first break of the range high (before any break of the low) looks back up to 120
 * bars for the last bearish candle and sets the change in state of delivery (CISD) level at the lower of the two
 * opens after it: a dotted red line with a "CISD level" label. The line extends while the closes stay at or above
 * the level (for at most 270 bars from it); the first close at or below it confirms the CISD (a red triangle). The
 * bearish fair value gaps found while the level is active are kept (a gap is dropped when a high goes above its
 * proximal edge). On the confirmation, a supply order block is drawn at the highest bar of the session so far
 * (refined by the order block refiner), and the latest kept gap is drawn as a supply FVG zone. A break of the low
 * is the mirror (demand). A zone has two dashed edges, a dotted middle line and a fill; it extends during the
 * trading session until the price reaches its mitigation level or for 240 bars. Everything is reset on the second
 * bar after the trading session.
 *
 * As in the original, the CISD state starts as active with a level of 0: the first trading-session bar within the
 * first 271 bars of the data draws a low CISD triangle (with an na price when the ATR has no value yet).
 *
 * Imported libraries, written in this file: FVGDetectorLibrary (version 3, `FVGDetector`; its drawings are off in
 * this script), OrderBlockRefiner_TradingFinder (version 2, `OBRefiner`) and OrderBlockDrawing_TradingFinder (version
 * 4, `OBDrawing`; its breaker block part is off in this script and has no output). The "Bar Back Check" input and the
 * CISD colour inputs are not used by the original (it passes 120 and fixed colours): they are kept as inputs.
 *
 * Reference: "ICT Venom Trading Model [TradingFinder] SMC NY Session 2025Setup" by TradingFinder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab
 */

import {
  ta, line, label, linefill, time as pineTime, barInterval, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Line, type Label, type Linefill, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

type RefineMethod = 'Defensive' | 'Aggressive';
type FilterType = 'Very Aggressive' | 'Aggressive' | 'Defensive' | 'Very Defensive';
type MitigationLevel = 'Proximal' | '50 % OB' | 'Distal';

export interface IctVenomTradingModelSmcNySessionInputs {
  /** Refine Order Block */
  Refine: boolean;
  /** Refine method */
  RefineMe: RefineMethod;
  /** Mitigation Level OB */
  MLOB: MitigationLevel;
  /** FVG Filter */
  PFVGFilter: boolean;
  /** FVG filter type */
  PFVGFilterType: FilterType;
  /** Mitigation Level FVG */
  MLFVG: MitigationLevel;
  /** Bar Back Check (not used by the original) */
  BarBackCheck: number;
  DOBShow: boolean;
  DOBColor: string;
  SOBShow: boolean;
  SOBColor: string;
  DFVGShow: boolean;
  DFVGColor: string;
  SFVGShow: boolean;
  SFVGColor: string;
  CISD_AShow: boolean;
  CISD_HShow: boolean;
  CISD_LShow: boolean;
  /** Not used by the original */
  CISD_HNColor: string;
  /** Not used by the original */
  CISD_LNColor: string;
  /** Not used by the original */
  CISD_HLColor: string;
  /** Not used by the original */
  CISD_LLColor: string;
  /** Opening Range (America/New_York) */
  Newyork_OR_F: string;
  /** Trading Permit (America/New_York) */
  Newyork_T_F: string;
}

export const defaultInputs: IctVenomTradingModelSmcNySessionInputs = {
  Refine: true,
  RefineMe: 'Defensive',
  MLOB: 'Proximal',
  PFVGFilter: false,
  PFVGFilterType: 'Defensive',
  MLFVG: 'Proximal',
  BarBackCheck: 5,
  DOBShow: true,
  DOBColor: '#3dec266b',
  SOBShow: true,
  SOBColor: '#ff1e1e73',
  DFVGShow: true,
  // input colours keep an alpha of 2 decimals: #4aa9f76c is stored as 0.42 (byte 0x6b)
  DFVGColor: '#4aa9f76b',
  SFVGShow: true,
  SFVGColor: '#f8a93270',
  CISD_AShow: true,
  CISD_HShow: true,
  CISD_LShow: true,
  CISD_HNColor: '#870505',
  CISD_LNColor: '#014f07',
  CISD_HLColor: '#b90000b8',
  // #069206a7 is stored as 0.65 (byte 0xa6)
  CISD_LLColor: '#069206a6',
  Newyork_OR_F: '0800-0930',
  Newyork_T_F: '0930-1700',
};

const OB_GROUP = 'Order Blocks Logical Setting';
const FVG_GROUP = 'FVG Logical Setting';
const MITIGATION = ['Proximal', '50 % OB', 'Distal'];

export const inputConfig: InputConfig[] = [
  { id: 'Refine', type: 'bool', title: 'Refine Order Block', defval: true, group: OB_GROUP, inline: 'Refine' },
  { id: 'RefineMe', type: 'string', title: '', defval: 'Defensive', options: ['Defensive', 'Aggressive'], group: OB_GROUP, inline: 'Refine' },
  { id: 'MLOB', type: 'string', title: 'Mitigation Level OB', defval: 'Proximal', options: MITIGATION, group: OB_GROUP,
    tooltip: 'Using this entry, you can determine which level the price reacts to in a Order Block.' },
  { id: 'PFVGFilter', type: 'bool', title: 'FVG Filter ............', defval: false, group: FVG_GROUP, inline: 'FVG Filter' },
  { id: 'PFVGFilterType', type: 'string', title: '', defval: 'Defensive',
    options: ['Very Aggressive', 'Aggressive', 'Defensive', 'Very Defensive'], group: FVG_GROUP, inline: 'FVG Filter',
    tooltip: 'If it is "On", this filter will filter "FVGs" based on the width of the Zone.From "Very Aggressive" to "Very Defensive" the width of the "FVG" decreases.' },
  { id: 'MLFVG', type: 'string', title: 'Mitigation Level FVG', defval: 'Proximal', options: MITIGATION, group: FVG_GROUP,
    tooltip: 'Using this entry, you can determine which level the price reacts to in a FVG.' },
  { id: 'BarBackCheck', type: 'int', title: 'Bar Back Check', defval: 5, min: 1, group: 'CISD Logical Setting' },
  { id: 'DOBShow', type: 'bool', title: 'Demand Order Block', defval: true, group: 'Order Block Display Setting', inline: 'DMOLB' },
  { id: 'DOBColor', type: 'color', title: '', defval: '#3dec266b', group: 'Order Block Display Setting', inline: 'DMOLB' },
  { id: 'SOBShow', type: 'bool', title: 'Supply Order Block', defval: true, group: 'Order Block Display Setting', inline: 'SSOLB' },
  { id: 'SOBColor', type: 'color', title: '', defval: '#ff1e1e73', group: 'Order Block Display Setting', inline: 'SSOLB' },
  { id: 'DFVGShow', type: 'bool', title: 'Demand FVG', defval: true, group: 'FVG Display Setting', inline: 'DFVG' },
  { id: 'DFVGColor', type: 'color', title: '', defval: '#4aa9f76b', group: 'FVG Display Setting', inline: 'DFVG' },
  { id: 'SFVGShow', type: 'bool', title: 'Supply FVG', defval: true, group: 'FVG Display Setting', inline: 'SFVG' },
  { id: 'SFVGColor', type: 'color', title: '', defval: '#f8a93270', group: 'FVG Display Setting', inline: 'SFVG' },
  { id: 'CISD_AShow', type: 'bool', title: 'Show All CISD', defval: true, group: 'CISD Display Setting' },
  { id: 'CISD_HShow', type: 'bool', title: 'Show High CISD', defval: true, group: 'CISD Display Setting', inline: 'CH' },
  { id: 'CISD_LShow', type: 'bool', title: 'Show Low CISD', defval: true, group: 'CISD Display Setting', inline: 'CL' },
  { id: 'CISD_HNColor', type: 'color', title: 'Name', defval: '#870505', group: 'CISD Display Setting', inline: 'CH' },
  { id: 'CISD_LNColor', type: 'color', title: 'Name', defval: '#014f07', group: 'CISD Display Setting', inline: 'CL' },
  { id: 'CISD_HLColor', type: 'color', title: 'Line', defval: '#b90000b8', group: 'CISD Display Setting', inline: 'CH' },
  { id: 'CISD_LLColor', type: 'color', title: 'Line', defval: '#069206a6', group: 'CISD Display Setting', inline: 'CL' },
  { id: 'Newyork_OR_F', type: 'session', title: 'Opening Range', defval: '0800-0930' },
  { id: 'Newyork_T_F', type: 'session', title: 'Trading Permit', defval: '0930-1700' },
];

export const plotConfig: PlotConfig[] = [];

/** Drawing kinds of the original */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'linefill'];

export const metadata = {
  title: 'ICT Venom Trading Model [TradingFinder] SMC NY Session 2025Setup',
  shortTitle: 'TFlab Venom',
  overlay: true,
};

// Pine comparisons: a > b only when a - b > 1e-10, a == b within 1e-10; na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** math.min / math.max: na when an argument is na */
const minOf = (v: number[]) => (v.some((x) => Number.isNaN(x)) ? NaN : Math.min(...v));
const maxOf = (v: number[]) => (v.some((x) => Number.isNaN(x)) ? NaN : Math.max(...v));

const NY = 'America/New_York';
const ONE_HOUR = 60 * 60 * 1000;
const GREY = '#767f99';
const EDGE = '#0000008C'; // color.rgb(0, 0, 0, 45)
const MIDDLE = '#000000';

/** Outputs of one OBRefiner() call: the bar and the distal / proximal prices of the block */
interface Refined { x: number; distal: number; proximal: number }

export function calculate(
  bars: Bar[],
  inputs: Partial<IctVenomTradingModelSmcNySessionInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const msOf = (t: number) => (ms ? t : t * 1000);
  const barMs = n > 1 ? barInterval(bars) * (ms ? 1 : 1000) : undefined;

  /** Series values by bar index; a bar outside the data is na */
  const inRange = (k: number) => k >= 0 && k < n && Number.isInteger(k);
  const H = (k: number) => (inRange(k) ? bars[k].high : NaN);
  const L = (k: number) => (inRange(k) ? bars[k].low : NaN);
  const O = (k: number) => (inRange(k) ? bars[k].open : NaN);
  const C = (k: number) => (inRange(k) ? bars[k].close : NaN);
  const atr = ta.atr(bars, 55).toArray().map((v) => v ?? NaN);

  // Newyork_OR / Newyork_T = math.sign(nz(time(timeframe.period, session, "America/New_York")))
  const sessionFlags = (session: string) => bars.map((b) => (pineTime.inSession(msOf(b.time), session, NY, barMs) ? 1 : 0));
  const orFlag = sessionFlags(cfg.Newyork_OR_F);
  const tFlag = sessionFlags(cfg.Newyork_T_F);
  const orAt = (k: number) => (k >= 0 ? orFlag[k] : NaN);
  const tAt = (k: number) => (k >= 0 ? tFlag[k] : NaN);

  // indicator(max_lines_count = 500, max_labels_count = 500)
  resetDrawings({ line: 500, label: 500 });

  // ---- global var drawings
  const startOrLine = varDrawing<Line>();
  const endTradeLine = varDrawing<Line>();
  const highLevel = varDrawing<Line>();
  const lowLevel = varDrawing<Line>();
  const openingLabel = varDrawing<Label>();

  // ---- LowHighSessionDetector(Newyork_OR)
  let highOr = 0.0;
  let lowOr = 0.0;

  // ---- breaks of the opening range
  let highBreak = false;
  let lowBreak = false;

  // ---- FVGDetector(): var values
  let ddfvg = 0.0;
  let dpfvg = 0.0;
  let barDfvg = 0;
  let sdfvg = 0.0;
  let spfvg = 0.0;
  let barSfvg = 0;

  // ---- CISDLevelDetector(): var state
  let lvlPL = 0.0;
  let lvlPH = 0.0;
  let lvlIL = 0;
  let lvlIH = 0;
  let permitHReset = true;
  let permitLReset = true;
  let prevPermitHReset = false;
  let prevPermitLReset = false;
  const cisdLineL = varDrawing<Line>();
  const cisdLineH = varDrawing<Line>();
  const cisdNameH = varDrawing<Label>();
  const cisdNameL = varDrawing<Label>();
  const cisdShapH = varDrawing<Label>();
  const cisdShapL = varDrawing<Label>();
  let bearFvg = 0;
  let bearFvgD = 0.0;
  let bearFvgP = 0.0;
  let bullFvg = 0;
  let bullFvgD = 0.0;
  let bullFvgP = 0.0;
  const fvgBearD: number[] = [];
  const fvgBearP: number[] = [];
  const fvgBearI: number[] = [];
  const fvgBullD: number[] = [];
  const fvgBullP: number[] = [];
  const fvgBullI: number[] = [];
  let highOb = NaN;
  let lowOb = NaN;
  let bearI = NaN;
  let bullI = NaN;

  /** OrderBlockRefiner_TradingFinder: OBRefiner(), one state per call */
  const obRefiner = (demand: boolean, refineOn: boolean, method: RefineMethod) => {
    let yp12 = 0.0;
    let yd12 = 0.0;
    let xd1 = 0;
    let dMinOpen = 0.0;
    let dMinLow = 0.0;
    let dMinClose = 0.0;
    let dMaxOpen = 0.0;
    let dMaxHigh = 0.0;
    let dMaxLow = 0.0;
    let dMaxClose = 0.0;
    let sMinOpen = 0.0;
    let sMinLow = 0.0;
    let sMinClose = 0.0;
    let sMaxHigh = 0.0;
    let sMaxClose = 0.0;
    let dda = 0.0;
    let dpa = 0.0;
    let sda = 0.0;
    let spa = 0.0;
    let proximalRefine = 0.0;
    let distalRefine = 0.0;

    return (i: number, trigger: boolean, index: number): Refined => {
      const ATR = atr[i];
      // PosIndex = bar_index - index < 4999 ? bar_index - index : 2 (na index: 2)
      const pos = i - index < 4999 ? i - index : 2;
      // history offsets from the current bar
      const o = (k: number) => O(i - k);
      const h = (k: number) => H(i - k);
      const l = (k: number) => L(i - k);
      const c = (k: number) => C(i - k);
      const range = (k: number) => h(k) - l(k);
      const bodyAt = (k: number) => c(k) - o(k);
      const body = bars[i].close - bars[i].open;
      const rangeAfter = range(pos + 1);
      const rangeBlock = range(pos);
      // the candles around the block: 4 once the block is 2 bars old, 3 on the bar after it, 2 on its own bar
      const around = i > index + 1 ? [pos - 2, pos + 1, pos, pos - 1] : i === index + 1 ? [pos + 1, pos, pos - 1]
        : i === index ? [pos + 1, pos] : null;

      if (demand && i > 4) {
        if (around) {
          dMinOpen = minOf(around.map(o));
          dMinLow = minOf(around.map(l));
          dMinClose = minOf(around.map(c));
          dMaxOpen = maxOf(around.map(o));
          dMaxHigh = maxOf(around.map(h));
          dMaxLow = maxOf(around.map(l));
          dMaxClose = maxOf(around.map(c));
        }
        if (le(rangeBlock, ATR * 0.5)) {
          dpa = h(pos);
          dda = dMinLow;
        } else if (gt(rangeBlock, ATR * 0.5) && le(rangeBlock, ATR)) {
          if (gt(body, 0) || eq(body, 0)) {
            dpa = c(pos);
            dda = dMinLow;
          } else if (lt(body, 0)) {
            dpa = o(pos);
            dda = dMinLow;
          }
        } else if (gt(rangeBlock, ATR)) {
          if (i > index) {
            if (lt(l(pos + 1), h(pos))) {
              if (gt(l(pos + 1), l(pos))) {
                dpa = l(pos + 1);
                dda = l(pos);
              } else if (le(l(pos + 1), l(pos))) {
                const b = bodyAt(pos + 1);
                if (gt(b, 0) || eq(b, 0)) {
                  if (gt(rangeAfter, ATR)) {
                    dpa = dMaxOpen;
                    dda = dMinLow;
                  } else if (le(rangeAfter, ATR)) {
                    dpa = dMaxClose;
                    dda = dMinLow;
                  }
                } else if (lt(b, 0)) {
                  if (gt(rangeAfter, ATR) || le(rangeAfter, ATR)) {
                    dpa = dMaxOpen;
                    dda = dMinLow;
                  }
                }
              } else {
                dpa = dMaxOpen;
                dda = dMinLow;
              }
            } else {
              const viaOpen = dMinLow - dMinOpen;
              const viaClose = dMinLow - dMinClose;
              dpa = gt(viaOpen, viaClose) && le(viaOpen, ATR) && ge(viaOpen, ATR * 0.5) ? dMinOpen : dMinClose;
              dda = dMinLow;
            }
          } else if (gt(rangeAfter, ATR)) {
            dpa = dMaxOpen;
            dda = dMinLow;
          } else {
            dpa = dMaxClose;
            dda = dMinLow;
          }
        } else if (gt(body, 0)) {
          dpa = dMaxHigh;
          dda = dMinLow;
        } else if (lt(body, 0)) {
          dpa = dMaxHigh;
          dda = dMaxLow;
        }
      }

      // As in the library, this part also runs for a supply block (with demand values that stay 0)
      if (method === 'Defensive') {
        const size = dpa - dda;
        if (ge(size, ATR * 4)) {
          distalRefine = dda;
          proximalRefine = dpa - size * 0.8;
        } else if (ge(size, ATR * 3) && lt(size, ATR * 4)) {
          distalRefine = dda;
          proximalRefine = dpa - size * 0.7;
        } else if (lt(size, ATR * 3) && ge(size, ATR * 2)) {
          distalRefine = dda;
          proximalRefine = dpa - size * 0.6;
        } else if (lt(size, ATR * 2) && ge(size, ATR * 1.6)) {
          distalRefine = dda;
          proximalRefine = dpa - size * 0.5;
        } else if (lt(size, ATR * 1.6) && gt(size, ATR)) {
          distalRefine = dda;
          proximalRefine = dpa - size * 0.25;
        } else if (le(size, ATR)) {
          distalRefine = dda;
          proximalRefine = dpa;
        }
      } else if (method === 'Aggressive') {
        distalRefine = dda;
        proximalRefine = dpa;
      }
      if (trigger) {
        yp12 = refineOn ? proximalRefine : h(pos);
        yd12 = refineOn ? distalRefine : l(pos);
        xd1 = index;
      }

      if (!demand && i > 4) {
        if (around) {
          sMinOpen = minOf(around.map(o));
          sMinLow = minOf(around.map(l));
          sMinClose = minOf(around.map(c));
          sMaxHigh = maxOf(around.map(h));
          sMaxClose = maxOf(around.map(c));
        }
        if (le(rangeBlock, ATR * 0.5)) {
          spa = l(pos);
          sda = sMaxHigh;
        } else if (gt(rangeBlock, ATR * 0.5) && le(rangeBlock, ATR)) {
          if (gt(body, 0) || eq(body, 0)) {
            spa = c(pos);
            sda = sMaxHigh;
          } else if (lt(body, 0)) {
            spa = o(pos);
            sda = sMaxHigh;
          }
        } else if (gt(rangeBlock, ATR)) {
          if (i > index) {
            if (gt(h(pos - 1), l(pos))) {
              if (gt(h(pos - 1), h(pos))) {
                spa = h(pos - 1);
                sda = h(pos);
              } else if (le(h(pos - 1), h(pos))) {
                const b = bodyAt(pos - 1);
                if (gt(b, 0) || eq(b, 0)) {
                  if (gt(rangeAfter, ATR)) {
                    spa = sMinClose;
                    sda = sMaxHigh;
                  } else if (le(rangeAfter, ATR)) {
                    spa = sMinOpen;
                    sda = sMaxHigh;
                  }
                } else if (lt(b, 0)) {
                  if (gt(rangeAfter, ATR)) {
                    spa = sMinOpen;
                    sda = sMaxHigh;
                  } else if (le(rangeAfter, ATR)) {
                    spa = sMaxClose;
                    sda = sMaxHigh;
                  }
                }
              } else {
                spa = sMinOpen;
                sda = sMaxHigh;
              }
            } else if (!gt(h(pos + 1), l(pos))) {
              const viaOpen = sMaxHigh - sMinOpen;
              const viaClose = sMaxHigh - sMinClose;
              // the second test of the library reads demand values (0 in a supply call): both outcomes are the close
              spa = gt(viaOpen, viaClose) && le(viaOpen, ATR) && ge(viaOpen, ATR * 0.5) ? sMinOpen : sMinClose;
              sda = sMaxHigh;
            } else {
              spa = sMinClose;
              sda = sMaxHigh;
            }
          } else if (gt(rangeAfter, ATR)) {
            spa = sMinClose;
            sda = sMaxHigh;
          } else {
            spa = sMinOpen;
            sda = sMaxHigh;
          }
        } else if (gt(body, 0) || lt(body, 0)) {
          spa = sMinLow;
          sda = sMaxHigh;
        }

        if (method === 'Defensive') {
          const size = sda - spa;
          if (ge(size, ATR * 4)) {
            distalRefine = sda;
            proximalRefine = spa + size * 0.8;
          } else if (ge(size, ATR * 3) && lt(size, ATR * 4)) {
            distalRefine = sda;
            proximalRefine = spa + size * 0.7;
          } else if (lt(size, ATR * 3) && ge(size, ATR * 2)) {
            distalRefine = sda;
            proximalRefine = spa + size * 0.6;
          } else if (lt(size, ATR * 2) && ge(size, ATR * 1.6)) {
            distalRefine = sda;
            proximalRefine = spa + size * 0.5;
          } else if (lt(size, ATR * 1.6) && gt(size, ATR)) {
            distalRefine = sda;
            proximalRefine = spa + size * 0.25;
          } else if (le(size, ATR)) {
            distalRefine = sda;
            proximalRefine = spa;
          }
        } else if (method === 'Aggressive') {
          distalRefine = sda;
          proximalRefine = spa;
        }
        if (trigger) {
          yp12 = refineOn ? proximalRefine : l(pos);
          yd12 = refineOn ? distalRefine : h(pos);
          xd1 = index;
        }
      }
      return { x: xd1, distal: yd12, proximal: yp12 };
    };
  };

  /**
   * OrderBlockDrawing_TradingFinder: OBDrawing() with ShowAll = true (no deletion) and Show_BB = false (the breaker
   * block part draws nothing and its outputs are not used), one state per call
   */
  const obDrawing = (demand: boolean, show: boolean, colorZone: string, mitigation: MitigationLevel) => {
    let distalPrice = 0.0;
    let proximalPrice = 0.0;
    let check = true;
    const distal = varDrawing<Line>();
    const proximal = varDrawing<Line>();
    const line50 = varDrawing<Line>();
    const fill = varDrawing<Linefill>();
    return (i: number, trigger: boolean, distalIn: number, proximalIn: number, index: number, validGlobal: boolean) => {
      const { high, low } = bars[i];
      if (trigger) {
        distalPrice = distalIn;
        proximalPrice = proximalIn;
      }
      const ml = mitigation === 'Proximal' ? proximalPrice : mitigation === 'Distal' ? distalPrice
        : (proximalPrice + distalPrice) / 2;
      if (trigger && show) {
        distal.value = line.new(index, distalPrice, i, distalPrice, 'bar_index', 'none', EDGE, 'dashed', 1);
        proximal.value = line.new(index, proximalPrice, i, proximalPrice, 'bar_index', 'none', EDGE, 'dashed', 1);
        line50.value = line.new(index, (proximalPrice + distalPrice) / 2, i, (proximalPrice + distalPrice) / 2,
          'bar_index', 'none', MIDDLE, 'dotted', 1);
        fill.value = linefill.new(distal.value, proximal.value, colorZone);
      }
      if (check && validGlobal) {
        for (const l of [distal.value, proximal.value, line50.value]) if (l) line.set_x2(l, i + 1);
      }
      if ((demand ? lt(low, ml) : gt(high, ml)) || i - index >= 240) check = false;
      if (trigger) check = true;
    };
  };

  const refineBull = obRefiner(true, cfg.Refine, cfg.RefineMe);
  const refineBear = obRefiner(false, cfg.Refine, cfg.RefineMe);
  const drawDemandOb = obDrawing(true, cfg.DOBShow, cfg.DOBColor, cfg.MLOB);
  const drawSupplyOb = obDrawing(false, cfg.SOBShow, cfg.SOBColor, cfg.MLOB);
  const drawDemandFvg = obDrawing(true, cfg.DFVGShow, cfg.DFVGColor, cfg.MLFVG);
  const drawSupplyFvg = obDrawing(false, cfg.SFVGShow, cfg.SFVGColor, cfg.MLFVG);
  const showHigh = cfg.CISD_AShow && cfg.CISD_HShow;
  const showLow = cfg.CISD_AShow && cfg.CISD_LShow;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const time = msOf(b.time);
    const ATR = atr[i];
    const T = tFlag[i];

    // ---- LowHighSessionDetector(Newyork_OR): the high / low of the opening range and of the bar after it
    if (orAt(i - 1) === 0 && orFlag[i] === 1) {
      highOr = b.high;
      lowOr = b.low;
    } else if (orAt(i - 1) === 1 || orFlag[i] === 1) {
      highOr = Math.max(b.high, highOr);
      lowOr = Math.min(b.low, lowOr);
    }

    if (orFlag[i] > orAt(i - 1)) {
      startOrLine.value = line.new(time, b.low, time, b.low + ATR, 'bar_time', 'both', GREY, 'dashed', 1);
      const end = time + Math.trunc(ONE_HOUR * 1.5);
      endTradeLine.value = line.new(end, b.low, end, b.low + ATR, 'bar_time', 'both', GREY, 'dashed', 1);
      openingLabel.value = label.new(time + Math.trunc(ONE_HOUR * 0.75), b.high + 10 * ATR, '08:00 to 09:30\nNew York AM',
        'bar_time', 'price', 'transparent', 'label_down', GREY, 'normal');
    }
    if (T > tAt(i - 1)) {
      highLevel.value = line.new(time, highOr, time + ONE_HOUR / 2, highOr, 'bar_time', 'none', '#b9c4e7', 'dotted', 1);
      lowLevel.value = line.new(time, lowOr, time + ONE_HOUR / 2, lowOr, 'bar_time', 'none', '#b9c4e7', 'dotted', 1);
    }

    const prevHighBreak = highBreak;
    const prevLowBreak = lowBreak;
    if (T === 0) {
      highBreak = false;
      lowBreak = false;
    }
    if (T === 1) {
      if (gt(b.high, highOr)) highBreak = true;
      if (lt(b.low, lowOr)) lowBreak = true;
    }

    // ---- FVG.FVGDetector(PFVGFilter ? 'On' : 'Off', PFVGFilterType, false, false)
    const h1 = H(i - 1);
    const l1 = L(i - 1);
    const o1 = O(i - 1);
    const c1 = C(i - 1);
    const h2 = H(i - 2);
    const l2 = L(i - 2);
    const o2 = O(i - 2);
    const c2 = C(i - 2);
    let dCond: boolean;
    let sCond: boolean;
    if (!cfg.PFVGFilter) {
      dCond = gt(b.low, h2);
      sCond = lt(b.high, l2);
    } else {
      const body1 = Math.abs((c1 - o1) / (h1 - l1));
      const t = cfg.PFVGFilterType;
      if (t === 'Very Aggressive') dCond = gt(b.low, h2) && gt(b.high, h1);
      else if (t === 'Aggressive') dCond = gt(b.low, h2) && ge(h1 - l1, 1.0 * ATR) && gt(b.high, h1);
      else if (t === 'Defensive') {
        dCond = gt(b.low, h2) && ge(h1 - l1, 1.5 * ATR) && gt(b.high, h1)
          && ((gt(c2 - o2, 0) && gt(c1 - o1, 0)) || gt(body1, 0.7));
      } else {
        dCond = gt(b.low, h2) && ge(h1 - l1, 1.5 * ATR) && gt(b.high, h1)
          && (gt(c2 - o2, 0) && gt(c1 - o1, 0) && gt(body1, 0.7))
          && gt(Math.abs((c2 - o2) / (h2 - l2)), 0.35) && gt(Math.abs((b.close - b.open) / (b.high - b.low)), 0.35);
      }
      if (t === 'Very Aggressive') sCond = lt(b.high, l2) && gt(l1, b.low);
      else if (t === 'Aggressive') sCond = lt(b.high, l2) && ge(h1 - l1, 1.0 * ATR) && gt(l1, b.low);
      else if (t === 'Defensive') {
        sCond = lt(b.high, l2) && ge(h1 - l1, 1.5 * ATR) && gt(l1, b.low)
          && ((lt(c2 - o2, 0) && lt(c1 - o1, 0)) || gt(body1, 0.7));
      } else {
        sCond = lt(b.high, l2) && ge(h1 - l1, 1.5 * ATR) && gt(l1, b.low)
          && (lt(c2 - o2, 0) && lt(c1 - o1, 0) && gt(body1, 0.7))
          && gt(Math.abs((c2 - o2) / (h2 - l2)), 0.35) && gt(Math.abs((b.close - b.open) / (b.high - b.low)), 0.35);
      }
    }
    if (dCond) {
      ddfvg = h2;
      dpfvg = b.low;
      barDfvg = i;
    }
    if (sCond) {
      sdfvg = l2;
      spfvg = b.high;
      barSfvg = i;
    }

    // ---- Cond_High / Cond_Low: the first break of the range high (low) in the session, before a break of the other side
    const condHigh = T === 1 && highBreak && !prevHighBreak && !lowBreak;
    const condLow = T === 1 && lowBreak && !prevLowBreak && !highBreak;

    // ---- CISDLevelDetector(Cond_High, Cond_Low, ..., 120, 'CISD level', ...)
    const body = (k: number) => C(i - k) - O(i - k);
    if (tAt(i - 1) === 0 && T === 1) {
      highOb = b.high;
      bearI = i;
      lowOb = b.low;
      bullI = i;
    }
    if (tAt(i - 1) === 1) {
      if (gt(b.high, highOb)) {
        highOb = b.high;
        bearI = i;
      }
      if (lt(b.low, lowOb)) {
        lowOb = b.low;
        bullI = i;
      }
    }
    if (condHigh) {
      let permitHSet = true;
      for (let k = 1; k <= 120; k++) {
        if (lt(body(k), 0) && permitHSet) {
          permitHReset = true;
          if (k > 1) {
            const m = Math.min(O(i - k + 1), O(i - k + 2));
            lvlPH = m;
            lvlIH = eq(m, O(i - k + 2)) ? i - k + 2 : i - k + 1;
          } else {
            lvlPH = O(i);
            lvlIH = i;
          }
          if (showHigh) {
            cisdLineH.value = line.new(lvlIH, lvlPH, i, lvlPH, 'bar_index', 'none', '#ed1212', 'dotted', 1);
            cisdNameH.value = label.new(lvlIH + 1, L(lvlIH) - ATR * 0.3, 'CISD level', 'bar_index', 'price', 'transparent',
              'label_upper_left', '#ed1212', 'tiny');
          }
          permitHSet = false;
        }
      }
    }
    if (permitHReset && T === 1) {
      if (sCond) {
        fvgBearI.push(barSfvg);
        fvgBearD.push(sdfvg);
        fvgBearP.push(spfvg);
      }
      if (fvgBearI.length > 0 && gt(b.high, fvgBearP[fvgBearP.length - 1])) {
        fvgBearI.pop();
        fvgBearD.pop();
        fvgBearP.pop();
      }
      if (ge(b.close, lvlPH) && i - lvlIH <= 270 && cisdLineH.value) line.set_x2(cisdLineH.value, i + 1);
      if (le(b.close, lvlPH) && i - lvlIH <= 270) {
        permitHReset = false;
        if (showHigh) {
          cisdShapH.value = label.new(i, b.high + ATR * 0.6, '', 'bar_index', 'price', '#890505', 'triangledown',
            undefined, 'tiny');
        }
      }
    }
    if (condLow) {
      let permitLSet = true;
      for (let k = 1; k <= 120; k++) {
        if (gt(body(k), 0) && permitLSet) {
          permitLReset = true;
          if (k > 1) {
            const m = Math.max(O(i - k + 1), O(i - k + 2));
            lvlPL = m;
            lvlIL = eq(m, O(i - k + 2)) ? i - k + 2 : i - k + 1;
          } else {
            lvlPL = O(i);
            lvlIL = i;
          }
          if (showLow) {
            cisdLineL.value = line.new(lvlIL, lvlPL, i, lvlPL, 'bar_index', 'none', '#16e61d', 'dotted', 1);
            cisdNameL.value = label.new(lvlIL + 1, H(lvlIL) + ATR * 0.6, 'CISD level', 'bar_index', 'price', 'transparent',
              'label_lower_right', '#16e61d', 'tiny');
          }
          permitLSet = false;
        }
      }
    }
    if (permitLReset && T === 1) {
      if (dCond) {
        fvgBullI.push(barDfvg);
        fvgBullD.push(ddfvg);
        fvgBullP.push(dpfvg);
      }
      if (fvgBullI.length > 0 && lt(b.low, fvgBullP[fvgBullP.length - 1])) {
        fvgBullI.pop();
        fvgBullD.pop();
        fvgBullP.pop();
      }
      if (le(b.close, lvlPL) && i - lvlIL <= 270 && cisdLineL.value) line.set_x2(cisdLineL.value, i + 1);
      if (ge(b.close, lvlPL) && i - lvlIL <= 270) {
        permitLReset = false;
        if (showLow) {
          cisdShapL.value = label.new(i, b.low - ATR * 0.6, '', 'bar_index', 'price', '#016004', 'triangleup',
            undefined, 'tiny');
        }
      }
    }
    // The second part of `size > 0 or (ta.change(size > 0) and size > 0)` only runs when the size is 0: it is false
    if (T === 1) {
      if (fvgBullI.length > 0) {
        bullFvg = fvgBullI[fvgBullI.length - 1];
        bullFvgD = fvgBullD[fvgBullD.length - 1];
        bullFvgP = fvgBullP[fvgBullP.length - 1];
      }
      if (fvgBearI.length > 0) {
        bearFvg = fvgBearI[fvgBearI.length - 1];
        bearFvgD = fvgBearD[fvgBearD.length - 1];
        bearFvgP = fvgBearP[fvgBearP.length - 1];
      }
    }
    const bearTrigger = prevPermitHReset && !permitHReset;
    const fvgBearTrigger = bearTrigger && fvgBearI.length > 0 && bearFvg !== 0;
    const bullTrigger = prevPermitLReset && !permitLReset;
    const fvgBullTrigger = bullTrigger && fvgBullI.length > 0 && bullFvg !== 0;
    if (tAt(i - 1) === 0 && tAt(i - 2) === 1) {
      bearFvg = 0;
      bearFvgD = 0.0;
      bearFvgP = 0.0;
      bullFvg = 0;
      bullFvgD = 0.0;
      bullFvgP = 0.0;
      highOb = NaN;
      lowOb = NaN;
      bearI = NaN;
      bullI = NaN;
      fvgBearD.length = 0;
      fvgBearP.length = 0;
      fvgBearI.length = 0;
      fvgBullD.length = 0;
      fvgBullP.length = 0;
      fvgBullI.length = 0;
    }
    prevPermitHReset = permitHReset;
    prevPermitLReset = permitLReset;

    // ---- Refiner.OBRefiner and Drawing.OBDrawing (order blocks, then the fair value gaps)
    const bu = refineBull(i, bullTrigger, bullI);
    const be = refineBear(i, bearTrigger, bearI);
    const valid = T === 1;
    drawDemandOb(i, bullTrigger, bu.distal, bu.proximal, bu.x, valid);
    drawSupplyOb(i, bearTrigger, be.distal, be.proximal, be.x, valid);
    drawDemandFvg(i, fvgBullTrigger, bullFvgD, bullFvgP, bullFvg, valid);
    drawSupplyFvg(i, fvgBearTrigger, bearFvgD, bearFvgP, bearFvg, valid);
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const IctVenomTradingModelSmcNySession = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds,
};
