/**
 * Normalized QQE (nQQE)
 *
 * Smoothed RSI with a QQE trailing stop, normalized around zero.
 * QQEF = EMA(RSI, SF) − 50, QQES trailing stop − 50.
 * ATR of RSI uses double-WWMA (alpha = 1/length).
 *
 * Alerts (alertcondition, `alerts` of the result): the 8 conditions of the original on the fast line (QQEF, before
 * the -50 shift) and the slow line: any cross, crossover / crossunder of the two lines, the fast line crossing 50
 * (up / down), above 60, below 40, and back inside 40..60 (SIDEWAYS).
 *
 * Pine source: "Normalized Quantitative Qualitative Estimation" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'QQE Crossing Signal!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'QQE BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'QQE SELL SIGNAL!' },
  { id: 'alert3', title: 'Cross 0 Up Alert', message: 'QQE FAST Crossing 0 UP!' },
  { id: 'alert4', title: 'Cross 0 Down Alert', message: 'QQE FAST Crossing 0 DOWN!' },
  { id: 'alert5', title: 'Cross 10 Up Alert', message: 'QQE Above 10 UPTREND SIGNAL!' },
  { id: 'alert6', title: 'Cross -10 Down Alert', message: 'QQE Below -10 DOWNTREND SIGNAL!' },
  { id: 'alert7', title: 'SIDEWAYS', message: 'QQE Entering Sideways Market!' },
];

export interface NormalizedQQEInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  src: SourceType;
  showSignals: boolean;
}

export const defaultInputs: NormalizedQQEInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.236,
  src: 'close',
  showSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'Smooth Factor', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.236, min: 0.01, step: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignals', type: 'bool', title: 'Show Crossing Signals?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FAST', color: '#800000', lineWidth: 2 },
  { id: 'plot1', title: 'SLOW', color: '#0007E1', lineWidth: 2 },
];

export const metadata = {
  title: 'Normalized QQE',
  shortTitle: 'nQQE',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface QqeRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  QQEF: number[];
  WWMA: number[];
  ATRRSI: number[];
  QQES: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NormalizedQQEInputs>): BarStudy<QqeRun, Result> {
  const { rsiLen, smoothFactor, qqeFactor, src, showSignals } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // Pine: wwalpha = 1/length
  const wwalpha = 1 / rsiLen;
  const warmup = rsiLen + smoothFactor;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLen);
      const ema = taStep.ema(smoothFactor);
      const s: QqeRun = {
        rsi, ema, QQEF: [], WWMA: [], ATRRSI: [], QQES: [], plot0: [], plot1: [], markers: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [rsi, ema], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.QQEF, s.WWMA, s.ATRRSI, s.QQES, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      // Pine: RSII=ema(rsi(src,length),SSF)  /  QQEF=ema(rsi(src,length),SSF)
      const qf = s.ema.step(s.rsi.step(value(b)));
      s.QQEF[i] = qf;

      // Pine: TR=abs(RSII-RSII[1])
      // na while RSII or RSII[1] is na
      const cur = qf ?? NaN;
      const prev = i > 0 ? (s.QQEF[i - 1] ?? NaN) : NaN;
      const TR = Math.abs(cur - prev);

      // Pine: WWMA := wwalpha*TR + (1-wwalpha)*nz(WWMA[1])
      // Pine: ATRRSI := wwalpha*WWMA + (1-wwalpha)*nz(ATRRSI[1])
      // Two passes of recursive filter with alpha = 1/rsiLen
      let wwma: number;
      let atrrsi: number;
      if (i === 0) {
        wwma = TR;
        atrrsi = wwma;
      } else {
        // nz(WWMA[1]) / nz(ATRRSI[1]): an na value before (TR is na on the first bars) counts as 0
        const pw = s.WWMA[i - 1];
        const pa = s.ATRRSI[i - 1];
        wwma = wwalpha * TR + (1 - wwalpha) * (isNaN(pw) ? 0 : pw);
        atrrsi = wwalpha * wwma + (1 - wwalpha) * (isNaN(pa) ? 0 : pa);
      }
      s.WWMA[i] = wwma;
      s.ATRRSI[i] = atrrsi;

      // Pine: QUP=QQEF+ATRRSI*4.236, QDN=QQEF-ATRRSI*4.236
      // Pine: QQES:=QUP<nz(QQES[1]) ? QUP
      //            : QQEF>nz(QQES[1]) and QQEF[1]<nz(QQES[1]) ? QDN
      //            : QDN>nz(QQES[1]) ? QDN
      //            : QQEF<nz(QQES[1]) and QQEF[1]>nz(QQES[1]) ? QUP
      //            : nz(QQES[1])
      const f = qf ?? 0;
      const dar = atrrsi * qqeFactor;
      const QUP = f + dar;
      const QDN = f - dar;
      let qs: number;
      if (i === 0) {
        qs = 0;
      } else {
        const prevS = s.QQES[i - 1];
        const prevF = s.QQEF[i - 1] ?? 0;
        if (QUP < prevS) {
          qs = QUP;
        } else if (f > prevS && prevF < prevS) {
          qs = QDN;
        } else if (QDN > prevS) {
          qs = QDN;
        } else if (f < prevS && prevF > prevS) {
          qs = QUP;
        } else {
          qs = prevS;
        }
      }
      s.QQES[i] = qs;

      // Pine: QQF=plot(QQEF-50,"FAST",color=color.maroon,linewidth=2)
      // Pine: plot(QQEF-50,color=Colorh,linewidth=2,style=5)  -- colored overlay
      // Pine: Colorh = QQEF-50>10 ? #007002 : QQEF-50<-10 ? color.red : #E8E81A
      if (qf == null || i < warmup) {
        s.plot0[i] = { time, value: NaN };
      } else {
        const val = qf - 50;
        const color = val > 10 ? '#007002' : val < -10 ? '#FF0000' : '#E8E81A';
        s.plot0[i] = { time, value: val, color };
      }

      // Pine: QQS=plot(QQES-50,"SLOW",color=#0007E1,linewidth=2)
      s.plot1[i] = i < warmup ? { time, value: NaN } : { time, value: qs - 50 };

      // Pine: buySignalr = crossover(QQEF, QQES)
      // Pine: plotshape(buySignalr and showsignals ? (QQES-50)*0.995 : na, ...)
      // Pine: sellSignallr = crossunder(QQEF, QQES)
      // Pine: plotshape(sellSignallr and showsignals ? (QQES-50)*1.005 : na, ...)
      if (showSignals && i >= warmup) {
        const curF = qf ?? 0;
        const prevF = s.QQEF[i - 1] ?? 0;
        const prevS = s.QQES[i - 1];
        if (prevF <= prevS && curF > qs) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#008000', text: 'Buy' });
        } else if (prevF >= prevS && curF < qs) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
        }
      }

      // The 8 conditions on the (not normalised) QQEF / QQES lines
      const a = qf ?? NaN;
      const pa = i > 0 ? s.QQEF[i - 1] ?? NaN : NaN;
      const ps = i > 0 ? s.QQES[i - 1] : NaN;
      const up = a > qs && pa <= ps;
      const dn = a < qs && pa >= ps;
      setFlag(s, 0, i, time, up || dn); // cross(QQEF, QQES)
      setFlag(s, 1, i, time, up);
      setFlag(s, 2, i, time, dn);
      setFlag(s, 3, i, time, a > 50 && pa <= 50);
      setFlag(s, 4, i, time, a < 50 && pa >= 50);
      setFlag(s, 5, i, time, a > 60 && pa <= 60);
      setFlag(s, 6, i, time, a < 40 && pa >= 40);
      setFlag(s, 7, i, time, (a < 60 && pa >= 60) || (a > 40 && pa <= 40)); // crossunder(QQEF, 60) or crossover(QQEF, 40)
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [
          { value: 10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper' } },
          { value: -10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower' } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

function setFlag(s: QqeRun, k: number, i: number, time: number, f: boolean): void {
  s.flags[k][i] = f;
  if (f) s.times[k].push(time);
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NormalizedQQEInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NormalizedQQEInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NormalizedQQE = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
