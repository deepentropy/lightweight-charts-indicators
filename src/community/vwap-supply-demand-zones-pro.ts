/**
 * VWAP Supply & Demand Zones PRO
 *
 * A moving VWAP: SMA(hlc3 x volume, length) / SMA(volume, length) (na when the volume average is 0), drawn with two
 * thin bands at +- "Zone Width %" / 10 percent and fills between the bands and the VWAP.
 *
 * On a confirmed bar after 2 x length bars, a close crossing under the VWAP with a volume above 1.2 x its 20-bar
 * average and a body above half the ATR(14) adds a supply zone from the VWAP to the high + "Zone Width %"; a close
 * crossing over the VWAP adds a demand zone from the low - "Zone Width %" to the VWAP. Each zone draws a box (border
 * and 90 % transparent background of its type), a dotted level line at the outer edge and a price label two bars to
 * the right; at most "Max Zones Per Type" zones are kept per type (the oldest are deleted). While a zone is not
 * broken, its box and line end "Zone Extension" bars after the current bar; a close above a supply zone top (below a
 * demand zone bottom) breaks it: its background turns grey and it stops extending.
 *
 * Also: a triangle at the zone edge when a zone is added, the background while a bar overlaps an unbroken zone, bar
 * colours by the close against the VWAP, and a table on the last bar (unbroken zones per type, VWAP, bias).
 * Alerts: four alert conditions, and alert() calls when a zone is added, tested "Min Touches" times or broken.
 *
 * Chart values (optional third argument of calculate): the symbol tick (label, table and alert prices) and whether
 * the last bar is closed (zones are added and crossings count on confirmed bars only).
 *
 * Reference: "VWAP Supply & Demand Zones PRO" by Finntech1
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, Series, box, line, label, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData,
  type ShapeConfig, type BarColorConfig, type Box, type Line, type Label, type Table,
} from 'oakscriptjs';
import type { AlertCall, BarColorData, BgColorData, MarkerData } from '../types';
import { lastBarConfirmedOf, mintickOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface VwapSupplyDemandZonesProInputs {
  /** VWAP Length */
  vwapLength: number;
  /** Zone Width % */
  zoneWidth: number;
  /** Max Zones Per Type */
  maxZones: number;
  /** Min Touches to Validate */
  minTouches: number;
  /** Zone Extension (bars) */
  zoneExtension: number;
  showVWAP: boolean;
  showZones: boolean;
  showLabels: boolean;
  showHUD: boolean;
  vwapColor: string;
  supplyColor: string;
  demandColor: string;
  neutralColor: string;
  alertOnNewZone: boolean;
  alertOnZoneTest: boolean;
  alertOnZoneBreak: boolean;
}

export const defaultInputs: VwapSupplyDemandZonesProInputs = {
  vwapLength: 20,
  zoneWidth: 0.5,
  maxZones: 5,
  minTouches: 2,
  zoneExtension: 30,
  showVWAP: true,
  showZones: true,
  showLabels: true,
  showHUD: true,
  vwapColor: '#2962FF',
  supplyColor: '#FF5252',
  demandColor: '#4CAF50',
  neutralColor: '#787B86',
  alertOnNewZone: true,
  alertOnZoneTest: true,
  alertOnZoneBreak: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'vwapLength', type: 'int', title: 'VWAP Length', defval: 20, min: 1, max: 100, group: 'VWAP Settings' },
  { id: 'zoneWidth', type: 'float', title: 'Zone Width %', defval: 0.5, min: 0.1, max: 3.0, step: 0.1, group: 'Zone Settings' },
  { id: 'maxZones', type: 'int', title: 'Max Zones Per Type', defval: 5, min: 1, max: 10, group: 'Zone Settings' },
  { id: 'minTouches', type: 'int', title: 'Min Touches to Validate', defval: 2, min: 1, max: 5, group: 'Zone Settings' },
  { id: 'zoneExtension', type: 'int', title: 'Zone Extension (bars)', defval: 30, min: 10, max: 100, group: 'Zone Settings' },
  { id: 'showVWAP', type: 'bool', title: 'Show VWAP', defval: true, group: 'Visual Settings' },
  { id: 'showZones', type: 'bool', title: 'Show Supply/Demand Zones', defval: true, group: 'Visual Settings' },
  { id: 'showLabels', type: 'bool', title: 'Show Zone Labels', defval: true, group: 'Visual Settings' },
  { id: 'showHUD', type: 'bool', title: 'Show HUD', defval: true, group: 'Visual Settings' },
  { id: 'vwapColor', type: 'color', title: 'VWAP Color', defval: '#2962FF', group: 'Colors' },
  { id: 'supplyColor', type: 'color', title: 'Supply Zone Color', defval: '#FF5252', group: 'Colors' },
  { id: 'demandColor', type: 'color', title: 'Demand Zone Color', defval: '#4CAF50', group: 'Colors' },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color', defval: '#787B86', group: 'Colors' },
  { id: 'alertOnNewZone', type: 'bool', title: 'Alert on New Zone', defval: true, group: 'Alerts' },
  { id: 'alertOnZoneTest', type: 'bool', title: 'Alert on Zone Test', defval: true, group: 'Alerts' },
  { id: 'alertOnZoneBreak', type: 'bool', title: 'Alert on Zone Break', defval: true, group: 'Alerts' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: String(color.new('#2962FF', 70)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: String(color.new('#2962FF', 70)), lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot0', title: 'Upper Fill' },
  { id: 'fill1', plot1: 'plot0', plot2: 'plot2', title: 'Lower Fill' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Supply Zone Created', style: 'triangledown', location: 'absolute', color: '#FF5252', size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Demand Zone Created', style: 'triangleup', location: 'absolute', color: '#4CAF50', size: 'small' },
];

export const barColorConfig: BarColorConfig[] = [
  { id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' },
  { id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'In Supply Zone', message: 'Price entered supply zone - potential reversal' },
  { id: 'alert1', title: 'In Demand Zone', message: 'Price entered demand zone - potential reversal' },
  { id: 'alert2', title: 'VWAP Cross Up', message: 'Price crossed above VWAP' },
  { id: 'alert3', title: 'VWAP Cross Down', message: 'Price crossed below VWAP' },
];

export const hasAlertFunction = true;

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'VWAP Supply & Demand Zones PRO',
  shortTitle: 'VWAP Supply & Demand Zones PRO',
  overlay: true,
};

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;

/** Pine v5 color.black / color.blue */
const BLACK = '#363A45';
const BLUE = '#2962FF';
const WHITE = '#FFFFFF';
/** Box text colour of Pine v5 (no text is drawn) */
const BOX_TEXT = '#363A45';

interface Zone {
  box: Box;
  line: Line;
  label: Label | null;
  /** supply: top; demand: bottom (the level the break test reads) */
  price: number;
  /** supply: bottom; demand: top */
  other: number;
  touches: number;
  broken: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VwapSupplyDemandZonesProInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { vwapLength, zoneWidth, maxZones, minTouches, zoneExtension, supplyColor, demandColor, neutralColor, vwapColor } = cfg;
  const mintick = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const fmt = (v: number) => str.tostring(v, 'mintick', mintick);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : Number(v)));
  const S = (a: number[]) => Series.fromArray(bars, a);

  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);
  const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
  const vwapNum = A(ta.sma(S(hlc3.map((h, i) => h * volume[i])), vwapLength));
  const vwapDen = A(ta.sma(S(volume), vwapLength));
  // vwapDen != 0 (na compares false)
  const vwap = vwapDen.map((d, i) => (!Number.isNaN(d) && Math.abs(d) > EPS ? vwapNum[i] / d : NaN));
  const volMA = A(ta.sma(S(volume), 20));
  const atr = A(ta.atr(bars, 14));
  const crossUp = ta.crossover(S(close), S(vwap)).toArray();
  const crossDown = ta.crossunder(S(close), S(vwap)).toArray();

  const plotV: number[][] = [[], [], []];
  const fillColors: string[][] = [[], []];
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const barColors: BarColorData[] = [];
  const flags: boolean[][] = [[], [], [], []];
  const alertCalls: AlertCall[] = [];

  const supplyBg = String(color.new(supplyColor, 90));
  const demandBg = String(color.new(demandColor, 90));
  const brokenBg = String(color.new(neutralColor, 95));
  const upperFill = String(color.new(supplyColor, 95));
  const lowerFill = String(color.new(demandColor, 95));
  const barUp = String(color.new(demandColor, 70));
  const barDown = String(color.new(supplyColor, 70));
  const bandColor = String(color.new(vwapColor, 70));
  const plotColors = [vwapColor, bandColor, bandColor];

  resetDrawings({ line: 100, box: 50, label: 50 });
  const supply: Zone[] = [];
  const demand: Zone[] = [];
  let hud: Table | null = null;

  /** f_cleanupZones(..., maxZones - 1): the oldest zones leave until maxZones - 1 remain */
  const cleanup = (zones: Zone[]) => {
    while (zones.length > maxZones - 1) {
      const z = zones.shift() as Zone;
      box.delete(z.box);
      line.delete(z.line);
      if (z.label) label.delete(z.label);
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const at = t as number;
    const v = vwap[i];
    const confirmed = i < n - 1 || lastConfirmed;
    const hasEnoughHistory = i > vwapLength * 2;
    const vwapCrossUp = confirmed && !!crossUp[i];
    const vwapCrossDown = confirmed && !!crossDown[i];
    const volumeConfirm = confirmed && gt(volume[i], volMA[i] * 1.2);
    const momentumConfirm = confirmed && gt(Math.abs(b.close - b.open), atr[i] * 0.5);

    const createSupply = hasEnoughHistory && vwapCrossDown && volumeConfirm && momentumConfirm;
    const supplyTop = createSupply ? b.high * (1 + zoneWidth / 100) : NaN;
    const supplyBottom = createSupply ? v : NaN;
    const createDemand = hasEnoughHistory && vwapCrossUp && volumeConfirm && momentumConfirm;
    const demandTop = createDemand ? v : NaN;
    const demandBottom = createDemand ? b.low * (1 - zoneWidth / 100) : NaN;

    if (createSupply && cfg.showZones && !Number.isNaN(supplyTop) && !Number.isNaN(supplyBottom)) {
      cleanup(supply);
      const zb = box.new(i, supplyTop, i + zoneExtension, supplyBottom, supplyColor, 1, 'solid', 'none', 'bar_index',
        supplyBg, '', 'auto', BOX_TEXT);
      const zl = line.new(i, supplyTop, i + zoneExtension, supplyTop, 'bar_index', 'none', supplyColor, 'dotted', 2);
      const zt = cfg.showLabels
        ? label.new(i + 2, supplyTop, 'Supply\n' + fmt(supplyTop), 'bar_index', 'price', supplyColor, 'label_down', WHITE, 'small')
        : null;
      supply.push({ box: zb, line: zl, label: zt, price: supplyTop, other: supplyBottom, touches: 0, broken: false });
      if (cfg.alertOnNewZone) alertCalls.push({ time: at, message: 'New Supply Zone Created at ' + fmt(supplyTop), freq: 'once_per_bar' });
    }

    if (createDemand && cfg.showZones && !Number.isNaN(demandTop) && !Number.isNaN(demandBottom)) {
      cleanup(demand);
      const zb = box.new(i, demandTop, i + zoneExtension, demandBottom, demandColor, 1, 'solid', 'none', 'bar_index',
        demandBg, '', 'auto', BOX_TEXT);
      const zl = line.new(i, demandBottom, i + zoneExtension, demandBottom, 'bar_index', 'none', demandColor, 'dotted', 2);
      const zt = cfg.showLabels
        ? label.new(i + 2, demandBottom, 'Demand\n' + fmt(demandBottom), 'bar_index', 'price', demandColor, 'label_up', WHITE, 'small')
        : null;
      demand.push({ box: zb, line: zl, label: zt, price: demandBottom, other: demandTop, touches: 0, broken: false });
      if (cfg.alertOnNewZone) alertCalls.push({ time: at, message: 'New Demand Zone Created at ' + fmt(demandBottom), freq: 'once_per_bar' });
    }

    // Update existing zones
    let activeSupply = 0;
    for (const z of supply) {
      if (z.broken) continue;
      box.set_right(z.box, i + zoneExtension);
      line.set_x2(z.line, i + zoneExtension);
      if (ge(b.high, z.other) && le(b.high, z.price)) {
        z.touches += 1;
        if (cfg.alertOnZoneTest && z.touches === minTouches) {
          alertCalls.push({ time: at, message: 'Supply Zone Tested at ' + fmt(z.price), freq: 'once_per_bar_close' });
        }
      }
      if (gt(b.close, z.price)) {
        z.broken = true;
        box.set_bgcolor(z.box, brokenBg);
        if (cfg.alertOnZoneBreak) alertCalls.push({ time: at, message: 'Supply Zone Broken at ' + fmt(z.price), freq: 'once_per_bar_close' });
      } else {
        activeSupply += 1;
      }
    }
    let activeDemand = 0;
    for (const z of demand) {
      if (z.broken) continue;
      box.set_right(z.box, i + zoneExtension);
      line.set_x2(z.line, i + zoneExtension);
      if (le(b.low, z.other) && ge(b.low, z.price)) {
        z.touches += 1;
        if (cfg.alertOnZoneTest && z.touches === minTouches) {
          alertCalls.push({ time: at, message: 'Demand Zone Tested at ' + fmt(z.price), freq: 'once_per_bar_close' });
        }
      }
      if (lt(b.close, z.price)) {
        z.broken = true;
        box.set_bgcolor(z.box, brokenBg);
        if (cfg.alertOnZoneBreak) alertCalls.push({ time: at, message: 'Demand Zone Broken at ' + fmt(z.price), freq: 'once_per_bar_close' });
      } else {
        activeDemand += 1;
      }
    }

    // Plots and fills
    plotV[0].push(cfg.showVWAP ? v : NaN);
    plotV[1].push(cfg.showVWAP ? v * (1 + zoneWidth / 1000) : NaN);
    plotV[2].push(cfg.showVWAP ? v * (1 - zoneWidth / 1000) : NaN);
    fillColors[0].push(upperFill);
    fillColors[1].push(lowerFill);

    // In-zone state (supply: price = top, other = bottom; demand: price = bottom, other = top)
    const inSupply = supply.some((z) => !z.broken && ge(b.high, z.other) && le(b.low, z.price));
    const inDemand = demand.some((z) => !z.broken && ge(b.high, z.price) && le(b.low, z.other));
    const bg = inSupply ? upperFill : inDemand ? lowerFill : null;
    if (bg) bgColors.push({ id: 'bgcolor0', time: t, color: bg });

    if (createSupply && !Number.isNaN(supplyTop)) {
      markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: supplyTop, shape: 'triangleDown', color: supplyColor, size: 'small' });
    }
    if (createDemand && !Number.isNaN(demandBottom)) {
      markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: demandBottom, shape: 'triangleUp', color: demandColor, size: 'small' });
    }

    if (cfg.showVWAP && !Number.isNaN(v)) {
      barColors.push({ id: 'barcolor0', time: t, color: gt(b.close, v) ? barUp : barDown });
    }

    // HUD
    if (i === 0 && cfg.showHUD) {
      hud = table.new('bottom_right', 3, 6, String(color.new(BLACK, 90)), undefined, undefined, undefined, 1);
    }
    if (cfg.showHUD && i === n - 1 && hud) {
      table.clear(hud, 0, 0, 2, 5);
      table.cell(hud, 0, 0, 'VWAP S&D', undefined, undefined, WHITE, undefined, undefined, undefined, String(color.new(BLUE, 50)));
      table.merge_cells(hud, 0, 0, 2, 0);
      const cell = (c: number, r: number, text: string, tc: string) =>
        table.cell(hud as Table, c, r, text, undefined, undefined, tc, undefined, undefined, 'tiny');
      cell(0, 1, 'Supply', WHITE);
      cell(1, 1, str.tostring(activeSupply), supplyColor);
      cell(2, 1, activeSupply > 0 ? '▼' : '-', supplyColor);
      cell(0, 2, 'Demand', WHITE);
      cell(1, 2, str.tostring(activeDemand), demandColor);
      cell(2, 2, activeDemand > 0 ? '▲' : '-', demandColor);
      cell(0, 3, 'VWAP', WHITE);
      cell(1, 3, fmt(v), vwapColor);
      const hasV = !Number.isNaN(v);
      cell(2, 3, hasV ? (gt(b.close, v) ? '↑' : '↓') : '-', hasV ? (gt(b.close, v) ? demandColor : supplyColor) : neutralColor);
      const bias = activeSupply > activeDemand ? 'BEAR' : activeDemand > activeSupply ? 'BULL' : 'NEUTRAL';
      const biasColor = bias === 'BEAR' ? supplyColor : bias === 'BULL' ? demandColor : neutralColor;
      cell(0, 4, 'Bias', WHITE);
      cell(1, 4, bias, biasColor);
      cell(2, 4, bias === 'BEAR' ? '🐻' : bias === 'BULL' ? '🐂' : '➖', biasColor);
    }

    flags[0].push(inSupply);
    flags[1].push(inDemand);
    flags[2].push(vwapCrossUp);
    flags[3].push(vwapCrossDown);
  }
  setDrawingBar(null);

  const plots: IndicatorResult['plots'] = {};
  for (let k = 0; k < 3; k++) {
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: plotV[k][i], color: plotColors[k] }));
  }
  const fills: FillData[] = fillConfig.map((f, k) => ({
    id: f.id, plot1: f.plot1, plot2: f.plot2, options: { title: f.title }, colors: fillColors[k],
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    bgColors,
    barColors,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
    alertCalls,
  };
}

export const VwapSupplyDemandZonesPro = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, barColorConfig,
  alertConditions, hasAlertFunction, drawingKinds,
};
