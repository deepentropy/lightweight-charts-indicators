/**
 * Directional Movement Index + ADX + Ploted KEYLEVEL
 *
 * Wilder's directional movement: +DM = change(high) when it is above -change(low) and positive, else 0 (also 0 on
 * the first bar), -DM likewise; +DI / -DI = fixnan(100 * RMA(DM, DI Length) / RMA(TR, DI Length)) and
 * ADX = 100 * RMA(|+DI - -DI| / (+DI + -DI, 1 when 0), ADX Smoothing). Draws ADX, +DI, -DI and the key level
 * (a constant plot, 23 by default).
 *
 * Reference: "Directional Movement Index + ADX + Ploted KEYLEVEL" by console
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DMIADXInputs {
  /** ADX smoothing (RMA length of the DX) */
  adxLen: number;
  /** DI length */
  diLen: number;
  /** Key level plotted for the ADX */
  keyLevel: number;
}

export const defaultInputs: DMIADXInputs = {
  adxLen: 14,
  diLen: 14,
  keyLevel: 23,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14 },
  { id: 'keyLevel', type: 'int', title: 'key level for ADX', defval: 23 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#FF0000', lineWidth: 1 },
  { id: 'plot1', title: '+DI', color: '#0000FF', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#808080', lineWidth: 1 },
  { id: 'plot3', title: 'Key Level', color: '#FFFFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'Directional Movement Index + ADX + Ploted KEYLEVEL',
  shortTitle: 'DMI/ADX/KEYLEVEL',
  overlay: false,
};

interface Point { time: number; value: number }

interface DmiRun extends BarRunState<{ lastPlus: number; lastMinus: number }> {
  tr: ReturnType<typeof taStep.tr>;
  truerange: ReturnType<typeof taStep.rma>;
  rp: ReturnType<typeof taStep.rma>;
  rm: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  plots: Point[][];
}

function study(inputs: Partial<DMIADXInputs>): BarStudy<DmiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: DmiRun = {
        tr: taStep.tr(), truerange: taStep.rma(cfg.diLen), rp: taStep.rma(cfg.diLen), rm: taStep.rma(cfg.diLen),
        adx: taStep.rma(cfg.adxLen), plots: [[], [], [], []],
        steps: [], vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.steps = [s.tr, s.truerange, s.rp, s.rm, s.adx];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // dirmov(len): up = change(high), down = -change(low); a comparison with na is false, so DM = 0 on bar 0
      const up = i > 0 ? b.high - bars[i - 1].high : NaN;
      const down = i > 0 ? -(b.low - bars[i - 1].low) : NaN;
      const plusDM = up > down && up > 0 ? up : 0;
      const minusDM = down > up && down > 0 ? down : 0;
      // truerange = rma(tr, len): tr is na on bar 0
      const truerange = s.truerange.step(s.tr.step(b.high, b.low, b.close));
      const rp = s.rp.step(plusDM);
      const rm = s.rm.step(minusDM);
      // fixnan(100 * rma(dm, len) / truerange): a plain division (x / 0 is +-infinity, 0 / 0 is na)
      const p0 = (100 * rp) / truerange;
      const m0 = (100 * rm) / truerange;
      const plus = isNaN(p0) ? v.lastPlus : (v.lastPlus = p0);
      const minus = isNaN(m0) ? v.lastMinus : (v.lastMinus = m0);
      // adx = 100 * rma(abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen)
      const sum = plus + minus;
      const adx = 100 * s.adx.step(Math.abs(plus - minus) / (sum === 0 ? 1 : sum));
      const t = b.time as number;
      s.plots[0][i] = { time: t, value: adx };
      s.plots[1][i] = { time: t, value: plus };
      s.plots[2][i] = { time: t, value: minus };
      s.plots[3][i] = { time: t, value: cfg.keyLevel };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DMIADXInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DMIADXInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DMIADX = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
