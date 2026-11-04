/**
 * Supply Demand Zones PRO
 *
 * Supply zones at confirmed pivot highs and demand zones at confirmed pivot lows (ta.pivothigh / ta.pivotlow of
 * high / low, Swing Length bars each side) made in the Asian, London or New York hours (hour of the bar in the
 * exchange time zone: 0-8 Asian, 9-12 London, 13-21 New York). The zone is the range of the pivot bar, resized
 * around its middle to the Force / Max Zone Height times ta.atr(20), kept when it is at least the Min Zone Height
 * times the ATR and Min Distance bars after the last zone of its type. A zone that overlaps one of the 10 newest
 * unbroken zones of its type is merged into it. Each zone is a box from the pivot bar to 400 bars after the
 * current bar. A close (or wick) beyond the zone breaks it: it turns into a historic zone. On every bar the zones
 * are shown or hidden (fully transparent) by the lookback and Max Zones rules; the shown zones get an info label
 * (height and distance in pips, type, strength from the retests and the age, session, age in bars) and an "R"
 * label once price came back into them. The script keeps the 40 newest zones (Max Zones x 4); older drawings stay
 * as they were. At most 500 boxes and 500 labels are kept (the oldest are deleted, as max_boxes_count /
 * max_labels_count).
 *
 * Chart context: exchange time zone (sessions), symbol type, currency and ticker (pip size) and the state of the
 * last bar (a zone is only made on a closed bar).
 *
 * Alerts (alertcondition, `alerts` of the result): 'New Supply Zone' and 'New Demand Zone' (a confirmed pivot,
 * with Enable Alerts on).
 *
 * Reference: "Supply Demand Zones PRO" by ProjectSyndicate
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, str, time, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Box, type Label, type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import {
  currencyOf, lastBarConfirmedOf, symbolTypeOf, tickerOf, timezoneOf, type ChartContext,
} from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface SupplyDemandZonesProInputs {
  swingLen: number;
  maxZones: number;
  maxZoneHeightATR: number;
  minZoneHeightATR: number;
  forceZoneHeightATR: number;
  minZoneDistance: number;
  invalidationMethod: 'Close' | 'Wick';
  showHistoric: boolean;
  activeLookback: number;
  historicBars: number;
  showActiveLabels: boolean;
  showHistoricLabels: boolean;
  labelSize: 'Tiny' | 'Small' | 'Normal' | 'Large';
  activeSupplyCol: string;
  activeDemandCol: string;
  historicCol: string;
  showRetestMarkers: boolean;
  retestBullCol: string;
  retestBearCol: string;
  alertsOn: boolean;
}

export const defaultInputs: SupplyDemandZonesProInputs = {
  swingLen: 12,
  maxZones: 10,
  maxZoneHeightATR: 1.0,
  minZoneHeightATR: 1.0,
  forceZoneHeightATR: 1.0,
  minZoneDistance: 44,
  invalidationMethod: 'Close',
  showHistoric: true,
  activeLookback: 1000,
  historicBars: 1000,
  showActiveLabels: true,
  showHistoricLabels: false,
  labelSize: 'Large',
  activeSupplyCol: 'rgba(242, 54, 69, 0.2)',
  activeDemandCol: 'rgba(76, 175, 80, 0.2)',
  historicCol: 'rgba(120, 123, 134, 0.15)',
  showRetestMarkers: true,
  retestBullCol: '#4CAF50',
  retestBearCol: '#F23645',
  alertsOn: true,
};

const G_ZONE = 'Zone Detection';
const G_SET = 'Zone Settings';
const G_DISP = 'Display';
const G_COL = 'Colors';
const G_RET = 'Retests';

export const inputConfig: InputConfig[] = [
  { id: 'swingLen', type: 'int', title: 'Swing Length (Sensitivity)', defval: 12, min: 3, max: 50, tooltip: 'Higher = Less zones, more significant', group: G_ZONE },
  { id: 'maxZones', type: 'int', title: 'Max Zones to Display', defval: 10, min: 3, max: 30, group: G_ZONE },
  { id: 'maxZoneHeightATR', type: 'float', title: 'Max Zone Height (ATR Multiplier)', defval: 1.0, min: 0.5, max: 10.0, step: 0.5, tooltip: 'Zones larger than this will be clamped', group: G_ZONE },
  { id: 'minZoneHeightATR', type: 'float', title: 'Min Zone Height (ATR Multiplier)', defval: 1.0, min: 0.1, max: 2.0, step: 0.1, tooltip: 'Zones smaller than this will be rejected', group: G_ZONE },
  { id: 'forceZoneHeightATR', type: 'float', title: 'Force Zone Height (ATR Multiplier)', defval: 1.0, min: 0.2, max: 3.0, step: 0.1, tooltip: 'All zones will be expanded to at least this height', group: G_ZONE },
  { id: 'minZoneDistance', type: 'int', title: 'Min Distance Between Zones (bars)', defval: 44, min: 1, max: 100, group: G_ZONE },
  { id: 'invalidationMethod', type: 'string', title: 'Zone Invalidation', defval: 'Close', options: ['Close', 'Wick'], group: G_SET },
  { id: 'showHistoric', type: 'bool', title: 'Show Historic Zones', defval: true, group: G_SET },
  { id: 'activeLookback', type: 'int', title: 'Active Zones Lookback', defval: 1000, min: 100, max: 5000, group: G_SET },
  { id: 'historicBars', type: 'int', title: 'Historic Zones Lookback', defval: 1000, min: 100, max: 5000, group: G_SET },
  { id: 'showActiveLabels', type: 'bool', title: 'Show Active Zone Info', defval: true, group: G_DISP },
  { id: 'showHistoricLabels', type: 'bool', title: 'Show Historic Zone Info', defval: false, group: G_DISP },
  { id: 'labelSize', type: 'string', title: 'Label Size', defval: 'Large', options: ['Tiny', 'Small', 'Normal', 'Large'], group: G_DISP },
  { id: 'activeSupplyCol', type: 'color', title: 'Active Supply', defval: defaultInputs.activeSupplyCol, group: G_COL },
  { id: 'activeDemandCol', type: 'color', title: 'Active Demand', defval: defaultInputs.activeDemandCol, group: G_COL },
  { id: 'historicCol', type: 'color', title: 'Historic Zones', defval: defaultInputs.historicCol, group: G_COL },
  { id: 'showRetestMarkers', type: 'bool', title: 'Show Retests', defval: true, group: G_RET },
  { id: 'retestBullCol', type: 'color', title: 'Demand Retest', defval: '#4CAF50', group: G_RET },
  { id: 'retestBearCol', type: 'color', title: 'Supply Retest', defval: '#F23645', group: G_RET },
  { id: 'alertsOn', type: 'bool', title: 'Enable Alerts', defval: true, group: 'Alerts' },
];

export const plotConfig: PlotConfig[] = [];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New Supply Zone', message: '{{ticker}} - New Supply Zone @ {{close}}' },
  { id: 'alert1', title: 'New Demand Zone', message: '{{ticker}} - New Demand Zone @ {{close}}' },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label'];

export const metadata = {
  title: 'Supply Demand Zones PRO',
  shortTitle: 'Supply Demand Zones PRO',
  overlay: true,
};

const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);

const RED = '#F23645';
const GREEN = '#4CAF50';
const GRAY = '#787B86';
const WHITE = '#FFFFFF';
/** color.new(c, 100): fully transparent */
const HIDDEN = 'rgba(0, 0, 0, 0)';

interface ZoneData {
  zoneBox: Box;
  infoLabel: Label | undefined;
  retestLabel: Label | undefined;
  top: number;
  bottom: number;
  startBar: number;
  session: string;
  retests: number;
  broken: boolean;
  zoneType: 'Supply' | 'Demand';
  retestCounted: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupplyDemandZonesProInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const swingLen = cfg.swingLen;
  const tz = timezoneOf(chart);
  const ms = n > 0 && bars[0].time >= 1e12;
  const lastConfirmed = lastBarConfirmedOf(chart);

  // f_getPips
  const ticker = tickerOf(chart);
  const pips = symbolTypeOf(chart) === 'forex' ? (currencyOf(chart) === 'JPY' ? 0.01 : 0.0001)
    : ticker === 'XAUUSD' || ticker === 'GOLD' ? 0.1 : 0.0001;
  const toPips = (v: number) => Math.abs(v) / pips;
  // f_getSession
  const sessionOf = (t: number): string => {
    const h = time.hour(ms ? t : t * 1000, tz);
    return h >= 0 && h < 9 ? 'Asian' : h >= 8 && h < 13 ? 'London' : h >= 13 && h < 22 ? 'New York' : 'Other';
  };
  const lblSize = cfg.labelSize === 'Tiny' ? 'tiny' : cfg.labelSize === 'Small' ? 'small'
    : cfg.labelSize === 'Normal' ? 'normal' : 'large';
  const calcStrength = (retests: number, age: number) => {
    const s = 8.0 - retests * 0.8 - Math.min(age / 500.0, 2.0);
    return Math.trunc(Math.max(0, Math.min(10, s)));
  };
  const labelColor = (zoneType: string, broken: boolean) => (broken ? GRAY : zoneType === 'Supply' ? RED : GREEN);

  const A = (s: Series) => s.toArray().map((v) => (v == null ? NaN : v));
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const atr = A(ta.atr(bars, 20));
  const ph = A(ta.pivothigh(high, swingLen, swingLen));
  const pl = A(ta.pivotlow(low, swingLen, swingLen));

  resetDrawings({ box: 500, label: 500 });
  const allZones: ZoneData[] = [];
  let lastSupplyBar = 0;
  let lastDemandBar = 0;
  const supplyFlags: boolean[] = [];
  const demandFlags: boolean[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const confirmed = i < n - 1 || lastConfirmed;

    // zone creation (supply at a pivot high, demand at a pivot low)
    const create = (zoneType: 'Supply' | 'Demand') => {
      const sess = sessionOf(b.time);
      if (sess === 'Other') return;
      let top = bars[i - swingLen].high;
      let bot = bars[i - swingLen].low;
      const startBar = i - swingLen;
      const lastBar = zoneType === 'Supply' ? lastSupplyBar : lastDemandBar;
      if (!(i - lastBar >= cfg.minZoneDistance)) return;
      const mid = (top + bot) / 2;
      let zoneHeight = top - bot;
      if (lt(zoneHeight, atr[i] * cfg.forceZoneHeightATR)) {
        const forcedHeight = atr[i] * cfg.forceZoneHeightATR;
        top = mid + forcedHeight / 2;
        bot = mid - forcedHeight / 2;
        zoneHeight = forcedHeight;
      }
      if (gt(zoneHeight, atr[i] * cfg.maxZoneHeightATR)) {
        const maxHeight = atr[i] * cfg.maxZoneHeightATR;
        top = mid + maxHeight / 2;
        bot = mid - maxHeight / 2;
        zoneHeight = maxHeight;
      }
      if (!ge(zoneHeight, atr[i] * cfg.minZoneHeightATR)) return;
      let merged = false;
      if (allZones.length > 0) {
        for (let k = allZones.length - 1; k >= Math.max(0, allZones.length - 10); k--) {
          const z = allZones[k];
          if (z.zoneType === zoneType && !z.broken) {
            if (ge(top, z.bottom) && le(bot, z.top)) {
              const newTop = Math.max(top, z.top);
              const newBot = Math.min(bot, z.bottom);
              z.top = newTop;
              z.bottom = newBot;
              box.set_top(z.zoneBox, newTop);
              box.set_bottom(z.zoneBox, newBot);
              merged = true;
              break;
            }
          }
        }
      }
      if (!merged) {
        const zoneBox = box.new(startBar, top, i + 400, bot, undefined, 0, 'solid', 'none', 'bar_index',
          zoneType === 'Supply' ? cfg.activeSupplyCol : cfg.activeDemandCol);
        allZones.push({
          zoneBox, infoLabel: undefined, retestLabel: undefined, top, bottom: bot, startBar, session: sess,
          retests: 0, broken: false, zoneType, retestCounted: false,
        });
        if (zoneType === 'Supply') lastSupplyBar = i;
        else lastDemandBar = i;
        if (allZones.length > cfg.maxZones * 4) allZones.shift();
      }
    };
    if (!Number.isNaN(ph[i]) && confirmed) create('Supply');
    if (!Number.isNaN(pl[i]) && confirmed) create('Demand');

    // update zones
    if (allZones.length > 0) {
      let activeSupplyCount = 0;
      let activeDemandCount = 0;
      let historicSupplyCount = 0;
      let historicDemandCount = 0;
      for (const z of allZones) {
        box.set_right(z.zoneBox, i + 400);
        if (!z.broken) {
          const priceInZone = ge(b.high, z.bottom) && le(b.low, z.top);
          if (priceInZone && !z.retestCounted) {
            z.retests += 1;
            z.retestCounted = true;
          } else if (!priceInZone) {
            z.retestCounted = false;
          }
        }
        if (!z.broken) {
          if (z.zoneType === 'Supply') {
            const breakLevel = cfg.invalidationMethod === 'Close' ? b.close : b.high;
            if (gt(breakLevel, z.top)) {
              z.broken = true;
              box.set_bgcolor(z.zoneBox, cfg.historicCol);
            }
          } else {
            const breakLevel = cfg.invalidationMethod === 'Close' ? b.close : b.low;
            if (lt(breakLevel, z.bottom)) {
              z.broken = true;
              box.set_bgcolor(z.zoneBox, cfg.historicCol);
            }
          }
        }
        const age = i - z.startBar;
        const zoneHeight = z.top - z.bottom;
        let shouldHide = false;
        if (z.broken && !cfg.showHistoric) shouldHide = true;
        if (z.broken && age > cfg.historicBars) shouldHide = true;
        if (!z.broken && age > cfg.activeLookback) shouldHide = true;
        if (z.broken && cfg.showHistoric) {
          if (lt(zoneHeight, atr[i] * cfg.minZoneHeightATR)) shouldHide = true;
          if (z.zoneType === 'Supply') {
            if (historicSupplyCount >= cfg.maxZones) shouldHide = true;
            else if (!shouldHide) historicSupplyCount += 1;
          } else {
            if (historicDemandCount >= cfg.maxZones) shouldHide = true;
            else if (!shouldHide) historicDemandCount += 1;
          }
        }
        if (!z.broken && !shouldHide) {
          if (z.zoneType === 'Supply') {
            if (activeSupplyCount >= cfg.maxZones) shouldHide = true;
            else activeSupplyCount += 1;
          } else {
            if (activeDemandCount >= cfg.maxZones) shouldHide = true;
            else activeDemandCount += 1;
          }
        }

        if (shouldHide) {
          box.set_bgcolor(z.zoneBox, HIDDEN);
          box.set_border_color(z.zoneBox, HIDDEN);
          if (z.infoLabel) {
            label.set_color(z.infoLabel, HIDDEN);
            label.set_textcolor(z.infoLabel, HIDDEN);
          }
          if (z.retestLabel) {
            label.set_color(z.retestLabel, HIDDEN);
            label.set_textcolor(z.retestLabel, HIDDEN);
          }
        } else {
          if (z.broken) box.set_bgcolor(z.zoneBox, cfg.historicCol);
          else box.set_bgcolor(z.zoneBox, z.zoneType === 'Supply' ? cfg.activeSupplyCol : cfg.activeDemandCol);

          const showThisLabel = z.broken ? cfg.showHistoricLabels : cfg.showActiveLabels;
          if (showThisLabel) {
            const heightPips = toPips(z.top - z.bottom);
            const distPips = z.zoneType === 'Supply' ? toPips(z.bottom - b.close) : toPips(b.close - z.top);
            const strength = calcStrength(z.retests, age);
            const txt = str.format('{0,number,#} pips || {1} || Strength {2}/10 || {3} || {4} bars || {5,number,#} pips away',
              heightPips, z.zoneType, strength, z.session, age, Math.abs(distPips));
            const mid = (z.top + z.bottom) / 2;
            const lblColor = labelColor(z.zoneType, z.broken);
            if (!z.infoLabel) {
              z.infoLabel = label.new(z.startBar + 10, mid, txt, 'bar_index', 'price', HIDDEN, 'label_left', lblColor, lblSize);
            } else {
              label.set_text(z.infoLabel, txt);
              label.set_y(z.infoLabel, mid);
              label.set_color(z.infoLabel, HIDDEN);
              label.set_textcolor(z.infoLabel, lblColor);
              label.set_size(z.infoLabel, lblSize);
              label.set_style(z.infoLabel, 'label_left');
              label.set_x(z.infoLabel, z.startBar + 10);
            }
          } else if (z.infoLabel) {
            label.set_color(z.infoLabel, HIDDEN);
            label.set_textcolor(z.infoLabel, HIDDEN);
          }

          if (cfg.showRetestMarkers && z.retests > 0) {
            if (!z.retestLabel) {
              z.retestLabel = z.zoneType === 'Supply'
                ? label.new(z.startBar + 3, z.top, 'R', 'bar_index', 'price', cfg.retestBearCol, 'label_down', WHITE, 'small')
                : label.new(z.startBar + 3, z.bottom, 'R', 'bar_index', 'price', cfg.retestBullCol, 'label_up', WHITE, 'small');
            } else {
              label.set_color(z.retestLabel, z.zoneType === 'Supply' ? cfg.retestBearCol : cfg.retestBullCol);
              label.set_textcolor(z.retestLabel, WHITE);
            }
          } else if (z.retestLabel) {
            label.set_color(z.retestLabel, HIDDEN);
            label.set_textcolor(z.retestLabel, HIDDEN);
          }
        }
      }
    }

    supplyFlags.push(!Number.isNaN(ph[i]) && confirmed && cfg.alertsOn);
    demandFlags.push(!Number.isNaN(pl[i]) && confirmed && cfg.alertsOn);
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
    alerts: alertStates(alertConditions, bars, [supplyFlags, demandFlags]),
  };
}

export const SupplyDemandZonesPro = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, drawingKinds,
};
