/**
 * Kinetic Slippage Index (KSI)
 *
 * Price movement per unit of volume: ksi = 1e6 * tr^2 / (volume * ema(volume, volEmaLength)), 0 when the volume EMA
 * is not above 0 (tr = true range, the high - low on the first bar). The signal line is the EMA of the KSI. The
 * histogram is green when the KSI is above the signal line, red otherwise. Horizontal lines at 0 and at the spike
 * level.
 * Alert (alertcondition, `alerts` of the result): 'KSI Anomalous Spike', the KSI crossing over the spike level.
 *
 * Reference: "Kinetic Slippage Index (KSI)" by HPotter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HPotter, Copyright by HPotter v1.01
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { alertStates, crossedOver, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KineticSlippageIndexInputs {
  /** True range period (not used by the computation of the original script) */
  atrLength: number;
  /** EMA period of the volume */
  volEmaLength: number;
  /** EMA period of the signal line */
  sigLength: number;
  /** Level of the spike line */
  sigSpike: number;
}

export const defaultInputs: KineticSlippageIndexInputs = {
  atrLength: 14,
  volEmaLength: 20,
  sigLength: 9,
  sigSpike: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR / Range Period', defval: 14, min: 1 },
  { id: 'volEmaLength', type: 'int', title: 'Volume EMA Period', defval: 20, min: 1 },
  { id: 'sigLength', type: 'int', title: 'Signal Line Period', defval: 9, min: 1 },
  { id: 'sigSpike', type: 'float', title: 'Spike Signal Level', defval: 0, min: 0 },
];

const upColor = String(color.new(color.green, 30));
const downColor = String(color.new(color.red, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KSI Histogram', color: upColor, lineWidth: 2, style: 'histogram' },
  { id: 'plot1', title: 'Signal Line', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Kinetic Slippage Index (KSI)',
  shortTitle: 'KSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface KsiRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  emaVol: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  ksiPine: number[];
  plot0: { time: Bar['time']; value: number; color: string }[];
  plot1: { time: Bar['time']; value: number; color: string }[];
}

function study(inputs: Partial<KineticSlippageIndexInputs>): BarStudy<KsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const tr = taStep.tr(true);
      const emaVol = taStep.ema(cfg.volEmaLength);
      const sig = taStep.ema(cfg.sigLength);
      const s: KsiRun = { tr, emaVol, sig, ksiPine: [], plot0: [], plot1: [], steps: [tr, emaVol, sig], vars: {}, lists: [], series: [] };
      s.series = [s.ksiPine, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const trueRange = s.tr.step(b.high, b.low, b.close) ?? NaN;
      const volume = b.volume ?? NaN;
      const emaVolume = s.emaVol.step(volume) ?? NaN;
      // emaVolume > 0 ? tr^2 / (volume * emaVolume) : 0. Pine tr^2 / 0 is +infinity, but the plot draws nothing for it,
      // ta.ema skips it like na (its value is na on that bar, so ksi > signal is false): NaN gives the same outputs
      let ksi = 0;
      if (gt(emaVolume, 0)) {
        const den = volume * emaVolume;
        ksi = (den === 0 ? NaN : Math.pow(trueRange, 2) / den) * 1000000;
      }
      const signal = s.sig.step(ksi) ?? NaN;
      // isSpike = ta.crossover(ksi, sigSpike): with the Pine value of tr^2 / 0 (+infinity, na for 0 / 0)
      s.ksiPine[i] = isNaN(ksi) && volume * emaVolume === 0 && Math.pow(trueRange, 2) > 0 ? Infinity : ksi;
      s.plot0[i] = { time: b.time, value: ksi, color: gt(ksi, signal) ? upColor : downColor };
      s.plot1[i] = { time: b.time, value: signal, color: color.orange };
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.sigSpike, options: { title: 'Spike Line', color: color.orange, linestyle: 'dashed' } },
        ],
        alerts: alertStates(alertConditions, bars, [crossedOver(s.ksiPine, cfg.sigSpike)]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KineticSlippageIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KineticSlippageIndexInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0',
    title: 'KSI Anomalous Spike',
    message: 'KSI Alert! Anomalous volume/range divergence detected on {{exchange}}:{{ticker}}, TF: {{interval}}. Potential trend exhaustion or false breakout.',
  },
];

export const KineticSlippageIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
