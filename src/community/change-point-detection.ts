/**
 * Change-Point Detection (CUSUM)
 *
 * CUSUM on the z-score of the log returns of the close (sma / stdev over `length` bars): sPos = max(0, sPos + z - k),
 * sNeg = min(0, sNeg + z + k). A change up is sPos > h, a change down sNeg < -h; on a change (and on bar `length`)
 * the regime price is set to the close, the trend to the change direction and both sums to 0. Plots: the regime
 * price coloured by the trend, and the regime price + sPos / sNeg times the stdev of the close, with fills to the
 * regime price; the lines break on a level change. Triangles mark the changes.
 *
 * Reference: "Change-Point Detection (CUSUM) [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChangePointDetectionInputs {
  /** Period of the rolling statistics of the log returns */
  length: number;
  /** Threshold (h) */
  threshold: number;
  /** Slack (k) */
  slack: number;
}

export const defaultInputs: ChangePointDetectionInputs = {
  length: 50,
  threshold: 4.0,
  slack: 0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 50, min: 10, group: 'Algorithm Settings',
    tooltip: 'Period used to calculate the rolling statistics of log-returns.' },
  { id: 'threshold', type: 'float', title: 'Threshold (h)', defval: 4.0, min: 0.1, step: 0.1, group: 'Algorithm Settings',
    tooltip: 'Sensitivity of the detection. Higher values require more accumulation to trigger a change.' },
  { id: 'slack', type: 'float', title: 'Slack (k)', defval: 0.5, min: 0.0, step: 0.1, group: 'Algorithm Settings',
    tooltip: "The 'allowable' deviation. Smaller values make the algorithm more sensitive." },
];

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const BULL_PRESSURE = String(color.new(BULL_COLOR, 80));
const BEAR_PRESSURE = String(color.new(BEAR_COLOR, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Regime Price', color: BULL_COLOR, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Bullish Pressure', color: BULL_PRESSURE, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Bearish Pressure', color: BEAR_PRESSURE, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Change-Point Detection (CUSUM) [LuxAlgo]',
  shortTitle: 'LuxAlgo - Change-Point Detection',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine a != b: false with na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CpdVars {
  /** var float sPos = 0.0, var float sNeg = 0.0 */
  sPos: number;
  sNeg: number;
  /** var int trend = 0 */
  trend: number;
  /** var float regimePrice = na (and its value on the bar before) */
  regimePrice: number;
  prevRegimePrice: number;
}

interface CpdRun extends BarRunState<CpdVars> {
  mean: WindowSma;
  std: WindowStdev;
  vol: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<ChangePointDetectionInputs>): BarStudy<CpdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  const bullFill = String(color.new(BULL_COLOR, 90));
  const bearFill = String(color.new(BEAR_COLOR, 90));
  return {
    init() {
      const mean = new WindowSma(len);
      const std = new WindowStdev(len);
      const vol = new WindowStdev(len);
      const s: CpdRun = {
        mean, std, vol, plot0: [], plot1: [], plot2: [], markers: [], steps: [mean, std, vol],
        vars: { sPos: 0, sNeg: 0, trend: 0, regimePrice: NaN, prevRegimePrice: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const t = bars[i].time;
      const close = bars[i].close;
      // logReturns = math.log(src / nz(src[1], src))
      const prev = i > 0 ? bars[i - 1].close : NaN;
      const logReturns = Math.log(close / (i > 0 && !isNaN(prev) ? prev : close));
      const rollingMean = s.mean.step(logReturns);
      const rollingStd = s.std.step(logReturns);
      const priceVol = s.vol.step(close);

      // zScore = (logReturns - rollingMean) / (rollingStd == 0 ? 1.0 : rollingStd)
      const sd = rollingStd;
      const div = !isNaN(sd) && Math.abs(sd) <= EPS ? 1.0 : sd;
      const z = (logReturns - rollingMean) / div;
      if (!isNaN(z)) {
        v.sPos = Math.max(0, v.sPos + z - cfg.slack);
        v.sNeg = Math.min(0, v.sNeg + z + cfg.slack);
      }
      const changeUp = gt(v.sPos, cfg.threshold);
      const changeDn = lt(v.sNeg, -cfg.threshold);
      // bar_index == lengthInput: bar_index counts from the first bar of the data
      if (changeUp || changeDn || i === len) {
        v.trend = changeUp ? 1 : changeDn ? -1 : v.trend;
        v.regimePrice = close;
        v.sPos = 0;
        v.sNeg = 0;
      }

      const trendColor = v.trend === 1 ? BULL_COLOR : v.trend === -1 ? BEAR_COLOR : color.gray;
      const isLevelChange = ne(v.regimePrice, v.prevRegimePrice);
      v.prevRegimePrice = v.regimePrice;
      const regimePrice = v.regimePrice;
      s.plot0[i] = { time: t, value: regimePrice, color: isLevelChange ? 'transparent' : trendColor };
      s.plot1[i] = { time: t, value: regimePrice + v.sPos * priceVol, color: isLevelChange ? 'transparent' : BULL_PRESSURE };
      s.plot2[i] = { time: t, value: regimePrice + v.sNeg * priceVol, color: isLevelChange ? 'transparent' : BEAR_PRESSURE };

      // plotshape(changeUp, 'Change Up', shape.triangleup, location.belowbar, BULL_COLOR, size = size.tiny)
      if (changeUp) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: BULL_COLOR, size: 'tiny' });
      // plotshape(changeDn, 'Change Down', shape.triangledown, location.abovebar, BEAR_COLOR, size = size.tiny)
      if (changeDn) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: BEAR_COLOR, size: 'tiny' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          // fill(pRegime, pCusumPos, color.new(BULL_COLOR, 90), 'Bullish CUSUM Fill')
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Bullish CUSUM Fill' },
            colors: new Array<string>(n).fill(bullFill) },
          // fill(pRegime, pCusumNeg, color.new(BEAR_COLOR, 90), 'Bearish CUSUM Fill')
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Bearish CUSUM Fill' },
            colors: new Array<string>(n).fill(bearFill) },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChangePointDetectionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ChangePointDetectionInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ChangePointDetection = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
