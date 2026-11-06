/**
 * Trader XO Macro Trend Scanner
 *
 * Overlay indicator (overlay=true) with:
 * - Consolidated EMA (shown when bothEMAs=false), colored green/red/#FF530D based on fast vs slow EMA
 * - Fast EMA (shown when bothEMAs=true), colored green/red/#FF530D based on trend
 * - Slow EMA (shown when bothEMAs=true), colored green/red/#FF530D based on trend
 * - Bull/Bear triangle markers on EMA crossover
 * - barcolor: green for bull/buysignal bars, red for bear/sellsignal bars
 * - bgcolor for Stoch RSI crossover alerts (mid-level, OB/OS-level, K>upper, K<lower)
 * - Moving average filter (EMA/WMA/SMA/None) gating Stoch RSI crossover checks
 * - Alerts (alertcondition, `alerts` of the result): 'Bullish EMA Cross' / 'Bearish EMA Cross' when the fast EMA
 *   crosses over / under the slow EMA, 'Stoch RSI Crossover' on the mid-level Stoch RSI crossover alerts (up or down)
 *
 * Reference: "[@btc_charlie] Trader XO Macro Trend Scanner"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TraderXOInputs {
  fastEMA: number;
  slowEMA: number;
  defEMA: number;
  bothEMAs: boolean;
  smoothK: number;
  smoothD: number;
  rsiLength: number;
  stochLength: number;
  upperBand: number;
  middleBand: number;
  lowerBand: number;
  crossoverBgMid: boolean;
  crossoverBgOBOS: boolean;
  crossoverBgGreater: boolean;
  crossoverBgLess: boolean;
  maType: string;
  maLength: number;
}

export const defaultInputs: TraderXOInputs = {
  fastEMA: 12,
  slowEMA: 25,
  defEMA: 25,
  bothEMAs: true,
  smoothK: 3,
  smoothD: 3,
  rsiLength: 14,
  stochLength: 14,
  upperBand: 80,
  middleBand: 50,
  lowerBand: 20,
  crossoverBgMid: false,
  crossoverBgOBOS: false,
  crossoverBgGreater: false,
  crossoverBgLess: false,
  maType: 'EMA',
  maLength: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastEMA', type: 'int', title: 'Fast EMA', defval: 12, min: 1 },
  { id: 'slowEMA', type: 'int', title: 'Slow EMA', defval: 25, min: 1 },
  { id: 'defEMA', type: 'int', title: 'Consolidated EMA', defval: 25, min: 1 },
  { id: 'bothEMAs', type: 'bool', title: 'Show Both EMAs', defval: true },
  { id: 'smoothK', type: 'int', title: 'K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'D', defval: 3, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLength', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'upperBand', type: 'int', title: 'Upper Band', defval: 80, min: 1 },
  { id: 'middleBand', type: 'int', title: 'Middle Band', defval: 50, min: 1 },
  { id: 'lowerBand', type: 'int', title: 'Lower Band', defval: 20, min: 1 },
  { id: 'crossoverBgMid', type: 'bool', title: 'Crossover Alert BG (Middle Level)', defval: false },
  { id: 'crossoverBgOBOS', type: 'bool', title: 'Crossover Alert BG (OB/OS Level)', defval: false },
  { id: 'crossoverBgGreater', type: 'bool', title: 'Crossover Alert >input', defval: false },
  { id: 'crossoverBgLess', type: 'bool', title: 'Crossover Alert <input', defval: false },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'WMA', 'SMA', 'None'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 200, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'consolidatedEMA', title: 'Consolidated EMA', color: '#26A69A', lineWidth: 3 },
  { id: 'fastEMAPlot', title: 'Fast EMA', color: '#26A69A', lineWidth: 1 },
  { id: 'slowEMAPlot', title: 'Slow EMA', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Trader XO Macro Trend Scanner',
  shortTitle: 'TraderXO',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface TraderXOVars {
  countBuy: number;
  countSell: number;
}

interface TraderXORun extends BarRunState<TraderXOVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  bias: ReturnType<typeof taStep.ema>;
  ma: { step(v: number): number; commit(): void } | null;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiHigh: WindowExtreme;
  rsiLow: WindowExtreme;
  kSma: WindowSma;
  dSma: WindowSma;
  fastArr: number[];
  slowArr: number[];
  kArr: number[];
  dArr: number[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TraderXOInputs>): BarStudy<TraderXORun, Result> {
  const {
    fastEMA, slowEMA, defEMA, bothEMAs,
    smoothK, smoothD, rsiLength, stochLength,
    upperBand, middleBand, lowerBand,
    crossoverBgMid, crossoverBgOBOS, crossoverBgGreater, crossoverBgLess,
    maType, maLength,
  } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(fastEMA, slowEMA, defEMA);
  // Moving average filter for Stoch RSI crossover checks
  const maStep = (): TraderXORun['ma'] => {
    if (maType === 'EMA') return taStep.ema(maLength);
    if (maType === 'WMA') {
      const m = taStep.wma();
      return { step: (v) => m.step(v, maLength), commit: () => m.commit() };
    }
    if (maType === 'SMA') return new WindowSma(maLength);
    return null;
  };
  return {
    init() {
      // EMA calculations
      const fast = taStep.ema(fastEMA);
      const slow = taStep.ema(slowEMA);
      const bias = taStep.ema(defEMA);
      const ma = maStep();
      // Stoch RSI calculation
      const rsi = taStep.rsi(rsiLength);
      const rsiHigh = new WindowExtreme(false, stochLength);
      const rsiLow = new WindowExtreme(true, stochLength);
      const kSma = new WindowSma(smoothK);
      const dSma = new WindowSma(smoothD);
      const s: TraderXORun = {
        fast, slow, bias, ma, rsi, rsiHigh, rsiLow, kSma, dSma, fastArr: [], slowArr: [], kArr: [], dArr: [],
        plots: [[], [], []], markers: [], barColors: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [fast, slow, bias, ...(ma ? [ma] : []), rsi, rsiHigh, rsiLow, kSma, dSma],
        vars: { countBuy: 0, countSell: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.fastArr, s.slowArr, s.kArr, s.dArr, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const close = bar.close;
      const t = bar.time;
      const v = s.vars;
      const fEMA = s.fast.step(close);
      const sEMA = s.slow.step(close);
      const bEMA = s.bias.step(close);
      s.fastArr[i] = fEMA;
      s.slowArr[i] = sEMA;
      const maVal = s.ma ? s.ma.step(close) : NaN;

      const r = s.rsi.step(close);
      const h = s.rsiHigh.step(r);
      const l = s.rsiLow.step(r);
      const stochRSI = r == null || isNaN(r) || h == null || isNaN(h) || l == null || isNaN(l) || h === l
        ? NaN
        : ((r - l) / (h - l)) * 100;
      const kVal = s.kSma.step(stochRSI);
      const dVal = s.dSma.step(kVal);
      s.kArr[i] = kVal;
      s.dArr[i] = dVal;

      // Pine: emaColor = v_fastEMA > v_slowEMA ? color.green : v_fastEMA < v_slowEMA ? color.red : #FF530D
      let emaColor = '#FF530D';
      if (!isNaN(fEMA) && !isNaN(sEMA)) {
        if (fEMA > sEMA) emaColor = '#26A69A';
        else if (fEMA < sEMA) emaColor = '#EF5350';
      }

      // Pine: plot(i_bothEMAs ? na : v_biasEMA, color=emaColor, linewidth=3, title='Consolidated EMA')
      s.plots[0][i] = { time: t, value: (!bothEMAs && i >= warmup) ? bEMA : NaN, color: emaColor };
      // Pine: plot(i_bothEMAs ? v_fastEMA : na, title='Fast EMA', color=emaColor)
      s.plots[1][i] = { time: t, value: (bothEMAs && i >= warmup) ? fEMA : NaN, color: emaColor };
      // Pine: plot(i_bothEMAs ? v_slowEMA : na, title='Slow EMA', color=emaColor)
      s.plots[2][i] = { time: t, value: (bothEMAs && i >= warmup) ? sEMA : NaN, color: emaColor };

      // EMA crossover state tracking (need previous bar)
      const buy = fEMA > sEMA;
      const sell = fEMA < sEMA;

      if (buy) { v.countBuy += 1; }
      if (buy) { v.countSell = 0; }
      if (sell) { v.countSell += 1; }
      if (sell) { v.countBuy = 0; }
      const { countBuy, countSell } = v;

      // alertcondition(crossupalert or crossdownalert, 'Stoch RSI Crossover')
      let stochCross = false;
      const fEMAPrev = i >= 1 ? s.fastArr[i - 1] : NaN;
      const sEMAPrev = i >= 1 ? s.slowArr[i - 1] : NaN;
      if (i >= 1) {
        const prevBuy = !isNaN(fEMAPrev) && !isNaN(sEMAPrev) && fEMAPrev > sEMAPrev;
        const prevSell = !isNaN(fEMAPrev) && !isNaN(sEMAPrev) && fEMAPrev < sEMAPrev;

        // Pine: buysignal = countBuy < 2 and countBuy > 0 and countSell < 1 and buy and not buy[1]
        const buysignal = countBuy < 2 && countBuy > 0 && countSell < 1 && buy && !prevBuy;
        // Pine: sellsignal = countSell > 0 and countSell < 2 and countBuy < 1 and sell and not sell[1]
        const sellsignal = countSell > 0 && countSell < 2 && countBuy < 1 && sell && !prevSell;

        const bull = countBuy > 1;
        const bear = countSell > 1;

        // Pine barcolor: buysignal green, sellsignal red, then bull green, bear red
        // In Pine, later barcolor calls override earlier ones. Since buysignal and bull
        // are mutually exclusive (buysignal needs countBuy==1, bull needs countBuy>=2),
        // we can just check all conditions.
        // `id`: the barcolor() call (barcolor0 buysignal, barcolor1 sellsignal, barcolor2 bull, barcolor3 bear)
        if (buysignal || bull) {
          s.barColors.push({ id: buysignal ? 'barcolor0' : 'barcolor2', time: t, color: '#26A69A' });
        } else if (sellsignal || bear) {
          s.barColors.push({ id: sellsignal ? 'barcolor1' : 'barcolor3', time: t, color: '#EF5350' });
        }

        // Pine: plotshape Bull triangle below bar
        if (buysignal) {
          s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bull' });
        }
        // Pine: plotshape Bear triangle above bar
        if (sellsignal) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Bear' });
        }

        // Stoch RSI crossover bgcolor signals (k and d known on this bar and the bar before)
        const kPrev = s.kArr[i - 1];
        const dPrev = s.dArr[i - 1];
        if (kVal != null && !isNaN(kVal) && dVal != null && !isNaN(dVal) &&
            kPrev != null && !isNaN(kPrev) && dPrev != null && !isNaN(dPrev)) {

          const crossUp = kPrev <= dPrev && kVal > dVal;
          const crossDown = kPrev >= dPrev && kVal < dVal;

          // Pine: crossupCHECK = maTypeChoice == 'None' or open > maValue and maTypeChoice != 'None'
          // Pine: crossdownCHECK = maTypeChoice == 'None' or open < maValue and maTypeChoice != 'None'
          const crossupCHECK = maType === 'None' || (!isNaN(maVal) && bar.open > maVal);
          const crossdownCHECK = maType === 'None' || (!isNaN(maVal) && bar.open < maVal);

          const crossupalert = crossupCHECK && crossUp && (kVal < middleBand || dVal < middleBand);
          const crossdownalert = crossdownCHECK && crossDown && (kVal > middleBand || dVal > middleBand);
          const crossupOSalert = crossupCHECK && crossUp && (kVal < lowerBand || dVal < lowerBand);
          const crossdownOBalert = crossdownCHECK && crossDown && (kVal > upperBand || dVal > upperBand);

          const aboveBandalert = kPrev >= upperBand && kVal < upperBand; // ta.crossunder(k, bandno0)
          const belowBandalert = kPrev <= lowerBand && kVal > lowerBand; // ta.crossover(k, bandno1)

          stochCross = crossupalert || crossdownalert;

          // bgcolor0 (Middle Level): crossupalert and MidOnOff ? #4CAF50 : crossdownalert and MidOnOff ? #FF0000 : na
          if (crossoverBgMid) {
            if (crossupalert) {
              s.bgColors.push({ id: 'bgcolor0', time: t, color: 'rgba(76,175,80,0.30)' });
            } else if (crossdownalert) {
              s.bgColors.push({ id: 'bgcolor0', time: t, color: 'rgba(255,0,0,0.30)' });
            }
          }

          // bgcolor1 (OB/OS Level): crossupOSalert and OBOSOnOff ? #fbc02d : crossdownOBalert and OBOSOnOff ? #000000 : na
          if (crossoverBgOBOS) {
            if (crossupOSalert) {
              s.bgColors.push({ id: 'bgcolor1', time: t, color: 'rgba(251,192,45,0.30)' });
            } else if (crossdownOBalert) {
              s.bgColors.push({ id: 'bgcolor1', time: t, color: 'rgba(0,0,0,0.30)' });
            }
          }

          // bgcolor2 (K > Upper level): aboveBandalert and GreaterThanOnOff ? #ff0014
          //   : crossdownalert and MidOnOff ? #FF0000 : na
          if (aboveBandalert && crossoverBgGreater) {
            s.bgColors.push({ id: 'bgcolor2', time: t, color: 'rgba(255,0,20,0.30)' });
          } else if (crossdownalert && crossoverBgMid) {
            s.bgColors.push({ id: 'bgcolor2', time: t, color: 'rgba(255,0,0,0.30)' });
          }

          // bgcolor3 (K < Lower level): belowBandalert and LessThanOnOff ? #4CAF50
          //   : crossdownalert and MidOnOff ? #FF0000 : na
          if (belowBandalert && crossoverBgLess) {
            s.bgColors.push({ id: 'bgcolor3', time: t, color: 'rgba(76,175,80,0.30)' });
          } else if (crossdownalert && crossoverBgMid) {
            s.bgColors.push({ id: 'bgcolor3', time: t, color: 'rgba(255,0,0,0.30)' });
          }
        }
      }

      // alertcondition(ta.crossover(v_fastEMA, v_slowEMA)) / alertcondition(ta.crossunder(v_fastEMA, v_slowEMA))
      const flags = [
        fEMA > sEMA && fEMAPrev <= sEMAPrev,
        fEMA < sEMA && fEMAPrev >= sEMAPrev,
        stochCross,
      ];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'consolidatedEMA': s.plots[0].slice(),
          'fastEMAPlot': s.plots[1].slice(),
          'slowEMAPlot': s.plots[2].slice(),
        },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TraderXOInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TraderXOInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish EMA Cross', message: 'Bullish EMA crossover' },
  { id: 'alert1', title: 'Bearish EMA Cross', message: 'Bearish EMA Crossover' },
  { id: 'alert2', title: 'Stoch RSI Crossover', message: 'STOCH RSI CROSSOVER' },
];

export const TraderXO = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
