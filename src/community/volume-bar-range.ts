/**
 * Volume bar range
 *
 * Keeps the high and the low of the last bar whose volume equals the highest volume of the last `lookback` bars
 * (the "volume bar"), and fills the range between them (aqua while the high does not change, white on a change).
 * Signals need a volume above its SMA and above the previous volume, and a close in the right half of the bar:
 * a breakout is a close crossing over the range high, a breakdown a close crossing under the range low; a reversal
 * breakout is a close crossing back over the range low (previous close below it), a reversal breakdown a close
 * crossing back under the range high (previous close above it). The signal text style is an input.
 *
 * Reference: "Volume bar range" by pandorid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tradeswithashish
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeBarRangeInputs {
  /** Number of bars to look back for the highest volume */
  lookback: number;
  /** Period of the volume moving average */
  volMaPeriod: number;
  /** Show the reversal breakout / breakdown signals */
  showReversalSignals: boolean;
  /** Text style of the buy / sell signals */
  signalText: '买/卖' | 'B/S' | 'BUY/SELL';
}

export const defaultInputs: VolumeBarRangeInputs = {
  lookback: 55,
  volMaPeriod: 21,
  showReversalSignals: true,
  signalText: '买/卖',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 55, min: 10, max: 200, step: 5 },
  { id: 'volMaPeriod', type: 'int', title: 'Volume MA Period', defval: 21, min: 5, max: 50, step: 1 },
  { id: 'showReversalSignals', type: 'bool', title: 'Show Reversal Signals', defval: true },
  { id: 'signalText', type: 'string', title: 'Signal Text', defval: '买/卖', options: ['买/卖', 'B/S', 'BUY/SELL'] },
];

const INVISIBLE = String(color.new(color.white, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Candle high', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot1', title: 'Candle low', color: INVISIBLE, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume bar range',
  shortTitle: 'VBR',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Cross = ReturnType<typeof taStep.crossover>;

interface VbrRun extends BarRunState<{ hi: number; lo: number }> {
  highestVol: WindowExtreme;
  volMa: WindowSma;
  crossOverHigh: Cross;
  crossUnderLow: Cross;
  crossOverLow: Cross;
  crossUnderHigh: Cross;
  highVB: number[];
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  fillColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<VolumeBarRangeInputs>): BarStudy<VbrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const aquaFill = String(color.new(color.aqua, 80));
  const whiteFill = String(color.new(color.white, 80));
  const [buyText, sellText] = cfg.signalText === 'B/S' ? ['B', 'S']
    : cfg.signalText === 'BUY/SELL' ? ['BUY', 'SELL'] : ['买', '卖'];
  const known = cfg.signalText === '买/卖' || cfg.signalText === 'B/S' || cfg.signalText === 'BUY/SELL';
  // Style ids: shape0 .. shape3 for 买/卖, shape4 .. shape7 for B/S, shape8 .. shape11 for BUY/SELL
  const idBase = cfg.signalText === 'B/S' ? 4 : cfg.signalText === 'BUY/SELL' ? 8 : 0;
  return {
    init() {
      const highestVol = new WindowExtreme(false, cfg.lookback);
      const volMa = new WindowSma(cfg.volMaPeriod);
      // ta.crossover / ta.crossunder (exact comparisons, last bar where both values were not na)
      const crossOverHigh = taStep.crossover();
      const crossUnderLow = taStep.crossunder();
      const crossOverLow = taStep.crossover();
      const crossUnderHigh = taStep.crossunder();
      const s: VbrRun = {
        highestVol, volMa, crossOverHigh, crossUnderLow, crossOverLow, crossUnderHigh,
        highVB: [], plot0: [], plot1: [], fillColors: [], markers: [],
        steps: [highestVol, volMa, crossOverHigh, crossUnderLow, crossOverLow, crossUnderHigh],
        vars: { hi: NaN, lo: NaN }, lists: [], series: [],
      };
      s.series = [s.highVB, s.plot0, s.plot1, s.fillColors];
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      const highestVol = s.highestVol.step(volume);
      const volMa = s.volMa.step(volume);

      // var highVB = high, var lowVB = low: the high / low of bar 0, then of the last bar with the highest volume
      if (i === 0) {
        v.hi = b.high;
        v.lo = b.low;
      }
      if (eq(volume, highestVol)) {
        v.hi = b.high;
        v.lo = b.low;
      }
      const highVB = v.hi;
      const lowVB = v.lo;
      s.highVB[i] = highVB;

      const crossOverHigh = s.crossOverHigh.step(b.close, highVB);
      const crossUnderLow = s.crossUnderLow.step(b.close, lowVB);
      const crossOverLow = s.crossOverLow.step(b.close, lowVB);
      const crossUnderHigh = s.crossUnderHigh.step(b.close, highVB);

      s.plot0[i] = { time: t, value: highVB };
      s.plot1[i] = { time: t, value: lowVB };
      // colfill = highVB == highVB[1] ? color.new(color.aqua, 80) : color.new(color.white, 80)
      s.fillColors[i] = i > 0 && eq(highVB, s.highVB[i - 1]) ? aquaFill : whiteFill;

      const range = b.high - b.low;
      const prevVolume = i > 0 ? bars[i - 1].volume ?? NaN : NaN;
      const volOk = gt(volume, volMa) && i > 0 && gt(volume, prevVolume) && gt(range, 0);
      const upperClose = gt((b.close - b.low) / range, 0.5);
      const lowerClose = gt((b.high - b.close) / range, 0.5);
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const breakout = crossOverHigh && volOk && upperClose;
      const breakdown = crossUnderLow && volOk && lowerClose;
      const reversalBreakout = crossOverLow && volOk && upperClose && lt(prevClose, lowVB);
      const reversalBreakdown = crossUnderHigh && volOk && lowerClose && gt(prevClose, highVB);
      if (!known) return;

      // plotshape(..., style = shape.labelup / labeldown, size = size.tiny, location.belowbar / abovebar,
      //   textcolor = color.white); one group of four plotshape calls per signal text style
      const buy = (on: boolean, c: string, k: number) => {
        if (on) s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: c, size: 'tiny', text: buyText, textColor: color.white, id: `shape${idBase + k}` });
      };
      const sell = (on: boolean, c: string, k: number) => {
        if (on) s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: c, size: 'tiny', text: sellText, textColor: color.white, id: `shape${idBase + k}` });
      };
      buy(breakout, color.blue, 0);
      sell(breakdown, color.black, 1);
      buy(cfg.showReversalSignals && reversalBreakout, color.purple, 2);
      sell(cfg.showReversalSignals && reversalBreakdown, color.orange, 3);
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Range of Volume bar' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeBarRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeBarRangeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeBarRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
