/**
 * Renko Candles Overlay
 *
 * Builds Renko bricks from the closes and draws the latest ones over the chart.
 * - Brick size: a fixed value ('Traditional'), the ATR rounded to a "nice" number ('ATR', 'ATR/2', 'ATR/4') or a
 *   percentage of the close ('Percentage'). The size in use only changes when new bricks are added.
 * - A list keeps the close of each brick. When the close moves away from the last brick by one size or more, bricks
 *   are added in the direction of the trend; two sizes or more against the trend reverse it.
 * - On the last bar the bricks are drawn as boxes, each "Width" bars wide, ending on the last bar. Drawing starts at
 *   the oldest brick that continues the direction of the brick before it.
 * - "Levels & Lines for new Bricks": two lines extended both ways and two labels 10 bars after the last bar, at the
 *   prices where the next brick up and the next brick down would form.
 * - "Change Bar Color": colours the bars by the Renko trend.
 * - When the last bar receives live updates, the bricks added on it are drawn in the 'Unconfirmed' colour.
 * Alerts (alertcondition, `alerts` of the result): 'Trend is UP' / 'Trend is DOWN', true on the bars on which the
 * Renko trend turns from down to up / from up to down.
 *
 * Chart values (third argument): the port reads the symbol tick (rounding and minimum of the brick size; without
 * it: 0.01) and whether the last bar receives live updates (`realtime`; without it: a calculation on history).
 *
 * Reference: "Renko Candles Overlay" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { taStep, str, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BoxData, LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { mintickOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RenkoCandlesOverlayInputs {
  /** Brick size method */
  mode: 'Traditional' | 'ATR' | 'ATR/2' | 'ATR/4' | 'Percentage';
  /** ATR period */
  modevalue: number;
  /** Brick size of the 'Traditional' method */
  tboxsize: number;
  /** Percentage of the 'Percentage' method */
  percentagebs: number;
  /** Number of bricks kept */
  period: number;
  /** Levels and lines for the next bricks */
  putlabels: boolean;
  linestyle: 'dashed' | 'dotted' | 'solid';
  colup: string;
  coldn: string;
  coluc: string;
  /** Brick width in bars */
  bwidth: number;
  bcolup: string;
  bcoldn: string;
  borderwidth: number;
  /** Change Bar Color */
  changebrol: boolean;
  barcolup: string;
  barcoldn: string;
}

export const defaultInputs: RenkoCandlesOverlayInputs = {
  mode: 'ATR/2',
  modevalue: 14,
  tboxsize: 10,
  percentagebs: 0.1,
  period: 140,
  putlabels: true,
  linestyle: 'dashed',
  colup: '#5b9cf6',
  coldn: '#0c3299',
  coluc: '#787B86',
  bwidth: 2,
  bcolup: '#00E676',
  bcoldn: '#FF5252',
  borderwidth: 1,
  changebrol: false,
  barcolup: '#00E676',
  barcoldn: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Method', defval: 'ATR/2', options: ['Traditional', 'ATR', 'ATR/2', 'ATR/4', 'Percentage'], group: 'SETUP' },
  { id: 'modevalue', type: 'int', title: ' Atr Period', defval: 14, min: 1, group: 'SETUP' },
  { id: 'tboxsize', type: 'float', title: ' Brick Size', defval: 10, min: 0.000000000000001, group: 'SETUP' },
  { id: 'percentagebs', type: 'float', title: ' Percentage %', defval: 0.1, min: 0.00001, step: 0.1, group: 'SETUP' },
  { id: 'period', type: 'int', title: ' Number of Bricks', defval: 140, min: 10, max: 280, group: 'SETUP' },
  { id: 'putlabels', type: 'bool', title: 'Levels & Lines for new Bricks', defval: true, inline: 'labels' },
  { id: 'linestyle', type: 'string', title: '', defval: 'dashed', options: ['dashed', 'dotted', 'solid'], inline: 'labels' },
  { id: 'colup', type: 'color', title: ' Color Up', defval: '#5b9cf6', group: 'BRICKS' },
  { id: 'coldn', type: 'color', title: ' Color Down', defval: '#0c3299', group: 'BRICKS' },
  { id: 'coluc', type: 'color', title: ' Unconfirmed', defval: '#787B86', group: 'BRICKS' },
  { id: 'bwidth', type: 'int', title: ' Width', defval: 2, min: 1, max: 10, group: 'BRICKS' },
  { id: 'bcolup', type: 'color', title: ' Color Up', defval: '#00E676', group: 'BORDERS' },
  { id: 'bcoldn', type: 'color', title: ' Color Down', defval: '#FF5252', group: 'BORDERS' },
  { id: 'borderwidth', type: 'int', title: ' Width', defval: 1, min: 0, max: 2, group: 'BORDERS' },
  { id: 'changebrol', type: 'bool', title: 'Change Bar Color', defval: false, group: 'CANDLES' },
  { id: 'barcolup', type: 'color', title: ' Color Up', defval: '#00E676', group: 'CANDLES' },
  { id: 'barcoldn', type: 'color', title: ' Color Down', defval: '#FF5252', group: 'CANDLES' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Renko Candles Overlay',
  shortTitle: 'Renko Candles Overlay',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

/** color.gray (lines) and the label text colours color.black / color.white of Pine v5 */
const GRAY = '#787B86';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';

type Result = IndicatorResult & { barColors: BarColorData[]; boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[] }
  & { alerts: AlertConditionState[] };

interface RenkoVars {
  /** The brick size in use */
  boxs: number;
  trend: number;
  /** The closes of the bricks, newest first (changed in place, copied by copyVars) */
  rclose: number[];
}

interface RenkoRun extends BarRunState<RenkoVars> {
  mintick: number;
  num: number;
  atr: ReturnType<typeof taStep.atr> | null;
  tr: ReturnType<typeof taStep.tr>;
  /** The bricks added on the last bar calculated (the 'Unconfirmed' count when it receives live updates), else -1 */
  lastUnconfirmed: number;
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RenkoCandlesOverlayInputs>): BarStudy<RenkoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const mode = cfg.mode;
  const period = Math.trunc(cfg.period);
  const bwidth = Math.trunc(cfg.bwidth);
  const pineMax = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));

  const getBSize = (value: number, tr: number, num: number, mintick: number): number => {
    let ret = value;
    if (ret === null || ret === undefined || Number.isNaN(ret)) ret = tr ?? NaN;
    if (lt(ret, 1)) {
      ret = math.round(ret * num) / num;
    } else if (!Number.isNaN(ret)) {
      const pw = ge(ret, 10) ? Math.pow(10, Math.max(str.tostring(ret).split('.')[0].length - 2, 1)) : 1;
      ret = math.round(ret / pw) * pw;
    }
    return Number.isNaN(ret) ? NaN : Math.max(ret, mintick);
  };
  const addbricks = (rclose: number[], numbrick: number, start: number, bsize: number) => {
    // for x = 1 to numbrick (counts down when numbrick < 1)
    if (numbrick >= 1) for (let x = 1; x <= numbrick; x++) rclose.unshift(start + x * bsize);
    else for (let x = 1; x >= numbrick; x--) rclose.unshift(start + x * bsize);
  };

  return {
    init(_bars, chart) {
      const mintick = mintickOf(chart);
      const atr = mode === 'ATR' || mode === 'ATR/2' || mode === 'ATR/4' ? taStep.atr(Math.trunc(cfg.modevalue)) : null;
      const tr = taStep.tr(true);
      const s: RenkoRun = {
        mintick,
        // get_b_size(): var num = math.pow(10, str.length(str.tostring(syminfo.mintick)) - 2)
        num: Math.pow(10, str.tostring(mintick).length - 2),
        atr, tr, lastUnconfirmed: -1, barColors: [], flags: [[], []], times: [[], []],
        steps: [...(atr ? [atr] : []), tr], vars: { boxs: NaN, trend: 0, rclose: [] }, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    copyVars: (v) => ({ boxs: v.boxs, trend: v.trend, rclose: v.rclose.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const { mintick, num } = s;
      const n = bars.length;
      const b = bars[i];
      const atr = s.atr ? s.atr.step(b.high, b.low, b.close) : NaN;
      const tr = s.tr.step(b.high, b.low, b.close);
      let boxsize: number;
      switch (mode) {
        case 'ATR': boxsize = getBSize(atr ?? NaN, tr, num, mintick); break;
        case 'ATR/2': boxsize = pineMax(getBSize(atr ?? NaN, tr, num, mintick) / 2, mintick); break;
        case 'ATR/4': boxsize = pineMax(getBSize(atr ?? NaN, tr, num, mintick) / 4, mintick); break;
        case 'Percentage': boxsize = getBSize((cfg.percentagebs * b.close) / 100, tr, num, mintick); break;
        default: boxsize = cfg.tboxsize;
      }

      const rclose = v.rclose;
      if (i === 0) {
        v.boxs = boxsize;
        rclose.push(Math.floor(b.open / v.boxs) * v.boxs);
      }
      const currentprice = b.close;
      const lastclose = rclose[0];
      const numcell = Math.floor(Math.abs(lastclose - currentprice) / v.boxs);
      const prevTrend = v.trend;
      let unconfirmed = -1;

      if (numcell > 0) {
        if (v.trend === 0) {
          if (numcell >= 2) {
            v.trend = lt(lastclose, currentprice) ? 1 : -1;
            addbricks(rclose, numcell, lastclose, v.trend * v.boxs);
          }
        } else if (lt(lastclose * v.trend, currentprice * v.trend)) {
          addbricks(rclose, numcell, lastclose, v.trend * v.boxs);
        } else if (numcell >= 2) {
          v.trend *= -1;
          addbricks(rclose, numcell - 1, lastclose + v.trend * v.boxs, v.trend * v.boxs);
        }
        // change boxsize when trend changed
        if (ne(lastclose, rclose[0])) {
          v.boxs = boxsize;
          // not barstate.ishistory and barstate.isrealtime (the chart's realtime flag is read in result)
          if (i === n - 1) unconfirmed = numcell - (v.trend !== prevTrend ? 1 : 0);
        }
      }
      if (i === n - 1) s.lastUnconfirmed = unconfirmed;
      // delete old elements
      while (rclose.length > period + 3) rclose.pop();

      // alertcondition(trend[1] == -1 and trend == 1) / alertcondition(trend[1] == 1 and trend == -1)
      const trend = v.trend;
      const up = i > 0 && prevTrend === -1 && trend === 1;
      const down = i > 0 && prevTrend === 1 && trend === -1;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(b.time as number);
      if (down) s.times[1].push(b.time as number);

      if (cfg.changebrol) s.barColors.push({ time: b.time as number, color: trend === 1 ? cfg.barcolup : cfg.barcoldn });
    },
    // the drawings of the last bar, from the bricks at its end
    result(s, bars, chart) {
      const n = bars.length;
      const { boxs, trend, rclose } = s.vars;
      // barstate.isrealtime: the last bar receives live updates
      const live = chart?.realtime === true;
      const unconfirmed = live && n > 0 ? s.lastUnconfirmed : -1;
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      const last = n - 1;
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      const boxes: BoxData[] = [];

      if (n > 0 && cfg.putlabels && trend !== 0) {
        const up = trend === 1 ? rclose[0] + boxs : rclose[0] + boxs * 2;
        const dn = trend === 1 ? rclose[0] - boxs * 2 : rclose[0] - boxs;
        for (const y of [up, dn]) {
          lines.push({
            time1: T(last), price1: y, time2: T(last - 1), price2: y, color: GRAY, extend: 'both',
            ...(cfg.linestyle === 'solid' ? {} : { style: cfg.linestyle }),
          });
        }
        labels.push({ time: T(last + 10), price: up, text: str.tostring(up), color: cfg.colup, textColor: BLACK, style: 'label_down' });
        labels.push({ time: T(last + 10), price: dn, text: str.tostring(dn), color: cfg.coldn, textColor: WHITE, style: 'label_up' });
      }

      // barstate.islast
      if (n > 0 && rclose.length >= 2) {
        const R = (x: number): number => {
          if (x < 0 || x >= rclose.length) throw new Error(`Index ${x} is out of bounds, array size is ${rclose.length}`);
          return rclose[x];
        };
        let start = rclose.length - 3;
        for (let x = rclose.length - 3; x >= 0; x--) {
          if ((gt(R(x), R(x + 1)) && gt(R(x + 1), R(x + 2))) || (lt(R(x), R(x + 1)) && lt(R(x + 1), R(x + 2)))) {
            start = x;
            break;
          }
        }
        let colnum = (start + 1) * bwidth;
        let trnd = gt(R(start), R(start + 1)) ? 1 : -1;
        let lasttb = R(start);
        for (let x = start + 1; x >= 0; x--) {
          const oldtrnd = trnd;
          trnd = gt(R(x), R(x + 1)) ? 1 : -1;
          const col = x < unconfirmed ? cfg.coluc : trnd === 1 ? cfg.colup : cfg.coldn;
          const bcol = trnd === 1 ? cfg.bcolup : cfg.bcoldn;
          const topbottom = oldtrnd === trnd ? R(x + 1) : lasttb;
          if (last - colnum - bwidth > 1 && colnum < 285) {
            boxes.push({
              time1: T(last - colnum), price1: R(x), time2: T(last - colnum - bwidth), price2: topbottom,
              borderWidth: Math.trunc(cfg.borderwidth), borderColor: bcol, bgColor: col,
            });
          }
          colnum -= bwidth;
          lasttb = topbottom;
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        barColors: s.barColors.slice(),
        boxes,
        labels,
        lines,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoCandlesOverlayInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RenkoCandlesOverlayInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Trend is UP', message: 'Trend is UP' },
  { id: 'alert1', title: 'Trend is DOWN', message: 'Trend is DOWN' },
];

export const RenkoCandlesOverlay = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
