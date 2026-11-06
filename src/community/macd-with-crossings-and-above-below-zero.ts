/**
 * MACD With Crossings and Above Below Zero
 *
 * MACD (fast MA - slow MA, EMA or SMA) with a signal line (EMA or SMA) and a histogram coloured by its sign and
 * direction. The MACD and signal lines change colour at zero; the one-bar change of the MACD is drawn as a
 * "derivative" line. Triangles mark the MACD / signal crossings (small triangles for crossings on the "expected"
 * side of zero, bigger ones on the other side). Arrows show which DMI line (+DI / -DI) is above. The background is
 * coloured by ADX levels (12.5 / 25 / 50 / 75). An RSI scaled to 0..1 is drawn with bands at 0.3 and 0.7.
 *
 * Reference: "MACD With Crossings and Above Below Zero" by Kgroomes
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun, WindowSma } from '../live-run';

export interface MacdWithCrossingsAndAboveBelowZeroInputs {
  fastLength: number;
  slowLength: number;
  src: SourceType;
  /** Signal line length */
  signalLength: number;
  /** SMA instead of EMA for the fast and slow MAs */
  smaSource: boolean;
  /** SMA instead of EMA for the signal line */
  smaSignal: boolean;
  /** ADX smoothing (also the DI length used by the script) */
  adxLen: number;
  /** DI length (not used by the original computation, which uses the ADX smoothing) */
  diLen: number;
  /** RSI length */
  rsiLen: number;
  /** RSI source */
  rsiSrc: SourceType;
}

export const defaultInputs: MacdWithCrossingsAndAboveBelowZeroInputs = {
  fastLength: 12,
  slowLength: 26,
  src: 'close',
  signalLength: 9,
  smaSource: false,
  smaSignal: false,
  adxLen: 14,
  diLen: 14,
  rsiLen: 14,
  rsiSrc: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'smaSource', type: 'bool', title: 'Simple MA(Oscillator)', defval: false },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA(Signal Line)', defval: false },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14 },
  { id: 'rsiLen', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'rsiSrc', type: 'source', title: 'Source', defval: 'close' },
];

const COL_GROW_ABOVE = '#26A69A';
const COL_GROW_BELOW = '#FFCDD2';
const COL_FALL_ABOVE = '#B2DFDB';
const COL_FALL_BELOW = '#EF5350';
const DERIV_COLOR = String(color.new('#ffff00', 50));
const RSI_COLOR = String(color.new(color.yellow, 0));
const RED = String(color.new(color.red, 0));
const GREEN = String(color.new(color.green, 0));
const BAND_COLOR = '#C0C0C0';
const BAND_FILL = String(color.new('#9915FF', 90));
// ADX background colours
const BG_75 = String(color.rgb(255, 235, 59, 60));
const BG_50 = String(color.rgb(255, 153, 0, 50));
const BG_25 = String(color.rgb(255, 82, 82, 80));
const BG_12 = String(color.rgb(33, 150, 243, 80));
const BG_LOW = String(color.rgb(33, 150, 243, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Histogram', color: COL_GROW_ABOVE, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'MACD', color: '#00f0ff', lineWidth: 1 },
  { id: 'plot3', title: 'Signal', color: '#ff6a00', lineWidth: 1 },
  { id: 'plot4', title: 'MACD Derivative', color: DERIV_COLOR, lineWidth: 1 },
  { id: 'plot5', title: 'RSI', color: RSI_COLOR, lineWidth: 1 },
];

/** hline(.70, 'Upper Band') / hline(.30, 'Lower Band'), dashed (Pine default) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 0.7, title: 'Upper Band', color: BAND_COLOR, linestyle: 'dashed' },
  { id: 'hline_lower', price: 0.3, title: 'Lower Band', color: BAND_COLOR, linestyle: 'dashed' },
];

/** fill(rsi_band1, rsi_band0, color = color.new(#9915FF, 90), title = 'Background') */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'Background' },
];

export const metadata = {
  title: 'MACD With Crossings and Above Below Zero',
  shortTitle: 'MACD Xs & 0',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Plots show na for na and +-infinity */
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type MaStep = { step(v: number): number; commit(): void };

interface MacdXVars {
  prevHigh: number;
  prevLow: number;
  prevMacd: number;
  prevHist: number;
  prevRsiSrc: number;
  /** fixnan(...) of +DI / -DI */
  plus: number;
  minus: number;
}

interface MacdXRun extends BarRunState<MacdXVars> {
  fast: MaStep;
  slow: MaStep;
  signal: MaStep;
  tr: ReturnType<typeof taStep.tr>;
  truerange: ReturnType<typeof taStep.rma>;
  rmaPlus: ReturnType<typeof taStep.rma>;
  rmaMinus: ReturnType<typeof taStep.rma>;
  rmaDx: ReturnType<typeof taStep.rma>;
  rsiUp: ReturnType<typeof taStep.rma>;
  rsiDown: ReturnType<typeof taStep.rma>;
  xover: ReturnType<typeof taStep.crossover>;
  xunder: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<MacdWithCrossingsAndAboveBelowZeroInputs>): BarStudy<MacdXRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcOf = barSource(cfg.src);
  const rsiSrcOf = barSource(cfg.rsiSrc);
  // MACD (the inputs choose the MA on every bar, so each ta call runs on all bars or on none)
  const ma = (sma: boolean, length: number): MaStep => {
    return sma ? new WindowSma(length) : taStep.ema(length);
  };
  // dirmov(len): the original uses adxlen for every rma (len is not used)
  const adxLen = cfg.adxLen;
  return {
    fullRunReason: () => (isBarSource(cfg.src) && isBarSource(cfg.rsiSrc) ? null : 'source of another study'),
    init() {
      const s: MacdXRun = {
        fast: ma(cfg.smaSource, cfg.fastLength), slow: ma(cfg.smaSource, cfg.slowLength),
        signal: ma(cfg.smaSignal, cfg.signalLength),
        tr: taStep.tr(), truerange: taStep.rma(adxLen), rmaPlus: taStep.rma(adxLen), rmaMinus: taStep.rma(adxLen),
        rmaDx: taStep.rma(adxLen), rsiUp: taStep.rma(cfg.rsiLen), rsiDown: taStep.rma(cfg.rsiLen),
        xover: taStep.crossover(), xunder: taStep.crossunder(),
        plots: Array.from({ length: 6 }, () => []), bgColors: [], markers: [],
        steps: [],
        vars: { prevHigh: NaN, prevLow: NaN, prevMacd: NaN, prevHist: NaN, prevRsiSrc: NaN, plus: NaN, minus: NaN },
        lists: [], series: [],
      };
      s.steps = [
        s.fast, s.slow, s.signal, s.tr, s.truerange, s.rmaPlus, s.rmaMinus, s.rmaDx, s.rsiUp, s.rsiDown, s.xover, s.xunder,
      ];
      s.lists = [s.bgColors, s.markers];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      const sv = srcOf(b);
      const macd = s.fast.step(sv) - s.slow.step(sv);
      const signal = s.signal.step(macd);
      const hist = macd - signal;

      const up = i > 0 ? b.high - v.prevHigh : NaN; // ta.change(high)
      const down = i > 0 ? -(b.low - v.prevLow) : NaN; // -ta.change(low)
      v.prevHigh = b.high;
      v.prevLow = b.low;
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const truerange = s.truerange.step(s.tr.step(b.high, b.low, b.close));
      const rmaPlus = s.rmaPlus.step(plusDM);
      const rmaMinus = s.rmaMinus.step(minusDM);
      // fixnan(100 * ta.rma(dm, adxlen) / truerange): a plain division (x / 0 is +-infinity, kept by fixnan; 0 / 0 is na)
      const p = (100 * rmaPlus) / truerange;
      const m = (100 * rmaMinus) / truerange;
      if (!isNaN(p)) v.plus = p;
      if (!isNaN(m)) v.minus = m;
      const plus = v.plus;
      const minus = v.minus;
      // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen)
      const sum = plus + minus;
      const dx = Math.abs(plus - minus) / (eq(sum, 0) ? 1 : sum);
      const sig = 100 * s.rmaDx.step(dx);

      // RSI scaled to 0..1
      const rs = rsiSrcOf(b);
      const chg = i > 0 ? rs - v.prevRsiSrc : NaN;
      v.prevRsiSrc = rs;
      const u = s.rsiUp.step(Math.max(chg, 0));
      const d = s.rsiDown.step(-Math.min(chg, 0));
      const rsi = (eq(d, 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / d)) / 100;

      // Crossings: ta.crossover / ta.crossunder(signal, macd) (exact comparisons)
      const over = s.xover.step(signal, macd);
      const under = s.xunder.step(signal, macd);

      const plots = s.plots;
      plots[0][i] = { time, value: fin(sig) };
      const grow = i > 0 && lt(v.prevHist, hist); // hist[1] < hist
      v.prevHist = hist;
      const c = ge(hist, 0) ? (grow ? COL_GROW_ABOVE : COL_FALL_ABOVE) : grow ? COL_GROW_BELOW : COL_FALL_BELOW;
      plots[1][i] = { time, value: fin(hist), color: c };
      plots[2][i] = { time, value: fin(macd), color: le(macd, 0) ? '#00477d' : '#00f0ff' };
      plots[3][i] = { time, value: fin(signal), color: le(signal, 0) ? '#ff2600' : '#ff6a00' };
      // plot(ta.change(macd))
      plots[4][i] = { time, value: fin(i > 0 ? macd - v.prevMacd : NaN), color: DERIV_COLOR };
      v.prevMacd = macd;
      plots[5][i] = { time, value: fin(rsi), color: RSI_COLOR };

      // bgcolor(bcol): ADX levels
      const bg = ge(sig, 75) ? BG_75 : ge(sig, 50) ? BG_50 : ge(sig, 25) ? BG_25 : ge(sig, 12.5) ? BG_12 : lt(sig, 12.5) ? BG_LOW : null;
      if (bg) s.bgColors.push({ time, color: bg });

      const markers = s.markers;
      // xUp = macd > 0 ? crossover : false -> 'MACD X Up': triangle down, top, tiny, red
      if (gt(macd, 0) && over) markers.push({ time, id: 'shape0', position: 'top', shape: 'triangleDown', color: RED, size: 'tiny' });
      // xDn = macd < 0 ? crossunder : false -> 'MACD X Dn': triangle up, bottom, tiny, green
      if (lt(macd, 0) && under) markers.push({ time, id: 'shape1', position: 'bottom', shape: 'triangleUp', color: GREEN, size: 'tiny' });
      // xDnHigh = macd >= 0 ? crossunder : false -> 'Big MACD X Up': triangle up, bottom, small, green
      if (ge(macd, 0) && under) markers.push({ time, id: 'shape2', position: 'bottom', shape: 'triangleUp', color: GREEN, size: 'small' });
      // xUpLow = macd <= 0 ? crossover : false -> 'Big MACD X Dn': triangle down, top, small, red
      if (le(macd, 0) && over) markers.push({ time, id: 'shape3', position: 'top', shape: 'triangleDown', color: RED, size: 'small' });
      // 'DMI+': plusDM > minusDM, arrow up, bottom, size.auto, green; 'DMI-': plusDM < minusDM, arrow down, top, red
      if (gt(plus, minus)) markers.push({ time, id: 'shape4', position: 'bottom', shape: 'arrowUp', color: GREEN, size: 'auto' });
      if (lt(plus, minus)) markers.push({ time, id: 'shape5', position: 'top', shape: 'arrowDown', color: RED, size: 'auto' });
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3, plot4, plot5] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
        hlines: [
          { value: 0.7, options: { title: 'Upper Band', color: BAND_COLOR, linestyle: 'dashed' } },
          { value: 0.3, options: { title: 'Lower Band', color: BAND_COLOR, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Background' }, colors: new Array<string>(n).fill(BAND_FILL) },
        ],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdWithCrossingsAndAboveBelowZeroInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdWithCrossingsAndAboveBelowZeroInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MacdWithCrossingsAndAboveBelowZero = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
