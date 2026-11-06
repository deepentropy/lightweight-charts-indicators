/**
 * HaP MACD
 *
 * Standard MACD (EMA or SMA oscillator and signal) with signal dots from a DEMA MACD: a dot on the MACD line while
 * the DEMA MACD is above its DEMA signal and that signal rises (blue on the first bar, then green when the MACD
 * rises, orange otherwise), a red exit dot on the first bar after, and MACD / signal cross triangles on the MACD line
 * (lime up, red down). The histogram and the cross triangles are hidden by default (shown from the Style settings).
 *
 * Reference: "HaP MACD" by agahakanaga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HaPMACDInputs {
  src: SourceType;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  /** Oscillator MA type */
  oscType: 'EMA' | 'SMA';
  /** Signal MA type */
  sigType: 'EMA' | 'SMA';
}

export const defaultInputs: HaPMACDInputs = {
  src: 'close',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscType: 'EMA',
  sigType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'oscType', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'sigType', type: 'string', title: 'Signal MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26a69a', lineWidth: 1, style: 'columns', display: 'none' },
  { id: 'plot1', title: 'MACD', color: '#363A45', lineWidth: 1 },
  { id: 'plot2', title: 'Signal', color: '#ff6d00', lineWidth: 1 },
];

export const metadata = {
  title: 'HaP MACD',
  shortTitle: 'HaP MACD',
  overlay: false,
};

type Ma = { step(v: number): number; commit(): void };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

function maStep(length: number, type: string): Ma {
  return type === 'SMA' ? new WindowSma(length) : taStep.ema(length);
}

/** f_dema(source, length) = 2 * ema(source) - ema(ema(source)) */
function demaStep(length: number): Ma {
  const e1 = taStep.ema(length);
  const e2 = taStep.ema(length);
  return {
    step: (v) => {
      const a1 = e1.step(v) ?? NaN;
      const a2 = e2.step(a1) ?? NaN;
      return 2 * a1 - a2;
    },
    commit: () => { e1.commit(); e2.commit(); },
  };
}

interface HapRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  demaFast: Ma;
  demaSlow: Ma;
  demaSig: Ma;
  macd: number[];
  signal: number[];
  hist: number[];
  demaSignal: number[];
  buy: boolean[];
  histPlot: { time: number; value: number; color: string }[];
  macdPlot: { time: number; value: number }[];
  signalPlot: { time: number; value: number }[];
  markers: MarkerData[];
}

function study(inputs: Partial<HaPMACDInputs>): BarStudy<HapRun, Result> {
  const { src, fastLength, slowLength, signalLength, oscType, sigType } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = maStep(fastLength, oscType);
      const slow = maStep(slowLength, oscType);
      const sig = maStep(signalLength, sigType);
      const demaFast = demaStep(fastLength);
      const demaSlow = demaStep(slowLength);
      const demaSig = demaStep(signalLength);
      const s: HapRun = {
        fast, slow, sig, demaFast, demaSlow, demaSig, macd: [], signal: [], hist: [], demaSignal: [], buy: [],
        histPlot: [], macdPlot: [], signalPlot: [], markers: [],
        steps: [fast, slow, sig, demaFast, demaSlow, demaSig], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.macd, s.signal, s.hist, s.demaSignal, s.buy, s.histPlot, s.macdPlot, s.signalPlot];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const x = value(bars[i]);
      const macd = (s.fast.step(x) ?? NaN) - (s.slow.step(x) ?? NaN);
      const signal = s.sig.step(macd) ?? NaN;
      const hist = macd - signal;
      s.macd[i] = macd;
      s.signal[i] = signal;
      s.hist[i] = hist;

      const demaMacd = s.demaFast.step(x) - s.demaSlow.step(x);
      const demaSignal = s.demaSig.step(demaMacd);
      s.demaSignal[i] = demaSignal;
      // buy_condition = dema_macd_line > dema_signal_line and dema_signal_line > dema_signal_line[1]
      // (a comparison with na is false; a bool history before the first bar is false)
      const buy = demaMacd > demaSignal && i > 0 && demaSignal > s.demaSignal[i - 1];
      s.buy[i] = buy;

      const prevBuy = i > 0 && s.buy[i - 1];
      // hColor = hist >= 0 ? (hist > hist[1] ? #26a69a : #b2dfdb) : (hist > hist[1] ? #ffcdd2 : #ff5252)
      const rising = i > 0 && hist > s.hist[i - 1];
      s.histPlot[i] = { time: t, value: hist, color: hist >= 0 ? (rising ? '#26a69a' : '#b2dfdb') : (rising ? '#ffcdd2' : '#ff5252') };
      s.macdPlot[i] = { time: t, value: macd };
      s.signalPlot[i] = { time: t, value: signal };
      // plotshape(buy_condition ? macd : na, shape.circle, location.absolute, color = dot_color, size.tiny)
      // dot_color: blue on the first signal bar, else green when macd > macd[1], else orange
      const markers = s.markers;
      if (buy && !isNaN(macd)) {
        const dot = !prevBuy ? color.blue : i > 0 && macd > s.macd[i - 1] ? color.green : color.orange;
        markers.push({ time: t, position: 'atPriceMiddle', price: macd, shape: 'circle', color: dot, size: 'tiny', id: 'shape0' });
      }
      // plotshape(buy_condition[1] and not buy_condition ? macd : na, shape.circle, color.red, size.tiny)
      if (prevBuy && !buy && !isNaN(macd)) {
        markers.push({ time: t, position: 'atPriceMiddle', price: macd, shape: 'circle', color: color.red, size: 'tiny', id: 'shape1' });
      }
      // bull_cross = ta.crossover(macd, signal) / bear_cross = ta.crossunder(macd, signal) (false while a value is na)
      // plotshape(bull_cross ? macd : na, shape.triangleup, location.absolute, color.lime, size.small, display.none)
      // plotshape(bear_cross ? macd : na, shape.triangledown, location.absolute, color.red, size.small, display.none)
      if (i > 0) {
        const m0 = macd, s0 = signal, m1 = s.macd[i - 1], s1 = s.signal[i - 1];
        if (m0 > s0 && m1 <= s1) {
          markers.push({ time: t, position: 'atPriceMiddle', price: m0, shape: 'triangleUp', color: color.lime, size: 'small', id: 'shape2' });
        }
        if (m0 < s0 && m1 >= s1) {
          markers.push({ time: t, position: 'atPriceMiddle', price: m0, shape: 'triangleDown', color: color.red, size: 'small', id: 'shape3' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.histPlot.slice(), plot1: s.macdPlot.slice(), plot2: s.signalPlot.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: String(color.new(color.gray, 50)), linestyle: 'dashed' } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HaPMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HaPMACDInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const HaPMACD = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
