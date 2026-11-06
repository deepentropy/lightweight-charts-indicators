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
 * Alerts (alertcondition, `alerts` of the result): the signal crosses 0 up / down / either way, and crosses over /
 * under the sentiment line ('VADER Speeding Up' / 'VADER Slowing Down').
 *
 * Reference: "RedK VADER v4.0" by RedKTrader
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Ma = { step(v: number): number; commit(): void };

/** Apply MA based on type selection (Pine: f_derma), one bar at a time */
function derma(len: number, maType: string): Ma {
  switch (maType) {
    case 'SMA': return new WindowSma(len);
    case 'EMA': return taStep.ema(len);
    default: return wmaStep(len);
  }
}

/** ta.wma(source, len) with a constant length */
function wmaStep(len: number): Ma {
  const m = taStep.wma();
  return { step: (v) => m.step(v, len), commit: () => m.commit() };
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface VaderRun extends BarRunState<Record<string, never>> {
  stoch: ReturnType<typeof taStep.stoch> | null;
  avgVola: Ma;
  demMa: Ma;
  supMa: Ma;
  adpMa: Ma;
  aspMa: Ma;
  anpMa: Ma;
  sAdpMa: Ma;
  sAspMa: Ma;
  sentiMa: Ma;
  c: number[];
  vSenti: number[];
  sig: number[];
  sentiLine: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RedKVADERInputs>): BarStudy<VaderRun, Result> {
  const { length, DER_avg, MA_Type, smooth, showSenti, senti, vCalc, vlookbk } = { ...defaultInputs, ...inputs };
  const warmup = length + DER_avg + smooth;
  const sentiWarmup = Math.max(warmup, senti + smooth);
  // The original's lines are na until their averages are known (the relative volume from bar vlookbk - 1, the
  // price change from bar 1): the port's values before that are not crossed
  const cFirst = vCalc === 'Relative' ? Math.max(vlookbk - 1, 1) : 1;
  const sigFirst = cFirst + (length - 1) + (DER_avg - 1) + (smooth - 1);
  const sentiFirst = cFirst + (length - 1) + (senti - 1) + (smooth - 1);
  return {
    init() {
      const stoch = vCalc !== 'None' && vCalc !== 'Full' ? taStep.stoch(vlookbk) : null;
      const avgVola = derma(length, MA_Type);
      const demMa = derma(length, MA_Type);
      const supMa = derma(length, MA_Type);
      const adpMa = wmaStep(DER_avg);
      const aspMa = wmaStep(DER_avg);
      const anpMa = wmaStep(smooth);
      const sAdpMa = wmaStep(senti);
      const sAspMa = wmaStep(senti);
      const sentiMa = wmaStep(smooth);
      const s: VaderRun = {
        stoch, avgVola, demMa, supMa, adpMa, aspMa, anpMa, sAdpMa, sAspMa, sentiMa, c: [], vSenti: [], sig: [],
        sentiLine: [], plot0: [], plot1: [], plot2: [], plot3: [], fillColors: [], flags: [[], [], [], [], []],
        times: [[], [], [], [], []],
        steps: [...(stoch ? [stoch] : []), avgVola, demMa, supMa, adpMa, aspMa, anpMa, sAdpMa, sAspMa, sentiMa],
        vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [
        s.c, s.vSenti, s.sig, s.sentiLine, s.plot0, s.plot1, s.plot2, s.plot3, s.fillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const time = bar.time;
      // --- Volume acceleration ---
      // Pine: vola = v_calc == 'None' ? 1 : v_calc == 'Relative' ? stoch(v,v,v,vlookbk)/100 : v
      const vol = bar.volume ?? 0;
      let vola: number;
      if (vCalc === 'None') {
        vola = 1;
      } else if (vCalc === 'Full') {
        vola = vol;
      } else {
        // Relative: stoch(v, v, v, vlookbk) / 100
        const sv = s.stoch!.step(vol, vol, vol);
        vola = (sv != null && !isNaN(sv)) ? sv / 100 : 1;
      }

      // --- Directional energy ratio ---
      // Pine: R = (highest(2) - lowest(2)) / 2
      //        sr = change(close) / R, clamped [-1, 1]
      //        c = fixnan(sr * vola)
      let hh: number, ll: number;
      if (i === 0) {
        hh = bar.high;
        ll = bar.low;
      } else {
        hh = Math.max(bar.high, bars[i - 1].high);
        ll = Math.min(bar.low, bars[i - 1].low);
      }
      const R = (hh - ll) / 2;
      // sr = change(close) / R
      const priceChange = i === 0 ? 0 : bar.close - bars[i - 1].close;
      const sr = R === 0 ? 0 : priceChange / R;
      // Clamp to [-1, 1]
      const rsr = Math.max(Math.min(sr, 1), -1);
      // c = rsr * vola (fixnan: carry forward last valid value)
      const rawC = rsr * vola;
      const c = isNaN(rawC) ? (i > 0 ? s.c[i - 1] : 0) : rawC;
      s.c[i] = c;
      const cPlus = Math.max(c, 0);
      const cMinus = -Math.min(c, 0);

      // --- DER MA calculations ---
      // Pine: avg_vola = f_derma(vola, length, MA_Type)
      //        dem = f_derma(c_plus, length, MA_Type) / avg_vola
      //        sup = f_derma(c_minus, length, MA_Type) / avg_vola
      const av = s.avgVola.step(vola);
      const demRaw = s.demMa.step(cPlus);
      const supRaw = s.supMa.step(cMinus);
      const avOk = av != null && av !== 0 && !isNaN(av);
      const dem = avOk ? demRaw / av : 0;
      const sup = avOk ? supRaw / av : 0;

      // --- Average DER ---
      // Pine: adp = 100 * wma(dem, DER_avg), asp = 100 * wma(sup, DER_avg)
      const adpW = s.adpMa.step(dem);
      const aspW = s.aspMa.step(sup);
      const adp = (adpW != null && !isNaN(adpW)) ? 100 * adpW : NaN;
      const asp = (aspW != null && !isNaN(aspW)) ? 100 * aspW : NaN;

      // --- Net DER and smoothed signal ---
      // Pine: anp = adp - asp, anp_s = wma(anp, smooth)
      const anp = (!isNaN(adp) && !isNaN(asp)) ? adp - asp : NaN;
      const anpS = s.anpMa.step(anp);

      // --- Sentiment ---
      // Pine: s_adp = 100 * wma(dem, senti), s_asp = 100 * wma(sup, senti)
      //        V_senti = wma(s_adp - s_asp, smooth)
      const sa = s.sAdpMa.step(dem);
      const ss = s.sAspMa.step(sup);
      const sentiDiff = (sa != null && !isNaN(sa) && ss != null && !isNaN(ss)) ? 100 * sa - 100 * ss : NaN;
      const vSenti = s.sentiMa.step(sentiDiff);
      s.vSenti[i] = vSenti;

      // --- Plot 0: VADER Signal (anp_s) colored by direction ---
      // Pine: plot(anp_s, 'Signal', up ? c_up : c_dn, 4)
      if (i < warmup || anpS == null || isNaN(anpS)) s.plot0[i] = { time, value: NaN };
      else s.plot0[i] = { time, value: anpS, color: anpS >= 0 ? '#359bfc' : '#f57f17' };

      // --- Plot 1: Demand Energy (adp) with cross style ---
      // Pine: d = plot(adp, 'Demand Energy', c_adp, 2, style=plot.style_cross, join=true)
      s.plot1[i] = { time, value: (i < warmup || isNaN(adp)) ? NaN : adp };
      // --- Plot 2: Supply Energy (asp) with circles style ---
      // Pine: s = plot(asp, 'Supply Energy', c_asp, 2, style=plot.style_circles, join=true)
      s.plot2[i] = { time, value: (i < warmup || isNaN(asp)) ? NaN : asp };

      // --- Plot 3: Sentiment 4-color histogram ---
      // Pine: sflag_up = abs(V_senti) >= abs(V_senti[1])
      //   color = s_up ? (sflag_up ? c_grow_above : c_fall_above) : (sflag_up ? c_grow_below : c_fall_below)
      if (!showSenti || i < sentiWarmup || vSenti == null || isNaN(vSenti)) {
        s.plot3[i] = { time, value: NaN };
      } else {
        const prevV = i > 0 ? s.vSenti[i - 1] : NaN;
        const sUp = vSenti >= 0;
        const sFlagUp = prevV != null && !isNaN(prevV) && Math.abs(vSenti) >= Math.abs(prevV);
        let color: string;
        if (sUp) {
          color = sFlagUp ? 'rgba(27,94,32,0.5)' : 'rgba(102,187,106,0.5)';
        } else {
          color = sFlagUp ? 'rgba(220,76,74,0.5)' : 'rgba(239,142,152,0.5)';
        }
        s.plot3[i] = { time, value: vSenti, color };
      }

      // --- Fill between demand and supply ---
      // Pine: fill(d, s, adp > asp ? c_fd : c_fs)
      if (i < warmup || isNaN(adp) || isNaN(asp)) s.fillColors[i] = 'rgba(0,0,0,0)';
      else s.fillColors[i] = adp > asp ? 'rgba(0, 128, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';

      // Alert_up = ta.crossover(anp_s, 0), Alert_dn = ta.crossunder(anp_s, 0), Alert_swing = ta.cross(anp_s, 0)
      // v_speedup = ta.crossover(anp_s, V_senti), v_slowdn = ta.crossunder(anp_s, V_senti)
      const sig = i < sigFirst ? NaN : anpS ?? NaN;
      const sentiLine = i < sentiFirst ? NaN : vSenti ?? NaN;
      s.sig[i] = sig;
      s.sentiLine[i] = sentiLine;
      const pSig = i > 0 ? s.sig[i - 1] : NaN;
      const pSenti = i > 0 ? s.sentiLine[i - 1] : NaN;
      const up = sig > 0 && pSig <= 0;
      const dn = sig < 0 && pSig >= 0;
      const swing = up || dn;
      const speedUp = sig > sentiLine && pSig <= pSenti;
      const slowDn = sig < sentiLine && pSig >= pSenti;
      s.flags[0][i] = up;
      s.flags[1][i] = dn;
      s.flags[2][i] = swing;
      s.flags[3][i] = speedUp;
      s.flags[4][i] = slowDn;
      if (up) s.times[0].push(time as number);
      if (dn) s.times[1].push(time as number);
      if (swing) s.times[2].push(time as number);
      if (speedUp) s.times[3].push(time as number);
      if (slowDn) s.times[4].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        hlines: [
          { value: 0, options: { color: 'rgba(255, 238, 0, 0.3)', linestyle: 'solid' as const, title: 'Zero' } },
        ],
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(0, 128, 0, 0.2)' }, colors: s.fillColors.slice() },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RedKVADERInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RedKVADERInputs> = {}): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '.   VADER Crossing 0 Up', message: 'VADER Up - Buying Energy Detected!' },
  { id: 'alert1', title: '..  VADER Crossing 0 Down', message: 'VADER Down - Selling Energy Detected!' },
  { id: 'alert2', title: '... VADER Crossing 0', message: 'VADER Swing - Possible Reversal' },
  { id: 'alert3', title: '*  VADER Speeding Up', message: 'VADER Speeding Up!' },
  { id: 'alert4', title: '** VADER Slowing Down', message: 'VADER Slowing Down!' },
];

export const RedKVADER = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
