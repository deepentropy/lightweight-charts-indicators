/**
 * FlowShift Oscillator
 *
 * Dislocation of hl2 from a baseline moving average (SMA / EMA / RMA / WMA / VWMA). Its 14-bar change is divided
 * by an EMA (24) of its standard deviation (24), the EMA (24) drift of that ratio is removed, the result is squashed
 * to -1..1 with x / (1 + |x|) and smoothed by two EMAs (5). Guides at +- the 88th percentile (linear interpolation)
 * of |oscillator| over 500 bars. BUY / SELL triangles mark a cross of the oscillator over / under its value 2 bars
 * earlier below the lower guide / above the upper guide. The baseline is drawn on the price chart and the candles
 * are tinted by the oscillator sign.
 *
 * Reference: "FlowShift Oscillator" by BOSWaves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BOSWaves
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface FlowshiftOscillatorInputs {
  /** Baseline moving average type */
  maType: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** Baseline moving average length */
  maLen: number;
  upFill: string;
  dnFill: string;
  upLine: string;
  dnLine: string;
  maCore: string;
  maGlow: string;
  /** Show the baseline moving average */
  showMA: boolean;
  /** Show the cross signals */
  showSig: boolean;
  /** Tint the candles by the oscillator sign */
  paintBars: boolean;
}

export const defaultInputs: FlowshiftOscillatorInputs = {
  maType: 'SMA',
  maLen: 40,
  upFill: '#4ADE80',
  dnFill: '#FB7185',
  upLine: '#166534',
  dnLine: '#7F1D1D',
  maCore: '#1D4ED8',
  maGlow: '#60A5FA',
  showMA: true,
  showSig: true,
  paintBars: true,
};

const GRP_MA = 'Baseline MA';
const GRP_VIS = 'Visuals';

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: GRP_MA },
  { id: 'maLen', type: 'int', title: 'Length', defval: 40, min: 10, max: 100, group: GRP_MA },
  { id: 'upFill', type: 'color', title: 'Up Area', defval: '#4ADE80', group: GRP_VIS },
  { id: 'dnFill', type: 'color', title: 'Down Area', defval: '#FB7185', group: GRP_VIS },
  { id: 'upLine', type: 'color', title: 'Up Line', defval: '#166534', group: GRP_VIS },
  { id: 'dnLine', type: 'color', title: 'Down Line', defval: '#7F1D1D', group: GRP_VIS },
  { id: 'maCore', type: 'color', title: 'MA Core', defval: '#1D4ED8', group: GRP_VIS },
  { id: 'maGlow', type: 'color', title: 'MA Glow', defval: '#60A5FA', group: GRP_VIS },
  { id: 'showMA', type: 'bool', title: 'Show Baseline MA', defval: true, group: GRP_VIS },
  { id: 'showSig', type: 'bool', title: 'Show Cross Signals', defval: true, group: GRP_VIS },
  { id: 'paintBars', type: 'bool', title: 'Tint Candles by MA Bias', defval: true, group: GRP_VIS },
];

const GUIDE = String(color.new(color.gray, 40));
const GUIDE_FILL = String(color.new(color.gray, 88));

// plot(baseMA, ..., force_overlay = true, display = showMA ? display.all : display.none): `visible` = the input id
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Baseline MA Glow', color: String(color.new('#60A5FA', 75)), lineWidth: 8, forceOverlay: true, visible: 'showMA' },
  { id: 'plot1', title: 'Baseline MA', color: '#1D4ED8', lineWidth: 2, forceOverlay: true, visible: 'showMA' },
  { id: 'plot2', title: 'FlowShift Area', color: String(color.new('#4ADE80', 35)), lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'FlowShift Line', color: '#166534', lineWidth: 2 },
  { id: 'plot4', title: 'Zero', color: String(color.new(color.gray, 0)), lineWidth: 1 },
  { id: 'plot5', title: 'Top Guide', color: GUIDE, lineWidth: 1 },
  { id: 'plot6', title: 'Bottom Guide', color: GUIDE, lineWidth: 1 },
];

export const metadata = {
  title: 'FlowShift Oscillator',
  shortTitle: 'FlowShift Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/**
 * `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time: the window kept sorted as the
 * oakscriptjs array function keeps it (the new value inserted before the first value `>=` it, then the value of the
 * bar leaving the window removed), read with the value of the current bar without changing the kept window.
 */
class PercentileLinear implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  private v = NaN;
  private k = 0;
  private out = -1;
  private stepped = false;

  constructor(private readonly length: number, private readonly percentage: number) {}

  step(v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.v = v;
    this.k = k;
    const i = this.count;
    if (i >= this.length) {
      const o = this.bars.indexOf(i - this.length);
      this.out = o < k ? o : o + 1;
    } else {
      this.out = -1;
    }
    this.stepped = true;
    if (i < this.length - 1) return NaN;
    const length = this.length;
    const pos = (this.percentage / 100) * length - 0.5;
    if (pos <= 0) return this.at(0);
    if (pos >= length - 1) return this.at(length - 1);
    const lo = Math.floor(pos);
    const a = this.at(lo);
    return a + (pos - lo) * (this.at(lo + 1) - a);
  }

  /** The value at index `r` of the sorted window with the value of the current bar */
  private at(r: number): number {
    const p = this.out >= 0 && r >= this.out ? r + 1 : r;
    if (p < this.k) return this.values[p]!;
    if (p === this.k) return this.v;
    return this.values[p - 1]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.count;
    this.values.splice(this.k, 0, this.v);
    this.bars.splice(this.k, 0, i);
    if (this.out >= 0) {
      this.values.splice(this.out, 1);
      this.bars.splice(this.out, 1);
    }
    this.count++;
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface FlowshiftRun extends BarRunState<Record<string, never>> {
  ma: { step(v: number, volume: number): number; commit(): void };
  dev: ReturnType<typeof taStep.stdev>;
  volEwma: ReturnType<typeof taStep.ema>;
  drift: ReturnType<typeof taStep.ema>;
  lev1: ReturnType<typeof taStep.ema>;
  lev2: ReturnType<typeof taStep.ema>;
  pct: PercentileLinear;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDn: ReturnType<typeof taStep.crossunder>;
  disloc: number[];
  flowOsc: number[];
  plots: Point[][];
  barColors: BarColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<FlowshiftOscillatorInputs>): BarStudy<FlowshiftRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Fixed parameters
  const winLen = 14;
  const scaleLen = 24;
  const smoothA = 5;
  const smoothB = 5;
  const thrPct = 88;
  const nz = (v: number) => (Number.isFinite(v) ? v : 0);
  const oscFillUp = String(color.new(cfg.upFill, 35));
  const oscFillDn = String(color.new(cfg.dnFill, 35));
  const oscLineUp = String(color.new(cfg.upLine, 0));
  const oscLineDn = String(color.new(cfg.dnLine, 0));
  const glow = String(color.new(cfg.maGlow, 75));
  const biasUp = String(color.new(cfg.upLine, 65));
  const biasDn = String(color.new(cfg.dnLine, 65));
  const zeroCol = String(color.new(color.gray, 0));
  const maStep = (): FlowshiftRun['ma'] => {
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(cfg.maLen); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(cfg.maLen); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLen), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(cfg.maLen); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.sma(); return { step: (v) => m.step(v, cfg.maLen), commit: () => m.commit() }; }
    }
  };
  return {
    init() {
      const s: FlowshiftRun = {
        ma: maStep(), dev: taStep.stdev(), volEwma: taStep.ema(scaleLen), drift: taStep.ema(Math.max(2, scaleLen)),
        lev1: taStep.ema(smoothA), lev2: taStep.ema(smoothB), pct: new PercentileLinear(500, thrPct),
        crossUp: taStep.crossover(), crossDn: taStep.crossunder(),
        disloc: [], flowOsc: [], plots: [[], [], [], [], [], [], []], barColors: [], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ma, s.dev, s.volEwma, s.drift, s.lev1, s.lev2, s.pct, s.crossUp, s.crossDn];
      s.lists = [s.markers];
      s.series = [s.disloc, s.flowOsc, ...s.plots, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // baseMA = f_ma(hl2, maLen, maType)
      const maSrc = (b.high + b.low) / 2;
      const baseMA = s.ma.step(maSrc, b.volume ?? NaN);
      const d = maSrc - baseMA;
      s.disloc[i] = d;
      // momWin = disloc - nz(disloc[winLen])
      const momWin = d - (i >= winLen ? nz(s.disloc[i - winLen]) : 0);
      const volEWMA = s.volEwma.step(s.dev.step(d, scaleLen));
      const normRaw = momWin / (volEWMA + 1e-10);
      const drift = s.drift.step(normRaw);
      // f_squash(x) = x / (1 + |x|)
      const dd = normRaw - drift;
      const squ = dd / (1.0 + Math.abs(dd));
      const flowOsc = s.lev2.step(s.lev1.step(squ));
      s.flowOsc[i] = flowOsc;
      // thrDyn = ta.percentile_linear_interpolation(math.abs(flowOsc), 500, thrPct); top = thrDyn, bot = -thrDyn
      const top = s.pct.step(Math.abs(flowOsc));
      const bot = -top;
      const isUp = ge(flowOsc, 0);

      // sigUp = showSig and ta.crossover(flowOsc, nz(flowOsc[2])) and flowOsc < bot (lazy `and`: the crossings only
      // run when showSig is true, an input constant, so on every bar or on none)
      if (cfg.showSig) {
        const prev2 = i >= 2 ? nz(s.flowOsc[i - 2]) : 0;
        const sigUp = s.crossUp.step(flowOsc, prev2) && lt(flowOsc, bot);
        const sigDn = s.crossDn.step(flowOsc, prev2) && gt(flowOsc, top);
        // plotshape(sigUp, "FS Up", shape.triangleup, size.tiny, upLine, location.belowbar, text = "BUY",
        //   textcolor = color.white, force_overlay = true)
        if (sigUp) {
          s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.upLine, size: 'tiny',
            text: 'BUY', textColor: color.white, forceOverlay: true });
        }
        if (sigDn) {
          s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.dnLine, size: 'tiny',
            text: 'SELL', textColor: color.white, forceOverlay: true });
        }
      }

      const p = s.plots;
      p[0][i] = { time, value: baseMA, color: glow };
      p[1][i] = { time, value: baseMA, color: cfg.maCore };
      p[2][i] = { time, value: flowOsc, color: isUp ? oscFillUp : oscFillDn };
      p[3][i] = { time, value: flowOsc, color: isUp ? oscLineUp : oscLineDn };
      p[4][i] = { time, value: 0, color: zeroCol };
      p[5][i] = { time, value: top, color: GUIDE };
      p[6][i] = { time, value: bot, color: GUIDE };
      // barcolor(paintBars ? (isUp ? color.new(upLine, 65) : color.new(dnLine, 65)) : na)
      if (cfg.paintBars) s.barColors[i] = { time, color: isUp ? biasUp : biasDn };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        fills: [
          // fill(tL, mid, color = color.new(color.gray, 88)); fill(bL, mid, ...)
          { plot1: 'plot5', plot2: 'plot4', colors: new Array<string>(n).fill(GUIDE_FILL) },
          { plot1: 'plot6', plot2: 'plot4', colors: new Array<string>(n).fill(GUIDE_FILL) },
        ],
        barColors: cfg.paintBars ? s.barColors.slice() : [],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FlowshiftOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FlowshiftOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FlowshiftOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
