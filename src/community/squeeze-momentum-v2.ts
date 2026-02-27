/**
 * Squeeze Momentum V2
 *
 * Enhanced squeeze with 3 Keltner Channel multiplier levels for squeeze intensity.
 * No squeeze = green, low squeeze = orange, mid squeeze = red, high squeeze = black.
 *
 * Reference: TradingView "Squeeze Momentum V2" community indicator
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SqueezeMomentumV2Inputs {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult1: number;
  kcMult2: number;
  kcMult3: number;
  signalPeriod: number;
  src: SourceType;
}

export const defaultInputs: SqueezeMomentumV2Inputs = {
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMult1: 1.0,
  kcMult2: 1.5,
  kcMult3: 2.0,
  signalPeriod: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB MultFactor', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'kcLength', type: 'int', title: 'KC Length', defval: 20, min: 1 },
  { id: 'kcMult1', type: 'float', title: 'KC Mult 1 (High)', defval: 1.0, min: 0.01, step: 0.5 },
  { id: 'kcMult2', type: 'float', title: 'KC Mult 2 (Mid)', defval: 1.5, min: 0.01, step: 0.5 },
  { id: 'kcMult3', type: 'float', title: 'KC Mult 3 (Low)', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Momentum', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze', color: '#787B86', lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: 'Signal', color: '#FF0000', lineWidth: 2 },
];

export const metadata = {
  title: 'Squeeze Momentum V2',
  shortTitle: 'SQZMOMV2',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SqueezeMomentumV2Inputs> = {}): IndicatorResult {
  const { bbLength, bbMult, kcLength, kcMult1, kcMult2, kcMult3, signalPeriod, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // Bollinger Bands
  const bbBasis = ta.sma(source, bbLength);
  const bbDev = ta.stdev(source, bbLength).mul(bbMult);
  const upperBB = bbBasis.add(bbDev);
  const lowerBB = bbBasis.sub(bbDev);

  // 3 Keltner Channel levels
  const [kcUpper1, , kcLower1] = ta.kc(bars, source, kcLength, kcMult1, true);
  const [kcUpper2, , kcLower2] = ta.kc(bars, source, kcLength, kcMult2, true);
  const [kcUpper3, , kcLower3] = ta.kc(bars, source, kcLength, kcMult3, true);

  // Squeeze states
  const sqz1On = lowerBB.gt(kcLower1).and(upperBB.lt(kcUpper1));
  const sqz2On = lowerBB.gt(kcLower2).and(upperBB.lt(kcUpper2));
  const sqz3On = lowerBB.gt(kcLower3).and(upperBB.lt(kcUpper3));
  const sqz1Arr = sqz1On.toArray();
  const sqz2Arr = sqz2On.toArray();
  const sqz3Arr = sqz3On.toArray();

  // Momentum: linreg(close - avg(donchian_mid, sma), kcLength, 0)
  const highSeries = new Series(bars, (bar) => bar.high);
  const lowSeries = new Series(bars, (bar) => bar.low);
  const hh = ta.highest(highSeries, kcLength);
  const ll = ta.lowest(lowSeries, kcLength);
  const donchianMid = hh.add(ll).div(2);
  const smaClose = ta.sma(source, kcLength);
  const midline = donchianMid.add(smaClose).div(2);
  const val = ta.linreg(source.sub(midline), kcLength, 0);
  const valArr = val.toArray();

  const warmup = Math.max(bbLength, kcLength);

  // Momentum histogram: 4-color scheme
  const momData = valArr.map((value, i) => {
    const v = value ?? NaN;
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (valArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#00E676' : '#26A69A';
    } else {
      color = v < prev ? '#FF5252' : '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  // Squeeze dots: black=tight(1x), red=normal(1.5x), orange=wide(2x), green=no squeeze
  const sqzData = valArr.map((value, i) => {
    if (i < warmup || value == null) return { time: bars[i].time, value: NaN };
    let color: string;
    if (sqz1Arr[i]) {
      color = '#000000'; // tight - inside 1x KC
    } else if (sqz2Arr[i]) {
      color = '#FF0000'; // normal - inside 1.5x KC
    } else if (sqz3Arr[i]) {
      color = '#FF6D00'; // wide - inside 2x KC
    } else {
      color = '#00E676'; // no squeeze
    }
    return { time: bars[i].time, value: 0, color };
  });

  // Signal line: SMA of momentum value (Pine: plot(sma(val, SignalPeriod), color=red))
  const valSeries = new Series(bars, (_b, i) => valArr[i] ?? 0);
  const signalArr = ta.sma(valSeries, signalPeriod).toArray();
  const signalData = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': momData, 'plot1': sqzData, 'plot2': signalData },
  };
}

export const SqueezeMomentumV2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
