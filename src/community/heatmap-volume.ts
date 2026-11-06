/**
 * HeatmapVolume
 *
 * Volume heatmap using standard deviation distance from SMA.
 * 5-tier coloring: Extra High / High / Medium / Normal / Low based on
 * how many standard deviations volume is from the moving average.
 * As the original, the lengths are cut to the bars so far (length := min(length, bar_index + 1)): the mean and the
 * standard deviation exist from the first bar (all bars so far on the early bars), and every output is drawn from
 * there. A zero standard deviation gives an na stdbar (0 / 0): such a bar takes the Low colour.
 * Heatmap zones ("Backgrounds"): fills between hidden level plots (ts1 + (ts1 - ts2), ts1 .. ts4 and 0).
 * Alerts (alertcondition, `alerts` of the result): extra high / high / medium volume (any bar, up bar, down bar).
 *
 * Reference: "Heatmap Volume [xdecow]" by xdecow
 */

import { taStep, color as pineColor, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HeatmapVolumeInputs {
  maLength: number;
  stdLength: number;
  thresholdExtraHigh: number;
  thresholdHigh: number;
  thresholdMedium: number;
  thresholdNormal: number;
  coloredBars: boolean;
  displayZones: 'None' | 'Lines' | 'Backgrounds' | 'Both';
  colorMode: 'Heatmap' | 'Up/Down';
}

export const defaultInputs: HeatmapVolumeInputs = {
  maLength: 610,
  stdLength: 610,
  thresholdExtraHigh: 4,
  thresholdHigh: 2.5,
  thresholdMedium: 1,
  thresholdNormal: -0.5,
  coloredBars: true,
  displayZones: 'Backgrounds',
  colorMode: 'Heatmap',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 610, min: 2 },
  { id: 'stdLength', type: 'int', title: 'Standard Deviation Length', defval: 610, min: 2 },
  { id: 'thresholdExtraHigh', type: 'float', title: 'Extra High Multiplier', defval: 4, step: 0.1 },
  { id: 'thresholdHigh', type: 'float', title: 'High Multiplier', defval: 2.5, step: 0.1 },
  { id: 'thresholdMedium', type: 'float', title: 'Medium Multiplier', defval: 1, step: 0.1 },
  { id: 'thresholdNormal', type: 'float', title: 'Normal Multiplier', defval: -0.5, step: 0.1 },
  { id: 'coloredBars', type: 'bool', title: 'Colored Bars', defval: true },
  { id: 'displayZones', type: 'string', title: 'Display Heatmap Zones', defval: 'Backgrounds', options: ['None', 'Lines', 'Backgrounds', 'Both'] },
  { id: 'colorMode', type: 'string', title: 'Color Mode', defval: 'Heatmap', options: ['Heatmap', 'Up/Down'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'volume', title: 'Volume', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'ma', title: 'Moving Average', color: '#000000', lineWidth: 2 },
  { id: 'tsExtraHigh', title: 'Extra High heatmap line', color: '#ff0000', lineWidth: 1 },
  { id: 'tsHigh', title: 'High heatmap line', color: '#ff7800', lineWidth: 1 },
  { id: 'tsMedium', title: 'Medium heatmap line', color: '#ffcf03', lineWidth: 1 },
  { id: 'tsNormal', title: 'Normal heatmap line', color: '#a0d6dc', lineWidth: 1 },
  // hidden heatmap lines to fill (display.none, editable = false)
  { id: 'zoneTop', title: 'Zone top', color: 'transparent', lineWidth: 1, display: 'none', editable: false },
  { id: 'zone0', title: 'Zone 0', color: 'transparent', lineWidth: 1, display: 'none', editable: false },
  { id: 'zone1', title: 'Zone 1', color: 'transparent', lineWidth: 1, display: 'none', editable: false },
  { id: 'zone2', title: 'Zone 2', color: 'transparent', lineWidth: 1, display: 'none', editable: false },
  { id: 'zone3', title: 'Zone 3', color: 'transparent', lineWidth: 1, display: 'none', editable: false },
  { id: 'zone4', title: 'Zone 4', color: 'transparent', lineWidth: 1, display: 'none', editable: false },
];

export const metadata = {
  title: 'Heatmap Volume',
  shortTitle: 'HMV',
  overlay: false,
};

// Heatmap colors
const HM_EXTRA_HIGH = '#ff0000';
const HM_HIGH = '#ff7800';
const HM_MEDIUM = '#ffcf03';
const HM_NORMAL = '#a0d6dc';
const HM_LOW = '#1f9cac';

// Up/Down colors
const UP_EXTRA_HIGH = '#00FF00';
const UP_HIGH = '#30FF30';
const UP_MEDIUM = '#60FF60';
const UP_NORMAL = '#8FFF8F';
const UP_LOW = '#BFFFBF';
const DN_EXTRA_HIGH = '#FF0000';
const DN_HIGH = '#FF3030';
const DN_MEDIUM = '#FF6060';
const DN_NORMAL = '#FF8F8F';
const DN_LOW = '#FFBFBF';

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface HeatmapRun extends BarRunState<Record<string, never>> {
  mean: ReturnType<typeof taStep.sma>;
  std: ReturnType<typeof taStep.stdev>;
  volumePlot: Point[];
  maPlot: Point[];
  tsPlots: Point[][];
  /** top, 0, ts1 .. ts4 */
  zones: Point[][];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<HeatmapVolumeInputs>): BarStudy<HeatmapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // Determine per-bar color based on stdbar thresholds
  function getBarColor(stdbar: number, isUp: boolean): string {
    if (cfg.colorMode === 'Heatmap') {
      if (stdbar > cfg.thresholdExtraHigh) return HM_EXTRA_HIGH;
      if (stdbar > cfg.thresholdHigh) return HM_HIGH;
      if (stdbar > cfg.thresholdMedium) return HM_MEDIUM;
      if (stdbar > cfg.thresholdNormal) return HM_NORMAL;
      return HM_LOW;
    }
    // Up/Down mode
    if (stdbar > cfg.thresholdExtraHigh) return isUp ? UP_EXTRA_HIGH : DN_EXTRA_HIGH;
    if (stdbar > cfg.thresholdHigh) return isUp ? UP_HIGH : DN_HIGH;
    if (stdbar > cfg.thresholdMedium) return isUp ? UP_MEDIUM : DN_MEDIUM;
    if (stdbar > cfg.thresholdNormal) return isUp ? UP_NORMAL : DN_NORMAL;
    return isUp ? UP_LOW : DN_LOW;
  }

  const showLines = cfg.displayZones === 'Lines' || cfg.displayZones === 'Both';
  const showBgs = cfg.displayZones === 'Backgrounds' || cfg.displayZones === 'Both';

  return {
    init() {
      const mean = taStep.sma();
      const std = taStep.stdev();
      const s: HeatmapRun = {
        mean, std, volumePlot: [], maPlot: [], tsPlots: [[], [], [], []], zones: [[], [], [], [], [], []], barColors: [],
        flags: Array.from({ length: 9 }, () => []), times: Array.from({ length: 9 }, () => []),
        steps: [mean, std], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.volumePlot, s.maPlot, ...s.tsPlots, ...s.zones, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const vol = b.volume ?? 0;
      // Pine: length := length > bar_index + 1 ? bar_index + 1 : length (same for slength): the windows grow on the first
      // bars, so mean and std exist from bar 0
      const mean = s.mean.step(vol, Math.min(cfg.maLength, i + 1));
      const std = s.std.step(vol, Math.min(cfg.stdLength, i + 1));
      const isUp = b.close > b.open;

      // stdbar = (volume - mean) / std: na when std is 0 (the comparisons are false: the Low colour)
      const stdbar = std !== 0 ? (vol - mean) / std : NaN;
      const color = getBarColor(stdbar, isUp);

      s.volumePlot[i] = { time, value: vol, color };
      s.maPlot[i] = { time, value: mean };

      // Threshold lines: ts1 = std * thresholdExtraHigh + mean, etc.
      const ts1 = std * cfg.thresholdExtraHigh + mean;
      const ts2 = std * cfg.thresholdHigh + mean;
      const ts3 = std * cfg.thresholdMedium + mean;
      const ts4 = std * cfg.thresholdNormal + mean;

      s.tsPlots[0][i] = { time, value: showLines ? ts1 : NaN };
      s.tsPlots[1][i] = { time, value: showLines ? ts2 : NaN };
      s.tsPlots[2][i] = { time, value: showLines ? ts3 : NaN };
      s.tsPlots[3][i] = { time, value: showLines ? ts4 : NaN };
      // pt = plot(zshow_backgrounds ? tst : na) with tst = ts1 + (ts1 - ts2); p0 = 0; p1 .. p4 = ts1 .. ts4
      const z = s.zones;
      z[0][i] = { time, value: !showBgs ? NaN : ts1 + (ts1 - ts2) };
      z[1][i] = { time, value: !showBgs ? NaN : 0 };
      z[2][i] = { time, value: !showBgs ? NaN : ts1 };
      z[3][i] = { time, value: !showBgs ? NaN : ts2 };
      z[4][i] = { time, value: !showBgs ? NaN : ts3 };
      z[5][i] = { time, value: !showBgs ? NaN : ts4 };

      // conditionExtraHigh = stdbar > thresholdExtraHigh, conditionHigh / conditionMedium: the tiers below (na: false)
      const sb = stdbar;
      const extraHigh = sb > cfg.thresholdExtraHigh;
      const high = sb <= cfg.thresholdExtraHigh && sb > cfg.thresholdHigh;
      const medium = sb <= cfg.thresholdHigh && sb > cfg.thresholdMedium;
      const up = b.open < b.close;
      const down = b.open > b.close;
      const f = s.flags;
      for (let k = 0; k < 3; k++) {
        const c = k === 0 ? extraHigh : k === 1 ? high : medium;
        f[3 * k][i] = c;
        f[3 * k + 1][i] = c && up;
        f[3 * k + 2][i] = c && down;
        if (c) s.times[3 * k].push(time as number);
        if (c && up) s.times[3 * k + 1].push(time as number);
        if (c && down) s.times[3 * k + 2].push(time as number);
      }

      if (cfg.coloredBars) {
        s.barColors.push({ id: 'barcolor0', time, color });
      }
    },
    result(s, bars) {
      const n = bars.length;
      // Heatmap fills between the hidden zone plots: fill(pt, p1, color.new(chm1, 85), title = 'Extra High heatmap zone') ...
      const tpf = 85;
      const fills: any[] = [];
      if (showBgs) {
        fills.push(
          { plot1: 'zoneTop', plot2: 'zone1', options: { title: 'Extra High heatmap zone', color: String(pineColor.new(HM_EXTRA_HIGH, tpf)) } },
          { plot1: 'zone1', plot2: 'zone2', options: { title: 'High heatmap zone', color: String(pineColor.new(HM_HIGH, tpf)) } },
          { plot1: 'zone2', plot2: 'zone3', options: { title: 'Medium heatmap zone', color: String(pineColor.new(HM_MEDIUM, tpf)) } },
          { plot1: 'zone3', plot2: 'zone4', options: { title: 'Normal heatmap zone', color: String(pineColor.new(HM_NORMAL, tpf)) } },
          { plot1: 'zone4', plot2: 'zone0', options: { title: 'Low heatmap zone', color: String(pineColor.new(HM_LOW, tpf)) } },
        );
      }
      const z = s.zones;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          volume: s.volumePlot.slice(),
          ma: s.maPlot.slice(),
          tsExtraHigh: s.tsPlots[0].slice(),
          tsHigh: s.tsPlots[1].slice(),
          tsMedium: s.tsPlots[2].slice(),
          tsNormal: s.tsPlots[3].slice(),
          zoneTop: z[0].slice(),
          zone0: z[1].slice(),
          zone1: z[2].slice(),
          zone2: z[3].slice(),
          zone3: z[4].slice(),
          zone4: z[5].slice(),
        },
        fills,
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HeatmapVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HeatmapVolumeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Any Extra High Vol', message: 'Any Bar Extra High Volume Threshold' },
  { id: 'alert1', title: 'Up Extra High', message: 'Up Bar Extra High Volume Threshold' },
  { id: 'alert2', title: 'Down Extra High', message: 'Down Bar Extra High Volume Threshold' },
  { id: 'alert3', title: 'Any High Vol', message: 'Any Bar High Volume Threshold' },
  { id: 'alert4', title: 'Up High Vol', message: 'Up Bar High Volume Threshold' },
  { id: 'alert5', title: 'Down High Vol', message: 'Down Bar High Volume Threshold' },
  { id: 'alert6', title: 'Any Medium Vol', message: 'Any Bar Medium Volume Threshold' },
  { id: 'alert7', title: 'Up Medium Vol', message: 'Up Bar Medium Volume Threshold' },
  { id: 'alert8', title: 'Down Medium Vol', message: 'Down Bar Medium Volume Threshold' },
];

export const HeatmapVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
