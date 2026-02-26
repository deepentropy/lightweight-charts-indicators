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
  { id: 'plot0', title: 'Momentum', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze', color: '#787B86', lineWidth: 2, style: 'columns' },
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
  const [kcUpper, , kcLower] = ta.kc(bars, source, kcLength, kcMult, useTrueRange);

  // Squeeze detection: BB inside KC = squeeze on
  const sqzOn = lowerBB.gt(kcLower).and(upperBB.lt(kcUpper));
  const sqzOff = lowerBB.lt(kcLower).and(upperBB.gt(kcUpper));
  const sqzOnArr = sqzOn.toArray();
  const sqzOffArr = sqzOff.toArray();

  // Momentum: linreg(close - avg(avg(highest, lowest), sma), kcLength, 0)
  const highSeries = new Series(bars, (bar) => bar.high);
  const lowSeries = new Series(bars, (bar) => bar.low);
  const hh = ta.highest(highSeries, kcLength);
  const ll = ta.lowest(lowSeries, kcLength);
  const donchianMid = hh.add(ll).div(2);
  const smaClose = ta.sma(source, kcLength);
  const midline = donchianMid.add(smaClose).div(2);
  const val = ta.linreg(source.sub(midline), kcLength, 0);
  const valArr = val.toArray();

  // Momentum histogram: 4-color scheme like TradingView
  // Positive & rising = lime (#00E676), positive & falling = dark green (#26A69A)
  // Negative & falling = red (#FF5252), negative & rising = dark red (#EF5350)
  const momData = valArr.map((value, i) => {
    const v = value ?? NaN;
    const prev = i > 0 ? (valArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#00E676' : '#26A69A';
    } else {
      color = v < prev ? '#FF5252' : '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  // Squeeze dots: black = squeeze on, gray = no squeeze, blue = squeeze off
  const sqzWarmup = Math.max(bbLength, kcLength);
  const sqzData = valArr.map((value, i) => {
    if (i < sqzWarmup || value == null) return { time: bars[i].time, value: NaN };
    let color: string;
    if (sqzOnArr[i]) {
      color = '#000000'; // squeeze on
    } else if (sqzOffArr[i]) {
      color = '#0000FF'; // squeeze off
    } else {
      color = '#787B86'; // no squeeze
    }
    return { time: bars[i].time, value: 0, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': momData, 'plot1': sqzData },
  };
}

export const SqueezeMomentum = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
