/**
 * E9 Bollinger Range
 *
 * EMA 20 and EMA 150 of the close, and Bollinger-type bands: a basis MA (SMA / EMA / RMA / WMA / VWMA) of the
 * source with four pairs of bands at basis +- stdev * 1 / 2 / 3 / 3.5. Optional trend bar colours (close above /
 * below the basis) and white triangles when the close crosses the basis.
 *
 * Reference: "E9 Bollinger Range" by E9XBT
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type BasisMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface E9BollingerRangeInputs {
  /** Basis MA and standard deviation length */
  length: number;
  /** Basis MA type */
  maType: BasisMaType;
  src: SourceType;
  /** Plot offset of the basis and of the bands */
  offset: number;
  /** Colour the price bars by trend */
  showHB: boolean;
  colTrndUp: string;
  colTrndDn: string;
  /** Standard deviation multipliers of the four band pairs */
  mult: number;
  mult1: number;
  mult2: number;
  mult3: number;
}

export const defaultInputs: E9BollingerRangeInputs = {
  length: 40,
  maType: 'EMA',
  src: 'ohlc4',
  offset: 0,
  showHB: false,
  colTrndUp: '#97ff9c',
  colTrndDn: 'rgb(250, 86, 143)',
  mult: 1.0,
  mult1: 2.0,
  mult2: 3.0,
  mult3: 3.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 40, min: 1 },
  { id: 'maType', type: 'string', title: 'Basis MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'showHB', type: 'bool', title: 'Show Highlight Price Bars', defval: false },
  { id: 'colTrndUp', type: 'color', title: 'Trend Up', defval: '#97ff9c' },
  { id: 'colTrndDn', type: 'color', title: 'Trend Down', defval: 'rgb(250, 86, 143)' },
  { id: 'mult', type: 'float', title: 'StdDev Bands 1', defval: 1.0, min: 0.001, max: 50 },
  { id: 'mult1', type: 'float', title: 'StdDev Bands 2', defval: 2.0, min: 0.001, max: 50 },
  { id: 'mult2', type: 'float', title: 'StdDev Bands 3', defval: 3.0, min: 0.001, max: 50 },
  { id: 'mult3', type: 'float', title: 'StdDev Bands 4', defval: 3.5, min: 0.001, max: 50 },
];

const UPPER1 = String(color.rgb(246, 125, 135, 100));
const LOWER1 = String(color.rgb(165, 249, 135, 77));
const UPPER2 = String(color.rgb(246, 125, 135, 77));
const LOWER2 = String(color.rgb(165, 249, 135, 83));
const UPPER3 = '#f67d8723';
const LOWER3 = '#a5f98728';
const UPPER4 = '#f67d874a';
const LOWER4 = '#a5f98725';
const BASIS = String(color.rgb(255, 255, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA1', color: '#6e65eb', lineWidth: 3 },
  { id: 'plot1', title: 'EMA2', color: color.red, lineWidth: 3 },
  { id: 'plot2', title: 'Basis', color: BASIS, lineWidth: 1 },
  { id: 'plot3', title: 'Upper', color: UPPER1, lineWidth: 1 },
  { id: 'plot4', title: 'Lower', color: LOWER1, lineWidth: 1 },
  { id: 'plot5', title: 'Upper', color: UPPER2, lineWidth: 1 },
  { id: 'plot6', title: 'Lower', color: LOWER2, lineWidth: 1 },
  { id: 'plot7', title: 'Upper', color: UPPER3, lineWidth: 1 },
  { id: 'plot8', title: 'Lower', color: LOWER3, lineWidth: 1 },
  { id: 'plot9', title: 'Upper', color: UPPER4, lineWidth: 2 },
  { id: 'plot10', title: 'Lower', color: LOWER4, lineWidth: 2 },
];

export const metadata = {
  title: 'E9 Bollinger Range',
  shortTitle: 'E9 BRange',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface E9Run extends BarRunState<Record<string, never>> {
  ema1: Committable & { step(v: number): number };
  ema2: Committable & { step(v: number): number };
  ma: Ma;
  dev: WindowStdev;
  up: ReturnType<typeof taStep.crossover>;
  dn: ReturnType<typeof taStep.crossunder>;
  basis: number[];
  sd: number[];
  plot0: Point[];
  plot1: Point[];
  /** The basis and bands of each bar (offset 0 only: else built from basis / sd in result) */
  bands: Point[][];
  barColors: BarColorData[];
  markers: MarkerData[];
}

const BAND_COLORS = [BASIS, UPPER1, LOWER1, UPPER2, LOWER2, UPPER3, LOWER3, UPPER4, LOWER4];

function study(inputs: Partial<E9BollingerRangeInputs>): BarStudy<E9Run, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const mults = [cfg.mult, cfg.mult, cfg.mult1, cfg.mult1, cfg.mult2, cfg.mult2, cfg.mult3, cfg.mult3];
  const band = (k: number, basis: number, sd: number): number =>
    k === 0 ? basis : basis + (k % 2 === 1 ? 1 : -1) * (mults[k - 1]! * sd);
  const maStep = (): Ma => {
    const len = cfg.length;
    switch (cfg.maType) {
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(len);
      default: { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const ema1 = taStep.ema(20);
      const ema2 = taStep.ema(150);
      const ma = maStep();
      const dev = new WindowStdev(cfg.length);
      const up = taStep.crossover();
      const dn = taStep.crossunder();
      const s: E9Run = {
        ema1, ema2, ma, dev, up, dn, basis: [], sd: [], plot0: [], plot1: [], bands: BAND_COLORS.map(() => []),
        barColors: [], markers: [], steps: [ema1, ema2, ma, dev, up, dn], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, s.markers];
      s.series = [s.basis, s.sd, s.plot0, s.plot1, ...(cfg.offset === 0 ? s.bands : [])];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const c = b.close;
      s.plot0[i] = { time: t, value: s.ema1.step(c), color: '#6e65eb' };
      s.plot1[i] = { time: t, value: s.ema2.step(c), color: color.red };
      const v = value(b);
      const basis = s.ma.step(v, b.volume ?? NaN);
      const sd = s.dev.step(v);
      s.basis[i] = basis;
      s.sd[i] = sd;
      if (cfg.offset === 0) {
        for (let k = 0; k < 9; k++) {
          const x = band(k, basis, sd);
          s.bands[k]![i] = { time: t, value: Number.isFinite(x) ? x : NaN, color: BAND_COLORS[k]! };
        }
      }
      const crossUp = s.up.step(c, basis);
      const crossDn = s.dn.step(c, basis);
      // barcolor(show_HB ? (trend_up ? col_trnd_Up : trend_dn ? col_trnd_Dn : na) : na)
      if (cfg.showHB) {
        const col = gt(c, basis) ? cfg.colTrndUp : lt(c, basis) ? cfg.colTrndDn : null;
        if (col) s.barColors.push({ time: t, color: col });
      }
      if (crossUp) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.white, size: 'tiny' });
      if (crossDn) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.white, size: 'tiny' });
    },
    result(s, bars) {
      const n = bars.length;
      let bands: Point[][];
      if (cfg.offset === 0) {
        bands = s.bands.map((p) => p.slice());
      } else {
        // plot(..., offset = offset): the value of bar i is drawn on bar i + offset (none before bar 0)
        const interval = barInterval(bars);
        bands = BAND_COLORS.map((col, k) => {
          const out: Point[] = [];
          for (let i = 0; i < n; i++) {
            const j = i + cfg.offset;
            if (j < 0) continue;
            const x = band(k, s.basis[i]!, s.sd[i]!);
            out.push({ time: barTime(bars, j, interval), value: Number.isFinite(x) ? x : NaN, color: col });
          }
          return out;
        });
      }
      const plots: Record<string, Point[]> = { plot0: s.plot0.slice(), plot1: s.plot1.slice() };
      bands.forEach((p, k) => { plots[`plot${k + 2}`] = p; });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<E9BollingerRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<E9BollingerRangeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const E9BollingerRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
