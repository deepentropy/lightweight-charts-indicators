/**
 * Supply & Demand Zones [BacktestBot]
 *
 * A run of bullish candles (no bearish candle since the last bearish one) whose move from the open of its first
 * candle to the current close reaches "Min % change" adds a demand zone; a run of bearish candles adds a supply zone.
 * The zone level (s1) is the open of the candle before the run (the open two bars back when the candle before the run
 * is almost flat), and the zone spans that level and the low (demand) or the high (supply) of the candle before the
 * run and of the first candle of the run. A zone taller than "Max % zone height" is cut to that height. Each zone draws
 * a box from one bar before to two bars after the candle before the run (border and background of its type).
 *
 * A low at or below a demand level (a high at or above a supply level) hits the zone: its box turns transparent with a
 * dotted border and the zone is no longer active (the original checks `showDemandZone` for both types there, as
 * here). Above "Max number of zones" zones of a type, the oldest inactive ones leave the list (their boxes stay).
 *
 * On each closed bar, the active zones within "% line" of the close show a level line from two bars after the zone to
 * one bar after the current bar and a price label (up to "Max line" per type, 4 bars to the right, or 29 when close
 * to the previous one); other active zones not hit yet that are within "% line" show a line from 10 bars back and a
 * label 25 bars to the right. Label tooltips give the zone price and time ("from UTC", with the hour offset input).
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): "Zone hit" when a zone is hit, "Near zone" when
 * the low (high) comes within "Near %" of a demand (supply) level, not repeated for the same level within "Mins no
 * repeat" minutes. The two "Demand & Supply Alerts" switches of the original are not read by its code.
 *
 * At most 500 boxes and 500 labels are kept (lines: 12).
 *
 * Chart values (optional third argument of calculate): the symbol tick (zone prices rounded to it), the chart
 * timeframe (bar duration of the box and line ends) and, on the last bar, whether it is closed (`lastBarConfirmed`:
 * zones are added and the level lines drawn on closed bars only).
 *
 * Reference: "Supply & Demand Zones [BacktestBot]" by BacktestBot
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BacktestBot
 */

import {
  str, math, color, time as ptime, timeframe, line, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Box, type Line, type Label,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import { chartTimeframe } from '../anchor-period';
import { lastBarConfirmedOf, mintickOf, timezoneOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface DemandSupplyZonesInputs {
  /** Min % change */
  dsMinPcChange: number;
  /** Max % zone height */
  dsMaxPcZone: number;
  /** % line */
  dsLinePcDisplay: number;
  /** Max line */
  dsLineMax: number;
  /** Max number of zones */
  dsMaxZones: number;
  /** Timezone offset (H) */
  dsHoursOffset: number;
  /** Demand */
  showDemandZone: boolean;
  demandBordCol: string;
  demandBgCol: string;
  /** Supply */
  showSupplyZone: boolean;
  supplyBordCol: string;
  supplyBgCol: string;
  /** Demand alerts (not read by the original's code) */
  dsAlertDemand: boolean;
  /** Supply alerts (not read by the original's code) */
  dsAlertSupply: boolean;
  /** Mins no repeat */
  dsAlertMinsNoRepeat: number;
  /** Near % */
  dsAlertsPcNear: number;
}

export const defaultInputs: DemandSupplyZonesInputs = {
  dsMinPcChange: 0.25,
  dsMaxPcZone: 0.6,
  dsLinePcDisplay: 3,
  dsLineMax: 3,
  dsMaxZones: 100,
  dsHoursOffset: 0,
  showDemandZone: true,
  demandBordCol: 'rgba(255, 0, 255, 0.5)',
  demandBgCol: 'rgba(255, 0, 255, 0.2)',
  showSupplyZone: true,
  supplyBordCol: 'rgba(255, 255, 0, 0.5)',
  supplyBgCol: 'rgba(255, 255, 0, 0.2)',
  dsAlertDemand: true,
  dsAlertSupply: true,
  dsAlertMinsNoRepeat: 60,
  dsAlertsPcNear: 1.5,
};

const G = 'Demand & Supply';
const GA = 'Demand & Supply Alerts';

export const inputConfig: InputConfig[] = [
  { id: 'dsMinPcChange', type: 'float', title: 'Min % change', defval: 0.25, min: 0, step: 0.2, group: G,
    tooltip: ' --- Min % change ---\n\nA zone is added if one candle or a run of bullish/bearish candles meets this minimum % change.\n\n'
      + 'The change is from the open to the close when the time period is complete. Adjust the % for the pair and the timeframe.\n'
      + 'e.g. Crypto 15m 0.8% 1m 0.5%, Forex 15m 0.4%' },
  { id: 'dsMaxPcZone', type: 'float', title: 'Max % zone height', defval: 0.6, min: 0, step: 0.2, group: G,
    tooltip: ' --- Max % zone height ---\n\nThe zone height is decided by the size of the candle before a significant drop or rally.\n\n'
      + 'Setting a higher max % will keep the height closer to candle height.\n'
      + 'Setting a lower max % makes the boxes look a bit tidier.' },
  { id: 'dsLinePcDisplay', type: 'float', title: '% line', defval: 3, min: 0, max: 5, step: 0.5, inline: 'line', group: G },
  { id: 'dsLineMax', type: 'int', title: 'Max line', defval: 3, min: 0, max: 5, inline: 'line', group: G,
    tooltip: ' --- % Line  --- \nDisplay lines of active zones when the close is within this % of the line. Max is 5%.\n\n'
      + ' --- Max Line  --- \nThe maximum number of lines to display for each zone type. Max=5' },
  { id: 'dsMaxZones', type: 'int', title: 'Max number of zones', defval: 100, max: 200, step: 50, group: G,
    tooltip: ' --- Max number of zones ---\n\nThe maximum number of zones for each zone type.\nUp to 200 boxes can be displayed for each zone type.' },
  { id: 'dsHoursOffset', type: 'float', title: 'Timezone offset (H)', defval: 0, min: -12, max: 14, group: G,
    tooltip: ' --- Timezone offset (H)  --- \nIf your chart timezone is not set set to UTC, set the offset in hours.\n'
      + 'Range: -12 to +14.\n\nTime information is displayed when hovering over zone labels.' },
  { id: 'showDemandZone', type: 'bool', title: 'Demand', defval: true, inline: 'demand_1', group: G },
  { id: 'demandBordCol', type: 'color', title: 'Border', defval: 'rgba(255, 0, 255, 0.5)', inline: 'demand_1', group: G },
  { id: 'demandBgCol', type: 'color', title: 'Background', defval: 'rgba(255, 0, 255, 0.2)', inline: 'demand_1', group: G,
    tooltip: 'This background colour applies when the zone is active. Once the zone has been hit, it becomes transparent.' },
  { id: 'showSupplyZone', type: 'bool', title: 'Supply', defval: true, inline: 'supply_1', group: G },
  { id: 'supplyBordCol', type: 'color', title: 'Border', defval: 'rgba(255, 255, 0, 0.5)', inline: 'supply_1', group: G },
  { id: 'supplyBgCol', type: 'color', title: 'Background', defval: 'rgba(255, 255, 0, 0.2)', inline: 'supply_1', group: G,
    tooltip: 'This background colour applies when the zone is active. Once the zone has been hit, it becomes transparent.' },
  { id: 'dsAlertDemand', type: 'bool', title: 'Demand', defval: true, inline: 'ds_alert_1', group: GA },
  { id: 'dsAlertSupply', type: 'bool', title: 'Supply', defval: true, inline: 'ds_alert_1', group: GA,
    tooltip: ' --- Demand & Supply Alerts ---\n\nTwo types of alerts are sent:\n1. Hit: The price hits an active zone.\n'
      + '2. Near: The price approaches the active zone.\n\n --- Supply Example ---\n'
      + '1. When the price is below the supply zone and the high hits the zone, an alert is sent.\n'
      + '2. When the price is below the supply zone and the high is within the Near %, an alert is sent.' },
  { id: 'dsAlertMinsNoRepeat', type: 'int', title: 'Mins no repeat', defval: 60, min: 0, max: 120, group: GA,
    tooltip: ' --- Mins No Repeat ---\n\nWait x mins before sending a similar alert type for the same zone.\n\n'
      + 'Setting this to 0 will turn this feature off.\nMax = 120mins.' },
  { id: 'dsAlertsPcNear', type: 'float', title: 'Near %', defval: 1.5, max: 5, step: 0.1, group: GA,
    tooltip: ' --- Near % ---\nThe alert is sent when the high or low is within this % of the zone. Max is 5%.' },
];

export const plotConfig: PlotConfig[] = [];

/** Drawings of the script */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

/** The script calls alert() */
export const hasAlertFunction = true;

export const metadata = {
  title: 'Supply & Demand Zones [BacktestBot]',
  shortTitle: 'S&D',
  overlay: true,
};

/** Pine float comparisons within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const le = (a: number, b: number) => a - b <= EPS;
/** array.includes on a float array: an element equal within 1e-10 (Pine ==) */
const includesNum = (arr: number[], x: number) => arr.some((v) => Math.abs(v - x) <= EPS);

const pcDiffAbs = (x: number, y: number) => Math.abs((y - x) / x * 100);
const amountByPc = (amount: number, pc: number, add: boolean) => {
  const p = amount * (pc / 100);
  return add ? amount + p : amount - p;
};

type ZoneType = 'S' | 'D';

/** Zones of one type: limited lists (with boxes) and the lists of all active zones */
interface Zones {
  alert: number[];
  time: number[];
  s1Active: boolean[];
  s1: number[];
  box: Box[];
  timeAll: number[];
  s1All: number[];
  s1Line: Line[];
  s1LinePrice: Label[];
  labelAll: Label[];
  lineAll: Line[];
}

const newZones = (): Zones => ({
  alert: [], time: [], s1Active: [], s1: [], box: [], timeAll: [], s1All: [], s1Line: [], s1LinePrice: [],
  labelAll: [], lineAll: [],
});

export function calculate(
  bars: Bar[],
  inputs: Partial<DemandSupplyZonesInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lineMax = Math.trunc(cfg.dsLineMax);
  const maxZones = Math.trunc(cfg.dsMaxZones);
  const minPc = cfg.dsMinPcChange;
  const maxPc = cfg.dsMaxPcZone;
  const linePc = cfg.dsLinePcDisplay;
  const hoursOffset = cfg.dsHoursOffset;
  const noRepeat = cfg.dsAlertMinsNoRepeat;
  const nearPc = cfg.dsAlertsPcNear;
  const { showDemandZone, showSupplyZone } = cfg;
  const mintick = mintickOf(chart);
  const tz = timezoneOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;

  // var milli_secs_per_bar: na on monthly charts
  const tfStr = chartTimeframe(bars, chart);
  const info = tfStr === '' ? null : timeframe.info(tfStr);
  const msPerBar = !info ? NaN
    : info.isseconds ? info.multiplier * 1000
    : info.isminutes ? info.multiplier * 60 * 1000
    : info.isdaily ? info.multiplier * 24 * 60 * 60 * 1000
    : info.isweekly ? info.multiplier * 7 * 24 * 60 * 60 * 1000 : NaN;
  const isMonthly = !!info && info.ismonthly;

  const getMonthBarTime = (start: number, add: boolean, num: number) => {
    const sign = add ? 1 : -1;
    const yearStart = ptime.year(start, tz);
    const monthStart = ptime.month(start, tz);
    const div = num / 12;
    const yearChange = div >= 1 ? Math.floor(div) : 0;
    let y = yearStart + yearChange * sign;
    let m = monthStart + (num % 12) * sign;
    y += m > 12 ? 1 : m < 1 ? -1 : 0;
    m += m > 12 ? -12 : m < 1 ? 12 : 0;
    return ptime.timestamp(tz, y, m, 1, 0, 0, 0);
  };
  const getBarTime = (start: number, add: boolean, num: number) => {
    const sign = add ? 1 : -1;
    return !isNaN(msPerBar) ? start + msPerBar * num * sign : isMonthly ? getMonthBarTime(start, add, num) : NaN;
  };

  resetDrawings({ label: 500, box: 500 });
  const alertCalls: AlertCall[] = [];
  const zones: Record<ZoneType, Zones> = { D: newZones(), S: newZones() };
  const transparent = String(color.new('#FFFFFF', 100));
  const white = String(color.new('#FFFFFF', 0));

  // ta.barssince(open < close) / ta.barssince(open > close)
  let lastBull = NaN;
  let lastBear = NaN;
  let s1Level = NaN;
  let s1Time = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const time = b.time * ms;
    const confirmed = i < n - 1 || lastConfirmed;
    const at = (k: number) => (i - k >= 0 ? bars[i - k] : null);
    const open = (k: number) => at(k)?.open ?? NaN;
    const close = (k: number) => at(k)?.close ?? NaN;
    const high = (k: number) => at(k)?.high ?? NaN;
    const low = (k: number) => at(k)?.low ?? NaN;

    if (i === 0) {
      if (lineMax - 1 < 0) throw new Error('Index 0 is out of bounds, array size is 0');
      for (let k = 0; k < lineMax; k++) {
        zones.D.s1Line[k] = line.new(NaN, NaN, NaN, NaN, 'bar_time', undefined, cfg.demandBordCol, 'solid');
        zones.S.s1Line[k] = line.new(NaN, NaN, NaN, NaN, 'bar_time', undefined, cfg.supplyBordCol, 'solid');
        zones.D.s1LinePrice[k] = label.new(NaN, NaN, undefined, undefined, undefined, undefined, 'label_left', white);
        zones.S.s1LinePrice[k] = label.new(NaN, NaN, undefined, undefined, undefined, undefined, 'label_left', white);
        zones.D.labelAll[k] = label.new(NaN, NaN, undefined, undefined, undefined, undefined, 'label_left', white);
        zones.S.labelAll[k] = label.new(NaN, NaN, undefined, undefined, undefined, undefined, 'label_left', white);
        zones.D.lineAll[k] = line.new(NaN, NaN, NaN, NaN, undefined, undefined, transparent, 'solid');
        zones.S.lineAll[k] = line.new(NaN, NaN, NaN, NaN, undefined, undefined, transparent, 'solid');
      }
    }

    if (lt(b.open, b.close)) lastBull = i;
    if (gt(b.open, b.close)) lastBear = i;
    const bearRun = i - lastBull; // NaN before the first bullish bar
    const bullRun = i - lastBear;

    s1Level = lt(pcDiffAbs(open(1), close(1)), 0.02)
      && ((bullRun === 1 && gt(open(2), close(2))) || (bearRun === 1 && lt(open(2), close(2)))) ? open(2)
      : bullRun === 1 || bearRun === 1 ? open(1)
      : bullRun > 1 || bearRun > 1 ? s1Level : NaN;
    s1Time = bullRun === 1 || bearRun === 1 ? (at(1) ? at(1)!.time * ms : NaN)
      : bullRun > 1 || bearRun > 1 ? s1Time : NaN;

    const zoneInfo = (type: ZoneType, s1: number, s1T: number) => {
      let txt = type === 'S' ? 'Supply Zone ' : 'Demand Zone ';
      txt += str.tostring(s1) + '\n';
      txt += 'from UTC';
      txt += hoursOffset > 0 ? '+' + str.tostring(hoursOffset) : hoursOffset < 0 ? str.tostring(hoursOffset) : '';
      txt += str.format(': {0,date,yyyy/MM/dd HH:mm}', s1T + 60 * 60 * 1000 * hoursOffset) + '\n';
      return txt;
    };

    // alert_ds()
    const alertDs = (doIt: boolean, type: ZoneType, s1: number, s1T: number, alertType: string) => {
      let repeat = false;
      if (doIt && alertType === 'N' && noRepeat > 0) {
        const arr = zones[type].alert;
        // remove_ds_alerts(): the pairs (price, time) older than "Mins no repeat" and all after them
        let sliceStart = NaN;
        const size = arr.length;
        if (size > 0) {
          for (let k = 0; k <= size - 1; k += 2) {
            const t = arr.length > k + 1 ? arr[k + 1] : NaN;
            if (ge((time - t) / (1000 * 60), noRepeat)) {
              sliceStart = k;
              break;
            }
          }
        }
        if (!isNaN(sliceStart)) arr.splice(sliceStart);
        repeat = includesNum(arr, s1);
        if (!repeat) arr.unshift(s1, time);
      }
      if (doIt && !repeat) {
        const msg = (alertType === 'H' ? 'Zone hit' : 'Near zone') + '\n' + zoneInfo(type, s1, s1T);
        alertCalls.push({ time: b.time, message: msg, freq: 'once_per_bar' });
      }
    };

    // deactivate_ds_limited()
    const deactivate = (doIt: boolean, type: ZoneType, s1T: number) => {
      if (!doIt) return;
      const z = zones[type];
      const index = z.time.indexOf(s1T);
      if (index >= 0) z.s1Active[index] = false;
      if (showDemandZone && index >= 0) {
        const bx = z.box.length > index ? z.box[index] : undefined;
        if (bx) {
          box.set_bgcolor(bx, String(color.rgb(0, 0, 0, 100)));
          box.set_border_style(bx, 'dotted');
        }
      }
    };

    // check_ds_zone_hit(): the loop bound is read once (version 5)
    for (const type of ['D', 'S'] as ZoneType[]) {
      const z = zones[type];
      const size = z.s1All.length;
      if (size === 0) continue;
      for (let k = 0; k <= size - 1; k++) {
        const s1 = z.s1All.length > k ? z.s1All[k] : NaN;
        const s1T = z.timeAll.length > k ? z.timeAll[k] : NaN;
        const near = amountByPc(s1, nearPc, type === 'D');
        const alertType = type === 'D'
          ? (le(b.low, s1) ? 'H' : le(b.low, near) ? 'N' : '')
          : (ge(b.high, s1) ? 'H' : ge(b.high, near) ? 'N' : '');
        if (alertType === 'H') {
          z.s1All.splice(k, 1);
          z.timeAll.splice(k, 1);
        }
        alertDs(alertType === 'H' || alertType === 'N', type, s1, s1T, alertType);
        deactivate(alertType === 'H', type, s1T);
        if (type === 'D' ? gt(b.low, s1) && gt(pcDiffAbs(b.low, s1), 5) : lt(b.high, s1) && gt(pcDiffAbs(b.high, s1), 5)) break;
      }
    }

    // add_ds_zone()
    for (const type of ['D', 'S'] as ZoneType[]) {
      const z = zones[type];
      const isS = type === 'S';
      const showZone = isS ? showSupplyZone : showDemandZone;
      const barsToS1 = isS ? bearRun : bullRun;
      const pcChange = barsToS1 >= 1 ? pcDiffAbs(b.close, open(barsToS1 - 1)) : 0;
      if (z.time.includes(s1Time) || !ge(pcChange, minPc) || !confirmed) continue;
      const left = getBarTime(s1Time, false, 1);
      const right = getBarTime(s1Time, true, 2);
      z.time.unshift(s1Time);
      z.timeAll.unshift(s1Time);
      let top = isS ? Math.max(high(barsToS1), high(barsToS1 - 1)) : s1Level;
      let bot = isS ? s1Level : Math.min(low(barsToS1), low(barsToS1 - 1));
      const topBotPc = pcDiffAbs(top, bot);
      const candlePc = pcDiffAbs(open(barsToS1), close(barsToS1));
      const tooTall = gt(topBotPc, maxPc);
      bot = isS && tooTall && le(candlePc, maxPc) ? s1Level
        : isS && tooTall ? amountByPc(close(barsToS1), maxPc / 5, false)
        : !isS && tooTall ? amountByPc(top, maxPc, false) : bot;
      top = isS && tooTall ? amountByPc(bot, maxPc, true)
        : !isS && tooTall && le(candlePc, maxPc) ? s1Level
        : !isS && tooTall ? amountByPc(close(barsToS1), maxPc / 5, true) : top;
      bot = math.round_to_mintick(bot, mintick);
      top = math.round_to_mintick(top, mintick);
      const s1 = isS ? bot : top;
      z.s1.unshift(s1);
      z.s1Active.unshift(true);
      z.s1All.unshift(s1);
      if (showZone) {
        z.box.unshift(box.new(left, top, right, bot, isS ? cfg.supplyBordCol : cfg.demandBordCol, 1, undefined, undefined,
          'bar_time', isS ? cfg.supplyBgCol : cfg.demandBgCol));
      }
      if (z.time.length > maxZones) {
        // from the end, remove inactive zones (their boxes stay on the chart)
        for (let k = z.time.length - 1; k >= 0; k--) {
          const active = z.s1Active.length > k ? z.s1Active[k] : undefined;
          if (active === false) {
            z.time.splice(k, 1);
            z.s1Active.splice(k, 1);
            z.s1.splice(k, 1);
            if (showZone) z.box.splice(k, 1);
            if (z.time.length === maxZones) break;
          }
        }
      }
      if (z.timeAll.length > 90000) {
        z.timeAll.pop();
        z.s1All.pop();
      }
    }

    // draw_nearby_ds_s1()
    if (confirmed && (showDemandZone || showSupplyZone)) {
      for (let k = 0; k < lineMax; k++) {
        for (const z of [zones.D, zones.S]) {
          line.set_xy1(z.s1Line[k], NaN, NaN);
          label.set_text(z.s1LinePrice[k], '');
          label.set_color(z.s1LinePrice[k], transparent);
        }
        for (const z of [zones.D, zones.S]) {
          label.set_text(z.labelAll[k], '');
          label.set_color(z.labelAll[k], transparent);
        }
        for (const z of [zones.D, zones.S]) line.set_color(z.lineAll[k], transparent);
      }
      const barsOut = 25;
      for (const type of ['D', 'S'] as ZoneType[]) {
        const z = zones[type];
        const show = type === 'D' ? showDemandZone : showSupplyZone;
        const bord = type === 'D' ? cfg.demandBordCol : cfg.supplyBordCol;
        // main labels with limited data
        let lineIndex = 0;
        const displayed: number[] = [];
        let s1Prev = NaN;
        let extraBars = 0;
        if (z.s1.length > 0 && show) {
          for (let k = 0; k <= z.s1.length - 1; k++) {
            const s1 = z.s1[k];
            if (z.s1Active[k] && le(pcDiffAbs(b.close, s1), linePc)) {
              const ln = z.s1Line[lineIndex];
              line.set_xy1(ln, getBarTime(z.time[k], true, 2), s1);
              line.set_xy2(ln, getBarTime(time, true, 1), s1);
              const lbl = z.s1LinePrice[lineIndex];
              label.set_color(lbl, bord);
              const diffToPrev = !isNaN(s1Prev) ? pcDiffAbs(s1Prev, s1) : NaN;
              extraBars = extraBars > 0 ? 0 : lt(diffToPrev, 0.7) ? barsOut : 0;
              label.set_xy(lbl, i + 4 + extraBars, s1);
              label.set_text(lbl, str.tostring(s1));
              const s1T = z.time.length > k ? z.time[k] : NaN;
              label.set_tooltip(lbl, zoneInfo(type, s1, s1T));
              lineIndex += 1;
              s1Prev = s1;
              displayed.unshift(s1);
            }
            if (lineIndex === lineMax) break;
          }
        }
        // all data with active zones (the tooltips of these labels say "Supply Zone" for both types, as the original)
        let lineCount = lineIndex;
        lineIndex = 0;
        if (z.s1All.length > 0 && lineCount !== lineMax) {
          for (let k = 0; k <= z.s1All.length - 1; k++) {
            const s1 = z.s1All.length > k ? z.s1All[k] : NaN;
            const diff = pcDiffAbs(b.close, s1);
            if (!includesNum(displayed, s1) && le(diff, linePc)) {
              const lbl = z.labelAll[lineIndex];
              label.set_color(lbl, bord);
              label.set_xy(lbl, i + barsOut, s1);
              label.set_text(lbl, str.tostring(s1));
              const s1T = z.timeAll.length > k ? z.timeAll[k] : NaN;
              label.set_tooltip(lbl, zoneInfo('S', s1, s1T));
              const ln = z.lineAll[lineIndex];
              line.set_color(ln, bord);
              line.set_xy1(ln, i - 10, s1);
              line.set_xy2(ln, i + barsOut, s1);
              lineIndex += 1;
              lineCount += 1;
            }
            if (lineIndex === lineMax || lineCount === lineMax || gt(diff, linePc)) break;
          }
        }
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alertCalls,
  };
}

export const DemandSupplyZones = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, hasAlertFunction,
};
