/**
 * Madrid Moving Average Ribbon
 *
 * Twenty moving averages (5 through 100, step 5) creating a ribbon.
 * Supports SMA and EMA types. Colors based on direction and position vs MA 100 reference.
 * Lime=uptrend, Green=reentry, Red=downtrend, Maroon=reversal warning.
 *
 * Reference: "Madrid Moving Average Ribbon"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MadridMaRibbonInputs {
  maType: string;
  src: SourceType;
}

export const defaultInputs: MadridMaRibbonInputs = {
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['sma', 'ema'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const lengths = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
// Gradient from bright green (fast) to dark red (slow)
const colors = [
  '#64DD17', '#76FF03', '#AEEA00', '#C6FF00', '#FFD600',
  '#FFAB00', '#FF6D00', '#FF3D00', '#DD2C00', '#B71C1C',
  '#880E4F', '#AD1457', '#C62828', '#D32F2F', '#E53935',
  '#F44336', '#EF5350', '#E57373', '#D50000', '#B71C1C',
];

export const plotConfig: PlotConfig[] = lengths.map((len, idx) => ({
  id: `plot${idx}`,
  title: `MA ${len}`,
  color: colors[idx],
  lineWidth: idx === 0 || idx === 19 ? 3 : 1,
}));

export const metadata = {
  title: 'Madrid MA Ribbon',
  shortTitle: 'MAR',
  overlay: true,
};

// Pine maColor: lime if rising AND above ma100, maroon if falling AND above ma100,
// red if falling AND below ma100, green if rising AND below ma100, gray otherwise
function maColor(maVal: number, prevMaVal: number, ma100Val: number): string {
  const diff = maVal - prevMaVal;
  if (diff >= 0 && maVal > ma100Val) return '#00FF00'; // LIME
  if (diff < 0 && maVal > ma100Val) return '#800000';  // MAROON
  if (diff <= 0 && maVal < ma100Val) return '#FF0000';  // RED (RUBI)
  if (diff >= 0 && maVal < ma100Val) return '#008000';  // GREEN
  return '#808080'; // GRAY
}

type Point = { time: number; value: number; color?: string };

interface MadridRun extends BarRunState<Record<string, never>> {
  mas: Array<{ step(v: number): number; commit(): void }>;
  /** The MA values per bar */
  values: number[][];
  plots: Point[][];
}

function study(inputs: Partial<MadridMaRibbonInputs>): BarStudy<MadridRun, IndicatorResult> {
  const { maType, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = lengths[lengths.length - 1]; // 100
  const last = lengths.length - 1;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // maFn = ta.ema or ta.sma; the ma100 reference of the colours is the MA of length 100 (the last one)
      const mas = lengths.map((len) => (maType === 'ema' ? taStep.ema(len) : new WindowSma(len)));
      const s: MadridRun = {
        mas,
        values: lengths.map(() => []),
        plots: lengths.map(() => []),
        steps: mas, vars: {}, lists: [], series: [],
      };
      s.series = [...s.values, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const x = value(bars[i]);
      for (let idx = 0; idx < lengths.length; idx++) s.values[idx]![i] = s.mas[idx]!.step(x);
      const ref = s.values[last]![i]!;
      for (let idx = 0; idx < lengths.length; idx++) {
        const arr = s.values[idx]!;
        const v = arr[i]!;
        if (i < warmup) {
          s.plots[idx]![i] = { time, value: NaN };
          continue;
        }
        const prev = i > 0 ? arr[i - 1]! : v;
        s.plots[idx]![i] = { time, value: v, color: maColor(v, prev, ref) };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (let idx = 0; idx < lengths.length; idx++) plots[`plot${idx}`] = s.plots[idx]!.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MadridMaRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MadridMaRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MadridMaRibbon = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
