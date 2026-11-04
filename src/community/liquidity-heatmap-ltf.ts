/**
 * LTF Activity Heatmap [LuxAlgo]
 *
 * Shows the activity of the lower timeframe bars inside each chart bar. For every chart bar that has lower timeframe
 * bars ("LTF Timeframe", `request.security_lower_tf` of the open, the close and the volume), a vertical line marks
 * the bar range (high to low) in the bullish colour when the bar closed above its open, else the bearish colour. Each
 * lower timeframe bar draws a box from its open to its close, one bar wide; its background is the gradient of its
 * volume between the lowest and the highest volume of the chart bar (first two heatmap colours); the bar with the
 * highest volume takes the third heatmap colour and two horizontal lines at its close and its open. At most 500
 * boxes and 500 lines are kept, as the original.
 *
 * Lower timeframe bars: the chart symbol on "LTF Timeframe" from the chart context (`requiredSymbols`, `bars`
 * accessor); without them the port throws a MissingSymbolDataError that lists them. The original's platform gives
 * at most the last 100,000 lower timeframe bars; the port uses the bars it receives. A lower timeframe equal to the
 * chart timeframe uses the chart bars; above it the port throws.
 *
 * Reference: "Liquidity Heatmap LTF [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  color, box, line, array, timeframe, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import { symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';
import type { StudyDrawingKind } from '../style-outputs';

export interface LiquidityHeatmapLtfInputs {
  /** Lower timeframe */
  res: string;
  /** Heatmap colour of the lowest volume */
  heatmapColor0: string;
  /** Heatmap colour of the highest volume (gradient end) */
  heatmapColor1: string;
  /** Colour of the lower timeframe bar with the highest volume */
  heatmapColor2: string;
  /** Lines of a bullish chart bar */
  bullColor: string;
  /** Lines of a bearish chart bar */
  bearColor: string;
}

export const defaultInputs: LiquidityHeatmapLtfInputs = {
  res: '1',
  heatmapColor0: '#0a0032',
  heatmapColor1: '#880e4f',
  heatmapColor2: '#ffeb3b',
  bullColor: '#0cb51a',
  bearColor: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'res', type: 'timeframe', title: 'LTF Timeframe', defval: '1' },
  { id: 'heatmapColor0', type: 'color', title: 'Heatmap', defval: '#0a0032', group: 'Style', inline: 'inline0' },
  { id: 'heatmapColor1', type: 'color', title: '', defval: '#880e4f', group: 'Style', inline: 'inline0' },
  { id: 'heatmapColor2', type: 'color', title: '', defval: '#ffeb3b', group: 'Style', inline: 'inline0' },
  { id: 'bullColor', type: 'color', title: 'Lines', defval: '#0cb51a', group: 'Style', inline: 'inline1' },
  { id: 'bearColor', type: 'color', title: '', defval: '#ff1100', group: 'Style', inline: 'inline1' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box'];

export const metadata = {
  title: 'LTF Activity Heatmap [LuxAlgo]',
  shortTitle: 'LTF Activity Heatmap [LuxAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

const MAX_OBJECTS = 500;

/** The lower timeframe differs from the chart timeframe: its bars come from the context */
function lowerTimeframeRequested(ltf: string, chartTf: string): boolean {
  return ltf !== '' && timeframe.in_seconds(ltf) !== timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on "LTF Timeframe" (none when it is the chart timeframe). */
export function requiredSymbols(inputs: Partial<LiquidityHeatmapLtfInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = chartTimeframe([], chart);
  if (tf === '' || !lowerTimeframeRequested(cfg.res, tf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.res }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityHeatmapLtfInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // ---- lower timeframe bars (request.security_lower_tf of the chart symbol)
  const chartTf = chartTimeframe(bars, chart) || '1D';
  if (cfg.res !== '' && timeframe.in_seconds(cfg.res) > timeframe.in_seconds(chartTf)) {
    throw new Error(`The lower timeframe "${cfg.res}" is above the chart timeframe "${chartTf}"`);
  }
  let intrabars: (i: number) => Bar[];
  if (n > 0 && lowerTimeframeRequested(cfg.res, chartTf)) {
    const [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: cfg.res }], chart);
    const merge = otherSymbolChart(bars, chart);
    const ranges = securityLowerTf(bars, ltfBars, cfg.res, merge, { other: { timezone: chart?.timezone, session: chart?.session } });
    intrabars = (i) => ltfBars.slice(ranges[i][0], ranges[i][1]);
  } else {
    intrabars = (i) => [bars[i]];
  }

  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS, label: 50 });
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const ib = intrabars(i);
    if (ib.length === 0) continue;
    const b = bars[i];
    const css1 = gt(b.close, b.open) ? cfg.bullColor : cfg.bearColor;
    line.new(i, b.high, i, b.low, 'bar_index', 'none', css1);

    const v = ib.map((x) => x.volume ?? NaN);
    const vMin = array.min(v);
    const vMax = array.max(v);
    for (let k = 0; k < ib.length; k++) {
      const getV = v[k];
      const getO = ib[k].open;
      const getC = ib[k].close;
      const isMax = eq(getV, vMax);
      const css0 = color.from_gradient(getV, vMin, vMax, cfg.heatmapColor0, cfg.heatmapColor1);
      box.new(i, getO, i + 1, getC, 'transparent', undefined, undefined, undefined, undefined,
        isMax ? cfg.heatmapColor2 : css0);
      // Highest body with highest volume
      if (isMax) {
        line.new(i, getC, i + 1, getC, 'bar_index', 'none', css1);
        line.new(i, getO, i + 1, getO, 'bar_index', 'none', css1);
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const LiquidityHeatmapLtf = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  requiredSymbols,
};
