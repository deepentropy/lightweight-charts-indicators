/**
 * Liquidation Levels [LuxAlgo]
 *
 * Estimated liquidation prices of leveraged positions: for each of three leverages L (25x, 50x, 100x by default) the
 * long level is ref * (1 + 1 / L) and the short level ref * (1 - 1 / L), where ref is the "Reference Price" of the
 * bar. A bar counts as a liquidation event when its volume is above "Volume Threshold" times its 13-bar SMA (two more
 * steps at +1 and +2), or when ref / (ref - low) or ref / (high - ref) is at most "Volatility Threshold"; and the bar
 * must range more than ref / 333 away from ref.
 *
 * Bubbles (circles at the level prices) are sized by the volume step (normal above +2, small above +1, tiny above the
 * threshold or on a volatility event). A level beyond the bar (long above the high, short below the low) also draws a
 * line from the bar, width 3 / 2 / 1 by the volume step, that extends one bar to the right on each bar until a bar
 * trades through it; at most 500 lines are kept.
 *
 * The "hlcc4" reference price uses the library source (oakScriptJS #189).
 *
 * Reference: "Liquidation Levels [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, line, Series, getSourceSeries, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Line, type MarkerData, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface LiquidationLevelsInputs {
  /** Reference price of the liquidation levels */
  refPL: 'open' | 'close' | 'oc2' | 'hl2' | 'hlc3' | 'ohlc4' | 'hlcc4';
  /** Volume threshold (times the 13-bar volume SMA) */
  vbHT: number;
  /** Volatility threshold */
  lqTH: number;
  /** Leverage 1 on */
  lqL1: boolean;
  /** Leverage 1 */
  lgL1V: number;
  /** Leverage 1 long colour */
  lqL1L: string;
  /** Leverage 1 short colour */
  lqL1S: string;
  /** Leverage 2 on */
  lqL2: boolean;
  /** Leverage 2 */
  lgL2V: number;
  /** Leverage 2 long colour */
  lqL2L: string;
  /** Leverage 2 short colour */
  lqL2S: string;
  /** Leverage 3 on */
  lqL3: boolean;
  /** Leverage 3 */
  lgL3V: number;
  /** Leverage 3 long colour */
  lqL3L: string;
  /** Leverage 3 short colour */
  lqL3S: string;
  /** Hide the bubbles */
  lqBB: boolean;
  /** Hide the level lines */
  lqLN: boolean;
}

export const defaultInputs: LiquidationLevelsInputs = {
  refPL: 'open',
  vbHT: 1.7,
  lqTH: 10,
  lqL1: true,
  lgL1V: 25,
  lqL1L: 'rgba(91, 156, 246, 0.5)',
  lqL1S: 'rgba(240, 98, 146, 0.5)',
  lqL2: true,
  lgL2V: 50,
  lqL2L: 'rgba(77, 208, 225, 0.5)',
  lqL2S: 'rgba(186, 104, 200, 0.5)',
  lqL3: true,
  lgL3V: 100,
  lqL3L: 'rgba(66, 189, 168, 0.5)',
  lqL3S: 'rgba(149, 117, 205, 0.5)',
  lqBB: false,
  lqLN: false,
};

const RP_TT = 'Liquidation Levels are estimates of potential price levels where liquidation events may occur\n' +
  ' - The reference price option defines the base price in calculating liquidation price levels';
const VL_TT = 'Liquidation data is closely tied in with trading volumes in the market and the movement in the underlying asset’s price\n' +
  ' -  The volume threshold option is the primary factor in detecting the significant trading activities that could potentially lead to liquidating leveraged positions\n' +
  ' -  The volatility threshold option (below) is the secondary factor that aims at detecting significant movement in the underlying asset’s price with relatively lower trading activities that could potentially also lead to liquidating high-leveraged positions';

export const inputConfig: InputConfig[] = [
  { id: 'refPL', type: 'string', title: 'Reference Price', defval: 'open', options: ['open', 'close', 'oc2', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'], tooltip: RP_TT },
  { id: 'vbHT', type: 'float', title: 'Volume Threshold', defval: 1.7, min: 1, step: 0.1, tooltip: VL_TT },
  { id: 'lqTH', type: 'int', title: 'Volatility Threshold', defval: 10, min: 0, step: 5 },
  { id: 'lqL1', type: 'bool', title: 'Leverage', defval: true, inline: 'L1' },
  { id: 'lgL1V', type: 'int', title: '', defval: 25, min: 1, inline: 'L1' },
  { id: 'lqL1L', type: 'color', title: '', defval: 'rgba(91, 156, 246, 0.5)', inline: 'L1' },
  { id: 'lqL1S', type: 'color', title: '', defval: 'rgba(240, 98, 146, 0.5)', inline: 'L1' },
  { id: 'lqL2', type: 'bool', title: 'Leverage', defval: true, inline: 'L2' },
  { id: 'lgL2V', type: 'int', title: '', defval: 50, min: 1, inline: 'L2' },
  { id: 'lqL2L', type: 'color', title: '', defval: 'rgba(77, 208, 225, 0.5)', inline: 'L2' },
  { id: 'lqL2S', type: 'color', title: '', defval: 'rgba(186, 104, 200, 0.5)', inline: 'L2' },
  { id: 'lqL3', type: 'bool', title: 'Leverage', defval: true, inline: 'L3' },
  { id: 'lgL3V', type: 'int', title: '', defval: 100, min: 1, inline: 'L3' },
  { id: 'lqL3L', type: 'color', title: '', defval: 'rgba(66, 189, 168, 0.5)', inline: 'L3' },
  { id: 'lqL3S', type: 'color', title: '', defval: 'rgba(149, 117, 205, 0.5)', inline: 'L3' },
  { id: 'lqBB', type: 'bool', title: 'Hide Liquidation Bubbles', defval: false },
  { id: 'lqLN', type: 'bool', title: 'Hide Liquidation Levels', defval: false },
];

export const plotConfig: PlotConfig[] = [];

type Size = 'normal' | 'small' | 'tiny';
/** Size of the 6 bubbles of a leverage, in the order of the original: long normal, small, tiny, short tiny, small, normal */
const SIZES: Size[] = ['normal', 'small', 'tiny', 'tiny', 'small', 'normal'];
const SHAPE_COLORS = [
  defaultInputs.lqL1L, defaultInputs.lqL1S, defaultInputs.lqL2L, defaultInputs.lqL2S, defaultInputs.lqL3L,
  defaultInputs.lqL3S,
];

/** The 18 plotshape() calls, in declaration order */
export const shapeConfig: ShapeConfig[] = Array.from({ length: 18 }, (_, k) => ({
  id: `shape${k}`,
  kind: 'shape' as const,
  title: 'Bubbles',
  style: 'circle',
  location: 'absolute',
  color: SHAPE_COLORS[Math.floor(k / 6) * 2 + (k % 6 < 3 ? 0 : 1)],
  size: SIZES[k % 6],
}));

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'Liquidation Levels [LuxAlgo]',
  shortTitle: 'LuxAlgo - Liquidation Levels',
  overlay: true,
};

/** Pine float comparisons (1e-10) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b <= 1e-10;
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<LiquidationLevelsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // f_gSRC(refPL)
  const refP: number[] = cfg.refPL === 'oc2'
    ? bars.map((b) => (b.open + b.close) / 2)
    : getSourceSeries(bars, cfg.refPL).toArray().map((v) => v ?? NaN);
  const nzV = bars.map((b) => (Number.isFinite(b.volume ?? NaN) ? (b.volume as number) : 0));
  const vbMA = ta.sma(Series.fromArray(bars, nzV), 13).toArray().map((v) => v ?? NaN);

  resetDrawings({ line: 500 });
  const aLQ: Line[] = [];
  const markers: MarkerData[] = [];

  const levels = [
    { on: cfg.lqL1, lev: cfg.lgL1V, colL: cfg.lqL1L, colS: cfg.lqL1S },
    { on: cfg.lqL2, lev: cfg.lgL2V, colL: cfg.lqL2L, colS: cfg.lqL2S },
    { on: cfg.lqL3, lev: cfg.lgL3V, colL: cfg.lqL3L, colS: cfg.lqL3S },
  ];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const t = b.time;
    const r = refP[i];
    const v = nzV[i];
    const nzVd2 = gt(v, vbMA[i] * (2 + cfg.vbHT));
    const nzVd1 = gt(v, vbMA[i] * (1 + cfg.vbHT));
    const nzVd0 = gt(v, vbMA[i] * (0 + cfg.vbHT));

    const lT = (ne(b.low, r) && le(r / (r - b.low), cfg.lqTH)) || (ne(b.high, r) && le(r / (b.high - r), cfg.lqTH));
    const eC = lt(r * (1 + 1 / 333), b.high) || gt(r * (1 - 1 / 333), b.low);
    const width = nzVd2 ? 3 : nzVd1 ? 2 : 1;

    levels.forEach((lv, k) => {
      const show = !cfg.lqBB && lv.on;
      const base = k * 6;
      const bubble = (id: number, price: number, col: string) => {
        if (Number.isFinite(price)) {
          markers.push({ id: `shape${id}`, time: t, position: 'atPriceMiddle', price, shape: 'circle', color: col, size: SIZES[id % 6] });
        }
      };
      const tiny = (show && nzVd0 && eC) || (show && lT);

      const pL = r * (1 + 1 / lv.lev);
      if (show && nzVd2 && eC) bubble(base, pL, lv.colL);
      if (show && nzVd1 && eC) bubble(base + 1, pL, lv.colL);
      if (tiny) bubble(base + 2, pL, lv.colL);
      if (!cfg.lqLN && lv.on && (lT || nzVd0) && gt(pL, b.high) && eC) {
        aLQ.push(line.new(i, pL, i + 1, pL, 'bar_index', 'none', lv.colL, 'solid', width));
      }

      const pS = r * (1 - 1 / lv.lev);
      if (tiny) bubble(base + 3, pS, lv.colS);
      if (show && nzVd1 && eC) bubble(base + 4, pS, lv.colS);
      if (show && nzVd2 && eC) bubble(base + 5, pS, lv.colS);
      if (!cfg.lqLN && lv.on && (lT || nzVd0) && lt(pS, b.low) && eC) {
        aLQ.push(line.new(i, pS, i + 1, pS, 'bar_index', 'none', lv.colS, 'solid', width));
      }
    });

    if (aLQ.length > 0) {
      const qt = aLQ.length;
      for (let ln = qt - 1; ln >= 0; ln--) {
        if (ln < aLQ.length) {
          const cL = aLQ[ln];
          const yL = line.get_y1(cL);
          // a level the bar trades through stops extending
          if (gt(b.high, yL) && lt(b.low, yL)) aLQ.splice(ln, 1);
          else line.set_x2(cL, i + 1);
        }
      }
      if (aLQ.length > 500) line.delete(aLQ.shift()!);
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars),
  };
}

export const LiquidationLevels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
};
