/**
 * QQE Signals
 *
 * Overlay indicator that shows Long/Short plotshape markers based on QQE crosses.
 * RSI is smoothed with EMA, then a Wilder-style ATR trailing stop is computed on
 * the smoothed RSI. When RSI crosses the trailing stop, a signal fires.
 *
 * Pine display elements:
 *   - plotshape: "QQE long"  (labelup, belowbar, green, text "Long", textcolor white)
 *   - plotshape: "QQE short" (labeldown, abovebar, red, text "Short", textcolor white)
 * Alerts (alertcondition, `alerts` of the result): 'Long' and 'Short', true on the bars of each label.
 *
 * Reference: "QQE signals" by colinmck
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long', message: 'Long' },
  { id: 'alert1', title: 'Short', message: 'Short' },
];

export interface QQESignalsInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  threshHold: number;
}

export const defaultInputs: QQESignalsInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.238,
  threshHold: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'Fast QQE Factor', defval: 4.238, min: 0.01, step: 0.001 },
  { id: 'threshHold', type: 'int', title: 'Thresh-hold', defval: 10, min: 0 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'QQE Signals',
  shortTitle: 'QQESig',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QqeRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  rsiMa: ReturnType<typeof taStep.ema>;
  maAtrRsi: ReturnType<typeof taStep.ema>;
  dar: ReturnType<typeof taStep.ema>;
  rsiMaArr: number[];
  longBand: number[];
  shortBand: number[];
  trendDir: number[];
  trailing: number[];
  qqeXlong: number[];
  qqeXshort: number[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QQESignalsInputs>): BarStudy<QqeRun, Result> {
  const { rsiLen, smoothFactor, qqeFactor } = { ...defaultInputs, ...inputs };
  const wildersLen = rsiLen * 2 - 1;
  // Pine: qqeLong = QQExlong == 1 ? FastAtrRsiTL[1] - 50 : na
  //        qqeShort = QQExshort == 1 ? FastAtrRsiTL[1] - 50 : na
  // plotshape fires when value is not na, so condition is QQExlong == 1
  const warmup = wildersLen + smoothFactor;
  return {
    init() {
      // Pine: Rsi = rsi(src, RSI_Period); RsiMa = ema(Rsi, SF)
      const rsi = taStep.rsi(rsiLen);
      const rsiMa = taStep.ema(smoothFactor);
      // Pine: MaAtrRsi = ema(AtrRsi, Wilders_Period); dar = ema(MaAtrRsi, Wilders_Period) * QQE
      const maAtrRsi = taStep.ema(wildersLen);
      const dar = taStep.ema(wildersLen);
      const s: QqeRun = {
        rsi, rsiMa, maAtrRsi, dar, rsiMaArr: [], longBand: [], shortBand: [], trendDir: [], trailing: [], qqeXlong: [],
        qqeXshort: [], markers: [], flags: [[], []], times: [[], []],
        steps: [rsi, rsiMa, maAtrRsi, dar], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.rsiMaArr, s.longBand, s.shortBand, s.trendDir, s.trailing, s.qqeXlong, s.qqeXshort, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      // Pine: src = close
      const rsiMaV = s.rsiMa.step(s.rsi.step(bars[i]!.close));
      s.rsiMaArr[i] = rsiMaV;
      // Pine: AtrRsi = abs(RsiMa[1] - RsiMa)
      const prevMa = i > 0 ? (s.rsiMaArr[i - 1] ?? 0) : 0;
      const atrRsi = Math.abs(prevMa - (rsiMaV ?? 0));
      const darV = s.dar.step(s.maAtrRsi.step(atrRsi));
      const { longBand, shortBand, trendDir, trailing } = s;

      // Trailing stop bands
      const rsIndex = rsiMaV ?? 0;
      const dar = (darV ?? 0) * qqeFactor;
      const newLongBand = rsIndex - dar;
      const newShortBand = rsIndex + dar;

      if (i === 0) {
        longBand[i] = newLongBand;
        shortBand[i] = newShortBand;
        trendDir[i] = 1;
      } else {
        const prevRsIndex = s.rsiMaArr[i - 1] ?? 0;

        // Pine: longband := RSIndex[1] > longband[1] and RSIndex > longband[1] ? max(longband[1], newlongband) : newlongband
        longBand[i] = (prevRsIndex > longBand[i - 1]! && rsIndex > longBand[i - 1]!)
          ? Math.max(longBand[i - 1]!, newLongBand)
          : newLongBand;

        // Pine: shortband := RSIndex[1] < shortband[1] and RSIndex < shortband[1] ? min(shortband[1], newshortband) : newshortband
        shortBand[i] = (prevRsIndex < shortBand[i - 1]! && rsIndex < shortBand[i - 1]!)
          ? Math.min(shortBand[i - 1]!, newShortBand)
          : newShortBand;

        // Pine: cross_1 = cross(longband[1], RSIndex)
        // cross(a, b) = (a[1] <= b[1] and a > b) or (a[1] >= b[1] and a < b)
        // a = longband[1] => at bar i: a = longband[i-1], a[1] = longband[i-2]
        // b = RSIndex     => at bar i: b = RSIndex[i],     b[1] = RSIndex[i-1]
        let crossLongRsi = false;
        if (i >= 2) {
          crossLongRsi = (longBand[i - 2]! <= prevRsIndex && longBand[i - 1]! > rsIndex)
            || (longBand[i - 2]! >= prevRsIndex && longBand[i - 1]! < rsIndex);
        }

        // Pine: cross(RSIndex, shortband[1])
        // a = RSIndex     => at bar i: a = RSIndex[i],     a[1] = RSIndex[i-1]
        // b = shortband[1]=> at bar i: b = shortband[i-1], b[1] = shortband[i-2]
        let crossRsiShort = false;
        if (i >= 2) {
          crossRsiShort = (prevRsIndex <= shortBand[i - 2]! && rsIndex > shortBand[i - 1]!)
            || (prevRsIndex >= shortBand[i - 2]! && rsIndex < shortBand[i - 1]!);
        }

        // Pine: trend := cross(RSIndex, shortband[1]) ? 1 : cross_1 ? -1 : nz(trend[1], 1)
        if (crossRsiShort) {
          trendDir[i] = 1;
        } else if (crossLongRsi) {
          trendDir[i] = -1;
        } else {
          trendDir[i] = trendDir[i - 1]!;
        }
      }

      // Pine: FastAtrRsiTL = trend == 1 ? longband : shortband
      trailing[i] = trendDir[i] === 1 ? longBand[i]! : shortBand[i]!;

      // Pine: QQE cross count
      // QQExlong := FastAtrRsiTL < RSIndex ? QQExlong + 1 : 0
      // QQExshort := FastAtrRsiTL > RSIndex ? QQExshort + 1 : 0
      s.qqeXlong[i] = i === 0 ? 0 : trailing[i]! < rsIndex ? s.qqeXlong[i - 1]! + 1 : 0;
      s.qqeXshort[i] = i === 0 ? 0 : trailing[i]! > rsIndex ? s.qqeXshort[i - 1]! + 1 : 0;

      // alertcondition(qqeLong) / alertcondition(qqeShort): the float as a condition (na and 0 are false)
      let long = false;
      let short = false;
      if (i >= warmup) {
        const value1 = i > 0 ? trailing[i - 1]! - 50 : NaN;
        long = s.qqeXlong[i] === 1 && Number.isFinite(value1) && value1 !== 0;
        short = s.qqeXshort[i] === 1 && Number.isFinite(value1) && value1 !== 0;
        if (s.qqeXlong[i] === 1) {
          s.markers.push({ time: bars[i]!.time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'Long' });
        }
        if (s.qqeXshort[i] === 1) {
          s.markers.push({ time: bars[i]!.time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'Short' });
        }
      }
      s.flags[0]![i] = long;
      s.flags[1]![i] = short;
      if (long) s.times[0]!.push(bars[i]!.time as number);
      if (short) s.times[1]!.push(bars[i]!.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QQESignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QQESignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QQESignals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
