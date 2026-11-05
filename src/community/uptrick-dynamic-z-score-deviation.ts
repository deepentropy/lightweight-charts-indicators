/**
 * Uptrick: Dynamic Z-Score Deviation
 *
 * The main line is the mean of an ALMA and an approximate zero-lag EMA (ema(2 * close - close[len], len)) of the
 * close. Its colour follows the slope over `slopeLen` bars: by default the RGB channels are EMAs (15) of the bullish /
 * bearish channel values, so the colour moves smoothly between the two. Up to four ATR shadow bands around the line
 * are filled with the line colour, and the candles can take it. Reversal labels: the z-score of the distance of the
 * close to the line and the z-score of an ALMA-smoothed RSI are both beyond their thresholds, the RSI EMA is below 40
 * (buy) / above 60 (sell) and the close turns up (buy) / down (sell). The label size follows the signal strength
 * |z price| + |z RSI| (tiny < 4, small < 6, normal from 6) or is fixed (small).
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' / 'Sell Alert' on the bars of the buy / sell labels.
 *
 * Reference: "Uptrick: Dynamic Z-Score Deviation" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uptrick
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UptrickDynamicZScoreDeviationInputs {
  maLen: number;
  rsiLen: number;
  zLookback: number;
  priceZThresh: number;
  rsiZThresh: number;
  rsiEmaLen: number;
  almaOffset: number;
  almaSigma: number;
  showSignals: boolean;
  /** Slope length of the line colour */
  slopeLen: number;
  showShadow: boolean;
  /** Number of ATR shadow bands (1..4) */
  shadowLayers: number;
  shadowBaseMult: number;
  /** Colour from EMAs of the RGB channels (else bullish / bearish / gray by the slope sign) */
  smoothGradient: boolean;
  atrLength: number;
  useBarColor: boolean;
  /** Label size from the signal strength (else a fixed small label) */
  useDynamicSize: boolean;
}

export const defaultInputs: UptrickDynamicZScoreDeviationInputs = {
  maLen: 50,
  rsiLen: 14,
  zLookback: 50,
  priceZThresh: 2.0,
  rsiZThresh: 1.5,
  rsiEmaLen: 8,
  almaOffset: 0.85,
  almaSigma: 6,
  showSignals: true,
  slopeLen: 10,
  showShadow: true,
  shadowLayers: 3,
  shadowBaseMult: 1.0,
  smoothGradient: true,
  atrLength: 14,
  useBarColor: true,
  useDynamicSize: true,
};

const MAIN = 'MAIN INPUTS';
const SHADOW = 'SHADOW SETTINGS';
export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'Main MA Length', defval: 50, group: MAIN },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, group: MAIN },
  { id: 'zLookback', type: 'int', title: 'Z-Score Lookback', defval: 50, group: MAIN },
  { id: 'priceZThresh', type: 'float', title: 'Price Z-Score Threshold', defval: 2.0, group: MAIN },
  { id: 'rsiZThresh', type: 'float', title: 'RSI Z-Score Threshold', defval: 1.5, group: MAIN },
  { id: 'rsiEmaLen', type: 'int', title: 'RSI EMA Filter Length', defval: 8, group: MAIN },
  { id: 'almaOffset', type: 'float', title: 'ALMA Offset', defval: 0.85, group: MAIN },
  { id: 'almaSigma', type: 'float', title: 'ALMA Sigma', defval: 6, group: MAIN },
  { id: 'showSignals', type: 'bool', title: 'Show Reversal Signals', defval: true, group: MAIN },
  { id: 'slopeLen', type: 'int', title: 'Slope Sensitivity', defval: 10, min: 1, group: MAIN },
  { id: 'showShadow', type: 'bool', title: 'Show MA Shadow', defval: true, group: SHADOW },
  { id: 'shadowLayers', type: 'int', title: 'Shadow Layer Count', defval: 3, min: 1, max: 4, group: SHADOW },
  { id: 'shadowBaseMult', type: 'float', title: 'Base Shadow ATR Multiplier', defval: 1.0, group: SHADOW },
  { id: 'smoothGradient', type: 'bool', title: 'Smooth Color Transitions', defval: true, group: SHADOW },
  { id: 'atrLength', type: 'int', title: 'ATR Length for Shadow', defval: 14, group: SHADOW },
  { id: 'useBarColor', type: 'bool', title: 'Use Bar Coloring', defval: true, group: 'BAR COLOR' },
  { id: 'useDynamicSize', type: 'bool', title: 'Use Dynamic Signal Size', defval: true, group: 'SIGNAL CUSTOMIZATION' },
];

const BULL = color.rgb(92, 240, 215);
const BEAR = color.rgb(179, 42, 195);
const SHADOW_PLOT = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Shadow 1', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Lower Shadow 1', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper Shadow 2', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Shadow 2', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Upper Shadow 3', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Lower Shadow 3', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Upper Shadow 4', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Lower Shadow 4', color: SHADOW_PLOT, lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Smoothed MA (ALMA + ZLMA)', color: BULL, lineWidth: 2 },
];

export const metadata = {
  title: 'Uptrick: Dynamic Z-Score Deviation',
  shortTitle: 'Uptrick: Dynamic Z-Score Deviation',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

/** ta.alma(source, length, offset, sigma) weights (the operations of the oakscriptjs function) */
function almaWeights(length: number, offset: number, sigma: number): number[] {
  const m = offset * (length - 1);
  const s = length / sigma;
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < length; i++) {
    const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(weight);
    weightSum += weight;
  }
  for (let i = 0; i < length; i++) weights[i]! /= weightSum;
  return weights;
}

/**
 * (x - ta.sma(x, len)) / (ta.stdev(x, len) + 1e-10) stepped bar by bar: the window sums of x and of its squares of
 * the oakscriptjs ta.sma / ta.stdev (biased) machines, shared (same doubles)
 */
class ZScore {
  private readonly sums = taStep.sum();
  private readonly squares = taStep.sum();
  private readonly len: number;
  constructor(length: number) {
    // the length checks of ta.sma and ta.stdev
    taStep.sma().step(0, length);
    taStep.stdev().step(0, length);
    this.len = Math.floor(length);
  }
  step(x: number): number {
    const len = this.len;
    const sum = this.sums.step(x, len);
    const sq = this.squares.step(Number.isFinite(x) ? x * x : NaN, len);
    const mean = sum / len;
    const variance = sq / len - mean * mean;
    const sd = Number.isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
    return (x - mean) / (sd + 1e-10);
  }
  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

interface UptrickRun extends BarRunState<Record<string, never>> {
  zlma: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiEma: ReturnType<typeof taStep.ema>;
  zRsi: ZScore;
  zPrice: ZScore;
  emaR: ReturnType<typeof taStep.ema>;
  emaG: ReturnType<typeof taStep.ema>;
  emaB: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  rsiArr: number[];
  comboMA: number[];
  plots: Point[][];
  fillColors: string[][];
  barColors: BarColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<UptrickDynamicZScoreDeviationInputs>): BarStudy<UptrickRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const maLen = cfg.maLen;
  const weights = almaWeights(maLen, cfg.almaOffset, cfg.almaSigma);
  const rsiWeights = almaWeights(10, 0.85, 6);
  const bullR = color.r(BULL), bullG = color.g(BULL), bullB = color.b(BULL);
  const bearR = color.r(BEAR), bearG = color.g(BEAR), bearB = color.b(BEAR);
  // Shadow layers k = 1..4: plot(on ? comboMA +/- shadowBaseMult * k * shadowATR : na), fill(u, l, color.new(maCoreColor, tr))
  const layerTransp = [75, 85, 92, 96];
  const layerOn = [1, 2, 3, 4].map((k) => cfg.showShadow && (k === 1 || (k === 4 ? cfg.shadowLayers === 4 : cfg.shadowLayers >= k)));
  const upText = '𝐔𝐩';
  const downText = '𝐃𝐨𝐰𝐧';
  return {
    init() {
      // the length checks of ta.alma
      taCore.alma([], maLen, cfg.almaOffset, cfg.almaSigma);
      const zlma = taStep.ema(maLen);
      const rsi = taStep.rsi(cfg.rsiLen);
      const rsiEma = taStep.ema(cfg.rsiEmaLen);
      const zRsi = new ZScore(cfg.zLookback);
      const zPrice = new ZScore(cfg.zLookback);
      const emaR = taStep.ema(15);
      const emaG = taStep.ema(15);
      const emaB = taStep.ema(15);
      const atr = taStep.atr(cfg.atrLength);
      const s: UptrickRun = {
        zlma, rsi, rsiEma, zRsi, zPrice, emaR, emaG, emaB, atr, rsiArr: [], comboMA: [],
        plots: Array.from({ length: 9 }, () => []), fillColors: [[], [], [], []], barColors: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [zlma, rsi, rsiEma, zRsi, zPrice, emaR, emaG, emaB, atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.rsiArr, s.comboMA, ...s.plots, ...s.fillColors, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;

      // Core MA: (alma + zlma) / 2 with zlma = ta.ema(2 * src - src[maLen], maLen)
      let alma = NaN;
      if (i >= maLen - 1) {
        alma = 0;
        for (let j = 0; j < maLen; j++) alma += bars[i - maLen + 1 + j].close * weights[j]!;
      }
      const zlmaSrc = i >= maLen ? 2 * close - bars[i - maLen].close : NaN;
      const zlma = s.zlma.step(zlmaSrc);
      const comboMA = (alma + zlma) / 2;
      s.comboMA[i] = comboMA;

      // RSI, ALMA-smoothed RSI and RSI EMA
      const rsi = s.rsi.step(close);
      s.rsiArr[i] = rsi;
      let rsiSmooth = NaN;
      if (i >= 10 - 1) {
        rsiSmooth = 0;
        for (let j = 0; j < 10; j++) rsiSmooth += s.rsiArr[i - 10 + 1 + j] * rsiWeights[j]!;
      }
      const rsiEma = s.rsiEma.step(rsi);

      // z-scores
      const zRsi = s.zRsi.step(rsiSmooth);
      const priceDist = close - comboMA;
      const zPrice = s.zPrice.step(priceDist);

      // Line colour: rawSlope = comboMA - comboMA[slopeLen]; channels = ta.ema(rawSlope > 0 ? bull : bear, 15)
      const rawSlope = i >= cfg.slopeLen ? comboMA - s.comboMA[i - cfg.slopeLen] : NaN;
      const up = gt(rawSlope, 0);
      const emaR = s.emaR.step(up ? bullR : bearR);
      const emaG = s.emaG.step(up ? bullG : bearG);
      const emaB = s.emaB.step(up ? bullB : bearB);
      const maCoreColor = cfg.smoothGradient
        // color.rgb(int(r), int(g), int(b)): int() truncates, a na channel is 0
        ? color.rgb(Math.trunc(emaR), Math.trunc(emaG), Math.trunc(emaB))
        : gt(rawSlope, 0) ? BULL : lt(rawSlope, 0) ? BEAR : color.gray;

      const atr = s.atr.step(b.high, b.low, close);
      for (let k = 1; k <= 4; k++) {
        const on = layerOn[k - 1];
        const width = cfg.shadowBaseMult * k * atr;
        s.plots[2 * (k - 1)][i] = { time, value: on ? comboMA + width : NaN };
        s.plots[2 * (k - 1) + 1][i] = { time, value: on ? comboMA - width : NaN };
        s.fillColors[k - 1][i] = on ? String(color.new(maCoreColor, layerTransp[k - 1])) : 'transparent';
      }
      // plot(comboMA, title = "Smoothed MA (ALMA + ZLMA)", color = maCoreColor, linewidth = 2)
      s.plots[8][i] = { time, value: comboMA, color: maCoreColor };
      // barcolor(useBarColor ? maCoreColor : na)
      s.barColors[i] = { time, color: maCoreColor };

      let buyCond = false;
      let sellCond = false;
      if (i >= 1) {
        const prevClose = bars[i - 1].close;
        buyCond = cfg.showSignals && lt(zPrice, -cfg.priceZThresh) && lt(zRsi, -cfg.rsiZThresh)
          && lt(rsiEma, 40) && gt(close, prevClose);
        sellCond = cfg.showSignals && gt(zPrice, cfg.priceZThresh) && gt(zRsi, cfg.rsiZThresh)
          && gt(rsiEma, 60) && lt(close, prevClose);
        const strength = Math.abs(zPrice) + Math.abs(zRsi);
        // Strong (>= 6): normal; medium (4..6): small; weak (< 4): tiny; fixed (dynamic size off): small
        const size = !cfg.useDynamicSize ? 'small' : ge(strength, 6) ? 'normal' : ge(strength, 4) ? 'small' : lt(strength, 4) ? 'tiny' : null;
        if (size !== null) {
          // Style ids: Buy Strong / Medium / Weak / Fixed = shape0..3, Sell Strong / Medium / Weak / Fixed = shape4..7
          const k = !cfg.useDynamicSize ? 3 : size === 'normal' ? 0 : size === 'small' ? 1 : 2;
          // plotshape(buyCond ..., location.belowbar, shape.labelup, color.rgb(92, 240, 215), text = "𝐔𝐩", textcolor = #000000)
          if (buyCond) {
            s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: BULL, size, text: upText, textColor: '#000000', id: `shape${k}` });
          }
          // plotshape(sellCond ..., location.abovebar, shape.labeldown, color.rgb(179, 42, 195), text = "𝐃𝐨𝐰𝐧", textcolor = color.white)
          if (sellCond) {
            s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: BEAR, size, text: downText, textColor: color.white, id: `shape${4 + k}` });
          }
        }
      }
      s.flags[0][i] = buyCond;
      s.flags[1][i] = sellCond;
      if (buyCond) s.times[0].push(time as number);
      if (sellCond) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      const fills: NonNullable<IndicatorResult['fills']> = [];
      for (let k = 1; k <= 4; k++) {
        const u = `plot${2 * (k - 1)}`;
        const l = `plot${2 * (k - 1) + 1}`;
        plots[u] = s.plots[2 * (k - 1)].slice();
        plots[l] = s.plots[2 * (k - 1) + 1].slice();
        fills.push({ plot1: u, plot2: l, colors: s.fillColors[k - 1].slice() });
      }
      plots.plot8 = s.plots[8].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        barColors: cfg.useBarColor ? s.barColors.slice() : [],
        // alertcondition(buyCond, "Buy Alert") / alertcondition(sellCond, "Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UptrickDynamicZScoreDeviationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<UptrickDynamicZScoreDeviationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Uptrick Buy Reversal Signal' },
  { id: 'alert1', title: 'Sell Alert', message: 'Uptrick Sell Reversal Signal' },
];

export const UptrickDynamicZScoreDeviation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  createRun,
};
