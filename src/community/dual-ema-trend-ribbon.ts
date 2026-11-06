/**
 * Dual EMA Trend Ribbon
 *
 * Two EMA pairs of the close: a fast ribbon (EMA 10 / EMA 30) and a slow ribbon (EMA 40 / EMA 50). Each ribbon is
 * the fill between its two EMAs, green when its fast EMA is above its slow EMA and red otherwise (light colours for
 * the fast ribbon, dark colours for the slow ribbon). The four EMAs are drawn as thin black lines.
 *
 * Reference: "Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation)" by Aleksin_Aleksandar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DualEMATrendRibbonInputs {
  /** Fast EMA of ribbon 1 */
  fastLength1: number;
  /** Slow EMA of ribbon 1 */
  slowLength1: number;
  /** Fast EMA of ribbon 2 */
  fastLength2: number;
  /** Slow EMA of ribbon 2 */
  slowLength2: number;
}

export const defaultInputs: DualEMATrendRibbonInputs = {
  fastLength1: 10,
  slowLength1: 30,
  fastLength2: 40,
  slowLength2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength1', type: 'int', title: 'Fast EMA 1  Period', defval: 10, min: 1 },
  { id: 'slowLength1', type: 'int', title: 'Slow EMA 1  Period', defval: 30, min: 1 },
  { id: 'fastLength2', type: 'int', title: 'Fast EMA 2  Period', defval: 40, min: 1 },
  { id: 'slowLength2', type: 'int', title: 'Slow EMA 2  Period', defval: 50, min: 1 },
];

// Pine colours: color.rgb(0, 0, 0), color.rgb(7, 0, 0), color.new(#070600, 0), color.new(#040505, 0)
const FAST1_COL = String(color.rgb(0, 0, 0));
const SLOW1_COL = String(color.rgb(7, 0, 0));
const FAST2_COL = String(color.new('#070600', 0));
const SLOW2_COL = String(color.new('#040505', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA 1', color: FAST1_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA 1', color: SLOW1_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Fast EMA 2', color: FAST2_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Slow EMA 2', color: SLOW2_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Dual EMA Band (On Chart)',
  shortTitle: 'DEMA-Band-OC',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface RibbonRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  lines: Point[][];
  colors1: string[];
  colors2: string[];
}

function study(inputs: Partial<DualEMATrendRibbonInputs>): BarStudy<RibbonRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // ribbon_color_1 = fast_ema_1 > slow_ema_1 ? color.new(#4bd64f, 40) : color.new(#f31f1f, 40)
  const bull1 = String(color.new('#4bd64f', 40));
  const bear1 = String(color.new('#f31f1f', 40));
  // ribbon_color_2 = fast_ema_2 > slow_ema_2 ? color.new(#032404, 30) : color.new(#3d0202, 30)
  const bull2 = String(color.new('#032404', 30));
  const bear2 = String(color.new('#3d0202', 30));
  const cols = [FAST1_COL, SLOW1_COL, FAST2_COL, SLOW2_COL];
  return {
    init() {
      const emas = [cfg.fastLength1, cfg.slowLength1, cfg.fastLength2, cfg.slowLength2].map((len) => taStep.ema(len));
      const s: RibbonRun = { emas, lines: [[], [], [], []], colors1: [], colors2: [], steps: emas, vars: {}, lists: [], series: [] };
      s.series = [...s.lines, s.colors1, s.colors2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const fast1 = s.emas[0].step(b.close) ?? NaN;
      const slow1 = s.emas[1].step(b.close) ?? NaN;
      const fast2 = s.emas[2].step(b.close) ?? NaN;
      const slow2 = s.emas[3].step(b.close) ?? NaN;
      s.lines[0][i] = { time: b.time, value: fast1, color: cols[0] };
      s.lines[1][i] = { time: b.time, value: slow1, color: cols[1] };
      s.lines[2][i] = { time: b.time, value: fast2, color: cols[2] };
      s.lines[3][i] = { time: b.time, value: slow2, color: cols[3] };
      s.colors1[i] = gt(fast1, slow1) ? bull1 : bear1;
      s.colors2[i] = gt(fast2, slow2) ? bull2 : bear2;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lines[0].slice(),
          plot1: s.lines[1].slice(),
          plot2: s.lines[2].slice(),
          plot3: s.lines[3].slice(),
        },
        fills: [
          // fill(p_fast_1, p_slow_1, color = ribbon_color_1, title = "Trend Ribbon 1 Fill")
          { plot1: 'plot0', plot2: 'plot1', colors: s.colors1.slice() },
          // fill(p_fast_2, p_slow_2, color = ribbon_color_2, title = "Trend Ribbon 2 Fill")
          { plot1: 'plot2', plot2: 'plot3', colors: s.colors2.slice() },
        ],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DualEMATrendRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DualEMATrendRibbonInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DualEMATrendRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
