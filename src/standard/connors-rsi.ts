/**
 * Connors RSI Indicator
 *
 * Composite momentum oscillator combining RSI, streak RSI, and percent rank of ROC.
 * CRSI = avg(RSI(close,3), RSI(updown(close),2), percentrank(ROC(close,1),100))
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ConnorsRSIInputs {
  lenrsi: number;
  lenupdown: number;
  lenroc: number;
}

export const defaultInputs: ConnorsRSIInputs = {
  lenrsi: 3,
  lenupdown: 2,
  lenroc: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenrsi', type: 'int', title: 'RSI Length', defval: 3 },
  { id: 'lenupdown', type: 'int', title: 'UpDown Length', defval: 2 },
  { id: 'lenroc', type: 'int', title: 'ROC Length', defval: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CRSI', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 30, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Connors RSI',
  shortTitle: 'CRSI',
  overlay: false,
};

type Point = { time: number; value: number };

interface CrsiRun extends BarRunState<{ ud: number }> {
  rsi: ReturnType<typeof taStep.rsi>;
  udRsi: ReturnType<typeof taStep.rsi>;
  roc: ReturnType<typeof taStep.roc>;
  pr: ReturnType<typeof taStep.percentrank>;
  crsiData: Point[];
}

function study(inputs: Partial<ConnorsRSIInputs>): BarStudy<CrsiRun, IndicatorResult> {
  const { lenrsi, lenupdown, lenroc } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CrsiRun = {
        rsi: taStep.rsi(lenrsi), udRsi: taStep.rsi(lenupdown), roc: taStep.roc(1), pr: taStep.percentrank(lenroc),
        crsiData: [], steps: [], vars: { ud: 0 }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.udRsi, s.roc, s.pr];
      s.series = [s.crsiData];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      // updown streak counter (0 on the first bar)
      let ud = 0;
      if (i > 0) {
        const prev = s.vars.ud;
        const c = bar.close;
        const cPrev = bars[i - 1].close;
        if (c === cPrev) ud = 0;
        else if (c > cPrev) ud = prev <= 0 ? 1 : prev + 1;
        else ud = prev >= 0 ? -1 : prev - 1;
      }
      s.vars.ud = ud;
      // Three components
      const a = s.rsi.step(bar.close);
      const b = s.udRsi.step(ud);
      const c = s.pr.step(s.roc.step(bar.close));
      // CRSI = math.avg(rsi, updownrsi, percentrank) = (a + b + c) / 3
      const value = (a != null && b != null && c != null) ? (a + b + c) / 3 : NaN;
      s.crsiData[i] = { time: bar.time as number, value };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.crsiData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ConnorsRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ConnorsRSIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ConnorsRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
