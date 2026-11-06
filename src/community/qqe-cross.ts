/**
 * QQE Cross Indicator Alert v2.0
 *
 * ATR-like adaptive bands around smoothed RSI (QQE method).
 * Three types of signal crosses: QQE cross (RSI vs trailing stop),
 * zero cross (RSI vs 50), and channel cross (RSI enters OB/OS threshold).
 * Optional triple-MA filter for confirming BUY/SELL signals.
 * Zero crosses (XZ) are marked when no XC / XQ / BUY / SELL mark is on the bar, and a circle at the bottom marks each
 * BUY / SELL bar once the next bar exists (the original's "Cross Alert Completed").
 *
 * Reference: "QQE Cross" by JustUncleL
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface QqeCrossInputs {
  rsiLength: number;
  rsiSmoothing: number;
  qqeFactor: number;
  threshold: number;
  fastMALen: number;
  medMALen: number;
  slowMALen: number;
  maType: string;
  useFilter: boolean;
}

export const defaultInputs: QqeCrossInputs = {
  rsiLength: 6,
  rsiSmoothing: 3,
  qqeFactor: 2.618,
  threshold: 10,
  fastMALen: 8,
  medMALen: 21,
  slowMALen: 34,
  maType: 'HullMA',
  useFilter: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 6, min: 1 },
  { id: 'rsiSmoothing', type: 'int', title: 'RSI Smoothing', defval: 3, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 2.618, min: 0.01, step: 0.001 },
  { id: 'threshold', type: 'int', title: 'Threshold', defval: 10, min: 0 },
  { id: 'fastMALen', type: 'int', title: 'Fast MA Length', defval: 8, min: 1 },
  { id: 'medMALen', type: 'int', title: 'Medium MA Length', defval: 21, min: 1 },
  { id: 'slowMALen', type: 'int', title: 'Slow MA Length', defval: 34, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'HullMA', options: ['SMA', 'EMA', 'WMA', 'HullMA', 'DEMA', 'SMMA'] },
  { id: 'useFilter', type: 'bool', title: 'Use MA Filter', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'maFast', title: 'Fast MA', color: '#000000', lineWidth: 2 },
  { id: 'maMed', title: 'Medium MA', color: '#26A69A', lineWidth: 3 },
  { id: 'maSlow', title: 'Slow MA', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'QQE Cross',
  shortTitle: 'QQEX',
  overlay: true,
};

type Ma = { step(v: number): number; commit(): void };

/** Smoothed MA: smma[length - 1] = sma, smma[i] = (smma[i-1]*(len-1) + src[i]) / len (bars with an na source skipped) */
class SmmaStep implements Ma {
  private bar = 0;
  private sum = 0;
  private last = NaN;
  private nextSum = 0;
  private next = NaN;

  constructor(private readonly length: number) {}

  step(v: number): number {
    const i = this.bar;
    const length = this.length;
    this.nextSum = this.sum;
    this.next = NaN;
    if (!isNaN(v)) {
      if (i < length) {
        this.nextSum = this.sum + v;
        if (i === length - 1) this.next = this.nextSum / length;
      } else {
        this.next = (this.last * (length - 1) + v) / length;
      }
    }
    return this.next;
  }

  commit(): void {
    this.bar++;
    this.sum = this.nextSum;
    this.last = this.next;
  }
}

/** One selectable MA variant stepped bar by bar */
function maStep(length: number, maType: string): Ma {
  switch (maType) {
    case 'SMA': return new WindowSma(length);
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'HullMA': return taStep.hma(length);
    case 'DEMA': {
      const e1 = taStep.ema(length);
      const e2 = taStep.ema(length);
      return {
        step: (v) => { const a = e1.step(v); return 2 * a - e2.step(a); },
        commit: () => { e1.commit(); e2.commit(); },
      };
    }
    case 'SMMA': return new SmmaStep(length);
    default: return taStep.ema(length);
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface QqeVars {
  /** Track channel entry for XC */
  xcBuyCount: number;
  xcSellCount: number;
  /** BUY (1) / SELL (-1) on the bar before */
  prevSignal: number;
}

interface QqeRun extends BarRunState<QqeVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  rsIndex: ReturnType<typeof taStep.ema>;
  maAtrRsi: ReturnType<typeof taStep.ema>;
  deltaFast: ReturnType<typeof taStep.ema>;
  fast: Ma;
  med: Ma;
  slow: Ma;
  rsIndexArr: number[];
  longband: number[];
  shortband: number[];
  trend: number[];
  fastAtrRsiTL: number[];
  medArr: number[];
  maFast: Point[];
  maMed: Point[];
  maSlow: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<QqeCrossInputs>): BarStudy<QqeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Wilders_Period = RSILen * 2 - 1
  const wildersPeriod = cfg.rsiLength * 2 - 1;
  const warmup = cfg.rsiLength * 2 + cfg.rsiSmoothing + wildersPeriod;
  return {
    init() {
      const s: QqeRun = {
        rsi: taStep.rsi(cfg.rsiLength), rsIndex: taStep.ema(cfg.rsiSmoothing), maAtrRsi: taStep.ema(wildersPeriod),
        deltaFast: taStep.ema(wildersPeriod), fast: maStep(cfg.fastMALen, cfg.maType),
        med: maStep(cfg.medMALen, cfg.maType), slow: maStep(cfg.slowMALen, cfg.maType),
        rsIndexArr: [], longband: [], shortband: [], trend: [], fastAtrRsiTL: [], medArr: [], maFast: [], maMed: [],
        maSlow: [], markers: [],
        steps: [], vars: { xcBuyCount: 0, xcSellCount: 0, prevSignal: 0 }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.rsIndex, s.maAtrRsi, s.deltaFast, s.fast, s.med, s.slow];
      s.lists = [s.markers];
      s.series = [s.rsIndexArr, s.longband, s.shortband, s.trend, s.fastAtrRsiTL, s.medArr, s.maFast, s.maMed, s.maSlow];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const { longband, shortband, trend, fastAtrRsiTL, rsIndexArr } = s;

      // --- QQE Core ---
      // RSI; RSIndex = EMA(RSI, SF)
      const rsIndex = s.rsIndex.step(s.rsi.step(b.close));
      rsIndexArr[i] = rsIndex;
      // AtrRsi = abs(RSIndex[1] - RSIndex)
      const atrRsi = i >= 1 && !isNaN(rsIndex) && !isNaN(rsIndexArr[i - 1]) ? Math.abs(rsIndexArr[i - 1] - rsIndex) : NaN;
      // MaAtrRsi = EMA(AtrRsi, Wilders_Period); DeltaFastAtrRsi = EMA(MaAtrRsi, Wilders_Period) * QQE_factor
      const deltaFast = s.deltaFast.step(s.maAtrRsi.step(atrRsi)) * cfg.qqeFactor;

      // Build longband, shortband, trend, FastAtrRsiTL
      if (isNaN(rsIndex) || isNaN(deltaFast)) {
        if (i > 0) {
          longband[i] = longband[i - 1];
          shortband[i] = shortband[i - 1];
          trend[i] = trend[i - 1];
          fastAtrRsiTL[i] = fastAtrRsiTL[i - 1];
        } else {
          longband[i] = 0;
          shortband[i] = 0;
          trend[i] = 0;
          fastAtrRsiTL[i] = NaN;
        }
      } else {
        const newLongband = rsIndex - deltaFast;
        const newShortband = rsIndex + deltaFast;

        if (i === 0) {
          longband[i] = newLongband;
          shortband[i] = newShortband;
          trend[i] = 1;
        } else {
          // Longband ratchets up
          longband[i] = rsIndex > longband[i - 1]
            ? Math.max(longband[i - 1], newLongband)
            : newLongband;

          // Shortband ratchets down
          shortband[i] = rsIndex < shortband[i - 1]
            ? Math.min(shortband[i - 1], newShortband)
            : newShortband;

          // Trend detection via cross
          const prevRSI = rsIndexArr[i - 1];
          // Actually: cross(RSIndex, shortband[1]) => RSIndex crosses above or below shortband
          // Pine cross() means either direction. But in QQE context:
          // trend = cross(RSIndex, shortband[1]) ? 1 : cross(longband[1], RSIndex) ? -1 : nz(trend[1],1)
          // cross(a,b) = (a>b AND a[1]<=b[1]) OR (a<b AND a[1]>=b[1])
          const crossShort = (rsIndex > shortband[i - 1] && prevRSI <= shortband[i - 1]) ||
                              (rsIndex < shortband[i - 1] && prevRSI >= shortband[i - 1]);
          const crossLong = (longband[i - 1] > rsIndex && longband[i - 2 >= 0 ? i - 2 : 0] <= prevRSI) ||
                             (longband[i - 1] < rsIndex && longband[i - 2 >= 0 ? i - 2 : 0] >= prevRSI);

          if (crossShort) {
            trend[i] = 1;
          } else if (crossLong) {
            trend[i] = -1;
          } else {
            trend[i] = trend[i - 1] || 1;
          }
        }

        fastAtrRsiTL[i] = trend[i] === 1 ? longband[i] : shortband[i];
      }

      // --- MA plots ---
      const fma = s.fast.step(b.close);
      const mma = s.med.step(b.close);
      const sma = s.slow.step(b.close);
      s.medArr[i] = mma;
      s.maFast[i] = { time, value: fma };
      const rising = i > 0 && mma > s.medArr[i - 1];
      s.maMed[i] = { time, value: mma, color: rising ? '#26A69A' : '#EF5350' };
      s.maSlow[i] = { time, value: sma };

      // --- Signal crosses ---
      if (i < 1) return;
      // plotshape(buy[1] == 1 or sell[1] == 1, "Cross Alert Completed", location.bottom,
      //   color = sell[1] == 1 ? red : green, shape.circle, offset = -1)
      if (v.prevSignal !== 0) {
        s.markers.push({ time: bars[i - 1].time, position: 'bottom', shape: 'circle', color: v.prevSignal < 0 ? '#FF0000' : '#008000', id: 'shape8' });
      }
      v.prevSignal = 0;
      if (i < warmup || isNaN(rsIndex) || isNaN(fastAtrRsiTL[i])) return;

      const rsi = rsIndex;
      const rsiPrev = rsIndexArr[i - 1];
      const tl = fastAtrRsiTL[i];
      const tlPrev = fastAtrRsiTL[i - 1];

      // XQ: RSI signal crossing FastAtrRsiTL
      const xqUp = rsiPrev <= tlPrev && rsi > tl;
      const xqDn = rsiPrev >= tlPrev && rsi < tl;

      // XC: RSI entering threshold channel
      const upperThresh = 50 + cfg.threshold;
      const lowerThresh = 50 - cfg.threshold;
      const inUpperChannel = rsi > upperThresh;
      const inLowerChannel = rsi < lowerThresh;
      const wasInUpperChannel = rsiPrev > upperThresh;
      const wasInLowerChannel = rsiPrev < lowerThresh;

      // Count consecutive bars in channel
      if (inUpperChannel && !wasInUpperChannel) {
        v.xcSellCount = 1;
      } else if (inUpperChannel) {
        v.xcSellCount++;
      } else {
        v.xcSellCount = 0;
      }

      if (inLowerChannel && !wasInLowerChannel) {
        v.xcBuyCount = 1;
      } else if (inLowerChannel) {
        v.xcBuyCount++;
      } else {
        v.xcBuyCount = 0;
      }

      const xcBuyFirst = v.xcBuyCount === 1;
      const xcSellFirst = v.xcSellCount === 1;

      // MA filter
      let buyFilter = true;
      let sellFilter = true;

      if (cfg.useFilter) {
        const c = b.close;
        buyFilter = c > mma && mma > sma && fma > mma;
        sellFilter = c < mma && mma < sma && fma < mma;
      }

      // Final BUY/SELL (XC channel entry with filter)
      const isBuy = xcBuyFirst && buyFilter;
      const isSell = xcSellFirst && sellFilter;

      if (isBuy) {
        s.markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'BUY', id: 'shape6' });
      } else if (isSell) {
        s.markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'SELL', id: 'shape7' });
      }
      v.prevSignal = isBuy ? 1 : isSell ? -1 : 0;

      // XQ cross markers (not overlapping with BUY/SELL)
      if (xqUp && !isBuy) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#2196F3', text: 'XQ', id: 'shape2' });
      } else if (xqDn && !isSell) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#000000', text: 'XQ', id: 'shape3' });
      }

      // XC markers (channel entry that is not already a BUY/SELL)
      if (xcBuyFirst && !isBuy) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#808000', text: 'XC', id: 'shape0' });
      } else if (xcSellFirst && !isSell) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'XC', id: 'shape1' });
      }

      // XZ: RSI signal crossing 50, on a bar without a channel (XC), BUY / SELL or XQ mark of the same side:
      // plotshape(sQQEz and QQEzlong and QQEclong != 1 and buy[shunt] != 1 and not QQExlong, "QQE Zero Cross Over",
      //   shape.triangleup, location.belowbar, text = "XZ", color = aqua) and the mirror with fuchsia
      if (rsi > 50 && rsiPrev <= 50 && !xcBuyFirst && !isBuy && !xqUp) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#00FFFF', text: 'XZ', id: 'shape4' });
      }
      if (rsi < 50 && rsiPrev >= 50 && !xcSellFirst && !isSell && !xqDn) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#FF00FF', text: 'XZ', id: 'shape5' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          maFast: s.maFast.slice(),
          maMed: s.maMed.slice(),
          maSlow: s.maSlow.slice(),
        },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QqeCrossInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QqeCrossInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const QqeCross = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
