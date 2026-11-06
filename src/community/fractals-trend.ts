/**
 * Fractals Trend
 *
 * Fractal highs (the high of bar i - length is the highest high of the last 2 * length + 1 bars) and fractal lows
 * (mirror) are pushed into two arrays that start with `storage` zeros; on a bar without a fractal the oldest value
 * of an array longer than `storage` is removed (upper array first, one array per bar). The upper and lower bands are
 * the average, the max / min or the median of the arrays. The trend turns up when close crosses over the upper band
 * and down when close crosses under the lower band. The line is the lower band in an up trend and the upper band in
 * a down trend (broken on the trend change bars), with a gradient shadow to hl2 and fractal labels drawn on the
 * fractal bars.
 * Alerts (alertcondition, `alerts` of the result): 'Trend Up' / 'Trend Down' on the bars where the trend changes.
 *
 * Reference: "Fractals Trend [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type FractalsTrendBandsType = 'avg' | 'min/max' | 'median';

export interface FractalsTrendInputs {
  /** Show the fractal labels */
  showFractals: boolean;
  /** Fractal detection length (bars on each side) */
  fractalLength: number;
  /** Number of fractals kept in each array */
  storage: number;
  /** Band calculation from the stored fractals */
  bandsType: FractalsTrendBandsType;
  /** Up trend colour (and fractal low labels) */
  colorSup: string;
  /** Down trend colour (and fractal high labels) */
  colorRes: string;
  /** Transparency of the shadow fill */
  shadow: number;
}

export const defaultInputs: FractalsTrendInputs = {
  showFractals: true,
  fractalLength: 5,
  storage: 3,
  bandsType: 'avg',
  colorSup: color.aqua,
  colorRes: color.orange,
  shadow: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'showFractals', type: 'bool', title: 'Show Fractals', defval: true },
  { id: 'fractalLength', type: 'int', title: 'Fractals Detection Length', defval: 5 },
  { id: 'storage', type: 'int', title: 'Fractals Storage Qty', defval: 3 },
  { id: 'bandsType', type: 'string', title: 'Bands Type', defval: 'avg', options: ['avg', 'min/max', 'median'] },
  { id: 'colorSup', type: 'color', title: 'Support Color', defval: color.aqua },
  { id: 'colorRes', type: 'color', title: 'Resistance Color', defval: color.orange },
  { id: 'shadow', type: 'int', title: 'Shadow Transparency', defval: 80 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fractal Line', color: color.aqua, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'hl2', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Fractals Trend [BigBeluga]',
  shortTitle: 'Fractals Trend [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons with the 1e-10 tolerance; na operands give false */
const ge = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

/** Pine array.avg / array.max / array.min / array.median of a float array (na when empty) */
function arrAvg(a: number[]): number {
  if (a.length === 0) return NaN;
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}
function arrMedian(a: number[]): number {
  if (a.length === 0) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const arrMax = (a: number[]): number => (a.length === 0 ? NaN : Math.max(...a));
const arrMin = (a: number[]): number => (a.length === 0 ? NaN : Math.min(...a));

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FractalsVars {
  /** var FracrtalsUpper / FracrtalsLower (changed in place: copyVars copies them) */
  upperArr: number[];
  lowerArr: number[];
  /** var trend = bool(na): a Pine v6 bool is never na, bool(na) is false */
  trend: boolean;
}

interface FractalsRun extends BarRunState<FractalsVars> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  lineUpper: number[];
  lineLower: number[];
  trend: boolean[];
  fractalLine: number[];
  hl2: number[];
  topColor: string[];
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number }[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<FractalsTrendInputs>): BarStudy<FractalsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { fractalLength: len, storage, bandsType } = cfg;
  const resLabel = String(color.new(cfg.colorRes, 50));
  const supLabel = String(color.new(cfg.colorSup, 50));
  return {
    init() {
      const highest = new WindowExtreme(false, len * 2 + 1);
      const lowest = new WindowExtreme(true, len * 2 + 1);
      const s: FractalsRun = {
        highest, lowest, lineUpper: [], lineLower: [], trend: [], fractalLine: [], hl2: [], topColor: [], plot0: [],
        plot1: [], flags: [[], []], times: [[], []], markers: [],
        steps: [highest, lowest],
        // var FracrtalsUpper = array.new<float>(fCount, 0); var FracrtalsLower = array.new<float>(fCount, 0)
        vars: { upperArr: new Array(storage).fill(0), lowerArr: new Array(storage).fill(0), trend: false },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.lineUpper, s.lineLower, s.trend, s.fractalLine, s.hl2, s.topColor, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { upperArr, lowerArr } = v;
      const b = bars[i];
      // upperF = high[fractalLen] >= ta.highest(high, fractalLen * 2 + 1); lowerF = low[fractalLen] <= ta.lowest(...)
      const highest = s.highest.step(b.high);
      const lowest = s.lowest.step(b.low);
      const hBack = i >= len ? bars[i - len].high : NaN;
      const lBack = i >= len ? bars[i - len].low : NaN;
      const upperF = ge(hBack, highest);
      const lowerF = ge(lowest, lBack);
      // switch: the first true case only
      if (upperF) upperArr.push(hBack);
      else if (lowerF) lowerArr.push(lBack);
      else if (upperArr.length > storage) upperArr.shift();
      else if (lowerArr.length > storage) lowerArr.shift();

      const lineUpper = bandsType === 'avg' ? arrAvg(upperArr) : bandsType === 'min/max' ? arrMax(upperArr) : arrMedian(upperArr);
      const lineLower = bandsType === 'avg' ? arrAvg(lowerArr) : bandsType === 'min/max' ? arrMin(lowerArr) : arrMedian(lowerArr);
      s.lineUpper[i] = lineUpper;
      s.lineLower[i] = lineLower;

      const close = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      // ta.crossover(close, fractalLineUpper): close > upper and close[1] <= upper[1], exact comparisons (no tolerance)
      if (i > 0 && close > lineUpper && prevClose <= s.lineUpper[i - 1]) v.trend = true;
      // ta.crossunder(close, fractalLineLower): close < lower and close[1] >= lower[1], exact comparisons
      if (i > 0 && close < lineLower && prevClose >= s.lineLower[i - 1]) v.trend = false;
      const trend = v.trend;
      s.trend[i] = trend;

      const t = b.time;
      const hl2 = (b.high + b.low) / 2;
      const fractalLine = trend ? lineLower : lineUpper;
      s.fractalLine[i] = fractalLine;
      s.hl2[i] = hl2;
      const trendColor = trend ? cfg.colorSup : cfg.colorRes;
      // plot(trend != trend[1] ? na : fractalLine, style = plot.style_linebr, color = trendColor); trend[1] of bar 0
      // is false (Pine v6 bool history)
      const prevTrend = i > 0 ? s.trend[i - 1] : false;
      s.plot0[i] = { time: t, value: trend !== prevTrend ? NaN : fractalLine, color: trendColor };
      s.plot1[i] = { time: t, value: hl2 };
      // fill(pt, ph, fractalLine, hl2, color.new(trendColor, shadow), na)
      s.topColor[i] = String(color.new(trendColor, cfg.shadow));
      // plotshape(upperF / lowerF, location.abovebar / belowbar, size.tiny, color.new(colorRes / colorSup, 50),
      //   shape.labeldown / labelup, offset = -5): the shape of bar i is drawn on bar i - 5
      if (cfg.showFractals && i >= 5) {
        const tShift = bars[i - 5].time;
        if (upperF) s.markers.push({ time: tShift, position: 'aboveBar', shape: 'labelDown', color: resLabel, size: 'tiny' });
        if (lowerF) s.markers.push({ time: tShift, position: 'belowBar', shape: 'labelUp', color: supLabel, size: 'tiny' });
      }
      // alertcondition(trend != trend[1] and trend, "Trend Up") / (trend != trend[1] and not trend, "Trend Down")
      const up = trend !== prevTrend && trend;
      const down = trend !== prevTrend && !trend;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(t as number);
      if (down) s.times[1].push(t as number);
    },
    copyVars: (v) => ({ upperArr: v.upperArr.slice(), lowerArr: v.lowerArr.slice(), trend: v.trend }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{
          plot1: 'plot0', plot2: 'plot1',
          gradient: {
            topValue: s.fractalLine.slice(), bottomValue: s.hl2.slice(), topColor: s.topColor.slice(),
            bottomColor: new Array<string | null>(n).fill(null),
          },
        }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FractalsTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FractalsTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (no message: the default one) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Trend Up', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Trend Down', message: 'Alert Fired!' },
];

export const FractalsTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
