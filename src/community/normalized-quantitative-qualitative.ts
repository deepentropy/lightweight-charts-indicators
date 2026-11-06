/**
 * Normalized Quantitative Qualitative Estimation (nQQE)
 *
 * QQE centred on zero: the fast line is the EMA (smoothing factor) of the RSI, minus 50. The volatility of the fast
 * line (absolute change, smoothed twice with a Wilder alpha 1 / RSI length) times 4.236 gives the upper and lower
 * bands, and the slow line is a trailing level that follows them. The fast line is also drawn as columns coloured by
 * the zone (above 10 green, below -10 red, else yellow). Optional Buy / Sell labels on the crossings of the two lines.
 *
 * Alerts (alertcondition, `alerts` of the result): the 8 conditions of the original on the fast line (QQEF, before
 * the -50 shift) and the slow line: any cross, crossover / crossunder of the two lines, the fast line crossing 50
 * (up / down), above 60, below 40, and back inside 40..60 (SIDEWAYS).
 *
 * Reference: "Normalized Quantitative Qualitative Estimation" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © KivancOzbilgic
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

export interface NormalizedQuantitativeQualitativeInputs {
  /** Source */
  src: SourceType;
  /** RSI length */
  length: number;
  /** EMA length of the RSI (smoothing factor) */
  ssf: number;
  /** Buy / Sell labels on the crossings */
  showSignals: boolean;
}

export const defaultInputs: NormalizedQuantitativeQualitativeInputs = {
  src: 'close',
  length: 14,
  ssf: 5,
  showSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'ssf', type: 'int', title: 'SF RSI SMoothing Factor', defval: 5, min: 1 },
  { id: 'showSignals', type: 'bool', title: 'Show Crossing Signals?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FAST', color: '#880E4F', lineWidth: 2 },
  { id: 'plot1', title: 'Plot', color: '#E8E81A', lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'SLOW', color: '#0007E1', lineWidth: 2 },
];

export const metadata = {
  title: ' Normalized Quantitative Qualitative Estimation',
  shortTitle: 'nQQE',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface NqqeVars {
  wwma: number;
  atrRsi: number;
  prevQqes: number;
}

interface NqqeRun extends BarRunState<NqqeVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  buy: ReturnType<typeof taStep.crossover>;
  sell: ReturnType<typeof taStep.crossunder>;
  qqef: number[];
  qqes: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NormalizedQuantitativeQualitativeInputs>): BarStudy<NqqeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const wwalpha = 1 / cfg.length;
  const v = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.length);
      const ema = taStep.ema(cfg.ssf);
      const buy = taStep.crossover();
      const sell = taStep.crossunder();
      const s: NqqeRun = {
        rsi, ema, buy, sell, qqef: [], qqes: [], plot0: [], plot1: [], plot2: [], markers: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [rsi, ema, buy, sell], vars: { wwma: 0, atrRsi: 0, prevQqes: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.qqef, s.qqes, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vr = s.vars;
      // QQEF = ema(rsi(src, length), SSF) (RSII is the same series)
      const f = s.ema.step(s.rsi.step(value(b)));
      s.qqef[i] = f;
      const f1 = i > 0 ? s.qqef[i - 1] : NaN;
      const tr = Math.abs(f - f1);
      // WWMA := wwalpha * TR + (1 - wwalpha) * nz(WWMA[1]); ATRRSI likewise from WWMA
      vr.wwma = wwalpha * tr + (1 - wwalpha) * nz(vr.wwma);
      vr.atrRsi = wwalpha * vr.wwma + (1 - wwalpha) * nz(vr.atrRsi);
      const qup = f + vr.atrRsi * 4.236;
      const qdn = f - vr.atrRsi * 4.236;
      const p = nz(vr.prevQqes);
      let q: number;
      if (lt(qup, p)) q = qup;
      else if (gt(f, p) && lt(f1, p)) q = qdn;
      else if (gt(qdn, p)) q = qdn;
      else if (lt(f, p) && gt(f1, p)) q = qup;
      else q = p;
      s.qqes[i] = q;
      vr.prevQqes = q;

      const time = b.time;
      const fast = f - 50;
      // Colorh = QQEF - 50 > 10 ? #007002 : QQEF - 50 < -10 ? color.red : #E8E81A
      const colorh = gt(fast, 10) ? '#007002' : lt(fast, -10) ? '#FF5252' : '#E8E81A';
      s.plot0[i] = { time, value: v(fast) };
      s.plot1[i] = { time, value: v(fast), color: colorh };
      s.plot2[i] = { time, value: v(q - 50) };

      const isBuy = s.buy.step(f, q);
      const isSell = s.sell.step(f, q);
      if (cfg.showSignals) {
        // plotshape(buySignalr and showsignals ? (QQES - 50) * 0.995 : na, location.absolute, shape.labelup, size.tiny)
        if (isBuy) {
          s.markers.push({ time, position: 'atPriceBottom', price: (q - 50) * 0.995, shape: 'labelUp',
            color: '#4CAF50', text: 'Buy', textColor: '#FFFFFF', size: 'tiny' });
        }
        if (isSell) {
          s.markers.push({ time, position: 'atPriceTop', price: (q - 50) * 1.005, shape: 'labelDown',
            color: '#FF5252', text: 'Sell', textColor: '#FFFFFF', size: 'tiny' });
        }
      }

      // The 8 conditions on the (not normalised) QQEF / QQES lines (compared with the bar before)
      const pf = f1;
      const pq = i > 0 ? s.qqes[i - 1] : NaN;
      const up = f > q && pf <= pq;
      const dn = f < q && pf >= pq;
      const over = (lvl: number) => f > lvl && pf <= lvl;
      const under = (lvl: number) => f < lvl && pf >= lvl;
      const flags = [
        up || dn, // cross(QQEF, QQES)
        up,
        dn,
        over(50),
        under(50),
        over(60),
        under(40),
        under(60) || over(40), // crossunder(QQEF, 60) or crossover(QQEF, 40)
      ];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 10, options: { title: 'Level', color: '#787B86', linestyle: 'dashed' } },
          { value: -10, options: { title: 'Level', color: '#787B86', linestyle: 'dashed' } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NormalizedQuantitativeQualitativeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NormalizedQuantitativeQualitativeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NormalizedQuantitativeQualitative = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
