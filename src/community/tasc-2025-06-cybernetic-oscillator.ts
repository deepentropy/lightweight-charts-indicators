/**
 * TASC 2025.06 Cybernetic Oscillator
 *
 * John F. Ehlers' Cybernetic Oscillator: a second-order highpass filter of the source (critical period hpPeriod),
 * then a Super Smoother lowpass filter (lpPeriod), divided by its root mean square over rmsLength bars. Both filters
 * start on bar_index 4 (0 before). The 'Trend' style colours the line green above 0 and red below; the 'Threshold'
 * style draws +/- threshold lines and fills the oscillator beyond them.
 *
 * Reference: "TASC 2025.06 Cybernetic Oscillator" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TascCyberneticOscillatorInputs {
  /** Source series */
  src: SourceType;
  /** Highpass filter critical period (not less than the lowpass period) */
  hpPeriod: number;
  /** Lowpass filter critical period */
  lpPeriod: number;
  /** Number of bars of the RMS */
  rmsLength: number;
  /** Display style */
  style: 'Trend' | 'Threshold';
  /** Absolute threshold of the 'Threshold' style */
  threshold: number;
}

export const defaultInputs: TascCyberneticOscillatorInputs = {
  src: 'close',
  hpPeriod: 30,
  lpPeriod: 20,
  rmsLength: 100,
  style: 'Trend',
  threshold: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source series:', defval: 'close' },
  { id: 'hpPeriod', type: 'int', title: 'Highpass period:', defval: 30, min: 3 },
  { id: 'lpPeriod', type: 'int', title: 'Lowpass period:', defval: 20, min: 3 },
  { id: 'rmsLength', type: 'int', title: 'RMS length:', defval: 100, min: 1 },
  { id: 'style', type: 'string', title: 'Display style:', defval: 'Trend', options: ['Trend', 'Threshold'] },
  { id: 'threshold', type: 'float', title: 'Threshold:', defval: 1, min: 0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Cybernetic Oscillator', color: '#4caf4f', lineWidth: 2 },
  { id: 'plot1', title: 'Upper threshold', color: '#b2b5be80', lineWidth: 1 },
  { id: 'plot2', title: 'Lower threshold', color: '#b2b5be80', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2025.06 Cybernetic Oscillator',
  shortTitle: 'CO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a != b when |a - b| > 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

/** Filter coefficients [c1, c2, c3] of the highpass (isHp) or Super Smoother filter */
function coefs(period: number, isHp: boolean): [number, number, number] {
  const a0 = (1.414 * Math.PI) / period;
  const a1 = Math.exp(-a0);
  const c2 = 2.0 * a1 * Math.cos(a0);
  const c3 = -a1 * a1;
  const c1 = isHp ? (1.0 + c2 - c3) * 0.25 : 1.0 - c2 - c3;
  return [c1, c2, c3];
}

type Point = { time: number; value: number; color?: string };

interface CoVars {
  /** co(): var result = 0.0 */
  res: number;
}

interface CoRun extends BarRunState<CoVars> {
  ms: WindowSma;
  src: number[];
  hp: number[];
  lp: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  upperFill: string[];
  lowerFill: string[];
}

function study(inputs: Partial<TascCyberneticOscillatorInputs>): BarStudy<CoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const isThresh = cfg.style === 'Threshold';
  const [h1, h2, h3] = coefs(cfg.hpPeriod, true);
  const [s1, s2, s3] = coefs(cfg.lpPeriod, false);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      if (cfg.hpPeriod < cfg.lpPeriod) {
        // runtime.error in Pine
        throw new Error('The highpass period cannot be less than the lowpass period.');
      }
      // rms = math.sqrt(ta.sma(lp * lp, rmsLength))
      const ms = new WindowSma(cfg.rmsLength);
      const s: CoRun = {
        ms, src: [], hp: [], lp: [], plot0: [], plot1: [], plot2: [], upperFill: [], lowerFill: [],
        steps: [ms], vars: { res: 0.0 }, lists: [], series: [],
      };
      s.series = [s.src, s.hp, s.lp, s.plot0, s.plot1, s.plot2, s.upperFill, s.lowerFill];
      return s;
    },
    bar(s, i, bars) {
      const { src, hp, lp } = s;
      src[i] = value(bars[i]);
      // hp(): var result = 0.0; from bar_index 4: c1 * (src - 2 * src[1] + src[2]) + c2 * nz(result[1]) + c3 * nz(result[2])
      hp[i] = i >= 4 ? h1 * (src[i] - 2.0 * src[i - 1] + src[i - 2]) + h2 * nz(hp[i - 1]) + h3 * nz(hp[i - 2]) : 0;
      // ss(): var result = source (hp of the first bar); from bar_index 4:
      // c1 * 0.5 * (src + src[1]) + c2 * nz(result[1]) + c3 * nz(result[2])
      lp[i] = i >= 4 ? s1 * 0.5 * (hp[i] + hp[i - 1]) + s2 * nz(lp[i - 1]) + s3 * nz(lp[i - 2]) : hp[0];
      const ms = s.ms.step(lp[i] * lp[i]);
      // co(): var result = 0.0; if rms != 0.0: result := lp / rms
      const rms = Math.sqrt(ms);
      if (ne(rms, 0.0)) s.vars.res = lp[i] / rms;
      const osc = s.vars.res;
      const time = bars[i].time;
      s.plot0[i] = { time, value: osc, color: isThresh ? '#aa9b9b' : gt(osc, 0.0) ? '#4caf4f' : '#af4e4c' };
      s.plot1[i] = { time, value: isThresh ? cfg.threshold : NaN, color: '#b2b5be80' };
      s.plot2[i] = { time, value: isThresh ? -cfg.threshold : NaN, color: '#b2b5be80' };
      s.upperFill[i] = isThresh && gt(osc, cfg.threshold) ? '#af4e4c93' : 'transparent';
      s.lowerFill[i] = isThresh && lt(osc, -cfg.threshold) ? '#4caf4f93' : 'transparent';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed' } }],
        fills: [
          // fill(p0, pu, isThresh and osc > thInput ? #af4e4c93 : na, title = "Upper fill")
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Upper fill' }, colors: s.upperFill.slice() },
          // fill(p0, pl, isThresh and osc < -thInput ? #4caf4f93 : na, title = "Lower fill")
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Lower fill' }, colors: s.lowerFill.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TascCyberneticOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TascCyberneticOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TascCyberneticOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
