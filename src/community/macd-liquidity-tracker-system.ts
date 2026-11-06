/**
 * MACD Liquidity Tracker System
 *
 * MACD line (EMA(fast) - EMA(slow) of the close) drawn as a histogram. Above 0 it is bright blue when it rises
 * against the MACD of the previous close, dark blue otherwise; at or below 0 it is bright magenta when it falls,
 * dark magenta otherwise. The system type turns these colours into long / short states (Fast: bright blue or dark
 * magenta is long; Normal: MACD above / below 0; Safe: only bright blue is long). Candles on the price pane take
 * the state colour, triangles mark the first bar of a long / short state, and a trend moving average (SMA, EMA,
 * WMA, HMA, RMA, LSMA, DEMA, TEMA or VIDYA) is drawn on the price pane.
 * Alerts (alertcondition, `alerts` of the result): the four histogram colour states (dark blue, dark magenta, no
 * leverage = dark blue / dark magenta / bright magenta, bright blue), the close above / below the trend MA and the
 * first bar of a long / short state (whatever signals are shown).
 *
 * Reference: "MACD Liquidity Tracker System" by PROFABIGHI_CAPITAL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LiquidityTrckr
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MacdLiquidityTrackerSystemType = 'Fast' | 'Normal' | 'Safe';
export type MacdLiquidityTrackerMaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'RMA' | 'LSMA' | 'DEMA' | 'TEMA' | 'VIDYA';
export type MacdLiquidityTrackerSignalDisplay = 'Both' | 'Long Only' | 'Short Only' | 'None';

export interface MacdLiquidityTrackerSystemInputs {
  /** Fast EMA length of the MACD */
  fastMA: number;
  /** Slow EMA length of the MACD */
  slowMA: number;
  /** System type: how the histogram colours give the long / short states */
  systemChoice: MacdLiquidityTrackerSystemType;
  /** Trend moving average type */
  maType: MacdLiquidityTrackerMaType;
  /** Trend moving average length */
  maLength: number;
  /** VIDYA volatility (standard deviation) length */
  vidyaVolatilityLength: number;
  /** Signal triangles shown */
  signalDisplay: MacdLiquidityTrackerSignalDisplay;
  /** Show the "Long" / "Short" text on the triangles */
  showText: boolean;
}

export const defaultInputs: MacdLiquidityTrackerSystemInputs = {
  fastMA: 12,
  slowMA: 26,
  systemChoice: 'Normal',
  maType: 'EMA',
  maLength: 50,
  vidyaVolatilityLength: 9,
  signalDisplay: 'Both',
  showText: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastMA', type: 'int', title: 'FMA', defval: 12, min: 7, group: 'MACD S' },
  { id: 'slowMA', type: 'int', title: 'SMA', defval: 26, min: 7, group: 'MACD S' },
  { id: 'systemChoice', type: 'string', title: 'System Type', defval: 'Normal', options: ['Fast', 'Normal', 'Safe'], group: 'System Logic' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'HMA', 'RMA', 'LSMA', 'DEMA', 'TEMA', 'VIDYA'], group: 'Trend MA Settings' },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 50, min: 1, group: 'Trend MA Settings' },
  { id: 'vidyaVolatilityLength', type: 'int', title: 'VIDYA Volatility Length', defval: 9, min: 1, group: 'Trend MA Settings' },
  { id: 'signalDisplay', type: 'string', title: 'Show Signals', defval: 'Both', options: ['Both', 'Long Only', 'Short Only', 'None'], group: 'Signal Display' },
  { id: 'showText', type: 'bool', title: 'Show Signal Text', defval: true, group: 'Signal Display' },
];

const BRIGHT_BLUE = String(color.rgb(0, 169, 230));
const DARK_BLUE_TRANSP = String(color.rgb(2, 25, 225, 31));
const BRIGHT_MAGENTA = String(color.rgb(255, 0, 238));
const DARK_MAGENTA_TRANSP = String(color.rgb(178, 0, 169, 17));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Histogram', color: BRIGHT_BLUE, lineWidth: 3, style: 'histogram' },
  // Pine force_overlay = true: the trend MA is drawn on the price pane
  { id: 'plot1', title: 'Trend MA', color: color.gray, lineWidth: 1, forceOverlay: true },
];

export const metadata = {
  title: 'MACD Liquidity Tracker System',
  shortTitle: 'LqdtyTrckr -> MACD Version',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

/** One moving average machine, stepped once per bar with the close */
interface MaStep { step(value: number): number; commit(): void }

/**
 * VIDYA: alpha * k * close + (1 - alpha * k) * nz(vidyaValue[1], close), k = stdev / stdev(stdev) clamped to [0, 1]
 * (stdev of the close and of the stdev over vidyaVolatilityLength)
 */
class VidyaStep implements MaStep {
  private prev = NaN; // vidyaValue[1]
  private next = NaN;
  private readonly sd: WindowStdev;
  private readonly sdSd: WindowStdev;
  private readonly alpha: number;

  constructor(len: number, vl: number) {
    this.sd = new WindowStdev(vl);
    this.sdSd = new WindowStdev(vl);
    this.alpha = 2.0 / (len + 1);
  }

  step(close: number): number {
    const sd = this.sd.step(close);
    const sdSd = this.sdSd.step(sd);
    // k = stdev / stdev(stdev): a plain division (x / 0 is +-infinity, 0 / 0 na), then clamped to [0, 1]
    let k = sd / sdSd;
    k = gt(k, 1.0) ? 1.0 : lt(k, 0.0) ? 0.0 : k;
    const alpha = this.alpha;
    // vidyaValue := alpha * k * close + (1 - alpha * k) * nz(vidyaValue[1], close)
    this.next = alpha * k * close + (1 - alpha * k) * (isNaN(this.prev) ? close : this.prev);
    return this.next;
  }

  commit(): void {
    this.sd.commit();
    this.sdSd.commit();
    this.prev = this.next;
  }
}

/** DEMA (2 * ema1 - ema2) and TEMA (3 * ema1 - 3 * ema2 + ema3), ema2 = ta.ema(ema1, len), ema3 = ta.ema(ema2, len) */
class EmaChain implements MaStep {
  private readonly emas: ReturnType<typeof taStep.ema>[];

  constructor(len: number, private readonly levels: 2 | 3) {
    this.emas = Array.from({ length: levels }, () => taStep.ema(len));
  }

  step(close: number): number {
    const ema1 = this.emas[0].step(close);
    const ema2 = this.emas[1].step(ema1);
    if (this.levels === 2) return 2 * ema1 - ema2;
    const ema3 = this.emas[2].step(ema2);
    return 3 * ema1 - 3 * ema2 + ema3;
  }

  commit(): void {
    for (const e of this.emas) e.commit();
  }
}

/** --- MA calculation (the input is constant: the selected branch runs on every bar) --- */
function maStep(cfg: MacdLiquidityTrackerSystemInputs): MaStep {
  const len = cfg.maLength;
  switch (cfg.maType) {
    case 'SMA': return new WindowSma(len);
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'HMA': return taStep.hma(len);
    case 'RMA': return taStep.rma(len);
    case 'LSMA': return taStep.linreg(len, 0);
    case 'DEMA': return new EmaChain(len, 2);
    case 'TEMA': return new EmaChain(len, 3);
    case 'VIDYA': return new VidyaStep(len, cfg.vidyaVolatilityLength);
    case 'EMA':
    default:
      return taStep.ema(len);
  }
}

interface MltRun extends BarRunState<{ longSignal: boolean; shortSignal: boolean }> {
  ma: MaStep;
  cur: ReturnType<typeof taStep.macd>;
  prev: ReturnType<typeof taStep.macd>;
  plot0: { time: number; value: number; color?: string }[];
  plot1: { time: number; value: number }[];
  candles: PlotCandleData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MacdLiquidityTrackerSystemInputs>): BarStudy<MltRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const showLong = cfg.signalDisplay === 'Both' || cfg.signalDisplay === 'Long Only';
  const showShort = cfg.signalDisplay === 'Both' || cfg.signalDisplay === 'Short Only';
  return {
    init() {
      const ma = maStep(cfg);
      // --- MACD of the close and of the previous close ---
      const cur = taStep.macd(cfg.fastMA, cfg.slowMA, 9);
      const prev = taStep.macd(cfg.fastMA, cfg.slowMA, 9);
      const s: MltRun = {
        ma, cur, prev, plot0: [], plot1: [], candles: [], markers: [],
        flags: Array.from({ length: 8 }, () => [] as boolean[]), times: Array.from({ length: 8 }, () => [] as number[]),
        steps: [ma, cur, prev],
        // var bool longSignal = false, var bool shortSignal = false
        vars: { longSignal: false, shortSignal: false },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const cur = s.cur.step(b.close)[0];
      const prev = s.prev.step(i > 0 ? bars[i - 1].close : NaN)[0];
      const ma = s.ma.step(b.close);
      // plotColor: na when currentMacd is na
      let plotColor: string | null = null;
      if (gt(cur, 0)) plotColor = gt(cur, prev) ? BRIGHT_BLUE : DARK_BLUE_TRANSP;
      else if (le(cur, 0)) plotColor = lt(cur, prev) ? BRIGHT_MAGENTA : DARK_MAGENTA_TRANSP;
      const isBrightBlue = plotColor === BRIGHT_BLUE;
      const isDarkBlueTransp = plotColor === DARK_BLUE_TRANSP;
      const isBrightMagenta = plotColor === BRIGHT_MAGENTA;
      const isDarkMagentaTransp = plotColor === DARK_MAGENTA_TRANSP;

      const prevLong = v.longSignal; // longSignal[1] (false on bar 0)
      const prevShort = v.shortSignal;
      let longSignal = prevLong;
      let shortSignal = prevShort;
      if (cfg.systemChoice === 'Fast') {
        longSignal = isBrightBlue || isDarkMagentaTransp;
        shortSignal = isDarkBlueTransp || isBrightMagenta;
      } else if (cfg.systemChoice === 'Normal') {
        longSignal = gt(cur, 0);
        shortSignal = lt(cur, 0);
      } else if (cfg.systemChoice === 'Safe') {
        longSignal = isBrightBlue;
        shortSignal = isDarkBlueTransp || isBrightMagenta || isDarkMagentaTransp;
      }
      v.longSignal = longSignal;
      v.shortSignal = shortSignal;
      const candleColor = longSignal ? BRIGHT_BLUE : shortSignal ? BRIGHT_MAGENTA : 'transparent';

      s.plot0[i] = { time: b.time, value: Number.isFinite(cur) ? cur : NaN, ...(plotColor ? { color: plotColor } : {}) };
      s.plot1[i] = { time: b.time, value: Number.isFinite(ma) ? ma : NaN };

      const longEntry = longSignal && !prevLong;
      const shortEntry = shortSignal && !prevShort;
      // plotshape(..., location.belowbar / abovebar, color = candleColor, shape.triangleup / triangledown, size.small,
      //   text = "Long" / "Short" (with text only), textcolor = candleColor, force_overlay = true)
      // ids: the outputs "... with Text" (shape0 / shape1) when showText, "... without Text" (shape2 / shape3) otherwise
      if (showLong && longEntry) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: candleColor, size: 'small',
          ...(cfg.showText ? { text: 'Long', textColor: candleColor } : {}), forceOverlay: true,
          id: cfg.showText ? 'shape0' : 'shape2' });
      }
      if (showShort && shortEntry) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: candleColor, size: 'small',
          ...(cfg.showText ? { text: 'Short', textColor: candleColor } : {}), forceOverlay: true,
          id: cfg.showText ? 'shape1' : 'shape3' });
      }
      // alertconditions: isNeutralBuy_Orig, isNeutralSell_Orig, isNoLeverage_Orig, isLeverage_Orig, isAboveMA,
      // isBelowMA, longEntryCondition, shortEntryCondition
      [isDarkBlueTransp, isDarkMagentaTransp, isDarkMagentaTransp || isDarkBlueTransp || isBrightMagenta, isBrightBlue,
        gt(b.close, ma), lt(b.close, ma), longEntry, shortEntry].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
      // plotcandle(open, high, low, close, color / wickcolor / bordercolor = candleColor, force_overlay = true)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: candleColor,
        wickColor: candleColor, borderColor: candleColor, forceOverlay: true };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [{ value: 0, options: { title: 'Zero line', color: color.gray, linestyle: 'dashed' } }],
        markers: s.markers.slice(),
        plotCandles: { coloredCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdLiquidityTrackerSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdLiquidityTrackerSystemInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Color: Dark Blue Transp', message: 'Dark Blue Transp color detected.' },
  { id: 'alert1', title: 'Color: Dark Magenta Transp', message: 'Dark Magenta Transp color detected.' },
  { id: 'alert2', title: 'Color: No Leverage Colors', message: 'Indicator shows Dark Blue T, Dark Magenta T, or Bright Magenta.' },
  { id: 'alert3', title: 'Color: Bright Blue', message: 'Bright Blue (Leverage) color detected.' },
  { id: 'alert4', title: 'Price Above MA', message: 'Price is above the selected MA.' },
  { id: 'alert5', title: 'Price Below MA', message: 'Price is below the selected MA.' },
  { id: 'alert6', title: 'Long Entry Signal Trigger', message: 'Long entry signal (triangle) detected.' },
  { id: 'alert7', title: 'Short Entry Signal Trigger', message: 'Short entry signal (triangle) detected.' },
];

export const MacdLiquidityTrackerSystem = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
