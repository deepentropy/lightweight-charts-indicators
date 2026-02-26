/**
 * Connors RSI Indicator
 *
 * Composite momentum oscillator combining RSI, streak RSI, and percent rank of ROC.
 * CRSI = avg(RSI(close,3), RSI(updown(close),2), percentrank(ROC(close,1),100))
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';

export interface ConnorsRSIInputs {
  lenrsi: number;
  lenupdown: number;
  lenroc: number;
}

export const defaultInputs: ConnorsRSIInputs = {
  lenrsi: 3,
  lenupdown: 2,
  lenroc: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenrsi', type: 'int', title: 'RSI Length', defval: 3, min: 1 },
  { id: 'lenupdown', type: 'int', title: 'UpDown Length', defval: 2, min: 1 },
  { id: 'lenroc', type: 'int', title: 'ROC Length', defval: 100, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CRSI', color: '#2962FF', lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 30, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Connors RSI',
  shortTitle: 'CRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ConnorsRSIInputs> = {}): IndicatorResult {
  const { lenrsi, lenupdown, lenroc } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // updown streak counter
  const ud: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const s = bars[i].close;
    const sPrev = bars[i - 1].close;
    if (s === sPrev) {
      ud.push(0);
    } else if (s > sPrev) {
      ud.push(ud[i - 1] <= 0 ? 1 : ud[i - 1] + 1);
    } else {
      ud.push(ud[i - 1] >= 0 ? -1 : ud[i - 1] - 1);
    }
  }

  const udSeries = new Series(bars, (_, i) => ud[i]);

  // Three components
  const rsi = ta.rsi(close, lenrsi);
  const updownRsi = ta.rsi(udSeries, lenupdown);
  const roc1 = ta.roc(close, 1);
  const pr = ta.percentrank(roc1, lenroc);

  const rsiArr = rsi.toArray();
  const udRsiArr = updownRsi.toArray();
  const prArr = pr.toArray();

  // CRSI = math.avg(rsi, updownrsi, percentrank) = (a + b + c) / 3
  const crsiData = bars.map((bar, i) => {
    const a = rsiArr[i], b = udRsiArr[i], c = prArr[i];
    const value = (a != null && b != null && c != null) ? (a + b + c) / 3 : NaN;
    return { time: bar.time, value };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': crsiData },
  };
}

export const ConnorsRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
