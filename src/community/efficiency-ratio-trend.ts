/**
 * Efficiency Ratio Trend
 *
 * A step line that moves to the source only when the source leaves a band around the line. The band half width
 * blends two standard deviations of 2 * source with the Kaufman efficiency ratio er = |change(src, length)| /
 * sum(|change(src)|, length): dev = er * stdev(2 * src, fast) + (1 - er) * stdev(2 * src, slow). The trend turns up
 * (or down) when the relative step of the line is at least 1 % of ATR(14) / line; the line is cyan in an up trend and
 * purple otherwise.
 *
 * Reference: "Efficiency Ratio Trend [Achira Meegasthanne]" by achirameegasthanne
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EfficiencyRatioTrendInputs {
  /** Sensitivity input of the Pine script (not used by its computation) */
  markrtStairsSen: number;
  /** Efficiency ratio length */
  length: number;
  /** Fast standard deviation length */
  fastLen: number;
  /** Slow standard deviation length */
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: EfficiencyRatioTrendInputs = {
  markrtStairsSen: 2.0,
  length: 200,
  fastLen: 100,
  slowLen: 400,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'markrtStairsSen', type: 'float', title: '', defval: 2.0, min: 0.01 },
  { id: 'length', type: 'int', title: 'Length', defval: 200 },
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 100 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 400 },
  { id: 'src', type: 'source', title: 'Src', defval: 'close' },
];

const BULL_COL = String(color.new('#0df1c6', 20));
const BEAR_COL = '#871ee9';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BULL_COL, lineWidth: 3, style: 'stepline_diamond' },
];

export const metadata = {
  title: 'Efficiency Ratio Trend',
  shortTitle: 'Efficiency Ratio Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine a != b: false when a value is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };

interface ErtRun extends BarRunState<{ trend: number }> {
  chgLen: ReturnType<typeof taStep.change>;
  chg: ReturnType<typeof taStep.change>;
  sumAbs: WindowSum;
  sdFast: WindowStdev;
  sdSlow: WindowStdev;
  atr: ReturnType<typeof taStep.atr>;
  aArr: number[];
  plot: Point[];
}

function study(inputs: Partial<EfficiencyRatioTrendInputs>): BarStudy<ErtRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const chgLen = taStep.change(cfg.length);
      const chg = taStep.change();
      const sumAbs = new WindowSum(cfg.length);
      const sdFast = new WindowStdev(cfg.fastLen);
      const sdSlow = new WindowStdev(cfg.slowLen);
      const atr = taStep.atr(14);
      const s: ErtRun = {
        chgLen, chg, sumAbs, sdFast, sdSlow, atr, aArr: [], plot: [],
        steps: [chgLen, chg, sumAbs, sdFast, sdSlow, atr],
        vars: { trend: 0 }, // var int trend = 0
        lists: [], series: [],
      };
      s.series = [s.aArr, s.plot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      // er = math.abs(ta.change(src, length)) / math.sum(math.abs(ta.change(src)), length)
      const chgLen = s.chgLen.step(src);
      const sumAbs = s.sumAbs.step(Math.abs(s.chg.step(src)));
      const sdFast = s.sdFast.step(src * 2);
      const sdSlow = s.sdSlow.step(src * 2);
      const atr = s.atr.step(b.high, b.low, b.close);

      const er = Math.abs(chgLen) / sumAbs;
      const dev = er * sdFast + (1 - er) * sdSlow;
      // a := src > nz(a[1], src) + dev ? src : src < nz(a[1], src) - dev ? src : nz(a[1], src)
      const prevA = i > 0 && !isNaN(s.aArr[i - 1]) ? s.aArr[i - 1] : src;
      const a = gt(src, prevA + dev) ? src : lt(src, prevA - dev) ? src : prevA;
      s.aArr[i] = a;

      // delta = (a - a[1]) / a[1]
      const a1 = i > 0 ? s.aArr[i - 1] : NaN;
      const delta = (a - a1) / a1;
      // price_scale = a != 0 ? a : close; volatility_pct = atr / price_scale; threshold = volatility_pct * 0.01
      const priceScale = ne(a, 0) ? a : b.close;
      const threshold = (atr / priceScale) * 0.01;
      // if math.abs(delta) >= threshold: trend := delta > 0 ? 1 : 0 (else unchanged)
      if (ge(Math.abs(delta), threshold)) s.vars.trend = gt(delta, 0) ? 1 : 0;
      // plot(a, color = isBullms ? bullCol : bearCol, linewidth = 3, style = plot.style_stepline_diamond, editable = false)
      s.plot[i] = { time: b.time as number, value: Number.isFinite(a) ? a : NaN, color: s.vars.trend === 1 ? BULL_COL : BEAR_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EfficiencyRatioTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EfficiencyRatioTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EfficiencyRatioTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
