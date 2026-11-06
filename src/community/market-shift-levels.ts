/**
 * Market Shift Levels [ChartPrime]
 *
 * Detect market structure shifts using HMA crossovers.
 * Plots shift level, colored candles, bar colors, and reversal labels.
 *
 * The level line of the original has the chart foreground colour on every second bar and no colour on the others.
 * With a foreground colour in the optional third argument (see src/chart-context.ts) the port does the same. Without
 * it the line keeps one fixed grey (#787B86) on every bar.
 *
 * Reference: "Market Shift Levels [ChartPrime]" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData, PlotCandleData, LabelData } from '../types';
import { foregroundColorOf, type ChartContext } from '../chart-context';

export interface MarketShiftLevelsInputs {
  length: number;
  labelData: 'Volume' | 'Price';
}

export const defaultInputs: MarketShiftLevelsInputs = {
  length: 55,
  labelData: 'Volume',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 55, min: 1 },
  { id: 'labelData', type: 'string', title: 'Label Data', defval: 'Volume', options: ['Volume', 'Price'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Market Shift Level', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'Market Shift Levels',
  shortTitle: 'MSL',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>; labels: LabelData[] };

interface MslVars {
  /** level tracks the shift level */
  level: number;
}

interface MslRun extends BarRunState<MslVars> {
  hma: ReturnType<typeof taStep.hma>;
  fgColor: string | undefined;
  hmaArr: number[];
  levelArr: number[];
  shiftPlot: Point[];
  barColors: BarColorData[];
  candles: PlotCandleData[];
  labels: LabelData[];
}

function study(inputs: Partial<MarketShiftLevelsInputs>): BarStudy<MslRun, Result> {
  const { length, labelData } = { ...defaultInputs, ...inputs };
  const useLblVol = labelData === 'Volume';
  const warmup = length + 5;
  return {
    init(_bars, chart) {
      // Pine: hma1 = ta.hma(close, length), hma2 = hma1[5]
      const hma = taStep.hma(length);
      // color = bar_index % 2 == 0 ? na : chart.fg_color (alternating visibility): only with the foreground colour of
      // the chart context; without it the points carry no colour (the fixed colour of plotConfig)
      const fgColor = chart?.foregroundColor !== undefined ? foregroundColorOf(chart) : undefined;
      const s: MslRun = {
        hma, fgColor, hmaArr: [], levelArr: [], shiftPlot: [], barColors: [], candles: [], labels: [],
        steps: [hma], vars: { level: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.candles, s.labels];
      s.series = [s.hmaArr, s.levelArr, s.shiftPlot];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const hmaArr = s.hmaArr;
      hmaArr[i] = s.hma.step(bars[i].close);
      if (i < warmup || hmaArr[i] == null) {
        s.levelArr[i] = NaN;
      } else {
        const hma1 = hmaArr[i]!;
        const hma2 = i >= 5 ? (hmaArr[i - 5] ?? NaN) : NaN;

        if (!isNaN(hma2)) {
          // Pine: crossover(hma1, hma2) => level := low
          const prevHma1 = hmaArr[i - 1] ?? NaN;
          const prevHma2 = i >= 6 ? (hmaArr[i - 6] ?? NaN) : NaN;
          if (!isNaN(prevHma1) && !isNaN(prevHma2)) {
            if (prevHma1 <= prevHma2 && hma1 > hma2) {
              v.level = bars[i].low;
            }
            if (prevHma1 >= prevHma2 && hma1 < hma2) {
              v.level = bars[i].high;
            }
          }
        }
        s.levelArr[i] = v.level;
      }

      // Pine: plot(level != level[1] ? na : level, ..., style=plot.style_linebr)
      const lvl = s.levelArr[i];
      const prevLvl = i > 0 ? s.levelArr[i - 1] : NaN;
      const pointColor = s.fgColor !== undefined ? { color: i % 2 === 0 ? 'transparent' : s.fgColor } : {};
      if (isNaN(lvl) || lvl !== prevLvl) {
        s.shiftPlot[i] = { time: bars[i].time, value: NaN, ...pointColor };
      } else {
        s.shiftPlot[i] = { time: bars[i].time, value: lvl, ...pointColor };
      }

      if (isNaN(lvl)) return;
      // Pine barcolor(shift_col): close < level => red, close >= level => green
      // Pine plotcandle colored by shift_col
      if (i >= warmup) {
        const color = bars[i].close < lvl ? '#E12B2B' : '#24D580';
        s.barColors.push({ time: bars[i].time, color });
        s.candles.push({
          time: bars[i].time,
          open: bars[i].open,
          high: bars[i].high,
          low: bars[i].low,
          close: bars[i].close,
          color,
          borderColor: color,
          wickColor: color,
        });
      }

      // Reversal detection labels
      // Pine: if high[2] < level and high < level and high[1] > level => label down at bar_index-1
      // Pine: if low[2] > level and low[1] < level and low > level => label up at bar_index-1
      if (i < 2) return;
      const volSum = (bars[i].volume ?? 0) + (i >= 1 ? (bars[i - 1].volume ?? 0) : 0) + (i >= 2 ? (bars[i - 2].volume ?? 0) : 0);

      // Bearish reversal: wick above level then rejected
      if (bars[i - 2].high < lvl && bars[i].high < lvl && bars[i - 1].high > lvl) {
        const labelText = useLblVol
          ? formatVolume(volSum) + '\n⬙'
          : bars[i - 1].high.toFixed(2) + '\n⬙';
        s.labels.push({
          time: bars[i - 1].time,
          price: bars[i - 1].high,
          text: labelText,
          textColor: '#FF0000',
          color: 'transparent',
          style: 'label_down',
        });
      }

      // Bullish reversal: wick below level then recovered
      if (bars[i - 2].low > lvl && bars[i - 1].low < lvl && bars[i].low > lvl) {
        const labelText = '⬘\n' + (useLblVol
          ? formatVolume(volSum)
          : bars[i - 1].high.toFixed(2));
        s.labels.push({
          time: bars[i - 1].time,
          price: bars[i - 1].low,
          text: labelText,
          textColor: '#00FF00',
          color: 'transparent',
          style: 'label_up',
        });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.shiftPlot.slice() },
        barColors: s.barColors.slice(),
        plotCandles: { candle0: s.candles.slice() },
        labels: s.labels.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketShiftLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketShiftLevelsInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}

export const MarketShiftLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
