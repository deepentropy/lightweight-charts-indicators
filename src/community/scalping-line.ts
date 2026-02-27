/**
 * Scalping Line Indicator
 *
 * Non-overlay oscillator: ScalpLine = SMA(close, signalPeriod) - ssMA
 * where ssMA is a double-smoothed SMA clamped to close when price moves beyond percent band.
 * Fill between ScalpLine and zero: green when >= 0, red when < 0.
 *
 * Reference: TradingView "Scalping Line Indicator" by KivancOzbilgic
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ScalpingLineInputs {
  src: SourceType;
  percent: number;
  mainPeriod: number;
  signalPeriod: number;
}

export const defaultInputs: ScalpingLineInputs = {
  src: 'close',
  percent: 1.0,
  mainPeriod: 100,
  signalPeriod: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'percent', type: 'float', title: 'Percent', defval: 1.0, min: 0, step: 0.1 },
  { id: 'mainPeriod', type: 'int', title: 'Main Period', defval: 100, min: 1 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 7, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Scalp Line', color: '#800000', lineWidth: 2 },
  { id: 'plot1', title: 'Zero', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Scalping Line',
  shortTitle: 'SLI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ScalpingLineInputs> = {}): IndicatorResult {
  const { src, percent, mainPeriod, signalPeriod } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const closeArr = source.toArray();

  // MA = sma(sma(src, ceil(mainPeriod/2)), floor(mainPeriod/2) + 1)
  const halfUp = Math.ceil(mainPeriod / 2);
  const halfDown = Math.floor(mainPeriod / 2) + 1;
  const sma1 = ta.sma(source, halfUp);
  const smaArr = ta.sma(sma1, halfDown).toArray();

  // ssMA: clamp MA to close when price moves beyond percent band
  const ssMAArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ma = smaArr[i];
    const c = closeArr[i] ?? 0;
    if (ma == null || isNaN(ma)) {
      ssMAArr[i] = NaN;
      continue;
    }
    const band = ma * percent / 100;
    if (ma > c + band) {
      ssMAArr[i] = ma;
    } else if (ma < c - band) {
      ssMAArr[i] = ma;
    } else {
      ssMAArr[i] = c;
    }
  }

  // signalline = sma(close, signalPeriod)
  const signalArr = ta.sma(source, signalPeriod).toArray();

  // ScalpLine = signalline - ssMA
  const scalpArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const sig = signalArr[i];
    const ss = ssMAArr[i];
    scalpArr[i] = (sig != null && !isNaN(sig) && !isNaN(ss)) ? sig - ss : NaN;
  }

  const warmup = halfUp + halfDown;

  const plot0 = scalpArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  const plot1 = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup ? NaN : 0,
  }));

  // Dynamic fill colors: green when ScalpLine >= 0, red when < 0
  const fillColors = scalpArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v >= 0 ? 'rgba(0,128,0,0.2)' : 'rgba(255,0,0,0.2)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,128,0,0.2)' }, colors: fillColors }],
  };
}

export const ScalpingLine = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
