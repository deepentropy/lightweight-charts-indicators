/**
 * Setup 9.1 (Larry Williams) + EMA 50
 *
 * Larry Williams' 9.1 setup on a 9-bar EMA (or SMA): the MA is green while rising, red while falling, yellow
 * otherwise. A buy signal is the first bar of a rise: its high is the entry level and its low the stop, kept while
 * the MA rises. A sell signal is the first bar of a fall: its low is the entry level and its high the stop, kept
 * while the MA falls. Signal bars closing in the signal direction are coloured; arrows with text mark the signals.
 * A second MA (50-bar EMA by default) is drawn as a filter.
 * Alerts (alertcondition, `alerts` of the result): '9.1 Buy Alert' / '9.1 Sell Alert', true on the signal bars.
 *
 * Reference: "Setup 9.1 (Larry Williams) + EMA 50" by oDouglasAlex
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type Setup91Ema50MaType = 'EMA' | 'SMA';

export interface Setup91Ema50Inputs {
  /** MA 1 type (9.1 signal) */
  typeMa1: Setup91Ema50MaType;
  /** MA 1 length */
  len: number;
  /** Show MA 2 */
  showMa2: boolean;
  /** MA 2 type (filter) */
  typeMa2: Setup91Ema50MaType;
  /** MA 2 length */
  len2: number;
}

export const defaultInputs: Setup91Ema50Inputs = {
  typeMa1: 'EMA',
  len: 9,
  showMa2: true,
  typeMa2: 'EMA',
  len2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeMa1', type: 'string', title: 'MA 1 Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'len', type: 'int', title: 'MA 1 Length', defval: 9, min: 1 },
  { id: 'showMa2', type: 'bool', title: 'Show MA 2', defval: true },
  { id: 'typeMa2', type: 'string', title: 'MA 2 Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'len2', type: 'int', title: 'MA 2 Length', defval: 50, min: 1 },
];

const GREEN = String(color.new('#1cff78', 0));
const GREEN_60 = String(color.new('#1cff78', 60));
const RED = String(color.new('#FF0000', 0));
const RED_60 = String(color.new('#FF0000', 60));
const YELLOW = String(color.new('#ffeb3b', 0));
const PURPLE = String(color.new('#9C27B0', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average 1 (9.1)', color: GREEN, lineWidth: 2 },
  { id: 'plot1', title: 'Moving Average 2', color: PURPLE, lineWidth: 2 },
  { id: 'plot2', title: 'Buy Entry Level', color: GREEN, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Buy Stop Level', color: GREEN_60, lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Sell Entry Level', color: RED, lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Sell Stop Level', color: RED_60, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Setup 9.1 (Larry Williams) + EMA 50',
  shortTitle: 'Setup 9.1 (Larry Williams) + EMA 50',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface SetupVars {
  /** var float buyTrigger = na, buyStop, sellTrigger, sellStop */
  buyTrigger: number;
  buyStop: number;
  sellTrigger: number;
  sellStop: number;
  /** ma1up[1] / ma1down[1] (false before bar 0) */
  prevUp: boolean;
  prevDown: boolean;
}

interface SetupRun extends BarRunState<SetupVars> {
  ma1: Ma;
  ma2: Ma;
  ma1Arr: number[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<Setup91Ema50Inputs>): BarStudy<SetupRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // get_ma(type, src, length) = type == "EMA" ? ta.ema(src, length) : ta.sma(src, length)
  const getMa = (type: Setup91Ema50MaType, length: number): Ma => (type === 'EMA' ? taStep.ema(length) : new WindowSma(length));
  return {
    init() {
      const ma1 = getMa(cfg.typeMa1, cfg.len);
      const ma2 = getMa(cfg.typeMa2, cfg.len2);
      const s: SetupRun = {
        ma1, ma2, ma1Arr: [], plots: [[], [], [], [], [], []], markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [ma1, ma2],
        vars: { buyTrigger: NaN, buyStop: NaN, sellTrigger: NaN, sellStop: NaN, prevUp: false, prevDown: false },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.ma1Arr, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const ma1 = s.ma1.step(b.close);
      const ma2 = s.ma2.step(b.close);
      s.ma1Arr[i] = ma1;
      const prevMa = i > 0 ? s.ma1Arr[i - 1] : NaN;
      const ma1up = gt(ma1, prevMa);
      const ma1down = lt(ma1, prevMa);
      const maColor = ma1up ? GREEN : ma1down ? RED : YELLOW;

      const buySignal = ma1up && !v.prevUp;
      const sellSignal = ma1down && !v.prevDown;
      v.prevUp = ma1up;
      v.prevDown = ma1down;
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(b.time as number);
      if (sellSignal) s.times[1].push(b.time as number);

      if (buySignal) {
        v.buyTrigger = b.high;
        v.buyStop = b.low;
      } else if (!ma1up) {
        v.buyTrigger = NaN;
        v.buyStop = NaN;
      }
      if (sellSignal) {
        v.sellTrigger = b.low;
        v.sellStop = b.high;
      } else if (!ma1down) {
        v.sellTrigger = NaN;
        v.sellStop = NaN;
      }

      // barcolor(buySignal and close > open ? #1cff78 : na, "Buy Bar Color"),
      // barcolor(sellSignal and close < open ? #FF0000 : na, "Sell Bar Color") (never both on one bar)
      if (sellSignal && lt(b.close, b.open)) s.barColors.push({ time: b.time, color: RED });
      else if (buySignal && gt(b.close, b.open)) s.barColors.push({ time: b.time, color: GREEN });

      // plotshape(buySignal, "9.1 BUY Shape", shape.arrowup, location.belowbar, size.small, text = "BUY 9.1")
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'arrowUp', color: GREEN, size: 'small', text: 'BUY 9.1',
          textColor: GREEN });
      }
      // plotshape(sellSignal, "9.1 SELL Shape", shape.arrowdown, location.abovebar, size.small, text = "SELL 9.1")
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: RED, size: 'small', text: 'SELL 9.1',
          textColor: RED });
      }

      const p = s.plots;
      p[0][i] = { time: b.time, value: ma1, color: maColor };
      p[1][i] = { time: b.time, value: cfg.showMa2 ? ma2 : NaN, color: PURPLE };
      p[2][i] = { time: b.time, value: v.buyTrigger, color: GREEN };
      p[3][i] = { time: b.time, value: v.buyStop, color: GREEN_60 };
      p[4][i] = { time: b.time, value: v.sellTrigger, color: RED };
      p[5][i] = { time: b.time, value: v.sellStop, color: RED_60 };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(buySignal, "9.1 Buy Alert") / alertcondition(sellSignal, "9.1 Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Setup91Ema50Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Setup91Ema50Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '9.1 Buy Alert', message: '9.1 Setup - BUY Signal' },
  { id: 'alert1', title: '9.1 Sell Alert', message: '9.1 Setup - SELL Signal' },
];

export const Setup91Ema50 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
