/**
 * Measured Pattern Move (Bulkowski)
 *
 * On each bar, the bars among the current bar and the 500 before it whose open time is between the start and the
 * end time give the pattern height (highest high - lowest low). The target is the pattern high plus the height times
 * the Bulkowski measure rule ratio of the selected pattern (bullish patterns), or the pattern low minus it (bearish
 * patterns), drawn as a purple line with four glow layers. The background marks the bars of the period.
 * "Descending Broadening Wedge" gives no target: the Pine target switch spells it "Descending Broadening Wdge".
 *
 * Reference: "Measured Pattern Move (Bulkowski) [SS]" by Steversteves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Steversteves
 */

import { color, array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MeasuredPatternMoveInputs {
  /** Pattern type */
  typ: string;
  /** Start of period A (UNIX ms, Pine input.time) */
  startTime: number;
  /** End of period A (UNIX ms, Pine input.time) */
  endTime: number;
}

/** timestamp("20 Jul 2022 00:00 +000") */
const DEFAULT_TIME = 1658275200000;

export const defaultInputs: MeasuredPatternMoveInputs = {
  typ: 'Double Bottom',
  startTime: DEFAULT_TIME,
  endTime: DEFAULT_TIME,
};

const TYPES = ['Double Bottom', 'Double Top', 'Head and Shoulders', 'Inverse H&S', 'Bear Flag', 'Bull Flag',
  'Horn Bottom', 'Horn Tops', 'Broadening Top (Megaphone)', 'Descending Broadening Wedge', 'Broadening Bottoms',
  'Broadening Tops', 'Cup and Handle (Bullish)', 'Inverted Cup and Handle (Bearish)', 'Diamond Bottom', 'Diamond Top',
  'Falling Wedge', 'Rising Wedge', 'Pipe Bottom', 'Pipe Top'];

export const inputConfig: InputConfig[] = [
  { id: 'typ', type: 'string', title: 'Select Adam Eve type', defval: 'Double Bottom', options: TYPES },
  { id: 'startTime', type: 'time', title: 'Start time Period A', defval: DEFAULT_TIME },
  { id: 'endTime', type: 'time', title: 'End time Period A', defval: DEFAULT_TIME },
];

const GLOW_COLS = [color.purple, ...[65, 75, 85, 95].map((t) => String(color.new(color.purple, t)))];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Target', color: GLOW_COLS[0], lineWidth: 1 },
  { id: 'plot1', title: 'Target Glow 1', color: GLOW_COLS[1], lineWidth: 3 },
  { id: 'plot2', title: 'Target Glow 2', color: GLOW_COLS[2], lineWidth: 6 },
  { id: 'plot3', title: 'Target Glow 3', color: GLOW_COLS[3], lineWidth: 8 },
  { id: 'plot4', title: 'Target Glow 4', color: GLOW_COLS[4], lineWidth: 10 },
];

export const metadata = {
  title: 'Measured Pattern Move (Bulkowski) [SS]',
  shortTitle: 'Measured Pattern Move (Bulkowski) [SS]',
  overlay: true,
};

/** Measure rule ratio of each pattern (Pine `cont` switch) */
const CONT: Record<string, number> = {
  'Double Bottom': 0.69, 'Double Top': 0.54, 'Inverse H&S': 0.74, 'Bear Flag': 0.47, 'Bull Flag': 0.64,
  'Horn Bottom': 0.76, 'Horn Tops': 0.70, 'Broadening Top (Megaphone)': 0.62, 'Descending Broadening Wedge': 0.79,
  'Broadening Bottoms': 0.59, 'Broadening Tops': 0.62, 'Cup and Handle (Bullish)': 0.50,
  'Inverted Cup and Handle (Bearish)': 0.47, 'Diamond Bottom': 0.81, 'Diamond Top': 0.69, 'Falling Wedge': 0.70,
  'Rising Wedge': 0.58, 'Pipe Bottom': 0.83, 'Pipe Top': 0.70, 'Head and Shoulders': 0.55,
};

/** Pine `target` switch: 'up' = max + dif * cont, 'down' = min - dif * cont; other names give na */
const DIRECTION: Record<string, 'up' | 'down'> = {
  'Double Bottom': 'up', 'Double Top': 'down', 'Inverse H&S': 'up', 'Bear Flag': 'down', 'Bull Flag': 'up',
  'Horn Bottom': 'up', 'Horn Tops': 'down', 'Broadening Top (Megaphone)': 'up', 'Descending Broadening Wdge': 'up',
  'Broadening Bottoms': 'up', 'Broadening Tops': 'down', 'Cup and Handle (Bullish)': 'up',
  'Inverted Cup and Handle (Bearish)': 'down', 'Diamond Bottom': 'up', 'Diamond Top': 'down', 'Falling Wedge': 'up',
  'Rising Wedge': 'down', 'Pipe Bottom': 'up', 'Pipe Top': 'down', 'Head and Shoulders': 'down',
};

/** `for i = 0 to 500`: the current bar and the 500 before it */
const LOOKBACK = 500;

type Result = IndicatorResult & { bgColors: BgColorData[] };
type Point = { time: number; value: number; color: string };

interface MeasuredRun extends BarRunState<Record<string, never>> {
  /** One plot per glow layer */
  plots: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<MeasuredPatternMoveInputs>): BarStudy<MeasuredRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const cont = CONT[cfg.typ] ?? NaN;
  const dir = DIRECTION[cfg.typ];
  const bgcol = String(color.new('#721682', 79));
  return {
    init() {
      const s: MeasuredRun = { plots: GLOW_COLS.map(() => []), bgColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = s.plots;
      return s;
    },
    bar(s, b, bars) {
      const inPeriod = (i: number) => {
        const t = bars[i].time * 1000;
        return t >= cfg.startTime && t <= cfg.endTime;
      };
      const hiAr: number[] = [];
      const loAr: number[] = [];
      // for i = 0 to 500: time[i] >= start_time and time[i] <= end_time (time[i] is na before the first bar)
      for (let i = 0; i <= LOOKBACK && b - i >= 0; i++) {
        if (inPeriod(b - i)) {
          array.push(hiAr, bars[b - i].high);
          array.push(loAr, bars[b - i].low);
        }
      }
      const max = array.max(hiAr);
      const min = array.min(loAr);
      const dif = max - min;
      const target = dir === 'up' ? max + dif * cont : dir === 'down' ? min - dif * cont : NaN;
      const time = bars[b].time;
      GLOW_COLS.forEach((c, k) => { s.plots[k][b] = { time, value: target, color: c }; });
      // bgcolor(time >= start_time and time <= end_time ? bgcol : na)
      if (inPeriod(b)) s.bgColors.push({ time, color: bgcol });
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MeasuredPatternMoveInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MeasuredPatternMoveInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MeasuredPatternMove = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
