/**
 * Market Structure Confluence [AlgoAlpha]
 *
 * Market structure from swing pivots ("Time-Horizon" bars on each side): each swing high is a higher high (HH) or a
 * lower high (LH) against the swing high before, each swing low a higher low (HL) or a lower low (LL). A close (or a
 * wick, "BOS Confirmation") beyond the last swing high / low breaks it once: a line from the swing to the break and a
 * "BOS" label, or "CHoCH" when the break is against the direction of the last break. The last break sets the trend.
 *
 * Bands: a 100-bar WMA of the close +- "Volatility Multiplier" times the 21-bar SMA of the 14-bar ATR. In a bullish
 * structure the lower band is drawn, in a bearish one the upper band; a bar whose range crosses the drawn band gives a
 * rejection mark one ATR beyond it. A dot marks the band on each trend change. Bars are coloured by the trend.
 * At most 500 lines and 500 labels are kept.
 *
 * Reference: "Market Structure Confluence [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, color, line, label, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type BarColorConfig, type IndicatorResult, type InputConfig, type MarkerData, type PlotConfig,
  type ShapeConfig, type BarColorData,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { lastBarConfirmedOf } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface MarketStructureConfluenceInputs {
  swingSize: number;
  bosConfType: 'Candle Close' | 'Wicks';
  bosStyleIn: 'Solid' | 'Dashed' | 'Dotted';
  showCHoCH: boolean;
  showSwing: boolean;
  basisLength: number;
  atrLength: number;
  atrSmooth: number;
  volMult: number;
  colBull: string;
  colBear: string;
  /** Alerts only on closed bars */
  waitClose: boolean;
}

export const defaultInputs: MarketStructureConfluenceInputs = {
  swingSize: 10,
  bosConfType: 'Candle Close',
  bosStyleIn: 'Solid',
  showCHoCH: true,
  showSwing: true,
  basisLength: 100,
  atrLength: 14,
  atrSmooth: 21,
  volMult: 2.0,
  colBull: '#00FFBB',
  colBear: '#FF1100',
  waitClose: true,
};

const MS = 'Market Structure';
const BANDS = 'Band Settings';
const APPEARANCE = 'Appearance';
const ALERTS = '⚠️ Alerts';

export const inputConfig: InputConfig[] = [
  { id: 'swingSize', type: 'int', title: 'Time-Horizon', defval: 10, min: 2, group: MS, tooltip: 'Look-back bars for pivot detection' },
  { id: 'bosConfType', type: 'string', title: 'BOS Confirmation', defval: 'Candle Close', options: ['Candle Close', 'Wicks'], group: MS, tooltip: 'Close vs. wick confirmation' },
  { id: 'bosStyleIn', type: 'string', title: 'BOS/CHoCH Line Style', defval: 'Solid', options: ['Solid', 'Dashed', 'Dotted'], group: MS },
  { id: 'showCHoCH', type: 'bool', title: 'Show CHoCH', defval: true, group: MS },
  { id: 'showSwing', type: 'bool', title: 'Show Swing Labels', defval: true, group: MS },
  { id: 'basisLength', type: 'int', title: 'Basis Length', defval: 100, min: 1, group: BANDS, tooltip: 'Length for the basis calculation (WMA)' },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1, group: BANDS, tooltip: 'Length for the volatility (ATR) calculation' },
  { id: 'atrSmooth', type: 'int', title: 'ATR Smoothing', defval: 21, min: 1, group: BANDS, tooltip: 'Length for smoothing the volatility' },
  { id: 'volMult', type: 'float', title: 'Volatility Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: BANDS, tooltip: 'Multiplier for the bands' },
  { id: 'colBull', type: 'color', title: 'Bull   Color', defval: '#00FFBB', inline: 'msc', group: APPEARANCE },
  { id: 'colBear', type: 'color', title: 'Bear   Color', defval: '#FF1100', inline: 'msc', group: APPEARANCE },
  { id: 'waitClose', type: 'bool', title: 'Wait for Bar Close (alerts)', defval: true, group: ALERTS },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Lower Band', color: '#00FFBB', lineWidth: 3, style: 'linebr' },
  { id: 'plot1', title: 'Upper Band', color: '#FF1100', lineWidth: 3, style: 'linebr' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Bullish Signal', char: '▲', location: 'absolute', color: '#00FFBB', size: 'tiny' },
  { id: 'char1', kind: 'char', title: 'Bearish Signal', char: '▼', location: 'absolute', color: '#FF1100', size: 'tiny' },
  { id: 'char2', kind: 'char', title: 'Trend Change Bullish', char: '◉', location: 'absolute', color: '#00FFBB', size: 'tiny' },
  { id: 'char3', kind: 'char', title: 'Trend Change Bearish', char: '◉', location: 'absolute', color: '#FF1100', size: 'tiny' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['label', 'line'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish CHoCH', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Bullish BOS', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Bearish CHoCH', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Bearish BOS', message: 'Alert Fired!' },
  { id: 'alert4', title: 'HH Detected', message: 'Alert Fired!' },
  { id: 'alert5', title: 'LH Detected', message: 'Alert Fired!' },
  { id: 'alert6', title: 'HL Detected', message: 'Alert Fired!' },
  { id: 'alert7', title: 'LL Detected', message: 'Alert Fired!' },
  { id: 'alert8', title: 'Bullish Arrow Signal', message: 'Bullish Rejection Signal' },
  { id: 'alert9', title: 'Bearish Arrow Signal', message: 'Bearish Rejection Signal' },
  { id: 'alert10', title: 'Bullish Trend Change', message: 'Trend changed to bullish' },
  { id: 'alert11', title: 'Bearish Trend Change', message: 'Trend changed to bearish' },
];

export const metadata = {
  title: 'Market Structure Confluence [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Market Structure',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => a - b > -1e-10;

type Pt = { time: number; value: number; color: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureConfluenceInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const swingSize = cfg.swingSize;
  const lastConfirmed = lastBarConfirmedOf(chart);
  const colBull = cfg.colBull;
  const colBear = cfg.colBear;
  const colBull50 = color.new(colBull, 50);
  const colBear50 = color.new(colBear, 50);
  const colClear = color.rgb(0, 0, 0, 100);
  const bosStyle = cfg.bosStyleIn === 'Solid' ? 'solid' : cfg.bosStyleIn === 'Dashed' ? 'dashed' : 'dotted';
  const byClose = cfg.bosConfType === 'Candle Close';

  const pivHiArr = ta.pivothigh(new Series(bars, (b) => b.high), swingSize, swingSize).toArray();
  const pivLoArr = ta.pivotlow(new Series(bars, (b) => b.low), swingSize, swingSize).toArray();
  const volatility = ta.atr(bars, cfg.atrLength);
  const svol = ta.sma(volatility, cfg.atrSmooth).toArray().map((v) => v ?? NaN);
  const atrArr = volatility.toArray().map((v) => v ?? NaN);
  const basis = ta.wma(new Series(bars, (b) => b.close), cfg.basisLength).toArray().map((v) => v ?? NaN);

  resetDrawings({ line: 500, label: 500 });

  let prevHigh = NaN;
  let prevLow = NaN;
  let prevHighIdx = NaN;
  let prevLowIdx = NaN;
  let highActive = false;
  let lowActive = false;
  let prevBreakDir = 0;
  let lastBreakDir = 0;

  const lowerPlot: Pt[] = [];
  const upperPlot: Pt[] = [];
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const flags: boolean[][] = alertConditions.map(() => []);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const barConfirmed = !cfg.waitClose || i < n - 1 || lastConfirmed;
    const pivHi = pivHiArr[i] ?? NaN;
    const pivLo = pivLoArr[i] ?? NaN;

    let hh = false;
    let lh = false;
    let hl = false;
    let ll = false;
    if (!isNaN(pivHi)) {
      hh = isNaN(prevHigh) || ge(pivHi, prevHigh);
      lh = !hh;
      prevHigh = pivHi;
      prevHighIdx = i - swingSize;
      highActive = true;
    }
    if (!isNaN(pivLo)) {
      hl = isNaN(prevLow) || ge(pivLo, prevLow);
      ll = !hl;
      prevLow = pivLo;
      prevLowIdx = i - swingSize;
      lowActive = true;
    }

    const highSrc = byClose ? b.close : b.high;
    const lowSrc = byClose ? b.close : b.low;
    let highBroken = false;
    let lowBroken = false;
    if (highActive && !isNaN(prevHigh) && gt(highSrc, prevHigh)) {
      highBroken = true;
      highActive = false;
    }
    if (lowActive && !isNaN(prevLow) && lt(lowSrc, prevLow)) {
      lowBroken = true;
      lowActive = false;
    }

    const upper = basis[i] + cfg.volMult * svol[i];
    const lower = basis[i] - cfg.volMult * svol[i];
    lowerPlot.push({ time: t, value: prevBreakDir === 1 ? lower : NaN, color: colBull });
    upperPlot.push({ time: t, value: prevBreakDir === -1 ? upper : NaN, color: colBear });

    const bullishArrow = prevBreakDir === 1 && lt(b.low, lower) && gt(b.high, lower);
    const bearishArrow = prevBreakDir === -1 && lt(b.low, upper) && gt(b.high, upper);
    const arrowOffset = atrArr[i] * 1;
    const bullPrice = lower - arrowOffset;
    const bearPrice = upper + arrowOffset;
    if (bullishArrow && !isNaN(bullPrice)) {
      markers.push({ id: 'char0', time: t, position: 'atPriceMiddle', price: bullPrice, shape: 'circle', char: '▲', color: colBull, size: 'tiny' });
    }
    if (bearishArrow && !isNaN(bearPrice)) {
      markers.push({ id: 'char1', time: t, position: 'atPriceMiddle', price: bearPrice, shape: 'circle', char: '▼', color: colBear, size: 'tiny' });
    }

    if (cfg.showSwing) {
      if (hh) label.new(i - swingSize, pivHi, 'HH', 'bar_index', 'price', colClear, 'label_down', colBull50);
      if (lh) label.new(i - swingSize, pivHi, 'LH', 'bar_index', 'price', colClear, 'label_down', colBear50);
      if (hl) label.new(i - swingSize, pivLo, 'HL', 'bar_index', 'price', colClear, 'label_up', colBull50);
      if (ll) label.new(i - swingSize, pivLo, 'LL', 'bar_index', 'price', colClear, 'label_up', colBear50);
    }

    let bullishChange = false;
    let bearishChange = false;
    if (highBroken) {
      line.new(prevHighIdx, prevHigh, i, prevHigh, 'bar_index', 'none', colBull, bosStyle, 1);
      const mid = Math.floor(i - (i - prevHighIdx) / 2);
      label.new(mid, prevHigh, prevBreakDir === -1 && cfg.showCHoCH ? 'CHoCH' : 'BOS', 'bar_index', 'price', colClear,
        'label_down', colBull, 'tiny');
      lastBreakDir = prevBreakDir;
      prevBreakDir = 1;
      bullishChange = lastBreakDir === -1 || lastBreakDir === 0;
    }
    if (lowBroken) {
      line.new(prevLowIdx, prevLow, i, prevLow, 'bar_index', 'none', colBear, bosStyle, 1);
      const mid = Math.floor(i - (i - prevLowIdx) / 2);
      label.new(mid, prevLow, prevBreakDir === 1 && cfg.showCHoCH ? 'CHoCH' : 'BOS', 'bar_index', 'price', colClear,
        'label_up', colBear, 'tiny');
      lastBreakDir = prevBreakDir;
      prevBreakDir = -1;
      bearishChange = lastBreakDir === 1 || lastBreakDir === 0;
    }

    if (bullishChange && !isNaN(lower)) {
      markers.push({ id: 'char2', time: t, position: 'atPriceMiddle', price: lower, shape: 'circle', char: '◉', color: colBull, size: 'tiny' });
    }
    if (bearishChange && !isNaN(upper)) {
      markers.push({ id: 'char3', time: t, position: 'atPriceMiddle', price: upper, shape: 'circle', char: '◉', color: colBear, size: 'tiny' });
    }

    barColors.push({ id: 'barcolor0', time: t, color: String(prevBreakDir === -1 ? color.new(colBear, 30) : color.new(colBull, 30)) });

    const conds = [
      highBroken && prevBreakDir === -1, highBroken && prevBreakDir !== -1,
      lowBroken && prevBreakDir === 1, lowBroken && prevBreakDir !== 1,
      hh, lh, hl, ll, bullishArrow, bearishArrow, bullishChange, bearishChange,
    ];
    conds.forEach((c, k) => flags[k].push(c && barConfirmed));
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: lowerPlot, plot1: upperPlot },
    markers,
    barColors,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const MarketStructureConfluence = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  barColorConfig,
  drawingKinds,
  alertConditions,
};
