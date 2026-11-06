/**
 * RSI Bars - OnlyFlow
 *
 * Colours the price candles by the RSI. At or above the overbought level the colour goes from "Overbought Min" to
 * "Mid" to "Max" as the RSI moves from the level to 100 (gradient mode: linear blend of the RGB channels; 3-step
 * mode: steps at level, level + 10, level + 20). At or below the oversold level the oversold colours do the same
 * towards 0. Between the levels the candle takes the neutral up / down colour (by close >= open) or a gray. The
 * colours are drawn as candles (body, wicks and borders) or as bar colours. An optional RSI line with its levels.
 *
 * Reference: "RSI Bars - OnlyFlow" by ofderk
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiBarsOnlyflowInputs {
  /** RSI source */
  src: SourceType;
  /** RSI length */
  len: number;
  /** Overbought level */
  ob: number;
  /** Oversold level */
  os: number;
  /** Gradient mode (off = 3 steps) */
  useSmooth: boolean;
  /** The neutral colour follows the bar direction (else a gray) */
  colorByDir: boolean;
  colSellMin: string;
  colSellMed: string;
  colSellMax: string;
  colBuyMin: string;
  colBuyMed: string;
  colBuyMax: string;
  colNeutralUp: string;
  colNeutralDown: string;
  /** Draw the colours as candles (body, wicks, borders); off: as bar colours */
  useCustomCandles: boolean;
  /** Transparency of the colours (0 = solid, 100 = invisible) */
  candleOpacityPct: number;
  /** Show the RSI line and its levels */
  showPane: boolean;
}

export const defaultInputs: RsiBarsOnlyflowInputs = {
  src: 'close',
  len: 14,
  ob: 70,
  os: 30,
  useSmooth: true,
  colorByDir: true,
  colSellMin: String(color.rgb(255, 181, 218)),
  colSellMed: String(color.rgb(255, 0, 0)),
  colSellMax: String(color.rgb(128, 0, 0)),
  colBuyMin: String(color.rgb(64, 224, 208)),
  colBuyMed: String(color.rgb(0, 128, 128)),
  colBuyMax: String(color.rgb(0, 64, 64)),
  colNeutralUp: String(color.rgb(50, 54, 69)),
  colNeutralDown: String(color.rgb(67, 73, 84)),
  useCustomCandles: true,
  candleOpacityPct: 0,
  showPane: false,
};

const d = defaultInputs;
export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'ob', type: 'float', title: 'Overbought', defval: 70, min: 50, max: 100 },
  { id: 'os', type: 'float', title: 'Oversold', defval: 30, min: 0, max: 50 },
  { id: 'useSmooth', type: 'bool', title: 'Gradient mode (off = 3-step)', defval: true },
  { id: 'colorByDir', type: 'bool', title: 'Neutral color follows bar direction', defval: true },
  { id: 'colSellMin', type: 'color', title: 'Overbought Min', defval: d.colSellMin },
  { id: 'colSellMed', type: 'color', title: 'Overbought Mid', defval: d.colSellMed },
  { id: 'colSellMax', type: 'color', title: 'Overbought Max', defval: d.colSellMax },
  { id: 'colBuyMin', type: 'color', title: 'Oversold Min', defval: d.colBuyMin },
  { id: 'colBuyMed', type: 'color', title: 'Oversold Mid', defval: d.colBuyMed },
  { id: 'colBuyMax', type: 'color', title: 'Oversold Max', defval: d.colBuyMax },
  { id: 'colNeutralUp', type: 'color', title: 'Neutral Up', defval: d.colNeutralUp },
  { id: 'colNeutralDown', type: 'color', title: 'Neutral Down', defval: d.colNeutralDown },
  { id: 'useCustomCandles', type: 'bool', title: 'Fully color body + wicks + borders', defval: true },
  { id: 'candleOpacityPct', type: 'int', title: 'Extra transparency (0=solid, 100=invisible)', defval: 0, min: 0, max: 100 },
  { id: 'showPane', type: 'bool', title: 'Show RSI pane', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#2962FF', lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'RSI Bars - OnlyFlow',
  shortTitle: 'RSI Bars - OnlyFlow',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** f_clamp01(x) = x < 0 ? 0.0 : x > 1 ? 1.0 : x */
const clamp01 = (x: number) => (lt(x, 0) ? 0 : gt(x, 1) ? 1 : x);

/** f_lerpColor: math.round of each RGB channel blend, color.rgb (opaque) */
function lerpColor(c1: string, c2: string, t: number): string {
  const tt = clamp01(t);
  const ch = (f: (c: string) => number) => Math.round(f(c1) + (f(c2) - f(c1)) * tt);
  return String(color.rgb(ch(color.r), ch(color.g), ch(color.b)));
}

/** f_palette3: x = clamp(t) * 2; x <= 1 ? lerp(min, med, x) : lerp(med, max, x - 1) */
function palette3(t: number, cMin: string, cMed: string, cMax: string): string {
  const x = clamp01(t) * 2.0;
  return le(x, 1.0) ? lerpColor(cMin, cMed, x) : lerpColor(cMed, cMax, x - 1.0);
}

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] };

interface RsiBarsRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: { time: number; value: number }[];
  candles: PlotCandleData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<RsiBarsOnlyflowInputs>): BarStudy<RsiBarsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { ob, os } = cfg;
  const value = barSource(cfg.src);
  const gray70 = String(color.new(color.gray, 70));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.len);
      const s: RsiBarsRun = { rsi, plot0: [], candles: [], barColors: [], steps: [rsi], vars: {}, lists: [], series: [] };
      s.lists = [s.candles, s.barColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const r = s.rsi.step(value(b));
      const obInt = ge(r, ob) ? (r - ob) / Math.max(0.0001, 100 - ob) : 0.0;
      const osInt = le(r, os) ? (os - r) / Math.max(0.0001, os) : 0.0;
      const isUp = ge(b.close, b.open);
      const baseColor = cfg.colorByDir ? (isUp ? cfg.colNeutralUp : cfg.colNeutralDown) : gray70;

      let finalColor = baseColor;
      if (ge(r, ob)) {
        if (cfg.useSmooth) {
          finalColor = palette3(obInt, cfg.colSellMin, cfg.colSellMed, cfg.colSellMax);
        } else {
          // sellStep (na below ob: nz gives baseColor)
          const step = ge(r, Math.min(100, ob + 20)) ? cfg.colSellMax
            : ge(r, Math.min(100, ob + 10)) ? cfg.colSellMed
              : ge(r, ob) ? cfg.colSellMin : null;
          finalColor = step ?? baseColor;
        }
      } else if (le(r, os)) {
        if (cfg.useSmooth) {
          finalColor = palette3(osInt, cfg.colBuyMin, cfg.colBuyMed, cfg.colBuyMax);
        } else {
          const step = le(r, Math.max(0, os - 20)) ? cfg.colBuyMax
            : le(r, Math.max(0, os - 10)) ? cfg.colBuyMed
              : le(r, os) ? cfg.colBuyMin : null;
          finalColor = step ?? baseColor;
        }
      }
      // fullCol = color.new(finalColor, candleOpacityPct)
      const fullCol = String(color.new(finalColor, cfg.candleOpacityPct));

      // plotcandle(open, high, low, close, "RSI Colored Candles", fullCol, wickcolor = fullCol, bordercolor = fullCol,
      //   display = useCustomCandles ? display.all : display.none)
      if (cfg.useCustomCandles) {
        s.candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: fullCol,
          wickColor: fullCol, borderColor: fullCol });
      } else {
        // barcolor(useCustomCandles ? na : fullCol, title = "RSI Gradient Bars")
        s.barColors.push({ time: b.time, color: fullCol });
      }
      // plot(showPane ? rsi : na, "RSI", display = display.pane)
      s.plot0[i] = { time: b.time, value: cfg.showPane ? r : NaN };
    },
    result(s) {
      // hline(..., color = showPane ? color.new(...) : na)
      const lvl = (c: string, t: number) => (cfg.showPane ? String(color.new(c, t)) : 'transparent');

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
        },
        hlines: [
          { value: ob, options: { title: 'OB', color: lvl(color.red, 70), linestyle: 'dashed' } },
          { value: os, options: { title: 'OS', color: lvl(color.teal, 70), linestyle: 'dashed' } },
          { value: 50, options: { title: 'Mid', color: lvl(color.gray, 80), linestyle: 'dashed' } },
        ],
        plotCandles: { rsiColoredCandles: s.candles.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiBarsOnlyflowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiBarsOnlyflowInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiBarsOnlyflow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
