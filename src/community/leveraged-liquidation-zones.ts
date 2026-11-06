/**
 * Leveraged Liquidation Zones
 *
 * Estimated liquidation bands around the previous close for 25x, 50x, 75x and 100x leverage:
 * upper = close[1] + close[1] / leverage, lower = close[1] - close[1] / leverage. Each band pair is filled with
 * the colour of its leverage level.
 *
 * Reference: "Leveraged Liquidation Zones" by Fussion_Trader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © mrfussion
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LeveragedLiquidationZonesInputs {
  show100x: boolean;
  show75x: boolean;
  show50x: boolean;
  show25x: boolean;
  color100x: string;
  color75x: string;
  color50x: string;
  color25x: string;
}

const C100 = String(color.new(color.red, 80));
const C75 = String(color.new(color.orange, 80));
const C50 = String(color.new(color.yellow, 80));
const C25 = String(color.new(color.green, 80));

export const defaultInputs: LeveragedLiquidationZonesInputs = {
  show100x: true,
  show75x: true,
  show50x: true,
  show25x: true,
  color100x: C100,
  color75x: C75,
  color50x: C50,
  color25x: C25,
};

export const inputConfig: InputConfig[] = [
  { id: 'show100x', type: 'bool', title: 'Show 100x', defval: true },
  { id: 'show75x', type: 'bool', title: 'Show 75x', defval: true },
  { id: 'show50x', type: 'bool', title: 'Show 50x', defval: true },
  { id: 'show25x', type: 'bool', title: 'Show 25x', defval: true },
  { id: 'color100x', type: 'color', title: 'Color 100x', defval: C100 },
  { id: 'color75x', type: 'color', title: 'Color 75x', defval: C75 },
  { id: 'color50x', type: 'color', title: 'Color 50x', defval: C50 },
  { id: 'color25x', type: 'color', title: 'Color 25x', defval: C25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '25x Sup', color: C25, lineWidth: 1 },
  { id: 'plot1', title: '25x Inf', color: C25, lineWidth: 1 },
  { id: 'plot2', title: '50x Sup', color: C50, lineWidth: 1 },
  { id: 'plot3', title: '50x Inf', color: C50, lineWidth: 1 },
  { id: 'plot4', title: '75x Sup', color: C75, lineWidth: 1 },
  { id: 'plot5', title: '75x Inf', color: C75, lineWidth: 1 },
  { id: 'plot6', title: '100x Sup', color: C100, lineWidth: 1 },
  { id: 'plot7', title: '100x Inf', color: C100, lineWidth: 1 },
];

/** fill(plot_hi_X, plot_lo_X, color = color_X) for each leverage level */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', color: C25 },
  { id: 'fill1', plot1: 'plot2', plot2: 'plot3', color: C50 },
  { id: 'fill2', plot1: 'plot4', plot2: 'plot5', color: C75 },
  { id: 'fill3', plot1: 'plot6', plot2: 'plot7', color: C100 },
];

export const metadata = {
  title: 'Leveraged Liquidation Zones',
  shortTitle: 'Leveraged Liquidation Zones',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface LiquidationRun extends BarRunState<Record<string, never>> {
  /** plot0 .. plot7 */
  plots: Point[][];
  /** fill colours, one per bar (25x, 50x, 75x, 100x) */
  fills: string[][];
}

function study(inputs: Partial<LeveragedLiquidationZonesInputs>): BarStudy<LiquidationRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const levels: Array<[show: boolean, lev: number, col: string]> = [
    [cfg.show25x, 25, cfg.color25x],
    [cfg.show50x, 50, cfg.color50x],
    [cfg.show75x, 75, cfg.color75x],
    [cfg.show100x, 100, cfg.color100x],
  ];
  return {
    init() {
      const s: LiquidationRun = {
        plots: Array.from({ length: 8 }, () => []), fills: [[], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots, ...s.fills];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // ref_price = close[1]; liq_band(price, lev) => [price + price / lev, price - price / lev]
      const price = i > 0 ? bars[i - 1].close : NaN;
      for (let k = 0; k < 4; k++) {
        const level = levels[k]!;
        const show = level[0];
        const col = level[2];
        const delta = price / level[1];
        s.plots[k * 2]![i] = { time: b.time as number, value: show ? price + delta : NaN, color: col };
        s.plots[k * 2 + 1]![i] = { time: b.time as number, value: show ? price - delta : NaN, color: col };
        s.fills[k]![i] = col;
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0]!.slice(),
          plot1: p[1]!.slice(),
          plot2: p[2]!.slice(),
          plot3: p[3]!.slice(),
          plot4: p[4]!.slice(),
          plot5: p[5]!.slice(),
          plot6: p[6]!.slice(),
          plot7: p[7]!.slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: cfg.color25x }, colors: s.fills[0]!.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { color: cfg.color50x }, colors: s.fills[1]!.slice() },
          { plot1: 'plot4', plot2: 'plot5', options: { color: cfg.color75x }, colors: s.fills[2]!.slice() },
          { plot1: 'plot6', plot2: 'plot7', options: { color: cfg.color100x }, colors: s.fills[3]!.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LeveragedLiquidationZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LeveragedLiquidationZonesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LeveragedLiquidationZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
