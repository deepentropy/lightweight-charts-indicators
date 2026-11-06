/**
 * ICT Killzones Toolkit [LuxAlgo]
 *
 * Four killzones (Asian, London, New York AM, New York PM by default), each with its own hours read in the fixed
 * time zone UTC-5. On intraday bars, up to the timeframe of the input 'Display Killzones within Timeframes Up To':
 * - Killzone: a box from the first to the last bar of the zone and from its high to its low, a name label above it,
 *   top / bottom lines (and an optional mean line) that go on after the zone until the price goes through them
 * - 'Open Price of': a dotted line at the open of the killzone, the day, the week or the month, with a label and a
 *   background colour on the bar that opens a new day / week / month
 * - Order blocks: inside a killzone, when the close goes above the last swing high, a bullish order block is made
 *   from the bar with the lowest low since the swing (the mirror for a bearish block). A block whose bottom (top) is
 *   broken becomes a breaker block
 * - Market structure shifts: inside a killzone, a close through the last pivot high / low draws a line and 'CHoCH'
 * - Fair value gaps: inside a killzone, a gap between the low and the high of two bars back that is wider than
 *   ATR(144) times the filter
 *
 * Pine details kept: the four killzones share one set of lines and labels (the last started zone owns them); the
 * bearish order block test reads the bar of the last swing high; drawings are kept up to 500 lines, 500 labels and
 * 500 boxes (the oldest are removed). Boxes that never get coordinates count in the 500 but are not drawn: they are
 * not in the result.
 *
 * Limits of the port:
 * - Without the chart context, new days / weeks / months come from the UTC calendar and the bars (see
 *   anchor-period): equal on UTC symbols and on symbols whose trading day is inside one UTC day.
 * - Chart values read: the symbol price tick (the price texts of the open price labels are formatted with it).
 *   Without a chart context the tick is 0.01.
 * - The chart timeframe is the one of the chart context, else it is read from the bars (the most frequent gap
 *   between two bars). With fewer than 2 bars and no context value it is not known and nothing is drawn.
 * - The label of a killzone is at the middle time of the zone. A time between two bars is drawn on the next bar, as
 *   the original does: the port gives the time of that bar.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "ICT Killzones Toolkit [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, str, timeframe, time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe, hasCalendar, periodChanges } from '../anchor-period';
import type { BgColorData, BoxData, LabelData, LineDrawingData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type Display = 'All' | 'First' | 'Last';

export interface IctKillzonesToolkitInputs {
  asSH: boolean;
  asST: string;
  asS: string;
  asC: string;
  ldnOSH: boolean;
  ldnOST: string;
  ldnOS: string;
  ldnOC: string;
  nySH: boolean;
  nyST: string;
  nyS: string;
  nyC: string;
  ldnCSH: boolean;
  ldnCST: string;
  ldnCS: string;
  ldnCC: string;
  /** Killzone Lines : Top/Bottom */
  kzMML: boolean;
  /** Mean */
  kzML: boolean;
  /** Extend Top/Bottom */
  kzLE: boolean;
  /** Killzone Labels */
  kzLB: boolean;
  /** Display Killzones within Timeframes Up To */
  kzSH: number;
  /** Open Price of */
  dwmO: 'Killzones' | 'the Day' | 'the Week' | 'the Month' | 'None';
  /** Separator */
  dwmS: boolean;
  dwmC: string;
  /** Label */
  dwmL: boolean;
  /** Order Blocks */
  obSH: boolean;
  /** Breaker Blocks */
  bbSH: boolean;
  /** Swing Detection Length */
  obbLN: number;
  /** Mitigation Price */
  obbMT: 'Closing Price' | 'Wick';
  useBody: boolean;
  /** Remove Mitigated Order Blocks & Breaker Blocks */
  obbR: boolean;
  /** Extend Order Blocks & Breaker Blocks */
  obbEX: boolean;
  /** Display Order Blocks & Breaker Blocks */
  obbSH: Display;
  bullOC: string;
  bearOC: string;
  bullBC: string;
  bearBC: string;
  obbTX: boolean;
  mssSH: boolean;
  mssLN: number;
  mssDO: Display;
  ppLCB: string;
  ppLCS: string;
  mssTX: boolean;
  fvgSH: boolean;
  fvgTH: number;
  fvgR: boolean;
  fvgE: boolean;
  fvgDO: Display;
  fvgBC: string;
  fvgSC: string;
  fvgTX: boolean;
}

export const defaultInputs: IctKillzonesToolkitInputs = {
  asSH: true,
  asST: 'Asian',
  asS: '2000-0000',
  asC: 'rgba(233, 30, 99, 0.1)',
  ldnOSH: true,
  ldnOST: 'London',
  ldnOS: '0200-0500',
  ldnOC: 'rgba(0, 188, 212, 0.1)',
  nySH: true,
  nyST: 'New York AM',
  nyS: '0830-1100',
  nyC: 'rgba(255, 93, 0, 0.1)',
  ldnCSH: true,
  ldnCST: 'New York PM',
  ldnCS: '1330-1600',
  ldnCC: 'rgba(33, 87, 243, 0.1)',
  kzMML: true,
  kzML: false,
  kzLE: true,
  kzLB: true,
  kzSH: 15,
  dwmO: 'None',
  dwmS: true,
  dwmC: 'rgba(120, 123, 134, 0.11)',
  dwmL: true,
  obSH: true,
  bbSH: false,
  obbLN: 5,
  obbMT: 'Closing Price',
  useBody: false,
  obbR: true,
  obbEX: true,
  obbSH: 'First',
  bullOC: 'rgba(33, 87, 243, 0.2)',
  bearOC: 'rgba(255, 93, 0, 0.2)',
  bullBC: 'rgba(255, 17, 0, 0.2)',
  bearBC: 'rgba(12, 181, 26, 0.2)',
  obbTX: true,
  mssSH: false,
  mssLN: 7,
  mssDO: 'First',
  ppLCB: '#00897B',
  ppLCS: '#FF5252',
  mssTX: true,
  fvgSH: true,
  fvgTH: 1.2,
  fvgR: true,
  fvgE: true,
  fvgDO: 'First',
  fvgBC: 'rgba(76, 175, 80, 0.2)',
  fvgSC: 'rgba(255, 82, 82, 0.2)',
  fvgTX: true,
};

const kzGR = 'Killzones';
const obbGR = 'Order Blocks & Breaker Blocks';
const mssGR = 'Market Structure Shifts';
const fvgGR = 'Fair Value Gaps';
const extTT = 'In this context, "extend" refers to the action of projecting or elongating the visual objects beyond the boundaries of the killzones.';
const fvgTT = 'The script showcases fair value gaps that exceed a predetermined length calculated by multiplying the fixed-average true range (ATR) value by the option\'s value.\n\n'
  + 'The option value set to 0 means no filtering is applied.\n\n'
  + 'Remark: No filtering will be implemented for the initial 144 candles based on the fixed-length ATR, as the ATR value won\'t be available during this period.';
const DISPLAY = ['All', 'First', 'Last'];

export const inputConfig: InputConfig[] = [
  { id: 'asSH', type: 'bool', title: '', defval: true, inline: 'asia', group: kzGR },
  { id: 'asST', type: 'string', title: '', defval: 'Asian', inline: 'asia', group: kzGR },
  { id: 'asS', type: 'session', title: '', defval: '2000-0000', inline: 'asia', group: kzGR },
  { id: 'asC', type: 'color', title: '', defval: 'rgba(233, 30, 99, 0.1)', inline: 'asia', group: kzGR },
  { id: 'ldnOSH', type: 'bool', title: '', defval: true, inline: 'ldno', group: kzGR },
  { id: 'ldnOST', type: 'string', title: '', defval: 'London', inline: 'ldno', group: kzGR },
  { id: 'ldnOS', type: 'session', title: '', defval: '0200-0500', inline: 'ldno', group: kzGR },
  { id: 'ldnOC', type: 'color', title: '', defval: 'rgba(0, 188, 212, 0.1)', inline: 'ldno', group: kzGR },
  { id: 'nySH', type: 'bool', title: '', defval: true, inline: 'nyam', group: kzGR },
  { id: 'nyST', type: 'string', title: '', defval: 'New York AM', inline: 'nyam', group: kzGR },
  { id: 'nyS', type: 'session', title: '', defval: '0830-1100', inline: 'nyam', group: kzGR },
  { id: 'nyC', type: 'color', title: '', defval: 'rgba(255, 93, 0, 0.1)', inline: 'nyam', group: kzGR },
  { id: 'ldnCSH', type: 'bool', title: '', defval: true, inline: 'nypm', group: kzGR },
  { id: 'ldnCST', type: 'string', title: '', defval: 'New York PM', inline: 'nypm', group: kzGR },
  { id: 'ldnCS', type: 'session', title: '', defval: '1330-1600', inline: 'nypm', group: kzGR },
  { id: 'ldnCC', type: 'color', title: '', defval: 'rgba(33, 87, 243, 0.1)', inline: 'nypm', group: kzGR },
  { id: 'kzMML', type: 'bool', title: 'Killzone Lines : Top/Bottom', defval: true, inline: 'LN', group: kzGR },
  { id: 'kzML', type: 'bool', title: 'Mean', defval: false, inline: 'LN', group: kzGR },
  { id: 'kzLE', type: 'bool', title: 'Extend Top/Bottom', defval: true, inline: 'LN', group: kzGR },
  { id: 'kzLB', type: 'bool', title: 'Killzone Labels', defval: true, group: kzGR },
  { id: 'kzSH', type: 'int', title: 'Display Killzones within Timeframes Up To', defval: 15, min: 1, max: 60, group: kzGR }, // Pine options = [1, 3, 5, 15, 30, 45, 60]
  { id: 'dwmO', type: 'string', title: 'Open Price of', defval: 'None', options: ['Killzones', 'the Day', 'the Week', 'the Month', 'None'], inline: 'OP', group: kzGR },
  { id: 'dwmS', type: 'bool', title: 'Separator', defval: true, inline: 'OP', group: kzGR },
  { id: 'dwmC', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.11)', inline: 'OP', group: kzGR },
  { id: 'dwmL', type: 'bool', title: 'Label', defval: true, inline: 'OP', group: kzGR },
  { id: 'obSH', type: 'bool', title: 'Order Blocks | Breaker Blocks', defval: true, inline: 'OB', group: obbGR },
  { id: 'bbSH', type: 'bool', title: '', defval: false, inline: 'OB', group: obbGR },
  { id: 'obbLN', type: 'int', title: 'Swing Detection Length', defval: 5, min: 3, group: obbGR },
  { id: 'obbMT', type: 'string', title: 'Mitigation Price', defval: 'Closing Price', options: ['Closing Price', 'Wick'], group: obbGR },
  { id: 'useBody', type: 'bool', title: 'Use Candle Body in Detection', defval: false, group: obbGR },
  { id: 'obbR', type: 'bool', title: 'Remove Mitigated Order Blocks & Breaker Blocks', defval: true, group: obbGR },
  { id: 'obbEX', type: 'bool', title: 'Extend Order Blocks & Breaker Blocks', defval: true, group: obbGR, tooltip: extTT },
  { id: 'obbSH', type: 'string', title: 'Display Order Blocks & Breaker Blocks', defval: 'First', options: DISPLAY, group: obbGR },
  { id: 'bullOC', type: 'color', title: 'Order Blocks  : Bullish', defval: 'rgba(33, 87, 243, 0.2)', inline: 'OBC', group: obbGR },
  { id: 'bearOC', type: 'color', title: 'Bearish', defval: 'rgba(255, 93, 0, 0.2)', inline: 'OBC', group: obbGR },
  { id: 'bullBC', type: 'color', title: 'Breaker Blocks : Bullish', defval: 'rgba(255, 17, 0, 0.2)', inline: 'BBC', group: obbGR },
  { id: 'bearBC', type: 'color', title: 'Bearish', defval: 'rgba(12, 181, 26, 0.2)', inline: 'BBC', group: obbGR },
  { id: 'obbTX', type: 'bool', title: 'Show Order Blocks & Breaker Blocks Text', defval: true, group: obbGR },
  { id: 'mssSH', type: 'bool', title: 'Market Structure Shifts', defval: false, group: mssGR },
  { id: 'mssLN', type: 'int', title: 'Detection Length', defval: 7, min: 1, group: mssGR },
  { id: 'mssDO', type: 'string', title: 'Display Market Structure Shifts', defval: 'First', options: DISPLAY, group: mssGR },
  { id: 'ppLCB', type: 'color', title: 'Market Structure Shifts : Bullish', defval: '#00897B', inline: 'MSS', group: mssGR },
  { id: 'ppLCS', type: 'color', title: 'Bearish', defval: '#FF5252', inline: 'MSS', group: mssGR },
  { id: 'mssTX', type: 'bool', title: 'Show Market Structure Shifts Text', defval: true, group: mssGR },
  { id: 'fvgSH', type: 'bool', title: 'Fair Value Gaps', defval: true, group: fvgGR },
  { id: 'fvgTH', type: 'float', title: 'Fair Value Gap Width Filter', defval: 1.2, min: 0, step: 0.1, tooltip: fvgTT, group: fvgGR },
  { id: 'fvgR', type: 'bool', title: 'Remove Mitigated Fair Value Gaps', defval: true, group: fvgGR },
  { id: 'fvgE', type: 'bool', title: 'Extend Fair Value Gaps', defval: true, group: fvgGR, tooltip: extTT },
  { id: 'fvgDO', type: 'string', title: 'Display Fair Value Gaps', defval: 'First', options: DISPLAY, group: fvgGR },
  { id: 'fvgBC', type: 'color', title: 'Bullish Imbalance', defval: 'rgba(76, 175, 80, 0.2)', group: fvgGR },
  { id: 'fvgSC', type: 'color', title: 'Bearish Imbalance', defval: 'rgba(255, 82, 82, 0.2)', group: fvgGR },
  { id: 'fvgTX', type: 'bool', title: 'Show Fair Value Gaps Text', defval: true, group: fvgGR },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'ICT Killzones Toolkit [LuxAlgo]',
  shortTitle: 'LuxAlgo - ICT Killzones Toolkit',
  overlay: true,
};

/** Time zone of the killzone hours */
const TZ = 'UTC-5';
/** max_lines_count, max_labels_count, max_boxes_count */
const MAX_COUNT = 500;
const NA_COLOR = 'transparent';

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

interface Ln {
  x1: number; y1: number; x2: number; y2: number;
  /** xloc.bar_time: x values are times (ms); else bar indexes */
  byTime: boolean;
  color: string; style?: 'dotted'; dead: boolean;
}
interface Bx {
  left: number; top: number; right: number; bottom: number;
  byTime: boolean;
  border: string; bg?: string;
  text?: string; textSize?: 'tiny'; textColor?: string; hAlign?: 'left'; vAlign?: 'top' | 'bottom';
  dead: boolean;
}
interface Lb {
  x: number; y: number; text: string; color: string; style: 'label_left' | 'label_down'; textColor: string;
  size: 'tiny' | 'small'; dead: boolean;
}

/** Live drawings of one kind: above max + 5 objects the oldest are deleted until max remain */
class Live<T extends { dead: boolean }> {
  readonly list: T[] = [];
  add(o: T): T {
    this.list.push(o);
    if (this.list.length > MAX_COUNT + 5) for (const old of this.list.splice(0, this.list.length - MAX_COUNT)) old.dead = true;
    return o;
  }
  del(o: T | null): void {
    if (!o || o.dead) return;
    o.dead = true;
    this.list.splice(this.list.indexOf(o), 1);
  }
}

/** Pine types */
interface Swing { y: number; i: number; x: boolean }
interface OB { top: number; btm: number; obI: number; bxOB: Bx; ext: boolean }
interface BB { bxOB: Bx; bxBB: Bx; ext: boolean; bb: boolean; bbI: number }
interface FVG { bx: Bx; e: boolean }
interface MSS { ln: Ln; bx: Bx }
/** `var` variables of one call of the killzones method */
interface KzSite { max: number; mid: number; min: number; sbT: number; xt: boolean; xb: boolean; area: Bx | null; s1: boolean }

type Result = IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; bgColors: BgColorData[] };

const DAY_MS = 86400000;

/** The study's variables: the drawings and every object that points at them (copied together by copyVars) */
interface IctVars {
  lines: Live<Ln>;
  boxes: Live<Bx>;
  labels: Live<Lb>;
  // var KZ kz: one object for the four killzone calls
  kz: { lnT: Ln | null; lnM: Ln | null; lnB: Ln | null; lnO: Ln | null; lb: Lb | null; lbO: Lb | null };
  dwm: { ln: Ln | null; lb: Lb | null };
  sites: KzSite[];
  bOB: OB[];
  aOB: OB[];
  bBB: BB[];
  aBB: BB[];
  bLS: number[];
  aLS: number[];
  bMSS: MSS[];
  aMSS: MSS[];
  pp: { h: number; hi: number; hx: boolean; l: number; li: number; lx: boolean };
  shift: number;
  bFVG: FVG[];
  aFVG: FVG[];
  // swings()
  os: number;
  top: Swing;
  btm: Swing;
  // pOBB() / pFVG() variables
  sbI: number;
  obXb: boolean;
  obXa: boolean;
  fvgXb: boolean;
  fvgXa: boolean;
  inKZ1: boolean;
  bullG1: boolean;
  bearG1: boolean;
}

interface IctRun extends BarRunState<IctVars> {
  upperStep: ReturnType<typeof taStep.highest>;
  lowerStep: ReturnType<typeof taStep.lowest>;
  atrStep: ReturnType<typeof taStep.atr>;
  ppHStep: PivotStep;
  ppLStep: PivotStep;
  bgColors: BgColorData[];
}

/** A copy of the variables: the object graph cloned with its shared references */
function copyIctVars(v: IctVars): IctVars {
  const c = structuredClone(v);
  for (const r of [c.lines, c.boxes, c.labels]) Object.setPrototypeOf(r, Live.prototype);
  return c;
}

function study(inputs: Partial<IctKillzonesToolkitInputs>): BarStudy<IctRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // read from the whole bar set and the chart by init
  let ms = false;
  let isIntraday = false;
  let shown = false;
  let barMs: number | undefined;
  let mintick = 0.01;
  /** The chart context of the period changes, with the chart timeframe of the whole bar set */
  let calChart: ChartContext | undefined;

  // format.mintick: the symbol price tick
  const priceText = (v: number) => str.tostring(v, 'mintick', mintick);
  const opaque = (c: string) => String(color.new(c, 0));
  const dwmTf = cfg.dwmO === 'the Day' ? 'D' : cfg.dwmO === 'the Week' ? 'W' : cfg.dwmO === 'the Month' ? 'M' : null;
  const xTxt = dwmTf ? `${dwmTf}O` : '';
  const kzO = cfg.dwmO === 'Killzones';
  const obbMP = cfg.obbMT === 'Closing Price';
  const { obSH: obS, bbSH: bbS, obbEX: obbE, obbSH: obbD, obbR } = cfg;
  const zones = [
    { on: cfg.nySH, sess: cfg.nyS, css: cfg.nyC, name: cfg.nyST },
    { on: cfg.ldnOSH, sess: cfg.ldnOS, css: cfg.ldnOC, name: cfg.ldnOST },
    { on: cfg.ldnCSH, sess: cfg.ldnCS, css: cfg.ldnCC, name: cfg.ldnCST },
    { on: cfg.asSH, sess: cfg.asS, css: cfg.asC, name: cfg.asST },
  ].map((z) => ({ ...z, tC: String(color.rgb(color.r(z.css), color.g(z.css), color.b(z.css))) }));
  const olC = opaque(cfg.dwmC);
  const site = (): KzSite => ({ max: NaN, mid: NaN, min: NaN, sbT: NaN, xt: false, xb: false, area: null, s1: false });

  // Setters that do nothing on a deleted (or na) object
  const live = <X extends { dead: boolean }>(o: X | null): o is X => o !== null && !o.dead;
  const maxOf = (a: number[]) => (a.length === 0 ? NaN : Math.max(...a));

  /**
   * periodChanges(bars, tf, chart)[i]: with the exchange calendar, the one of bars i - 1 and i (the calendar reads the
   * chart timeframe of the whole set); else a new UTC calendar period (the rule of periodStarts for D / W / M)
   */
  const periodChange = (bars: Bar[], i: number, tf: 'D' | 'W' | 'M'): boolean => {
    if (i === 0) return false;
    if (hasCalendar(calChart)) return periodChanges([bars[i - 1], bars[i]], tf, calChart)[1];
    const key = (time: number) => {
      const t = ms ? time : time * 1000;
      const day = Math.floor(t / DAY_MS) * DAY_MS;
      if (tf === 'D') return day;
      const d = new Date(day);
      if (tf === 'W') return day - ((d.getUTCDay() + 6) % 7) * DAY_MS;
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    };
    return key(bars[i].time) !== key(bars[i - 1].time);
  };

  return {
    // the chart timeframe comes from the bar gaps (or the context), the time unit from the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    init(bars, chart) {
      ms = bars.length > 0 && bars[0].time >= 1e12;
      const tfName = chartTimeframe(bars, chart);
      const tfInfo = tfName === '' ? null : timeframe.info(tfName);
      isIntraday = tfInfo?.isintraday ?? false;
      const tfM = tfInfo?.multiplier ?? 1;
      shown = tfM <= cfg.kzSH;
      // bar duration for the session test (clock-change rule of the library)
      barMs = tfName === '' ? undefined : timeframe.in_seconds(tfName) * 1000;
      mintick = mintickOf(chart);
      // periodChanges of two bars equals the one of the whole set when the calendar reads the same chart timeframe
      calChart = tfName === '' || chart.timeframe ? chart : { ...chart, timeframe: tfName };
      const upperStep = taStep.highest();
      const lowerStep = taStep.lowest();
      const atrStep = taStep.atr(144);
      const ppHStep = new PivotStep(cfg.mssLN, cfg.mssLN, true);
      const ppLStep = new PivotStep(cfg.mssLN, cfg.mssLN, false);
      const s: IctRun = {
        upperStep, lowerStep, atrStep, ppHStep, ppLStep, bgColors: [],
        steps: [upperStep, lowerStep, atrStep, ppHStep, ppLStep],
        vars: {
          lines: new Live<Ln>(), boxes: new Live<Bx>(), labels: new Live<Lb>(),
          kz: { lnT: null, lnM: null, lnB: null, lnO: null, lb: null, lbO: null },
          dwm: { ln: null, lb: null },
          sites: zones.map(() => site()),
          bOB: [], aOB: [], bBB: [], aBB: [], bLS: [], aLS: [], bMSS: [], aMSS: [],
          pp: { h: NaN, hi: NaN, hx: false, l: NaN, li: NaN, lx: false },
          shift: 0, bFVG: [], aFVG: [],
          os: 0, top: { y: NaN, i: NaN, x: false }, btm: { y: NaN, i: NaN, x: false },
          sbI: 0, obXb: false, obXa: false, fvgXb: false, fvgXa: false, inKZ1: false, bullG1: false, bearG1: false,
        },
        lists: [], series: [],
      };
      s.lists = [s.bgColors];
      return s;
    },
    copyVars: copyIctVars,
    bar(s, i, bars) {
      const v = s.vars;
      const { lines, boxes, labels, kz, dwm, pp } = v;
      const newLine = (x1: number, y1: number, x2: number, y2: number, byTime: boolean, css: string, style?: 'dotted') =>
        lines.add({ x1, y1, x2, y2, byTime, color: css, style, dead: false });
      const newBox = (b: Omit<Bx, 'dead'>) => boxes.add({ ...b, dead: false });
      const newLabel = (l: Omit<Lb, 'dead'>) => labels.add({ ...l, dead: false });

      // History helpers (na before the first bar)
      const H = (j: number) => (j >= 0 ? bars[j].high : NaN);
      const L = (j: number) => (j >= 0 ? bars[j].low : NaN);
      const C = (j: number) => (j >= 0 ? bars[j].close : NaN);
      const O = (j: number) => (j >= 0 ? bars[j].open : NaN);
      const T = (j: number) => (j >= 0 ? (ms ? bars[j].time : bars[j].time * 1000) : NaN);
      const MX = (j: number) => (j < 0 ? NaN : cfg.useBody ? Math.max(bars[j].close, bars[j].open) : bars[j].high);
      const MN = (j: number) => (j < 0 ? NaN : cfg.useBody ? Math.min(bars[j].close, bars[j].open) : bars[j].low);

      const bar = bars[i];
      const { open, high, low } = bar;
      const t = T(i);
      const upper = s.upperStep.step(high, cfg.obbLN);
      const lower = s.lowerStep.step(low, cfg.obbLN);
      const atr = s.atrStep.step(high, low, bar.close);
      const ppH = s.ppHStep.step(i, high);
      const ppL = s.ppLStep.step(i, low);
      const active = zones.map((z) => pineTime.inSession(t, z.sess, TZ, barMs) && z.on && shown);
      const inKZ = active.some(Boolean);

      // Killzones
      zones.forEach((z, k) => {
        const st = v.sites[k];
        const s = active[k] && isIntraday;
        if (s && !st.s1) {
          st.max = high;
          st.sbT = t;
          st.min = low;
          st.mid = (st.max + st.min) / 2;
          st.area = newBox({ left: i, top: st.max, right: i, bottom: st.min, byTime: false, border: NA_COLOR, bg: z.css });
          if (cfg.kzMML) {
            kz.lnT = newLine(st.sbT, st.max, st.sbT, st.max, true, z.tC);
            kz.lnB = newLine(st.sbT, st.min, st.sbT, st.min, true, z.tC);
          }
          if (cfg.kzML) kz.lnM = newLine(st.sbT, st.mid, st.sbT, st.mid, true, z.tC, 'dotted');
          if (kzO) {
            kz.lnO = newLine(st.sbT, open, st.sbT, open, true, olC, 'dotted');
            if (cfg.dwmL) {
              kz.lbO = newLabel({ x: st.sbT, y: open, text: 'KZO(' + priceText(open) + ')', color: NA_COLOR, style: 'label_left', textColor: olC, size: 'tiny' });
            }
          }
          if (cfg.kzLB) {
            kz.lb = newLabel({ x: st.sbT, y: st.max, text: z.name, color: '#ffffff00', style: 'label_down', textColor: z.tC, size: 'small' });
          }
        }
        if (s) {
          st.max = Math.max(high, st.max);
          st.min = Math.min(low, st.min);
          st.mid = (st.max + st.min) / 2;
          st.xt = true;
          st.xb = true;
          if (live(st.area)) {
            st.area.top = st.max;
            st.area.right = i;
            st.area.bottom = st.min;
          }
          if (cfg.kzLB && live(kz.lb)) {
            kz.lb.x = Math.trunc((t + st.sbT) / 2);
            kz.lb.y = st.max;
          }
          if (cfg.kzMML) {
            if (live(kz.lnT)) {
              kz.lnT.y1 = st.max;
              kz.lnT.x2 = t;
              kz.lnT.y2 = st.max;
            }
            if (live(kz.lnB)) {
              kz.lnB.y1 = st.min;
              kz.lnB.x2 = t;
              kz.lnB.y2 = st.min;
            }
          }
          if (cfg.kzML && live(kz.lnM)) {
            kz.lnM.y1 = st.mid;
            kz.lnM.x2 = t;
            kz.lnM.y2 = st.mid;
          }
          if (kzO) {
            if (live(kz.lnO)) kz.lnO.x2 = t;
            if (cfg.dwmL && live(kz.lbO)) kz.lbO.x = t;
          }
        }
        if (!s && cfg.kzLE && !inKZ) {
          if (cfg.kzMML) {
            if (st.xt) {
              const y = live(kz.lnT) ? kz.lnT.y1 : NaN;
              if (live(kz.lnT)) kz.lnT.x2 = t;
              if (!lt(high, y)) st.xt = false;
            }
            if (st.xb) {
              const y = live(kz.lnB) ? kz.lnB.y1 : NaN;
              if (live(kz.lnB)) kz.lnB.x2 = t;
              if (!gt(low, y)) st.xb = false;
            }
          }
          if (cfg.kzML && live(kz.lnM)) kz.lnM.x2 = t;
        }
        st.s1 = s;
      });

      // Open price of the day / week / month
      const xChg = dwmTf !== null && periodChange(bars, i, dwmTf);
      if (!kzO && isIntraday && shown) {
        if (xChg) {
          labels.del(dwm.lb);
          dwm.ln = newLine(t, open, t, open, true, olC, 'dotted');
          if (cfg.dwmL) {
            dwm.lb = newLabel({ x: t, y: open, text: xTxt + '(' + priceText(open) + ')', color: NA_COLOR, style: 'label_left', textColor: olC, size: 'tiny' });
          }
        } else {
          if (live(dwm.ln)) dwm.ln.x2 = t;
          if (cfg.dwmL && live(dwm.lb)) dwm.lb.x = t;
        }
      }
      if (cfg.dwmS && !kzO && isIntraday && shown && xChg) s.bgColors.push({ time: bar.time, color: cfg.dwmC });

      // swings(obbLN)
      const os1 = i > 0 ? v.os : NaN;
      v.os = gt(H(i - cfg.obbLN), upper) ? 0 : lt(L(i - cfg.obbLN), lower) ? 1 : v.os;
      if (v.os === 0 && os1 === 1) v.top = { y: H(i - cfg.obbLN), i: i - cfg.obbLN, x: false };
      if (v.os === 1 && os1 === 0) v.btm = { y: L(i - cfg.obbLN), i: i - cfg.obbLN, x: false };
      const { top, btm } = v;

      // Order blocks & breaker blocks
      if (obS || bbS) {
        const s = inKZ;
        if (s && !v.inKZ1) {
          v.sbI = i;
          v.obXb = true;
          v.obXa = true;
          if (obbE) {
            v.bOB = [];
            v.aOB = [];
            v.bBB = [];
            v.aBB = [];
          }
        }
        const obBox = (css: string) => newBox({
          left: NaN, top: NaN, right: NaN, bottom: NaN, byTime: true, border: NA_COLOR,
          text: cfg.obbTX ? 'OB' : '', textSize: 'tiny', textColor: opaque(css),
        });
        const bbBoxes = (css: string): BB => ({
          bxOB: newBox({ left: NaN, top: NaN, right: NaN, bottom: NaN, byTime: true, border: NA_COLOR }),
          bxBB: newBox({
            left: NaN, top: NaN, right: NaN, bottom: NaN, byTime: true, border: NA_COLOR,
            text: cfg.obbTX ? 'BB' : '', textSize: 'tiny', textColor: opaque(css),
          }),
          ext: true, bb: false, bbI: NaN,
        });
        if (s) {
          if (gt(C(i - 1), top.y) && !top.x && top.i >= v.sbI) {
            top.x = true;
            let minima = MX(i - 1);
            let maxima = MN(i - 1);
            let sBT = T(i - 1);
            const last = i - top.i - 1;
            for (let k = 1; last >= 1 ? k <= last : k >= last; k += last >= 1 ? 1 : -1) {
              minima = Math.min(MN(i - k), minima);
              if (eq(minima, MN(i - k))) {
                maxima = MX(i - k);
                sBT = T(i - k);
              }
            }
            v.bOB.unshift({ top: maxima, btm: minima, obI: sBT, bxOB: obBox(cfg.bullOC), ext: true });
            v.bBB.unshift(bbBoxes(cfg.bullBC));
          }
          if (lt(C(i - 1), btm.y) && !btm.x && top.i >= v.sbI) {
            btm.x = true;
            let minima = MN(i - 1);
            let maxima = MX(i - 1);
            let sBT = T(i - 1);
            const last = i - btm.i - 1;
            for (let k = 1; last >= 1 ? k <= last : k >= last; k += last >= 1 ? 1 : -1) {
              maxima = Math.max(MX(i - k), maxima);
              if (eq(maxima, MX(i - k))) {
                minima = MN(i - k);
                sBT = T(i - k);
              }
            }
            v.aOB.unshift({ top: maxima, btm: minima, obI: sBT, bxOB: obBox(cfg.bearOC), ext: true });
            v.aBB.unshift(bbBoxes(cfg.bearBC));
          }
        }

        if (obbE || s) {
          const side = (obs: OB[], bbs: BB[], bull: boolean, cOB: string, cBB: string, ls: number[]) => {
            for (let k = obs.length - 1; k >= 0; k--) {
              const ob = obs[k];
              const bb = bbs[k];
              const isFirst = obbD === 'First' ? k === obs.length - 1 : true;
              const bg = obbD === 'Last' ? (k === 0 ? cOB : NA_COLOR) : cOB;
              const tc = obbD === 'Last' ? (k === 0 ? opaque(cOB) : NA_COLOR) : opaque(cOB);
              if (obbR) {
                if (!ob.ext) boxes.del(ob.bxOB);
                if (!bb.ext) {
                  boxes.del(bb.bxOB);
                  boxes.del(bb.bxBB);
                }
              }
              const outline = () => {
                if (live(bb.bxOB)) {
                  bb.bxOB.left = ob.obI;
                  bb.bxOB.top = ob.top;
                  bb.bxOB.right = bb.bbI;
                  bb.bxOB.bottom = ob.btm;
                  bb.bxOB.bg = NA_COLOR;
                  bb.bxOB.border = cBB;
                }
              };
              if (!bb.bb) {
                if (obS && isFirst && live(ob.bxOB)) {
                  ob.bxOB.left = ob.obI;
                  ob.bxOB.top = ob.top;
                  ob.bxOB.right = t;
                  ob.bxOB.bottom = ob.btm;
                  ob.bxOB.bg = bg;
                  ob.bxOB.textColor = tc;
                }
                const broken = bull
                  ? lt(Math.min(obbMP ? C(i - 1) : L(i - 1), O(i - 1)), ob.btm)
                  : gt(Math.max(obbMP ? C(i - 1) : H(i - 1), O(i - 1)), ob.top);
                if (broken) {
                  bb.bb = true;
                  if (obS) {
                    if (live(ob.bxOB)) ob.bxOB.right = T(i - 1);
                    ob.ext = false;
                  }
                  if (bbS && (bull ? v.obXb : v.obXa)) {
                    bb.bbI = T(i - 1);
                    if (live(bb.bxBB)) {
                      bb.bxBB.left = bb.bbI;
                      bb.bxBB.top = ob.top;
                      bb.bxBB.right = t;
                      bb.bxBB.bottom = ob.btm;
                      bb.bxBB.bg = cBB;
                    }
                    if (!obS || obbR || !isFirst) outline();
                    if (obbD === 'First') {
                      if (bull) v.obXb = false;
                      else v.obXa = false;
                    }
                    if (obbD === 'Last') ls.push(bb.bbI);
                  }
                }
              } else {
                if (bull ? gt(obbMP ? C(i - 1) : H(i - 1), ob.top) : lt(obbMP ? C(i - 1) : L(i - 1), ob.btm)) bb.ext = false;
                if (obS && live(ob.bxOB)) {
                  ob.bxOB.bg = bg;
                  ob.bxOB.textColor = tc;
                }
                if (bbS && bb.ext && live(bb.bxBB)) bb.bxBB.right = t;
                if (bbS && obbD === 'Last') {
                  if (k !== 0) outline();
                  const left = live(bb.bxBB) ? bb.bxBB.left : NaN;
                  const lsMax = maxOf(ls);
                  // `!=` is false when a side is na
                  if (!Number.isNaN(left) && !Number.isNaN(lsMax) && lsMax !== left) {
                    if (live(bb.bxBB)) {
                      bb.bxBB.bg = NA_COLOR;
                      bb.bxBB.textColor = NA_COLOR;
                    }
                    if (live(bb.bxOB)) bb.bxOB.border = NA_COLOR;
                  }
                }
              }
            }
          };
          side(v.bOB, v.bBB, true, cfg.bullOC, cfg.bullBC, v.bLS);
          side(v.aOB, v.aBB, false, cfg.bearOC, cfg.bearBC, v.aLS);
        } else {
          v.bOB = [];
          v.aOB = [];
          v.bBB = [];
          v.aBB = [];
        }
      }

      // Market structure shifts
      if (!Number.isNaN(ppH)) {
        pp.h = ppH;
        pp.hx = false;
        pp.hi = i - cfg.mssLN;
      }
      if (!Number.isNaN(ppL)) {
        pp.l = ppL;
        pp.lx = false;
        pp.li = i - cfg.mssLN;
      }
      if (!inKZ) {
        pp.l = 0;
        pp.h = 10e8;
        v.shift = 0;
        v.bMSS = [];
        v.aMSS = [];
      }
      if (cfg.mssSH && inKZ) {
        const mss = (x: number, y: number, css: string, vAlign: 'top' | 'bottom'): MSS => ({
          ln: newLine(x, y, i - 1, y, false, css),
          bx: newBox({
            left: x, top: y, right: i - 1, bottom: y, byTime: false, border: NA_COLOR, bg: NA_COLOR,
            text: 'CHoCH', textSize: 'tiny', hAlign: 'left', vAlign, textColor: cfg.mssTX ? css : NA_COLOR,
          }),
        });
        const drop = (m: MSS | undefined) => {
          if (!m) return;
          lines.del(m.ln);
          boxes.del(m.bx);
        };
        if (gt(C(i - 1), pp.h) && !pp.hx) {
          pp.hx = true;
          if (v.shift === -1 || v.shift === 0) {
            if (cfg.mssDO === 'First' ? v.bMSS.length < 1 : true) v.bMSS.unshift(mss(pp.hi, pp.h, cfg.ppLCB, 'bottom'));
            if (v.bMSS.length > 1 && cfg.mssDO === 'Last') drop(v.bMSS.pop());
          }
          v.shift = 1;
        }
        if (lt(C(i - 1), pp.l) && !pp.lx) {
          pp.lx = true;
          if (v.shift === 1 || v.shift === 0) {
            if (cfg.mssDO === 'First' ? v.aMSS.length < 1 : true) v.aMSS.unshift(mss(pp.li, pp.l, cfg.ppLCS, 'top'));
            if (v.aMSS.length > 1 && cfg.mssDO === 'Last') drop(v.aMSS.pop());
          }
          v.shift = -1;
        }
      }

      // Fair value gaps
      if (cfg.fvgSH) {
        const s = inKZ;
        const fvgATR = (Number.isFinite(atr) ? atr : 0) * cfg.fvgTH;
        if (s && !v.inKZ1) {
          v.fvgXb = true;
          v.fvgXa = true;
          if (cfg.fvgE) {
            v.bFVG = [];
            v.aFVG = [];
          }
        }
        const bullG = gt(low, H(i - 1));
        const bearG = lt(high, L(i - 1));
        if (s) {
          const fvgBox = (boxTop: number, boxBottom: number, css: string): FVG => ({
            bx: newBox({
              left: i - 1, top: boxTop, right: i, bottom: boxBottom, byTime: false, border: NA_COLOR, bg: css,
              text: cfg.fvgTX ? 'FVG' : '', textSize: 'tiny', textColor: opaque(css),
            }),
            e: true,
          });
          const bull = gt(low - H(i - 2), fvgATR) && gt(low, H(i - 2)) && gt(C(i - 1), H(i - 2)) && !(bullG || v.bullG1);
          if (bull && v.fvgXb) {
            v.bFVG.unshift(fvgBox(low, H(i - 2), cfg.fvgBC));
            if (cfg.fvgDO === 'First') v.fvgXb = false;
            if (v.bFVG.length > 1 && cfg.fvgDO === 'Last') boxes.del(v.bFVG.pop()!.bx);
          }
          const bear = gt(L(i - 2) - high, fvgATR) && lt(high, L(i - 2)) && lt(C(i - 1), L(i - 2)) && !(bearG || v.bearG1);
          if (bear && v.fvgXa) {
            v.aFVG.unshift(fvgBox(L(i - 2), high, cfg.fvgSC));
            if (cfg.fvgDO === 'First') v.fvgXa = false;
            if (v.aFVG.length > 1 && cfg.fvgDO === 'Last') boxes.del(v.aFVG.pop()!.bx);
          }
        }
        if (cfg.fvgE || s) {
          for (let k = v.bFVG.length - 1; k >= 0; k--) {
            const fvg = v.bFVG[k];
            const fvgB = live(fvg.bx) ? fvg.bx.bottom : NaN;
            if (!fvg.e) continue;
            if (live(fvg.bx)) fvg.bx.right = i;
            if (lt(low, fvgB)) {
              if (cfg.fvgR) boxes.del(fvg.bx);
              fvg.e = false;
            }
          }
          for (let k = v.aFVG.length - 1; k >= 0; k--) {
            const fvg = v.aFVG[k];
            const fvgT = live(fvg.bx) ? fvg.bx.top : NaN;
            if (!fvg.e) continue;
            if (live(fvg.bx)) fvg.bx.right = i;
            if (gt(high, fvgT)) {
              if (cfg.fvgR) boxes.del(fvg.bx);
              fvg.e = false;
            }
          }
        } else {
          v.bFVG = [];
          v.aFVG = [];
        }
        v.bullG1 = bullG;
        v.bearG1 = bearG;
      }
      v.inKZ1 = inKZ;
    },
    result(s, bars) {
      const n = bars.length;
      const { lines, boxes, labels } = s.vars;
      const tAt = (k: number) => (ms ? bars[k].time : bars[k].time * 1000);
      // Output: a time between two bars is drawn on the next bar (the first bar at or after it)
      const barOf = (time: number) => {
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (tAt(mid) >= time) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      };
      const X = (x: number, byTime: boolean) => bars[byTime ? barOf(x) : x].time;
      const drawn = (...v: number[]) => v.every((x) => !Number.isNaN(x));
      const outLines: LineDrawingData[] = lines.list.filter((l) => drawn(l.x1, l.y1, l.x2, l.y2)).map((l) => ({
        time1: X(l.x1, l.byTime), price1: l.y1, time2: X(l.x2, l.byTime), price2: l.y2, color: l.color,
        ...(l.style ? { style: l.style } : {}),
      }));
      const outBoxes: BoxData[] = boxes.list.filter((b) => drawn(b.left, b.top, b.right, b.bottom)).map((b) => ({
        time1: X(b.left, b.byTime), price1: b.top, time2: X(b.right, b.byTime), price2: b.bottom, borderColor: b.border,
        ...(b.bg !== undefined ? { bgColor: b.bg } : {}),
        ...(b.text !== undefined ? { text: b.text } : {}),
        ...(b.textSize ? { textSize: b.textSize } : {}),
        ...(b.textColor !== undefined ? { textColor: b.textColor } : {}),
        ...(b.hAlign ? { textHAlign: b.hAlign } : {}),
        ...(b.vAlign ? { textVAlign: b.vAlign } : {}),
      }));
      const outLabels: LabelData[] = labels.list.filter((l) => drawn(l.x, l.y)).map((l) => ({
        time: X(l.x, true), price: l.y, text: l.text, color: l.color, style: l.style, textColor: l.textColor, size: l.size,
      }));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: outLines,
        boxes: outBoxes,
        labels: outLabels,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IctKillzonesToolkitInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IctKillzonesToolkitInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const IctKillzonesToolkit = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
