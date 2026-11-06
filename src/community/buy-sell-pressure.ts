/**
 * BUY & SELL VOLUME TO PRICE PRESSURE
 *
 * Vadim Gimelfarb's Bull/Bear Power Balance algorithm applied to volume.
 * Plots: SELLING (columns), BUYING (columns), SPAvg (line), BPAvg (line),
 * plus Buy-to-Sell Convergence/Divergence oscillators: VPO1, VPO2, VPH.
 *
 * Reference: "BUY & SELL VOLUME TO PRICE PRESSURE by @XeL_Arjona" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BuySellPressureInputs {
  signal: number;
  long: number;
}

export const defaultInputs: BuySellPressureInputs = {
  signal: 3,
  long: 27,
};

export const inputConfig: InputConfig[] = [
  { id: 'signal', type: 'int', title: 'FastMA Periods', defval: 3, min: 1 },
  { id: 'long', type: 'int', title: 'Conv/Div Lookback', defval: 27, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'selling', title: 'SELLING', color: '#EF5350', lineWidth: 3, style: 'columns' },
  { id: 'buying', title: 'BUYING', color: '#26A69A', lineWidth: 3, style: 'columns' },
  { id: 'spAvg', title: 'SPAvg', color: '#EF5350', lineWidth: 2 },
  { id: 'bpAvg', title: 'BPAvg', color: '#26A69A', lineWidth: 2 },
  { id: 'vpo1', title: 'VPO1', color: '#4CAF50', lineWidth: 3 },
  { id: 'vpo2', title: 'VPO2', color: '#4CAF50', lineWidth: 1 },
  { id: 'vph', title: 'VPH', color: '#2196F3', lineWidth: 3, style: 'columns' },
];

export const metadata = {
  title: 'Buy & Sell Pressure',
  shortTitle: 'BSVP',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface BspRun extends BarRunState<Record<string, never>> {
  bpvE1: ReturnType<typeof taStep.ema>;
  bpvAvg: ReturnType<typeof taStep.ema>;
  spvE1: ReturnType<typeof taStep.ema>;
  spvAvg: ReturnType<typeof taStep.ema>;
  tpvW1: ReturnType<typeof taStep.wma>;
  tpvAvg: ReturnType<typeof taStep.ema>;
  bpEmaLong: ReturnType<typeof taStep.ema>;
  spEmaLong: ReturnType<typeof taStep.ema>;
  volEmaLong: ReturnType<typeof taStep.ema>;
  nbfW: ReturnType<typeof taStep.wma>;
  nbf: ReturnType<typeof taStep.ema>;
  nsfW: ReturnType<typeof taStep.wma>;
  nsf: ReturnType<typeof taStep.ema>;
  tpfW: ReturnType<typeof taStep.wma>;
  tpf: ReturnType<typeof taStep.ema>;
  /** The VPH value per bar (na before the warm-up) */
  vphValues: number[];
  plots: Point[][];
}

function study(inputs: Partial<BuySellPressureInputs>): BarStudy<BspRun, IndicatorResult> {
  const { signal, long } = { ...defaultInputs, ...inputs };
  // Conditional columns: show dominant as positive, counterforce as negative
  const warmup = Math.max(signal * 2, long) + signal;
  return {
    init() {
      const s: BspRun = {
        bpvE1: taStep.ema(signal), bpvAvg: taStep.ema(signal),
        spvE1: taStep.ema(signal), spvAvg: taStep.ema(signal),
        tpvW1: taStep.wma(), tpvAvg: taStep.ema(signal),
        bpEmaLong: taStep.ema(long), spEmaLong: taStep.ema(long), volEmaLong: taStep.ema(long),
        nbfW: taStep.wma(), nbf: taStep.ema(signal),
        nsfW: taStep.wma(), nsf: taStep.ema(signal),
        tpfW: taStep.wma(), tpf: taStep.ema(signal),
        vphValues: [],
        plots: Array.from({ length: 7 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        s.bpvE1, s.bpvAvg, s.spvE1, s.spvAvg, s.tpvW1, s.tpvAvg, s.bpEmaLong, s.spEmaLong, s.volEmaLong,
        s.nbfW, s.nbf, s.nsfW, s.nsf, s.tpfW, s.tpf,
      ];
      s.series = [s.vphValues, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      // Gimelfarb Bull/Bear Power Balance
      const c = bars[i].close;
      const o = bars[i].open;
      const h = bars[i].high;
      const l = bars[i].low;
      const pc = i > 0 ? bars[i - 1].close : c;
      const po = i > 0 ? bars[i - 1].open : o;

      let bp: number, sp: number;
      if (c < o) {
        bp = pc < po ? Math.max(h - pc, c - l) : Math.max(h - o, c - l);
        sp = pc > po ? Math.max(pc - o, h - l) : h - l;
      } else if (c > o) {
        bp = pc > po ? h - l : Math.max(o - pc, h - l);
        sp = pc > po ? Math.max(pc - l, h - c) : Math.max(o - l, h - c);
      } else {
        if (h - c > c - l) {
          bp = pc < po ? Math.max(h - pc, c - l) : h - o;
          sp = pc > po ? Math.max(pc - o, h - l) : h - l;
        } else if (h - c < c - l) {
          bp = pc > po ? h - l : Math.max(o - pc, h - l);
          sp = pc > po ? Math.max(pc - l, h - c) : o - l;
        } else {
          bp = pc > po ? Math.max(h - o, c - l) : (pc < po ? Math.max(o - pc, h - l) : h - l);
          sp = pc > po ? Math.max(pc - o, h - l) : (pc < po ? Math.max(o - l, h - c) : h - l);
        }
      }

      // Volume and TP
      const vol = Math.max(bars[i].volume ?? 0, 1);
      const tp = bp + sp;
      const bpv = tp === 0 ? 0 : (bp / tp) * vol;
      const spv = tp === 0 ? 0 : (sp / tp) * vol;
      const tpv = bpv + spv;

      // Double EMA averages for RAW: BPVavg = ema(ema(BPV, signal), signal)
      const bpvAvg = s.bpvAvg.step(s.bpvE1.step(bpv) ?? 0);
      const spvAvg = s.spvAvg.step(s.spvE1.step(spv) ?? 0);
      const tpvAvg = s.tpvAvg.step(s.tpvW1.step(tpv, signal) ?? 0);

      // VPO: Volume Pressure Oscillator
      // vpo1 = ((BPVavg - SPVavg) / TPVavg) * 100
      // For normalized version (vpo2), need additional processing
      const bpEmaLong = s.bpEmaLong.step(bp);
      const spEmaLong = s.spEmaLong.step(sp);
      const volEmaLong = s.volEmaLong.step(vol);

      // Normalized versions
      const vn = volEmaLong ? vol / (volEmaLong ?? 1) : 0;
      const bn = bpEmaLong ? ((bp / (bpEmaLong ?? 1)) * vn) * 100 : 0;
      const sn = spEmaLong ? ((sp / (spEmaLong ?? 1)) * vn) * 100 : 0;
      const tn = bn + sn;

      const nbfV = s.nbf.step(s.nbfW.step(bn, signal) ?? 0);
      const nsfV = s.nsf.step(s.nsfW.step(sn, signal) ?? 0);
      const tpfV = s.tpf.step(s.tpfW.step(tn, signal) ?? 0);

      const t = bars[i].time;
      const p = s.plots;
      if (i < warmup) {
        for (let k = 0; k < 7; k++) p[k]![i] = { time: t, value: NaN };
        s.vphValues[i] = NaN;
        return;
      }

      // Columns: dominant positive, counterforce negative
      const bpCon = bpv > spv ? bpv : -Math.abs(bpv);
      const spCon = spv > bpv ? spv : -Math.abs(spv);

      p[0]![i] = { time: t, value: spCon };
      p[1]![i] = { time: t, value: bpCon };
      p[2]![i] = { time: t, value: spvAvg ?? NaN };
      p[3]![i] = { time: t, value: bpvAvg ?? NaN };

      // VPO1 = ((BPVavg - SPVavg) / TPVavg) * 100
      const bpa = bpvAvg ?? 0;
      const spa = spvAvg ?? 0;
      const tpa = tpvAvg ?? 1;
      const vpo1 = ((bpa - spa) / tpa) * 100;

      // VPO2 = ((nbf - nsf) / tpf) * 100
      const nbf = nbfV ?? 0;
      const nsf = nsfV ?? 0;
      const tpf = tpfV ?? 1;
      const vpo2 = ((nbf - nsf) / tpf) * 100;

      const vph = isNaN(vpo1) || isNaN(vpo2) ? 0 : vpo1 - vpo2;
      s.vphValues[i] = vph;

      p[4]![i] = { time: t, value: vpo1, color: vpo1 > 0 ? '#4CAF50' : '#EF5350' };
      p[5]![i] = { time: t, value: vpo2, color: vpo2 > 0 ? '#4CAF50' : '#EF5350' };
      // VPH colour: compared to the VPH value of the bar before when both are values, else (the first value) to the
      // value two bars back (na before the warm-up: false), as the original's pass over the plot
      const prev = i > 0 ? s.vphValues[i - 1]! : NaN;
      let up: boolean;
      if (!isNaN(vph) && !isNaN(prev)) up = vph > prev;
      else up = i > 0 && vph > (i >= 2 ? s.vphValues[i - 2]! : 0);
      p[6]![i] = { time: t, value: vph, color: up ? '#2196F3' : '#BA00AA' };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          selling: p[0]!.slice(),
          buying: p[1]!.slice(),
          spAvg: p[2]!.slice(),
          bpAvg: p[3]!.slice(),
          vpo1: p[4]!.slice(),
          vpo2: p[5]!.slice(),
          vph: p[6]!.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuySellPressureInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuySellPressureInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BuySellPressure = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
