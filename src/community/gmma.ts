/**
 * GMMA - Guppy Multiple Moving Average
 *
 * Two groups of EMAs as the original: 'Trader EMA 1..6' (lengths 3, 5, 8, 10, 12, 15, aqua) and 'Investor EMA 1..6'
 * (lengths 30, 35, 40, 45, 50, 60, red), transparency 15, 12, 9, 6, 3, 0 from the first to the sixth of each group.
 * Each EMA is drawn from its first value (ta.ema, seeded with the SMA of its first `length` values); no cloud fills.
 * Alert arrows (the original's plotarrow outputs, `arrows` of the result), from the Super Guppy rules of the original:
 * the average of 11 fast EMAs (3..23) against the average of 16 slow EMAs (25..70), with the fast / slow ribbons in
 * order: a swing arrow when the fast ribbon turns ordered with the trend, a break arrow when the averages cross, each
 * only after more than "Alert Lookback Length" bars since the last one. "Use alternate Anchor TimeFrame" multiplies
 * the lengths of these Super Guppy EMAs (and of the 200 EMA filter) as the original: on intraday charts by
 * round(anchor / chart minutes) when the anchor (minutes, up to 1440) is above the chart interval, on daily / weekly /
 * monthly charts by round(anchor / chart multiplier) when the anchor is at most 52 and above it; 1 otherwise (0 = none).
 * The chart timeframe is `chart.timeframe` of the optional third argument, else the bar spacing.
 *
 * Reference: "Guppy Multiple Moving Average" by Daryl Guppy
 */

import { taStep, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ArrowData } from 'oakscriptjs';
import { chartTimeframe } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GMMAInputs {
  src: SourceType;
  /** Use alternate Anchor TimeFrame (0 = none): minutes on intraday charts, D / W / M units above */
  anchor: number;
  /** Show Trend Break Arrow Alerts */
  showBreak: boolean;
  /** Show Swing Arrow Alerts */
  showSwing: boolean;
  /** Give Only Fast+Slow Confluence Alerts */
  showCon: boolean;
  /** Add Bar Colour Changes to Swing Alerts */
  uOccSwing: boolean;
  /** Alert Lookback Length */
  lookback: number;
  /** Filter Alerts with 200ema */
  emaFilter: boolean;
  /** Trader EMA 1..6 length */
  t1: number; t2: number; t3: number; t4: number; t5: number; t6: number;
  /** Investor EMA 1..6 length */
  i1: number; i2: number; i3: number; i4: number; i5: number; i6: number;
}

export const defaultInputs: GMMAInputs = {
  src: 'close',
  anchor: 0,
  showBreak: true,
  showSwing: true,
  showCon: false,
  uOccSwing: false,
  lookback: 6,
  emaFilter: false,
  t1: 3, t2: 5, t3: 8, t4: 10, t5: 12, t6: 15,
  i1: 30, i2: 35, i3: 40, i4: 45, i5: 50, i6: 60,
};

const TRADER_KEYS = ['t1', 't2', 't3', 't4', 't5', 't6'] as const;
const INVESTOR_KEYS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'] as const;

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'anchor', type: 'int', title: 'Use alternate Anchor TimeFrame (0=none, max=1440 (mins,D,W)', defval: 0, min: 0, max: 1440 },
  { id: 'showBreak', type: 'bool', title: 'Show Trend Break Arrow Alerts', defval: true },
  { id: 'showSwing', type: 'bool', title: 'Show Swing Arrow Alerts', defval: true },
  { id: 'showCon', type: 'bool', title: 'Give Only Fast+Slow Confluence Alerts', defval: false },
  { id: 'uOccSwing', type: 'bool', title: 'Add Bar Colour Changes to Swing Alerts', defval: false },
  { id: 'lookback', type: 'int', title: 'Alert Lookback Length', defval: 6 },
  { id: 'emaFilter', type: 'bool', title: 'Filter Alerts with 200ema', defval: false },
  ...TRADER_KEYS.map((id, k): InputConfig => ({
    id, type: 'int', title: `Trader EMA ${k + 1} length`, defval: defaultInputs[id], min: 1,
  })),
  ...INVESTOR_KEYS.map((id, k): InputConfig => ({
    id, type: 'int', title: `Investor EMA ${k + 1} length`, defval: defaultInputs[id], min: 1,
  })),
];

/** Colour constants of Pine version 3 (the original's version) */
const LIME = '#00FF00';
const RED = '#FF0000';
const AQUA = '#00FFFF';
const BLUE = '#0000FF';
/** transp1..transp6 of the original */
const TRANSP = [15, 12, 9, 6, 3, 0];

export const plotConfig: PlotConfig[] = [
  ...TRANSP.map((tr, k): PlotConfig => ({ id: `plot${k}`, title: `Trader EMA ${k + 1}`, color: String(color.new(AQUA, tr)), lineWidth: 1 })),
  ...TRANSP.map((tr, k): PlotConfig => ({ id: `plot${k + 6}`, title: `Investor EMA ${k + 1}`, color: String(color.new(RED, tr)), lineWidth: 1 })),
];

export const metadata = {
  title: 'Guppy Multiple Moving Average',
  shortTitle: 'GMMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * The original's multiplier of the Super Guppy lengths:
 * mult = isintraday ? (anchor == 0 or interval <= 0 or interval >= anchor or anchor > 1440) ? 1
 *   : round(anchor / interval) > 1 ? round(anchor / interval) : 1 : 1
 * mult := not isintraday ? (anchor == 0 or interval <= 0 or interval >= anchor or anchor > 52) ? mult
 *   : round(anchor / interval) > 1 ? round(anchor / interval) : 1 : mult
 */
function anchorMultiplier(anchor: number, tf: string): number {
  if (tf === '') return 1;
  const info = timeframe.info(tf);
  const interval = info.multiplier;
  const r = Math.round(anchor / interval);
  if (info.isintraday) {
    return anchor === 0 || interval <= 0 || interval >= anchor || anchor > 1440 ? 1 : r > 1 ? r : 1;
  }
  return anchor === 0 || interval <= 0 || interval >= anchor || anchor > 52 ? 1 : r > 1 ? r : 1;
}

type Result = IndicatorResult & { arrows: ArrowData[] };

interface GmmaVars {
  /** buy / sell / buybreak / sellbreak of the bar before */
  buy: number;
  sell: number;
  buyBreak: number;
  sellBreak: number;
  /** barssince(nz(x[1], 1) == 1) of buy, sell, buybreak, sellbreak */
  sinceBuy: number;
  sinceSell: number;
  sinceBuyBreak: number;
  sinceSellBreak: number;
}

interface GmmaRun extends BarRunState<GmmaVars> {
  /** One ta.ema machine per distinct length (equal lengths give the same values), and their values of the bar */
  emas: ReturnType<typeof taStep.ema>[];
  values: Float64Array;
  /** The machine of each plot, fast and slow Super Guppy EMA, and of the 200 EMA */
  plotE: number[];
  fastE: number[];
  slowE: number[];
  ema200: number;
  plots: Array<Array<{ time: number; value: number }>>;
  arrows: ArrowData[];
}

function study(inputs: Partial<GMMAInputs>): BarStudy<GmmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const { showBreak, showSwing, showCon, uOccSwing, lookback, emaFilter } = cfg;
  const lengths = [...TRADER_KEYS, ...INVESTOR_KEYS].map((k) => cfg[k]);
  const arrowColor = (c: string) => String(color.new(c, 20));
  const lime = arrowColor(LIME);
  const red = arrowColor(RED);
  const aqua = arrowColor(AQUA);
  const blue = arrowColor(BLUE);
  // barssince(nz(x[1], 1) == 1): bars since the last bar on which the previous value was 1 (na before the first)
  const sinceStep = (since: number, prev: number) => ((isNaN(prev) ? 1 : prev) === 1 ? 0 : since + 1);
  const nzPos = (v: number) => (isNaN(v) ? 0 : v) > 0;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    // the chart timeframe (from the bar spacing without chart.timeframe) gives the Super Guppy length multiplier
    key: (bars, chart) => (cfg.anchor === 0 ? '' : chartTimeframe(bars, chart)),
    init(bars, chart) {
      const mult = anchorMultiplier(cfg.anchor, cfg.anchor === 0 ? '' : chartTimeframe(bars, chart));
      const byLength = new Map<number, number>();
      const emas: ReturnType<typeof taStep.ema>[] = [];
      const ema = (len: number) => {
        let k = byLength.get(len);
        if (k === undefined) {
          k = emas.length;
          emas.push(taStep.ema(len));
          byLength.set(len, k);
        }
        return k;
      };
      // TEMA1..6 = ema(src, T1..T6), IEMA1..6 = ema(src, I1..I6)
      const plotE = lengths.map(ema);
      // Super Guppy alert arrows: emaF<k> = ema(src, lenF<k> * mult), emaS<k> = ema(src, lenS<k> * mult),
      // ema200 = ema(src, len * mult)
      const fastE = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23].map((l) => ema(l * mult));
      const slowE = [25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70].map((l) => ema(l * mult));
      const ema200 = ema(200 * mult);
      const s: GmmaRun = {
        emas, values: new Float64Array(emas.length), plotE, fastE, slowE, ema200,
        plots: lengths.map(() => []), arrows: [],
        steps: emas,
        vars: {
          buy: NaN, sell: NaN, buyBreak: NaN, sellBreak: NaN,
          sinceBuy: NaN, sinceSell: NaN, sinceBuyBreak: NaN, sinceSellBreak: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.arrows];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const t = bar.time;
      const x = value(bar);
      // the machine of one length is stepped once per bar (the same value for every call)
      const ev = s.values;
      for (let k = 0; k < s.emas.length; k++) ev[k] = s.emas[k].step(x);
      // plotted as they are (na until each EMA has a value)
      for (let k = 0; k < s.plotE.length; k++) s.plots[k][i] = { time: t, value: ev[s.plotE[k]] };

      let sumF = 0;
      let colfastL = true;
      let colfastS = true;
      for (let k = 0; k < s.fastE.length; k++) {
        const e = ev[s.fastE[k]];
        sumF = sumF + e;
        if (k > 0) {
          const prev = ev[s.fastE[k - 1]];
          colfastL = colfastL && gt(prev, e);
          colfastS = colfastS && lt(prev, e);
        }
      }
      let sumS = 0;
      let colslowL = true;
      let colslowS = true;
      for (let k = 0; k < s.slowE.length; k++) {
        const e = ev[s.slowE[k]];
        sumS = sumS + e;
        if (k > 0) {
          const prev = ev[s.slowE[k - 1]];
          colslowL = colslowL && gt(prev, e);
          colslowS = colslowS && lt(prev, e);
        }
      }
      const emafast = sumF / 11;
      const emaslow = sumS / 16;
      const ema200 = ev[s.ema200];

      const v = s.vars;
      let b = gt(emafast, emaslow) && !colslowS && colfastL && (!showCon || colslowL) && (!emaFilter || gt(emafast, ema200))
        ? (nzPos(v.buy) ? v.buy + 1 : 1) : 0;
      let sl = lt(emafast, emaslow) && !colslowL && colfastS && (!showCon || colslowS) && (!emaFilter || lt(emafast, ema200))
        ? (nzPos(v.sell) ? v.sell + 1 : 1) : 0;
      const c1 = i > 0 ? bars[i - 1].close : NaN, o1 = i > 0 ? bars[i - 1].open : NaN;
      if (b > 1 && colfastL && uOccSwing && lt(c1, o1) && gt(bar.close, bar.open)) b = 1;
      if (sl > 1 && colfastS && uOccSwing && gt(c1, o1) && lt(bar.close, bar.open)) sl = 1;
      const bb = gt(emafast, emaslow) && !colslowS && (!emaFilter || gt(emafast, ema200))
        ? (nzPos(v.buyBreak) ? v.buyBreak + 1 : 1) : 0;
      const sb = lt(emafast, emaslow) && !colslowL && (!emaFilter || lt(emafast, ema200))
        ? (nzPos(v.sellBreak) ? v.sellBreak + 1 : 1) : 0;
      v.sinceBuy = sinceStep(v.sinceBuy, v.buy);
      v.sinceSell = sinceStep(v.sinceSell, v.sell);
      v.sinceBuyBreak = sinceStep(v.sinceBuyBreak, v.buyBreak);
      v.sinceSellBreak = sinceStep(v.sinceSellBreak, v.sellBreak);
      v.buy = b;
      v.sell = sl;
      v.buyBreak = bb;
      v.sellBreak = sb;
      // plotarrow(ShowSwing and buy == 1 and barssince(nz(buy[1], 1) == 1) > Lookback ? 1 : na, "BUY Swing Arrow", colorup = lime)
      if (showSwing && b === 1 && v.sinceBuy > lookback) s.arrows.push({ time: t, id: 'arrow0', value: 1, color: lime });
      // plotarrow(... sell == 1 ... ? -1 : na, "SELL Swing Arrow", colordown = red)
      if (showSwing && sl === 1 && v.sinceSell > lookback) s.arrows.push({ time: t, id: 'arrow1', value: -1, color: red });
      // plotarrow(ShowBreak and buybreak == 1 and barssince(sellbreak) > Lookback and barssince(buybreak) > Lookback ? 1 : na)
      if (showBreak && bb === 1 && v.sinceSellBreak > lookback && v.sinceBuyBreak > lookback) {
        s.arrows.push({ time: t, id: 'arrow2', value: 1, color: aqua });
      }
      if (showBreak && sb === 1 && v.sinceBuyBreak > lookback && v.sinceSellBreak > lookback) {
        s.arrows.push({ time: t, id: 'arrow3', value: -1, color: blue });
      }
    },
    result(s) {
      const plots: Record<string, Array<{ time: number; value: number }>> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GMMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GMMAInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { arrows: ArrowData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const GMMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
