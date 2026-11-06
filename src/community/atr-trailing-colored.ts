/**
 * Average True Range Trailing Stops Colored
 *
 * ATR trailing stop (Sylvain Vervoort): loss = multiplier x ATR(period). While the close and the previous close
 * stay on one side of the previous stop, the stop ratchets (max(stop, close - loss) above, min(stop, close + loss)
 * below); when the close crosses it, the stop restarts at close -/+ loss. A missing previous stop counts as 0, so
 * the stop exists from the first bar of the ATR.
 * The line is coloured by the position: green after the close crosses above the stop, red after it crosses below,
 * blue until the first cross. The original draws only this line (no bar colours, no markers).
 *
 * Reference: "Average True Range Trailing Stops Strategy, by Sylvain Vervoort" (community, HPotter)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ATRTrailingColoredInputs {
  length: number;
  mult: number;
}

export const defaultInputs: ATRTrailingColoredInputs = {
  length: 5,
  mult: 3.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ATR Length', defval: 5, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 3.5, min: 0.1, step: 0.1 },
];

// Colours of the script (red / green / blue constants of Pine version 1) with that version's default plot
// transparency (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const RED = V1('#FF0000');
const GREEN = V1('#008000');
const BLUE = V1('#0000FF');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR Trailing Stop', color: V1('#3BB3E4'), lineWidth: 1 },
];

export const metadata = {
  title: 'Average True Range Trailing Stops Colored',
  shortTitle: 'ATRTSC',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'>;
type Point = { time: number; value: number; color?: string };

interface AtrtsVars {
  /** xATRTrailingStop[1] */
  prevStopRaw: number;
  /** pos[1] */
  prevPos: number;
}

interface AtrtsRun extends BarRunState<AtrtsVars> {
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
}

function study(inputs: Partial<ATRTrailingColoredInputs>): BarStudy<AtrtsRun, Result> {
  const { length, mult } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(length);
      const s: AtrtsRun = { atr, plot0: [], steps: [atr], vars: { prevStopRaw: NaN, prevPos: 0 }, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const nLoss = mult * s.atr.step(b.high, b.low, b.close);
      const close = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      // nz(xATRTrailingStop[1], 0)
      const prevStop = i > 0 && !isNaN(v.prevStopRaw) ? v.prevStopRaw : 0;

      let stop: number;
      if (close > prevStop && prevClose > prevStop) stop = Math.max(prevStop, close - nLoss);
      else if (close < prevStop && prevClose < prevStop) stop = Math.min(prevStop, close + nLoss);
      else stop = close > prevStop ? close - nLoss : close + nLoss;
      v.prevStopRaw = stop;

      let pos: number;
      if (prevClose < prevStop && close > prevStop) pos = 1;
      else if (prevClose > prevStop && close < prevStop) pos = -1;
      else pos = i > 0 ? v.prevPos : 0;
      v.prevPos = pos;

      if (isNaN(stop)) {
        s.plot0[i] = { time: b.time, value: NaN };
      } else {
        const c = pos === -1 ? RED : pos === 1 ? GREEN : BLUE;
        s.plot0[i] = { time: b.time, value: stop, color: c };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ATRTrailingColoredInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ATRTrailingColoredInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ATRTrailingColored = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
