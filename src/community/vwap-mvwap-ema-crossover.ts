/**
 * VWAP/MVWAP/EMA Crossover
 *
 * Trading signals from VWAP/MVWAP/EMA crossovers with RSI filtering.
 * Includes Senkou span cloud for trend context.
 *
 * The VWAP restarts on each day. On intraday bars the port reads the exchange time zone and the session of the
 * symbol from the optional third argument (see src/chart-context.ts) and uses the trading day of the exchange, as
 * the original. Without them the day is the UTC date. While the volume of the day is zero or na the VWAP is na
 * (0 / 0); the averages of the VWAP skip na values, as in Pine.
 *
 * The four signal shapes of the original ("Buy Alert", "Risky", "WAIT", "Enter Here") are drawn fully transparent,
 * as the original does (transp 100): they are listed in the Style settings and can be made visible there. The
 * "Long" triangle is green #008000, the "Short" triangle red #FF0000; the bars are green #008000 while Long is 1, else
 * red #FF0000.
 *
 * Reference: "VWAP/MVWAP/EMA CROSSOVER" by DerrickLaFlame
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, hasCalendar, periodChanges } from '../anchor-period';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VwapMvwapEmaCrossoverInputs {
  vwapLength: number;
  emaLength1: number;
  emaLength2: number;
  rsiLimit: number;
  rsiMinimum: number;
  mvwapLength: number;
  conversionLen: number;
  baseLineLen: number;
  senkouBLen: number;
  displacementA: number;
  displacementB: number;
}

export const defaultInputs: VwapMvwapEmaCrossoverInputs = {
  vwapLength: 1,
  emaLength1: 7,
  emaLength2: 25,
  rsiLimit: 65,
  rsiMinimum: 51,
  mvwapLength: 21,
  conversionLen: 9,
  baseLineLen: 26,
  senkouBLen: 51,
  displacementA: 26,
  displacementB: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'vwapLength', type: 'int', title: 'VWAP Length', defval: 1, min: 1 },
  { id: 'emaLength1', type: 'int', title: 'EMA 1 Length', defval: 7, min: 1 },
  { id: 'emaLength2', type: 'int', title: 'EMA 2 Length', defval: 25, min: 1 },
  { id: 'rsiLimit', type: 'int', title: 'RSI Limit (RISKY)', defval: 65, min: 1 },
  { id: 'rsiMinimum', type: 'int', title: 'RSI Minimum (WAIT FOR DIP)', defval: 51, min: 1 },
  { id: 'mvwapLength', type: 'int', title: 'MVWAP Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#FFFF00', lineWidth: 3 },
  { id: 'plot1', title: 'MVWAP', color: '#FF00FF', lineWidth: 1 },
  { id: 'plot2', title: 'EMA1', color: '#FFFF00', lineWidth: 1 },
  { id: 'plot3', title: 'EMA2', color: '#FF9800', lineWidth: 1 },
  { id: 'plot4', title: 'Senkou A', color: '#008000', lineWidth: 2 },
  { id: 'plot5', title: 'Senkou B', color: '#FF0000', lineWidth: 2 },
];

export const metadata = {
  title: 'VWAP/MVWAP/EMA Crossover',
  shortTitle: 'VWAP-X',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };
type Point = { time: number; value: number };

const DAY_MS = 86400000;

/** Running sums of f(x) (volume, high * volume, low * volume over x bars) */
interface MidSums {
  sumV: number;
  sumHV: number;
  sumLV: number;
}

interface VwapVars {
  /** ta.vwap sums */
  sumPV: number;
  sumV: number;
  conv: MidSums;
  base: MidSums;
  spanB: MidSums;
}

interface VwapRun extends BarRunState<VwapVars> {
  cvwap: ReturnType<typeof taStep.ema>;
  mvwap: ReturnType<typeof taStep.ema>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  longArr: number[];
  senkouABase: number[];
  senkouBBase: number[];
  senkouA: number[];
  senkouB: number[];
  plots: Point[][];
  fill: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<VwapMvwapEmaCrossoverInputs>): BarStudy<VwapRun, Result> {
  const {
    vwapLength, emaLength1, emaLength2, mvwapLength, rsiLimit, rsiMinimum,
    conversionLen, baseLineLen, senkouBLen, displacementA, displacementB,
  } = { ...defaultInputs, ...inputs };
  /** Chart context of the day changes (with the chart timeframe) and the time unit, set by init */
  let calChart: ChartContext = {};
  let ms = false;

  /**
   * vwap anchor (hlc3, anchored on each new day; the sums start on the first bar as in Pine): the trading days of the
   * exchange with the chart context (the change of bars i - 1 and i, the calendar reads the chart timeframe of the
   * whole set), else the UTC dates
   */
  const newDay = (bars: Bar[], i: number): boolean => {
    if (i === 0) return true;
    if (hasCalendar(calChart)) return periodChanges([bars[i - 1]!, bars[i]!], '1D', calChart)[1]!;
    const day = (t: number) => Math.floor((ms ? t : t * 1000) / DAY_MS);
    return day(bars[i]!.time) !== day(bars[i - 1]!.time);
  };

  // Senkou spans (volume-weighted Ichimoku-style)
  // Pine: f(x) => total_volume=sum(volume,x), vw_high=sum(high*vol,x)/total_volume, vw_low=sum(low*vol,x)/total_volume, (vw_high+vw_low)/2
  const volWeightedMidpoint = (m: MidSums, bars: Bar[], i: number, len: number): number => {
    const b = bars[i]!;
    const vol = b.volume ?? 0;
    m.sumV += vol;
    m.sumHV += b.high * vol;
    m.sumLV += b.low * vol;
    if (i >= len) {
      const old = bars[i - len]!;
      const oldVol = old.volume ?? 0;
      m.sumV -= oldVol;
      m.sumHV -= old.high * oldVol;
      m.sumLV -= old.low * oldVol;
    }
    return i >= len - 1 && m.sumV > 0 ? (m.sumHV / m.sumV + m.sumLV / m.sumV) / 2 : NaN;
  };

  /** Plot and fill of the Senkou spans on bar j from the displaced values */
  const writeSenkou = (s: VwapRun, bars: Bar[], j: number) => {
    const t = bars[j]!.time as number;
    const sa = s.senkouA[j]!;
    const sb = s.senkouB[j]!;
    s.plots[4]![j] = { time: t, value: sa };
    s.plots[5]![j] = { time: t, value: sb };
    // Fill between Senkou A and B
    s.fill[j] = !isNaN(sa) && !isNaN(sb) ? (sa > sb ? 'rgba(0,128,0,0.27)' : 'rgba(255,0,0,0.27)') : 'transparent';
  };

  /**
   * Apply displacement (shift forward): senkou[i] = base[i - displacement]; a negative displacement reads a later
   * bar (undefined after the last bar): bar i writes the slot of bar i + displacement, the only writer of it
   */
  const displace = (out: number[], base: number[], i: number, d: number): number => {
    if (d >= 0) {
      out[i] = i - d >= 0 ? base[i - d]! : NaN;
      return -1;
    }
    out[i] = undefined as unknown as number;
    if (!Number.isInteger(d) || i + d < 0) return -1;
    out[i + d] = base[i]!;
    return i + d;
  };

  return {
    // the day changes read the chart timeframe of the bar gaps (or the context) and the time unit of the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0]!.time >= 1e12}`,
    init(bars, chart) {
      ms = bars.length > 0 && bars[0]!.time >= 1e12;
      const tfName = chartTimeframe(bars, chart);
      calChart = tfName === '' || chart.timeframe ? chart : { ...chart, timeframe: tfName };
      const plots: Point[][] = Array.from({ length: 6 }, () => []);
      const s: VwapRun = {
        cvwap: taStep.ema(vwapLength), mvwap: taStep.ema(mvwapLength), ema1: taStep.ema(emaLength1),
        ema2: taStep.ema(emaLength2), rsi: taStep.rsi(14), longArr: [], senkouABase: [], senkouBBase: [],
        senkouA: [], senkouB: [], plots, fill: [], barColors: [], markers: [], steps: [], lists: [], series: [],
        vars: {
          sumPV: NaN, sumV: NaN, conv: { sumV: 0, sumHV: 0, sumLV: 0 }, base: { sumV: 0, sumHV: 0, sumLV: 0 },
          spanB: { sumV: 0, sumHV: 0, sumLV: 0 },
        },
      };
      s.steps = [s.cvwap, s.mvwap, s.ema1, s.ema2, s.rsi];
      s.lists = [s.markers];
      s.series = [s.longArr, s.senkouABase, s.senkouBBase, s.senkouA, s.senkouB, ...plots, s.fill, s.barColors];
      return s;
    },
    copyVars: (v) => ({ ...v, conv: { ...v.conv }, base: { ...v.base }, spanB: { ...v.spanB } }),
    bar(s, i, bars) {
      const b = bars[i]!;
      const t = b.time as number;
      const v = s.vars;
      const src = (b.high + b.low + b.close) / 3;
      const volume = b.volume ?? NaN;
      if (newDay(bars, i)) {
        v.sumPV = src * volume;
        v.sumV = volume;
      } else {
        // An na source or volume makes the sums na until the next anchor
        v.sumPV += src * volume;
        v.sumV += volume;
      }
      const vwap = v.sumV === 0 ? NaN : v.sumPV / v.sumV;
      // cvwap = ema(vwap, vwapLength); MVWAP = ema(vwap, mvwapLength)
      const cvwap = s.cvwap.step(vwap);
      const mvwap = s.mvwap.step(vwap);
      // EMAs
      const e1 = s.ema1.step(b.close);
      const e2 = s.ema2.step(b.close);
      // RSI
      const r = s.rsi.step(b.close);

      // Conditions
      const check1 = e1 >= mvwap;
      const check2 = e2 >= mvwap;
      const check3 = cvwap >= mvwap;
      const cross = check1 && check2;
      const crossUp = cross && check3;
      const buy = crossUp && r > 0;
      const long = buy ? 1 : 0;
      s.longArr[i] = long;
      // Risky = Crossup and rsi > rsilimit; BuyDip = Crossup and rsi < rsiminimum
      // GoodBuy = Buy and rsi < rsilimit; GreatBuy = GoodBuy and rsi > rsiminimum
      const risky = crossUp && r > rsiLimit;
      const buyDip = crossUp && r < rsiMinimum;
      const greatBuy = buy && r < rsiLimit && r > rsiMinimum;

      const convLine = volWeightedMidpoint(v.conv, bars, i, conversionLen);
      const baseLine = volWeightedMidpoint(v.base, bars, i, baseLineLen);
      s.senkouABase[i] = !isNaN(convLine) && !isNaN(baseLine) ? (convLine + baseLine) / 2 : NaN;
      s.senkouBBase[i] = volWeightedMidpoint(v.spanB, bars, i, senkouBLen);
      const ja = displace(s.senkouA, s.senkouABase, i, displacementA);
      const jb = displace(s.senkouB, s.senkouBBase, i, displacementB);
      writeSenkou(s, bars, i);
      if (ja >= 0) writeSenkou(s, bars, ja);
      if (jb >= 0 && jb !== ja) writeSenkou(s, bars, jb);

      s.plots[0]![i] = { time: t, value: cvwap };
      s.plots[1]![i] = { time: t, value: mvwap };
      s.plots[2]![i] = { time: t, value: e1 };
      s.plots[3]![i] = { time: t, value: e2 };

      // Pine: Longtrigger = crossover(Long, 0.5), Shorttrigger = crossover(Short, 0.5)
      if (i > 0) {
        const prevLong = s.longArr[i - 1]!;
        const prevShort = prevLong === 0 ? 1 : 0;
        const curShort = long === 0 ? 1 : 0;
        if (prevLong <= 0 && long > 0) {
          // plotshape(Longtrigger, "Long Entry", belowbar, color=green (#008000), triangleup, text="Long")
          s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#008000', text: 'Long', id: 'shape0' });
        }
        if (prevShort <= 0 && curShort > 0) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'Short', id: 'shape1' });
        }
      }
      // plotshape(Buy, "Buy Alert", belowbar, white, transp=100, triangleup); plotshape(Risky, "Risky", abovebar, red,
      // transp=100, triangledown); plotshape(BuyDip, "WAIT", abovebar, orange, transp=100, triangledown);
      // plotshape(GreatBuy, "Enter Here", belowbar, green, transp=100, triangleup)
      if (buy) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: 'rgba(255, 255, 255, 0)', id: 'shape2' });
      if (risky) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: 'rgba(255, 0, 0, 0)', id: 'shape3' });
      if (buyDip) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: 'rgba(255, 127, 0, 0)', id: 'shape4' });
      if (greatBuy) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: 'rgba(0, 128, 0, 0)', id: 'shape5' });

      // barcolor(Long == 1 ? green : red): green #008000, red #FF0000
      s.barColors[i] = { id: 'barcolor0', time: t, color: long === 1 ? '#008000' : '#FF0000' };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': p[0]!.slice(), 'plot1': p[1]!.slice(), 'plot2': p[2]!.slice(),
          'plot3': p[3]!.slice(), 'plot4': p[4]!.slice(), 'plot5': p[5]!.slice(),
        },
        fills: [
          { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(0,128,0,0.27)' }, colors: s.fill.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwapMvwapEmaCrossoverInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VwapMvwapEmaCrossoverInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VwapMvwapEmaCrossover = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
