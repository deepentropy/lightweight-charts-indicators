/**
 * MA Ribbon 5EMA | 20EMA | 50SMA | 200EMA
 *
 * Four moving averages of the source on the price chart: EMA 5, EMA 20, SMA 50 and EMA 200. Each line can be
 * hidden; colours and widths are inputs.
 * Alerts (alertcondition, `alerts` of the result): the source crossing above / below the EMA 200 and the EMA 5
 * crossing above / below the EMA 20 (whether the lines are shown or not).
 *
 * Reference: "5 EMA | 20 EMA | 50 SMA | 200 EMA" by vamsinelluri7
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MaRibbon5ema20ema50sma200emaInputs {
  /** Source of the four averages */
  src: SourceType;
  show5ema: boolean;
  show20ema: boolean;
  show50sma: boolean;
  show200ema: boolean;
  col5ema: string;
  col20ema: string;
  col50sma: string;
  col200ema: string;
  /** Line widths (the plot widths of plotConfig are the defaults) */
  width5ema: number;
  width20ema: number;
  width50sma: number;
  width200ema: number;
}

export const defaultInputs: MaRibbon5ema20ema50sma200emaInputs = {
  src: 'close',
  show5ema: true,
  show20ema: true,
  show50sma: true,
  show200ema: true,
  col5ema: '#00E5FF',
  col20ema: '#8FCE00',
  col50sma: '#F6C73B',
  col200ema: '#F44336',
  width5ema: 1,
  width20ema: 1,
  width50sma: 2,
  width200ema: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'show5ema', type: 'bool', title: 'Show 5 EMA', defval: true },
  { id: 'show20ema', type: 'bool', title: 'Show 20 EMA', defval: true },
  { id: 'show50sma', type: 'bool', title: 'Show 50 SMA', defval: true },
  { id: 'show200ema', type: 'bool', title: 'Show 200 EMA', defval: true },
  { id: 'col5ema', type: 'color', title: '5 EMA Color', defval: '#00E5FF' },
  { id: 'col20ema', type: 'color', title: '20 EMA Color', defval: '#8FCE00' },
  { id: 'col50sma', type: 'color', title: '50 SMA Color', defval: '#F6C73B' },
  { id: 'col200ema', type: 'color', title: '200 EMA Color', defval: '#F44336' },
  { id: 'width5ema', type: 'int', title: '5 EMA Width', defval: 1, min: 1, max: 5 },
  { id: 'width20ema', type: 'int', title: '20 EMA Width', defval: 1, min: 1, max: 5 },
  { id: 'width50sma', type: 'int', title: '50 SMA Width', defval: 2, min: 1, max: 5 },
  { id: 'width200ema', type: 'int', title: '200 EMA Width', defval: 2, min: 1, max: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '5 EMA', color: '#00E5FF', lineWidth: 1 },
  { id: 'plot1', title: '20 EMA', color: '#8FCE00', lineWidth: 1 },
  { id: 'plot2', title: '50 SMA', color: '#F6C73B', lineWidth: 2 },
  { id: 'plot3', title: '200 EMA', color: '#F44336', lineWidth: 2 },
];

export const metadata = {
  title: '5 EMA | 20 EMA | 50 SMA | 200 EMA',
  shortTitle: 'MA Ribbon 5,20,50,200',
  overlay: true,
};

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface RibbonRun extends BarRunState<Record<string, never>> {
  e5: ReturnType<typeof taStep.ema>;
  e20: ReturnType<typeof taStep.ema>;
  s50: WindowSma;
  e200: ReturnType<typeof taStep.ema>;
  srcArr: number[];
  ema5: number[];
  ema20: number[];
  ema200: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MaRibbon5ema20ema50sma200emaInputs>): BarStudy<RibbonRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const e5 = taStep.ema(5);
      const e20 = taStep.ema(20);
      const s50 = new WindowSma(50);
      const e200 = taStep.ema(200);
      const s: RibbonRun = {
        e5, e20, s50, e200, srcArr: [], ema5: [], ema20: [], ema200: [], plots: [[], [], [], []],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [e5, e20, s50, e200], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.srcArr, s.ema5, s.ema20, s.ema200, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      const ema5 = s.e5.step(src);
      const ema20 = s.e20.step(src);
      const sma50 = s.s50.step(src);
      const ema200 = s.e200.step(src);
      s.srcArr[i] = src;
      s.ema5[i] = ema5;
      s.ema20[i] = ema20;
      s.ema200[i] = ema200;
      // plot(showX ? x : na, title, color = colX, linewidth = widthX)
      s.plots[0][i] = { time: t, value: cfg.show5ema ? ema5 : NaN, color: cfg.col5ema };
      s.plots[1][i] = { time: t, value: cfg.show20ema ? ema20 : NaN, color: cfg.col20ema };
      s.plots[2][i] = { time: t, value: cfg.show50sma ? sma50 : NaN, color: cfg.col50sma };
      s.plots[3][i] = { time: t, value: cfg.show200ema ? ema200 : NaN, color: cfg.col200ema };
      const ps = i > 0 ? s.srcArr[i - 1] : NaN;
      const p200 = i > 0 ? s.ema200[i - 1] : NaN;
      const p5 = i > 0 ? s.ema5[i - 1] : NaN;
      const p20 = i > 0 ? s.ema20[i - 1] : NaN;
      const flags = [
        src > ema200 && ps <= p200, // ta.crossover(src, ema200)
        src < ema200 && ps >= p200, // ta.crossunder(src, ema200)
        ema5 > ema20 && p5 <= p20, // ta.crossover(ema5, ema20)
        ema5 < ema20 && p5 >= p20, // ta.crossunder(ema5, ema20)
      ];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MaRibbon5ema20ema50sma200emaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MaRibbon5ema20ema50sma200emaInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Crossed Above 200 EMA', message: 'Price crossed ABOVE 200 EMA' },
  { id: 'alert1', title: 'Price Crossed Below 200 EMA', message: 'Price crossed BELOW 200 EMA' },
  { id: 'alert2', title: '5 EMA Crossed Above 20 EMA', message: '5 EMA crossed ABOVE 20 EMA — Bullish' },
  { id: 'alert3', title: '5 EMA Crossed Below 20 EMA', message: '5 EMA crossed BELOW 20 EMA — Bearish' },
];

export const MaRibbon5ema20ema50sma200ema = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
