/**
 * Smart Money Volume Index [AlgoAlpha]
 *
 * The negative volume index ("smart" money) and the positive volume index ("dumb" money), each minus its 255-bar
 * EMA, give two RSI values. The ratio smart RSI / dumb RSI is the buy interest, the ratio of their distances to 100
 * the sell interest. Each ratio is summed over the index period and divided by the highest of the two sums over
 * the normalisation period. "Net" mode draws buy minus sell as layered columns, "Compare" mode draws both as
 * lines with a gradient fill. Price candles on the main pane take the colour of the interest.
 * Alerts (alertcondition, `alerts` of the result): buy / sell signal (buy and sell interest in "Compare" mode, net
 * index and its opposite in "Net" mode) crossing the high interest threshold and zero, and the buy line crossing 0.7.
 *
 * Chart values (third argument): the port reads the chart foreground and background colours (fills, candles, price
 * line; without them: #DBDBDB and #0F0F0F, a dark chart). `plotConfig` has the price line colour of the dark chart.
 *
 * Reference: "Smart Money Volume Index [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { foregroundColorOf, backgroundColorOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface SmartMoneyVolumeIndexInputs {
  /** "Compare": buy and sell interest as two lines; "Net": one oscillator */
  mode: 'Compare' | 'Net';
  /** Bars of the sum of the interest ratios */
  indexPeriod: number;
  /** RSI period of the volume flows */
  volumeFlowPeriod: number;
  /** Bars of the highest sum that normalises the index */
  normalizationPeriod: number;
  /** Level from which the interest is "high" */
  highInterestThreshold: number;
  upColor: string;
  secondaryUpColor: string;
  downColor: string;
  secondaryDownColor: string;
}

export const defaultInputs: SmartMoneyVolumeIndexInputs = {
  mode: 'Net',
  indexPeriod: 25,
  volumeFlowPeriod: 14,
  normalizationPeriod: 500,
  highInterestThreshold: 0.9,
  upColor: '#00ffbb',
  secondaryUpColor: '#008461',
  downColor: '#ff1100',
  secondaryDownColor: '#840900',
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Display Mode', defval: 'Net', options: ['Compare', 'Net'], group: 'Settings' },
  { id: 'indexPeriod', type: 'int', title: 'Index Period', defval: 25, min: 1, group: 'Settings' },
  { id: 'volumeFlowPeriod', type: 'int', title: 'Volume Flow Period', defval: 14, min: 1, group: 'Settings' },
  { id: 'normalizationPeriod', type: 'int', title: 'Normalization Period', defval: 500, min: 1, group: 'Settings' },
  { id: 'highInterestThreshold', type: 'float', title: 'High Interest Threshold', defval: 0.9, min: 0.01, max: 0.99, step: 0.05, group: 'Settings' },
  { id: 'upColor', type: 'color', title: 'Up Color', defval: '#00ffbb', group: 'Colors' },
  { id: 'secondaryUpColor', type: 'color', title: 'Secondary Up Color', defval: '#008461', group: 'Colors' },
  { id: 'downColor', type: 'color', title: 'Down Color', defval: '#ff1100', group: 'Colors' },
  { id: 'secondaryDownColor', type: 'color', title: 'Secondary Down Color', defval: '#840900', group: 'Colors' },
];

/** Transparency of the net columns: transp + 60, 55, 45, 30, 25 with transp = 20 */
const LAYERS: [factor: number, transparency: number][] = [[1, 80], [0.8, 75], [0.6, 65], [0.4, 50], [0.2, 45]];
const LAYER_NAMES = ['100', '80', '60', '40', '20'];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Top Limit', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Bottom Limit', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'High Buy Threshold', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'High Sell Threshold', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Buy Interest', color: '#00ffbb', lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Sell Interest', color: '#ff1100', lineWidth: 1, style: 'linebr' },
  ...LAYERS.map(([, t], k): PlotConfig => ({
    id: `plot${7 + k}`, title: `Net Buy ${LAYER_NAMES[k]}`, color: String(color.new('#008461', t)), lineWidth: 4, style: 'columns',
  })),
  { id: 'plot12', title: 'Net Buy Line', color: String(color.new('#00ffbb', 20)), lineWidth: 1, style: 'linebr' },
  ...LAYERS.map(([, t], k): PlotConfig => ({
    id: `plot${13 + k}`, title: `Net Sell ${LAYER_NAMES[k]}`, color: String(color.new('#840900', t)), lineWidth: 4, style: 'columns',
  })),
  { id: 'plot18', title: 'Net Sell Line', color: String(color.new('#ff1100', 20)), lineWidth: 1, style: 'linebr' },
  { id: 'plot19', title: 'Price Tracking line', color: String(color.new('#DBDBDB', 85)), lineWidth: 1, forceOverlay: true },
];

export const metadata = {
  title: 'Smart Money Volume Index [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Smart Money',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface SmviVars {
  /** ta.pvi / ta.nvi of the previous bar */
  pvi: number;
  nvi: number;
}

interface SmviRun extends BarRunState<SmviVars> {
  pviEma: ReturnType<typeof taStep.ema>;
  nviEma: ReturnType<typeof taStep.ema>;
  drsiStep: ReturnType<typeof taStep.rsi>;
  srsiStep: ReturnType<typeof taStep.rsi>;
  sumBuy: ReturnType<typeof taStep.sum>;
  sumSell: ReturnType<typeof taStep.sum>;
  peakStep: WindowHighest;
  /** plot0 .. plot19 */
  plots: Point[][];
  buyTop: number[];
  sellTop: number[];
  topActive: boolean[];
  botActive: boolean[];
  candles: PlotCandleData[];
  sigBuy: number[];
  sigSell: number[];
  flags: boolean[][];
  times: number[][];
}

/** taCore volumeIndex: nz(index[1], 0) == 0 ? 1 : index[1], moved by the close change on the bars `use` selects */
function volumeIndex(prevIndex: number, c: number, prevC: number, v: number, prevV: number, up: boolean): number {
  const prev = !prevIndex ? 1 : prevIndex;
  let value = prev;
  if (c && prevC) {
    if (up ? v > prevV : v < prevV) value = prev + ((c - prevC) / prevC) * prev;
  }
  return value;
}

/**
 * `ta.highest(source, length)` with a constant length in O(1) per bar: the same doubles as taStep.highest (the
 * highest of the last `length` finite values, also on a bar whose own value is na; na before bar `length - 1`; +0
 * wins over -0), from a deque of the committed values that may still be the highest.
 */
class WindowHighest implements Committable {
  private readonly len: number;
  private values: number[] = [];
  /** Indices into `values`, their values decreasing (a -0 after a +0 is kept) */
  private deque: number[] = [];
  private head = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    // the length checks of ta.highest (the same errors)
    taStep.highest().step(NaN, length);
    this.len = Math.trunc(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const count = this.values.length;
    if (this.bars < this.len - 1 || count + (own ? 1 : 0) === 0) return NaN;
    // the committed values of the window: the last len - 1 with the own value, else the last len
    const first = count - (own ? this.len - 1 : this.len);
    let h = this.head;
    if (h < this.deque.length && this.deque[h] < first) h++;
    if (h >= this.deque.length) return value;
    const best = this.values[this.deque[h]];
    return own ? Math.max(value, best) : best;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const d = this.deque;
    // drop the values v replaces as the highest (equal ones too, but a +0 is not replaced by a -0)
    while (d.length > this.head) {
      const last = this.values[d[d.length - 1]];
      if (last < v || (last === v && !(Object.is(v, -0) && Object.is(last, 0)))) d.pop();
      else break;
    }
    d.push(this.values.length);
    this.values.push(v);
    const first = this.values.length - this.len;
    while (this.head < d.length && d[this.head] < first) this.head++;
    if (this.head > 1024 && this.head * 2 > d.length) {
      // keep the arrays short: indices from the oldest value still in the deque
      const base = d[this.head];
      this.values = this.values.slice(base);
      this.deque = d.slice(this.head).map((k) => k - base);
      this.head = 0;
    }
  }
}

function study(inputs: Partial<SmartMoneyVolumeIndexInputs>): BarStudy<SmviRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const compare = cfg.mode === 'Compare';
  const net = cfg.mode === 'Net';
  const thr = cfg.highInterestThreshold;
  const num = (v: number) => (Number.isFinite(v) ? v : NaN);
  const upLayer = LAYERS.map(([, transparency]) => String(color.new(cfg.secondaryUpColor, transparency)));
  const downLayer = LAYERS.map(([, transparency]) => String(color.new(cfg.secondaryDownColor, transparency)));
  const upLine = String(color.new(cfg.upColor, 20));
  const downLine = String(color.new(cfg.downColor, 20));
  let CHART_FG = '';
  let CHART_BG = '';
  let priceColor = '';
  return {
    init(_bars, chart) {
      // chart.fg_color / chart.bg_color
      CHART_FG = foregroundColorOf(chart);
      CHART_BG = backgroundColorOf(chart);
      priceColor = String(color.new(CHART_FG, 85));
      const s: SmviRun = {
        pviEma: taStep.ema(255), nviEma: taStep.ema(255), drsiStep: taStep.rsi(cfg.volumeFlowPeriod),
        srsiStep: taStep.rsi(cfg.volumeFlowPeriod), sumBuy: taStep.sum(), sumSell: taStep.sum(), peakStep: new WindowHighest(cfg.normalizationPeriod),
        plots: Array.from({ length: 20 }, () => []), buyTop: [], sellTop: [], topActive: [], botActive: [], candles: [],
        sigBuy: [], sigSell: [], flags: Array.from({ length: 10 }, () => []), times: Array.from({ length: 10 }, () => []),
        steps: [], vars: { pvi: NaN, nvi: NaN }, lists: [], series: [],
      };
      s.steps = [s.pviEma, s.nviEma, s.drsiStep, s.srsiStep, s.sumBuy, s.sumSell, s.peakStep];
      s.lists = s.times;
      s.series = [...s.plots, s.buyTop, s.sellTop, s.topActive, s.botActive, s.candles, s.sigBuy, s.sigSell, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time as number;

      // dumb = ta.pvi - ta.ema(ta.pvi, 255); smart = ta.nvi - ta.ema(ta.nvi, 255)
      const prevC = i === 0 ? NaN : bars[i - 1].close;
      const vol = b.volume ?? NaN;
      const pv = i === 0 ? NaN : bars[i - 1].volume ?? NaN;
      const prevV = i === 0 || Number.isNaN(pv) ? 0 : pv;
      v.pvi = volumeIndex(v.pvi, b.close, prevC, vol, prevV, true);
      v.nvi = volumeIndex(v.nvi, b.close, prevC, vol, prevV, false);
      const drsi = s.drsiStep.step(v.pvi - s.pviEma.step(v.pvi));
      const srsi = s.srsiStep.step(v.nvi - s.nviEma.step(v.nvi));

      // r_buy = srsi / drsi; r_sell = (100 - srsi) / (100 - drsi)
      const sumsBuy = s.sumBuy.step(srsi / drsi, cfg.indexPeriod);
      const sumsSell = s.sumSell.step((100 - srsi) / (100 - drsi), cfg.indexPeriod);
      // peak = ta.highest(math.max(sums_buy, sums_sell), peakslen)
      const peak = s.peakStep.step(isNaN(sumsBuy) || isNaN(sumsSell) ? NaN : Math.max(sumsBuy, sumsSell));
      const indexBuy = sumsBuy / peak;
      const indexSell = sumsSell / peak;
      const netIndex = indexBuy - indexSell;

      // plot_buy = mode == "Compare" ? index_buy : na; plot_sell = mode == "Compare" ? -index_sell : na
      const plotBuy = compare ? indexBuy : NaN;
      const plotSell = compare ? -indexSell : NaN;
      // n_up = mode == "Net" and net_index > 0 ? net_index : na; n_dn = mode == "Net" and net_index < 0 ? net_index : na
      const nUp = net && gt(netIndex, 0) ? netIndex : NaN;
      const nDn = net && lt(netIndex, 0) ? netIndex : NaN;

      const p = s.plots;
      p[0][i] = { time, value: 0 };
      p[1][i] = { time, value: 1 };
      p[2][i] = { time, value: -1 };
      p[3][i] = { time, value: thr };
      p[4][i] = { time, value: -thr };
      p[5][i] = { time, value: num(plotBuy), color: cfg.upColor };
      p[6][i] = { time, value: num(plotSell), color: cfg.downColor };
      for (let k = 0; k < LAYERS.length; k++) {
        const factor = LAYERS[k][0];
        p[7 + k][i] = { time, value: num(nUp * factor), color: upLayer[k] };
        p[13 + k][i] = { time, value: num(nDn * factor), color: downLayer[k] };
      }
      p[12][i] = { time, value: num(nUp), color: upLine };
      p[18][i] = { time, value: num(nDn), color: downLine };
      // plot(close, "Price Tracking line", color = color.new(chart.fg_color, 85), force_overlay = true)
      p[19][i] = { time, value: num(b.close), color: priceColor };

      // v_up = mode == "Compare" ? index_buy : net_index; v_dn = mode == "Compare" ? -index_sell : net_index
      s.topActive[i] = gt(compare ? indexBuy : netIndex, 0.7);
      s.botActive[i] = lt(compare ? -indexSell : netIndex, -0.7);
      s.buyTop[i] = num(plotBuy);
      s.sellTop[i] = num(plotSell);

      // plotcandle(open, high, low, close, color = candle_color, wickcolor = candle_color, bordercolor = candle_color,
      //   force_overlay = true)
      let candleColor: string | null;
      if (net) {
        // net_color = net_index > 0 ? from_gradient(abs_net, 0, 1, bg, green) : from_gradient(abs_net, 0, 1, bg, red)
        const absNet = Math.abs(netIndex);
        candleColor = isNaN(absNet) ? null
          : String(color.from_gradient(absNet, 0, 1, CHART_BG, gt(netIndex, 0) ? cfg.upColor : cfg.downColor));
      } else {
        // comp_color = sig_buy > thr ? green : sig_sell > thr ? red : na
        candleColor = gt(indexBuy, thr) ? cfg.upColor : gt(indexSell, thr) ? cfg.downColor : null;
      }
      const c = candleColor ?? 'transparent';
      s.candles[i] = {
        time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: c, wickColor: c, borderColor: c, forceOverlay: true,
      };

      // Alerts: sig_buy = Compare ? index_buy : net_index; sig_sell = Compare ? index_sell : -net_index;
      // v_up = Compare ? index_buy : net_index; ta.crossover / ta.crossunder compare exactly (na compares false)
      const sb = num(compare ? indexBuy : netIndex);
      const ss = num(compare ? indexSell : -netIndex);
      s.sigBuy[i] = sb;
      s.sigSell[i] = ss;
      const pb = i > 0 ? s.sigBuy[i - 1] : NaN;
      const ps = i > 0 ? s.sigSell[i - 1] : NaN;
      const f = s.flags;
      f[0][i] = sb > thr && pb <= thr;
      f[1][i] = ss > thr && ps <= thr;
      f[2][i] = sb < thr && pb >= thr;
      f[3][i] = ss < thr && ps >= thr;
      f[4][i] = sb > 0 && pb <= 0;
      f[5][i] = sb < 0 && pb >= 0;
      f[6][i] = ss > 0 && ps <= 0;
      f[7][i] = ss < 0 && ps >= 0;
      f[8][i] = sb > 0.7 && pb <= 0.7;
      f[9][i] = sb < 0.7 && pb >= 0.7;
      for (let k = 0; k < 10; k++) if (f[k][i]) s.times[k].push(time);
    },
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T): T[] => new Array<T>(n).fill(v);
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const fg = (transparency: number) => String(color.new(CHART_FG, transparency));
      const fg30 = fg(30);
      const fg45 = fg(45);
      const fg60 = fg(60);
      const fg90 = fg(90);
      const fills = [
        // fill(thresh_up, top, 1, thr, top_active ? fg 45 : fg 90, top_active ? fg 30 : fg 60)
        {
          plot1: 'plot3', plot2: 'plot1',
          gradient: {
            topValue: constant(1), bottomValue: constant(thr),
            topColor: s.topActive.map((on) => (on ? fg45 : fg90)), bottomColor: s.topActive.map((on) => (on ? fg30 : fg60)),
          },
        },
        // fill(thresh_down, low_, -thr, -1, bot_active ? fg 30 : fg 60, bot_active ? fg 45 : fg 90)
        {
          plot1: 'plot4', plot2: 'plot2',
          gradient: {
            topValue: constant(-thr), bottomValue: constant(-1),
            topColor: s.botActive.map((on) => (on ? fg30 : fg60)), bottomColor: s.botActive.map((on) => (on ? fg45 : fg90)),
          },
        },
        // fill(bottom, i_buy, plot_buy, 0, green, chart.bg_color)
        {
          plot1: 'plot0', plot2: 'plot5',
          gradient: { topValue: s.buyTop.slice(), bottomValue: constant(0), topColor: constant(cfg.upColor), bottomColor: constant(CHART_BG) },
        },
        // fill(bottom, i_sell, plot_sell, 0, red, chart.bg_color)
        {
          plot1: 'plot0', plot2: 'plot6',
          gradient: { topValue: s.sellTop.slice(), bottomValue: constant(0), topColor: constant(cfg.downColor), bottomColor: constant(CHART_BG) },
        },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        plotCandles: { smartMoneyCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmartMoneyVolumeIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmartMoneyVolumeIndexInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions (no message: the default "Alert Fired!") */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'High Smart Money Buy Interest', message: 'Alert Fired!' },
  { id: 'alert1', title: 'High Smart Money Sell Interest', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Smart Money Buy Interest no longer high', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Smart Money Sell Interest no longer high', message: 'Alert Fired!' },
  { id: 'alert4', title: 'Smart Money Buy Interest turned positive', message: 'Alert Fired!' },
  { id: 'alert5', title: 'Smart Money Buy Interest turned negative', message: 'Alert Fired!' },
  { id: 'alert6', title: 'Smart Money Sell Interest turned positive', message: 'Alert Fired!' },
  { id: 'alert7', title: 'Smart Money Sell Interest turned negative', message: 'Alert Fired!' },
  { id: 'alert8', title: 'Smart Money Buy Interest entered high zone', message: 'Alert Fired!' },
  { id: 'alert9', title: 'Smart Money Buy Interest exited high zone', message: 'Alert Fired!' },
];

export const SmartMoneyVolumeIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
