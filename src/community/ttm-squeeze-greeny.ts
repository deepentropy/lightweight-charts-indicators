/**
 * TTM Squeeze
 *
 * Momentum histogram and squeeze dots. The oscillator is the linear regression (end value, `length` bars) of
 * close - e1 / 2, where e1 = (highest high + lowest low) / 2 + sma(close), all over `length` bars. Its bars are
 * bright when the oscillator rises and dark when it falls (cyan shades at or above zero, magenta shades below).
 * The dots on the zero line compare the upper Bollinger band (sma + 2 stdev) with the upper Keltner band
 * (ema(close) + ema(true range)): green when the Bollinger band is at or above the Keltner band, red when it is
 * inside (the squeeze).
 *
 * Reference: "TTM Squeeze" by Greeny
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TtmSqueezeGreenyInputs {
  length: number;
}

export const defaultInputs: TtmSqueezeGreenyInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 0 },
];

// Colours of the script (green and red are the colour constants of Pine version 1), with the default plot
// transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const RISE_POS = V1('#00FFFF');
const RISE_NEG = V1('#CC00CC');
const FALL_POS = V1('#009B9B');
const FALL_NEG = V1('#FF9BFF');
const GREEN = V1('#008000');
const RED = V1('#FF0000');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: RISE_POS, lineWidth: 2, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze', color: GREEN, lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'TTM Squeeze',
  shortTitle: 'TTM Squeeze',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };

interface TtmRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  hh: WindowExtreme;
  ll: WindowExtreme;
  linreg: ReturnType<typeof taStep.linreg>;
  dev: WindowStdev;
  emaClose: ReturnType<typeof taStep.ema>;
  tr: ReturnType<typeof taStep.tr>;
  emaTr: ReturnType<typeof taStep.ema>;
  osc: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<TtmSqueezeGreenyInputs>): BarStudy<TtmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = cfg.length;
  return {
    init() {
      const sma = new WindowSma(length);
      const hh = new WindowExtreme(false, length);
      const ll = new WindowExtreme(true, length);
      const linreg = taStep.linreg(length, 0);
      const dev = new WindowStdev(length);
      const emaClose = taStep.ema(length);
      const tr = taStep.tr();
      const emaTr = taStep.ema(length);
      const s: TtmRun = {
        sma, hh, ll, linreg, dev, emaClose, tr, emaTr, osc: [], plot0: [], plot1: [],
        steps: [sma, hh, ll, linreg, dev, emaClose, tr, emaTr], vars: {}, lists: [], series: [],
      };
      s.series = [s.osc, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const sma = s.sma.step(b.close);
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      // e1 = (highest(high, length) + lowest(low, length)) / 2 + sma(close, length)
      // osc = linreg(close - e1 / 2, length, 0)
      const o = s.linreg.step(b.close - ((hh + ll) / 2 + sma) / 2);
      s.osc[i] = o;
      // diff = (sma + 2 * stdev) - (ema(close) + ema(tr))
      const dev = s.dev.step(b.close);
      const emaClose = s.emaClose.step(b.close);
      const emaTr = s.emaTr.step(s.tr.step(b.high, b.low, b.close));
      const prev = i > 0 ? s.osc[i - 1] : NaN;
      const oscColor = lt(prev, o) ? (ge(o, 0) ? RISE_POS : RISE_NEG) : ge(o, 0) ? FALL_POS : FALL_NEG;
      const diff = sma + 2 * dev - (emaClose + emaTr);
      s.plot0[i] = { time: b.time, value: o, color: oscColor };
      s.plot1[i] = { time: b.time, value: 0, color: ge(diff, 0) ? GREEN : RED };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TtmSqueezeGreenyInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TtmSqueezeGreenyInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TtmSqueezeGreeny = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
