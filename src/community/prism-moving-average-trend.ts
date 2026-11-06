/**
 * Prism Moving Average Trend (PriMAT)
 *
 * PRISM(x, length): a weighted average of the last `length` values with the weights (sin(a) + cos(a) + 1) / 2,
 * a = (i + 1) * pi / (length + 1), blended with the current value: base * (1 - alpha) + x * alpha, alpha =
 * 2 / (1 + Lookback). The Prism MA is PRISM(PRISM(src, Lookback), round(sqrt(Lookback))). Bands are the MA +- ATR(Lookback)
 * * multiplier. The trend turns up when the source closes above the upper band with a rising MA, down when it closes
 * below the lower band with a falling MA; it colours the candles, the MA, the bands and the band fill. A yellow
 * background warns of a possible reversal when (src - MA) * trend is at its lowest over Lookback bars.
 *
 * Reference: "Prism Moving Average Trend" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PrismMovingAverageTrendInputs {
  /** Source */
  src: SourceType;
  /** Lookback */
  len: number;
  /** ATR multiplier of the bands */
  mul: number;
}

export const defaultInputs: PrismMovingAverageTrendInputs = {
  src: 'close',
  len: 31,
  mul: 0.85,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'Prism Moving Average Trend' },
  { id: 'len', type: 'int', title: 'Lookback', defval: 31, min: 2, tooltip: 'Changes the amount of data used.',
    group: 'Prism Moving Average Trend' },
  { id: 'mul', type: 'float', title: 'Multiplier', defval: 0.85, step: 0.05, group: 'Prism Moving Average Trend' },
];

const NEUTRAL = String(color.rgb(72, 72, 72));
const NEUTRAL_T = String(color.rgb(72, 72, 72, 60));
const UP = String(color.rgb(0, 255, 187));
const UP_T = String(color.rgb(0, 255, 187, 60));
const DOWN = String(color.rgb(255, 0, 157));
const DOWN_T = String(color.rgb(255, 0, 157, 60));
const DANGER = String(color.rgb(253, 249, 57, 65));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Prism Moving Average', color: NEUTRAL, lineWidth: 3 },
  { id: 'plot1', title: 'Prism Upper Band', color: NEUTRAL, lineWidth: 2 },
  { id: 'plot2', title: 'Prism Lower Band', color: NEUTRAL, lineWidth: 2 },
  { id: 'plot3', title: 'Change', color: NEUTRAL, lineWidth: 1, display: 'status_line' },
];

export const metadata = {
  title: 'Prism Moving Average Trend',
  shortTitle: 'PriMAT │ MisinkoMaster',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> };

interface PrismVars {
  /** var trend = 0, var col, var colT, var colC */
  trend: number;
  c: string;
  cT: string;
  cC: string;
}

interface PrismRun extends BarRunState<PrismVars> {
  atr: ReturnType<typeof taStep.atr>;
  lowest: WindowExtreme;
  src: number[];
  base: number[];
  prism: number[];
  plots: Point[][];
  colT: string[];
  candles: PlotCandleData[];
  bgColors: BgColorData[];
}

/** The PRISM weights (sin(a) + cos(a) + 1) / 2 of one length and their sum (added in the same order) */
function prismWeights(length: number): { weights: number[]; w: number } {
  const weights: number[] = [];
  let w = 0.0;
  for (let i = 0; i <= length - 1; i++) {
    const angle = ((i + 1) * Math.PI) / (length + 1);
    const weight = ((math.sin(angle) as number) + (math.cos(angle) as number) + 1) / 2;
    weights.push(weight);
    w += weight;
  }
  return { weights, w };
}

function study(inputs: Partial<PrismMovingAverageTrendInputs>): BarStudy<PrismRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, mul } = cfg;
  const value = barSource(cfg.src);
  const sqrtlen = math.round(math.sqrt(len) as number) as number;
  // PRISM(source, length); alpha uses the Lookback input `len`, not `length` (as the Pine source)
  const alpha = 2 / (1 + len);
  const w1 = prismWeights(len);
  const w2 = prismWeights(sqrtlen);
  const PRISM = (source: number[], k: number, { weights, w }: { weights: number[]; w: number }): number => {
    let sum = 0.0;
    for (let i = 0; i < weights.length; i++) sum += (k - i >= 0 ? source[k - i] : NaN) * weights[i];
    // w != 0 (Pine: not within 1e-10 of 0)
    const base = !eq(w, 0) ? sum / w : source[k];
    return base * (1 - alpha) + source[k] * alpha;
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: PrismRun = {
        atr: taStep.atr(len), lowest: new WindowExtreme(true, len), src: [], base: [], prism: [],
        plots: [[], [], [], []], colT: [], candles: [], bgColors: [],
        vars: { trend: 0, c: NEUTRAL, cT: NEUTRAL_T, cC: NEUTRAL }, steps: [], lists: [], series: [],
      };
      s.steps = [s.atr, s.lowest];
      s.lists = [s.bgColors];
      s.series = [s.src, s.base, s.prism, ...s.plots, s.colT, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const src = value(b);
      s.src[i] = src;
      s.base[i] = PRISM(s.src, i, w1);
      const prism = PRISM(s.base, i, w2);
      s.prism[i] = prism;
      const vol = s.atr.step(b.high, b.low, b.close) * mul;
      const upper = prism + vol;
      const lower = prism - vol;
      const change = prism - (i > 0 ? s.prism[i - 1] : NaN);
      if (gt(src, upper) && gt(change, 0)) v.trend = 1;
      if (lt(src, lower) && lt(change, 0)) v.trend = -1;
      const trend = v.trend;
      if (trend === 1) {
        v.c = UP;
        v.cT = UP_T;
      }
      if (trend === -1) {
        v.c = DOWN;
        v.cT = DOWN_T;
      }
      if (gt(change, 0)) v.cC = UP;
      if (lt(change, 0)) v.cC = DOWN;
      const col = v.c;
      s.colT[i] = v.cT;
      const dist = (src - prism) * trend;
      // (src - prism) * trend == ta.lowest((src - prism) * trend, len)
      const lowestDist = s.lowest.step(dist);
      // plotcandle(open, high, low, close, color = col, bordercolor = col, wickcolor = col, display = display.pane)
      s.candles[i] = { time, open: b.open, high: b.high, low: b.low, close: b.close, color: col, wickColor: col, borderColor: col };
      s.plots[0][i] = { time, value: fin(prism), color: col };
      s.plots[1][i] = { time, value: fin(upper), color: col };
      s.plots[2][i] = { time, value: fin(lower), color: col };
      s.plots[3][i] = { time, value: fin(change), color: v.cC };
      if (eq(dist, lowestDist)) s.bgColors.push({ time, color: DANGER });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        // fill(u, l, colT, "Band Filling")
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Band Filling' }, colors: s.colT.slice() }],
        bgColors: s.bgColors.slice(),
        plotCandles: { prismCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PrismMovingAverageTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PrismMovingAverageTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PrismMovingAverageTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
