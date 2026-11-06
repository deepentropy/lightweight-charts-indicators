/**
 * Buying & Selling Pressure
 *
 * Candle metrics averaged over a period with a chosen moving average (Gaussian 10-pole filter, linear regression,
 * HMA, RMA, EMA, WMA or SMA): buying pressure = close - min(low, previous close) and selling pressure =
 * max(high, previous close) - close ("Net Move" also takes away the lower / higher wick). The pressure lines are
 * coloured by their direction (growing or falling), with a dark gradient between their average and the highest of
 * the larger pressure over three periods. Optional averages of the true range, body range, wicks (higher / lower,
 * average, total). Bars are coloured when the buying pressure falls on an up close or the selling pressure falls on
 * a down close.
 *
 * Reference: "Buying & Selling Pressure" by fract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type BSPAveragingType = 'Gaussian 10 Polar' | 'Linear Regression' | 'HMA' | 'RMA' | 'EMA' | 'WMA' | 'SMA';

export interface BuyingSellingPressureInputs {
  /** Averaging type */
  typeMA: BSPAveragingType;
  /** Averaging period */
  ln: number;
  /** Colour the price bars */
  bg: boolean;
  /** Range type: 'Pressure', or 'Net Move' (pressure less the wick) */
  typeCM: 'Pressure' | 'Net Move';
  /** Show the average true range */
  trsw: boolean;
  /** Show the average body range */
  brsw: boolean;
  /** Show the average wick range */
  awsw: boolean;
  /** Show the higher and lower wick ranges */
  wksw: boolean;
  /** Show the total wicks range */
  twsw: boolean;
}

export const defaultInputs: BuyingSellingPressureInputs = {
  typeMA: 'HMA',
  ln: 14,
  bg: true,
  typeCM: 'Pressure',
  trsw: false,
  brsw: false,
  awsw: false,
  wksw: false,
  twsw: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeMA', type: 'string', title: 'Averaging Type', defval: 'HMA',
    options: ['Gaussian 10 Polar', 'Linear Regression', 'HMA', 'RMA', 'EMA', 'WMA', 'SMA'] },
  { id: 'ln', type: 'int', title: 'Period', defval: 14, min: 1 },
  { id: 'bg', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'typeCM', type: 'string', title: 'Range Type', defval: 'Pressure', options: ['Pressure', 'Net Move'] },
  { id: 'trsw', type: 'bool', title: 'Average True Range', defval: false },
  { id: 'brsw', type: 'bool', title: 'Average Body Range', defval: false },
  { id: 'awsw', type: 'bool', title: 'Average Wick Range', defval: false },
  { id: 'wksw', type: 'bool', title: 'Higher & Lower Wicks Range', defval: false },
  { id: 'twsw', type: 'bool', title: 'Total Wicks Range', defval: false },
];

const BP_GROW = String(color.rgb(0, 206, 0));
const BP_FALL = String(color.rgb(155, 0, 255));
const SP_GROW = String(color.rgb(255, 0, 0));
const SP_FALL = String(color.rgb(245, 127, 33));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'Average Body Range', color: '#000000', lineWidth: 1, style: 'stepline' },
  { id: 'plot2', title: 'Awerage Wick', color: '#000000', lineWidth: 2 },
  { id: 'plot3', title: 'Higher Wick', color: '#2a2e39', lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Lower Wick', color: '#2a2e39', lineWidth: 1, style: 'cross' },
  { id: 'plot5', title: 'Total Wicks', color: '#787b86', lineWidth: 1, style: 'stepline' },
  { id: 'plot6', title: 'Buying Pressure', color: BP_GROW, lineWidth: 2 },
  { id: 'plot7', title: 'Selling Pressure', color: SP_GROW, lineWidth: 2 },
];

export const metadata = {
  title: 'Buying & Selling Pressure [Candle Metrics]',
  shortTitle: 'BSP',
  overlay: false,
};

// Pine compares floats with a tolerance of 1e-10; a comparison with na is false.
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const nz = (v: number) => (isNaN(v) ? 0 : v);

/**
 * gaus(source, length) of the script, one bar at a time: 10-pole Gaussian filter with `var float filter`, then
 * (filter + nz(filter[1])) / 2. The filter values are kept by bar (a bar calculated again writes its own slot).
 */
class GausStep {
  private readonly filter: number[] = [];
  private readonly alpha: number;
  private readonly p: number[];

  constructor(length: number) {
    const beta = (1 - Math.cos((2 * Math.PI) / length)) / (Math.pow(2, 0.1) - 1);
    const alpha = -beta + Math.sqrt(Math.pow(beta, 2) + 2 * beta);
    this.alpha = alpha;
    this.p = Array.from({ length: 11 }, (_v, k) => Math.pow(1 - alpha, k));
  }

  step(i: number, source: number): number {
    const { alpha, p, filter } = this;
    const f = (k: number) => nz(i - k >= 0 ? filter[i - k] : NaN);
    const v = Math.pow(alpha, 10) * source
      + 10 * (1 - alpha) * f(1)
      - 45 * p[2] * f(2)
      + 120 * p[3] * f(3)
      - 210 * p[4] * f(4)
      + 252 * p[5] * f(5)
      - 210 * p[6] * f(6)
      + 120 * p[7] * f(7)
      - 45 * p[8] * f(8)
      + 10 * p[9] * f(9)
      - p[10] * f(10);
    filter[i] = v;
    // fShift = (filter + nz(filter[1])) / 2
    return (v + f(1)) / 2;
  }

  commit(): void {}
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };
type Ma = { step(i: number, v: number): number; commit(): void };

interface BspRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  mas: (Ma | null)[];
  bsmax: WindowExtreme;
  bpma: number[];
  spma: number[];
  avg: number[];
  bsmaxArr: number[];
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<BuyingSellingPressureInputs>): BarStudy<BspRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { typeMA, ln, typeCM } = cfg;
  const ma = (length: number): Ma => {
    switch (typeMA) {
      case 'Gaussian 10 Polar': return new GausStep(length);
      case 'Linear Regression': { const m = taStep.linreg(length, 0); return { step: (_i, v) => m.step(v), commit: () => m.commit() }; }
      case 'SMA': { const m = new WindowSma(length); return { step: (_i, v) => m.step(v), commit: () => m.commit() }; }
      case 'EMA': { const m = taStep.ema(length); return { step: (_i, v) => m.step(v), commit: () => m.commit() }; }
      case 'HMA': { const m = taStep.hma(length); return { step: (_i, v) => m.step(v), commit: () => m.commit() }; }
      case 'RMA': { const m = taStep.rma(length); return { step: (_i, v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (_i, v) => m.step(v, length), commit: () => m.commit() }; }
      default: return { step: () => NaN, commit: () => {} };
    }
  };
  // the averages: atr, brma, bpma, spma, awma, lwma, hwma, twma (null: not shown, na)
  const shown = [cfg.trsw, cfg.brsw, true, true, cfg.awsw, cfg.wksw, cfg.wksw, cfg.twsw];
  // the sources and averages of one bar (scratch arrays)
  const src: number[] = new Array(8).fill(NaN);
  const out: number[] = new Array(8).fill(NaN);
  return {
    init() {
      const s: BspRun = {
        tr: taStep.tr(false), mas: shown.map((on) => (on ? ma(ln) : null)), bsmax: new WindowExtreme(false, ln * 3),
        bpma: [], spma: [], avg: [], bsmaxArr: [], plots: Array.from({ length: 8 }, () => []), barColors: [],
        vars: {}, steps: [], lists: [], series: [],
      };
      s.steps = [s.tr, ...s.mas.filter((m): m is Ma => m !== null), s.bsmax];
      s.lists = [s.barColors];
      s.series = [s.bpma, s.spma, s.avg, s.bsmaxArr, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      // Candle metrics
      const tr = s.tr.step(b.high, b.low, b.close) ?? NaN; // ta.tr: na on the first bar
      const br = Math.abs(b.close - b.open);
      const hw = b.high - Math.max(b.open, b.close);
      const lw = Math.min(b.open, b.close) - b.low;
      const tw = b.high - b.low - br;
      const aw = (hw + lw) / 2;
      // bp = close - math.min(low, close[1]) - (typeCM == 'Pressure' ? 0 : lw) (math.min with na is na)
      const bp = b.close - Math.min(b.low, prevClose) - (typeCM === 'Pressure' ? 0 : lw);
      // sp = math.max(high, close[1]) - close - (typeCM == 'Pressure' ? 0 : hw)
      const sp = Math.max(b.high, prevClose) - b.close - (typeCM === 'Pressure' ? 0 : hw);
      src[0] = tr; src[1] = br; src[2] = bp; src[3] = sp; src[4] = aw; src[5] = lw; src[6] = hw; src[7] = tw;
      for (let k = 0; k < 8; k++) {
        const m = s.mas[k];
        out[k] = m ? m.step(i, src[k]) ?? NaN : NaN;
      }
      const bpma = out[2];
      const spma = out[3];
      s.bpma[i] = bpma;
      s.spma[i] = spma;

      // bsmx = math.max(bpma, spma); bsmax = ta.highest(bsmx, ln * 3)
      s.bsmaxArr[i] = s.bsmax.step(Math.max(bpma, spma));
      s.avg[i] = (bpma + spma) / 2;

      const bpPrev = i > 0 ? s.bpma[i - 1] : NaN;
      const spPrev = i > 0 ? s.spma[i - 1] : NaN;
      // plot order: atr, brma, awma, hwma, lwma, twma
      s.plots[0][i] = { time: t, value: out[0] };
      s.plots[1][i] = { time: t, value: out[1] };
      s.plots[2][i] = { time: t, value: out[4] };
      s.plots[3][i] = { time: t, value: out[6] };
      s.plots[4][i] = { time: t, value: out[5] };
      s.plots[5][i] = { time: t, value: out[7] };
      // color = bpma > bpma[1] ? bpgrow : bpfall; color = spma > spma[1] ? spgrow : spfall
      s.plots[6][i] = { time: t, value: bpma, color: gt(bpma, bpPrev) ? BP_GROW : BP_FALL };
      s.plots[7][i] = { time: t, value: spma, color: gt(spma, spPrev) ? SP_GROW : SP_FALL };
      // barcolor(bg and bpma < bpma[1] and close > close[1] ? color.new(bpfall, 0) : na)
      // barcolor(bg and spma < spma[1] and close < close[1] ? color.new(spfall, 0) : na)  (drawn over the first)
      if (cfg.bg) {
        let c: string | null = null;
        if (gt(bpPrev, bpma) && gt(b.close, prevClose)) c = BP_FALL;
        if (gt(spPrev, spma) && gt(prevClose, b.close)) c = SP_FALL;
        if (c !== null) s.barColors.push({ time: t, color: c });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
          plot5: s.plots[5].slice(),
          plot6: s.plots[6].slice(),
          plot7: s.plots[7].slice(),
        },
        fills: [
          // fill(trp, awmap, color.new(#ffffff, 90), 'ATR AWR ZONE')
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'ATR AWR ZONE', color: String(color.new('#ffffff', 90)) } },
          // fill(lwp, hwp, color.new(#2a2e39, 40), 'LH Wicks ZONE')
          { plot1: 'plot4', plot2: 'plot3', options: { title: 'LH Wicks ZONE', color: String(color.new('#2a2e39', 40)) } },
          // fill(bpp, spp, math.avg(bpma, spma), bsmax, na, color.rgb(0, 0, 0, 25), 'High Shades')
          { plot1: 'plot6', plot2: 'plot7', options: { title: 'High Shades' }, gradient: {
            topValue: s.avg.slice(), bottomValue: s.bsmaxArr.slice(),
            topColor: new Array<string | null>(n).fill(null),
            bottomColor: new Array<string | null>(n).fill(String(color.rgb(0, 0, 0, 25))),
          } },
        ],
        markers: [],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyingSellingPressureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuyingSellingPressureInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyingSellingPressure = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
