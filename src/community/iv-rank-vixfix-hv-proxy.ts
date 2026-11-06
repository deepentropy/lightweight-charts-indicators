/**
 * IV Rank (tasty-style), VIXFix / HV proxy
 *
 * An implied volatility proxy: VIXFix = max(100 * (highest(high, len) - close) / highest(high, len),
 * mult * stdev(low, len)), or the annualised historical volatility stdev(log(close / close[1]), len) * sqrt(252) * 100.
 * The IV rank is the position of the proxy between its lowest and highest value of `lookbackIVR` bars, in percent
 * (na when that range is 0). Horizontal lines at 0, 50 and 100.
 *
 * Reference: "IV Rank (tasty-style) — VIXFix / HV Proxy" by steveoptionstrade2025
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © steveoptionstrade2025
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IvRankVixFixHvProxyInputs {
  /** Volatility proxy */
  ivSource: 'VIXFix' | 'HV(30)';
  /** Length of the highest / lowest proxy value */
  lookbackIVR: number;
  /** Length of the historical volatility (HV mode) */
  hvLen: number;
  /** Length of the VIXFix */
  vixLen: number;
  /** Multiplier of the standard deviation of the low (VIXFix) */
  vixMult: number;
}

export const defaultInputs: IvRankVixFixHvProxyInputs = {
  ivSource: 'VIXFix',
  lookbackIVR: 252,
  hvLen: 30,
  vixLen: 22,
  vixMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'ivSource', type: 'string', title: 'IV Source (proxy)', defval: 'VIXFix', options: ['VIXFix', 'HV(30)'] },
  { id: 'lookbackIVR', type: 'int', title: 'IVR Lookback (trading days ~1y)', defval: 252, min: 60 },
  { id: 'hvLen', type: 'int', title: 'HV length (if HV mode)', defval: 30, min: 10 },
  { id: 'vixLen', type: 'int', title: 'VIXFix length', defval: 22, min: 10 },
  { id: 'vixMult', type: 'float', title: 'VIXFix stdev multiplier', defval: 2.0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'IV Rank %', color: '#2962FF', lineWidth: 2 },
];

/** hline(0), hline(50), hline(100) with the Pine default style */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, title: '0%', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_50', price: 50, title: '50%', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_100', price: 100, title: '100%', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'IV Rank (tasty-style) — VIXFix / HV Proxy',
  shortTitle: 'IV Rank (tasty-style) — VIXFix / HV Proxy',
  overlay: false,
};

/** Pine `!=`: false when a value is na or when the values are within 1e-10 */
const EPS = 1e-10;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

interface IvRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme | null;
  st: WindowStdev;
  ivHi: WindowExtreme;
  ivLo: WindowExtreme;
  plot0: Array<{ time: number; value: number }>;
}

function study(inputs: Partial<IvRankVixFixHvProxyInputs>): BarStudy<IvRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const vixFix = cfg.ivSource === 'VIXFix';
  return {
    init() {
      // ivSource is an input: the same branch runs on every bar, so its ta.* calls see every bar
      const hh = vixFix ? new WindowExtreme(false, cfg.vixLen) : null;
      const st = new WindowStdev(vixFix ? cfg.vixLen : cfg.hvLen);
      const ivHi = new WindowExtreme(false, cfg.lookbackIVR);
      const ivLo = new WindowExtreme(true, cfg.lookbackIVR);
      const s: IvRun = { hh, st, ivHi, ivLo, plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.steps = [...(hh ? [hh] : []), st, ivHi, ivLo];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      let iv: number;
      if (vixFix) {
        const hh = s.hh!.step(b.high);
        const st = s.st.step(b.low);
        const raw = (100 * (hh - close)) / hh;
        // math.max(raw, st): na when one of them is na
        iv = Math.max(raw, cfg.vixMult * st);
      } else {
        const r = i > 0 ? Math.log(close / bars[i - 1].close) : NaN;
        iv = s.st.step(r) * Math.sqrt(252) * 100.0;
      }

      const ivHi = s.ivHi.step(iv);
      const ivLo = s.ivLo.step(iv);
      const ivRange = ivHi - ivLo;
      const ivr = ne(ivRange, 0) ? (100 * (iv - ivLo)) / ivRange : NaN;
      s.plot0[i] = { time: b.time as number, value: Number.isFinite(ivr) ? ivr : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: hlineConfig.map((h) => ({
          value: h.price,
          options: { title: h.title, color: h.color, linestyle: h.linestyle, linewidth: h.linewidth },
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IvRankVixFixHvProxyInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IvRankVixFixHvProxyInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IvRankVixFixHvProxy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
