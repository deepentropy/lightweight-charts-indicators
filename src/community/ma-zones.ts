/**
 * MA Zones
 *
 * Three zones, each made of an EMA and an SMA of the close with the same period (50, 100 and 200 by default).
 * The space between the EMA and the SMA of a zone is filled.
 *
 * Reference: "MA Zones" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenAndTheArtOfTrading | PineScriptMastery
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAZonesInputs {
  showZone1: boolean;
  showZone2: boolean;
  showZone3: boolean;
  /** Period of the EMA and SMA of zone 1 */
  zone1: number;
  /** Period of the EMA and SMA of zone 2 */
  zone2: number;
  /** Period of the EMA and SMA of zone 3 */
  zone3: number;
}

export const defaultInputs: MAZonesInputs = {
  showZone1: true,
  showZone2: true,
  showZone3: true,
  zone1: 50,
  zone2: 100,
  zone3: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'showZone1', type: 'bool', title: 'Show Zone 1?', defval: true },
  { id: 'showZone2', type: 'bool', title: 'Show Zone 2?', defval: true },
  { id: 'showZone3', type: 'bool', title: 'Show Zone 3?', defval: true },
  { id: 'zone1', type: 'int', title: 'Zone 1 Period', defval: 50, min: 1 },
  { id: 'zone2', type: 'int', title: 'Zone 2 Period', defval: 100, min: 1 },
  { id: 'zone3', type: 'int', title: 'Zone 3 Period', defval: 200, min: 1 },
];

const lime = String(color.new(color.lime, 50));
const orange = String(color.new(color.orange, 50));
const red = String(color.new(color.red, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: lime, lineWidth: 1 },
  { id: 'plot1', title: 'SMA 1', color: lime, lineWidth: 1 },
  { id: 'plot2', title: 'EMA 2', color: orange, lineWidth: 1 },
  { id: 'plot3', title: 'SMA 2', color: orange, lineWidth: 1 },
  { id: 'plot4', title: 'EMA 3', color: red, lineWidth: 1 },
  { id: 'plot5', title: 'SMA 3', color: red, lineWidth: 1 },
];

export const metadata = {
  title: 'MA Zones',
  shortTitle: 'MAZ',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface MaZonesRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  smas: WindowSma[];
  lines: Point[][];
}

function study(inputs: Partial<MAZonesInputs>): BarStudy<MaZonesRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const periods = [cfg.zone1, cfg.zone2, cfg.zone3];
  const shows = [cfg.showZone1, cfg.showZone2, cfg.showZone3];
  const colors = [lime, orange, red];
  return {
    init() {
      const s: MaZonesRun = {
        emas: periods.map((p) => taStep.ema(p)),
        smas: periods.map((p) => new WindowSma(p)),
        lines: [[], [], [], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.emas, ...s.smas];
      s.series = s.lines;
      return s;
    },
    bar(s, i, bars) {
      const { time, close } = bars[i];
      for (let z = 0; z < 3; z++) {
        const ema = s.emas[z].step(close);
        const ma = s.smas[z].step(close);
        // plot(showZoneN ? x : na, ...)
        s.lines[z * 2][i] = { time, value: shows[z] ? ema : NaN, color: colors[z] };
        s.lines[z * 2 + 1][i] = { time, value: shows[z] ? ma : NaN, color: colors[z] };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lines[0].slice(),
          plot1: s.lines[1].slice(),
          plot2: s.lines[2].slice(),
          plot3: s.lines[3].slice(),
          plot4: s.lines[4].slice(),
          plot5: s.lines[5].slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Zone of Value 1', color: String(color.new(color.lime, 75)) } },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Zone of Value 2', color: String(color.new(color.orange, 75)) } },
          { plot1: 'plot4', plot2: 'plot5', options: { title: 'Zone of Value 3', color: String(color.new(color.red, 75)) } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAZonesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MAZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
