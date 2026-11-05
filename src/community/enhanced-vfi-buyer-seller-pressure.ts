/**
 * Enhanced VFI Buyer/Seller Pressure
 *
 * Buyer pressure (close - open) / (high - low) and seller pressure (open - close) / (high - low), drawn as histograms
 * scaled by 100 / max(buyer, seller, threshold): green / red when the pressure reaches the threshold, gray when
 * neither does. The background shows the same three states. The Volume Flow Indicator (VFI) is the sum over
 * `vfiLength` bars of the volume (capped at `vcoef` times its average) signed by the typical price change when this
 * change exceeds `coef` times the 30-bar stdev of the log returns times the close, divided by the average volume of
 * the previous bar, optionally smoothed by a 3-bar SMA; an EMA signal line and circles at their crosses.
 * Alerts (alertcondition, `alerts` of the result): 'VFI Crossover' / 'VFI Crossunder' (VFI crosses its EMA),
 * 'Strong Buying Pressure' / 'Strong Selling Pressure' (pressure above the threshold) and 'Neutral Zone'.
 *
 * Reference: "Enhanced VFI Buyer/Seller Pressure" by ask2maniish
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EnhancedVfiBuyerSellerPressureInputs {
  /** Pressure threshold of a strong buyer / seller bar */
  pressureThreshold: number;
  /** VFI length */
  vfiLength: number;
  /** Coefficient of the cutoff threshold */
  coef: number;
  /** Maximum volume cutoff multiplier */
  vcoef: number;
  /** EMA length of the signal line */
  signalLength: number;
  /** Smooth the VFI with a 3-bar SMA */
  smoothVfi: boolean;
}

export const defaultInputs: EnhancedVfiBuyerSellerPressureInputs = {
  pressureThreshold: 0.75,
  vfiLength: 130,
  coef: 0.2,
  vcoef: 2.5,
  signalLength: 5,
  smoothVfi: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pressureThreshold', type: 'float', title: 'Pressure Threshold', defval: 0.75, min: 0, step: 0.01 },
  { id: 'vfiLength', type: 'int', title: 'VFI Length', defval: 130 },
  { id: 'coef', type: 'float', title: 'Coefficient', defval: 0.2 },
  { id: 'vcoef', type: 'float', title: 'Max. Volume Cutoff', defval: 2.5 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 5 },
  { id: 'smoothVfi', type: 'bool', title: 'Smooth VFI?', defval: true },
];

const VFI_COL = String(color.new(color.aqua, 0));
const VFIMA_COL = String(color.new(color.yellow, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buyer Pressure', color: color.green, lineWidth: 5, style: 'histogram' },
  { id: 'plot1', title: 'Seller Pressure', color: color.red, lineWidth: 5, style: 'histogram' },
  { id: 'plot2', title: 'VFI', color: VFI_COL, lineWidth: 2 },
  { id: 'plot3', title: 'VFI EMA', color: VFIMA_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'Enhanced VFI Buyer/Seller Pressure',
  shortTitle: 'Enhanced VFI Buyer/Seller Pressure',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.max: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
/** Plots show +-infinity as na */
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface VfiRun extends BarRunState<Record<string, never>> {
  stdev: ReturnType<typeof taStep.stdev>;
  smaVol: ReturnType<typeof taStep.sma>;
  smooth: ReturnType<typeof taStep.sma>;
  ema: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  typical: number[];
  smaVolArr: number[];
  vcp: number[];
  buyerPlot: Point[];
  sellerPlot: Point[];
  vfiPlot: Point[];
  vfimaPlot: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EnhancedVfiBuyerSellerPressureInputs>): BarStudy<VfiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const th = cfg.pressureThreshold;
  const buyGreen = color.green;
  const buyFaded = String(color.new(color.green, 70));
  const sellRed = color.red;
  const sellFaded = String(color.new(color.red, 70));
  const bgBuy = String(color.new(color.green, 85));
  const bgSell = String(color.new(color.red, 85));
  const bgNeutral = String(color.new(color.gray, 95));
  /** The array of the vfi_length last vcp values, filled again on each bar */
  let sumVcp: number[] = [];
  return {
    init() {
      sumVcp = new Array(cfg.vfiLength).fill(0);
      const s: VfiRun = {
        stdev: taStep.stdev(), smaVol: taStep.sma(), smooth: taStep.sma(), ema: taStep.ema(cfg.signalLength),
        over: taStep.crossover(), under: taStep.crossunder(),
        typical: [], smaVolArr: [], vcp: [], buyerPlot: [], sellerPlot: [], vfiPlot: [], vfimaPlot: [], bgColors: [],
        markers: [], flags: [[], [], [], [], []], times: [[], [], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.stdev, s.smaVol, s.smooth, s.ema, s.over, s.under];
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.typical, s.smaVolArr, s.vcp, s.buyerPlot, s.sellerPlot, s.vfiPlot, s.vfimaPlot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Buyer / seller pressure (plain division: x / 0 is +-infinity, 0 / 0 na)
      const buyerPressure = (b.close - b.open) / (b.high - b.low);
      const sellerPressure = (b.open - b.close) / (b.high - b.low);
      const strongBuy = ge(buyerPressure, th);
      const strongSell = ge(sellerPressure, th);
      const neutral = !strongBuy && !strongSell;
      s.bgColors.push({ time: b.time, color: strongBuy ? bgBuy : strongSell ? bgSell : bgNeutral });
      const maxPressure = max(max(buyerPressure, sellerPressure), th);
      const histogramScale = gt(maxPressure, 0) ? 100 / maxPressure : 1;
      s.buyerPlot[i] = {
        time: b.time, value: fin(buyerPressure * histogramScale),
        color: strongBuy ? buyGreen : neutral ? color.gray : buyFaded,
      };
      s.sellerPlot[i] = {
        time: b.time, value: fin(sellerPressure * histogramScale),
        color: strongSell ? sellRed : neutral ? color.gray : sellFaded,
      };

      // VFI
      const typical = (b.high + b.low + b.close) / 3;
      s.typical[i] = typical;
      const inter = i > 0 ? Math.log(typical) - Math.log(s.typical[i - 1]) : NaN;
      const vinter = s.stdev.step(inter, 30);
      const volume = b.volume ?? NaN;
      s.smaVolArr[i] = s.smaVol.step(volume, cfg.vfiLength);
      const cutoff = cfg.coef * vinter * b.close;
      const vave = i > 0 ? s.smaVolArr[i - 1] : NaN; // ta.sma(volume, vfi_length)[1]
      const vmax = vave * cfg.vcoef;
      const vc = lt(volume, vmax) ? volume : vmax;
      const mf = i > 0 ? typical - s.typical[i - 1] : NaN;
      s.vcp[i] = gt(mf, cutoff) ? vc : lt(mf, -cutoff) ? -vc : 0;
      // sum_vcp = array.new_float(vfi_length, 0.0); array.set(sum_vcp, k, vcp[k]) for k = 0 .. vfi_length - 1
      for (let k = 0; k <= cfg.vfiLength - 1; k++) array.set(sumVcp, k, i - k >= 0 ? s.vcp[i - k] : NaN);
      const raw = array.sum(sumVcp) / vave;
      // ma(x, y) => smooth_vfi ? ta.sma(x, y) : x
      const vfi = cfg.smoothVfi ? s.smooth.step(raw, 3) : raw;
      const vfima = s.ema.step(vfi);
      const crossoverVfi = s.over.step(vfi, vfima);
      const crossunderVfi = s.under.step(vfi, vfima);
      s.vfiPlot[i] = { time: b.time, value: fin(vfi), color: VFI_COL };
      s.vfimaPlot[i] = { time: b.time, value: fin(vfima), color: VFIMA_COL };
      if (Number.isFinite(vfi)) {
        // plotshape(crossover_vfi ? vfi : na, "VFI Crossover", shape.circle, location.absolute, color.aqua, size.auto)
        if (crossoverVfi) {
          s.markers.push({ time: b.time, position: 'atPriceMiddle', price: vfi, shape: 'circle', color: color.aqua, size: 'auto', id: 'shape0' });
        }
        // plotshape(crossunder_vfi ? vfi : na, "VFI Crossunder", shape.circle, location.absolute, color.yellow, size.auto)
        if (crossunderVfi) {
          s.markers.push({ time: b.time, position: 'atPriceMiddle', price: vfi, shape: 'circle', color: color.yellow, size: 'auto', id: 'shape1' });
        }
      }
      // alertcondition(crossover_vfi) / (crossunder_vfi) / (buyer_pressure > pressure_threshold) /
      //   (seller_pressure > pressure_threshold) / (neutral_signal)
      const flags = [crossoverVfi, crossunderVfi, gt(buyerPressure, th), gt(sellerPressure, th), neutral];
      for (let k = 0; k < 5; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.buyerPlot.slice(), plot1: s.sellerPlot.slice(), plot2: s.vfiPlot.slice(), plot3: s.vfimaPlot.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dotted', linewidth: 1 } }],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EnhancedVfiBuyerSellerPressureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EnhancedVfiBuyerSellerPressureInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'VFI Crossover', message: 'VFI has crossed above the EMA.' },
  { id: 'alert1', title: 'VFI Crossunder', message: 'VFI has crossed below the EMA.' },
  { id: 'alert2', title: 'Strong Buying Pressure', message: 'Buyer pressure exceeds the threshold.' },
  { id: 'alert3', title: 'Strong Selling Pressure', message: 'Seller pressure exceeds the threshold.' },
  { id: 'alert4', title: 'Neutral Zone', message: 'Buyer and seller pressures are in the neutral range.' },
];

export const EnhancedVfiBuyerSellerPressure = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
