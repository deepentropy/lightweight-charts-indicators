/**
 * Trend Meter
 *
 * Three "trend meters" (rows of dots, green or red) chosen among: MACD 12/26/9 histogram > 0, fast MACD 8/21/5
 * histogram > 0, Mom / Dad cross (EMA 5 - EMA 20 above its EMA 30), RSI 13 above its 21-bar linear regression line,
 * RSI 13 > 50, RSI 5 > 50 and trend candles (a Heikin-Ashi like trend that keeps the colour of an earlier candle
 * while the current one is inside it). A background band is green when the three meters are green and red when
 * they are red; a large dot marks the bar where they become all green / all red, and a cross the bars where a Wave
 * Trend cross agrees with them. Two trend bars below show a moving average cross (or the direction of one average).
 * Small dots at the top mark positive / negative pressure: RSI 14 oversold / overbought with the Wave Trend beyond
 * -60 / 60 and its delta pointing up / down.
 *
 * Alerts (alertcondition, `alerts` of the result): the original's 38 conditions (pressure, the three meters turning
 * green / red / no longer aligned / rapid change, Wave Trend cross with the meters, trend bar MA crosses and their
 * combinations with the meters), true on the bars where the original's expression is true.
 *
 * Reference: "Trend Meter" by Lij_MC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type TrendMeterSource =
  | 'MACD Crossover - 12, 26, 9'
  | 'MACD Crossover - Fast - 8, 21, 5'
  | 'Mom Dad Cross (Top Dog Trading)'
  | 'RSI Signal Line Cross - RSI 13, Sig 21'
  | 'RSI 13: > or < 50'
  | 'RSI 5: > or < 50'
  | 'Trend Candles'
  | 'N/A';

export interface TrendMeterInputs {
  posNegPressure: boolean;
  tmSetups: boolean;
  tmSetupsAndWt: boolean;
  trendBar1: TrendMeterSource;
  trendBar2: TrendMeterSource;
  trendBar3: TrendMeterSource;
  showTrendBar1: boolean;
  showTrendBar2: boolean;
  trendBar4: 'MA Crossover' | 'MA Direction - Fast MA - TB1' | 'MA Direction - Slow MA - TB1';
  trendBar5: 'MA Crossover' | 'MA Direction - Fast MA - TB2' | 'MA Direction - Slow MA - TB2';
  ma1Length: number;
  ma1Type: 'EMA' | 'SMA';
  ma2Length: number;
  ma2Type: 'EMA' | 'SMA';
  ma3Length: number;
  ma3Type: 'EMA' | 'SMA';
  ma4Length: number;
  ma4Type: 'EMA' | 'SMA';
}

export const defaultInputs: TrendMeterInputs = {
  posNegPressure: true,
  tmSetups: true,
  tmSetupsAndWt: true,
  trendBar1: 'MACD Crossover - Fast - 8, 21, 5',
  trendBar2: 'RSI 13: > or < 50',
  trendBar3: 'RSI 5: > or < 50',
  showTrendBar1: true,
  showTrendBar2: true,
  trendBar4: 'MA Crossover',
  trendBar5: 'MA Crossover',
  ma1Length: 5,
  ma1Type: 'EMA',
  ma2Length: 11,
  ma2Type: 'EMA',
  ma3Length: 13,
  ma3Type: 'EMA',
  ma4Length: 36,
  ma4Type: 'SMA',
};

const METER_OPTIONS: TrendMeterSource[] = [
  'MACD Crossover - 12, 26, 9', 'MACD Crossover - Fast - 8, 21, 5', 'Mom Dad Cross (Top Dog Trading)',
  'RSI Signal Line Cross - RSI 13, Sig 21', 'RSI 13: > or < 50', 'RSI 5: > or < 50', 'Trend Candles', 'N/A',
];

export const inputConfig: InputConfig[] = [
  { id: 'posNegPressure', type: 'bool', title: 'Pos / Neg Pressure', defval: true, group: 'Signals',
    tooltip: 'Positive Pressure   = RSI14 and Wave Trend Over Sold with WT Delta Pointing Up                                                               Negative Pressure = RSI14 and Wave Trend Over Bought with WT Delta Pointing Down' },
  { id: 'tmSetups', type: 'bool', title: 'Trend Meter Signal', defval: true, group: 'Signals', tooltip: 'All 3 Trend Meters Now Align' },
  { id: 'tmSetupsAndWt', type: 'bool', title: 'Wave Trend Cross Aligns with Trend Meter Signal', defval: true, group: 'Signals' },
  { id: 'trendBar1', type: 'string', title: 'Trend Meter 1', defval: 'MACD Crossover - Fast - 8, 21, 5', options: METER_OPTIONS, group: 'Trend Meters' },
  { id: 'trendBar2', type: 'string', title: 'Trend Meter 2', defval: 'RSI 13: > or < 50', options: METER_OPTIONS, group: 'Trend Meters' },
  { id: 'trendBar3', type: 'string', title: 'Trend Meter 3', defval: 'RSI 5: > or < 50', options: METER_OPTIONS, group: 'Trend Meters' },
  { id: 'showTrendBar1', type: 'bool', title: 'Trend Bar 1', defval: true, group: 'Trend Bar 1', inline: 'Trend Bar 1' },
  { id: 'showTrendBar2', type: 'bool', title: 'Trend Bar 2', defval: true, group: 'Trend Bar 2', inline: 'Trend Bar 2' },
  { id: 'trendBar4', type: 'string', title: '', defval: 'MA Crossover',
    options: ['MA Crossover', 'MA Direction - Fast MA - TB1', 'MA Direction - Slow MA - TB1'], group: 'Trend Bar 1', inline: 'Trend Bar 1' },
  { id: 'trendBar5', type: 'string', title: '', defval: 'MA Crossover',
    options: ['MA Crossover', 'MA Direction - Fast MA - TB2', 'MA Direction - Slow MA - TB2'], group: 'Trend Bar 2', inline: 'Trend Bar 2' },
  { id: 'ma1Length', type: 'int', title: 'Fast MA', defval: 5, min: 1, group: 'Trend Bar 1', inline: 'TB1 Fast' },
  { id: 'ma1Type', type: 'string', title: '', defval: 'EMA', options: ['EMA', 'SMA'], group: 'Trend Bar 1', inline: 'TB1 Fast' },
  { id: 'ma2Length', type: 'int', title: 'Slow MA', defval: 11, min: 1, group: 'Trend Bar 1', inline: 'TB1 Slow' },
  { id: 'ma2Type', type: 'string', title: '', defval: 'EMA', options: ['EMA', 'SMA'], group: 'Trend Bar 1', inline: 'TB1 Slow' },
  { id: 'ma3Length', type: 'int', title: 'Fast MA', defval: 13, min: 1, group: 'Trend Bar 2', inline: 'TB2 Fast' },
  { id: 'ma3Type', type: 'string', title: '', defval: 'EMA', options: ['EMA', 'SMA'], group: 'Trend Bar 2', inline: 'TB2 Fast' },
  { id: 'ma4Length', type: 'int', title: 'Slow MA', defval: 36, min: 1, group: 'Trend Bar 2', inline: 'TB2 Slow' },
  { id: 'ma4Type', type: 'string', title: '', defval: 'SMA', options: ['EMA', 'SMA'], group: 'Trend Bar 2', inline: 'TB2 Slow' },
];

const TEAL = '#288a75';
const GREEN = '#4CAF50';
const RED = '#FF5252';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Wave Trend - Positive Pressure', color: String(color.new(TEAL, 25)), lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Wave Trend - Negative Pressure', color: String(color.new('#DC143C', 32)), lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'All 3 Trend Meters Now Align', color: String(color.new(TEAL, 20)), lineWidth: 3, style: 'circles' },
  { id: 'plot3', title: 'Wave Trend X & All 3 Trend Meters Now Align', color: String(color.new(TEAL, 20)), lineWidth: 4, style: 'cross' },
  { id: 'plot4', title: 'Trend Meter 1', color: String(color.new(TEAL, 18)), lineWidth: 2, style: 'circles' },
  { id: 'plot5', title: 'Trend Meter 2', color: String(color.new(TEAL, 18)), lineWidth: 2, style: 'circles' },
  { id: 'plot6', title: 'Trend Meter 3', color: String(color.new(TEAL, 18)), lineWidth: 2, style: 'circles' },
  { id: 'plot7', title: 'Trend Bar 1 - Thin Line', color: String(color.new(GREEN, 15)), lineWidth: 4 },
  { id: 'plot8', title: 'Trend Bar 1 - Thick Line', color: String(color.new(GREEN, 15)), lineWidth: 9 },
  { id: 'plot9', title: 'Trend Bar 2 - Thin Line', color: String(color.new(GREEN, 15)), lineWidth: 6 },
  { id: 'plot10', title: 'Trend Bar 2 - Thick Line', color: String(color.new(GREEN, 15)), lineWidth: 9 },
];

/** hline(113.7) and hline(131.3), colour color.new(color.white, 100), the band of the background highlight */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_tma', price: 113.7, color: String(color.new('#FFFFFF', 100)), linestyle: 'dashed' },
  { id: 'hline_tmb', price: 131.3, color: String(color.new('#FFFFFF', 100)), linestyle: 'dashed' },
];

/** fill(TMa, TMb, color = green / red when the three meters agree, transp = 91) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_tm', plot1: 'hline_tma', plot2: 'hline_tmb', color: String(color.new(GREEN, 91)),
    title: 'Trend Meter Background Highlight - 3 Trend Meter Conditions Met' },
];

export const metadata = {
  title: 'Trend Meter',
  shortTitle: 'Trend Meter',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** An int used as a condition (v4): na and 0 are false */
const on = (x: number) => !isNaN(x) && x !== 0;

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;
type Sma = ReturnType<typeof taStep.sma>;
type Ma = { step(v: number): number; commit(): void };

/** One moving average of the trend bars (EMA or SMA of the close) */
function maStep(type: 'EMA' | 'SMA', len: number): Ma {
  if (type === 'SMA') {
    const m = taStep.sma();
    return { step: (v) => m.step(v, len), commit: () => m.commit() };
  }
  return taStep.ema(len);
}

interface TrendMeterRun extends BarRunState<Record<string, never>> {
  esa: Ema; de: Ema; wt1: Ema; wt2: Sma; wtCross: ReturnType<typeof taStep.cross>;
  ma1: Ma; ma2: Ma; ma3: Ma; ma4: Ma;
  macdFast: Ema; macdSlow: Ema; macdSig: Ema;
  fastFast: Ema; fastSlow: Ema; fastSig: Ema;
  ema5: Ema; ema20: Ema; dad: Ema;
  rsi5: ReturnType<typeof taStep.rsi>; rsi13: ReturnType<typeof taStep.rsi>; rsi14: ReturnType<typeof taStep.rsi>;
  xMean: Sma; yMean: Sma; xDev: ReturnType<typeof taStep.stdev>; yDev: ReturnType<typeof taStep.stdev>;
  corr: ReturnType<typeof taStep.correlation>;
  /** Values of earlier bars */
  haopen: number[]; haclose: number[]; ccolor: number[];
  ma1v: number[]; ma2v: number[]; ma3v: number[]; ma4v: number[];
  rsi14v: number[]; yellowWave: number[]; pos3: boolean[]; neg3: boolean[];
  plots: Point[][];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrendMeterInputs>): BarStudy<TrendMeterRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const tbGreen = String(color.new(GREEN, 15));
  const tbRed = String(color.new(RED, 20));
  const posPressure = String(color.new(TEAL, 25));
  const negPressure = String(color.new('#DC143C', 32));
  const fillGreen = String(color.new(GREEN, 91));
  const fillRed = String(color.new(RED, 91));
  const hlineColor = String(color.new('#FFFFFF', 100));
  const PLOT_COUNT = 11;

  return {
    init() {
      const s: TrendMeterRun = {
        esa: taStep.ema(9), de: taStep.ema(9), wt1: taStep.ema(12), wt2: taStep.sma(), wtCross: taStep.cross(),
        ma1: maStep(cfg.ma1Type, cfg.ma1Length), ma2: maStep(cfg.ma2Type, cfg.ma2Length),
        ma3: maStep(cfg.ma3Type, cfg.ma3Length), ma4: maStep(cfg.ma4Type, cfg.ma4Length),
        macdFast: taStep.ema(12), macdSlow: taStep.ema(26), macdSig: taStep.ema(9),
        fastFast: taStep.ema(8), fastSlow: taStep.ema(21), fastSig: taStep.ema(5),
        ema5: taStep.ema(5), ema20: taStep.ema(20), dad: taStep.ema(30),
        rsi5: taStep.rsi(5), rsi13: taStep.rsi(13), rsi14: taStep.rsi(14),
        xMean: taStep.sma(), yMean: taStep.sma(), xDev: taStep.stdev(), yDev: taStep.stdev(), corr: taStep.correlation(21),
        haopen: [], haclose: [], ccolor: [], ma1v: [], ma2v: [], ma3v: [], ma4v: [], rsi14v: [], yellowWave: [],
        pos3: [], neg3: [], plots: Array.from({ length: PLOT_COUNT }, () => []), fillColors: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        s.esa, s.de, s.wt1, s.wt2, s.wtCross, s.ma1, s.ma2, s.ma3, s.ma4, s.macdFast, s.macdSlow, s.macdSig,
        s.fastFast, s.fastSlow, s.fastSig, s.ema5, s.ema20, s.dad, s.rsi5, s.rsi13, s.rsi14,
        s.xMean, s.yMean, s.xDev, s.yDev, s.corr,
      ];
      s.lists = s.times;
      s.series = [
        s.haopen, s.haclose, s.ccolor, s.ma1v, s.ma2v, s.ma3v, s.ma4v, s.rsi14v, s.yellowWave, s.pos3, s.neg3,
        ...s.plots, s.fillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const prev = (a: number[], k = 1) => (i - k >= 0 ? a[i - k] : NaN);

      // Wave Trend
      const ap = (b.high + b.low + b.close) / 3;
      const esa = s.esa.step(ap);
      const de = s.de.step(Math.abs(ap - esa));
      const ci = (ap - esa) / (0.015 * de);
      const wt1 = s.wt1.step(ci);
      const wt2 = s.wt2.step(wt1, 3);
      const yellowWave = wt1 - wt2;
      s.yellowWave[i] = yellowWave;
      const wtCross = s.wtCross.step(wt1, wt2);

      // Moving averages of the trend bars
      const ma1 = s.ma1.step(close);
      const ma2 = s.ma2.step(close);
      const ma3 = s.ma3.step(close);
      const ma4 = s.ma4.step(close);
      s.ma1v[i] = ma1;
      s.ma2v[i] = ma2;
      s.ma3v[i] = ma3;
      s.ma4v[i] = ma4;

      // MACD 12 / 26 / 9 and fast MACD 8 / 21 / 5
      const line = s.macdFast.step(close) - s.macdSlow.step(close);
      const macdHistogram = line - s.macdSig.step(line);
      const fastLine = s.fastFast.step(close) - s.fastSlow.step(close);
      const fastMacdHistogram = fastLine - s.fastSig.step(fastLine);

      // Top Dog Trading Mom / Dad
      const topDogMom = s.ema5.step(close) - s.ema20.step(close);
      const topDogDad = s.dad.step(topDogMom);

      // Trend candles: haopen := na(haopen[1]) ? (open + close) / 2 : (haopen[1] + haclose[1]) / 2, haclose = ohlc4
      const haclose = (b.open + b.high + b.low + b.close) / 4;
      s.haclose[i] = haclose;
      const p = prev(s.haopen);
      const haopen = isNaN(p) ? (b.open + b.close) / 2 : (p + s.haclose[i - 1]) / 2;
      s.haopen[i] = haopen;
      const ccolor = gt(haclose - haopen, 0) ? 1 : 0;
      s.ccolor[i] = ccolor;
      const inside = (k: number) => {
        const o = prev(s.haopen, k);
        const c = prev(s.haclose, k);
        const hi = Math.max(o, c);
        const lo = Math.min(o, c);
        return le(haopen, hi) && ge(haopen, lo) && le(haclose, hi) && ge(haclose, lo);
      };
      let tc = ccolor;
      for (const k of [6, 5, 4, 3, 2, 1]) {
        if (inside(k)) {
          tc = prev(s.ccolor, k);
          break;
        }
      }
      const trendCandle = on(tc) ? 1 : 0;

      // RSI 5, RSI 13 and the linear regression signal line of RSI 13 (x = bar_index)
      const rsi5 = s.rsi5.step(close);
      const rsi13 = s.rsi13.step(close);
      const x = i;
      const x_ = s.xMean.step(x, 21);
      const y_ = s.yMean.step(rsi13, 21);
      const mx = s.xDev.step(x, 21);
      const my = s.yDev.step(rsi13, 21);
      const corr = s.corr.step(x, rsi13);
      const slope = corr * (my / mx);
      const inter = y_ - slope * x_;
      const linReg1 = x * slope + inter;

      const rsi14 = s.rsi14.step(close);
      s.rsi14v[i] = rsi14;

      const meterResult = (src: TrendMeterSource): number => {
        switch (src) {
          case 'MACD Crossover - 12, 26, 9': return gt(macdHistogram, 0) ? 1 : 0;
          case 'MACD Crossover - Fast - 8, 21, 5': return gt(fastMacdHistogram, 0) ? 1 : 0;
          case 'Mom Dad Cross (Top Dog Trading)': return gt(topDogMom, topDogDad) ? 1 : 0;
          case 'RSI Signal Line Cross - RSI 13, Sig 21': return gt(rsi13, linReg1) ? 1 : 0;
          case 'RSI 5: > or < 50': return gt(rsi5, 50) ? 1 : 0;
          case 'RSI 13: > or < 50': return gt(rsi13, 50) ? 1 : 0;
          case 'Trend Candles': return trendCandle;
          default: return NaN;
        }
      };
      const meterColor = (src: TrendMeterSource): string | null => {
        if (src === 'N/A') return null;
        return on(meterResult(src)) ? TEAL : RED;
      };

      const r1 = on(meterResult(cfg.trendBar1));
      const r2 = on(meterResult(cfg.trendBar2));
      const r3 = on(meterResult(cfg.trendBar3));
      const pos3 = r1 && r2 && r3;
      const neg3 = !r1 && !r2 && !r3;
      s.pos3[i] = pos3;
      s.neg3[i] = neg3;

      const tb4On = (() => {
        switch (cfg.trendBar4) {
          case 'MA Direction - Fast MA - TB1': return gt(ma1, prev(s.ma1v));
          case 'MA Direction - Slow MA - TB1': return gt(ma2, prev(s.ma2v));
          default: return gt(ma1, ma2);
        }
      })();
      const tb5On = (() => {
        switch (cfg.trendBar5) {
          case 'MA Direction - Fast MA - TB2': return gt(ma3, prev(s.ma3v));
          case 'MA Direction - Slow MA - TB2': return gt(ma4, prev(s.ma4v));
          default: return gt(ma3, ma4);
        }
      })();
      // BackgroundColorChangePositive = TrendBars3Positive and not TrendBars3Positive[1] (na [1] on bar 0 is false)
      const chPos = pos3 && !(i > 0 && s.pos3[i - 1]);
      const chNeg = neg3 && !(i > 0 && s.neg3[i - 1]);
      // plot transp = 20 / 18 on an opaque colour
      const signalColor = chPos ? String(color.new(TEAL, 20)) : chNeg ? String(color.new(RED, 20)) : 'transparent';
      // OSIndicatorsYellowPointingUp = (RSI14OS or RSI14OS[1]) and WTVOS and YellowWavePointingUp
      const osUp = (lt(rsi14, 30) || lt(prev(s.rsi14v), 30)) && lt(wt1, -60) && gt(yellowWave, prev(s.yellowWave));
      // OBIndicatorsYellowPointingDown = (RSI14OB or RSI14OB[1]) and WTVOB and not YellowWavePointingUp
      const obDown = (gt(rsi14, 70) || gt(prev(s.rsi14v), 70)) && gt(wt1, 60) && !gt(yellowWave, prev(s.yellowWave));
      // PositiveWaveTrendCross = WTCross and WTCrossUp (wt2 - wt1 <= 0), NegativeWaveTrendCross = WTCross and WTCrossDown
      const wtPos = wtCross && le(wt2 - wt1, 0);
      const wtNeg = wtCross && ge(wt2 - wt1, 0);
      const meter = (src: TrendMeterSource, value: number): Point => {
        const c = meterColor(src);
        return { time: t, value, color: c === null ? 'transparent' : String(color.new(c, 18)) };
      };

      const pl = s.plots;
      pl[0][i] = { time: t, value: cfg.posNegPressure && osUp ? 138.5 : NaN, color: posPressure };
      pl[1][i] = { time: t, value: cfg.posNegPressure && obDown ? 138.5 : NaN, color: negPressure };
      pl[2][i] = { time: t, value: cfg.tmSetups ? 134.5 : NaN, color: signalColor };
      {
        const up = wtPos && pos3;
        const down = wtNeg && neg3;
        pl[3][i] = { time: t, value: cfg.tmSetupsAndWt && (up || down) ? 134.5 : NaN, color: signalColor };
      }
      pl[4][i] = meter(cfg.trendBar1, 128.5);
      pl[5][i] = meter(cfg.trendBar2, 122.5);
      pl[6][i] = meter(cfg.trendBar3, 116.5);
      pl[7][i] = { time: t, value: cfg.showTrendBar1 && cfg.showTrendBar2 ? 110 : NaN, color: tb4On ? tbGreen : tbRed };
      pl[8][i] = { time: t, value: cfg.showTrendBar1 && !cfg.showTrendBar2 ? 110 : NaN, color: tb4On ? tbGreen : tbRed };
      pl[9][i] = { time: t, value: cfg.showTrendBar2 && cfg.showTrendBar1 ? 104.5 : NaN, color: tb5On ? tbGreen : tbRed };
      pl[10][i] = { time: t, value: cfg.showTrendBar2 && !cfg.showTrendBar1 ? 110 : NaN, color: tb5On ? tbGreen : tbRed };

      // fill(TMa, TMb, color = TrendBars3Positive ? color.green : TrendBars3Negative ? color.red : na, transp = 91)
      s.fillColors[i] = pos3 ? fillGreen : neg3 ? fillRed : 'transparent';

      // Alert conditions, as the original computes them (na history is false)
      const at = (a: boolean[], k: number) => i - k >= 0 && a[i - k];
      const crossUp = (a: number, bv: number, pa: number, pb: number) => gt(a, bv) && le(pa, pb);
      const crossDown = (a: number, bv: number, pa: number, pb: number) => lt(a, bv) && ge(pa, pb);
      const P3 = pos3, Q3 = neg3;
      const bgPos = chPos, bgNeg = chNeg;
      const wtP = wtPos && P3, wtN = wtNeg && Q3;
      // TrendMetersNoLongerAlign = ((not P or not N) and P[1]) or ((not P or not N) and N[1])
      const notBoth = !P3 || !Q3;
      const noLonger = (notBoth && at(s.pos3, 1)) || (notBoth && at(s.neg3, 1));
      // RapidColorChangePositive / Negative = P and (N[1] or N[2]) / N and (P[1] or P[2])
      const rapidPos = P3 && (at(s.neg3, 1) || at(s.neg3, 2));
      const rapidNeg = Q3 && (at(s.pos3, 1) || at(s.pos3, 2));
      // TB1MACrossUp = crossover(MA1, MA2), TB2MACrossUp = crossover(MA3, MA4), ...
      const pm1 = prev(s.ma1v), pm2 = prev(s.ma2v), pm3 = prev(s.ma3v), pm4 = prev(s.ma4v);
      const tb1Up = crossUp(ma1, ma2, pm1, pm2), tb1Down = crossDown(ma1, ma2, pm1, pm2);
      const tb2Up = crossUp(ma3, ma4, pm3, pm4), tb2Down = crossDown(ma3, ma4, pm3, pm4);
      const tb1Green = gt(ma1, ma2), tb1Red = lt(ma1, ma2);
      const tb2Green = gt(ma3, ma4), tb2Red = lt(ma3, ma4);
      const tb12Green = tb1Green && tb2Green && (tb1Up || tb2Up);
      const tb12Red = tb1Red && tb2Red && (tb1Down || tb2Down);
      const v = [
        obDown || osUp,
        bgPos, bgNeg, bgPos || bgNeg,
        wtP, wtN, wtP || wtN,
        noLonger,
        rapidPos, rapidNeg, rapidPos || rapidNeg,
        tb1Up, tb1Down, tb1Up || tb1Down,
        tb2Up, tb2Down, tb2Up || tb2Down,
        tb12Green, tb12Red, tb12Green || tb12Red,
        tb12Green && P3, tb12Red && Q3, (tb12Green && P3) || (tb12Red && Q3),
        tb1Green && P3, tb1Red && Q3, (tb1Green && P3) || (tb1Red && Q3),
        tb2Green && P3, tb2Red && Q3, (tb2Green && P3) || (tb2Red && Q3),
        bgPos && tb1Green, bgNeg && tb1Red, (bgPos && tb1Green) || (bgNeg && tb1Red),
        bgPos && tb2Green, bgNeg && tb2Red, (bgPos && tb2Green) || (bgNeg && tb2Red),
        bgPos && tb1Green && tb2Green, bgNeg && tb1Red && tb2Red,
        (bgPos && tb1Green && tb2Green) || (bgNeg && tb1Red && tb2Red),
      ];
      for (let k = 0; k < v.length; k++) {
        s.flags[k][i] = v[k];
        if (v[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < PLOT_COUNT; k++) plots[`plot${k}`] = s.plots[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 113.7, options: { color: hlineColor, linestyle: 'dashed' } },
          { value: 131.3, options: { color: hlineColor, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_tma', plot2: 'hline_tmb', colors: s.fillColors.slice(),
            options: { title: 'Trend Meter Background Highlight - 3 Trend Meter Conditions Met' } },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendMeterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendMeterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions, in its declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: ' -   Pos / Neg Pressure', message: 'Pos / Neg Pressure - Trend Meter' },
  { id: 'alert1', title: ' --  3 TMs Turn Green', message: 'All 3 Trend Meters Turn  Green - Trend Meter' },
  { id: 'alert2', title: ' --  3 TMs Turn Red', message: 'All 3 Trend Meters Turn  Red - Trend Meter' },
  { id: 'alert3', title: ' -- 3 TMs Change to Same Color', message: 'All 3 Trend Meters Change to Same Color - Trend Meter' },
  { id: 'alert4', title: '--- 3 TMs Turn Green & WaveTrend X', message: 'Green - Wave Trend Signal - Aligns with 3 Trend Meters - Trend Meter' },
  { id: 'alert5', title: '--- 3 TMs Turn Red & WaveTrend X', message: 'Red - Wave Trend Signal - Aligns with 3 Trend Meters - Trend Meter' },
  { id: 'alert6', title: '--- 3 TMs Change to Same Color & WT X', message: 'Red / Green - Wave Trend Signal - Aligns with 3 Trend Meters - Trend Meter' },
  { id: 'alert7', title: '---- 3 Trend Meters No Longer Align', message: '3 Trend Meters No Longer Align - Trend Meter' },
  { id: 'alert8', title: 'All 3 TMs Rapid Change Red to Green', message: 'All 3 Trend Meters Rapid Change Red to Green - Trend Meter' },
  { id: 'alert9', title: 'All 3 TMs Rapid Change Green to Red', message: 'All 3 Trend Meters Rapid Change Green to Red - Trend Meter' },
  { id: 'alert10', title: 'All 3 TMs Rapid Change to Same Color', message: 'All 3 Trend Meters Rapid Change to Same Color - Trend Meter' },
  { id: 'alert11', title: 'TB 1 Turns Green', message: 'Trend Bar 1 - Turns Green - Trend Meter' },
  { id: 'alert12', title: 'TB 1 Turns Red', message: 'Trend Bar 1 - Turns Red - Trend Meter' },
  { id: 'alert13', title: 'TB 1 Color Change', message: 'Trend Bar 1 - Color Change - Trend Meter' },
  { id: 'alert14', title: 'TB 2 Turns Green', message: 'Trend Bar 2 - Turns Green - Trend Meter' },
  { id: 'alert15', title: 'TB 2 Turns Red', message: 'Trend Bar 2 - Turns Red - Trend Meter' },
  { id: 'alert16', title: 'TB 2 Color Change', message: 'Trend Bar 2 - Color Change - Trend Meter' },
  { id: 'alert17', title: 'TBs 1+2 Turn Green', message: 'Trend Bars 1+2 - Turn Green - Trend Meter' },
  { id: 'alert18', title: 'TBs 1+2 Turn Red', message: 'Trend Bars 1+2 - Turn Red - Trend Meter' },
  { id: 'alert19', title: 'TBs 1+2 Change to Same Color', message: 'Trend Bars 1+2 - Change to Same Color - MAs Crossing - Trend Meter' },
  { id: 'alert20', title: 'TBs 1+2 Turn Green with 3 TMs', message: 'Trend Bars 1+2 - Turn Green with 3 TMs - Trend Meter' },
  { id: 'alert21', title: 'TBs 1+2 Turn Red with 3 TMs', message: 'Trend Bars 1+2 - Turn Red with 3 TMs- Trend Meter' },
  { id: 'alert22', title: 'TBs 1+2 Change to Same Color with 3 TMs', message: 'Trend Bars 1+2 - Change to Same Color with 3 TMs - Trend Meter' },
  { id: 'alert23', title: 'TB 1 Turns Green with 3 TMs', message: 'Trend Bar 1 - Turn Green with 3 TMs - Trend Meter' },
  { id: 'alert24', title: 'TB 1 Turns Red with 3 TMs', message: 'Trend Bar 1 - Turn Red with 3 TMs- Trend Meter' },
  { id: 'alert25', title: 'TB 1 Change to Same Color with 3 TMs', message: 'Trend Bar 1 - Change to Same Color with 3 TMs - Trend Meter' },
  { id: 'alert26', title: 'TB 2 Turns Green with 3 TMs', message: 'Trend Bar 2 - Turn Green with 3 TMs - Trend Meter' },
  { id: 'alert27', title: 'TB 2 Turns Red with 3 TMs', message: 'Trend Bar 2 - Turn Red with 3 TMs- Trend Meter' },
  { id: 'alert28', title: 'TB 2 Change to Same Color with 3 TMs', message: 'Trend Bar 2 - Change to Same Color with 3 TMs - Trend Meter' },
  { id: 'alert29', title: '3 TMs Turn Green with TB 1', message: 'All 3 Trend Meters Turn  Green with TB 1 - Trend Meter' },
  { id: 'alert30', title: '3 TMs Turn Red with TB 1', message: 'All 3 Trend Meters Turn  Red with TB 1 - Trend Meter' },
  { id: 'alert31', title: '3 TMs Change Color with TB 1', message: 'All 3 Trend Meters Change Color with TB 1 - Trend Meter' },
  { id: 'alert32', title: '3 TMs Turn Green with TB 2', message: 'All 3 Trend Meters Turn  Green with TB 2 - Trend Meter' },
  { id: 'alert33', title: '3 TMs Turn Red with TB 2', message: 'All 3 Trend Meters Turn  Red with TB 2 - Trend Meter' },
  { id: 'alert34', title: '3 TMs Change Color with TB 2', message: 'All 3 Trend Meters Change Color with TB 2 - Trend Meter' },
  { id: 'alert35', title: '3 TMs Turn Green with TBs 1+2', message: 'All 3 Trend Meters Turn  Green with Trend Bar 1+2 - Trend Meter' },
  { id: 'alert36', title: '3 TMs Turn Red with TBs 1+2', message: 'All 3 Trend Meters Turn  Red with Trend Bar 1+2 - Trend Meter' },
  { id: 'alert37', title: '3 TMs Change Color with TBs 1+2', message: 'All 3 Trend Meters Change Color with Trend Bar 1+2 - Trend Meter' },
];

export const TrendMeter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
