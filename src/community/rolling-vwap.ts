/**
 * Rolling VWAP
 *
 * A VWAP over a rolling window of time: sum(src * volume) / sum(volume) over the bars whose time is less than the
 * period before the current bar time (at least `Bars` bars are kept, even when they are older). The period is set
 * from the chart timeframe (1 minute or less: 1 hour; 5 minutes or less: 4 hours; 1 hour or less: 1 day; 4 hours or
 * less: 3 days; 12 hours or less: 1 week; 1 day or less: 30.4375 days; 1 week or less: 90 days; else 365 days) or
 * from the "Time period" inputs. Bands: the VWAP +- multiplier * the volume-weighted standard deviation
 * (sqrt(max(E[src^2] - VWAP^2, 0))), drawn when the multiplier is not 0, with a fill between each pair. A one-cell
 * table shows the period on the last historical bar. The script stops with an error when the bars have no volume.
 *
 * Library written in this file: PineCoders/ConditionalAverages (totalForTimeWhen).
 *
 * Chart context: chart timeframe (automatic period) and the state of the last bar (`barstate.islastconfirmedhistory`).
 *
 * Reference: "Rolling VWAP"
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, table, timeframe, getSourceSeries, resetDrawings, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type FillConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe } from '../anchor-period';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface RollingVwapInputs {
  srcInput: SourceType;
  fixedTfInput: boolean;
  daysInput: number;
  hoursInput: number;
  minsInput: number;
  showInfoBoxInput: boolean;
  infoBoxSizeInput: string;
  infoBoxYPosInput: string;
  infoBoxXPosInput: string;
  infoBoxColorInput: string;
  infoBoxTxtColorInput: string;
  stdevMult1: number;
  stdevMult2: number;
  stdevMult3: number;
  stdevColor1: string;
  stdevColor2: string;
  stdevColor3: string;
  minBarsInput: number;
}

export const defaultInputs: RollingVwapInputs = {
  srcInput: 'hlc3',
  fixedTfInput: false,
  daysInput: 1,
  hoursInput: 0,
  minsInput: 0,
  showInfoBoxInput: true,
  infoBoxSizeInput: 'small',
  infoBoxYPosInput: 'bottom',
  infoBoxXPosInput: 'right',
  infoBoxColorInput: '#787B86',
  infoBoxTxtColorInput: '#FFFFFF',
  stdevMult1: 0.0,
  stdevMult2: 0.0,
  stdevMult3: 0.0,
  stdevColor1: '#4CAF50',
  stdevColor2: '#FFEB3B',
  stdevColor3: '#FF5252',
  minBarsInput: 10,
};

const GRP2 = 'Time period';
const GRP3 = 'Deviation bands';
const GRP4 = 'Minimum window size';

export const inputConfig: InputConfig[] = [
  { id: 'srcInput', type: 'source', title: 'Source', defval: 'hlc3',
    tooltip: 'The source series for which to calculate the RVWAP. The default is the average of the high, low, and close prices.' },
  { id: 'fixedTfInput', type: 'bool', title: 'Use a fixed time period', defval: false, group: GRP2,
    tooltip: "By default, the indicator selects the rolling period for the RVWAP automatically based on the chart's timeframe. When this checkbox is selected, the rolling period is the total span from the days, hours, and minutes specified in the fields below." },
  { id: 'daysInput', type: 'int', title: 'Days', defval: 1, min: 0, group: GRP2, active: 'fixedTfInput' },
  { id: 'hoursInput', type: 'int', title: 'Hours', defval: 0, min: 0, max: 23, group: GRP2, active: 'fixedTfInput' },
  { id: 'minsInput', type: 'int', title: 'Minutes', defval: 0, min: 0, max: 59, group: GRP2, active: 'fixedTfInput' },
  { id: 'showInfoBoxInput', type: 'bool', title: 'Show time period', defval: true, group: GRP2 },
  { id: 'infoBoxSizeInput', type: 'string', title: 'Size ', defval: 'small', inline: '21', group: GRP2,
    active: 'showInfoBoxInput', options: ['tiny', 'small', 'normal', 'large', 'huge', 'auto'] },
  { id: 'infoBoxYPosInput', type: 'string', title: '↕', defval: 'bottom', inline: '21', group: GRP2,
    active: 'showInfoBoxInput', options: ['top', 'middle', 'bottom'] },
  { id: 'infoBoxXPosInput', type: 'string', title: '↔', defval: 'right', inline: '21', group: GRP2,
    active: 'showInfoBoxInput', options: ['left', 'center', 'right'] },
  { id: 'infoBoxColorInput', type: 'color', title: '', defval: '#787B86', inline: '21', group: GRP2, active: 'showInfoBoxInput' },
  { id: 'infoBoxTxtColorInput', type: 'color', title: 'T', defval: '#FFFFFF', inline: '21', group: GRP2, active: 'showInfoBoxInput' },
  { id: 'stdevMult1', type: 'float', title: 'Bands multiplier 1', defval: 0.0, min: 0.0, step: 0.5, inline: '31', group: GRP3,
    tooltip: 'Sets the multiplier for standard deviation bands offset above and below the RVWAP, and their color. For example, with a multiplier of 1, the distance from the RVWAP to the bands is 100% of the standard deviation.\n\nTo hide the bands, use a value of 0.' },
  { id: 'stdevMult2', type: 'float', title: 'Bands multiplier 2', defval: 0.0, min: 0.0, step: 0.5, inline: '32', group: GRP3,
    tooltip: 'Sets the multiplier for standard deviation bands offset above and below the RVWAP, and their color. For example, with a multiplier of 1, the distance from the RVWAP to the bands is 100% of the standard deviation.\n\nTo hide the bands, use a value of 0.' },
  { id: 'stdevMult3', type: 'float', title: 'Bands multiplier 3', defval: 0.0, min: 0.0, step: 0.5, inline: '33', group: GRP3,
    tooltip: 'Sets the multiplier for standard deviation bands offset above and below the RVWAP, and their color. For example, with a multiplier of 1, the distance from the RVWAP to the bands is 100% of the standard deviation.\n\nTo hide the bands, use a value of 0.' },
  { id: 'stdevColor1', type: 'color', title: '', defval: '#4CAF50', inline: '31', group: GRP3, active: { input: 'stdevMult1', ne: 0 } },
  { id: 'stdevColor2', type: 'color', title: '', defval: '#FFEB3B', inline: '32', group: GRP3, active: { input: 'stdevMult2', ne: 0 } },
  { id: 'stdevColor3', type: 'color', title: '', defval: '#FF5252', inline: '33', group: GRP3, active: { input: 'stdevMult3', ne: 0 } },
  { id: 'minBarsInput', type: 'int', title: 'Bars', defval: 10, group: GRP4,
    tooltip: 'The minimum number of recent values to preserve in the moving window, even if they are outside the specified time window. Keeping a minimum number of bars in the calculation helps avoid situations where a large time gap between bars causes an empty period.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rolling VWAP', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Upper band 1', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot2', title: 'Lower band 1', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot3', title: 'Upper band 2', color: '#FFEB3B', lineWidth: 1 },
  { id: 'plot4', title: 'Lower band 2', color: '#FFEB3B', lineWidth: 1 },
  { id: 'plot5', title: 'Upper band 3', color: '#FF5252', lineWidth: 1 },
  { id: 'plot6', title: 'Lower band 3', color: '#FF5252', lineWidth: 1 },
];

const FILL_COLOR = String(color.new(color.green, 95));

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', title: 'Bands fill', color: FILL_COLOR },
  { id: 'fill1', plot1: 'plot3', plot2: 'plot4', title: 'Bands fill', color: FILL_COLOR },
  { id: 'fill2', plot1: 'plot5', plot2: 'plot6', title: 'Bands fill', color: FILL_COLOR },
];

export const drawingKinds: StudyDrawingKind[] = ['table'];

export const metadata = {
  title: 'Rolling VWAP',
  shortTitle: 'RVWAP',
  overlay: true,
};

const MS_IN_MIN = 60 * 1000;
const MS_IN_HOUR = MS_IN_MIN * 60;
const MS_IN_DAY = MS_IN_HOUR * 24;

/** timeStep(): the automatic period of the chart timeframe, in ms */
function timeStep(tfInSeconds: number): number {
  const tfInMs = tfInSeconds * 1000;
  const step = tfInMs <= MS_IN_MIN ? MS_IN_HOUR
    : tfInMs <= MS_IN_MIN * 5 ? MS_IN_HOUR * 4
      : tfInMs <= MS_IN_HOUR ? MS_IN_DAY * 1
        : tfInMs <= MS_IN_HOUR * 4 ? MS_IN_DAY * 3
          : tfInMs <= MS_IN_HOUR * 12 ? MS_IN_DAY * 7
            : tfInMs <= MS_IN_DAY ? MS_IN_DAY * 30.4375
              : tfInMs <= MS_IN_DAY * 7 ? MS_IN_DAY * 90
                : MS_IN_DAY * 365;
  return Math.trunc(step);
}

/** tfString(): the period as days, hours and minutes, or "1M" / "1W" (v6 `int s = ms / 1000` keeps the fraction) */
function tfString(timeInMs: number): string {
  const s = timeInMs / 1000;
  const m = s / 60;
  const h = m / 60;
  const tm = Math.floor(m % 60);
  const th = Math.floor(h % 24);
  const d = Math.floor(h / 24);
  if (d === 30 && th === 10 && tm === 30) return '1M';
  if (d === 7 && th === 0 && tm === 0) return '1W';
  const dStr = d > 0 ? `${d}D` : '';
  const hStr = th > 0 ? `${th}H` : '';
  const mStr = tm > 0 ? `${tm}min` : '';
  const hasHours = hStr !== '';
  const hasMins = mStr !== '';
  return dStr + (hasHours || hasMins ? ' ' : '') + hStr + (hasMins ? ' ' : '') + mStr;
}

/**
 * PineCoders/ConditionalAverages `totalForTimeWhen(source, ms, true, minBars)`: running total of the non-na values
 * whose time is less than `ms` before the current bar time, at least `minBars` values kept; na while fewer values
 */
function totalForTimeWhen(source: number[], timesMs: number[], ms: number, minBars: number): number[] {
  const sources: number[] = [];
  const times: number[] = [];
  let head = 0;
  let result = 0.0;
  const out: number[] = new Array(source.length);
  for (let i = 0; i < source.length; i++) {
    const v = source[i];
    if (!Number.isNaN(v)) {
      sources.push(v);
      times.push(timesMs[i]);
      result += v;
      while (sources.length - head > Math.max(minBars, 0) && timesMs[i] - times[head] >= ms) {
        result -= sources[head];
        head++;
      }
    }
    out[i] = sources.length - head < minBars ? NaN : result;
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<RollingVwapInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  resetDrawings();

  // ta.cum(nz(volume)) == 0 and barstate.islast: runtime.error
  let cumVol = 0;
  for (const b of bars) cumVol += Number.isFinite(b.volume) ? (b.volume as number) : 0;
  if (n > 0 && Math.abs(cumVol) <= 1e-10) throw new Error('No volume is provided by the data vendor.');

  const timeInMs = cfg.fixedTfInput
    ? cfg.minsInput * MS_IN_MIN + cfg.hoursInput * MS_IN_HOUR + cfg.daysInput * MS_IN_DAY
    : timeStep(timeframe.in_seconds(chartTimeframe(bars, chart)));

  const unit = chart?.timeUnit === 'ms' || (chart?.timeUnit === undefined && n > 0 && bars[0].time >= 1e12) ? 1 : 1000;
  const timesMs = bars.map((b) => (b.time as number) * unit);
  const src = getSourceSeries(bars, cfg.srcInput).toArray().map((v) => v ?? NaN);
  const vol = bars.map((b) => (b.volume === undefined || b.volume === null ? NaN : b.volume));

  const sumSrcVol = totalForTimeWhen(src.map((s, i) => s * vol[i]), timesMs, timeInMs, cfg.minBarsInput);
  const sumVol = totalForTimeWhen(vol, timesMs, timeInMs, cfg.minBarsInput);
  const sumSrcSrcVol = totalForTimeWhen(src.map((s, i) => vol[i] * Math.pow(s, 2)), timesMs, timeInMs, cfg.minBarsInput);

  const na = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot0: { time: number; value: number }[] = [];
  const bands: { time: number; value: number; color: string }[][] = [[], [], [], [], [], []];
  const mults = [cfg.stdevMult1, cfg.stdevMult2, cfg.stdevMult3];
  const colors = [cfg.stdevColor1, cfg.stdevColor2, cfg.stdevColor3];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time as number;
    const rollingVWAP = sumSrcVol[i] / sumVol[i];
    const variance = Math.max(sumSrcSrcVol[i] / sumVol[i] - Math.pow(rollingVWAP, 2), 0.0);
    const stDev = Math.sqrt(variance);
    plot0.push({ time: t, value: na(rollingVWAP) });
    for (let k = 0; k < 3; k++) {
      // stdevMult != 0 (Pine == within 1e-10)
      const on = Math.abs(mults[k]) > 1e-10;
      bands[2 * k].push({ time: t, value: on ? na(rollingVWAP + stDev * mults[k]) : NaN, color: colors[k] });
      bands[2 * k + 1].push({ time: t, value: on ? na(rollingVWAP - stDev * mults[k]) : NaN, color: colors[k] });
    }
  }

  // Time period table on the last historical bar
  const lastHistory = lastBarConfirmedOf(chart) ? n - 1 : n - 2;
  if (cfg.showInfoBoxInput && lastHistory >= 0) {
    const tfDisplay = table.new(`${cfg.infoBoxYPosInput}_${cfg.infoBoxXPosInput}` as Parameters<typeof table.new>[0], 1, 1);
    table.cell(tfDisplay, 0, 0, tfString(timeInMs), undefined, undefined, cfg.infoBoxTxtColorInput, undefined, undefined,
      cfg.infoBoxSizeInput, cfg.infoBoxColorInput);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0, plot1: bands[0], plot2: bands[1], plot3: bands[2], plot4: bands[3], plot5: bands[4], plot6: bands[5],
    },
    fills: [
      { id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { color: FILL_COLOR, title: 'Bands fill' } },
      { id: 'fill1', plot1: 'plot3', plot2: 'plot4', options: { color: FILL_COLOR, title: 'Bands fill' } },
      { id: 'fill2', plot1: 'plot5', plot2: 'plot6', options: { color: FILL_COLOR, title: 'Bands fill' } },
    ],
    ...drawingOutputs(bars),
  } as IndicatorResult;
}

export const RollingVwap = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, drawingKinds,
};
