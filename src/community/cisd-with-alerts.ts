/**
 * CISD with Alerts (Change in State of Delivery)
 *
 * Tracks a simple market structure (a top and a bottom price) and the pullbacks against it:
 * - a bearish pullback starts after an up bar (close above open): its level is the open of that bar, moved to the
 *   open of each later bar that opens higher, or to the open of an up bar that opens lower;
 * - a bullish pullback starts after a down bar, its level follows the opens the same way down.
 * When the low breaks the structure bottom after a bearish pullback (or after an up bar followed by a down bar), the
 * pullback level becomes a "+CISD" line from the bar of the level to "Line Extension Bars" bars ahead, with its
 * label. When the high breaks the structure top the bullish pullback level becomes a "-CISD" line.
 *
 * Without "Keep old CISD levels" only the newest level of each side is kept. While a "-CISD" level is not crossed it
 * follows the current bar; a close below it completes it ("Bearish CISD Formed" alert) and draws a new "+CISD" level
 * at the current bearish pullback level. A close above the newest "+CISD" level completes it the same way ("Bullish
 * CISD Formed", a new "-CISD" level); this second check runs only without "Keep old CISD levels", as in the original.
 * The levels drawn at a completion have a monospace label.
 *
 * Optional table (last bar): ticker, timeframe and the current state (bullish after the last bullish completion).
 * Its colours are the chart background / foreground colours of the chart context.
 *
 * Reference: "CISD with Alerts [neo|]" by neommxm
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  line, label, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Label,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import { backgroundColorOf, foregroundColorOf, tickerOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import type { StudyDrawingKind } from '../style-outputs';

export interface CisdWithAlertsInputs {
  /** Colour of the "+CISD" levels */
  bullishBreakColor: string;
  /** Colour of the "-CISD" levels */
  bearishBreakColor: string;
  /** Text next to the "+CISD" levels */
  bullStr: string;
  /** Text next to the "-CISD" levels */
  bearStr: string;
  /** Declared by the original (the alerts do not read it) */
  bullishAlerts: boolean;
  /** Declared by the original (the alerts do not read it) */
  bearishAlerts: boolean;
  lineWidth: number;
  /** Bars the levels extend past the current bar */
  lookAheadBars: number;
  styleOption: string;
  keepLevels: boolean;
  showTable: boolean;
  tablePosition: string;
}

export const defaultInputs: CisdWithAlertsInputs = {
  bullishBreakColor: '#363A45',
  bearishBreakColor: '#363A45',
  bullStr: '+CISD',
  bearStr: '-CISD',
  bullishAlerts: false,
  bearishAlerts: false,
  lineWidth: 1,
  lookAheadBars: 5,
  styleOption: 'Solid (─)',
  keepLevels: false,
  showTable: false,
  tablePosition: 'Top Right',
};

const TEXT_TIP = 'Text to be displayed next to the CISD level.';

export const inputConfig: InputConfig[] = [
  { id: 'bullishBreakColor', type: 'color', title: 'Bull CISD', defval: '#363A45', inline: 'bup' },
  { id: 'bearishBreakColor', type: 'color', title: 'Bear CISD', defval: '#363A45', inline: 'bep' },
  { id: 'bullStr', type: 'string', title: ' ', defval: '+CISD', tooltip: TEXT_TIP, inline: 'bup' },
  { id: 'bearStr', type: 'string', title: ' ', defval: '-CISD', tooltip: TEXT_TIP, inline: 'bep' },
  {
    id: 'bullishAlerts', type: 'bool', title: 'Alert?', defval: false, inline: 'bup',
    tooltip: "When set up through alerts, the script will send an alert when price closes ABOVE the current '+CISD' level.",
  },
  {
    id: 'bearishAlerts', type: 'bool', title: 'Alert?', defval: false, inline: 'bep',
    tooltip: "When set up through alerts, the script will send an alert when price closes ABOVE the current '-CISD' level.",
  },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 1, min: 1, max: 5 },
  { id: 'lookAheadBars', type: 'int', title: 'Line Extension Bars', defval: 5, min: 1, max: 5 },
  { id: 'styleOption', type: 'string', title: 'Line Style', defval: 'Solid (─)', options: ['Solid (─)', 'Dotted (┈)', 'Dashed (╌)'] },
  { id: 'keepLevels', type: 'bool', title: 'Keep old CISD levels', defval: false },
  { id: 'showTable', type: 'bool', title: 'Enable stat table', defval: false, group: 'Table' },
  {
    id: 'tablePosition', type: 'string', title: 'Table Position', defval: 'Top Right', group: 'Table',
    options: ['Top Right', 'Bottom Right', 'Middle Right', 'Bottom Center', 'Middle Left'], active: { input: 'showTable' },
  },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

/** The original calls alert() ("Bearish CISD Formed" / "Bullish CISD Formed") */
export const hasAlertFunction = true;

export const metadata = {
  title: 'CISD with Alerts [neo|]',
  shortTitle: 'CISD neo|',
  overlay: true,
};

/** color.new(color.white, 100) */
const LABEL_BG = 'rgba(255, 255, 255, 0)';

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** gettablePos(): "Middle Left" gives position.bottom_left in the original */
const TABLE_POS: Record<string, 'top_right' | 'bottom_right' | 'middle_right' | 'bottom_center' | 'bottom_left'> = {
  'Top Right': 'top_right',
  'Bottom Right': 'bottom_right',
  'Middle Right': 'middle_right',
  'Bottom Center': 'bottom_center',
  'Middle Left': 'bottom_left',
};

interface Cisd {
  level: Line;
  txt: Label;
  completed: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CisdWithAlertsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const look = cfg.lookAheadBars;
  const style = cfg.styleOption === 'Dotted (┈)' ? 'dotted' : cfg.styleOption === 'Dashed (╌)' ? 'dashed' : 'solid';
  const high = (k: number) => (k >= 0 && k < n ? bars[k].high : NaN);

  resetDrawings({ line: 50, label: 50 });
  const alertCalls: AlertCall[] = [];

  const structure = { topPrice: 0, bottomPrice: 0, isBullish: false };
  const cisdLevelsBu: Cisd[] = [];
  const cisdLevelsBe: Cisd[] = [];
  let isBullishPullback = false;
  let isBearishPullback = false;
  let potentialTopPrice = NaN;
  let potentialBottomPrice = NaN;
  let bullishBreakIndex = NaN;
  let bearishBreakIndex = NaN;
  let currentState = false;

  /** A "+CISD" level at the bearish pullback level (Be array) */
  const newBear = (i: number, font: 'default' | 'monospace'): Cisd => ({
    level: line.new(bullishBreakIndex, potentialTopPrice, i + look, potentialTopPrice, 'bar_index', 'none',
      cfg.bullishBreakColor, style, cfg.lineWidth),
    txt: label.new(i + look, potentialTopPrice, cfg.bullStr, 'bar_index', 'price', LABEL_BG, 'label_left',
      cfg.bullishBreakColor, 'small', 'center', undefined, font, undefined, 2),
    completed: false,
  });
  /** A "-CISD" level at the bullish pullback level (Bu array) */
  const newBull = (i: number, font: 'default' | 'monospace'): Cisd => ({
    level: line.new(bearishBreakIndex, potentialBottomPrice, i + look, potentialBottomPrice, 'bar_index', 'none',
      cfg.bearishBreakColor, style, cfg.lineWidth),
    txt: label.new(i + look, potentialBottomPrice, cfg.bearStr, 'bar_index', 'price', LABEL_BG, 'label_left',
      cfg.bearishBreakColor, 'small', 'center', undefined, font, undefined, 2),
    completed: false,
  });

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const p = i > 0 ? bars[i - 1] : undefined;
    const prevUp = p !== undefined && gt(p.close, p.open);
    const prevDown = p !== undefined && lt(p.close, p.open);

    // Pullback detection
    if (prevUp && !isBearishPullback) {
      isBearishPullback = true;
      potentialTopPrice = p.open;
      bullishBreakIndex = i - 1;
    }
    if (prevDown && !isBullishPullback) {
      isBullishPullback = true;
      potentialBottomPrice = p.open;
      bearishBreakIndex = i - 1;
    }

    // Potential levels during the pullbacks
    if (isBullishPullback) {
      if (lt(b.open, potentialBottomPrice)) {
        potentialBottomPrice = b.open;
        bearishBreakIndex = i;
      }
      if (lt(b.close, b.open) && gt(b.open, potentialBottomPrice)) {
        potentialBottomPrice = b.open;
        bearishBreakIndex = i;
      }
    }
    if (isBearishPullback) {
      if (gt(b.open, potentialTopPrice)) {
        potentialTopPrice = b.open;
        bullishBreakIndex = i;
      }
      if (gt(b.close, b.open) && lt(b.open, potentialTopPrice)) {
        potentialTopPrice = b.open;
        bullishBreakIndex = i;
      }
    }

    // Structure update: bearish break (bar_index - bullishBreakIndex != 0 is false when the index is na)
    if (lt(b.low, structure.bottomPrice)) {
      structure.bottomPrice = b.low;
      structure.isBullish = false;
      if (isBearishPullback && i - bullishBreakIndex !== 0 && !isNaN(bullishBreakIndex)) {
        // math.max(high[bar_index - bullishBreakIndex], high[bar_index - bullishBreakIndex + 1])
        structure.topPrice = Math.max(high(bullishBreakIndex), high(bullishBreakIndex - 1));
        isBearishPullback = false;
        cisdLevelsBe.push(newBear(i, 'default'));
      } else if (prevUp && lt(b.close, b.open)) {
        structure.topPrice = p.high;
        isBearishPullback = false;
        cisdLevelsBe.push(newBear(i, 'default'));
      }
    }

    // Structure update: bullish break
    if (gt(b.high, structure.topPrice)) {
      structure.isBullish = true;
      structure.topPrice = b.high;
      if (isBullishPullback && i - bearishBreakIndex !== 0 && !isNaN(bearishBreakIndex)) {
        structure.bottomPrice = Math.min(bars[bearishBreakIndex]?.low ?? NaN, bars[bearishBreakIndex - 1]?.low ?? NaN);
        isBullishPullback = false;
        cisdLevelsBu.push(newBull(i, 'default'));
      } else if (prevDown && gt(b.close, b.open)) {
        structure.bottomPrice = p.low;
        isBullishPullback = false;
        cisdLevelsBu.push(newBull(i, 'default'));
      }
    }

    if (cisdLevelsBu.length > 1 && !cfg.keepLevels) {
      const oldest = cisdLevelsBu.shift() as Cisd;
      line.delete(oldest.level);
      label.delete(oldest.txt);
    }
    if (cisdLevelsBe.length > 1 && !cfg.keepLevels) {
      const oldest = cisdLevelsBe.shift() as Cisd;
      line.delete(oldest.level);
      label.delete(oldest.txt);
    }

    if (cisdLevelsBu.length >= 1) {
      const latest = cisdLevelsBu[0];
      const y2 = line.get_y2(latest.level);
      if (!lt(b.close, y2) && !latest.completed) {
        line.set_x2(latest.level, i + look);
        label.set_x(latest.txt, i + look);
      }
      if (lt(b.close, y2) && !latest.completed) {
        latest.completed = true;
        alertCalls.push({ time: b.time, message: 'Bearish CISD Formed', freq: 'once_per_bar' });
        cisdLevelsBe.push(newBear(i, 'monospace'));
        currentState = false;
      }
    }

    if (cisdLevelsBe.length >= 1 && !cfg.keepLevels) {
      const latest = cisdLevelsBe[0];
      const y2 = line.get_y2(latest.level);
      if (!gt(b.close, y2) && !latest.completed) {
        line.set_x2(latest.level, i + look);
        label.set_x(latest.txt, i + look);
      }
      if (gt(b.close, y2) && !latest.completed) {
        latest.completed = true;
        alertCalls.push({ time: b.time, message: 'Bullish CISD Formed', freq: 'once_per_bar' });
        cisdLevelsBu.push(newBull(i, 'monospace'));
        currentState = true;
      }
    }

    // Table of the last bar
    if (cfg.showTable && i === n - 1) {
      const fg = foregroundColorOf(chart);
      const bg = backgroundColorOf(chart);
      const tbl = table.new(TABLE_POS[cfg.tablePosition] ?? 'top_right', 4, 4, bg, fg, 1, fg, 1);
      table.cell(tbl, 0, 0, `${tickerOf(chart)}, ${chartTimeframe(bars, chart)} neo|`, 0, 0, fg, undefined, undefined,
        'tiny', undefined, undefined, 'monospace');
      table.cell(tbl, 0, 1, 'Current State', 0, 0, bg, undefined, undefined, 'small', fg, undefined, 'monospace', 1);
      table.cell(tbl, 0, 2, currentState ? 'Bullish' : 'Bearish', 0, 0, fg, undefined, undefined, 'small', undefined,
        undefined, 'monospace', 1);
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alertCalls,
  };
}

export const CisdWithAlerts = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  hasAlertFunction,
};
