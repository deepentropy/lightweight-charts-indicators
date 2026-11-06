/**
 * Gridbot Ping Pong
 *
 * A grid of 5 levels (base price +- 1 and 2 spacings, the spacing a percent of the base price) simulates a grid bot.
 * The base line can tilt in the direction of the last grid shift (tilt factor). Buy / sell signals come when the
 * trigger source crosses a grid level (or touches it, "Wick Touch"); a signal at the same level as the last signal
 * is not repeated, counter-trend signals become take profits of an open position, and a flat position only trades
 * with the trend at the inner levels. When a bar closes beyond the outer level plus an anchor buffer, the grid shifts
 * one level in that direction (an adverse position is stopped). The grid lines are hidden on the bar after a shift
 * change; a symmetrically weighted MA (SWMA) is drawn with gradient fills to the outer levels.
 * Alerts (alertcondition, `alerts` of the result): Buy, Sell, Buy TP, Sell TP, Buy Stop and Sell Stop, on the bars of
 * each signal.
 *
 * Reference: "Gridbot Ping Pong" by xxattaxx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type GridbotTrigger = 'Auto' | 'Wick Touch' | 'Wick Reverse' | 'SWMA' | 'Close';

export interface GridbotPingPongInputs {
  /** Price data that generates the signals */
  trigger: GridbotTrigger;
  /** Percentage spacing between grid levels */
  intervals: number;
  /** Grid slope factor (positive tilts with the trend, negative against it) */
  tilt: number;
  /** Shift resistance factor */
  anchor: number;
  /** Support grid colour */
  supportCol: string;
  /** Resistance grid colour */
  resistCol: string;
  /** Upper fill colour (at the upper grid) */
  colUpperTop: string;
  /** Lower fill colour (at the lower grid) */
  colLowerTop: string;
  /** SWMA colour */
  colSWMA: string;
}

export const defaultInputs: GridbotPingPongInputs = {
  trigger: 'Auto',
  intervals: 1.0,
  tilt: 1.0,
  anchor: 1.0,
  // color.new(c, 75) as an input default: alpha 0.25
  supportCol: 'rgba(76, 175, 80, 0.25)',
  resistCol: 'rgba(255, 0, 0, 0.25)',
  colUpperTop: 'rgba(178, 34, 34, 0.25)',
  colLowerTop: 'rgba(34, 139, 34, 0.25)',
  colSWMA: 'rgba(0, 0, 255, 0.25)',
};

export const inputConfig: InputConfig[] = [
  { id: 'trigger', type: 'string', title: 'Trigger', defval: 'Auto', options: ['Auto', 'Wick Touch', 'Wick Reverse', 'SWMA', 'Close'] },
  { id: 'intervals', type: 'float', title: 'Spacing(%)', defval: 1.0, step: 0.25 },
  { id: 'tilt', type: 'float', title: 'Tilt Factor', defval: 1.0, step: 1.0 },
  { id: 'anchor', type: 'float', title: 'Anchor Strength', defval: 1.0, step: 1.0, min: 0 },
  { id: 'supportCol', type: 'color', title: 'Grids (support)', defval: 'rgba(76, 175, 80, 0.25)' },
  { id: 'resistCol', type: 'color', title: 'Grids (resistance)', defval: 'rgba(255, 0, 0, 0.25)' },
  { id: 'colUpperTop', type: 'color', title: 'Fill (upper)', defval: 'rgba(178, 34, 34, 0.25)' },
  { id: 'colLowerTop', type: 'color', title: 'Fill (lower)', defval: 'rgba(34, 139, 34, 0.25)' },
  { id: 'colSWMA', type: 'color', title: 'SWMA', defval: 'rgba(0, 0, 255, 0.25)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price0', color: 'rgba(76, 175, 80, 0.25)', lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Price1', color: 'rgba(76, 175, 80, 0.25)', lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Price2', color: 'rgba(76, 175, 80, 0.25)', lineWidth: 3, style: 'circles' },
  { id: 'plot3', title: 'Price3', color: 'rgba(255, 0, 0, 0.25)', lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Price4', color: 'rgba(255, 0, 0, 0.25)', lineWidth: 2, style: 'linebr' },
  { id: 'plot5', title: 'SWMA', color: 'rgba(0, 0, 255, 0.25)', lineWidth: 4 },
];

export const metadata = {
  title: 'Gridbot Ping Pong',
  shortTitle: 'Gridbot Ping Pong',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface GridVars {
  bPrice: number; // var B_Price = close
  bIndex: number; // var int B_Index = bar_index
  slope: number;
  intercept: number;
  shiftCount: number;
  anchorUp: number;
  anchorDown: number;
  LSI: number;
  P: number;
  prevShift: number; // Shift[1] (na on the first bar)
  prevBuySource: number; // BuySource[1]
  prevSellSource: number; // SellSource[1]
}

interface GridRun extends BarRunState<GridVars> {
  plots: Point[][];
  /** fill0 / fill1: top value, bottom value, top colour, bottom colour per bar */
  fill0: [number[], number[], (string | null)[], (string | null)[]];
  fill1: [number[], number[], (string | null)[], (string | null)[]];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<GridbotPingPongInputs>): BarStudy<GridRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const trigger = cfg.trigger;
  const colUpperBot = String(color.new(cfg.colUpperTop, 88));
  const colLowerBot = String(color.new(cfg.colLowerTop, 88));
  const buyCol = String(color.new('#32CD32', 0));
  const sellCol = String(color.new('#EE4B2B', 0));
  const GI = cfg.intervals / 100;
  return {
    init() {
      const s: GridRun = {
        plots: [[], [], [], [], [], []],
        fill0: [[], [], [], []],
        fill1: [[], [], [], []],
        markers: [],
        // Buy, Sell, BuyTP, SellTP, BuyStop, SellStop per bar (the alertcondition() order)
        flags: [[], [], [], [], [], []],
        times: [[], [], [], [], [], []],
        steps: [],
        vars: {
          bPrice: NaN, bIndex: 0, slope: 0, intercept: NaN, shiftCount: 0, anchorUp: 0, anchorDown: 0, LSI: 2, P: 0,
          prevShift: NaN, prevBuySource: NaN, prevSellSource: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, ...s.fill0, ...s.fill1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const t = bar.time as number;
      if (i === 0) v.bPrice = bar.close;
      // ta.swma(close): (close + 2 * close[1] + 2 * close[2] + close[3]) / 6
      const SWMA = i < 3 ? NaN : (bar.close + 2 * bars[i - 1].close + 2 * bars[i - 2].close + bars[i - 3].close) / 6;
      let shift = 0; // int Shift = 0
      let buy = false;
      let sell = false;
      let buyTP = false;
      let sellTP = false;
      let buyStop = false;
      let sellStop = false;
      const dir = v.shiftCount >= 0 ? 1 : -1;
      const g2Color = dir === 1 ? cfg.supportCol : cfg.resistCol;
      const colorArray = [cfg.supportCol, cfg.supportCol, g2Color, cfg.resistCol, cfg.resistCol];
      const bPrice = v.bPrice;

      // Grid calculations
      let basePrice: number;
      if (Math.abs(cfg.tilt - 0) > EPS) { // Tilt != 0
        const normTilt = (cfg.tilt * GI * bPrice) / 10000;
        v.slope = normTilt * dir;
        v.intercept = bPrice - v.slope * v.bIndex;
        basePrice = v.slope * i + v.intercept;
      } else {
        basePrice = bPrice;
      }
      const grid = [
        basePrice - GI * 2 * bPrice,
        basePrice - GI * 1 * bPrice,
        basePrice,
        basePrice + GI * 1 * bPrice,
        basePrice + GI * 2 * bPrice,
      ];

      const buySource = trigger === 'Wick Touch' || trigger === 'Wick Reverse' ? bar.low
        : trigger === 'SWMA' ? SWMA
          : trigger === 'Auto' ? (dir === 1 ? bar.low : bar.close)
            : bar.close;
      const sellSource = trigger === 'Wick Touch' || trigger === 'Wick Reverse' ? bar.high
        : trigger === 'SWMA' ? SWMA
          : trigger === 'Auto' ? (dir === -1 ? bar.high : bar.close)
            : bar.close;

      // Signal detection
      const RMB = array.binary_search_rightmost(grid, buySource);
      const LMS = array.binary_search_leftmost(grid, sellSource);
      let buyIndex = -1;
      let sellIndex = -1;
      const LSI0 = v.LSI;
      if (trigger === 'Wick Touch') {
        buyIndex = RMB < LSI0 ? RMB : buyIndex;
        sellIndex = LMS > LSI0 ? LMS : sellIndex;
      } else {
        for (let k = 0; k <= 4; k++) {
          const value = grid[k];
          if (le(buySource, value) && gt(v.prevBuySource, value) && buyIndex === -1) {
            buyIndex = k;
            break;
          }
        }
        for (let k = 4; k >= 0; k--) {
          const value = grid[k];
          if (ge(sellSource, value) && lt(v.prevSellSource, value) && sellIndex === -1) {
            sellIndex = k;
            break;
          }
        }
      }

      // Signal filtering
      const P0 = v.P;
      const shiftCount0 = v.shiftCount;
      buy = buyIndex >= 0;
      sell = sellIndex >= 0;
      buy = buyIndex >= LSI0 ? false : buy;
      sell = sellIndex <= LSI0 ? false : sell;
      if (buy && sell) {
        buy = dir > 0;
        sell = !(dir > 0);
      }
      if (sell && dir > 0) {
        sellTP = P0 > 0;
        sell = false;
      }
      if (buy && dir < 0) {
        buyTP = P0 < 0;
        buy = false;
      }
      if (P0 === 0) {
        buy = buy && dir > 0;
        sell = sell && dir < 0;
      }
      // Shift != Shift[1]: Shift is still 0 here (false on the first bar, Shift[1] na)
      if (!isNaN(v.prevShift) && shift !== v.prevShift) {
        buy = false;
        sell = false;
        buyTP = false;
        sellTP = false;
        buyStop = shiftCount0 >= 1 && P0 < 0;
        sellStop = shiftCount0 <= -1 && P0 > 0;
      }
      if (sellIndex >= 4) sell = false;
      if (buyIndex <= 0) buy = false;
      if (P0 === 0 && buyIndex >= 3) buy = false;
      if (P0 === 0 && sellIndex <= 1) sell = false;
      buyTP = P0 >= 0 ? false : buyTP;
      sellTP = P0 <= 0 ? false : sellTP;
      buyStop = P0 >= 0 ? false : buyStop;
      sellStop = P0 <= 0 ? false : sellStop;

      // Grid shifting (historical bars are confirmed)
      const normAnchor = (cfg.anchor * GI * bPrice) / 100;
      v.anchorUp = v.shiftCount > 1 ? normAnchor / Math.max(Math.abs(v.shiftCount), 1) : normAnchor;
      v.anchorDown = v.shiftCount < -1 ? normAnchor / Math.max(Math.abs(v.shiftCount), 1) : normAnchor;
      if (gt(bar.low, grid[4] + v.anchorUp)) {
        v.bPrice = grid[3] + v.anchorUp;
        v.bIndex = i;
        v.shiftCount = v.shiftCount >= 0 ? v.shiftCount + 1 : 1;
        shift = 1;
      }
      if (lt(bar.high, grid[0] - v.anchorDown)) {
        v.bPrice = grid[1] - v.anchorDown;
        v.bIndex = i;
        v.shiftCount = v.shiftCount <= 0 ? v.shiftCount - 1 : -1;
        shift = -1;
      }

      // Plots: grid lines hidden when Shift != Shift[1]
      const plt = !isNaN(v.prevShift) && shift === v.prevShift;
      for (let k = 0; k < 5; k++) {
        const p: Point = { time: t, value: plt ? grid[k] : NaN };
        if (plt) p.color = colorArray[k];
        s.plots[k]![i] = p;
      }
      s.plots[5]![i] = { time: t, value: SWMA, color: cfg.colSWMA };
      // fill(maLine, p0, SWMA, Price0, colLowerBot, colLowerTop); fill(maLine, p4, SWMA, Price4, colUpperBot, colUpperTop)
      s.fill0[0][i] = SWMA;
      s.fill0[1][i] = grid[0];
      s.fill0[2][i] = colLowerBot;
      s.fill0[3][i] = cfg.colLowerTop;
      s.fill1[0][i] = SWMA;
      s.fill1[1][i] = grid[4];
      s.fill1[2][i] = colUpperBot;
      s.fill1[3][i] = cfg.colUpperTop;

      // plotchar signals: size.tiny, location.belowbar (buy) / abovebar (sell)
      const char = (on: boolean, below: boolean, text: string) => {
        if (on) {
          s.markers.push({ time: t, position: below ? 'belowBar' : 'aboveBar', shape: 'circle', color: 'transparent',
            text, textColor: below ? buyCol : sellCol, size: 'tiny' });
        }
      };
      char(buy, true, '▲');
      char(sell, false, '▼');
      char(buyTP, true, '△');
      char(sellTP, false, '▽');
      char(buyStop, true, '⦿');
      char(sellStop, false, '⦿');
      const f = s.flags;
      f[0]![i] = buy;
      f[1]![i] = sell;
      f[2]![i] = buyTP;
      f[3]![i] = sellTP;
      f[4]![i] = buyStop;
      f[5]![i] = sellStop;
      for (let k = 0; k < 6; k++) if (f[k]![i]) s.times[k]!.push(t);

      // Position tracking
      if (buy) v.P = v.P > 0 ? v.P + 1 : 1;
      else if (sell) v.P = v.P < 0 ? v.P - 1 : -1;
      else if (buyTP || sellTP || buyStop || sellStop) v.P = 0;

      let LSI = v.LSI;
      const P = v.P;
      LSI = buy ? buyIndex : sell ? sellIndex : LSI;
      LSI = buyTP ? buyIndex : sellTP ? sellIndex : LSI;
      LSI = buyStop ? 4 : sellStop ? 0 : LSI;
      if (P === 0 && LMS > LSI) LSI = LMS;
      if (P === 0 && RMB < LSI) LSI = RMB;
      if (P !== 0 && LMS === 4) LSI = 4;
      if (P !== 0 && RMB === 0) LSI = 0;
      if (shift === 1 && P > 0) LSI = 0;
      else if (shift === 1 && P < 0) LSI = 4;
      else if (shift === -1 && P > 0) LSI = 0;
      else if (shift === -1 && P < 0) LSI = 4;
      if (!isNaN(v.prevShift) && shift !== v.prevShift && P === 0 && Math.abs(v.shiftCount) === 1) LSI = 2;
      v.LSI = LSI;

      v.prevShift = shift;
      v.prevBuySource = buySource;
      v.prevSellSource = sellSource;
    },
    result(s, bars) {
      const n = bars.length;
      const gradient = (f: GridRun['fill0']) => ({
        topValue: f[0].slice(), bottomValue: f[1].slice(), topColor: f[2].slice(), bottomColor: f[3].slice(),
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        fills: [
          { plot1: 'plot5', plot2: 'plot0', options: { title: 'Lower Fill' }, gradient: gradient(s.fill0) },
          { plot1: 'plot5', plot2: 'plot4', options: { title: 'Upper Fill' }, gradient: gradient(s.fill1) },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GridbotPingPongInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GridbotPingPongInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy', message: 'Buy' },
  { id: 'alert1', title: 'Sell', message: 'Sell' },
  { id: 'alert2', title: 'Buy TP', message: 'Buy TP' },
  { id: 'alert3', title: 'Sell TP', message: 'Sell TP' },
  { id: 'alert4', title: 'Buy Stop', message: 'Buy Stop' },
  { id: 'alert5', title: 'Sell Stop', message: 'Sell Stop' },
];

export const GridbotPingPong = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
