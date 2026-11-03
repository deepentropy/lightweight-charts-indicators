/**
 * Grid Bot Simulator
 *
 * Simulates a grid trading bot between an upper and a lower limit split into equal grid steps. A buy signal is a
 * grid level crossed downwards (previous high above it and low at or below it; closes with "High/Low for signals"
 * off), a sell signal a level crossed upwards. A signal is skipped when it is within one grid step of the last
 * signal level, outside the limits, or (with a market direction) within two steps against that direction. The last
 * signal level gives the zone of one grid step above and below it (circles, filled red / green while "Highlight
 * Trade Zones" is on, faint black when it is off, as the original), and the grid lines are drawn on every bar (red
 * above the close, green below, none on the signal level), with a faint line at the last signal level; "Show Only
 * Current Grids" draws only the levels above and below it.
 *
 * Reference: "Grid Bot Simulator" by xxattaxx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©mvs1231 || xxattaxx || DisDev
 */

import {
  color, line, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface GridBotSimulatorInputs {
  upperLimit: number;
  lowerLimit: number;
  /** Number of grids (the script uses this + 1 levels) */
  noGrids: number;
  dir: 'up' | 'neutral' | 'down';
  signalSize: 'small' | 'large';
  showGrids: boolean;
  highLight: boolean;
  showCurrent: boolean;
  extremes: boolean;
}

export const defaultInputs: GridBotSimulatorInputs = {
  upperLimit: 50000.0,
  lowerLimit: 43000.0,
  noGrids: 10,
  dir: 'neutral',
  signalSize: 'small',
  showGrids: true,
  highLight: true,
  showCurrent: false,
  extremes: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'upperLimit', type: 'float', title: 'Upper Limit', defval: 50000.0, confirm: true },
  { id: 'lowerLimit', type: 'float', title: 'Lower Limit', defval: 43000.0, confirm: true },
  { id: 'noGrids', type: 'int', title: 'Number of Grids(10)', defval: 10 },
  { id: 'dir', type: 'string', title: 'Market Direction', defval: 'neutral', options: ['up', 'neutral', 'down'] },
  { id: 'signalSize', type: 'string', title: 'Signal Size', defval: 'small', options: ['small', 'large'] },
  { id: 'showGrids', type: 'bool', title: 'Show Grids', defval: true },
  { id: 'highLight', type: 'bool', title: 'Highlight Trade Zones', defval: true },
  { id: 'showCurrent', type: 'bool', title: 'Show Only Current Grids', defval: false },
  { id: 'extremes', type: 'bool', title: 'High/Low for signals', defval: true },
];

// Pine v5 colours
const RED = '#FF5252';
const GREEN = '#4CAF50';
const CRIMSON = '#DC143C';
const LIME_GREEN = '#32CD32';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Limit', color: RED, lineWidth: 3 },
  { id: 'plot1', title: 'Lower Limit', color: GREEN, lineWidth: 3 },
  { id: 'plot2', title: 'Line Above', color: String(color.new(RED, 100)), lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Line Below', color: String(color.new(GREEN, 100)), lineWidth: 1, style: 'circles' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot2', plot2: 'plot3', title: 'Trade Zone' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Buy', char: '▲', location: 'belowbar', color: LIME_GREEN, size: 'tiny' },
  { id: 'char1', kind: 'char', title: 'Sell', char: '▼', location: 'abovebar', color: CRIMSON, size: 'tiny' },
  { id: 'char2', kind: 'char', title: 'Buy', char: '▲', location: 'belowbar', color: LIME_GREEN, size: 'small' },
  { id: 'char3', kind: 'char', title: 'Sell', char: '▼', location: 'abovebar', color: CRIMSON, size: 'small' },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'buy', message: 'buy' },
  { id: 'alert1', title: 'sell', message: 'sell' },
];

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'Grid Bot Simulator',
  shortTitle: 'GridBotDir',
  overlay: true,
};

/** Pine float comparisons: within 1e-10 is equal; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<GridBotSimulatorInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const upper = cfg.upperLimit;
  const lower = cfg.lowerLimit;
  const noGrids = Math.trunc(cfg.noGrids) + 1;
  const direction = cfg.dir === 'up' ? 1 : cfg.dir === 'down' ? -1 : 0;
  const small = cfg.signalSize === 'small';
  const extremes = cfg.extremes;

  const redGrid = String(color.new(RED, 50));
  const greenGrid = String(color.new(GREEN, 40));
  const gridInterval = (upper - lower) / (noGrids - 1);
  // a_grid = array.new_float(No_Grids); array.set(a_grid, x, LowerLimit + GridInterval * x)
  const grid: number[] = [];
  for (let x = 0; x <= noGrids - 1; x++) grid.push(lower + gridInterval * x);

  // bar times in ms (Pine `time`)
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;

  resetDrawings({ line: 50 });

  const upperV: number[] = [];
  const lowerV: number[] = [];
  const aboveV: number[] = [];
  const belowV: number[] = [];
  const upperC: string[] = [];
  const lowerC: string[] = [];
  const fillColors: string[] = [];
  const markers: MarkerData[] = [];
  const buyFlags: boolean[] = [];
  const sellFlags: boolean[] = [];

  let prevLastSignal = NaN;
  let prevLastIndex = NaN;
  let prevLastTime = NaN;
  let prevSignalLine = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const p = i > 0 ? bars[i - 1] : undefined;
    const time = b.time * ms;
    const prevTime = p ? p.time * ms : NaN;

    // Get_BuyLine_Index() / Get_SellLine_Index(): the last level crossed
    let buyIdx = 0;
    let sellIdx = 0;
    for (let x = 0; x <= noGrids - 1; x++) {
      const v = lower + gridInterval * x;
      if (extremes) {
        if (p && gt(p.high, v) && le(b.low, v)) buyIdx = x;
        if (p && lt(p.low, v) && ge(b.high, v)) sellIdx = x;
      } else {
        if (p && gt(p.close, v) && le(b.close, v)) buyIdx = x;
        if (p && lt(p.close, v) && ge(b.close, v)) sellIdx = x;
      }
    }
    let buy = buyIdx > 0;
    let sell = sellIdx > 0;
    // No repeat trades at current level
    if (extremes) {
      if (ge(b.low, prevSignalLine - gridInterval)) buy = false;
      if (le(b.high, prevSignalLine + gridInterval)) sell = false;
    } else {
      if (ge(b.close, prevSignalLine - gridInterval)) buy = false;
      if (le(b.close, prevSignalLine + gridInterval)) sell = false;
    }
    // No trades outside of grid limits
    if (ge(b.close, upper)) buy = false;
    if (lt(b.close, lower)) buy = false;
    if (le(b.close, lower)) sell = false;
    if (gt(b.close, upper)) sell = false;
    // Direction filter (skip one signal if against market direction)
    if (direction === -1 && ge(b.low, prevSignalLine - gridInterval * 2)) buy = false;
    if (direction === 1 && le(b.high, prevSignalLine + gridInterval * 2)) sell = false;

    // Trackers
    const lastSignal = buy ? 1 : sell ? -1 : prevLastSignal;
    const lastIndex = buy ? buyIdx : sell ? sellIdx : prevLastIndex;
    const lastTime = buy || sell ? time : prevLastTime;
    const signalLine = lower + gridInterval * lastIndex;

    // Plot grids
    for (let k = 1; k <= noGrids - 1; k++) {
      const value = grid[k];
      const closest = value - b.close;
      let lineColor = gt(closest, 0) ? redGrid : lt(closest, 0) ? greenGrid : 'transparent';
      if (k === lastIndex) lineColor = 'transparent';
      if (cfg.showGrids) {
        if (cfg.showCurrent) {
          line.new(lastTime, signalLine + gridInterval, time + 1000000, signalLine + gridInterval, 'bar_time', 'left', RED, 'solid', 1);
          line.new(lastTime, signalLine - gridInterval, time + 1000000, signalLine - gridInterval, 'bar_time', 'left', GREEN, 'solid', 1);
        } else {
          const colCurrent = lastSignal === 1 ? String(color.new(GREEN, 95)) : String(color.new(RED, 95));
          line.new(time, value, prevTime, value, 'bar_time', 'right', lineColor, 'solid', 1);
          // draw line before latest signal
          line.new(lastTime, signalLine, lastTime - 100000, signalLine, 'bar_time', 'right', colCurrent, 'solid', 1);
        }
      }
    }

    const ul = cfg.showGrids && !cfg.showCurrent;
    upperV.push(ul ? upper : NaN);
    upperC.push(ge(b.close, upper) ? GREEN : RED);
    lowerV.push(ul ? lower : NaN);
    lowerC.push(le(b.close, lower) ? RED : GREEN);
    // Lines one above and one below
    aboveV.push(eq(signalLine, upper) ? signalLine : signalLine + gridInterval);
    belowV.push(eq(signalLine, lower) ? signalLine : signalLine - gridInterval);
    // boxColor = LastSignal == -1 ? green 90 : red 90 (na when "Highlight Trade Zones" is off);
    // fill(a, b, color = color.new(boxColor, 90)): color.new(na, 90) is black with transparency 90
    const boxColor = cfg.highLight ? color.new(lastSignal === -1 ? GREEN : RED, 90) : null;
    fillColors.push(String(color.new(boxColor, 90)));

    if (buy) {
      markers.push({
        id: small ? 'char0' : 'char2', time: b.time, position: 'belowBar', shape: 'circle', color: 'transparent',
        text: '▲', textColor: LIME_GREEN, size: small ? 'tiny' : 'small',
      });
    }
    if (sell) {
      markers.push({
        id: small ? 'char1' : 'char3', time: b.time, position: 'aboveBar', shape: 'circle', color: 'transparent',
        text: '▼', textColor: CRIMSON, size: small ? 'tiny' : 'small',
      });
    }
    buyFlags.push(buy);
    sellFlags.push(sell);

    prevLastSignal = lastSignal;
    prevLastIndex = lastIndex;
    prevLastTime = lastTime;
    prevSignalLine = signalLine;
  }
  setDrawingBar(null);

  const series = (v: number[], c?: string[]) =>
    bars.map((b, i) => ({ time: b.time, value: isFinite(v[i]) ? v[i] : NaN, ...(c ? { color: c[i] } : {}) }));
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot2', plot2: 'plot3', options: { title: 'Trade Zone' }, colors: fillColors },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: series(upperV, upperC),
      plot1: series(lowerV, lowerC),
      plot2: series(aboveV),
      plot3: series(belowV),
    },
    fills,
    markers,
    ...drawingOutputs(bars, ms === 1 ? 'ms' : 's'),
    alerts: alertStates(alertConditions, bars, [buyFlags, sellFlags]),
  };
}

export const GridBotSimulator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  alertConditions,
  drawingKinds,
};
