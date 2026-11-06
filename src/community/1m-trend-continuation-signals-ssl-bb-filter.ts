/**
 * 1m Trend Continuation Signals - SSL + BB Filter
 *
 * Trend EMA of the close, an SSL channel (SMA of the high and SMA of the low; the state flips to up when the close is
 * above the high SMA and to down when it is below the low SMA) and Bollinger Bands (SMA +- stdev * multiplier).
 * Buy: close above the trend EMA, SSL up line crossing over the SSL down line and close above the upper band.
 * Sell: close below the trend EMA, SSL up line crossing under the SSL down line and close below the lower band.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of each signal.
 *
 * Reference: "1m Trend Continuation Signals - SSL + BB Filter" by rhariganesh
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendContinuationSslBbInputs {
  /** Trend EMA length */
  emaLength: number;
  /** SSL channel length */
  sslLength: number;
  /** Bollinger Band length */
  bbLength: number;
  /** Bollinger Band standard deviation multiplier */
  bbStdDev: number;
}

export const defaultInputs: TrendContinuationSslBbInputs = {
  emaLength: 200,
  sslLength: 10,
  bbLength: 150,
  bbStdDev: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'Trend EMA Length', defval: 200 },
  { id: 'sslLength', type: 'int', title: 'SSL Channel Length', defval: 10 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 150, min: 1 },
  { id: 'bbStdDev', type: 'float', title: 'BB Std Dev', defval: 2.0, step: 0.1 },
];

const EMA_COL = String(color.new('#5b9cf6', 0));
const UP_COL = String(color.new('#089981', 0));
const DOWN_COL = String(color.new('#f23645', 0));
const SSL_FILL_UP = String(color.new('#089981', 85));
const SSL_FILL_DOWN = String(color.new('#f23645', 85));
const BB_FILL = String(color.new(color.gray, 92));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend EMA', color: EMA_COL, lineWidth: 2 },
  { id: 'plot1', title: 'SSL Up', color: UP_COL, lineWidth: 1 },
  { id: 'plot2', title: 'SSL Down', color: DOWN_COL, lineWidth: 1 },
  { id: 'plot3', title: 'BB Basis', color: color.orange, lineWidth: 2 },
  { id: 'plot4', title: 'BB Upper', color: color.green, lineWidth: 1 },
  { id: 'plot5', title: 'BB Lower', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: '1m Trend Continuation Signals - SSL + BB Filter',
  shortTitle: '1m Trend Continuation Signals - SSL + BB Filter',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SslVars {
  /** var int hlv (na before bar 0) */
  hlv: number;
}

interface SslRun extends BarRunState<SslVars> {
  ema: ReturnType<typeof taStep.ema>;
  smaHigh: WindowSma;
  smaLow: WindowSma;
  bbBasis: WindowSma;
  bbStd: WindowStdev;
  sslUp: number[];
  sslDown: number[];
  fillColors: string[];
  emaPlot: Point[];
  upPlot: Point[];
  downPlot: Point[];
  basisPlot: Point[];
  upperPlot: Point[];
  lowerPlot: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<TrendContinuationSslBbInputs>): BarStudy<SslRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(cfg.emaLength);
      const smaHigh = new WindowSma(cfg.sslLength);
      const smaLow = new WindowSma(cfg.sslLength);
      const bbBasis = new WindowSma(cfg.bbLength);
      const bbStd = new WindowStdev(cfg.bbLength);
      const s: SslRun = {
        ema, smaHigh, smaLow, bbBasis, bbStd, sslUp: [], sslDown: [], fillColors: [], emaPlot: [], upPlot: [],
        downPlot: [], basisPlot: [], upperPlot: [], lowerPlot: [], flags: [[], []], times: [[], []], markers: [],
        steps: [ema, smaHigh, smaLow, bbBasis, bbStd], vars: { hlv: NaN }, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [
        s.sslUp, s.sslDown, s.fillColors, s.emaPlot, s.upPlot, s.downPlot, s.basisPlot, s.upperPlot, s.lowerPlot,
        ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = b.close;
      const trendEma = s.ema.step(c);
      const smaHigh = s.smaHigh.step(b.high);
      const smaLow = s.smaLow.step(b.low);
      const bbBasis = s.bbBasis.step(c);
      const bbStd = s.bbStd.step(c);
      // var int hlv = 0; hlv := close > smaHigh ? 1 : close < smaLow ? -1 : hlv[1] (hlv[1] is na on bar 0)
      const hlv = gt(c, smaHigh) ? 1 : lt(c, smaLow) ? -1 : i > 0 ? s.vars.hlv : NaN;
      s.vars.hlv = hlv;
      const up = lt(hlv, 0) ? smaLow : smaHigh;
      const down = lt(hlv, 0) ? smaHigh : smaLow;
      s.sslUp[i] = up;
      s.sslDown[i] = down;
      const dev = bbStd * cfg.bbStdDev;
      const bbUpper = bbBasis + dev;
      const bbLower = bbBasis - dev;

      let buySignal = false;
      let sellSignal = false;
      if (i >= 1) {
        // ta.crossover / ta.crossunder compare exactly (na compares false)
        const sslBullish = up > down && s.sslUp[i - 1] <= s.sslDown[i - 1];
        const sslBearish = up < down && s.sslUp[i - 1] >= s.sslDown[i - 1];
        buySignal = gt(c, trendEma) && sslBullish && gt(c, bbUpper);
        sellSignal = lt(c, trendEma) && sslBearish && lt(c, bbLower);
        if (buySignal) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#089981', text: 'BUY',
            textColor: color.white, size: 'small' });
        }
        if (sellSignal) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#f23645', text: 'SELL',
            textColor: color.white, size: 'small' });
        }
      }
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(time as number);
      if (sellSignal) s.times[1].push(time as number);

      // fill(p_up, p_down, color = hlv == 1 ? color.new(#089981, 85) : color.new(#f23645, 85), title = "SSL Fill")
      s.fillColors[i] = hlv === 1 ? SSL_FILL_UP : SSL_FILL_DOWN;
      s.emaPlot[i] = { time, value: trendEma, color: EMA_COL };
      s.upPlot[i] = { time, value: up, color: UP_COL };
      s.downPlot[i] = { time, value: down, color: DOWN_COL };
      s.basisPlot[i] = { time, value: bbBasis, color: color.orange };
      s.upperPlot[i] = { time, value: bbUpper, color: color.green };
      s.lowerPlot[i] = { time, value: bbLower, color: color.red };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.emaPlot.slice(),
          plot1: s.upPlot.slice(),
          plot2: s.downPlot.slice(),
          plot3: s.basisPlot.slice(),
          plot4: s.upperPlot.slice(),
          plot5: s.lowerPlot.slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'SSL Fill' }, colors: s.fillColors.slice() },
          { plot1: 'plot4', plot2: 'plot5', options: { title: 'BB Fill', color: BB_FILL } },
        ],
        markers: s.markers.slice(),
        // alertcondition(buySignal, "Buy Signal", ...) / alertcondition(sellSignal, "Sell Signal", ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendContinuationSslBbInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendContinuationSslBbInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'SSL Bullish Signal + Close Above Upper Bollinger Band' },
  { id: 'alert1', title: 'Sell Signal', message: 'SSL Bearish Signal + Close Below Lower Bollinger Band' },
];

export const TrendContinuationSslBb = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
