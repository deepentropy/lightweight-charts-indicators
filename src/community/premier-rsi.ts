/**
 * Premier RSI Oscillator
 *
 * RSI → Stochastic → normalize to [-5,5] → double EMA smoothing → exp sigmoid.
 * Output oscillates between -1 and +1.
 *
 * Reference: "Premier RSI Oscillator [LazyBear]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PremierRSIInputs {
  source: SourceType;
  rsiLength: number;
  stochLength: number;
  smoothLength: number;
}

export const defaultInputs: PremierRSIInputs = {
  source: 'close',
  rsiLength: 14,
  stochLength: 8,
  smoothLength: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 8, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 25, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Premier RSI', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'PRO Histo', color: '#787B86', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Premier RSI Oscillator',
  shortTitle: 'PRO',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface ProRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  stoch: ReturnType<typeof taStep.stoch>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  pro: number[];
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number; color?: string }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<PremierRSIInputs>): BarStudy<ProRun, Result> {
  const { source, rsiLength, stochLength, smoothLength } = { ...defaultInputs, ...inputs };
  const value = barSource(source);
  const len = Math.round(Math.sqrt(smoothLength));
  const warmup = rsiLength + stochLength + len * 2;
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLength);
      const stoch = taStep.stoch(stochLength);
      const ema1 = taStep.ema(len);
      const ema2 = taStep.ema(len);
      const s: ProRun = {
        rsi, stoch, ema1, ema2, pro: [], plot0: [], plot1: [], barColors: [],
        steps: [rsi, stoch, ema1, ema2], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.pro, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const r = s.rsi.step(value(bars[i]));
      // stoch(r, r, r, stochLength) - stochastic of RSI with itself as H/L/C
      const sk = s.stoch.step(r, r, r);
      // nsk = 0.1 * (sk - 50)
      const nsk = (sk - 50) * 0.1;
      // ss = ema(ema(nsk, len), len)
      const v = s.ema2.step(s.ema1.step(nsk));

      // pro = (exp(ss) - 1) / (exp(ss) + 1) - tanh sigmoid
      let pro = NaN;
      if (!(i < warmup || v == null)) {
        const expss = Math.exp(v);
        pro = (expss - 1) / (expss + 1);
      }
      s.pro[i] = pro;

      // Pine: plot(pro, title="Premier RSI Stoch", color=black, linewidth=2) - line plot
      s.plot0[i] = { time, value: isNaN(pro) ? NaN : pro };
      // Pine: plot(pro, color=iff(pro<0,red,green), style=histogram, title="PROHisto") - colored histogram
      s.plot1[i] = isNaN(pro) ? { time, value: NaN } : { time, value: pro, color: pro < 0 ? '#FF0000' : '#00FF00' };

      // barcolor: pro<0 ? (pro<pro[1]?red:orange) : (pro>pro[1]?lime:green)
      if (i >= warmup && !isNaN(pro)) {
        const prevPro = i > 0 ? s.pro[i - 1] : NaN;
        let color: string;
        if (pro < 0) {
          color = pro < prevPro ? '#FF0000' : '#FFA500';
        } else {
          color = pro > prevPro ? '#00FF00' : '#008000';
        }
        s.barColors.push({ time: time as number, color });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dotted', title: 'Zero' } },
          { value: 0.9, options: { color: '#26A69A', linestyle: 'solid', title: 'Overbought' } },
          { value: -0.9, options: { color: '#EF5350', linestyle: 'solid', title: 'Oversold' } },
          { value: 0.2, options: { color: '#787B86', linestyle: 'dashed' } },
          { value: -0.2, options: { color: '#787B86', linestyle: 'dashed' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PremierRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PremierRSIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars)) as IndicatorResult;
}

export const PremierRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
