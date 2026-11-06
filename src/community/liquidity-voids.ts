/**
 * Liquidity Voids (FVG) [LuxAlgo]
 *
 * A liquidity void is a three-bar gap that is wider than a part of the average true range (144 bars, times the
 * threshold): a bullish one when the low is above the high of two bars back and the close of the bar between is above
 * that high too, a bearish one when the high is below the low of two bars back and the close between is below that
 * low. Each void is drawn as 13 thin boxes stacked over the gap, from two bars back to the next bar. When the bar
 * before was a void of the same side, the 13 boxes cover the move of the low (bullish) or of the high (bearish)
 * since that bar.
 *
 * On every bar the open boxes run one bar further. A box that the bar range enters is filled: it stops there and
 * takes the "filled" colour (or is deleted when the filled voids are hidden). The text of a box takes the chart
 * foreground colour once the box is more than 21 bars old. The script follows at most 500 open boxes (the oldest one
 * stops when there are more) and the chart keeps at most 500 boxes.
 *
 * "Present" mode only looks for voids on the last "# Bars" bars.
 *
 * Reference: "Liquidity Voids (FVG) [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { type ChartContext, foregroundColorOf } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LiquidityVoidsInputs {
  mode: 'Present' | 'Historical';
  /** Bars looked at in "Present" mode */
  back: number;
  /** Minimum width of a void, in average true ranges (0: no filter) */
  lqTH: number;
  lqBC: string;
  lqSC: string;
  /** Text "Liquidity Void" in the first box of a void */
  lqTX: boolean;
  /** Keep the filled voids on the chart */
  lqVF: boolean;
  lqFC: string;
}

export const defaultInputs: LiquidityVoidsInputs = {
  mode: 'Historical',
  back: 360,
  lqTH: 0.5,
  lqBC: 'rgba(8, 153, 129, 0.27)',
  lqSC: 'rgba(242, 54, 69, 0.27)',
  lqTX: false,
  lqVF: true,
  lqFC: 'rgba(120, 123, 134, 0.27)',
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Mode', defval: 'Historical', options: ['Present', 'Historical'], inline: 'MOD' },
  {
    id: 'back', type: 'int', title: ' # Bars', defval: 360, min: 100, max: 5000, step: 10, inline: 'MOD',
    tooltip: "The mode option controls the number of visual objects presented, where\n\n- Historical, takes into account all data available to the user\n- Present, takes into account only the last X bars specified in the '# Bars' option",
  },
  {
    id: 'lqTH', type: 'float', title: 'Liquidity Voids Threshold', defval: 0.5, min: 0, step: 0.1, group: 'Liquidity Detection',
    tooltip: 'Act as a filter while detecting the Liquidity Voids. When set to 0 means no filtering is applied, increasing the value causes the script to check the width of the void compared to a fixed-length ATR value',
  },
  { id: 'lqBC', type: 'color', title: 'Bullish', defval: 'rgba(8, 153, 129, 0.27)', inline: 'VD', group: 'Liquidity Detection' },
  { id: 'lqSC', type: 'color', title: 'Bearish', defval: 'rgba(242, 54, 69, 0.27)', inline: 'VD', group: 'Liquidity Detection' },
  { id: 'lqTX', type: 'bool', title: 'Label', defval: false, inline: 'VD', group: 'Liquidity Detection' },
  {
    id: 'lqVF', type: 'bool', title: 'Filled Liquidity Voids', defval: true, inline: 'FL', group: 'Liquidity Detection',
    tooltip: 'Toggles the visibility of the Filled Liquidity Voids',
  },
  { id: 'lqFC', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.27)', inline: 'FL', group: 'Liquidity Detection' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Voids (FVG) [LuxAlgo]',
  shortTitle: 'LuxAlgo - Liquidity Voids (FVG)',
  overlay: true,
};

/** indicator(max_boxes_count = 500) */
const MAX_BOXES = 500;
/** Boxes of one void */
const SLICES = 13;
const VOID_TEXT = 'Liquidity Void   ';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

interface Bx {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bg: string;
  text: string;
  valign: 'top' | 'bottom' | null;
  /** null: the default text colour of a box (black) */
  textColor: string | null;
  deleted: boolean;
}

type Result = Omit<IndicatorResult, 'boxes'> & { boxes: BoxData[] };

interface LiquidityVoidsVars {
  /**
   * Boxes alive on the chart in creation order: when a creation brings the count above max + 5, the oldest are
   * deleted until max remain. A deleted box ignores later changes and its getters give na.
   */
  alive: Bx[];
  /** var lqV: the open boxes */
  lqV: Bx[];
  /** `bull` / `bear` are local to `if per`: their value of the bar before is na when the block did not run */
  prevBull: boolean;
  prevBear: boolean;
}

interface LiquidityVoidsRun extends BarRunState<LiquidityVoidsVars> {
  atr: ReturnType<typeof taStep.atr>;
}

function study(inputs: Partial<LiquidityVoidsInputs>): BarStudy<LiquidityVoidsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let fgColor = foregroundColorOf(undefined);
  return {
    // "Present" mode looks for voids on the last "# Bars" bars: the bars looked at follow the bar count
    key: (bars) => (cfg.mode === 'Present' ? `n${bars.length}` : ''),
    init(_bars, chart) {
      fgColor = foregroundColorOf(chart);
      const atr = taStep.atr(144);
      return { atr, steps: [atr], vars: { alive: [], lqV: [], prevBull: false, prevBear: false }, lists: [], series: [] };
    },
    bar(s, i, bars) {
      const n = bars.length;
      const v = s.vars;
      const { alive, lqV } = v;
      const b = bars[i];
      const atr = (s.atr.step(b.high, b.low, b.close) ?? NaN) * cfg.lqTH;
      const newBox = (left: number, top: number, right: number, bottom: number, bg: string, text = '', valign: Bx['valign'] = null) => {
        const nb: Bx = { left, top, right, bottom, bg, text, valign, textColor: text ? 'transparent' : null, deleted: false };
        alive.push(nb);
        if (alive.length > MAX_BOXES + 5) for (const old of alive.splice(0, alive.length - MAX_BOXES)) old.deleted = true;
        lqV.push(nb);
      };

      const per = cfg.mode === 'Present' ? n - 1 - i <= cfg.back : true;
      let bull = false;
      let bear = false;
      if (per) {
        const h2 = i >= 2 ? bars[i - 2].high : NaN;
        const l2 = i >= 2 ? bars[i - 2].low : NaN;
        const c1 = i >= 1 ? bars[i - 1].close : NaN;
        bull = gt(b.low - h2, atr) && gt(b.low, h2) && gt(c1, h2);
        if (bull) {
          if (v.prevBull) {
            const l1 = bars[i - 1].low;
            const st = Math.abs(b.low - l1) / SLICES;
            for (let k = 0; k < SLICES; k++) newBox(i - 2, l1 + (k + 1) * st, i, l1 + k * st, cfg.lqBC);
          } else {
            const st = Math.abs(b.low - h2) / SLICES;
            for (let k = 0; k < SLICES; k++) {
              if (cfg.lqTX && k === 0) newBox(i - 2, h2 + (k + 1) * st, i, h2 + k * st, cfg.lqBC, VOID_TEXT, 'bottom');
              else newBox(i - 2, h2 + (k + 1) * st, i, h2 + k * st, cfg.lqBC);
            }
          }
        }
        bear = gt(l2 - b.high, atr) && lt(b.high, l2) && lt(c1, l2);
        if (bear) {
          const st = v.prevBear ? Math.abs(bars[i - 1].high - b.high) / SLICES : Math.abs(l2 - b.high) / SLICES;
          for (let k = 0; k < SLICES; k++) {
            if (!v.prevBear && cfg.lqTX && k === SLICES - 1) newBox(i - 2, b.high + (k + 1) * st, i, b.high + k * st, cfg.lqSC, VOID_TEXT, 'top');
            else newBox(i - 2, b.high + (k + 1) * st, i, b.high + k * st, cfg.lqSC);
          }
        }
      }
      v.prevBull = bull;
      v.prevBear = bear;

      if (lqV.length > 0) {
        for (let bn = lqV.length - 1; bn >= 0; bn--) {
          if (bn >= lqV.length) continue;
          const cb = lqV[bn];
          const tBX = cb.deleted ? NaN : cb.top;
          const bBX = cb.deleted ? NaN : cb.bottom;
          if (gt(b.high, bBX) && lt(b.low, tBX)) {
            if (cfg.lqVF) {
              cb.bg = cfg.lqFC;
            } else {
              cb.deleted = true;
              alive.splice(alive.indexOf(cb), 1);
            }
            lqV.splice(bn, 1);
          } else if (!cb.deleted) {
            cb.right = i + 1;
            if (i - cb.left > 21) cb.textColor = fgColor;
          }
        }
        if (lqV.length > 500) lqV.shift();
      }
    },
    // the boxes and the open list pointing at them: one clone keeps the shared objects shared
    copyVars: (v) => structuredClone(v),
    result(s, bars) {
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        boxes: s.vars.alive.map((b) => ({
          time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, bgColor: b.bg, borderColor: 'transparent',
          ...(b.text ? { text: b.text, textSize: 'tiny' as const, textHAlign: 'right' as const, textVAlign: b.valign! } : {}),
          ...(b.textColor !== null ? { textColor: b.textColor } : {}),
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidityVoidsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityVoidsInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'boxes'> & { boxes: BoxData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const LiquidityVoids = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
