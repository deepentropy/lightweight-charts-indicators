/**
 * Dynamic VWAP: Fair Value & Divergence Suite
 *
 * A VWAP anchored at the last swing low: the anchor is the time of the last bar whose low equals the lowest low of
 * the last `swingLength` bars, and the sums restart when the anchor changes (the volume is replaced by the bar range
 * when it is na). Bands at +-1 and +-2 standard deviations of the close (over `stdevLength` bars) around the VWAP, and
 * +3 to +5 standard deviations above it, with fills that show in which zone the open or the close is. Signals: a
 * higher high with a falling VWAP slope (linear regression of the VWAP now and `slopeLength` bars ago), a close
 * crossing over the VWAP on a volume below its 20-bar average, and a close back below +1 sigma after a close above
 * +3 sigma.
 * Alerts (alertcondition, `alerts` of the result): 'VWAP Slope Divergence', 'Low Volume Retest' and 'Deviation
 * Failure', true on the bars of each signal (also with the signals hidden).
 *
 * Reference: "Dynamic VWAP: Fair Value & Divergence Suite" by RWCS_LTD
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RWCS_LTD
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicVwapFairValueDivergenceSuiteInputs {
  /** Show the divergence signals */
  detect: boolean;
  /** Length of the standard deviation of the close */
  stdevLength: number;
  /** Show the +3 to +5 sigma bands */
  showExtendedBands: boolean;
  /** Show the zone fills */
  showFills: boolean;
  /** Lookback of the swing low that anchors the VWAP */
  swingLength: number;
  /** Length of the linear regression of the VWAP slope */
  slopeLength: number;
}

export const defaultInputs: DynamicVwapFairValueDivergenceSuiteInputs = {
  detect: true,
  stdevLength: 20,
  showExtendedBands: true,
  showFills: true,
  swingLength: 50,
  slopeLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'detect', type: 'bool', title: 'Detect Divergence', defval: true, group: 'Divergence Detection' },
  { id: 'stdevLength', type: 'int', title: 'Standard Deviation Length', defval: 20, min: 1, group: 'Standard Deviation' },
  { id: 'showExtendedBands', type: 'bool', title: 'Show ±3σ to ±5σ Bands', defval: true, group: 'Standard Deviation' },
  { id: 'showFills', type: 'bool', title: 'Show Zone Fills', defval: true, group: 'Standard Deviation' },
  { id: 'swingLength', type: 'int', title: 'Swing Low Lookback Bars', defval: 50, min: 1, group: 'Volume Weighted Moving Average (VWAP)' },
  { id: 'slopeLength', type: 'int', title: 'VWAP Slope Length', defval: 20, min: 1, group: 'Volume Weighted Moving Average (VWAP)' },
];

const hidden = (id: string, title: string): PlotConfig => ({ id, title, color: 'transparent', lineWidth: 1, display: 'none' });

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchored VWAP', color: String(color.new(color.white, 0)), lineWidth: 1 },
  { id: 'plot1', title: '+1σ', color: String(color.new(color.lime, 30)), lineWidth: 1 },
  { id: 'plot2', title: '-1σ', color: String(color.new(color.lime, 30)), lineWidth: 1 },
  { id: 'plot3', title: '+2σ', color: String(color.new(color.yellow, 40)), lineWidth: 1 },
  { id: 'plot4', title: '+3σ', color: String(color.new(color.orange, 50)), lineWidth: 1 },
  { id: 'plot5', title: '+4σ', color: String(color.new(color.red, 60)), lineWidth: 1 },
  { id: 'plot6', title: '+5σ', color: String(color.new(color.fuchsia, 70)), lineWidth: 1 },
  // Hidden plots of the fills (display = display.none), two per fill in the Pine order
  hidden('plot7', 'Fair Value Fill +1σ'),
  hidden('plot8', 'Fair Value Fill -1σ'),
  hidden('plot9', '+1σ to +2σ Fill +2σ'),
  hidden('plot10', '+1σ to +2σ Fill +1σ'),
  hidden('plot11', '-1σ to -2σ Fill -1σ'),
  hidden('plot12', '-1σ to -2σ Fill -2σ'),
  hidden('plot13', '+2σ to +3σ Fill +3σ'),
  hidden('plot14', '+2σ to +3σ Fill +2σ'),
  hidden('plot15', '+3σ to +4σ Fill +4σ'),
  hidden('plot16', '+3σ to +4σ Fill +3σ'),
  hidden('plot17', '+4σ to +5σ Fill +5σ'),
  hidden('plot18', '+4σ to +5σ Fill +4σ'),
];

export const metadata = {
  title: 'Dynamic VWAP: Fair Value & Divergence Suite',
  shortTitle: 'Dynamic VWAP: Fair Value & Divergence Suite',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface VwapVars {
  anchorTime: number;
  prevAnchorTime: number;
  /** var float cumPV = na / var float cumVolume = na */
  cumPV: number;
  cumVolume: number;
}

interface VwapRun extends BarRunState<VwapVars> {
  lowest: ReturnType<typeof taStep.lowest>;
  dev: ReturnType<typeof taStep.stdev>;
  hh: ReturnType<typeof taStep.highest>;
  volMa: ReturnType<typeof taStep.sma>;
  cross: ReturnType<typeof taStep.crossover>;
  vwap: number[];
  /** +1 to +5 sigma, then -1 and -2 sigma */
  up: number[][];
  slope: number[];
  highestHigh: number[];
  plots: Point[][];
  fills: string[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/**
 * ta.linreg(source[shift], length, 0) on bar i from the values of the earlier bars (the operations of the oakscriptjs
 * function: na when a value of the window is na, sums from the oldest value)
 */
function linregAt(source: number[], i: number, shift: number, length: number): number {
  const len = Math.floor(length);
  // a value before the first bar is na
  if (i < len - 1 || i - shift - (len - 1) < 0) return NaN;
  const end = i - shift;
  for (let j = 0; j < len; j++) if (isNaN(source[end - j])) return NaN;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let j = 0; j < len; j++) {
    const x = j + 1;
    const y = source[end - (len - 1 - j)];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
  const intercept = sumY / len - (slope * sumX) / len + slope;
  return intercept + slope * (len - 1 - 0);
}

function study(inputs: Partial<DynamicVwapFairValueDivergenceSuiteInputs>): BarStudy<VwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.slopeLength;
  const fillColor = (on: boolean, c: string) => (cfg.showFills && on ? c : 'transparent');
  const green85 = String(color.new(color.green, 85));
  const yellow80 = String(color.new(color.yellow, 80));
  const orange70 = String(color.new(color.orange, 70));
  const red70 = String(color.new(color.red, 70));
  const fuchsia70 = String(color.new(color.fuchsia, 70));
  const slopeColor = String(color.new(color.fuchsia, 40));
  const retestColor = String(color.new(color.aqua, 40));
  const failColor = String(color.new(color.red, 40));
  const lineColors = [
    String(color.new(color.white, 0)), String(color.new(color.lime, 30)), String(color.new(color.lime, 30)),
    String(color.new(color.yellow, 40)), String(color.new(color.orange, 50)), String(color.new(color.red, 60)),
    String(color.new(color.fuchsia, 70)),
  ];
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const ext = (x: number) => (cfg.showExtendedBands ? x : NaN);
  const fillTitles = [
    'Fair Value Zone Fill', '+1σ to +2σ Fill', '-1σ to -2σ Fill', '+2σ to +3σ Fill', '+3σ to +4σ Fill', '+4σ to +5σ Fill',
  ];
  return {
    init() {
      const lowest = taStep.lowest();
      const dev = taStep.stdev();
      // ta.linreg checks the length (read below from the VWAP of the earlier bars)
      taStep.linreg(L, 0);
      const hh = taStep.highest();
      const volMa = taStep.sma();
      const cross = taStep.crossover();
      const s: VwapRun = {
        lowest, dev, hh, volMa, cross,
        vwap: [], up: [[], [], [], [], [], [], []], slope: [], highestHigh: [],
        plots: Array.from({ length: 19 }, () => []), fills: Array.from({ length: 6 }, () => []),
        markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [lowest, dev, hh, volMa, cross],
        vars: { anchorTime: NaN, prevAnchorTime: NaN, cumPV: NaN, cumVolume: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.vwap, ...s.up, s.slope, s.highestHigh, ...s.plots, ...s.fills, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const t = b.time as number;
      const close = b.close;
      const high = b.high;
      const low = b.low;
      const volume = b.volume ?? NaN;
      // anchorTime = ta.valuewhen(low == ta.lowest(low, swingLength), time, 0)
      const lowestLow = s.lowest.step(low, cfg.swingLength);
      const stdDev = s.dev.step(close, cfg.stdevLength);
      if (eq(low, lowestLow)) v.anchorTime = t;
      // newAnchor = ta.change(anchorTime) != 0 (na on the first bar with an anchor: false)
      const newAnchor = !isNaN(v.anchorTime) && !isNaN(v.prevAnchorTime) && v.anchorTime - v.prevAnchorTime !== 0;
      v.prevAnchorTime = v.anchorTime;
      const afterAnchor = !isNaN(v.anchorTime) && t >= v.anchorTime;
      let vwapValue = NaN;
      let stdevValue = NaN;
      if (afterAnchor) {
        if (newAnchor) {
          v.cumPV = 0;
          v.cumVolume = 0;
        }
        const barVolume = isNaN(volume) ? high - low : volume;
        // na + x stays na: the sums are na until the first anchor change
        v.cumPV += close * barVolume;
        v.cumVolume += barVolume;
        vwapValue = v.cumPV / v.cumVolume;
        stdevValue = stdDev;
      }
      s.vwap[i] = vwapValue;
      const bands = afterAnchor && !isNaN(stdevValue);
      for (let k = 0; k < 5; k++) s.up[k][i] = bands ? vwapValue + (k + 1) * stdevValue : NaN;
      s.up[5][i] = bands ? vwapValue - 1 * stdevValue : NaN;
      s.up[6][i] = bands ? vwapValue - 2 * stdevValue : NaN;
      const u1 = s.up[0][i], u2 = s.up[1][i], u3 = s.up[2][i], u4 = s.up[3][i], u5 = s.up[4][i];
      const l1 = s.up[5][i], l2 = s.up[6][i];

      // VWAP slope: (ta.linreg(vwapValue, slopeLength, 0) - ta.linreg(vwapValue[slopeLength], slopeLength, 0)) / slopeLength
      const linregNow = linregAt(s.vwap, i, 0, L);
      const linregPrev = linregAt(s.vwap, i, L, L);
      const vwapSlope = (linregNow - linregPrev) / L;
      s.slope[i] = vwapSlope;
      s.highestHigh[i] = s.hh.step(high, L);
      const volMA = s.volMa.step(volume, 20);
      const crossAboveVWAP = s.cross.step(close, vwapValue);

      // priceHigherHigh = high > ta.highest(high, slopeLength)[1]; slopeDivergence = ... and vwapSlope < vwapSlope[1]
      const priceHigherHigh = i > 0 && gt(high, s.highestHigh[i - 1]);
      const slopeDivergence = priceHigherHigh && i > 0 && lt(vwapSlope, s.slope[i - 1]);
      // lowVolumeRetest = ta.crossover(close, vwapValue) and volume < volMA
      const lowVolumeRetest = crossAboveVWAP && lt(volume, volMA);
      // sigmaFail = close[1] > upper3[1] and close < upper1
      const sigmaFail = i > 0 && gt(bars[i - 1].close, s.up[2][i - 1]) && lt(close, u1);
      s.flags[0][i] = slopeDivergence;
      s.flags[1][i] = lowVolumeRetest;
      s.flags[2][i] = sigmaFail;
      if (slopeDivergence) s.times[0].push(t);
      if (lowVolumeRetest) s.times[1].push(t);
      if (sigmaFail) s.times[2].push(t);
      if (cfg.detect && slopeDivergence) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: slopeColor, size: 'tiny' });
      }
      if (cfg.detect && lowVolumeRetest) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: retestColor, size: 'tiny' });
      }
      if (cfg.detect && sigmaFail) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'cross', color: failColor, size: 'tiny' });
      }

      const c = close;
      const o = b.open;
      const inside1sigma = (le(c, u1) && ge(c, l1)) || (le(o, u1) && ge(o, l1));
      const insidePlus2sigma = (le(c, u2) && gt(c, u1)) || (le(o, u2) && gt(o, u1));
      const insideMinus2sigma = (ge(c, l2) && lt(c, l1)) || (ge(o, l2) && lt(o, l1));
      const insidePlus3sigma = (le(c, u3) && gt(c, u2)) || (le(o, u3) && gt(o, u2));
      const insidePlus4sigma = (le(c, u4) && gt(c, u3)) || (le(o, u4) && gt(o, u3));
      const insidePlus5sigma = (le(c, u5) && gt(c, u4)) || (le(o, u5) && gt(o, u4));
      s.fills[0][i] = fillColor(inside1sigma, green85);
      s.fills[1][i] = fillColor(insidePlus2sigma, yellow80);
      s.fills[2][i] = fillColor(insideMinus2sigma, yellow80);
      s.fills[3][i] = fillColor(insidePlus3sigma, orange70);
      s.fills[4][i] = fillColor(insidePlus4sigma, red70);
      s.fills[5][i] = fillColor(insidePlus5sigma, fuchsia70);

      const p = s.plots;
      p[0][i] = { time: t, value: fin(vwapValue), color: lineColors[0] };
      p[1][i] = { time: t, value: fin(u1), color: lineColors[1] };
      p[2][i] = { time: t, value: fin(l1), color: lineColors[2] };
      p[3][i] = { time: t, value: fin(u2), color: lineColors[3] };
      p[4][i] = { time: t, value: fin(ext(u3)), color: lineColors[4] };
      p[5][i] = { time: t, value: fin(ext(u4)), color: lineColors[5] };
      p[6][i] = { time: t, value: fin(ext(u5)), color: lineColors[6] };
      // the hidden plots of the fills, two per fill in the Pine order
      p[7][i] = { time: t, value: fin(u1) };
      p[8][i] = { time: t, value: fin(l1) };
      p[9][i] = { time: t, value: fin(u2) };
      p[10][i] = { time: t, value: fin(u1) };
      p[11][i] = { time: t, value: fin(l1) };
      p[12][i] = { time: t, value: fin(l2) };
      p[13][i] = { time: t, value: fin(u3) };
      p[14][i] = { time: t, value: fin(u2) };
      p[15][i] = { time: t, value: fin(u4) };
      p[16][i] = { time: t, value: fin(u3) };
      p[17][i] = { time: t, value: fin(u5) };
      p[18][i] = { time: t, value: fin(u4) };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, k) => { plots[`plot${k}`] = pl.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: fillTitles.map((title, k) => ({ plot1: `plot${7 + 2 * k}`, plot2: `plot${8 + 2 * k}`, options: { title }, colors: s.fills[k].slice() })),
        markers: s.markers.slice(),
        // alertcondition(slopeDivergence) / alertcondition(lowVolumeRetest) / alertcondition(sigmaFail)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicVwapFairValueDivergenceSuiteInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicVwapFairValueDivergenceSuiteInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'VWAP Slope Divergence', message: 'VWAP slope divergence detected.' },
  { id: 'alert1', title: 'Low Volume Retest', message: 'Price crossed VWAP on low volume.' },
  { id: 'alert2', title: 'Deviation Failure', message: 'Deviation failure detected (mean reversion signal).' },
];

export const DynamicVwapFairValueDivergenceSuite = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  createRun,
};
