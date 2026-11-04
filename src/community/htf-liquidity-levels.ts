/**
 * HTF Liquidity Levels
 *
 * Liquidity levels of up to five higher timeframes (Month, Week and Day by default; 240 and 60 off). On the first bar
 * of each new period of a timeframe (timeframe.change) the script draws two lines at the high and the low of the
 * previous period of that timeframe (request.security(tickerid, tf, [high[1], low[1]], lookahead on)), in the upper
 * and lower colour and the width of the level. A timeframe below the chart timeframe draws nothing. On the last bar
 * every level line is moved to start on the last bar and to end 25 bars after it. A high above an upper level (a low
 * below a lower level) "purges" it: the line takes the purged colour and style. The purged lines are deleted on each
 * new period of the "Removal" timeframe. At most 500 lines are kept (the oldest are deleted, as max_lines_count).
 *
 * The periods follow the exchange calendar of the chart context (time zone and session, see src/anchor-period.ts);
 * without it the UTC calendar of the bars. The higher-timeframe bars are built from the chart bars.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Purging Up', 'Purging Down' and 'Purging', true on the bars
 * where at least one upper / lower / any level is purged.
 *
 * Reference: "HTF Liquidity Levels" by sbtnc
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © sbtnc
 */

import {
  timeframe, line, resetDrawings, setDrawingBar, drawingOutputs,
  type Line, type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, higherTimeframeBars, periodChanges } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface HtfLiquidityLevelsInputs {
  isEnabled1: boolean;
  timeframe1: string;
  upperColor1: string;
  lowerColor1: string;
  width1: number;
  isEnabled2: boolean;
  timeframe2: string;
  upperColor2: string;
  lowerColor2: string;
  width2: number;
  isEnabled3: boolean;
  timeframe3: string;
  upperColor3: string;
  lowerColor3: string;
  width3: number;
  isEnabled4: boolean;
  timeframe4: string;
  upperColor4: string;
  lowerColor4: string;
  width4: number;
  isEnabled5: boolean;
  timeframe5: string;
  upperColor5: string;
  lowerColor5: string;
  width5: number;
  /** Colour of the purged levels */
  purgedColor: string;
  /** Line style of the purged levels */
  purgedStyle: 'Solid' | 'Dashed' | 'Dotted';
  /** Timeframe whose new periods delete the purged levels */
  purgeTimeframe: string;
}

export const defaultInputs: HtfLiquidityLevelsInputs = {
  isEnabled1: true,
  timeframe1: 'M',
  upperColor1: 'rgba(135, 254, 7, 0.1)',
  lowerColor1: 'rgba(255, 152, 0, 0.1)',
  width1: 10,
  isEnabled2: true,
  timeframe2: 'W',
  upperColor2: 'rgba(0, 230, 118, 0.3)',
  lowerColor2: 'rgba(255, 82, 82, 0.3)',
  width2: 5,
  isEnabled3: true,
  timeframe3: 'D',
  upperColor3: 'rgba(76, 175, 80, 0.3)',
  lowerColor3: 'rgba(242, 54, 69, 0.3)',
  width3: 2,
  isEnabled4: false,
  timeframe4: '240',
  upperColor4: 'rgba(0, 151, 167, 0.3)',
  lowerColor4: 'rgba(123, 31, 162, 0.3)',
  width4: 1,
  isEnabled5: false,
  timeframe5: '60',
  upperColor5: 'rgba(0, 96, 100, 0.3)',
  lowerColor5: 'rgba(74, 20, 140, 0.3)',
  width5: 1,
  purgedColor: 'rgba(120, 123, 134, 0.3)',
  purgedStyle: 'Dashed',
  purgeTimeframe: 'D',
};

const G1 = 'Liquidity Levels';
const G2 = 'Purged Levels';
const levelInputs = (k: 1 | 2 | 3 | 4 | 5): InputConfig[] => {
  const d = defaultInputs as unknown as Record<string, string | number | boolean>;
  const inline = `Level${k}`;
  return [
    { id: `isEnabled${k}`, type: 'bool', title: '', defval: d[`isEnabled${k}`], inline, group: G1 },
    { id: `timeframe${k}`, type: 'timeframe', title: '', defval: d[`timeframe${k}`], inline, group: G1 },
    { id: `upperColor${k}`, type: 'color', title: '', defval: d[`upperColor${k}`], inline, group: G1 },
    { id: `lowerColor${k}`, type: 'color', title: '', defval: d[`lowerColor${k}`], inline, group: G1 },
    { id: `width${k}`, type: 'int', title: 'Width', defval: d[`width${k}`], inline, group: G1, display: 'none' },
  ];
};

export const inputConfig: InputConfig[] = [
  ...levelInputs(1),
  ...levelInputs(2),
  ...levelInputs(3),
  ...levelInputs(4),
  ...levelInputs(5),
  { id: 'purgedColor', type: 'color', title: 'Color', defval: defaultInputs.purgedColor, group: G2 },
  { id: 'purgedStyle', type: 'string', title: 'Style', defval: 'Dashed', options: ['Solid', 'Dashed', 'Dotted'], group: G2, display: 'none' },
  {
    id: 'purgeTimeframe', type: 'timeframe', title: 'Removal', defval: 'D', group: G2, display: 'none',
    tooltip: 'Clear all the purged levels on a new timeframe rotation.',
  },
];

export const plotConfig: PlotConfig[] = [];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Purging Up', message: '{{ticker}} Purging Up Liquidity' },
  { id: 'alert1', title: 'Purging Down', message: '{{ticker}} Purging Down Liquidity' },
  { id: 'alert2', title: 'Purging', message: '{{ticker}} Purging Liquidity' },
];

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'HTF Liquidity Levels',
  shortTitle: 'HTF Liquidity',
  overlay: true,
};

const LINE_OFFSET_START = 0;
const LINE_OFFSET_END = 25;
const MAX_LINES = 500;
const EPS = 1e-10;

/** A liquidity level: its price and its line */
interface Level {
  price: number;
  line: Line;
}

/**
 * request.security(tickerid, tf, [high[1], low[1]], lookahead = on): the high and low of the previous period of `tf`
 * on each chart bar (na on the first period of the bars). `tf` equal to the chart timeframe: the chart bar before.
 */
function previousHighLow(bars: Bar[], tf: string, chart?: ChartContext): { high: number[]; low: number[] } {
  const chartTf = chartTimeframe(bars, chart);
  if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) {
    return {
      high: bars.map((_b, i) => (i > 0 ? bars[i - 1].high : NaN)),
      low: bars.map((_b, i) => (i > 0 ? bars[i - 1].low : NaN)),
    };
  }
  const { htf, group } = higherTimeframeBars(bars, tf, chart);
  return {
    high: group.map((g) => (g > 0 ? htf[g - 1].high : NaN)),
    low: group.map((g) => (g > 0 ? htf[g - 1].low : NaN)),
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HtfLiquidityLevelsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const d = cfg as unknown as Record<string, string | number | boolean>;
  const chartSeconds = n > 0 ? timeframe.in_seconds(chartTimeframe(bars, chart) || 'D') : 0;

  // levels 5, 4, 3, 2, 1 in that order (the order of the original's creations)
  const levels = ([5, 4, 3, 2, 1] as const).map((k) => {
    const tf = String(d[`timeframe${k}`]);
    // f_isHigherTimeframe(tf): timeframe.in_seconds(tf) >= timeframe.in_seconds()
    const used = Boolean(d[`isEnabled${k}`]) && n > 0 && timeframe.in_seconds(tf) >= chartSeconds;
    return {
      used,
      changes: used ? periodChanges(bars, tf, chart) : [],
      prev: used ? previousHighLow(bars, tf, chart) : { high: [], low: [] },
      upper: String(d[`upperColor${k}`]),
      lower: String(d[`lowerColor${k}`]),
      width: Number(d[`width${k}`]),
    };
  });
  const purgeChanges = n > 0 ? periodChanges(bars, cfg.purgeTimeframe, chart) : [];
  const purgedStyle = cfg.purgedStyle === 'Solid' ? 'solid' : cfg.purgedStyle === 'Dotted' ? 'dotted' : 'dashed';

  resetDrawings({ line: MAX_LINES });
  const highsArray: Level[] = [];
  const lowsArray: Level[] = [];
  const purgedArray: Level[] = [];
  const upFlags: boolean[] = [];
  const downFlags: boolean[] = [];
  const anyFlags: boolean[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    // f_createLevels on a new period of each enabled timeframe
    for (const lv of levels) {
      if (!lv.used || !lv.changes[i]) continue;
      const h = lv.prev.high[i];
      const l = lv.prev.low[i];
      highsArray.push({ price: h, line: line.new(i, h, i, h, 'bar_index', 'none', lv.upper, 'solid', lv.width) });
      lowsArray.push({ price: l, line: line.new(i, l, i, l, 'bar_index', 'none', lv.lower, 'solid', lv.width) });
    }
    // barstate.islast: the levels float at the right of the last bar
    if (i === n - 1) {
      for (const arr of [highsArray, lowsArray, purgedArray]) {
        for (const level of arr) {
          line.set_x1(level.line, i + LINE_OFFSET_START);
          line.set_x2(level.line, i + LINE_OFFSET_END);
        }
      }
    }
    // updateLevels: a high above an upper level / a low below a lower level purges it (na compares false)
    const update = (arr: Level[], isUpper: boolean): boolean => {
      let purged = false;
      for (let k = arr.length - 1; k >= 0; k--) {
        const level = arr[k];
        if (isUpper ? b.high - level.price > EPS : level.price - b.low > EPS) {
          line.set_color(level.line, cfg.purgedColor);
          line.set_style(level.line, purgedStyle);
          purgedArray.push(arr.splice(k, 1)[0]);
          purged = true;
        }
      }
      return purged;
    };
    const up = update(highsArray, true);
    const down = update(lowsArray, false);
    upFlags.push(up);
    downFlags.push(down);
    anyFlags.push(up || down);
    // clearLevels on a new period of the removal timeframe
    if (purgeChanges[i]) {
      for (let k = purgedArray.length - 1; k >= 0; k--) line.delete(purgedArray.splice(k, 1)[0].line);
    }
  }
  setDrawingBar(null);

  const ms = n > 0 && bars[0].time >= 1e12;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
    alerts: alertStates(alertConditions, bars, [upFlags, downFlags, anyFlags]),
  };
}

export const HtfLiquidityLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, drawingKinds };
