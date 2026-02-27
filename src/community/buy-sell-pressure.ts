/**
 * BUY & SELL VOLUME TO PRICE PRESSURE
 *
 * Vadim Gimelfarb's Bull/Bear Power Balance algorithm applied to volume.
 * Plots: SELLING (columns), BUYING (columns), SPAvg (line), BPAvg (line),
 * plus Buy-to-Sell Convergence/Divergence oscillators: VPO1, VPO2, VPH.
 *
 * Reference: TradingView "BUY & SELL VOLUME TO PRICE PRESSURE by @XeL_Arjona" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

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

export function calculate(bars: Bar[], inputs: Partial<BuySellPressureInputs> = {}): IndicatorResult {
  const { signal, long } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Gimelfarb Bull/Bear Power Balance
  const bpArr: number[] = new Array(n);
  const spArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
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
    bpArr[i] = bp;
    spArr[i] = sp;
  }

  // Volume and TP
  const volArr = bars.map(b => Math.max(b.volume ?? 0, 1));

  const tpArr: number[] = new Array(n);
  const bpvArr: number[] = new Array(n);
  const spvArr: number[] = new Array(n);
  const tpvArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    tpArr[i] = bpArr[i] + spArr[i];
    bpvArr[i] = tpArr[i] === 0 ? 0 : (bpArr[i] / tpArr[i]) * volArr[i];
    spvArr[i] = tpArr[i] === 0 ? 0 : (spArr[i] / tpArr[i]) * volArr[i];
    tpvArr[i] = bpvArr[i] + spvArr[i];
  }

  // Double EMA averages for RAW: BPVavg = ema(ema(BPV, signal), signal)
  const bpvSeries = new Series(bars, (_b, i) => bpvArr[i]);
  const spvSeries = new Series(bars, (_b, i) => spvArr[i]);
  const tpvSeries = new Series(bars, (_b, i) => tpvArr[i]);

  const bpvE1 = ta.ema(bpvSeries, signal).toArray();
  const bpvE1Series = new Series(bars, (_b, i) => bpvE1[i] ?? 0);
  const bpvAvgArr = ta.ema(bpvE1Series, signal).toArray();

  const spvE1 = ta.ema(spvSeries, signal).toArray();
  const spvE1Series = new Series(bars, (_b, i) => spvE1[i] ?? 0);
  const spvAvgArr = ta.ema(spvE1Series, signal).toArray();

  const tpvW1 = ta.wma(tpvSeries, signal).toArray();
  const tpvW1Series = new Series(bars, (_b, i) => tpvW1[i] ?? 0);
  const tpvAvgArr = ta.ema(tpvW1Series, signal).toArray();

  // Conditional columns: show dominant as positive, counterforce as negative
  const warmup = Math.max(signal * 2, long) + signal;

  const sellingPlot: { time: number; value: number }[] = [];
  const buyingPlot: { time: number; value: number }[] = [];
  const spAvgPlot: { time: number; value: number }[] = [];
  const bpAvgPlot: { time: number; value: number }[] = [];
  const vpo1Plot: { time: number; value: number; color?: string }[] = [];
  const vpo2Plot: { time: number; value: number; color?: string }[] = [];
  const vphPlot: { time: number; value: number; color?: string }[] = [];

  // VPO: Volume Pressure Oscillator
  // vpo1 = ((BPVavg - SPVavg) / TPVavg) * 100
  // For normalized version (vpo2), need additional processing
  const bpSeries = new Series(bars, (_b, i) => bpArr[i]);
  const spSeries = new Series(bars, (_b, i) => spArr[i]);
  const bpEmaLong = ta.ema(bpSeries, long).toArray();
  const spEmaLong = ta.ema(spSeries, long).toArray();
  const volSeries = new Series(bars, (_b, i) => volArr[i]);
  const volEmaLong = ta.ema(volSeries, long).toArray();

  // Normalized versions
  const bnArr: number[] = new Array(n);
  const snArr: number[] = new Array(n);
  const tnArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const vn = volEmaLong[i] ? volArr[i] / (volEmaLong[i] ?? 1) : 0;
    bnArr[i] = bpEmaLong[i] ? ((bpArr[i] / (bpEmaLong[i] ?? 1)) * vn) * 100 : 0;
    snArr[i] = spEmaLong[i] ? ((spArr[i] / (spEmaLong[i] ?? 1)) * vn) * 100 : 0;
    tnArr[i] = bnArr[i] + snArr[i];
  }

  const bnSeries = new Series(bars, (_b, i) => bnArr[i]);
  const snSeries = new Series(bars, (_b, i) => snArr[i]);
  const tnSeries = new Series(bars, (_b, i) => tnArr[i]);

  const nbfW = ta.wma(bnSeries, signal).toArray();
  const nbfWSeries = new Series(bars, (_b, i) => nbfW[i] ?? 0);
  const nbfArr = ta.ema(nbfWSeries, signal).toArray();

  const nsfW = ta.wma(snSeries, signal).toArray();
  const nsfWSeries = new Series(bars, (_b, i) => nsfW[i] ?? 0);
  const nsfArr = ta.ema(nsfWSeries, signal).toArray();

  const tpfW = ta.wma(tnSeries, signal).toArray();
  const tpfWSeries = new Series(bars, (_b, i) => tpfW[i] ?? 0);
  const tpfArr = ta.ema(tpfWSeries, signal).toArray();

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      sellingPlot.push({ time: t, value: NaN });
      buyingPlot.push({ time: t, value: NaN });
      spAvgPlot.push({ time: t, value: NaN });
      bpAvgPlot.push({ time: t, value: NaN });
      vpo1Plot.push({ time: t, value: NaN });
      vpo2Plot.push({ time: t, value: NaN });
      vphPlot.push({ time: t, value: NaN });
      continue;
    }

    const bpv = bpvArr[i];
    const spv = spvArr[i];
    // Columns: dominant positive, counterforce negative
    const bpCon = bpv > spv ? bpv : -Math.abs(bpv);
    const spCon = spv > bpv ? spv : -Math.abs(spv);

    sellingPlot.push({ time: t, value: spCon });
    buyingPlot.push({ time: t, value: bpCon });
    spAvgPlot.push({ time: t, value: spvAvgArr[i] ?? NaN });
    bpAvgPlot.push({ time: t, value: bpvAvgArr[i] ?? NaN });

    // VPO1 = ((BPVavg - SPVavg) / TPVavg) * 100
    const bpa = bpvAvgArr[i] ?? 0;
    const spa = spvAvgArr[i] ?? 0;
    const tpa = tpvAvgArr[i] ?? 1;
    const vpo1 = ((bpa - spa) / tpa) * 100;

    // VPO2 = ((nbf - nsf) / tpf) * 100
    const nbf = nbfArr[i] ?? 0;
    const nsf = nsfArr[i] ?? 0;
    const tpf = tpfArr[i] ?? 1;
    const vpo2 = ((nbf - nsf) / tpf) * 100;

    const vph = isNaN(vpo1) || isNaN(vpo2) ? 0 : vpo1 - vpo2;

    vpo1Plot.push({ time: t, value: vpo1, color: vpo1 > 0 ? '#4CAF50' : '#EF5350' });
    vpo2Plot.push({ time: t, value: vpo2, color: vpo2 > 0 ? '#4CAF50' : '#EF5350' });
    const prevVph = i > warmup ? (vpo1Plot[i - 1 - 0] ? 0 : 0) : 0;
    vphPlot.push({ time: t, value: vph, color: i > 0 && vph > (vphPlot[vphPlot.length - 2]?.value ?? 0) ? '#2196F3' : '#BA00AA' });
  }

  // Fix VPH color: compare to previous VPH value
  for (let j = 1; j < vphPlot.length; j++) {
    if (!isNaN(vphPlot[j].value) && !isNaN(vphPlot[j - 1].value)) {
      (vphPlot[j] as { time: number; value: number; color?: string }).color =
        vphPlot[j].value > vphPlot[j - 1].value ? '#2196F3' : '#BA00AA';
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      selling: sellingPlot,
      buying: buyingPlot,
      spAvg: spAvgPlot,
      bpAvg: bpAvgPlot,
      vpo1: vpo1Plot,
      vpo2: vpo2Plot,
      vph: vphPlot,
    },
  };
}

export const BuySellPressure = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
