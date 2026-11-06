/**
 * Bitcoin 2Y-SMA Bands | Astral Vision
 *
 * Investor bands from the 2-year SMA (730 bars) of the close: bottom = SMA * bottom multiplier, top = bottom * top
 * multiplier, drawn on the price pane with a background below the bottom / above the top and recoloured candles.
 * The pane shows log(close / bottom) with levels at log(top multiplier) and 0, filled where the ratio is below 1 or
 * above the top multiplier. Colours from a theme (or custom colours); the ratio colour is flat (positive below 1,
 * negative above the top multiplier, gray between) or a gradient between 1 and the top multiplier.
 *
 * Reference: "Bitcoin 2Y-SMA Bands| Astral Vision 🌠💠" by AstralVision
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AstralVision
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { PlotCandleData, BgColorData } from '../types';

export type AstralTheme = 'Inferno' | 'Paradiso' | 'Futura' | 'Infinito' | 'Hermes';

export interface Bitcoin2ySmaBandsAstralVisionInputs {
  /** Bottom multiplier (2y-SMA x) */
  multBottom: number;
  /** Top multiplier (bottom x) */
  multTop: number;
  /** Draw the recoloured candles on the price pane */
  showCandle: boolean;
  /** Gradient colour of the ratio (else flat colours) */
  usegrad: boolean;
  theme: AstralTheme;
  usecustom: boolean;
  customPos: string;
  customNeg: string;
}

export const defaultInputs: Bitcoin2ySmaBandsAstralVisionInputs = {
  multBottom: 0.6,
  multTop: 6.5,
  showCandle: true,
  usegrad: false,
  theme: 'Hermes',
  usecustom: false,
  customPos: color.white,
  customNeg: color.gray,
};

export const inputConfig: InputConfig[] = [
  { id: 'multBottom', type: 'float', title: 'Bottom Multiplier (2y-SMA ×)', defval: 0.6, step: 0.05, group: 'Settings' },
  { id: 'multTop', type: 'float', title: 'Top Multiplier (Bottom ×)', defval: 6.5, step: 0.1, group: 'Settings' },
  { id: 'showCandle', type: 'bool', title: 'Plot Candle', defval: true, group: 'Plots' },
  { id: 'usegrad', type: 'bool', title: 'Use Gradient Color', defval: false, group: 'Plots' },
  { id: 'theme', type: 'string', title: 'Theme', defval: 'Hermes', options: ['Inferno', 'Paradiso', 'Futura', 'Infinito', 'Hermes'],
    group: 'Astral Colors' },
  { id: 'usecustom', type: 'bool', title: 'Use Custom Colors', defval: false, group: 'Astral Colors' },
  { id: 'customPos', type: 'color', title: 'Custom Positive', defval: color.white, group: 'Astral Colors' },
  { id: 'customNeg', type: 'color', title: 'Custom Negative', defval: color.gray, group: 'Astral Colors' },
];

const HERMES_POS = color.rgb(255, 160, 0);
const HERMES_NEG = color.rgb(0, 180, 120);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Investor Bottom (2y-SMA × mult)', color: HERMES_POS, lineWidth: 2, forceOverlay: true },
  { id: 'plot1', title: 'Investor Top (Bottom × mult)', color: HERMES_NEG, lineWidth: 2, forceOverlay: true },
  { id: 'plot2', title: 'Top Level', color: HERMES_NEG, lineWidth: 1 },
  { id: 'plot3', title: 'Bottom Level', color: HERMES_POS, lineWidth: 1 },
  { id: 'plot4', title: 'Price / Investor Bottom', color: color.rgb(120, 120, 120), lineWidth: 2 },
];

/** plotcandle(open, high, low, close, "Candle", ..., force_overlay = true, display = show_candle ? all : none) */
export const plotCandleConfig = [{ id: 'candle', title: 'Candle' }];

export const metadata = {
  title: 'Bitcoin 2Y-SMA Bands| Astral Vision 🌠💠',
  shortTitle: 'Bitcoin 2Y-SMA Bands| Astral Vision 🌠💠',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

function themeColors(cfg: Bitcoin2ySmaBandsAstralVisionInputs): [string, string] {
  if (cfg.usecustom) return [cfg.customPos, cfg.customNeg];
  switch (cfg.theme) {
    case 'Inferno': return [color.rgb(255, 0, 0), color.rgb(120, 0, 0)];
    case 'Paradiso': return [color.rgb(0, 210, 255), color.rgb(0, 80, 160)];
    case 'Futura': return [color.rgb(0, 255, 180), color.rgb(180, 0, 255)];
    case 'Infinito': return [color.rgb(180, 120, 255), color.rgb(255, 220, 80)];
    default: return [HERMES_POS, HERMES_NEG];
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; bgColors: BgColorData[] };

interface BtcRun extends BarRunState<Record<string, never>> {
  sma2y: WindowSma;
  plots: Point[][];
  fillBottom: string[];
  fillTop: string[];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<Bitcoin2ySmaBandsAstralVisionInputs>): BarStudy<BtcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const [posCol, negCol] = themeColors(cfg);
  const gray = color.rgb(120, 120, 120);
  const posBg = String(color.new(posCol, 50));
  const negBg = String(color.new(negCol, 50));
  const posFill = String(color.new(posCol, 70));
  const negFill = String(color.new(negCol, 70));
  const multTop = cfg.multTop;
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const sma2y = new WindowSma(730);
      const s: BtcRun = {
        sma2y, plots: [[], [], [], [], []], fillBottom: [], fillTop: [], bgColors: [], candles: [],
        steps: [sma2y], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.candles];
      s.series = [...s.plots, s.fillBottom, s.fillTop];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const invBottom = s.sma2y.step(b.close) * cfg.multBottom;
      const invTop = invBottom * multTop;
      // ratio = inv_bottom != 0 ? close / inv_bottom : na
      const r = ne(invBottom, 0) ? b.close / invBottom : NaN;
      // flat_col = ratio > mult_top ? neg_col : ratio < 1.0 ? pos_col : color.rgb(120, 120, 120)
      const flat = gt(r, multTop) ? negCol : lt(r, 1.0) ? posCol : gray;
      const finalCol = cfg.usegrad ? color.from_gradient(r, 1.0, multTop, posCol, negCol) : flat;
      // bgcolor(ratio < 1.0 ? color.new(pos_col, 50) : na, force_overlay = true), then the top layer
      // id: the original's bgcolor() call (bgcolor0 / bgcolor1)
      if (lt(r, 1.0)) s.bgColors.push({ time: t, color: posBg, forceOverlay: true, id: 'bgcolor0' });
      if (gt(r, multTop)) s.bgColors.push({ time: t, color: negBg, forceOverlay: true, id: 'bgcolor1' });
      if (cfg.showCandle) {
        s.candles.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: finalCol,
          wickColor: finalCol, borderColor: finalCol, forceOverlay: true });
      }
      s.fillBottom[i] = lt(r, 1.0) ? posFill : 'transparent';
      s.fillTop[i] = gt(r, multTop) ? negFill : 'transparent';

      const p = s.plots;
      p[0][i] = { time: t, value: finite(invBottom), color: posCol };
      p[1][i] = { time: t, value: finite(invTop), color: negCol };
      p[2][i] = { time: t, value: finite(Math.log(multTop)), color: negCol };
      p[3][i] = { time: t, value: Math.log(1.0), color: posCol };
      p[4][i] = { time: t, value: finite(Math.log(r)), color: finalCol };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
        },
        fills: [
          // fill(p_ratio, h_one, ratio < 1.0 ? color.new(pos_col, 70) : na)
          { plot1: 'plot4', plot2: 'plot3', colors: s.fillBottom.slice() },
          // fill(p_ratio, h_top, ratio > mult_top ? color.new(neg_col, 70) : na)
          { plot1: 'plot4', plot2: 'plot2', colors: s.fillTop.slice() },
        ],
        plotCandles: { candle: s.candles.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Bitcoin2ySmaBandsAstralVisionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Bitcoin2ySmaBandsAstralVisionInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const Bitcoin2ySmaBandsAstralVision = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
};
