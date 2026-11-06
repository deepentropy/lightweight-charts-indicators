/**
 * Zero Lag HMA Trend Suite
 *
 * Hull moving average WMA(2 * WMA(source, ceil(length / 2)) - WMA(source, length), round(sqrt(length))), drawn as
 * nine stacked lines of growing width and transparency (a glow) in the slope colour: teal when the HMA is above its
 * value `slopeIndex` bars ago, purple otherwise. The price bars take the same colour. Optional signals: Buy / Sell
 * labels when the source crosses under the HMA - multiplier * ATR / over the HMA + multiplier * ATR, reversal circles
 * on the opposite crosses. Optional VWAP ribbon: the session VWAP (anchored on each new day) drawn as two wide
 * translucent lines, teal when it is below the HMA and purple when it is above.
 * The VWAP day: on intraday bars the port reads the exchange time zone and the session of the symbol from the
 * optional third argument (see src/chart-context.ts) and starts the VWAP with the trading day of the exchange, as
 * the original. Without them the day starts at 00:00 UTC.
 * Alerts (alertcondition, `alerts` of the result): the Buy / Sell and Reversal Up / Down crosses (whether or not
 * their labels are shown), and the start of a bullish / bearish trend (the HMA above / below its value `slopeIndex`
 * bars ago, and not on the bar before).
 *
 * Reference: "Uptrick: Zero Lag HMA Trend Suite" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, hasCalendar, periodChanges } from '../anchor-period';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZeroLagHMATrendSuiteInputs {
  /** HMA length */
  length: number;
  /** Source */
  source: SourceType;
  /** ATR length of the signal thresholds */
  atrLength: number;
  /** ATR multiplier of the signal thresholds */
  signalMultiplier: number;
  /** Show the Buy / Sell labels */
  showBuySellSignals: boolean;
  /** Show the reversal circles */
  showReversalSignals: boolean;
  /** Show the bull / bear VWAP ribbon */
  showVWAP: boolean;
  /** Slope colouring: the HMA is compared with its value this many bars ago */
  slopeIndex: number;
}

export const defaultInputs: ZeroLagHMATrendSuiteInputs = {
  length: 21,
  source: 'close',
  atrLength: 14,
  signalMultiplier: 1.5,
  showBuySellSignals: false,
  showReversalSignals: false,
  showVWAP: false,
  slopeIndex: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'HMA Length', defval: 21, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'signalMultiplier', type: 'float', title: 'Signal Multiplier', defval: 1.5, min: 0.1 },
  { id: 'showBuySellSignals', type: 'bool', title: 'Show Buy/Sell Signals', defval: false },
  { id: 'showReversalSignals', type: 'bool', title: 'Show Reversal Signals', defval: false },
  { id: 'showVWAP', type: 'bool', title: 'Show Bull/Bear VWAP Ribbon', defval: false },
  { id: 'slopeIndex', type: 'int', title: 'Slope Index Coloring', defval: 1 },
];

/** Line widths and transparencies of the nine HMA lines */
const HMA_LINES: [number, number][] = [[2, 0], [3, 20], [4, 40], [5, 60], [7, 80], [10, 85], [14, 90], [16, 95], [20, 97]];

export const plotConfig: PlotConfig[] = [
  ...HMA_LINES.map(([w], k) => ({ id: `plot${k}`, title: 'Zero Lag HMA', color: '#5CF0D7', lineWidth: w })),
  { id: 'plot9', title: 'Bullish VWAP', color: String(color.new('#5CF3DA', 70)), lineWidth: 20, style: 'linebr' },
  { id: 'plot10', title: 'Bullish VWAP', color: String(color.new('#5CF3DA', 80)), lineWidth: 60, style: 'linebr' },
  { id: 'plot11', title: 'Bearish VWAP', color: String(color.new('#B029C0', 70)), lineWidth: 20, style: 'linebr' },
  { id: 'plot12', title: 'Bearish VWAP', color: String(color.new('#B029C0', 80)), lineWidth: 60, style: 'linebr' },
];

export const metadata = {
  title: 'Zero Lag HMA Trend Suite',
  shortTitle: 'ZL HMA Trend Suite',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

const DAY_MS = 86400000;

interface ZlVars {
  /** ta.vwap sums */
  sumPV: number;
  sumV: number;
}

interface ZlRun extends BarRunState<ZlVars> {
  wma1: ReturnType<typeof taStep.wma>;
  wma2: ReturnType<typeof taStep.wma>;
  wma3: ReturnType<typeof taStep.wma>;
  atr: ReturnType<typeof taStep.atr>;
  source: number[];
  hma: number[];
  lower: number[];
  upper: number[];
  isBullish: boolean[];
  isBearish: boolean[];
  plots: Point[][];
  barColors: BarColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ZeroLagHMATrendSuiteInputs>): BarStudy<ZlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, atrLength, signalMultiplier, showBuySellSignals, showReversalSignals, showVWAP, slopeIndex } = cfg;
  const value = barSource(cfg.source);
  // halfLength = math.ceil(length / 2); sqrtLength = math.round(math.sqrt(length))
  const halfLength = Math.ceil(length / 2);
  const sqrtLength = Math.round(Math.sqrt(length));
  /** Chart context of the day changes (with the chart timeframe) and the time unit, set by init */
  let calChart: ChartContext = {};
  let ms = false;

  /**
   * Start of a new day (Pine ta.vwap anchor: timeframe.change("1D")) of bar i (newDay(bars, chart)[i]); true on the
   * first bar. With the exchange calendar, the change of bars i - 1 and i (the calendar reads the chart timeframe of
   * the whole set); else a new UTC day (the rule of periodStarts).
   */
  const newDay = (bars: Bar[], i: number): boolean => {
    if (i === 0) return true;
    if (hasCalendar(calChart)) return periodChanges([bars[i - 1]!, bars[i]!], '1D', calChart)[1]!;
    const day = (t: number) => Math.floor((ms ? t : t * 1000) / DAY_MS);
    return day(bars[i]!.time) !== day(bars[i - 1]!.time);
  };

  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    // the day changes read the chart timeframe of the bar gaps (or the context) and the time unit of the first bar
    key: (bars, chart) => (showVWAP ? `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}` : ''),
    init(bars, chart) {
      ms = bars.length > 0 && bars[0].time >= 1e12;
      const tfName = chartTimeframe(bars, chart);
      calChart = tfName === '' || chart.timeframe ? chart : { ...chart, timeframe: tfName };
      const s: ZlRun = {
        wma1: taStep.wma(), wma2: taStep.wma(), wma3: taStep.wma(), atr: taStep.atr(atrLength),
        source: [], hma: [], lower: [], upper: [], isBullish: [], isBearish: [],
        plots: Array.from({ length: 13 }, () => []), barColors: [], markers: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [], vars: { sumPV: NaN, sumV: NaN }, lists: [], series: [],
      };
      s.steps = [s.wma1, s.wma2, s.wma3, s.atr];
      s.lists = [s.markers, ...s.times];
      s.series = [s.source, s.hma, s.lower, s.upper, s.isBullish, s.isBearish, ...s.plots, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const t = b.time;
      const src = value(b);
      s.source[i] = src;
      const wma1 = s.wma1.step(src, halfLength);
      const wma2 = s.wma2.step(src, length);
      const hma = s.wma3.step(2 * wma1 - wma2, sqrtLength);
      s.hma[i] = hma;

      // slopeUp = zeroLagHMA > zeroLagHMA[slopeIndex]
      const hmaBack = i >= slopeIndex ? s.hma[i - slopeIndex]! : NaN;
      const slopeColor = gt(hma, hmaBack) ? '#5CF0D7' : '#B32AC3';
      HMA_LINES.forEach(([, transp], k) => {
        s.plots[k]![i] = { time: t, value: hma, color: String(color.new(slopeColor, transp)) };
      });
      // barcolor(slopeColor)
      s.barColors[i] = { time: t, color: slopeColor };

      // Signals: crossunder / crossover of the source with zeroLagHMA -/+ signalMultiplier * atr
      const atr = s.atr.step(b.high, b.low, b.close);
      const lower = hma - signalMultiplier * atr;
      const upper = hma + signalMultiplier * atr;
      s.lower[i] = lower;
      s.upper[i] = upper;
      // ta.crossover / ta.crossunder compare exactly (no 1e-10 tolerance); na operands give false
      const ps = i > 0 ? s.source[i - 1]! : NaN;
      const pl = i > 0 ? s.lower[i - 1]! : NaN;
      const pu = i > 0 ? s.upper[i - 1]! : NaN;
      const buy = i > 0 && src < lower && ps >= pl;
      const sell = i > 0 && src > upper && ps <= pu;
      const revUp = i > 0 && src > lower && ps <= pl;
      const revDown = i > 0 && src < upper && ps >= pu;
      // isBullish = zeroLagHMA > zeroLagHMA[slopeIndex]; isBearish = zeroLagHMA < zeroLagHMA[slopeIndex]
      const isBullish = gt(hma, hmaBack);
      const isBearish = lt(hma, hmaBack);
      s.isBullish[i] = isBullish;
      s.isBearish[i] = isBearish;
      // isBullish and not isBullish[1] (false before the first bar)
      const bullStart = isBullish && !(i > 0 && s.isBullish[i - 1]);
      const bearStart = isBearish && !(i > 0 && s.isBearish[i - 1]);
      if (showBuySellSignals && buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: '#40a998', text: '𝓤𝓹', textColor: '#FFFFFF' });
      }
      if (showBuySellSignals && sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: String(color.new('#B32AC3', 0)), text: '𝓓𝓸𝔀𝓷', textColor: '#FFFFFF' });
      }
      if (showReversalSignals && revUp) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'circle', color: String(color.new('#58EDD4C3', 0)), text: 'B', textColor: '#FFFFFF', size: 'small' });
      }
      if (showReversalSignals && revDown) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: String(color.new('#B129C0C3', 0)), text: 'B', textColor: '#FFFFFF', size: 'small' });
      }
      const flags = [buy, sell, revUp, revDown, bullStart, bearStart];
      for (let k = 0; k < 6; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(t as number);
      }

      // vwap = ta.vwap (hlc3, anchored on each new day); bullishVWAP = vwap < zeroLagHMA; bearishVWAP = vwap > zeroLagHMA
      let vwap = NaN;
      if (showVWAP) {
        const v = s.vars;
        const hlc3 = (b.high + b.low + b.close) / 3;
        const vol = b.volume ?? NaN;
        if (newDay(bars, i)) {
          v.sumPV = hlc3 * vol;
          v.sumV = vol;
        } else {
          // An na source or volume makes the sums na until the next anchor
          v.sumPV += hlc3 * vol;
          v.sumV += vol;
        }
        vwap = v.sumV === 0 ? NaN : v.sumPV / v.sumV;
      }
      const bullish = showVWAP && gt(hma, vwap);
      const bearish = showVWAP && gt(vwap, hma);
      s.plots[9]![i] = { time: t, value: showVWAP && bullish ? vwap : NaN, color: String(color.new('#5CF3DAEB', 70)) };
      s.plots[10]![i] = { time: t, value: showVWAP && bullish ? vwap : NaN, color: String(color.new('#5CF3DAEB', 80)) };
      s.plots[11]![i] = { time: t, value: showVWAP && bearish ? vwap : NaN, color: String(color.new('#B029C0EB', 70)) };
      s.plots[12]![i] = { time: t, value: showVWAP && bearish ? vwap : NaN, color: String(color.new('#B029C0EB', 80)) };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZeroLagHMATrendSuiteInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZeroLagHMATrendSuiteInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** alertcondition() calls of the original */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy Signal: Price crossed below Zero Lag HMA minus ATR threshold.' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell Signal: Price crossed above Zero Lag HMA plus ATR threshold.' },
  { id: 'alert2', title: 'Reversal Up Signal', message: 'Reversal Up Signal: Price crossed above Zero Lag HMA minus ATR threshold.' },
  { id: 'alert3', title: 'Reversal Down Signal', message: 'Reversal Down Signal: Price crossed below Zero Lag HMA plus ATR threshold.' },
  { id: 'alert4', title: 'Bullish Trend Start', message: 'Trend Shift: Bullish trend started.' },
  { id: 'alert5', title: 'Bearish Trend Start', message: 'Trend Shift: Bearish trend started.' },
];

export const ZeroLagHMATrendSuite = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
