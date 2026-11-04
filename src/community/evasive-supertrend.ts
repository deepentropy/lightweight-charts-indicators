/**
 * Evasive SuperTrend [LuxAlgo]
 *
 * A SuperTrend band on hl2 +/- multiplier * ATR that moves away from the price when the price comes too close.
 * When the distance between the close and the band of the bar before is below "Noise Threshold" * ATR, the bar is
 * noisy: the band is pushed "Expansion Alpha" * ATR away from the price (down in an up trend, up in a down trend)
 * instead of following the usual SuperTrend rule. A close through the band flips the trend and the band jumps to the
 * other side.
 *
 * Outputs: a dot where the trend flips, the band (solid on normal bars, dotted on noisy bars, green in an up trend,
 * red in a down trend), a gradient fill between the band and hl2 (less transparent near the price) and a BULL / BEAR
 * label on each flip (at most 500 labels are kept).
 *
 * Reference: "Evasive SuperTrend [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, color, label, resetDrawings, setDrawingBar,
  type Bar, type FillConfig, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { LabelData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

export interface EvasiveSupertrendInputs {
  /** ATR length */
  lengthInput: number;
  /** Base multiplier of the ATR */
  multiplierInput: number;
  /** A close nearer to the band than this many ATRs is noise */
  thresholdInput: number;
  /** ATRs the band is pushed away on a noisy bar */
  alphaInput: number;
  /** Show the BULL / BEAR labels */
  showLabelsInput: boolean;
  /** Show the gradient fill */
  showFillsInput: boolean;
}

export const defaultInputs: EvasiveSupertrendInputs = {
  lengthInput: 10,
  multiplierInput: 3.0,
  thresholdInput: 1.0,
  alphaInput: 0.5,
  showLabelsInput: true,
  showFillsInput: true,
};

const ST_GROUP = 'Supertrend Settings';
const NOISE_GROUP = 'Noise Avoidance Logic';
const VISUAL_GROUP = 'Visualization';

export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'ATR Length', defval: 10, min: 1, group: ST_GROUP },
  { id: 'multiplierInput', type: 'float', title: 'Base Multiplier', defval: 3.0, min: 0.1, step: 0.1, group: ST_GROUP },
  {
    id: 'thresholdInput', type: 'float', title: 'Noise Threshold (xATR)', defval: 1.0, min: 0.1, step: 0.1, group: NOISE_GROUP,
    tooltip: 'If price gets closer to the band than this value, the band is pushed away.',
  },
  {
    id: 'alphaInput', type: 'float', title: 'Expansion Alpha (xATR)', defval: 0.5, min: 0, step: 0.1, group: NOISE_GROUP,
    tooltip: 'Distance (in ATRs) to push the band away when noise is detected.',
  },
  { id: 'showLabelsInput', type: 'bool', title: 'Show Signal Labels', defval: true, group: VISUAL_GROUP },
  { id: 'showFillsInput', type: 'bool', title: 'Show Gradient Fills', defval: true, group: VISUAL_GROUP },
];

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Switch Dot', color: BULL_COLOR, lineWidth: 4, style: 'circles', palette: [BULL_COLOR, BEAR_COLOR] },
  { id: 'plot1', title: 'Band for Fill', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Solid Band', color: BULL_COLOR, lineWidth: 2, style: 'linebr', palette: [BULL_COLOR, BEAR_COLOR] },
  {
    id: 'plot3', title: 'Dotted Band', color: BULL_COLOR, lineWidth: 2, style: 'linebr', linestyle: 'dotted',
    palette: [BULL_COLOR, BEAR_COLOR],
  },
  { id: 'plot4', title: 'Source', color: 'transparent', lineWidth: 1 },
];

const BULL_50 = String(color.new(BULL_COLOR, 50));
const BULL_100 = String(color.new(BULL_COLOR, 100));
const BEAR_50 = String(color.new(BEAR_COLOR, 50));
const BEAR_100 = String(color.new(BEAR_COLOR, 100));

/** fill(plotId, srcId, topValue, bottomValue, topFillColor, bottomFillColor, display = showFillsInput ? ...) */
export const fillConfig: FillConfig[] = [
  {
    id: 'fill0', plot1: 'plot1', plot2: 'plot4', title: 'Trend Fill', visible: 'showFillsInput',
    topColor: BULL_50, bottomColor: BEAR_50,
  },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const metadata = {
  title: 'Evasive SuperTrend [LuxAlgo]',
  shortTitle: 'LuxAlgo - Evasive SuperTrend',
  overlay: true,
};

/** Pine float comparison: a < b only when b - a > 1e-10 (na compares false) */
const lt = (a: number, b: number) => b - a > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<EvasiveSupertrendInputs> = {},
): IndicatorResult & { labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const atr = ta.atr(bars, cfg.lengthInput).toArray().map((v) => v ?? NaN);

  resetDrawings({ label: 500 });

  const pDot: { time: number; value: number; color: string }[] = [];
  const pBand: { time: number; value: number }[] = [];
  const pSolid: { time: number; value: number; color: string }[] = [];
  const pDotted: { time: number; value: number; color: string }[] = [];
  const pSrc: { time: number; value: number }[] = [];
  const topValue: number[] = [];
  const bottomValue: number[] = [];
  const topColor: Array<string | null> = [];
  const bottomColor: Array<string | null> = [];

  let stBand = NaN; // var float stBand = na
  let trend = 1; // var int trend = 1
  let prevTrend = NaN; // trend[1]: na on the first bar

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const a = atr[i];
    const src = (b.high + b.low) / 2;
    const upperBase = src + cfg.multiplierInput * a;
    const lowerBase = src - cfg.multiplierInput * a;

    // nz(stBand[1], trend == 1 ? lowerBase : upperBase)
    const prevBand = isNaN(stBand) ? (trend === 1 ? lowerBase : upperBase) : stBand;
    const isNoisy = lt(Math.abs(b.close - prevBand), a * cfg.thresholdInput);

    if (trend === 1) {
      // math.max with an na argument is na
      stBand = isNoisy ? prevBand - a * cfg.alphaInput : Math.max(lowerBase, prevBand);
      if (lt(b.close, stBand)) {
        trend = -1;
        stBand = upperBase;
      }
    } else {
      stBand = isNoisy ? prevBand + a * cfg.alphaInput : Math.min(upperBase, prevBand);
      if (lt(stBand, b.close)) {
        trend = 1;
        stBand = lowerBase;
      }
    }

    // trend != trend[1]: false on the first bar (na compares false)
    const trendChanged = !isNaN(prevTrend) && trend !== prevTrend;
    prevTrend = trend;
    const stColor = trend === 1 ? BULL_COLOR : BEAR_COLOR;

    pDot.push({ time: b.time, value: trendChanged ? stBand : NaN, color: stColor });
    pBand.push({ time: b.time, value: stBand });
    pSolid.push({ time: b.time, value: isNoisy ? NaN : stBand, color: stColor });
    pDotted.push({ time: b.time, value: isNoisy ? stBand : NaN, color: stColor });
    pSrc.push({ time: b.time, value: src });

    topValue.push(isNaN(stBand) ? NaN : Math.max(src, stBand));
    bottomValue.push(isNaN(stBand) ? NaN : Math.min(src, stBand));
    topColor.push(trend === 1 ? BULL_50 : BEAR_100);
    bottomColor.push(trend === 1 ? BULL_100 : BEAR_50);

    if (cfg.showLabelsInput && trendChanged) {
      label.new(i, stBand, trend === 1 ? 'BULL' : 'BEAR', 'bar_index', 'price', stColor,
        trend === 1 ? 'label_up' : 'label_down', '#FFFFFF', 'tiny');
    }
  }
  setDrawingBar(null);

  const labels: LabelData[] = label.all().map((l) => ({
    time: bars[l.x].time,
    price: l.y,
    text: l.text ?? '',
    color: String(l.color),
    textColor: '#FFFFFF',
    style: l.style as 'label_up' | 'label_down',
    size: 'tiny',
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: pDot, plot1: pBand, plot2: pSolid, plot3: pDotted, plot4: pSrc },
    fills: cfg.showFillsInput
      ? [{ id: 'fill0', plot1: 'plot1', plot2: 'plot4', options: { title: 'Trend Fill' }, gradient: { topValue, bottomValue, topColor, bottomColor } }]
      : [],
    labels,
  };
}

export const EvasiveSupertrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  drawingKinds,
};
