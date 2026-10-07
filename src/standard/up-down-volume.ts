/**
 * Up/Down Volume
 *
 * Splits each bar's volume into "up" and "down" components: up volume as green columns above zero, down volume as
 * red columns below zero, and the delta (up - down) as a "—" character at its value, green when positive and red
 * otherwise.
 *
 * The standard indicator splits the volume of each bar into up and down volume from lower-timeframe (intrabar)
 * volume: 'Use custom timeframe' / 'Timeframe', else automatic ("1S" on seconds charts, "1" intraday, "5" daily,
 * "60" above). See src/lower-tf-volume.ts:
 * - lower timeframe = chart timeframe (e.g. 'Timeframe' "1D" on a daily chart, automatic on a 1-minute chart): the
 *   chart bars are the intrabars and the values are the original ones (library rule: up when close > open, down
 *   when close < open, else by close vs previous close, else as the previous bar)
 * - lower timeframe below the chart timeframe: the chart bars do not have the intrabar volume; the values are an
 *   estimate that gives all the volume of a bar to "up" when it closes at or above the previous close (first bar:
 *   the open), else to "down"
 * - lower timeframe above the chart timeframe: error, as the original
 * The design (columns, colours, delta character) is the one of the standard indicator.
 *
 * PineScript display:
 *   plot(upVolume, "Up Volume", style = plot.style_columns, color = color.new(color.green, 60))
 *   plot(downVolume, "Down Volume", style = plot.style_columns, color = color.new(color.red, 60))
 *   plotchar(delta, "delta", "—", location.absolute, color = delta > 0 ? color.green : color.red, size = size.tiny)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { lowerTimeframe, upDownVolumeOfChartBars } from '../lower-tf-volume';

export interface UpDownVolumeInputs {
  /** Use the custom lower timeframe instead of the automatic one */
  useCustomTimeframe: boolean;
  /** Custom lower timeframe of the intrabar volume */
  lowerTimeframe: string;
}

export const defaultInputs: UpDownVolumeInputs = {
  useCustomTimeframe: false,
  lowerTimeframe: '1',
};

const LOWER_TF_TOOLTIP = 'The indicator scans lower timeframe data to approximate Up/Down volume.  By default, the timeframe is chosen automatically. These inputs override this with a custom timeframe. \n\nHigher timeframes provide more historical data, but the data will be less precise.';

export const inputConfig: InputConfig[] = [
  { id: 'useCustomTimeframe', type: 'bool', title: 'Use custom timeframe', defval: false, tooltip: LOWER_TF_TOOLTIP, display: 'none' },
  { id: 'lowerTimeframe', type: 'timeframe', title: 'Timeframe', defval: '1', active: 'useCustomTimeframe' },
];

// color.new(color.green, 60) / color.new(color.red, 60): alpha 0.4 = 102 = 0x66
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Volume', color: '#4CAF5066', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Volume', color: '#F2364566', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Up/Down Volume',
  shortTitle: 'Up/Dn Vol',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<UpDownVolumeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { useCustomTimeframe, lowerTimeframe: customTimeframe } = { ...defaultInputs, ...inputs };
  const { exact } = lowerTimeframe(bars, useCustomTimeframe, customTimeframe);
  const exactVolume = exact ? upDownVolumeOfChartBars(bars) : null;
  const up: { time: number; value: number }[] = [];
  const down: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < bars.length; i++) {
    let upVol: number;
    let downVol: number;
    if (exactVolume) {
      // Lower timeframe = chart timeframe: the original values
      upVol = exactVolume.up[i];
      downVol = -exactVolume.down[i];
    } else {
      const vol = bars[i].volume ?? 0;
      // Estimate: direction from close vs previous close; first bar falls back to close vs open.
      const ref = i > 0 ? bars[i - 1].close : bars[i].open;
      const isUp = bars[i].close >= ref;
      upVol = isUp ? vol : 0;
      downVol = isUp ? 0 : vol;
    }
    const delta = upVol - downVol;

    up.push({ time: bars[i].time, value: upVol });
    down.push({ time: bars[i].time, value: -downVol }); // plotted below zero
    // plotchar(delta, "delta", "—", location.absolute, color = delta > 0 ? color.green : color.red, size = size.tiny)
    markers.push({
      time: bars[i].time,
      position: 'atPriceMiddle',
      price: delta,
      shape: 'circle',
      color: 'transparent',
      text: '—',
      textColor: gt(delta, 0) ? '#4CAF50' : '#F23645',
      size: 'tiny',
    });
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': up,
      'plot1': down,
    },
    markers,
  };
}

export const UpDownVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
