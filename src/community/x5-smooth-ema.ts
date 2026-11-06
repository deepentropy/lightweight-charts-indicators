/**
 * x5 Smooth EMA
 *
 * An EMA of the source is smoothed again by five moving averages of the same length (SMA, EMA, RMA, WMA, VWMA). Each
 * smoothed line is coloured bull when it rises from the previous bar, else bear. The base EMA is drawn as a sixth
 * line, coloured as the VWMA line (as the original script does).
 *
 * Reference: "x5-smooth-ema[t90]" by traderninezero
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © traderninezero
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface X5SmoothEmaInputs {
  /** Source of the base EMA */
  src: SourceType;
  /** Length of the base EMA and of the smoothing averages */
  emaLen: number;
  bullColor: string;
  bearColor: string;
}

// input.color(#00e67740) / input.color(#f5020237): Pine keeps the alpha with 2 decimals (0.25 / 0.22)
export const defaultInputs: X5SmoothEmaInputs = {
  src: 'close',
  emaLen: 9,
  bullColor: 'rgba(0, 230, 119, 0.25)',
  bearColor: 'rgba(245, 2, 2, 0.22)',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'emaLen', type: 'int', title: 'Base Length', defval: 9 },
  { id: 'bullColor', type: 'color', title: 'Bull Color', defval: 'rgba(0, 230, 119, 0.25)' },
  { id: 'bearColor', type: 'color', title: 'Bear Color', defval: 'rgba(245, 2, 2, 0.22)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'fl1', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot1', title: 'fl2', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot2', title: 'fl3', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot3', title: 'fl4', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot4', title: 'fl5', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
  { id: 'plot5', title: 'fl0', color: 'rgba(0, 230, 119, 0.25)', lineWidth: 1 },
];

export const metadata = {
  title: 'x5-smooth-ema[t90]',
  shortTitle: 'x5ema[t90]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };

interface X5Run extends BarRunState<Record<string, never>> {
  mainEma: ReturnType<typeof taStep.ema>;
  sma: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  rma: ReturnType<typeof taStep.rma>;
  wma: ReturnType<typeof taStep.wma>;
  vwma: WindowVwma;
  /** Values of the five smoothed lines per bar */
  vals: number[][];
  lines: Point[][];
}

/** Line `k` on bar `i`: its value and colour (x > x[1] ? bullColor : bearColor) */
function line(s: X5Run, k: number, i: number, time: number, x: number, bull: string, bear: string): string {
  const vals = s.vals[k]!;
  vals[i] = x;
  const color = i > 0 && gt(x, vals[i - 1]!) ? bull : bear;
  s.lines[k]![i] = { time, value: x, color };
  return color;
}

function study(inputs: Partial<X5SmoothEmaInputs>): BarStudy<X5Run, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.emaLen;
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const mainEma = taStep.ema(len);
      const sma = new WindowSma(len);
      const ema = taStep.ema(len);
      const rma = taStep.rma(len);
      const wma = taStep.wma();
      const vwma = new WindowVwma(len);
      const s: X5Run = {
        mainEma, sma, ema, rma, wma, vwma, vals: [[], [], [], [], []], lines: [[], [], [], [], [], []],
        steps: [mainEma, sma, ema, rma, wma, vwma], vars: {}, lists: [], series: [],
      };
      s.series = [...s.vals, ...s.lines];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const mainEMA = s.mainEma.step(value(b));
      // baseEMA = ta.ema(src, len): the doubles of mainEMA
      const baseEMA = mainEMA;
      // x > x[1] ? bullColor : bearColor
      line(s, 0, i, time, s.sma.step(mainEMA), cfg.bullColor, cfg.bearColor);
      line(s, 1, i, time, s.ema.step(mainEMA), cfg.bullColor, cfg.bearColor);
      line(s, 2, i, time, s.rma.step(mainEMA), cfg.bullColor, cfg.bearColor);
      line(s, 3, i, time, s.wma.step(mainEMA, len), cfg.bullColor, cfg.bearColor);
      const vwmaColor = line(s, 4, i, time, s.vwma.step(mainEMA, b.volume ?? NaN), cfg.bullColor, cfg.bearColor);
      // plot(baseEMA, "fl0", color = smoothVWMAColor)
      s.lines[5]![i] = { time, value: baseEMA, color: vwmaColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lines[0]!.slice(),
          plot1: s.lines[1]!.slice(),
          plot2: s.lines[2]!.slice(),
          plot3: s.lines[3]!.slice(),
          plot4: s.lines[4]!.slice(),
          plot5: s.lines[5]!.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<X5SmoothEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<X5SmoothEmaInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const X5SmoothEma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
