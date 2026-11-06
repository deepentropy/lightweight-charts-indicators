/**
 * Volume Candle Coloring v5 (BARCOLOR STABLE)
 *
 * Colours the price bars by the ratio of the volume to its SMA and by the bar direction (close >= open is bullish).
 * Volume levels: low (below lowMult x SMA), normal (to midMult), high (to highMult), extreme (to ultraMult) and
 * ultra (from ultraMult). Bullish: green 70 % transparent, green 40 %, green, lime, aqua. Bearish: red 70 %, red 40 %,
 * red, orange, fuchsia. Gray when the SMA is not available. The volume is a hidden plot.
 *
 * Reference: "Volume Candle Coloring v5 (BARCOLOR STABLE)" by sugogou
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeCandleColoringV5Inputs {
  /** Volume SMA length */
  volLength: number;
  /** Low volume: below this multiple of the SMA */
  lowMult: number;
  /** High volume: from this multiple */
  midMult: number;
  /** Extreme volume: from this multiple */
  highMult: number;
  /** Ultra volume: from this multiple */
  ultraMult: number;
}

export const defaultInputs: VolumeCandleColoringV5Inputs = {
  volLength: 20,
  lowMult: 0.7,
  midMult: 1.5,
  highMult: 2.5,
  ultraMult: 4.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'volLength', type: 'int', title: 'Période moyenne volume', defval: 20 },
  { id: 'lowMult', type: 'float', title: 'Volume faible', defval: 0.7 },
  { id: 'midMult', type: 'float', title: 'Volume fort', defval: 1.5 },
  { id: 'highMult', type: 'float', title: 'Volume extrême', defval: 2.5 },
  { id: 'ultraMult', type: 'float', title: 'Volume ULTRA', defval: 4.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Volume Candle Coloring v5 (BARCOLOR STABLE)',
  shortTitle: 'Volume Candle Coloring v5 (BARCOLOR STABLE)',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = IndicatorResult & { barColors: BarColorData[] };

interface VccRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: { time: number; value: number }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VolumeCandleColoringV5Inputs>): BarStudy<VccRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullCols = [color.aqua, color.lime, color.green, String(color.new(color.green, 40)), String(color.new(color.green, 70))];
  const bearCols = [color.fuchsia, color.orange, color.red, String(color.new(color.red, 40)), String(color.new(color.red, 70))];
  return {
    init() {
      const sma = new WindowSma(cfg.volLength);
      const s: VccRun = { sma, plot0: [], barColors: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = b.volume ?? NaN;
      const ma = s.sma.step(v);
      const volLow = lt(v, ma * cfg.lowMult);
      const volNormal = ge(v, ma * cfg.lowMult) && lt(v, ma * cfg.midMult);
      const volHigh = ge(v, ma * cfg.midMult) && lt(v, ma * cfg.highMult);
      const volExtreme = ge(v, ma * cfg.highMult) && lt(v, ma * cfg.ultraMult);
      const volUltra = ge(v, ma * cfg.ultraMult);
      const bull = ge(b.close, b.open);
      const bear = lt(b.close, b.open);
      // Levels in the Pine order: ultra, extreme, high, normal, low
      const level = [volUltra, volExtreme, volHigh, volNormal, volLow].indexOf(true);
      const c = level >= 0 && bull ? bullCols[level] : level >= 0 && bear ? bearCols[level] : color.gray;
      s.barColors[i] = { time: b.time, color: c };
      // plot(volume, display = display.none)
      s.plot0[i] = { time: b.time, value: v };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
        },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeCandleColoringV5Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeCandleColoringV5Inputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeCandleColoringV5 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
