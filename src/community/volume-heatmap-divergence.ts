/**
 * Volume HeatMap Divergence [BigBeluga]
 *
 * Volume as a percentage of its highest value over the last 1,000 bars (`ta.percentile_nearest_rank(volume, 1000,
 * 100)`), drawn as candles from 0 to that percentage on a pane without its own price scale (`scale.none`). The
 * colour runs from aqua to yellow below 20 % and from yellow to red from 20 % to 100 %. The same colour is the bar
 * colour of the original, which is hidden (`display.none`): not drawn by the port.
 *
 * Divergences: a pivot high of the volume percentage (Pivot Left / Right bars) between Range Min and Max bars after
 * the pivot before is bullish when its volume is higher and the low lower than at the pivot before, bearish when its
 * volume is lower and the high higher. The two divergence plots show the volume percentage at each pivot (drawn on
 * the pivot bar, offset -Pivot Right) and take a colour only on divergences. A label with the volume and the
 * percentage marks each divergence on the volume pane (at most 500 labels), and a "Bull" / "Bear" label shape marks
 * the low / high of the pivot bar on the price chart.
 *
 * Chart context: the shape text colour is `chart.fg_color` (`foregroundColorOf`).
 *
 * Reference: "Volume HeatMap Divergence [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, Series, color, str, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { LabelData, MarkerData, PlotCandleData } from '../types';
import { foregroundColorOf, type ChartContext } from '../chart-context';

export interface VolumeHeatmapDivergenceInputs {
  showDiv: boolean;
  labelVolume: boolean;
  labelPercent: boolean;
  minRange: number;
  maxRange: number;
  divLookLeft: number;
  divLookRight: number;
  bullColor: string;
  bearColor: string;
  /** Value of the hidden scale plot (keeps the volume candles low on the pane) */
  sizeOffset: number;
}

export const defaultInputs: VolumeHeatmapDivergenceInputs = {
  showDiv: true,
  labelVolume: true,
  labelPercent: true,
  minRange: 5,
  maxRange: 60,
  divLookLeft: 10,
  divLookRight: 5,
  bullColor: '#19b493',
  bearColor: '#b95919',
  sizeOffset: 400,
};

export const inputConfig: InputConfig[] = [
  { id: 'showDiv', type: 'bool', title: 'Divergence', defval: true, group: 'Divergence', inline: 'div' },
  { id: 'labelVolume', type: 'bool', title: 'Volume', defval: true, group: 'Divergence', inline: 'div', active: 'showDiv' },
  { id: 'labelPercent', type: 'bool', title: 'Percent', defval: true, group: 'Divergence', inline: 'div', active: 'showDiv' },
  { id: 'minRange', type: 'int', title: 'Range Min', defval: 5, inline: 'Range', group: 'Divergence' },
  { id: 'maxRange', type: 'int', title: 'Max', defval: 60, inline: 'Range', group: 'Divergence' },
  { id: 'divLookLeft', type: 'int', title: 'Pivot Left', defval: 10, inline: 'pivot', group: 'Divergence' },
  { id: 'divLookRight', type: 'int', title: 'Right', defval: 5, inline: 'pivot', group: 'Divergence' },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#19b493' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#b95919' },
  { id: 'sizeOffset', type: 'int', title: 'Chart Scale', defval: 400 },
];

export const plotConfig: PlotConfig[] = [
  // plot(sizeOffset, editable = false, color = color(na))
  { id: 'plot0', title: 'Plot', color: 'transparent', lineWidth: 1, editable: false },
  { id: 'plot1', title: 'Bullish Volume HL', color: '#2962FF', lineWidth: 2, offset: -5 },
  { id: 'plot2', title: 'Bearish Volume LH', color: '#2962FF', lineWidth: 2, offset: -5 },
];

export const plotCandleConfig = [{ id: 'candles', title: 'Volume' }];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bullish Price LL Label', style: 'labelup', location: 'absolute', color: '#19b493', text: 'Bull', forceOverlay: true, offset: -5 },
  { id: 'shape1', kind: 'shape', title: 'Bearish Price HH Label', style: 'labeldown', location: 'absolute', color: '#b95919', text: 'Bear', forceOverlay: true, offset: -5 },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const metadata = {
  title: 'Volume HeatMap Divergence [BigBeluga]',
  shortTitle: 'Volume HeatMap Divergence [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeHeatmapDivergenceInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; markers: MarkerData[]; labels?: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const right = cfg.divLookRight;
  const left = cfg.divLookLeft;
  const fg = foregroundColorOf(chart);

  const volume = bars.map((b) => num(b.volume));
  // vol = volume / ta.percentile_nearest_rank(volume, 1000, 100) * 100
  const S = (values: number[]) => Series.fromArray(bars, values);
  const top = ta.percentile_nearest_rank(S(volume), 1000, 100).toArray();
  const vol = volume.map((v, i) => (v / num(top[i])) * 100);
  const volColor = vol.map((v) => (lt(v, 20)
    ? color.from_gradient(v, 0, 20, color.aqua, color.yellow)
    : color.from_gradient(v, 20, 100, color.yellow, color.red)));
  const back = (arr: number[], i: number) => (i - right >= 0 ? arr[i - right] : NaN);
  const volVal = vol.map((_, i) => back(vol, i));
  const lowR = bars.map((_, i) => (i - right >= 0 ? bars[i - right].low : NaN));
  const highR = bars.map((_, i) => (i - right >= 0 ? bars[i - right].high : NaN));

  // VolumeDivergence(showDiv): its ta.* calls run on every bar when showDiv is on, on none when it is off
  const PH = new Array<boolean>(n).fill(false);
  const bull = new Array<boolean>(n).fill(false);
  const bear = new Array<boolean>(n).fill(false);
  if (cfg.showDiv) {
    const piv = ta.pivothigh(S(vol), left, right).toArray();
    for (let i = 0; i < n; i++) PH[i] = !Number.isNaN(num(piv[i]));
    // _inRange(PH[1]): ta.barssince(PH[1])
    const prevPH = PH.map((_, i) => (i > 0 && PH[i - 1] ? 1 : 0));
    const barCount = ta.barssince(S(prevPH)).toArray();
    const cond = S(PH.map((p) => (p ? 1 : 0)));
    const volPrev = ta.valuewhen(cond, S(volVal), 1).toArray();
    const lowPrev = ta.valuewhen(cond, S(lowR), 1).toArray();
    const highPrev = ta.valuewhen(cond, S(highR), 1).toArray();
    for (let i = 0; i < n; i++) {
      const bc = num(barCount[i]);
      const range = cfg.minRange <= bc && bc <= cfg.maxRange;
      const volHL = gt(volVal[i], num(volPrev[i])) && range;
      const priceLL = lt(lowR[i], num(lowPrev[i]));
      bull[i] = PH[i] && volHL && priceLL;
      const volLH = lt(volVal[i], num(volPrev[i])) && range;
      const priceHH = gt(highR[i], num(highPrev[i]));
      bear[i] = PH[i] && volLH && priceHH;
    }
  }

  const plot0 = bars.map((b) => ({ time: b.time, value: cfg.sizeOffset }));
  const candles: PlotCandleData[] = bars.map((b, i) => ({
    time: b.time, open: 0, high: vol[i], low: 0, close: vol[i],
    color: volColor[i] ?? 'transparent', wickColor: volColor[i] ?? 'transparent', borderColor: volColor[i] ?? 'transparent',
  }));
  // barcolor(volColor, display = display.none): hidden, not drawn

  // plot(PH ? volVal : na, offset = -divLookRight, ...): the value of bar i is drawn on bar i - divLookRight
  const plot1: { time: number; value: number; color?: string }[] = [];
  const plot2: { time: number; value: number; color?: string }[] = [];
  for (let i = right; i < n; i++) {
    const t = bars[i - right].time;
    const v = PH[i] ? volVal[i] : NaN;
    plot1.push({ time: t, value: v, color: bull[i] ? cfg.bullColor : 'transparent' });
    plot2.push({ time: t, value: v, color: bear[i] ? cfg.bearColor : 'transparent' });
  }

  resetDrawings({ label: 500 });
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const volTXT = cfg.labelVolume ? '\n' + str.tostring(i - right >= 0 ? volume[i - right] : NaN, 'volume') : '';
    const percentTXT = cfg.labelPercent ? '\n' + str.tostring(back(vol, i), 'percent') : '';
    if (bull[i]) {
      label.new(i - right, volVal[i], 'Bull' + volTXT + percentTXT, 'bar_index', 'price', cfg.bullColor, undefined,
        undefined, 'small');
    }
    if (bear[i]) {
      label.new(i - right, volVal[i], 'Bear' + volTXT + percentTXT, 'bar_index', 'price', cfg.bearColor, undefined,
        undefined, 'small');
    }
    // plotshape(isBullDiv ? low[r] : na, offset = -r, style = shape.labelup, location.absolute, force_overlay)
    if (bull[i] && !Number.isNaN(lowR[i])) {
      markers.push({
        id: 'shape0', time: bars[i - right].time, position: 'atPriceBottom', price: lowR[i], shape: 'labelUp',
        color: cfg.bullColor, text: 'Bull', textColor: fg, forceOverlay: true,
      });
    }
    if (bear[i] && !Number.isNaN(highR[i])) {
      markers.push({
        id: 'shape1', time: bars[i - right].time, position: 'atPriceTop', price: highR[i], shape: 'labelDown',
        color: cfg.bearColor, text: 'Bear', textColor: fg, forceOverlay: true,
      });
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    plotCandles: { candles },
    markers,
    ...drawingOutputs(bars),
  };
}

export const VolumeHeatmapDivergence = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, shapeConfig, drawingKinds,
};
