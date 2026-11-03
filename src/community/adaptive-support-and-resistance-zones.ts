/**
 * Adaptive S/R Zones [BigBeluga]
 *
 * Support and resistance levels from pivots. A pivot high (low) with "Pivot Length" bars on each side becomes a
 * resistance (support) level when it stands at least "Min ATR Strength" x ATR(14) above (below) its two neighbour
 * bars, when no active level of the same type is closer than "Merge Threshold" x ATR, and while fewer than "Max Active
 * Levels Each" levels of that type are active. A level draws a line extended to the right, a zone box of "Zone Width"
 * x ATR around it and a price label. A level older than "Max Level Age" bars is removed. When a close goes beyond the
 * level by "Break Sensitivity" x ATR the level is broken: its line becomes a grey dotted segment up to the break bar,
 * its zone a grey box of the break buffer, a "< Break" label marks the bar, and the last "Max Broken Levels Shown"
 * broken levels stay on the chart. With "Enable Longevity Width" the line of an active level gets thicker with its
 * age (1 to "Max Longevity Width"). A dashboard shows the nearest resistance above and support below the close, the
 * direction of the last break and the number of active levels.
 *
 * Chart context (optional third argument): the symbol tick (`syminfo.mintick`: price texts, and the ATR fallback of
 * 10 ticks on the first bars; without it 0.01) and the chart background colour of the price labels (without it the
 * dark theme colour #0F0F0F).
 *
 * Reference: "Adaptive S/R Zones [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, str, color, Series, line, box, label, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type Label, type Line, type Table, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { backgroundColorOf, mintickOf, type ChartContext } from '../chart-context';

export interface AdaptiveSupportAndResistanceZonesInputs {
  pivotLen: number;
  minStrength: number;
  maxAgeBars: number;
  showSupport: boolean;
  showResist: boolean;
  maxLevels: number;
  mergeThresh: number;
  showZones: boolean;
  zoneWidth: number;
  showBroken: boolean;
  breakSens: number;
  showBreakLbl: boolean;
  maxBroken: number;
  supColor: string;
  resColor: string;
  brokenColor: string;
  lineWidth: number;
  useDynamicWidth: boolean;
  maxLineWidth: number;
  showDash: boolean;
  showPriceLbl: boolean;
  dashPos: 'Top Right' | 'Bottom Right' | 'Top Left' | 'Bottom Left';
}

export const defaultInputs: AdaptiveSupportAndResistanceZonesInputs = {
  pivotLen: 5,
  minStrength: 0.1,
  maxAgeBars: 300,
  showSupport: true,
  showResist: true,
  maxLevels: 5,
  mergeThresh: 0.5,
  showZones: true,
  zoneWidth: 0.25,
  showBroken: true,
  breakSens: 0.1,
  showBreakLbl: true,
  maxBroken: 4,
  supColor: '#22bac5',
  resColor: '#ff6f43',
  brokenColor: '#94a3b8',
  lineWidth: 2,
  useDynamicWidth: true,
  maxLineWidth: 7,
  showDash: true,
  showPriceLbl: true,
  dashPos: 'Bottom Right',
};

const gSwing = 'Swing Detection';
const gLevels = 'Levels';
const gBreak = 'Breakouts';
const gVis = 'Visuals';

export const inputConfig: InputConfig[] = [
  {
    id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 5, min: 2, max: 50, group: gSwing,
    tooltip: 'The number of bars on each side of a high or low to confirm a pivot point.',
  },
  {
    id: 'minStrength', type: 'float', title: 'Min ATR Strength', defval: 0.1, min: 0, max: 5, step: 0.05, group: gSwing,
    tooltip: 'Minimum distance required between the pivot and its neighbors.',
  },
  {
    id: 'maxAgeBars', type: 'int', title: 'Max Level Age (bars)', defval: 300, min: 20, max: 2000, group: gSwing,
    tooltip: 'Maximum bars a level exists before removal. Also used to calculate longevity scaling.',
  },
  { id: 'showSupport', type: 'bool', title: 'Show Support Levels', defval: true, group: gLevels },
  { id: 'showResist', type: 'bool', title: 'Show Resistance Levels', defval: true, group: gLevels },
  { id: 'maxLevels', type: 'int', title: 'Max Active Levels Each', defval: 5, min: 1, max: 20, group: gLevels },
  { id: 'mergeThresh', type: 'float', title: 'Merge Threshold (ATR x)', defval: 0.5, min: 0, max: 3, step: 0.05, group: gLevels },
  { id: 'showZones', type: 'bool', title: 'Show Level Zones', defval: true, group: gLevels },
  { id: 'zoneWidth', type: 'float', title: 'Zone Width (ATR x)', defval: 0.25, min: 0.05, max: 2, step: 0.05, group: gLevels },
  { id: 'showBroken', type: 'bool', title: 'Show Broken Levels', defval: true, group: gBreak },
  { id: 'breakSens', type: 'float', title: 'Break Sensitivity (ATR x)', defval: 0.1, min: 0, max: 2, step: 0.05, group: gBreak },
  { id: 'showBreakLbl', type: 'bool', title: 'Show Break Labels', defval: true, group: gBreak },
  { id: 'maxBroken', type: 'int', title: 'Max Broken Levels Shown', defval: 4, min: 0, max: 20, group: gBreak },
  { id: 'supColor', type: 'color', title: 'Support Color', defval: '#22bac5', group: gVis },
  { id: 'resColor', type: 'color', title: 'Resistance Color', defval: '#ff6f43', group: gVis },
  { id: 'brokenColor', type: 'color', title: 'Broken Level Color', defval: '#94a3b8', group: gVis },
  {
    id: 'lineWidth', type: 'int', title: 'Base Line Width', defval: 2, min: 1, max: 5, group: gVis,
    tooltip: 'Used when Longevity Scaling is OFF.',
  },
  {
    id: 'useDynamicWidth', type: 'bool', title: 'Enable Longevity Width', defval: true, group: gVis,
    tooltip: 'When enabled, older levels become thicker over time.',
  },
  {
    id: 'maxLineWidth', type: 'int', title: 'Max Longevity Width', defval: 7, min: 1, max: 10, group: gVis,
    tooltip: 'The maximum thickness an old level can reach.',
  },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: gVis },
  { id: 'showPriceLbl', type: 'bool', title: 'Show Price Labels on Active Levels', defval: true, group: gVis },
  {
    id: 'dashPos', type: 'string', title: 'Dashboard Position', defval: 'Bottom Right',
    options: ['Top Right', 'Bottom Right', 'Top Left', 'Bottom Left'], group: 'Dashboard',
  },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'Adaptive S/R Zones [BigBeluga]',
  shortTitle: 'Adaptive S/R [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const DASH = '—';

interface SRLevel {
  price: number;
  barStart: number;
  levelType: number;
  active: boolean;
  broken: boolean;
  breakBar: number;
  retested: boolean;
  mainLine: Line;
  zoneBox: Box | null;
  breakLabel: Label | null;
  priceLabel: Label | null;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveSupportAndResistanceZonesInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const pivotLen = Math.trunc(cfg.pivotLen);
  const mintick = mintickOf(chart);
  const bg = backgroundColorOf(chart);
  const { minStrength, mergeThresh, zoneWidth, breakSens } = cfg;
  const { supColor, resColor, brokenColor } = cfg;

  resetDrawings({ line: 500, label: 200, box: 200 });

  const atr = ta.atr(bars, 14).toArray();
  const ph = ta.pivothigh(new Series(bars, (b) => b.high), pivotLen, pivotLen).toArray();
  const pl = ta.pivotlow(new Series(bars, (b) => b.low), pivotLen, pivotLen).toArray();

  const activeLevels: SRLevel[] = [];
  const brokenLevels: SRLevel[] = [];
  let lastBreakDir = DASH;
  let dashTable: Table | null = null;
  const fmt = (v: number) => str.tostring(v, 'mintick', mintick);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const atrVal = atr[i] ?? NaN;
    const atrSafe = Number.isNaN(atrVal) || Math.abs(atrVal) <= EPS ? mintick * 10 : atrVal;

    const isTooClose = (price: number, type: number) => {
      for (const lvl of activeLevels) {
        if (lvl.levelType === type && lvl.active && lt(Math.abs(lvl.price - price), mergeThresh * atrSafe)) return true;
      }
      return false;
    };

    const addLevel = (price: number, type: number, barIdx: number) => {
      if (isTooClose(price, type)) return;
      let cnt = 0;
      for (const lvl of activeLevels) if (lvl.levelType === type && lvl.active) cnt += 1;
      if (cnt >= cfg.maxLevels) return;
      const baseColor = type === 1 ? resColor : supColor;
      const zoneTop = price + zoneWidth * atrSafe * 0.5;
      const zoneBot = price - zoneWidth * atrSafe * 0.5;
      const mainLine = line.new(barIdx, price, barIdx + 1, price, 'bar_index', 'right', color.new(baseColor, 0), 'solid', cfg.lineWidth);
      const zoneBox = cfg.showZones
        ? box.new(barIdx, zoneTop, barIdx + 1, zoneBot, color.new(baseColor, 90), undefined, undefined, 'right', undefined,
          color.new(baseColor, 88), undefined, undefined, '#ffffff')
        : null;
      const priceLabel = cfg.showPriceLbl
        ? label.new(i + 20, price, fmt(price), 'bar_index', 'price', color.new(bg, 0), 'label_center', baseColor, 'small')
        : null;
      activeLevels.push({
        price, barStart: barIdx, levelType: type, active: true, broken: false, breakBar: NaN, retested: false,
        mainLine, zoneBox, breakLabel: null, priceLabel,
      });
    };

    const pivotStrong = (price: number, type: number) => {
      if (!(minStrength > 0)) return true;
      if (type === 1) {
        const nearHigh = Math.max(bars[i - (pivotLen - 1)].high, bars[i - (pivotLen + 1)].high);
        return !lt(price - nearHigh, minStrength * atrSafe);
      }
      const nearLow = Math.min(bars[i - (pivotLen - 1)].low, bars[i - (pivotLen + 1)].low);
      return !lt(nearLow - price, minStrength * atrSafe);
    };

    // Prune old levels
    for (let k = activeLevels.length - 1; k >= 0; k--) {
      const lvl = activeLevels[k];
      if (lvl.active && i - lvl.barStart > cfg.maxAgeBars) {
        line.delete(lvl.mainLine);
        if (lvl.zoneBox) box.delete(lvl.zoneBox);
        if (lvl.priceLabel) label.delete(lvl.priceLabel);
        activeLevels.splice(k, 1);
      }
    }

    // Add new pivots
    const phv = ph[i] ?? NaN;
    const plv = pl[i] ?? NaN;
    if (!Number.isNaN(phv) && cfg.showResist && pivotStrong(phv, 1)) addLevel(phv, 1, i - pivotLen);
    if (!Number.isNaN(plv) && cfg.showSupport && pivotStrong(plv, -1)) addLevel(plv, -1, i - pivotLen);

    // Breakout logic
    for (let k = activeLevels.length - 1; k >= 0; k--) {
      const lvl = activeLevels[k];
      if (!lvl.active) continue;
      const breakBuffer = breakSens * atrSafe;
      const bull = lvl.levelType === 1 && gt(b.close, lvl.price + breakBuffer);
      const bear = !bull && lvl.levelType === -1 && lt(b.close, lvl.price - breakBuffer);
      if (!bull && !bear) continue;
      lvl.active = false;
      lvl.broken = true;
      lvl.breakBar = i;
      lastBreakDir = bull ? 'Bullish' : 'Bearish';
      if (lvl.priceLabel) {
        label.delete(lvl.priceLabel);
        lvl.priceLabel = null;
      }
      line.set_color(lvl.mainLine, color.new(brokenColor, 0));
      line.set_style(lvl.mainLine, 'dotted');
      line.set_width(lvl.mainLine, 1);
      line.set_extend(lvl.mainLine, 'none');
      line.set_x2(lvl.mainLine, i);
      if (lvl.zoneBox) {
        const zb = lvl.zoneBox;
        box.set_bgcolor(zb, color.new(brokenColor, 93));
        box.set_border_color(zb, color.new(brokenColor, 100));
        box.set_extend(zb, 'none');
        box.set_right(zb, i);
        const mid = (box.get_top(zb) + box.get_bottom(zb)) / 2;
        box.set_top(zb, mid + breakBuffer);
        box.set_bottom(zb, mid - breakBuffer);
      }
      if (cfg.showBreakLbl) {
        lvl.breakLabel = label.new(i, lvl.price, '< Break', 'bar_index', 'price',
          color.new(bull ? '#22c55e' : '#ef4444', 100), 'label_left', bull ? supColor : resColor, 'small');
      }
      if (cfg.showBroken) {
        brokenLevels.push(lvl);
        if (brokenLevels.length > cfg.maxBroken && brokenLevels.length > 0) {
          const old = brokenLevels.shift()!;
          line.delete(old.mainLine);
          if (old.zoneBox) box.delete(old.zoneBox);
          if (old.breakLabel) label.delete(old.breakLabel);
        }
      } else {
        line.delete(lvl.mainLine);
        if (lvl.zoneBox) box.delete(lvl.zoneBox);
      }
      activeLevels.splice(k, 1);
    }

    // Extend visuals on active levels
    for (const lvl of activeLevels) {
      if (!lvl.active) continue;
      if (cfg.useDynamicWidth) {
        const age = i - lvl.barStart;
        const calcWidth = Math.min(cfg.maxLineWidth, 1 + Math.floor((age / cfg.maxAgeBars) * (cfg.maxLineWidth - 1)));
        line.set_width(lvl.mainLine, Math.trunc(calcWidth));
      } else {
        line.set_width(lvl.mainLine, cfg.lineWidth);
      }
      line.set_x2(lvl.mainLine, i + 1);
      if (lvl.zoneBox) box.set_right(lvl.zoneBox, i + 1);
      if (cfg.showPriceLbl && lvl.priceLabel) label.set_x(lvl.priceLabel, i + 10);
    }

    // Dashboard
    if (cfg.showDash) {
      if (i === 0) {
        const pos = cfg.dashPos === 'Top Right' ? 'top_right' : cfg.dashPos === 'Top Left' ? 'top_left'
          : cfg.dashPos === 'Bottom Left' ? 'bottom_left' : 'bottom_right';
        dashTable = table.new(pos, 2, 5, color.new('#0d1117', 5), color.new('#30363d', 20), 1, color.new('#30363d', 40), 1);
      }
      if (i === n - 1 && dashTable) {
        let nearestSup = NaN;
        let nearestRes = NaN;
        for (const lvl of activeLevels) {
          if (!lvl.active) continue;
          if (lvl.levelType === -1 && lt(lvl.price, b.close) && (Number.isNaN(nearestSup) || gt(lvl.price, nearestSup))) {
            nearestSup = lvl.price;
          }
          if (lvl.levelType === 1 && gt(lvl.price, b.close) && (Number.isNaN(nearestRes) || lt(lvl.price, nearestRes))) {
            nearestRes = lvl.price;
          }
        }
        const t = dashTable;
        const rowBg = color.new('#0d1117', 10);
        const keyText = color.new('#8b949e', 0);
        const naText = color.new('#484f58', 0);
        const white = color.new('#f0f6fc', 0);
        table.cell(t, 0, 0, 'S/R Dashboard', undefined, undefined, white, 'center', undefined, 'normal', color.new('#161b22', 0));
        table.merge_cells(t, 0, 0, 1, 0);
        table.cell(t, 0, 1, 'Resistance', undefined, undefined, keyText, 'left', undefined, 'normal', rowBg);
        table.cell(t, 1, 1, Number.isNaN(nearestRes) ? DASH : fmt(nearestRes), undefined, undefined,
          Number.isNaN(nearestRes) ? naText : resColor, 'right', undefined, 'normal', rowBg);
        table.cell(t, 0, 2, 'Support', undefined, undefined, keyText, 'left', undefined, 'normal', rowBg);
        table.cell(t, 1, 2, Number.isNaN(nearestSup) ? DASH : fmt(nearestSup), undefined, undefined,
          Number.isNaN(nearestSup) ? naText : supColor, 'right', undefined, 'normal', rowBg);
        table.cell(t, 0, 3, 'Last Break', undefined, undefined, keyText, 'left', undefined, 'normal', rowBg);
        const breakDirColor = lastBreakDir === 'Bullish' ? supColor : lastBreakDir === 'Bearish' ? resColor : naText;
        table.cell(t, 1, 3, lastBreakDir, undefined, undefined, breakDirColor, 'right', undefined, 'normal', rowBg);
        table.cell(t, 0, 4, 'Active Levels', undefined, undefined, keyText, 'left', undefined, 'normal', rowBg);
        table.cell(t, 1, 4, str.tostring(activeLevels.length), undefined, undefined, white, 'right', undefined, 'normal', rowBg);
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, n > 0 && bars[0].time >= 1e12 ? 'ms' : 's'),
  };
}

export const AdaptiveSupportAndResistanceZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
