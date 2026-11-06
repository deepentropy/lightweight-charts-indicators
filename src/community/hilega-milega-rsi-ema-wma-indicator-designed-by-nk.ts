/**
 * Hilega-Milega-RSI-EMA-WMA
 *
 * An RSI computed by hand (RMA of the up and down changes of the source), with a WMA and an EMA of the RSI. Two dashed
 * middle lines (an adjustable one and 50), and fills between the RSI and the adjustable middle line: red when the RSI
 * is above it, blue when it is below.
 *
 * Reference: "Hilega-Milega-RSI-EMA-WMA indicator designed by NK" by kshirsagar_n
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NK1356
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HilegaMilegaRsiEmaWmaInputs {
  /** RSI source */
  src: SourceType;
  /** RSI length */
  len: number;
  /** WMA length (WMA of the RSI) */
  wmaLength: number;
  /** EMA length (EMA of the RSI) */
  emaLength: number;
  /** Adjustable middle line */
  adjustableMiddleLine: number;
}

export const defaultInputs: HilegaMilegaRsiEmaWmaInputs = {
  src: 'close',
  len: 9,
  wmaLength: 21,
  emaLength: 3,
  adjustableMiddleLine: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'RSI Length', defval: 9, min: 1 },
  { id: 'wmaLength', type: 'int', title: 'WMA Length', defval: 21 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 3 },
  { id: 'adjustableMiddleLine', type: 'int', title: 'Adjustable Middle Line', defval: 50 },
];

const RSI_COLOR = String(color.new(color.black, 0));
const WMA_COLOR = String(color.new(color.red, 0));
const EMA_COLOR = String(color.new(color.green, 0));
const OVERSOLD_COLOR = String(color.new(color.red, 90));
const OVERBOUGHT_COLOR = String(color.new(color.blue, 90));
/** Pine default plot colour (the reference plot has no colour argument) */
const DEFAULT_PLOT_COLOR = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'WMA', color: WMA_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'EMA', color: EMA_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Middle Line Reference', color: DEFAULT_PLOT_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold', color: OVERSOLD_COLOR, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Overbought', color: OVERBOUGHT_COLOR, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Hilega-Milega-RSI-EMA-WMA indicator designed by NK',
  shortTitle: 'Hilega-Milega-RSI-EMA-WMA indicator designed by NK',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

interface HmRun extends BarRunState<Record<string, never>> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  wma: ReturnType<typeof taStep.wma>;
  ema: ReturnType<typeof taStep.ema>;
  plots: Point[][];
}

function study(inputs: Partial<HilegaMilegaRsiEmaWmaInputs>): BarStudy<HmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const mid = cfg.adjustableMiddleLine;
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const up = taStep.rma(cfg.len);
      const down = taStep.rma(cfg.len);
      const wma = taStep.wma();
      const ema = taStep.ema(cfg.emaLength);
      const s: HmRun = {
        up, down, wma, ema, plots: [[], [], [], [], [], []],
        steps: [up, down, wma, ema], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      // ta.change(src): na on bar 0; math.max / math.min of na is na
      const c = i > 0 ? value(bars[i]) - value(bars[i - 1]) : NaN;
      const u = s.up.step(isNaN(c) ? NaN : Math.max(c, 0));
      const d = s.down.step(isNaN(c) ? NaN : -Math.min(c, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(d, 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / d);
      const wma = s.wma.step(rsi, cfg.wmaLength);
      const ema = s.ema.step(rsi);
      const p = s.plots;
      p[0]![i] = { time: t, value: rsi, color: RSI_COLOR };
      p[1]![i] = { time: t, value: wma, color: WMA_COLOR };
      p[2]![i] = { time: t, value: ema, color: EMA_COLOR };
      p[3]![i] = { time: t, value: mid, color: DEFAULT_PLOT_COLOR };
      // rsi > adjustable_middle_line ? rsi : adjustable_middle_line (na rsi compares false)
      p[4]![i] = { time: t, value: gt(rsi, mid) ? rsi : mid, color: OVERSOLD_COLOR };
      // rsi > adjustable_middle_line ? adjustable_middle_line : rsi
      p[5]![i] = { time: t, value: gt(rsi, mid) ? mid : rsi, color: OVERBOUGHT_COLOR };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0]!.slice(), plot1: p[1]!.slice(), plot2: p[2]!.slice(), plot3: p[3]!.slice(), plot4: p[4]!.slice(),
          plot5: p[5]!.slice(),
        },
        hlines: [
          { value: mid, options: { title: 'Adjustable Middle Line', color: color.gray, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Default Middle Line', color: '#b2b5be', linestyle: 'dashed' } },
        ],
        fills: [
          // fill(obsd, ref, color.new(color.red, 90), title = "Oversold")
          { plot1: 'plot4', plot2: 'plot3', options: { title: 'Oversold', color: OVERSOLD_COLOR } },
          // fill(obbt, ref, color.new(color.blue, 90), title = "Overbought")
          { plot1: 'plot5', plot2: 'plot3', options: { title: 'Overbought', color: OVERBOUGHT_COLOR } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HilegaMilegaRsiEmaWmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HilegaMilegaRsiEmaWmaInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HilegaMilegaRsiEmaWma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
