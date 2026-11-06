/**
 * RedK Slow_Smooth WMA (RSS_WMA)
 *
 * As the original: a triple-pass WMA. The "Combined Smoothness" length L is split over the three passes:
 * w2 = round(L / 3), w1 = round((L - w2) / 2), w3 = int((L - w2) / 2); LL = WMA(WMA(WMA(source, w1), w2), w3)
 * (the source itself for L <= 2). The line is green while it rises (LL > LL[1]), red otherwise; the plain WMA of the
 * source over L is a hidden plot. With "Up/Dn Swing Signal?" on: a triangle "Signal Locator %" of LL above the line
 * on a swing down (shape0), below it on a swing up (shape1).
 * Alerts (alertcondition, `alerts` of the result): 'RSS_WMA Swing Up' (the line rises, did not rise on the bar
 * before), 'RSS_WMA Swing Down' (the line does not rise, rose on the bar before) and 'RSS_WMA Swing' (either).
 *
 * Reference: "RedK RSS_WMA" by RedKTrader
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RedKRSSWMAInputs {
  src: SourceType;
  /** Combined Smoothness */
  length: number;
  showSig: boolean;
  sigMulti: number;
}

export const defaultInputs: RedKRSSWMAInputs = {
  src: 'close',
  length: 15,
  showSig: false,
  sigMulti: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Combined Smoothness', defval: 15, min: 1 },
  { id: 'showSig', type: 'bool', title: 'Up/Dn Swing Signal?', defval: false },
  { id: 'sigMulti', type: 'float', title: 'Signal Locator %', defval: 1.0, step: 0.2, min: 0, max: 20 },
];

const C_UP = '#33ff00';
const C_DN = '#ff1111';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SS_WMA Line', color: '#2196F3', lineWidth: 3 },
  { id: 'plot1', title: 'WMA', color: '#9C27B0', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'RedK RSS_WMA',
  shortTitle: 'RSS',
  overlay: true,
};

/** Pine round(): half away from zero */
const pineRound = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

/** f_LazyLine(_data, _length) of the original */
export function lazyLine(data: number[], length: number): number[] {
  if (length <= 2) return data.slice();
  const w2 = pineRound(length / 3);
  const w1 = pineRound((length - w2) / 2);
  const w3 = Math.trunc((length - w2) / 2);
  return taCore.wma(taCore.wma(taCore.wma(data, w1), w2), w3);
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Wma = ReturnType<typeof taStep.wma>;

interface RssRun extends BarRunState<Record<string, never>> {
  /** The three passes of f_LazyLine (null for length <= 2: the source itself) */
  passes: [Wma, Wma, Wma] | null;
  wma: Wma;
  ll: number[];
  uptrend: boolean[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RedKRSSWMAInputs>): BarStudy<RssRun, Result> {
  const { src, length, showSig, sigMulti } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // f_LazyLine(_data, _length) of the original
  const w2 = pineRound(length / 3);
  const w1 = pineRound((length - w2) / 2);
  const w3 = Math.trunc((length - w2) / 2);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const passes: RssRun['passes'] = length <= 2 ? null : [taStep.wma(), taStep.wma(), taStep.wma()];
      const wma = taStep.wma();
      const s: RssRun = {
        passes, wma, ll: [], uptrend: [], plot0: [], plot1: [], markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [...(passes ?? []), wma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.ll, s.uptrend, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const price = value(b) ?? NaN;
      const p = s.passes;
      const ll = p ? p[2].step(p[1].step(p[0].step(price, w1), w2), w3) : price;
      const wma = s.wma.step(price, length);
      s.ll[i] = ll;

      // uptrend = LL > LL[1] (na compares false)
      const uptrend = i > 0 && ll > s.ll[i - 1];
      s.uptrend[i] = uptrend;
      const prevUp = i > 0 && s.uptrend[i - 1];
      const swingUp = uptrend && !prevUp;
      const swingDn = prevUp && !uptrend;

      s.plot0[i] = { time: b.time, value: Number.isFinite(ll) ? ll : NaN, color: uptrend ? C_UP : C_DN };
      s.plot1[i] = { time: b.time, value: Number.isFinite(wma) ? wma : NaN };

      // plotshape(SignalOn and SwingDn ? LL + d : na) / (SignalOn and SwingUp ? LL - d : na), d = SigMulti / 100 * LL
      if (showSig) {
        const d = sigMulti / 100 * ll;
        if (swingDn && Number.isFinite(ll + d)) {
          s.markers.push({ id: 'shape0', time: b.time, position: 'atPriceMiddle', price: ll + d, shape: 'triangleDown', color: C_DN, size: 'small' });
        }
        if (swingUp && Number.isFinite(ll - d)) {
          s.markers.push({ id: 'shape1', time: b.time, position: 'atPriceMiddle', price: ll - d, shape: 'triangleUp', color: C_UP, size: 'small' });
        }
      }

      const flags = [swingUp, swingDn, swingUp || swingDn];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => !!f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RedKRSSWMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RedKRSSWMAInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RSS_WMA Swing Up', message: 'RSS_WMA Swing Up Detected!' },
  { id: 'alert1', title: 'RSS_WMA Swing Down', message: 'RSS_WMA Swing Down Detected!' },
  { id: 'alert2', title: 'RSS_WMA Swing', message: 'RSS_WMA Up/Down Swing Detected!' },
];

export const RedKRSSWMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
