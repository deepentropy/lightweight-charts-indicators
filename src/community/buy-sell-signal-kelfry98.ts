/**
 * Buy Sell Signal
 *
 * A fast and a slow EMA of the close give the trend. A change of the trend (confirmed by the candle direction when
 * the option is on) opens a position: BUY when the fast EMA gets above the slow one, SELL when it gets below. The
 * stop is the low (high) of the signal bar minus (plus) the ATR times a multiplier, the final target is the risk
 * times the risk / reward ratio, with one intermediate target per whole risk unit. Shapes mark the entries, the final
 * target, the stop and the entries cancelled by an opposite signal; labels mark the intermediate targets when they
 * are reached. While a position is open, lines show the entry, the stop and the targets, and a table gives the
 * status of the position.
 * Alerts (alertcondition, `alerts` of the result): BUY / SELL signal, final take profit, stop loss and entry
 * invalidated, true on the bars of the matching shapes.
 *
 * Reference: "Buy Sell Signal" by kelfry98
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, str, barInterval,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData, LabelData, LineDrawingData, TableData, TableCellData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '🟢 BUY Signal', message: '📈 BUY on {{ticker}} | Price: {{close}}' },
  { id: 'alert1', title: '🔴 SELL Signal', message: '📉 SELL on {{ticker}} | Price: {{close}}' },
  { id: 'alert2', title: '🎯 Final Take Profit', message: '✅ Final TP hit on {{ticker}} | Price: {{close}}' },
  { id: 'alert3', title: '❌ Stop Loss', message: '🛑 SL triggered on {{ticker}} | Price: {{close}}' },
  { id: 'alert4', title: '⚠️ Entry Invalidated', message: '⚠️ Previous entry invalidated on {{ticker}} | New signal detected' },
];

export interface BuySellSignalKelfry98Inputs {
  emaFastLen: number;
  emaSlowLen: number;
  atrLen: number;
  /** Stop distance from the low / high of the signal bar, in ATR */
  atrMultSL: number;
  riskReward: number;
  /** A BUY needs a rising candle, a SELL a falling candle */
  confirmCandle: boolean;
  showEmaFast: boolean;
  emaFastColor: string;
  showEmaSlow: boolean;
  emaSlowColor: string;
}

export const defaultInputs: BuySellSignalKelfry98Inputs = {
  emaFastLen: 5,
  emaSlowLen: 13,
  atrLen: 14,
  atrMultSL: 0.5,
  riskReward: 3.0,
  confirmCandle: true,
  showEmaFast: true,
  emaFastColor: '#4CAF50',
  showEmaSlow: true,
  emaSlowColor: '#FF9800',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFastLen', type: 'int', title: 'Fast EMA', defval: 5, min: 1 },
  { id: 'emaSlowLen', type: 'int', title: 'Slow EMA', defval: 13, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Period', defval: 14, min: 1 },
  { id: 'atrMultSL', type: 'float', title: 'SL Multiplier (ATR)', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'riskReward', type: 'float', title: 'Risk:Reward (R:R)', defval: 3.0, min: 1.0, step: 0.5 },
  { id: 'confirmCandle', type: 'bool', title: 'Require candle confirmation', defval: true },
  { id: 'showEmaFast', type: 'bool', title: 'Show Fast EMA', defval: true, group: 'EMAs' },
  { id: 'emaFastColor', type: 'color', title: 'Fast EMA Color', defval: '#4CAF50', group: 'EMAs' },
  { id: 'showEmaSlow', type: 'bool', title: 'Show Slow EMA', defval: true, group: 'EMAs' },
  { id: 'emaSlowColor', type: 'color', title: 'Slow EMA Color', defval: '#FF9800', group: 'EMAs' },
];

// plot(..., display = showEmaFastLabel ? display.all : display.none): PlotConfig `visible` = the input id
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#4CAF50', lineWidth: 1, visible: 'showEmaFast' },
  { id: 'plot1', title: 'Slow EMA', color: '#FF9800', lineWidth: 1, visible: 'showEmaSlow' },
];

export const metadata = {
  title: 'Buy Sell Signal',
  shortTitle: 'Buy Sell Signal',
  overlay: true,
};

/** indicator() default: max_lines_count = 50, max_labels_count = 50 */
const MAX_LINES = 50;
const MAX_LABELS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when a > b - 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);

interface LineObj {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  deleted: boolean;
}

type Result = Omit<IndicatorResult, 'markers' | 'labels' | 'lines' | 'tables'> & {
  markers: MarkerData[]; labels: LabelData[]; lines: LineDrawingData[]; tables: TableData[];
} & { alerts: AlertConditionState[] };

interface KelfryVars {
  prevBullTrend: boolean;
  // Position
  entryPrice: number;
  stopLoss: number;
  takeProfitFinal: number;
  inPosition: boolean;
  positionType: string;
  invalidatedType: string;
  /** Changed in place (copied in copyVars) */
  tpLevels: number[];
  tpHitFlags: boolean[];
  tpAlreadyMarked: boolean[];
  // Drawings: the live lines in creation order (a creation that brings the count above max + 5 deletes the oldest
  // until max remain; a line a `var` variable still refers to is not deleted) and the live labels
  lines: LineObj[];
  entryLine: LineObj | null;
  slLine: LineObj | null;
  tpLineFinal: LineObj | null;
  tpIntermediateLines: LineObj[];
  labels: LabelData[];
}

interface KelfryRun extends BarRunState<KelfryVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number; color: string }[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function createLine(v: KelfryVars, obj: LineObj): LineObj {
  v.lines.push(obj);
  if (v.lines.length > MAX_LINES + 5) {
    let excess = v.lines.length - MAX_LINES;
    v.lines = v.lines.filter((o) => {
      if (excess <= 0 || o === v.entryLine || o === v.slLine || o === v.tpLineFinal) return true;
      excess--;
      o.deleted = true;
      return false;
    });
  }
  return obj;
}

function deleteLine(v: KelfryVars, obj: LineObj | null): void {
  if (!obj || obj.deleted) return;
  obj.deleted = true;
  v.lines.splice(v.lines.indexOf(obj), 1);
}

function study(inputs: Partial<BuySellSignalKelfry98Inputs>): BarStudy<KelfryRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const numTPs = Math.floor(cfg.riskReward);
  /** `for i = 1 to numTPs - 1`: counts down when numTPs - 1 is below 1 (i = 1, then 0) */
  const tpSteps: number[] = [];
  if (numTPs - 1 >= 1) for (let k = 1; k <= numTPs - 1; k++) tpSteps.push(k);
  else for (let k = 1; k >= numTPs - 1; k--) tpSteps.push(k);

  const white = String(color.white);
  const tpLabelColor = String(color.new(color.green, 50));
  const tpLineColor = String(color.new(color.green, 60));
  const invTextColor = String(color.rgb(97, 100, 107));
  const fastColor = String(color.new(cfg.emaFastColor, 0));
  const slowColor = String(color.new(cfg.emaSlowColor, 0));
  const newLine = (v: KelfryVars, x1: number, y1: number, x2: number, y2: number, css: string, width: number, style: LineObj['style']) =>
    createLine(v, { x1, y1, x2, y2, color: css, width, style, deleted: false });
  const setLine = (l: LineObj, x1: number, y1: number, x2: number, y2: number) => {
    l.x1 = x1;
    l.y1 = y1;
    l.x2 = x2;
    l.y2 = y2;
  };

  return {
    init() {
      const fast = taStep.ema(cfg.emaFastLen);
      const slow = taStep.ema(cfg.emaSlowLen);
      const atr = taStep.atr(cfg.atrLen);
      const s: KelfryRun = {
        fast, slow, atr, plot0: [], plot1: [], markers: [], flags: [[], [], [], [], []], times: [[], [], [], [], []],
        steps: [fast, slow, atr],
        vars: {
          prevBullTrend: false, entryPrice: NaN, stopLoss: NaN, takeProfitFinal: NaN, inPosition: false, positionType: '',
          invalidatedType: '', tpLevels: [], tpHitFlags: [], tpAlreadyMarked: [], lines: [], entryLine: null,
          slLine: null, tpLineFinal: null, tpIntermediateLines: [], labels: [],
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { open, high, low, close, time } = bars[i];
      const emaFast = s.fast.step(close) ?? NaN;
      const emaSlow = s.slow.step(close) ?? NaN;
      const atr = s.atr.step(high, low, close) ?? NaN;
      s.plot0[i] = { time, value: emaFast, color: fastColor };
      s.plot1[i] = { time, value: emaSlow, color: slowColor };

      const bullTrend = gt(emaFast, emaSlow);
      const bearTrend = lt(emaFast, emaSlow);
      const trendChange = bullTrend !== v.prevBullTrend;
      v.prevBullTrend = bullTrend;
      const buySignal = bullTrend && trendChange && (!cfg.confirmCandle || gt(close, open));
      const sellSignal = bearTrend && trendChange && (!cfg.confirmCandle || lt(close, open));

      // Final target and stop of the open position
      let tpFinalHit = false;
      let slHit = false;
      let invalidated = false;
      if (v.inPosition && v.positionType === 'LONG') {
        if (ge(high, v.takeProfitFinal)) {
          tpFinalHit = true;
          v.inPosition = false;
          v.positionType = '';
        } else if (le(low, v.stopLoss)) {
          slHit = true;
          v.inPosition = false;
          v.positionType = '';
        }
      }
      if (v.inPosition && v.positionType === 'SHORT') {
        if (le(low, v.takeProfitFinal)) {
          tpFinalHit = true;
          v.inPosition = false;
          v.positionType = '';
        } else if (ge(high, v.stopLoss)) {
          slHit = true;
          v.inPosition = false;
          v.positionType = '';
        }
      }
      const tpLevels = v.tpLevels;
      const tpHitFlags = v.tpHitFlags;
      // Intermediate targets (marked once)
      if (v.inPosition && tpLevels.length > 0) {
        for (let k = 0; k < tpLevels.length; k++) {
          if (tpHitFlags[k]) continue;
          if (v.positionType === 'LONG' && ge(high, tpLevels[k])) tpHitFlags[k] = true;
          else if (v.positionType === 'SHORT' && le(low, tpLevels[k])) tpHitFlags[k] = true;
        }
      }

      // New entries; an open position of the other side is cancelled
      let showBuySignal = false;
      let showSellSignal = false;
      if (buySignal && (!v.inPosition || v.positionType !== 'LONG')) {
        if (v.inPosition && v.positionType === 'SHORT') {
          invalidated = true;
          v.invalidatedType = 'SELL';
          v.inPosition = false;
        }
        v.entryPrice = close;
        v.stopLoss = low - atr * cfg.atrMultSL;
        const risk = v.entryPrice - v.stopLoss;
        v.takeProfitFinal = v.entryPrice + risk * cfg.riskReward;
        tpLevels.length = 0;
        tpHitFlags.length = 0;
        for (const k of tpSteps) {
          tpLevels.push(v.entryPrice + risk * k);
          tpHitFlags.push(false);
        }
        v.inPosition = true;
        v.positionType = 'LONG';
        showBuySignal = true;
      }
      if (sellSignal && (!v.inPosition || v.positionType !== 'SHORT')) {
        if (v.inPosition && v.positionType === 'LONG') {
          invalidated = true;
          v.invalidatedType = 'BUY';
          v.inPosition = false;
        }
        v.entryPrice = close;
        v.stopLoss = high + atr * cfg.atrMultSL;
        const risk = v.stopLoss - v.entryPrice;
        v.takeProfitFinal = v.entryPrice - risk * cfg.riskReward;
        tpLevels.length = 0;
        tpHitFlags.length = 0;
        for (const k of tpSteps) {
          tpLevels.push(v.entryPrice - risk * k);
          tpHitFlags.push(false);
        }
        v.inPosition = true;
        v.positionType = 'SHORT';
        showSellSignal = true;
      }

      // alertcondition(showBuySignal) / (showSellSignal) / (tpFinalHit) / (slHit) / (invalidated)
      const f = [showBuySignal, showSellSignal, tpFinalHit, slHit, invalidated];
      for (let k = 0; k < 5; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(time as number);
      }

      // Shapes
      const markers = s.markers;
      if (showBuySignal) {
        markers.push({ time, position: 'belowBar', shape: 'labelUp', color: String(color.new(color.lime, 0)), text: 'BUY', textColor: white, size: 'small' });
      }
      if (showSellSignal) {
        markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: String(color.new(color.red, 0)), text: 'SELL', textColor: white, size: 'small' });
      }
      if (tpFinalHit) {
        markers.push({ time, position: 'aboveBar', shape: 'circle', color: String(color.new('#00ff00', 0)), text: '🎯 TP', textColor: '#00ff00', size: 'small' });
      }
      if (slHit) {
        markers.push({ time, position: 'belowBar', shape: 'xcross', color: String(color.new('#ff0000', 0)), text: 'SL', textColor: white, size: 'small' });
      }
      if (invalidated && v.invalidatedType === 'BUY') {
        markers.push({ time, position: 'aboveBar', shape: 'diamond', color: String(color.new(color.yellow, 0)), text: 'INV BUY', textColor: invTextColor, size: 'tiny' });
      }
      if (invalidated && v.invalidatedType === 'SELL') {
        markers.push({ time, position: 'aboveBar', shape: 'diamond', color: String(color.new(color.yellow, 0)), text: 'INV SELL', textColor: invTextColor, size: 'tiny' });
      }

      // Labels of the intermediate targets, once per target
      const tpAlreadyMarked = v.tpAlreadyMarked;
      if (showBuySignal || showSellSignal) {
        tpAlreadyMarked.length = 0;
        for (let k = 0; k < tpSteps.length; k++) tpAlreadyMarked.push(false);
      }
      if (v.inPosition && tpHitFlags.length > 0 && tpAlreadyMarked.length > 0) {
        for (let k = 0; k < tpHitFlags.length; k++) {
          if (tpHitFlags[k] && !tpAlreadyMarked[k]) {
            // max_labels_count: a creation above max + 5 deletes the oldest until max remain
            v.labels.push({
              time, price: high, text: 'TP' + str.tostring(k + 1), style: 'label_down', color: tpLabelColor,
              textColor: white, size: 'tiny', yloc: 'abovebar',
            });
            if (v.labels.length > MAX_LABELS + 5) v.labels.splice(0, v.labels.length - MAX_LABELS);
            tpAlreadyMarked[k] = true;
          }
        }
      }

      // Risk management lines
      if (v.inPosition && v.positionType !== '') {
        const { entryPrice, stopLoss, takeProfitFinal } = v;
        if (v.entryLine === null) v.entryLine = newLine(v, i - 10, entryPrice, i + 10, entryPrice, String(color.new(color.white, 0)), 1, 'dashed');
        else setLine(v.entryLine, i - 10, entryPrice, i + 10, entryPrice);
        if (v.slLine === null) v.slLine = newLine(v, i, stopLoss, i + 1, stopLoss, String(color.new(color.red, 0)), 2, 'solid');
        else setLine(v.slLine, i, stopLoss, i + 1, stopLoss);
        if (v.tpLineFinal === null) v.tpLineFinal = newLine(v, i, takeProfitFinal, i + 1, takeProfitFinal, String(color.new(color.green, 0)), 2, 'solid');
        else setLine(v.tpLineFinal, i, takeProfitFinal, i + 1, takeProfitFinal);
        const tpIntermediateLines = v.tpIntermediateLines;
        if (tpIntermediateLines.length === 0 && tpLevels.length > 0) {
          for (let k = 0; k < tpLevels.length; k++) {
            tpIntermediateLines.push(newLine(v, i, tpLevels[k], i + 1, tpLevels[k], tpLineColor, 1, 'dotted'));
          }
        } else if (tpIntermediateLines.length > 0) {
          for (let k = 0; k < tpIntermediateLines.length; k++) {
            setLine(tpIntermediateLines[k], i, tpLevels[k], i + 1, tpLevels[k]);
          }
        }
      } else {
        if (v.entryLine !== null) {
          deleteLine(v, v.entryLine);
          v.entryLine = null;
        }
        if (v.slLine !== null) {
          deleteLine(v, v.slLine);
          v.slLine = null;
        }
        if (v.tpLineFinal !== null) {
          deleteLine(v, v.tpLineFinal);
          v.tpLineFinal = null;
        }
        if (v.tpIntermediateLines.length > 0) {
          for (const l of v.tpIntermediateLines) deleteLine(v, l);
          v.tpIntermediateLines.length = 0;
        }
      }
    },
    copyVars(v) {
      // the lines are changed in place: copies, with the references of the variables pointed at the copies
      const map = new Map<LineObj, LineObj>();
      const cl = (l: LineObj): LineObj => {
        let c = map.get(l);
        if (!c) {
          c = { ...l };
          map.set(l, c);
        }
        return c;
      };
      return {
        ...v,
        tpLevels: v.tpLevels.slice(),
        tpHitFlags: v.tpHitFlags.slice(),
        tpAlreadyMarked: v.tpAlreadyMarked.slice(),
        lines: v.lines.map(cl),
        entryLine: v.entryLine && cl(v.entryLine),
        slLine: v.slLine && cl(v.slLine),
        tpLineFinal: v.tpLineFinal && cl(v.tpLineFinal),
        tpIntermediateLines: v.tpIntermediateLines.map(cl),
        labels: v.labels.slice(),
      };
    },
    result(s, bars) {
      const n = bars.length;
      const { inPosition, positionType, entryPrice, stopLoss, takeProfitFinal } = s.vars;
      // Info table (filled on the last bar)
      const cells: TableCellData[] = [];
      if (n > 0) {
        const cell = (column: number, row: number, text: string, textColor: string) => {
          cells.push({ column, row, text, textColor, textSize: 'small' });
        };
        cell(0, 0, 'Status:', white);
        cell(1, 0, inPosition ? positionType : 'No Position', String(inPosition ? color.yellow : color.gray));
        if (inPosition) {
          cell(0, 1, 'Entry:', white);
          cell(1, 1, str.tostring(entryPrice, '#.##'), white);
          cell(0, 2, 'Stop Loss:', white);
          cell(1, 2, str.tostring(stopLoss, '#.##'), String(color.red));
          cell(0, 3, 'Take Profit:', white);
          cell(1, 3, str.tostring(takeProfitFinal, '#.##'), String(color.green));
          const riskVal = Math.abs(entryPrice - stopLoss);
          const rewardVal = Math.abs(takeProfitFinal - entryPrice);
          const currentRR = rewardVal / riskVal;
          cell(0, 4, 'R:R:', white);
          cell(1, 4, str.tostring(currentRR, '#.##') + ':1', String(color.orange));
        }
      }
      const table: TableData = {
        position: 'top_right', columns: 2, rows: 5, cells, bgColor: String(color.new(color.black, 85)), borderWidth: 1,
      };

      // Times of bar indexes before the first bar and after the last bar
      const interval = barInterval(bars);
      const T = (index: number) => (index < 0 ? bars[0].time + index * interval
        : index < n ? bars[index].time : bars[n - 1].time + (index - (n - 1)) * interval);

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        labels: s.vars.labels.slice(),
        lines: s.vars.lines.map((l) => ({
          time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: l.color, width: l.width, style: l.style,
        })),
        tables: n > 0 ? [table] : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuySellSignalKelfry98Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuySellSignalKelfry98Inputs> = {},
): Omit<IndicatorResult, 'markers' | 'labels' | 'lines' | 'tables'> & {
  markers: MarkerData[]; labels: LabelData[]; lines: LineDrawingData[]; tables: TableData[];
} & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BuySellSignalKelfry98 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
