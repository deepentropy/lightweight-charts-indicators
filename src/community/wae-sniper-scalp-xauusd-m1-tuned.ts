/**
 * WAE Sniper Scalp XAUUSD M1 (Tuned)
 *
 * A Waddah Attar Explosion variant. t1 = (MACD - MACD[1]) * sensitivity, with MACD = EMA(fast) - EMA(slow) of the
 * close; trend up = t1 when t1 > 0 (else 0), trend down = -t1 when t1 < 0 (else 0), drawn as columns. The explosion
 * line is the Bollinger band width (2 * mult * stdev) and the dead zone is the RMA of the true range * ATR mult.
 * A buy signal: trend up above the dead zone and the explosion line, rising, with the close above the trend EMA; a
 * sell signal: the same for trend down with the close below the trend EMA. A signal is drawn only when the previous
 * bar was not locked in the same direction (the lock is set by a signal and cleared by an opposite signal).
 *
 * Reference: "WAE Sniper Scalp – XAUUSD M1 (Tuned)" by khonthailoei19071983
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WaeSniperScalpXauusdM1TunedInputs {
  sensitivity: number;
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** Bollinger band length */
  channelLength: number;
  /** Bollinger band multiplier */
  mult: number;
  /** Trend EMA filter length */
  emaFilterLen: number;
  /** ATR dead zone length */
  atrLength: number;
  /** ATR dead zone multiplier */
  atrMult: number;
}

export const defaultInputs: WaeSniperScalpXauusdM1TunedInputs = {
  sensitivity: 150,
  fastLength: 12,
  slowLength: 26,
  channelLength: 20,
  mult: 2.0,
  emaFilterLen: 200,
  atrLength: 14,
  atrMult: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 150 },
  { id: 'fastLength', type: 'int', title: 'Fast EMA', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA', defval: 26 },
  { id: 'channelLength', type: 'int', title: 'BB Length', defval: 20 },
  { id: 'mult', type: 'float', title: 'BB Mult', defval: 2.0 },
  { id: 'emaFilterLen', type: 'int', title: 'Trend EMA Filter', defval: 200 },
  { id: 'atrLength', type: 'int', title: 'ATR DeadZone Len', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR DeadZone Mult', defval: 1.5 },
];

const UP_COL = String(color.new(color.green, 40));
const DOWN_COL = String(color.new(color.red, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: UP_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Trend', color: DOWN_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Explosion Line (BB)', color: color.orange, lineWidth: 2 },
  { id: 'plot3', title: 'DeadZone (ATR)', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'WAE Sniper Scalp – XAUUSD M1 (Tuned)',
  shortTitle: 'WAE Sniper Scalp – XAUUSD M1 (Tuned)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface WaeVars {
  /** var bool buyLock = false, var bool sellLock = false */
  buyLock: boolean;
  sellLock: boolean;
  prevMacd: number;
}

interface WaeRun extends BarRunState<WaeVars> {
  emaFast: ReturnType<typeof taStep.ema>;
  emaSlow: ReturnType<typeof taStep.ema>;
  basis: WindowSma;
  sd: WindowStdev;
  tr: ReturnType<typeof taStep.tr>;
  rmaTr: ReturnType<typeof taStep.rma>;
  emaFilter: ReturnType<typeof taStep.ema>;
  trendUp: number[];
  trendDown: number[];
  plots: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<WaeSniperScalpXauusdM1TunedInputs>): BarStudy<WaeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: WaeRun = {
        emaFast: taStep.ema(cfg.fastLength), emaSlow: taStep.ema(cfg.slowLength), basis: new WindowSma(cfg.channelLength),
        sd: new WindowStdev(cfg.channelLength), tr: taStep.tr(true), rmaTr: taStep.rma(cfg.atrLength),
        emaFilter: taStep.ema(cfg.emaFilterLen), trendUp: [], trendDown: [], plots: [[], [], [], []], markers: [],
        steps: [], vars: { buyLock: false, sellLock: false, prevMacd: NaN }, lists: [], series: [],
      };
      s.steps = [s.emaFast, s.emaSlow, s.basis, s.sd, s.tr, s.rmaTr, s.emaFilter];
      s.lists = [s.markers];
      s.series = [s.trendUp, s.trendDown, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const c = b.close;
      const emaFast = s.emaFast.step(c);
      const emaSlow = s.emaSlow.step(c);
      const basis = s.basis.step(c);
      const sd = s.sd.step(c);
      const rmaTr = s.rmaTr.step(s.tr.step(b.high, b.low, b.close));
      const emaFilter = s.emaFilter.step(c);

      const macd = emaFast - emaSlow;
      const t1 = (macd - v.prevMacd) * cfg.sensitivity;
      v.prevMacd = macd;
      const dev = cfg.mult * sd;
      const bbWidth = basis + dev - (basis - dev);
      const deadZone = rmaTr * cfg.atrMult;
      const trendUp = gt(t1, 0) ? t1 : 0;
      const trendDown = gt(0, t1) ? -t1 : 0;
      s.trendUp[i] = trendUp;
      s.trendDown[i] = trendDown;

      const buySignal = gt(trendUp, deadZone) && gt(trendUp, bbWidth) && gt(c, emaFilter)
        && i > 0 && gt(trendUp, s.trendUp[i - 1]);
      const sellSignal = gt(trendDown, deadZone) && gt(trendDown, bbWidth) && gt(emaFilter, c)
        && i > 0 && gt(trendDown, s.trendDown[i - 1]);

      // plotshape(buySignal and not buyLock[1], ...): buyLock[1] is the lock before this bar's updates
      const prevBuyLock = v.buyLock;
      const prevSellLock = v.sellLock;
      if (buySignal) {
        v.buyLock = true;
        v.sellLock = false;
      }
      if (sellSignal) {
        v.sellLock = true;
        v.buyLock = false;
      }
      if (buySignal && !prevBuyLock) {
        s.markers.push({ time: b.time, position: 'bottom', shape: 'triangleUp', color: color.green, size: 'tiny' });
      }
      if (sellSignal && !prevSellLock) {
        s.markers.push({ time: b.time, position: 'top', shape: 'triangleDown', color: color.red, size: 'tiny' });
      }

      s.plots[0][i] = { time: b.time, value: trendUp, color: UP_COL };
      s.plots[1][i] = { time: b.time, value: trendDown, color: DOWN_COL };
      s.plots[2][i] = { time: b.time, value: bbWidth, color: color.orange };
      s.plots[3][i] = { time: b.time, value: deadZone, color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WaeSniperScalpXauusdM1TunedInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WaeSniperScalpXauusdM1TunedInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const WaeSniperScalpXauusdM1Tuned = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
