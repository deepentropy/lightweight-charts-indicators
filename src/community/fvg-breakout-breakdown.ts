/**
 * FVG Breakout/Breakdown
 *
 * NWOG levels: the close of the bar whose time is 2024-01-01 15:59 UTC and the open of the bar whose time is
 * 2024-01-04 00:00 UTC (both kept once found); gap = open - close; the plots are open + gap and open - gap
 * (na until both bars are found). Fair value gaps: bullish when low[1] > high[3], bearish when high[1] < low[3]
 * (labels). Fresh Buy: close above the NWOG high on a bullish FVG; Fresh Sell: close below the NWOG low on a bearish
 * FVG (labels BUY / SELL).
 * Alerts (alertcondition, `alerts` of the result): 'Fresh Buy Signal' / 'Fresh Sell Signal' on those bars.
 *
 * Reference: "FVG Breakout/Breakdown" by ICT_Concept_Trading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface FvgBreakoutBreakdownInputs {}

export const defaultInputs: FvgBreakoutBreakdownInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NWOG High', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'NWOG Low', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'FVG Breakout/Breakdown',
  shortTitle: 'FVG Breakout/Breakdown',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine default plotshape text colour */
const PINE_BLUE = '#2962FF';

/** timestamp("2024-01-01 15:59 +0000") and timestamp("2024-01-04 00:00 +0000"), in seconds (bar time unit) */
const FRIDAY_CLOSE_TIME = Date.UTC(2024, 0, 1, 15, 59) / 1000;
const MONDAY_OPEN_TIME = Date.UTC(2024, 0, 4, 0, 0) / 1000;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FvgVars {
  /** var float fridayClose = na; var float mondayOpen = na */
  fridayClose: number;
  mondayOpen: number;
}

interface FvgRun extends BarRunState<FvgVars> {
  highData: Point[];
  lowData: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(): BarStudy<FvgRun, Result> {
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: FvgRun = {
        highData: [], lowData: [], markers: [], flags: [[], []], times: [[], []], steps: [],
        vars: { fridayClose: NaN, mondayOpen: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.highData, s.lowData, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      if (b.time === FRIDAY_CLOSE_TIME) v.fridayClose = b.close;
      if (b.time === MONDAY_OPEN_TIME) v.mondayOpen = b.open;
      const nwogGap = v.mondayOpen - v.fridayClose;
      const nwogHigh = v.mondayOpen + nwogGap;
      const nwogLow = v.mondayOpen - nwogGap;

      // bullishFVG = low[1] > high[3]; bearishFVG = high[1] < low[3] (na before bar 3: false)
      const bullishFVG = i >= 3 && gt(bars[i - 1].low, bars[i - 3].high);
      const bearishFVG = i >= 3 && lt(bars[i - 1].high, bars[i - 3].low);
      const freshBreakout = gt(b.close, nwogHigh) && bullishFVG;
      const freshBreakdown = lt(b.close, nwogLow) && bearishFVG;

      // plotshape(bullishFVG, location.belowbar, color.purple, shape.labelup, text = "")
      if (bullishFVG) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.purple, size: 'auto', id: 'shape0' });
      }
      if (bearishFVG) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'auto', id: 'shape1' });
      }
      // plotshape(freshBreakout, location.belowbar, color.purple, shape.labelup, text = "BUY"): default text colour
      if (freshBreakout) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.purple, text: 'BUY',
          textColor: PINE_BLUE, size: 'auto', id: 'shape2' });
      }
      if (freshBreakdown) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: PINE_BLUE, size: 'auto', id: 'shape3' });
      }
      s.highData[i] = { time: b.time, value: val(nwogHigh), color: color.green };
      s.lowData[i] = { time: b.time, value: val(nwogLow), color: color.red };
      // alertcondition(freshBreakout, "Fresh Buy Signal") / alertcondition(freshBreakdown, "Fresh Sell Signal")
      s.flags[0][i] = freshBreakout;
      s.flags[1][i] = freshBreakdown;
      if (freshBreakout) s.times[0].push(b.time as number);
      if (freshBreakdown) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.highData.slice(), plot1: s.lowData.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<FvgBreakoutBreakdownInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FvgBreakoutBreakdownInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}


/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Fresh Buy Signal', message: 'Fresh Buy signal based on NWOG breakout and FVG!' },
  { id: 'alert1', title: 'Fresh Sell Signal', message: 'Fresh Sell signal based on NWOG breakdown and FVG!' },
];

export const FvgBreakoutBreakdown = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
