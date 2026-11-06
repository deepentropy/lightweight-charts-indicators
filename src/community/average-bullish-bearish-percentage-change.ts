/**
 * Average Bullish & Bearish Percentage Change
 *
 * Each bar with a rising close (change >= 0) adds its percentage move to a "bullish" list, each bar with a falling
 * close adds its absolute percentage move to a "bearish" list. The move is the close change divided by the previous
 * close ("Net Move"), or close - min(low, close[1]) divided by min(low, close[1]) for bullish bars and
 * max(high, close[1]) - close divided by max(high, close[1]) for bearish bars ("Full Capacity"). The lists keep the
 * last `bull_count` / `bear_count` values. The averages of the lists (simple, exponential or weighted) are drawn as
 * columns on the bullish / bearish bars, brighter when the average rose since the previous bar of the same kind.
 * The exponential average keeps its value from bar to bar and runs again over the whole list on every bar, as the
 * Pine function (a `var` inside it). As an option, bars are coloured when the average falls.
 * The script runs on the chart timeframe (indicator timeframe = ""); the extra Timeframe setting is not ported.
 * Alerts (alertcondition, `alerts` of the result): the bullish average crossing over the bearish one, and the mirror.
 *
 * Reference: "Average Bullish & Bearish Percentage Change" by fract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AverageBullishBearishPercentageChangeInputs {
  /** Bar metrics: 'Net Move' (close change) or 'Full Capacity' (move from the low / high, including the gap) */
  src: 'Net Move' | 'Full Capacity';
  /** Averaging type */
  avgType: 'Simple' | 'Exponential' | 'Weighted';
  /** Number of past bullish bars in the average */
  bullCount: number;
  /** Number of past bearish bars in the average */
  bearCount: number;
  /** Colour the bars where the average falls */
  colbars: boolean;
}

export const defaultInputs: AverageBullishBearishPercentageChangeInputs = {
  src: 'Net Move',
  avgType: 'Exponential',
  bullCount: 10,
  bearCount: 10,
  colbars: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'string', title: 'Bar Metrics', defval: 'Net Move', options: ['Net Move', 'Full Capacity'] },
  { id: 'avgType', type: 'string', title: 'Averaging Type', defval: 'Exponential', options: ['Simple', 'Exponential', 'Weighted'] },
  { id: 'bullCount', type: 'int', title: 'Past Bullish Bars Count', defval: 10, min: 1 },
  { id: 'bearCount', type: 'int', title: 'Past Bearish Bars Count', defval: 10, min: 1 },
  { id: 'colbars', type: 'bool', title: 'Color Bars', defval: false },
];

const BULL_UP = String(color.rgb(107, 165, 131, 10));
const BULL_DOWN = String(color.rgb(107, 165, 131, 50));
const BEAR_UP = String(color.rgb(215, 84, 66, 10));
const BEAR_DOWN = String(color.rgb(215, 84, 66, 50));
const BAR_BULL = String(color.rgb(155, 0, 255));
const BAR_BEAR = String(color.rgb(245, 127, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish 𝜟', color: BULL_DOWN, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Bearish 𝜟', color: BEAR_DOWN, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Average Bullish & Bearish Percentage Change',
  shortTitle: 'Bullish & Bearish %𝜟',
  overlay: false,
  format: 'percent',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/** simple_avg(data): array.sum(data) / size */
const simpleAvg = (data: number[]) => data.reduce((acc, v) => acc + v, 0) / data.length;

/** weighted_avg(data): weights 1..size, the newest value has the largest weight */
const weightedAvg = (data: number[]) => {
  let sumWeights = 0.0;
  let weightedSum = 0.0;
  for (let i = 0; i < data.length; i++) {
    const weight = i + 1;
    sumWeights += weight;
    weightedSum += data[i] * weight;
  }
  return weightedSum / sumWeights;
};

/** exp_avg(data, length) of one Pine call site: `var float ema` (the value of the previous call, in `ema`), and every
 *  call runs the EMA again over the whole list, starting from that value */
const expAvg = (data: number[], length: number, ema: number) => {
  const alpha = 2.0 / (length + 1);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    ema = isNaN(ema) ? v : (v - ema) * alpha + ema;
  }
  return ema;
};

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface AvgVars {
  bull: number[]; // var array<float> bull
  bear: number[]; // var array<float> bear
  /** `var float ema` of the two exp_avg call sites */
  bullEma: number;
  bearEma: number;
  // ta.valuewhen(bl, bavg, 0 / 1) and ta.valuewhen(br, savg, 0 / 1)
  bullVw0: number;
  bullVw1: number;
  bearVw0: number;
  bearVw1: number;
}

interface AvgRun extends BarRunState<AvgVars> {
  bavgs: number[];
  savgs: number[];
  plot0: Point[];
  plot1: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AverageBullishBearishPercentageChangeInputs>): BarStudy<AvgRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const net = cfg.src === 'Net Move';
  return {
    init() {
      const s: AvgRun = {
        bavgs: [], savgs: [], plot0: [], plot1: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: { bull: [], bear: [], bullEma: NaN, bearEma: NaN, bullVw0: NaN, bullVw1: NaN, bearVw0: NaN, bearVw1: NaN },
        lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.bavgs, s.savgs, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, bull: v.bull.slice(), bear: v.bear.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const { bull, bear } = v;
      const b = bars[i]!;
      const prevClose = i > 0 ? bars[i - 1]!.close : NaN;
      const lowRef = Math.min(b.low, prevClose); // math.min(low, close[1]): na on bar 0
      const highRef = Math.max(b.high, prevClose);
      const bp = b.close - lowRef;
      const sp = highRef - b.close;
      const delta = b.close - prevClose; // ta.change(close)
      const deltaPos = ge(delta, 0);
      const deltaNeg = lt(delta, 0);
      const bulldelta = deltaPos ? delta : NaN;
      const beardelta = deltaNeg ? Math.abs(delta) : NaN;
      // A plain division: x / 0 is +-infinity, which na() treats as na (the value is not pushed)
      const brng = (net ? bulldelta / prevClose : bp / lowRef) * 100;
      const srng = (net ? beardelta / prevClose : sp / highRef) * 100;
      const bl = deltaPos;
      const br = deltaNeg;

      if (bl && Number.isFinite(brng)) {
        bull.push(brng);
        if (bull.length > cfg.bullCount) bull.shift();
      }
      if (br && Number.isFinite(srng)) {
        bear.push(srng);
        if (bear.length > cfg.bearCount) bear.shift();
      }

      let bavg = NaN;
      let savg = NaN;
      if (bull.length > 0) {
        if (cfg.avgType === 'Simple') bavg = simpleAvg(bull);
        else if (cfg.avgType === 'Exponential') bavg = v.bullEma = expAvg(bull, cfg.bullCount, v.bullEma);
        else if (cfg.avgType === 'Weighted') bavg = weightedAvg(bull);
      }
      if (bear.length > 0) {
        if (cfg.avgType === 'Simple') savg = simpleAvg(bear);
        else if (cfg.avgType === 'Exponential') savg = v.bearEma = expAvg(bear, cfg.bearCount, v.bearEma);
        else if (cfg.avgType === 'Weighted') savg = weightedAvg(bear);
      }
      s.bavgs[i] = bavg;
      s.savgs[i] = savg;

      if (bl) {
        v.bullVw1 = v.bullVw0;
        v.bullVw0 = bavg;
      }
      if (br) {
        v.bearVw1 = v.bearVw0;
        v.bearVw0 = savg;
      }
      const gr = gt(v.bullVw0, v.bullVw1);
      const fl = gt(v.bearVw0, v.bearVw1);

      // plot(bl ? bavg : na, 'Bullish 𝜟', gr ? color.rgb(107, 165, 131, 10) : color.rgb(107, 165, 131, 50), columns)
      s.plot0[i] = { time: b.time as number, value: bl && Number.isFinite(bavg) ? bavg : NaN, color: gr ? BULL_UP : BULL_DOWN };
      s.plot1[i] = { time: b.time as number, value: br && Number.isFinite(savg) ? savg : NaN, color: fl ? BEAR_UP : BEAR_DOWN };

      // barcolor(colbars and bl and valuewhen(bl, bavg, 0) < valuewhen(bl, bavg, 1) ? purple : na), then the bearish
      // one (bl and br never hold on the same bar)
      if (cfg.colbars && bl && lt(v.bullVw0, v.bullVw1)) s.barColors.push({ time: b.time, color: BAR_BULL });
      if (cfg.colbars && br && lt(v.bearVw0, v.bearVw1)) s.barColors.push({ time: b.time, color: BAR_BEAR });

      // alertcondition(ta.crossover(bavg, savg)) / alertcondition(ta.crossover(savg, bavg))
      const pb = i > 0 ? s.bavgs[i - 1]! : NaN;
      const ps = i > 0 ? s.savgs[i - 1]! : NaN;
      const flags = [bavg > savg && pb <= ps, savg > bavg && ps <= pb];
      flags.forEach((f, k) => {
        s.flags[k]![i] = f;
        if (f) s.times[k]!.push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AverageBullishBearishPercentageChangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AverageBullishBearishPercentageChangeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (no message: the default one) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish %𝜟 > Bearish %𝜟', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Bearish %𝜟 > Bullish %𝜟', message: 'Alert Fired!' },
];

export const AverageBullishBearishPercentageChange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
