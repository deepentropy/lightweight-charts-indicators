/**
 * OTT Bands
 *
 * OTT with upper and lower percentage bands.
 * Support line (MA) with upper band and lower band
 * derived from the OTT trailing stop percentage offsets.
 * Supports 8 MA types: SMA, EMA, WMA, TMA, VAR, WWMA, ZLEMA, TSF.
 * Alerts (alertcondition, `alerts` of the result): the 6 conditions of the original (support line / OTT[2] and
 * price / OTT[2] crosses), on the series of the port.
 *
 * Reference: "Optimized Trend Tracker Bands" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OTTBandsInputs {
  period: number;
  percent: number;
  upperCoeff: number;
  lowerCoeff: number;
  showFiboLines: boolean;
  showSupport: boolean;
  highlight: boolean;
  mav: string;
  src: SourceType;
}

export const defaultInputs: OTTBandsInputs = {
  period: 2,
  percent: 15,
  upperCoeff: 0.1,
  lowerCoeff: 0.077,
  showFiboLines: false,
  showSupport: false,
  highlight: false,
  mav: 'VAR',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'OTT Moving Average Length', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Optimization Coeff', defval: 15, min: 0, step: 0.1 },
  { id: 'upperCoeff', type: 'float', title: 'OTT Upper Band Coeff', defval: 0.1, min: 0, step: 0.001 },
  { id: 'lowerCoeff', type: 'float', title: 'OTT Lower Band Coeff', defval: 0.077, min: 0, step: 0.001 },
  { id: 'showFiboLines', type: 'bool', title: 'Show OTT Bands Fibonacci Levels?', defval: false },
  { id: 'showSupport', type: 'bool', title: 'Show Support Line?', defval: false },
  { id: 'highlight', type: 'bool', title: 'Show OTT Support Line Color Changes?', defval: false },
  { id: 'mav', type: 'string', title: 'Moving Average Type', defval: 'VAR', options: ['SMA', 'EMA', 'WMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ottMain', title: 'OTT', color: '#B800D9', lineWidth: 2 },
  { id: 'support', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
  { id: 'ottUpper', title: 'OTT UPPER', color: '#4500C4', lineWidth: 2 },
  { id: 'ottUpperHalf', title: 'OTT UPPER HALF', color: '#8400FF', lineWidth: 1 },
  { id: 'ottUpperFibo', title: 'OTT UPPER FIBO', color: '#C830FF', lineWidth: 1 },
  { id: 'ottLower', title: 'OTT LOWER', color: '#00A6FF', lineWidth: 2 },
  { id: 'ottLowerHalf', title: 'OTT LOWER HALF', color: '#007BBD', lineWidth: 1 },
  { id: 'ottLowerFibo', title: 'OTT LOWER FIBO', color: '#024DE3', lineWidth: 1 },
];

export const metadata = {
  title: 'OTT Bands',
  shortTitle: 'OTTBands',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface OttVars {
  /** VAR / WWMA of the bar before */
  prevMa: number;
  longStop: number;
  shortStop: number;
  dir: number;
}

interface OttRun extends BarRunState<OttVars> {
  ma: { step(v: number): number; commit(): void } | null;
  srcArr: number[];
  mavg: number[];
  ott2: number[];
  ott: number[];
  out: Point[][];
  flags: boolean[][];
  times: number[][];
}

const PLOT_IDS = ['ottMain', 'support', 'ottUpper', 'ottUpperHalf', 'ottUpperFibo', 'ottLower', 'ottLowerHalf', 'ottLowerFibo'] as const;

function study(inputs: Partial<OTTBandsInputs>): BarStudy<OttRun, Result> {
  const { period, percent, upperCoeff, lowerCoeff, showFiboLines, showSupport, highlight, mav, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // VAR (Variable Index Dynamic Average) and WWMA (Welles Wilder Moving Average) factors
  const valpha = 2 / (period + 1);
  const wwalpha = 1 / period;
  // Pine: zxLag = length/2==round(length/2) ? length/2 : (length-1)/2
  const zxLag = (period / 2) === Math.round(period / 2) ? Math.floor(period / 2) : Math.floor((period - 1) / 2);
  const warmup = period + 9;
  const X3 = upperCoeff;
  const X5 = lowerCoeff;

  // Compute selected MA type
  // Pine: MAvg=getMA(src, length) with mav selector
  const maStep = (): OttRun['ma'] => {
    switch (mav) {
      case 'SMA': return new WindowSma(period);
      case 'EMA':
      case 'ZLEMA': return taStep.ema(period);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, period), commit: () => m.commit() }; }
      case 'TMA': {
        // Pine: sma(sma(src, ceil(length/2)), floor(length/2) + 1)
        const a = new WindowSma(Math.max(1, Math.ceil(period / 2)));
        const b = new WindowSma(Math.floor(period / 2) + 1);
        return { step: (v) => b.step(a.step(v)), commit: () => { a.commit(); b.commit(); } };
      }
      case 'TSF': {
        // Pine: lrc = linreg(src,length,0), lrc1 = linreg(src,length,1), TSF = lrc + (lrc - lrc1)
        const a = taStep.linreg(period, 0);
        const b = taStep.linreg(period, 1);
        return {
          step: (v) => { const l = a.step(v) ?? 0; const l1 = b.step(v) ?? 0; return l + (l - l1); },
          commit: () => { a.commit(); b.commit(); },
        };
      }
      default: return null;
    }
  };

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ma = maStep();
      const s: OttRun = {
        ma, srcArr: [], mavg: [], ott2: [], ott: [], out: PLOT_IDS.map(() => []), flags: [[], [], [], [], [], []],
        times: [[], [], [], [], [], []],
        steps: ma ? [ma] : [], vars: { prevMa: NaN, longStop: NaN, shortStop: NaN, dir: NaN }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.srcArr, s.mavg, s.ott2, s.ott, ...s.out, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      const x = value(bars[i]) ?? 0;
      s.srcArr[i] = x;
      let m: number;
      if (mav === 'WWMA') {
        m = i === 0 ? x : wwalpha * x + (1 - wwalpha) * v.prevMa;
        v.prevMa = m;
      } else if (mav === 'ZLEMA') {
        const lagged = i >= zxLag ? s.srcArr[i - zxLag] : s.srcArr[0];
        m = s.ma!.step(x + x - lagged);
      } else if (s.ma) {
        m = s.ma.step(x);
      } else {
        // Default: VAR
        let vUD = 0;
        let vDD = 0;
        for (let j = Math.max(0, i - 8); j <= i; j++) {
          const cur = s.srcArr[j];
          const prev = j > 0 ? s.srcArr[j - 1] : cur;
          if (cur > prev) vUD += cur - prev;
          if (cur < prev) vDD += prev - cur;
        }
        const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
        m = i === 0 ? x : valpha * Math.abs(vCMO) * x + (1 - valpha * Math.abs(vCMO)) * v.prevMa;
        v.prevMa = m;
      }
      // Replace NaN/undefined with 0 for downstream computation
      if (m == null || isNaN(m)) m = 0;
      s.mavg[i] = m;

      // OTT trailing stop logic
      const fark = m * percent * 0.01;
      let longStop = m - fark;
      let shortStop = m + fark;
      let dir: number;
      if (i > 0) {
        if (m > v.longStop) longStop = Math.max(longStop, v.longStop);
        if (m < v.shortStop) shortStop = Math.min(shortStop, v.shortStop);
        dir = v.dir;
        if (v.dir === -1 && m > v.shortStop) dir = 1;
        else if (v.dir === 1 && m < v.longStop) dir = -1;
      } else {
        dir = 1;
      }
      v.longStop = longStop;
      v.shortStop = shortStop;
      v.dir = dir;
      const mt = dir === 1 ? longStop : shortStop;
      s.ott[i] = m > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;

      const o = s.out;
      const early = i < warmup + 2;
      const base = early ? NaN : s.ott[i - 2];
      // Pine: OTTMAIN=plot(nz(OTT[2]), color=#B800D9, linewidth=2)
      o[0][i] = early ? { time, value: NaN } : { time, value: base };
      // Pine: OTTC = highlight ? MAvg > MAvg[1] ? color.green : color.red : #0585E1
      // Pine: plot(showsupport ? MAvg : na, color=OTTC, linewidth=2, title="Support Line")
      if (i < warmup || !showSupport) o[1][i] = { time, value: NaN };
      else {
        const c = highlight ? (i > 0 && m > s.mavg[i - 1]) ? '#26A69A' : '#EF5350' : '#0585E1';
        o[1][i] = { time, value: m, color: c };
      }
      // Pine: OTTUST=plot(nz(OTT[2])*(1+X3), color=#4500C4, linewidth=2)
      o[2][i] = early ? { time, value: NaN } : { time, value: base * (1 + X3) };
      // Pine: OTTUSTYARI=plot(showfibolines ? nz(OTT[2])*(1+X3*0.618) : nz(OTT[2])*(1+X3/2))
      o[3][i] = early ? { time, value: NaN } : { time, value: showFiboLines ? base * (1 + X3 * 0.618) : base * (1 + X3 / 2) };
      // Pine: OTTFIBOUST2=plot(showfibolines ? nz(OTT[2])*(1+X3*0.382) : na)
      o[4][i] = early || !showFiboLines ? { time, value: NaN } : { time, value: base * (1 + X3 * 0.382) };
      // Pine: OTTALT=plot(nz(OTT[2])*(1-X5), color=#00A6FF, linewidth=2)
      o[5][i] = early ? { time, value: NaN } : { time, value: base * (1 - X5) };
      // Pine: OTTALTYARI=plot(showfibolines ? nz(OTT[2])*(1-X5*0.618) : nz(OTT[2])*(1-X5/2))
      o[6][i] = early ? { time, value: NaN } : { time, value: showFiboLines ? base * (1 - X5 * 0.618) : base * (1 - X5 / 2) };
      // Pine: OTTALTFIBO2=plot(showfibolines ? nz(OTT[2])*(1-X5*0.382) : na)
      o[7][i] = early || !showFiboLines ? { time, value: NaN } : { time, value: base * (1 - X5 * 0.382) };

      // Alerts: crosses of MAvg and of the source with OTT[2] (na on the first two bars)
      const t2 = i >= 2 ? s.ott[i - 2] : NaN;
      s.ott2[i] = t2;
      const pt = i > 0 ? s.ott2[i - 1] : NaN;
      const pm = i > 0 ? s.mavg[i - 1] : NaN;
      const px = i > 0 ? s.srcArr[i - 1] : NaN;
      const supUp = m > t2 && pm <= pt, supDown = m < t2 && pm >= pt;
      const priceUp = x > t2 && px <= pt, priceDown = x < t2 && px >= pt;
      // alertcondition(cross / crossover / crossunder(MAvg, OTT[2]), cross / crossover / crossunder(src, OTT[2]))
      const f = [supUp || supDown, supUp, supDown, priceUp || priceDown, priceUp, priceDown];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: IndicatorResult['plots'] = {};
      PLOT_IDS.forEach((id, k) => { plots[id] = s.out[k].slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        plots,
        fills: [
          // Pine: fill(OTTUST, OTTUSTYARI, color=#4500C4, transp=88)
          { plot1: 'ottUpper', plot2: 'ottUpperHalf', options: { color: 'rgba(69,0,196,0.12)' } },
          // Pine: fill(OTTFIBOUST2, OTTUSTYARI, color=#8400FF, transp=88)
          { plot1: 'ottUpperFibo', plot2: 'ottUpperHalf', options: { color: 'rgba(132,0,255,0.12)' } },
          // Pine: fill(OTTUSTYARI, OTTMAIN, color=#C810FF, transp=88)
          { plot1: 'ottUpperHalf', plot2: 'ottMain', options: { color: 'rgba(200,16,255,0.12)' } },
          // Pine: fill(OTTFIBOUST2, OTTMAIN, color=#C810FF, transp=88)
          { plot1: 'ottUpperFibo', plot2: 'ottMain', options: { color: 'rgba(200,16,255,0.12)' } },
          // Pine: fill(OTTALT, OTTALTYARI, color=#00A6FF, transp=88)
          { plot1: 'ottLower', plot2: 'ottLowerHalf', options: { color: 'rgba(0,166,255,0.12)' } },
          // Pine: fill(OTTALTFIBO2, OTTALTYARI, color=#007BBD, transp=88)
          { plot1: 'ottLowerFibo', plot2: 'ottLowerHalf', options: { color: 'rgba(0,123,189,0.12)' } },
          // Pine: fill(OTTALTYARI, OTTMAIN, color=#024DE3, transp=88)
          { plot1: 'ottLowerHalf', plot2: 'ottMain', options: { color: 'rgba(2,77,227,0.12)' } },
          // Pine: fill(OTTALTFIBO2, OTTMAIN, color=#024DE3, transp=88)
          { plot1: 'ottLowerFibo', plot2: 'ottMain', options: { color: 'rgba(2,77,227,0.12)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OTTBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OTTBandsInputs> = {}): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'OTT - Support Line Crossing!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'Support Line BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'Support Line SELL SIGNAL!' },
  { id: 'alert3', title: 'Price Cross Alert', message: 'OTT - Price Crossing!' },
  { id: 'alert4', title: 'Price Crossover Alarm', message: 'PRICE OVER OTT - BUY SIGNAL!' },
  { id: 'alert5', title: 'Price Crossunder Alarm', message: 'PRICE UNDER OTT - SELL SIGNAL!' },
];

export const OTTBands = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
