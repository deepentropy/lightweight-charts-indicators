/**
 * Volume Candle Highlighter
 *
 * A bar is abnormal when its volume is at least `abnormalMul` times the SMA of the volume over `volMaLen` bars.
 * The candles are redrawn with the abnormal colours on abnormal bars and with the bull / bear colours otherwise
 * (bull: close >= open). Abnormal bars get a triangle marker (up below a bull bar, down above a bear bar) and,
 * optionally, a background colour.
 *
 * Reference: "Volume Candle Highlighter" by Dougie_dee
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData, PineSize, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeCandleHighlighterInputs {
  /** Abnormal volume multiplier */
  abnormalMul: number;
  /** Volume MA length */
  volMaLen: number;
  bullColor: string;
  bearColor: string;
  abnColor: string;
  bullBorder: string;
  bearBorder: string;
  abnBorder: string;
  bullWick: string;
  bearWick: string;
  abnWick: string;
  showMarker: boolean;
  markerColor: string;
  markerSize: 'Tiny' | 'Small' | 'Normal' | 'Large';
  /** Background colour on abnormal bars */
  showBg: boolean;
  abnBg: string;
}

const WHITE = String(color.new(color.white, 0));
const GOLD = String(color.new('#FFD700', 0));
const GOLD_BG = String(color.new('#FFD700', 85));

export const defaultInputs: VolumeCandleHighlighterInputs = {
  abnormalMul: 2.0,
  volMaLen: 20,
  bullColor: WHITE,
  bearColor: WHITE,
  abnColor: GOLD,
  bullBorder: WHITE,
  bearBorder: WHITE,
  abnBorder: GOLD,
  bullWick: WHITE,
  bearWick: WHITE,
  abnWick: GOLD,
  showMarker: true,
  markerColor: GOLD,
  markerSize: 'Normal',
  showBg: false,
  abnBg: GOLD_BG,
};

export const inputConfig: InputConfig[] = [
  { id: 'abnormalMul', type: 'float', title: 'Abnormal Volume Multiplier', defval: 2.0, min: 1.1, max: 5.0, step: 0.1, group: '── Volume ──' },
  { id: 'volMaLen', type: 'int', title: 'Volume MA Length', defval: 20, min: 5, max: 50, group: '── Volume ──' },
  { id: 'bullColor', type: 'color', title: 'Normal Bull Candle', defval: WHITE, group: '── Candle Colors ──' },
  { id: 'bearColor', type: 'color', title: 'Normal Bear Candle', defval: WHITE, group: '── Candle Colors ──' },
  { id: 'abnColor', type: 'color', title: 'Abnormal Candle', defval: GOLD, group: '── Candle Colors ──' },
  { id: 'bullBorder', type: 'color', title: 'Normal Bull Border', defval: WHITE, group: '── Border Colors ──' },
  { id: 'bearBorder', type: 'color', title: 'Normal Bear Border', defval: WHITE, group: '── Border Colors ──' },
  { id: 'abnBorder', type: 'color', title: 'Abnormal Border', defval: GOLD, group: '── Border Colors ──' },
  { id: 'bullWick', type: 'color', title: 'Normal Bull Wick', defval: WHITE, group: '── Wick Colors ──' },
  { id: 'bearWick', type: 'color', title: 'Normal Bear Wick', defval: WHITE, group: '── Wick Colors ──' },
  { id: 'abnWick', type: 'color', title: 'Abnormal Wick', defval: GOLD, group: '── Wick Colors ──' },
  { id: 'showMarker', type: 'bool', title: 'Show Marker', defval: true, group: '── Marker ──' },
  { id: 'markerColor', type: 'color', title: 'Marker Color', defval: GOLD, group: '── Marker ──' },
  { id: 'markerSize', type: 'string', title: 'Marker Size', defval: 'Normal', options: ['Tiny', 'Small', 'Normal', 'Large'], group: '── Marker ──' },
  { id: 'showBg', type: 'bool', title: 'Flash Background', defval: false, group: '── Marker ──' },
  { id: 'abnBg', type: 'color', title: 'Background Color', defval: GOLD_BG, group: '── Marker ──' },
];

export const plotConfig: PlotConfig[] = [
  // plot(na, display = display.none)
  { id: 'plot0', title: 'Empty Plot', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Volume Candle Highlighter',
  shortTitle: 'VolCandles',
  overlay: true,
};

/** Pine a >= b: false with na; equal within 1e-10 */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

const SIZES: Record<VolumeCandleHighlighterInputs['markerSize'], PineSize> = {
  Tiny: 'tiny',
  Small: 'small',
  Normal: 'normal',
  Large: 'large',
};

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  bgColors: BgColorData[];
  plotCandles: Record<string, PlotCandleData[]>;
};

interface VchRun extends BarRunState<Record<string, never>> {
  avg: WindowSma;
  plot0: { time: Bar['time']; value: number }[];
  candles: PlotCandleData[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<VolumeCandleHighlighterInputs>): BarStudy<VchRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // The script has one plotshape per size (a const size); only the one of the selected size can fire.
  const size = SIZES[cfg.markerSize];
  // Style ids: shape0 .. shape3 = the bull markers Tiny .. Large, shape4 .. shape7 = the bear markers
  const sizeIndex = (['Tiny', 'Small', 'Normal', 'Large'] as const).indexOf(cfg.markerSize);
  return {
    init() {
      // avg_vol = ta.sma(volume, vol_ma_len)
      const avg = new WindowSma(cfg.volMaLen);
      const s: VchRun = {
        avg, plot0: [], candles: [], markers: [], bgColors: [],
        steps: [avg], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.plot0, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const avgVol = s.avg.step(volume) ?? NaN;
      // abnormal = volume >= avg_vol * abnormal_mul; bull = close >= open
      const abnormal = ge(volume, avgVol * cfg.abnormalMul);
      const bull = ge(b.close, b.open);
      s.candles[i] = {
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: abnormal ? cfg.abnColor : bull ? cfg.bullColor : cfg.bearColor,
        wickColor: abnormal ? cfg.abnWick : bull ? cfg.bullWick : cfg.bearWick,
        borderColor: abnormal ? cfg.abnBorder : bull ? cfg.bullBorder : cfg.bearBorder,
      };
      if (cfg.showMarker && abnormal && size) {
        s.markers.push(bull
          ? { time: b.time, position: 'belowBar', shape: 'triangleUp', color: cfg.markerColor, size, id: `shape${sizeIndex}` }
          : { time: b.time, position: 'aboveBar', shape: 'triangleDown', color: cfg.markerColor, size, id: `shape${4 + sizeIndex}` });
      }
      // bgcolor(show_bg and abnormal ? abn_bg : na)
      if (cfg.showBg && abnormal) s.bgColors.push({ time: b.time, color: cfg.abnBg });
      s.plot0[i] = { time: b.time, value: NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        plotCandles: { candles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeCandleHighlighterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeCandleHighlighterInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  bgColors: BgColorData[];
  plotCandles: Record<string, PlotCandleData[]>;
} {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeCandleHighlighter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
