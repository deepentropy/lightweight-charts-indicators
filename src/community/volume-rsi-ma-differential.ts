/**
 * Volume + RSI & MA Differential
 *
 * RSI(14) of the close, SMA(20) of the volume and two SMAs of the close (fast, slow). The volume SMA is drawn as
 * columns, light orange when the RSI is below the buy level with a volume above its SMA, pink when the RSI is above
 * the sell level with the close above the fast SMA, dark grey otherwise; the bars get the same signal colours (teal
 * when neutral). A line at 1 shows the MA differential diffMA = (fast SMA - slow SMA) * volume SMA / 2: dark when
 * diffMA rises, pink when it is above volume SMA / 2, light orange otherwise.
 *
 * Reference: "Volume + RSI & MA Differential" by ozzy_livin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright All rights reserved @ozzy_livin
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeRsiMaDifferentialInputs {
  /** RSI buy level (Pine input `low`) */
  rsiBuy: number;
  /** RSI sell level (Pine input `high`) */
  rsiSell: number;
  /** Fast SMA length */
  fastLength: number;
  /** Slow SMA length */
  slowLength: number;
}

export const defaultInputs: VolumeRsiMaDifferentialInputs = {
  rsiBuy: 35,
  rsiSell: 75,
  fastLength: 50,
  slowLength: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiBuy', type: 'int', title: 'RSI Buy Signal', defval: 35 },
  { id: 'rsiSell', type: 'int', title: 'RSI Sell Signal', defval: 75 },
  { id: 'fastLength', type: 'int', title: 'Fast MA', defval: 50 },
  { id: 'slowLength', type: 'int', title: 'Slow MA', defval: 100 },
];

const BAR_BUY = String(color.new('#ffcc80', 0));
const BAR_SELL = String(color.new('#e91e63', 0));
const BAR_NEUTRAL = String(color.new('#0097a7', 0));
const COL_BUY = String(color.new('#ffcc80', 30));
const COL_SELL = String(color.new('#e91e63', 30));
const COL_NEUTRAL = String(color.new('#111111', 30));
const DIFF_UP = String(color.new('#111111', 0));
const DIFF_HIGH = String(color.new('#e91e63', 0));
const DIFF_LOW = String(color.new('#ffcc80', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume MA Columns', color: COL_NEUTRAL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume MA', color: '#FFCD50', lineWidth: 1 },
  { id: 'plot2', title: 'MA Differential', color: DIFF_LOW, lineWidth: 4 },
];

export const metadata = {
  title: 'Volume + RSI & MA Differential',
  shortTitle: 'VRMA Differential',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface VrmaRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  volSma: WindowSma;
  fastSma: WindowSma;
  slowSma: WindowSma;
  diffMA: number[];
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<VolumeRsiMaDifferentialInputs>): BarStudy<VrmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: VrmaRun = {
        rsi: taStep.rsi(14), volSma: new WindowSma(20), fastSma: new WindowSma(cfg.fastLength),
        slowSma: new WindowSma(cfg.slowLength), diffMA: [], plots: [[], [], []], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.volSma, s.fastSma, s.slowSma];
      s.lists = [s.barColors];
      s.series = [s.diffMA, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const volume = b.volume ?? NaN;
      const rs = s.rsi.step(close);
      const volumeMA = s.volSma.step(volume);
      const fastMA = s.fastSma.step(close);
      const slowMA = s.slowSma.step(close);
      // diffMA = (fastMA - slowMA) * (volumeMA / 2)
      const diffMA = (fastMA - slowMA) * (volumeMA / 2);
      s.diffMA[i] = diffMA;

      const buy = lt(rs, cfg.rsiBuy) && gt(volume, volumeMA);
      const sell = gt(rs, cfg.rsiSell) && lt(fastMA, close);
      // barcolor(rs < low and volume > volumeMA ? #ffcc80 : rs > high and fastMA < close ? #e91e63 : #0097a7)
      s.barColors.push({ time: t, color: buy ? BAR_BUY : sell ? BAR_SELL : BAR_NEUTRAL });
      // plot(volumeMA, color = ..., style = plot.style_columns)
      s.plots[0][i] = { time: t, value: volumeMA, color: buy ? COL_BUY : sell ? COL_SELL : COL_NEUTRAL };
      // plot(volumeMA, color = #FFCD50)
      s.plots[1][i] = { time: t, value: volumeMA, color: '#FFCD50' };
      // plot(1, color = diffMA > diffMA[1] ? #111111 : diffMA > volumeMA / 2 ? #e91e63 : #ffcc80, linewidth = 4)
      const prev = i > 0 ? s.diffMA[i - 1] : NaN;
      const c = gt(diffMA, prev) ? DIFF_UP : gt(diffMA, volumeMA / 2) ? DIFF_HIGH : DIFF_LOW;
      s.plots[2][i] = { time: t, value: 1, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeRsiMaDifferentialInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeRsiMaDifferentialInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeRsiMaDifferential = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
