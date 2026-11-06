/**
 * Echo Forecast [LuxAlgo]
 *
 * A forecast drawn after the last bar from the past window that looks the most like (or the least like) the recent
 * prices. The reference window is the latest "Forecast Window" values of the source. It is compared, by correlation,
 * with every window of the same size that starts 0 .. "Evaluation Window" - 1 bars before it; the window with the
 * highest correlation ("Similarity") or the lowest one ("Dissimilarity") is kept. The bar-to-bar changes that
 * came with that window are then replayed after the last bar: added one after the other to the last value
 * ("Cumulative"), added to the mean of the reference window ("Mean") or added to a linear regression of the
 * reference window ("Linreg"). The forecast is a chain of line segments, one per future bar.
 *
 * "Show Area" draws three boxes over the highest / lowest source of the whole span: the evaluation span, the
 * reference window and the window that was kept.
 *
 * The drawings are those of the last bar (the script redraws them on every new bar).
 *
 * Reference: "Echo Forecast [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BoxData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TheEchoForecastInputs {
  /** Evaluation Window: number of past windows compared */
  length: number;
  /** Forecast Window: size of a window and number of forecast bars */
  fcast: number;
  fmode: 'Similarity' | 'Dissimilarity';
  cmode: 'Cumulative' | 'Mean' | 'Linreg';
  src: SourceType;
  fcastCss: string;
  fcastStyle: '──' | '- - -' | '· · ·';
  showArea: boolean;
  refArea: string;
  corrArea: string;
  evalArea: string;
}

export const defaultInputs: TheEchoForecastInputs = {
  length: 50,
  fcast: 50,
  fmode: 'Similarity',
  cmode: 'Cumulative',
  src: 'close',
  fcastCss: '#2157F3',
  fcastStyle: '· · ·',
  showArea: true,
  refArea: 'rgba(255, 93, 0, 0.2)',
  corrArea: 'rgba(8, 153, 129, 0.2)',
  evalArea: 'rgba(120, 123, 134, 0.2)',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Evaluation Window', defval: 50, min: 0, max: 200 },
  { id: 'fcast', type: 'int', title: 'Forecast Window', defval: 50, min: 1, max: 200 },
  { id: 'fmode', type: 'string', title: 'Forecast Mode', defval: 'Similarity', options: ['Similarity', 'Dissimilarity'] },
  { id: 'cmode', type: 'string', title: 'Forecast Construction', defval: 'Cumulative', options: ['Cumulative', 'Mean', 'Linreg'] },
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'fcastCss', type: 'color', title: 'Forecast Style', defval: '#2157F3', inline: 'fcast_style', group: 'Style' },
  { id: 'fcastStyle', type: 'string', title: '', defval: '· · ·', options: ['──', '- - -', '· · ·'], inline: 'fcast_style', group: 'Style' },
  { id: 'showArea', type: 'bool', title: 'Show Area', defval: true, inline: 'areas', group: 'Style' },
  { id: 'refArea', type: 'color', title: '', defval: 'rgba(255, 93, 0, 0.2)', inline: 'areas', group: 'Style' },
  { id: 'corrArea', type: 'color', title: '', defval: 'rgba(8, 153, 129, 0.2)', inline: 'areas', group: 'Style' },
  { id: 'evalArea', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.2)', inline: 'areas', group: 'Style' },
];

// No plot(): the outputs are lines and boxes
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Echo Forecast [LuxAlgo]',
  shortTitle: 'LuxAlgo - ECHO',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;

/** Pine `for i = from to to`: counts down when from > to */
function* range(from: number, to: number): Generator<number> {
  if (from <= to) for (let i = from; i <= to; i++) yield i;
  else for (let i = from; i >= to; i--) yield i;
}

type Result = Omit<IndicatorResult, 'boxes' | 'lines'> & { boxes: BoxData[]; lines: LineDrawingData[] };

interface EchoRun extends BarRunState<{ top: number; btm: number }> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  src: number[];
}

function study(inputs: Partial<TheEchoForecastInputs>): BarStudy<EchoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = Math.trunc(cfg.length);
  const fcast = Math.trunc(cfg.fcast);
  const { fmode, cmode } = cfg;
  const value = barSource(cfg.src);
  const result = (lines: LineDrawingData[], boxes: BoxData[]) => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    boxes,
  });
  // Range maximum / minimum
  const span = length + fcast * 2;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const hi = new WindowExtreme(false, span);
      const lo = new WindowExtreme(true, span);
      const s: EchoRun = { hi, lo, src: [], steps: [hi, lo], vars: { top: NaN, btm: NaN }, lists: [], series: [] };
      s.series = [s.src];
      return s;
    },
    bar(s, i, bars) {
      const v = value(bars[i]) ?? NaN;
      s.src[i] = v;
      s.vars.top = s.hi.step(v) ?? NaN;
      s.vars.btm = s.lo.step(v) ?? NaN;
    },
    result(s, bars) {
      const count = bars.length;
      if (count === 0) return result([], []);
      const src = s.src;
      const { top, btm } = s.vars;
      // src[k] on the last bar; na before the first bar
      const n = count - 1;
      const srcBack = (k: number) => (k >= 0 && k <= n ? src[n - k] : NaN);
      // d = src - src[1], read k bars back
      const dBack = (k: number) => srcBack(k) - srcBack(k + 1);

      // barstate.islast: calculation window (newest first) and linreg independent variable
      const A: number[] = [];
      const X: number[] = [];
      for (const i of range(0, fcast * 2 + length)) {
        A.push(srcBack(i));
        if (cmode === 'Linreg') X.push(i <= n ? n - i : NaN);
      }
      // Reference window (array.slice: the end index is not included)
      const a = array.slice(A, 0, fcast - 1);

      // Find the window that produces the forecast
      let k = 0;
      let val = NaN;
      for (const i of range(0, length - 1)) {
        const b = array.slice(A, fcast + i, fcast * 2 + i - 1); // Evaluation window
        const r = array.covariance(a, b) / (array.stdev(a) * array.stdev(b)); // Correlation
        // nz(val, r): an infinite value is na for nz()
        const ref = Number.isFinite(val) ? val : r;
        if (fmode === 'Similarity') val = ge(r, ref) ? r : val;
        else val = le(r, ref) ? r : val;
        k = eq(val, r) ? i : k;
      }

      // Set ECHO
      const lineStyle = cfg.fcastStyle === '- - -' ? 'dashed' : cfg.fcastStyle === '· · ·' ? 'dotted' : 'solid';
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      const lines: LineDrawingData[] = [];
      let prev = src[n];
      let current = src[n];
      for (const i of range(0, fcast - 1)) {
        const e = dBack(fcast + k + (fcast - i - 1));
        if (cmode === 'Mean') {
          current = array.avg(a) + e;
        } else if (cmode === 'Linreg') {
          const a2 = array.slice(A, 0, fcast);
          const x = array.slice(X, 0, fcast);
          const alpha = array.covariance(a2, x) / array.variance(x);
          const beta = array.avg(a2) - alpha * array.avg(x);
          current = alpha * (n + i + 1) + beta + e;
        } else {
          current += e;
        }
        // a line with an na coordinate is not drawn
        if (Number.isFinite(prev) && Number.isFinite(current)) {
          lines.push({ time1: T(n + i), price1: prev, time2: T(n + i + 1), price2: current, color: cfg.fcastCss, style: lineStyle });
        }
        prev = current;
      }

      // Set areas
      const boxes: BoxData[] = [];
      if (cfg.showArea && !isNaN(top) && !isNaN(btm)) {
        const area = (left: number, right: number, bg: string) => {
          // a box edge before the first bar is not drawn
          if (left < 0 || right < 0) return;
          boxes.push({ time1: T(left), price1: top, time2: T(right), price2: btm, bgColor: bg, borderColor: 'transparent' });
        };
        area(n - length - fcast * 2 + 1, n - fcast + 1, cfg.evalArea); // Evaluation window
        area(n - fcast + 1, n, cfg.refArea); // Reference window
        area(n - k - fcast * 2 + 1, n - k - fcast, cfg.corrArea); // Correlation window
      }

      return result(lines, boxes);
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TheEchoForecastInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TheEchoForecastInputs> = {},
): Omit<IndicatorResult, 'boxes' | 'lines'> & { boxes: BoxData[]; lines: LineDrawingData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TheEchoForecast = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
