/**
 * TTM Squeeze Pro
 *
 * John Carter's TTM Squeeze Pro. Squeeze dots at 0 as the original: three Keltner channels around the SMA of the
 * source with the SMA of the true range times 1.0 / 1.5 / 2.0; a squeeze of a channel when the lower Bollinger Band
 * is at or above its lower band or the upper Bollinger Band at or below its upper band: orange (#1), else red (#2),
 * else black (#3), else green (no squeeze, also before the bands exist). Momentum columns as the original: above 0
 * aqua when rising over the bar before (na before = 0), else #2962ff; at or below 0 red when falling, else yellow.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar), as the original computes them: no squeeze = the
 * lower Bollinger Band below the lower widest Keltner Channel or the upper band above the upper one (Keltner basis:
 * SMA of the source, width: SMA of the true range times KC Mult 3); "Squeeze Started" when the bar before had no
 * squeeze and this bar has one ("Alert Price Action Squeeze" on), else "Squeeze Fired" when this bar has no squeeze
 * and the bar before had one ("Alert Squeeze Firing" on).
 *
 * Reference: "TTM Squeeze Pro" by John Carter
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface TTMSqueezeProInputs {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult1: number;
  kcMult2: number;
  kcMult3: number;
  src: SourceType;
  /** alert("Squeeze Started") calls (`alertCalls`); no effect on the other outputs */
  detectSqzStart: boolean;
  /** alert("Squeeze Fired") calls (`alertCalls`); no effect on the other outputs */
  detectSqzFire: boolean;
}

export const defaultInputs: TTMSqueezeProInputs = {
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMult1: 1.0,
  kcMult2: 1.5,
  kcMult3: 2.0,
  src: 'close',
  detectSqzStart: true,
  detectSqzFire: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB MultFactor', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'kcLength', type: 'int', title: 'KC Length', defval: 20, min: 1 },
  { id: 'kcMult1', type: 'float', title: 'KC Mult 1 (Tight)', defval: 1.0, min: 0.01, step: 0.5 },
  { id: 'kcMult2', type: 'float', title: 'KC Mult 2 (Normal)', defval: 1.5, min: 0.01, step: 0.5 },
  { id: 'kcMult3', type: 'float', title: 'KC Mult 3 (Wide)', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'detectSqzStart', type: 'bool', title: 'Alert Price Action Squeeze', defval: true },
  { id: 'detectSqzFire', type: 'bool', title: 'Alert Squeeze Firing', defval: true },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** color.orange / color.red / color.black / color.green / color.aqua / #2962ff / color.yellow */
const ORANGE = '#FF9800';
const RED = '#FF5252';
const BLACK = '#363A45';
const GREEN = '#4CAF50';
const AQUA = '#00BCD4';
const BLUE = '#2962ff';
const YELLOW = '#FFEB3B';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Momentum', color: '#2962ff', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'SQZ', color: '#2962ff', lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'TTM Squeeze Pro',
  shortTitle: 'TTMSqzPro',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alertCalls: AlertCall[] };

interface TtmRun extends BarRunState<Record<string, never>> {
  bbBasis: WindowSma;
  bbDev: WindowStdev;
  hh: WindowExtreme;
  ll: WindowExtreme;
  kcSma: WindowSma;
  trSma: WindowSma;
  linreg: ReturnType<typeof taStep.linreg>;
  val: number[];
  noSqz: boolean[];
  momData: Point[];
  sqzData: Point[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<TTMSqueezeProInputs>): BarStudy<TtmRun, Result> {
  const { bbLength, bbMult, kcLength, kcMult1, kcMult2, kcMult3, src, detectSqzStart, detectSqzFire } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(bbLength, kcLength);
  // a >= b / a <= b with the 1e-10 tolerance (na compares false)
  const ge = (x: number, y: number) => !Number.isNaN(x) && !Number.isNaN(y) && !lt(x, y);
  const le = (x: number, y: number) => !Number.isNaN(x) && !Number.isNaN(y) && !gt(x, y);
  const inside = (lowerBB: number, upperBB: number, kcBasis: number, devKC: number, mult: number) =>
    ge(lowerBB, kcBasis - devKC * mult) || le(upperBB, kcBasis + devKC * mult);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const bbBasis = new WindowSma(bbLength);
      const bbDev = new WindowStdev(bbLength);
      const hh = new WindowExtreme(false, kcLength);
      const ll = new WindowExtreme(true, kcLength);
      const kcSma = new WindowSma(kcLength);
      const trSma = new WindowSma(kcLength);
      const linreg = taStep.linreg(kcLength, 0);
      const s: TtmRun = {
        bbBasis, bbDev, hh, ll, kcSma, trSma, linreg, val: [], noSqz: [], momData: [], sqzData: [], alertCalls: [],
        steps: [bbBasis, bbDev, hh, ll, kcSma, trSma, linreg], vars: {}, lists: [], series: [],
      };
      s.lists = [s.alertCalls];
      s.series = [s.val, s.noSqz, s.momData, s.sqzData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const x = value(b);

      // Bollinger Bands
      const basis = s.bbBasis.step(x);
      const dev = s.bbDev.step(x) * bbMult;
      const upperBB = basis + dev;
      const lowerBB = basis - dev;

      // Momentum: linreg(close - avg((highest+lowest)/2, sma), kcLength, 0)
      const donchianMid = (s.hh.step(b.high) + s.ll.step(b.low)) / 2;
      const smaClose = s.kcSma.step(x);
      const midline = (donchianMid + smaClose) / 2;
      const v = s.linreg.step(x - midline);
      s.val[i] = v;

      // Momentum histogram colour: mom > 0 ? (mom > nz(mom[1]) ? aqua : #2962ff) : (mom < nz(mom[1]) ? red : yellow)
      if (i < warmup || isNaN(v)) s.momData[i] = { time, value: NaN };
      else {
        const p = i > 0 ? s.val[i - 1] : NaN;
        const prev = Number.isNaN(p) ? 0 : p;
        s.momData[i] = { time, value: v, color: gt(v, 0) ? (gt(v, prev) ? AQUA : BLUE) : (lt(v, prev) ? RED : YELLOW) };
      }

      // Keltner channels of the original: KC_basis = ta.sma(close, length), devKC = ta.sma(ta.tr, length) (ta.tr is na on
      // the first bar), bands at basis +/- devKC * 1.0 / 1.5 / 2.0
      const kcBasis = smaClose;
      const tr = i > 0
        ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))
        : NaN;
      const devKC = s.trSma.step(tr);
      // NoSqz = BB_lower < KC_lower_low or BB_upper > KC_upper_low
      const noSqz = lt(lowerBB, kcBasis - devKC * kcMult3) || gt(upperBB, kcBasis + devKC * kcMult3);
      s.noSqz[i] = noSqz;

      // plot(0, 'SQZ', style circles): HighSqz (KC #1) orange, else MidSqz (KC #2) red, else LowSqz (KC #3) black, else
      // green; each squeeze = the lower band at or above the lower Keltner band OR the upper band at or below the upper one
      const color = inside(lowerBB, upperBB, kcBasis, devKC, kcMult1) ? ORANGE
        : inside(lowerBB, upperBB, kcBasis, devKC, kcMult2) ? RED
        : inside(lowerBB, upperBB, kcBasis, devKC, kcMult3) ? BLACK : GREEN;
      s.sqzData[i] = { time, value: 0, color };

      // NoSqz[1] is na (false) on the first bar
      const prevNoSqz = i > 0 && s.noSqz[i - 1];
      // if Detect_Sqz_Start and NoSqz[1] and not NoSqz: alert("Squeeze Started")
      // else if Detect_Sqz_Fire and NoSqz and not NoSqz[1]: alert("Squeeze Fired")
      if (detectSqzStart && prevNoSqz && !noSqz) {
        s.alertCalls.push({ time: time as number, message: 'Squeeze Started', freq: 'once_per_bar' });
      } else if (detectSqzFire && noSqz && !prevNoSqz) {
        s.alertCalls.push({ time: time as number, message: 'Squeeze Fired', freq: 'once_per_bar' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.momData.slice(), 'plot1': s.sqzData.slice() },
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TTMSqueezeProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TTMSqueezeProInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TTMSqueezePro = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
