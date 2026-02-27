/**
 * RedK Volume-Accelerated Directional Energy Ratio (VADER)
 *
 * Pine: R = (highest(2) - lowest(2)) / 2
 *       sr = change(close) / R, clamped to [-1, 1]
 *       c = sr * vola (volume acceleration)
 *       dem = f_derma(c_plus, length) / avg_vola
 *       sup = f_derma(c_minus, length) / avg_vola
 *       adp = 100 * wma(dem, DER_avg), asp = 100 * wma(sup, DER_avg)
 *       anp_s = wma(adp - asp, smooth)
 *
 * Reference: TradingView "RedK VADER v4.0" by RedKTrader
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RedKVADERInputs {
  length: number;
  DER_avg: number;
  MA_Type: string;
  smooth: number;
  showSenti: boolean;
  senti: number;
  vCalc: string;
  vlookbk: number;
}

export const defaultInputs: RedKVADERInputs = {
  length: 10,
  DER_avg: 5,
  MA_Type: 'WMA',
  smooth: 3,
  showSenti: false,
  senti: 20,
  vCalc: 'Relative',
  vlookbk: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'DER_avg', type: 'int', title: 'Average', defval: 5, min: 1 },
  { id: 'MA_Type', type: 'string', title: 'DER MA type', defval: 'WMA', options: ['WMA', 'EMA', 'SMA'] },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 3, min: 1 },
  { id: 'showSenti', type: 'bool', title: 'Sentiment', defval: false },
  { id: 'senti', type: 'int', title: 'Sentiment Length', defval: 20, min: 1 },
  { id: 'vCalc', type: 'string', title: 'Volume Calculation', defval: 'Relative', options: ['Relative', 'Full', 'None'] },
  { id: 'vlookbk', type: 'int', title: 'Lookback (for Relative)', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VADER Signal', color: '#359bfc', lineWidth: 4 },
  { id: 'plot1', title: 'Demand Energy', color: 'rgba(0, 255, 255, 0.7)', lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: 'Supply Energy', color: 'rgba(255, 165, 0, 0.7)', lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Sentiment', color: '#1b5e20', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'RedK VADER',
  shortTitle: 'VADER',
  overlay: false,
};

/** Apply MA based on type selection (Pine: f_derma) */
function derma(bars: Bar[], data: number[], len: number, maType: string): number[] {
  const s = Series.fromArray(bars, data);
  switch (maType) {
    case 'SMA': return ta.sma(s, len).toArray();
    case 'EMA': return ta.ema(s, len).toArray();
    default:    return ta.wma(s, len).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<RedKVADERInputs> = {}): IndicatorResult {
  const { length, DER_avg, MA_Type, smooth, showSenti, senti, vCalc, vlookbk } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // --- Volume acceleration ---
  // Pine: vola = v_calc == 'None' ? 1 : v_calc == 'Relative' ? stoch(v,v,v,vlookbk)/100 : v
  const volArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    volArr[i] = bars[i].volume ?? 0;
  }

  const volaArr: number[] = new Array(n);
  if (vCalc === 'None') {
    volaArr.fill(1);
  } else if (vCalc === 'Full') {
    for (let i = 0; i < n; i++) volaArr[i] = volArr[i];
  } else {
    // Relative: stoch(v, v, v, vlookbk) / 100
    const volSeries = Series.fromArray(bars, volArr);
    const stochVol = ta.stoch(volSeries, volSeries, volSeries, vlookbk).toArray();
    for (let i = 0; i < n; i++) {
      const sv = stochVol[i];
      volaArr[i] = (sv != null && !isNaN(sv)) ? sv / 100 : 1;
    }
  }

  // --- Directional energy ratio ---
  // Pine: R = (highest(2) - lowest(2)) / 2
  //        sr = change(close) / R, clamped [-1, 1]
  //        c = fixnan(sr * vola)
  const cArr: number[] = new Array(n);
  const cPlusArr: number[] = new Array(n);
  const cMinusArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    // R = (highest(high, 2) - lowest(low, 2)) / 2
    let hh: number, ll: number;
    if (i === 0) {
      hh = bars[i].high;
      ll = bars[i].low;
    } else {
      hh = Math.max(bars[i].high, bars[i - 1].high);
      ll = Math.min(bars[i].low, bars[i - 1].low);
    }
    const R = (hh - ll) / 2;

    // sr = change(close) / R
    const priceChange = i === 0 ? 0 : bars[i].close - bars[i - 1].close;
    const sr = R === 0 ? 0 : priceChange / R;

    // Clamp to [-1, 1]
    const rsr = Math.max(Math.min(sr, 1), -1);

    // c = rsr * vola (fixnan: carry forward last valid value)
    const rawC = rsr * volaArr[i];
    cArr[i] = isNaN(rawC) ? (i > 0 ? cArr[i - 1] : 0) : rawC;

    cPlusArr[i] = Math.max(cArr[i], 0);
    cMinusArr[i] = -Math.min(cArr[i], 0);
  }

  // --- DER MA calculations ---
  // Pine: avg_vola = f_derma(vola, length, MA_Type)
  //        dem = f_derma(c_plus, length, MA_Type) / avg_vola
  //        sup = f_derma(c_minus, length, MA_Type) / avg_vola
  const avgVola = derma(bars, volaArr, length, MA_Type);
  const demRaw = derma(bars, cPlusArr, length, MA_Type);
  const supRaw = derma(bars, cMinusArr, length, MA_Type);

  const demArr: number[] = new Array(n);
  const supArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const av = avgVola[i];
    demArr[i] = (av != null && av !== 0 && !isNaN(av)) ? demRaw[i] / av : 0;
    supArr[i] = (av != null && av !== 0 && !isNaN(av)) ? supRaw[i] / av : 0;
  }

  // --- Average DER ---
  // Pine: adp = 100 * wma(dem, DER_avg), asp = 100 * wma(sup, DER_avg)
  const demSeries = Series.fromArray(bars, demArr);
  const supSeries = Series.fromArray(bars, supArr);
  const adpRaw = ta.wma(demSeries, DER_avg).toArray();
  const aspRaw = ta.wma(supSeries, DER_avg).toArray();

  for (let i = 0; i < n; i++) {
    adpRaw[i] = (adpRaw[i] != null && !isNaN(adpRaw[i])) ? 100 * adpRaw[i] : NaN;
    aspRaw[i] = (aspRaw[i] != null && !isNaN(aspRaw[i])) ? 100 * aspRaw[i] : NaN;
  }

  // --- Net DER and smoothed signal ---
  // Pine: anp = adp - asp, anp_s = wma(anp, smooth)
  const anpArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = adpRaw[i];
    const s = aspRaw[i];
    anpArr[i] = (!isNaN(a) && !isNaN(s)) ? a - s : NaN;
  }
  const anpSeries = Series.fromArray(bars, anpArr);
  const anpSmooth = ta.wma(anpSeries, smooth).toArray();

  // --- Sentiment ---
  // Pine: s_adp = 100 * wma(dem, senti), s_asp = 100 * wma(sup, senti)
  //        V_senti = wma(s_adp - s_asp, smooth)
  const sAdpRaw = ta.wma(demSeries, senti).toArray();
  const sAspRaw = ta.wma(supSeries, senti).toArray();
  const sentiDiffArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const sa = sAdpRaw[i];
    const ss = sAspRaw[i];
    sentiDiffArr[i] = (sa != null && !isNaN(sa) && ss != null && !isNaN(ss)) ? 100 * sa - 100 * ss : NaN;
  }
  const sentiSeries = Series.fromArray(bars, sentiDiffArr);
  const vSenti = ta.wma(sentiSeries, smooth).toArray();

  const warmup = length + DER_avg + smooth;

  // --- Plot 0: VADER Signal (anp_s) colored by direction ---
  // Pine: plot(anp_s, 'Signal', up ? c_up : c_dn, 4)
  const plot0 = bars.map((bar, i) => {
    const v = anpSmooth[i];
    if (i < warmup || v == null || isNaN(v)) return { time: bar.time, value: NaN };
    const color = v >= 0 ? '#359bfc' : '#f57f17';
    return { time: bar.time, value: v, color };
  });

  // --- Plot 1: Demand Energy (adp) with cross style ---
  // Pine: d = plot(adp, 'Demand Energy', c_adp, 2, style=plot.style_cross, join=true)
  const plot1 = bars.map((bar, i) => ({
    time: bar.time,
    value: (i < warmup || isNaN(adpRaw[i])) ? NaN : adpRaw[i],
  }));

  // --- Plot 2: Supply Energy (asp) with circles style ---
  // Pine: s = plot(asp, 'Supply Energy', c_asp, 2, style=plot.style_circles, join=true)
  const plot2 = bars.map((bar, i) => ({
    time: bar.time,
    value: (i < warmup || isNaN(aspRaw[i])) ? NaN : aspRaw[i],
  }));

  // --- Plot 3: Sentiment 4-color histogram ---
  // Pine: sflag_up = abs(V_senti) >= abs(V_senti[1])
  //   color = s_up ? (sflag_up ? c_grow_above : c_fall_above) : (sflag_up ? c_grow_below : c_fall_below)
  const sentiWarmup = Math.max(warmup, senti + smooth);
  const plot3 = bars.map((bar, i) => {
    const v = vSenti[i];
    if (!showSenti || i < sentiWarmup || v == null || isNaN(v)) return { time: bar.time, value: NaN };
    const prevV = i > 0 ? vSenti[i - 1] : NaN;
    const sUp = v >= 0;
    const sFlagUp = prevV != null && !isNaN(prevV) && Math.abs(v) >= Math.abs(prevV);
    let color: string;
    if (sUp) {
      color = sFlagUp ? 'rgba(27,94,32,0.5)' : 'rgba(102,187,106,0.5)';
    } else {
      color = sFlagUp ? 'rgba(220,76,74,0.5)' : 'rgba(239,142,152,0.5)';
    }
    return { time: bar.time, value: v, color };
  });

  // --- Fill between demand and supply ---
  // Pine: fill(d, s, adp > asp ? c_fd : c_fs)
  const fillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < warmup || isNaN(adpRaw[i]) || isNaN(aspRaw[i])) {
      fillColors[i] = 'rgba(0,0,0,0)';
    } else {
      fillColors[i] = adpRaw[i] > aspRaw[i] ? 'rgba(0, 128, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 0, options: { color: 'rgba(255, 238, 0, 0.3)', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(0, 128, 0, 0.2)' }, colors: fillColors },
    ],
  };
}

export const RedKVADER = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
