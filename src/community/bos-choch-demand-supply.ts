/**
 * BOS/CHOCH Demand & Supply
 *
 * Market structure on several pivot lookbacks at once ("Pivot Lookback Periods", a comma-separated list). For each
 * lookback L the script keeps the last and the previous pivot high / low (ta.pivothigh / ta.pivotlow(L, L)) and the
 * candle of the last pivots. A close above the last pivot high (with the high of the bar before below it) is a
 * bullish break: a Change of Character when the last pivot high is below the previous one, a Break of Structure
 * when it is above it (or when there is no previous one). It creates a demand zone on the candle of the last pivot
 * low (top = max(open, close), bottom = low) with a label "BOS Demand (L)" / "CHOCH Demand (L)" (" + IDM" when
 * "Require Inducement" is on and the last low swept the previous low). Bearish breaks of the last pivot low create
 * supply zones on the candle of the last pivot high in the same way. On confirmed bars a zone is removed when the
 * low goes below a demand zone (the high above a supply zone) and turns grey (mitigated) when price comes back into
 * it; only the last "Max Number of Active Boxes per Type" zones of each type are kept.
 *
 * The zone boxes are created with `right = na` as in the original: such a box is not drawn (it still counts in the
 * box limit), so the visible output is the labels (the drawing registry gives no box for it). Alerts: the four
 * alertconditions of the original (`alerts` of the result).
 *
 * Chart context (optional third argument of calculate): whether the last bar is closed (`barstate.isconfirmed`, the
 * zone management skips an open last bar). Without it the last bar counts as closed.
 *
 * Reference: "BOS/CHOCH Demand & Supply" by s3u1l
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, box, label, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Box, type Label,
} from 'oakscriptjs';
import type { BoxData, LabelData } from '../types';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface BosChochDemandSupplyInputs {
  /** Pivot Lookback Periods (comma-separated) */
  pivotLookback_str: string;
  /** Max Number of Active Boxes per Type */
  maxNumberOfBoxes: number;
  showBOS: boolean;
  showCHOCH: boolean;
  requireInducement: boolean;
  showAlerts_NewPattern: boolean;
  showAlerts_Mitigation: boolean;
  showAlerts_Break: boolean;
}

export const defaultInputs: BosChochDemandSupplyInputs = {
  pivotLookback_str: '1, 2,3, 5, 11,15,20',
  maxNumberOfBoxes: 50,
  showBOS: true,
  showCHOCH: true,
  requireInducement: false,
  showAlerts_NewPattern: true,
  showAlerts_Mitigation: true,
  showAlerts_Break: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLookback_str', type: 'string', title: 'Pivot Lookback Periods (comma-separated)', defval: '1, 2,3, 5, 11,15,20',
    tooltip: 'Enter multiple lookback periods separated by a comma. Example: 5,15,30' },
  { id: 'maxNumberOfBoxes', type: 'int', title: 'Max Number of Active Boxes per Type', defval: 50, min: 1, max: 500 },
  { id: 'showBOS', type: 'bool', title: 'Show Break of Structure (BOS) Zones', defval: true, group: 'Zone Display Settings' },
  { id: 'showCHOCH', type: 'bool', title: 'Show Change of Character (CHOCH) Zones', defval: true, group: 'Zone Display Settings' },
  { id: 'requireInducement', type: 'bool', title: 'Require Inducement / Liquidity Grab', defval: false, group: 'SMC Settings',
    tooltip: 'If checked, a zone will only be drawn if the swing point creating it took liquidity from the previous swing point. This identifies high-probability zones.' },
  { id: 'showAlerts_NewPattern', type: 'bool', title: 'Alert on New Confirmed Zone', defval: true, group: 'Alert Settings' },
  { id: 'showAlerts_Mitigation', type: 'bool', title: 'Alert on Zone Mitigation', defval: true, group: 'Alert Settings' },
  { id: 'showAlerts_Break', type: 'bool', title: 'Alert on Zone Break', defval: true, group: 'Alert Settings' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label'];

export const metadata = {
  title: 'BOS/CHOCH Demand & Supply',
  shortTitle: 'BOS/CHOCH Demand & Supply',
  overlay: true,
};

/** Pine version 5 colours */
const GREEN = '#4CAF50';
const RED = '#FF5252';
const GRAY = '#787B86';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

interface Zone {
  box: Box;
  label: Label;
  top: number;
  bottom: number;
  mitigated: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BosChochDemandSupplyInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { boxes: BoxData[]; labels: LabelData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const lastConfirmed = lastBarConfirmedOf(chart);

  // barstate.isfirst: lookbackPeriods = int(str.tonumber(str.trim(s))) for each comma-separated part
  const lookbacks = str.split(cfg.pivotLookback_str, ',').map((s) => {
    const v = str.tonumber(str.trim(s));
    return v === null || !Number.isFinite(v) ? NaN : Math.trunc(v);
  });
  const num = lookbacks.length;

  // ta.pivothigh / ta.pivotlow(L, L) of each lookback (a call in the loop reads the high / low history only)
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const ph = lookbacks.map((L) => A(ta.pivothigh(highS, L, L)));
  const pl = lookbacks.map((L) => A(ta.pivotlow(lowS, L, L)));

  const na = () => new Array<number>(num).fill(NaN);
  const lastHighs = na();
  const lastHighBars = na();
  const lastHighHighs = na();
  const lastHighOpen = na();
  const lastHighClose = na();
  const prevHighs = na();
  const lastLows = na();
  const lastLowBars = na();
  const lastLowsLow = na();
  const lastLowsOpen = na();
  const lastLowsClose = na();
  const prevLows = na();

  const bull: Zone[] = [];
  const bear: Zone[] = [];
  const newBull: boolean[] = [];
  const newBear: boolean[] = [];
  const mitigatedFlags: boolean[] = [];
  const brokenFlags: boolean[] = [];

  resetDrawings();
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === last);
    const b = bars[i];
    const prevHigh1 = i > 0 ? bars[i - 1].high : NaN;
    const prevLow1 = i > 0 ? bars[i - 1].low : NaN;
    let anyBull = false;
    let anyBear = false;

    for (let k = 0; k < num; k++) {
      const L = lookbacks[k];
      if (!isNaN(ph[k][i])) {
        prevHighs[k] = lastHighs[k];
        lastHighs[k] = ph[k][i];
        lastHighBars[k] = i - L;
        lastHighHighs[k] = bars[i - L].high;
        lastHighOpen[k] = bars[i - L].open;
        lastHighClose[k] = bars[i - L].close;
      }
      if (!isNaN(pl[k][i])) {
        prevLows[k] = lastLows[k];
        lastLows[k] = pl[k][i];
        lastLowBars[k] = i - L;
        lastLowsLow[k] = bars[i - L].low;
        lastLowsOpen[k] = bars[i - L].open;
        lastLowsClose[k] = bars[i - L].close;
      }
      const lastHigh = lastHighs[k];
      const prevHigh = prevHighs[k];
      const lastLow = lastLows[k];
      const prevLow = prevLows[k];

      const isBullishBreak = gt(b.close, lastHigh) && lt(prevHigh1, lastHigh) && !isNaN(lastHigh) && !isNaN(lastLow);
      const isBearishBreak = lt(b.close, lastLow) && gt(prevLow1, lastLow) && !isNaN(lastLow) && !isNaN(lastHigh);
      const inducementBull = lt(lastLow, prevLow) && !isNaN(prevLow);
      const inducementBear = gt(lastHigh, prevHigh) && !isNaN(prevHigh);

      if (isBullishBreak) {
        const isCHOCH = lt(lastHigh, prevHigh);
        const isBOS = isNaN(prevHigh) || gt(lastHigh, prevHigh);
        if (((isCHOCH && cfg.showCHOCH) || (isBOS && cfg.showBOS)) && (!cfg.requireInducement || inducementBull)) {
          anyBull = true;
          const x = lastLowBars[k];
          let text = isCHOCH ? 'CHOCH Demand' : 'BOS Demand';
          if (cfg.requireInducement && inducementBull) text += ' + IDM';
          const top = Math.max(lastLowsOpen[k], lastLowsClose[k]);
          const bottom = lastLowsLow[k];
          const bx = box.new(x, top, NaN, bottom, GREEN, undefined, undefined, undefined, undefined, String(color.new(GREEN, 80)));
          const lb = label.new(x, bottom, text + ' (' + str.tostring(L) + ')', 'bar_index', 'price',
            String(color.new(GREEN, 20)), 'label_up', '#FFFFFF', 'small');
          bull.push({ box: bx, label: lb, top, bottom, mitigated: false });
        }
      }
      if (isBearishBreak) {
        const isCHOCH = gt(lastLow, prevLow);
        const isBOS = isNaN(prevLow) || lt(lastLow, prevLow);
        if (((isCHOCH && cfg.showCHOCH) || (isBOS && cfg.showBOS)) && (!cfg.requireInducement || inducementBear)) {
          anyBear = true;
          const x = lastHighBars[k];
          let text = isCHOCH ? 'CHOCH Supply' : 'BOS Supply';
          if (cfg.requireInducement && inducementBear) text += ' + IDM';
          const top = lastHighHighs[k];
          const bottom = Math.min(lastHighOpen[k], lastHighClose[k]);
          const bx = box.new(x, top, NaN, bottom, RED, undefined, undefined, undefined, undefined, String(color.new(RED, 80)));
          const lb = label.new(x, top, text + ' (' + str.tostring(L) + ')', 'bar_index', 'price',
            String(color.new(RED, 20)), 'label_down', '#FFFFFF', 'small');
          bear.push({ box: bx, label: lb, top, bottom, mitigated: false });
        }
      }
    }

    // zone management on confirmed bars (the last bar of a live chart is not confirmed)
    let mitigated = false;
    let broken = false;
    const confirmed = i < last || lastConfirmed;
    if (confirmed && bull.length > 0) {
      for (let j = bull.length - 1; j >= 0; j--) {
        const z = bull[j];
        if (lt(b.low, z.bottom)) {
          box.delete(z.box);
          label.delete(z.label);
          bull.splice(j, 1);
          broken = true;
          continue;
        }
        if (!z.mitigated && le(b.low, z.top)) {
          box.set_border_color(z.box, GRAY);
          box.set_bgcolor(z.box, String(color.new(GRAY, 85)));
          label.set_color(z.label, GRAY);
          z.mitigated = true;
          mitigated = true;
        }
      }
    }
    if (confirmed && bear.length > 0) {
      for (let j = bear.length - 1; j >= 0; j--) {
        const z = bear[j];
        if (gt(b.high, z.top)) {
          box.delete(z.box);
          label.delete(z.label);
          bear.splice(j, 1);
          broken = true;
          continue;
        }
        if (!z.mitigated && ge(b.high, z.bottom)) {
          box.set_border_color(z.box, GRAY);
          box.set_bgcolor(z.box, String(color.new(GRAY, 85)));
          label.set_color(z.label, GRAY);
          z.mitigated = true;
          mitigated = true;
        }
      }
    }
    // max box limit per type: the oldest zones go first
    while (bull.length > cfg.maxNumberOfBoxes) {
      const z = bull.shift() as Zone;
      box.delete(z.box);
      label.delete(z.label);
    }
    while (bear.length > cfg.maxNumberOfBoxes) {
      const z = bear.shift() as Zone;
      box.delete(z.box);
      label.delete(z.label);
    }

    newBull.push(cfg.showAlerts_NewPattern && anyBull);
    newBear.push(cfg.showAlerts_NewPattern && anyBear);
    mitigatedFlags.push(cfg.showAlerts_Mitigation && mitigated);
    brokenFlags.push(cfg.showAlerts_Break && broken);
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars);
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes: drawn.boxes ?? [],
    labels: drawn.labels ?? [],
    alerts: alertStates(alertConditions, bars, [newBull, newBear, mitigatedFlags, brokenFlags]),
  };
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New Confirmed Demand Zone', message: 'New Demand Zone (BOS/CHOCH) confirmed on {{ticker}}.' },
  { id: 'alert1', title: 'New Confirmed Supply Zone', message: 'New Supply Zone (BOS/CHOCH) confirmed on {{ticker}}.' },
  { id: 'alert2', title: 'Zone Mitigated', message: 'Price has mitigated a confirmed zone on {{ticker}}.' },
  { id: 'alert3', title: 'Zone Broken', message: 'Price has broken through a confirmed zone on {{ticker}}.' },
];

export const BosChochDemandSupply = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, alertConditions,
};
