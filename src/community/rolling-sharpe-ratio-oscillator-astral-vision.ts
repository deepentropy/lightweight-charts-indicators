/**
 * Rolling Sharpe Ratio Oscillator | Astral Vision
 *
 * Log return r = ln(close / close[1]); Sharpe = SMA(r, len) / stdev(r, len) * sqrt(365) when the stdev is above 0,
 * smoothed by an EMA. The line is coloured by a gradient from -2 to 2 (or by the overbought / oversold thresholds),
 * with fills to the threshold lines when beyond them. On the price pane: background colours beyond the thresholds,
 * candles in the line colour, and two price levels: EMA of close[len] * exp(threshold * stdev / sqrt(365) * len).
 *
 * Reference: "Rolling Sharpe Ratio Oscillator | Astral Vision 🌠💠" by AstralVision
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Astral Vision
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData, PlotCandleData } from '../types';

export interface RollingSharpeRatioOscillatorAstralVisionInputs {
  /** Lookback period (bars) of the mean and stdev of the log returns */
  len: number;
  /** EMA length of the Sharpe ratio and of the price levels */
  smoothLen: number;
  /** Oversold threshold */
  threshOs: number;
  /** Overbought threshold */
  threshOb: number;
  /** Gradient colour (else threshold colours) */
  useGrad: boolean;
  theme: 'Inferno' | 'Paradiso' | 'Futura' | 'Infinito' | 'Hermes';
  useCustom: boolean;
  customPos: string;
  customNeg: string;
}

export const defaultInputs: RollingSharpeRatioOscillatorAstralVisionInputs = {
  len: 365,
  smoothLen: 30,
  threshOs: -1.5,
  threshOb: 2.8,
  useGrad: true,
  theme: 'Futura',
  useCustom: false,
  customPos: color.green,
  customNeg: color.red,
};

const G1 = 'Settings';
const G2 = 'Astral Colors';

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Lookback Period (days)', defval: 365, group: G1 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing EMA Length', defval: 30, group: G1 },
  { id: 'threshOs', type: 'float', title: 'Oversold Threshold', defval: -1.5, step: 0.1, group: G1 },
  { id: 'threshOb', type: 'float', title: 'Overbought Threshold', defval: 2.8, step: 0.1, group: G1 },
  { id: 'useGrad', type: 'bool', title: 'Use Gradient Color', defval: true, group: G1 },
  { id: 'theme', type: 'string', title: 'Theme', defval: 'Futura', options: ['Inferno', 'Paradiso', 'Futura', 'Infinito', 'Hermes'], group: G2 },
  { id: 'useCustom', type: 'bool', title: 'Use Custom Colors', defval: false, group: G2 },
  { id: 'customPos', type: 'color', title: 'Custom Positive', defval: color.green, group: G2 },
  { id: 'customNeg', type: 'color', title: 'Custom Negative', defval: color.red, group: G2 },
];

const POS = String(color.rgb(0, 255, 180));
const NEG = String(color.rgb(180, 0, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Threshold', color: String(color.new(POS, 40)), lineWidth: 1 },
  { id: 'plot1', title: 'Oversold Threshold', color: String(color.new(NEG, 40)), lineWidth: 1 },
  { id: 'plot2', title: 'Sharpe Ratio', color: POS, lineWidth: 2 },
  { id: 'plot3', title: 'Overbought Price', color: String(color.new(POS, 40)), lineWidth: 1, forceOverlay: true },
  { id: 'plot4', title: 'Oversold Price', color: String(color.new(NEG, 40)), lineWidth: 1, forceOverlay: true },
];

export const metadata = {
  title: 'Rolling Sharpe Ratio Oscillator | Astral Vision 🌠💠',
  shortTitle: 'Rolling Sharpe Ratio Oscillator | Astral Vision 🌠💠',
  overlay: false,
  precision: 2,
  format: 'price',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const THEMES: Record<string, [string, string]> = {
  Inferno: [String(color.rgb(255, 0, 0)), String(color.rgb(120, 0, 0))],
  Paradiso: [String(color.rgb(0, 210, 255)), String(color.rgb(0, 80, 160))],
  Futura: [POS, NEG],
  Infinito: [String(color.rgb(180, 120, 255)), String(color.rgb(255, 220, 80))],
  Hermes: [String(color.rgb(255, 160, 0)), String(color.rgb(0, 180, 120))],
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> };

interface SharpeRun extends BarRunState<Record<string, never>> {
  mean: WindowSma;
  dev: WindowStdev;
  smooth: ReturnType<typeof taStep.ema>;
  obEma: ReturnType<typeof taStep.ema>;
  osEma: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  fillOs: string[];
  fillOb: string[];
  candles: PlotCandleData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RollingSharpeRatioOscillatorAstralVisionInputs>): BarStudy<SharpeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, smoothLen, threshOs, threshOb } = cfg;

  // Theme colours (Hermes is the last `else` of the Pine ternary chain)
  const [themePos, themeNeg] = THEMES[cfg.theme] ?? THEMES.Hermes;
  const posCol = cfg.useCustom ? cfg.customPos : themePos;
  const negCol = cfg.useCustom ? cfg.customNeg : themeNeg;

  const NA = 'transparent';
  const posLine = String(color.new(posCol, 40));
  const negLine = String(color.new(negCol, 40));
  const posFill = String(color.new(posCol, 80));
  const negFill = String(color.new(negCol, 80));
  const posBg = String(color.new(posCol, 50));
  const negBg = String(color.new(negCol, 50));

  return {
    init() {
      const mean = new WindowSma(len);
      const dev = new WindowStdev(len);
      const smooth = taStep.ema(smoothLen);
      const obEma = taStep.ema(smoothLen);
      const osEma = taStep.ema(smoothLen);
      const s: SharpeRun = {
        mean, dev, smooth, obEma, osEma, plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], fillOs: [], fillOb: [],
        candles: [], bgColors: [],
        steps: [mean, dev, smooth, obEma, osEma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.fillOs, s.fillOb, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const excess = i > 0 ? Math.log(b.close / bars[i - 1].close) : NaN;
      const meanExcess = s.mean.step(excess);
      const stdevExcess = s.dev.step(excess);
      // sharpe = stdev_excess > 0 ? mean / stdev * sqrt(365) : na
      const sharpe = gt(stdevExcess, 0) ? (meanExcess / stdevExcess) * Math.sqrt(365) : NaN;
      const ss = s.smooth.step(sharpe);

      // price levels: close[len] * exp(thresh * stdev / sqrt(365) * len), smoothed by an EMA
      const level = (th: number) => (i - len >= 0
        ? bars[i - len].close * Math.exp(((th * stdevExcess) / Math.sqrt(365)) * len) : NaN);
      const priceOb = s.obEma.step(level(threshOb));
      const priceOs = s.osEma.step(level(threshOs));

      const above = gt(ss, threshOb);
      const below = lt(ss, threshOs);
      // grad = color.from_gradient(sharpe_smooth, -2, 2, neg_col, pos_col) (na value: na colour)
      const grad = String(color.from_gradient(ss, -2, 2, negCol, posCol));
      const col = above ? posCol : below ? negCol : color.black;
      const definite = cfg.useGrad ? grad : col;
      // fill(sharpeplot, h2, sharpe_smooth < thresh_os ? color.new(neg_col, 80) : na)
      s.fillOs[i] = below ? negFill : NA;
      // fill(sharpeplot, h1, sharpe_smooth > thresh_ob ? color.new(pos_col, 80) : na)
      s.fillOb[i] = above ? posFill : NA;
      // two bgcolor calls (force_overlay): the second one is drawn on top; they never hold on the same bar
      if (below) s.bgColors.push({ id: 'bgcolor0', time: b.time, color: negBg, forceOverlay: true });
      if (above) s.bgColors.push({ id: 'bgcolor1', time: b.time, color: posBg, forceOverlay: true });
      // plotcandle(open, high, low, close, color = definitecol, wickcolor = definitecol, bordercolor = definitecol, force_overlay = true)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: definite, wickColor: definite, borderColor: definite, forceOverlay: true };

      // h1 = plot(thresh_ob, color = color.new(pos_col, 40), linewidth = 1)
      s.plot0[i] = { time: b.time, value: threshOb, color: posLine };
      // h2 = plot(thresh_os, color = color.new(neg_col, 40), linewidth = 1)
      s.plot1[i] = { time: b.time, value: threshOs, color: negLine };
      // sharpeplot = plot(sharpe_smooth, color = definitecol, linewidth = 2)
      s.plot2[i] = { time: b.time, value: ss, color: definite };
      // plot(ta.ema(price_ob, smooth_len), color = color.new(pos_col, 40), linewidth = 1, force_overlay = true)
      s.plot3[i] = { time: b.time, value: priceOb, color: posLine };
      // plot(ta.ema(price_os, smooth_len), color = color.new(neg_col, 40), linewidth = 1, force_overlay = true)
      s.plot4[i] = { time: b.time, value: priceOs, color: negLine };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot1', colors: s.fillOs.slice() },
          { plot1: 'plot2', plot2: 'plot0', colors: s.fillOb.slice() },
        ],
        bgColors: s.bgColors.slice(),
        plotCandles: { sharpeCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RollingSharpeRatioOscillatorAstralVisionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RollingSharpeRatioOscillatorAstralVisionInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RollingSharpeRatioOscillatorAstralVision = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
