/**
 * AI Volume Signals
 *
 * A volume spike is a volume above `volumeMultiplier` times its EMA. A spike on a bullish candle (close > open) with
 * the close above the 50 EMA gives a BUY label below the bar; a spike on a bearish candle with the close below the
 * 50 EMA gives a SELL label above the bar. The volume EMA can be drawn.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the bars of each signal.
 *
 * Reference: "AI Volume Signals" by szymonsobkowiak
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AiVolumeSignalsInputs {
  /** Volume EMA length */
  volumeEmaLength: number;
  /** Multiplier of the volume EMA for the spike detection */
  volumeMultiplier: number;
  /** Draw the volume EMA */
  showVolumeEMA: boolean;
}

export const defaultInputs: AiVolumeSignalsInputs = {
  volumeEmaLength: 20,
  volumeMultiplier: 2.0,
  showVolumeEMA: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'volumeEmaLength', type: 'int', title: 'Volume EMA Length', defval: 20 },
  { id: 'volumeMultiplier', type: 'float', title: 'Multiplier (for spike detection)', defval: 2.0 },
  { id: 'showVolumeEMA', type: 'bool', title: 'Show Volume EMA', defval: false, tooltip: 'Check to show the Volume EMA on the chart' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume EMA', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'AI Volume Signals',
  shortTitle: 'AI Volume Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface AiVolumeRun extends BarRunState<Record<string, never>> {
  volEma: ReturnType<typeof taStep.ema>;
  priceEma: ReturnType<typeof taStep.ema>;
  plot0: { time: number; value: number }[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AiVolumeSignalsInputs>): BarStudy<AiVolumeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const volEma = taStep.ema(cfg.volumeEmaLength);
      const priceEma = taStep.ema(50);
      const s: AiVolumeRun = {
        volEma, priceEma, plot0: [], markers: [], flags: [[], []], times: [[], []],
        steps: [volEma, priceEma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volumeEMA = s.volEma.step(b.volume ?? NaN);
      const priceMA = s.priceEma.step(b.close);
      const volumeSpike = gt(b.volume ?? NaN, volumeEMA * cfg.volumeMultiplier);
      const trendUp = gt(b.close, priceMA);
      const trendDown = lt(b.close, priceMA);
      // plotshape(buySignal, "Buy Signal", location.belowbar, color.green, shape.labelup, text = "BUY")
      const buySignal = volumeSpike && trendUp && gt(b.close, b.open);
      const sellSignal = volumeSpike && trendDown && lt(b.close, b.open);
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(b.time as number);
      if (sellSignal) s.times[1].push(b.time as number);
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
      }
      // plotshape(sellSignal, "Sell Signal", location.abovebar, color.red, shape.labeldown, text = "SELL")
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
      }
      s.plot0[i] = { time: b.time, value: cfg.showVolumeEMA ? volumeEMA : NaN };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        // alertcondition(buySignal, "Buy Alert") / alertcondition(sellSignal, "Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AiVolumeSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AiVolumeSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'AI Volume Signal: BUY' },
  { id: 'alert1', title: 'Sell Alert', message: 'AI Volume Signal: SELL' },
];

export const AiVolumeSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
