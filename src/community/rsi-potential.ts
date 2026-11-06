/**
 * RSI Potential
 *
 * For a target RSI level, the close that would bring the RSI of the next bar to that level (inverse RSI with the
 * RMA averages of the up and down moves). Upside potential = distance in % from the close up to the overbought
 * price; downside potential = distance in % from the close down to the oversold price; net potential = upside -
 * downside, drawn as columns (green above zero, red otherwise).
 *
 * Reference: "RSI Potential" by nasu_is_gaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © nasu_is_gaji
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiPotentialInputs {
  /** RSI length */
  rsiLength: number;
  /** Overbought RSI level */
  obLevel: number;
  /** Oversold RSI level */
  osLevel: number;
}

export const defaultInputs: RsiPotentialInputs = {
  rsiLength: 14,
  obLevel: 75,
  osLevel: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'obLevel', type: 'int', title: 'Overbought Level', defval: 75 },
  { id: 'osLevel', type: 'int', title: 'Oversold Level', defval: 25 },
];

const NET_UP = String(color.new(color.green, 30));
const NET_DOWN = String(color.new(color.red, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upside Potential', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Downside Potential', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Net Potential', color: NET_UP, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'RSI Potential',
  shortTitle: 'RSI Potential',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };

interface RsiPotentialRun extends BarRunState<Record<string, never>> {
  avgUp: ReturnType<typeof taStep.rma>;
  avgDown: ReturnType<typeof taStep.rma>;
  rsi: ReturnType<typeof taStep.rsi>;
  plots: Point[][];
}

function study(inputs: Partial<RsiPotentialInputs>): BarStudy<RsiPotentialRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.rsiLength;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // The three invRSI calls compute the same ta.rma / ta.rsi series (same arguments on every bar)
      const avgUp = taStep.rma(len);
      const avgDown = taStep.rma(len);
      const rsi = taStep.rsi(len);
      const s: RsiPotentialRun = { avgUp, avgDown, rsi, plots: [[], [], []], steps: [avgUp, avgDown, rsi], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const close = bars[i].close;
      const t = bars[i].time;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      // up = math.max(close - close[1], 0), down = math.max(close[1] - close, 0) (na on the first bar)
      const up = i > 0 ? Math.max(close - close1, 0) : NaN;
      const down = i > 0 ? Math.max(close1 - close, 0) : NaN;
      const avgUp = s.avgUp.step(up);
      const avgDown = s.avgDown.step(down);
      const rsi = s.rsi.step(close);

      const invRsi = (target: number) => {
        const targetRs = target / (100 - target);
        const priceUp = targetRs * (avgDown * (len - 1)) - avgUp * (len - 1) + close;
        const priceDown = avgDown * (len - 1) - (avgUp * (len - 1)) / targetRs + close;
        return gt(target, rsi) ? priceUp : priceDown;
      };

      const priceOb = invRsi(cfg.obLevel);
      const priceOs = invRsi(cfg.osLevel);
      const upside = ((priceOb - close) / close) * 100;
      const downside = ((close - priceOs) / close) * 100;
      const net = upside - downside;
      s.plots[0][i] = { time: t, value: fin(upside), color: color.green };
      s.plots[1][i] = { time: t, value: fin(downside), color: color.red };
      s.plots[2][i] = { time: t, value: fin(net), color: gt(net, 0) ? NET_UP : NET_DOWN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiPotentialInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiPotentialInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiPotential = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
