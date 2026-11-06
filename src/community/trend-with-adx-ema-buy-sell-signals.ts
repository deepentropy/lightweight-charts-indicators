/**
 * Trend with ADX - Buy & Sell
 *
 * Directional movement (+DI / -DI) from the RMA of the true range and of the plus / minus directional movement:
 * the background is green when +DI is above -DI, else red. A fast and a slow EMA of the close are drawn; a Buy
 * label marks a fast EMA cross above the slow EMA after a cross below, a Sell label the opposite.
 * Alerts (alertcondition, `alerts` of the result): 'Trend Green Alert' (+DI above -DI), 'Trend Red Alert' (-DI above
 * +DI), 'Buy Alert' and 'Sell Alert' (the bars of the Buy / Sell labels).
 *
 * Reference: "Trend with ADX/EMA - Buy & Sell Signals" by RMPM
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface TrendWithAdxEmaBuySellSignalsInputs {
  /** ADX length (RMA length of the true range and directional movement) */
  len: number;
  /** Threshold (not used by the script) */
  th: number;
  /** Fast EMA length */
  len1: number;
  /** Slow EMA length */
  len2: number;
}

export const defaultInputs: TrendWithAdxEmaBuySellSignalsInputs = {
  len: 14,
  th: 20,
  len1: 5,
  len2: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
  { id: 'th', type: 'float', title: 'Threshold', defval: 20 },
  { id: 'len1', type: 'int', title: 'FastEMA', defval: 5, min: 1 },
  { id: 'len2', type: 'int', title: 'SlowEMA', defval: 8, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FastEMA', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'SlowEMA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Trend with ADX - Buy & Sell',
  shortTitle: 'Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface AdxRun extends BarRunState<{ condIni: number }> {
  rmaTr: ReturnType<typeof taStep.rma>;
  rmaPlus: ReturnType<typeof taStep.rma>;
  rmaMinus: ReturnType<typeof taStep.rma>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrendWithAdxEmaBuySellSignalsInputs>): BarStudy<AdxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const nz = (v: number) => (Number.isNaN(v) ? 0 : v);
  const bull = 'rgb(173, 230, 174)';
  const bear = 'rgb(227, 142, 142)';
  return {
    init() {
      const s: AdxRun = {
        rmaTr: taStep.rma(cfg.len), rmaPlus: taStep.rma(cfg.len), rmaMinus: taStep.rma(cfg.len),
        ema1: taStep.ema(cfg.len1), ema2: taStep.ema(cfg.len2), over: taStep.crossover(), under: taStep.crossunder(),
        plot0: [], plot1: [], bgColors: [], markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { condIni: NaN }, lists: [], series: [],
      };
      s.steps = [s.rmaTr, s.rmaPlus, s.rmaMinus, s.ema1, s.ema2, s.over, s.under];
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const prevClose = i > 0 ? nz(bars[i - 1].close) : 0;
      const prevHigh = i > 0 ? nz(bars[i - 1].high) : 0;
      const prevLow = i > 0 ? nz(bars[i - 1].low) : 0;
      const tr = Math.max(Math.max(b.high - b.low, Math.abs(b.high - prevClose)), Math.abs(b.low - prevClose));
      const dmPlus = gt(b.high - prevHigh, prevLow - b.low) ? Math.max(b.high - prevHigh, 0) : 0;
      const dmMinus = gt(prevLow - b.low, b.high - prevHigh) ? Math.max(prevLow - b.low, 0) : 0;
      const smoothedTr = s.rmaTr.step(tr);
      const smoothedPlus = s.rmaPlus.step(dmPlus);
      const smoothedMinus = s.rmaMinus.step(dmMinus);

      const ema1 = s.ema1.step(b.close);
      const ema2 = s.ema2.step(b.close);
      const longCond = s.over.step(ema1, ema2);
      const shortCond = s.under.step(ema1, ema2);

      // A plain division: x / 0 is +-infinity (0 / 0 NaN), the comparison uses the infinite value
      const diPlus = (smoothedPlus / smoothedTr) * 100;
      const diMinus = (smoothedMinus / smoothedTr) * 100;
      s.bgColors.push({ time: t, color: gt(diPlus, diMinus) ? bull : bear });

      // CondIni := longCond ? 1 : shortCond ? -1 : CondIni[1]
      const prev = s.vars.condIni;
      s.vars.condIni = longCond ? 1 : shortCond ? -1 : prev;
      const buy = !!longCond && prev === -1;
      const sell = !!shortCond && prev === 1;
      if (buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Buy',
          textColor: color.white, size: 'tiny' });
      }
      if (sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Sell',
          textColor: color.white, size: 'tiny' });
      }
      // trendGreen = DIPlus > DIMinus / trendRed = DIMinus > DIPlus
      const flags = [gt(diPlus, diMinus), gt(diMinus, diPlus), buy, sell];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t);
      }

      s.plot0[i] = { time: t, value: ema1, color: color.green };
      s.plot1[i] = { time: t, value: ema2, color: color.red };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendWithAdxEmaBuySellSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendWithAdxEmaBuySellSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Trend Green Alert', message: 'Trend Green Alert' },
  { id: 'alert1', title: 'Trend Red Alert', message: 'Trend Red Alert' },
  { id: 'alert2', title: 'Buy Alert', message: 'Buy Alert' },
  { id: 'alert3', title: 'Sell Alert', message: 'Sell Alert' },
];

export const TrendWithAdxEmaBuySellSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
