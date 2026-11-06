/**
 * RSI + ADX + ATR Combo
 *
 * RSI of the source, an ADX built from the directional movements (RMA of +DM, -DM and the true range, DX, then the
 * RMA of DX) and the ATR, in one pane. The background is fuchsia when the RSI is between the two bounds, the ADX is
 * under its threshold and the ATR is under its threshold (a quiet, range-bound market).
 * Alert (alertcondition, `alerts` of the result): 'All Conditions Met', true on the bars of that condition.
 *
 * Reference: "RSI + ADX + ATR Combo" by shawasutosh
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiAdxAtrComboInputs {
  rsiLen: number;
  rsiSource: SourceType;
  rsiLower: number;
  rsiUpper: number;
  adxLen: number;
  adxThreshold: number;
  atrLen: number;
  atrThreshold: number;
}

export const defaultInputs: RsiAdxAtrComboInputs = {
  rsiLen: 14,
  rsiSource: 'close',
  rsiLower: 40,
  rsiUpper: 60,
  adxLen: 14,
  adxThreshold: 20,
  atrLen: 14,
  atrThreshold: 2.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'rsiLower', type: 'int', title: 'RSI Lower Bound', defval: 40 },
  { id: 'rsiUpper', type: 'int', title: 'RSI Upper Bound', defval: 60 },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrThreshold', type: 'float', title: 'ATR Threshold', defval: 2.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'ADX', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'ATR', color: color.purple, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI + ADX + ATR Combo',
  shortTitle: 'RSI_ADX_ATR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };

interface ComboRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  tr: ReturnType<typeof taStep.tr>;
  atrADX: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  atr: ReturnType<typeof taStep.atr>;
  plots: Point[][];
  flags: boolean[];
  times: number[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RsiAdxAtrComboInputs>): BarStudy<ComboRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const src = barSource(cfg.rsiSource);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const signal = String(color.new(color.fuchsia, 85));
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.rsiLen);
      const tr = taStep.tr(false);
      const atrADX = taStep.rma(cfg.adxLen);
      const plusRma = taStep.rma(cfg.adxLen);
      const minusRma = taStep.rma(cfg.adxLen);
      const adx = taStep.rma(cfg.adxLen);
      const atr = taStep.atr(cfg.atrLen);
      const s: ComboRun = {
        rsi, tr, atrADX, plusRma, minusRma, adx, atr, plots: [[], [], []], flags: [], times: [], bgColors: [],
        steps: [rsi, tr, atrADX, plusRma, minusRma, adx, atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.times, s.bgColors];
      s.series = [...s.plots, s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const rsi = s.rsi.step(src(b));
      // upMove = high - high[1]; downMove = low[1] - low (na on the first bar: both DM are 0)
      const up = i > 0 ? b.high - bars[i - 1].high : NaN;
      const down = i > 0 ? bars[i - 1].low - b.low : NaN;
      const plusDM = gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = gt(down, up) && gt(down, 0) ? down : 0;
      // tr = ta.tr (the variable: na on the first bar)
      const atrADX = s.atrADX.step(s.tr.step(b.high, b.low, b.close));
      const plusRma = s.plusRma.step(plusDM);
      const minusRma = s.minusRma.step(minusDM);
      // Plain divisions: x / 0 is +-infinity, 0 / 0 is na; ta.rma skips the non-finite values like na
      const plusDI = (100 * plusRma) / atrADX;
      const minusDI = (100 * minusRma) / atrADX;
      const dx = (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
      const adx = s.adx.step(dx);
      const atr = s.atr.step(b.high, b.low, b.close);

      const rsiCond = gt(rsi, cfg.rsiLower) && lt(rsi, cfg.rsiUpper);
      const adxCond = lt(adx, cfg.adxThreshold);
      const atrCond = lt(atr, cfg.atrThreshold);
      // bgcolor(comboSignal ? color.new(color.fuchsia, 85) : na)
      const comboSignal = rsiCond && adxCond && atrCond;
      s.flags[i] = comboSignal;
      if (comboSignal) {
        s.bgColors.push({ time: b.time, color: signal });
        s.times.push(b.time as number);
      }
      s.plots[0][i] = { time: b.time, value: fin(rsi) };
      s.plots[1][i] = { time: b.time, value: fin(adx) };
      s.plots[2][i] = { time: b.time, value: fin(atr) };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [
          { value: cfg.rsiLower, options: { title: 'RSI Lower', color: color.green, linestyle: 'dashed' } },
          { value: cfg.rsiUpper, options: { title: 'RSI Upper', color: color.red, linestyle: 'dashed' } },
          { value: cfg.adxThreshold, options: { title: 'ADX Threshold', color: color.gray, linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        // alertcondition(comboSignal, "All Conditions Met")
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiAdxAtrComboInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiAdxAtrComboInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'All Conditions Met', message: 'RSI, ADX, and ATR conditions are all satisfied.' },
];

export const RsiAdxAtrCombo = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
