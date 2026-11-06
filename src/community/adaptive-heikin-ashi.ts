/**
 * Adaptive Heikin Ashi [CHE]
 *
 * Heikin-Ashi candles whose open is an adaptive blend: haOpen = haOpen[1] * w + haClose[1] * (1 - w), with
 * haClose = (open + high + low + close) / 4. The weight w = 0.5 + range * clamp((ATR / SMA(ATR) - 1) * sensitivity,
 * -1, 1) moves around 0.5 with the ATR compared with its own average. The first open (and the open after an na
 * weight) is (1 - w) * open + w * close. High / low include the HA open and close. Candles are green when the HA close
 * is above the HA open, else red. The weight can be plotted as a diagnostic.
 *
 * Reference: "Adaptive Heikin Ashi [CHE]" by chervolino
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveHeikinAshiInputs {
  /** ATR length used to adapt the HA weighting */
  atrLength: number;
  /** Max deviation of the weight around 0.5 */
  oscillationRange: number;
  /** Scales the impact of the ATR oscillation */
  adaptSensitivity: number;
  showBorders: boolean;
  showWicks: boolean;
  colBullBody: string;
  colBearBody: string;
  colBullWick: string;
  colBearWick: string;
  colBullBorder: string;
  colBearBorder: string;
  /** Body transparency (0..100) */
  transpBody: number;
  /** Wick transparency (0..100) */
  transpWick: number;
  /** Border transparency (0..100) */
  transpBorder: number;
  /** Plot the adaptive weight */
  showWeight: boolean;
  weightColor: string;
}

export const defaultInputs: AdaptiveHeikinAshiInputs = {
  atrLength: 14,
  oscillationRange: 0.2,
  adaptSensitivity: 6.0,
  showBorders: true,
  showWicks: true,
  colBullBody: '#089981',
  colBearBody: '#f23645',
  colBullWick: '#089981',
  colBearWick: '#f23645',
  colBullBorder: '#089981',
  colBearBorder: '#f23645',
  transpBody: 0,
  transpWick: 0,
  transpBorder: 0,
  showWeight: false,
  weightColor: color.gray,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'oscillationRange', type: 'float', title: 'Oscillation Range', defval: 0.2, min: 0.0, max: 0.5, step: 0.01 },
  { id: 'adaptSensitivity', type: 'float', title: 'Adapt Sensitivity', defval: 6.0, min: -3.0, step: 0.1 },
  { id: 'showBorders', type: 'bool', title: 'Show Borders', defval: true },
  { id: 'showWicks', type: 'bool', title: 'Show Wicks', defval: true },
  { id: 'colBullBody', type: 'color', title: 'Bull Body', defval: '#089981' },
  { id: 'colBearBody', type: 'color', title: 'Bear Body', defval: '#f23645' },
  { id: 'colBullWick', type: 'color', title: 'Bull Wick', defval: '#089981' },
  { id: 'colBearWick', type: 'color', title: 'Bear Wick', defval: '#f23645' },
  { id: 'colBullBorder', type: 'color', title: 'Bull Border', defval: '#089981' },
  { id: 'colBearBorder', type: 'color', title: 'Bear Border', defval: '#f23645' },
  { id: 'transpBody', type: 'int', title: 'Body Transparency (0..100)', defval: 0, min: 0, max: 100 },
  { id: 'transpWick', type: 'int', title: 'Wick Transparency (0..100)', defval: 0, min: 0, max: 100 },
  { id: 'transpBorder', type: 'int', title: 'Border Transparency (0..100)', defval: 0, min: 0, max: 100 },
  { id: 'showWeight', type: 'bool', title: 'Show Adaptive Weight', defval: false },
  { id: 'weightColor', type: 'color', title: 'Weight Plot Color', defval: color.gray },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive Weight', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'Adaptive Heikin Ashi [CHE]',
  shortTitle: 'Adaptive Heikin Ashi [CHE]',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface AhaVars {
  /** var float ha_open = na */
  haOpen: number;
  /** ha_close[1] */
  prevHaClose: number;
}

interface AhaRun extends BarRunState<AhaVars> {
  atr: ReturnType<typeof taStep.atr>;
  atrSma: WindowSma;
  candles: PlotCandleData[];
  plot0: { time: number; value: number; color: string }[];
}

/** A candle value: na when not finite (the candle is not drawn) */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<AdaptiveHeikinAshiInputs>): BarStudy<AhaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullBody = String(color.new(cfg.colBullBody, cfg.transpBody));
  const bearBody = String(color.new(cfg.colBearBody, cfg.transpBody));
  const bullWick = String(color.new(cfg.colBullWick, cfg.transpWick));
  const bearWick = String(color.new(cfg.colBearWick, cfg.transpWick));
  const bullBorder = String(color.new(cfg.colBullBorder, cfg.transpBorder));
  const bearBorder = String(color.new(cfg.colBearBorder, cfg.transpBorder));
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const atrSma = new WindowSma(cfg.atrLength);
      const s: AhaRun = {
        atr, atrSma, candles: [], plot0: [], steps: [atr, atrSma], vars: { haOpen: NaN, prevHaClose: NaN }, lists: [], series: [],
      };
      s.series = [s.candles, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const atr = s.atr.step(b.high, b.low, b.close);
      const atrSmaRaw = s.atrSma.step(atr);
      const haClose = (b.open + b.high + b.low + b.close) / 4.0;
      // atr_sma = nz(ta.sma(atr_val, atr_length), atr_val)
      const atrSma = isNaN(atrSmaRaw) ? atr : atrSmaRaw;
      // math.min / math.max give na with an na argument (as JS NaN); a plain division (0 / 0 is na)
      const atrNorm = Math.min(Math.max((atr / atrSma - 1.0) * cfg.adaptSensitivity, -1.0), 1.0);
      const w = 0.5 + cfg.oscillationRange * atrNorm;
      const initialOpen = (1.0 - w) * b.open + w * b.close;
      // ha_open := na(ha_open[1]) ? initial_open : ha_open[1] * w + ha_close[1] * (1 - w)
      const haOpen = !Number.isFinite(v.haOpen) ? initialOpen : v.haOpen * w + v.prevHaClose * (1.0 - w);
      v.haOpen = haOpen;
      const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
      const haLow = Math.min(b.low, Math.min(haOpen, haClose));
      v.prevHaClose = haClose;

      const bull = gt(haClose, haOpen);
      // Every bar as in Pine (NaN = na: the open / high / low are na in the ATR warm-up); a candle with an na value
      // is not drawn
      s.candles[i] = {
        time: b.time, open: fin(haOpen), high: fin(haHigh), low: fin(haLow), close: fin(haClose),
        color: bull ? bullBody : bearBody,
        wickColor: cfg.showWicks ? (bull ? bullWick : bearWick) : 'transparent',
        borderColor: cfg.showBorders ? (bull ? bullBorder : bearBorder) : 'transparent',
      };
      // plot(show_weight ? w : na, 'Adaptive Weight', linewidth = 2, color = weight_color)
      s.plot0[i] = { time: b.time, value: cfg.showWeight && Number.isFinite(w) ? w : NaN, color: cfg.weightColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        plotCandles: { adaptiveHeikinAshi: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveHeikinAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveHeikinAshiInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveHeikinAshi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
