/**
 * Liquidity Grabs (Flux Charts)
 *
 * Detects liquidity grabs by tracking pivot highs/lows as liquidity zones,
 * then flagging bars where price wicks beyond a zone but closes back inside.
 * Size is proportional to the wick-body ratio relative to the WBR threshold.
 * A cooldown prevents rapid-fire signals.
 *
 * Reference: TradingView "Liquidity Grabs | Flux Charts" by fluxchart
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface LiquidityGrabsInputs {
  pivotLength: number;
  wbr: number;
  cooldown: number;
  zoneCount: number;
}

export const defaultInputs: LiquidityGrabsInputs = {
  pivotLength: 25,
  wbr: 0.5,
  cooldown: 3,
  zoneCount: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 25, min: 1 },
  { id: 'wbr', type: 'float', title: 'Wick-Body Ratio', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'cooldown', type: 'int', title: 'Cooldown Bars', defval: 3, min: 0 },
  { id: 'zoneCount', type: 'int', title: 'Liquidity Zone Count', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'buySm', title: 'Buyside Liq Grab Small', color: '#f23646', lineWidth: 5, style: 'cross' },
  { id: 'buyMd', title: 'Buyside Liq Grab Medium', color: '#f23646', lineWidth: 7, style: 'cross' },
  { id: 'buyLg', title: 'Buyside Liq Grab Large', color: '#f23646', lineWidth: 10, style: 'cross' },
  { id: 'sellSm', title: 'Sellside Liq Grab Small', color: '#089981', lineWidth: 5, style: 'cross' },
  { id: 'sellMd', title: 'Sellside Liq Grab Medium', color: '#089981', lineWidth: 7, style: 'cross' },
  { id: 'sellLg', title: 'Sellside Liq Grab Large', color: '#089981', lineWidth: 10, style: 'cross' },
];

export const metadata = {
  title: 'Liquidity Grabs',
  shortTitle: 'LiqGrab',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LiquidityGrabsInputs> = {}): IndicatorResult {
  const { pivotLength, wbr, cooldown, zoneCount } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = pivotLength;

  const highArr = new Series(bars, (b) => b.high).toArray();
  const lowArr = new Series(bars, (b) => b.low).toArray();
  const closeArr = new Series(bars, (b) => b.close).toArray();
  const openArr = new Series(bars, (b) => b.open).toArray();

  // Detect pivot highs and lows (confirmed len bars later)
  const pivotHighs: (number | null)[] = new Array(n).fill(null);
  const pivotLows: (number | null)[] = new Array(n).fill(null);

  for (let i = len; i < n - len; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= len; j++) {
      if (highArr[i] <= highArr[i - j] || highArr[i] <= highArr[i + j]) isHigh = false;
      if (lowArr[i] >= lowArr[i - j] || lowArr[i] >= lowArr[i + j]) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivotHighs[i + len] = highArr[i];
    if (isLow) pivotLows[i + len] = lowArr[i];
  }

  // Liquidity grab detection
  const buySm: number[] = new Array(n).fill(NaN);
  const buyMd: number[] = new Array(n).fill(NaN);
  const buyLg: number[] = new Array(n).fill(NaN);
  const sellSm: number[] = new Array(n).fill(NaN);
  const sellMd: number[] = new Array(n).fill(NaN);
  const sellLg: number[] = new Array(n).fill(NaN);

  const buysideLiqs: number[] = [];
  const sellsideLiqs: number[] = [];
  let lastBuysideGrab = -cooldown - 1;
  let lastSellsideGrab = -cooldown - 1;

  for (let i = 0; i < n; i++) {
    // Add new pivot zones
    if (pivotHighs[i] !== null) {
      buysideLiqs.push(pivotHighs[i]!);
      if (buysideLiqs.length > zoneCount) buysideLiqs.shift();
    }
    if (pivotLows[i] !== null) {
      sellsideLiqs.push(pivotLows[i]!);
      if (sellsideLiqs.length > zoneCount) sellsideLiqs.shift();
    }

    const hi = highArr[i];
    const lo = lowArr[i];
    const cl = closeArr[i];
    const op = openArr[i];
    const topClose = Math.max(cl, op);
    const botClose = Math.min(cl, op);
    const bodySize = Math.abs(cl - op) || 0.0001; // avoid div by 0

    let grabFound = false;
    let grabBuyside = true;
    let grabSize = 0;
    const toRemove: number[] = [];

    // Check buyside (price wicks above pivot high but closes below)
    for (let j = 0; j < buysideLiqs.length; j++) {
      const liq = buysideLiqs[j];
      if (hi > liq && topClose < liq) {
        const wickSize = hi - topClose;
        const curWBR = wickSize / bodySize;
        grabFound = true;
        grabBuyside = true;
        grabSize = Math.min(Math.floor(curWBR / wbr), 3);
        toRemove.push(liq);
        break;
      }
      if (topClose > liq) {
        toRemove.push(liq);
        break;
      }
    }

    // Check sellside (price wicks below pivot low but closes above)
    if (!grabFound) {
      for (let j = 0; j < sellsideLiqs.length; j++) {
        const liq = sellsideLiqs[j];
        if (lo < liq && botClose > liq) {
          const wickSize = botClose - lo;
          const curWBR = wickSize / bodySize;
          grabFound = true;
          grabBuyside = false;
          grabSize = Math.min(Math.floor(curWBR / wbr), 3);
          toRemove.push(liq);
          break;
        }
        if (botClose < liq) {
          toRemove.push(liq);
          break;
        }
      }
    }

    // Remove consumed levels
    for (const liq of toRemove) {
      let idx = buysideLiqs.indexOf(liq);
      if (idx !== -1) { buysideLiqs.splice(idx, 1); continue; }
      idx = sellsideLiqs.indexOf(liq);
      if (idx !== -1) sellsideLiqs.splice(idx, 1);
    }

    // Apply cooldown and assign to plots
    if (grabFound && grabSize > 0) {
      const cooldownOk = grabBuyside
        ? (i - lastBuysideGrab) > cooldown
        : (i - lastSellsideGrab) > cooldown;

      if (cooldownOk) {
        if (grabBuyside) {
          lastBuysideGrab = i;
          if (grabSize === 1) buySm[i] = hi;
          else if (grabSize === 2) buyMd[i] = hi;
          else buyLg[i] = hi;
        } else {
          lastSellsideGrab = i;
          if (grabSize === 1) sellSm[i] = lo;
          else if (grabSize === 2) sellMd[i] = lo;
          else sellLg[i] = lo;
        }
      }
    }
  }

  const mkPlot = (arr: number[]) => arr.map((v, i) => ({ time: bars[i].time, value: v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'buySm': mkPlot(buySm),
      'buyMd': mkPlot(buyMd),
      'buyLg': mkPlot(buyLg),
      'sellSm': mkPlot(sellSm),
      'sellMd': mkPlot(sellMd),
      'sellLg': mkPlot(sellLg),
    },
  };
}

export const LiquidityGrabs = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
