/**
 * Gamma Hedging Pressure PRO
 *
 * A momentum proxy: gammaRaw = (close - close[gammaLength]) / max(stdev(close, gammaLength), 0.00001). It is
 * normalised to -100..+100 over the lowest / highest of the last `normLookback` values, optionally smoothed with an
 * EMA, and split into a bullish pressure (the positive part) and a bearish pressure (the absolute negative part),
 * both 0..100. The background is green / red when the bullish / bearish pressure is above the extreme level.
 * Alerts (alertcondition, `alerts` of the result): each pressure above the extreme level, and crossing over it.
 *
 * Reference: "Gamma Hedging Pressure PRO (0–100 / 0–100)" by uzair2join
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface GammaHedgingPressureInputs {
  /** Length of the stdev and of the momentum */
  gammaLength: number;
  /** Lookback of the lowest / highest normalisation */
  normLookback: number;
  /** Smooth the normalised value with an EMA */
  useSmoothing: boolean;
  /** EMA length */
  smoothLength: number;
  /** Extreme level (background and hline) */
  extremeLevel: number;
}

export const defaultInputs: GammaHedgingPressureInputs = {
  gammaLength: 20,
  normLookback: 100,
  useSmoothing: true,
  smoothLength: 5,
  extremeLevel: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'gammaLength', type: 'int', title: 'Gamma Calculation Length', defval: 20 },
  { id: 'normLookback', type: 'int', title: 'Normalization Lookback', defval: 100 },
  { id: 'useSmoothing', type: 'bool', title: 'Enable EMA Smoothing', defval: true },
  { id: 'smoothLength', type: 'int', title: 'EMA Length', defval: 5 },
  { id: 'extremeLevel', type: 'int', title: 'Extreme Level', defval: 70, min: 50, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish Gamma Pressure', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Bearish Gamma Pressure', color: color.red, lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_extreme', price: 70, title: 'Extreme Level', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: 'Gamma Hedging Pressure PRO (0–100 / 0–100)',
  shortTitle: 'Gamma Hedging Pressure PRO (0–100 / 0–100)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface GhpRun extends BarRunState<Record<string, never>> {
  dev: WindowStdev;
  lowest: WindowExtreme;
  highest: WindowExtreme;
  ema: ReturnType<typeof taStep.ema> | null;
  close: number[];
  bulls: number[];
  bears: number[];
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<GammaHedgingPressureInputs>): BarStudy<GhpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullBg = String(color.new(color.green, 85));
  const bearBg = String(color.new(color.red, 85));
  const level = cfg.extremeLevel;
  return {
    init() {
      const s: GhpRun = {
        dev: new WindowStdev(cfg.gammaLength), lowest: new WindowExtreme(true, cfg.normLookback),
        highest: new WindowExtreme(false, cfg.normLookback), ema: cfg.useSmoothing ? taStep.ema(cfg.smoothLength) : null,
        close: [], bulls: [], bears: [], plot0: [], plot1: [], bgColors: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.dev, s.lowest, s.highest, ...(s.ema ? [s.ema] : [])];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.close, s.bulls, s.bears, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const c = b.close;
      s.close[i] = c;
      // volatility = ta.stdev(close, gammaLength); momentum = close - close[gammaLength]
      const volatility = s.dev.step(c);
      const momentum = i - cfg.gammaLength >= 0 ? c - s.close[i - cfg.gammaLength] : NaN;
      // math.max(na, x) is na
      const gammaRaw = momentum / (isNaN(volatility) ? NaN : Math.max(volatility, 0.00001));

      const lowestVal = s.lowest.step(gammaRaw);
      const highestVal = s.highest.step(gammaRaw);
      const d = highestVal - lowestVal;
      const rangeVal = isNaN(d) ? NaN : Math.max(d, 0.00001);
      const gammaNorm = (200 * (gammaRaw - lowestVal)) / rangeVal - 100;

      const g = s.ema ? s.ema.step(gammaNorm) : gammaNorm;
      // math.max(gammaFinal, 0) / math.abs(math.min(gammaFinal, 0)): na stays na
      const bullPressure = isNaN(g) ? NaN : Math.max(g, 0);
      const bearPressure = isNaN(g) ? NaN : Math.abs(Math.min(g, 0));
      s.bulls[i] = bullPressure;
      s.bears[i] = bearPressure;
      s.plot0[i] = { time, value: fin(bullPressure), color: color.green };
      s.plot1[i] = { time, value: fin(bearPressure), color: color.red };
      const bg = gt(bullPressure, level) ? bullBg : gt(bearPressure, level) ? bearBg : null;
      if (bg) s.bgColors.push({ time, color: bg });

      // alertcondition(bullPressure > extremeLevel) / (bearPressure > extremeLevel) / ta.crossover(..., extremeLevel)
      const pBull = i > 0 ? s.bulls[i - 1] : NaN;
      const pBear = i > 0 ? s.bears[i - 1] : NaN;
      const flags = [
        gt(bullPressure, level),
        gt(bearPressure, level),
        bullPressure > level && pBull <= level,
        bearPressure > level && pBear <= level,
      ];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: cfg.extremeLevel, options: { title: 'Extreme Level', color: color.gray, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GammaHedgingPressureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GammaHedgingPressureInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Extreme Bullish Gamma', message: 'Bullish Gamma Pressure above threshold' },
  { id: 'alert1', title: 'Extreme Bearish Gamma', message: 'Bearish Gamma Pressure above threshold' },
  { id: 'alert2', title: 'Bullish Pressure Rising', message: 'Bullish Gamma crossing extreme level' },
  { id: 'alert3', title: 'Bearish Pressure Rising', message: 'Bearish Gamma crossing extreme level' },
];

export const GammaHedgingPressure = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
