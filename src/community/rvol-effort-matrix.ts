/**
 * RVOL Effort Matrix
 *
 * Relative volume: rvol = volume / sma(volume, lookback), in four zones (below average, average, above average,
 * extreme) by three thresholds, each with its own colour. The buy / sell split estimates 70 % buy volume on an up
 * candle, 30 % on a down candle and 50 % otherwise; buy and sell relative volumes are drawn as columns (the sell
 * columns one bar to the left), with the RVOL line on top. Optional background colour by zone.
 *
 * Reference: "RVOL Effort Matrix" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge
 * Laboratory (2025)
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RvolEffortMatrixInputs {
  /** Average volume lookback */
  lookback: number;
  /** Average volume threshold */
  avgThresh: number;
  /** Above average threshold */
  aboveThresh: number;
  /** Extreme volume threshold */
  strongThresh: number;
  colBelow: string;
  colAvg: string;
  colAbove: string;
  colExtreme: string;
  /** Background highlight by zone */
  showBG: boolean;
  /** Show the buy / sell ratio overlay (else the total RVOL columns) */
  showSplitOverlay: boolean;
}

export const defaultInputs: RvolEffortMatrixInputs = {
  lookback: 22,
  avgThresh: 0.702,
  aboveThresh: 1.414,
  strongThresh: 4.0,
  colBelow: color.red,
  colAvg: color.yellow,
  colAbove: color.green,
  colExtreme: color.fuchsia,
  showBG: false,
  showSplitOverlay: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Average Volume Lookback', defval: 22, min: 1, group: 'Settings' },
  { id: 'avgThresh', type: 'float', title: 'Average Volume Threshold', defval: 0.702, min: 0.1, step: 0.1, group: 'Settings' },
  { id: 'aboveThresh', type: 'float', title: 'Above Average Threshold', defval: 1.414, min: 0.5, step: 0.05, group: 'Settings' },
  { id: 'strongThresh', type: 'float', title: 'Extreme Volume Threshold', defval: 4.0, min: 1.5, step: 0.5, group: 'Settings' },
  { id: 'colBelow', type: 'color', title: 'Below Avg', defval: color.red, group: 'Colors' },
  { id: 'colAvg', type: 'color', title: 'Avg Zone', defval: color.yellow, group: 'Colors' },
  { id: 'colAbove', type: 'color', title: 'Above Avg', defval: color.green, group: 'Colors' },
  { id: 'colExtreme', type: 'color', title: 'Extreme', defval: color.fuchsia, group: 'Colors' },
  { id: 'showBG', type: 'bool', title: 'Background Highlight by Zone', defval: false, group: 'Display Options' },
  { id: 'showSplitOverlay', type: 'bool', title: 'Show Buy/Sell Ratio Overlay', defval: true, group: 'Display Options' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relativity Overlay', color: color.red, lineWidth: 1, style: 'line' },
  { id: 'plot1', title: 'Total RVOL', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Buy RVOL', color: String(color.new(color.green, 0)), lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Sell RVOL', color: String(color.new(color.red, 20)), lineWidth: 1, style: 'columns', offset: -1 },
];

export const metadata = {
  title: 'RVOL Effort Matrix',
  shortTitle: 'RVOL',
  overlay: false,
  precision: 1,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface RvolRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  /** The Sell RVOL point of each bar (drawn on the bar before) */
  sell: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RvolEffortMatrixInputs>): BarStudy<RvolRun, IndicatorResult & { bgColors: BgColorData[] }> {
  const cfg = { ...defaultInputs, ...inputs };
  // Plain divisions: x / 0 is +-infinity (0 / 0 na); the zone comparisons use the infinite value, plots show na
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

  const sellBelow = String(color.new(color.red, 70));
  const sellOther = String(color.new(color.red, 20));
  const buyColor = String(color.new(color.green, 0));
  const bgZone = [
    String(color.new(color.red, 80)),
    String(color.new(color.yellow, 80)),
    String(color.new(color.green, 80)),
    String(color.new(color.fuchsia, 80)),
  ];
  const zoneColor = [cfg.colBelow, cfg.colAvg, cfg.colAbove, cfg.colExtreme];
  return {
    init() {
      const sma = new WindowSma(cfg.lookback);
      const s: RvolRun = { sma, plot0: [], plot1: [], plot2: [], sell: [], bgColors: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2, s.sell];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const vol = b.volume ?? NaN;
      const avgVol = s.sma.step(vol) ?? NaN;
      const rvol = vol / avgVol;
      // zone = rvol < avgThresh ? 0 : rvol < aboveThresh ? 1 : rvol < strongThresh ? 2 : 3 (na rvol: 3)
      const zone = lt(rvol, cfg.avgThresh) ? 0 : lt(rvol, cfg.aboveThresh) ? 1 : lt(rvol, cfg.strongThresh) ? 2 : 3;
      const volColor = zoneColor[zone];
      const bodyUp = gt(b.close, b.open);
      const bodyDown = lt(b.close, b.open);
      const volBuy = bodyUp ? vol * 0.7 : bodyDown ? vol * 0.3 : vol * 0.5;
      const volSell = vol - volBuy;
      const rvolBuy = volBuy / avgVol;
      const rvolSell = volSell / avgVol;

      s.plot0[i] = { time: t, value: cfg.showSplitOverlay ? fin(rvol) : NaN, color: volColor };
      s.plot1[i] = { time: t, value: cfg.showSplitOverlay ? NaN : fin(rvol), color: volColor };
      s.plot2[i] = { time: t, value: cfg.showSplitOverlay ? fin(rvolBuy) : NaN, color: buyColor };
      // plot(..., "Sell RVOL", offset = -1): the value (and colour) of bar i is drawn on bar i - 1
      s.sell[i] = {
        time: i >= 1 ? bars[i - 1].time : NaN,
        value: cfg.showSplitOverlay ? fin(rvolSell) : NaN,
        color: zone === 0 ? sellBelow : sellOther,
      };
      // bgcolor(showBG ? bgCol : na); zone is never na here, so bgCol is always a zone colour
      if (cfg.showBG) s.bgColors.push({ time: t, color: bgZone[zone] });
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.sell.slice(1) },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RvolEffortMatrixInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult & { bgColors: BgColorData[] }> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RvolEffortMatrixInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const RvolEffortMatrix = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
