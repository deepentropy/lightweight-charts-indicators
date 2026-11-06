/**
 * Accumulation/Distribution Money Flow
 *
 * The A/D ratio is the close change divided by the true range (0 when na), optionally pushed towards its sign by the
 * A/D weight. The money flow is the RMA over `len` bars of volume * hlc3 (or volume) * A/D ratio. It is smoothed by
 * a moving average (the "smoothed" line) and smoothed again for the signal line; the histogram is their difference.
 * The ribbon between the two lines and the histogram are green when the histogram is positive, red otherwise.
 * Circles mark the crosses of the signal and the smoothed line (or, as an option, the turns of the smoothed line).
 * Bars are coloured by the histogram sign, by the sign of the line and of the histogram, or by a gradient of the
 * histogram normalised by its range over the last `normPeriod` bars.
 *
 * Reference: "Accumulation/Distribution Money Flow v1.3" by kypexin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: original calculation author (c) cI8DH, see "Accumulation/Distribution Money Flow" indicator;
 * modified (c) kypexin
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type AdMoneyFlowMaType = 'EMA' | 'DEMA' | 'TEMA' | 'WMA' | 'VWMA' | 'SMA' | 'SMMA' | 'HMA';

export interface AdMoneyFlowInputs {
  /** ADMF period length (RMA length) */
  len: number;
  /** Factor the price in (money flow = volume * hlc3) */
  priceEnable: boolean;
  /** A/D weight (at 1 all volume is included) */
  adWeight: number;
  /** Show the original ADMF line */
  showADMF: boolean;
  /** Show the histogram */
  showHist: boolean;
  /** MA type of the ADMF smoothing */
  ma1Type: AdMoneyFlowMaType;
  /** MA length of the ADMF smoothing */
  ma1Length: number;
  /** MA type of the signal */
  ma2Type: AdMoneyFlowMaType;
  /** MA length of the signal */
  ma2Length: number;
  /** Crossover markers (otherwise advance / decline markers) */
  crossMrk: boolean;
  /** Colour the bars */
  colorBars: boolean;
  /** Bar colour by the sign of the smoothed line and of the histogram */
  colorPlusMinus: boolean;
  /** Bar colour by a gradient of the normalised histogram */
  colorGrad: boolean;
  /** Bars back of the gradient normalisation range */
  normPeriod: number;
  /** Fill the ribbon between the smoothed line and the signal */
  fillRibbon: boolean;
}

export const defaultInputs: AdMoneyFlowInputs = {
  len: 9,
  priceEnable: true,
  adWeight: 0.0,
  showADMF: false,
  showHist: true,
  ma1Type: 'EMA',
  ma1Length: 2,
  ma2Type: 'EMA',
  ma2Length: 2,
  crossMrk: true,
  colorBars: true,
  colorPlusMinus: false,
  colorGrad: false,
  normPeriod: 100,
  fillRibbon: true,
};

const MA_TYPES = ['EMA', 'DEMA', 'TEMA', 'WMA', 'VWMA', 'SMA', 'SMMA', 'HMA'];

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'ADMF period length', defval: 9, min: 1 },
  { id: 'priceEnable', type: 'bool', title: 'Factor price (= money flow)', defval: true },
  { id: 'adWeight', type: 'float', title: 'A/D weight (at 1 all volume is included)', defval: 0.0, min: 0.0, max: 1.0, step: 0.5 },
  { id: 'showADMF', type: 'bool', title: 'Show original ADMA line', defval: false },
  { id: 'showHist', type: 'bool', title: 'Show histogram', defval: true },
  { id: 'ma1Type', type: 'string', title: 'MA smoother for ADMF', defval: 'EMA', options: MA_TYPES },
  { id: 'ma1Length', type: 'int', title: 'MA Length for ADMF', defval: 2, min: 1, step: 1 },
  { id: 'ma2Type', type: 'string', title: 'MA smoother for signal', defval: 'EMA', options: MA_TYPES },
  { id: 'ma2Length', type: 'int', title: 'MA Length for signal', defval: 2, min: 1, step: 1 },
  { id: 'crossMrk', type: 'bool', title: 'Crossover markers (otherwise advance/declibe markers)', defval: true },
  { id: 'colorBars', type: 'bool', title: 'Color bars', defval: true },
  { id: 'colorPlusMinus', type: 'bool', title: 'Color based on range', defval: false },
  { id: 'colorGrad', type: 'bool', title: 'Gradient coloring', defval: false },
  { id: 'normPeriod', type: 'int', title: 'Gradient normalize range, bars back', defval: 100, min: 10, step: 10 },
  { id: 'fillRibbon', type: 'bool', title: 'Fill ribbon', defval: true },
];

const ADMF_COLOR = String(color.new(color.rgb(200, 200, 255), 0));
const SMOOTHED_COLOR = String(color.new(color.rgb(36, 91, 240), 0));
const SIGNAL_COLOR = String(color.new(color.rgb(208, 158, 8), 0));
const HIST_UP = String(color.new(color.green, 60));
const HIST_DOWN = String(color.new(color.red, 60));
const BARS_UP = String(color.new(color.green, 10));
const BARS_DOWN = String(color.new(color.red, 10));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'A/D Money Flow', color: ADMF_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'A/D Money Flow smoothed', color: SMOOTHED_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Signal', color: SIGNAL_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Histogram', color: HIST_UP, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Accumulation/Distribution Money Flow v1.3',
  shortTitle: 'ADMF v1.3',
  overlay: false,
  precision: 0,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };
type Point = { time: number; value: number; color?: string };
/** One f_ma call stepped bar by bar */
type Ma = Committable & { step(v: number, volume: number): number };

/** ta.wma(src, length) with a length fixed at the call */
function wmaStep(length: number): Committable & { step(v: number): number } {
  const m = taStep.wma();
  return { step: (v) => m.step(v, length), commit: () => m.commit() };
}

/**
 * SMMA: result := na(w[1]) ? ta.sma(_src, _len) : (w[1] * (_len - 1) + _src) / _len, w = ta.wma(_src, _len); the
 * ta.sma runs only on the bars where w[1] is na (its history is these bars)
 */
class SmmaStep implements Committable {
  private readonly wma: Committable & { step(v: number): number };
  private readonly sma: WindowSma;
  private prevW = NaN;
  private nextW = NaN;
  private stepped = false;

  constructor(private readonly len: number) {
    this.wma = wmaStep(len);
    this.sma = new WindowSma(len);
  }

  step(v: number): number {
    this.stepped = true;
    this.nextW = this.wma.step(v) ?? NaN;
    if (isNaN(this.prevW)) return this.sma.step(v) ?? NaN;
    return (this.prevW * (this.len - 1) + v) / this.len;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.wma.commit();
    this.sma.commit();
    this.prevW = this.nextW;
  }
}

// f_ma(type, src, len): one moving average per call
function maStep(type: AdMoneyFlowMaType, len: number): Ma {
  const A = (v: number) => v ?? NaN;
  switch (type) {
    case 'SMA': { const m = new WindowSma(len); return { step: (v) => A(m.step(v)), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(len); return { step: (v) => A(m.step(v)), commit: () => m.commit() }; }
    case 'DEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return {
        step: (v) => { const e = A(e1.step(v)); return 2 * e - A(e2.step(e)); },
        commit: () => { e1.commit(); e2.commit(); },
      };
    }
    case 'TEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return {
        step: (v) => { const e = A(e1.step(v)); const ee = A(e2.step(e)); return 3 * (e - ee) + A(e3.step(ee)); },
        commit: () => { e1.commit(); e2.commit(); e3.commit(); },
      };
    }
    case 'WMA': { const m = wmaStep(len); return { step: (v) => A(m.step(v)), commit: () => m.commit() }; }
    case 'VWMA': { const m = new WindowVwma(len); return { step: (v, vol) => A(m.step(v, vol)), commit: () => m.commit() }; }
    case 'SMMA': { const m = new SmmaStep(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'HMA': {
      const half = wmaStep(len / 2);
      const full = wmaStep(len);
      const out = wmaStep(Math.round(Math.sqrt(len)));
      return {
        step: (v) => { const h = A(half.step(v)); return A(out.step(2 * h - A(full.step(v)))); },
        commit: () => { half.commit(); full.commit(); out.commit(); },
      };
    }
    default:
      return { step: () => 0, commit: () => {} };
  }
}

interface AdmfVars {
  /** The ma1 of the previous bars where the left side of the lazy `and` was true */
  risePrev: number;
  fallPrev: number;
}

interface AdmfRun extends BarRunState<AdmfVars> {
  rma: ReturnType<typeof taStep.rma>;
  ma1: Ma;
  ma2: Ma;
  hMax: WindowExtreme;
  hMin: WindowExtreme;
  ma1Arr: number[];
  ma2Arr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  fillColors: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<AdMoneyFlowInputs>): BarStudy<AdmfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rma = taStep.rma(cfg.len);
      const ma1 = maStep(cfg.ma1Type, cfg.ma1Length);
      const ma2 = maStep(cfg.ma2Type, cfg.ma2Length);
      const hMax = new WindowExtreme(false, cfg.normPeriod);
      const hMin = new WindowExtreme(true, cfg.normPeriod);
      const s: AdmfRun = {
        rma, ma1, ma2, hMax, hMin, ma1Arr: [], ma2Arr: [], plot0: [], plot1: [], plot2: [], plot3: [], fillColors: [],
        markers: [], barColors: [],
        steps: [rma, ma1, ma2, hMax, hMin], vars: { risePrev: NaN, fallPrev: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors];
      s.series = [s.ma1Arr, s.ma2Arr, s.plot0, s.plot1, s.plot2, s.plot3, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      const volume = b.volume ?? NaN;
      // AD_ratio = nz(ta.change(close) / ta.tr(true))
      const tr = i === 0 ? b.high - b.low
        : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1]!.close), Math.abs(b.low - bars[i - 1]!.close));
      const ch = i === 0 ? NaN : b.close - bars[i - 1]!.close;
      const r = nz(tr === 0 ? NaN : ch / tr);
      const ad = (1 - cfg.adWeight) * r + Math.sign(r) * cfg.adWeight;
      const vol = cfg.priceEnable ? volume * ((b.high + b.low + b.close) / 3) : volume;
      const admf = s.rma.step(vol * ad) ?? NaN;
      const ma1 = s.ma1.step(admf, volume);
      const ma2 = s.ma2.step(ma1, volume);
      s.ma1Arr[i] = ma1;
      s.ma2Arr[i] = ma2;
      const hist = ma1 - ma2;
      const histMax = s.hMax.step(hist) ?? NaN;
      const histMin = s.hMin.step(hist) ?? NaN;
      const histColor = gt(hist, 0) ? HIST_UP : HIST_DOWN;

      if (cfg.colorBars) {
        let c: string | null;
        if (cfg.colorGrad) {
          // histGrad = 100 * hist / histRange: a plain division (x / 0 is +-infinity, 0 / 0 NaN); color.from_gradient
          // uses the infinite value
          const grad = (100 * hist) / (histMax - histMin);
          c = gt(hist, 0)
            ? color.from_gradient(grad, 0, 100, String(color.new('#bdffbd', 0)), String(color.new('#00ff00', 0)))
            : color.from_gradient(grad, -100, 0, String(color.new('#ff0000', 0)), String(color.new('#ffbdbd', 0)));
        } else if (cfg.colorPlusMinus) {
          const m = ma1;
          const h = hist;
          c = gt(m, 0) && gt(h, 0) ? String(color.new('#00ff00', 10))
            : gt(m, 0) && lt(h, 0) ? String(color.new('#ffaaaa', 10))
              : lt(m, 0) && lt(h, 0) ? String(color.new('#ff0000', 10))
                : lt(m, 0) && gt(h, 0) ? String(color.new('#aaffaa', 10))
                  : null;
        } else {
          c = gt(hist, 0) ? BARS_UP : BARS_DOWN;
        }
        if (c !== null) s.barColors.push({ time: b.time, color: c });
      }

      // Markers (plotshape, shape.circle, location.absolute, size.tiny)
      const m1 = s.ma1Arr;
      const m2 = s.ma2Arr;
      const rising = (x: number[], j: number) => j >= 1 && gt(x[j]!, x[j - 1]!); // ta.rising(x, 1)
      const falling = (x: number[], j: number) => j >= 1 && lt(x[j]!, x[j - 1]!); // ta.falling(x, 1)
      let under = NaN;
      let over = NaN;
      if (cfg.crossMrk) {
        // ta.crossunder(ma2, ma1): ma2 < ma1 and ma2[1] >= ma1[1]; ta.crossover(ma2, ma1): ma2 > ma1 and ma2[1] <= ma1[1];
        // both compare exactly (no 1e-10 tolerance; na compares false)
        if (i > 0 && ma2 < ma1 && m2[i - 1]! >= m1[i - 1]!) under = ma1;
        if (i > 0 && ma2 > ma1 && m2[i - 1]! <= m1[i - 1]!) over = ma2;
      } else {
        // ta.rising(ma1[1], 1) and not ta.rising(ma1, 1); ta.falling(ma1[1], 1) and not ta.falling(ma1, 1)
        // Pine v6 `and` is lazy: `not ta.rising(ma1, 1)` / `not ta.falling(ma1, 1)` only run on the bars where the left
        // side is true, so they compare ma1 with its value on the previous such bar (na before the first one)
        if (i > 0 && rising(m1, i - 1)) {
          if (!gt(ma1, v.risePrev)) under = ma1;
          v.risePrev = ma1;
        }
        if (i > 0 && falling(m1, i - 1)) {
          if (!lt(ma1, v.fallPrev)) over = ma1;
          v.fallPrev = ma1;
        }
      }
      // plotshape(..., title = 'Signal crossunder') = shape0, plotshape(..., title = 'Signal crossover') = shape1
      if (!isNaN(under)) {
        s.markers.push({ time: b.time, position: 'atPriceMiddle', price: under, shape: 'circle', color: ADMF_COLOR, size: 'tiny', id: 'shape0' });
      }
      if (!isNaN(over)) {
        s.markers.push({ time: b.time, position: 'atPriceMiddle', price: over, shape: 'circle', color: SIGNAL_COLOR, size: 'tiny', id: 'shape1' });
      }

      s.plot0[i] = { time: b.time, value: cfg.showADMF ? admf : NaN, color: ADMF_COLOR };
      s.plot1[i] = { time: b.time, value: ma1, color: SMOOTHED_COLOR };
      s.plot2[i] = { time: b.time, value: ma2, color: SIGNAL_COLOR };
      s.plot3[i] = { time: b.time, value: cfg.showHist ? hist : NaN, color: histColor };
      // fill(ma1Plot, ma2Plot, color = fillRibbon ? histColor : na)
      s.fillColors[i] = cfg.fillRibbon ? histColor : 'transparent';
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        hlines: [{ value: 0, options: { title: 'Zero line', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } }],
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdMoneyFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdMoneyFlowInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdMoneyFlow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
