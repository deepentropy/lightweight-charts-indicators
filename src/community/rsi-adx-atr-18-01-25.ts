/**
 * RSI + ADX + ATR 18-01-25
 *
 * RSI of the source (RMA of the gains and of the losses), a simple ADX (SMA of |+DM - -DM| / (+DM + -DM) * 100,
 * with +DM / -DM the RMA of the positive high change and of the positive negated low change) and the ATR, in one
 * pane. The background is red when the RSI is between the two bounds, the ADX is under its threshold and the ATR is
 * under its threshold.
 * Alert (alertcondition, `alerts` of the result): 'RSI, ADX, and ATR Condition Met', true on the bars of that condition.
 *
 * Reference: "RSI + ADX + ATR 15-01" by dipak11298
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiAdxAtr180125Inputs {
  rsiLength: number;
  rsiSource: SourceType;
  /** RSI lower bound of the background condition */
  rsiLowerBound: number;
  /** RSI upper bound of the background condition */
  rsiUpperBound: number;
  adxLength: number;
  adxThreshold: number;
  atrLength: number;
  atrThreshold: number;
}

export const defaultInputs: RsiAdxAtr180125Inputs = {
  rsiLength: 14,
  rsiSource: 'close',
  rsiLowerBound: 40,
  rsiUpperBound: 60,
  adxLength: 14,
  adxThreshold: 20,
  atrLength: 14,
  atrThreshold: 2.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'rsiLowerBound', type: 'int', title: 'RSI Lower Bound for BG Color', defval: 40, min: 0, max: 100 },
  { id: 'rsiUpperBound', type: 'int', title: 'RSI Upper Bound for BG Color', defval: 60, min: 0, max: 100 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrThreshold', type: 'float', title: 'ATR Threshold', defval: 2.5 },
];

const ADX_COLOR = String(color.rgb(234, 255, 2));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'ADX', color: ADX_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'ATR', color: color.purple, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI + ADX + ATR 15-01',
  shortTitle: 'RSI + ADX + ATR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface RaaRun extends BarRunState<Record<string, never>> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  plusDI: ReturnType<typeof taStep.rma>;
  minusDI: ReturnType<typeof taStep.rma>;
  adx: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[];
  times: number[];
}

function study(inputs: Partial<RsiAdxAtr180125Inputs>): BarStudy<RaaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSource);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const bg = String(color.rgb(255, 59, 59, 73));
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const up = taStep.rma(cfg.rsiLength);
      const down = taStep.rma(cfg.rsiLength);
      const plusDI = taStep.rma(cfg.adxLength);
      const minusDI = taStep.rma(cfg.adxLength);
      const adx = new WindowSma(cfg.adxLength);
      const atr = taStep.atr(cfg.atrLength);
      const s: RaaRun = {
        up, down, plusDI, minusDI, adx, atr, plots: [[], [], []], bgColors: [], flags: [], times: [],
        steps: [up, down, plusDI, minusDI, adx, atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.times];
      s.series = [...s.plots, s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // change = ta.change(src); math.max(na, 0) is na
      const change = i > 0 ? value(b) - value(bars[i - 1]) : NaN;
      const gain = isNaN(change) ? NaN : Math.max(change, 0);
      const loss = isNaN(change) ? NaN : -Math.min(change, 0);
      const chHigh = i > 0 ? b.high - bars[i - 1].high : NaN;
      const chLow = i > 0 ? b.low - bars[i - 1].low : NaN;
      const hiUp = isNaN(chHigh) ? NaN : Math.max(chHigh, 0);
      const loDown = isNaN(chLow) ? NaN : Math.max(-chLow, 0);
      const up = s.up.step(gain);
      const down = s.down.step(loss);
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);

      const plusDI = s.plusDI.step(hiUp);
      const minusDI = s.minusDI.step(loDown);
      // Plain division: 0 / 0 is na, ta.sma skips it as Pine
      const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
      const adx = s.adx.step(dx);
      const atr = s.atr.step(b.high, b.low, b.close);

      // bgcolor((rsi > lower and rsi < upper) and adx < adxThreshold and atr < atrThreshold ? color.rgb(255, 59, 59, 73) : na)
      const cond = gt(rsi, cfg.rsiLowerBound) && lt(rsi, cfg.rsiUpperBound) && lt(adx, cfg.adxThreshold)
        && lt(atr, cfg.atrThreshold);
      s.flags[i] = cond;
      if (cond) {
        s.bgColors.push({ time: b.time, color: bg });
        s.times.push(b.time as number);
      }
      s.plots[0]![i] = { time: b.time, value: fin(rsi) };
      s.plots[1]![i] = { time: b.time, value: fin(adx) };
      s.plots[2]![i] = { time: b.time, value: fin(atr) };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0]!.slice(), plot1: s.plots[1]!.slice(), plot2: s.plots[2]!.slice() },
        hlines: [
          { value: cfg.rsiUpperBound, options: { title: 'RSI Upper Bound (Dynamic)', color: color.red, linestyle: 'dashed' } },
          { value: cfg.rsiLowerBound, options: { title: 'RSI Lower Bound (Dynamic)', color: color.green, linestyle: 'dashed' } },
          { value: cfg.adxThreshold, options: { title: 'ADX Threshold', color: color.gray, linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        // alertcondition(the background condition, "RSI, ADX, and ATR Condition Met")
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]!]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiAdxAtr180125Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiAdxAtr180125Inputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0',
    title: 'RSI, ADX, and ATR Condition Met',
    message: 'RSI is between custom bounds, ADX is below the threshold, and ATR is below the threshold.',
  },
];

export const RsiAdxAtr180125 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
