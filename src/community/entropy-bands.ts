/**
 * Entropy Bands (TechnoBlooms)
 *
 * A moving average (SMA, EMA or WMA) of the close is the midline. The "entropy" is the SMA of the bar range divided
 * by the close; the band width is multiplier * (entropy + ATR). The bands are the midline +/- the width, with a fill.
 * Candles with a body larger than a minimum percent of the close are coloured green above the upper band, magenta
 * below the lower band and gray between the bands.
 *
 * Reference: "Entropy Bands (TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TechnoBlooms
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type EntropyBandsMAType = 'SMA' | 'EMA' | 'WMA';

export interface EntropyBandsInputs {
  /** Length of the midline average and of the entropy SMA */
  entropyLength: number;
  atrLength: number;
  bandMultiplier: number;
  maType: EntropyBandsMAType;
  /** Show the midline and the bands */
  showBands: boolean;
  /** Pine input that the script does not use */
  showBackground: boolean;
  /** Pine input that the script does not use */
  entropyThreshold: number;
  /** Colour the candles */
  showCandleColoring: boolean;
  /** Minimum candle body (% of the close) to colour a candle */
  minBodyPercent: number;
}

export const defaultInputs: EntropyBandsInputs = {
  entropyLength: 20,
  atrLength: 14,
  bandMultiplier: 1.5,
  maType: 'SMA',
  showBands: true,
  showBackground: true,
  entropyThreshold: 2.0,
  showCandleColoring: true,
  minBodyPercent: 0.03,
};

export const inputConfig: InputConfig[] = [
  { id: 'entropyLength', type: 'int', title: 'Entropy Length', defval: 20 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'bandMultiplier', type: 'float', title: 'Band Multiplier', defval: 1.5, step: 0.1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA'] },
  { id: 'showBands', type: 'bool', title: 'Show Bands', defval: true },
  { id: 'showBackground', type: 'bool', title: 'Color Background by Entropy', defval: true },
  { id: 'entropyThreshold', type: 'float', title: 'Entropy Threshold for Dynamic Background', defval: 2.0 },
  { id: 'showCandleColoring', type: 'bool', title: 'Color Candles Based on Entropy Bands', defval: true },
  { id: 'minBodyPercent', type: 'float', title: 'Minimum Candle Body Size (%) to Confirm Breakout', defval: 0.03 },
];

const BAND_COLOR = String(color.rgb(47, 192, 187));
const FILL_COLOR = String(color.rgb(146, 146, 148, 94));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Upper Fill Edge', color: 'transparent', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Fill Edge', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Entropy Bands (TechnoBlooms)',
  shortTitle: 'Entropy Bands (TechnoBlooms)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface EbRun extends BarRunState<Record<string, never>> {
  basis: { step(v: number): number; commit(): void };
  entropy: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EntropyBandsInputs>): BarStudy<EbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.entropyLength;
  // basis = ma(close, entropy_length): the switch runs only the branch of the (constant) type
  const basisStep = (): EbRun['basis'] => {
    if (cfg.maType === 'EMA') return taStep.ema(len);
    if (cfg.maType === 'WMA') {
      const m = taStep.wma();
      return { step: (v) => m.step(v, len), commit: () => m.commit() };
    }
    return new WindowSma(len);
  };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: EbRun = {
        basis: basisStep(), entropy: new WindowSma(len), atr: taStep.atr(cfg.atrLength),
        plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.basis, s.entropy, s.atr];
      s.lists = [s.barColors];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const basis = s.basis.step(close);
      // entropy = ta.sma((high - low) / close, entropy_length)
      const entropy = s.entropy.step((b.high - b.low) / close);
      const atr = s.atr.step(b.high, b.low, close);
      const width = cfg.bandMultiplier * (entropy + atr);
      const upper = basis + width;
      const lower = basis - width;

      const time = b.time as number;
      s.plot0[i] = { time, value: cfg.showBands ? fin(basis) : NaN, color: color.blue };
      s.plot1[i] = { time, value: cfg.showBands ? fin(upper) : NaN, color: BAND_COLOR };
      s.plot2[i] = { time, value: cfg.showBands ? fin(lower) : NaN, color: BAND_COLOR };
      // fill(plot(upper_band, color = na), plot(lower_band, color = na), color.rgb(146, 146, 148, 94))
      s.plot3[i] = { time, value: fin(upper) };
      s.plot4[i] = { time, value: fin(lower) };

      // barcolor(show_candle_coloring and body_percent > min_body_percent ? (close > upper_band ? #06f093 :
      //   close < lower_band ? #ff03ea : #6e6b6f) : na)
      if (cfg.showCandleColoring) {
        const bodyPercent = (Math.abs(close - b.open) / close) * 100;
        if (!gt(bodyPercent, cfg.minBodyPercent)) return;
        const c = gt(close, upper) ? '#06f093' : lt(close, lower) ? '#ff03ea' : '#6e6b6f';
        s.barColors.push({ time: b.time, color: c });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        fills: [{ plot1: 'plot3', plot2: 'plot4', options: { color: FILL_COLOR }, colors: new Array<string>(n).fill(FILL_COLOR) }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EntropyBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EntropyBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EntropyBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
