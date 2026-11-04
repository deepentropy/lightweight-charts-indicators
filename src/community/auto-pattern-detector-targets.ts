/**
 * Auto Pattern Detector Targets [MarkitTick]
 *
 * Collects pivot highs and lows (a bar whose high / low is above / below the "Pivot Lookback Left" bars on each side;
 * at most "Max Pivots to Remember" of each, newest first) and tests the latest pivots for chart patterns, in this
 * order: double top / bottom, triple top / bottom, head and shoulders (and inverted), bullish / bearish flag or
 * pennant, rising / falling wedge, triangle, rectangle, cup and handle (and inverted). A pattern counts when the
 * price broke its neckline or boundary on one of the last bars (by an ATR or percent margin, optional close / body /
 * confirmation / volume rules) and its risk:reward after costs reaches the minimum. Patterns are looked for from bar
 * 601 on; a new pattern needs a start more than "Pattern Cooldown" bars away from the previous one and a closed bar.
 *
 * Each new pattern draws its boundary lines (a transparent pair with a fill and a coloured pair), a label with its
 * name in the middle, and, with "Show Measured Targets", dashed entry / stop / target lines over 50 bars from the
 * breakout with their labels (prices to the symbol tick, adjusted R:R). Only the "Max Patterns Displayed" latest
 * patterns are kept. A dashboard (top right) shows the latest pattern, its bias, the ATR, volume / R:R / pivot scores,
 * the bars since the pattern and the pivot count, as they were at the start of the last bar. An alert() call with a
 * JSON message is made for every new pattern (`alertCalls`).
 *
 * Chart context: symbol tick (slippage cost, price texts), ticker, chart timeframe and the state of the last bar.
 *
 * Reference: "Auto Pattern Detector Targets [MarkitTick]" by MarkitTick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MarkitTick
 */

import {
  ta, str, math, color, callsite, Series, line, label, linefill, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe } from '../anchor-period';
import { lastBarConfirmedOf, mintickOf, tickeridOf, tickerOf, type ChartContext } from '../chart-context';

export const hasAlertFunction = true;

export interface AutoPatternDetectorTargetsInputs {
  cooldown: number;
  /** Symmetry tolerance (%) */
  sym_tol: number;
  /** Level tolerance (%) */
  lvl_tol: number;
  /** Minimum pattern size (% of price) */
  min_size_pct: number;
  min_atr_mult: number;
  show_dt_top: boolean;
  show_dt_bot: boolean;
  show_tt_top: boolean;
  show_tt_bot: boolean;
  show_hs_std: boolean;
  show_hs_inv: boolean;
  show_flag_bull: boolean;
  show_flag_bear: boolean;
  show_pennant_bull: boolean;
  show_pennant_bear: boolean;
  show_wedge_rise: boolean;
  show_wedge_fall: boolean;
  show_tri_gen: boolean;
  show_rect_gen: boolean;
  show_cup_std: boolean;
  show_cup_inv: boolean;
  lb_left: number;
  lb_right: number;
  max_piv_hist: number;
  req_close_brk: boolean;
  req_body_brk: boolean;
  use_atr_brk: boolean;
  break_atr: number;
  /** Breakout threshold (%) */
  break_pct: number;
  brk_confirm_bars: number;
  show_ignore_conf: boolean;
  min_brk_bar: number;
  req_vol: boolean;
  vol_mult: number;
  vol_len: number;
  min_rr: number;
  slippage_ticks: number;
  commission_pct: number;
  col_bull: string;
  col_bear: string;
  /** Not used by the drawings of the original */
  col_neu: string;
  /** Not used by the drawings of the original */
  col_pend: string;
  fill_transp: number;
  show_tgt: boolean;
  stop_buffer: number;
  use_sl_pct_tgt: boolean;
  /** SL % of target distance */
  sl_pct_tgt: number;
  max_patterns: number;
  extend_lines: boolean;
  col_entry: string;
  col_stop: string;
  col_target: string;
  dash_bg_color: string;
  dash_txt_color: string;
  alert_en: boolean;
  rr_dyn_en: boolean;
  rr_dyn_mult: number;
  atr_norm_en: boolean;
  lbl_scale_en: boolean;
  lbl_scale_sel: 'Small' | 'Normal' | 'Large';
}

export const defaultInputs: AutoPatternDetectorTargetsInputs = {
  cooldown: 5,
  sym_tol: 10,
  lvl_tol: 3,
  min_size_pct: 0.5,
  min_atr_mult: 1,
  show_dt_top: true,
  show_dt_bot: true,
  show_tt_top: true,
  show_tt_bot: true,
  show_hs_std: true,
  show_hs_inv: true,
  show_flag_bull: true,
  show_flag_bear: true,
  show_pennant_bull: true,
  show_pennant_bear: true,
  show_wedge_rise: true,
  show_wedge_fall: true,
  show_tri_gen: true,
  show_rect_gen: true,
  show_cup_std: true,
  show_cup_inv: true,
  lb_left: 10,
  lb_right: 10,
  max_piv_hist: 500,
  req_close_brk: false,
  req_body_brk: false,
  use_atr_brk: true,
  break_atr: 1,
  break_pct: 0.3,
  brk_confirm_bars: 1,
  show_ignore_conf: false,
  min_brk_bar: 1,
  req_vol: false,
  vol_mult: 1,
  vol_len: 20,
  min_rr: 1,
  slippage_ticks: 1,
  commission_pct: 0.0001,
  col_bull: '#00FFB4',
  col_bear: '#FF1E78',
  col_neu: '#A050FF',
  col_pend: '#00C8FF',
  fill_transp: 80,
  show_tgt: true,
  stop_buffer: 0.5,
  use_sl_pct_tgt: true,
  sl_pct_tgt: 25,
  max_patterns: 1,
  extend_lines: false,
  col_entry: '#FFDC00',
  col_stop: '#FF3282',
  col_target: '#00FFA0',
  dash_bg_color: '#0A0A12F2',
  dash_txt_color: '#DCDCEB',
  alert_en: true,
  rr_dyn_en: false,
  rr_dyn_mult: 2,
  atr_norm_en: false,
  lbl_scale_en: false,
  lbl_scale_sel: 'Normal',
};

const G = 'General';
const P = 'Patterns';
const PV = 'Pivot';
const F = 'Filters';
const V = 'Vis';
const D = '📊 Dashboard Settings';

export const inputConfig: InputConfig[] = [
  { id: 'cooldown', type: 'int', title: 'Pattern Cooldown (Bars)', defval: 5, min: 1, group: G },
  { id: 'sym_tol', type: 'float', title: 'Symmetry Tolerance (%)', defval: 10, min: 1, step: 0.5, group: G },
  { id: 'lvl_tol', type: 'float', title: 'Level Tolerance (%)', defval: 3, min: 0.1, step: 0.1, group: G },
  { id: 'min_size_pct', type: 'float', title: 'Min Pattern Size (% of Price)', defval: 0.5, min: 0.1, group: G },
  { id: 'min_atr_mult', type: 'float', title: 'Min Pattern Size (ATR Multiplier)', defval: 1, min: 0.1, step: 0.1, group: G },
  { id: 'show_dt_top', type: 'bool', title: 'Double Top', defval: true, group: P },
  { id: 'show_dt_bot', type: 'bool', title: 'Double Bottom', defval: true, group: P },
  { id: 'show_tt_top', type: 'bool', title: 'Triple Top', defval: true, group: P },
  { id: 'show_tt_bot', type: 'bool', title: 'Triple Bottom', defval: true, group: P },
  { id: 'show_hs_std', type: 'bool', title: 'Head and Shoulders', defval: true, group: P },
  { id: 'show_hs_inv', type: 'bool', title: 'Inverted Head and Shoulders', defval: true, group: P },
  { id: 'show_flag_bull', type: 'bool', title: 'Bullish Flag', defval: true, group: P },
  { id: 'show_flag_bear', type: 'bool', title: 'Bearish Flag', defval: true, group: P },
  { id: 'show_pennant_bull', type: 'bool', title: 'Bullish Pennant', defval: true, group: P },
  { id: 'show_pennant_bear', type: 'bool', title: 'Bearish Pennant', defval: true, group: P },
  { id: 'show_wedge_rise', type: 'bool', title: 'Rising Wedge', defval: true, group: P },
  { id: 'show_wedge_fall', type: 'bool', title: 'Falling Wedge', defval: true, group: P },
  { id: 'show_tri_gen', type: 'bool', title: 'Triangle', defval: true, group: P },
  { id: 'show_rect_gen', type: 'bool', title: 'Rectangle', defval: true, group: P },
  { id: 'show_cup_std', type: 'bool', title: 'Cup and Handle', defval: true, group: P },
  { id: 'show_cup_inv', type: 'bool', title: 'Inverted Cup and Handle', defval: true, group: P },
  { id: 'lb_left', type: 'int', title: 'Pivot Lookback Left', defval: 10, min: 1, group: PV },
  { id: 'lb_right', type: 'int', title: 'Pivot Lookback Right', defval: 10, min: 1, group: PV },
  { id: 'max_piv_hist', type: 'int', title: 'Max Pivots to Remember', defval: 500, min: 5, max: 1000, group: PV },
  { id: 'req_close_brk', type: 'bool', title: 'Require Candle Close Outside?', defval: false, group: F },
  { id: 'req_body_brk', type: 'bool', title: 'Require Full Body Breakout?', defval: false, group: F },
  { id: 'use_atr_brk', type: 'bool', title: 'Use ATR for Threshold?', defval: true, group: F },
  { id: 'break_atr', type: 'float', title: 'Breakout Threshold (ATR)', defval: 1, min: 0.1, step: 0.1, group: F },
  { id: 'break_pct', type: 'float', title: 'Breakout Threshold (%)', defval: 0.3, min: 0, step: 0.1, group: F },
  { id: 'brk_confirm_bars', type: 'int', title: 'Confirmation Bars (Consecutive)', defval: 1, min: 1, group: F },
  { id: 'show_ignore_conf', type: 'bool', title: 'Show Patterns Without Confirmation', defval: false, group: F },
  { id: 'min_brk_bar', type: 'int', title: 'Scan Lookback Bars', defval: 1, min: 1, group: F },
  { id: 'req_vol', type: 'bool', title: 'Require Volume Spike?', defval: false, group: F },
  { id: 'vol_mult', type: 'float', title: 'Volume Multiplier', defval: 1, min: 1, step: 0.1, group: F },
  { id: 'vol_len', type: 'int', title: 'Volume SMA Length', defval: 20, group: F },
  { id: 'min_rr', type: 'float', title: 'Min Risk:Reward Ratio', defval: 1, min: 0.1, step: 0.1, group: F },
  { id: 'slippage_ticks', type: 'float', title: 'Slippage (Ticks)', defval: 1, min: 0, step: 0.1, group: F },
  { id: 'commission_pct', type: 'float', title: 'Commission (%)', defval: 0.0001, min: 0, step: 0.0001, group: F },
  { id: 'col_bull', type: 'color', title: 'Bullish Color', defval: '#00FFB4', group: V },
  { id: 'col_bear', type: 'color', title: 'Bearish Color', defval: '#FF1E78', group: V },
  { id: 'col_neu', type: 'color', title: 'Neutral/Text Color', defval: '#A050FF', group: V },
  { id: 'col_pend', type: 'color', title: 'Pending Pattern Color', defval: '#00C8FF', group: V },
  { id: 'fill_transp', type: 'int', title: 'Fill Transparency', defval: 80, min: 50, max: 99, group: V },
  { id: 'show_tgt', type: 'bool', title: 'Show Measured Targets', defval: true, group: V },
  { id: 'stop_buffer', type: 'float', title: 'Stop Loss ATR Buffer', defval: 0.5, min: 0, step: 0.1, group: V },
  { id: 'use_sl_pct_tgt', type: 'bool', title: 'SL as % of Target Dist', defval: true, group: V },
  { id: 'sl_pct_tgt', type: 'float', title: 'SL % of Target Dist', defval: 25, min: 1, max: 100, step: 0.5, group: V },
  { id: 'max_patterns', type: 'int', title: 'Max Patterns Displayed', defval: 1, min: 1, max: 50, group: V },
  { id: 'extend_lines', type: 'bool', title: 'Extend Breakout Lines', defval: false, group: V },
  { id: 'col_entry', type: 'color', title: 'Entry Line Color', defval: '#FFDC00', group: V },
  { id: 'col_stop', type: 'color', title: 'Stop Line Color', defval: '#FF3282', group: V },
  { id: 'col_target', type: 'color', title: 'Target Line Color', defval: '#00FFA0', group: V },
  { id: 'dash_bg_color', type: 'color', title: 'Background Color', defval: '#0A0A12F2', group: D },
  { id: 'dash_txt_color', type: 'color', title: 'Text Color', defval: '#DCDCEB', group: D },
  { id: 'alert_en', type: 'bool', title: 'Enable Alerts', defval: true, group: 'Alerts' },
  { id: 'rr_dyn_en', type: 'bool', title: 'Dynamic R:R Multiplier', defval: false, group: 'Risk' },
  { id: 'rr_dyn_mult', type: 'float', title: 'R:R Multiplier', defval: 2, min: 0.1, step: 0.1, group: 'Risk' },
  { id: 'atr_norm_en', type: 'bool', title: 'Normalized ATR Display', defval: false, group: 'Volatility' },
  { id: 'lbl_scale_en', type: 'bool', title: 'Custom Label Scaling', defval: false, group: 'UI/UX' },
  { id: 'lbl_scale_sel', type: 'string', title: 'Label Size', defval: 'Normal', options: ['Small', 'Normal', 'Large'], group: 'UI/UX' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill', 'label', 'table'];

export const metadata = {
  title: 'Auto Pattern Detector Targets [MarkitTick]',
  shortTitle: 'Auto Pattern Detector Targets [MarkitTick]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const le = (a: number, b: number) => a - b <= EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const na = (x: number) => Number.isNaN(x);
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);

interface Pivot {
  p: number;
  i: number;
}
const NA_PIVOT: Pivot = { p: NaN, i: NaN };

const FIELDS = [
  'fux1', 'fuy1', 'fux2', 'fuy2', 'flx1', 'fly1', 'flx2', 'fly2',
  'lux1', 'luy1', 'lux2', 'luy2', 'llx1', 'lly1', 'llx2', 'lly2',
] as const;
type Coord = (typeof FIELDS)[number];

type PatternResult = {
  detected: boolean;
  name: string;
  isBullish: boolean;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  start_idx: number;
  breakout_idx: number;
} & Record<Coord, number>;

/** PatternResult.new(detected, name, isBullish, entry, stop, target, l_upper, l_lower, start, breakout, coords...) */
function pattern(
  name: string, isBullish: boolean, entry: number, stop: number, target: number, start: number, breakout: number,
  coords: number[] = [],
): PatternResult {
  const res = {
    detected: true, name, isBullish, entryPrice: entry, stopPrice: stop, targetPrice: target, start_idx: start,
    breakout_idx: breakout,
  } as PatternResult;
  FIELDS.forEach((f, k) => {
    res[f] = k < coords.length ? coords[k] : NaN;
  });
  return res;
}

const EMPTY: PatternResult = { ...pattern('', false, NaN, NaN, NaN, NaN, NaN), detected: false };

/** f_project() */
function project(x1: number, y1: number, x2: number, y2: number, tx: number): number {
  return eq(x2, x1) ? y1 : y1 + ((y2 - y1) / (x2 - x1)) * (tx - x1);
}

/** f_neck_at_break() */
function neckAtBreak(nlI: number, nlP: number, nrI: number, nrP: number, b: number): number {
  if (na(nlI) && na(nrI)) return NaN;
  if (na(nlI)) return nrP;
  if (na(nrI)) return nlP;
  return eq(nlI, nrI) ? nlP : project(nlI, nlP, nrI, nrP, b);
}

const isNear = (v1: number, v2: number, tol: number) => le(Math.abs(v1 - v2), ((v1 + v2) / 2) * tol);

/** f_blockBar() */
function blockBar(score: number): string {
  const n = Math.min(Math.max(math.round(score), 0), 10);
  let s = '';
  for (let i = 1; i <= 10; i++) s += i <= n ? '█' : '░';
  return `${s} ${str.tostring(math.round((score / 10) * 100), '##0')}%`;
}

/** f_blockColor() */
function blockColor(score: number): string {
  return ge(score, 7) ? String(color.rgb(0, 255, 120)) : ge(score, 4) ? String(color.rgb(80, 255, 0))
    : ge(score, 1.5) ? String(color.rgb(200, 200, 0)) : String(color.rgb(110, 110, 110));
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoPatternDetectorTargetsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const symTol = cfg.sym_tol / 100;
  const lvlTol = cfg.lvl_tol / 100;
  const minSizePct = cfg.min_size_pct / 100;
  const breakPct = cfg.break_pct / 100;
  const slPctTgt = cfg.sl_pct_tgt / 100;
  const { lb_left: lbLeft, lb_right: lbRight, max_piv_hist: maxPiv, cooldown } = cfg;
  const mintick = mintickOf(chart);
  const pricescale = chart?.pricescale;
  const fmt = (x: number) => str.tostring(x, 'mintick', mintick, pricescale);
  const slipCost = cfg.slippage_ticks * mintick;
  const tickerid = tickeridOf(chart);
  const prefix = tickerid.includes(':') ? tickerid.slice(0, tickerid.indexOf(':')) : '';
  const cleanTicker = `${prefix}:${tickerOf(chart)}`;
  const period = chartTimeframe(bars, chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const lblSize = cfg.lbl_scale_en ? (cfg.lbl_scale_sel === 'Small' ? 'small' : cfg.lbl_scale_sel === 'Large' ? 'large' : 'normal') : 'small';

  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);
  // vol_sma = ta.sma(volume, math.max(1, math.min(vol_len, bar_index + 1))), atr_val = ta.atr(14)
  const volLens = bars.map((_, i) => Math.max(1, Math.min(cfg.vol_len, i + 1)));
  const volSma = ta.sma(Series.fromArray(bars, volume), Series.fromArray(bars, volLens)).toArray().map((v) => v ?? NaN);
  const atr = ta.atr(bars, 14).toArray().map((v) => v ?? NaN);
  const poleHigh = callsite.highest();
  const poleLow = callsite.lowest();

  resetDrawings({ line: 500, label: 500, box: 500 });
  const dash = table.new('top_right', 2, 9, undefined, String(color.rgb(60, 60, 90, 10)), 1, String(color.rgb(50, 50, 70, 20)), 1);
  const alertCalls: AlertCall[] = [];

  const pivotHighs: Pivot[] = [];
  const pivotLows: Pivot[] = [];
  const patHistory: { lns: Line[]; lbls: Label[] }[] = [];
  let dashPatName = '—';
  let dashPatBull = false;
  let dashLastBar = 0;
  let dashEntry = NaN;
  let dashStop = NaN;
  let dashTarget = NaN;
  let frozenStart = NaN;

  for (let bi = 0; bi < n; bi++) {
    setDrawingBar(bi, bi === n - 1);
    const atrV = atr[bi];

    // dashboard values at the start of the bar
    const dashPivTotal = pivotHighs.length + pivotLows.length;
    let dashCells: [string, string, string][] | null = null;
    if (bi === n - 1) {
      const volRatio = gt(volSma[bi], 0) ? volume[bi] / volSma[bi] : 1;
      const volScore = Math.min(Math.max(((volRatio - 1) / 4) * 10, 0), 10);
      const rrRaw = !na(dashEntry) && !na(dashStop) && !na(dashTarget) && gt(Math.abs(dashEntry - dashStop), 0)
        ? Math.abs(dashTarget - dashEntry) / Math.abs(dashEntry - dashStop) : 0;
      const rrScore = Math.min((rrRaw / 5) * 10, 10);
      const pivScore = Math.min((dashPivTotal / 20) * 10, 10);
      const biasCol = dashPatBull ? String(color.rgb(0, 255, 120)) : String(color.rgb(255, 60, 80));
      const atrStr = cfg.atr_norm_en ? `${str.tostring(math.round(atrV / mintick), '##0')} ticks` : fmt(atrV);
      const txt = cfg.dash_txt_color;
      const blue = String(color.rgb(140, 180, 255));
      dashCells = [
        ['  Pattern Detector', `${cleanTicker} · ${period}`, txt],
        ['  Pattern Bias', dashPatBull ? '▲ Bull' : '▼ Bear', biasCol],
        ['  Active Pattern', dashPatName, biasCol],
        ['  ATR (14)', atrStr, String(color.rgb(200, 200, 60))],
        ['  Vol Spike', blockBar(volScore), blockColor(volScore)],
        ['  R:R Quality', blockBar(rrScore), blockColor(rrScore)],
        ['  Pivot Depth', blockBar(pivScore), blockColor(pivScore)],
        ['  Bars Since Brk', `⏳ ${bi - dashLastBar} Bars`, blue],
        ['  Pivot Count', `⏳ ${dashPivTotal} Pivots`, blue],
      ];
    }

    const H = (k: number) => (bi - k >= 0 ? high[bi - k] : NaN);
    const L = (k: number) => (bi - k >= 0 ? low[bi - k] : NaN);

    const isValidSize = (h: number, price: number) => gt(h, Math.max(price * minSizePct, atrV * cfg.min_atr_mult));
    const applyBuffer = (price: number, bull: boolean) => (bull ? price - atrV * cfg.stop_buffer : price + atrV * cfg.stop_buffer);
    const slPat = (anchor: number, bull: boolean, entry: number, target: number) => {
      if (cfg.use_sl_pct_tgt && !na(entry) && !na(target)) {
        const dist = Math.abs(target - entry);
        return bull ? entry - dist * slPctTgt : entry + dist * slPctTgt;
      }
      return applyBuffer(anchor, bull);
    };
    const entryPrice = (b: number) => {
      const offs = bi - b;
      return offs >= 1 ? open[bi - offs] : NaN;
    };
    // f_get_break_idx_precise()
    const breakIdx = (x1: number, y1: number, x2: number, y2: number, isUp: boolean) => {
      const scan = Math.max(cfg.min_brk_bar, lbRight) + 10;
      const m = eq(x2, x1) ? 0 : (y2 - y1) / (x2 - x1);
      for (let i = scan; i >= 1; i--) {
        if (bi - i < 0) continue;
        const j = bi - i;
        const proj = eq(x2, x1) ? y1 : y1 + m * (j - x1);
        const margin = cfg.use_atr_brk ? atr[j] * cfg.break_atr : proj * breakPct;
        const up = proj + margin;
        const down = proj - margin;
        const cv = cfg.req_close_brk ? close[j] : isUp ? high[j] : low[j];
        let broken = isUp ? gt(cv, up) : lt(cv, down);
        if (cfg.req_body_brk && broken && !cfg.show_ignore_conf) {
          broken = isUp ? gt(open[j], up) && gt(close[j], up) : lt(open[j], down) && lt(close[j], down);
        }
        if (broken) {
          let confirmed = true;
          if (cfg.brk_confirm_bars > 1 && !cfg.show_ignore_conf) {
            for (let k = 1; k <= cfg.brk_confirm_bars - 1; k++) {
              const ci = i - k;
              if (ci < 0) {
                confirmed = false;
                break;
              }
              const projK = eq(x2, x1) ? y1 : y1 + m * (bi - ci - x1);
              const marginK = cfg.use_atr_brk ? atr[bi - ci] * cfg.break_atr : projK * breakPct;
              if (isUp && le(close[bi - ci], projK + marginK)) {
                confirmed = false;
                break;
              } else if (!isUp && ge(close[bi - ci], projK - marginK)) {
                confirmed = false;
                break;
              }
            }
          }
          if (confirmed) return bi - i;
        }
      }
      return NaN;
    };
    // f_validate_pattern()
    const validate = (b: number, entry: number, stop: number, target: number) => {
      if (cfg.show_ignore_conf) return true;
      let valid = true;
      if (cfg.req_vol && !na(b)) {
        const offs = bi - b;
        if (offs >= 0 && offs < bi) {
          const sma = volSma[bi - offs];
          if (!na(sma) && le(volume[bi - offs], sma * cfg.vol_mult)) valid = false;
        }
      }
      if (valid && !na(entry)) {
        const cost = slipCost + entry * (cfg.commission_pct / 100) * 2;
        const risk = Math.abs(entry - stop);
        const reward = Math.max(0, Math.abs(target - entry) - cost);
        if (eq(risk, 0) || lt(reward / risk, cfg.min_rr)) valid = false;
      }
      return valid;
    };

    const detectHS = (): PatternResult => {
      let res = EMPTY;
      const hasHs = pivotHighs.length >= 3 && pivotLows.length >= 2;
      const hasIhs = pivotLows.length >= 3 && pivotHighs.length >= 2;
      const rs = hasHs ? pivotHighs[0] : NA_PIVOT;
      const head = hasHs ? pivotHighs[1] : NA_PIVOT;
      const ls = hasHs ? pivotHighs[2] : NA_PIVOT;
      const neckR = hasHs ? pivotLows[0] : NA_PIVOT;
      const neckL = hasHs ? pivotLows[1] : NA_PIVOT;
      const rsI = hasIhs ? pivotLows[0] : NA_PIVOT;
      const headI = hasIhs ? pivotLows[1] : NA_PIVOT;
      const lsI = hasIhs ? pivotLows[2] : NA_PIVOT;
      const hNeckR = hasIhs ? pivotHighs[0] : NA_PIVOT;
      const hNeckL = hasIhs ? pivotHighs[1] : NA_PIVOT;
      const bHs = breakIdx(neckL.i, neckL.p, neckR.i, neckR.p, false);
      const bIhs = breakIdx(hNeckL.i, hNeckL.p, hNeckR.i, hNeckR.p, true);
      const epHs = entryPrice(bHs);
      const naHs = neckAtBreak(neckL.i, neckL.p, neckR.i, neckR.p, nz(bHs));
      const neckAvg = (nz(neckR.p) + nz(neckL.p)) / 2;
      const htHs = nz(head.p) - neckAvg;
      const tpHs = naHs - htHs;
      const spHs = slPat(rs.p, false, epHs, tpHs);
      const valHs = validate(bHs, epHs, spHs, tpHs);
      const epIhs = entryPrice(bIhs);
      const naIhs = neckAtBreak(hNeckL.i, hNeckL.p, hNeckR.i, hNeckR.p, nz(bIhs));
      const neckAvgInv = (nz(hNeckR.p) + nz(hNeckL.p)) / 2;
      const htIhs = neckAvgInv - nz(headI.p);
      const tpIhs = naIhs + htIhs;
      const spIhs = slPat(rsI.p, true, epIhs, tpIhs);
      const valIhs = validate(bIhs, epIhs, spIhs, tpIhs);
      if (hasHs) {
        if (gt(rs.i, neckR.i) && gt(neckR.i, head.i) && gt(head.i, neckL.i) && gt(neckL.i, ls.i)) {
          if (gt(head.p, rs.p) && gt(head.p, ls.p) && isNear(ls.p, rs.p, symTol)) {
            if (isValidSize(htHs, close[bi]) && !na(bHs) && !na(epHs) && valHs && cfg.show_hs_std) {
              res = pattern('Head & Shoulders', false, epHs, spHs, tpHs, ls.i, bHs,
                [ls.i, head.p, bHs, naHs, neckL.i, neckL.p, bHs, naHs, NaN, NaN, NaN, NaN, neckL.i, neckL.p, bHs, naHs]);
            }
          }
        }
      }
      if (!res.detected && hasIhs) {
        if (gt(rsI.i, hNeckR.i) && gt(hNeckR.i, headI.i) && gt(headI.i, hNeckL.i) && gt(hNeckL.i, lsI.i)) {
          if (lt(headI.p, rsI.p) && lt(headI.p, lsI.p) && isNear(lsI.p, rsI.p, symTol)) {
            if (isValidSize(htIhs, close[bi]) && !na(bIhs) && !na(epIhs) && valIhs && cfg.show_hs_inv) {
              res = pattern('Inv Head & Shoulders', true, epIhs, spIhs, tpIhs, lsI.i, bIhs,
                [hNeckL.i, hNeckL.p, bIhs, naIhs, lsI.i, headI.p, bIhs, naIhs, hNeckL.i, hNeckL.p, bIhs, naIhs]);
            }
          }
        }
      }
      return res;
    };

    const detectDouble = (): PatternResult => {
      let res = EMPTY;
      const hasDt = pivotHighs.length >= 2 && pivotLows.length >= 1;
      const hasDb = pivotLows.length >= 2 && pivotHighs.length >= 1;
      const p1 = hasDt ? pivotHighs[0] : NA_PIVOT;
      const p2 = hasDt ? pivotHighs[1] : NA_PIVOT;
      const mid = hasDt ? pivotLows[0] : NA_PIVOT;
      const p1b = hasDb ? pivotLows[0] : NA_PIVOT;
      const p2b = hasDb ? pivotLows[1] : NA_PIVOT;
      const midB = hasDb ? pivotHighs[0] : NA_PIVOT;
      const bDt = breakIdx(mid.i, mid.p, bi, mid.p, false);
      const bDb = breakIdx(midB.i, midB.p, bi, midB.p, true);
      const epDt = entryPrice(bDt);
      const avgTop = (nz(p1.p) + nz(p2.p)) / 2;
      const htDt = avgTop - nz(mid.p);
      const tpDt = nz(mid.p) - htDt;
      const spDt = slPat(Math.max(nz(p1.p), nz(p2.p)), false, epDt, tpDt);
      const valDt = validate(bDt, epDt, spDt, tpDt);
      const epDb = entryPrice(bDb);
      const avgBot = (nz(p1b.p) + nz(p2b.p)) / 2;
      const htDb = nz(midB.p) - avgBot;
      const tpDb = nz(midB.p) + htDb;
      const spDb = slPat(Math.min(nz(p1b.p), nz(p2b.p)), true, epDb, tpDb);
      const valDb = validate(bDb, epDb, spDb, tpDb);
      if (hasDt && gt(p1.i, mid.i) && gt(mid.i, p2.i) && isNear(p1.p, p2.p, lvlTol)) {
        if (isValidSize(htDt, close[bi]) && !na(bDt) && !na(epDt) && valDt && cfg.show_dt_top) {
          res = pattern('Double Top', false, epDt, spDt, tpDt, p2.i, bDt,
            [p2.i, avgTop, bDt, avgTop, mid.i, mid.p, bDt, mid.p, NaN, NaN, NaN, NaN, mid.i, mid.p, bDt, mid.p]);
        }
      }
      if (!res.detected && hasDb && gt(p1b.i, midB.i) && gt(midB.i, p2b.i) && isNear(p1b.p, p2b.p, lvlTol)) {
        if (isValidSize(htDb, close[bi]) && !na(bDb) && !na(epDb) && valDb && cfg.show_dt_bot) {
          res = pattern('Double Bottom', true, epDb, spDb, tpDb, p2b.i, bDb,
            [midB.i, midB.p, bDb, midB.p, p2b.i, avgBot, bDb, avgBot, midB.i, midB.p, bDb, midB.p]);
        }
      }
      return res;
    };

    const detectTriple = (): PatternResult => {
      let res = EMPTY;
      const hasTt = pivotHighs.length >= 3 && pivotLows.length >= 2;
      const hasTb = pivotLows.length >= 3 && pivotHighs.length >= 2;
      const h1 = hasTt ? pivotHighs[0] : NA_PIVOT;
      const h2 = hasTt ? pivotHighs[1] : NA_PIVOT;
      const h3 = hasTt ? pivotHighs[2] : NA_PIVOT;
      const l1t = hasTt ? pivotLows[0] : NA_PIVOT;
      const l2t = hasTt ? pivotLows[1] : NA_PIVOT;
      const l1b = hasTb ? pivotLows[0] : NA_PIVOT;
      const l2b = hasTb ? pivotLows[1] : NA_PIVOT;
      const l3b = hasTb ? pivotLows[2] : NA_PIVOT;
      const h1b = hasTb ? pivotHighs[0] : NA_PIVOT;
      const h2b = hasTb ? pivotHighs[1] : NA_PIVOT;
      const neckTt = Math.min(nz(l1t.p), nz(l2t.p));
      const topTt = Math.max(nz(h1.p), Math.max(nz(h2.p), nz(h3.p)));
      const htTt = topTt - neckTt;
      const neckTb = Math.max(nz(h1b.p), nz(h2b.p));
      const botTb = Math.min(nz(l1b.p), Math.min(nz(l2b.p), nz(l3b.p)));
      const htTb = neckTb - botTb;
      const bTt = breakIdx(l2t.i, l2t.p, l1t.i, l1t.p, false);
      const bTb = breakIdx(h2b.i, neckTb, h1b.i, neckTb, true);
      const naTt = neckAtBreak(l2t.i, l2t.p, l1t.i, l1t.p, nz(bTt));
      const naTb = neckAtBreak(h2b.i, neckTb, h1b.i, neckTb, nz(bTb));
      const epTt = entryPrice(bTt);
      const epTb = entryPrice(bTb);
      const tpTt = naTt - htTt;
      const tpTb = naTb + htTb;
      const spTt = slPat(topTt, false, epTt, tpTt);
      const spTb = slPat(botTb, true, epTb, tpTb);
      const valTt = validate(bTt, epTt, spTt, tpTt);
      const valTb = validate(bTb, epTb, spTb, tpTb);
      if (hasTt && gt(h1.i, l1t.i) && gt(l1t.i, h2.i) && gt(h2.i, l2t.i) && gt(l2t.i, h3.i)) {
        if (isNear(h1.p, h2.p, lvlTol) && isNear(h2.p, h3.p, lvlTol)) {
          if (isValidSize(htTt, close[bi]) && !na(bTt) && !na(epTt) && valTt && cfg.show_tt_top) {
            const avgTopTt = Math.max(h1.p, Math.max(h2.p, h3.p));
            res = pattern('Triple Top', false, epTt, spTt, tpTt, h3.i, bTt,
              [h3.i, avgTopTt, bTt, avgTopTt, l2t.i, neckTt, bTt, naTt, NaN, NaN, NaN, NaN, l2t.i, neckTt, bTt, naTt]);
          }
        }
      }
      if (!res.detected && hasTb && gt(l1b.i, h1b.i) && gt(h1b.i, l2b.i) && gt(l2b.i, h2b.i) && gt(h2b.i, l3b.i)) {
        if (isNear(l1b.p, l2b.p, lvlTol) && isNear(l2b.p, l3b.p, lvlTol)) {
          if (isValidSize(htTb, close[bi]) && !na(bTb) && !na(epTb) && valTb && cfg.show_tt_bot) {
            const avgBotTt = Math.min(l1b.p, Math.min(l2b.p, l3b.p));
            res = pattern('Triple Bottom', true, epTb, spTb, tpTb, l3b.i, bTb,
              [h2b.i, neckTb, bTb, naTb, l3b.i, avgBotTt, bTb, avgBotTt, h2b.i, neckTb, bTb, naTb]);
          }
        }
      }
      return res;
    };

    const detectCupHandle = (): PatternResult => {
      let res = EMPTY;
      const hasCup = pivotHighs.length >= 2 && pivotLows.length >= 2;
      const hRim = hasCup ? pivotHighs[0] : NA_PIVOT;
      const hLeft = hasCup ? pivotHighs[1] : NA_PIVOT;
      const lHandle = hasCup ? pivotLows[0] : NA_PIVOT;
      const lBot = hasCup ? pivotLows[1] : NA_PIVOT;
      const lRim = hasCup ? pivotLows[0] : NA_PIVOT;
      const lLeft = hasCup ? pivotLows[1] : NA_PIVOT;
      const hHandle = hasCup ? pivotHighs[0] : NA_PIVOT;
      const hTop = hasCup ? pivotHighs[1] : NA_PIVOT;
      const cupHStd = nz(hRim.p) - nz(lBot.p);
      const cupHInv = nz(hTop.p) - nz(lRim.p);
      const bCup = breakIdx(hRim.i, hRim.p, bi, hRim.p, true);
      const bInv = breakIdx(lRim.i, lRim.p, bi, lRim.p, false);
      const naCup = neckAtBreak(hLeft.i, hLeft.p, hRim.i, hRim.p, nz(bCup));
      const naInv = neckAtBreak(lLeft.i, lLeft.p, lRim.i, lRim.p, nz(bInv));
      const epCup = entryPrice(bCup);
      const epInv = entryPrice(bInv);
      const tpCup = naCup + cupHStd;
      const tpInv = naInv - cupHInv;
      const spCup = slPat(lHandle.p, true, epCup, tpCup);
      const spInv = slPat(hHandle.p, false, epInv, tpInv);
      const valCup = validate(bCup, epCup, spCup, tpCup);
      const valInv = validate(bInv, epInv, spInv, tpInv);
      if (hasCup && gt(lHandle.i, hRim.i) && gt(hRim.i, lBot.i) && gt(lBot.i, hLeft.i)) {
        if (isNear(hRim.p, hLeft.p, symTol) && gt(lHandle.p, lBot.p) && lt(lHandle.p, hRim.p)) {
          if (isValidSize(cupHStd, close[bi]) && !na(bCup) && !na(epCup) && valCup && cfg.show_cup_std) {
            res = pattern('Cup & Handle', true, epCup, spCup, tpCup, hLeft.i, bCup,
              [hLeft.i, hLeft.p, bCup, naCup, hLeft.i, lBot.p, bCup, lHandle.p, hLeft.i, hRim.p, bCup, naCup]);
          }
        }
      }
      if (!res.detected && hasCup && gt(hHandle.i, lRim.i) && gt(lRim.i, hTop.i) && gt(hTop.i, lLeft.i)) {
        if (isNear(lRim.p, lLeft.p, symTol) && lt(hHandle.p, hTop.p) && gt(hHandle.p, lRim.p)) {
          if (isValidSize(cupHInv, close[bi]) && !na(bInv) && !na(epInv) && valInv && cfg.show_cup_inv) {
            res = pattern('Inv Cup & Handle', false, epInv, spInv, tpInv, lLeft.i, bInv,
              [lLeft.i, hTop.p, bInv, hHandle.p, lLeft.i, lLeft.p, bInv, naInv, NaN, NaN, NaN, NaN, lLeft.i, lRim.p, bInv, naInv]);
          }
        }
      }
      return res;
    };

    /** Latest two pivot highs and lows, and the slopes of their lines */
    const pairs = () => {
      const has = pivotHighs.length >= 2 && pivotLows.length >= 2;
      const h1 = has ? pivotHighs[0] : NA_PIVOT;
      const h2 = has ? pivotHighs[1] : NA_PIVOT;
      const l1 = has ? pivotLows[0] : NA_PIVOT;
      const l2 = has ? pivotLows[1] : NA_PIVOT;
      const slopeU = eq(h1.i, h2.i) ? 0 : (nz(h1.p) - nz(h2.p)) / Math.max(1, h1.i - h2.i);
      const slopeL = eq(l1.i, l2.i) ? 0 : (nz(l1.p) - nz(l2.p)) / Math.max(1, l1.i - l2.i);
      const up = (x: number) => project(h2.i, h2.p, h1.i, h1.p, x);
      const dn = (x: number) => project(l2.i, l2.p, l1.i, l1.p, x);
      return { has, h1, h2, l1, l2, slopeU, slopeL, up, dn };
    };

    /** The boundary coordinates set after a detection (flag, wedge, triangle) */
    const setLines = (res: PatternResult, q: ReturnType<typeof pairs>, fromPivots: boolean) => {
      const sb = Math.min(q.h2.i, q.l2.i);
      const b = res.breakout_idx;
      const ubs = q.up(b);
      const lbs = q.dn(b);
      const uss = q.up(sb);
      const lss = q.dn(sb);
      res.fux1 = fromPivots ? q.h2.i : sb;
      res.fuy1 = fromPivots ? q.h2.p : uss;
      res.fux2 = b;
      res.fuy2 = ubs;
      res.flx1 = fromPivots ? q.l2.i : sb;
      res.fly1 = fromPivots ? q.l2.p : lss;
      res.flx2 = b;
      res.fly2 = lbs;
      res.lux1 = sb;
      res.luy1 = uss;
      res.lux2 = b;
      res.luy2 = ubs;
      res.llx1 = sb;
      res.lly1 = lss;
      res.llx2 = b;
      res.lly2 = lbs;
    };

    // ── PIVOT COLLECTION ── f_pivotHigh(high, lb_left) / f_pivotLow(low, lb_left)
    const candH = H(lbLeft);
    const candL = L(lbLeft);
    let validH = true;
    let validL = true;
    for (let k = 1; k <= lbLeft * 2; k++) {
      if (k !== lbLeft && ge(H(k), candH)) validH = false;
      if (k !== lbLeft && le(L(k), candL)) validL = false;
    }
    const ph = validH ? candH : NaN;
    const pl = validL ? candL : NaN;
    if (!na(ph)) {
      pivotHighs.unshift({ p: ph, i: bi - lbRight });
      if (pivotHighs.length > maxPiv) pivotHighs.pop();
    }
    if (!na(pl)) {
      pivotLows.unshift({ p: pl, i: bi - lbRight });
      if (pivotLows.length > maxPiv) pivotLows.pop();
    }
    const hasPivots = pivotHighs.length >= 2 && pivotLows.length >= 2;

    // detectFlagPennant(): ta.highest / ta.lowest run on every bar
    const qf = pairs();
    const startBar = Math.min(nz(qf.h2.i), nz(qf.l2.i));
    const poleLen = Math.min(200, bi - startBar + 1);
    const poleMove = poleHigh(high[bi], poleLen, bi) - poleLow(low[bi], poleLen, bi);
    const detectFlagPennant = (): PatternResult => {
      let res = EMPTY;
      const q = qf;
      const parallel = isNear(q.slopeU, q.slopeL, 0.2);
      const bBull = breakIdx(q.h2.i, q.h2.p, q.h1.i, q.h1.p, true);
      const bBear = breakIdx(q.l2.i, q.l2.p, q.l1.i, q.l1.p, false);
      const ubBull = q.up(nz(bBull));
      const lbBull = q.dn(nz(bBull));
      const ubBear = q.up(nz(bBear));
      const lbBear = q.dn(nz(bBear));
      const epBull = entryPrice(bBull);
      const epBear = entryPrice(bBear);
      const tpBull = ubBull + poleMove;
      const tpBear = lbBear - poleMove;
      const spBull = slPat(lbBull, true, epBull, tpBull);
      const spBear = slPat(ubBear, false, epBear, tpBear);
      const valBull = validate(bBull, epBull, spBull, tpBull);
      const valBear = validate(bBear, epBear, spBear, tpBear);
      if (q.has && gt(poleMove, atrV * 3)) {
        if (lt(q.slopeU, 0) && lt(q.slopeL, 0)) {
          if (!na(bBull) && !na(epBull) && valBull && ((parallel && cfg.show_flag_bull) || (!parallel && cfg.show_pennant_bull))) {
            res = pattern(parallel ? 'Bullish Flag' : 'Bullish Pennant', true, epBull, spBull, tpBull, q.h2.i, bBull);
          }
        } else if (gt(q.slopeU, 0) && gt(q.slopeL, 0)) {
          if (!na(bBear) && !na(epBear) && valBear && ((parallel && cfg.show_flag_bear) || (!parallel && cfg.show_pennant_bear))) {
            res = pattern(parallel ? 'Bearish Flag' : 'Bearish Pennant', false, epBear, spBear, tpBear, q.h2.i, bBear);
          }
        }
      }
      if (res.detected) setLines(res, q, false);
      return res;
    };

    const detectWedge = (): PatternResult => {
      let res = EMPTY;
      const q = pairs();
      const heightNow = q.up(bi) - q.dn(bi);
      const bFall = breakIdx(q.h2.i, q.h2.p, q.h1.i, q.h1.p, true);
      const bRise = breakIdx(q.l2.i, q.l2.p, q.l1.i, q.l1.p, false);
      const lbFall = q.dn(nz(bFall));
      const ubRise = q.up(nz(bRise));
      const epFall = entryPrice(bFall);
      const epRise = entryPrice(bRise);
      const tpFall = nz(q.h2.p);
      const tpRise = nz(q.l2.p);
      const spFall = slPat(lbFall, true, epFall, tpFall);
      const spRise = slPat(ubRise, false, epRise, tpRise);
      const valFall = validate(bFall, epFall, spFall, tpFall);
      const valRise = validate(bRise, epRise, spRise, tpRise);
      if (q.has && gt(heightNow, 0)) {
        if (lt(q.slopeU, 0) && lt(q.slopeL, 0) && lt(q.slopeL, q.slopeU)) {
          if (!na(bFall) && !na(epFall) && valFall && cfg.show_wedge_fall) {
            res = pattern('Falling Wedge', true, epFall, spFall, tpFall, q.h2.i, bFall);
          }
        } else if (gt(q.slopeU, 0) && gt(q.slopeL, 0) && gt(q.slopeL, q.slopeU)) {
          if (!na(bRise) && !na(epRise) && valRise && cfg.show_wedge_rise) {
            res = pattern('Rising Wedge', false, epRise, spRise, tpRise, q.h2.i, bRise);
          }
        }
      }
      if (res.detected) setLines(res, q, true);
      return res;
    };

    const detectTriangles = (): PatternResult => {
      let res = EMPTY;
      const q = pairs();
      const startTri = Math.min(nz(q.h2.i), nz(q.l2.i));
      const baseHeight = Math.abs(q.up(startTri) - q.dn(startTri));
      const flatTol = close[bi] * 0.0005;
      const converging = gt(q.up(bi), q.dn(bi));
      const bBull = breakIdx(q.h2.i, q.h2.p, q.h1.i, q.h1.p, true);
      const bBear = breakIdx(q.l2.i, q.l2.p, q.l1.i, q.l1.p, false);
      const ubBull = q.up(nz(bBull));
      const lbBull = q.dn(nz(bBull));
      const ubBear = q.up(nz(bBear));
      const lbBear = q.dn(nz(bBear));
      const epBull = entryPrice(bBull);
      const epBear = entryPrice(bBear);
      const tpBull = ubBull + baseHeight;
      const tpBear = lbBear - baseHeight;
      const spBull = slPat(lbBull, true, epBull, tpBull);
      const spBear = slPat(ubBear, false, epBear, tpBear);
      const valBull = validate(bBull, epBull, spBull, tpBull);
      const valBear = validate(bBear, epBear, spBear, tpBear);
      if (q.has && converging && isValidSize(baseHeight, close[bi])) {
        if ((lt(q.slopeU, 0) && gt(q.slopeL, 0)) || (lt(Math.abs(q.slopeU), flatTol) && gt(q.slopeL, 0))) {
          if (!na(bBull) && !na(epBull) && valBull && cfg.show_tri_gen) {
            const asc = lt(Math.abs(q.slopeU), flatTol);
            res = pattern(asc ? 'Ascending Triangle' : 'Symmetrical Triangle', true, epBull, spBull, tpBull, q.h2.i, bBull);
          }
        }
        if (!res.detected && ((lt(q.slopeU, 0) && gt(q.slopeL, 0)) || (lt(q.slopeU, 0) && lt(Math.abs(q.slopeL), flatTol)))) {
          if (!na(bBear) && !na(epBear) && valBear && cfg.show_tri_gen) {
            const desc = lt(Math.abs(q.slopeL), flatTol);
            res = pattern(desc ? 'Descending Triangle' : 'Symmetrical Triangle', false, epBear, spBear, tpBear, q.h2.i, bBear);
          }
        }
      }
      if (res.detected) setLines(res, q, true);
      return res;
    };

    const detectRectangles = (): PatternResult => {
      let res = EMPTY;
      const q = pairs();
      const flatTolR = atrV * 0.05;
      const isFlat = lt(Math.abs(q.slopeU), flatTolR) && lt(Math.abs(q.slopeL), flatTolR);
      const startRect = Math.min(nz(q.h2.i), nz(q.l2.i));
      const avgTop = (nz(q.h1.p) + nz(q.h2.p)) / 2;
      const avgBot = (nz(q.l1.p) + nz(q.l2.p)) / 2;
      const height = avgTop - avgBot;
      const bBull = breakIdx(startRect, avgTop, bi, avgTop, true);
      const bBear = breakIdx(startRect, avgBot, bi, avgBot, false);
      const epBull = entryPrice(bBull);
      const epBear = entryPrice(bBear);
      const tpBull = avgTop + height;
      const tpBear = avgBot - height;
      const spBull = slPat(avgBot, true, epBull, tpBull);
      const spBear = slPat(avgTop, false, epBear, tpBear);
      const valBull = validate(bBull, epBull, spBull, tpBull);
      const valBear = validate(bBear, epBear, spBear, tpBear);
      if (q.has && isFlat && isNear(q.slopeU, q.slopeL, 0.5) && isValidSize(height, close[bi])) {
        if (!na(bBull) && !na(epBull) && valBull && cfg.show_rect_gen) {
          res = pattern('Rectangle', true, epBull, spBull, tpBull, q.h2.i, bBull,
            [startRect, avgTop, bBull, avgTop, startRect, avgBot, bBull, avgBot]);
        }
        if (!res.detected && !na(bBear) && !na(epBear) && valBear && cfg.show_rect_gen) {
          res = pattern('Rectangle', false, epBear, spBear, tpBear, q.h2.i, bBear,
            [startRect, avgTop, bBear, avgTop, startRect, avgBot, bBear, avgBot]);
        }
      }
      if (res.detected) {
        const sb = Math.min(q.h2.i, q.l2.i);
        const b = res.breakout_idx;
        res.lux1 = sb;
        res.luy1 = avgTop;
        res.lux2 = b;
        res.luy2 = avgTop;
        res.llx1 = sb;
        res.lly1 = avgBot;
        res.llx2 = b;
        res.lly2 = avgBot;
      }
      return res;
    };

    // ── PATTERN ENGINE ── (the detection functions have no state: they only matter when the gate is open)
    let res = EMPTY;
    if (bi > 600 && hasPivots) {
      const rDbl = detectDouble();
      const rTri = detectTriple();
      const rHs = detectHS();
      const rFp = detectFlagPennant();
      const rWdg = detectWedge();
      const rTrng = detectTriangles();
      const rRect = detectRectangles();
      const rCup = detectCupHandle();
      if ((cfg.show_dt_top || cfg.show_dt_bot) && !res.detected && rDbl.detected) res = rDbl;
      if ((cfg.show_tt_top || cfg.show_tt_bot) && !res.detected && rTri.detected) res = rTri;
      if ((cfg.show_hs_std || cfg.show_hs_inv) && !res.detected && rHs.detected) res = rHs;
      if ((cfg.show_flag_bull || cfg.show_flag_bear || cfg.show_pennant_bull || cfg.show_pennant_bear) && !res.detected && rFp.detected) res = rFp;
      if ((cfg.show_wedge_rise || cfg.show_wedge_fall) && !res.detected && rWdg.detected) res = rWdg;
      if (cfg.show_tri_gen && !res.detected && rTrng.detected) res = rTrng;
      if (cfg.show_rect_gen && !res.detected && rRect.detected) res = rRect;
      if ((cfg.show_cup_std || cfg.show_cup_inv) && !res.detected && rCup.detected) res = rCup;
    }

    // ── RENDERING ──
    const confirmed = bi < n - 1 || lastConfirmed;
    const isNew = res.detected && confirmed && (na(frozenStart) || gt(Math.abs(res.start_idx - frozenStart), cooldown));
    if (isNew && cfg.rr_dyn_en && !na(res.entryPrice) && !na(res.stopPrice)) {
      const risk = Math.abs(res.entryPrice - res.stopPrice);
      res.targetPrice = res.isBullish ? res.entryPrice + risk * cfg.rr_dyn_mult : res.entryPrice - risk * cfg.rr_dyn_mult;
    }
    if (isNew) {
      const cur = { lns: [] as Line[], lbls: [] as Label[] };
      frozenStart = res.start_idx;
      dashPatName = res.name;
      dashPatBull = res.isBullish;
      dashLastBar = bi;
      dashEntry = res.entryPrice;
      dashStop = res.stopPrice;
      dashTarget = res.targetPrice;
      const col = res.isBullish ? cfg.col_bull : cfg.col_bear;
      const txt = res.name;

      if (!na(res.fux1) && !na(res.fuy1) && !na(res.fux2) && !na(res.fuy2)) {
        // f_fill_sliced()
        const top = line.new(res.fux1, res.fuy1, res.fux2, res.fuy2, 'bar_index', undefined, String(color.new(col, 100)), undefined, 1);
        const bot = line.new(res.flx1, res.fly1, res.flx2, res.fly2, 'bar_index', undefined, String(color.new(col, 100)), undefined, 1);
        linefill.new(top, bot, String(color.new(col, cfg.fill_transp)));
        cur.lns.push(top, bot);
      }
      const ext = cfg.extend_lines ? 'right' : undefined;
      if (!na(res.lux1)) cur.lns.push(line.new(res.lux1, res.luy1, res.lux2, res.luy2, 'bar_index', ext, col, undefined, 2));
      if (!na(res.llx1)) cur.lns.push(line.new(res.llx1, res.lly1, res.llx2, res.lly2, 'bar_index', ext, col, undefined, 2));

      if (!na(res.start_idx) && !na(res.breakout_idx)) {
        // int _cx = (start + breakout) / 2 keeps the fractional quotient
        const cx = (res.start_idx + res.breakout_idx) / 2;
        const uy = !na(res.lux1) ? project(res.lux1, res.luy1, res.lux2, res.luy2, cx)
          : !na(res.fux1) ? project(res.fux1, res.fuy1, res.fux2, res.fuy2, cx) : NaN;
        const ly = !na(res.llx1) ? project(res.llx1, res.lly1, res.llx2, res.lly2, cx)
          : !na(res.flx1) ? project(res.flx1, res.fly1, res.flx2, res.fly2, cx) : NaN;
        const cy = !na(uy) && !na(ly) ? (uy + ly) / 2 : !na(uy) ? uy : ly;
        if (!na(cy)) {
          cur.lbls.push(label.new(cx, cy, txt, 'bar_index', 'price', String(color.rgb(0, 0, 0, 0)), 'label_center', '#FFFFFF', lblSize));
        }
      }

      if (cfg.alert_en && !na(res.entryPrice) && !na(res.targetPrice) && !na(res.stopPrice)) {
        const json = '{' + str.format('"ticker":"{0}","pattern":"{1}","bias":"{2}","entry":{3},"tp":{4},"sl":{5}', tickerid, txt,
          res.isBullish ? 'bull' : 'bear', fmt(res.entryPrice), fmt(res.targetPrice), fmt(res.stopPrice)) + '}';
        alertCalls.push({ time: bars[bi].time as number, message: json, freq: 'once_per_bar_close' });
      }

      if (cfg.show_tgt && !na(res.breakout_idx) && !na(res.entryPrice) && !na(res.stopPrice) && !na(res.targetPrice)) {
        const offs = bi - res.breakout_idx;
        if (offs >= 1) {
          const x1 = res.breakout_idx;
          const x2 = x1 + 50;
          const lx = x2 + 1;
          const ep = res.entryPrice;
          const cost = slipCost + ep * (cfg.commission_pct / 100) * 2;
          const risk = Math.abs(ep - res.stopPrice);
          const reward = Math.max(0, Math.abs(res.targetPrice - ep) - cost);
          const rr = eq(risk, 0) ? 0 : reward / risk;
          const rrStr = str.tostring(rr, '#.##');
          cur.lns.push(
            line.new(x1, ep, x2, ep, 'bar_index', undefined, cfg.col_entry, 'dashed', 1),
            line.new(x1, res.stopPrice, x2, res.stopPrice, 'bar_index', undefined, cfg.col_stop, 'dashed', 1),
            line.new(x1, res.targetPrice, x2, res.targetPrice, 'bar_index', undefined, cfg.col_target, 'dashed', 1),
          );
          cur.lbls.push(
            label.new(lx, ep, `▶ [${txt}] Entry  ${fmt(ep)}`, 'bar_index', 'price', String(color.new(cfg.col_entry, 70)), 'label_left', cfg.col_entry, lblSize),
            label.new(lx, res.stopPrice, `▶ [${txt}] Stop   ${fmt(res.stopPrice)}`, 'bar_index', 'price', String(color.new(cfg.col_stop, 70)), 'label_left', cfg.col_stop, lblSize),
            label.new(lx, res.targetPrice, `▶ [${txt}] Target ${fmt(res.targetPrice)}   R:R ${rrStr}`, 'bar_index', 'price', String(color.new(cfg.col_target, 70)), 'label_left', cfg.col_target, lblSize),
          );
        }
      }

      patHistory.push(cur);
      // f_manage_drawings(max_patterns)
      while (patHistory.length > cfg.max_patterns) {
        const old = patHistory.shift()!;
        for (const l of old.lns) line.delete(l);
        for (const l of old.lbls) label.delete(l);
      }
    }

    // ── DASHBOARD ── (the cells of the last bar are the ones shown)
    if (dashCells) {
      const hdrBg = String(color.rgb(30, 30, 45, 10));
      const altBg = String(color.rgb(20, 20, 25, 10));
      dashCells.forEach(([left, right, rightCol], row) => {
        const bg = row === 0 ? hdrBg : row % 2 === 1 ? altBg : cfg.dash_bg_color;
        table.cell(dash, 0, row, left, undefined, undefined, cfg.dash_txt_color, 'left', undefined, 'small', bg, undefined, 'monospace');
        table.cell(dash, 1, row, right, undefined, undefined, rightCol, 'right', undefined, 'small', bg, undefined, 'monospace');
      });
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, n > 0 && bars[0].time >= 1e12 ? 'ms' : 's'),
    alertCalls,
  };
}

export const AutoPatternDetectorTargets = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, hasAlertFunction,
};
