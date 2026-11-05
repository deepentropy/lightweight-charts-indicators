/**
 * Market Cipher B
 *
 * WaveTrend oscillator with MFI area, difference (VWAP) area, MFI bar, Stochastic RSI with its fill,
 * cross-detection dots and the original's characters: buy / sell circles, divergence circles, gold buy circle,
 * Sommi flags and diamonds (absolute positions, as the original's plotchar calls).
 *
 * Alerts (alertcondition, `alerts` of the result): the nine conditions of the original (buy / sell circles,
 * divergence circles, gold buy, Sommi flag/diamond, small dots).
 *
 * Higher timeframes (security of the original, chart context as the third argument): the Sommi flag uses the
 * WaveTrend of the "Sommi F. Wave timeframe" bars (no lookahead), the Sommi diamond the Heikin Ashi candles of the
 * two "HTF Candle Res." timeframes (lookahead on), built from the chart bars. A timeframe equal to or lower than the
 * chart timeframe uses the chart bars (the lower-timeframe data is not available).
 *
 * Reference: "VuManChu Cipher B + Divergences" (community)
 */

import {
  ta, taStep, getSourceSeries, Series, math, color, timeframe, heikinAshi, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData, PineSize } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketCipherBInputs {
  wtChannelLen: number;
  wtAvgLen: number;
  wtMALen: number;
  rsiMFIPeriod: number;
  rsiMFIMult: number;
  rsiMFIPosY: number;
  obLevel: number;
  obLevel2: number;
  obLevel3: number;
  osLevel: number;
  osLevel2: number;
  osLevel3: number;
  wtBuyShow: boolean;
  wtGoldShow: boolean;
  wtSellShow: boolean;
  wtDivShow: boolean;
  wtShowDiv: boolean;
  wtDivOBLevel: number;
  wtDivOSLevel: number;
  wtDivOBLevel_add: number;
  wtDivOSLevel_add: number;
  rsiLen: number;
  rsiShowDiv: boolean;
  rsiDivOBLevel: number;
  rsiDivOSLevel: number;
  stochShow: boolean;
  stochUseLog: boolean;
  stochAvg: boolean;
  stochLen: number;
  stochRsiLen: number;
  stochKSmooth: number;
  stochDSmooth: number;
  stochShowDiv: boolean;
  sommiFlagShow: boolean;
  sommiVwapTF: string;
  sommiVwapBearLevel: number;
  sommiVwapBullLevel: number;
  soomiFlagWTBearLevel: number;
  soomiFlagWTBullLevel: number;
  soomiRSIMFIBearLevel: number;
  soomiRSIMFIBullLevel: number;
  sommiDiamondShow: boolean;
  sommiHTCRes: string;
  sommiHTCRes2: string;
  soomiDiamondWTBearLevel: number;
  soomiDiamondWTBullLevel: number;
}

export const defaultInputs: MarketCipherBInputs = {
  wtChannelLen: 9,
  wtAvgLen: 12,
  wtMALen: 3,
  rsiMFIPeriod: 60,
  rsiMFIMult: 150,
  rsiMFIPosY: 2.5,
  obLevel: 53,
  obLevel2: 60,
  obLevel3: 100,
  osLevel: -53,
  osLevel2: -60,
  osLevel3: -75,
  wtBuyShow: true,
  wtGoldShow: true,
  wtSellShow: true,
  wtDivShow: true,
  wtShowDiv: true,
  wtDivOBLevel: 45,
  wtDivOSLevel: -65,
  wtDivOBLevel_add: 15,
  wtDivOSLevel_add: -40,
  rsiLen: 14,
  rsiShowDiv: false,
  rsiDivOBLevel: 60,
  rsiDivOSLevel: 30,
  stochShow: true,
  stochUseLog: true,
  stochAvg: false,
  stochLen: 14,
  stochRsiLen: 14,
  stochKSmooth: 3,
  stochDSmooth: 3,
  stochShowDiv: false,
  sommiFlagShow: false,
  sommiVwapTF: '720',
  sommiVwapBearLevel: 0,
  sommiVwapBullLevel: 0,
  soomiFlagWTBearLevel: 0,
  soomiFlagWTBullLevel: 0,
  soomiRSIMFIBearLevel: 0,
  soomiRSIMFIBullLevel: 0,
  sommiDiamondShow: false,
  sommiHTCRes: '60',
  sommiHTCRes2: '240',
  soomiDiamondWTBearLevel: 0,
  soomiDiamondWTBullLevel: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'WT Channel Length', defval: 9, min: 1 },
  { id: 'wtAvgLen', type: 'int', title: 'WT Average Length', defval: 12, min: 1 },
  { id: 'wtMALen', type: 'int', title: 'WT MA Length', defval: 3, min: 1 },
  { id: 'rsiMFIPeriod', type: 'int', title: 'MFI Period', defval: 60, min: 1 },
  { id: 'rsiMFIMult', type: 'float', title: 'MFI Area multiplier', defval: 150, min: 1 },
  { id: 'rsiMFIPosY', type: 'float', title: 'MFI Area Y Pos', defval: 2.5 },
  { id: 'obLevel', type: 'int', title: 'WT Overbought Level 1', defval: 53 },
  { id: 'obLevel2', type: 'int', title: 'WT Overbought Level 2', defval: 60 },
  { id: 'obLevel3', type: 'int', title: 'WT Overbought Level 3', defval: 100 },
  { id: 'osLevel', type: 'int', title: 'WT Oversold Level 1', defval: -53 },
  { id: 'osLevel2', type: 'int', title: 'WT Oversold Level 2', defval: -60 },
  { id: 'osLevel3', type: 'int', title: 'WT Oversold Level 3', defval: -75 },
  { id: 'wtBuyShow', type: 'bool', title: 'Show Buy dots', defval: true },
  { id: 'wtGoldShow', type: 'bool', title: 'Show Gold dots', defval: true },
  { id: 'wtSellShow', type: 'bool', title: 'Show Sell dots', defval: true },
  { id: 'wtDivShow', type: 'bool', title: 'Show Div. dots', defval: true },
  { id: 'wtShowDiv', type: 'bool', title: 'Show WT Regular Divergences', defval: true },
  { id: 'wtDivOBLevel', type: 'int', title: 'WT Bearish Divergence min', defval: 45 },
  { id: 'wtDivOSLevel', type: 'int', title: 'WT Bullish Divergence min', defval: -65 },
  { id: 'wtDivOBLevel_add', type: 'int', title: 'WT 2nd Bearish Divergence', defval: 15 },
  { id: 'wtDivOSLevel_add', type: 'int', title: 'WT 2nd Bullish Divergence 15 min', defval: -40 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiShowDiv', type: 'bool', title: 'Show RSI Regular Divergences', defval: false },
  { id: 'rsiDivOBLevel', type: 'int', title: 'RSI Bearish Divergence min', defval: 60 },
  { id: 'rsiDivOSLevel', type: 'int', title: 'RSI Bullish Divergence min', defval: 30 },
  { id: 'stochShow', type: 'bool', title: 'Show Stochastic RSI', defval: true },
  { id: 'stochUseLog', type: 'bool', title: ' Use Log?', defval: true },
  { id: 'stochAvg', type: 'bool', title: 'Use Average of both K & D', defval: false },
  { id: 'stochLen', type: 'int', title: 'Stochastic RSI Length', defval: 14 },
  { id: 'stochRsiLen', type: 'int', title: 'RSI Length ', defval: 14 },
  { id: 'stochKSmooth', type: 'int', title: 'Stochastic RSI K Smooth', defval: 3 },
  { id: 'stochDSmooth', type: 'int', title: 'Stochastic RSI D Smooth', defval: 3 },
  { id: 'stochShowDiv', type: 'bool', title: 'Show Stoch Regular Divergences', defval: false },
  { id: 'sommiFlagShow', type: 'bool', title: 'Show Sommi flag', defval: false },
  { id: 'sommiVwapTF', type: 'string', title: 'Sommi F. Wave timeframe', defval: '720' },
  { id: 'sommiVwapBearLevel', type: 'int', title: 'F. Wave Bear Level (less than)', defval: 0 },
  { id: 'sommiVwapBullLevel', type: 'int', title: 'F. Wave Bull Level (more than)', defval: 0 },
  { id: 'soomiFlagWTBearLevel', type: 'int', title: 'WT Bear Level (more than)', defval: 0 },
  { id: 'soomiFlagWTBullLevel', type: 'int', title: 'WT Bull Level (less than)', defval: 0 },
  { id: 'soomiRSIMFIBearLevel', type: 'int', title: 'Money flow Bear Level (less than)', defval: 0 },
  { id: 'soomiRSIMFIBullLevel', type: 'int', title: 'Money flow Bull Level (more than)', defval: 0 },
  { id: 'sommiDiamondShow', type: 'bool', title: 'Show Sommi diamond', defval: false },
  { id: 'sommiHTCRes', type: 'string', title: 'HTF Candle Res. 1', defval: '60' },
  { id: 'sommiHTCRes2', type: 'string', title: 'HTF Candle Res. 2', defval: '240' },
  { id: 'soomiDiamondWTBearLevel', type: 'int', title: 'WT Bear Level (More than)', defval: 0 },
  { id: 'soomiDiamondWTBullLevel', type: 'int', title: 'WT Bull Level (Less than)', defval: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'wt1', title: 'WT Wave 1', color: '#4994EC', lineWidth: 2, style: 'area' },
  { id: 'wt2', title: 'WT Wave 2', color: '#1F1559', lineWidth: 1, style: 'area' },
  { id: 'vwap', title: 'VWAP (WT1-WT2)', color: '#FFFFFF80', lineWidth: 2, style: 'area' },
  { id: 'mfiArea', title: 'MFI Area', color: '#3EE145', lineWidth: 1, style: 'area' },
  { id: 'crossDot', title: 'Cross Dot', color: '#00FF00', lineWidth: 3, style: 'circles' },
  { id: 'crossLine', title: 'Cross Line', color: '#000000', lineWidth: 5 },
  { id: 'mfiBarTop', title: 'MFI Bar TOP Line', color: 'transparent', lineWidth: 1 },
  { id: 'mfiBarBottom', title: 'MFI Bar BOTTOM Line', color: 'transparent', lineWidth: 1 },
  { id: 'stochK', title: 'Stoch K', color: String(color.new('#21baf3', 70)), lineWidth: 2 },
  { id: 'stochD', title: 'Stoch D', color: String(color.new('#673ab7', 90)), lineWidth: 1 },
];

export const metadata = {
  title: 'Market Cipher B',
  shortTitle: 'MCB',
  overlay: false,
};

// Colours of the original
const COLOR_RED = '#ff0000';
const COLOR_GREEN = '#3fff00';
const COLOR_ORANGE = '#e2a400';
const COLOR_PINK = '#ff00f0';
const COLOR_BLUELIGHT = '#31c0ff';

const num = (a: (number | null | undefined)[]) => a.map((v) => (v == null ? NaN : v));

/** WaveTrend of the original (f_wavetrend): ci from hlc3, wt1 = ema(ci, avg), wt2 = sma(wt1, malen) */
function waveTrend(bars: Bar[], chlen: number, avg: number, malen: number): { wt1: number[]; wt2: number[] } {
  const hlc3 = getSourceSeries(bars, 'hlc3');
  const esa = ta.ema(hlc3, chlen);
  const de = ta.ema(math.abs(hlc3.sub(esa)) as Series, chlen);
  const ci = hlc3.sub(esa).div(de.mul(0.015));
  const wt1 = ta.ema(ci, avg);
  const wt2 = ta.sma(wt1, malen);
  return { wt1: num(wt1.toArray()), wt2: num(wt2.toArray()) };
}

/**
 * f_findDivs(src, topLimit, botLimit, useLimits) of the original, one bar at a time: fractals of src two bars back,
 * the previous fractal's value and price (valuewhen(...)[2]) and the regular divergences
 */
class Divs {
  readonly src: number[] = [];
  readonly vwHigh: number[] = [];
  readonly vwHighPrice: number[] = [];
  readonly vwLow: number[] = [];
  readonly vwLowPrice: number[] = [];
  readonly fractalBot: boolean[] = [];
  readonly lowPrev: number[] = [];
  readonly bearSignal: boolean[] = [];
  readonly bullSignal: boolean[] = [];

  constructor(private readonly topLimit: number, private readonly botLimit: number, private readonly useLimits: boolean) {}

  get series(): unknown[][] {
    return [this.src, this.vwHigh, this.vwHighPrice, this.vwLow, this.vwLowPrice, this.fractalBot, this.lowPrev, this.bearSignal, this.bullSignal];
  }

  bar(i: number, value: number, bars: Bar[]): void {
    const { src, vwHigh, vwHighPrice, vwLow, vwLowPrice, useLimits } = this;
    src[i] = value;
    const at = (a: number[], k: number) => (k >= 0 ? a[k] : NaN);
    const s0 = value, s1 = at(src, i - 1), s2 = at(src, i - 2), s3 = at(src, i - 3), s4 = at(src, i - 4);
    const top = s4 < s2 && s3 < s2 && s2 > s1 && s2 > s0;
    const bot = s4 > s2 && s3 > s2 && s2 < s1 && s2 < s0;
    const fractalize = top ? 1 : bot ? -1 : 0;
    // fractalTop / fractalBot are floats (src[2] or na) used as conditions: true when not na and not 0
    const ft = fractalize > 0 && (useLimits ? s2 >= this.topLimit : true) ? s2 : NaN;
    const fb = fractalize < 0 && (useLimits ? s2 <= this.botLimit : true) ? s2 : NaN;
    const fractalTop = !Number.isNaN(ft) && ft !== 0;
    const fractalBot = !Number.isNaN(fb) && fb !== 0;
    this.fractalBot[i] = fractalBot;
    const high2 = i >= 2 ? bars[i - 2].high : NaN;
    const low2 = i >= 2 ? bars[i - 2].low : NaN;
    vwHigh[i] = fractalTop ? s2 : i > 0 ? vwHigh[i - 1] : NaN;
    vwHighPrice[i] = fractalTop ? high2 : i > 0 ? vwHighPrice[i - 1] : NaN;
    vwLow[i] = fractalBot ? s2 : i > 0 ? vwLow[i - 1] : NaN;
    vwLowPrice[i] = fractalBot ? low2 : i > 0 ? vwLowPrice[i - 1] : NaN;
    const highPrev = at(vwHigh, i - 2);
    const highPrice = at(vwHighPrice, i - 2);
    const lowPrev = at(vwLow, i - 2);
    this.lowPrev[i] = lowPrev;
    const lowPrice = at(vwLowPrice, i - 2);
    this.bearSignal[i] = fractalTop && high2 > highPrice && s2 < highPrev;
    this.bullSignal[i] = fractalBot && low2 < lowPrice && s2 > lowPrev;
  }
}

/** sma over the last `len` values of an array (bar i included): na when a value of the window is na */
function smaAt(src: number[], i: number, len: number): number {
  if (i < len - 1) return NaN;
  let sum = 0;
  for (let j = i - len + 1; j <= i; j++) sum += src[j];
  return sum / len;
}

/** stoch(src, src, src, len) on bar i: na while the window has an na value, or with a zero range */
function stochAt(src: number[], i: number, len: number): number {
  if (i < len - 1) return NaN;
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = i - len + 1; j <= i; j++) {
    if (Number.isNaN(src[j])) return NaN;
    lo = Math.min(lo, src[j]);
    hi = Math.max(hi, src[j]);
  }
  return hi - lo > 0 ? (100 * (src[i] - lo)) / (hi - lo) : NaN;
}

type Point = { time: number; value: number; color?: string };
type McbResult = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface McbRun extends BarRunState<Record<string, never>> {
  esa: ReturnType<typeof taStep.ema>;
  de: ReturnType<typeof taStep.ema>;
  wt1Ema: ReturnType<typeof taStep.ema>;
  wt2Sma: ReturnType<typeof taStep.sma>;
  mfiSma: ReturnType<typeof taStep.sma>;
  rsiStep: ReturnType<typeof taStep.rsi>;
  stochRsiStep: ReturnType<typeof taStep.rsi>;
  wt1: number[];
  wt2: number[];
  rsi: number[];
  rsiMFI: number[];
  stochRsi: number[];
  stochRaw: number[];
  kk: number[];
  stochK: number[];
  stochD: number[];
  rsiWhen: number[];
  /** wtCross, wtCrossUp, wtCrossDown of each bar */
  cross: boolean[];
  crossUp: boolean[];
  crossDown: boolean[];
  divs: Divs[];
  wt1Plot: Point[];
  wt2Plot: Point[];
  vwapPlot: Point[];
  mfiPlot: Point[];
  crossDotPlot: Point[];
  crossLinePlot: Point[];
  mfiBarTop: Point[];
  mfiBarBottom: Point[];
  mfiBarColors: string[];
  stochKPlot: Point[];
  stochDPlot: Point[];
  kdColors: string[];
  /** the markers at the time of a bar but the Sommi ones: char4 / char5 (from the bar), char6..8 (from 2 bars later) */
  marksA: (MarkerData[] | null)[];
  marksB: (MarkerData[] | null)[];
  /** alert flags of the conditions that do not read the higher timeframes (null for alert3 / alert5) */
  flags: (boolean[] | null)[];
}

function study(inputs: Partial<MarketCipherBInputs>): BarStudy<McbRun, McbResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const {
    wtChannelLen, wtAvgLen, wtMALen,
    rsiMFIPeriod, rsiMFIMult, rsiMFIPosY,
    obLevel, obLevel2, obLevel3, osLevel, osLevel2, osLevel3,
  } = cfg;
  const hlc3 = barSource('hlc3');
  const warmup = wtChannelLen + wtAvgLen;
  const mfiWarmup = rsiMFIPeriod;
  const toVal = (v: number | null, i: number, wu: number): number => {
    if (v == null || i < wu || !isFinite(v)) return NaN;
    return v;
  };
  const buyCircle = String(color.new(COLOR_GREEN, 50));
  const sellCircle = String(color.new(COLOR_RED, 50));
  const gold = String(color.new(COLOR_ORANGE, 15));
  return {
    init() {
      // Pine: esa = ema(hlc3, chlen), de = ema(abs(hlc3-esa), chlen)
      //        ci = (hlc3 - esa) / (0.015 * de)
      //        wt1 = ema(ci, avg), wt2 = sma(wt1, malen)
      const esa = taStep.ema(wtChannelLen);
      const de = taStep.ema(wtChannelLen);
      const wt1Ema = taStep.ema(wtAvgLen);
      const wt2Sma = taStep.sma();
      const mfiSma = taStep.sma();
      const rsiStep = taStep.rsi(cfg.rsiLen);
      const stochRsiStep = taStep.rsi(cfg.stochRsiLen);
      // Divergences: wt, wt (additional levels), rsi, stoch
      const divs = [
        new Divs(cfg.wtDivOBLevel, cfg.wtDivOSLevel, true),
        new Divs(cfg.wtDivOBLevel_add, cfg.wtDivOSLevel_add, true),
        new Divs(cfg.rsiDivOBLevel, cfg.rsiDivOSLevel, true),
        new Divs(0, 0, false),
      ];
      const s: McbRun = {
        esa, de, wt1Ema, wt2Sma, mfiSma, rsiStep, stochRsiStep,
        wt1: [], wt2: [], rsi: [], rsiMFI: [], stochRsi: [], stochRaw: [], kk: [], stochK: [], stochD: [], rsiWhen: [],
        cross: [], crossUp: [], crossDown: [], divs,
        wt1Plot: [], wt2Plot: [], vwapPlot: [], mfiPlot: [], crossDotPlot: [], crossLinePlot: [], mfiBarTop: [],
        mfiBarBottom: [], mfiBarColors: [], stochKPlot: [], stochDPlot: [], kdColors: [], marksA: [], marksB: [],
        flags: [[], [], [], null, [], null, [], [], []],
        steps: [esa, de, wt1Ema, wt2Sma, mfiSma, rsiStep, stochRsiStep], vars: {}, lists: [], series: [],
      };
      s.series = [
        s.wt1, s.wt2, s.rsi, s.rsiMFI, s.stochRsi, s.stochRaw, s.kk, s.stochK, s.stochD, s.rsiWhen, s.cross, s.crossUp,
        s.crossDown, ...divs.flatMap((d) => d.series), s.wt1Plot, s.wt2Plot, s.vwapPlot, s.mfiPlot, s.crossDotPlot,
        s.crossLinePlot, s.mfiBarTop, s.mfiBarBottom, s.mfiBarColors, s.stochKPlot, s.stochDPlot, s.kdColors, s.marksA,
        s.marksB, ...s.flags.filter((f): f is boolean[] => f !== null),
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // --- WaveTrend ---
      const src = hlc3(b);
      const esa = s.esa.step(src);
      const de = s.de.step(Math.abs(src - esa));
      const ci = (src - esa) / (de * 0.015);
      const c1 = s.wt1Ema.step(ci);
      const c2 = s.wt2Sma.step(c1, wtMALen);
      s.wt1[i] = c1;
      s.wt2[i] = c2;

      // --- RSI+MFI Area ---
      // Pine: sma(((close - open) / (high - low)) * multiplier, period) - posY
      const range = b.high - b.low;
      const mfiRaw = range > 0 ? ((b.close - b.open) / range) * rsiMFIMult : 0;
      const mfi = s.mfiSma.step(mfiRaw, rsiMFIPeriod);

      // Pine: plot(wt1, style=area, color=#4994EC)
      s.wt1Plot[i] = { time, value: toVal(c1, i, warmup) };
      // Pine: plot(wt2, style=area, color=#1F1559)
      s.wt2Plot[i] = { time, value: toVal(c2, i, warmup) };
      // Pine: wtVwap = wt1 - wt2; plot(wtVwap, style=area, color=white)
      s.vwapPlot[i] = isNaN(c1) || isNaN(c2) || i < warmup ? { time, value: NaN } : { time, value: c1 - c2 };
      // Pine: plot(rsiMFI, style=area, color=rsiMFIColor)
      const val = toVal(mfi, i, mfiWarmup) - rsiMFIPosY;
      const rsiMFI = isFinite(val) ? val : NaN;
      s.mfiPlot[i] = { time, value: rsiMFI, color: val > 0 ? '#3EE14580' : '#FF3D2E80' };
      s.rsiMFI[i] = rsiMFI;

      // --- Cross dots ---
      // Pine: wtCross = cross(wt1, wt2)
      //       plot(wtCross ? wt2 : na, style=circles, color=signalColor, linewidth=3)
      const p1 = i > 0 ? s.wt1[i - 1] : NaN;
      const p2 = i > 0 ? s.wt2[i - 1] : NaN;
      if (i < warmup + 1 || isNaN(c1) || isNaN(c2) || isNaN(p1) || isNaN(p2)) {
        s.crossDotPlot[i] = { time, value: NaN };
        s.crossLinePlot[i] = { time, value: NaN };
      } else if ((p1 <= p2 && c1 > c2) || (p1 >= p2 && c1 < c2)) {
        // Pine: plot(cross(wt1, wt2) ? wt2 : na, color=black, style=line, linewidth=5)
        s.crossLinePlot[i] = { time, value: c2 };
        // Small circle at every cross (Pine line 495)
        s.crossDotPlot[i] = { time, value: c2, color: (c2 - c1) > 0 ? '#FF5252' : '#00E676' };
      } else {
        s.crossDotPlot[i] = { time, value: NaN };
        s.crossLinePlot[i] = { time, value: NaN };
      }

      // --- Signals of the original (na values compare false) ---
      // rsi = rsi(close, rsiLen)
      const rsi = s.rsiStep.step(b.close);
      s.rsi[i] = rsi;
      // f_stochrsi(close, stochLen, stochRsiLen, stochKSmooth, stochDSmooth, stochUseLog, stochAvg)
      s.stochRsi[i] = s.stochRsiStep.step(cfg.stochUseLog ? Math.log(b.close) : b.close);
      s.stochRaw[i] = stochAt(s.stochRsi, i, cfg.stochLen);
      const kk = smaAt(s.stochRaw, i, cfg.stochKSmooth);
      s.kk[i] = kk;
      const stochD = smaAt(s.kk, i, cfg.stochDSmooth);
      s.stochD[i] = stochD;
      const stochK = cfg.stochAvg ? (kk + stochD) / 2 : kk;
      s.stochK[i] = stochK;

      // Divergences
      const [wtDiv, wtDivAdd, rsiDiv, stochDiv] = s.divs;
      wtDiv.bar(i, c2, bars);
      wtDivAdd.bar(i, c2, bars);
      rsiDiv.bar(i, rsi, bars);
      stochDiv.bar(i, stochK, bars);
      // lastRsi = valuewhen(wtFractalBot, rsi[2], 0)[2]
      s.rsiWhen[i] = wtDiv.fractalBot[i] ? (i >= 2 ? s.rsi[i - 2] : NaN) : i > 0 ? s.rsiWhen[i - 1] : NaN;

      const wtCross = (c1 > c2 && p1 <= p2) || (c1 < c2 && p1 >= p2);
      const wtCrossUp = c2 - c1 <= 0;
      const wtCrossDown = c2 - c1 >= 0;
      s.cross[i] = wtCross;
      s.crossUp[i] = wtCrossUp;
      s.crossDown[i] = wtCrossDown;
      // buySignal = wtCross and wtCrossUp and wtOversold; sellSignal = wtCross and wtCrossDown and wtOverbought
      const buySignal = wtCross && wtCrossUp && c2 <= osLevel;
      const sellSignal = wtCross && wtCrossDown && c2 >= obLevel;
      const buySignalDiv = (cfg.wtShowDiv && wtDiv.bullSignal[i]) || (cfg.wtShowDiv && wtDivAdd.bullSignal[i])
        || (cfg.stochShowDiv && stochDiv.bullSignal[i]) || (cfg.rsiShowDiv && rsiDiv.bullSignal[i]);
      const sellSignalDiv = (cfg.wtShowDiv && wtDiv.bearSignal[i]) || (cfg.wtShowDiv && wtDivAdd.bearSignal[i])
        || (cfg.stochShowDiv && stochDiv.bearSignal[i]) || (cfg.rsiShowDiv && rsiDiv.bearSignal[i]);
      const lastRsi = i >= 2 ? s.rsiWhen[i - 2] : NaN;
      const wtLowPrev = wtDiv.lowPrev[i];
      const wtGoldBuy = ((cfg.wtShowDiv && wtDiv.bullSignal[i]) || (cfg.rsiShowDiv && rsiDiv.bullSignal[i]))
        && wtLowPrev <= osLevel3 && c2 > osLevel3 && wtLowPrev - c2 <= -5 && lastRsi < 30;

      const f = s.flags;
      f[0]![i] = buySignal;
      f[1]![i] = buySignalDiv;
      f[2]![i] = wtGoldBuy;
      f[4]![i] = wtCross && wtCrossUp;
      f[6]![i] = sellSignal;
      f[7]![i] = sellSignalDiv;
      f[8]![i] = wtCross && wtCrossDown;

      // plotchar(..., location = location.absolute): the character at the price, on the bar (offset applied)
      const char = (id: string, at: number, price: number, ch: string, css: string, size: PineSize): MarkerData =>
        ({ id, time: bars[at].time, position: 'atPriceMiddle', price, shape: 'circle', char: ch, color: css, size });
      let a: MarkerData[] | null = null;
      if (cfg.wtBuyShow && buySignal) (a ??= []).push(char('char4', i, -107, '·', buyCircle, 'small'));
      if (cfg.wtSellShow && sellSignal) (a ??= []).push(char('char5', i, 105, '·', sellCircle, 'small'));
      s.marksA[i] = a;
      // the characters with offset = -2: bar i is the only writer of the slot of bar i - 2
      if (i >= 2) {
        let m: MarkerData[] | null = null;
        // offset = -2, transp = 15: wtBullDiv ? green : wtBullDiv_add ? color.new(green, 60) : rsiShowDiv ? green : na
        if (cfg.wtDivShow && buySignalDiv) {
          const css = wtDiv.bullSignal[i] ? String(color.new(COLOR_GREEN, 15))
            : wtDivAdd.bullSignal[i] ? String(color.new(COLOR_GREEN, 60))
              : cfg.rsiShowDiv ? String(color.new(COLOR_GREEN, 15)) : 'transparent';
          (m ??= []).push(char('char6', i - 2, -106, '•', css, 'small'));
        }
        // wtBearDiv ? red : wtBearDiv_add ? color.new(red, 60) : rsiBearDiv ? red : na
        if (cfg.wtDivShow && sellSignalDiv) {
          const css = wtDiv.bearSignal[i] ? String(color.new(COLOR_RED, 15))
            : wtDivAdd.bearSignal[i] ? String(color.new(COLOR_RED, 60))
              : rsiDiv.bearSignal[i] ? String(color.new(COLOR_RED, 15)) : 'transparent';
          (m ??= []).push(char('char7', i - 2, 106, '•', css, 'small'));
        }
        if (wtGoldBuy && cfg.wtGoldShow) (m ??= []).push(char('char8', i - 2, -106, '•', gold, 'normal'));
        s.marksB[i - 2] = m;
      }
      // the slots of the last two bars have no writer yet
      s.marksB[i] = null;

      // MFI bar: plot(rsiMFIShow ? -95 : na) / plot(rsiMFIShow ? -99 : na) with transp 100,
      // fill(..., title = 'MFI Bar Colors', color = rsiMFIColor, transp = 75)
      s.mfiBarTop[i] = { time, value: -95 };
      s.mfiBarBottom[i] = { time, value: -99 };
      s.mfiBarColors[i] = String(color.new(rsiMFI > 0 ? '#3ee145' : '#ff3d2e', 75));
      // Stochastic RSI: plot(stochShow ? stochK : na, 'Stoch K') / plot(stochShow ? stochD : na, 'Stoch D'),
      // fill(stochKplot, stochDplot, title = 'KD Fill', color = stochK >= stochD ? #21baf3 95% : #673ab7 90%)
      s.stochKPlot[i] = { time, value: cfg.stochShow && Number.isFinite(stochK) ? stochK : NaN };
      s.stochDPlot[i] = { time, value: cfg.stochShow && Number.isFinite(stochD) ? stochD : NaN };
      s.kdColors[i] = String(stochK >= stochD ? color.new('#21baf3', 95) : color.new('#673ab7', 90));
    },
    // The Sommi flag and diamond read the higher timeframes of the whole bar set (the diamond with lookahead): they
    // are found again on each update
    result(s, bars, chart) {
      const n = bars.length;
      // Bars of a timeframe as security(syminfo.tickerid, tf, ...) builds them; null: the chart bars
      const chartTf = chartTimeframe(bars, chart);
      const securityOf = (tf: string) => {
        if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) <= timeframe.in_seconds(chartTf)) return null;
        return higherTimeframeBars(bars, tf, chart);
      };
      // f_findSommiFlag: hwtVwap = wt1 - wt2 of the WaveTrend of the timeframe (no lookahead)
      const flagSec = securityOf(cfg.sommiVwapTF);
      let hwtVwap: number[];
      if (flagSec) {
        const h = waveTrend(flagSec.htf, wtChannelLen, wtAvgLen, wtMALen);
        hwtVwap = mapToChart(h.wt1.map((v, g) => v - h.wt2[g]), flagSec.group, flagSec.latest, false, false);
      } else {
        hwtVwap = s.wt1.map((v, i) => v - s.wt2[i]);
      }
      // f_getTFCandle: Heikin Ashi candle of the timeframe (lookahead on), candleBodyDir = close > open
      const candleBodyDir = (tf: string): boolean[] => {
        const sec = securityOf(tf);
        const ha = heikinAshi(sec ? sec.htf : bars);
        const dir = ha.map((hb) => (hb.close > hb.open ? 1 : 0));
        const onChart = sec ? mapToChart(dir, sec.group, sec.latest, true, false) : dir;
        return onChart.map((v) => v === 1);
      };
      const dir1 = candleBodyDir(cfg.sommiHTCRes);
      const dir2 = candleBodyDir(cfg.sommiHTCRes2);

      const bull: boolean[] = new Array(n);
      const bear: boolean[] = new Array(n);
      const markers: MarkerData[] = [];
      const char = (id: string, i: number, price: number, ch: string, css: string) => {
        markers.push({ id, time: bars[i].time, position: 'atPriceMiddle', price, shape: 'circle', char: ch, color: css, size: 'tiny' });
      };
      for (let i = 0; i < n; i++) {
        const c2 = s.wt2[i];
        const wtCross = s.cross[i];
        const sommiBearish = s.rsiMFI[i] < cfg.soomiRSIMFIBearLevel && c2 > cfg.soomiFlagWTBearLevel && wtCross && s.crossDown[i]
          && hwtVwap[i] < cfg.sommiVwapBearLevel;
        const sommiBullish = s.rsiMFI[i] > cfg.soomiRSIMFIBullLevel && c2 < cfg.soomiFlagWTBullLevel && wtCross && s.crossUp[i]
          && hwtVwap[i] > cfg.sommiVwapBullLevel;
        const sommiBearishDiamond = c2 >= cfg.soomiDiamondWTBearLevel && wtCross && s.crossDown[i] && !dir1[i] && !dir2[i];
        const sommiBullishDiamond = c2 <= cfg.soomiDiamondWTBullLevel && wtCross && s.crossUp[i] && dir1[i] && dir2[i];
        bull[i] = sommiBullish || sommiBullishDiamond;
        bear[i] = sommiBearish || sommiBearishDiamond;
        // the markers in the order of the original's (sorted by time): the Sommi characters, char4 / char5, then the
        // characters drawn 2 bars back
        if (cfg.sommiFlagShow && sommiBearish) char('char0', i, 108, '⚑', COLOR_PINK);
        if (cfg.sommiFlagShow && sommiBullish) char('char1', i, -108, '⚑', COLOR_BLUELIGHT);
        if (cfg.sommiDiamondShow && sommiBearishDiamond) char('char2', i, 108, '◆', COLOR_PINK);
        if (cfg.sommiDiamondShow && sommiBullishDiamond) char('char3', i, -108, '◆', COLOR_BLUELIGHT);
        const a = s.marksA[i];
        if (a) for (const m of a) markers.push(m);
        const m2 = s.marksB[i];
        if (m2) for (const m of m2) markers.push(m);
      }
      const flags = s.flags.map((f, k) => f ?? (k === 3 ? bull : bear));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'wt1': s.wt1Plot.slice(),
          'wt2': s.wt2Plot.slice(),
          'vwap': s.vwapPlot.slice(),
          'mfiArea': s.mfiPlot.slice(),
          'crossDot': s.crossDotPlot.slice(),
          'crossLine': s.crossLinePlot.slice(),
          'mfiBarTop': s.mfiBarTop.slice(),
          'mfiBarBottom': s.mfiBarBottom.slice(),
          'stochK': s.stochKPlot.slice(),
          'stochD': s.stochDPlot.slice(),
        },
        fills: [
          { plot1: 'mfiBarTop', plot2: 'mfiBarBottom', options: { title: 'MFI Bar Colors' }, colors: s.mfiBarColors.slice() },
          { plot1: 'stochK', plot2: 'stochD', options: { title: 'KD Fill' }, colors: s.kdColors.slice() },
        ],
        hlines: [
          { value: 0, options: { color: '#FFFFFF80', linestyle: 'solid' as const, title: 'Zero' } },
          { value: obLevel, options: { color: '#FFFFFF26', linestyle: 'dashed' as const, title: 'OB1 (53)' } },
          { value: osLevel, options: { color: '#FFFFFF26', linestyle: 'dashed' as const, title: 'OS1 (-53)' } },
          { value: obLevel2, options: { color: '#FFFFFF15', linestyle: 'dashed' as const, title: 'OB2 (60)' } },
          { value: osLevel2, options: { color: '#FFFFFF15', linestyle: 'dashed' as const, title: 'OS2 (-60)' } },
          { value: obLevel3, options: { color: '#FFFFFF0A', linestyle: 'dotted' as const, title: 'OB3 (100)' } },
          { value: osLevel3, options: { color: '#FFFFFF0A', linestyle: 'dotted' as const, title: 'OS3 (-75)' } },
        ],
        markers,
        alerts: alertStates(alertConditions, bars, flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketCipherBInputs> = {}, chart: ChartContext = {}): IndicatorRun<McbResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketCipherBInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy (Big green circle)', message: 'Green circle WaveTrend Oversold' },
  { id: 'alert1', title: 'Buy (Big green circle + Div)', message: 'Buy & WT Bullish Divergence & WT Overbought' },
  { id: 'alert2', title: 'GOLD Buy (Big GOLDEN circle)', message: 'Green & GOLD circle WaveTrend Overbought' },
  { id: 'alert3', title: 'Sommi bullish flag/diamond', message: 'Blue flag/diamond' },
  { id: 'alert4', title: 'Buy (Small green dot)', message: 'Buy small circle' },
  { id: 'alert5', title: 'Sommi bearish flag/diamond', message: 'Purple flag/diamond' },
  { id: 'alert6', title: 'Sell (Big red circle)', message: 'Red Circle WaveTrend Overbought' },
  { id: 'alert7', title: 'Sell (Big red circle + Div)', message: 'Buy & WT Bearish Divergence & WT Overbought' },
  { id: 'alert8', title: 'Sell (Small red dot)', message: 'Sell small circle' },
];

export const MarketCipherB = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, alertConditions };
