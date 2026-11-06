/**
 * Squeeze Momentum Indicator Version2
 *
 * Bollinger Bands (SMA of the close +- KC MultFactor * stdev of the close: the original uses the KC factor for the
 * bands, the BB MultFactor input is not used) against Keltner Channels (SMA of the close +- KC MultFactor * SMA of
 * the true range, or of high - low). The momentum line is the linear regression of
 * close - avg(avg(highest high, lowest low), SMA of the close) over the KC length; the signal line is its SMA over
 * the signal length. The cross line at 0 is blue without squeeze, black when the bands are inside the channels and
 * gray when they are outside.
 *
 * Reference: "Squeeze Momentum Indicator [LazyBear] Version2 by KıvanÇ fr3762" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear, modified by KıvanÇ @fr3762 on twitter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SqueezeMomentumIndicatorVersion2Inputs {
  /** BB Length */
  length: number;
  /** BB MultFactor (not used by the original computation) */
  mult: number;
  /** KC Length */
  lengthKC: number;
  /** KC MultFactor */
  multKC: number;
  /** Signal Length */
  signalPeriod: number;
  /** Use TrueRange (KC) */
  useTrueRange: boolean;
}

export const defaultInputs: SqueezeMomentumIndicatorVersion2Inputs = {
  length: 20,
  mult: 2.0,
  lengthKC: 20,
  multKC: 1.5,
  signalPeriod: 5,
  useTrueRange: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'BB Length', defval: 20 },
  { id: 'mult', type: 'float', title: 'BB MultFactor', defval: 2.0 },
  { id: 'lengthKC', type: 'int', title: 'KC Length', defval: 20 },
  { id: 'multKC', type: 'float', title: 'KC MultFactor', defval: 1.5 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Length', defval: 5 },
  { id: 'useTrueRange', type: 'bool', title: 'Use TrueRange (KC)', defval: true },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const BLUE = V1('#0000FF');
const BLACK = V1('#000000');
const GRAY = V1('#808080');
const RED = V1('#FF0000');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLUE, lineWidth: 2 },
  { id: 'plot1', title: 'Plot', color: BLUE, lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: 'Plot', color: RED, lineWidth: 2 },
];

export const metadata = {
  title: 'Squeeze Momentum Indicator [LazyBear] Version2 by KıvanÇ fr3762',
  shortTitle: 'SQZMOMv2',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface SqzRun extends BarRunState<Record<string, never>> {
  basis: ReturnType<typeof taStep.sma>;
  sd: ReturnType<typeof taStep.stdev>;
  ma: ReturnType<typeof taStep.sma>;
  tr: ReturnType<typeof taStep.tr>;
  rangema: ReturnType<typeof taStep.sma>;
  hh: ReturnType<typeof taStep.highest>;
  ll: ReturnType<typeof taStep.lowest>;
  linreg: ReturnType<typeof taStep.linreg>;
  signal: ReturnType<typeof taStep.sma>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<SqueezeMomentumIndicatorVersion2Inputs>): BarStudy<SqzRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, lengthKC, multKC, signalPeriod, useTrueRange } = cfg;
  const num = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const basis = taStep.sma();
      const sd = taStep.stdev();
      // the same ta.sma(close, length) when the KC length is the BB length (one machine, the same doubles)
      const shared = lengthKC === length;
      const ma = shared ? basis : taStep.sma();
      const tr = taStep.tr(false);
      const rangema = taStep.sma();
      const hh = taStep.highest();
      const ll = taStep.lowest();
      const linreg = taStep.linreg(lengthKC, 0);
      const signal = taStep.sma();
      const s: SqzRun = {
        basis, sd, ma, tr, rangema, hh, ll, linreg, signal, plot0: [], plot1: [], plot2: [],
        steps: [basis, sd, ...(shared ? [] : [ma]), tr, rangema, hh, ll, linreg, signal], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      // BB: basis = sma(close, length), dev = multKC * stdev(close, length)
      const basis = s.basis.step(close, length);
      const sd = s.sd.step(close, length);
      const upperBB = basis + multKC * sd;
      const lowerBB = basis - multKC * sd;

      // KC: range = useTrueRange ? tr : high - low (tr is na on the first bar)
      const ma = s.ma === s.basis ? basis : s.ma.step(close, lengthKC);
      const range = useTrueRange ? s.tr.step(b.high, b.low, b.close) : b.high - b.low;
      const rangema = s.rangema.step(range, lengthKC);
      const upperKC = ma + rangema * multKC;
      const lowerKC = ma - rangema * multKC;

      // val = linreg(close - avg(avg(highest(high, lengthKC), lowest(low, lengthKC)), sma(close, lengthKC)), lengthKC, 0)
      const hh = s.hh.step(b.high, lengthKC);
      const ll = s.ll.step(b.low, lengthKC);
      const src = close - ((hh + ll) / 2 + ma) / 2;
      const val = s.linreg.step(src);
      const signal = s.signal.step(val, signalPeriod);

      s.plot0[i] = { time: b.time, value: num(val) };
      // scolor = noSqz ? blue : sqzOn ? black : gray
      const sqzOn = gt(lowerBB, lowerKC) && lt(upperBB, upperKC);
      const sqzOff = lt(lowerBB, lowerKC) && gt(upperBB, upperKC);
      const noSqz = !sqzOn && !sqzOff;
      s.plot1[i] = { time: b.time, value: 0, color: noSqz ? BLUE : sqzOn ? BLACK : GRAY };
      s.plot2[i] = { time: b.time, value: num(signal) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SqueezeMomentumIndicatorVersion2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SqueezeMomentumIndicatorVersion2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}
export const SqueezeMomentumIndicatorVersion2 = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
