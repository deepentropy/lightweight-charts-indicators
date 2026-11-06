/**
 * Pivot Point SuperTrend
 *
 * SuperTrend around a centre line built from pivot points: each new pivot high or low moves the
 * centre by center = (center * 2 + pivot) / 3. The bands are center -/+ Factor * ATR, trailed like
 * a SuperTrend. Buy / Sell on a trend change, optional pivot labels, centre line and
 * support / resistance levels.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' / 'Sell Signal' on a trend change up / down, and
 * 'Trend Changed' on either.
 *
 * Reference: "Pivot Point SuperTrend" by LonesomeTheBlue
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PivotPointSupertrendInputs {
  pivotLen: number;
  atrFactor: number;
  atrLen: number;
  showPivot: boolean;
  showLabel: boolean;
  showCl: boolean;
  showSr: boolean;
}

export const defaultInputs: PivotPointSupertrendInputs = {
  pivotLen: 2,
  atrFactor: 3,
  atrLen: 10,
  showPivot: false,
  showLabel: true,
  showCl: false,
  showSr: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Point Period', defval: 2, min: 1, max: 50 },
  { id: 'atrFactor', type: 'float', title: 'ATR Factor', defval: 3, min: 1, step: 0.1 },
  { id: 'atrLen', type: 'int', title: 'ATR Period', defval: 10, min: 1 },
  { id: 'showPivot', type: 'bool', title: 'Show Pivot Points', defval: false },
  { id: 'showLabel', type: 'bool', title: 'Show Buy/Sell Labels', defval: true },
  { id: 'showCl', type: 'bool', title: 'Show PP Center Line', defval: false },
  { id: 'showSr', type: 'bool', title: 'Show Support/Resistance', defval: false },
];

// Pine v4 colour constants
const LIME = '#00E676';
const RED = '#FF5252';
const BLUE = '#2196F3';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PP SuperTrend', color: LIME, lineWidth: 2 },
  { id: 'plot1', title: 'Center Line', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Support', color: LIME, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Resistance', color: RED, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Pivot Point SuperTrend',
  shortTitle: 'PPST',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PpstVars {
  /** var float center = na */
  center: number;
  /** TUp[1], TDown[1] */
  prevTUp: number;
  prevTDown: number;
  support: number;
  resistance: number;
}

interface PpstRun extends BarRunState<PpstVars> {
  ph: PivotStep;
  pl: PivotStep;
  atr: ReturnType<typeof taStep.atr>;
  trend: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PivotPointSupertrendInputs>): BarStudy<PpstRun, Result> {
  const { pivotLen: prd, atrFactor: Factor, atrLen: Pd, showPivot, showLabel, showCl, showSr } = { ...defaultInputs, ...inputs };

  // Pine `if ph` / `ph ? ...`: na and 0 are false
  const isPivot = (v: number | null | undefined): v is number => v != null && !isNaN(v) && v !== 0;

  return {
    init() {
      const s: PpstRun = {
        ph: new PivotStep(prd, prd, true), pl: new PivotStep(prd, prd, false), atr: taStep.atr(Pd),
        trend: [], plots: Array.from({ length: 4 }, () => []), markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [],
        vars: { center: NaN, prevTUp: NaN, prevTDown: NaN, support: NaN, resistance: NaN },
        lists: [], series: [],
      };
      s.steps = [s.ph, s.pl, s.atr];
      s.lists = [s.markers, ...s.times];
      s.series = [s.trend, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // Pine: float ph = pivothigh(prd, prd), float pl = pivotlow(prd, prd)
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);

      // Pine: lastpp = ph ? ph : pl ? pl : na; center := na(center) ? lastpp : (center * 2 + lastpp) / 3
      const lastpp = isPivot(ph) ? ph : isPivot(pl) ? pl : NaN;
      if (isPivot(lastpp)) {
        v.center = isNaN(v.center) ? lastpp : (v.center * 2 + lastpp) / 3;
      }
      const center = v.center;

      const atr = s.atr.step(b.high, b.low, b.close);
      const Up = center - Factor * atr;
      const Dn = center + Factor * atr;

      // Pine: TUp := close[1] > TUp[1] ? max(Up, TUp[1]) : Up (comparisons with na are false, max with na is na)
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const TUp = close1 > v.prevTUp ? Math.max(Up, v.prevTUp) : Up;
      const TDown = close1 < v.prevTDown ? Math.min(Dn, v.prevTDown) : Dn;

      // Pine: Trend := close > TDown[1] ? 1 : close < TUp[1] ? -1 : nz(Trend[1], 1)
      const close = b.close;
      const trend = close > v.prevTDown ? 1 : close < v.prevTUp ? -1 : i > 0 ? s.trend[i - 1] : 1;

      s.trend[i] = trend;
      const tsl = trend === 1 ? TUp : TDown;
      v.prevTUp = TUp;
      v.prevTDown = TDown;

      // Pine: support := pl ? pl : support[1]; resistance := ph ? ph : resistance[1]
      if (isPivot(pl)) v.support = pl;
      if (isPivot(ph)) v.resistance = ph;

      // Pine: plot(Trailingsl, color = linecolor, linewidth = 2, title = "PP SuperTrend")
      // linecolor = Trend == 1 and nz(Trend[1]) == 1 ? lime : Trend == -1 and nz(Trend[1]) == -1 ? red : na
      // A value with an na colour is kept as a transparent point.
      const t1 = i > 0 ? s.trend[i - 1] : 0;
      const lineColor = trend === 1 && t1 === 1 ? LIME : trend === -1 && t1 === -1 ? RED : 'transparent';
      s.plots[0][i] = { time: b.time, value: tsl, color: lineColor };

      // Pine: plot(showcl ? center : na, color = showcl ? center < hl2 ? blue : red : na)
      if (!showCl) s.plots[1][i] = { time: b.time, value: NaN };
      else {
        const hl2 = (b.high + b.low) / 2;
        s.plots[1][i] = { time: b.time, value: center, color: center < hl2 ? BLUE : RED };
      }

      // Pine: plot(showsr and support ? support : na, ..., style = plot.style_circles, offset = -prd)
      // The value computed on bar i is shown on bar i - prd (bar i is the only writer of that point; its own point
      // stays na until bar i + prd).
      s.plots[2][i] = { time: b.time, value: NaN };
      s.plots[3][i] = { time: b.time, value: NaN };
      if (i >= prd) {
        const back = bars[i - prd].time;
        s.plots[2][i - prd] = { time: back, value: showSr && isPivot(v.support) ? v.support : NaN };
        s.plots[3][i - prd] = { time: back, value: showSr && isPivot(v.resistance) ? v.resistance : NaN };
      }

      // Pine: plotshape(ph and showpivot, text="H", style=shape.labeldown, color=na, textcolor=color.red,
      //   location=location.abovebar, offset = -prd); same for pl with "L", textcolor=color.lime, location.belowbar
      if (showPivot && i >= prd) {
        if (isPivot(ph)) {
          s.markers.push({ time: bars[i - prd].time, position: 'aboveBar', shape: 'labelDown', color: 'transparent', text: 'H', textColor: RED });
        }
        if (isPivot(pl)) {
          s.markers.push({ time: bars[i - prd].time, position: 'belowBar', shape: 'labelDown', color: 'transparent', text: 'L', textColor: LIME });
        }
      }
      // Pine: bsignal = Trend == 1 and Trend[1] == -1; ssignal = Trend == -1 and Trend[1] == 1
      // plotshape(bsignal and showlabel ? Trailingsl : na, "Buy", location.absolute, shape.labelup, size.tiny, lime,
      //   textcolor = color.black)
      // plotshape(ssignal and showlabel ? Trailingsl : na, "Sell", location.absolute, shape.labeldown, size.tiny, red,
      //   textcolor = color.white)
      // (Pine hides the shape when Trailingsl is na). At the stop price: labelup below it, labeldown above it.
      if (showLabel && i > 0 && !isNaN(tsl)) {
        if (trend === 1 && s.trend[i - 1] === -1) {
          s.markers.push({
            time: b.time, position: 'atPriceBottom', price: tsl, shape: 'labelUp',
            color: LIME, text: 'Buy', textColor: '#000000', size: 'tiny',
          });
        }
        if (trend === -1 && s.trend[i - 1] === 1) {
          s.markers.push({
            time: b.time, position: 'atPriceTop', price: tsl, shape: 'labelDown',
            color: RED, text: 'Sell', textColor: '#FFFFFF', size: 'tiny',
          });
        }
      }
      // alertcondition(Trend == 1 and Trend[1] == -1) / (Trend == -1 and Trend[1] == 1) / (change(Trend)); Trend[1] is
      // na on the first bar
      const prev = i > 0 ? s.trend[i - 1] : NaN;
      const buy = i > 0 && trend === 1 && prev === -1;
      const sell = i > 0 && trend === -1 && prev === 1;
      const changed = i > 0 && trend !== prev;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      s.flags[2][i] = changed;
      if (buy) s.times[0].push(b.time as number);
      if (sell) s.times[1].push(b.time as number);
      if (changed) s.times[2].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plots[0].slice(), 'plot1': s.plots[1].slice(), 'plot2': s.plots[2].slice(), 'plot3': s.plots[3].slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotPointSupertrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PivotPointSupertrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy Signal' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell Signal' },
  { id: 'alert2', title: 'Trend Changed', message: 'Trend Changed' },
];

export const PivotPointSupertrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
