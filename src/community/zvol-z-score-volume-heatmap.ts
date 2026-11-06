/**
 * ZVOL - Z-Score Volume Heatmap
 *
 * Z-score of the volume: z = (volume - sma(volume, maLen)) / stdev(volume, stdLen). The z-score is put in a zone by
 * four thresholds (below low, low..medium, medium..high, high..extreme, above extreme; an na z-score is in the top
 * zone, as Pine's comparisons with na are false). The volume columns take the zone colour and the background is
 * shaded by zone. EMA 21 and EMA 34 of the volume are drawn with a fill coloured by their order.
 *
 * Reference: "ZVOL — Z-Score Volume Heatmap" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge Laboratory  (2025)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData } from '../types';

export interface ZvolZScoreVolumeHeatmapInputs {
  maLen: number;
  stdLen: number;
  thresholdLow: number;
  thresholdMed: number;
  thresholdHigh: number;
  thresholdExtreme: number;
  colLow: string;
  colMed: string;
  colHigh: string;
  colExtreme: string;
  /** Transparency of the EMA fill (0-100) */
  ribbonOpacity: number;
  showBG: boolean;
}

export const defaultInputs: ZvolZScoreVolumeHeatmapInputs = {
  maLen: 100,
  stdLen: 100,
  thresholdLow: 0.0,
  thresholdMed: 1.0,
  thresholdHigh: 2.5,
  thresholdExtreme: 4.0,
  colLow: color.gray,
  colMed: color.teal,
  colHigh: color.orange,
  colExtreme: color.red,
  ribbonOpacity: 20,
  showBG: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'Moving Average Length', defval: 100, min: 2, group: 'Heatmap Settings' },
  { id: 'stdLen', type: 'int', title: 'Standard Deviation Length', defval: 100, min: 2, group: 'Heatmap Settings' },
  { id: 'thresholdLow', type: 'float', title: 'Low Threshold (σ)', defval: 0.0, group: 'Heatmap Settings' },
  { id: 'thresholdMed', type: 'float', title: 'Medium Threshold (σ)', defval: 1.0, group: 'Heatmap Settings' },
  { id: 'thresholdHigh', type: 'float', title: 'High Threshold (σ)', defval: 2.5, group: 'Heatmap Settings' },
  { id: 'thresholdExtreme', type: 'float', title: 'Extreme Threshold (σ)', defval: 4.0, group: 'Heatmap Settings' },
  { id: 'colLow', type: 'color', title: 'Low', defval: color.gray, group: 'Zone Colors' },
  { id: 'colMed', type: 'color', title: 'Medium', defval: color.teal, group: 'Zone Colors' },
  { id: 'colHigh', type: 'color', title: 'High', defval: color.orange, group: 'Zone Colors' },
  { id: 'colExtreme', type: 'color', title: 'Extreme', defval: color.red, group: 'Zone Colors' },
  { id: 'ribbonOpacity', type: 'int', title: 'Ribbon Shading Opacity (0–100)', defval: 20, min: 0, max: 100, group: 'Heatmap Settings' },
  { id: 'showBG', type: 'bool', title: 'Show Background Heatmap', defval: true, group: 'Heatmap Settings' },
];

const EMA21_COL = String(color.new('#b5feed', 0));
const EMA34_COL = String(color.new('#089590', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'EMA 21', color: EMA21_COL, lineWidth: 1 },
  { id: 'plot2', title: 'EMA 34', color: EMA34_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'ZVOL — Z-Score Volume Heatmap',
  shortTitle: 'ZVOL',
  overlay: false,
  precision: 1,
  format: 'volume',
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const lt = (a: number, b: number) => b - a > 1e-10;
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface ZvolRun extends BarRunState<Record<string, never>> {
  ma: WindowSma;
  dev: WindowStdev;
  ema21: ReturnType<typeof taStep.ema>;
  ema34: ReturnType<typeof taStep.ema>;
  volumePlot: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<ZvolZScoreVolumeHeatmapInputs>): BarStudy<ZvolRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bgByZone = [
    'transparent',
    String(color.new(cfg.colLow, 65)),
    String(color.new(cfg.colMed, 65)),
    String(color.new(cfg.colHigh, 65)),
    String(color.new(cfg.colExtreme, 65)),
  ];
  const zoneCol = [cfg.colLow, cfg.colMed, cfg.colHigh, cfg.colExtreme, cfg.colExtreme];
  const fillUp = String(color.new('#b5feed', cfg.ribbonOpacity));
  const fillDown = String(color.new('#06706d', cfg.ribbonOpacity));
  return {
    init() {
      const ma = new WindowSma(cfg.maLen);
      const dev = new WindowStdev(cfg.stdLen);
      const ema21 = taStep.ema(21);
      const ema34 = taStep.ema(34);
      const s: ZvolRun = {
        ma, dev, ema21, ema34, volumePlot: [], plot1: [], plot2: [], fillColors: [], bgColors: [],
        steps: [ma, dev, ema21, ema34], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.volumePlot, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const vol = bars[i].volume ?? NaN;
      const volMA = s.ma.step(vol);
      const volStdev = s.dev.step(vol);
      const ema21 = s.ema21.step(vol);
      const ema34 = s.ema34.step(vol);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the comparisons use the infinite value, na compares false
      const z = (vol - volMA) / volStdev;
      const zone = lt(z, cfg.thresholdLow) ? 0 : lt(z, cfg.thresholdMed) ? 1 : lt(z, cfg.thresholdHigh) ? 2
        : lt(z, cfg.thresholdExtreme) ? 3 : 4;
      // bgcolor(showBG ? bgCol : na)
      if (cfg.showBG && zone > 0) s.bgColors.push({ time: t, color: bgByZone[zone] });
      s.volumePlot[i] = { time: t, value: vol, color: zoneCol[zone] };
      s.plot1[i] = { time: t, value: ema21, color: EMA21_COL };
      s.plot2[i] = { time: t, value: ema34, color: EMA34_COL };
      s.fillColors[i] = gt(ema21, ema34) ? fillUp : fillDown;
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots: { plot0: s.volumePlot.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'EMA Fill' }, colors: s.fillColors.slice() }],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZvolZScoreVolumeHeatmapInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZvolZScoreVolumeHeatmapInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ZvolZScoreVolumeHeatmap = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
