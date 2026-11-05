/**
 * Kernel Channel
 *
 * The midline is a kernel-weighted mean of the source over the window (weight of bar i back from the kernel of
 * u = i / (length - 1) / bandwidth: Epanechnikov 1 - u^2, Triangular 1 - u, Laplacian exp(-|u|), Cosine
 * (1 + cos(pi u)) / 2; bars before the history count as 0). The width is the kernel mean of the true range or the
 * kernel standard deviation of the source around the midline; bands = midline +/- width * multiplier. Lines and
 * fill take the slope colour of the midline. Squeeze: the relative width (width / |midline|) ranks in the lowest
 * percentile of its lookback window (background). Optional backgrounds for closes outside the channel and candles
 * coloured by regime (strong / weak trend, squeeze, neutral).
 * Alerts (alertcondition, `alerts` of the result): midline rising / falling, close crossing over / under the midline,
 * close below the upper band ('Price Above Kernel Channel Upper', as the original's expression) and below the lower.
 *
 * Reference: "Kernel Channel [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type KernelType = 'Epanechnikov' | 'Triangular' | 'Laplacian' | 'Cosine';
type BandType = 'Kernel ATR' | 'Kernel StdDev';

export interface KernelChannelInputs {
  src: SourceType;
  /** Window length */
  winLength: number;
  /** Bandwidth (locality) */
  bandwidth: number;
  kernelType: KernelType;
  /** Width from the kernel ATR or the kernel standard deviation */
  bandType: BandType;
  bandMult: number;
  showBands: boolean;
  /** Colour the candles by regime */
  useBarColor: boolean;
  /** Highlight squeeze periods */
  showSqueeze: boolean;
  /** Highlight price deviation from the channel */
  highlightDev: boolean;
  squeezeLookback: number;
  /** Squeeze percentile */
  squeezePct: number;
  colUp: string;
  colDown: string;
  sqzCol: string;
}

export const defaultInputs: KernelChannelInputs = {
  src: 'hlc3',
  winLength: 100,
  bandwidth: 1.0,
  kernelType: 'Epanechnikov',
  bandType: 'Kernel StdDev',
  bandMult: 2.0,
  showBands: true,
  useBarColor: false,
  showSqueeze: true,
  highlightDev: false,
  squeezeLookback: 100,
  squeezePct: 20.0,
  colUp: '#00ff00',
  colDown: '#ff0000',
  sqzCol: '#ffeb3b26',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'winLength', type: 'int', title: 'Window Length', defval: 100, min: 2 },
  { id: 'bandwidth', type: 'float', title: 'Bandwidth (locality)', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'kernelType', type: 'string', title: 'Kernel Type', defval: 'Epanechnikov', options: ['Epanechnikov', 'Triangular', 'Laplacian', 'Cosine'] },
  { id: 'bandType', type: 'string', title: 'Band Type', defval: 'Kernel StdDev', options: ['Kernel ATR', 'Kernel StdDev'] },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 2.0, min: 0.0, step: 0.1 },
  { id: 'showBands', type: 'bool', title: 'Show Bands', defval: true },
  { id: 'useBarColor', type: 'bool', title: 'Color Bars By Regime', defval: false },
  { id: 'showSqueeze', type: 'bool', title: 'Highlight Squeeze Periods', defval: true },
  { id: 'highlightDev', type: 'bool', title: 'Highlight Price Devation from Channel', defval: false },
  { id: 'squeezeLookback', type: 'int', title: 'Squeeze Lookback', defval: 100 },
  { id: 'squeezePct', type: 'float', title: 'Squeeze Percentile', defval: 20.0, min: 1.0, step: 1.0 },
  { id: 'colUp', type: 'color', title: 'Long Color', defval: '#00ff00' },
  { id: 'colDown', type: 'color', title: 'Short Color', defval: '#ff0000' },
  { id: 'sqzCol', type: 'color', title: 'Squeeze Color', defval: '#ffeb3b26' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Kernel Midline', color: '#00ff00', lineWidth: 3 },
  { id: 'plot1', title: 'Upper Band', color: '#00ff00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#00ff00', lineWidth: 1 },
];

/** plotcandle(open, high, low, close, "Bar Coloring", ..., display = useBarColor ? display.all : display.none) */
export const plotCandleConfig = [{ id: 'barColoring', title: 'Bar Coloring' }];

export const metadata = {
  title: 'Kernel Channel [BackQuant]',
  shortTitle: 'Kernel Channel [BackQuant]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

/** kernelWeight(idx, length, bw, ktype) */
function kernelWeight(idx: number, length: number, bw: number, ktype: KernelType): number {
  const uRaw = length > 1 ? idx / (length - 1.0) : 0.0;
  const u = uRaw / bw;
  const uClamp = Math.min(1.0, Math.max(0.0, u));
  if (ktype === 'Epanechnikov') return 1.0 - Math.pow(uClamp, 2.0);
  if (ktype === 'Triangular') return 1.0 - uClamp;
  if (ktype === 'Laplacian') return Math.exp(-Math.abs(u));
  return 0.5 * (1.0 + Math.cos(Math.PI * uClamp));
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface KernelRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  src: number[];
  trs: number[];
  midline: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fill: string[];
  /** relWidth of the bars where percentile() runs (its argument history) */
  calls: number[];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<KernelChannelInputs>): BarStudy<KernelRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const len = cfg.winLength;
  const w = Array.from({ length: len }, (_v, i) => kernelWeight(i, len, cfg.bandwidth, cfg.kernelType));
  // nz(s[i]): bars before the history (and na values) count as 0
  const nzAt = (s: number[], j: number) => (j >= 0 && !isNaN(s[j]) ? s[j] : 0);
  const kernelMu = (s: number[], i: number) => {
    let num = 0;
    let den = 0;
    for (let k = 0; k < len; k++) {
      num += w[k] * nzAt(s, i - k);
      den += w[k];
    }
    return den !== 0 ? num / den : NaN;
  };
  const kernelStddev = (s: number[], i: number, mean: number) => {
    let num = 0;
    let den = 0;
    for (let k = 0; k < len; k++) {
      const diff = nzAt(s, i - k) - mean;
      num += w[k] * diff * diff;
      den += w[k];
    }
    return den !== 0 ? Math.sqrt(num / den) : NaN;
  };
  const sqLen = cfg.squeezeLookback;
  const colFlat = color.gray;
  const fillOf = new Map<string, string>([cfg.colUp, cfg.colDown, colFlat].map((c) => [c, String(color.new(c, 80))]));
  const devUp = String(color.new(cfg.colUp, 80));
  const devDown = String(color.new(cfg.colDown, 80));
  const compressedCol = String(color.new(color.gray, 60));
  const flags = [false, false, false, false, false, false];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const tr = taStep.tr(true);
      const s: KernelRun = {
        tr, src: [], trs: [], midline: [], plot0: [], plot1: [], plot2: [], fill: [], calls: [], bgColors: [],
        candles: [], flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [tr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.calls, s.bgColors, s.candles, ...s.times];
      s.series = [s.src, s.trs, s.midline, s.plot0, s.plot1, s.plot2, s.fill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      s.src[i] = value(b);
      s.trs[i] = s.tr.step(b.high, b.low, b.close);
      const mid = kernelMu(s.src, i);
      const width = cfg.bandType === 'Kernel ATR' ? kernelMu(s.trs, i) : isNaN(mid) ? NaN : kernelStddev(s.src, i, mid);
      s.midline[i] = mid;
      const bad = isNaN(mid) || isNaN(width);
      const upper = bad ? NaN : mid + width * cfg.bandMult;
      const lower = bad ? NaN : mid - width * cfg.bandMult;
      // relWidth = na(width) or midline == 0.0 ? na : width / math.abs(midline)
      const relWidth = isNaN(width) || eq(mid, 0) ? NaN : width / Math.abs(mid);

      // squeezeRank = showSqueeze and not na(relWidth) ? percentile(relWidth, lookback, pct) : na
      // percentile() runs only on the bars of that branch: its argument history `s[i]` is the value of the i-th
      // previous call. From bar_index >= len: share (%) of the window values below the current one.
      let inSqueeze = false;
      if (cfg.showSqueeze && !isNaN(relWidth)) {
        const calls = s.calls;
        calls.push(relWidth);
        const m = calls.length - 1;
        if (i >= sqLen) {
          let count = 0;
          let rank = 0;
          const cur = calls[m];
          for (let k = 0; k < sqLen; k++) {
            const v = m - k >= 0 ? calls[m - k] : 0; // nz(s[i])
            count += 1;
            if (lt(v, cur)) rank += 1;
          }
          const frac = count > 0 ? (100.0 * rank) / count : NaN;
          inSqueeze = !isNaN(frac) && le(frac, cfg.squeezePct);
        }
      }

      const prev = i > 0 ? s.midline[i - 1] : NaN;
      const rising = gt(mid, prev);
      const falling = lt(mid, prev);
      const midColor = rising ? cfg.colUp : falling ? cfg.colDown : colFlat;
      s.plot0[i] = { time: t, value: mid, color: midColor };
      s.plot1[i] = { time: t, value: cfg.showBands ? upper : NaN, color: midColor };
      s.plot2[i] = { time: t, value: cfg.showBands ? lower : NaN, color: midColor };
      // fill(plotUpper, plotLower, "Kernel Channel Fill", color.new(midColor, 80))
      s.fill[i] = fillOf.get(midColor)!;

      const c = b.close;
      // bgcolor(showSqueeze and inSqueeze ? sqzCol : na), then the two deviation layers
      if (cfg.showSqueeze && inSqueeze) s.bgColors.push({ time: t, color: cfg.sqzCol, id: 'bgcolor0' });
      if (cfg.highlightDev && gt(c, upper)) s.bgColors.push({ time: t, color: devUp, id: 'bgcolor1' });
      if (cfg.highlightDev && lt(c, lower)) s.bgColors.push({ time: t, color: devDown, id: 'bgcolor2' });
      // plotcandle(..., "Bar Coloring", barCol, barCol, bordercolor = barCol, display = useBarColor ? all : none)
      if (cfg.useBarColor) {
        let barCol: string;
        if (gt(c, upper) && rising) barCol = color.lime;
        else if (lt(c, lower) && falling) barCol = color.red;
        else if (ge(c, mid) && le(c, upper) && rising) barCol = color.teal;
        else if (le(c, mid) && ge(c, lower) && falling) barCol = color.maroon;
        else if (cfg.showSqueeze && inSqueeze) barCol = compressedCol;
        else barCol = color.orange;
        s.candles.push({ time: t, open: b.open, high: b.high, low: b.low, close: c,
          color: barCol, wickColor: barCol, borderColor: barCol });
      }

      const pc = i > 0 ? bars[i - 1].close : NaN;
      flags[0] = rising; // midline > midline[1]
      flags[1] = falling; // midline < midline[1]
      flags[2] = c > mid && pc <= prev; // ta.crossover(close, midline)
      flags[3] = c < mid && pc >= prev; // ta.crossunder(close, midline)
      flags[4] = lt(c, upper); // close < upper
      flags[5] = lt(c, lower); // close < lower
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Kernel Channel Fill' }, colors: s.fill.slice() }],
        bgColors: s.bgColors.slice(),
        // the plotcandle output is always declared; its candles are drawn only with useBarColor (display.none else)
        plotCandles: { barColoring: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KernelChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KernelChannelInputs> = {},
): IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Kernel Channel Long', message: 'Kernel Channel Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Kernel Channel Short', message: 'Kernel Channel Short {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'Price Crossed Kernel Channel Midline', message: 'Price Crossed Kernel Channel Midline {{exchange}}:{{ticker}}' },
  { id: 'alert3', title: 'Price Crossed Kernel Channel Midline', message: 'Price Crossed Kernel Channel Midline {{exchange}}:{{ticker}}' },
  { id: 'alert4', title: 'Price Above Kernel Channel Upper', message: 'Price Above Kernel Channel Upper {{exchange}}:{{ticker}}' },
  { id: 'alert5', title: 'Price Below Kernel Channel Lower', message: 'Price Below Kernel Channel Lower {{exchange}}:{{ticker}}' },
];

export const KernelChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
  alertConditions,
};
