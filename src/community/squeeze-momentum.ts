/**
 * Squeeze Momentum Indicator
 *
 * Bollinger Bands inside Keltner Channels = squeeze.
 * Momentum = linreg of (close - avg(Donchian midline, SMA)).
 *
 * Reference: "Squeeze Momentum Indicator" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SqueezeMomentumInputs {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  useTrueRange: boolean;
  src: SourceType;
}

export const defaultInputs: SqueezeMomentumInputs = {
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMult: 1.5,
  useTrueRange: true,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB MultFactor', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'kcLength', type: 'int', title: 'KC Length', defval: 20, min: 1 },
  { id: 'kcMult', type: 'float', title: 'KC MultFactor', defval: 1.5, min: 0.01, step: 0.5 },
  { id: 'useTrueRange', type: 'bool', title: 'Use TrueRange (KC)', defval: true },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Momentum', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze', color: '#787B86', lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Squeeze Momentum',
  shortTitle: 'SQZMOM',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

/** Pine float comparisons (the Series gt / lt): a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

interface SqzRun extends BarRunState<Record<string, never>> {
  bbBasis: WindowSma;
  bbDev: WindowStdev;
  kcMid: ReturnType<typeof taStep.ema>;
  tr: ReturnType<typeof taStep.tr>;
  kcRange: ReturnType<typeof taStep.ema>;
  hh: WindowExtreme;
  ll: WindowExtreme;
  smaClose: WindowSma;
  /** source - midline of each bar (the window of ta.linreg) */
  diff: number[];
  val: number[];
  momData: Point[];
  sqzData: Point[];
}

function study(inputs: Partial<SqueezeMomentumInputs>): BarStudy<SqzRun, IndicatorResult> {
  const { bbLength, bbMult, kcLength, kcMult, useTrueRange, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // Squeeze dots: black = squeeze on, gray = no squeeze, blue = squeeze off
  const sqzWarmup = Math.max(bbLength, kcLength);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // ta.kc(source, kcLength, kcMult, useTrueRange): ema of the source, ema of the true range (or high - low)
      const s: SqzRun = {
        bbBasis: new WindowSma(bbLength), bbDev: new WindowStdev(bbLength), kcMid: taStep.ema(kcLength),
        tr: taStep.tr(false), kcRange: taStep.ema(kcLength), hh: new WindowExtreme(false, kcLength),
        ll: new WindowExtreme(true, kcLength), smaClose: new WindowSma(kcLength), diff: [], val: [], momData: [],
        sqzData: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.bbBasis, s.bbDev, s.kcMid, s.tr, s.kcRange, s.hh, s.ll, s.smaClose];
      s.series = [s.diff, s.val, s.momData, s.sqzData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const source = value(b);

      // Bollinger Bands
      const bbBasis = s.bbBasis.step(source);
      const bbDev = s.bbDev.step(source) * bbMult;
      const upperBB = bbBasis + bbDev;
      const lowerBB = bbBasis - bbDev;

      // Keltner Channels
      const middle = s.kcMid.step(source);
      const range = useTrueRange ? s.tr.step(b.high, b.low, b.close) : b.high - b.low;
      const rangeEma = s.kcRange.step(range);
      // const [kcUpper, , kcLower] = ta.kc(...): ta.kc gives [middle, upper, lower], so kcUpper is the middle band
      const kcUpper = middle;
      const kcLower = middle - rangeEma * kcMult;

      // Squeeze detection: BB inside KC = squeeze on
      const sqzOn = gt(lowerBB, kcLower) && lt(upperBB, kcUpper);
      const sqzOff = lt(lowerBB, kcLower) && gt(upperBB, kcUpper);

      // Momentum: linreg(close - avg(avg(highest, lowest), sma), kcLength, 0)
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const donchianMid = (hh + ll) / 2;
      const smaClose = s.smaClose.step(source);
      const midline = (donchianMid + smaClose) / 2;
      s.diff[i] = source - midline;
      // ta.linreg(x, kcLength, 0) on the window of the last kcLength values (the operations of the library)
      const len = Math.floor(kcLength);
      let v = NaN;
      if (i >= len - 1) {
        let hasNaN = false;
        for (let j = 0; j < len; j++) {
          if (isNaN(s.diff[i - j])) {
            hasNaN = true;
            break;
          }
        }
        if (!hasNaN) {
          let sumX = 0;
          let sumY = 0;
          let sumXY = 0;
          let sumX2 = 0;
          for (let j = 0; j < len; j++) {
            const x = j + 1;
            const y = s.diff[i - (len - 1 - j)];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
          }
          const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
          const intercept = sumY / len - (slope * sumX) / len + slope;
          v = intercept + slope * (len - 1 - 0);
        }
      }
      s.val[i] = v;

      // Momentum histogram: 4-color scheme as in the Pine script
      // Positive & rising = lime (#00E676), positive & falling = dark green (#26A69A)
      // Negative & falling = red (#FF5252), negative & rising = dark red (#EF5350)
      const prev = i > 0 ? s.val[i - 1] : NaN;
      let color: string;
      if (v >= 0) {
        color = v > prev ? '#00E676' : '#26A69A';
      } else {
        color = v < prev ? '#FF5252' : '#EF5350';
      }
      s.momData[i] = { time, value: v, color };

      if (i < sqzWarmup) {
        s.sqzData[i] = { time, value: NaN };
      } else {
        let c: string;
        if (sqzOn) {
          c = '#000000'; // squeeze on
        } else if (sqzOff) {
          c = '#0000FF'; // squeeze off
        } else {
          c = '#787B86'; // no squeeze
        }
        s.sqzData[i] = { time, value: 0, color: c };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.momData.slice(), 'plot1': s.sqzData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SqueezeMomentumInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SqueezeMomentumInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SqueezeMomentum = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
