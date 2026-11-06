/**
 * Aura Sentiment & Risk Flow
 *
 * Sentiment = SMA(RSI(close, Sentiment Length) - 50, Smoothing Factor), drawn as columns coloured by a gradient from
 * the bearish colour (-50) to the bullish colour (+50), grey when the momentum fades (positive and falling, or
 * negative and rising). BUY / SELL labels at -5 / +5 when the sentiment crosses zero, a grey background when
 * |sentiment| > 40. The hidden Risk Flow area is |sentiment| - |riskOsc - riskOscInv|, with Chandelier exits of the
 * highest / lowest close and ATR normalised by the close range.
 * Alerts (alertcondition, `alerts` of the result): 'Aura Buy Signal', 'Aura Sell Signal' (the zero crosses) and
 * 'Aura Extreme Risk' (|sentiment| > 40).
 *
 * Reference: "Aura Sentiment & Risk Flow [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AuraSentimentRiskFlowInputs {
  /** RSI length of the sentiment */
  rsiLen: number;
  /** SMA length of the sentiment */
  smoothLen: number;
  /** ATR / highest / lowest length of the risk */
  atrLen: number;
  /** ATR multiplier of the Chandelier exits */
  atrMult: number;
  colBull: string;
  colBear: string;
  colNeut: string;
}

export const defaultInputs: AuraSentimentRiskFlowInputs = {
  rsiLen: 14,
  smoothLen: 3,
  atrLen: 22,
  atrMult: 3.0,
  colBull: '#089981',
  colBear: '#f23645',
  colNeut: '#787b86',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'Sentiment Length', defval: 14, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Factor', defval: 3, min: 1 },
  { id: 'atrLen', type: 'int', title: 'Risk Lookback', defval: 22, min: 1 },
  { id: 'atrMult', type: 'float', title: 'Risk Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'colBull', type: 'color', title: 'Bullish Color', defval: '#089981' },
  { id: 'colBear', type: 'color', title: 'Bearish Color', defval: '#f23645' },
  { id: 'colNeut', type: 'color', title: 'Neutral/Risk Color', defval: '#787b86' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Sentiment Aura', color: '#089981', lineWidth: 3, style: 'columns' },
  { id: 'plot1', title: 'Signal Edge', color: String(color.new(color.white, 80)), lineWidth: 1 },
  { id: 'plot2', title: 'Risk Flow', color: String(color.new('#787b86', 70)), lineWidth: 1, style: 'area', histbase: -50, display: 'none' },
];

/** hline(0, "Zero Line") with the default colour (the result `hlines` carry the input colour) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: String(color.new('#787b86', 70)), linestyle: 'dotted' },
];

export const metadata = {
  title: 'Aura Sentiment & Risk Flow [Pineify]',
  shortTitle: 'Aura Flow',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface AuraRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  sma: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  hi: WindowExtreme;
  lo: WindowExtreme;
  up: ReturnType<typeof taStep.crossover>;
  dn: ReturnType<typeof taStep.crossunder>;
  sentiment: number[];
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AuraSentimentRiskFlowInputs>): BarStudy<AuraRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const neutFade = String(color.new(cfg.colNeut, 50));
  const bearGrad = String(color.new(cfg.colBear, 20));
  const bullGrad = String(color.new(cfg.colBull, 20));
  const edgeColor = String(color.new(color.white, 80));
  const flowColor = String(color.new(cfg.colNeut, 70));
  const bgExtreme = String(color.new(cfg.colNeut, 90));
  return {
    init() {
      const s: AuraRun = {
        rsi: taStep.rsi(cfg.rsiLen), sma: new WindowSma(cfg.smoothLen), atr: taStep.atr(cfg.atrLen),
        hi: new WindowExtreme(false, cfg.atrLen), lo: new WindowExtreme(true, cfg.atrLen),
        up: taStep.crossover(), dn: taStep.crossunder(),
        sentiment: [], plots: [[], [], []], markers: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.sma, s.atr, s.hi, s.lo, s.up, s.dn];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.sentiment, ...s.plots, ...s.flags];
      return s;
    },
    bar(st, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      // 1. Sentiment
      const rawRSI = st.rsi.step(b.close);
      const s = st.sma.step(rawRSI - 50);
      st.sentiment[i] = s;
      const prev = i > 0 ? st.sentiment[i - 1] : NaN;

      // 2. Risk (Chandelier exits)
      const atrValue = st.atr.step(b.high, b.low, b.close);
      const highestHigh = st.hi.step(b.close);
      const lowestLow = st.lo.step(b.close);

      // Signals: ta.crossover / ta.crossunder of the sentiment with 0
      const crossUp = st.up.step(s, 0);
      const crossDn = st.dn.step(s, 0);

      const chandLong = highestHigh - atrValue * cfg.atrMult;
      const chandShort = lowestLow + atrValue * cfg.atrMult;
      const riskRange = highestHigh - lowestLow;
      // riskRange > 0 ? ... : 0 (na compares false)
      const riskOsc = gt(riskRange, 0) ? ((b.close - chandShort) / riskRange) * 50 : 0;
      const riskOscInv = gt(riskRange, 0) ? ((chandLong - b.close) / riskRange) * 50 : 0;

      const isUptrend = gt(s, 0);
      const isDowntrend = lt(s, 0);
      const momentumFading = (isUptrend && lt(s, prev)) || (isDowntrend && gt(s, prev));
      const colorAura = momentumFading ? neutFade : color.from_gradient(s, -50, 50, bearGrad, bullGrad);

      st.plots[0][i] = { time: t, value: s, color: colorAura };
      st.plots[1][i] = { time: t, value: s, color: edgeColor };
      const riskFlow = Math.abs(s) - Math.abs(riskOsc - riskOscInv);
      st.plots[2][i] = { time: t, value: Number.isFinite(riskFlow) ? riskFlow : NaN, color: flowColor };

      // plotshape(buySignal ? -5 : na, style = shape.labelup, location = location.absolute, ...)
      if (crossUp) {
        st.markers.push({ time: t, position: 'atPriceBottom', price: -5, shape: 'labelUp', color: cfg.colBull,
          text: 'BUY', textColor: color.white, size: 'tiny' });
      }
      // plotshape(sellSignal ? 5 : na, style = shape.labeldown, location = location.absolute, ...)
      if (crossDn) {
        st.markers.push({ time: t, position: 'atPriceTop', price: 5, shape: 'labelDown', color: cfg.colBear,
          text: 'SELL', textColor: color.white, size: 'tiny' });
      }
      // bgcolor(math.abs(sentimentOsc) > 40 ? color.new(colNeut, 90) : na)
      const isExtreme = gt(Math.abs(s), 40);
      if (isExtreme) st.bgColors.push({ time: t, color: bgExtreme });
      // alertcondition(buySignal) / alertcondition(sellSignal) / alertcondition(isExtreme)
      const f = [crossUp, crossDn, isExtreme];
      for (let k = 0; k < 3; k++) {
        st.flags[k][i] = f[k];
        if (f[k]) st.times[k].push(t);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: String(color.new(cfg.colNeut, 70)), linestyle: 'dotted' } },
        ],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AuraSentimentRiskFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AuraSentimentRiskFlowInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Aura Buy Signal', message: 'Aura Flow: BUY Signal - Bullish Sentiment Crossing Up' },
  { id: 'alert1', title: 'Aura Sell Signal', message: 'Aura Flow: SELL Signal - Bearish Sentiment Crossing Down' },
  { id: 'alert2', title: 'Aura Extreme Risk', message: 'Aura Flow: Extreme Risk Zone - Sentiment at extremes' },
];

export const AuraSentimentRiskFlow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
