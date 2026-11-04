/**
 * Balanced Price Range (BPR)
 *
 * Three-bar fair value gaps (FVG) on the last 5,000 bars: the middle body must be larger than 0.3 x the sum of the
 * two other bodies (unless "Sensitivity" is 0), the bar-to-bar gaps at most half an ATR(20) and the gap larger than
 * 0.08 x "Sensitivity" x ATR. A gap is bullish when the middle bar closes above its open. "FVG Detection Method" can
 * ask for three bars of the same type ("Same") or not all of the same type ("Mixed").
 * A gap invalidated by a close (or a wick, "FVG Invalidation Method") through its far side becomes an inverted gap
 * (IFVG). A new gap of the other direction that overlaps an IFVG (and starts before the IFVG ended) makes it a
 * balanced price range: the zone takes the price range of the new gap. A BPR ends when a wick (or a close, "BPR
 * Invalidation Method") crosses back through it; it is then removed (kept as a historic zone with "Show Historic
 * Zones"). Zones untouched for 200 bars are removed. A close back out of a BPR after a touch is a retest: a triangle
 * label under (bullish) or over (bearish) the bar ("Retests"), removed with its zone.
 * On the last closed bar each BPR is drawn: a box from the start of the first gap to its invalidation (the colour of
 * the BPR at 60 % transparency), a box from there to the end of the BPR (or 10 bars after the bar) with the text
 * "BPR", and a dashed middle line over the first box. A BPR whose second part is shorter than 4 bars is drawn as a
 * single box (the FVG colours of the original). Only closed bars are analysed: a last bar that is still open (chart
 * context `lastBarConfirmed` false) is left out and the zones are drawn on the bar before it.
 *
 * Alerts: 4 alertconditions (new bullish / bearish BPR, bullish / bearish BPR retest) and the same 4 messages as
 * alert() calls (`alertCalls`), each switched by its input of the "Alerts" group.
 *
 * Reference: "Balanced Price Range | Flux Charts" by fluxchart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This Pine Script® code is subject to the terms of the Creative Commons
 * Attribution-NonCommercial-ShareAlike 4.0 International License
 * (https://creativecommons.org/licenses/by-nc-sa/4.0/). © Flux Charts
 */

import {
  ta, color, timeframe, box, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Box, type Line, type Label,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, timeAfterLastBar } from '../anchor-period';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface BalancedPriceRangeFluxChartsInputs {
  showHistoricZones: boolean;
  fvgDetectionType: 'Same' | 'Mixed' | 'All';
  fvgInvalidation: 'Wick' | 'Close';
  ifvgInvalidation: 'Wick' | 'Close';
  fvgSensitivity: number;
  fvgLabel: boolean;
  retestsEnabled: boolean;
  ifvgBullColor: string;
  ifvgBearColor: string;
  textColor: string;
  dbgLabelTextSize: 'tiny' | 'small' | 'normal' | 'large' | 'huge' | 'auto';
  bullishBPRAlertEnabled: boolean;
  bearishBPRAlertEnabled: boolean;
  bullishBPRRetestAlertEnabled: boolean;
  bearishBPRRetestAlertEnabled: boolean;
}

export const defaultInputs: BalancedPriceRangeFluxChartsInputs = {
  showHistoricZones: false,
  fvgDetectionType: 'All',
  fvgInvalidation: 'Close',
  ifvgInvalidation: 'Wick',
  fvgSensitivity: 2,
  fvgLabel: true,
  retestsEnabled: true,
  // #08998150, #f2364650, #ffffff80: an input colour keeps an alpha of 2 decimals
  ifvgBullColor: 'rgba(8, 153, 129, 0.31)',
  ifvgBearColor: 'rgba(242, 54, 70, 0.31)',
  textColor: 'rgba(255, 255, 255, 0.5)',
  dbgLabelTextSize: 'normal',
  bullishBPRAlertEnabled: true,
  bearishBPRAlertEnabled: true,
  bullishBPRRetestAlertEnabled: true,
  bearishBPRRetestAlertEnabled: true,
};

const G_GEN = 'General Configuration';
const G_BPR = 'Balanced Price Range';
const G_STYLE = 'Style';
const G_ALERTS = 'Alerts';

export const inputConfig: InputConfig[] = [
  { id: 'showHistoricZones', type: 'bool', title: 'Show Historic Zones', defval: false, group: G_GEN },
  {
    id: 'fvgDetectionType', type: 'string', title: 'FVG Detection Method', defval: 'All', options: ['Same', 'Mixed', 'All'],
    group: G_BPR,
    tooltip: 'Same -> All 3 bars that formed the FVG should be the same type. (Bullish / Bearish) \n\nMixed-> Bar types must vary between bullish / bearish.\n\nAll -> Bar types may vary between bullish / bearish.',
  },
  { id: 'fvgInvalidation', type: 'string', title: 'FVG Invalidation Method', defval: 'Close', options: ['Wick', 'Close'], group: G_BPR },
  { id: 'ifvgInvalidation', type: 'string', title: 'BPR Invalidation Method', defval: 'Wick', options: ['Wick', 'Close'], group: G_BPR },
  {
    id: 'fvgSensitivity', type: 'int', title: 'Sensitivity', defval: 2, min: 0, max: 25, group: G_BPR,
    tooltip: 'Higher values may identify fewer, larger BPRs. Lower values may detect more, smaller BPRs.',
  },
  { id: 'fvgLabel', type: 'bool', title: 'Labels ', defval: true, group: G_BPR, inline: 'btm' },
  { id: 'retestsEnabled', type: 'bool', title: 'Retests', defval: true, group: G_BPR, inline: 'btm' },
  { id: 'ifvgBullColor', type: 'color', title: 'Bullish', defval: defaultInputs.ifvgBullColor, inline: 'EV', group: G_STYLE },
  { id: 'ifvgBearColor', type: 'color', title: 'Bearish', defval: defaultInputs.ifvgBearColor, inline: 'EV', group: G_STYLE },
  { id: 'textColor', type: 'color', title: 'Text Color', defval: defaultInputs.textColor, group: G_STYLE },
  {
    id: 'dbgLabelTextSize', type: 'string', title: 'Text Size', defval: 'normal',
    options: ['tiny', 'small', 'normal', 'large', 'huge', 'auto'],
  },
  { id: 'bullishBPRAlertEnabled', type: 'bool', title: 'Bullish BPR', defval: true, inline: 'BPR', group: G_ALERTS },
  { id: 'bearishBPRAlertEnabled', type: 'bool', title: 'Bearish BPR', defval: true, inline: 'BPR', group: G_ALERTS },
  { id: 'bullishBPRRetestAlertEnabled', type: 'bool', title: 'Bullish BPR Retest', defval: true, inline: 'BPR2', group: G_ALERTS },
  { id: 'bearishBPRRetestAlertEnabled', type: 'bool', title: 'Bearish BPR Retest', defval: true, inline: 'BPR2', group: G_ALERTS },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line', 'label'];

export const metadata = {
  title: 'Balanced Price Range | Flux Charts',
  shortTitle: 'BPR | Flux Charts',
  overlay: true,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Balanced Price Range', message: 'A new Bullish Balanced Price Range has formed.' },
  { id: 'alert1', title: 'Bearish Balanced Price Range', message: 'A new Bearish Balanced Price Range has formed.' },
  { id: 'alert2', title: 'Bullish Balanced Price Range Retest', message: 'A new Bullish Balanced Price Range retest occured.' },
  { id: 'alert3', title: 'Bearish Balanced Price Range Retest', message: 'A new Bearish Balanced Price Range retest occured.' },
];

/** The script also calls alert() */
export const hasAlertFunction = true;

// Constants of the original
const MIN_FVG_SIZE = 4;
const MIN_IFVG_SIZE = 4;
const ATR_LEN = 20;
const EXTEND_ZONES_BY = 10;
const DELETE_AFTER_UNTOUCHED = 200;
const BOUNDS = 5000;
const RETEST_SIZE = 4;
const MAX_BOXES = 500;
const FVG_BULL_COLOR = '#08998150';
const FVG_BEAR_COLOR = '#f2364650';

/** Pine float comparisons within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && b - a <= EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b <= EPS;
/** math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));

interface FVG {
  isBull: boolean;
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  lastTouchedIndex: number;
  dormant: boolean;
  isIFVG: boolean;
  ifvgEndTime: number;
  isBPR: boolean;
  zone: Box | null;
  ifvgZone: Box | null;
  volSeperatorLine: Line | null;
  retestLabels: Label[] | null;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BalancedPriceRangeFluxChartsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const ms = chart?.timeUnit === 'ms' || (n > 0 && bars[0].time >= 1e12);
  const unit = ms ? 1 : 1000;
  const T = bars.map((b) => b.time * unit);
  resetDrawings({ box: MAX_BOXES });

  const bullDetected = new Array<boolean>(n).fill(false);
  const bearDetected = new Array<boolean>(n).fill(false);
  const bullRetest = new Array<boolean>(n).fill(false);
  const bearRetest = new Array<boolean>(n).fill(false);
  const alertCalls: AlertCall[] = [];

  const curTFs = n > 0 ? timeframe.in_seconds(chartTimeframe(bars, chart) || '1D') : NaN;
  const atr = ta.atr(bars, ATR_LEN).toArray().map((v) => v ?? NaN);
  const sensCoefficient = cfg.fvgSensitivity * 0.08;
  // Every block runs on closed bars only: an open last bar is left out
  const end = lastBarConfirmedOf(chart) ? last : last - 1;

  const allFVGs: FVG[] = [];
  let fvgsToRemove: FVG[] = [];
  const queueForRemoval = (f: FVG) => {
    f.dormant = true;
    fvgsToRemove.push(f);
  };
  const destroyFVG = (f: FVG) => {
    if (f.zone) box.delete(f.zone);
    f.zone = null;
    if (f.ifvgZone) box.delete(f.ifvgZone);
    f.ifvgZone = null;
    if (f.volSeperatorLine) line.delete(f.volSeperatorLine);
    f.volSeperatorLine = null;
    if (f.retestLabels) {
      for (const l of f.retestLabels) label.delete(l);
      f.retestLabels = null;
    }
  };

  // History of the calls of detectFVG() (one call per closed bar inside the bounds)
  const bodyHist: number[] = [];
  const bullHist: boolean[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === last);
    const b = bars[i];
    const insideBounds = i > last - BOUNDS;
    const confirmed = i <= end;
    const o = (k: number) => (i - k >= 0 ? bars[i - k].open : NaN);
    const c = (k: number) => (i - k >= 0 ? bars[i - k].close : NaN);
    const h = (k: number) => (i - k >= 0 ? bars[i - k].high : NaN);
    const l = (k: number) => (i - k >= 0 ? bars[i - k].low : NaN);

    let bullishBPRDetected = false;
    let bearishBPRDetected = false;
    if (confirmed && insideBounds) {
      // detectFVG()
      let isBull = false;
      let startTime = NaN;
      let top = NaN;
      let bottom = NaN;
      const bodySize = Math.abs(b.open - b.close);
      bodyHist.push(bodySize);
      const body = (k: number) => (bodyHist.length - 1 - k >= 0 ? bodyHist[bodyHist.length - 1 - k] : NaN);
      let baseFVGCondition = gt(body(1), (bodySize + body(2)) * 0.3);
      baseFVGCondition = cfg.fvgSensitivity === 0 ? true : baseFVGCondition;
      let typeCondition = true;
      if (cfg.fvgDetectionType !== 'All') {
        const isBarBull = gt(b.close, b.open);
        bullHist.push(isBarBull);
        const bb = (k: number) => (bullHist.length - 1 - k >= 0 ? bullHist[bullHist.length - 1 - k] : false);
        typeCondition = baseFVGCondition && ((isBarBull && bb(1) && bb(2)) || (!isBarBull && !bb(1) && !bb(2)));
        typeCondition = cfg.fvgDetectionType === 'Mixed' ? !typeCondition : typeCondition;
      }
      if (baseFVGCondition && typeCondition) {
        isBull = gt(c(1), o(1));
        startTime = i >= 2 ? T[i - 2] : NaN;
        top = l(2);
        bottom = b.high;
        if (isBull) {
          top = b.low;
          bottom = h(2);
        }
      }
      let gapsCondition = true;
      if (baseFVGCondition) {
        const maxGap = max(Math.abs(b.open - c(1)), Math.abs(o(1) - c(2)));
        if (gt(maxGap, atr[i] * 0.5)) gapsCondition = false;
      }
      const sizeCondition = gt(top - bottom, atr[i] * sensCoefficient);
      if (!(gapsCondition && sizeCondition)) {
        isBull = false;
        startTime = NaN;
        top = NaN;
        bottom = NaN;
      }

      // detectBPR()
      let bprDetected = false;
      for (const cur of allFVGs) {
        if (cur.isBull !== isBull && cur.isIFVG && !cur.isBPR) {
          const yIntersect = ((le(bottom, cur.top) && ge(bottom, cur.bottom)) || (ge(top, cur.bottom) && le(top, cur.top)))
            || ((le(cur.bottom, top) && ge(cur.bottom, bottom)) || (ge(cur.top, bottom) && le(cur.top, top)));
          const xIntersect = Number.isNaN(cur.ifvgEndTime) || le(startTime, cur.ifvgEndTime);
          let overlappingPercentage = 0.0;
          if (yIntersect) {
            const rangeSize = Math.abs(top - bottom);
            const overlapTop = min(top, cur.top);
            const overlapBottom = max(bottom, cur.bottom);
            const overlapSize = max(0, overlapTop - overlapBottom);
            overlappingPercentage = (overlapSize / rangeSize) * 100.0;
          }
          if (yIntersect && xIntersect && gt(overlappingPercentage, 0)) {
            cur.top = top;
            cur.bottom = bottom;
            cur.lastTouchedIndex = i;
            cur.dormant = false;
            cur.isBPR = true;
            cur.isIFVG = true;
            bprDetected = true;
            break;
          }
        }
      }
      if (bprDetected) {
        bullishBPRDetected = isBull;
        bearishBPRDetected = !isBull;
      }
      if (!Number.isNaN(startTime) && !bprDetected) {
        // curFVGCount is never increased in the original: the maxFVGCount rule never applies
        allFVGs.push({
          isBull, startTime, endTime: NaN, top, bottom, lastTouchedIndex: i, dormant: false, isIFVG: false,
          ifvgEndTime: NaN, isBPR: false, zone: null, ifvgZone: null, volSeperatorLine: null, retestLabels: null,
        });
      }
    }

    // FVG update
    let renderBullishRetest = false;
    let renderBearishRetest = false;
    let bullishRetestBPR: FVG | null = null;
    let bearishRetestBPR: FVG | null = null;
    if (confirmed && insideBounds && allFVGs.length > 0) {
      const invBottomOf = (isClose: boolean) => (isClose ? Math.min(b.close, b.open) : b.low);
      const invTopOf = (isClose: boolean) => (isClose ? Math.max(b.close, b.open) : b.high);
      for (const f of allFVGs) {
        if (f.dormant) continue;
        let r1 = false;
        let r2 = false;
        if (!f.isIFVG) {
          const invalidateBottom = invBottomOf(cfg.fvgInvalidation !== 'Wick');
          const invalidateTop = invTopOf(cfg.fvgInvalidation !== 'Wick');
          if ((f.isBull && lt(invalidateBottom, f.bottom)) || (!f.isBull && gt(invalidateTop, f.top))) {
            // ifvgEnabled: the gap becomes an inverted gap
            f.endTime = T[i];
            f.dormant = false;
            f.isIFVG = true;
            destroyFVG(f);
          }
          if (f.isBull && lt(b.low, f.top)) {
            f.lastTouchedIndex = i;
          } else if (!f.isBull && gt(b.high, f.bottom)) {
            f.lastTouchedIndex = i;
          }
          if (i - f.lastTouchedIndex > DELETE_AFTER_UNTOUCHED) queueForRemoval(f);
        } else {
          const invalidateBottom = invBottomOf(cfg.ifvgInvalidation !== 'Wick');
          const invalidateTop = invTopOf(cfg.ifvgInvalidation !== 'Wick');
          if ((f.isBull && gt(invalidateTop, f.top)) || (!f.isBull && lt(invalidateBottom, f.bottom))) {
            f.ifvgEndTime = T[i];
            f.dormant = true;
            destroyFVG(f);
            if (!cfg.showHistoricZones) queueForRemoval(f);
          }
          if (f.isBull && gt(b.high, f.bottom)) {
            if (lt(b.close, f.bottom)) r2 = f.isBPR;
            f.lastTouchedIndex = i;
          } else if (!f.isBull && lt(b.low, f.top)) {
            if (gt(b.close, f.top)) r1 = f.isBPR;
            f.lastTouchedIndex = i;
          }
          if (i - f.lastTouchedIndex > DELETE_AFTER_UNTOUCHED) queueForRemoval(f);
        }
        if (!renderBullishRetest) {
          renderBullishRetest = r1;
          if (r1) bullishRetestBPR = f;
        }
        if (!renderBearishRetest) {
          renderBearishRetest = r2;
          if (r2) bearishRetestBPR = f;
        }
      }
    }

    if (cfg.retestsEnabled && renderBullishRetest && bullishRetestBPR) {
      const lab = label.new(i, b.close, '', 'bar_index', 'belowbar', String(color.new(cfg.ifvgBullColor, 0)), 'triangleup',
        undefined, RETEST_SIZE);
      (bullishRetestBPR.retestLabels ??= []).push(lab);
    }
    if (cfg.retestsEnabled && renderBearishRetest && bearishRetestBPR) {
      const lab = label.new(i, b.close, '', 'bar_index', 'abovebar', String(color.new(cfg.ifvgBearColor, 0)), 'triangledown',
        undefined, RETEST_SIZE);
      (bearishRetestBPR.retestLabels ??= []).push(lab);
    }

    if (fvgsToRemove.length > 0) {
      for (const f of fvgsToRemove) {
        destroyFVG(f);
        const k = allFVGs.indexOf(f);
        if (k !== -1) allFVGs.splice(k, 1);
      }
      fvgsToRemove = [];
    }

    // Render on the last closed bar (barstate.islastconfirmedhistory, or a closed last bar)
    if (i === end) {
      // time(timeframe.period, -extendZonesBy): the time of the bar 10 bars after this one
      const k = i + EXTEND_ZONES_BY;
      const futureTime = k <= last ? T[k] : timeAfterLastBar(bars, k - last, chart) * unit;
      for (const f of allFVGs) {
        if (!f.isBPR) continue;
        let renderAsIFVG = f.isIFVG;
        const endTime = Number.isNaN(f.endTime) ? futureTime : f.endTime;
        const ifvgEndTime = Number.isNaN(f.ifvgEndTime) ? futureTime : f.ifvgEndTime;
        if (!renderAsIFVG && endTime - f.startTime < curTFs * MIN_FVG_SIZE * 1000) {
          queueForRemoval(f);
          continue;
        }
        if (renderAsIFVG && ifvgEndTime - f.endTime < curTFs * MIN_IFVG_SIZE * 1000) renderAsIFVG = false;
        const midLine = (f.top + f.bottom) / 2.0;
        const curFVGColor = f.isBull ? FVG_BULL_COLOR : FVG_BEAR_COLOR;
        const curIFVGColor = f.isBull ? cfg.ifvgBearColor : cfg.ifvgBullColor;
        let fvgText = cfg.fvgLabel ? (renderAsIFVG ? 'IFVG' : 'FVG') : '';
        if (cfg.fvgLabel) fvgText = f.isBPR ? 'BPR' : fvgText;
        // timeframe.in_seconds(fvg.timeframeInput) with an na timeframe is the chart timeframe: no prefix
        if (f.zone === null) {
          f.zone = box.new(f.startTime, f.top, endTime, f.bottom, undefined, 0, undefined, undefined, 'bar_time',
            !renderAsIFVG ? curFVGColor : String(color.new(curIFVGColor, 60)), undefined, cfg.dbgLabelTextSize,
            cfg.textColor, 'center');
          if (renderAsIFVG) {
            f.ifvgZone = box.new(f.endTime, f.top, ifvgEndTime, f.bottom, undefined, 0, undefined, undefined, 'bar_time',
              curIFVGColor, undefined, cfg.dbgLabelTextSize, cfg.textColor, 'center');
            box.set_text(f.ifvgZone, fvgText);
            // fvgMidline (true): from the start of the zone to its end (ifvgMidline false)
            f.volSeperatorLine = line.new(f.startTime, midLine, endTime, midLine, 'bar_time', 'none', cfg.textColor,
              'dashed', 1);
          } else {
            box.set_text(f.zone, fvgText);
            f.volSeperatorLine = line.new(f.startTime, midLine, endTime, midLine, 'bar_time', 'none', cfg.textColor,
              'dashed', 1);
          }
        }
      }
    }

    bullDetected[i] = bullishBPRDetected;
    bearDetected[i] = bearishBPRDetected;
    bullRetest[i] = renderBullishRetest;
    bearRetest[i] = renderBearishRetest;
    if (cfg.bullishBPRAlertEnabled && bullishBPRDetected) {
      alertCalls.push({ time: b.time, message: 'A new Bullish Balanced Price Range has formed.', freq: 'once_per_bar' });
    }
    if (cfg.bearishBPRAlertEnabled && bearishBPRDetected) {
      alertCalls.push({ time: b.time, message: 'A new Bearish Balanced Price Range has formed.', freq: 'once_per_bar' });
    }
    if (renderBullishRetest && cfg.bullishBPRRetestAlertEnabled) {
      alertCalls.push({ time: b.time, message: 'A new Bullish Balanced Price Range retest occured.', freq: 'once_per_bar' });
    }
    if (renderBearishRetest && cfg.bearishBPRRetestAlertEnabled) {
      alertCalls.push({ time: b.time, message: 'A new Bearish Balanced Price Range retest occured.', freq: 'once_per_bar' });
    }
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars, ms ? 'ms' : 's');
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawn,
    alerts: alertStates(alertConditions, bars, [bullDetected, bearDetected, bullRetest, bearRetest]),
    alertCalls,
  };
}

export const BalancedPriceRangeFluxCharts = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, alertConditions, hasAlertFunction,
};
