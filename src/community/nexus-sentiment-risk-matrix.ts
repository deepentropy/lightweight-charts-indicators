/**
 * Nexus Sentiment & Risk Matrix
 *
 * Sentiment = average of RSI(close, len), SMA(Stochastic(len), 3) and the CCI(close, len) mapped to 0..100
 * (above 100 -> 100, below -100 -> 0, else (CCI + 100) / 2), coloured by a gradient from the bearish colour (0) to
 * the bullish colour (100), with gradient fills to the 50 line. Risk direction (Chandelier model): 1 when the close
 * is above lowest low + ATR * mult, -1 when it is below highest high - ATR * mult, else unchanged. BUY when the risk
 * direction rises while the sentiment is above 50, SELL when it falls while the sentiment is below 50.
 *
 * Alerts (alertcondition, `alerts` of the result): "Nexus Buy Signal" (BUY) and "Nexus Sell Signal" (SELL).
 *
 * Reference: "Nexus Sentiment & Risk Matrix [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Nexus Buy Signal', message: 'Risk-On: Bullish Sentiment & Risk metrics aligned.' },
  { id: 'alert1', title: 'Nexus Sell Signal', message: 'Risk-Off: Bearish Sentiment & Risk metrics aligned.' },
];

export interface NexusSentimentRiskMatrixInputs {
  /** Shared length of RSI, Stochastic and CCI */
  len: number;
  /** ATR / highest / lowest length of the Chandelier model */
  atrLen: number;
  /** ATR multiplier of the Chandelier levels */
  atrMult: number;
}

export const defaultInputs: NexusSentimentRiskMatrixInputs = {
  len: 14,
  atrLen: 22,
  atrMult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Oscillator Length', defval: 14, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 22, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

const BULL = '#089981';
const BEAR = '#f23645';
const NEUTRAL = '#787b86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Equilibrium Level', color: String(color.new(NEUTRAL, 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Nexus Sentiment', color: BULL, lineWidth: 2 },
];

export const metadata = {
  title: 'Nexus Sentiment & Risk Matrix [Pineify]',
  shortTitle: 'Nexus S&R [Pineify]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface NexusVars {
  /** var int riskDir = 1 */
  dir: number;
  /** ta.stoch: the value of the bar before (kept on a bar where it is na) */
  stoch: number;
}

interface NexusRun extends BarRunState<NexusVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  /** ta.stoch(close, high, low, len): highest high / lowest low of the window */
  stochHi: WindowExtreme;
  stochLo: WindowExtreme;
  stochSma: WindowSma;
  cci: ReturnType<typeof taStep.cci>;
  atr: ReturnType<typeof taStep.atr>;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  sentiment: number[];
  riskDir: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NexusSentimentRiskMatrixInputs>): BarStudy<NexusRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fill0Top = String(color.new(BULL, 70));
  const fill0Bottom = String(color.new(BULL, 90));
  const fill1Top = String(color.new(BEAR, 90));
  const fill1Bottom = String(color.new(BEAR, 70));
  const midColor = String(color.new(NEUTRAL, 50));
  return {
    init() {
      const s: NexusRun = {
        rsi: taStep.rsi(cfg.len), stochHi: new WindowExtreme(false, cfg.len), stochLo: new WindowExtreme(true, cfg.len),
        stochSma: new WindowSma(3), cci: taStep.cci(cfg.len),
        atr: taStep.atr(cfg.atrLen), highest: new WindowExtreme(false, cfg.atrLen), lowest: new WindowExtreme(true, cfg.atrLen),
        sentiment: [], riskDir: [], plot0: [], plot1: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { dir: 1, stoch: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.stochHi, s.stochLo, s.stochSma, s.cci, s.atr, s.highest, s.lowest];
      s.lists = [s.markers, ...s.times];
      s.series = [s.sentiment, s.riskDir, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Sentiment
      const rsiVal = s.rsi.step(b.close);
      const lo = s.stochLo.step(b.low);
      const k = (100 * (b.close - lo)) / (s.stochHi.step(b.high) - lo);
      if (!Number.isNaN(k)) s.vars.stoch = k;
      const stochVal = s.stochSma.step(s.vars.stoch);
      const c = s.cci.step(b.close);
      // cciRaw > 100 ? 100 : cciRaw < -100 ? 0 : (cciRaw + 100) / 2
      const cciNorm = gt(c, 100) ? 100 : lt(c, -100) ? 0 : (c + 100) / 2;
      // math.avg: na when an argument is na
      const sent = (rsiVal + stochVal + cciNorm) / 3;
      s.sentiment[i] = sent;

      // Risk (Chandelier)
      const atrValue = s.atr.step(b.high, b.low, b.close);
      const chandLong = s.highest.step(b.high) - atrValue * cfg.atrMult;
      const chandShort = s.lowest.step(b.low) + atrValue * cfg.atrMult;
      // riskDir := close > nz(chandShort, high) ? 1 : close < nz(chandLong, low) ? -1 : riskDir
      const shortLvl = isNaN(chandShort) ? b.high : chandShort;
      const longLvl = isNaN(chandLong) ? b.low : chandLong;
      s.vars.dir = gt(b.close, shortLvl) ? 1 : lt(b.close, longLvl) ? -1 : s.vars.dir;
      s.riskDir[i] = s.vars.dir;

      const t = b.time as number;
      s.plot0[i] = { time: t, value: 50, color: midColor };
      s.plot1[i] = { time: t, value: sent, color: color.from_gradient(sent, 0, 100, BEAR, BULL) };
      // ta.change(riskDir) > 0 and sentiment > 50 / ta.change(riskDir) < 0 and sentiment < 50 (na on bar 0)
      const ch = i > 0 ? s.riskDir[i] - s.riskDir[i - 1] : NaN;
      const buy = gt(ch, 0) && gt(sent, 50);
      const sell = lt(ch, 0) && lt(sent, 50);
      if (buy) {
        s.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: BULL, text: 'BUY', textColor: BULL, size: 'small' });
      }
      if (sell) {
        s.markers.push({ time: t, position: 'top', shape: 'triangleDown', color: BEAR, text: 'SELL', textColor: BEAR, size: 'small' });
      }
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(t);
      if (sell) s.times[1].push(t);
    },
    result(s, bars) {
      const n = bars.length;
      const sentiment = s.sentiment;
      // fill(pSent, pMid, top_value = math.max(sentiment, 50), bottom_value = 50, color.new(bull, 70), color.new(bull, 90))
      // fill(pMid, pSent, top_value = 50, bottom_value = math.min(sentiment, 50), color.new(bear, 90), color.new(bear, 70))
      // math.max / math.min: na when the sentiment is na
      const fills = [
        { plot1: 'plot1', plot2: 'plot0', options: { title: 'Bullish Zone' },
          gradient: {
            topValue: sentiment.map((v) => Math.max(v, 50)),
            bottomValue: new Array<number>(n).fill(50),
            topColor: new Array<string | null>(n).fill(fill0Top),
            bottomColor: new Array<string | null>(n).fill(fill0Bottom),
          } },
        { plot1: 'plot0', plot2: 'plot1', options: { title: 'Bearish Zone' },
          gradient: {
            topValue: new Array<number>(n).fill(50),
            bottomValue: sentiment.map((v) => Math.min(v, 50)),
            topColor: new Array<string | null>(n).fill(fill1Top),
            bottomColor: new Array<string | null>(n).fill(fill1Bottom),
          } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NexusSentimentRiskMatrixInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<NexusSentimentRiskMatrixInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const NexusSentimentRiskMatrix = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
