/**
 * ADX-vALMA (N)
 *
 * ADX and DI lines smoothed with a volume-weighted ALMA (vALMA = alma(x * volume) / alma(volume), volume 1 when
 * missing). The +DM, -DM and true range are smoothed with vALMA ("Fast") or RMA ("Standard"); DI+ / DI- are the
 * smoothed DMs over the smoothed true range (x 100) and the ADX is the vALMA of DX. In "Normalized ADX" mode the ADX
 * is scaled to 0..100 between its lowest and highest values over the normalization lookback. The ADX is green when
 * it is not falling and red when it falls; the area between DI+ and DI- is green when DI+ is above. Triangles on the
 * price chart mark the DI crosses, shifted by the signal visual offset.
 *
 * Reference: "ADX-vALMA (N)" by Zomzi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { AlmaStep, createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ADXvALMAInputs {
  /** Lookback of the ADX and DI smoothing */
  len: number;
  /** ALMA offset (0..1) */
  offsetValma: number;
  /** ALMA sigma */
  sigma: number;
  /** Trend threshold line */
  th: number;
  /** Smoothing of +DM, -DM and true range: 'Fast' (vALMA) or 'Standard' (RMA) */
  smoothingMode: 'Fast' | 'Standard';
  /** Show the DI cross triangles on the price chart */
  showSignals: boolean;
  /** Bar shift of the signal triangles (negative: to the left) */
  visualOffset: number;
  adxMode: 'Standard ADX' | 'Normalized ADX';
  /** Lookback of the normalization (lowest / highest ADX) */
  normLen: number;
}

export const defaultInputs: ADXvALMAInputs = {
  len: 14,
  offsetValma: 0.7,
  sigma: 4.0,
  th: 22.5,
  smoothingMode: 'Fast',
  showSignals: true,
  visualOffset: -1,
  adxMode: 'Normalized ADX',
  normLen: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'offsetValma', type: 'float', title: 'ALMA Offset', defval: 0.7, step: 0.025 },
  { id: 'sigma', type: 'float', title: 'ALMA Sigma', defval: 4.0, step: 0.25 },
  { id: 'th', type: 'float', title: 'Trend Threshold', defval: 22.5 },
  { id: 'smoothingMode', type: 'string', title: 'DI Smoothing Mode', defval: 'Fast', options: ['Fast', 'Standard'] },
  { id: 'showSignals', type: 'bool', title: 'Show Signals on Main Chart', defval: true },
  { id: 'visualOffset', type: 'int', title: 'Signal Visual Offset', defval: -1, min: -10, max: 10 },
  { id: 'adxMode', type: 'string', title: 'ADX Mode', defval: 'Normalized ADX', options: ['Standard ADX', 'Normalized ADX'] },
  { id: 'normLen', type: 'int', title: 'Normalization Lookback', defval: 50, min: 1 },
];

const DI_PLUS_COL = color.rgb(4, 117, 0);
const DI_MINUS_COL = '#7e0000';
const ADX_UP = '#00ff15';
const ADX_DOWN = '#ff0000';
const FILL_UP = String(color.new('#00ff08', 90));
const FILL_DOWN = String(color.new('#ff0000', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI+', color: DI_PLUS_COL, lineWidth: 1 },
  { id: 'plot1', title: 'DI-', color: DI_MINUS_COL, lineWidth: 1 },
  { id: 'plot2', title: 'ADX Final', color: ADX_UP, lineWidth: 2 },
];

export const metadata = {
  title: 'ADX-vALMA (N)',
  shortTitle: 'ADX-vALMA (N)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Division: a 0 denominator here has a 0 numerator (0 / 0 is NaN in Pine too) or is kept >= 1e-10 by math.max */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);
/** Pine math.max: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ADXvALMARun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  rmas: ReturnType<typeof taStep.rma>[];
  lo: WindowExtreme;
  hi: WindowExtreme;
  /** ta.alma of vol, plusDM * vol, minusDM * vol, tr * vol, dx * vol */
  almaVol: AlmaStep;
  almaPlus: AlmaStep | null;
  almaMinus: AlmaStep | null;
  almaTR: AlmaStep | null;
  almaDx: AlmaStep;
  diPlus: number[];
  diMinus: number[];
  adxFinal: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
}

function study(inputs: Partial<ADXvALMAInputs>): BarStudy<ADXvALMARun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, offsetValma: off, sigma: sig } = cfg;
  const fast = cfg.smoothingMode === 'Fast';
  const normalized = cfg.adxMode === 'Normalized ADX';
  return {
    init() {
      const s: ADXvALMARun = {
        tr: taStep.tr(true), rmas: fast ? [] : [taStep.rma(len), taStep.rma(len), taStep.rma(len)],
        lo: new WindowExtreme(true, cfg.normLen), hi: new WindowExtreme(false, cfg.normLen),
        almaVol: new AlmaStep(len, off, sig), almaPlus: fast ? new AlmaStep(len, off, sig) : null,
        almaMinus: fast ? new AlmaStep(len, off, sig) : null, almaTR: fast ? new AlmaStep(len, off, sig) : null,
        almaDx: new AlmaStep(len, off, sig), diPlus: [], diMinus: [], adxFinal: [], plot0: [], plot1: [], plot2: [],
        fillColors: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.tr, ...s.rmas, ...(normalized ? [s.lo, s.hi] : []), s.almaVol, s.almaDx];
      if (fast) s.steps.push(s.almaPlus!, s.almaMinus!, s.almaTR!);
      s.series = [s.diPlus, s.diMinus, s.adxFinal, s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // valma(src) = ta.alma(src * vol, len, off, sig) / ta.alma(vol, len, off, sig), vol = nz(volume, 1)
      const vol = b.volume === undefined || b.volume === null || isNaN(b.volume) ? 1 : b.volume;
      const almaVol = s.almaVol.step(vol);
      const valma = (x: AlmaStep, value: number) => div(x.step(value * vol), almaVol);

      // DM and true range
      const up = i > 0 ? b.high - bars[i - 1].high : NaN;
      const down = i > 0 ? -(b.low - bars[i - 1].low) : NaN;
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const tr = s.tr.step(b.high, b.low, b.close);
      const sPlus = fast ? valma(s.almaPlus!, plusDM) : s.rmas[0].step(plusDM);
      const sMinus = fast ? valma(s.almaMinus!, minusDM) : s.rmas[1].step(minusDM);
      const sTR = fast ? valma(s.almaTR!, tr) : s.rmas[2].step(tr);

      const diPlus = div(sPlus, sTR) * 100;
      const diMinus = div(sMinus, sTR) * 100;
      s.diPlus[i] = diPlus;
      s.diMinus[i] = diMinus;
      const dx = div(Math.abs(diPlus - diMinus), max(diPlus + diMinus, 1e-10)) * 100;
      const adxRaw = valma(s.almaDx, dx);
      let adxFinal = adxRaw;
      if (normalized) {
        // normalize(src, length) = 100 * (src - ta.lowest(src, length)) / math.max(highest - lowest, 1e-10)
        const lo = s.lo.step(adxRaw);
        const hi = s.hi.step(adxRaw);
        adxFinal = div(100 * (adxRaw - lo), max(hi - lo, 1e-10));
      }
      s.adxFinal[i] = adxFinal;

      const time = b.time;
      s.plot0[i] = { time, value: diPlus, color: DI_PLUS_COL };
      s.plot1[i] = { time, value: diMinus, color: DI_MINUS_COL };
      // kolorADX = adx_final >= adx_final[1] ? #00ff15 : #ff0000
      s.plot2[i] = { time, value: adxFinal, color: i > 0 && ge(adxFinal, s.adxFinal[i - 1]) ? ADX_UP : ADX_DOWN };
      // fill(plotPlus, plotMinus, color = diPlus > diMinus ? color.new(#00ff08, 90) : color.new(#ff0000, 90))
      s.fillColors[i] = gt(diPlus, diMinus) ? FILL_UP : FILL_DOWN;
    },
    result(s, bars) {
      const n = bars.length;
      const { diPlus, diMinus } = s;
      // the markers from the per-bar values: their time follows the bar count when the offset is after the last bar
      const markers: MarkerData[] = [];
      if (cfg.showSignals) {
        const interval = barInterval(bars);
        for (let i = 1; i < n; i++) {
          // plotshape(..., offset = visualOffset, force_overlay = true): the signal of bar i is drawn on bar i + offset
          const j = i + cfg.visualOffset;
          if (j < 0) continue;
          const t = barTime(bars, j, interval);
          // ta.crossover(diPlus, diMinus) (exact comparisons, no tolerance): triangle up below the bar, color.green,
          // size.small
          if (diPlus[i] > diMinus[i] && diPlus[i - 1] <= diMinus[i - 1]) {
            markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small', forceOverlay: true });
          }
          // ta.crossunder(diPlus, diMinus) (exact comparisons): triangle down above the bar, color.red, size.small
          if (diPlus[i] < diMinus[i] && diPlus[i - 1] >= diMinus[i - 1]) {
            markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small', forceOverlay: true });
          }
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: cfg.th, options: { title: 'Threshold Line', color: String(color.new(color.gray, 50)), linestyle: 'dashed' } },
          { value: 100, options: { title: 'Upper Bound', color: String(color.new(color.red, 80)), linestyle: 'dashed' } },
          { value: 0, options: { title: 'Lower Bound', color: String(color.new(color.green, 80)), linestyle: 'dashed' } },
        ],
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        markers,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ADXvALMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ADXvALMAInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ADXvALMA = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
