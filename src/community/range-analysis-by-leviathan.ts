/**
 * Range Analysis - By Leviathan
 *
 * Levels and a volume profile of a range of bars chosen with "Start Time" and "End Time" (both 0 by default: no bar is
 * in the range and nothing is drawn). The range high / low are the highest "Range Max" source (close by default; the
 * wick uses the highs and the lows) of the bars counted in the range so far plus one, read on the bar before (so the
 * bar before the range is part of the window). When the range ends (or on the last bar while the range is open):
 * - lines from the first bar of the range to the current bar (or "Extend (+Bars)" bars further, or extended right)
 *   at the high, the low, the half, the quarters, the eighths, the outer levels, the Fibonacci levels, a diagonal
 *   line, with labels on the right (or the left) of the lines
 * - with a profile option (profile, POC, VAH, VAL, VA box or horizontal heatmap): the volume of every bar of the
 *   range split into "Resolution" rows (body volume to the up or down side, the wicks half to each side), drawn as
 *   boxes (up / down, total or delta nodes, left or right, facing left or right), a horizontal heatmap coloured by
 *   the percent rank of the up volume, the point of control, the value area high / low and box. As in the original,
 *   the levels and labels are then drawn twice (once in the profile code and once in the levels code)
 * - an anchored VWAP from "Start Time" (plot "VWAP") and a vertical heatmap: a fill between the range high and low
 *   coloured by the volume relative to its 50-bar highest
 * The original's level arrays are deleted with wrong indexes on a second range end, which does not happen with one
 * time range; "Stats (Soon)" and the "Range Max" line style have no effect in it.
 *
 * Data type "Open Interest": the change of the close of BINANCE:<base currency>USDT.P_OI (the chart timeframe, or 1D
 * for futures on an intraday chart) replaces the volume; its bars come from the chart context (`requiredSymbols`),
 * an empty series (symbol that does not exist) gives na. Box texts use `chart.fg_color` of the context (fallback
 * #DBDBDB). The VWAP line style and the node text styles follow the inputs; the plot style of "VWAP" is circles (the
 * "────" option draws it as a line with breaks in the original).
 *
 * Reference: "Range Analysis - By Leviathan" by LeviathanCapital
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LeviathanCapital
 */

import {
  ta, str, color, array, Series, line, label, box, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import {
  symbolBarsOf, basecurrencyOf, symbolTypeOf, foregroundColorOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { otherSymbolChart, securityOtherValues } from '../other-symbol';

type LineStyleName = '────' | '--------' | '┈┈┈┈';
type TextSize = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Auto';

export interface RangeAnalysisByLeviathanInputs {
  /** Direction of the range: UP (low to high) or DOWN, for the level labels and the Fibonacci levels */
  dir: 'UP' | 'DOWN';
  showHL: boolean;
  rangemax: 'Range Max: Wick' | 'Range Max: Close' | 'Range Max: HLC3' | 'Range Max:OHLC4';
  /** Style of the high / low lines (no effect in the original: they are solid) */
  rangemaxStyle: LineStyleName;
  hlCol: string;
  lvl05: boolean;
  lvl05Col: string;
  lvl05Style: LineStyleName;
  quarters: boolean;
  quartersCol: string;
  quartersStyle: LineStyleName;
  eighths: boolean;
  eighthsCol: string;
  eighthsStyle: LineStyleName;
  fib: boolean;
  fibCol: string;
  fibStyle: LineStyleName;
  showvwap: boolean;
  vwapCol: string;
  /** Plot style of the VWAP: circles or a line (the port keeps circles) */
  vwapStyle: '•••••••••' | '────';
  outer: boolean;
  outerCol: string;
  outerStyle: LineStyleName;
  extendb: boolean;
  extnmb: number;
  extend: boolean;
  labels: boolean;
  dirline: boolean;
  /** No effect in the original */
  stats: boolean;
  voltype: 'Volume' | 'Open Interest';
  res: number;
  showProf: boolean;
  bullCol: string;
  bearCol: string;
  volhm: boolean;
  hvolhm: boolean;
  vhmcol1: string;
  vhmcol2: string;
  hhmcol1: string;
  hhmcol2: string;
  volnodes: 'Up/Down' | 'Total' | 'Delta';
  profilepos: 'Left' | 'Right';
  profiledir: 'Left' | 'Right';
  profiletype: 'Type 1' | 'Type 2';
  nodesize: number;
  VApct: number;
  volval: boolean;
  hmval: boolean;
  showPoc: boolean;
  pocCol: string;
  pocStyle: LineStyleName;
  showVAH: boolean;
  vahCol: string;
  vahStyle: LineStyleName;
  showVAL: boolean;
  valCol: string;
  valStyle: LineStyleName;
  showVAbox: boolean;
  VAboxCol: string;
  netcol1: string;
  netcol2: string;
  smoothVol: boolean;
  ndsize: TextSize;
  ndpos: 'Left' | 'Right' | 'Center';
  lblsize: TextSize;
  lblpos: 'Right' | 'Left';
  hmsize: TextSize;
  hmpos: 'Left' | 'Right' | 'Center';
  profbuff: number;
  hmbuff: number;
  showRB: boolean;
  rangebCol: string;
  /** Start of the range (UNIX ms) */
  startTime: number;
  /** End of the range (UNIX ms) */
  endTime: number;
}

export const defaultInputs: RangeAnalysisByLeviathanInputs = {
  dir: 'UP',
  showHL: true,
  rangemax: 'Range Max: Close',
  rangemaxStyle: '────',
  hlCol: '#B2B5BE',
  lvl05: true,
  lvl05Col: 'rgba(178,181,190,0.8)',
  lvl05Style: '────',
  quarters: true,
  quartersCol: 'rgba(178,181,190,0.3)',
  quartersStyle: '────',
  eighths: false,
  eighthsCol: 'rgba(178,181,190,0.2)',
  eighthsStyle: '────',
  fib: false,
  fibCol: 'rgba(178,181,190,0.2)',
  fibStyle: '────',
  showvwap: false,
  vwapCol: '#B2B5BE',
  vwapStyle: '•••••••••',
  outer: false,
  outerCol: 'rgba(178,181,190,0.2)',
  outerStyle: '────',
  extendb: false,
  extnmb: 50,
  extend: false,
  labels: true,
  dirline: false,
  stats: false,
  voltype: 'Volume',
  res: 30,
  showProf: false,
  bullCol: 'rgba(76,175,79,0.5)',
  bearCol: 'rgba(255,82,82,0.5)',
  volhm: false,
  hvolhm: false,
  vhmcol1: 'rgba(33,149,243,0)',
  vhmcol2: 'rgba(20,94,255,0.37)',
  hhmcol1: 'rgba(33,149,243,0)',
  hhmcol2: 'rgba(20,94,255,0.37)',
  volnodes: 'Up/Down',
  profilepos: 'Left',
  profiledir: 'Right',
  profiletype: 'Type 1',
  nodesize: 30,
  VApct: 70,
  volval: false,
  hmval: false,
  showPoc: false,
  pocCol: '#880E4F',
  pocStyle: '────',
  showVAH: false,
  vahCol: 'rgba(255,153,0,0.64)',
  vahStyle: '────',
  showVAL: false,
  valCol: 'rgba(255,153,0,0.64)',
  valStyle: '────',
  showVAbox: false,
  VAboxCol: 'rgba(2,68,122,0.15)',
  netcol1: '#2962ff',
  netcol2: '#FF5252',
  smoothVol: false,
  ndsize: 'Auto',
  ndpos: 'Center',
  lblsize: 'Small',
  lblpos: 'Right',
  hmsize: 'Auto',
  hmpos: 'Left',
  profbuff: 10,
  hmbuff: 1,
  showRB: false,
  rangebCol: 'rgba(178,181,190,0.02)',
  startTime: 0,
  endTime: 0,
};

const timeGroup = 'Time Interval';
const vpGroup = 'Volume Profile / Open Interest Profile / Heatmap';
const rangeGroup = 'Range Levels';
const nstip = 'Node Size inputs controls the scaling of volume profile nodes in relation to the range size. Example: The value of 1 will proportionally extend the nodes to right max of the range, whereas the value of 0.5 will extend the nodes to the middle of the range.';
const rstip = 'Increasing the resolution input will improve the volume profile but will also limit the script from generating profiles on longer ranges. Play around and find the higest resolution value that works on your selected range.';
const vapcttip = 'Value Area is the area where the most volume occurred. The input is usually 70% or 68%, but you can adjust it to any percentage you want.';
const svtip = 'Useful for assets that have very large spikes in volume over large bars. It uses ema of volume instead of just volume and helps create better profiles when needed.';
const dirtip = 'Specify the direction of your range (eg. from low to high = UP and high to low = DOWN). This is only significant for level labels and fibbonacci levels';
const ndtytip = 'Type 1 means that one node consists of both UP and DOWN data. Type 2 means that UP node will be on the right side of y axis and DOWN node will be on the left side of y axis.';
const prfdirtip = 'Choose whether the nodes of the profile are facing left or right.';
const prfpostip = 'Choose whether the profile is positioned on the left side of the range or on the right side of the range.';
const volndtip = 'Up/Down shows the proportion of UP data and DOWN data in a node. Total shows the net value of UP data + DOWN data. Delta shows the net difference between UP Data and DOWN data.';
const dtatyptip = 'Choose the data source used for generating the profile and the heatmaps';

export const inputConfig: InputConfig[] = [
  { id: 'dir', type: 'string', title: 'Direction', defval: 'UP', options: ['UP', 'DOWN'], group: rangeGroup, tooltip: dirtip },
  { id: 'showHL', type: 'bool', title: '', defval: true, group: rangeGroup, inline: 'rm' },
  { id: 'rangemax', type: 'string', title: '', defval: 'Range Max: Close', options: ['Range Max: Wick', 'Range Max: Close', 'Range Max: HLC3', 'Range Max:OHLC4'], group: rangeGroup, inline: 'rm' },
  { id: 'rangemaxStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: rangeGroup, inline: 'rm' },
  { id: 'hlCol', type: 'color', title: '', defval: '#B2B5BE', group: rangeGroup, inline: 'rm' },
  { id: 'lvl05', type: 'bool', title: 'Half      ', defval: true, group: rangeGroup, inline: '2' },
  { id: 'lvl05Col', type: 'color', title: '', defval: 'rgba(178,181,190,0.8)', group: rangeGroup, inline: '2' },
  { id: 'lvl05Style', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: rangeGroup, inline: '2' },
  { id: 'quarters', type: 'bool', title: 'Quarters    ', defval: true, group: rangeGroup, inline: '4' },
  { id: 'quartersCol', type: 'color', title: '', defval: 'rgba(178,181,190,0.3)', group: rangeGroup, inline: '4' },
  { id: 'quartersStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: rangeGroup, inline: '4' },
  { id: 'eighths', type: 'bool', title: 'Eighths       ', defval: false, group: rangeGroup, inline: '8' },
  { id: 'eighthsCol', type: 'color', title: '', defval: 'rgba(178,181,190,0.2)', group: rangeGroup, inline: '8' },
  { id: 'eighthsStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: rangeGroup, inline: '8' },
  { id: 'fib', type: 'bool', title: 'Fibonacci  ', defval: false, group: rangeGroup, inline: 'F' },
  { id: 'fibCol', type: 'color', title: '', defval: 'rgba(178,181,190,0.2)', group: rangeGroup, inline: 'F' },
  { id: 'fibStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: rangeGroup, inline: 'F' },
  { id: 'showvwap', type: 'bool', title: 'VWAP    ', defval: false, group: rangeGroup, inline: 'vwap' },
  { id: 'vwapCol', type: 'color', title: '', defval: '#B2B5BE', group: rangeGroup, inline: 'vwap' },
  { id: 'vwapStyle', type: 'string', title: '', defval: '•••••••••', options: ['•••••••••', '────'], group: rangeGroup, inline: 'vwap' },
  { id: 'outer', type: 'bool', title: 'Outer     ', defval: false, group: rangeGroup, inline: 'out' },
  { id: 'outerCol', type: 'color', title: '', defval: 'rgba(178,181,190,0.2)', group: rangeGroup, inline: 'out' },
  { id: 'outerStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: rangeGroup, inline: 'out' },
  { id: 'extendb', type: 'bool', title: 'Extend (+Bars)', defval: false, group: rangeGroup, inline: 'ex' },
  { id: 'extnmb', type: 'int', title: '', defval: 50, group: rangeGroup, inline: 'ex' },
  { id: 'extend', type: 'bool', title: 'Extend Right', defval: false, group: rangeGroup, inline: 'opt' },
  { id: 'labels', type: 'bool', title: 'Show Labels', defval: true, group: rangeGroup, inline: 'opt' },
  { id: 'dirline', type: 'bool', title: 'Diagonal Line', defval: false, group: rangeGroup, inline: 'dd' },
  { id: 'stats', type: 'bool', title: 'Stats (Soon)', defval: false, group: rangeGroup, inline: 'dd' },
  { id: 'voltype', type: 'string', title: 'Data Type:         ', defval: 'Volume', options: ['Volume', 'Open Interest'], group: vpGroup, inline: 'vp1', tooltip: dtatyptip },
  { id: 'res', type: 'int', title: 'Resolution', defval: 30, min: 5, group: vpGroup, tooltip: rstip },
  { id: 'showProf', type: 'bool', title: 'Volume/OI Profile    ', defval: false, group: vpGroup, inline: 'vpm' },
  { id: 'bullCol', type: 'color', title: '', defval: 'rgba(76,175,79,0.5)', group: vpGroup, inline: 'vpm' },
  { id: 'bearCol', type: 'color', title: '', defval: 'rgba(255,82,82,0.5)', group: vpGroup, inline: 'vpm' },
  { id: 'volhm', type: 'bool', title: 'Vertical Heatmap    ', defval: false, group: vpGroup, inline: 'vhm' },
  { id: 'hvolhm', type: 'bool', title: 'Horizontal Heatmap ', defval: false, group: vpGroup, inline: 'hhm' },
  { id: 'vhmcol1', type: 'color', title: '', defval: 'rgba(33,149,243,0)', group: vpGroup, inline: 'vhm' },
  { id: 'vhmcol2', type: 'color', title: '', defval: 'rgba(20,94,255,0.37)', group: vpGroup, inline: 'vhm' },
  { id: 'hhmcol1', type: 'color', title: '', defval: 'rgba(33,149,243,0)', group: vpGroup, inline: 'hhm' },
  { id: 'hhmcol2', type: 'color', title: '', defval: 'rgba(20,94,255,0.37)', group: vpGroup, inline: 'hhm' },
  { id: 'volnodes', type: 'string', title: 'Node Type', defval: 'Up/Down', options: ['Up/Down', 'Total', 'Delta'], group: vpGroup, tooltip: volndtip },
  { id: 'profilepos', type: 'string', title: 'Profile Position', defval: 'Left', options: ['Left', 'Right'], group: vpGroup, tooltip: prfpostip },
  { id: 'profiledir', type: 'string', title: 'Profile Direction', defval: 'Right', options: ['Left', 'Right'], group: vpGroup, tooltip: prfdirtip },
  { id: 'profiletype', type: 'string', title: 'Profile Type', defval: 'Type 1', options: ['Type 1', 'Type 2'], group: vpGroup, tooltip: ndtytip },
  { id: 'nodesize', type: 'float', title: 'Node Size (%)', defval: 30, min: 1, max: 600, step: 5, group: vpGroup, tooltip: nstip },
  { id: 'VApct', type: 'float', title: 'Value Area (%)', defval: 70, min: 1, max: 100, step: 1, group: vpGroup, tooltip: vapcttip },
  { id: 'volval', type: 'bool', title: 'Profile Node Values', defval: false, group: vpGroup, inline: 'vl' },
  { id: 'hmval', type: 'bool', title: 'Heatmap Node Values', defval: false, group: vpGroup, inline: 'vl' },
  { id: 'showPoc', type: 'bool', title: 'POC      ', defval: false, group: vpGroup, inline: 'poc' },
  { id: 'pocCol', type: 'color', title: '', defval: '#880E4F', group: vpGroup, inline: 'poc' },
  { id: 'pocStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: vpGroup, inline: 'poc' },
  { id: 'showVAH', type: 'bool', title: 'VAH      ', defval: false, group: vpGroup, inline: 'vah' },
  { id: 'vahCol', type: 'color', title: '', defval: 'rgba(255,153,0,0.64)', group: vpGroup, inline: 'vah' },
  { id: 'vahStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: vpGroup, inline: 'vah' },
  { id: 'showVAL', type: 'bool', title: 'VAL        ', defval: false, group: vpGroup, inline: 'val' },
  { id: 'valCol', type: 'color', title: '', defval: 'rgba(255,153,0,0.64)', group: vpGroup, inline: 'val' },
  { id: 'valStyle', type: 'string', title: '', defval: '────', options: ['────', '--------', '┈┈┈┈'], group: vpGroup, inline: 'val' },
  { id: 'showVAbox', type: 'bool', title: 'VA        ', defval: false, group: vpGroup, inline: 'vb' },
  { id: 'VAboxCol', type: 'color', title: '', defval: 'rgba(2,68,122,0.15)', group: vpGroup, inline: 'vb' },
  { id: 'netcol1', type: 'color', title: 'Total Volume', defval: '#2962ff', group: vpGroup, inline: 'ttv' },
  { id: 'netcol2', type: 'color', title: '', defval: '#FF5252', group: vpGroup, inline: 'ttv' },
  { id: 'smoothVol', type: 'bool', title: 'Smooth Volume Data', defval: false, group: vpGroup, tooltip: svtip },
  { id: 'ndsize', type: 'string', title: 'Node Text Style     ', defval: 'Auto', options: ['Tiny', 'Small', 'Normal', 'Large', 'Auto'], group: 'Additional Settings', inline: 'nds' },
  { id: 'ndpos', type: 'string', title: '', defval: 'Center', options: ['Left', 'Right', 'Center'], group: 'Additional Settings', inline: 'nds' },
  { id: 'lblsize', type: 'string', title: 'Label Text Style     ', defval: 'Small', options: ['Tiny', 'Small', 'Normal', 'Large', 'Auto'], group: 'Additional Settings', inline: 'lbls' },
  { id: 'lblpos', type: 'string', title: '', defval: 'Right', options: ['Right', 'Left'], group: 'Additional Settings', inline: 'lbls' },
  { id: 'hmsize', type: 'string', title: 'Heatmap Text Style ', defval: 'Auto', options: ['Tiny', 'Small', 'Normal', 'Large', 'Auto'], group: 'Additional Settings', inline: 'hms' },
  { id: 'hmpos', type: 'string', title: '', defval: 'Left', options: ['Left', 'Right', 'Center'], group: 'Additional Settings', inline: 'hms' },
  { id: 'profbuff', type: 'int', title: 'Profile Node Buffer', defval: 10, min: 3, max: 12, group: 'Additional Settings' },
  { id: 'hmbuff', type: 'int', title: 'Heatmap Node Buffer', defval: 1, min: 1, max: 10, group: 'Additional Settings' },
  { id: 'showRB', type: 'bool', title: 'Range Box', defval: false, group: 'Additional Settings', inline: 'rb' },
  { id: 'rangebCol', type: 'color', title: '', defval: 'rgba(178,181,190,0.02)', group: 'Additional Settings', inline: 'rb' },
  { id: 'startTime', type: 'time', title: 'Start Time', defval: 0, group: timeGroup },
  { id: 'endTime', type: 'time', title: 'End Time', defval: 0, group: timeGroup },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#B2B5BE', lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Range High', color: 'rgba(54,58,69,0)', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Range Low', color: 'rgba(54,58,69,0)', lineWidth: 1, style: 'linebr' },
];

export const fillConfig: FillConfig[] = [{ id: 'fill0', plot1: 'plot1', plot2: 'plot2', title: 'Plots Background' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const metadata = {
  title: 'Range Analysis - By Leviathan',
  shortTitle: 'Range Analysis - By Leviathan',
  overlay: true,
};

/** indicator(max_boxes_count = 500); lines and labels keep the default 50 */
const MAX_BOXES = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
/** nz(): na and +-infinity give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);
/** Pine int(): truncation, na stays na */
const int = (x: number) => (Number.isFinite(x) ? Math.trunc(x) : NaN);
/** math.max / math.min with na give na */
const max = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));
const lineStyle = (s: string) => (s === '--------' ? 'dashed' : s === '┈┈┈┈' ? 'dotted' : 'solid') as 'solid' | 'dashed' | 'dotted';
const textSize = (s: string) => s.toLowerCase();
const align = (s: string) => s.toLowerCase() as 'left' | 'right' | 'center';

/** The open interest symbol of the original and its timeframe */
function openInterestRequest(chart?: ChartContext): SymbolRequest {
  const tf = chartTimeframe([], chart);
  const intraday = /^\d+$/.test(tf) || /^\d*[S]$/.test(tf);
  return {
    symbol: `BINANCE:${basecurrencyOf(chart)}USDT.P_OI`,
    timeframe: symbolTypeOf(chart) === 'futures' && intraday ? '1D' : tf,
  };
}

/**
 * Bars of other symbols the indicator reads: the open interest symbol, with the "Open Interest" data type only. An app
 * gives an empty array for a symbol that does not exist (PineScript ignore_invalid_symbol).
 */
export function requiredSymbols(inputs: Partial<RangeAnalysisByLeviathanInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  return cfg.voltype === 'Open Interest' ? [openInterestRequest(chart)] : [];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RangeAnalysisByLeviathanInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { fills: FillData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const isVolume = cfg.voltype === 'Volume';
  const isOI = cfg.voltype === 'Open Interest';
  const resolution = cfg.res;
  const fg = foregroundColorOf(chart);
  const volume = bars.map((b) => b.volume ?? NaN);

  // time >= startTime and time <= endTime; barsInSession counts the bars in the range
  const inZone = bars.map((b) => b.time * 1000 >= cfg.startTime && b.time * 1000 <= cfg.endTime);
  const lens: number[] = [];
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (inZone[i]) count += 1;
    lens.push(count + 1);
  }
  const src = (hi: boolean) => (b: Bar) => {
    switch (cfg.rangemax) {
      case 'Range Max: Wick': return hi ? b.high : b.low;
      case 'Range Max: Close': return b.close;
      case 'Range Max: HLC3': return (b.high + b.low + b.close) / 3;
      default: return (b.open + b.high + b.low + b.close) / 4;
    }
  };
  const L = Series.fromArray(bars, lens);
  const hiArr = ta.highest(new Series(bars, src(true)), L).toArray().map((v) => v ?? NaN);
  const loArr = ta.lowest(new Series(bars, src(false)), L).toArray().map((v) => v ?? NaN);
  const profHighAt = (i: number) => (i >= 1 ? hiArr[i - 1] : NaN);
  const profLowAt = (i: number) => (i >= 1 ? loArr[i - 1] : NaN);

  // deltaOi = request.security(openInterestTicker, timeframe, close - close[1], ignore_invalid_symbol = true)
  let deltaOi: number[] = new Array(n).fill(NaN);
  if (isOI) {
    const req = openInterestRequest(chart);
    const [oiBars] = symbolBarsOf([req], chart);
    const tf = req.timeframe === chartTimeframe([], chart) ? '' : req.timeframe;
    deltaOi = securityOtherValues(bars, oiBars, tf, oiBars.map((b, j) => (j >= 1 ? b.close - oiBars[j - 1].close : NaN)),
      otherSymbolChart(bars, chart), { other: chart?.symbolInfo?.(req.symbol) });
  }
  const ema5 = cfg.smoothVol ? ta.ema(Series.fromArray(bars, volume), 5).toArray().map((v) => v ?? NaN) : [];
  const dV = bars.map((_, i) => (isOI ? deltaOi[i] : cfg.smoothVol ? ema5[i] : volume[i]));

  resetDrawings({ box: MAX_BOXES });

  const vpGreen: number[] = new Array(resolution).fill(0);
  const vpRed: number[] = new Array(resolution).fill(0);
  const zoneBounds: number[] = new Array(resolution).fill(0);
  const ltf: { o: number; h: number; l: number; c: number; v: number }[] = [];
  let zoneStartIndex = 0;
  let zoneEndIndex = 0;
  let zoneStart = 0;

  const getVol = (y11: number, y12: number, y21: number, y22: number, height: number, vol: number) =>
    nz((max(min(max(y11, y12), max(y21, y22)) - max(min(y11, y12), min(y21, y22)), 0) * vol) / height);

  const profileAdd = (o: number, h: number, l: number, c: number, v: number, g: number) => {
    for (let i = 0; i <= vpGreen.length - 1; i++) {
      const zoneTop = zoneBounds[i];
      const zoneBot = zoneTop - g;
      const bodyTop = max(c, o);
      const bodyBot = min(c, o);
      const itsgreen = ge(c, o);
      const topwick = h - bodyTop;
      const bottomwick = bodyBot - l;
      const body = bodyTop - bodyBot;
      const den = 2 * topwick + 2 * bottomwick + body;
      const bodyvol = (body * v) / den;
      const topwickvol = (2 * topwick * v) / den;
      const bottomwickvol = (2 * bottomwick * v) / den;
      if (isVolume) {
        const bodyPart = getVol(zoneBot, zoneTop, bodyBot, bodyTop, body, bodyvol);
        const wicks = getVol(zoneBot, zoneTop, bodyTop, h, topwick, topwickvol) / 2
          + getVol(zoneBot, zoneTop, bodyBot, l, bottomwick, bottomwickvol) / 2;
        vpGreen[i] = vpGreen[i] + (itsgreen ? bodyPart : 0) + wicks;
        vpRed[i] = vpRed[i] + (itsgreen ? 0 : bodyPart) + wicks;
      } else if (isOI) {
        if (gt(v, 0)) vpGreen[i] = vpGreen[i] + getVol(zoneBot, zoneTop, bodyBot, bodyTop, body, v);
        if (lt(v, 0)) vpRed[i] = vpRed[i] + getVol(zoneBot, zoneTop, bodyBot, bodyTop, body, -v);
      }
    }
  };

  const pocLevel = () => {
    let maxVol = 0;
    let levelInd = 0;
    for (let i = 0; i <= vpRed.length - 1; i++) {
      if (gt(vpRed[i] + vpGreen[i], maxVol)) {
        maxVol = vpRed[i] + vpGreen[i];
        levelInd = i;
      }
    }
    return levelInd !== vpRed.length - 1
      ? zoneBounds[levelInd] - (zoneBounds[levelInd] - zoneBounds[levelInd + 1]) / 2 : NaN;
  };

  const valueLevels = (poc: number, profHigh: number, profLow: number): [number, number] => {
    const gap = (profHigh - profLow) / resolution;
    const volSum = array.sum(vpRed) + array.sum(vpGreen);
    let volCnt = 0;
    let vah = profHigh;
    let val = profLow;
    let pocInd = 0;
    for (let i = 0; i <= zoneBounds.length - 2; i++) {
      if (ge(zoneBounds[i], poc) && lt(zoneBounds[i + 1], poc)) pocInd = i;
    }
    volCnt += vpRed[pocInd] + vpGreen[pocInd];
    const target = volSum * (cfg.VApct / 100);
    for (let i = 1; i <= vpRed.length; i++) {
      if (pocInd + i >= 0 && pocInd + i < vpRed.length) {
        volCnt += vpRed[pocInd + i] + vpGreen[pocInd + i];
        if (ge(volCnt, target)) break;
        val = zoneBounds[pocInd + i] - gap;
      }
      if (pocInd - i >= 0 && pocInd - i < vpRed.length) {
        volCnt += vpRed[pocInd - i] + vpGreen[pocInd - i];
        if (ge(volCnt, target)) break;
        vah = zoneBounds[pocInd - i];
      }
    }
    return [val, vah];
  };

  // VWAP anchored at "Start Time": var arrays of hlc3 * volume and volume, cleared before the start
  const srcVolArray: number[] = [];
  const volArray: number[] = [];
  const vwap: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const isLast = i === n - 1;
    const newSession = inZone[i] && !(i >= 1 && inZone[i - 1]);
    const endSession = !inZone[i] && i >= 1 && inZone[i - 1];
    if (newSession) zoneStartIndex = i;
    if (endSession) zoneEndIndex = i;
    const lookback = i - zoneStart;
    const profHigh = profHighAt(i);
    const profLow = profLowAt(i);
    const update = endSession || (isLast && inZone[i]);

    // calcSession(update)
    vpGreen.fill(0);
    vpRed.fill(0);
    if (i > lookback && update && (cfg.showPoc || cfg.showProf || cfg.showVAbox || cfg.showVAH || cfg.showVAL || cfg.hvolhm)) {
      const gap = (profHigh - profLow) / resolution;
      for (let k = 0; k <= resolution - 1; k++) zoneBounds[k] = profHigh - gap * k;
      for (const x of ltf) profileAdd(x.o, x.h, x.l, x.c, x.v, gap);
    }

    // drawNewZone(update)
    if (update) drawNewZone(i, profHigh, profLow, isLast && inZone[i] ? i : zoneEndIndex);

    // resetProfile(newSession)
    if (newSession) {
      vpGreen.fill(0);
      vpRed.fill(0);
      ltf.length = 0;
    }
    if (inZone[i]) ltf.push({ o: b.open, h: b.high, l: b.low, c: b.close, v: dV[i] });
    if (newSession) zoneStart = i;

    if (cfg.showvwap) {
      if (cfg.startTime <= b.time * 1000) {
        srcVolArray.push(((b.high + b.low + b.close) / 3) * volume[i]);
        volArray.push(volume[i]);
      } else {
        srcVolArray.length = 0;
        volArray.length = 0;
      }
      vwap[i] = array.sum(srcVolArray) / array.sum(volArray);
    }
  }
  setDrawingBar(null);

  function drawNewZone(i: number, profHigh: number, profLow: number, rightIndex: number) {
    const leftMax = zoneStartIndex;
    const rightMax = (rightIndex - zoneStartIndex) * (cfg.nodesize / 100) + zoneStartIndex;
    const xEnd = cfg.extendb ? i + cfg.extnmb : i;
    const ext = cfg.extend ? 'right' : 'none';
    const half = (profHigh + profLow) / 2;
    const l75 = (half + profHigh) / 2;
    const l25 = (half + profLow) / 2;
    const l125 = (profLow + l25) / 2;
    const l375 = (half + l25) / 2;
    const l625 = (half + l75) / 2;
    const l875 = (l75 + profHigh) / 2;
    const up = cfg.dir === 'UP';
    const fibLevel = (r: number) => (up ? profHigh - (profHigh - profLow) * r : profLow + (profHigh - profLow) * r);
    const f618 = fibLevel(0.618);
    const f236 = fibLevel(0.236);
    const f382 = fibLevel(0.382);
    const f786 = fibLevel(0.786);
    const f161 = fibLevel(1.618);
    const f261 = fibLevel(2.618);

    const newLine = (cond: boolean, x: number, y: number, c: string, w: number, s: string) => {
      if (cond) line.new(x, y, xEnd, y, 'bar_index', ext, c, lineStyle(s), w);
    };
    const labelTransparent = String(color.rgb(255, 255, 255, 100));
    const newLabel = (cond: boolean, x: number, y: number, txt: string, txtcl: string) => {
      if (!cond) return;
      const lx = cfg.extend ? x : cfg.lblpos === 'Right' ? (cfg.extendb ? i + cfg.extnmb + 1 : i + 1) : x;
      label.new(lx, y, txt, 'bar_index', 'price', labelTransparent,
        cfg.extend || cfg.lblpos === 'Left' ? 'label_right' : 'label_left', txtcl, textSize(cfg.lblsize));
    };
    const newNode = (cond: boolean, x: number, top: number, right: number, bott: number, col: string, txt: string) => {
      if (cond) {
        box.new(x, top, right, bott, undefined, 0, undefined, undefined, 'bar_index', col, cfg.volval ? txt : undefined,
          textSize(cfg.ndsize), fg, align(cfg.ndpos));
      }
    };
    const newHeatmap = (x: number, top: number, right: number, bott: number, col: string, txt: string) => {
      box.new(x, top, right, bott, undefined, 0, undefined, undefined, 'bar_index', col, cfg.hmval ? txt : undefined,
        textSize(cfg.hmsize), fg, align(cfg.hmpos));
    };
    const hl = (y: number) => line.new(int(leftMax), y, xEnd, y, 'bar_index', ext, cfg.hlCol, 'solid', 1);
    const diagonal = () => line.new(int(leftMax), up ? profLow : profHigh, i, up ? profHigh : profLow, 'bar_index', ext,
      cfg.fibCol, lineStyle(cfg.fibStyle), 1);

    if (array.sum(vpGreen) + array.sum(vpRed) > 0) {
      const gap = (profHigh - profLow) / resolution;
      const rightMaxVol = array.max(vpGreen) + array.max(vpRed);
      const buffer = gap / cfg.profbuff;
      const buffer2 = gap / cfg.hmbuff;
      if (cfg.showProf || cfg.hvolhm) {
        const span = rightMax - leftMax;
        for (let k = 0; k <= vpRed.length - 1; k++) {
          const g = vpGreen[k];
          const r = vpRed[k];
          const vpct = array.percentrank(vpGreen, k) / 100;
          const netcol = String(color.from_gradient(vpct, 0, 1, cfg.netcol1, cfg.netcol2));
          const hmcol = String(color.from_gradient(vpct, 0, 1, cfg.hhmcol1, cfg.hhmcol2));
          const gleft = cfg.profilepos === 'Left' ? leftMax : i;
          const greenEnd = int(leftMax + span * (g / rightMaxVol));
          const greenEndD = int(gleft - span * (g / rightMaxVol));
          const greenEnd2 = int(i + span * (g / rightMaxVol));
          const redEnd = int(greenEnd + span * (r / rightMaxVol));
          const redEndD = int(greenEndD - span * (r / rightMaxVol));
          const redEnd2 = int(greenEnd2 + span * (r / rightMaxVol));
          const redEnd3 = int(int(leftMax) - span * (r / rightMaxVol));
          const redEnd4 = int(i - span * (r / rightMaxVol));
          const total = int(leftMax + span * (g / rightMaxVol) + span * (r / rightMaxVol));
          const totalD = int(gleft - span * (g / rightMaxVol) - span * (r / rightMaxVol));
          const total2 = int(i + span * (g / rightMaxVol) + span * (r / rightMaxVol));
          const delta = g - r;
          const deltap = int(gleft + span * (Math.abs(g - r) / rightMaxVol));
          const deltap2 = int(gleft - span * (Math.abs(g - r) / rightMaxVol));
          const totvol = str.tostring(g + (isVolume ? r : 0), 'volume');
          const hmvoloi = str.tostring(g - r, 'volume');
          const gvol = str.tostring(g, 'volume');
          const rvol = str.tostring(r, 'volume');
          const dvol = str.tostring(delta, 'volume');
          const top = zoneBounds[k] - buffer;
          const bott = zoneBounds[k] - gap + buffer;
          const right = cfg.profiledir === 'Right';
          const upDown = cfg.volnodes === 'Up/Down';
          const t1 = cfg.profiletype === 'Type 1';
          const t2 = cfg.profiletype === 'Type 2';
          const isDelta = cfg.volnodes === 'Delta';
          const deltaCol = gt(delta, 0) ? cfg.bullCol : cfg.bearCol;
          if (cfg.profilepos === 'Left' && cfg.showProf) {
            newNode(upDown, int(leftMax), top, right ? greenEnd : greenEndD, bott, cfg.bullCol, gvol);
            newNode(upDown && t1, right ? greenEnd : greenEndD, top, right ? redEnd : redEndD, bott, cfg.bearCol, rvol);
            newNode(upDown && t2, int(leftMax), top, redEnd3, bott, cfg.bearCol, rvol);
            newNode(cfg.volnodes === 'Total', int(leftMax), top, right ? total : totalD, bott, netcol, totvol);
            newNode(isDelta && t1, int(leftMax), top, deltap, bott, deltaCol, dvol);
            newNode(isDelta && t2, int(leftMax), top, gt(delta, 0) ? deltap : deltap2, bott, deltaCol, dvol);
          }
          if (cfg.profilepos === 'Right' && cfg.showProf) {
            newNode(upDown, i, top, right ? greenEnd2 : greenEndD, bott, cfg.bullCol, gvol);
            newNode(upDown && t1, right ? greenEnd2 : greenEndD, top, right ? redEnd2 : redEndD, bott, cfg.bearCol, rvol);
            newNode(upDown && t2, i, top, redEnd4, bott, cfg.bearCol, rvol);
            newNode(cfg.volnodes === 'Total', i, top, right ? total2 : totalD, bott, netcol, totvol);
            newNode(isDelta && t1, int(gleft), top, deltap, bott, deltaCol, dvol);
            newNode(isDelta && t2, int(gleft), top, gt(delta, 0) ? deltap : deltap2, bott, deltaCol, dvol);
          }
          if (cfg.hvolhm) {
            newHeatmap(int(leftMax), zoneBounds[k] - buffer2, i, zoneBounds[k] - gap + buffer2, hmcol, isVolume ? totvol : hmvoloi);
          }
        }
      }

      // levels drawn by the profile code (not kept in an array)
      if (cfg.showHL) {
        hl(profHigh);
        hl(profLow);
      }
      if (cfg.lvl05 || cfg.quarters || cfg.eighths) newLine(true, int(leftMax), half, cfg.lvl05Col, 1, cfg.lvl05Style);
      if (cfg.quarters || cfg.eighths) {
        newLine(true, int(leftMax), l75, cfg.quartersCol, 1, cfg.quartersStyle);
        newLine(true, int(leftMax), l25, cfg.quartersCol, 1, cfg.quartersStyle);
      }
      if (cfg.eighths) {
        newLine(true, int(leftMax), l125, cfg.eighthsCol, 1, cfg.eighthsStyle);
        newLine(true, int(leftMax), l375, cfg.eighthsCol, 1, cfg.eighthsStyle);
        newLine(true, int(leftMax), l625, cfg.eighthsCol, 1, cfg.eighthsStyle);
        newLine(true, int(leftMax), l875, cfg.eighthsCol, 1, cfg.eighthsStyle);
      }
      if (cfg.outer) {
        const q = cfg.quarters || cfg.eighths;
        newLine(q, int(leftMax), profLow - (l25 - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(q, int(leftMax), profLow - (half - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(q, int(leftMax), profHigh + (l25 - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(q, int(leftMax), profHigh + (half - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(cfg.eighths, int(leftMax), profHigh + (l125 - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(cfg.eighths, int(leftMax), profHigh + (l375 - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(cfg.eighths, int(leftMax), profLow - (l125 - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(cfg.eighths, int(leftMax), profLow - (l375 - profLow), cfg.outerCol, 1, cfg.outerStyle);
        newLine(cfg.fib, int(leftMax), f161, cfg.fibCol, 1, cfg.fibStyle);
        newLine(cfg.fib, int(leftMax), f261, cfg.fibCol, 1, cfg.fibStyle);
      }
      if (cfg.fib) {
        newLine(true, int(leftMax), f618, cfg.fibCol, 1, cfg.fibStyle);
        newLine(true, int(leftMax), f236, cfg.fibCol, 1, cfg.fibStyle);
        newLine(true, int(leftMax), f382, cfg.fibCol, 1, cfg.fibStyle);
        newLine(true, int(leftMax), f786, cfg.fibCol, 1, cfg.fibStyle);
      }
      if (cfg.dirline) diagonal();
      if (cfg.labels) {
        newLabel(cfg.lvl05, int(leftMax), half, '0.5', cfg.hlCol);
        newLabel(cfg.fib, int(leftMax), f618, '0.618', cfg.fibCol);
        newLabel(cfg.fib, int(leftMax), f236, '0.236', cfg.fibCol);
        newLabel(cfg.fib, int(leftMax), f382, '0.382', cfg.fibCol);
        newLabel(cfg.fib, int(leftMax), f786, '0.786', cfg.fibCol);
        newLabel(cfg.showHL, int(leftMax), profHigh, up ? '0' : '1', cfg.hlCol);
        newLabel(cfg.showHL, int(leftMax), profLow, up ? '1' : '0', cfg.hlCol);
        newLabel(cfg.quarters, int(leftMax), l75, up ? '0.25' : '0.75', cfg.hlCol);
        newLabel(cfg.quarters, int(leftMax), l25, up ? '0.75' : '0.25', cfg.hlCol);
      }

      const poc = pocLevel();
      const [val, vah] = valueLevels(poc, profHigh, profLow);
      const level = (y: number, c: string, s: string) => line.new(int(leftMax), y, xEnd, y, 'bar_index', ext, c, lineStyle(s), 1);
      if (cfg.showPoc) level(poc, cfg.pocCol, cfg.pocStyle);
      if (cfg.showVAH) level(vah, cfg.vahCol, cfg.vahStyle);
      if (cfg.showVAL) level(val, cfg.valCol, cfg.valStyle);
      if (cfg.showVAbox) {
        box.new(int(leftMax), vah, xEnd, val, 'transparent', undefined, undefined, ext, 'bar_index', cfg.VAboxCol);
      }
    }

    // levels code: one range end, so the arrays of the previous range are empty
    if (cfg.showHL || cfg.dirline || cfg.lvl05 || cfg.quarters || cfg.eighths || cfg.outer || cfg.fib || cfg.labels) {
      const q = cfg.quarters || cfg.eighths;
      const o = cfg.outer;
      if (cfg.showHL) hl(profHigh);
      if (cfg.showHL) hl(profLow);
      if (cfg.dirline) diagonal();
      newLine(cfg.lvl05 || q, int(leftMax), half, cfg.lvl05Col, 1, cfg.lvl05Style);
      newLine(q, int(leftMax), l75, cfg.quartersCol, 1, cfg.quartersStyle);
      newLine(q, int(leftMax), l25, cfg.quartersCol, 1, cfg.quartersStyle);
      newLine(cfg.eighths, int(leftMax), l125, cfg.eighthsCol, 1, cfg.eighthsStyle);
      newLine(cfg.eighths, int(leftMax), l375, cfg.eighthsCol, 1, cfg.eighthsStyle);
      newLine(cfg.eighths, int(leftMax), l625, cfg.eighthsCol, 1, cfg.eighthsStyle);
      newLine(cfg.eighths, int(leftMax), l875, cfg.eighthsCol, 1, cfg.eighthsStyle);
      newLine(o && q, int(leftMax), profLow - (l25 - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && q, int(leftMax), profLow - (half - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && q, int(leftMax), profHigh + (l25 - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && cfg.eighths, int(leftMax), profLow - (l375 - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && cfg.eighths, int(leftMax), profLow - (l125 - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && q, int(leftMax), profHigh + (half - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && cfg.eighths, int(leftMax), profHigh + (l125 - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && cfg.eighths, int(leftMax), profHigh + (l375 - profLow), cfg.outerCol, 1, cfg.outerStyle);
      newLine(o && cfg.fib, int(leftMax), f161, cfg.fibCol, 1, cfg.fibStyle);
      newLine(o && cfg.fib, int(leftMax), f261, cfg.fibCol, 1, cfg.fibStyle);
      newLine(cfg.fib, int(leftMax), f618, cfg.fibCol, 1, cfg.fibStyle);
      newLine(cfg.fib, int(leftMax), f236, cfg.fibCol, 1, cfg.fibStyle);
      newLine(cfg.fib, int(leftMax), f382, cfg.fibCol, 1, cfg.fibStyle);
      newLine(cfg.fib, int(leftMax), f786, cfg.fibCol, 1, cfg.fibStyle);
      const lb = cfg.labels;
      newLabel(lb && cfg.fib, int(leftMax), f618, '0.618', cfg.hlCol);
      newLabel(lb && cfg.fib, int(leftMax), f236, '0.236', cfg.hlCol);
      newLabel(lb && cfg.fib, int(leftMax), f382, '0.382', cfg.hlCol);
      newLabel(lb && cfg.fib, int(leftMax), f786, '0.786', cfg.hlCol);
      newLabel(lb && cfg.lvl05, int(leftMax), half, '0.5', cfg.hlCol);
      newLabel(lb && cfg.showHL, int(leftMax), profHigh, up ? '0' : '1', cfg.hlCol);
      newLabel(lb && cfg.showHL, int(leftMax), profLow, up ? '1' : '0', cfg.hlCol);
      newLabel(lb && cfg.quarters, int(leftMax), l25, up ? '0.75' : '0.25', cfg.hlCol);
      newLabel(lb && cfg.quarters, int(leftMax), l75, up ? '0.25' : '0.75', cfg.hlCol);
      if (cfg.showRB) {
        box.new(zoneStartIndex, profHigh, i, profLow, 'transparent', undefined, undefined, undefined, 'bar_index', cfg.rangebCol);
      }
    }
  }

  // plots and the vertical heatmap fill
  const vhmsrc = isVolume ? volume : deltaOi;
  const hvol = ta.highest(Series.fromArray(bars, vhmsrc), 50).toArray().map((v) => v ?? NaN);
  const shown = (i: number) => cfg.extend || inZone[i];
  const profHigh = bars.map((_, i) => profHighAt(i));
  const profLow = bars.map((_, i) => profLowAt(i));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const rangeColor = String(color.rgb(54, 58, 69, 100));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: shown(i) && cfg.showvwap ? fin(vwap[i]) : NaN, color: cfg.vwapCol })),
      plot1: bars.map((b, i) => ({ time: b.time, value: shown(i) && cfg.volhm ? fin(profHigh[i]) : NaN, color: rangeColor })),
      plot2: bars.map((b, i) => ({ time: b.time, value: shown(i) && cfg.volhm ? fin(profLow[i]) : NaN, color: rangeColor })),
    },
    fills: [{
      id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' },
      colors: vhmsrc.map((v, i) => String(color.from_gradient(v, 0, hvol[i], cfg.vhmcol1, cfg.vhmcol2))),
    }],
    ...drawingOutputs(bars),
  };
}

export const RangeAnalysisByLeviathan = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  drawingKinds,
  requiredSymbols,
};
