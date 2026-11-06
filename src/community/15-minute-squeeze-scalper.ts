/**
 * Squeeze Momentum Scalper
 *
 * Bollinger Bands (SMA +- mult * stdev of the close) against Keltner Channels (SMA of the close +- mult * SMA of the
 * true range, or of high - low). Squeeze on (red cross at 0): the Bollinger Bands are inside the Keltner Channels;
 * squeeze off (green): they are outside; else no squeeze (blue). The momentum histogram is the linear regression of
 * close - average(average(highest high, lowest low), SMA of the close) over the KC length: lime / green above zero
 * (rising / falling), red / maroon below zero (falling / rising).
 * Alerts (alertcondition, `alerts` of the result): 'Squeeze Fired' (squeeze on the bar before, not on this bar),
 * 'Long Momentum' / 'Short Momentum' (the momentum crosses above / below zero).
 *
 * Reference: "15-Minute Squeeze Scalper (Traffic Light Edition)" by Universal_Scalper_Pro
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy,
  type IndicatorRun,
} from '../live-run';

export interface SqueezeMomentumScalperInputs {
  /** Bollinger Bands length */
  lengthBB: number;
  /** Bollinger Bands standard deviation factor */
  multBB: number;
  /** Keltner Channels length (also the momentum length) */
  lengthKC: number;
  /** Keltner Channels range factor */
  multKC: number;
  /** Keltner Channels range: true range (true) or high - low (false) */
  useTrueRange: boolean;
}

export const defaultInputs: SqueezeMomentumScalperInputs = {
  lengthBB: 20,
  multBB: 2.0,
  lengthKC: 20,
  multKC: 1.5,
  useTrueRange: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthBB', type: 'int', title: 'BB Length', defval: 20 },
  { id: 'multBB', type: 'float', title: 'BB MultFactor', defval: 2.0 },
  { id: 'lengthKC', type: 'int', title: 'KC Length', defval: 20 },
  { id: 'multKC', type: 'float', title: 'KC MultFactor', defval: 1.5 },
  { id: 'useTrueRange', type: 'bool', title: 'Use TrueRange (KC)', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Momentum Histogram', color: color.lime, lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze Status', color: color.blue, lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Squeeze Momentum Scalper [15m]',
  shortTitle: 'SQZ_Scalp',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface SqueezeRun extends BarRunState<Record<string, never>> {
  basis: WindowSma;
  sd: WindowStdev;
  ma: WindowSma;
  tr: ReturnType<typeof taStep.tr>;
  rangema: WindowSma;
  hh: WindowExtreme;
  ll: WindowExtreme;
  lr: ReturnType<typeof taStep.linreg>;
  val: number[];
  sqzOn: boolean[];
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SqueezeMomentumScalperInputs>): BarStudy<SqueezeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const nz = (v: number) => (Number.isFinite(v) ? v : 0);
  return {
    init() {
      const basis = new WindowSma(cfg.lengthBB);
      const sd = new WindowStdev(cfg.lengthBB);
      const ma = new WindowSma(cfg.lengthKC);
      const tr = taStep.tr();
      const rangema = new WindowSma(cfg.lengthKC);
      const hh = new WindowExtreme(false, cfg.lengthKC);
      const ll = new WindowExtreme(true, cfg.lengthKC);
      const lr = taStep.linreg(cfg.lengthKC, 0);
      const s: SqueezeRun = {
        basis, sd, ma, tr, rangema, hh, ll, lr, val: [], sqzOn: [], plot0: [], plot1: [], flags: [[], [], []],
        times: [[], [], []], steps: [basis, sd, ma, tr, rangema, hh, ll, lr], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.val, s.sqzOn, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      // Bollinger Bands
      const basis = s.basis.step(close);
      const sd = s.sd.step(close);
      const upperBB = basis + cfg.multBB * sd;
      const lowerBB = basis - cfg.multBB * sd;

      // Keltner Channels: range_val = useTrueRange ? ta.tr : high - low (ta.tr is na on the first bar)
      const ma = s.ma.step(close);
      const trv = s.tr.step(b.high, b.low, b.close);
      const rangeVal = cfg.useTrueRange ? trv : b.high - b.low;
      const rangema = s.rangema.step(rangeVal);
      const upperKC = ma + rangema * cfg.multKC;
      const lowerKC = ma - rangema * cfg.multKC;

      // Momentum: ta.linreg(close - avg(avg(highest(high), lowest(low)), sma(close)), lengthKC, 0)
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const val = s.lr.step(close - ((hh + ll) / 2 + ma) / 2);
      s.val[i] = val;

      const sqzOn = gt(lowerBB, lowerKC) && lt(upperBB, upperKC);
      s.sqzOn[i] = sqzOn;
      const pv = i > 0 ? s.val[i - 1] : NaN;

      // bcolor = val > 0 ? (val > nz(val[1]) ? lime : green) : (val < nz(val[1]) ? red : maroon)
      const prev = i > 0 ? nz(pv) : 0;
      const c = gt(val, 0) ? (gt(val, prev) ? color.lime : color.green) : (lt(val, prev) ? color.red : color.maroon);
      s.plot0[i] = { time: b.time, value: val, color: c };
      // scolor = noSqz ? blue : sqzOn ? red : green
      const sqzOff = lt(lowerBB, lowerKC) && gt(upperBB, upperKC);
      const noSqz = !sqzOn && !sqzOff;
      s.plot1[i] = { time: b.time, value: 0, color: noSqz ? color.blue : sqzOn ? color.red : color.green };

      // squeezeFired = sqzOn[1] and not sqzOn; longEntry = ta.crossover(val, 0); shortEntry = ta.crossunder(val, 0)
      const fired = i > 0 && s.sqzOn[i - 1] && !sqzOn;
      const longEntry = val > 0 && pv <= 0;
      const shortEntry = val < 0 && pv >= 0;
      const f = [fired, longEntry, shortEntry];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SqueezeMomentumScalperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SqueezeMomentumScalperInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Squeeze Fired', message: 'Volatility Squeeze has FIRED! Check histogram for direction.' },
  { id: 'alert1', title: 'Long Momentum', message: 'Momentum has crossed bullish.' },
  { id: 'alert2', title: 'Short Momentum', message: 'Momentum has crossed bearish.' },
];

export const SqueezeMomentumScalper = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
