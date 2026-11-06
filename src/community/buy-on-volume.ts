/**
 * Buy on Volume
 *
 * A DEMA of the close (2 * EMA - EMA of the EMA) and a "Lorentzian line" that is an SMA of the close over
 * max(1, int(0.8 * lorentzianLength)) bars (stepline). A BUY label below the bar when the DEMA crosses above the
 * line on a bar whose volume is above 1.3 times its SMA over `volumeLookback` bars.
 * Alert (alertcondition, `alerts` of the result): 'Buy Signal', true on the bars of a BUY label.
 *
 * Reference: "Buy Signal with DEMA and Volume Confirmation" by Mando4_27
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0', title: 'Buy Signal',
    message: 'Buy Signal! DEMA crossed above Lorentzian Line, and volume is 50% higher than average.',
  },
];

export interface BuyOnVolumeInputs {
  /** DEMA period */
  demaPeriod: number;
  /** Volume lookback period (SMA of the volume) */
  volumeLookback: number;
  /** Lorentzian length (the SMA uses 80 % of it) */
  lorentzianLength: number;
}

export const defaultInputs: BuyOnVolumeInputs = {
  demaPeriod: 6,
  volumeLookback: 20,
  lorentzianLength: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'demaPeriod', type: 'int', title: 'DEMA Period', defval: 6 },
  { id: 'volumeLookback', type: 'int', title: 'Volume Lookback Period', defval: 20 },
  { id: 'lorentzianLength', type: 'int', title: 'Lorentzian Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Lorentzian Line', color: String(color.new(color.aqua, 45)), lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'DEMA', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Buy Signal with DEMA and Volume Confirmation',
  shortTitle: 'Buy Signal with DEMA and Volume Confirmation',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };

interface BovRun extends BarRunState<Record<string, never>> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  line: WindowSma;
  avgVol: WindowSma;
  cross: ReturnType<typeof taStep.crossover>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BuyOnVolumeInputs>): BarStudy<BovRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // lorentzianLine = ta.sma(close, math.max(1, int(lorentzianLength * 0.8)))
  const sensitiveLength = Math.max(1, Math.trunc(cfg.lorentzianLength * 0.8));
  const signalColor = String(color.new(color.green, 75));
  return {
    init() {
      const ema1 = taStep.ema(cfg.demaPeriod);
      const ema2 = taStep.ema(cfg.demaPeriod);
      const line = new WindowSma(sensitiveLength);
      const avgVol = new WindowSma(cfg.volumeLookback);
      const cross = taStep.crossover();
      const s: BovRun = {
        ema1, ema2, line, avgVol, cross, plot0: [], plot1: [], markers: [], flags: [[]], times: [[]],
        steps: [ema1, ema2, line, avgVol, cross], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      // fastDEMA = 2 * ema1 - ema2
      const e1 = s.ema1.step(b.close);
      const e2 = s.ema2.step(e1);
      const dema = 2 * e1 - e2;
      const line = s.line.step(b.close);
      // averageVolume = ta.sma(volume, volumeLookback); volumeConfirmation = volume > averageVolume * 1.3
      const avgVol = s.avgVol.step(b.volume ?? NaN);
      // demaCrossUp = ta.crossover(fastDEMA, lorentzianLine) (exact comparison)
      const crossUp = s.cross.step(dema, line);

      const buySignal = Boolean(crossUp) && gt(b.volume ?? NaN, avgVol * 1.3);
      // plotshape(buySignal, "Buy Signal", location.belowbar, color.new(color.green, 75), shape.labelup, "BUY", size.small)
      if (buySignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: signalColor, text: 'BUY',
          textColor: color.blue, size: 'small' });
      }
      // alertcondition(buySignal, title="Buy Signal")
      s.flags[0][i] = buySignal;
      if (buySignal) s.times[0].push(time);
      s.plot0[i] = { time, value: line };
      s.plot1[i] = { time, value: dema };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyOnVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuyOnVolumeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyOnVolume = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
