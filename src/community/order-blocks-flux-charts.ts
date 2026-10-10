/**
 * Volumized Order Blocks | Flux Charts
 *
 * Finds order blocks on the last 1,750 bars. Swings: bar i - L (L = "Swing Length") is a swing high when its high is
 * above the highest high of the L bars after it, a swing low when its low is below the lowest low of those bars.
 * When a close breaks the last swing high, the bar with the lowest low between the swing and the break becomes a
 * bullish order block (its high / low range); when a close breaks the last swing low, the bar with the highest high
 * becomes a bearish block. A block larger than 3.5 x ATR(10) is ignored. The volume of a block is the volume of the
 * break bar and the two bars before it, split in two parts (the last two bars / the third one).
 *
 * A bullish block is invalidated when the low (or the candle body, "Zone Invalidation") goes below its bottom, and
 * removed when the high later goes above its top; bearish blocks are mirrored. The most recent blocks of each side
 * ("Zone Count": 1, 3, 5 or 10) are shown. Blocks of the same side that overlap, in time and in price, are merged
 * into one block (lighter fill). A block runs from its bar to the bar that invalidated it, or to the last bar.
 *
 * Drawings per block: the zone box, a box for the text (total volume, the share of the smaller volume part, and
 * the chart timeframe), and with "Volumetric Info" two volume bars in the first third of the zone, a dashed line
 * between them and a line at the end of the third. The original places them by time: each edge is on the first bar
 * that starts at or after its time; an open block ends on the last bar.
 *
 * The original reads its own lists through a request on the chart symbol and the chart timeframe: this gives the
 * lists themselves. It redraws on closed bars only: every bar of the port is a closed bar.
 *
 * Reference: "Volumized Order Blocks | Flux Charts" by fluxchart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fluxchart
 */

import { ta, str, color, callsite, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe } from '../anchor-period';

export interface OrderBlocksFluxChartsInputs {
  /** Show the blocks that were invalidated */
  showInvalidated: boolean;
  orderBlockVolumetricInfo: boolean;
  obEndMethod: 'Wick' | 'Close';
  swingLength: number;
  zoneCount: 'High' | 'Medium' | 'Low' | 'One';
  bullOrderBlockColor: string;
  bearOrderBlockColor: string;
  textColor: string;
}

export const defaultInputs: OrderBlocksFluxChartsInputs = {
  showInvalidated: true,
  orderBlockVolumetricInfo: true,
  obEndMethod: 'Wick',
  swingLength: 10,
  zoneCount: 'Low',
  bullOrderBlockColor: 'rgba(8, 153, 129, 0.5)',
  bearOrderBlockColor: 'rgba(242, 54, 70, 0.5)',
  textColor: 'rgba(255, 255, 255, 0.5)',
};

export const inputConfig: InputConfig[] = [
  { id: 'showInvalidated', type: 'bool', title: 'Show Historic Zones', defval: true, group: 'General Configuration' },
  { id: 'orderBlockVolumetricInfo', type: 'bool', title: 'Volumetric Info', defval: true, group: 'General Configuration', inline: 'EV' },
  { id: 'obEndMethod', type: 'string', title: 'Zone Invalidation', defval: 'Wick', options: ['Wick', 'Close'], group: 'General Configuration' },
  {
    id: 'swingLength', type: 'int', title: 'Swing Length', defval: 10, min: 3, group: 'General Configuration',
    tooltip: 'Swing length is used when finding order block formations. Smaller values will result in finding smaller order blocks.',
  },
  {
    id: 'zoneCount', type: 'string', title: 'Zone Count', defval: 'Low', options: ['High', 'Medium', 'Low', 'One'], group: 'General Configuration',
    tooltip: 'Number of Order Block Zones to be rendered. Higher options will result in older Order Blocks shown.',
  },
  { id: 'bullOrderBlockColor', type: 'color', title: 'Bullish', defval: 'rgba(8, 153, 129, 0.5)', inline: 'obColor', group: 'General Configuration' },
  { id: 'bearOrderBlockColor', type: 'color', title: 'Bearish', defval: 'rgba(242, 54, 70, 0.5)', inline: 'obColor', group: 'General Configuration' },
  { id: 'textColor', type: 'color', title: 'Text Color', defval: 'rgba(255, 255, 255, 0.5)', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volumized Order Blocks | Flux Charts',
  shortTitle: 'Volumized Order Blocks | Flux Charts',
  overlay: true,
};

/** Constants of the script */
const MAX_DISTANCE_TO_LAST_BAR = 1750;
const MAX_ORDER_BLOCKS = 30;
const MAX_ATR_MULT = 3.5;
const OVERLAP_THRESHOLD_PERCENTAGE = 0;

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (v: number) => (isNaN(v) ? 0 : v);

/** type orderBlockInfo: times in ms; breakTime is na (NaN) while the block is not invalidated */
interface OrderBlockInfo {
  top: number;
  bottom: number;
  obVolume: number;
  obType: 'Bull' | 'Bear';
  startTime: number;
  bbVolume: number;
  obLowVolume: number;
  obHighVolume: number;
  breaker: boolean;
  breakTime: number;
  disabled: boolean;
  combined: boolean;
}

/** type obSwing */
interface Swing {
  x: number;
  y: number;
  crossed: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderBlocksFluxChartsInputs> = {},
): Omit<IndicatorResult, 'boxes' | 'lines'> & { boxes: BoxData[]; lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const len = Math.trunc(cfg.swingLength);
  const shown = cfg.zoneCount === 'One' ? 1 : cfg.zoneCount === 'Low' ? 3 : cfg.zoneCount === 'Medium' ? 5 : 10;
  const wick = cfg.obEndMethod === 'Wick';
  const ms = n > 0 && bars[0].time >= 1e12;
  const timeMs = (i: number) => (ms ? bars[i].time : bars[i].time * 1000);
  const vol = (i: number) => (i >= 0 ? (bars[i].volume ?? NaN) : NaN);

  const atr = ta.atr(bars, 10).toArray().map((v) => v ?? NaN);

  const bullList: OrderBlockInfo[] = [];
  const bearList: OrderBlockInfo[] = [];

  // findOBSwings(): called only on the last bars, so its ta.highest / ta.lowest keep their history by bar
  const highestSite = callsite.highestByBar();
  const lowestSite = callsite.lowestByBar();
  let swingType = 0;
  let prevSwingType = NaN; // swingType[1]: na on the first call
  let top: Swing = { x: NaN, y: NaN, crossed: false };
  let btm: Swing = { x: NaN, y: NaN, crossed: false };

  for (let i = 0; i < n; i++) {
    // findOrderBlocks(): if bar_index > last_bar_index - maxDistanceToLastBar
    if (!(i > last - MAX_DISTANCE_TO_LAST_BAR)) continue;
    const b = bars[i];
    const upper = highestSite(i, b.high, len);
    const lower = lowestSite(i, b.low, len);
    const highBack = i >= len ? bars[i - len].high : NaN;
    const lowBack = i >= len ? bars[i - len].low : NaN;
    swingType = gt(highBack, upper) ? 0 : lt(lowBack, lower) ? 1 : swingType;
    // `swingType[1] != 0` is false while swingType[1] is na
    if (swingType === 0 && !isNaN(prevSwingType) && prevSwingType !== 0) top = { x: i - len, y: highBack, crossed: false };
    if (swingType === 1 && !isNaN(prevSwingType) && prevSwingType !== 1) btm = { x: i - len, y: lowBack, crossed: false };
    prevSwingType = swingType;

    // Bullish order blocks: invalidation, then removal
    for (let k = bullList.length - 1; k >= 0; k--) {
      const ob = bullList[k];
      if (!ob.breaker) {
        if (lt(wick ? b.low : Math.min(b.open, b.close), ob.bottom)) {
          ob.breaker = true;
          ob.breakTime = timeMs(i);
          ob.bbVolume = vol(i);
        }
      } else if (gt(b.high, ob.top)) {
        bullList.splice(k, 1);
      }
    }
    if (gt(b.close, top.y) && !top.crossed) {
      top.crossed = true;
      // the bar with the lowest low after the swing (the oldest one on a tie)
      let boxBtm = bars[i - 1].high;
      let boxTop = bars[i - 1].low;
      let boxLoc = timeMs(i - 1);
      for (let j = 1; j <= i - top.x - 1; j++) {
        const p = bars[i - j];
        boxBtm = Math.min(p.low, boxBtm);
        if (eq(boxBtm, p.low)) {
          boxTop = p.high;
          boxLoc = timeMs(i - j);
        }
      }
      const info: OrderBlockInfo = {
        top: boxTop, bottom: boxBtm, obVolume: vol(i) + vol(i - 1) + vol(i - 2), obType: 'Bull', startTime: boxLoc,
        bbVolume: NaN, obLowVolume: vol(i - 2), obHighVolume: vol(i) + vol(i - 1), breaker: false, breakTime: NaN,
        disabled: false, combined: false,
      };
      if (le(Math.abs(info.top - info.bottom), atr[i] * MAX_ATR_MULT)) {
        bullList.unshift(info);
        if (bullList.length > MAX_ORDER_BLOCKS) bullList.pop();
      }
    }

    // Bearish order blocks
    for (let k = bearList.length - 1; k >= 0; k--) {
      const ob = bearList[k];
      if (!ob.breaker) {
        if (gt(wick ? b.high : Math.max(b.open, b.close), ob.top)) {
          ob.breaker = true;
          ob.breakTime = timeMs(i);
          ob.bbVolume = vol(i);
        }
      } else if (lt(b.low, ob.bottom)) {
        bearList.splice(k, 1);
      }
    }
    if (lt(b.close, btm.y) && !btm.crossed) {
      btm.crossed = true;
      // the bar with the highest high after the swing (the oldest one on a tie)
      let boxBtm = bars[i - 1].low;
      let boxTop = bars[i - 1].high;
      let boxLoc = timeMs(i - 1);
      for (let j = 1; j <= i - btm.x - 1; j++) {
        const p = bars[i - j];
        boxTop = Math.max(p.high, boxTop);
        if (eq(boxTop, p.high)) {
          boxBtm = p.low;
          boxLoc = timeMs(i - j);
        }
      }
      const info: OrderBlockInfo = {
        top: boxTop, bottom: boxBtm, obVolume: vol(i) + vol(i - 1) + vol(i - 2), obType: 'Bear', startTime: boxLoc,
        bbVolume: NaN, obLowVolume: vol(i) + vol(i - 1), obHighVolume: vol(i - 2), breaker: false, breakTime: NaN,
        disabled: false, combined: false,
      };
      if (le(Math.abs(info.top - info.bottom), atr[i] * MAX_ATR_MULT)) {
        bearList.unshift(info);
        if (bearList.length > MAX_ORDER_BLOCKS) bearList.pop();
      }
    }
  }

  const boxes: BoxData[] = [];
  const lines: LineDrawingData[] = [];
  const result = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    lines,
  });
  if (n === 0) return result();

  // handleOrderBlocksFinal() on the last bar: every bar deletes all drawings and draws the lists again
  const time = timeMs(last);
  const all: OrderBlockInfo[] = [];
  for (let j = 0; j <= Math.min(bullList.length - 1, shown - 1); j++) all.unshift({ ...bullList[j] });
  for (let j = 0; j <= Math.min(bearList.length - 1, shown - 1); j++) all.unshift({ ...bearList[j] });

  // areaOfOB(), doOBsTouch()
  const endOf = (o: OrderBlockInfo) => (isNaN(o.breakTime) ? time + 1 : o.breakTime);
  const areaOf = (o: OrderBlockInfo) => {
    const xa1 = o.startTime;
    const xa2 = endOf(o);
    const edge1 = Math.sqrt((xa2 - xa1) * (xa2 - xa1));
    const edge2 = Math.sqrt((o.bottom - o.top) * (o.bottom - o.top));
    return edge1 * edge2;
  };
  const touch = (a: OrderBlockInfo, b: OrderBlockInfo) => {
    const intersection = Math.max(0, Math.min(endOf(a), endOf(b)) - Math.max(a.startTime, b.startTime))
      * Math.max(0, Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom));
    const union = areaOf(a) + areaOf(b) - intersection;
    return gt((intersection / union) * 100, OVERLAP_THRESHOLD_PERCENTAGE);
  };

  // combineOBsFunc(): the end of a `for` loop is read once, when the loop starts; a merged block goes to the front
  if (all.length > 0) {
    let lastCombinations = 999;
    while (lastCombinations > 0) {
      lastCombinations = 0;
      const endI = all.length - 1;
      for (let i = 0; i <= endI; i++) {
        const ob1 = all[i];
        const endJ = all.length - 1;
        for (let j = 0; j <= endJ; j++) {
          const ob2 = all[j];
          if (i === j) continue;
          if (ob1.disabled || ob2.disabled) continue;
          if (ob1.obType !== ob2.obType) continue;
          if (touch(ob1, ob2)) {
            ob1.disabled = true;
            ob2.disabled = true;
            const breakTime = Math.max(nz(ob1.breakTime), nz(ob2.breakTime));
            all.unshift({
              top: Math.max(ob1.top, ob2.top),
              bottom: Math.min(ob1.bottom, ob2.bottom),
              obVolume: ob1.obVolume + ob2.obVolume,
              obType: ob1.obType,
              startTime: Math.min(ob1.startTime, ob2.startTime),
              breakTime: breakTime === 0 ? NaN : breakTime,
              obLowVolume: ob1.obLowVolume + ob2.obLowVolume,
              obHighVolume: ob1.obHighVolume + ob2.obHighVolume,
              bbVolume: nz(ob1.bbVolume) + nz(ob2.bbVolume),
              breaker: ob1.breaker || ob2.breaker,
              disabled: false,
              combined: true,
            });
            lastCombinations += 1;
          }
        }
      }
    }
  }

  // formatTimeframeString(timeframe.period)
  const chart = chartTimeframe(bars).replace(/^1([DWM])$/, '$1');
  let tfText = chart;
  if (chart !== '' && !/[DWSM]/.test(chart)) {
    const seconds = timeframe.in_seconds(chart);
    if (seconds >= 3600) {
      const hourCount = Math.trunc(seconds / 3600);
      tfText = `${hourCount} Hour${hourCount > 1 ? 's' : ''}`;
    } else {
      tfText = `${chart} Min`;
    }
  }

  // The drawings use times (xloc.bar_time): a time is shown on the first bar that starts at or after it. A time
  // after the start of the last bar is on the bar slot that holds it: an open block ends 1 ms after the start of the
  // last bar, on the last bar.
  const interval = barInterval(bars);
  const intervalMs = ms ? interval : interval * 1000;
  const barOf = (t: number) => {
    if (t > timeMs(last)) return barTime(bars, last + Math.floor((t - timeMs(last)) / intervalMs), interval);
    let lo = 0;
    let hi = last;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (timeMs(mid) >= t) hi = mid;
      else lo = mid + 1;
    }
    return bars[lo].time;
  };
  // colorWithTransparency(): color.new(c, color.t(c) * x)
  const withTransparency = (c: string, x: number) => String(color.new(c, color.t(c) * x));
  const obBox = (bg: string, x1: number, y1: number, x2: number, y2: number, text: string): BoxData => ({
    time1: barOf(x1), price1: y1, time2: barOf(x2), price2: y2, bgColor: bg, borderColor: '#00000000',
    text, textColor: cfg.textColor, textSize: 'normal', textHAlign: 'center',
  });

  // renderOrderBlock()
  for (const info of all) {
    if (info.disabled) continue;
    if (!cfg.showInvalidated && info.breaker) continue;
    const orderColor = info.obType === 'Bull' ? cfg.bullOrderBlockColor : cfg.bearOrderBlockColor;
    const zoneSize = isNaN(info.breakTime) ? time + 1 - info.startTime : info.breakTime - info.startTime;
    const startX = info.startTime;
    const maxEndX = info.startTime + zoneSize / 3;
    const endX = info.startTime + zoneSize;
    const mid = (info.bottom + info.top) / 2;

    const percentage = Math.trunc((Math.min(info.obHighVolume, info.obLowVolume) / Math.max(info.obHighVolume, info.obLowVolume)) * 100);
    const text = (cfg.orderBlockVolumetricInfo ? `${str.tostring(info.obVolume, 'volume')} (${str.tostring(percentage)}%)\n` : '')
      + `${tfText} OB`;

    boxes.push(obBox(withTransparency(orderColor, info.combined ? 1.1 : 1.5), startX, info.top, endX, info.bottom, ''));
    boxes.push(obBox(withTransparency('#FFFFFF00', 1.0), maxEndX, info.top, endX, info.bottom, text));
    if (cfg.orderBlockVolumetricInfo) {
      const curEndXHigh = Math.ceil((info.obHighVolume / info.obVolume) * (maxEndX - startX) + startX);
      const curEndXLow = Math.ceil((info.obLowVolume / info.obVolume) * (maxEndX - startX) + startX);
      boxes.push(obBox(withTransparency(cfg.bullOrderBlockColor, 1.0), startX, info.top, curEndXHigh, mid, ''));
      boxes.push(obBox(withTransparency(cfg.bearOrderBlockColor, 1.0), startX, info.bottom, curEndXLow, mid, ''));
      lines.push({ time1: barOf(startX), price1: mid, time2: barOf(maxEndX), price2: mid, color: cfg.textColor, width: 1, style: 'dashed' });
      lines.push({ time1: barOf(maxEndX), price1: info.top, time2: barOf(maxEndX), price2: info.bottom, color: cfg.textColor, width: 1 });
    }
  }

  return result();
}

export const OrderBlocksFluxCharts = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
