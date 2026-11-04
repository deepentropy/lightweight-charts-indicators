/**
 * Saty Pivot Ribbon
 *
 * A ribbon of three EMAs of the close (fast 8, pivot 21, slow 34) with two clouds: fast / pivot (bullish colour while
 * fast >= pivot) and pivot / slow (bullish while pivot >= slow). Two conviction EMAs (13 and 48): an up triangle on
 * the bar where the fast one comes back to at or above the slow one, a down triangle where it goes below. Optional
 * candle bias colours: the candle colour from the close against a bias EMA (21) and the candle direction.
 *
 * Every EMA is computed on the "Time Warp" timeframe (the chart timeframe when "off") and shown as the original's
 * `request.security(..., lookahead = barmerge.lookahead_off)` does: on a higher timeframe, the value of the last
 * completed bar of that timeframe (bars built from the chart bars); on a lower timeframe, the value of the last lower
 * bar of each chart bar. While the last chart bar is open the original reads the EMA of the bar before
 * (`ta.ema(...)[barstate.isrealtime ? 1 : 0]`); the port does the same when the chart context says the last bar is
 * open. The original computes the EMAs of the close of the symbol with extended hours inside a request of the
 * symbol with its chart session: the EMAs run on the bars of the chart session, so the port uses the close of these
 * bars.
 *
 * A "Time Warp" timeframe below the chart timeframe needs the bars of the chart symbol on that timeframe: they come
 * from the chart context (`requiredSymbols`, `bars` accessor); without them the port throws a MissingSymbolDataError.
 *
 * Reference: "Saty Pivot Ribbon" by satymahajan
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (C) 2022-2025 Saty Mahajan
 */

import {
  ta, Series, color, timeframe,
  type Bar, type FillConfig, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import { lastBarConfirmedOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { securityOtherValues, otherSymbolChart } from '../other-symbol';

export interface SatyPivotRibbonInputs {
  timeWarp: string;
  fastEma: number;
  pivotEma: number;
  slowEma: number;
  bullishFastCloudColor: string;
  bearishFastCloudColor: string;
  bullishSlowCloudColor: string;
  bearishSlowCloudColor: string;
  cloudTransparency: number;
  showFastEmaHighlight: boolean;
  fastEmaHighlightColor: string;
  showPivotEmaHighlight: boolean;
  pivotEmaHighlightColor: string;
  showSlowEmaHighlight: boolean;
  slowEmaHighlightColor: string;
  showConvictionArrows: boolean;
  bullishConvictionColor: string;
  bearishConvictionColor: string;
  showFastConvictionEma: boolean;
  fastConvictionEma: number;
  fastConvictionEmaColor: string;
  showSlowConvictionEma: boolean;
  slowConvictionEma: number;
  slowConvictionEmaColor: string;
  showCandleBias: boolean;
  biasEma: number;
}

export const defaultInputs: SatyPivotRibbonInputs = {
  timeWarp: 'off',
  fastEma: 8,
  pivotEma: 21,
  slowEma: 34,
  bullishFastCloudColor: '#4CAF50',
  bearishFastCloudColor: '#FF5252',
  bullishSlowCloudColor: '#00BCD4',
  bearishSlowCloudColor: '#FF9800',
  cloudTransparency: 60,
  showFastEmaHighlight: false,
  fastEmaHighlightColor: '#FFFFFF',
  showPivotEmaHighlight: false,
  pivotEmaHighlightColor: '#FFFFFF',
  showSlowEmaHighlight: false,
  slowEmaHighlightColor: '#FFFFFF',
  showConvictionArrows: true,
  bullishConvictionColor: '#00BCD4',
  bearishConvictionColor: '#FFEB3B',
  showFastConvictionEma: true,
  fastConvictionEma: 13,
  fastConvictionEmaColor: '#B2B5BE',
  showSlowConvictionEma: true,
  slowConvictionEma: 48,
  slowConvictionEmaColor: '#9C27B0',
  showCandleBias: false,
  biasEma: 21,
};

const TIME_WARPS = ['off', '1m', '2m', '3m', '4m', '5m', '10m', '15m', '20m', '30m', '1h', '2h', '4h', 'D', 'W', 'M', 'Y'];
/** timeframe_func(): the timeframe of each "Time Warp" option */
const WARP_TF: Record<string, string> = {
  '1m': '1', '2m': '2', '3m': '3', '4m': '4', '5m': '5', '10m': '10', '15m': '15', '20m': '20', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', D: 'D', W: 'W', M: 'M', Y: '12M',
};

export const inputConfig: InputConfig[] = [
  { id: 'timeWarp', type: 'string', title: 'Time Warp', defval: 'off', options: TIME_WARPS },
  { id: 'fastEma', type: 'int', title: 'Fast EMA Length', defval: 8 },
  { id: 'pivotEma', type: 'int', title: 'Pivot EMA Length', defval: 21 },
  { id: 'slowEma', type: 'int', title: 'Slow EMA Length', defval: 34 },
  { id: 'bullishFastCloudColor', type: 'color', title: 'Bullish Fast Cloud Color', defval: '#4CAF50' },
  { id: 'bearishFastCloudColor', type: 'color', title: 'Bearish Fast Cloud Color', defval: '#FF5252' },
  { id: 'bullishSlowCloudColor', type: 'color', title: 'Bullish Slow Cloud Color', defval: '#00BCD4' },
  { id: 'bearishSlowCloudColor', type: 'color', title: 'Bearish Slow Cloud Color', defval: '#FF9800' },
  { id: 'cloudTransparency', type: 'int', title: 'Cloud Transparency (0-100)', defval: 60 },
  { id: 'showFastEmaHighlight', type: 'bool', title: 'Show Fast EMA Highlight', defval: false },
  { id: 'fastEmaHighlightColor', type: 'color', title: 'Fast EMA Highlight Color', defval: '#FFFFFF' },
  { id: 'showPivotEmaHighlight', type: 'bool', title: 'Show Pivot EMA Highlight', defval: false },
  { id: 'pivotEmaHighlightColor', type: 'color', title: 'Pivot EMA Highlight Color', defval: '#FFFFFF' },
  { id: 'showSlowEmaHighlight', type: 'bool', title: 'Show Slow EMA Highlight', defval: false },
  { id: 'slowEmaHighlightColor', type: 'color', title: 'Slow EMA Highlight Color', defval: '#FFFFFF' },
  { id: 'showConvictionArrows', type: 'bool', title: 'Show Conviction Arrows', defval: true },
  { id: 'bullishConvictionColor', type: 'color', title: 'Bullish Conviction Arrow Color', defval: '#00BCD4' },
  { id: 'bearishConvictionColor', type: 'color', title: 'Bearish Conviction Arrow Color', defval: '#FFEB3B' },
  { id: 'showFastConvictionEma', type: 'bool', title: 'Show Fast Conviction EMA', defval: true },
  { id: 'fastConvictionEma', type: 'int', title: 'Fast Conviction EMA Length', defval: 13 },
  { id: 'fastConvictionEmaColor', type: 'color', title: 'Fast Conviction EMA Color', defval: '#B2B5BE' },
  { id: 'showSlowConvictionEma', type: 'bool', title: 'Show Slow Conviction EMA', defval: true },
  { id: 'slowConvictionEma', type: 'int', title: 'Slow Conviction EMA Length', defval: 48 },
  { id: 'slowConvictionEmaColor', type: 'color', title: 'Slow Conviction EMA Color', defval: '#9C27B0' },
  { id: 'showCandleBias', type: 'bool', title: 'Show Candle Bias', defval: false },
  { id: 'biasEma', type: 'int', title: 'Bias EMA', defval: 21 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#2962ff', lineWidth: 1 },
  { id: 'plot1', title: 'Pivot EMA', color: '#2962ff', lineWidth: 1 },
  { id: 'plot2', title: 'Slow EMA', color: '#2962ff', lineWidth: 1 },
  { id: 'plot3', title: 'Fast Conviction EMA', color: '#2962ff', lineWidth: 1 },
  { id: 'plot4', title: 'Slow Conviction EMA', color: '#2962ff', lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Fast Cloud' },
  { id: 'fill1', plot1: 'plot1', plot2: 'plot2', title: 'Slow Cloud' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bullish Conviction', style: 'triangleup', location: 'belowbar', color: '#00BCD4', size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Bearish Conviction', style: 'triangledown', location: 'abovebar', color: '#FFEB3B', size: 'small' },
];

/** plotcandle(open, high, low, close, color = bias_candle_color, ...): untitled */
export const plotCandleConfig = [{ id: 'candle', title: 'Candle Bias' }];

export const metadata = {
  title: 'Saty Pivot Ribbon',
  shortTitle: 'Saty Pivot Ribbon',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** The timeframe of the "Time Warp" option ('' = the chart timeframe) */
function warpTimeframe(warp: string): string {
  return WARP_TF[warp] ?? '';
}

/** Below the chart timeframe: the bars of that timeframe come from the context */
function lowerWarp(tf: string, chartTf: string): boolean {
  return tf !== '' && chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on the "Time Warp" timeframe when it is below the chart timeframe. */
export function requiredSymbols(inputs: Partial<SatyPivotRibbonInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = warpTimeframe(cfg.timeWarp);
  if (!lowerWarp(tf, chartTimeframe([], chart))) return [];
  return [{ symbol: tickeridOf(chart), timeframe: tf }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SatyPivotRibbonInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const live = !lastBarConfirmedOf(chart);
  const chartTf = chartTimeframe(bars, chart) || '1D';
  let tf = warpTimeframe(cfg.timeWarp);
  if (tf !== '' && timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) tf = '';

  // The bars of the requested timeframe and the mapping of an expression on them to the chart bars
  let srcBars: Bar[];
  let toChart: (values: number[]) => number[];
  if (tf === '') {
    srcBars = bars;
    toChart = (values) => values;
  } else if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
    [srcBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: tf }], chart);
    const merge = otherSymbolChart(bars, chart);
    const other = { timezone: chart?.timezone, session: chart?.session };
    toChart = (values) => securityOtherValues(bars, srcBars, tf, values, merge, { other });
  } else {
    const htf = higherTimeframeBars(bars, tf, chart);
    srcBars = htf.htf;
    toChart = (values) => bars.map((_b, i) => {
      // the open last bar reads the expression of its own (realtime) bar of the timeframe
      const k = live && i === n - 1 ? htf.group[i] : htf.latest[i];
      return k >= 0 && k < values.length ? values[k] : NaN;
    });
  }
  const m = srcBars.length;
  const closeS = new Series(srcBars, (b) => b.close);
  // request.security(syminfo.tickerid, tf, ta.ema(price, len)[barstate.isrealtime ? 1 : 0], lookahead_off)
  const emaOf = (len: number): number[] => {
    const e = ta.ema(closeS, len).toArray().map((v) => (v == null ? NaN : v));
    if (live && m > 1) e[m - 1] = e[m - 2];
    return toChart(e);
  };
  const fast = emaOf(cfg.fastEma);
  const pivot = emaOf(cfg.pivotEma);
  const slow = emaOf(cfg.slowEma);
  const fastConv = emaOf(cfg.fastConvictionEma);
  const slowConv = emaOf(cfg.slowConvictionEma);
  const bias = emaOf(cfg.biasEma);

  const line = (values: number[], show: boolean, c: string) => {
    const col = show ? c : 'transparent';
    return bars.map((b, i) => ({ time: b.time, value: Number.isFinite(values[i]) ? values[i] : NaN, color: col }));
  };
  const plots = {
    plot0: line(fast, cfg.showFastEmaHighlight, cfg.fastEmaHighlightColor),
    plot1: line(pivot, cfg.showPivotEmaHighlight, cfg.pivotEmaHighlightColor),
    plot2: line(slow, cfg.showSlowEmaHighlight, cfg.slowEmaHighlightColor),
    plot3: line(fastConv, cfg.showFastConvictionEma, cfg.fastConvictionEmaColor),
    plot4: line(slowConv, cfg.showSlowConvictionEma, cfg.slowConvictionEmaColor),
  };

  // fast_cloud_color = fast_ema_value >= pivot_ema_value ? color.new(bullish, t) : color.new(bearish, t)
  const fastCloud = bars.map((_b, i) => String(color.new(
    ge(fast[i], pivot[i]) ? cfg.bullishFastCloudColor : cfg.bearishFastCloudColor, cfg.cloudTransparency)));
  const slowCloud = bars.map((_b, i) => String(color.new(
    ge(pivot[i], slow[i]) ? cfg.bullishSlowCloudColor : cfg.bearishSlowCloudColor, cfg.cloudTransparency)));
  const fills = [
    { id: 'fill0', plot1: 'plot0', plot2: 'plot1', colors: fastCloud },
    { id: 'fill1', plot1: 'plot1', plot2: 'plot2', colors: slowCloud },
  ];

  const markers: MarkerData[] = [];
  const candles: PlotCandleData[] = [];
  // v5 bools: a comparison with an na EMA is na, and `na == false` is false
  let bull1: boolean | null = null;
  let bear1: boolean | null = null;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // bullish_conviction = fast >= slow; bearish_conviction = fast < slow; confirmed: true now, false on the bar before
    const known = !Number.isNaN(fastConv[i]) && !Number.isNaN(slowConv[i]);
    const bull = known ? ge(fastConv[i], slowConv[i]) : null;
    const bear = known ? lt(fastConv[i], slowConv[i]) : null;
    if (cfg.showConvictionArrows && bull === true && bull1 === false) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: cfg.bullishConvictionColor, size: 'small', id: 'shape0' });
    }
    if (cfg.showConvictionArrows && bear === true && bear1 === false) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: cfg.bearishConvictionColor, size: 'small', id: 'shape1' });
    }
    bull1 = bull;
    bear1 = bear;

    const above = ge(b.close, bias[i]);
    const below = lt(b.close, bias[i]);
    const up = lt(b.open, b.close);
    const doji = eq(b.open, b.close);
    const down = lt(b.close, b.open);
    const show = cfg.showCandleBias;
    const c = above && up && show ? cfg.bullishFastCloudColor
      : below && up && show ? cfg.bearishSlowCloudColor
        : above && down && show ? cfg.bullishSlowCloudColor
          : below && down && show ? cfg.bearishFastCloudColor
            : doji && show ? '#787B86'
              : 'transparent';
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, borderColor: c, wickColor: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    plotCandles: { candle: candles },
  };
}

export const SatyPivotRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  plotCandleConfig,
  requiredSymbols,
};
