/**
 * ICT Unicorn | Flux Charts
 *
 * The script works on the last 3,000 bars, on closed bars only. One setup at a time:
 * 1. Fair value gaps: three bars of the same type, a gap above the high two bars back (bullish) or below its low
 *    (bearish), the gap and the bodies large enough for the ATR(10) and the sensitivity ("Extreme" 6, "High" 2,
 *    "Normal" 1.5, "Low" 1) and no gap of more than one ATR between the bodies. The 20 latest gaps are kept; a close
 *    beyond the far side ends a gap, and a gap untouched for 200 bars is dropped.
 * 2. Breaker blocks: order blocks from the swing highs / lows of "Swing Length" (the candle with the lowest low /
 *    highest high since the swing, up to 3.5 x ATR(10); 40 kept per side). A body beyond the far side makes the order
 *    block a breaker; a close beyond its other side removes the breaker.
 * 3. Unicorn: on the bar where a fair value gap or a breaker appears, a bullish gap that overlaps a breaker of a
 *    bearish block (or a bearish gap and a breaker of a bullish block) is the setup (the last overlapping pair of
 *    the lists wins). With "Require Retracement" a bar must come back to the far side of the gap. The trade is
 *    entered at the close of the next bar. Targets: Unicorn = stop beyond the 100-bar low / high by 4.75 x ATR(50),
 *    take profit at 0.57 x the stop distance; Dynamic = stop at ATR(50) x the risk factor, take profit at 0.86 x the
 *    stop distance; Fixed = the two percentages. The stop wins when one bar reaches both.
 *
 * Outputs: "TP" / "SL" markers on the exit bars; for the 76 most recent setups with an entry, the breaker block (box
 * and two dashed lines) and the gap (two boxes) up to the entry, a "Buy" / "Sell" label and the dashed target lines
 * with "TP" / "SL" labels (or two boxes with the "Alternative" layout; an open trade ends 15 bars after the current
 * bar); the backtesting table. The blocks and gaps of older setups stay on the chart (up to 500 objects of each
 * kind), as in the original.
 * Alerts: the four alert conditions (`alerts` of the result: 'Buy Signal' and 'Sell Signal' on the entry bars,
 * 'Take-Profit Signal' and 'Stop-Loss Signal' on the exit bars) and the alert() calls of the same names
 * (`alertCalls`, each with its "... Signal" input on), as in the original only from the last closed bar of the
 * history on (the bars before it are the initial run): the last bar, or the bar before it when the last bar is open.
 *
 * Chart context (optional third argument):
 * - `chart.lastBarConfirmed`: the original works on closed bars only. When the last bar is still open, it is not
 *   read, and the drawings are those of the bar before it. Without it every bar is a closed bar.
 * - `chart.timezone` / `chart.session` (and `chart.timeframe`): the times after the last bar follow the exchange
 *   calendar; without them the bar interval.
 * - `chart.mintick`: the tick of the prices in the texts of the "Alternative" layout. Without it 0.01.
 *
 * Reference: "ICT Unicorn | Flux Charts" by fluxchart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fluxchart
 */

import {
  ta, str, color, Series, box, line, label, resetDrawings, setDrawingBar,
  type Box, type Line, type Label, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig,
} from 'oakscriptjs';
import type { AlertCall, BoxData, LabelData, LineDrawingData, MarkerData, TableData, TableCellData, TablePosition } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { timeAfterLastBar, barsAfterLastBar } from '../anchor-period';
import { lastBarConfirmedOf, mintickOf, type ChartContext } from '../chart-context';

export interface IctUnicornFluxChartsInputs {
  fvgSensitivityText: 'Extreme' | 'High' | 'Normal' | 'Low';
  swingLength: number;
  /** Require Retracement */
  dbgRequireRetracement: boolean;
  showBB: boolean;
  showFVG: boolean;
  showTPSL: boolean;
  tpslMethod: 'Unicorn' | 'Dynamic' | 'Fixed';
  riskAmount: 'Highest' | 'High' | 'Normal' | 'Low' | 'Lowest';
  tpPercent: number;
  slPercent: number;
  backtestDisplayEnabled: boolean;
  backtestingLocation: 'Top Right' | 'Right Center' | 'Top Center';
  fillBackgrounds: boolean;
  screenerColor: string;
  buyAlertEnabled: boolean;
  sellAlertEnabled: boolean;
  tpAlertEnabled: boolean;
  slAlertEnabled: boolean;
  /** TP / SL Layout */
  dbgTPSLVersion: 'Default' | 'Alternative';
  bullishBreakerBlockColor: string;
  bearishBreakerBlockColor: string;
  highColor: string;
  lowColor: string;
  textColor: string;
}

export const defaultInputs: IctUnicornFluxChartsInputs = {
  fvgSensitivityText: 'Normal',
  swingLength: 10,
  dbgRequireRetracement: false,
  showBB: true,
  showFVG: true,
  showTPSL: true,
  tpslMethod: 'Unicorn',
  riskAmount: 'Normal',
  tpPercent: 0.3,
  slPercent: 0.4,
  backtestDisplayEnabled: true,
  backtestingLocation: 'Top Center',
  fillBackgrounds: true,
  screenerColor: '#1B1F2B',
  buyAlertEnabled: true,
  sellAlertEnabled: true,
  tpAlertEnabled: true,
  slAlertEnabled: true,
  dbgTPSLVersion: 'Default',
  bullishBreakerBlockColor: 'rgba(41, 98, 255, 0.25)',
  bearishBreakerBlockColor: 'rgba(255, 235, 59, 0.25)',
  highColor: 'rgba(8, 153, 129, 0.5)',
  lowColor: 'rgba(242, 54, 70, 0.5)',
  textColor: '#ffffff',
};

const G = 'General Configuration';
export const inputConfig: InputConfig[] = [
  {
    id: 'fvgSensitivityText', type: 'string', title: 'FVG Detection Sensitivity', defval: 'Normal',
    options: ['Extreme', 'High', 'Normal', 'Low'], group: G,
  },
  {
    id: 'swingLength', type: 'int', title: 'Swing Length', defval: 10, min: 3, group: G,
    tooltip: 'Swing length is used when finding order block formations. Smaller values will result in finding smaller order blocks.',
  },
  {
    id: 'dbgRequireRetracement', type: 'bool', title: 'Require Retracement', defval: false, group: G,
    tooltip: 'A retracement to the FVG will be required for entry confirmation if enabled.',
  },
  { id: 'showBB', type: 'bool', title: 'Show Breaker Blocks', defval: true, inline: 'bb', group: G },
  { id: 'showFVG', type: 'bool', title: 'FVGs', defval: true, inline: 'bb', group: G },
  { id: 'showTPSL', type: 'bool', title: 'Enabled', defval: true, group: 'TP / SL' },
  { id: 'tpslMethod', type: 'string', title: 'TP / SL Method', defval: 'Unicorn', options: ['Unicorn', 'Dynamic', 'Fixed'], group: 'TP / SL' },
  {
    id: 'riskAmount', type: 'string', title: 'Dynamic Risk', defval: 'Normal', options: ['Highest', 'High', 'Normal', 'Low', 'Lowest'], group: 'TP / SL',
    tooltip: 'The risk amount when Dynamic TP / SL method is selected.\n\nDifferent assets may have different volatility so changing this setting may result in change of performance of the indicator.',
  },
  { id: 'tpPercent', type: 'float', title: 'Fixed Take Profit %', defval: 0.3, group: 'TP / SL' },
  { id: 'slPercent', type: 'float', title: 'Fixed Stop Loss %', defval: 0.4, group: 'TP / SL' },
  { id: 'backtestDisplayEnabled', type: 'bool', title: 'Enabled', defval: true, group: 'Backtesting Dashboard' },
  {
    id: 'backtestingLocation', type: 'string', title: 'Position', defval: 'Top Center', options: ['Top Right', 'Right Center', 'Top Center'],
    group: 'Backtesting Dashboard',
  },
  { id: 'fillBackgrounds', type: 'bool', title: 'Fill Backgrounds', defval: true, group: 'Backtesting Dashboard' },
  { id: 'screenerColor', type: 'color', title: 'Background', defval: '#1B1F2B', inline: '1', group: 'Backtesting Dashboard' },
  { id: 'buyAlertEnabled', type: 'bool', title: 'Buy Signal', defval: true, inline: 'BS', group: 'Alerts' },
  { id: 'sellAlertEnabled', type: 'bool', title: 'Sell Signal', defval: true, inline: 'BS', group: 'Alerts' },
  { id: 'tpAlertEnabled', type: 'bool', title: 'Take-Profit Signal', defval: true, inline: 'TS', group: 'Alerts' },
  { id: 'slAlertEnabled', type: 'bool', title: 'Stop-Loss Signal ', defval: true, inline: 'TS', group: 'Alerts' },
  { id: 'dbgTPSLVersion', type: 'string', title: 'TP / SL Layout', defval: 'Default', options: ['Default', 'Alternative'], group: 'Visuals' },
  { id: 'bullishBreakerBlockColor', type: 'color', title: 'Bullish Breaker', defval: 'rgba(41, 98, 255, 0.25)', inline: 'breakerColor', group: 'Visuals' },
  { id: 'bearishBreakerBlockColor', type: 'color', title: 'Bearish Breaker', defval: 'rgba(255, 235, 59, 0.25)', inline: 'breakerColor', group: 'Visuals' },
  { id: 'highColor', type: 'color', title: 'Buy', defval: 'rgba(8, 153, 129, 0.5)', inline: 'colors', group: 'Visuals' },
  { id: 'lowColor', type: 'color', title: 'Sell', defval: 'rgba(242, 54, 70, 0.5)', inline: 'colors', group: 'Visuals' },
  { id: 'textColor', type: 'color', title: 'Text', defval: '#ffffff', inline: 'colors', group: 'Visuals' },
];

export const plotConfig: PlotConfig[] = [];

/** Colour constants of Pine v5 */
const RED = '#FF5252';
const BLUE = '#2962FF';
const WHITE = '#FFFFFF';
const BLACK = '#363A45';

/** The four plotshape() calls of the original (untitled there) */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Short Stop Loss', style: 'circle', location: 'abovebar', color: RED, text: 'SL', size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Long Stop Loss', style: 'circle', location: 'belowbar', color: RED, text: 'SL', size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Long Take Profit', style: 'xcross', location: 'abovebar', color: BLUE, text: 'TP', size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Short Take Profit', style: 'xcross', location: 'belowbar', color: BLUE, text: 'TP', size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line', 'label', 'table'];

export const metadata = {
  title: 'ICT Unicorn | Flux Charts',
  shortTitle: 'ICT Unicorn | Flux Charts',
  overlay: true,
};

/** Constants of the script */
const MAX_BOXES = 500;
const MAX_DISTANCE_TO_LAST_BAR = 3000;
const MAX_ORDER_BLOCKS = 40;
const SHOW_LAST_X_FVGS = 20;
const ATR_LEN = 10;
const DELETE_UNTOUCHED_AFTER = 200;
const MAX_ATR_MULT = 3.5;
const ZONE_COUNT_OB = 20;
const MAX_UNICORN = 75;
const ATR_LEN_UNICORN = 50;
const UNICORN_TPSL_LENGTH = 100;
const UNICORN_SL_OFFSET = 4.75;
const UNICORN_RR = 0.57;
const DYNAMIC_RR = 0.86;
const ENTRY_WAIT_BARS = 1;
const OVERLAP_THRESHOLD = 0;

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine math.max / math.min: na when an argument is na */
const max2 = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min2 = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

interface FVGInfo {
  max: number;
  min: number;
  isBull: boolean;
  startTime: number;
  endTime: number;
  lastTouched: number;
  isInverse: boolean;
}
/** type FVG: the info and the two boxes of renderFVG (zone, text) */
interface FVG {
  info: FVGInfo;
  boxes: Box[];
}
interface OBInfo {
  top: number;
  bottom: number;
  obType: 'Bull' | 'Bear';
  startTime: number;
  breaker: boolean;
  breakTime: number;
}
/** type orderBlock: the info, the breaker box and its two lines */
interface OB {
  info: OBInfo;
  boxes: Box[];
  lines: Line[];
}
type State = 'Waiting For FVG-BB Overlap' | 'FVG-BB Overlap' | 'Require Retracement' | 'Enter Position' | 'Entry Taken'
  | 'Take Profit' | 'Stop Loss' | 'Done';
interface Unicorn {
  state: State;
  overlapDirection: 'Bull' | 'Bear' | null;
  retraceTo: number;
  enterPositionBar: number;
  fvg: FVG | null;
  ob: OB | null;
  slTarget: number;
  tpTarget: number;
  entryType: 'Long' | 'Short' | null;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
}

const POSITIONS: Record<string, TablePosition> = {
  'Top Right': 'top_right',
  'Top Center': 'top_center',
  'Right Center': 'middle_right',
};

export function calculate(
  bars: Bar[],
  inputs: Partial<IctUnicornFluxChartsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; tables: TableData[] }
  & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const markers: MarkerData[] = [];
  const tables: TableData[] = [];
  const boxesOut: BoxData[] = [];
  const linesOut: LineDrawingData[] = [];
  const labelsOut: LabelData[] = [];
  // buyAlertTick / sellAlertTick / tpAlertTick / slAlertTick and not initRun, per bar
  const alertFlags: boolean[][] = [[], [], [], []];
  const alertCalls: AlertCall[] = [];
  const result = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines: linesOut,
    boxes: boxesOut,
    labels: labelsOut,
    tables,
    alerts: alertStates(alertConditions, bars, alertFlags),
    alertCalls,
  });
  if (n === 0) return result();

  // Bar times are in s or ms; Pine adds ms
  const U = bars[0].time >= 1e12 ? 1 : 1000;

  const fvgSensitivity = cfg.fvgSensitivityText === 'Extreme' ? 6 : cfg.fvgSensitivityText === 'High' ? 2
    : cfg.fvgSensitivityText === 'Normal' ? 1.5 : 1;
  const slATRMult = cfg.riskAmount === 'Highest' ? 9.5 : cfg.riskAmount === 'High' ? 6 : cfg.riskAmount === 'Normal' ? 5
    : cfg.riskAmount === 'Low' ? 4 : cfg.riskAmount === 'Lowest' ? 1.5 : 6.5;
  const { tpPercent, slPercent, tpslMethod } = cfg;
  const swingLength = Math.trunc(cfg.swingLength);
  const MINTICK = mintickOf(chart);

  const arr = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const atr = arr(ta.atr(bars, ATR_LEN));
  const atrUnicorn = arr(ta.atr(bars, ATR_LEN_UNICORN));
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const upperArr = arr(ta.highest(highSeries, swingLength));
  const lowerArr = arr(ta.lowest(lowSeries, swingLength));
  const highTPSL = arr(ta.highest(highSeries, UNICORN_TPSL_LENGTH));
  const lowTPSL = arr(ta.lowest(lowSeries, UNICORN_TPSL_LENGTH));

  // The original reads and draws closed bars only (barstate.isconfirmed)
  const lastConfirmed = lastBarConfirmedOf(chart);

  /** Time after the last bar: the bar `count` bars after the last bar */
  const after = (count: number) => timeAfterLastBar(bars, count, chart);
  /** A drawing x given as a time is drawn on the first bar at or after that time */
  const snap = (t: number): number => {
    if (isNaN(t)) return NaN;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid].time < t) lo = mid + 1;
      else hi = mid;
    }
    if (lo < n) return bars[lo].time;
    const k = barsAfterLastBar(bars, t, chart);
    if (isNaN(k)) return t;
    const tk = after(k);
    return tk >= t ? tk : after(k + 1);
  };

  resetDrawings({ box: MAX_BOXES, line: MAX_BOXES, label: MAX_BOXES });

  const colorWithTransparency = (c: string, x: number) => String(color.new(c, color.t(c) * x));
  /** createFVGBox(): box.new(na, na, na, na, text_size = size.normal, xloc = xloc.bar_time, ...) */
  const createFVGBox = (boxColor: string, transparencyX = 1.0) => box.new(
    NaN, NaN, NaN, NaN, '#00000000', 1, 'solid', 'none', 'bar_time', colorWithTransparency(boxColor, transparencyX), '',
    'normal', cfg.textColor, 'center',
  );
  const moveBox = (b: Box, x1: number, y1: number, x2: number, y2: number) => {
    box.set_lefttop(b, x1, y1);
    box.set_rightbottom(b, x2, y2);
  };
  // safeDeleteFVG() / safeDeleteOrderBlock()
  const deleteObjects = (obj: { boxes: Box[]; lines?: Line[] }) => {
    for (const b of obj.boxes) box.delete(b);
    obj.boxes = [];
    if (obj.lines) {
      for (const l of obj.lines) line.delete(l);
      obj.lines = [];
    }
  };

  // renderFVG(fvg, customEndTime) with the constant settings of the script (no volumetric info, no IFVG)
  const renderFVG = (fvg: FVG, customEndTime: number) => {
    const info = fvg.info;
    const zoneBox = createFVGBox(info.isBull ? cfg.highColor : cfg.lowColor, 1.5);
    const textBox = createFVGBox(String(color.new(WHITE, 100)));
    fvg.boxes = [zoneBox, textBox];
    const zoneSize = customEndTime - info.startTime;
    const maxEndX = info.startTime + zoneSize / 3;
    moveBox(zoneBox, info.startTime, info.max, info.startTime + zoneSize, info.min);
    moveBox(textBox, maxEndX, info.max, info.startTime + zoneSize, info.min);
  };
  // renderOrderBlock(ob, customEndTime): order blocks are off, so only the breaker block
  const renderOrderBlock = (ob: OB, customEndTime: number) => {
    const info = ob.info;
    if (!info.breaker) return;
    const breakerBlockColor = info.obType === 'Bull' ? cfg.bearishBreakerBlockColor : cfg.bullishBreakerBlockColor;
    const startTime = info.startTime;
    const endTime = customEndTime;
    ob.boxes = [box.new(
      startTime, info.top, endTime, info.bottom, 'transparent', 1, 'solid', 'none', 'bar_time', breakerBlockColor, '', 'normal', cfg.textColor,
    )];
    const lineColor = colorWithTransparency(breakerBlockColor, 0);
    ob.lines = [
      line.new(startTime, info.top, endTime, info.top, 'bar_time', 'none', lineColor, 'dashed'),
      line.new(startTime, info.bottom, endTime, info.bottom, 'bar_time', 'none', lineColor, 'dashed'),
    ];
  };

  // Area of a zone from x1 to x2 (ms) between two prices, as areaOfOB / areaOfBB / areaOfFVG compute it
  const area = (x1: number, x2: number, y1: number, y2: number) => {
    const edge1 = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y2) * (y2 - y2));
    const edge2 = Math.sqrt((x2 - x2) * (x2 - x2) + (y2 - y1) * (y2 - y1));
    return edge1 * edge2;
  };
  // doBBFVGTouch(OBInfo, FVGInfo) on the bar at `timeMs` (the FVG has no end time: the ended ones are dropped)
  const doBBFVGTouch = (o: OBInfo, f: FVGInfo, timeMs: number) => {
    if (!o.breaker) return false;
    const XA1 = o.breakTime * U;
    const XA2 = timeMs + 1;
    const YA1 = o.top;
    const YA2 = o.bottom;
    const XB1 = f.startTime * U;
    const XB2 = isNaN(f.endTime) ? timeMs + 1 : f.endTime * U;
    const YB1 = f.max;
    const YB2 = f.min;
    const intersectionArea = Math.max(0, Math.min(XA2, XB2) - Math.max(XA1, XB1)) * Math.max(0, Math.min(YA1, YB1) - Math.max(YA2, YB2));
    const unionArea = area(XA1, XA2, YA1, YA2) + area(XB1, XB2, YB1, YB2) - intersectionArea;
    const overlapPercentage = (intersectionArea / unionArea) * 100.0;
    return gt(overlapPercentage, OVERLAP_THRESHOLD);
  };

  // FVGs
  let fvgInfoList: FVGInfo[] = [];
  let allFVGList: FVG[] = [];
  // Order blocks
  const bullishOrderBlocksList: OBInfo[] = [];
  const bearishOrderBlocksList: OBInfo[] = [];
  let allOrderBlocksList: OB[] = [];
  let swingType = 0;
  let prevSwingType = NaN;
  let top = { x: NaN, y: NaN, crossed: false };
  let btm = { x: NaN, y: NaN, crossed: false };
  // Unicorns
  const unicornList: Unicorn[] = [];
  let lastUnicorn: Unicorn | null = null;
  let lineX: Line[] = [];
  let boxX: Box[] = [];
  let labelX: Label[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === last);
    const b = bars[i];
    const time = b.time;
    const timeMs = time * U;
    const confirmed = i < last || lastConfirmed;
    const inRange = i > last - MAX_DISTANCE_TO_LAST_BAR;
    const active = confirmed && inRange;
    let buyAlertTick = false, sellAlertTick = false, tpAlertTick = false, slAlertTick = false;
    const bk = (k: number) => (i - k >= 0 ? bars[i - k] : null);

    // findOBSwings(swingLength), on every bar
    {
      const back = bk(swingLength);
      const hi = back ? back.high : NaN;
      const li = back ? back.low : NaN;
      swingType = gt(hi, upperArr[i]) ? 0 : lt(li, lowerArr[i]) ? 1 : swingType;
      if (swingType === 0 && !isNaN(prevSwingType) && prevSwingType !== 0) top = { x: i - swingLength, y: hi, crossed: false };
      if (swingType === 1 && !isNaN(prevSwingType) && prevSwingType !== 1) btm = { x: i - swingLength, y: li, crossed: false };
      prevSwingType = swingType;
    }

    // Order and breaker blocks (last 3,000 bars)
    if (inRange) {
      for (let k = bullishOrderBlocksList.length - 1; k >= 0; k--) {
        const ob = bullishOrderBlocksList[k];
        if (!ob.breaker) {
          if (lt(Math.min(b.open, b.close), ob.bottom)) {
            ob.breaker = true;
            ob.breakTime = time;
          }
        } else if (gt(b.close, ob.top)) {
          bullishOrderBlocksList.splice(k, 1);
        }
      }
      if (gt(b.close, top.y) && !top.crossed) {
        top.crossed = true;
        // the candle with the lowest low since the swing high (the oldest on a tie)
        const b1 = bk(1);
        let boxBtmBull = b1 ? b1.high : NaN;
        let boxTopBull = b1 ? b1.low : NaN;
        let boxLocBull = b1 ? b1.time : NaN;
        for (let k = 1; k <= i - top.x - 1; k++) {
          const x = bars[i - k];
          boxBtmBull = min2(x.low, boxBtmBull);
          if (eq(boxBtmBull, x.low)) {
            boxTopBull = x.high;
            boxLocBull = x.time;
          }
        }
        if (le(Math.abs(boxTopBull - boxBtmBull), atr[i] * MAX_ATR_MULT)) {
          bullishOrderBlocksList.unshift({ top: boxTopBull, bottom: boxBtmBull, obType: 'Bull', startTime: boxLocBull, breaker: false, breakTime: NaN });
          if (bullishOrderBlocksList.length > MAX_ORDER_BLOCKS) bullishOrderBlocksList.pop();
        }
      }
      for (let k = bearishOrderBlocksList.length - 1; k >= 0; k--) {
        const ob = bearishOrderBlocksList[k];
        if (!ob.breaker) {
          if (gt(Math.max(b.open, b.close), ob.top)) {
            ob.breaker = true;
            ob.breakTime = time;
          }
        } else if (lt(b.close, ob.bottom)) {
          bearishOrderBlocksList.splice(k, 1);
        }
      }
      if (lt(b.close, btm.y) && !btm.crossed) {
        btm.crossed = true;
        // the candle with the highest high since the swing low (the oldest on a tie)
        const b1 = bk(1);
        let boxBtmBear = b1 ? b1.low : NaN;
        let boxTopBear = b1 ? b1.high : NaN;
        let boxLocBear = b1 ? b1.time : NaN;
        for (let k = 1; k <= i - btm.x - 1; k++) {
          const x = bars[i - k];
          boxTopBear = max2(x.high, boxTopBear);
          if (eq(boxTopBear, x.high)) {
            boxBtmBear = x.low;
            boxLocBear = x.time;
          }
        }
        if (le(Math.abs(boxTopBear - boxBtmBear), atr[i] * MAX_ATR_MULT)) {
          bearishOrderBlocksList.unshift({ top: boxTopBear, bottom: boxBtmBear, obType: 'Bear', startTime: boxLocBear, breaker: false, breakTime: NaN });
          if (bearishOrderBlocksList.length > MAX_ORDER_BLOCKS) bearishOrderBlocksList.pop();
        }
      }
    }

    // Fair value gaps (closed bars of the last 3,000)
    if (active) {
      const b1 = bk(1);
      const b2 = bk(2);
      let cond = false;
      if (b1 && b2) {
        const size = (x: Bar) => Math.max(x.open, x.close) - Math.min(x.open, x.close);
        const barSizeSum = size(b) + size(b1) + size(b2);
        const sameType = (gt(b.open, b.close) && gt(b1.open, b1.close) && gt(b2.open, b2.close))
          || (le(b.open, b.close) && le(b1.open, b1.close) && le(b2.open, b2.close));
        if (sameType) {
          const maxCODiff = Math.max(Math.abs(b2.close - b1.open), Math.abs(b1.close - b.open));
          cond = gt(barSizeSum * fvgSensitivity, atr[i] / 1.5) && le(maxCODiff, atr[i]);
        }
      }
      const bearFVG = !!b2 && lt(b.high, b2.low) && lt(b1!.close, b2.low) && cond;
      const bullFVG = !!b2 && gt(b.low, b2.high) && gt(b1!.close, b2.high) && cond;
      const fvgSize = bearFVG ? Math.abs(b2!.low - b.high) : bullFVG ? Math.abs(b.low - b2!.high) : 0;
      if (gt(fvgSize * fvgSensitivity, atr[i]) && (bearFVG || bullFVG)) {
        fvgInfoList.unshift({
          max: bearFVG ? b2!.low : b.low, min: bearFVG ? b.high : b2!.high, isBull: !bearFVG, startTime: time,
          endTime: NaN, lastTouched: i, isInverse: false,
        });
        while (fvgInfoList.length > SHOW_LAST_X_FVGS) fvgInfoList.pop();
      }
      // Find closed FVGs (end on a close beyond the far side)
      for (const f of fvgInfoList) {
        if ((f.isBull && le(b.low, f.max)) || (!f.isBull && ge(b.high, f.min))) f.lastTouched = i;
        if (isNaN(f.endTime)) {
          if ((f.isBull && lt(b.close, f.min)) || (!f.isBull && gt(b.close, f.max))) {
            f.endTime = time;
            f.isInverse = true;
          }
        }
      }
      // Remove old FVGs: the ended ones (inverse FVGs are off) and the ones untouched for more than 200 bars
      fvgInfoList = fvgInfoList.filter((f) => !f.isInverse && !(i - f.lastTouched > DELETE_UNTOUCHED_AFTER));

      // handleFVGsFinal() / handleOrderBlocksFinal(): new copies of the lists (no drawing: they are drawn only as
      // part of a unicorn)
      allFVGList = fvgInfoList.map((info) => ({ info: { ...info }, boxes: [] }));
      allOrderBlocksList = [
        ...bullishOrderBlocksList.slice(0, ZONE_COUNT_OB),
        ...bearishOrderBlocksList.slice(0, ZONE_COUNT_OB),
      ].map((info) => ({ info: { ...info }, boxes: [], lines: [] }));

      // Unicorn
      if (lastUnicorn === null || !isNaN(lastUnicorn.exitPrice)) {
        lastUnicorn = {
          state: 'Waiting For FVG-BB Overlap', overlapDirection: null, retraceTo: NaN, enterPositionBar: NaN, fvg: null,
          ob: null, slTarget: NaN, tpTarget: NaN, entryType: null, entryTime: NaN, exitTime: NaN, entryPrice: NaN,
          exitPrice: NaN,
        };
        unicornList.unshift(lastUnicorn);
      }
      const u: Unicorn = lastUnicorn;
      if (u.state === 'Waiting For FVG-BB Overlap') {
        for (const f of allFVGList) {
          for (const o of allOrderBlocksList) {
            if (!o.info.breaker) continue;
            if (!((o.info.obType === 'Bear' && f.info.isBull) || (o.info.obType === 'Bull' && !f.info.isBull))) continue;
            if (doBBFVGTouch(o.info, f.info, timeMs) && (time === f.info.startTime || time === o.info.breakTime)) {
              u.state = 'FVG-BB Overlap';
              u.overlapDirection = f.info.isBull ? 'Bull' : 'Bear';
              u.retraceTo = f.info.isBull ? f.info.max : f.info.min;
              u.fvg = f;
              u.ob = o;
            }
          }
        }
      }
      if (u.state === 'FVG-BB Overlap') {
        if (!cfg.dbgRequireRetracement) {
          u.state = 'Enter Position';
          u.enterPositionBar = i;
        } else {
          u.state = 'Require Retracement';
        }
      }
      if (u.state === 'Require Retracement') {
        if (u.overlapDirection === 'Bull' && lt(b.low, u.retraceTo)) {
          u.state = 'Enter Position';
          u.enterPositionBar = i;
        }
        if (u.overlapDirection === 'Bear' && gt(b.high, u.retraceTo)) {
          u.state = 'Enter Position';
          u.enterPositionBar = i;
        }
      }
      if (u.state === 'Enter Position' && i >= u.enterPositionBar + ENTRY_WAIT_BARS) {
        u.state = 'Entry Taken';
        u.entryTime = time;
        u.entryPrice = b.close;
        if (u.overlapDirection === 'Bull') {
          u.entryType = 'Long';
          buyAlertTick = true;
          if (tpslMethod === 'Fixed') {
            u.slTarget = u.entryPrice * (1 - slPercent / 100.0);
            u.tpTarget = u.entryPrice * (1 + tpPercent / 100.0);
          } else if (tpslMethod === 'Dynamic') {
            u.slTarget = u.entryPrice - atrUnicorn[i] * slATRMult;
            u.tpTarget = u.entryPrice + Math.abs(u.entryPrice - u.slTarget) * DYNAMIC_RR;
          } else {
            u.slTarget = lowTPSL[i] - atrUnicorn[i] * UNICORN_SL_OFFSET;
            u.tpTarget = u.entryPrice + Math.abs(u.entryPrice - u.slTarget) * UNICORN_RR;
          }
        } else {
          u.entryType = 'Short';
          sellAlertTick = true;
          if (tpslMethod === 'Fixed') {
            u.slTarget = u.entryPrice * (1 + slPercent / 100.0);
            u.tpTarget = u.entryPrice * (1 - tpPercent / 100.0);
          } else if (tpslMethod === 'Dynamic') {
            u.slTarget = u.entryPrice + atrUnicorn[i] * slATRMult;
            u.tpTarget = u.entryPrice - Math.abs(u.entryPrice - u.slTarget) * DYNAMIC_RR;
          } else {
            u.slTarget = highTPSL[i] + atrUnicorn[i] * UNICORN_SL_OFFSET;
            u.tpTarget = u.entryPrice - Math.abs(u.entryPrice - u.slTarget) * UNICORN_RR;
          }
        }
      }
      // Exits: the four tests run one after the other (a stop on the same bar replaces a take profit)
      if (u.state === 'Entry Taken' && time > u.entryTime) {
        const long = u.entryType === 'Long';
        const short = u.entryType === 'Short';
        const exit = (price: number, state: State) => {
          if (state === 'Take Profit') tpAlertTick = true;
          else slAlertTick = true;
          u.exitPrice = price;
          u.exitTime = time;
          u.state = state;
        };
        if (tpslMethod === 'Fixed') {
          if (long && ge((b.high / u.entryPrice - 1) * 100, tpPercent)) exit(u.entryPrice * (1 + tpPercent / 100.0), 'Take Profit');
          if (short && le((b.low / u.entryPrice - 1) * 100, -tpPercent)) exit(u.entryPrice * (1 - tpPercent / 100.0), 'Take Profit');
          if (long && le((b.low / u.entryPrice - 1) * 100, -slPercent)) exit(u.entryPrice * (1 - slPercent / 100.0), 'Stop Loss');
          if (short && ge((b.high / u.entryPrice - 1) * 100, slPercent)) exit(u.entryPrice * (1 + slPercent / 100.0), 'Stop Loss');
        } else {
          if (long && ge(b.high, u.tpTarget)) exit(u.tpTarget, 'Take Profit');
          if (short && le(b.low, u.tpTarget)) exit(u.tpTarget, 'Take Profit');
          if (long && le(b.low, u.slTarget)) exit(u.slTarget, 'Stop Loss');
          if (short && ge(b.high, u.slTarget)) exit(u.slTarget, 'Stop Loss');
        }
      }
    }

    // Exit markers (every bar)
    if (lastUnicorn !== null) {
      const u: Unicorn = lastUnicorn;
      const mark = (id: string, shape: 'circle' | 'xcross', above: boolean, col: string, text: string) => markers.push({
        id, time, position: above ? 'aboveBar' : 'belowBar', shape, color: col, text, textColor: cfg.textColor, size: 'tiny',
      });
      if (u.state === 'Stop Loss' && time >= u.exitTime) {
        if (u.entryType === 'Long') mark('shape1', 'circle', false, RED, 'SL');
        else mark('shape0', 'circle', true, RED, 'SL');
        u.state = 'Done';
      }
      if (u.state === 'Take Profit') {
        if (u.entryType === 'Long') mark('shape2', 'xcross', true, BLUE, 'TP');
        else mark('shape3', 'xcross', false, BLUE, 'TP');
        u.state = 'Done';
      }
    }

    // if barstate.islastconfirmedhistory: initRun := false (var initRun = true): the last bar when it is closed, else
    // the bar before it
    const initRun = i < (lastConfirmed ? last : last - 1);
    // alertcondition(<tick> and not initRun, "<name> Signal", ""); if not initRun: if <tick> and <enabled>: alert(...)
    const ticks = [buyAlertTick, sellAlertTick, tpAlertTick, slAlertTick];
    const enabled = [cfg.buyAlertEnabled, cfg.sellAlertEnabled, cfg.tpAlertEnabled, cfg.slAlertEnabled];
    ticks.forEach((tick, k) => {
      alertFlags[k].push(tick && !initRun);
      if (tick && !initRun && enabled[k]) alertCalls.push({ time, message: alertConditions[k].title, freq: 'once_per_bar' });
    });

    // Drawings: every closed bar deletes them and draws the 76 most recent unicorns again
    if (confirmed) {
      for (const x of lineX) line.delete(x);
      for (const x of boxX) box.delete(x);
      for (const x of labelX) label.delete(x);
      lineX = [];
      boxX = [];
      labelX = [];
      if (unicornList.length > 0) {
        // time("", -15): the bar 15 bars after the current bar
        const endOpen = i + 15 <= last ? bars[i + 15].time : after(i + 15 - last);
        const half = (c: string) => String(color.new(c, 50));
        const textColor = String(color.new(cfg.textColor, 0));
        for (let k = 0; k <= Math.min(MAX_UNICORN, unicornList.length - 1); k++) {
          const ts = unicornList[k];
          if (isNaN(ts.entryTime)) continue;
          if (cfg.showBB && ts.ob !== null) {
            deleteObjects(ts.ob);
            renderOrderBlock(ts.ob, ts.entryTime);
          }
          if (cfg.showFVG && ts.fvg !== null) {
            deleteObjects(ts.fvg);
            renderFVG(ts.fvg, ts.entryTime);
          }
          if (ts.entryType === 'Long') {
            labelX.push(label.new(ts.entryTime, b.close, 'Buy', 'bar_time', 'belowbar', cfg.highColor, 'label_up', textColor, 'normal'));
          } else {
            labelX.push(label.new(ts.entryTime, b.close, 'Sell', 'bar_time', 'abovebar', cfg.lowColor, 'label_down', textColor, 'normal'));
          }
          if (!cfg.showTPSL) continue;
          const endTime = isNaN(ts.exitTime) ? endOpen : ts.exitTime;
          if (cfg.dbgTPSLVersion === 'Alternative') {
            const offset = atrUnicorn[i] / 3.0;
            const altBox = (y: number, text: string, bg: string) => box.new(
              ts.entryTime, y + offset, endTime, y - offset, BLUE, 0, 'solid', 'none', 'bar_time', half(bg), text, 'small', cfg.textColor,
            );
            boxX.push(altBox(ts.tpTarget, `TAKE PROFIT (${str.tostring(ts.tpTarget, 'mintick', MINTICK)})`, cfg.highColor));
            boxX.push(altBox(ts.slTarget, `STOP LOSS (${str.tostring(ts.slTarget, 'mintick', MINTICK)})`, cfg.lowColor));
          } else {
            lineX.push(line.new(ts.entryTime, ts.entryPrice, ts.entryTime, ts.tpTarget, 'bar_time', 'none', cfg.highColor, 'dashed'));
            lineX.push(line.new(ts.entryTime, ts.tpTarget, endTime, ts.tpTarget, 'bar_time', 'none', cfg.highColor, 'dashed'));
            labelX.push(label.new(endTime, ts.tpTarget, 'TP', 'bar_time', 'price', half(cfg.highColor), 'label_left', textColor, 'normal'));
            lineX.push(line.new(ts.entryTime, ts.entryPrice, ts.entryTime, ts.slTarget, 'bar_time', 'none', cfg.lowColor, 'dashed'));
            lineX.push(line.new(ts.entryTime, ts.slTarget, endTime, ts.slTarget, 'bar_time', 'none', cfg.lowColor, 'dashed'));
            labelX.push(label.new(endTime, ts.slTarget, 'SL', 'bar_time', 'price', half(cfg.lowColor), 'label_left', textColor, 'normal'));
          }
        }
      }
    }
  }
  setDrawingBar(null);

  for (const x of box.all()) {
    if (isNaN(x.left) || isNaN(x.right) || isNaN(x.top) || isNaN(x.bottom)) continue;
    boxesOut.push({
      time1: snap(x.left), price1: x.top, time2: snap(x.right), price2: x.bottom, bgColor: String(x.bgcolor ?? 'transparent'),
      borderColor: String(x.border_color ?? 'transparent'), borderWidth: x.border_width ?? 1, text: x.text ?? '',
      textSize: x.text_size as BoxData['textSize'], textColor: String(x.text_color ?? cfg.textColor), textHAlign: x.text_halign ?? 'center',
    });
  }
  for (const l of line.all()) {
    linesOut.push({
      time1: snap(l.x1), price1: l.y1, time2: snap(l.x2), price2: l.y2, color: String(l.color ?? 'transparent'),
      style: l.style ?? 'solid', width: l.width ?? 1,
    });
  }
  for (const l of label.all()) {
    labelsOut.push({
      time: snap(l.x), price: l.y, text: l.text ?? '', yloc: l.yloc, color: String(l.color ?? 'transparent'),
      textColor: String(l.textcolor ?? WHITE), style: l.style as LabelData['style'], size: l.size as LabelData['size'],
    });
  }

  // Backtesting dashboard, on the last bar
  if (cfg.backtestDisplayEnabled) {
    let totalProfitPercent = 0;
    let wins = 0;
    let losses = 0;
    const diffPercent = (val1: number, val2: number) => (Math.abs(val1 - val2) / val2) * 100.0;
    for (const cur of unicornList) {
      if (isNaN(cur.entryPrice)) continue;
      let isSuccess = false;
      if (!isNaN(cur.exitPrice)) {
        if ((cur.entryType === 'Long' && gt(cur.exitPrice, cur.entryPrice)) || (cur.entryType === 'Short' && lt(cur.exitPrice, cur.entryPrice))) {
          totalProfitPercent += Math.abs(diffPercent(cur.entryPrice, cur.exitPrice));
          isSuccess = true;
        } else {
          totalProfitPercent -= Math.abs(diffPercent(cur.entryPrice, cur.exitPrice));
        }
      }
      if (isSuccess) wins += 1;
      else losses += 1;
    }
    const total = wins + losses;
    const cells: TableCellData[] = [];
    const cell = (column: number, row: number, text: string) => cells.push({
      column, row, text, textColor: WHITE, bgColor: cfg.screenerColor, textSize: 'auto',
    });
    cell(0, 0, 'Unicorn Backtesting');
    cell(0, 1, 'Total Entries');
    cell(1, 1, str.tostring(total));
    cell(0, 2, 'Wins');
    cell(1, 2, str.tostring(wins));
    cell(0, 3, 'Losses');
    cell(1, 3, str.tostring(losses));
    cell(0, 4, 'Winrate');
    cell(1, 4, `${str.tostring(100.0 * (wins / total), '#.##')}%`);
    cell(0, 5, 'Average Profit');
    cell(1, 5, `${str.tostring(totalProfitPercent / total, '#.##')}%`);
    cell(0, 6, 'Total Profit');
    cell(1, 6, `${str.tostring(totalProfitPercent, '#.##')}%`);
    tables.push({
      position: POSITIONS[cfg.backtestingLocation] ?? 'top_center', columns: 2, rows: 10, cells,
      merges: [{ startColumn: 0, startRow: 0, endColumn: 1, endRow: 0 }],
      bgColor: cfg.screenerColor, frameWidth: 2, frameColor: BLACK, borderWidth: 1, borderColor: BLACK,
    });
  }

  return result();
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: '' },
  { id: 'alert1', title: 'Sell Signal', message: '' },
  { id: 'alert2', title: 'Take-Profit Signal', message: '' },
  { id: 'alert3', title: 'Stop-Loss Signal', message: '' },
];

/** The original makes alert() calls */
export const hasAlertFunction = true;

export const IctUnicornFluxCharts = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
  hasAlertFunction,
};
