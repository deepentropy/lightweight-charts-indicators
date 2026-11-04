/**
 * Pro Scalper AI
 *
 * Composite oscillator of four normalised parts, each read on confirmed bars only (on an open last bar every input
 * and output keeps the value of the bar before, as the original's `f_nr()`):
 * - trend: the direction of +DI / -DI times the ADX scaled from 20 (0) to 40 (1)
 * - momentum: the original compares its "Momentum Mode" input ("Stochastic RSI", "Fisher RSI", "Williams %R") with
 *   "Mode 1" / "Mode 2" / "Mode 3", which never match: the momentum part is always 0 and the dashboard shows mode "3"
 * - volatility: ATR / close * 2 - 1
 * - volume: the OBV scaled into [-1, 1] over "Volume Lookback" bars
 * With "Use Dynamic Weighting?" the trend weight is multiplied by ADX / 25 (at most "Max Trend Factor") and the
 * volatility weight by (ATR / close) / 0.005 (at most "Max Volatility Factor"). The weighted average times 100 is
 * the oscillator; the dynamic thresholds are the base thresholds plus / minus the standard deviation of the
 * oscillator times "Dynamic Threshold Multiplier". With "Use AI Forecast?" a linear regression forecast of the close
 * is scaled into the oscillator range and shifts the thresholds by "AI Threshold Shift" (the "AI Bias" plot).
 * A local HMA of the close gives the trend; with "Use Higher Timeframe Trend Filter?" the HMA of the close on "HTF"
 * (`request.security` of the chart symbol, no lookahead) filters the strong signals.
 *
 * Signals: strong buy (oscillator above the adjusted upper threshold, close above the HMA, HTF trend up when used,
 * ADX above 20), strong sell (the mirror), early buy (between the base and the adjusted upper threshold), early sell.
 * With "Enable Latching?" a state machine keeps the state between confirmed bars (latched markers), else the signal of
 * each bar is shown (immediate markers). The band between the thresholds is filled with the colour of the active
 * signal; a dashboard table shows the values of the last confirmed bar.
 *
 * A higher "HTF" is built from the chart bars; a lower one comes from the chart context (`requiredSymbols`, `bars`
 * accessor), else the port throws a MissingSymbolDataError. The original also computes a TDI (RSI and EMA) that it
 * never shows, and the inputs "Use MACD Filter?", "Use Pinbar Filter?", the stochastic / Fisher / Williams lengths and
 * the hysteresis inputs have no effect in it: they are kept as inputs and not used.
 *
 * Reference: "Pro Scalper AI [BullByte]" by BullByte
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BullByte
 */

import {
  ta, Series, str, color, timeframe, mapToChart,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type ShapeConfig,
  type FillData, type TableData, type TableCellData,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { lastBarConfirmedOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { securityOtherValues, otherSymbolChart } from '../other-symbol';

export interface ProScalperAiInputs {
  useHTF: boolean;
  htfTf: string;
  useMACDFilter: boolean;
  usePinbarFilter: boolean;
  adxLen: number;
  diLen: number;
  atrLen: number;
  hmaLen: number;
  momChoice: 'Stochastic RSI' | 'Fisher RSI' | 'Williams %R';
  stochRsiLen: number;
  stochKLen: number;
  stochDLen: number;
  fisherRsiLen: number;
  wprLen: number;
  tdiRsiLen: number;
  tdiSignalLen: number;
  wTrend: number;
  wMomentum: number;
  wVolatility: number;
  wVolume: number;
  baseUpper: number;
  baseLower: number;
  dynMultiplier: number;
  oscLookback: number;
  useHysteresis: boolean;
  baseHystGap: number;
  hystMultiplier: number;
  useDynamicW: boolean;
  maxVolFactor: number;
  maxTrendFactor: number;
  volLookback: number;
  useAI: boolean;
  aiLength: number;
  aiFuture: number;
  aiAdjustment: number;
  aiSmoothing: boolean;
  useLatching: boolean;
  dashboardSizeOption: 'Tiny' | 'Small' | 'Normal' | 'Large';
}

export const defaultInputs: ProScalperAiInputs = {
  useHTF: false,
  htfTf: '15',
  useMACDFilter: false,
  usePinbarFilter: false,
  adxLen: 14,
  diLen: 14,
  atrLen: 14,
  hmaLen: 21,
  momChoice: 'Stochastic RSI',
  stochRsiLen: 12,
  stochKLen: 3,
  stochDLen: 3,
  fisherRsiLen: 14,
  wprLen: 14,
  tdiRsiLen: 13,
  tdiSignalLen: 7,
  wTrend: 0.3,
  wMomentum: 0.3,
  wVolatility: 0.2,
  wVolume: 0.2,
  baseUpper: 25.0,
  baseLower: -25.0,
  dynMultiplier: 0.5,
  oscLookback: 50,
  useHysteresis: true,
  baseHystGap: 1.0,
  hystMultiplier: 1.0,
  useDynamicW: true,
  maxVolFactor: 2.0,
  maxTrendFactor: 1.5,
  volLookback: 50,
  useAI: false,
  aiLength: 20,
  aiFuture: 2,
  aiAdjustment: 1.5,
  aiSmoothing: true,
  useLatching: true,
  dashboardSizeOption: 'Normal',
};

export const inputConfig: InputConfig[] = [
  { id: 'useHTF', type: 'bool', title: 'Use Higher Timeframe Trend Filter?', defval: false, inline: 'HTF' },
  { id: 'htfTf', type: 'timeframe', title: 'HTF', defval: '15', inline: 'HTF' },
  { id: 'useMACDFilter', type: 'bool', title: 'Use MACD Filter?', defval: false },
  { id: 'usePinbarFilter', type: 'bool', title: 'Use Pinbar Filter?', defval: false },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'hmaLen', type: 'int', title: 'HMA Length', defval: 21 },
  { id: 'momChoice', type: 'string', title: 'Momentum Mode', defval: 'Stochastic RSI', options: ['Stochastic RSI', 'Fisher RSI', 'Williams %R'] },
  { id: 'stochRsiLen', type: 'int', title: 'Stoch RSI Length', defval: 12, group: 'Stoch RSI' },
  { id: 'stochKLen', type: 'int', title: 'Stoch RSI %K Smoothing', defval: 3, group: 'Stoch RSI' },
  { id: 'stochDLen', type: 'int', title: 'Stoch RSI %D Smoothing', defval: 3, group: 'Stoch RSI' },
  { id: 'fisherRsiLen', type: 'int', title: 'Fisher RSI Length', defval: 14, group: 'Fisher RSI' },
  { id: 'wprLen', type: 'int', title: 'Williams %R Length', defval: 14, group: 'Williams %R' },
  { id: 'tdiRsiLen', type: 'int', title: 'TDI RSI Length', defval: 13 },
  { id: 'tdiSignalLen', type: 'int', title: 'TDI Signal Length', defval: 7 },
  { id: 'wTrend', type: 'float', title: 'Trend Weight', defval: 0.3, step: 0.1 },
  { id: 'wMomentum', type: 'float', title: 'Momentum Weight', defval: 0.3, step: 0.1 },
  { id: 'wVolatility', type: 'float', title: 'Volatility Weight', defval: 0.2, step: 0.1 },
  { id: 'wVolume', type: 'float', title: 'Volume Weight', defval: 0.2, step: 0.1 },
  { id: 'baseUpper', type: 'float', title: 'Base Upper Threshold', defval: 25.0, step: 0.1 },
  { id: 'baseLower', type: 'float', title: 'Base Lower Threshold', defval: -25.0, step: 0.1 },
  { id: 'dynMultiplier', type: 'float', title: 'Dynamic Threshold Multiplier', defval: 0.5, step: 0.1 },
  { id: 'oscLookback', type: 'int', title: 'Oscillator Std Dev Lookback', defval: 50 },
  { id: 'useHysteresis', type: 'bool', title: 'Use Adaptive Hysteresis?', defval: true },
  { id: 'baseHystGap', type: 'float', title: 'Base Hysteresis Gap', defval: 1.0, step: 0.1 },
  { id: 'hystMultiplier', type: 'float', title: 'Hysteresis Volatility Multiplier', defval: 1.0, step: 0.1 },
  { id: 'useDynamicW', type: 'bool', title: 'Use Dynamic Weighting?', defval: true },
  { id: 'maxVolFactor', type: 'float', title: 'Max Volatility Factor', defval: 2.0, step: 0.1 },
  { id: 'maxTrendFactor', type: 'float', title: 'Max Trend Factor', defval: 1.5, step: 0.1 },
  { id: 'volLookback', type: 'int', title: 'Volume Lookback', defval: 50 },
  { id: 'useAI', type: 'bool', title: 'Use AI Forecast?', defval: false },
  { id: 'aiLength', type: 'int', title: 'AI Length', defval: 20, min: 1 },
  { id: 'aiFuture', type: 'int', title: 'AI Forecast Bars Ahead', defval: 2, min: 1 },
  { id: 'aiAdjustment', type: 'float', title: 'AI Threshold Shift', defval: 1.5, step: 0.1 },
  { id: 'aiSmoothing', type: 'bool', title: 'Smooth AI Forecast?', defval: true },
  { id: 'useLatching', type: 'bool', title: 'Enable Latching?', defval: true },
  { id: 'dashboardSizeOption', type: 'string', title: 'Dashboard Text Size', defval: 'Normal', options: ['Tiny', 'Small', 'Normal', 'Large'] },
];

/** Pine v6 colours */
const GREEN = '#4CAF50';
const RED = '#F23645';
const LIME = '#00E676';
const MAROON = '#880E4F';
const GRAY = '#787B86';
const PURPLE = '#9C27B0';
const BLUE = '#2962FF';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Composite Oscillator', color: GREEN, lineWidth: 2 },
  { id: 'plot1', title: 'Zero Line', color: GRAY, lineWidth: 1 },
  { id: 'plot2', title: 'Dynamic Upper Threshold', color: PURPLE, lineWidth: 1 },
  { id: 'plot3', title: 'Dynamic Lower Threshold', color: PURPLE, lineWidth: 1 },
  { id: 'plot4', title: 'AI Bias', color: BLUE, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot2', plot2: 'plot3', title: 'Band Background' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Immediate Strong Buy', style: 'circle', location: 'bottom', color: GREEN, size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Immediate Strong Sell', style: 'circle', location: 'top', color: RED, size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Immediate Early Buy', style: 'cross', location: 'bottom', color: LIME, size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Immediate Early Sell', style: 'cross', location: 'top', color: MAROON, size: 'tiny' },
  { id: 'shape4', kind: 'shape', title: 'Latched Strong Buy', style: 'triangleup', location: 'bottom', color: GREEN, size: 'tiny' },
  { id: 'shape5', kind: 'shape', title: 'Latched Strong Sell', style: 'triangledown', location: 'top', color: RED, size: 'tiny' },
  { id: 'shape6', kind: 'shape', title: 'Latched Early Buy', style: 'diamond', location: 'bottom', color: LIME, size: 'tiny' },
  { id: 'shape7', kind: 'shape', title: 'Latched Early Sell', style: 'diamond', location: 'top', color: MAROON, size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['table'];

export const metadata = {
  title: ' Pro Scalper AI [BullByte]',
  shortTitle: ' Pro Scalper AI [BullByte]',
  overlay: false,
};

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** nz(): na and +-infinity give 0 */
const nz = (v: number) => (Number.isFinite(v) ? v : 0);
const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

/** True when `tf` is a timeframe below the chart timeframe */
function lowerTimeframe(tf: string, chartTf: string): boolean {
  return tf.trim() !== '' && chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf);
}

/** The chart symbol on "HTF" when the filter is on and "HTF" is below the chart timeframe (the bars do not carry it) */
export function requiredSymbols(inputs: Partial<ProScalperAiInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chart?.timeframe ?? '';
  if (!cfg.useHTF || !lowerTimeframe(cfg.htfTf, chartTf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.htfTf }];
}

/** The local hma() of the original: wma(2 * wma(src, round(len / 2)) - wma(src, len), round(sqrt(len))) */
function hma(bars: Bar[], src: number[], length: number): number[] {
  const s = Series.fromArray(bars, src);
  const wma1 = A(ta.wma(s, length));
  const wma2 = A(ta.wma(s, Math.round(length / 2)));
  const diff = wma2.map((v, i) => 2 * v - wma1[i]);
  return A(ta.wma(Series.fromArray(bars, diff), Math.round(Math.sqrt(length))));
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ProScalperAiInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; fills: FillData[]; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lastConfirmed = lastBarConfirmedOf(chart);
  const confirmed = (i: number) => i < n - 1 || lastConfirmed;
  // f_nr(src) => barstate.isconfirmed ? src : nz(src[1])
  const fnr = (src: number[]) => src.map((v, i) => (confirmed(i) ? v : nz(i > 0 ? src[i - 1] : NaN)));
  const S = (arr: number[]) => Series.fromArray(bars, arr);

  const cHigh = fnr(bars.map((b) => b.high));
  const cLow = fnr(bars.map((b) => b.low));
  const cClose = fnr(bars.map((b) => b.close));
  const cVolume = fnr(bars.map((b) => b.volume ?? NaN));

  // 3.1 f_tr(): true range with nz(close[1])
  const tr = cHigh.map((h, i) => {
    const c1 = nz(i > 0 ? cClose[i - 1] : NaN);
    return Math.max(h - cLow[i], Math.abs(h - c1), Math.abs(cLow[i] - c1));
  });

  // 3.2 ADX & DI
  const plusDM = cHigh.map((h, i) => {
    const up = i > 0 ? h - cHigh[i - 1] : NaN;
    const down = i > 0 ? -(cLow[i] - cLow[i - 1]) : NaN;
    return isNaN(up) ? NaN : (gt(up, down) && gt(up, 0) ? up : 0);
  });
  const minusDM = cHigh.map((h, i) => {
    const up = i > 0 ? h - cHigh[i - 1] : NaN;
    const down = i > 0 ? -(cLow[i] - cLow[i - 1]) : NaN;
    return isNaN(down) ? NaN : (gt(down, up) && gt(down, 0) ? down : 0);
  });
  const truerange = A(ta.rma(S(tr), cfg.diLen));
  const rmaPlus = A(ta.rma(S(plusDM), cfg.diLen));
  const rmaMinus = A(ta.rma(S(minusDM), cfg.diLen));
  const diplus = rmaPlus.map((v, i) => nz((100 * v) / truerange[i]));
  const diminus = rmaMinus.map((v, i) => nz((100 * v) / truerange[i]));
  const ratio = diplus.map((p, i) => {
    const sum = p + diminus[i];
    return Math.abs(p - diminus[i]) / (eq(sum, 0) ? 1 : sum);
  });
  const adxVal = A(ta.rma(S(ratio), cfg.adxLen)).map((v) => 100 * v);
  const normTrend = adxVal.map((adx, i) => {
    const trendDir = gt(diplus[i], diminus[i]) ? 1.0 : gt(diminus[i], diplus[i]) ? -1.0 : 0.0;
    return trendDir * Math.min(Math.max((adx - 20) / 20, 0.0), 1.0);
  });
  const confirmedADX = fnr(adxVal);
  const confirmedNormTrend = fnr(normTrend);

  // 3.3 Volatility
  const atrVal = A(ta.rma(S(tr), cfg.atrLen));
  const normATR = atrVal.map((v, i) => v / cClose[i]);
  const confirmedNormVolatility = fnr(normATR.map((v) => v * 2 - 1));

  // 3.4 Momentum: momChoice is never "Mode 1" / "Mode 2" / "Mode 3" (see the header): momentumVal stays 0.0
  const confirmedMomentum = 0.0;

  // 3.6 Volume: OBV
  const obv: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? nz(obv[i - 1]) : 0;
    const c1 = i > 0 ? cClose[i - 1] : NaN;
    obv[i] = prev + (gt(cClose[i], c1) ? cVolume[i] : lt(cClose[i], c1) ? -cVolume[i] : 0);
  }
  const obvMin = A(ta.lowest(S(obv), cfg.volLookback));
  const obvMax = A(ta.highest(S(obv), cfg.volLookback));
  const normVolumeRaw = obv.map((v, i) => ((v - obvMin[i]) / Math.max(obvMax[i] - obvMin[i], 0.0001)) * 2 - 1);
  const confirmedVolumeNorm = fnr(normVolumeRaw);

  // 3.7 Dynamic weighting, 3.8 composite oscillator
  const volFactor = normATR.map((v) => (cfg.useDynamicW ? Math.min(v / 0.005, cfg.maxVolFactor) : 1.0));
  const trendFactor = adxVal.map((v) => (cfg.useDynamicW ? Math.min(v / 25.0, cfg.maxTrendFactor) : 1.0));
  const oscillator = bars.map((_b, i) => {
    const effWTrend = cfg.wTrend * trendFactor[i];
    const effWVolatility = cfg.wVolatility * volFactor[i];
    const totalWeight = effWTrend + cfg.wMomentum + effWVolatility + cfg.wVolume;
    const raw = (effWTrend * confirmedNormTrend[i] + cfg.wMomentum * confirmedMomentum
      + effWVolatility * confirmedNormVolatility[i] + cfg.wVolume * confirmedVolumeNorm[i]) / totalWeight;
    return raw * 100;
  });
  const confirmedOscillator = fnr(oscillator);
  const oscStd = A(ta.stdev(S(confirmedOscillator), cfg.oscLookback));
  const confirmedUpperThreshold = fnr(oscStd.map((v) => cfg.baseUpper + v * cfg.dynMultiplier));
  const confirmedLowerThreshold = fnr(oscStd.map((v) => cfg.baseLower - v * cfg.dynMultiplier));

  // 3.9 AI forecast
  let aiBias: number[] = new Array(n).fill(0.0);
  if (cfg.useAI) {
    const close = S(cClose);
    const aiValue = A(ta.linreg(close, cfg.aiLength, 0));
    const aiValue1 = A(ta.linreg(close, cfg.aiLength, 1));
    const aiPred = aiValue.map((v, i) => v + (v - aiValue1[i]) * cfg.aiFuture);
    const aiPredSmooth = cfg.aiSmoothing ? A(ta.sma(S(aiPred), 2)) : aiPred;
    const oscLb = A(ta.lowest(S(confirmedOscillator), cfg.aiLength));
    const oscHb = A(ta.highest(S(confirmedOscillator), cfg.aiLength));
    const aiLb = A(ta.lowest(S(aiPredSmooth), cfg.aiLength));
    const aiHb = A(ta.highest(S(aiPredSmooth), cfg.aiLength));
    const oscMid = (cfg.baseUpper + cfg.baseLower) / 2;
    aiBias = aiPredSmooth.map((p, i) => {
      const oscRange = Math.max(oscHb[i] - oscLb[i], 0.001);
      const aiRange = Math.max(aiHb[i] - aiLb[i], 0.001);
      const aiOsc = ((p - aiLb[i]) / aiRange) * oscRange + oscLb[i];
      return aiOsc - oscMid;
    });
  }
  const confirmedAiBias = fnr(aiBias);
  const confirmedAdjustedUpperThreshold = fnr(confirmedUpperThreshold.map((u, i) => (cfg.useAI
    ? u + (gt(confirmedAiBias[i], 0) ? cfg.aiAdjustment : 0) : u)));
  const confirmedAdjustedLowerThreshold = fnr(confirmedLowerThreshold.map((l, i) => (cfg.useAI
    ? l + (lt(confirmedAiBias[i], 0) ? -cfg.aiAdjustment : 0) : l)));

  // 3.10 Trend via the local HMA
  const localHMA = hma(bars, cClose, cfg.hmaLen);
  const confirmedTrendHMA = fnr(cClose.map((c, i) => (gt(c, localHMA[i]) ? 1.0 : lt(c, localHMA[i]) ? -1.0 : 0.0)));

  // Higher timeframe trend: request.security(syminfo.tickerid, htf_tf, hma(cClose, hmaLen), lookahead_off)
  let htfTrend: number[] = new Array(n).fill(0.0);
  if (cfg.useHTF && n > 0) {
    const chartTf = chartTimeframe(bars, chart);
    let htfHMA: number[];
    if (cfg.htfTf.trim() === '' || chartTf === '' || timeframe.in_seconds(cfg.htfTf) === timeframe.in_seconds(chartTf)) {
      htfHMA = localHMA;
    } else if (lowerTimeframe(cfg.htfTf, chartTf)) {
      // the chart symbol on the lower timeframe: the value of the last lower bar of each chart bar
      const [ltf] = symbolBarsOf(requiredSymbols(cfg, { ...chart, timeframe: chartTf }), chart);
      const ltfConfirmed = lastConfirmed;
      const ltfClose = ltf.map((b, k) => (k < ltf.length - 1 || ltfConfirmed ? b.close : nz(k > 0 ? ltf[k - 1].close : NaN)));
      const values = hma(ltf, ltfClose, cfg.hmaLen);
      htfHMA = securityOtherValues(bars, ltf, cfg.htfTf, values, otherSymbolChart(bars, chart),
        { other: { timezone: chart?.timezone, session: chart?.session } });
    } else {
      const sec = higherTimeframeBars(bars, cfg.htfTf, chart);
      // the open last higher-timeframe bar reads its close through f_nr() too
      const lastHtf = sec.htf.length - 1;
      const htfClose = sec.htf.map((b, k) => (k < lastHtf || sec.lastCompletes || lastConfirmed ? b.close
        : nz(k > 0 ? sec.htf[k - 1].close : NaN)));
      htfHMA = mapToChart(hma(sec.htf, htfClose, cfg.hmaLen), sec.group, sec.latest, false, false);
    }
    htfTrend = htfHMA.map((h, i) => (isNaN(h) ? 0.0 : gt(cClose[i], h) ? 1.0 : lt(cClose[i], h) ? -1.0 : 0.0));
  }
  const confirmedHTFTrend = fnr(htfTrend);

  // 4. Signals
  const markers: MarkerData[] = [];
  const fillColors: string[] = [];
  const activeAt: string[] = [];
  let storedState = 'Neutral';
  for (let i = 0; i < n; i++) {
    const osc = confirmedOscillator[i];
    const adjU = confirmedAdjustedUpperThreshold[i];
    const adjL = confirmedAdjustedLowerThreshold[i];
    const condStrongBuy = gt(osc, adjU) && gt(confirmedTrendHMA[i], 0) && (!cfg.useHTF || gt(confirmedHTFTrend[i], 0))
      && gt(confirmedADX[i], 20);
    const condStrongSell = lt(osc, adjL) && lt(confirmedTrendHMA[i], 0) && (!cfg.useHTF || lt(confirmedHTFTrend[i], 0))
      && gt(confirmedADX[i], 20);
    const condEarlyBuy = gt(osc, cfg.baseUpper) && lt(osc, adjU);
    const condEarlySell = lt(osc, cfg.baseLower) && gt(osc, adjL);

    const immediateSignal = condStrongBuy ? 'Strong Buy' : condStrongSell ? 'Strong Sell'
      : condEarlyBuy ? 'Early Buy' : condEarlySell ? 'Early Sell' : 'No Signal';

    if (cfg.useLatching && confirmed(i)) {
      if (storedState === 'Neutral') {
        if (condEarlyBuy) storedState = 'EarlyBuy';
        else if (condEarlySell) storedState = 'EarlySell';
        else if (condStrongBuy) storedState = 'Long';
        else if (condStrongSell) storedState = 'Short';
      } else if (storedState === 'EarlyBuy') {
        if (condStrongBuy) storedState = 'Long';
        else if (!condEarlyBuy) storedState = 'Neutral';
      } else if (storedState === 'Long') {
        if (condStrongSell) storedState = 'Short';
        else if (condEarlySell) storedState = 'EarlySell';
      } else if (storedState === 'EarlySell') {
        if (condStrongSell) storedState = 'Short';
        else if (!condEarlySell) storedState = 'Neutral';
      } else if (storedState === 'Short') {
        if (condStrongBuy) storedState = 'Long';
        else if (condEarlyBuy) storedState = 'EarlyBuy';
      }
    }
    const storedSignal = storedState === 'Long' ? 'Strong Buy' : storedState === 'Short' ? 'Strong Sell'
      : storedState === 'EarlyBuy' ? 'Early Buy' : storedState === 'EarlySell' ? 'Early Sell' : 'No Signal';

    const activeSignal = cfg.useLatching ? storedSignal : immediateSignal;
    activeAt.push(activeSignal);
    fillColors.push(activeSignal === 'Strong Buy' ? String(color.new(GREEN, 80))
      : activeSignal === 'Strong Sell' ? String(color.new(RED, 80))
        : activeSignal === 'Early Buy' ? String(color.new(LIME, 80))
          : activeSignal === 'Early Sell' ? String(color.new(MAROON, 80)) : String(color.new(BLUE, 90)));

    const time = bars[i].time as number;
    const mark = (k: number, on: boolean) => {
      if (!on) return;
      const cfgK = shapeConfig[k];
      const shape = ({ circle: 'circle', cross: 'cross', triangleup: 'triangleUp', triangledown: 'triangleDown', diamond: 'diamond' } as const)[
        cfgK.style as 'circle' | 'cross' | 'triangleup' | 'triangledown' | 'diamond'];
      markers.push({ id: cfgK.id, time, position: cfgK.location === 'top' ? 'top' : 'bottom', shape, color: cfgK.color as string, size: 'tiny' });
    };
    mark(0, !cfg.useLatching && immediateSignal === 'Strong Buy');
    mark(1, !cfg.useLatching && immediateSignal === 'Strong Sell');
    mark(2, !cfg.useLatching && immediateSignal === 'Early Buy');
    mark(3, !cfg.useLatching && immediateSignal === 'Early Sell');
    mark(4, cfg.useLatching && storedState === 'Long');
    mark(5, cfg.useLatching && storedState === 'Short');
    mark(6, cfg.useLatching && storedState === 'EarlyBuy');
    mark(7, cfg.useLatching && storedState === 'EarlySell');
  }

  // 6. Dashboard: written on every confirmed bar, so it shows the last confirmed bar
  const tables: TableData[] = [];
  const t = lastConfirmed ? n - 1 : n - 2;
  if (t >= 0) {
    const textSize = ({ Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large' } as const)[cfg.dashboardSizeOption] ?? 'large';
    const g70 = String(color.new(GREEN, 70));
    const r70 = String(color.new(RED, 70));
    const gray80 = String(color.new(GRAY, 80));
    const cellColor = (v: number) => (gt(v, 0) ? g70 : lt(v, 0) ? r70 : gray80);
    const arrow = (s: number[]) => {
      const diff = t < 1 || isNaN(s[t - 1]) ? 0 : s[t] - s[t - 1];
      return gt(diff, 0) ? '⬆️' : lt(diff, 0) ? '⬇️' : '';
    };
    const trendText = (v: number) => (gt(v, 0) ? 'Bullish' : lt(v, 0) ? 'Bearish' : 'Flat');
    const activeSig = activeAt[t];
    const cells: TableCellData[] = [];
    const row = (r: number, name: string, text: string, bgColor: string) => {
      cells.push({ column: 0, row: r, text: name, textColor: WHITE, bgColor: BLACK, textSize });
      cells.push({ column: 1, row: r, text, textColor: WHITE, bgColor, textSize });
    };
    row(0, 'ADX', `${str.tostring(confirmedADX[t], '#.##')} ${arrow(confirmedADX)}`, gt(confirmedADX[t], 25) ? g70 : r70);
    row(1, 'Osc', str.tostring(confirmedOscillator[t], '#.##'), cellColor(confirmedOscillator[t]));
    row(2, 'Mom Mode', '3', gray80);
    row(3, 'TrendHMA', trendText(confirmedTrendHMA[t]), cellColor(confirmedTrendHMA[t]));
    row(4, 'HTF Trend', cfg.useHTF ? trendText(confirmedHTFTrend[t]) : 'Off', cellColor(confirmedHTFTrend[t]));
    row(5, 'VolFactor', str.tostring(volFactor[t], '#.##'), gt(volFactor[t], 1) ? g70 : gray80);
    row(6, 'Signal', activeSig, activeSig === 'Strong Buy' ? g70 : activeSig === 'Strong Sell' ? r70 : gray80);
    row(7, 'AI Bias', cfg.useAI ? str.tostring(confirmedAiBias[t], '#.##') : 'Disabled', cellColor(confirmedAiBias[t]));
    row(8, 'Volume', `${str.tostring(confirmedVolumeNorm[t], '#.##')} ${arrow(confirmedVolumeNorm)}`, cellColor(confirmedVolumeNorm[t]));
    tables.push({ position: 'top_right', columns: 3, rows: 9, borderWidth: 1, cells });
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const g = String(color.new(GREEN, 0));
  const r = String(color.new(RED, 0));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(confirmedOscillator[i]), color: ge(confirmedOscillator[i], 0) ? g : r })),
      plot1: bars.map((b) => ({ time: b.time, value: 0, color: GRAY })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(confirmedUpperThreshold[i]), color: PURPLE })),
      plot3: bars.map((b, i) => ({ time: b.time, value: fin(confirmedLowerThreshold[i]), color: PURPLE })),
      plot4: bars.map((b, i) => ({ time: b.time, value: cfg.useAI ? fin(confirmedAiBias[i]) : NaN, color: BLUE })),
    },
    fills: [{ id: 'fill0', plot1: 'plot2', plot2: 'plot3', options: { title: 'Band Background' }, colors: fillColors }],
    markers,
    tables,
  };
}

export const ProScalperAi = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, drawingKinds, requiredSymbols,
};
