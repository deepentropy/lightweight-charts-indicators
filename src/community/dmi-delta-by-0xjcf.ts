/**
 * DMI Delta
 *
 * DI+ minus DI- of ta.dmi as a histogram. In the "Delta Highlight" mode the bars are coloured by the ADX (trending
 * above the threshold, non-trending below), the delta beyond the upper / lower limits with the RSI(14) above / below
 * 50 (strong) or inside the limits (weak). In the "Volume Analysis" mode the histogram is the volume, signed by
 * DI+ > DI-, coloured strong on extreme volume (volume > multiplier * SMA(volume)), weak above the volume SMA and
 * non-trending below it. Dashed threshold lines at the limits, a dotted zero line and fills between them.
 *
 * Reference: "DMI Delta by 0xjcf" by J_O_S_E_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DmiDeltaBy0xjcfInputs {
  nonTrendingBaseColor: string;
  nonTrendingWeakColor: string;
  trendingStrongBullishColor: string;
  trendingStrongBearishColor: string;
  trendingWeakBullishColor: string;
  trendingWeakBearishColor: string;
  /** DI length */
  dmiLength: number;
  /** ADX smoothing */
  adxSmoothing: number;
  /** DI smoothing (an input of the script, not used by any output) */
  diSmoothing: number;
  /** ADX level between non-trending and trending */
  thresholdTrending: number;
  upperLimit: number;
  lowerLimit: number;
  /** SMA length of the volume */
  volumeLookback: number;
  /** Volume / SMA(volume) ratio of an extreme volume */
  volumeMultiplier: number;
  visualizationToggle: 'Volume Analysis' | 'Delta Highlight';
}

export const defaultInputs: DmiDeltaBy0xjcfInputs = {
  nonTrendingBaseColor: '#787B8633',
  nonTrendingWeakColor: '#787B8633',
  trendingStrongBullishColor: '#4CAF50',
  trendingStrongBearishColor: '#F23645',
  trendingWeakBullishColor: '#4CAF5033',
  trendingWeakBearishColor: '#F2364533',
  dmiLength: 14,
  adxSmoothing: 14,
  diSmoothing: 14,
  thresholdTrending: 25,
  upperLimit: 30,
  lowerLimit: -30,
  volumeLookback: 100,
  volumeMultiplier: 3.0,
  visualizationToggle: 'Delta Highlight',
};

export const inputConfig: InputConfig[] = [
  { id: 'nonTrendingBaseColor', type: 'color', title: 'Non-Trending Base', defval: '#787B8633' },
  { id: 'nonTrendingWeakColor', type: 'color', title: 'Non-Trending Weak', defval: '#787B8633' },
  { id: 'trendingStrongBullishColor', type: 'color', title: 'Trending Strong Bullish', defval: '#4CAF50' },
  { id: 'trendingStrongBearishColor', type: 'color', title: 'Trending Strong Bearish', defval: '#F23645' },
  { id: 'trendingWeakBullishColor', type: 'color', title: 'Trending Weak Bullish', defval: '#4CAF5033' },
  { id: 'trendingWeakBearishColor', type: 'color', title: 'Trending Weak Bearish', defval: '#F2364533' },
  { id: 'dmiLength', type: 'int', title: 'DMI Length', defval: 14, min: 1 },
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1, max: 50 },
  { id: 'diSmoothing', type: 'int', title: 'DI Smoothing', defval: 14 },
  { id: 'thresholdTrending', type: 'int', title: 'Trending Threshold', defval: 25, min: 1 },
  { id: 'upperLimit', type: 'float', title: 'DMI Upper Limit', defval: 30 },
  { id: 'lowerLimit', type: 'float', title: 'DMI Lower Limit', defval: -30 },
  { id: 'volumeLookback', type: 'int', title: 'Volume Lookback Period', defval: 100 },
  { id: 'volumeMultiplier', type: 'float', title: 'Volume Multiplier for Extreme Spikes', defval: 3.0 },
  { id: 'visualizationToggle', type: 'string', title: 'Choose Visualization', defval: 'Delta Highlight', options: ['Volume Analysis', 'Delta Highlight'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DMI Delta / Volume', color: '#4CAF50', lineWidth: 2, style: 'histogram' },
];

/** hline(upper_limit / 0 / lower_limit) with the default values and colours ("Delta Highlight" mode) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 30, title: 'DI+ Threshold', color: String(color.new(color.green, 0)), linestyle: 'dashed' },
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: String(color.new(color.gray, 0)), linestyle: 'dotted' },
  { id: 'hline_lower', price: -30, title: 'DI- Threshold', color: String(color.new(color.red, 0)), linestyle: 'dashed' },
];

/** fill(hline_20_plus, hline_0) and fill(hline_0, hline_20_negative) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_upper', plot1: 'hline_upper', plot2: 'hline_zero', color: String(color.new('#010316', 97)), title: 'Hlines Background' },
  { id: 'fill_lower', plot1: 'hline_zero', plot2: 'hline_lower', color: String(color.new('#010316', 97)), title: 'Hlines Background' },
];

export const metadata = {
  title: 'DMI Delta by 0xjcf',
  shortTitle: 'DMI Delta by 0xjcf',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface DmiDeltaRun extends BarRunState<Record<string, never>> {
  dmi: ReturnType<typeof taStep.dmi>;
  volumeMa: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: Point[];
}

const fillColor = String(color.new('#010316', 97));

function study(inputs: Partial<DmiDeltaBy0xjcfInputs>): BarStudy<DmiDeltaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const showVolumeAnalysis = cfg.visualizationToggle === 'Volume Analysis';
  const up = cfg.upperLimit;
  const lo = cfg.lowerLimit;
  return {
    init() {
      const dmi = taStep.dmi(cfg.dmiLength, cfg.adxSmoothing);
      const volumeMa = new WindowSma(cfg.volumeLookback);
      const rsi = taStep.rsi(14);
      const s: DmiDeltaRun = { dmi, volumeMa, rsi, plot0: [], steps: [dmi, volumeMa, rsi], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = b.volume ?? NaN;
      const [diPlus, diMinus, adx] = s.dmi.step(b.high, b.low, b.close);
      const volumeMa = s.volumeMa.step(v);
      const rsi = s.rsi.step(b.close);
      const diDelta = diPlus - diMinus;
      let value: number;
      let col: string;
      if (showVolumeAnalysis) {
        const extreme = gt(v, cfg.volumeMultiplier * volumeMa);
        const extremeBull = extreme && gt(diPlus, diMinus);
        const extremeBear = extreme && lt(diPlus, diMinus);
        const aboveMa = gt(v, volumeMa);
        const belowMa = lt(v, volumeMa);
        value = gt(diPlus, diMinus) ? v : -v;
        col = extremeBull ? cfg.trendingStrongBullishColor
          : extremeBear ? cfg.trendingStrongBearishColor
          : gt(diDelta, 0) && aboveMa ? cfg.trendingWeakBullishColor
          : gt(diDelta, 0) && belowMa ? cfg.nonTrendingWeakColor
          : lt(diDelta, 0) && aboveMa ? cfg.trendingWeakBearishColor
          : lt(diDelta, 0) && belowMa ? cfg.nonTrendingWeakColor
          : 'transparent';
      } else {
        const nonTrending = lt(adx, cfg.thresholdTrending);
        const trending = gt(adx, cfg.thresholdTrending);
        const bullishRsi = gt(rsi, 50);
        const bearishRsi = lt(rsi, 50);
        value = diDelta;
        col = nonTrending && gt(diDelta, up) && bullishRsi ? cfg.nonTrendingBaseColor
          : nonTrending && lt(diDelta, lo) && bearishRsi ? cfg.nonTrendingBaseColor
          : nonTrending && gt(diDelta, 0) && lt(diDelta, up) ? cfg.nonTrendingWeakColor
          : nonTrending && lt(diDelta, 0) && gt(diDelta, lo) ? cfg.nonTrendingWeakColor
          : trending && gt(diDelta, up) && bullishRsi ? cfg.trendingStrongBullishColor
          : trending && lt(diDelta, lo) && bearishRsi ? cfg.trendingStrongBearishColor
          : trending && gt(diDelta, 0) && lt(diDelta, up) ? cfg.trendingWeakBullishColor
          : trending && lt(diDelta, 0) && gt(diDelta, lo) ? cfg.trendingWeakBearishColor
          : 'transparent';
      }
      s.plot0[i] = { time: b.time as number, value: Number.isFinite(value) ? value : NaN, color: col };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: up, options: { title: 'DI+ Threshold', color: showVolumeAnalysis ? 'transparent' : String(color.new(color.green, 0)), linestyle: 'dashed' } },
          { value: 0, options: { title: 'Zero Line', color: String(color.new(color.gray, 0)), linestyle: 'dotted' } },
          { value: lo, options: { title: 'DI- Threshold', color: showVolumeAnalysis ? 'transparent' : String(color.new(color.red, 0)), linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_zero', options: { title: 'Hlines Background' }, colors: new Array<string>(n).fill(fillColor) },
          { plot1: 'hline_zero', plot2: 'hline_lower', options: { title: 'Hlines Background' }, colors: new Array<string>(n).fill(fillColor) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DmiDeltaBy0xjcfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DmiDeltaBy0xjcfInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DmiDeltaBy0xjcf = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
