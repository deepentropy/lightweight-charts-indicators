/**
 * Candle Spread Oscillator (CS0)
 *
 * The candle body as a share of the bar range, spread = (close - open) / (high - low), smoothed with a Hull moving
 * average. The area line and the background take a gradient colour from fuchsia (-0.1 and below) to aqua
 * (0.2 and above). Midline at 0.
 * Alerts (alertcondition, `alerts` of the result): 'Cross Up' / 'Cross Down' when the oscillator crosses above /
 * below the midline.
 *
 * Reference: "Candle Spread Oscillator (CS0)" by RWCS_LTD
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RWCS_LTD
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CandleSpreadOscillatorInputs {
  /** Smoothing period of the HMA */
  lookbackPeriod: number;
}

export const defaultInputs: CandleSpreadOscillatorInputs = {
  lookbackPeriod: 500,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Smoothing Period', defval: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Candle Spread Oscillator', color: String(color.new(color.aqua, 50)), lineWidth: 2, style: 'areabr' },
];

export const metadata = {
  title: 'Candle Spread Oscillator (CS0)',
  shortTitle: 'Candle Spread Oscillator (CS0)',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface CsoRun extends BarRunState<Record<string, never>> {
  hma: ReturnType<typeof taStep.hma>;
  smoothed: number[];
  plot0: Point[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CandleSpreadOscillatorInputs>): BarStudy<CsoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bottom = String(color.new(color.fuchsia, 50));
  const top = String(color.new(color.aqua, 50));
  return {
    init() {
      // ta.hma(x, 1) is a Pine runtime error (wma length 0)
      if (cfg.lookbackPeriod === 1) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function");
      const hma = taStep.hma(cfg.lookbackPeriod);
      const s: CsoRun = {
        hma, smoothed: [], plot0: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [hma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.smoothed, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // spread = (close - open) / (high - low): a plain division (x / 0 is +-infinity, 0 / 0 na); ta.hma skips them
      const v = s.hma.step((b.close - b.open) / (b.high - b.low));
      s.smoothed[i] = v;
      // gradientColor = color.from_gradient(smoothedSpread, -0.1, 0.2, ...): na for an na value
      if (isNaN(v)) {
        s.plot0[i] = { time: t, value: NaN };
      } else {
        const c = color.from_gradient(v, -0.1, 0.2, bottom, top);
        s.plot0[i] = { time: t, value: v, color: c };
        s.bgColors.push({ time: t, color: c });
      }
      // crossUp = ta.crossover(smoothedSpread, 0) / crossDown = ta.crossunder(smoothedSpread, 0)
      const pv = i > 0 ? s.smoothed[i - 1] : NaN;
      const flags = [v > 0 && pv <= 0, v < 0 && pv >= 0];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [{ value: 0, options: { title: 'Midline', color: color.gray, linestyle: 'dotted' } }],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleSpreadOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CandleSpreadOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Up', message: 'Candle Spread Oscillator crossed above the midline.' },
  { id: 'alert1', title: 'Cross Down', message: 'Candle Spread Oscillator crossed below the midline.' },
];

export const CandleSpreadOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
