/**
 * UM EMA SMA WMA HMA with Directional Color Change
 *
 * A moving average (EMA, SMA, WMA or HMA) of the selected price, and a smoothing line: the same MA type of the MA.
 * Both lines are green when the MA is above the smoothing line and red otherwise (for the HMA: green when the MA is
 * below the smoothing line). The area between the two lines is filled green when the MA is above the smoothing line,
 * red otherwise; the area between the price and the MA is filled green when the MA rises, red otherwise. Optional
 * arrows mark the colour changes (red to green, green to red).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Color Change' / 'Bearish Color Change' on the bars of the
 * red-to-green / green-to-red changes, when "Enable Alerts" is on.
 *
 * Reference: "UM EMA SMA WMA HMA with Directional Color Change" by UnderwearMillionaire
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © UnderwearMillionaire
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type UmSourceOption = 'Close' | 'Open' | 'High' | 'Low' | 'OHLC4';
export type UmMaMethod = 'EMA' | 'SMA' | 'WMA' | 'HMA';

export interface UmEmaSmaWmaHmaWithDirectionalColorChangeInputs {
  /** Price source of the MA */
  srcOption: UmSourceOption;
  /** MA length */
  len: number;
  /** Plot offset (bars) of the MA, the smoothing line and the price plot */
  offset: number;
  /** MA type */
  typeMA: UmMaMethod;
  /** Length of the smoothing line (the same MA type of the MA) */
  smoothingLength: number;
  /** Show the colour change arrows */
  showArrows: boolean;
  /** Enable the alerts (the two alert conditions are false when off) */
  enableAlerts: boolean;
}

export const defaultInputs: UmEmaSmaWmaHmaWithDirectionalColorChangeInputs = {
  srcOption: 'OHLC4',
  len: 65,
  offset: 0,
  typeMA: 'EMA',
  smoothingLength: 2,
  showArrows: false,
  enableAlerts: true,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'srcOption', type: 'string', title: 'Source', defval: 'OHLC4', options: ['Close', 'Open', 'High', 'Low', 'OHLC4'],
    tooltip: 'Select the price source for the MA calculation.',
  },
  { id: 'len', type: 'int', title: 'Length', defval: 65, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'typeMA', type: 'string', title: 'Method', defval: 'EMA', options: ['EMA', 'SMA', 'WMA', 'HMA'] },
  { id: 'smoothingLength', type: 'int', title: 'Smoothing Length', defval: 2, min: 1, max: 100 },
  { id: 'showArrows', type: 'bool', title: 'Show Arrows', defval: false },
  { id: 'enableAlerts', type: 'bool', title: 'Enable Alerts', defval: true },
];

const PRICE_COL = String(color.new(color.gray, 100));
const FILL_UP_80 = String(color.new(color.green, 80));
const FILL_DN_80 = String(color.new(color.red, 80));
const FILL_UP_90 = String(color.new(color.green, 90));
const FILL_DN_90 = String(color.new(color.red, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Smoothing Line', color: color.green, lineWidth: 1 },
  { id: 'plot2', title: 'Price', color: PRICE_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'UM EMA SMA WMA HMA with Directional Color Change',
  shortTitle: 'UM-MA-w-Color-Change',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface UmRun extends BarRunState<Record<string, never>> {
  ma: Ma;
  smooth: Ma;
  src: number[];
  out: number[];
  smoothingLine: number[];
  up: boolean[];
  maFill: string[];
  priceFill: string[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<UmEmaSmaWmaHmaWithDirectionalColorChangeInputs>): BarStudy<UmRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // src = switch srcOption
  const source = (b: Bar): number => {
    switch (cfg.srcOption) {
      case 'Close': return b.close;
      case 'Open': return b.open;
      case 'High': return b.high;
      case 'Low': return b.low;
      default: return (b.open + b.high + b.low + b.close) / 4;
    }
  };
  // ma(source, length, type): the type is an input, so the taken switch branch runs on every bar
  const maStep = (length: number): Ma => {
    switch (cfg.typeMA) {
      case 'SMA': return new WindowSma(length);
      case 'WMA': {
        const m = taStep.wma();
        return { step: (v) => m.step(v, length), commit: () => m.commit() };
      }
      case 'HMA': {
        // ta.wma(2 * ta.wma(source, length / 2) - ta.wma(source, length), math.round(math.sqrt(length))):
        // length / 2 keeps the fraction in Pine v6, ta.wma truncates it; length 1 gives ta.wma(source, 0.5): a Pine
        // runtime error on the first bar
        if (Math.floor(length / 2) < 1) {
          throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        }
        const half = taStep.wma();
        const full = taStep.wma();
        const hull = taStep.wma();
        const sqrtLength = Math.round(Math.sqrt(length));
        return {
          step: (v) => hull.step(2 * half.step(v, length / 2) - full.step(v, length), sqrtLength),
          commit: () => { half.commit(); full.commit(); hull.commit(); },
        };
      }
      default: return taStep.ema(length);
    }
  };
  const isHMA = cfg.typeMA === 'HMA';
  return {
    init() {
      const ma = maStep(cfg.len);
      const smooth = maStep(cfg.smoothingLength);
      const s: UmRun = {
        ma, smooth, src: [], out: [], smoothingLine: [], up: [], maFill: [], priceFill: [], flags: [[], []],
        times: [[], []], markers: [], steps: [ma, smooth], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.src, s.out, s.smoothingLine, s.up, s.maFill, s.priceFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = source(b);
      const out = s.ma.step(src);
      const smoothingLine = s.smooth.step(out);
      s.src[i] = src;
      s.out[i] = out;
      s.smoothingLine[i] = smoothingLine;
      // outCurrColor = isHMA ? (out < smoothingLine ? green : red) : (out > smoothingLine ? green : red)
      const up = isHMA ? lt(out, smoothingLine) : gt(out, smoothingLine);
      s.up[i] = up;
      // plotLong = outPrevColor == red and outCurrColor == green (outPrevColor: the same test on bar i - 1, red on bar 0)
      const prevUp = i > 0 && s.up[i - 1];
      const plotLong = !prevUp && up;
      const plotShort = prevUp && !up;
      const long = plotLong && cfg.enableAlerts;
      const short = plotShort && cfg.enableAlerts;
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(b.time as number);
      if (short) s.times[1].push(b.time as number);
      if (cfg.showArrows && plotLong) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green });
      }
      if (cfg.showArrows && plotShort) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red });
      }
      // fill(emaPlot, smoothingPlot, color = out > smoothingLine ? color.new(green, 80) : color.new(red, 80))
      s.maFill[i] = gt(out, smoothingLine) ? FILL_UP_80 : FILL_DN_80;
      // fill(pricePlot, emaPlot, color = out > out[1] ? color.new(green, 90) : color.new(red, 90))
      s.priceFill[i] = i > 0 && gt(out, s.out[i - 1]) ? FILL_UP_90 : FILL_DN_90;
    },
    result(s, bars) {
      const n = bars.length;
      // the times of the shifted points follow the bar count (future bars after the last one)
      const interval = barInterval(bars);
      const k = cfg.offset;
      // plot(..., offset = k): the value (and colour) of bar i is drawn on bar i + k
      const shifted = (values: number[], colorAt: (i: number) => string): Point[] => {
        const pts: Point[] = [];
        for (let i = 0; i < n; i++) {
          if (i + k < 0) continue;
          pts.push({ time: barTime(bars, i + k, interval), value: Number.isFinite(values[i]) ? values[i] : NaN, color: colorAt(i) });
        }
        return pts;
      };
      const colorOf = (i: number) => (s.up[i] ? color.green : color.red);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: shifted(s.out, colorOf),
          plot1: shifted(s.smoothingLine, colorOf),
          plot2: shifted(s.src, () => PRICE_COL),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.maFill.slice() },
          { plot1: 'plot2', plot2: 'plot0', colors: s.priceFill.slice() },
        ],
        markers: s.markers.slice(),
        // alertcondition(plotLong and enableAlerts) / alertcondition(plotShort and enableAlerts)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<UmEmaSmaWmaHmaWithDirectionalColorChangeInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UmEmaSmaWmaHmaWithDirectionalColorChangeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Color Change', message: 'MA and Smoothing Line Bullish Color Change (Red to Green)' },
  { id: 'alert1', title: 'Bearish Color Change', message: 'MA and Smoothing Line Bearish Color Change (Green to Red)' },
];

export const UmEmaSmaWmaHmaWithDirectionalColorChange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
