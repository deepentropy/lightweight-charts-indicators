/**
 * Dynamic Score PSAR [QuantAlgo]
 *
 * The distance of the close to the Parabolic SAR, divided by the 21-bar EMA of the high - low range (x 100), is drawn
 * as columns. The trend score counts, over the last `Window Length` bars, +1 for each past value below the current
 * value and -1 otherwise. Uptrend: positive value and score above the uptrend threshold; downtrend: negative value
 * and score below the downtrend threshold. Columns, bands at +-600 / +-900 and bars are coloured by the trend (a
 * gradient on the value), with markers and background colours when the value crosses zero in a confirmed trend.
 * Presets replace the PSAR and score settings.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Reversal' / 'Bearish Reversal' (the signals), and
 * 'Histogram Turned Bullish' / 'Bearish' / 'Neutral' (first bar of an uptrend / downtrend / neutral state).
 *
 * Reference: "Dynamic Score PSAR [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type DynamicScorePsarPreset = 'Default' | 'Fast Response' | 'Smooth Trend';

export interface DynamicScorePsarInputs {
  /** Preset: 'Fast Response' and 'Smooth Trend' replace the PSAR and score settings */
  presetConfig: DynamicScorePsarPreset;
  psarStart: number;
  psarIncrement: number;
  psarMax: number;
  /** Number of past bars of the trend score */
  windowLen: number;
  uptrendThreshold: number;
  downtrendThreshold: number;
  bullishColor: string;
  bearishColor: string;
  neutralColor: string;
  /** Colour the price bars by the trend */
  colorBars: boolean;
}

export const defaultInputs: DynamicScorePsarInputs = {
  presetConfig: 'Default',
  psarStart: 0.02,
  psarIncrement: 0.0005,
  psarMax: 0.2,
  windowLen: 60,
  uptrendThreshold: 30,
  downtrendThreshold: -20,
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  neutralColor: '#787b86',
  colorBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'psarStart', type: 'float', title: 'PSAR Start', defval: 0.02, min: 0.0, step: 0.001 },
  { id: 'psarIncrement', type: 'float', title: 'PSAR Increment', defval: 0.0005, min: 0.0, step: 0.001 },
  { id: 'psarMax', type: 'float', title: 'PSAR Max Value', defval: 0.2, step: 0.001 },
  { id: 'windowLen', type: 'int', title: 'Window Length', defval: 60 },
  { id: 'uptrendThreshold', type: 'int', title: 'Uptrend Threshold', defval: 30 },
  { id: 'downtrendThreshold', type: 'int', title: 'Downtrend Threshold', defval: -20 },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color', defval: '#787b86' },
  { id: 'colorBars', type: 'bool', title: 'Color Bars?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dynamic PSAR', color: '#787b86', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Upper OB', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot2', title: 'Upper OS', color: '#ff0000', lineWidth: 1 },
  { id: 'plot3', title: 'Lower OB', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot4', title: 'Lower OS', color: '#ff0000', lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Score PSAR [QuantAlgo]',
  shortTitle: 'Dynamic Score PSAR [QuantAlgo]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const PRESETS: Record<string, { start: number; inc: number; max: number; window: number; up: number; down: number }> = {
  'Fast Response': { start: 0.04, inc: 0.002, max: 0.3, window: 30, up: 15, down: -10 },
  'Smooth Trend': { start: 0.01, inc: 0.0002, max: 0.15, window: 100, up: 50, down: -35 },
};

/**
 * `ta.sar(start, inc, max)` one bar at a time, with the operations of the oakscriptjs function (same doubles): the
 * state of the last committed bar, and the state of the bar stepped last kept until commit.
 */
class SarStep {
  private sarValue = NaN;
  private extremePoint = NaN;
  private acceleration: number;
  private isUpTrend = false;
  private nSar = NaN;
  private nExtreme = NaN;
  private nAcceleration: number;
  private nUpTrend = false;
  private stepped = false;

  constructor(private readonly start: number, private readonly inc: number, private readonly max: number) {
    this.acceleration = start;
    this.nAcceleration = start;
  }

  step(bars: Bar[], i: number): number {
    this.stepped = false;
    if (i === 0) return NaN;
    const { start, inc, max } = this;
    const high = bars[i].high;
    const low = bars[i].low;
    let { sarValue, extremePoint, acceleration, isUpTrend } = this;
    let isFirstTrendBar = false;

    if (i === 1) {
      if (bars[i].close > bars[i - 1].close) {
        isUpTrend = true;
        extremePoint = high;
        sarValue = bars[i - 1].low;
      } else {
        isUpTrend = false;
        extremePoint = low;
        sarValue = bars[i - 1].high;
      }
      isFirstTrendBar = true;
      acceleration = start;
    }

    sarValue = sarValue + acceleration * (extremePoint - sarValue);

    if (isUpTrend) {
      if (sarValue > low) {
        isFirstTrendBar = true;
        isUpTrend = false;
        sarValue = Math.max(high, extremePoint);
        extremePoint = low;
        acceleration = start;
      }
    } else {
      if (sarValue < high) {
        isFirstTrendBar = true;
        isUpTrend = true;
        sarValue = Math.min(low, extremePoint);
        extremePoint = high;
        acceleration = start;
      }
    }

    if (!isFirstTrendBar) {
      if (isUpTrend) {
        if (high > extremePoint) {
          extremePoint = high;
          acceleration = Math.min(acceleration + inc, max);
        }
      } else {
        if (low < extremePoint) {
          extremePoint = low;
          acceleration = Math.min(acceleration + inc, max);
        }
      }
    }

    if (isUpTrend) {
      sarValue = Math.min(sarValue, bars[i - 1].low);
      if (i > 1) {
        sarValue = Math.min(sarValue, bars[i - 2].low);
      }
    } else {
      sarValue = Math.max(sarValue, bars[i - 1].high);
      if (i > 1) {
        sarValue = Math.max(sarValue, bars[i - 2].high);
      }
    }

    this.nSar = sarValue;
    this.nExtreme = extremePoint;
    this.nAcceleration = acceleration;
    this.nUpTrend = isUpTrend;
    this.stepped = true;
    return sarValue;
  }

  commit(): void {
    if (this.stepped) {
      this.sarValue = this.nSar;
      this.extremePoint = this.nExtreme;
      this.acceleration = this.nAcceleration;
      this.isUpTrend = this.nUpTrend;
    }
    this.stepped = false;
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface PsarVars {
  /** long_condition[1] / short_condition[1] (false before the first bar) */
  prevLong: boolean;
  prevShort: boolean;
}

interface PsarRun extends BarRunState<PsarVars> {
  sar: SarStep;
  rangeEma: ReturnType<typeof taStep.ema>;
  np: number[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DynamicScorePsarInputs>): BarStudy<PsarRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const p = PRESETS[cfg.presetConfig] ?? {
    start: cfg.psarStart, inc: cfg.psarIncrement, max: cfg.psarMax,
    window: cfg.windowLen, up: cfg.uptrendThreshold, down: cfg.downtrendThreshold,
  };
  const bullFaded = String(color.new(cfg.bullishColor, 40));
  const bearFaded = String(color.new(cfg.bearishColor, 40));
  const bullBg = String(color.new(cfg.bullishColor, 70));
  const bearBg = String(color.new(cfg.bearishColor, 70));
  return {
    init() {
      const s: PsarRun = {
        sar: new SarStep(p.start, p.inc, p.max), rangeEma: taStep.ema(21), np: [], plots: [[], [], [], [], []],
        markers: [], barColors: [], bgColors: [], flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        vars: { prevLong: false, prevShort: false }, steps: [], lists: [], series: [],
      };
      s.steps = [s.sar, s.rangeEma];
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.np, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const vs = s.vars;
      const b = bars[i];
      const t = b.time;
      const np = s.np;
      // normalized_psar = (close - ta.sar(...)) / ta.ema(high - low, 21) * 100. On flat bars (high == low) the EMA is 0:
      // Pine gives +-infinity for a non-zero value / 0 (it compares and colours as +-infinity; the plot draws nothing)
      const sar = s.sar.step(bars, i);
      const rangeEma = s.rangeEma.step(b.high - b.low) ?? NaN;
      const v = ((b.close - sar) / rangeEma) * 100;
      np[i] = v;
      // dynamic_score(): +1 when normalized_psar > normalized_psar[k + 1], else -1 (na history: -1)
      let score = 0;
      for (let k = 0; k < p.window; k++) {
        const past = i - k - 1 >= 0 ? np[i - k - 1] : NaN;
        score += gt(v, past) ? 1 : -1;
      }
      const longCondition = gt(v, 0) && gt(score, p.up);
      const shortCondition = lt(v, 0) && lt(score, p.down);
      // ta.crossover(x, 0): x > 0 and x[1] <= 0; ta.crossunder(x, 0): x < 0 and x[1] >= 0 (exact comparisons)
      const prev = i > 0 ? np[i - 1] : NaN;
      const bullishSignal = v > 0 && prev <= 0 && longCondition;
      const bearishSignal = v < 0 && prev >= 0 && shortCondition;
      const flags = [
        bullishSignal,
        bearishSignal,
        longCondition && !vs.prevLong,
        shortCondition && !vs.prevShort,
        !longCondition && !shortCondition && (vs.prevLong || vs.prevShort),
      ];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
      vs.prevLong = longCondition;
      vs.prevShort = shortCondition;

      const uptrendColor = color.from_gradient(v, 0, 400, bullFaded, cfg.bullishColor);
      const downtrendColor = color.from_gradient(v, -400, 0, cfg.bearishColor, bearFaded);
      const finalColor = longCondition ? uptrendColor : shortCondition ? downtrendColor : cfg.neutralColor;

      s.plots[0][i] = { time: t, value: Number.isFinite(v) ? v : NaN, color: finalColor };
      s.plots[1][i] = { time: t, value: 900, color: uptrendColor };
      s.plots[2][i] = { time: t, value: -900, color: downtrendColor };
      s.plots[3][i] = { time: t, value: 600, color: uptrendColor };
      s.plots[4][i] = { time: t, value: -600, color: downtrendColor };

      // plotchar(bearish_signal ? 400 : na, '▼', location.absolute, bearish_color, size.tiny); bullish at -400
      if (bearishSignal) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: 400, shape: 'circle', color: 'transparent', text: '▼',
          textColor: cfg.bearishColor, size: 'tiny' });
      }
      if (bullishSignal) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: -400, shape: 'circle', color: 'transparent', text: '▲',
          textColor: cfg.bullishColor, size: 'tiny' });
      }

      if (cfg.colorBars) {
        s.barColors.push({ time: t, color: longCondition ? cfg.bullishColor : shortCondition ? cfg.bearishColor : cfg.neutralColor,
          id: 'barcolor0' });
      }
      if (bullishSignal) s.bgColors.push({ time: t, color: bullBg, id: 'bgcolor0' });
      if (bearishSignal) s.bgColors.push({ time: t, color: bearBg, id: 'bgcolor1' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [{ value: 0, options: { title: '0 Line', color: '#787b86', linestyle: 'solid' } }],
        fills: [
          // fill(obupper, oblower, color.new(bullish_color, 90)) / fill(osupper, oslower, color.new(bearish_color, 90))
          { plot1: 'plot1', plot2: 'plot3', options: { title: 'OB Fill' }, colors: new Array<string>(n).fill(String(color.new(cfg.bullishColor, 90))) },
          { plot1: 'plot2', plot2: 'plot4', options: { title: 'OS Fill' }, colors: new Array<string>(n).fill(String(color.new(cfg.bearishColor, 90))) },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicScorePsarInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicScorePsarInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Reversal', message: 'Dynamic Score PSAR crossed above zero line with bullish confirmation' },
  { id: 'alert1', title: 'Bearish Reversal', message: 'Dynamic Score PSAR crossed below zero line with bearish confirmation' },
  { id: 'alert2', title: 'Histogram Turned Bullish', message: 'Dynamic Score PSAR histogram turned bullish (green)' },
  { id: 'alert3', title: 'Histogram Turned Bearish', message: 'Dynamic Score PSAR histogram turned bearish (red)' },
  { id: 'alert4', title: 'Histogram Turned Neutral', message: 'Dynamic Score PSAR histogram turned neutral (grey)' },
];

export const DynamicScorePsar = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
