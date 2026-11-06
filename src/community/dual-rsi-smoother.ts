/**
 * Dual RSI Smoother
 *
 * Two RSIs of the close (lengths 5 and 6) are smoothed with an SMA (6 and 13 bars) and stretched around 50
 * (x 1.25 and x 1.3), clamped to 0..100. The second line is green when the sum of both lines is below 55. Buy dots
 * are drawn 5 points below the first line when both lines are low (or the second line is more than 30 points above
 * the first); sell dots 5 points above it when the first line is high and more than 12 points above the second, or
 * above 95.
 * Alerts (alertcondition, `alerts` of the result): 'Green Dot Alert' / 'Red Dot Alert', true on the bars with a buy /
 * sell dot.
 *
 * Reference: "Dual RSI Smoother" by TheUltimator5
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TheUltimator5
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DualRsiSmootherInputs {
  rsiLength1: number;
  rsiLength2: number;
  /** SMA length of RSI 1 */
  rsiSmoothLen1: number;
  /** SMA length of RSI 2 */
  rsiSmoothLen2: number;
  /** Colour of RSI 2 when the sum of both lines is 55 or more */
  line1Color: string;
  /** Colour of RSI 1 */
  line2Color: string;
  /** Colour of RSI 2 when the sum of both lines is below 55 */
  highlightColor: string;
  buyDotColor: string;
  sellDotColor: string;
}

export const defaultInputs: DualRsiSmootherInputs = {
  rsiLength1: 5,
  rsiLength2: 6,
  rsiSmoothLen1: 6,
  rsiSmoothLen2: 13,
  line1Color: 'rgb(255, 0, 217)',
  line2Color: 'rgb(0, 200, 255)',
  highlightColor: color.lime,
  buyDotColor: 'rgb(109, 244, 113)',
  sellDotColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength1', type: 'int', title: 'RSI Length 1', defval: 5 },
  { id: 'rsiLength2', type: 'int', title: 'RSI Length 2', defval: 6 },
  { id: 'rsiSmoothLen1', type: 'int', title: 'Smooth Length RSI 1', defval: 6 },
  { id: 'rsiSmoothLen2', type: 'int', title: 'Smooth Length RSI 2', defval: 13 },
  { id: 'line1Color', type: 'color', title: 'Slow RSI Line Color', defval: 'rgb(255, 0, 217)' },
  { id: 'line2Color', type: 'color', title: 'Fast RSI Line Color', defval: 'rgb(0, 200, 255)' },
  { id: 'highlightColor', type: 'color', title: 'Buy Line Highlight Color', defval: color.lime },
  { id: 'buyDotColor', type: 'color', title: 'Buy Dot Color', defval: 'rgb(109, 244, 113)' },
  { id: 'sellDotColor', type: 'color', title: 'Sell Dot Color', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI1', color: 'rgb(0, 200, 255)', lineWidth: 2 },
  { id: 'plot1', title: 'RSI2', color: 'rgb(255, 0, 217)', lineWidth: 2 },
];

export const metadata = {
  title: 'Dual RSI Smoother',
  shortTitle: 'Dual RSI Smoother',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface DrsRun extends BarRunState<Record<string, never>> {
  rsi1: ReturnType<typeof taStep.rsi>;
  rsi2: ReturnType<typeof taStep.rsi>;
  sma1: WindowSma;
  sma2: WindowSma;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DualRsiSmootherInputs>): BarStudy<DrsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: DrsRun = {
        rsi1: taStep.rsi(cfg.rsiLength1), rsi2: taStep.rsi(cfg.rsiLength2), sma1: new WindowSma(cfg.rsiSmoothLen1),
        sma2: new WindowSma(cfg.rsiSmoothLen2), plot0: [], plot1: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi1, s.sma1, s.rsi2, s.sma2];
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time as number;
      const close = bars[i].close;
      const smoothed1 = s.sma1.step(s.rsi1.step(close));
      const smoothed2 = s.sma2.step(s.rsi2.step(close));
      // math.min(100, math.max(0, (x - 50) * k + 50)): na stays na
      const a1 = Math.min(100, Math.max(0, (smoothed1 - 50) * 1.25 + 50));
      const a2 = Math.min(100, Math.max(0, (smoothed2 - 50) * 1.3 + 50));
      // plotchar(series, location = location.absolute, char = "•", size = size.tiny, color = c): the 4 plotchar
      // outputs are char0..char3 in declaration order
      const dot = (time: number, price: number, c: string, id: string) => {
        s.markers.push({ time, position: 'atPriceMiddle', price, shape: 'circle', color: 'transparent', text: '•',
          textColor: c, size: 'tiny', id });
      };
      const sum = a1 + a2;
      // rsi2Color = sum < 55 ? highlightColor : sum >= 50 ? line1Color : color.blue (na sum: color.blue)
      const rsi2Color = lt(sum, 55) ? cfg.highlightColor : ge(sum, 50) ? cfg.line1Color : color.blue;
      s.plot0[i] = { time: t, value: a1, color: cfg.line2Color };
      s.plot1[i] = { time: t, value: a2, color: rsi2Color };

      const highlightCondition1 = lt(a1, 30) && lt(a2, 35);
      const highlightCondition2 = gt(a2 - a1, 30);
      const highlightCondition3 = lt(a2, 25) && lt(a1, 22);
      const highlightBackground = highlightCondition1 || highlightCondition2;
      if (highlightBackground) dot(t, a1 - 5, cfg.buyDotColor, 'char0');
      if (highlightCondition3) dot(t, a1 - 5, cfg.buyDotColor, 'char1');
      const top1 = gt(a1, 75) && gt(a1 - a2, 12);
      const top2 = gt(a1, 95);
      if (top1) dot(t, a1 + 5, cfg.sellDotColor, 'char2');
      if (top2) dot(t, a1 + 5, cfg.sellDotColor, 'char3');
      // alertcondition(highlightBackground or highlightCondition3) / alertcondition(highlightConditionTop1 or ...Top2)
      [highlightBackground || highlightCondition3, top1 || top2].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t);
      });
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
export function createRun(inputs: Partial<DualRsiSmootherInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DualRsiSmootherInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Green Dot Alert', message: 'Green Dot (Buy) condition triggered' },
  { id: 'alert1', title: 'Red Dot Alert', message: 'Red Dot (Sell) condition triggered' },
];

export const DualRsiSmoother = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
