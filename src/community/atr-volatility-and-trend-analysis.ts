/**
 * ATR Volatility and Trend Analysis
 *
 * Three pairs of bands at close +- ATR * multiplier. A volatility breakout circle marks the first bar where the ATR
 * is above its SMA (same length) times the threshold. Trend: the ATR is above its SMA (trend smoothing length) and
 * the close is above its SMA (bullish) or not (bearish); a label marks the first bar of each new trend state.
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): "ATR Volatility Breakout",
 * "ATR Bullish Trend Signal", "ATR Bearish Trend Signal" on the bars of those signals (shown or not), "Price Above ATR
 * Band 1" / "Price Below ATR Band 1" when the close crosses over the upper / under the lower band 1 (the bands are
 * close +- ATR, so as in the original these two never run).
 *
 * Reference: "ATR Volatility and Trend Analysis" by dchunt-stack
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dchunt-stack. Copyright © 2025 dchunt-stack. All rights reserved
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface AtrVolatilityAndTrendAnalysisInputs {
  /** ATR length */
  atrLength: number;
  showBands: boolean;
  band1Mult: number;
  band2Mult: number;
  band3Mult: number;
  showVolSignals: boolean;
  /** ATR / SMA(ATR) ratio above which volatility breaks out */
  volThreshold: number;
  showTrend: boolean;
  /** SMA length of the trend detection */
  trendLength: number;
  upperBandColor: string;
  lowerBandColor: string;
  signalColor: string;
  bullTrendSignalColor: string;
  bearTrendSignalColor: string;
}

const BULL_COLOR = '#26a69aff';
const BEAR_COLOR = '#ef5350ff';
const SIGNAL_COLOR = '#ffeb3bff';
const BAND_COLOR_UPPER = '#2196f380';
const BAND_COLOR_LOWER = '#f4433680';

export const defaultInputs: AtrVolatilityAndTrendAnalysisInputs = {
  atrLength: 14,
  showBands: true,
  band1Mult: 1.0,
  band2Mult: 2.0,
  band3Mult: 3.0,
  showVolSignals: true,
  volThreshold: 1.5,
  showTrend: true,
  trendLength: 21,
  upperBandColor: BAND_COLOR_UPPER,
  lowerBandColor: BAND_COLOR_LOWER,
  signalColor: SIGNAL_COLOR,
  bullTrendSignalColor: BULL_COLOR,
  bearTrendSignalColor: BEAR_COLOR,
};

const G1 = 'ATR Settings';
const G2 = 'ATR Bands Settings';
const G3 = 'Volatility Signals';
const G4 = 'Trend Detection';
const G5 = 'Visual Settings';

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1, max: 100, group: G1, tooltip: 'Period for ATR calculation' },
  { id: 'showBands', type: 'bool', title: 'Show ATR Bands', defval: true, group: G2, tooltip: 'Display ATR-based support/resistance bands' },
  { id: 'band1Mult', type: 'float', title: 'Band 1 Multiplier', defval: 1.0, min: 0.1, max: 10.0, step: 0.1, group: G2, tooltip: 'ATR multiplier for first band' },
  { id: 'band2Mult', type: 'float', title: 'Band 2 Multiplier', defval: 2.0, min: 0.1, max: 10.0, step: 0.1, group: G2, tooltip: 'ATR multiplier for second band' },
  { id: 'band3Mult', type: 'float', title: 'Band 3 Multiplier', defval: 3.0, min: 0.1, max: 10.0, step: 0.1, group: G2, tooltip: 'ATR multiplier for third band' },
  { id: 'showVolSignals', type: 'bool', title: 'Show Volatility Signals', defval: true, group: G3, tooltip: 'Display volatility breakout signals' },
  { id: 'volThreshold', type: 'float', title: 'Volatility Threshold', defval: 1.5, min: 0.5, max: 5.0, step: 0.1, group: G3, tooltip: 'ATR multiplier threshold for volatility signals' },
  { id: 'showTrend', type: 'bool', title: 'Show Trend Signals', defval: true, group: G4, tooltip: 'Display ATR-based trend signals' },
  { id: 'trendLength', type: 'int', title: 'Trend Smoothing', defval: 21, min: 5, max: 50, group: G4, tooltip: 'Period for trend smoothing' },
  { id: 'upperBandColor', type: 'color', title: 'Upper Band Color', defval: BAND_COLOR_UPPER, group: G5 },
  { id: 'lowerBandColor', type: 'color', title: 'Lower Band Color', defval: BAND_COLOR_LOWER, group: G5 },
  { id: 'signalColor', type: 'color', title: 'Volatility Signal Color', defval: SIGNAL_COLOR, group: G5 },
  { id: 'bullTrendSignalColor', type: 'color', title: 'Bullish Trend Signal Color', defval: BULL_COLOR, group: G5 },
  { id: 'bearTrendSignalColor', type: 'color', title: 'Bearish Trend Signal Color', defval: BEAR_COLOR, group: G5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band 1', color: BAND_COLOR_UPPER, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band 1', color: BAND_COLOR_LOWER, lineWidth: 1 },
  { id: 'plot2', title: 'Upper Band 2', color: String(color.new(BAND_COLOR_UPPER, 60)), lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band 2', color: String(color.new(BAND_COLOR_LOWER, 60)), lineWidth: 1 },
  { id: 'plot4', title: 'Upper Band 3', color: String(color.new(BAND_COLOR_UPPER, 80)), lineWidth: 1 },
  { id: 'plot5', title: 'Lower Band 3', color: String(color.new(BAND_COLOR_LOWER, 80)), lineWidth: 1 },
];

export const metadata = {
  title: 'ATR Volatility and Trend Analysis',
  shortTitle: 'ATR Volatility and Trend Analysis',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };

interface AtrVars {
  /** volBreakout[1] (false before the first bar) */
  prevBreakout: boolean;
  /** trendDirection[1] (na before the first bar: `!=` is false) */
  prevTrend: number;
  /** close[1], upperBand1[1], lowerBand1[1] of the crosses */
  prevClose: number;
  prevUpper: number;
  prevLower: number;
}

interface AtrRun extends BarRunState<AtrVars> {
  atr: ReturnType<typeof taStep.atr>;
  atrSma: WindowSma;
  srcSma: WindowSma;
  atrSmaTrend: WindowSma;
  markers: MarkerData[];
  alertCalls: AlertCall[];
  plots: Point[][];
}

function study(inputs: Partial<AtrVolatilityAndTrendAnalysisInputs>): BarStudy<AtrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const mults = [cfg.band1Mult, cfg.band1Mult, cfg.band2Mult, cfg.band2Mult, cfg.band3Mult, cfg.band3Mult];
  const signs = [1, -1, 1, -1, 1, -1];
  const cols = [
    cfg.upperBandColor, cfg.lowerBandColor,
    String(color.new(cfg.upperBandColor, 60)), String(color.new(cfg.lowerBandColor, 60)),
    String(color.new(cfg.upperBandColor, 80)), String(color.new(cfg.lowerBandColor, 80)),
  ];
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const atrSma = new WindowSma(cfg.atrLength);
      // getTrendDirection(close, atrValue, trendLength)
      const srcSma = new WindowSma(cfg.trendLength);
      const atrSmaTrend = new WindowSma(cfg.trendLength);
      const s: AtrRun = {
        atr, atrSma, srcSma, atrSmaTrend, markers: [], alertCalls: [], plots: mults.map(() => []),
        steps: [atr, atrSma, srcSma, atrSmaTrend],
        vars: { prevBreakout: false, prevTrend: NaN, prevClose: NaN, prevUpper: NaN, prevLower: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time as number;
      const close = b.close;
      const atrValue = s.atr.step(b.high, b.low, close);
      const atrSma = s.atrSma.step(atrValue);
      const srcSma = s.srcSma.step(close);
      const atrSmaTrend = s.atrSmaTrend.step(atrValue);

      // atrCrossover = ta.crossover(close, upperBand1); atrCrossunder = ta.crossunder(close, lowerBand1)
      const upper = close + atrValue * cfg.band1Mult;
      const lower = close - atrValue * cfg.band1Mult;
      const atrCrossover = close > upper && v.prevClose <= v.prevUpper;
      const atrCrossunder = close < lower && v.prevClose >= v.prevLower;
      v.prevClose = close;
      v.prevUpper = upper;
      v.prevLower = lower;

      const call = (message: string) => s.alertCalls.push({ time: t, message, freq: 'once_per_bar_close' });
      const volBreakout = gt(atrValue, atrSma * cfg.volThreshold);
      const volSignal = volBreakout && !v.prevBreakout;
      v.prevBreakout = volBreakout;

      const priceAboveSma = gt(close, srcSma);
      const atrRising = gt(atrValue, atrSmaTrend);
      const trend = priceAboveSma && atrRising ? 1 : !priceAboveSma && atrRising ? -1 : 0;
      const bullishTrend = trend === 1 && !isNaN(v.prevTrend) && v.prevTrend !== 1;
      const bearishTrend = trend === -1 && !isNaN(v.prevTrend) && v.prevTrend !== -1;
      v.prevTrend = trend;

      if (volSignal) call('ATR Volatility Breakout');
      if (bullishTrend) call('ATR Bullish Trend Signal');
      if (bearishTrend) call('ATR Bearish Trend Signal');
      if (atrCrossover) call('Price Above ATR Band 1');
      if (atrCrossunder) call('Price Below ATR Band 1');

      if (cfg.showVolSignals && volSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: cfg.signalColor, size: 'tiny' });
      }
      if (cfg.showTrend && bullishTrend) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: cfg.bullTrendSignalColor, text: '↑',
          textColor: color.white, size: 'tiny' });
      }
      if (cfg.showTrend && bearishTrend) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: cfg.bearTrendSignalColor, text: '↓',
          textColor: color.white, size: 'tiny' });
      }

      // getBands(close, atrValue, mult): close +- atrValue * mult
      for (let k = 0; k < 6; k++) {
        s.plots[k][i] = { time: b.time, value: cfg.showBands ? close + signs[k] * (atrValue * mults[k]) : NaN, color: cols[k] };
      }
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4, plot5] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AtrVolatilityAndTrendAnalysisInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AtrVolatilityAndTrendAnalysisInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AtrVolatilityAndTrendAnalysis = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
