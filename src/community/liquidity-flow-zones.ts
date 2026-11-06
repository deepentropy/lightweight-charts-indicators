/**
 * Liquidity Flow Zones (LFZ)
 *
 * The last confirmed swing high (pivot high of `pivotLen` bars on each side) is the buy side liquidity level, the
 * last swing low the sell side liquidity level. A bearish sweep is a bar whose high goes above the last swing high
 * by more than atrMult * ATR and that closes back below it; a bullish sweep is a bar whose low goes below the last
 * swing low by more than atrMult * ATR and that closes back above it. Sweeps give BUY / SELL triangles and a green /
 * red background.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Liquidity Sweep' and 'Bearish Liquidity Sweep' on the
 * sweep bars.
 *
 * Reference: "Liquidity Flow Zones (LFZ)" by ReubenMiles
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ExpertTraderASK
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LiquidityFlowZonesInputs {
  /** Pivot length on each side of a swing */
  pivotLen: number;
  /** ATR length */
  atrLen: number;
  /** Sweep filter in ATR */
  atrMult: number;
  /** Show the liquidity levels */
  showZones: boolean;
}

export const defaultInputs: LiquidityFlowZonesInputs = {
  pivotLen: 5,
  atrLen: 14,
  atrMult: 0.2,
  showZones: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Swing Length', defval: 5, min: 2 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'Sweep Filter (ATR)', defval: 0.2, step: 0.05 },
  { id: 'showZones', type: 'bool', title: 'Show Liquidity Levels', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Side Liquidity', color: color.red, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Sell Side Liquidity', color: color.lime, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Liquidity Flow Zones (LFZ)',
  shortTitle: 'Liquidity Flow Zones (LFZ)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine default plotshape text colour */
const PINE_TEXT = '#2962FF';

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface LfzVars {
  /** var float lastHigh = na */
  lastHigh: number;
  lastLow: number;
}

interface LfzRun extends BarRunState<LfzVars> {
  atr: ReturnType<typeof taStep.atr>;
  ph: PivotStep;
  pl: PivotStep;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<LiquidityFlowZonesInputs>): BarStudy<LfzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullBg = String(color.new(color.green, 90));
  const bearBg = String(color.new(color.red, 90));
  return {
    init() {
      const atr = taStep.atr(cfg.atrLen);
      const ph = new PivotStep(cfg.pivotLen, cfg.pivotLen, true);
      const pl = new PivotStep(cfg.pivotLen, cfg.pivotLen, false);
      const s: LfzRun = {
        atr, ph, pl, plot0: [], plot1: [], flags: [[], []], times: [[], []], markers: [], bgColors: [],
        steps: [atr, ph, pl], vars: { lastHigh: NaN, lastLow: NaN }, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.bgColors];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const atr = s.atr.step(b.high, b.low, b.close);
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      if (!isNaN(ph)) v.lastHigh = ph;
      if (!isNaN(pl)) v.lastLow = pl;
      const lastHigh = v.lastHigh;
      const lastLow = v.lastLow;
      s.plot0[i] = { time, value: cfg.showZones ? lastHigh : NaN, color: color.red };
      s.plot1[i] = { time, value: cfg.showZones ? lastLow : NaN, color: color.lime };

      const bearSweep = !isNaN(lastHigh) && gt(b.high, lastHigh + atr * cfg.atrMult) && lt(b.close, lastHigh);
      const bullSweep = !isNaN(lastLow) && lt(b.low, lastLow - atr * cfg.atrMult) && gt(b.close, lastLow);
      s.flags[0][i] = bullSweep;
      s.flags[1][i] = bearSweep;
      if (bullSweep) s.times[0].push(time as number);
      if (bearSweep) s.times[1].push(time as number);
      if (bullSweep) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'small', text: 'BUY',
          textColor: PINE_TEXT });
      }
      if (bearSweep) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small', text: 'SELL',
          textColor: PINE_TEXT });
      }
      if (bullSweep) s.bgColors.push({ time, color: bullBg });
      else if (bearSweep) s.bgColors.push({ time, color: bearBg });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(bullSweep, "Bullish Liquidity Sweep") / alertcondition(bearSweep, "Bearish Liquidity Sweep")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidityFlowZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LiquidityFlowZonesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Liquidity Sweep', message: 'Bullish Liquidity Sweep detected' },
  { id: 'alert1', title: 'Bearish Liquidity Sweep', message: 'Bearish Liquidity Sweep detected' },
];

export const LiquidityFlowZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
