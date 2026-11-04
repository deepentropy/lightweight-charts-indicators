/**
 * Order Flow VWAP Deviation [LuxAlgo]
 *
 * VWAP of hlc3 anchored on each new session / week / month / year ("VWAP Anchor"), with bands at +- "Std. Dev
 * Multiplier" standard deviations and gradient fills between the VWAP and each band.
 *
 * Stop zones: each pivot high / low ("Pivot Lookback" bars on each side) draws a dashed level from the pivot; at most
 * "Max Active Lines" levels per side stay active and are extended bar by bar until price trades through them. A bar
 * that takes out a level on a volume above 1.2 x its 20-bar average marks "Stops Triggered" (circles above / below the
 * bar).
 *
 * IFVGs (off by default): a fair value gap after a large candle (body above "IFVG Volatility Filter" x the 50-bar
 * average body) that price closes through becomes an inversion gap: a box from the gap to 5 bars after the current
 * bar and an "IFVG" label, at most "Max Active IFVGs"; it is deleted when price closes back through it.
 *
 * Session profile: from the first bar of each "Anchor Time Range" (in "Timezone", background highlight) the closes,
 * volumes and a buy / sell volume proxy (volume x position of the close in the bar range) are collected; on the last
 * bar a profile of "Profile Rows" rows of the closes is drawn "Profile Right Offset" bars after the last bar, at most
 * "Profile Max Width" bars wide: the PoC row in yellow, rows above "Stop Zone Volume Multiplier" x the average row in
 * orange with their multiple of the average and the dominant side (B / S).
 *
 * The periods follow the exchange calendar of the chart context (src/anchor-period.ts); `syminfo.mintick` and the
 * chart colours (`chart.fg_color` / `chart.bg_color`) come from the context.
 *
 * Reference: "Order Flow VWAP Deviation [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, line, label, box, time as pineTime, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig,
  type ShapeConfig, type BarColorConfig, type FillConfig, type FillData,
} from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';
import { periodChanges, timeAfterLastBar } from '../anchor-period';
import { backgroundColorOf, foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';

export interface OrderFlowVwapDeviationInputs {
  vwapAnchor: 'Session' | 'Week' | 'Month' | 'Year';
  stdDevMult: number;
  pivotLookback: number;
  maxActiveLines: number;
  vpRows: number;
  vpWidth: number;
  vpOffset: number;
  /** Anchor Time Range (HHMM-HHMM) */
  sessionAnchor: string;
  sessionTz: 'GMT-5' | 'GMT-4' | 'UTC';
  stopThreshold: number;
  showIFVG: boolean;
  ifvgVolFilter: number;
  ifvgHistory: number;
}

export const defaultInputs: OrderFlowVwapDeviationInputs = {
  vwapAnchor: 'Session',
  stdDevMult: 2.0,
  pivotLookback: 50,
  maxActiveLines: 10,
  vpRows: 50,
  vpWidth: 30,
  vpOffset: 10,
  sessionAnchor: '1800-1801',
  sessionTz: 'GMT-4',
  stopThreshold: 1.5,
  showIFVG: false,
  ifvgVolFilter: 1.2,
  ifvgHistory: 5,
};

const G_VWAP = 'VWAP Settings';
const G_STOP = 'Stop Zones (Pivots)';
const G_VP = 'Volume Profile & Stop Zones';
const G_IFVG = 'Inversion Fair Value Gaps (IFVGs)';

export const inputConfig: InputConfig[] = [
  { id: 'vwapAnchor', type: 'string', title: 'VWAP Anchor', defval: 'Session', options: ['Session', 'Week', 'Month', 'Year'], group: G_VWAP },
  { id: 'stdDevMult', type: 'float', title: 'Std. Dev Multiplier', defval: 2.0, min: 0.5, step: 0.1, group: G_VWAP },
  { id: 'pivotLookback', type: 'int', title: 'Pivot Lookback (Stop Zones)', defval: 50, min: 10, group: G_STOP },
  { id: 'maxActiveLines', type: 'int', title: 'Max Active Lines', defval: 10, min: 1, max: 50, group: G_STOP },
  { id: 'vpRows', type: 'int', title: 'Profile Rows', defval: 50, min: 10, max: 100, group: G_VP },
  { id: 'vpWidth', type: 'int', title: 'Profile Max Width (Bars)', defval: 30, min: 5, group: G_VP },
  { id: 'vpOffset', type: 'int', title: 'Profile Right Offset', defval: 10, min: 0, group: G_VP },
  { id: 'sessionAnchor', type: 'string', title: 'Anchor Time Range (HHMM-HHMM)', defval: '1800-1801', group: G_VP },
  { id: 'sessionTz', type: 'string', title: 'Timezone', defval: 'GMT-4', options: ['GMT-5', 'GMT-4', 'UTC'], group: G_VP },
  { id: 'stopThreshold', type: 'float', title: 'Stop Zone Volume Multiplier', defval: 1.5, min: 1.0, step: 0.1, group: G_VP },
  { id: 'showIFVG', type: 'bool', title: 'Show IFVGs', defval: false, group: G_IFVG },
  { id: 'ifvgVolFilter', type: 'float', title: 'IFVG Volatility Filter', defval: 1.2, min: 0.5, step: 0.1, group: G_IFVG },
  { id: 'ifvgHistory', type: 'int', title: 'Max Active IFVGs', defval: 5, min: 1, max: 20, group: G_IFVG },
];

const RED = '#f23645';
const TEAL = '#089981';
/** plot() without a colour: the default plot colour */
const DEFAULT_PLOT = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#DBDBDB80', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: TEAL, lineWidth: 1 },
  { id: 'plot3', title: 'Plot', color: DEFAULT_PLOT, lineWidth: 1 },
  { id: 'plot4', title: 'Plot', color: DEFAULT_PLOT, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot3', title: 'Plots Background' },
  { id: 'fill1', plot1: 'plot2', plot2: 'plot4', title: 'Plots Background' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Stops Triggered High', style: 'circle', location: 'abovebar', color: String(color.new(RED, 50)), size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Stops Triggered Low', style: 'circle', location: 'belowbar', color: String(color.new(TEAL, 50)), size: 'tiny' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box', 'label'];

export const metadata = {
  title: 'Order Flow VWAP Deviation [LuxAlgo]',
  shortTitle: 'LuxAlgo - Order Flow VWAP Deviation',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => a - b > -1e-10;
const le = (a: number, b: number) => b - a > -1e-10;

type Pt = { time: number; value: number; color?: string };

const ANCHOR_TF: Record<OrderFlowVwapDeviationInputs['vwapAnchor'], string> = {
  Session: 'D', Week: 'W', Month: 'M', Year: '12M',
};

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderFlowVwapDeviationInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[]; fills: FillData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const mintick = mintickOf(chart);
  const ms = chart?.timeUnit === 'ms' || (n > 0 && bars[0].time >= 1e12);
  const toMs = ms ? 1 : 1000;
  const look = cfg.pivotLookback;

  // ---- VWAP
  const anchor = n > 0 ? periodChanges(bars, ANCHOR_TF[cfg.vwapAnchor] ?? 'D', chart) : [];
  const hlc3 = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const vol = new Series(bars, (b) => b.volume ?? NaN);
  const anchorSeries = Series.fromArray(bars, anchor.map((a) => (a ? 1 : 0)));
  const [vSeries, upSeries, loSeries] = ta.vwapBands(hlc3, vol, anchorSeries, cfg.stdDevMult);
  const num = (s: Series) => s.toArray().map((v) => (v === null || v === undefined || !Number.isFinite(v) ? NaN : v));
  const vValue = num(vSeries);
  const vUpper = num(upSeries);
  const vLower = num(loSeries);

  const ph = num(ta.pivothigh(new Series(bars, (b) => b.high), look, look));
  const pl = num(ta.pivotlow(new Series(bars, (b) => b.low), look, look));
  const avgVol20 = num(ta.sma(new Series(bars, (b) => b.volume ?? NaN), 20));
  const avgBody = num(ta.sma(new Series(bars, (b) => Math.abs(b.close - b.open)), 50));
  const interval = barInterval(bars);

  resetDrawings({ line: 500, box: 500, label: 500 });

  const upperLines: Line[] = [];
  const lowerLines: Line[] = [];
  const bearTop: number[] = [];
  const bearBtm: number[] = [];
  const bearBar: number[] = [];
  const bullTop: number[] = [];
  const bullBtm: number[] = [];
  const bullBar: number[] = [];
  const ifvgBoxes: Box[] = [];
  const ifvgLabels: Label[] = [];
  const ifvgIsBull: boolean[] = [];
  let sessionPrices: number[] = [];
  let sessionVolumes: number[] = [];
  let sessionBuyVols: number[] = [];
  let sessionSellVols: number[] = [];

  const plots: Pt[][] = [[], [], [], [], []];
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const vwapColor = String(color.new(fg, 50));
  const upperLineColor = String(color.new(RED, 60));
  const lowerLineColor = String(color.new(TEAL, 60));
  const shapeHigh = String(color.new(RED, 50));
  const shapeLow = String(color.new(TEAL, 50));
  const anchorBg = String(color.new('#FDD835', 80));
  let prevInSession = false;

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const isLast = i === n - 1;
    setDrawingBar(i, isLast);

    // ---- Stop lines
    if (!Number.isNaN(ph[i])) {
      upperLines.unshift(line.new(i - look, ph[i], i, ph[i], 'bar_index', 'none', upperLineColor, 'dashed'));
      if (upperLines.length > cfg.maxActiveLines) line.delete(upperLines.pop() as Line);
    }
    if (!Number.isNaN(pl[i])) {
      lowerLines.unshift(line.new(i - look, pl[i], i, pl[i], 'bar_index', 'none', lowerLineColor, 'dashed'));
      if (lowerLines.length > cfg.maxActiveLines) line.delete(lowerLines.pop() as Line);
    }
    let stopTriggeredUpper = false;
    let stopTriggeredLower = false;
    for (let k = upperLines.length - 1; k >= 0 && upperLines.length > 0; k--) {
      const l = upperLines[k];
      if (ge(b.high, line.get_y1(l))) {
        if (gt(b.volume ?? NaN, avgVol20[i] * 1.2)) stopTriggeredUpper = true;
        line.set_x2(l, i);
        upperLines.splice(k, 1);
      } else {
        line.set_x2(l, i);
      }
    }
    for (let k = lowerLines.length - 1; k >= 0 && lowerLines.length > 0; k--) {
      const l = lowerLines[k];
      if (le(b.low, line.get_y1(l))) {
        if (gt(b.volume ?? NaN, avgVol20[i] * 1.2)) stopTriggeredLower = true;
        line.set_x2(l, i);
        lowerLines.splice(k, 1);
      } else {
        line.set_x2(l, i);
      }
    }

    // ---- IFVGs
    const volatilityValid = i >= 1 && gt(Math.abs(bars[i - 1].close - bars[i - 1].open), avgBody[i] * cfg.ifvgVolFilter);
    const bearFVG = volatilityValid && i >= 2 && lt(b.high, bars[i - 2].low);
    const bullFVG = volatilityValid && i >= 2 && gt(b.low, bars[i - 2].high);
    if (cfg.showIFVG) {
      if (bearFVG) {
        bearTop.unshift(bars[i - 2].low);
        bearBtm.unshift(b.high);
        bearBar.unshift(i - 1);
      }
      if (bullFVG) {
        bullTop.unshift(b.low);
        bullBtm.unshift(bars[i - 2].high);
        bullBar.unshift(i - 1);
      }
      const keepHistory = () => {
        if (ifvgBoxes.length > cfg.ifvgHistory) {
          box.delete(ifvgBoxes.pop() as Box);
          label.delete(ifvgLabels.pop() as Label);
          ifvgIsBull.pop();
        }
      };
      // Bearish FVGs for bullish inversion
      for (let k = bearTop.length - 1; k >= 0 && bearTop.length > 0; k--) {
        const top = bearTop[k];
        const btm = bearBtm[k];
        if (gt(b.close, top)) {
          const startBar = bearBar[k];
          const bx = box.new(startBar, top, i + 10, btm, String(color.new(TEAL, 60)), 1, 'solid', 'none', 'bar_index',
            String(color.new(TEAL, 85)));
          const lb = label.new(i, (top + btm) / 2, 'IFVG', 'bar_index', 'price', '#00000000', 'label_center', TEAL, 'small');
          ifvgBoxes.unshift(bx);
          ifvgLabels.unshift(lb);
          ifvgIsBull.unshift(true);
          bearTop.splice(k, 1);
          bearBtm.splice(k, 1);
          bearBar.splice(k, 1);
          keepHistory();
        }
      }
      // Bullish FVGs for bearish inversion
      for (let k = bullTop.length - 1; k >= 0 && bullTop.length > 0; k--) {
        const top = bullTop[k];
        const btm = bullBtm[k];
        if (lt(b.close, btm)) {
          const startBar = bullBar[k];
          const bx = box.new(startBar, top, i + 10, btm, String(color.new(RED, 60)), 1, 'solid', 'none', 'bar_index',
            String(color.new(RED, 85)));
          const lb = label.new(i, (top + btm) / 2, 'IFVG', 'bar_index', 'price', '#00000000', 'label_center', RED, 'small');
          ifvgBoxes.unshift(bx);
          ifvgLabels.unshift(lb);
          ifvgIsBull.unshift(false);
          bullTop.splice(k, 1);
          bullBtm.splice(k, 1);
          bullBar.splice(k, 1);
          keepHistory();
        }
      }
    }
    // Mitigation logic
    for (let k = ifvgBoxes.length - 1; k >= 0 && ifvgBoxes.length > 0; k--) {
      const bx = ifvgBoxes[k];
      const lb = ifvgLabels[k];
      const top = box.get_top(bx);
      const btm = box.get_bottom(bx);
      const mitigated = ifvgIsBull[k] ? lt(b.close, btm) : gt(b.close, top);
      if (mitigated) {
        box.delete(bx);
        label.delete(lb);
        ifvgBoxes.splice(k, 1);
        ifvgLabels.splice(k, 1);
        ifvgIsBull.splice(k, 1);
      } else if (i < box.get_right(bx)) {
        box.set_right(bx, i + 5);
      }
    }

    // ---- Forward volume collection: t = time(timeframe.period, sessionAnchor, sessionTz)
    const inSession = pineTime.inSession(b.time * toMs, cfg.sessionAnchor, cfg.sessionTz, interval * toMs);
    const isAnchorBar = inSession && (i === 0 || !prevInSession);
    prevInSession = inSession;
    if (isAnchorBar) {
      sessionPrices = [];
      sessionVolumes = [];
      sessionBuyVols = [];
      sessionSellVols = [];
    }
    const rangeVal = Math.max(b.high - b.low, mintick);
    const v = b.volume ?? NaN;
    sessionPrices.push(b.close);
    sessionVolumes.push(v);
    sessionBuyVols.push(v * (b.close - b.low) / rangeVal);
    sessionSellVols.push(v * (b.high - b.close) / rangeVal);
    if (isAnchorBar) bgColors.push({ id: 'bgcolor0', time: b.time, color: anchorBg });

    // ---- Profile on the last bar
    if (isLast && sessionPrices.length > 0) {
      let sHigh = sessionPrices[0];
      let sLow = sessionPrices[0];
      for (const p of sessionPrices) {
        sHigh = Math.max(sHigh, p);
        sLow = Math.min(sLow, p);
      }
      const rows = cfg.vpRows;
      const binVols = new Array<number>(rows).fill(0);
      const binBuyVols = new Array<number>(rows).fill(0);
      const binSellVols = new Array<number>(rows).fill(0);
      const bSize = (sHigh - sLow) / rows;
      if (gt(bSize, 0)) {
        for (let k = 0; k < sessionPrices.length; k++) {
          const bIdx = Math.min(rows - 1, Math.max(0, Math.floor((sessionPrices[k] - sLow) / bSize)));
          binVols[bIdx] = binVols[bIdx] + sessionVolumes[k];
          binBuyVols[bIdx] = binBuyVols[bIdx] + sessionBuyVols[k];
          binSellVols[bIdx] = binSellVols[bIdx] + sessionSellVols[k];
        }
        let maxV = 0;
        let totalV = 0;
        let pIdx = 0;
        for (let r = 0; r < rows; r++) {
          const bv = binVols[r];
          totalV += bv;
          if (gt(bv, maxV)) {
            maxV = bv;
            pIdx = r;
          }
        }
        const avgV = totalV / rows;
        const clearBg = String(color.new(bg, 100));
        for (let r = 0; r < rows; r++) {
          const bv = binVols[r];
          if (!gt(bv, 0)) continue;
          const nW = (bv / maxV) * cfg.vpWidth;
          const isStop = gt(bv, avgV * cfg.stopThreshold);
          const binColor = r === pIdx ? color.new('#FFEB3B', 10) : isStop ? color.new('#ff9800', 30) : color.new('#5b9cf6', 60);
          const tBox = sLow + (r + 1) * bSize;
          const bBox = sLow + r * bSize;
          const lBox = i + cfg.vpOffset;
          const rBox = lBox + Math.round(nW);
          box.new(lBox, tBox, rBox, bBox, clearBg, 1, 'solid', 'none', 'bar_index', String(binColor));
          if (isStop || r === pIdx) {
            const diffMult = bv / avgV;
            const buy = binBuyVols[r];
            const sell = binSellVols[r];
            const yCenter = (tBox + bBox) / 2;
            const multColor = r === pIdx ? '#FFEB3B' : '#ff9800';
            label.new(rBox, yCenter, str.format('{0,number,#.#}x', diffMult), 'bar_index', 'price', clearBg, 'label_left',
              multColor, 'tiny');
            const side = gt(buy, sell);
            label.new(rBox + 3, yCenter, side ? 'B' : 'S', 'bar_index', 'price', clearBg, 'label_left', side ? TEAL : RED, 'tiny');
          }
        }
      }
    }

    // ---- Plots and shapes
    const t = b.time;
    plots[0].push({ time: t, value: vValue[i], color: vwapColor });
    plots[1].push({ time: t, value: vUpper[i] });
    plots[2].push({ time: t, value: vLower[i] });
    plots[3].push({ time: t, value: vValue[i] });
    plots[4].push({ time: t, value: vValue[i] });
    if (stopTriggeredUpper) markers.push({ id: 'shape0', time: t, position: 'aboveBar', shape: 'circle', color: shapeHigh, size: 'tiny' });
    if (stopTriggeredLower) markers.push({ id: 'shape1', time: t, position: 'belowBar', shape: 'circle', color: shapeLow, size: 'tiny' });
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars, ms ? 'ms' : 's');
  resetDrawings();

  // Points after the last bar: the bar `k` bars after it on the exchange calendar of the context
  if (n > 1) {
    const lastTime = bars[n - 1].time;
    const future = new Map<number, number>();
    const ahead = Math.max(10, cfg.vpOffset + cfg.vpWidth + 3);
    for (let k = 1; k <= ahead; k++) future.set(barTime(bars, n - 1 + k), timeAfterLastBar(bars, k, chart));
    const at = (x: number) => (x > lastTime ? future.get(x) ?? x : x);
    for (const l of drawn.lines ?? []) {
      l.time1 = at(l.time1);
      l.time2 = at(l.time2);
    }
    for (const bx of drawn.boxes ?? []) {
      bx.time1 = at(bx.time1);
      bx.time2 = at(bx.time2);
    }
    for (const lb of drawn.labels ?? []) lb.time = at(lb.time);
  }

  const fillTop = String(color.new(RED, 90));
  const fillBottom = String(color.new(RED, 100));
  const fillTopLo = String(color.new(TEAL, 90));
  const fillBottomLo = String(color.new(TEAL, 100));
  const fills: FillData[] = [
    // fill(pUp, plot(vValue), vUpper, vValue, color.new(#f23645, 90), color.new(#f23645, 100))
    { id: 'fill0', plot1: 'plot1', plot2: 'plot3', options: { title: 'Plots Background' }, gradient: { topValue: vUpper,
      bottomValue: vValue, topColor: new Array(n).fill(fillTop), bottomColor: new Array(n).fill(fillBottom) } },
    // fill(pLo, plot(vValue), vLower, vValue, color.new(#089981, 90), color.new(#089981, 100))
    { id: 'fill1', plot1: 'plot2', plot2: 'plot4', options: { title: 'Plots Background' }, gradient: { topValue: vLower,
      bottomValue: vValue, topColor: new Array(n).fill(fillTopLo), bottomColor: new Array(n).fill(fillBottomLo) } },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: plots[0], plot1: plots[1], plot2: plots[2], plot3: plots[3], plot4: plots[4] },
    markers,
    bgColors,
    fills,
    ...drawn,
  };
}

export const OrderFlowVwapDeviation = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, barColorConfig, drawingKinds,
};
