/**
 * ADX and RSI Combo
 *
 * Two RSIs of the close (lengths 2 and 5 by default) with the up / down changes averaged by an SMA ("Simple RSI")
 * or an RMA: rsi = 100 when the average fall is 0, 0 when the average rise is 0, else 100 - 100 / (1 + up / down).
 * Bands at 85 and 15 with a fill. The DI+ / DI- lines come from Wilder sums (S = S[1] - S[1] / len + x) of the true
 * range and the directional movements, and the ADX is the RMA of DX. Triangles on the RSI2 line: up when RSI2 was
 * below 15 and rises, down when it was above 85 and falls.
 *
 * Reference: "ADX and RSI Combo" by Tracks
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdxAndRsiComboInputs {
  /** Length of RSI1 */
  len1: number;
  /** Length of RSI2 */
  len2: number;
  /** RSI1 averages with an SMA (else an RMA) */
  rs1: boolean;
  /** RSI2 averages with an SMA (else an RMA) */
  rs2: boolean;
  /** Show the RSI2 triangles */
  ut: boolean;
  /** Length of the Wilder sums and of the ADX RMA */
  len: number;
}

export const defaultInputs: AdxAndRsiComboInputs = {
  len1: 2,
  len2: 5,
  rs1: true,
  rs2: true,
  ut: true,
  len: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'RSI1 Length', defval: 2, min: 1 },
  { id: 'len2', type: 'int', title: 'RSI2 Length', defval: 5, min: 1 },
  { id: 'rs1', type: 'bool', title: 'Simple RSI(2)', defval: true },
  { id: 'rs2', type: 'bool', title: 'Simple RSI(5)', defval: true },
  { id: 'ut', type: 'bool', title: 'Show RSI Triggers', defval: true },
  { id: 'len', type: 'int', title: 'ADX Length', defval: 5 },
];

const PURPLE = String(color.new(color.purple, 0));
const GREEN = String(color.new(color.green, 0));
const RED = String(color.new(color.red, 0));
const BLACK = String(color.new(color.black, 0));
const BAND_FILL = String(color.new(color.purple, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI1', color: PURPLE, lineWidth: 4 },
  { id: 'plot1', title: 'RSI2', color: PURPLE, lineWidth: 1 },
  { id: 'plot2', title: 'DI+', color: GREEN, lineWidth: 1 },
  { id: 'plot3', title: 'DI-', color: RED, lineWidth: 1 },
  { id: 'plot4', title: 'ADX', color: BLACK, lineWidth: 1 },
];

/** hline(85) / hline(15): default colour and style */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 85, title: 'Upper Level', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_lower', price: 15, title: 'Lower Level', color: '#787B86', linestyle: 'dashed' },
];

/** fill(band1, band0, color = color.new(color.purple, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'Band Fill' },
];

export const metadata = {
  title: 'ADX and RSI Combo',
  shortTitle: 'ADX&RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color?: string };
type Avg = { step(v: number): number; commit(): void };

interface ComboVars {
  /** Wilder sums: S := nz(S[1]) - nz(S[1]) / len + x */
  sTr: number;
  sPlus: number;
  sMinus: number;
}

interface ComboRun extends BarRunState<ComboVars> {
  up1: Avg;
  down1: Avg;
  up2: Avg;
  down2: Avg;
  adx: ReturnType<typeof taStep.rma>;
  rsi2: number[];
  plots: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<AdxAndRsiComboInputs>): BarStudy<ComboRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.len;
  // up / down: if rs ? ta.sma(...) : ta.rma(...) (only the chosen average runs)
  const avg = (simple: boolean, l: number): Avg => (simple ? new WindowSma(l) : taStep.rma(l));
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const nz = (x: number) => (Number.isFinite(x) ? x : 0);
  // down == 0 ? 100 : up == 0 ? 0 : 100 - 100 / (1 + up / down)
  const rsiOf = (u: number, d: number) => (eq(d, 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / d));
  return {
    init() {
      const up1 = avg(cfg.rs1, cfg.len1);
      const down1 = avg(cfg.rs1, cfg.len1);
      const up2 = avg(cfg.rs2, cfg.len2);
      const down2 = avg(cfg.rs2, cfg.len2);
      const adx = taStep.rma(len);
      const s: ComboRun = {
        up1, down1, up2, down2, adx, rsi2: [], plots: Array.from({ length: 5 }, () => []), markers: [],
        steps: [up1, down1, up2, down2, adx], vars: { sTr: 0, sPlus: 0, sMinus: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.rsi2, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      // ta.change(src) (na on the first bar; math.max / math.min keep na)
      const change = i > 0 ? b.close - bars[i - 1].close : NaN;
      const gain = Math.max(change, 0);
      const loss = -Math.min(change, 0);
      const rsi = rsiOf(s.up1.step(gain), s.down1.step(loss));
      const rsi2 = rsiOf(s.up2.step(gain), s.down2.step(loss));
      s.rsi2[i] = rsi2;

      // Wilder sums: S := nz(S[1]) - nz(S[1]) / len + x; nz(close[1]) etc. are 0 on the first bar
      const pc = i > 0 ? (isNaN(bars[i - 1].close) ? 0 : bars[i - 1].close) : 0;
      const ph = i > 0 ? (isNaN(bars[i - 1].high) ? 0 : bars[i - 1].high) : 0;
      const pl = i > 0 ? (isNaN(bars[i - 1].low) ? 0 : bars[i - 1].low) : 0;
      const tr = Math.max(Math.max(b.high - b.low, Math.abs(b.high - pc)), Math.abs(b.low - pc));
      const dmPlus = gt(b.high - ph, pl - b.low) ? Math.max(b.high - ph, 0) : 0;
      const dmMinus = gt(pl - b.low, b.high - ph) ? Math.max(pl - b.low, 0) : 0;
      v.sTr = nz(v.sTr) - nz(v.sTr) / len + tr;
      v.sPlus = nz(v.sPlus) - nz(v.sPlus) / len + dmPlus;
      v.sMinus = nz(v.sMinus) - nz(v.sMinus) / len + dmMinus;
      // plain divisions: x / 0 is +-infinity, 0 / 0 na
      const diPlus = (v.sPlus / v.sTr) * 100;
      const diMinus = (v.sMinus / v.sTr) * 100;
      const dx = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
      // ADX = ta.rma(DX, len): +-infinity is skipped like na
      const adx = s.adx.step(Number.isFinite(dx) ? dx : NaN);

      if (i >= 1) {
        const prev = s.rsi2[i - 1];
        // bc = rsi2[1] < 15 and rsi2 > rsi2[1] and ut; plotshape(bc ? rsi2 : na, triangleup, green, location.absolute)
        if (cfg.ut && lt(prev, 15) && gt(rsi2, prev)) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price: rsi2, shape: 'triangleUp', color: GREEN });
        }
        // bp = rsi2[1] > 85 and rsi2 < rsi2[1] and ut; plotshape(bp ? rsi2 : na, triangledown, red, location.absolute)
        if (cfg.ut && gt(prev, 85) && lt(rsi2, prev)) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price: rsi2, shape: 'triangleDown', color: RED });
        }
      }

      const p = s.plots;
      p[0][i] = { time: t, value: val(rsi), color: PURPLE };
      p[1][i] = { time: t, value: val(rsi2), color: PURPLE };
      p[2][i] = { time: t, value: val(diPlus), color: GREEN };
      p[3][i] = { time: t, value: val(diMinus), color: RED };
      p[4][i] = { time: t, value: val(adx), color: BLACK };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        fills: [{ plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Band Fill', color: BAND_FILL } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdxAndRsiComboInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdxAndRsiComboInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdxAndRsiCombo = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
