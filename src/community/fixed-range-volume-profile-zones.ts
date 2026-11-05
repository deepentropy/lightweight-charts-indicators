/**
 * Fixed-Range Volume-Profile Zones
 *
 * A volume profile of the closes of the last `Lookback Days` bars: the close range is cut into `Number of Bins`
 * equal bins and each bar adds its volume to the bin of its close. The bins with volume, in price order (position j),
 * get zone = j / ceil(count / 3), a fractional quotient: VAL is the centre of the bin with zone 0 (the lowest bin),
 * POC the centre of the bin with zone 1, VAH the centre of the last bin with zone 2 or above (the lines keep their
 * value when fewer than 3 bins have volume or no bin has that zone). The window low / high are drawn (transparent)
 * for fills to VAL / VAH. Triangles mark closes above the VAH percentile price or below the VAL percentile price of the window, and
 * candles are coloured by the direction of the previous close change.
 *
 * Reference: "Fixed-Range Volume-Profile Zones" by RWCS_LTD
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RWCS_LTD
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FixedRangeVolumeProfileZonesInputs {
  /** Number of bars in the profile window */
  lookbackDays: number;
  /** Number of price bins */
  numBins: number;
  /** Upper percentile of the window closes for the VAH buffer */
  percentileUpper: number;
  /** Lower percentile of the window closes for the VAL buffer */
  percentileLower: number;
}

export const defaultInputs: FixedRangeVolumeProfileZonesInputs = {
  lookbackDays: 30,
  numBins: 30,
  percentileUpper: 95.0,
  percentileLower: 5.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackDays', type: 'int', title: 'Lookback Days', defval: 30, min: 1 },
  { id: 'numBins', type: 'int', title: 'Number of Bins', defval: 30, min: 5 },
  { id: 'percentileUpper', type: 'float', title: 'VAH Percentile', defval: 95.0, min: 50.0, max: 100.0, step: 0.1 },
  { id: 'percentileLower', type: 'float', title: 'VAL Percentile', defval: 5.0, min: 0.0, max: 50.0, step: 0.1 },
];

const MIN_COL = String(color.new(color.green, 100));
const MAX_COL = String(color.new(color.red, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VAL', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'VAH', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'POC', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'Min Price', color: MIN_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Max Price', color: MAX_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Fixed Range Volume Profile Zones (with Dynamic Percentile Buffers)',
  shortTitle: 'Fixed Range Volume Profile Zones (with Dynamic Percentile Buffers)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** plotcandle without bordercolor: the style default of the plot (no colorer) */
const CANDLE_BORDER = '#000000';

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface ZonesVars {
  /** var float VAL = na, VAH, POC */
  VAL: number;
  VAH: number;
  POC: number;
}

interface ZonesRun extends BarRunState<ZonesVars> {
  plots: Point[][];
  candles: PlotCandleData[];
  markers: MarkerData[];
}

function study(inputs: Partial<FixedRangeVolumeProfileZonesInputs>): BarStudy<ZonesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lookbackDays, numBins, percentileUpper, percentileLower } = cfg;
  // the closes / volumes of the last lookbackDays bars (array.push / array.shift of the original), filled on each bar
  const closes: number[] = [];
  const vols: number[] = [];
  const noCandle = String(color.new(color.black, 100));
  return {
    init() {
      const s: ZonesRun = {
        plots: Array.from({ length: 5 }, () => []), candles: [], markers: [],
        steps: [], vars: { VAL: NaN, VAH: NaN, POC: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [...s.plots, s.candles];
      return s;
    },
    bar(s, k, bars) {
      const v = s.vars;
      let VAL = v.VAL;
      let VAH = v.VAH;
      let POC = v.POC;
      const from = Math.max(0, k - lookbackDays + 1);
      closes.length = 0;
      vols.length = 0;
      for (let j = from; j <= k; j++) {
        closes.push(bars[j].close);
        vols.push(bars[j].volume ?? NaN);
      }
      let pminV = NaN;
      let pmaxV = NaN;

      if (closes.length >= lookbackDays) {
        // Binning (array.min / array.max of the window)
        let pmin = Infinity;
        let pmax = -Infinity;
        for (let i = 0; i < closes.length; i++) {
          pmin = Math.min(pmin, closes[i]);
          pmax = Math.max(pmax, closes[i]);
        }
        const prange = pmax - pmin;
        const binWidth = gt(prange, 0) ? prange / numBins : 1.0;
        const binVol: number[] = new Array(numBins).fill(0.0);
        const binCenter: number[] = new Array(numBins).fill(0.0);
        for (let i = 0; i < numBins; i++) {
          const left = pmin + i * binWidth;
          const right = left + binWidth;
          binCenter[i] = (left + right) / 2;
        }
        for (let i = 0; i < closes.length; i++) {
          const binIndex = Math.min(numBins - 1, Math.max(0, Math.floor((closes[i] - pmin) / binWidth)));
          binVol[binIndex] = binVol[binIndex] + vols[i];
        }
        // Non-zero bins
        const nzCenter: number[] = [];
        const nzVol: number[] = [];
        for (let i = 0; i < numBins; i++) {
          const bv = binVol[i];
          if (gt(bv, 0)) {
            nzCenter.push(binCenter[i]);
            nzVol.push(bv);
          }
        }
        if (nzCenter.length >= 3) {
          const nz = nzCenter.length;
          const idx = nzCenter.map((_c, i) => i);
          // Selection sort of idx by nz_center
          for (let i = 0; i <= nz - 2; i++) {
            let minIdx = i;
            for (let j = i + 1; j <= nz - 1; j++) {
              if (lt(nzCenter[idx[j]], nzCenter[idx[minIdx]])) minIdx = j;
            }
            if (i !== minIdx) {
              const tmp = idx[i];
              idx[i] = idx[minIdx];
              idx[minIdx] = tmp;
            }
          }
          const zoneSize = Math.ceil(nz / 3);
          let maxVol = -1.0;
          for (let j = 0; j < nz; j++) {
            const bin = idx[j];
            const center = nzCenter[bin];
            const vol = nzVol[bin];
            // int zone = j / zone_size: Pine keeps the fractional quotient (observed values: a truncated zone gives
            // other VAL / POC values)
            let zone = j / zoneSize;
            if (gt(zone, 2)) zone = 2;
            if (zone === 0) VAL = center;
            if (zone === 2) VAH = center;
            if (zone === 1 && gt(vol, maxVol)) {
              maxVol = vol;
              POC = center;
            }
          }
        }
        pminV = pmin;
        pmaxV = pmax;
      }
      v.VAL = VAL;
      v.VAH = VAH;
      v.POC = POC;

      // Dynamic percentile buffers
      const sorted = closes.sort((a, b) => a - b);
      const m = sorted.length;
      const idxUp = Math.max(0, Math.min(Math.round((m * percentileUpper) / 100) - 1, m - 1));
      const idxLo = Math.max(0, Math.min(Math.round((m * percentileLower) / 100) - 1, m - 1));
      const pctUp = sorted[idxUp];
      const pctLo = sorted[idxLo];
      const vahBuf = pctUp - VAH;
      const valBuf = VAL - pctLo;

      const b = bars[k];
      const time = b.time;
      s.plots[0][k] = { time, value: VAL, color: color.green };
      s.plots[1][k] = { time, value: VAH, color: color.orange };
      s.plots[2][k] = { time, value: POC, color: color.red };
      s.plots[3][k] = { time, value: pminV, color: MIN_COL };
      s.plots[4][k] = { time, value: pmaxV, color: MAX_COL };

      // plotcandle(open, high, low, close, 'Price Action', close[2] < close[1] ? aqua : close[2] > close[1] ? fuchsia
      //   : color.new(color.black, 100), color.white)
      const c2 = k >= 2 ? bars[k - 2].close : NaN;
      const c1 = k >= 1 ? bars[k - 1].close : NaN;
      const col = lt(c2, c1) ? color.aqua : gt(c2, c1) ? color.fuchsia : noCandle;
      s.candles[k] = { time, open: b.open, high: b.high, low: b.low, close: b.close, color: col,
        wickColor: color.white, borderColor: CANDLE_BORDER };

      const c = b.close;
      if (gt(c, VAH + vahBuf) && !isNaN(VAH)) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      if (lt(c, VAL - valBuf) && !isNaN(VAL)) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
    },
    result(s, bars) {
      const n = bars.length;
      // fill(plot_val, plot_pmin, color.new(color.green, 90)), fill(plot_vah, plot_pmax, color.new(color.red, 90))
      const fills = [
        { plot1: 'plot0', plot2: 'plot3', colors: new Array(n).fill(String(color.new(color.green, 90))) },
        { plot1: 'plot1', plot2: 'plot4', colors: new Array(n).fill(String(color.new(color.red, 90))) },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        fills,
        markers: s.markers.slice(),
        plotCandles: { priceAction: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FixedRangeVolumeProfileZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FixedRangeVolumeProfileZonesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FixedRangeVolumeProfileZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
