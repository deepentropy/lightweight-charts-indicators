/**
 * Squeeze Momentum Indicator
 *
 * Bollinger Bands inside Keltner Channels = squeeze.
 * Momentum = linreg of (close - avg(Donchian midline, SMA)).
 *
 * Reference: TradingView "Squeeze Momentum Indicator" by LazyBear
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SqueezeMomentumInputs {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  useTrueRange: boolean;
  src: SourceType;
}

export const defaultInputs: SqueezeMomentumInputs = {
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMult: 1.5,
  useTrueRange: true,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB MultFactor', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'kcLength', type: 'int', title: 'KC Length', defval: 20, min: 1 },
  { id: 'kcMult', type: 'float', title: 'KC MultFactor', defval: 1.5, min: 0.01, step: 0.5 },
  { id: 'useTrueRange', type: 'bool', title: 'Use TrueRange (KC)', defval: true },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Momentum', color: '#26A69A', lineWidth: 4 },
  { id: 'plot1', title: 'Squeeze', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'Squeeze Momentum',
  shortTitle: 'SQZMOM',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SqueezeMomentumInputs> = {}): IndicatorResult {
  const { bbLength, bbMult, kcLength, kcMult, useTrueRange, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // Bollinger Bands
  const bbBasis = ta.sma(source, bbLength);
  const bbDev = ta.stdev(source, bbLength).mul(bbMult);
  const upperBB = bbBasis.add(bbDev);
  const lowerBB = bbBasis.sub(bbDev);

  // Keltner Channels
  const [kcUpper, kcMiddle, kcLower] = ta.kc(bars, source, kcLength, kcMult, useTrueRange);

  // Squeeze detection: BB inside KC
  // sqzOn = lowerBB > lowerKC AND upperBB < upperKC
  // sqzOff = lowerBB < lowerKC AND upperBB > upperKC
  const sqzOn = lowerBB.gt(kcLower).and(upperBB.lt(kcUpper));
  const sqzOff = lowerBB.lt(kcLower).and(upperBB.gt(kcUpper));
  const noSqz = sqzOn.not().and(sqzOff.not());

  // Momentum: linreg(close - avg(avg(highest, lowest), sma), kcLength, 0)
  const highSeries = new Series(bars, (bar) => bar.high);
  const lowSeries = new Series(bars, (bar) => bar.low);
  const hh = ta.highest(highSeries, kcLength);
  const ll = ta.lowest(lowSeries, kcLength);
  const donchianMid = hh.add(ll).div(2);
  const smaClose = ta.sma(source, kcLength);
  const midline = donchianMid.add(smaClose).div(2);
  const val = ta.linreg(source.sub(midline), kcLength, 0);

  // Squeeze state: 0 = no squeeze (gray), 1 = squeeze on (black), -1 = squeeze off
  const sqzOnArr = sqzOn.toArray();
  const noSqzArr = noSqz.toArray();
  const valArr = val.toArray();

  const momData = valArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  // Squeeze indicator: 0 for plotting as dots
  // Color: black=squeeze on, gray=no squeeze, blue=squeeze off (encoded as value)
  const sqzData = bars.map((bar, i) => ({
    time: bar.time,
    value: valArr[i] != null ? 0 : NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': momData, 'plot1': sqzData },
  };
}

export const SqueezeMomentum = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
