/**
 * Market Cipher A (VuManChu Cipher A)
 *
 * EMA ribbon overlay with 8 EMAs (5,11,15,18,21,24,28,34), WaveTrend oscillator,
 * RSI, and RSI+MFI for signal generation.
 *
 * Display elements from Pine:
 * - 8 EMA ribbon lines with conditional colors (blue shades when bullish, gray when bearish), each from the first
 *   bar where its ta.ema exists (bar index length - 1)
 * - RSI+MFI = sma(((close - open) / (high - low)) * multiplier, period): na while a bar whose high equals its low
 *   is in the window (division by zero), so the Yellow Cross is not drawn there
 * - Fills between EMA1-EMA2 and EMA2-EMA8
 * - 8 plotshape markers, all above the bar: longEma, shortEma, redCross, blueTriangle, redDiamond,
 *   bullCandle, bloodDiamond, yellowCross; drawn from the first bar where their series exist (no extra warm-up);
 *   Bull candle and Yellow Cross in color.yellow (#FFEB3B), the Blood Diamond without text
 * Alerts (alertcondition, `alerts` of the result): Red Diamond, Blood Diamond, YellowX, RedX, Longema and
 * Bluetriangle, on every bar of the signal.
 *
 * Reference: "VuManChu Cipher A" (overlay=true)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun, WindowSma } from '../live-run';

export interface MarketCipherAInputs {
  wtChannelLen: number;
  wtAverageLen: number;
  wtMALen: number;
  ema1Len: number;
  ema2Len: number;
  ema3Len: number;
  ema4Len: number;
  ema5Len: number;
  ema6Len: number;
  ema7Len: number;
  ema8Len: number;
  rsiLen: number;
  rsiMFIPeriod: number;
  rsiMFIMultiplier: number;
}

export const defaultInputs: MarketCipherAInputs = {
  wtChannelLen: 9,
  wtAverageLen: 13,
  wtMALen: 3,
  ema1Len: 5,
  ema2Len: 11,
  ema3Len: 15,
  ema4Len: 18,
  ema5Len: 21,
  ema6Len: 24,
  ema7Len: 28,
  ema8Len: 34,
  rsiLen: 14,
  rsiMFIPeriod: 60,
  rsiMFIMultiplier: 150,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'WT Channel Length', defval: 9, min: 1 },
  { id: 'wtAverageLen', type: 'int', title: 'WT Average Length', defval: 13, min: 1 },
  { id: 'wtMALen', type: 'int', title: 'WT MA Length', defval: 3, min: 1 },
  { id: 'ema1Len', type: 'int', title: 'EMA 1', defval: 5, min: 1 },
  { id: 'ema2Len', type: 'int', title: 'EMA 2', defval: 11, min: 1 },
  { id: 'ema3Len', type: 'int', title: 'EMA 3', defval: 15, min: 1 },
  { id: 'ema4Len', type: 'int', title: 'EMA 4', defval: 18, min: 1 },
  { id: 'ema5Len', type: 'int', title: 'EMA 5', defval: 21, min: 1 },
  { id: 'ema6Len', type: 'int', title: 'EMA 6', defval: 24, min: 1 },
  { id: 'ema7Len', type: 'int', title: 'EMA 7', defval: 28, min: 1 },
  { id: 'ema8Len', type: 'int', title: 'EMA 8', defval: 34, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiMFIPeriod', type: 'int', title: 'RSI+MFI Period', defval: 60, min: 1 },
  { id: 'rsiMFIMultiplier', type: 'int', title: 'RSI+MFI Multiplier', defval: 150, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ema1', title: 'EMA 1', color: '#1573d4', lineWidth: 2 },
  { id: 'ema2', title: 'EMA 2', color: '#3096ff', lineWidth: 2 },
  { id: 'ema3', title: 'EMA 3', color: '#57abff', lineWidth: 2 },
  { id: 'ema4', title: 'EMA 4', color: '#85c2ff', lineWidth: 2 },
  { id: 'ema5', title: 'EMA 5', color: '#9bcdff', lineWidth: 2 },
  { id: 'ema6', title: 'EMA 6', color: '#b3d9ff', lineWidth: 2 },
  { id: 'ema7', title: 'EMA 7', color: '#c9e5ff', lineWidth: 2 },
  { id: 'ema8', title: 'EMA 8', color: '#dfecfb', lineWidth: 2 },
];

export const metadata = {
  title: 'Market Cipher A',
  shortTitle: 'MCA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface McaVars {
  pe1: number;
  pe2: number;
  pe3: number;
  pe8: number;
  pw1: number;
  pw2: number;
  /** running sum and na count of the RSI+MFI window */
  sum: number;
  naCount: number;
}

interface McaRun extends BarRunState<McaVars> {
  emas: ReturnType<typeof taStep.ema>[];
  esa: ReturnType<typeof taStep.ema>;
  de: ReturnType<typeof taStep.ema>;
  wt1: ReturnType<typeof taStep.ema>;
  wt2: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  mfiRaw: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

// --- EMA plots with conditional colors ---
// Pine: ribbonDir = ema8 < ema2; color = ribbonDir ? blue_shade : gray
const blueShades = ['#1573d4', '#3096ff', '#57abff', '#85c2ff', '#9bcdff', '#b3d9ff', '#c9e5ff', '#dfecfb'];
const plotIds = ['ema1', 'ema2', 'ema3', 'ema4', 'ema5', 'ema6', 'ema7', 'ema8'];

function study(inputs: Partial<MarketCipherAInputs>): BarStudy<McaRun, Result> {
  const {
    wtChannelLen, wtAverageLen, wtMALen,
    ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, ema6Len, ema7Len, ema8Len,
    rsiLen, rsiMFIPeriod, rsiMFIMultiplier,
  } = { ...defaultInputs, ...inputs };
  // --- 8 EMA Ribbon ---
  const lengths = [ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, ema6Len, ema7Len, ema8Len];
  /** the EMAs of the bar */
  const ema: number[] = new Array(8).fill(NaN);
  return {
    init() {
      const s: McaRun = {
        emas: lengths.map((len) => taStep.ema(len)),
        esa: taStep.ema(wtChannelLen), de: taStep.ema(wtChannelLen), wt1: taStep.ema(wtAverageLen), wt2: new WindowSma(wtMALen),
        rsi: taStep.rsi(rsiLen),
        mfiRaw: [], plots: plotIds.map(() => []), markers: [], flags: [[], [], [], [], [], []],
        times: [[], [], [], [], [], []],
        steps: [],
        vars: { pe1: NaN, pe2: NaN, pe3: NaN, pe8: NaN, pw1: NaN, pw2: NaN, sum: 0, naCount: 0 },
        lists: [], series: [],
      };
      s.steps = [...s.emas, s.esa, s.de, s.wt1, s.wt2, s.rsi];
      s.lists = [s.markers, ...s.times];
      s.series = [s.mfiRaw, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      const close = b.close;
      for (let p = 0; p < 8; p++) ema[p] = s.emas[p].step(close);
      const e1 = ema[0];
      const e2 = ema[1];
      const e3 = ema[2];
      const e8 = ema[7];

      // --- WaveTrend ---
      // Pine: esa = ema(hlc3, chlen), de = ema(abs(hlc3 - esa), chlen),
      //        ci = (hlc3 - esa) / (0.015 * de), tci = ema(ci, avg), wt1 = tci, wt2 = sma(wt1, malen)
      const hlc3 = (b.high + b.low + b.close) / 3;
      const esa = s.esa.step(hlc3);
      const de = s.de.step(Math.abs(hlc3 - esa));
      const ci = (hlc3 - esa) / (de * 0.015);
      const w1 = s.wt1.step(ci);
      const w2 = s.wt2.step(w1);

      // --- RSI ---
      const rsi = s.rsi.step(close);

      // --- RSI+MFI: sma(((close - open) / (high - low)) * multiplier, period) ---
      // A bar whose high equals its low divides by zero: na, and the sma is na while that bar is in its window
      const range = b.high - b.low;
      const raw = range === 0 ? NaN : ((b.close - b.open) / range) * rsiMFIMultiplier;
      s.mfiRaw[i] = raw;
      if (Number.isNaN(raw)) v.naCount++; else v.sum += raw;
      if (i >= rsiMFIPeriod) {
        const old = s.mfiRaw[i - rsiMFIPeriod];
        if (Number.isNaN(old)) v.naCount--; else v.sum -= old;
      }
      const rsiMFI = i >= rsiMFIPeriod - 1 && v.naCount === 0 ? v.sum / rsiMFIPeriod : NaN;

      for (let p = 0; p < 8; p++) {
        const val = ema[p];
        // ta.ema exists from its length-th bar (bar index length - 1)
        if (val == null || Number.isNaN(val)) {
          s.plots[p][i] = { time, value: NaN };
        } else {
          const ribbonDir = e8 < e2;
          s.plots[p][i] = { time, value: val, color: ribbonDir ? blueShades[p] : '#787B86' };
        }
      }

      const { pe1, pe2, pe3, pe8, pw1, pw2 } = v;
      v.pe1 = e1;
      v.pe2 = e2;
      v.pe3 = e3;
      v.pe8 = e8;
      v.pw1 = w1;
      v.pw2 = w2;

      // Pine crossover/crossunder helpers (na compares false)
      const crossoverE2E8 = pe2 <= pe8 && e2 > e8;   // longEma
      const crossoverE8E2 = pe8 <= pe2 && e8 > e2;   // shortEma
      const crossunderE1E2 = pe1 >= pe2 && e1 < e2;  // redCross
      const crossoverE2E3 = pe2 <= pe3 && e2 > e3;   // blueTriangle

      // WaveTrend cross conditions
      // Pine: cross(wt1, wt2) => either crossover or crossunder
      const wtCross = (pw1 <= pw2 && w1 > w2) || (pw1 >= pw2 && w1 < w2);
      // Pine: wtCrossDown = wt2 - wt1 >= 0  (wt2 above wt1 = bearish)
      const wtCrossDown = (w2 - w1) >= 0;

      // Pine signals
      const redDiamond = wtCross && wtCrossDown;
      const redCross = crossunderE1E2;
      const yellowCross = redDiamond && w2 < 45 && w2 > -80 && rsi < 30 && rsi > 15 && rsiMFI < -5;
      const bloodDiamond = redDiamond && redCross;
      const bullCandle = b.open > e2 && b.open > e8 &&
        (i > 0 && bars[i - 1].close > bars[i - 1].open) &&
        (b.close > b.open) &&
        !redDiamond && !redCross;

      // alertcondition(redDiamond / bloodDiamond / yellowCross / redCross / longEma / blueTriangle != 0)
      const flags = [redDiamond, bloodDiamond, yellowCross, redCross, crossoverE2E8, crossoverE2E3];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }

      const markers = s.markers;
      // The markers are drawn wherever their condition holds: an na series makes the condition false
      // Pine plotshape order (determines marker z-order / priority); ids: shape<k> in that order
      // longEma: green circle aboveBar (transp=50)
      if (crossoverE2E8) {
        markers.push({ time, id: 'shape0', position: 'aboveBar', shape: 'circle', color: 'rgba(0,255,0,0.50)', text: '' });
      }
      // shortEma: red circle aboveBar (transp=50)
      if (crossoverE8E2) {
        markers.push({ time, id: 'shape1', position: 'aboveBar', shape: 'circle', color: 'rgba(255,0,0,0.50)', text: '' });
      }
      // redCross: red xcross aboveBar (transp=50)
      if (redCross) {
        markers.push({ time, id: 'shape2', position: 'aboveBar', shape: 'xcross', color: 'rgba(255,0,0,0.50)', text: '' });
      }
      // blueTriangle: blue triangleUp aboveBar (transp=50)
      if (crossoverE2E3) {
        markers.push({ time, id: 'shape3', position: 'aboveBar', shape: 'triangleUp', color: 'rgba(0,100,255,0.50)', text: '' });
      }
      // redDiamond: red diamond aboveBar (transp=25)
      if (redDiamond) {
        markers.push({ time, id: 'shape4', position: 'aboveBar', shape: 'diamond', color: 'rgba(255,0,0,0.75)', text: '' });
      }
      // bullCandle: color.yellow (#FFEB3B) diamond aboveBar (transp=75)
      if (bullCandle) {
        markers.push({ time, id: 'shape5', position: 'aboveBar', shape: 'diamond', color: 'rgba(255,235,59,0.25)', text: '' });
      }
      // bloodDiamond: red diamond aboveBar, size small (transp=15), no text
      if (bloodDiamond) {
        markers.push({ time, id: 'shape6', position: 'aboveBar', shape: 'diamond', color: 'rgba(255,0,0,0.85)', text: '' });
      }
      // yellowCross: color.yellow (#FFEB3B) xcross aboveBar (transp=25)
      if (yellowCross) {
        markers.push({ time, id: 'shape7', position: 'aboveBar', shape: 'xcross', color: 'rgba(255,235,59,0.75)', text: '' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let p = 0; p < 8; p++) plots[plotIds[p]] = s.plots[p].slice();
      // --- Fills ---
      // Pine: fill(p1, p2, color=#1573d4, transp=85) => ~15% opacity
      // Pine: fill(p2, p8, color=#363a45, transp=85) => ~15% opacity
      const fills = [
        { plot1: 'ema1', plot2: 'ema2', options: { color: 'rgba(21,115,212,0.15)' } },
        { plot1: 'ema2', plot2: 'ema8', options: { color: 'rgba(54,58,69,0.15)' } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketCipherAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketCipherAInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Red Diamond', message: 'Red Diamond' },
  { id: 'alert1', title: 'Blood Diamond', message: 'Blood Diamond' },
  { id: 'alert2', title: 'YellowX', message: 'YellowX' },
  { id: 'alert3', title: 'RedX', message: 'RedX' },
  { id: 'alert4', title: 'Longema', message: 'Longema' },
  { id: 'alert5', title: 'Bluetriangle', message: 'Bluetriangle' },
];

export const MarketCipherA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
