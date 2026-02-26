/**
 * Woodies CCI Indicator
 *
 * Consists of CCI with a turbo CCI for faster signals.
 * CCI Turbo = 6-period CCI
 * CCI 14 = 14-period CCI
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';

export interface WoodiesCCIInputs {
  /** Turbo CCI period */
  turboLength: number;
  /** Standard CCI period */
  cciLength: number;
}

export const defaultInputs: WoodiesCCIInputs = {
  turboLength: 6,
  cciLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'turboLength', type: 'int', title: 'Turbo CCI Length', defval: 6, min: 1 },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI Turbo Histogram', color: '#009688', lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: 'CCI Turbo', color: '#009688', lineWidth: 1 },
  { id: 'plot2', title: 'CCI 14', color: '#F44336', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 100, color: '#787B86', linestyle: 'dotted', title: 'Hundred Line' },
  { id: 'hline_mid',   price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
  { id: 'hline_lower', price: -100, color: '#787B86', linestyle: 'dotted', title: 'Minus Line' },
];

export const fillConfig: FillConfig[] = [];

export const metadata = {
  title: 'Woodies CCI',
  shortTitle: 'WCCI',
  overlay: false,
};

/**
 * Calculate CCI
 * CCI = (typicalPrice - SMA(typicalPrice, length)) / (0.015 * meanDeviation)
 */
function cci(typicalPrice: number[], length: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < typicalPrice.length; i++) {
    if (i < length - 1) {
      result.push(NaN);
      continue;
    }

    // Calculate SMA
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) {
      sum += typicalPrice[j];
    }
    const sma = sum / length;

    // Calculate Mean Deviation
    let devSum = 0;
    for (let j = i - length + 1; j <= i; j++) {
      devSum += Math.abs(typicalPrice[j] - sma);
    }
    const meanDev = devSum / length;

    if (meanDev === 0) {
      result.push(0);
    } else {
      result.push((typicalPrice[i] - sma) / (0.015 * meanDev));
    }
  }

  return result;
}

export function calculate(bars: Bar[], inputs: Partial<WoodiesCCIInputs> = {}): IndicatorResult {
  const { turboLength, cciLength } = { ...defaultInputs, ...inputs };

  // TradingView's Woodies CCI uses close as source (not hlc3)
  const source = bars.map(b => b.close);

  // Calculate both CCIs
  const cciTurbo = cci(source, turboLength);
  const cci14Values = cci(source, cciLength);

  // CCI Turbo Histogram = CCI 14 (displayed as histogram)
  // Color logic: green if last 5 bars all positive, red if last 5 all negative,
  // otherwise green if current < 0, red if current >= 0
  const histogramData = cci14Values.map((value, i) => {
    const v = value ?? NaN;
    let color: string;
    if (i >= 5) {
      const last5Up = cci14Values[i-5] > 0 && cci14Values[i-4] > 0 && cci14Values[i-3] > 0 && cci14Values[i-2] > 0 && cci14Values[i-1] > 0;
      const last5Down = cci14Values[i-5] < 0 && cci14Values[i-4] < 0 && cci14Values[i-3] < 0 && cci14Values[i-2] < 0 && cci14Values[i-1] < 0;
      color = last5Up ? '#009688' : last5Down ? '#F44336' : v < 0 ? '#009688' : '#F44336';
    } else {
      color = v >= 0 ? '#009688' : '#F44336';
    }
    return { time: bars[i].time, value: v, color };
  });

  const turboData = cciTurbo.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const cci14Data = cci14Values.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': histogramData,
      'plot1': turboData,
      'plot2': cci14Data,
    },
  };
}

export const WoodiesCCI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
