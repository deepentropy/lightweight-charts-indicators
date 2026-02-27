/**
 * Realtime Volume Bars w Market Buy/Sell/Neutral Split & Mkt Delta
 *
 * Splits volume into buy/sell/neutral components based on price direction.
 * Buy volume = volume on uptick bars, Sell = downtick bars, Neutral = flat.
 * Includes volume MA and delta direction bar coloring.
 *
 * Reference: TradingView "Volume with Market Buy/Sell and Neutral Volume Split" by the_MarketWhisperer
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';

export interface RealtimeVolumeBarsInputs {
  mode: string;
  showSplit: boolean;
  showMA: boolean;
  maPeriod: number;
  showDelta: boolean;
}

export const defaultInputs: RealtimeVolumeBarsInputs = {
  mode: 'Up/Down/Neutral',
  showSplit: true,
  showMA: false,
  maPeriod: 20,
  showDelta: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Mode', defval: 'Up/Down/Neutral', options: ['Up/Down/Neutral', 'Up/Down'] },
  { id: 'showSplit', type: 'bool', title: 'Show Split', defval: true },
  { id: 'showMA', type: 'bool', title: 'Show MA', defval: false },
  { id: 'maPeriod', type: 'int', title: 'MA Period', defval: 20, min: 1 },
  { id: 'showDelta', type: 'bool', title: 'Show Net Delta Above Bar', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Up', color: '#00FF00', lineWidth: 4, style: 'columns' },
  { id: 'plot1', title: 'Volume Down', color: '#FF0000', lineWidth: 4, style: 'columns' },
  { id: 'plot2', title: 'Volume Neutral', color: '#808080', lineWidth: 4, style: 'columns' },
  { id: 'plot3', title: 'Volume MA', color: '#000000', lineWidth: 1 },
];

export const metadata = {
  title: 'Realtime Volume Bars',
  shortTitle: 'VolBuySell',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RealtimeVolumeBarsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { mode, showSplit, showMA, maPeriod, showDelta } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const isUpDownOnly = mode === 'Up/Down';

  // For historical bars, split volume based on close vs previous close
  const volUp: number[] = new Array(n).fill(0);
  const volDn: number[] = new Array(n).fill(0);
  const volNt: number[] = new Array(n).fill(0);

  let prevPolarity = 0;
  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].open;

    if (bars[i].close > prevClose) {
      prevPolarity = 1;
      volUp[i] = vol;
    } else if (bars[i].close < prevClose) {
      prevPolarity = -1;
      volDn[i] = vol;
    } else {
      // Neutral
      if (isUpDownOnly) {
        if (prevPolarity === 1) volUp[i] = vol;
        else if (prevPolarity === -1) volDn[i] = vol;
        else volNt[i] = vol;
      } else {
        volNt[i] = vol;
      }
    }
  }

  // Volume MA
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const volMaArr = ta.ema(volSeries, maPeriod).toArray();

  // Build plots
  // Pine: buySeries = volume (full height green), sellSeries = volDn + volNt (stacked below),
  //        neutralSeries = volNt (stacked at bottom)
  // When showSplit is false, show total volume colored by direction
  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number; color?: string }[] = [];
  const plot2: { time: number; value: number; color?: string }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const vol = bars[i].volume ?? 0;

    if (!showSplit) {
      // No split: show as regular volume colored by direction
      const color = bars[i].close > bars[i].open ? '#0000FF' : bars[i].close < bars[i].open ? '#000000' : '#808080';
      plot0.push({ time: t, value: vol, color });
      plot1.push({ time: t, value: 0 });
      plot2.push({ time: t, value: 0 });
    } else {
      // Pine stacking: green column = total vol, red column = volDn + volNt, gray = volNt
      plot0.push({ time: t, value: vol, color: '#00FF00' });
      plot1.push({ time: t, value: volDn[i] + volNt[i], color: '#FF0000' });
      plot2.push({ time: t, value: volNt[i], color: '#808080' });
    }

    plot3.push({ time: t, value: showMA ? (volMaArr[i] ?? NaN) : NaN });

    // Delta markers (replacing label.new)
    if (showDelta) {
      const delta = volUp[i] - volDn[i];
      if (delta !== 0) {
        markers.push({
          time: t,
          position: 'aboveBar',
          shape: 'circle',
          color: delta > 0 ? '#00FF00' : '#FF0000',
          text: String(Math.round(delta)),
          size: 1,
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    markers,
  };
}

export const RealtimeVolumeBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
