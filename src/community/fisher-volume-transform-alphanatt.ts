/**
 * Fisher Volume Transform
 *
 * The close is blended with a volume-weighted close (close * volume / SMA(volume)) by the volume weight. The blend
 * is normalised to -0.999..0.999 inside its highest / lowest range over the Fisher period (0 while the range is 0 or
 * na) and Fisher-transformed (0.5 * ln((1 + x) / (1 - x))). The oscillator is 25 * EMA(fisher, smoothing), with an
 * EMA signal line of twice the smoothing. Nine gradient fill layers per side, a histogram with a colour gradient,
 * the oscillator line and the signal line.
 * Alerts (alertcondition, `alerts` of the result): the oscillator crossing zero and crossing the signal line.
 *
 * Reference: "Fisher Volume Transform | AlphaNatt" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FisherVolumeTransformAlphanattInputs {
  fisherPeriod: number;
  volumeWeight: number;
  smoothing: number;
}

export const defaultInputs: FisherVolumeTransformAlphanattInputs = {
  fisherPeriod: 10,
  volumeWeight: 0.7,
  smoothing: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'fisherPeriod', type: 'int', title: 'Fisher Period', defval: 10, min: 5, max: 30 },
  { id: 'volumeWeight', type: 'float', title: 'Volume Weight', defval: 0.7, min: 0.1, max: 1.0, step: 0.1 },
  { id: 'smoothing', type: 'int', title: 'Smoothing', defval: 3, min: 1, max: 10 },
];

const BULL = '#00F1FF';
const BEAR = '#FF019A';
const LAYERS = [1, 0.89, 0.78, 0.67, 0.56, 0.44, 0.33, 0.22, 0.11];
const FILL_TRANSP = [75, 78, 81, 84, 87, 90, 93, 96, 98];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: color.gray, lineWidth: 1 },
  ...LAYERS.map((k, j) => ({ id: `plot${1 + j}`, title: `Positive Layer ${Math.round(k * 100)}%`, color: BULL, lineWidth: 1, display: 'none' as const })),
  ...LAYERS.map((k, j) => ({ id: `plot${10 + j}`, title: `Negative Layer ${Math.round(k * 100)}%`, color: BEAR, lineWidth: 1, display: 'none' as const })),
  { id: 'plot19', title: 'Histogram', color: BULL, lineWidth: 3, style: 'histogram' },
  { id: 'plot20', title: 'Fisher Transform', color: BULL, lineWidth: 2 },
  { id: 'plot21', title: 'Signal', color: String(color.new(BULL, 30)), lineWidth: 1 },
];

export const metadata = {
  title: 'Fisher Volume Transform | AlphaNatt',
  shortTitle: 'FVT | AlphaNatt',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b beyond 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface FvtRun extends BarRunState<Record<string, never>> {
  volSma: ReturnType<typeof taStep.sma>;
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  smooth: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  osc: number[];
  signal: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

const bullZero = color.new(BULL, 100);
const bullFull = color.new(BULL, 0);
const bearFull = color.new(BEAR, 0);
const bearZero = color.new(BEAR, 100);
const sigBull = String(color.new(BULL, 30));
const sigBear = String(color.new(BEAR, 30));
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<FisherVolumeTransformAlphanattInputs>): BarStudy<FvtRun, Result> {
  const { fisherPeriod, volumeWeight, smoothing } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: FvtRun = {
        volSma: taStep.sma(), highest: taStep.highest(), lowest: taStep.lowest(), smooth: taStep.ema(smoothing),
        sig: taStep.ema(smoothing * 2), osc: [], signal: [], plots: Array.from({ length: 22 }, () => []),
        flags: [[], [], [], []], times: [[], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.volSma, s.highest, s.lowest, s.smooth, s.sig];
      s.lists = s.times;
      s.series = [s.osc, s.signal, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // vwPrice = close * (volume / ta.sma(volume, fisherPeriod)): a plain division (x / 0 is +-infinity, 0 / 0 na)
      const volume = b.volume ?? NaN;
      const volSma = s.volSma.step(volume, fisherPeriod);
      const src = b.close * (1 - volumeWeight) + b.close * (volume / volSma) * volumeWeight;

      // fisherTransform(blendedPrice, fisherPeriod)
      const highest = s.highest.step(src, fisherPeriod);
      const lowest = s.lowest.step(src, fisherPeriod);
      const rangee = highest - lowest;
      // rangee != 0 is false when rangee is na: 0
      let normalized = ne(rangee, 0) ? ((src - lowest) / rangee - 0.5) * 2 : 0;
      normalized = Math.max(Math.min(normalized, 0.999), -0.999);
      const fisher = 0.5 * Math.log((1 + normalized) / (1 - normalized));
      const osc = s.smooth.step(fisher) * 25;
      const signal = s.sig.step(osc);
      s.osc[i] = osc;
      s.signal[i] = signal;

      const p = s.plots;
      p[0][i] = { time, value: 0, color: color.gray };
      // p1..p9: showGradient and oscillator > 0 ? oscillator * k : 0; n1..n9: oscillator < 0
      for (let j = 0; j < 9; j++) p[1 + j][i] = { time, value: gt(osc, 0) ? fin(osc * LAYERS[j]) : 0 };
      for (let j = 0; j < 9; j++) p[10 + j][i] = { time, value: lt(osc, 0) ? fin(osc * LAYERS[j]) : 0 };
      p[19][i] = {
        time,
        value: fin(osc),
        color: gt(osc, 0)
          ? String(color.from_gradient(osc, 0, 100, bullZero, bullFull))
          : String(color.from_gradient(osc, -100, 0, bearFull, bearZero)),
      };
      p[20][i] = { time, value: fin(osc), color: gt(osc, 0) ? BULL : BEAR };
      p[21][i] = { time, value: fin(signal), color: gt(osc, signal) ? sigBull : sigBear };

      // alertcondition(ta.crossover(oscillator, 0)) / crossunder(oscillator, 0) / crossover / crossunder(oscillator, signal)
      const po = i > 0 ? s.osc[i - 1] : NaN;
      const ps = i > 0 ? s.signal[i - 1] : NaN;
      const flags = [osc > 0 && po <= 0, osc < 0 && po >= 0, osc > signal && po <= ps, osc < signal && po >= ps];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, j) => { plots[`plot${j}`] = p.slice(); });
      // fill(p1, p2, color.new(bullColor, 75)) ... fill(p9, zeroLine, color.new(bullColor, 98)); same for n1..n9
      const fills = [
        ...FILL_TRANSP.map((tr, j) => ({ plot1: `plot${1 + j}`, plot2: j < 8 ? `plot${2 + j}` : 'plot0', color: String(color.new(BULL, tr)) })),
        ...FILL_TRANSP.map((tr, j) => ({ plot1: `plot${10 + j}`, plot2: j < 8 ? `plot${11 + j}` : 'plot0', color: String(color.new(BEAR, tr)) })),
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FisherVolumeTransformAlphanattInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FisherVolumeTransformAlphanattInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Fisher Bull Cross', message: 'Fisher Transform crossed above zero' },
  { id: 'alert1', title: 'Fisher Bear Cross', message: 'Fisher Transform crossed below zero' },
  { id: 'alert2', title: 'Signal Cross Up', message: 'Fisher crossed above signal' },
  { id: 'alert3', title: 'Signal Cross Down', message: 'Fisher crossed below signal' },
];

export const FisherVolumeTransformAlphanatt = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
