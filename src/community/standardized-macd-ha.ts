/**
 * Standardized MACD Heikin-Ashi Transformed
 *
 * As the original: the MACD of the source divided by the EMA of the bar range (high - low) over the slow length,
 * times 100, turned into one Heikin-Ashi bar per bar from the previous and current values (the original's ha
 * method, its persistent bar and history rules included); the signal is the EMA of a source of that HA bar, the
 * histogram its close minus the signal. Candles coloured by the HA direction (hollow rising bodies with "Hollow
 * Candles"), OB / OS triangles 40 above the HA high / below the HA low (shape0 / shape1).
 * Histogram columns (width 1) as the original: above 0 light blue #8ac3f5, below (or na) light red #ffa7b6, at
 * transparency 20 when the histogram is above its value of the bar before, else 30.
 * Bar colours (barcolor0) by "Bar Coloring", None by default (no bar colour): MidLine (HA close above 0), Candles (HA
 * direction), Sig Cross (signal above the HA close: red), Extremities (HA close beyond the reversion threshold, else
 * the chart foreground colour at transparency 25), Reversions (OS / OB signals, else that foreground colour); na
 * values compare false, as in the original. The foreground colour is `chart.fg_color` of the chart context.
 * HA open: the original's persistent bar object (var bar x, its close set to the new ohlc4 before the new bar is
 * built) read as Pine evaluates it: x.o[1] is the open of the HA bar before, x.src('oc2')[1] the value of that call
 * on the bar before (0 through nz() on the first bar it runs).
 * Alerts (alertcondition, `alerts` of the result): Overbought / Oversold (HA close crossing its open beyond the
 * reversion threshold), Midline Crossover / Crossunder (HA close crossing 0), Positive / Negative Heikin-Ashi (the
 * crosses inside the threshold), MACD Bull / Bear Cross (HA close crossing the signal). alert() calls (`alertCalls`,
 * once per bar close): on each bar where one of them is true, the message of the first true one in that order.
 *
 * Reference: "Standardized MACD Heikin-Ashi Transformed" by EliCobra
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData, BarColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface StandardizedMacdHAInputs {
  src: string;
  fast: number;
  slow: number;
  signalSrc: string;
  signalLength: number;
  reversionThreshold: number;
  /** Bar Coloring */
  barColoring: 'None' | 'MidLine' | 'Candles' | 'Sig Cross' | 'Extremities' | 'Reversions';
  hollow: boolean;
}

export const defaultInputs: StandardizedMacdHAInputs = {
  src: 'close',
  fast: 12,
  slow: 26,
  signalSrc: 'close',
  signalLength: 9,
  reversionThreshold: 100,
  barColoring: 'None',
  hollow: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fast', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slow', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalSrc', type: 'string', title: 'Signal Source', defval: 'close', options: ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'] },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'reversionThreshold', type: 'float', title: 'Reversion Threshold', defval: 100, min: 0, step: 10 },
  { id: 'barColoring', type: 'string', title: 'Bar Coloring', defval: 'None', options: ['None', 'MidLine', 'Candles', 'Sig Cross', 'Extremities', 'Reversions'] },
  { id: 'hollow', type: 'bool', title: 'Hollow Candles', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'signal', title: 'Signal', color: '#787B86', lineWidth: 1 },
  { id: 'histogram', title: 'Histogram', color: '#8ac3f5', lineWidth: 1, style: 'columns' },
];

export const plotCandleConfig = [
  { id: 'candle0', title: 'HA MACD Candle' },
];

export const metadata = {
  title: 'Standardized MACD HA',
  shortTitle: 'SMACDHA',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[]; alertCalls: AlertCall[] };
type Point = { time: number; value: number; color?: string };

const pick = (o: number, h: number, l: number, c: number, which: string): number => {
  switch (which) {
    case 'open': return o;
    case 'high': return h;
    case 'low': return l;
    case 'oc2': return (o + c) / 2;
    case 'hl2': return (h + l) / 2;
    case 'hlc3': return (h + l + c) / 3;
    case 'ohlc4': return (o + h + l + c) / 4;
    case 'hlcc4': return (h + l + c + c) / 4;
    default: return c;
  }
};

interface SmacdVars {
  /** x.o: the open of the HA bar before */
  prevOpen: number;
  /** x.src('oc2') of the bar before (na when not evaluated) */
  lastOc2: number;
}

interface SmacdRun extends BarRunState<SmacdVars> {
  emaFast: ReturnType<typeof taStep.ema>;
  emaSlow: ReturnType<typeof taStep.ema>;
  emaRange: ReturnType<typeof taStep.ema>;
  emaSignal: ReturnType<typeof taStep.ema>;
  neutralBar: string;
  macd: number[];
  haOpen: number[];
  haClose: number[];
  signal: number[];
  hist: number[];
  candles: PlotCandleData[];
  signalPlot: Point[];
  histPlot: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  alertCalls: AlertCall[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<StandardizedMacdHAInputs>): BarStudy<SmacdRun, Result> {
  const { src, fast, slow, signalSrc, signalLength, reversionThreshold, barColoring, hollow } = { ...defaultInputs, ...inputs };
  const upColor = '#00bcd4';
  const downColor = '#fc1f1f';
  // colh = o.h > 0 ? (o.h > o.h[1] ? color.new(colhu, 20) : color.new(colhu, 30))
  //                 : (o.h > o.h[1] ? color.new(colhd, 20) : color.new(colhd, 30))
  const histColors = ['#8ac3f5', '#ffa7b6'].map((c) => [String(color.new(c, 20)), String(color.new(c, 30))]);
  return {
    fullRunReason: () => (isBarSource(src) || src === 'oc2' ? null : 'source of another study'),
    init(_bars, chart) {
      const s: SmacdRun = {
        emaFast: taStep.ema(fast), emaSlow: taStep.ema(slow), emaRange: taStep.ema(slow), emaSignal: taStep.ema(signalLength),
        neutralBar: barColoring !== 'None' ? String(color.new(foregroundColorOf(chart), 25)) : '',
        macd: [], haOpen: [], haClose: [], signal: [], hist: [], candles: [], signalPlot: [], histPlot: [], markers: [],
        barColors: [], alertCalls: [], flags: Array.from({ length: 8 }, () => []), times: Array.from({ length: 8 }, () => []),
        steps: [], vars: { prevOpen: NaN, lastOc2: NaN }, lists: [], series: [],
      };
      s.steps = [s.emaFast, s.emaSlow, s.emaRange, s.emaSignal];
      s.lists = [s.markers, s.barColors, s.alertCalls, ...s.times];
      s.series = [s.macd, s.haOpen, s.haClose, s.signal, s.hist, s.candles, s.signalPlot, s.histPlot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const v = s.vars;
      // x = (ema(src, fast) - ema(src, slow)) / ema(high - low, slow) * 100
      const x = pick(b.open, b.high, b.low, b.close, src);
      const f = s.emaFast.step(x);
      const sl = s.emaSlow.step(x);
      const r = s.emaRange.step(b.high - b.low);
      const mv = ((f - sl) / r) * 100;
      const m = Number.isFinite(mv) ? mv : NaN;
      s.macd[i] = m;

      // One Heikin-Ashi pass (method ha) on the bar z = (x[1], max(x, x[1]), min(x, x[1]), x). The persistent object x
      // holds the HA bar of the bar before; its close is first set to ohlc4(z), then the new bar is
      //   open  = na(x.o[1]) ? oc2(z) : nz(x.src('oc2')[1])  (x.src('oc2') = avg(open of the HA bar before, ohlc4(z)),
      //           evaluated in that branch only: its value of the bar before, na on the first bar of the branch)
      //   high  = max(z.h, max(x.o, x.c)), low = min(z.l, min(x.o, x.c))  (x.o: the open of the HA bar before)
      //   close = ohlc4(z)
      const m1 = i > 0 ? s.macd[i - 1] : NaN;
      const zo = m1, zh = Math.max(m, m1), zl = Math.min(m, m1), zc = m;
      const c = (zo + zh + zl + zc) / 4;
      const prevOpen = v.prevOpen;
      let o: number;
      if (!Number.isFinite(prevOpen)) {
        o = (zo + zc) / 2;
        v.lastOc2 = NaN;
      } else {
        o = Number.isFinite(v.lastOc2) ? v.lastOc2 : 0;
        v.lastOc2 = (prevOpen + c) / 2;
      }
      const haOpen = Number.isFinite(o) ? o : NaN;
      const haHigh = Math.max(zh, Math.max(prevOpen, c));
      const haLow = Math.min(zl, Math.min(prevOpen, c));
      const haClose = Number.isFinite(c) ? c : NaN;
      v.prevOpen = haOpen;
      s.haOpen[i] = haOpen;
      s.haClose[i] = haClose;

      // s = ema(z.src(sig), clen); H = z.c - s
      const signal = s.emaSignal.step(pick(haOpen, haHigh, haLow, haClose, signalSrc));
      const hist = haClose - signal;
      s.signal[i] = signal;
      s.hist[i] = hist;

      // haColor = c > o ? colup : c < o ? coldn : na; no body on a rising candle with "Hollow Candles"
      if (![haOpen, haHigh, haLow, haClose].every(Number.isFinite)) {
        s.candles[i] = { time, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        const col = haClose > haOpen ? upColor : haClose < haOpen ? downColor : 'transparent';
        s.candles[i] = {
          time,
          open: haOpen,
          high: haHigh,
          low: haLow,
          close: haClose,
          color: hollow && haClose > haOpen ? 'transparent' : col,
          borderColor: col,
          wickColor: col,
        };
      }

      s.signalPlot[i] = { time: b.time, value: Number.isFinite(signal) ? signal : NaN };
      const rising = i > 0 && hist > s.hist[i - 1];
      s.histPlot[i] = { time: b.time, value: Number.isFinite(hist) ? hist : NaN, color: histColors[hist > 0 ? 0 : 1][rising ? 0 : 1] };

      // plotshape(a.s ? o.b.h + 40 : na, "OB", triangledown, absolute) / plotshape(a.b ? o.b.l - 40 : na, "OS", triangleup)
      const pc = i > 0 ? s.haClose[i - 1] : NaN;
      const po = i > 0 ? s.haOpen[i - 1] : NaN;
      const under = haClose < haOpen && pc >= po;
      const over = haClose > haOpen && pc <= po;
      const obSignal = under && haHigh > reversionThreshold;
      const osSignal = over && haLow < -reversionThreshold;
      if (obSignal) {
        s.markers.push({ id: 'shape0', time, position: 'atPriceMiddle', price: haHigh + 40, shape: 'triangleDown', color: downColor, size: 'tiny' });
      }
      if (osSignal) {
        s.markers.push({ id: 'shape1', time, position: 'atPriceMiddle', price: haLow - 40, shape: 'triangleUp', color: upColor, size: 'tiny' });
      }

      // barcolor(col): col = switch colb ('None' => na: no bar colour); na values compare false
      if (barColoring !== 'None') {
        const neutralBar = s.neutralBar;
        let col: string | null;
        switch (barColoring) {
          case 'MidLine': col = haClose > 0 ? upColor : downColor; break;
          case 'Candles': col = haClose > haOpen ? upColor : downColor; break;
          case 'Sig Cross': col = signal > haClose ? downColor : upColor; break;
          case 'Extremities': col = haClose > reversionThreshold ? downColor : haClose < -reversionThreshold ? upColor : neutralBar; break;
          case 'Reversions': col = osSignal ? downColor : obSignal ? upColor : neutralBar; break;
          default: col = null;
        }
        if (col !== null) s.barColors.push({ id: 'barcolor0', time, color: col });
      }

      // alerts.new(...): crossunder(c, o) and h > revt, crossover(c, o) and l < -revt, crossover(c, 0), crossunder(c, 0),
      // crossunder(c, o) and not h > revt, crossover(c, o) and not l < -revt, crossover(c, signal), crossunder(c, signal)
      const ps = i > 0 ? s.signal[i - 1] : NaN;
      const fl = s.flags;
      fl[0][i] = under && haHigh > reversionThreshold;
      fl[1][i] = over && haLow < -reversionThreshold;
      fl[2][i] = haClose > 0 && pc <= 0;
      fl[3][i] = haClose < 0 && pc >= 0;
      fl[4][i] = under && !(haHigh > reversionThreshold);
      fl[5][i] = over && !(haLow < -reversionThreshold);
      fl[6][i] = haClose > signal && pc <= ps;
      fl[7][i] = haClose < signal && pc >= ps;
      // a.any().notify(): alert(<message of the first true condition>, alert.freq_once_per_bar_close)
      let first = -1;
      for (let k = 0; k < 8; k++) {
        if (fl[k][i]) {
          s.times[k].push(time);
          if (first < 0) first = k;
        }
      }
      if (first >= 0) s.alertCalls.push({ time, message: alertConditions[first].message!, freq: 'once_per_bar_close' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { signal: s.signalPlot.slice(), histogram: s.histPlot.slice() },
        plotCandles: { candle0: s.candles.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StandardizedMacdHAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StandardizedMacdHAInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Overbought', message: 'OB Signal' },
  { id: 'alert1', title: 'Oversold  ', message: 'OS Signal' },
  { id: 'alert2', title: 'Midline Crossover ', message: 'Bullish Trend' },
  { id: 'alert3', title: 'Midline Crossunder', message: 'Bearish Trend' },
  { id: 'alert4', title: 'Positive Heikin-Ashi', message: 'Heikin-Ashi Uptrend  ' },
  { id: 'alert5', title: 'Negative Heikin-Ashi', message: 'Heikin-Ashi Downtrend' },
  { id: 'alert6', title: 'MACD Bull Cross', message: 'MACD Bullish Cross' },
  { id: 'alert7', title: 'MACD Bear Cross', message: 'MACD Bearish Cross' },
];

export const StandardizedMacdHA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, alertConditions, hasAlertFunction };
