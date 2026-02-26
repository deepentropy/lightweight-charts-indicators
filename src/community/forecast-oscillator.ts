/**
 * Forecast Oscillator (FOSC)
 *
 * Percentage difference between price and its linear regression forecast.
 * fosc = 100 * (src - linreg(src, length, 0)) / src
 *
 * Reference: TradingView "Forecast Oscillator" by KivancOzbilgic
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ForecastOscillatorInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ForecastOscillatorInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FOSC', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Forecast Oscillator',
  shortTitle: 'FOSC',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ForecastOscillatorInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const tsf = ta.linreg(source, length, 0);
  // fosc = 100 * (source - tsf) / source
  const fosc = source.sub(tsf).div(source).mul(100);

  const foscArr = fosc.toArray();
  const data = foscArr.map((value, i) => {
    const v = value ?? NaN;
    const prev = i > 0 ? (foscArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v > prev) color = '#26A69A';       // rising = green
    else if (v < prev) color = '#EF5350';  // falling = red
    else color = '#2962FF';                // neutral = blue
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
    hlines: [{ value: 0, options: { color: '#2962FF', linestyle: 'dashed', title: 'Zero' } }],
  };
}

export const ForecastOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
