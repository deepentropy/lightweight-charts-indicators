/**
 * Barchart RSI Modified
 *
 * An RSI with simple moving averages of the gains and losses: rsi = sma(up, period) / (sma(up, period) +
 * sma(down, period)) * 100 (50 when both are 0), and an SMA of the RSI as signal line. The RSI is blue at or above
 * the overbought level, red at or below the oversold level and green between them. The RSI above overbought /
 * below oversold is filled to the level. Horizontal lines at the range bounds (50 +/- range / 2), the levels and 50.
 *
 * Reference: "Barchart RSI Modified" by Santos_Trader_PT
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiModifiedInputs {
  /** Length of the SMAs of the gains and losses */
  period: number;
  /** Range: the range lines are at 50 +/- range / 2 */
  rsiRange: number;
  /** Length of the SMA of the RSI */
  maPeriod: number;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const defaultInputs: RsiModifiedInputs = {
  period: 14,
  rsiRange: 100.0,
  maPeriod: 9,
  overboughtLevel: 70.0,
  oversoldLevel: 30.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 14, min: 1 },
  { id: 'rsiRange', type: 'float', title: 'Range', defval: 100.0, min: 1.0, max: 100.0 },
  { id: 'maPeriod', type: 'int', title: 'RSI MA Period', defval: 9, min: 1 },
  { id: 'overboughtLevel', type: 'float', title: 'Overbought', defval: 70.0, min: 0.0, max: 100.0 },
  { id: 'oversoldLevel', type: 'float', title: 'Oversold', defval: 30.0, min: 0.0, max: 100.0 },
];

const OB_COLOR = String(color.rgb(38, 86, 255));
const OS_COLOR = String(color.rgb(255, 65, 54));
const MID_COLOR = String(color.rgb(0, 176, 91));
const MA_COLOR = String(color.rgb(255, 137, 75));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Fill Source', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Oversold Fill Source', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Overbought Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Oversold Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'RSI', color: MID_COLOR, lineWidth: 2 },
  { id: 'plot5', title: 'RSI MA', color: MA_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Barchart RSI Modified',
  shortTitle: 'RSI Mod',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

interface RsiModRun extends BarRunState<Record<string, never>> {
  up: WindowSma;
  down: WindowSma;
  ma: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<RsiModifiedInputs>): BarStudy<RsiModRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const upperRangeValue = 50.0 + cfg.rsiRange / 2.0;
  const lowerRangeValue = 50.0 - cfg.rsiRange / 2.0;
  const ob = cfg.overboughtLevel;
  const os = cfg.oversoldLevel;
  const rsiColor = (v: number) => (ge(v, ob) ? OB_COLOR : ge(os, v) ? OS_COLOR : MID_COLOR);
  return {
    init() {
      const up = new WindowSma(cfg.period);
      const down = new WindowSma(cfg.period);
      const ma = new WindowSma(cfg.maPeriod);
      const s: RsiModRun = {
        up, down, ma, plots: Array.from({ length: 6 }, () => []), steps: [up, down, ma], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      // diff = close - close[1]; up = math.max(diff, 0); down = math.max(-diff, 0) (na on the first bar)
      const d = i > 0 ? bars[i].close - bars[i - 1].close : NaN;
      const avgUp = s.up.step(isNaN(d) ? NaN : Math.max(d, 0));
      const avgDown = s.down.step(isNaN(d) ? NaN : Math.max(-d, 0));
      const total = avgUp + avgDown;
      // avgTotal == 0.0 ? 50.0 : avgUp / avgTotal * 100.0
      const rsi = eq(total, 0) ? 50.0 : (avgUp / total) * 100.0;
      const rsiMa = s.ma.step(rsi);
      const p = s.plots;
      // plot(rsi > overboughtLevel ? rsi : na, color = na, display = display.none)
      p[0][i] = { time, value: gt(rsi, ob) ? rsi : NaN };
      // plot(rsi < oversoldLevel ? rsi : na, color = na, display = display.none)
      p[1][i] = { time, value: gt(os, rsi) ? rsi : NaN };
      p[2][i] = { time, value: ob };
      p[3][i] = { time, value: os };
      p[4][i] = { time, value: rsi, color: rsiColor(rsi) };
      p[5][i] = { time, value: rsiMa, color: MA_COLOR };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const gray = color.gray;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        hlines: [
          { value: upperRangeValue, options: { title: 'Upper Range', color: String(color.new(gray, 70)), linestyle: 'dashed' } },
          { value: ob, options: { title: 'Overbought', color: String(color.new(gray, 25)), linestyle: 'dashed' } },
          { value: 50, options: { title: 'Midpoint', color: String(color.new(gray, 45)), linestyle: 'dotted' } },
          { value: os, options: { title: 'Oversold', color: String(color.new(gray, 25)), linestyle: 'dashed' } },
          { value: lowerRangeValue, options: { title: 'Lower Range', color: String(color.new(gray, 70)), linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Overbought Solid Fill' },
            colors: new Array<string>(n).fill(String(color.new(OB_COLOR, 70))) },
          { plot1: 'plot1', plot2: 'plot3', options: { title: 'Oversold Solid Fill' },
            colors: new Array<string>(n).fill(String(color.new(OS_COLOR, 70))) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiModifiedInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiModifiedInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiModified = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
