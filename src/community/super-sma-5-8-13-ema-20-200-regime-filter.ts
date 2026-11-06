/**
 * Super SMA 5 8 13 + EMA 20/200 Regime Filter
 *
 * SMAs 5, 8 and 13 and EMAs 20 and 200 of the close. A buy signal is a cross of SMA 5 and SMA 13 with SMA 5 above
 * SMA 13; a sell signal is a cross of SMA 5 and SMA 13 with SMA 5 below SMA 8 and SMA 13. The regime filter keeps
 * all signals, only the signals when EMA 20 > EMA 200 (bullish) or only when EMA 20 < EMA 200 (bearish).
 * Alerts (alertcondition, `alerts` of the result): 'Buy Condition' and 'Sell Condition', true on the signal bars.
 *
 * Reference: "Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET)" by afdzjr69
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Owner: ALIZET
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SuperSma5813Ema20200RegimeFilterInputs {
  /** Regime filter */
  regimeMode: 'Both' | 'Bullish only (EMA20 > EMA200)' | 'Bearish only (EMA20 < EMA200)';
}

export const defaultInputs: SuperSma5813Ema20200RegimeFilterInputs = {
  regimeMode: 'Both',
};

export const inputConfig: InputConfig[] = [
  { id: 'regimeMode', type: 'string', title: 'Regime Filter', defval: 'Both',
    options: ['Both', 'Bullish only (EMA20 > EMA200)', 'Bearish only (EMA20 < EMA200)'] },
];

const SMA5_COL = String(color.rgb(0, 255, 8));
const SMA8_COL = '#ff7300';
const SMA13_COL = String(color.rgb(191, 0, 255));
const EMA20_COL = '#2148f3';
const EMA200_COL = '#ff0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA 5', color: SMA5_COL, lineWidth: 2 },
  { id: 'plot1', title: 'SMA 8', color: SMA8_COL, lineWidth: 2 },
  { id: 'plot2', title: 'SMA 13', color: SMA13_COL, lineWidth: 2 },
  { id: 'plot3', title: 'EMA 20', color: EMA20_COL, lineWidth: 5 },
  { id: 'plot4', title: 'EMA 200', color: EMA200_COL, lineWidth: 5 },
];

export const metadata = {
  title: 'Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET)',
  shortTitle: 'Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SuperSmaVars {
  /** ta.cross(ma5, ma13): the last bar where both values were not na */
  prev5: number;
  prev13: number;
}

interface SuperSmaRun extends BarRunState<SuperSmaVars> {
  sma5: WindowSma;
  sma8: WindowSma;
  sma13: WindowSma;
  ema20: ReturnType<typeof taStep.ema>;
  ema200: ReturnType<typeof taStep.ema>;
  lines: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SuperSma5813Ema20200RegimeFilterInputs>): BarStudy<SuperSmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma5 = new WindowSma(5);
      const sma8 = new WindowSma(8);
      const sma13 = new WindowSma(13);
      const ema20 = taStep.ema(20);
      const ema200 = taStep.ema(200);
      const s: SuperSmaRun = {
        sma5, sma8, sma13, ema20, ema200, lines: [[], [], [], [], []], markers: [], flags: [[], []], times: [[], []],
        steps: [sma5, sma8, sma13, ema20, ema200], vars: { prev5: NaN, prev13: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.lines, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const close = bars[i].close;
      const time = bars[i].time;
      const a = s.sma5.step(close);
      const m8 = s.sma8.step(close);
      const b = s.sma13.step(close);
      const e20 = s.ema20.step(close);
      const e200 = s.ema200.step(close);
      // ta.cross(ma5, ma13): compares exactly, with the last bar where both values were not na
      let cross = false;
      if (!isNaN(a) && !isNaN(b)) {
        cross = !isNaN(v.prev5) && ((a > b && v.prev5 <= v.prev13) || (a < b && v.prev5 >= v.prev13));
        v.prev5 = a;
        v.prev13 = b;
      }
      const bullRegime = gt(e20, e200);
      const bearRegime = lt(e20, e200);
      const regimeFilter = cfg.regimeMode === 'Bullish only (EMA20 > EMA200)' ? bullRegime
        : cfg.regimeMode === 'Bearish only (EMA20 < EMA200)' ? bearRegime : true;
      const buyCond = cross && gt(a, b) && regimeFilter;
      const sellCond = cross && lt(a, m8) && lt(a, b) && regimeFilter;
      // plotshape(buy_cond, "BUY SIGNAL", shape.triangleup, location.belowbar, color.lime, size = size.large,
      //   text = "BUY NOW"): default text colour
      if (buyCond) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'large',
          text: 'BUY NOW', textColor: color.blue });
      }
      if (sellCond) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'large',
          text: 'SELL NOW', textColor: color.blue });
      }
      const l = s.lines;
      l[0][i] = { time, value: a, color: SMA5_COL };
      l[1][i] = { time, value: m8, color: SMA8_COL };
      l[2][i] = { time, value: b, color: SMA13_COL };
      l[3][i] = { time, value: e20, color: EMA20_COL };
      l[4][i] = { time, value: e200, color: EMA200_COL };
      s.flags[0][i] = buyCond;
      s.flags[1][i] = sellCond;
      if (buyCond) s.times[0].push(time as number);
      if (sellCond) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const l = s.lines;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: l[0].slice(), plot1: l[1].slice(), plot2: l[2].slice(), plot3: l[3].slice(), plot4: l[4].slice() },
        markers: s.markers.slice(),
        // alertcondition(buy_cond, "Buy Condition") / alertcondition(sell_cond, "Sell Condition")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperSma5813Ema20200RegimeFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SuperSma5813Ema20200RegimeFilterInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Condition', message: 'Buy Alert!' },
  { id: 'alert1', title: 'Sell Condition', message: 'Sell Alert!' },
];

export const SuperSma5813Ema20200RegimeFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
