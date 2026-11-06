/**
 * Momentum-based ZigZag (incl. QQE) NON-REPAINTING
 *
 * Non-repainting ZigZag that switches direction based on momentum signals
 * from MACD, Moving Average, or QQE. ZigZag tracks peaks/bottoms;
 * momentum determines direction changes. Force detection via RSI(5).
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): on each LONG / SHORT signal,
 * 'long slprice=<stop> tp=<TakeProfitLevel>' / 'short slprice=<stop> tp=<TakeProfitLevel>' as the original builds them.
 *
 * Reference: "Momentum-based ZigZag (incl. QQE) NON-REPAINTING" by Peter_O
 */

import { taStep, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface MomentumZigZagInputs {
  momentumSelect: string;
  colorLines: boolean;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  macdOscType: string;
  macdSigType: string;
  maType: string;
  maLength: number;
  rsiPeriod: number;
  qqeFactor: number;
  rsiSmoothing: number;
  qqeThreshold: number;
  /** Take profit level written in the alert messages (no effect on the other outputs) */
  takeProfitLevel: number;
}

export const defaultInputs: MomentumZigZagInputs = {
  momentumSelect: 'QQE',
  colorLines: true,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  macdOscType: 'EMA',
  macdSigType: 'EMA',
  maType: 'SMA',
  maLength: 20,
  rsiPeriod: 14,
  qqeFactor: 4.238,
  rsiSmoothing: 5,
  qqeThreshold: 10,
  takeProfitLevel: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'momentumSelect', type: 'string', title: 'Select Momentum Indicator', defval: 'QQE', options: ['MACD', 'MovingAverage', 'QQE'] },
  { id: 'colorLines', type: 'bool', title: 'Color ZigZag lines to show force direction', defval: true },
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'MACD Signal Smoothing', defval: 9, min: 1 },
  { id: 'macdOscType', type: 'string', title: 'MACD Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'macdSigType', type: 'string', title: 'MACD Signal MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['EMA', 'SMA', 'WMA', 'HMA', 'RMA'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 20, min: 1 },
  { id: 'rsiPeriod', type: 'int', title: 'QQE RSI Length', defval: 14, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.238, min: 0.001, step: 0.001 },
  { id: 'rsiSmoothing', type: 'int', title: 'QQE RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeThreshold', type: 'int', title: 'QQE Threshold', defval: 10, min: 0 },
  { id: 'takeProfitLevel', type: 'int', title: 'TakeProfitLevel', defval: 200 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZigZag', color: '#000000', lineWidth: 5 },
];

export const metadata = {
  title: 'Momentum-based ZigZag',
  shortTitle: 'MomZZ',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };
type Ma = { step(v: number): number; commit(): void };

interface ZigZagVars {
  /** QQE: the bars of the last two qqeLong / qqeShort crosses (-1: none) */
  long1: number;
  long2: number;
  short1: number;
  short2: number;
  /** The last bar (before the current one) of momentumUP / momentumDOWN / rsi5 > ob / rsi5 < os (-1: none) */
  lastUp: number;
  lastDown: number;
  lastAbove: number;
  lastBelow: number;
  /** The colour that sticks from one momentum signal until the next */
  lastColor: string;
  /** var stoploss_long = low / var stoploss_short = high (first bar) */
  stoplossLong: number;
  stoplossShort: number;
}

interface ZigZagRun extends BarRunState<ZigZagVars> {
  machines: Ma[];
  rsi5: ReturnType<typeof taStep.rsi>;
  /** MACD: macd line and signal; MovingAverage: the average */
  a: number[];
  b: number[];
  /** QQE state by bar */
  rsiMa: number[];
  longband: number[];
  shortband: number[];
  trend: number[];
  qqeLong: number[];
  qqeShort: number[];
  lastQqeHigh: number[];
  lastQqeLow: number[];
  momDir: number[];
  zzPeak: number[];
  zzBottom: number[];
  zzLine: number[];
  plot0: { time: number; value: number; color: string }[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<MomentumZigZagInputs>): BarStudy<ZigZagRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const ob = 80;
  const os = 20;
  const wildPeriod = cfg.rsiPeriod * 2 - 1;
  const smaOrEma = (type: string, length: number): Ma => (type === 'SMA' ? new WindowSma(length) : taStep.ema(length));
  const maOf = (): Ma => {
    switch (cfg.maType) {
      case 'EMA': return taStep.ema(cfg.maLength);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'HMA': return taStep.hma(cfg.maLength);
      case 'RMA': return taStep.rma(cfg.maLength);
      default: return new WindowSma(cfg.maLength);
    }
  };
  const tp = str.tostring(cfg.takeProfitLevel);
  return {
    init() {
      let machines: Ma[];
      if (cfg.momentumSelect === 'MACD') {
        machines = [
          smaOrEma(cfg.macdOscType, cfg.fastLength), smaOrEma(cfg.macdOscType, cfg.slowLength),
          smaOrEma(cfg.macdSigType, cfg.signalLength),
        ];
      } else if (cfg.momentumSelect === 'MovingAverage') {
        machines = [maOf()];
      } else {
        // rsi, RsiMa, MaAtrRsi, dar
        machines = [taStep.rsi(cfg.rsiPeriod), taStep.ema(cfg.rsiSmoothing), taStep.ema(wildPeriod), taStep.ema(wildPeriod)];
      }
      // --- Force detection (RSI 5) ---
      const rsi5 = taStep.rsi(5);
      const s: ZigZagRun = {
        machines, rsi5, a: [], b: [], rsiMa: [], longband: [], shortband: [], trend: [], qqeLong: [], qqeShort: [],
        lastQqeHigh: [], lastQqeLow: [], momDir: [], zzPeak: [], zzBottom: [], zzLine: [], plot0: [], markers: [],
        alertCalls: [],
        steps: [...machines, rsi5],
        vars: {
          long1: -1, long2: -1, short1: -1, short2: -1, lastUp: -1, lastDown: -1, lastAbove: -1, lastBelow: -1,
          lastColor: '#808080', stoplossLong: NaN, stoplossShort: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = [
        s.a, s.b, s.rsiMa, s.longband, s.shortband, s.trend, s.qqeLong, s.qqeShort, s.lastQqeHigh, s.lastQqeLow, s.momDir,
        s.zzPeak, s.zzBottom, s.zzLine, s.plot0,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const close = bar.close;
      const high = bar.high;
      const low = bar.low;
      if (i === 0) {
        v.stoplossLong = low;
        v.stoplossShort = high;
      }

      // --- Momentum UP/DOWN signals ---
      let momentumUp = false;
      let momentumDown = false;
      if (cfg.momentumSelect === 'MACD') {
        // MACD
        const fastMa = s.machines[0].step(close);
        const slowMa = s.machines[1].step(close);
        const m = (fastMa ?? 0) - (slowMa ?? 0);
        const sig = s.machines[2].step(m);
        s.a[i] = m;
        s.b[i] = sig;
        // Crossover/crossunder
        if (i >= 1) {
          const mPrev = s.a[i - 1];
          const sg = sig ?? 0;
          const sPrev = s.b[i - 1] ?? 0;
          if (mPrev <= sPrev && m > sg) momentumUp = true;
          if (mPrev >= sPrev && m < sg) momentumDown = true;
        }
      } else if (cfg.momentumSelect === 'MovingAverage') {
        // Moving Average direction change
        s.a[i] = s.machines[0].step(close);
        // Pine: maUP = ma > ma[1] and ma[2] > ma[1] (trough detection)
        // maDOWN = ma < ma[1] and ma[2] < ma[1] (peak detection)
        if (i >= 2) {
          const cur = s.a[i] ?? 0;
          const prev = s.a[i - 1] ?? 0;
          const prev2 = s.a[i - 2] ?? 0;
          if (cur > prev && prev2 > prev) momentumUp = true;
          if (cur < prev && prev2 < prev) momentumDown = true;
        }
      } else {
        // QQE
        const rsi = s.machines[0].step(close);
        const rsiMaArr = s.rsiMa;
        rsiMaArr[i] = s.machines[1].step(rsi ?? 50);
        // AtrRsi = abs(RsiMa[1] - RsiMa)
        const atrRsi = i >= 1 ? Math.abs((rsiMaArr[i - 1] ?? 50) - (rsiMaArr[i] ?? 50)) : 0;
        const maAtrRsi = s.machines[2].step(atrRsi);
        const darRaw = s.machines[3].step(maAtrRsi ?? 0);

        const { longband, shortband, trend, qqeLong, qqeShort, lastQqeHigh, lastQqeLow } = s;
        if (i === 0) {
          longband[0] = 0;
          shortband[0] = 0;
          trend[0] = 1;
          qqeLong[0] = 0;
          qqeShort[0] = 0;
          lastQqeHigh[0] = 0;
          lastQqeLow[0] = 0;
        } else {
          const dar = (darRaw ?? 0) * cfg.qqeFactor;
          const rsiIndex = rsiMaArr[i] ?? 50;
          const rsiIndexPrev = rsiMaArr[i - 1] ?? 50;

          const newLongband = rsiIndex - dar;
          const newShortband = rsiIndex + dar;

          longband[i] = rsiIndexPrev > longband[i - 1] && rsiIndex > longband[i - 1]
            ? Math.max(longband[i - 1], newLongband)
            : newLongband;

          shortband[i] = rsiIndexPrev < shortband[i - 1] && rsiIndex < shortband[i - 1]
            ? Math.min(shortband[i - 1], newShortband)
            : newShortband;

          // Determine barssince for qqeLong/qqeShort (none: more than any count found)
          const barsSinceUp = v.long1 >= 0 ? i - v.long1 : Infinity;
          const barsSinceDown = v.short1 >= 0 ? i - v.short1 : Infinity;

          const goingUp = barsSinceUp < barsSinceDown;
          const goingDown = barsSinceUp > barsSinceDown;

          let prevGoingUp = false;
          let prevGoingDown = false;
          if (i >= 2) {
            // the last crosses up to bar i - 2
            const u = v.long1 === i - 1 ? v.long2 : v.long1;
            const d = v.short1 === i - 1 ? v.short2 : v.short1;
            const bsU2 = u >= 0 ? i - 1 - u : Infinity;
            const bsD2 = d >= 0 ? i - 1 - d : Infinity;
            prevGoingUp = bsU2 < bsD2;
            prevGoingDown = bsU2 > bsD2;
          }

          // Track last QQE high/low
          lastQqeHigh[i] = (high > lastQqeHigh[i - 1] && goingUp) || (prevGoingDown && goingUp)
            ? high
            : lastQqeHigh[i - 1] || high;

          lastQqeLow[i] = (low < lastQqeLow[i - 1] && goingDown) || (prevGoingUp && goingDown)
            ? low
            : lastQqeLow[i - 1] || low;

          // Trend
          const crossOverShort = rsiIndex > shortband[i - 1] && rsiIndexPrev <= shortband[i - 1];
          const crossUnderLong = rsiIndex < longband[i - 1] && rsiIndexPrev >= longband[i - 1];
          const breakHigh = high > lastQqeHigh[i - 1] && (i < 2 || bars[i - 1].high <= lastQqeHigh[i - 2]);
          const breakLow = low < lastQqeLow[i - 1] && (i < 2 || bars[i - 1].low >= lastQqeLow[i - 2]);

          if (crossOverShort || breakHigh) {
            trend[i] = 1;
          } else if (crossUnderLong || breakLow) {
            trend[i] = -1;
          } else {
            trend[i] = trend[i - 1];
          }

          // QQE crosses
          qqeLong[i] = trend[i] === 1 && trend[i - 1] === -1 ? 1 : 0;
          qqeShort[i] = trend[i] === -1 && trend[i - 1] === 1 ? 1 : 0;
          if (qqeLong[i] === 1) {
            v.long2 = v.long1;
            v.long1 = i;
          }
          if (qqeShort[i] === 1) {
            v.short2 = v.short1;
            v.short1 = i;
          }
        }
        if (qqeLong[i] === 1) momentumUp = true;
        if (qqeShort[i] === 1) momentumDown = true;
      }

      // --- Momentum direction ---
      const momDir = s.momDir;
      momDir[i] = momentumUp ? 1 : momentumDown ? -1 : i > 0 ? momDir[i - 1] : 0;

      // barssince(x) at [i - 1]: the bars since the last bar before i where x is true, i when none
      const rsi5 = s.rsi5.step(close);
      let forceUpColor = '#808080'; // gray default
      let wasForceUp = false;
      let wasForceDown = false;
      if (i >= 1) {
        if (momentumDown) {
          // Was force up: barssince(momentumUP) >= barssince(rsi5 > ob) at [i-1]
          wasForceUp = i - 1 - v.lastUp >= i - 1 - v.lastAbove;
          if (wasForceUp) forceUpColor = '#00FF00'; // lime = force up
        }
        if (momentumUp) {
          // Was force down: barssince(momentumDOWN) >= barssince(rsi5 < os) at [i-1]
          wasForceDown = i - 1 - v.lastDown >= i - 1 - v.lastBelow;
          if (wasForceDown) forceUpColor = '#FF0000'; // red = force down
        }
      }

      // --- ZigZag computation ---
      const { zzPeak, zzBottom } = s;
      const goingUp = momDir[i] === 1;
      const goingDown = momDir[i] === -1;
      const prevGoingUp = i > 0 ? momDir[i - 1] === 1 : false;
      const prevGoingDown = i > 0 ? momDir[i - 1] === -1 : false;

      // Peak
      if (i === 0) {
        zzPeak[i] = high;
      } else if ((high > zzPeak[i - 1] && goingUp) || (prevGoingDown && goingUp)) {
        zzPeak[i] = high;
      } else {
        zzPeak[i] = zzPeak[i - 1] || high;
      }

      // Bottom
      if (i === 0) {
        zzBottom[i] = low;
      } else if ((low < zzBottom[i - 1] && goingDown) || (prevGoingUp && goingDown)) {
        zzBottom[i] = low;
      } else {
        zzBottom[i] = zzBottom[i - 1] || low;
      }

      // ZigZag value
      let zigzag = NaN;
      if (i > 0) {
        if (goingUp && prevGoingDown) {
          zigzag = zzBottom[i - 1];
        } else if (prevGoingUp && goingDown) {
          zigzag = zzPeak[i - 1];
        }
      }

      // Build the running zigzag: at each bar, the value is either a pivot or the running extreme
      const zzLine = s.zzLine;
      if (!isNaN(zigzag)) {
        zzLine[i] = zigzag;
      } else if (momDir[i] === 1) {
        // Going up: track peak
        zzLine[i] = zzPeak[i];
      } else if (momDir[i] === -1) {
        // Going down: track bottom
        zzLine[i] = zzBottom[i];
      } else if (i > 0) {
        zzLine[i] = zzLine[i - 1];
      } else {
        zzLine[i] = NaN;
      }

      // Determine per-bar color based on the last momentum signal's force classification
      // The color sticks from one momentum signal until the next
      if (forceUpColor !== '#808080') {
        v.lastColor = forceUpColor;
      }
      if (momentumUp || momentumDown) {
        if (forceUpColor !== '#808080') {
          v.lastColor = forceUpColor;
        } else {
          v.lastColor = '#808080';
        }
      }
      s.plot0[i] = { time: bar.time, value: zzLine[i], color: cfg.colorLines ? v.lastColor : '#000000' };

      // --- Markers for LONG/SHORT ---
      if (i >= 1) {
        let goLong = false, goShort = false;
        if (momentumDown) {
          goShort = !wasForceUp;
          // GoShort = momentumDOWN and not force_up
          if (!wasForceUp && !isNaN(zigzag)) {
            s.markers.push({
              time: bar.time,
              position: 'aboveBar',
              shape: 'labelDown',
              color: '#FF0000',
              text: 'SHORT\npivot high:\n' + zigzag.toFixed(2),
            });
          }
        }
        if (momentumUp) {
          goLong = !wasForceDown;
          // GoLong = momentumUP and not force_down
          if (!wasForceDown && !isNaN(zigzag)) {
            s.markers.push({
              time: bar.time,
              position: 'belowBar',
              shape: 'labelUp',
              color: '#00FF00',
              text: 'LONG\npivot low:\n' + zigzag.toFixed(2),
            });
          }
        }
        // pl / ph = ta.valuewhen(momentumUP / momentumDOWN, ZigZag, 0): this bar's ZigZag on a signal bar
        // if GoLong: stoploss_long := low < pl ? low : pl / if GoShort: stoploss_short := high > ph ? high : ph
        if (goLong) v.stoplossLong = low < zigzag ? low : zigzag;
        if (goShort) v.stoplossShort = high > zigzag ? high : zigzag;
        // alert('long slprice=' + str.tostring(stoploss_long) + ' tp=' + str.tostring(TakeProfitLevel), freq_once_per_bar_close)
        if (goLong) s.alertCalls.push({ time: bar.time as number, message: 'long slprice=' + str.tostring(v.stoplossLong) + ' tp=' + tp, freq: 'once_per_bar_close' });
        if (goShort) s.alertCalls.push({ time: bar.time as number, message: 'short slprice=' + str.tostring(v.stoplossShort) + ' tp=' + tp, freq: 'once_per_bar_close' });
      }

      // this bar in the barssince of the next bars
      if (momentumUp) v.lastUp = i;
      if (momentumDown) v.lastDown = i;
      if ((rsi5 ?? 0) > ob) v.lastAbove = i;
      if ((rsi5 ?? 0) < os) v.lastBelow = i;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MomentumZigZagInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MomentumZigZagInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MomentumZigZag = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
