/**
 * Filter Wave
 *
 * Trend score of a linear regression line: over the last `n` regression values, every pair (newer, older) adds +1
 * when the newer value is higher, -1 when it is lower. The state is bullish when the score is above the tolerance
 * (Range Tolerance % of the pair count), bearish below its negative. The intensity |score| / pair count, smoothed by
 * three SMA(3), shifts a wave above the close by intensity * ATR(14) * 0.5 and a floor by intensity * ATR(14) * 0.1;
 * both lines and the fill between them take the bull / bear colour (less transparent with a higher intensity), grey
 * in the neutral state.
 *
 * Reference: "Filter Wave" by c9indicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FilterWaveInputs {
  /** Number of regression values compared pair by pair */
  n: number;
  /** Range tolerance (%) of the pair count */
  p: number;
  /** Regression source */
  src: SourceType;
  /** Linear regression length */
  lrLen: number;
  colBull: string;
  colBear: string;
}

export const defaultInputs: FilterWaveInputs = {
  n: 12,
  p: 90,
  src: 'close',
  lrLen: 90,
  colBull: '#00ffbb',
  colBear: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Lookback Period', defval: 12 },
  { id: 'p', type: 'int', title: 'Range Tolerance (%)', defval: 90, min: 0, max: 100 },
  { id: 'src', type: 'source', title: 'Regression Source', defval: 'close' },
  { id: 'lrLen', type: 'int', title: 'Linear Regression Length', defval: 90 },
  { id: 'colBull', type: 'color', title: 'Bull Color', defval: '#00ffbb' },
  { id: 'colBear', type: 'color', title: 'Bear Color', defval: '#ff1100' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Wave', color: '#00ffbb', lineWidth: 3 },
  { id: 'plot1', title: 'Wave Floor', color: '#00ffbb', lineWidth: 1 },
];

export const metadata = {
  title: 'Filter Wave',
  shortTitle: 'Filter Wave',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine `for i = a to b`: counts up, or down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

type Point = { time: number; value: number; color: string };

interface FilterWaveRun extends BarRunState<Record<string, never>> {
  linreg: ReturnType<typeof taStep.linreg>;
  sma1: ReturnType<typeof taStep.sma>;
  sma2: ReturnType<typeof taStep.sma>;
  sma3: ReturnType<typeof taStep.sma>;
  atr: ReturnType<typeof taStep.atr>;
  lr: number[];
  wave: Point[];
  floor: Point[];
  fill: string[];
}

function study(inputs: Partial<FilterWaveInputs>): BarStudy<FilterWaveRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { n, p } = cfg;
  const value = barSource(cfg.src);
  // total_pairs = (n * (n - 1)) / 2 and p / 100 are fractional divisions in Pine v6
  const totalPairs = (n * (n - 1)) / 2;
  const threshold = totalPairs * (p / 100);
  // the (i, j) pairs of the two loops, in their order
  const pairs: number[] = [];
  for (const i of pineRange(0, n - 2)) for (const j of pineRange(i + 1, n - 1)) pairs.push(i, j);
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const linreg = taStep.linreg(cfg.lrLen, 0);
      const sma1 = taStep.sma();
      const sma2 = taStep.sma();
      const sma3 = taStep.sma();
      const atr = taStep.atr(14);
      const s: FilterWaveRun = {
        linreg, sma1, sma2, sma3, atr, lr: [], wave: [], floor: [], fill: [],
        steps: [linreg, sma1, sma2, sma3, atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.lr, s.wave, s.floor, s.fill];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const { lr } = s;
      lr[b] = s.linreg.step(value(bar));
      const lrAt = (k: number) => {
        if (k < 0) throw new Error(`Invalid number of bars back: ${k}`);
        return b - k >= 0 ? lr[b - k] : NaN;
      };
      let trend = 0;
      for (let q = 0; q < pairs.length; q += 2) {
        const a = lrAt(pairs[q]);
        const c = lrAt(pairs[q + 1]);
        trend += gt(a, c) ? 1 : lt(a, c) ? -1 : 0;
      }
      const state = gt(trend, threshold) ? 1 : lt(trend, -threshold) ? -1 : 0;
      const intensity = Math.abs(trend) / totalPairs;

      const smooth1 = s.sma1.step(intensity, 3);
      const smooth2 = s.sma2.step(smooth1, 3);
      const smooth3 = s.sma3.step(smooth2, 3);
      const atr = s.atr.step(bar.high, bar.low, bar.close);

      // alpha = 90 - int(intensity * 70)
      const alpha = 90 - Math.trunc(intensity * 70);
      const waveColor = state === 1 ? color.new(cfg.colBull, alpha)
        : state === -1 ? color.new(cfg.colBear, alpha)
          : color.new(color.gray, 80);
      // wave = close + smooth3 * ta.atr(14) * 0.5
      s.wave[b] = { time: bar.time, value: finite(bar.close + smooth3 * atr * 0.5), color: String(waveColor) };
      // wave_floor = close + smooth3 * ta.atr(14) * 0.1, colour color.new(wave_color, 90)
      s.floor[b] = { time: bar.time, value: finite(bar.close + smooth3 * atr * 0.1), color: String(color.new(waveColor, 90)) };
      // fill(p1, p2, color.new(wave_color, 85))
      s.fill[b] = String(color.new(waveColor, 85));
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.wave.slice(), plot1: s.floor.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fill.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FilterWaveInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FilterWaveInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FilterWave = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
