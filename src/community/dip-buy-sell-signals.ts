/**
 * Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD)
 *
 * Three conditions:
 * 1. CM Williams Vix Fix: wvf = (highest(close, pd) - low) / highest(close, pd) * 100 is at or above its upper
 *    Bollinger band (sma + mult * stdev over bbl bars) or at or above ph times its highest value over lb bars.
 * 2. Deviation from a moving average (type and length as inputs): (close - ma) / ma * 100 below -percent (buy) or
 *    above +percent (sell).
 * 3. TRMAD: (close - MA(close)) / MA(true range), 0 when not finite, below the buy level (buy) or above the sell
 *    level (sell).
 * Buy = 1 and 2 (buy) and 3 (buy); sell = 1 and 2 (sell) and 3 (sell). A label below the bar marks a buy signal.
 * The bar colour, the background colour and the sell label have display.none in Pine: they are not drawn.
 *
 * Reference: "Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD)" by DotGain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DotGain
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type DipDevMaType = 'ema' | 'sma' | 'rma' | 'vwma' | 'wma' | 'tema';
export type DipTrmadMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface DipBuySellSignalsInputs {
  pd: number;
  bbl: number;
  mult: number;
  lb: number;
  ph: number;
  pl: number;
  matDev: DipDevMaType;
  lenDev: number;
  percentDev: number;
  trTypeInputTrmad: DipTrmadMaType;
  trLengthInputTrmad: number;
  maTypeInputTrmad: DipTrmadMaType;
  maLengthInputTrmad: number;
  trmadLevelBuy: number;
  trmadLevelSell: number;
}

export const defaultInputs: DipBuySellSignalsInputs = {
  pd: 22,
  bbl: 20,
  mult: 2.0,
  lb: 50,
  ph: 0.85,
  pl: 1.01,
  matDev: 'ema',
  lenDev: 200,
  percentDev: 10,
  trTypeInputTrmad: 'SMA',
  trLengthInputTrmad: 14,
  maTypeInputTrmad: 'SMA',
  maLengthInputTrmad: 20,
  trmadLevelBuy: -3.0,
  trmadLevelSell: 3.0,
};

const GROUP_VIX = 'CM Williams Vix Fix';
const GROUP_DEV = 'Deviation from MA';
const GROUP_TRMAD = 'TRMAD';
const TRMAD_TYPES: DipTrmadMaType[] = ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'];

export const inputConfig: InputConfig[] = [
  { id: 'pd', type: 'int', title: 'LookBack Period Standard Deviation High', defval: 22, group: GROUP_VIX },
  { id: 'bbl', type: 'int', title: 'Bolinger Band Length', defval: 20, group: GROUP_VIX },
  { id: 'mult', type: 'float', title: 'Bollinger Band Standard Deviation Up', defval: 2.0, min: 1, max: 5, group: GROUP_VIX },
  { id: 'lb', type: 'int', title: 'Look Back Period Percentile High', defval: 50, group: GROUP_VIX },
  { id: 'ph', type: 'float', title: 'Highest Percentile', defval: 0.85, group: GROUP_VIX },
  { id: 'pl', type: 'float', title: 'Lowest Percentile', defval: 1.01, group: GROUP_VIX },
  { id: 'matDev', type: 'string', title: 'Moving Average Type', defval: 'ema',
    options: ['ema', 'sma', 'rma', 'vwma', 'wma', 'tema'], group: GROUP_DEV },
  { id: 'lenDev', type: 'int', title: 'Length of MA', defval: 200, group: GROUP_DEV },
  { id: 'percentDev', type: 'float', title: 'Deviation Percent', defval: 10, group: GROUP_DEV },
  { id: 'trTypeInputTrmad', type: 'string', title: 'TR Type', defval: 'SMA', options: TRMAD_TYPES, group: GROUP_TRMAD },
  { id: 'trLengthInputTrmad', type: 'int', title: 'TR Length', defval: 14, min: 2, group: GROUP_TRMAD },
  { id: 'maTypeInputTrmad', type: 'string', title: 'MA Type', defval: 'SMA', options: TRMAD_TYPES, group: GROUP_TRMAD },
  { id: 'maLengthInputTrmad', type: 'int', title: 'MA Length', defval: 20, min: 2, group: GROUP_TRMAD },
  { id: 'trmadLevelBuy', type: 'float', title: 'TRMAD Buy Level', defval: -3.0, step: 0.1, group: GROUP_TRMAD },
  { id: 'trmadLevelSell', type: 'float', title: 'TRMAD Sell Level', defval: 3.0, step: 0.1, group: GROUP_TRMAD },
];

// No plot(): a plotshape marker only (barcolor, bgcolor and the sell plotshape have display.none)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD)',
  shortTitle: 'DipSig',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Ma = { step(v: number, volume: number): number; commit(): void };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

/** One moving average stepped bar by bar */
function maStep(kind: 'ema' | 'rma' | 'vwma' | 'wma' | 'sma', p: number): Ma {
  switch (kind) {
    case 'ema': { const m = taStep.ema(p); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'rma': { const m = taStep.rma(p); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'vwma': return new WindowVwma(p);
    case 'wma': { const m = taStep.wma(); return { step: (v) => m.step(v, p), commit: () => m.commit() }; }
    default: { const m = new WindowSma(p); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  }
}

// f_ma_dev(t, s, p)
function maDev(t: string, p: number): Ma {
  if (t === 'tema') {
    // f_tema_dev(s, p): 3 * ema1 - 3 * ema2 + ema3
    const e1 = taStep.ema(p);
    const e2 = taStep.ema(p);
    const e3 = taStep.ema(p);
    return {
      step: (v) => {
        const a = e1.step(v) ?? NaN;
        const b = e2.step(a) ?? NaN;
        const c = e3.step(b) ?? NaN;
        return 3 * a - 3 * b + c;
      },
      commit: () => { e1.commit(); e2.commit(); e3.commit(); },
    };
  }
  return maStep(t === 'ema' || t === 'rma' || t === 'vwma' || t === 'wma' ? t : 'sma', p);
}

// f_ma_trmad(source, length, type)
function maTrmad(length: number, type: string): Ma {
  switch (type) {
    case 'EMA': return maStep('ema', length);
    case 'SMMA (RMA)': return maStep('rma', length);
    case 'WMA': return maStep('wma', length);
    case 'VWMA': return maStep('vwma', length);
    default: return maStep('sma', length);
  }
}

interface DipRun extends BarRunState<Record<string, never>> {
  hiClose: WindowExtreme;
  sd: WindowStdev;
  mid: WindowSma;
  hiWvf: WindowExtreme;
  ma1Dev: Ma;
  tr: ReturnType<typeof taStep.tr>;
  atrTrmad: Ma;
  maClose: Ma;
  markers: MarkerData[];
}

function study(inputs: Partial<DipBuySellSignalsInputs>): BarStudy<DipRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyColor = String(color.new(color.green, 60));
  return {
    init() {
      // 1. CM Williams Vix Fix
      const hiClose = new WindowExtreme(false, cfg.pd);
      const sd = new WindowStdev(cfg.bbl);
      const mid = new WindowSma(cfg.bbl);
      const hiWvf = new WindowExtreme(false, cfg.lb);
      // 2. Deviation from MA
      const ma1Dev = maDev(cfg.matDev, cfg.lenDev);
      // 3. TRMAD
      const tr = taStep.tr(true);
      const atrTrmad = maTrmad(cfg.trLengthInputTrmad, cfg.trTypeInputTrmad);
      const maClose = maTrmad(cfg.maLengthInputTrmad, cfg.maTypeInputTrmad);
      const s: DipRun = {
        hiClose, sd, mid, hiWvf, ma1Dev, tr, atrTrmad, maClose, markers: [],
        steps: [hiClose, sd, mid, hiWvf, ma1Dev, tr, atrTrmad, maClose], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const vol = b.volume ?? NaN;
      const hiClose = s.hiClose.step(close);
      const wvf = (hiClose - b.low) / hiClose * 100;
      const sd = s.sd.step(wvf);
      const midLine = s.mid.step(wvf);
      const hiWvf = s.hiWvf.step(wvf);
      const ma1Dev = s.ma1Dev.step(close, vol) ?? NaN;
      const atrTrmad = s.atrTrmad.step(s.tr.step(b.high, b.low, close), vol) ?? NaN;
      const maClose = s.maClose.step(close, vol) ?? NaN;

      const sDev = cfg.mult * sd;
      const upperBand = midLine + sDev;
      const rangeHigh = hiWvf * cfg.ph;
      const cond1VixLime = ge(wvf, upperBand) || ge(wvf, rangeHigh);

      // Plain division: x / 0 is +-infinity, 0 / 0 is na
      const defVal = (close - ma1Dev) / ma1Dev * 100;
      const cond2DevBuy = lt(defVal, -cfg.percentDev);
      const cond2DevSell = gt(defVal, cfg.percentDev);

      const distanceTrmad = close - maClose;
      const ratio = distanceTrmad / atrTrmad;
      // nz(): na and +-infinity give 0
      const trmadVal = Number.isFinite(ratio) ? ratio : 0;
      const cond3TrmadBuy = lt(trmadVal, cfg.trmadLevelBuy);
      const cond3TrmadSell = gt(trmadVal, cfg.trmadLevelSell);

      const buySignal = cond1VixLime && cond2DevBuy && cond3TrmadBuy;
      const sellSignal = cond1VixLime && cond2DevSell && cond3TrmadSell;

      // barcolor(buy ? green : sell ? red : na, display.none) and bgcolor(buy ? green 85 : sell ? red 85 : na,
      // display.none): not drawn
      // plotshape(buySignal, 'Buy', shape.labelup, location.belowbar, color.new(color.green, 60), size.small)
      if (buySignal) s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyColor, size: 'small' });
      // plotshape(sellSignal, 'Sell', shape.labeldown, location.abovebar, color.new(color.red, 60), size.small,
      // display.none): not drawn
      void sellSignal;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DipBuySellSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DipBuySellSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const DipBuySellSignals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
