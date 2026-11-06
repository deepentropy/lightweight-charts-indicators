/**
 * Multi-Band Trend Line
 *
 * Bands of one type: Bollinger Bands, Keltner Channels, Donchian Channels (highest high / lowest low of the previous
 * `period` bars), moving average envelopes (SMA +/- percent) or ATR bands (SMA +/- ATR(period) * multiplier).
 * A close above the upper band raises the trend line to max(low - ATR, previous line), a close below the lower
 * band lowers it to min(high + ATR, previous line) (without the ATR filter: low / high); otherwise the line stays.
 * The previous line is 0 while it is na, as in the Pine nz(). The trend is up when the line rises and down when it
 * falls; the line is green in an up trend, red otherwise. BUY / SELL labels on trend changes and a light green /
 * red background by trend.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' / 'Sell Alert', true on the bars of the BUY / SELL
 * labels.
 *
 * Reference: "Multi-Band Trend Line" by Mr_Rakun
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Mr_Rakun
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';

export interface MultiBandTrendLineInputs {
  bandType: 'Bollinger Bands' | 'Keltner Channels' | 'Donchian Channels' | 'Moving Average Envelopes' | 'ATR Bands';
  /** Band period */
  period: number;
  /** Band source */
  source: SourceType;
  /** Move the trend line by the ATR beyond the low / high */
  useAtrFilter: boolean;
  /** ATR period of the filter */
  atrPeriod: number;
  /** Bollinger Bands standard deviation multiplier */
  bbStd: number;
  /** Keltner Channels ATR multiplier */
  kcMultiplier: number;
  /** Moving average envelope percent */
  maPercentage: number;
  /** ATR bands multiplier */
  atrMultiplier: number;
}

export const defaultInputs: MultiBandTrendLineInputs = {
  bandType: 'Bollinger Bands',
  period: 20,
  source: 'close',
  useAtrFilter: true,
  atrPeriod: 14,
  bbStd: 2.0,
  kcMultiplier: 2.0,
  maPercentage: 2.0,
  atrMultiplier: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'bandType', type: 'string', title: 'Band Type', defval: 'Bollinger Bands', options: ['Bollinger Bands', 'Keltner Channels', 'Donchian Channels', 'Moving Average Envelopes', 'ATR Bands'] },
  { id: 'period', type: 'int', title: 'Period', defval: 20, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'useAtrFilter', type: 'bool', title: 'Use ATR Filter', defval: true },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 14, min: 1 },
  { id: 'bbStd', type: 'float', title: 'BB Standard Deviation', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'kcMultiplier', type: 'float', title: 'KC ATR Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'maPercentage', type: 'float', title: 'MA Envelope %', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

const BAND_COL = String(color.new(color.gray, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Trend Line', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Multi-Band Trend Line',
  shortTitle: 'Multi-Band Trend Line',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine nz(x) */
const nz = (x: number) => (isNaN(x) ? 0 : x);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface MbtlVars {
  /** var float trendLine = na; var int trend = 0 */
  tl: number;
  trend: number;
  /** dc_upper[1], dc_lower[1] */
  prevHi: number;
  prevLo: number;
}

interface MbtlRun extends BarRunState<MbtlVars> {
  atr: ReturnType<typeof taStep.atr>;
  ema: ReturnType<typeof taStep.ema> | null;
  tr: ReturnType<typeof taStep.tr> | null;
  rangeEma: ReturnType<typeof taStep.ema> | null;
  hi: WindowExtreme | null;
  lo: WindowExtreme | null;
  sma: WindowSma | null;
  dev: WindowStdev | null;
  bandAtr: ReturnType<typeof taStep.atr> | null;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MultiBandTrendLineInputs>): BarStudy<MbtlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const type = cfg.bandType;
  const kc = type === 'Keltner Channels';
  const dc = type === 'Donchian Channels';
  const env = type === 'Moving Average Envelopes';
  const atrBands = type === 'ATR Bands';
  const bb = !kc && !dc && !env && !atrBands;
  const buyCol = String(color.new(color.green, 60));
  const sellCol = String(color.new(color.red, 60));
  const bgUp = String(color.new(color.green, 95));
  const bgDn = String(color.new(color.red, 95));
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: MbtlRun = {
        atr: taStep.atr(cfg.atrPeriod),
        ema: kc ? taStep.ema(cfg.period) : null,
        tr: kc ? taStep.tr(false) : null,
        rangeEma: kc ? taStep.ema(cfg.period) : null,
        hi: dc ? new WindowExtreme(false, cfg.period) : null,
        lo: dc ? new WindowExtreme(true, cfg.period) : null,
        sma: env || atrBands || bb ? new WindowSma(cfg.period) : null,
        dev: bb ? new WindowStdev(cfg.period) : null,
        bandAtr: atrBands ? taStep.atr(cfg.period) : null,
        plot0: [], plot1: [], plot2: [], markers: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { tl: NaN, trend: 0, prevHi: NaN, prevLo: NaN }, lists: [], series: [],
      };
      for (const m of [s.atr, s.ema, s.tr, s.rangeEma, s.hi, s.lo, s.sma, s.dev, s.bandAtr]) if (m) s.steps.push(m);
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      const atrValue = s.atr.step(b.high, b.low, b.close);

      let upper: number;
      let lower: number;
      if (kc) {
        // ta.kc(src, period, mult): ema(src) +- ema(ta.tr) * mult
        const middle = s.ema!.step(src);
        const rangeEma = s.rangeEma!.step(s.tr!.step(b.high, b.low, b.close));
        upper = middle + rangeEma * cfg.kcMultiplier;
        lower = middle - rangeEma * cfg.kcMultiplier;
      } else if (dc) {
        // [dc_upper[1], dc_lower[1]]
        upper = i > 0 ? v.prevHi : NaN;
        lower = i > 0 ? v.prevLo : NaN;
        v.prevHi = s.hi!.step(b.high);
        v.prevLo = s.lo!.step(b.low);
      } else if (env) {
        const m = s.sma!.step(src);
        upper = m + (m * cfg.maPercentage) / 100;
        lower = m - (m * cfg.maPercentage) / 100;
      } else if (atrBands) {
        const m = s.sma!.step(src);
        const atr = s.bandAtr!.step(b.high, b.low, b.close);
        upper = m + atr * cfg.atrMultiplier;
        lower = m - atr * cfg.atrMultiplier;
      } else {
        // ta.bb(src, period, bbStd)
        const basis = s.sma!.step(src);
        const dev = s.dev!.step(src);
        upper = basis + cfg.bbStd * dev;
        lower = basis - cfg.bbStd * dev;
      }

      const prev = nz(v.tl); // nz(trendLine[1])
      // Signal = close > upper ? 1 : close < lower ? -1 : 0
      const signal = gt(b.close, upper) ? 1 : gt(lower, b.close) ? -1 : 0;
      let tl: number;
      if (signal === 1) tl = max(cfg.useAtrFilter ? b.low - atrValue : b.low, prev);
      else if (signal === -1) tl = min(cfg.useAtrFilter ? b.high + atrValue : b.high, prev);
      else tl = prev;
      const prevTrend = v.trend;
      if (gt(tl, prev)) v.trend = 1;
      else if (gt(prev, tl)) v.trend = -1;
      v.tl = tl;
      const trend = v.trend;

      const t = b.time;
      // buy_condition = trend[1] < 0 and trend > 0; sell_condition = trend[1] > 0 and trend < 0
      const buy = i > 0 && prevTrend < 0 && trend > 0;
      const sell = i > 0 && prevTrend > 0 && trend < 0;
      if (buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: buyCol, text: 'BUY', textColor: color.teal, size: 'small' });
      }
      if (sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: sellCol, text: 'SELL', textColor: color.red, size: 'small' });
      }
      // bgcolor(trend > 0 ? color.new(color.green, 95) : trend < 0 ? color.new(color.red, 95) : na)
      if (trend !== 0) s.bgColors.push({ time: t, color: trend > 0 ? bgUp : bgDn });
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(t as number);
      if (sell) s.times[1].push(t as number);

      s.plot0[i] = { time: t, value: upper, color: BAND_COL };
      s.plot1[i] = { time: t, value: lower, color: BAND_COL };
      // plot(trendLine, 'Trend Line', color = trend > 0 ? color.green : color.red, linewidth = 2)
      s.plot2[i] = { time: t, value: tl, color: trend > 0 ? color.green : color.red };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(buy_condition, "Buy Alert") / alertcondition(sell_condition, "Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MultiBandTrendLineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MultiBandTrendLineInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Buy Signal Generated' },
  { id: 'alert1', title: 'Sell Alert', message: 'Sell Signal Generated' },
];

export const MultiBandTrendLine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
