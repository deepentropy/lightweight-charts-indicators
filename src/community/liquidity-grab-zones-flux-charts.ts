/**
 * Liquidity Grab Zones | Flux Charts
 *
 * Liquidity levels are the pivot highs (buyside) and pivot lows (sellside) of "Pivot Length" bars on each side,
 * found on the last 500 bars ("Max Distance To Last Bar": 150 bars for "Low"). A new level is skipped when an open
 * level of the same side is less than one ATR(5) away; a level closes when a close goes beyond it. A bar grabs an
 * open level when its high reaches a buyside level (its low a sellside level), once per level and at most one grab
 * per side and bar; the grab counts when the wick beyond the body is at least "Wick-Body Ratio" times the body.
 *
 * Each counted grab on a closed bar opens a zone: from the high to the top of the body (buyside) or from the
 * bottom of the body to the low (sellside). A zone is broken when a close ("Close") or a wick ("Wick") goes beyond
 * its far side; a zone broken more than 3 bars after it started gives a break marker ("Breaks") and, with "Inverse
 * Zones After Broken", a zone of the other side over the same prices. A bar that reaches the middle of an open zone
 * at least 3 bars old gives a retest marker ("Retests"), with a cooldown of 5 bars. Zones of the same side that
 * overlap are merged into one (on every bar).
 *
 * On the last bar each zone is drawn as a box with a dashed middle line: open zones extend to the right, broken
 * zones stop at the break ("Show Historic Zones"). The six bubble plots of the original are switched off by its
 * constants: they are always na. Retest and break markers are at the zone price; nothing new is made on a live
 * (not closed) last bar.
 *
 * Reference: "Liquidity Grab Zones | Flux Charts" by fluxchart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fluxchart
 */

import {
  ta, Series, box, line, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { MarkerData } from '../types';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface LiquidityGrabZonesFluxChartsInputs {
  /** Bars before the last bar where liquidity levels are searched: "Normal" 500, "Low" 150 */
  maxDistanceString: 'Normal' | 'Low';
  /** Bars on each side of a pivot */
  pivotLenLiq: number;
  /** Smallest ratio of the wick beyond the body to the body */
  WBR: number;
  zoneInvalidation: 'Wick' | 'Close';
  retestsEnabled: boolean;
  breaksEnabled: boolean;
  /** A broken zone gives a zone of the other side */
  inverseZones: boolean;
  /** Draw the broken zones */
  showInvalidated: boolean;
  /** Colour of the sellside (bullish) zones */
  sellsideColor: string;
  /** Colour of the buyside (bearish) zones */
  buysideColor: string;
}

export const defaultInputs: LiquidityGrabZonesFluxChartsInputs = {
  maxDistanceString: 'Normal',
  pivotLenLiq: 25,
  WBR: 0.5,
  zoneInvalidation: 'Close',
  retestsEnabled: true,
  breaksEnabled: false,
  inverseZones: true,
  showInvalidated: true,
  sellsideColor: 'rgba(8, 153, 129, 0.5)',
  buysideColor: 'rgba(242, 54, 70, 0.5)',
};

const GENERAL = 'General Configuration';

export const inputConfig: InputConfig[] = [
  { id: 'maxDistanceString', type: 'string', title: 'Max Distance To Last Bar', defval: 'Normal', options: ['Normal', 'Low'],
    group: GENERAL },
  { id: 'pivotLenLiq', type: 'int', title: 'Pivot Length', defval: 25, group: GENERAL },
  { id: 'WBR', type: 'float', title: 'Wick-Body Ratio', defval: 0.5, step: 0.1, group: GENERAL },
  { id: 'zoneInvalidation', type: 'string', title: 'Zone Invalidation', defval: 'Close', options: ['Wick', 'Close'],
    group: GENERAL },
  { id: 'retestsEnabled', type: 'bool', title: 'Retests', defval: true, inline: 'rb', group: GENERAL },
  { id: 'breaksEnabled', type: 'bool', title: 'Breaks', defval: false, inline: 'rb', group: GENERAL },
  { id: 'inverseZones', type: 'bool', title: 'Inverse Zones After Broken', defval: true, group: GENERAL },
  { id: 'showInvalidated', type: 'bool', title: 'Show Historic Zones', defval: true, group: GENERAL },
  { id: 'sellsideColor', type: 'color', title: 'Bullish', defval: 'rgba(8, 153, 129, 0.5)', inline: 'bsColor', group: GENERAL },
  { id: 'buysideColor', type: 'color', title: 'Bearish', defval: 'rgba(242, 54, 70, 0.5)', inline: 'bsColor', group: GENERAL },
];

/** The six untitled bubble plots (circles); the original's constants switch them off (always na) */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buyside Bubble 5', color: 'rgba(242, 54, 70, 0.5)', lineWidth: 5, style: 'circles' },
  { id: 'plot1', title: 'Buyside Bubble 10', color: 'rgba(242, 54, 70, 0.5)', lineWidth: 7, style: 'circles' },
  { id: 'plot2', title: 'Buyside Bubble 15', color: 'rgba(242, 54, 70, 0.5)', lineWidth: 10, style: 'circles' },
  { id: 'plot3', title: 'Sellside Bubble 5', color: 'rgba(8, 153, 129, 0.5)', lineWidth: 5, style: 'circles' },
  { id: 'plot4', title: 'Sellside Bubble 10', color: 'rgba(8, 153, 129, 0.5)', lineWidth: 7, style: 'circles' },
  { id: 'plot5', title: 'Sellside Bubble 15', color: 'rgba(8, 153, 129, 0.5)', lineWidth: 10, style: 'circles' },
];

const BLUE = '#2962FF';

/** The original's untitled plotshapes (markers carry these ids) */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Buyside Retest', style: 'labeldown', location: 'absolute',
    color: 'rgba(242, 54, 70, 0.5)', text: 'R', textcolor: '#FFFFFF', size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Sellside Retest', style: 'labelup', location: 'absolute',
    color: 'rgba(8, 153, 129, 0.5)', text: 'R', textcolor: '#FFFFFF', size: 'small' },
  { id: 'shape2', kind: 'shape', title: 'Buyside Break', style: 'labelup', location: 'absolute', color: BLUE, text: 'B',
    textcolor: '#FFFFFF', size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'Sellside Break', style: 'labeldown', location: 'absolute', color: BLUE,
    text: 'B', textcolor: '#FFFFFF', size: 'small' },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buyside Liquidity Grab @ {{ticker}}', message: 'Buyside Liquidity Grab @ {{ticker}}' },
  { id: 'alert1', title: 'Sellside Liquidity Grab @ {{ticker}}', message: 'Sellside Liquidity Grab @ {{ticker}}' },
  { id: 'alert2', title: 'Buyside Liq Grab Zone Retest @ {{ticker}}', message: 'Buyside Liq Grab Zone Retest @ {{ticker}}' },
  { id: 'alert3', title: 'Sellside Liq Grab Zone Retest @ {{ticker}}', message: 'Sellside Liq Grab Zone Retest @ {{ticker}}' },
  { id: 'alert4', title: 'Buyside Liq Grab Zone Break @ {{ticker}}', message: 'Buyside Liq Grab Zone Break @ {{ticker}}' },
  { id: 'alert5', title: 'Sellside Liq Grab Zone Break @ {{ticker}}', message: 'Sellside Liq Grab Zone Break @ {{ticker}}' },
];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['box', 'line'];

export const metadata = {
  title: 'Liquidity Grab Zones | Flux Charts',
  shortTitle: 'Liquidity Grab Zones | Flux Charts',
  overlay: true,
};

// Constants of the original
const SHOW_LAST_X = 500;
const MAX_ZONES = 100;
const EXTEND_ZONES_BY = 15;
const RETEST_COOLDOWN = 5;
const MIN_ZONE_SIZE = 3;
const LINE_COLOR = '#FFFFFF';
const MIN_DIST = 0;
const GRABS_PER_ZONE = 1;
const MIN_ATR_BETWEEN_PIVOTS = 1;

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when a - b >= -1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;

type Side = 'Buyside' | 'Sellside';

interface LiqInfo {
  startTime: number;
  endTime: number;
  price: number;
  liqType: Side;
  grabsFound: number;
}

interface LiqGrabZone {
  /** Bar index (na = NaN) */
  startTime: number;
  /** Bar index (na = NaN) */
  endTime: number;
  priceHigh: number;
  priceLow: number;
  liqType: Side;
  disabled: boolean;
  ephemeral: boolean;
}

const nz = (x: number) => (isNaN(x) ? 0 : x);

/** areaOfZone() */
function areaOfZone(zone: LiqGrabZone): number {
  const XA1 = zone.startTime;
  const XA2 = isNaN(zone.endTime) ? zone.startTime + EXTEND_ZONES_BY : zone.endTime;
  const YA1 = zone.priceHigh;
  const YA2 = zone.priceLow;
  const edge1 = Math.sqrt((XA2 - XA1) * (XA2 - XA1) + (YA2 - YA2) * (YA2 - YA2));
  const edge2 = Math.sqrt((XA2 - XA2) * (XA2 - XA2) + (YA2 - YA1) * (YA2 - YA1));
  return edge1 * edge2;
}

/** doZonesTouch() */
function doZonesTouch(zone1: LiqGrabZone, zone2: LiqGrabZone, barIndex: number): boolean {
  const XA1 = zone1.startTime;
  const XA2 = isNaN(zone1.endTime) ? barIndex : zone1.endTime;
  const YA1 = zone1.priceHigh;
  const YA2 = zone1.priceLow;
  const XB1 = zone2.startTime;
  const XB2 = isNaN(zone2.endTime) ? barIndex : zone2.endTime;
  const YB1 = zone2.priceHigh;
  const YB2 = zone2.priceLow;
  const intersectionArea = Math.max(0, Math.min(XA2, XB2) - Math.max(XA1, XB1))
    * Math.max(0, Math.min(YA1, YB1) - Math.max(YA2, YB2));
  const unionArea = areaOfZone(zone1) + areaOfZone(zone2) - intersectionArea;
  const overlapPercentage = (intersectionArea / unionArea) * 100.0;
  return gt(overlapPercentage, 0);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityGrabZonesFluxChartsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const pivotLen = Math.trunc(cfg.pivotLenLiq);
  const WBR = cfg.WBR;
  const maxDistance = cfg.maxDistanceString === 'Low' ? 150 : cfg.maxDistanceString === 'Normal' ? 500 : 750;
  const lastConfirmed = lastBarConfirmedOf(chart);
  const byClose = cfg.zoneInvalidation === 'Close';

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const pivHigh = ta.pivothigh(highS, pivotLen, pivotLen).toArray();
  const pivLow = ta.pivotlow(lowS, pivotLen, pivotLen).toArray();
  const atr = ta.atr(bars, 5).toArray();

  resetDrawings({ box: 500, line: 500, label: 500 });
  const allLiqList: LiqInfo[] = [];
  const allLiqGrabZones: LiqGrabZone[] = [];
  let lastHigh = 0;
  let lastLow = 0;
  let lastRetestIndex = 0;

  const markers: MarkerData[] = [];
  const flags: boolean[][] = Array.from({ length: 6 }, () => new Array(n).fill(false));

  const addPivot = (price: number, i: number, type: Side, curATR: number) => {
    let addLiq = true;
    for (const info of allLiqList) {
      if (isNaN(info.endTime) && info.liqType === type && lt(Math.abs(price - info.price), curATR * MIN_ATR_BETWEEN_PIVOTS)) {
        addLiq = false;
        break;
      }
    }
    if (addLiq) {
      allLiqList.unshift({ startTime: bars[i - pivotLen].time, endTime: NaN, price, liqType: type, grabsFound: 0 });
      // safeDeleteLiq(allLiqList.pop()): the liquidity lines are switched off by the original's constants
      if (allLiqList.length > SHOW_LAST_X) allLiqList.pop();
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const confirmed = i < n - 1 || lastConfirmed;
    const curATR = atr[i] ?? NaN;

    if (i > n - 1 - maxDistance) {
      for (const info of allLiqList) {
        if (isNaN(info.endTime) && (info.liqType === 'Buyside' ? gt(b.close, info.price) : lt(b.close, info.price))) {
          info.endTime = b.time;
        }
      }
      const ph = pivHigh[i] ?? NaN;
      if (!isNaN(ph)) addPivot(ph, i, 'Buyside', curATR);
      const pl = pivLow[i] ?? NaN;
      if (!isNaN(pl)) addPivot(pl, i, 'Sellside', curATR);
    }

    // Liquidity grabs
    let high5 = false;
    let high10 = false;
    let high15 = false;
    let low5 = false;
    let low10 = false;
    let low15 = false;
    for (const info of allLiqList) {
      if (!isNaN(info.endTime)) continue;
      if (info.grabsFound === GRABS_PER_ZONE) continue;
      const bodySize = Math.abs(b.close - b.open);
      const wickSize = info.liqType === 'Buyside' ? b.high - Math.max(b.close, b.open) : Math.min(b.close, b.open) - b.low;
      const curWBR = wickSize / bodySize;
      if (info.liqType === 'Buyside') {
        if (ge(b.high, info.price) && i - lastHigh > MIN_DIST) {
          lastHigh = i;
          if (ge(curWBR, WBR * 3)) high15 = true;
          else if (ge(curWBR, WBR * 2)) high10 = true;
          else if (ge(curWBR, WBR)) high5 = true;
          info.grabsFound += 1;
        }
      } else if (le(b.low, info.price) && i - lastLow > MIN_DIST) {
        lastLow = i;
        if (ge(curWBR, WBR * 3)) low15 = true;
        else if (ge(curWBR, WBR * 2)) low10 = true;
        else if (ge(curWBR, WBR)) low5 = true;
        info.grabsFound += 1;
      }
    }
    const highGrab = high5 || high10 || high15;
    const lowGrab = low5 || low10 || low15;
    // highCirclePrice / lowCirclePrice only feed the switched-off bubble plots

    if (highGrab && confirmed) {
      allLiqGrabZones.unshift({ startTime: i, endTime: NaN, priceHigh: b.high, priceLow: Math.max(b.close, b.open),
        liqType: 'Buyside', disabled: false, ephemeral: false });
      if (allLiqGrabZones.length > MAX_ZONES) allLiqGrabZones.pop();
    } else if (lowGrab && confirmed) {
      allLiqGrabZones.unshift({ startTime: i, endTime: NaN, priceHigh: Math.min(b.close, b.open), priceLow: b.low,
        liqType: 'Sellside', disabled: false, ephemeral: false });
      if (allLiqGrabZones.length > MAX_ZONES) allLiqGrabZones.pop();
    }

    // Breaks (the loop bound is evaluated once, as in Pine v5: a zone added at the front shifts the others)
    let breakBuyside = NaN;
    let breakSellside = NaN;
    if (allLiqGrabZones.length > 0 && confirmed) {
      const end = allLiqGrabZones.length - 1;
      for (let k = 0; k <= end; k++) {
        const z = allLiqGrabZones[k];
        if (z.disabled) continue;
        if (isNaN(z.endTime) && i > z.startTime) {
          if (z.liqType === 'Buyside') {
            if (gt(byClose ? b.close : b.high, z.priceHigh)) {
              z.endTime = i;
              if (z.endTime - z.startTime > MIN_ZONE_SIZE) {
                breakBuyside = z.priceLow;
                if (cfg.inverseZones && !z.ephemeral) {
                  allLiqGrabZones.unshift({ startTime: i, endTime: NaN, priceHigh: z.priceHigh, priceLow: z.priceLow,
                    liqType: 'Sellside', disabled: false, ephemeral: true });
                }
              }
            }
          } else if (lt(byClose ? b.close : b.low, z.priceLow)) {
            z.endTime = i;
            if (z.endTime - z.startTime > MIN_ZONE_SIZE) {
              breakSellside = z.priceHigh;
              if (cfg.inverseZones && !z.ephemeral) {
                allLiqGrabZones.unshift({ startTime: i, endTime: NaN, priceHigh: z.priceHigh, priceLow: z.priceLow,
                  liqType: 'Buyside', disabled: false, ephemeral: true });
              }
            }
          }
        }
      }
    }

    // Retests
    let retestBuyside = NaN;
    let retestSellside = NaN;
    if (allLiqGrabZones.length > 0 && i - lastRetestIndex > RETEST_COOLDOWN && confirmed) {
      for (const z of allLiqGrabZones) {
        if (i - z.startTime < MIN_ZONE_SIZE) continue;
        if (z.disabled) continue;
        if (!isNaN(z.endTime)) continue;
        const middleLine = (z.priceLow + z.priceHigh) / 2.0;
        if (z.liqType === 'Buyside') {
          if (gt(b.high, middleLine)) {
            retestBuyside = z.priceHigh;
            lastRetestIndex = i;
          }
        } else if (lt(b.low, middleLine)) {
          retestSellside = z.priceLow;
          lastRetestIndex = i;
        }
      }
    }

    const t = b.time;
    if (!isNaN(retestBuyside) && cfg.retestsEnabled) {
      markers.push({ id: 'shape0', time: t, position: 'atPriceTop', price: retestBuyside, shape: 'labelDown',
        color: cfg.buysideColor, text: 'R', textColor: '#FFFFFF', size: 'small' });
    }
    if (!isNaN(retestSellside) && cfg.retestsEnabled) {
      markers.push({ id: 'shape1', time: t, position: 'atPriceBottom', price: retestSellside, shape: 'labelUp',
        color: cfg.sellsideColor, text: 'R', textColor: '#FFFFFF', size: 'small' });
    }
    if (!isNaN(breakBuyside) && cfg.breaksEnabled) {
      markers.push({ id: 'shape2', time: t, position: 'atPriceBottom', price: breakBuyside, shape: 'labelUp',
        color: BLUE, text: 'B', textColor: '#FFFFFF', size: 'small' });
    }
    if (!isNaN(breakSellside) && cfg.breaksEnabled) {
      markers.push({ id: 'shape3', time: t, position: 'atPriceTop', price: breakSellside, shape: 'labelDown',
        color: BLUE, text: 'B', textColor: '#FFFFFF', size: 'small' });
    }

    flags[0][i] = highGrab && confirmed;
    flags[1][i] = lowGrab && confirmed;
    flags[2][i] = !isNaN(retestBuyside) && confirmed;
    flags[3][i] = !isNaN(retestSellside) && confirmed;
    flags[4][i] = !isNaN(breakBuyside) && confirmed;
    flags[5][i] = !isNaN(breakSellside) && confirmed;

    // combineFunc() (loop bounds evaluated once per loop, as in Pine v5)
    if (allLiqGrabZones.length > 0) {
      let lastCombinations = 999;
      while (lastCombinations > 0) {
        lastCombinations = 0;
        const endI = allLiqGrabZones.length - 1;
        for (let a = 0; a <= endI; a++) {
          const z1 = allLiqGrabZones[a];
          const endJ = allLiqGrabZones.length - 1;
          for (let c = 0; c <= endJ; c++) {
            const z2 = allLiqGrabZones[c];
            if (a === c) continue;
            if (z1.liqType !== z2.liqType) continue;
            if (z1.disabled || z2.disabled) continue;
            if (doZonesTouch(z1, z2, i)) {
              z1.disabled = true;
              z2.disabled = true;
              const endTime = Math.max(nz(z1.endTime), nz(z2.endTime));
              allLiqGrabZones.unshift({
                startTime: Math.min(z1.startTime, z2.startTime), endTime: endTime === 0 ? NaN : endTime,
                priceHigh: Math.max(z1.priceHigh, z2.priceHigh), priceLow: Math.min(z1.priceLow, z2.priceLow),
                liqType: z1.liqType, disabled: false, ephemeral: false,
              });
              lastCombinations += 1;
            }
          }
        }
      }
    }

    // Drawings on the last bar
    if (i === n - 1) {
      for (const z of allLiqGrabZones) {
        if (!cfg.showInvalidated && !isNaN(z.endTime)) continue;
        if (z.disabled) continue;
        if (!isNaN(z.endTime) && z.endTime - z.startTime <= MIN_ZONE_SIZE) continue;
        const open = isNaN(z.endTime);
        const x2 = open ? i + 1 : z.endTime;
        const extend = open ? 'right' : 'none';
        box.new(z.startTime, z.priceHigh, x2, z.priceLow, undefined, 0, undefined, extend, 'bar_index',
          z.liqType === 'Buyside' ? cfg.buysideColor : cfg.sellsideColor);
        const middlePrice = (z.priceHigh + z.priceLow) / 2;
        line.new(z.startTime, middlePrice, x2, middlePrice, 'bar_index', extend, LINE_COLOR, 'dashed');
      }
    }
  }
  setDrawingBar(null);

  const naPlot = (c: string) => bars.map((b) => ({ time: b.time, value: NaN, color: c }));
  const buy = naPlot(cfg.buysideColor);
  const sell = naPlot(cfg.sellsideColor);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: buy, plot1: buy, plot2: buy, plot3: sell, plot4: sell, plot5: sell },
    markers,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const LiquidityGrabZonesFluxCharts = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  shapeConfig,
  drawingKinds,
};
