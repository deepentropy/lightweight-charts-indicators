/**
 * Pure Price Action Structures [LuxAlgo]
 *
 * Market structure on three levels, from the price bars only (no lookback length).
 * - Short term: a swing low is a bar whose low is below the low before it and not above the low after it (three
 *   bars); a swing high is the mirror on the highs.
 * - Intermediate term: a short-term swing low that is below the short-term swing low before it and not above the
 *   one after it (the same three-point pattern on the short-term swings); the mirror for the highs.
 * - Long term: the same pattern on the intermediate-term swings.
 * On each level, when a bar closes above the latest swing high (below the latest swing low) for the first time, a
 * line is drawn from the swing to that bar. With the labels enabled the line carries a text: "MSS" (market structure
 * shift) when the break is against the direction of the break before it on that level, else "BOS" (break of
 * structure), with the prefix ST / IT / LT.
 * Every short-term swing has a label; its text is only visible when the swings of its level are enabled, and it
 * takes the text, size and colour of the intermediate and long-term level when the swing is promoted.
 * At most 500 lines, 500 labels and 500 boxes are kept (the texts of the lines are boxes).
 *
 * Reference: "Pure Price Action Structures [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, PineSize } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type SizeText = 'Tiny' | 'Small' | 'Normal' | 'Large';
type StyleText = 'Solid' | 'Dashed' | 'Dotted';
type Toggle = 'Enabled' | 'Disabled';

export interface PurePriceActionStructuresInputs {
  stSwings: '⦁' | 'ST(H/L)' | 'Disabled';
  stSwingsSZ: SizeText;
  stMarketStructures: boolean;
  stMSTextT: Toggle;
  stMSLineStyle: StyleText;
  stMSLineWidth: number;
  stBullMSColor: string;
  stBearMSColor: string;
  itSwings: '◈' | '△▽' | 'IT(H/L)' | 'Disabled';
  itSwingsSZ: SizeText;
  itMarketStructures: boolean;
  itMSTextT: Toggle;
  itMSLineStyle: StyleText;
  itMSLineWidth: number;
  itBullMSColor: string;
  itBearMSColor: string;
  ltSwings: '◉' | '▲▼' | 'LT(H/L)' | 'Disabled';
  ltSwingsSZ: SizeText;
  ltMarketStructures: boolean;
  ltMSTextT: Toggle;
  ltMSLineStyle: StyleText;
  ltMSLineWidth: number;
  ltBullMSColor: string;
  ltBearMSColor: string;
}

export const defaultInputs: PurePriceActionStructuresInputs = {
  stSwings: 'Disabled',
  stSwingsSZ: 'Tiny',
  stMarketStructures: true,
  stMSTextT: 'Disabled',
  stMSLineStyle: 'Dotted',
  stMSLineWidth: 1,
  stBullMSColor: '#089981',
  stBearMSColor: '#f23645',
  itSwings: 'Disabled',
  itSwingsSZ: 'Small',
  itMarketStructures: true,
  itMSTextT: 'Disabled',
  itMSLineStyle: 'Dashed',
  itMSLineWidth: 1,
  itBullMSColor: '#089981',
  itBearMSColor: '#f23645',
  ltSwings: '◉',
  ltSwingsSZ: 'Normal',
  ltMarketStructures: true,
  ltMSTextT: 'Enabled',
  ltMSLineStyle: 'Solid',
  ltMSLineWidth: 1,
  ltBullMSColor: '#089981',
  ltBearMSColor: '#f23645',
};

const stGroup = 'Short Term Structures';
const itGroup = 'Intermediate Term Structures';
const ltGroup = 'Long Term Structures';
const SIZES = ['Tiny', 'Small', 'Normal', 'Large'];
const STYLES = ['Solid', 'Dashed', 'Dotted'];
const TOGGLE = ['Enabled', 'Disabled'];
const LABELS_TITLE = '  Market Structure Labels';
const STYLE_TITLE = '  Line Style';

export const inputConfig: InputConfig[] = [
  { id: 'stSwings', type: 'string', title: 'Swings', defval: 'Disabled', options: ['⦁', 'ST(H/L)', 'Disabled'], inline: 'NA', group: stGroup },
  { id: 'stSwingsSZ', type: 'string', title: 'Size', defval: 'Tiny', options: SIZES, inline: 'NA', group: stGroup },
  { id: 'stMarketStructures', type: 'bool', title: 'Market Structures', defval: true, group: stGroup },
  { id: 'stMSTextT', type: 'string', title: LABELS_TITLE, defval: 'Disabled', options: TOGGLE, group: stGroup },
  { id: 'stMSLineStyle', type: 'string', title: STYLE_TITLE, defval: 'Dotted', options: STYLES, inline: 'LN', group: stGroup },
  { id: 'stMSLineWidth', type: 'int', title: 'Width', defval: 1, min: 1, inline: 'LN', group: stGroup },
  { id: 'stBullMSColor', type: 'color', title: 'Swing and Line Colors, Bullish', defval: '#089981', inline: 'MS', group: stGroup },
  { id: 'stBearMSColor', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'MS', group: stGroup },
  { id: 'itSwings', type: 'string', title: 'Swings', defval: 'Disabled', options: ['◈', '△▽', 'IT(H/L)', 'Disabled'], inline: 'NA', group: itGroup },
  { id: 'itSwingsSZ', type: 'string', title: 'Size', defval: 'Small', options: SIZES, inline: 'NA', group: itGroup },
  { id: 'itMarketStructures', type: 'bool', title: 'Market Structures', defval: true, group: itGroup },
  { id: 'itMSTextT', type: 'string', title: LABELS_TITLE, defval: 'Disabled', options: TOGGLE, group: itGroup },
  { id: 'itMSLineStyle', type: 'string', title: STYLE_TITLE, defval: 'Dashed', options: STYLES, inline: 'LN', group: itGroup },
  { id: 'itMSLineWidth', type: 'int', title: 'Width', defval: 1, min: 1, inline: 'LN', group: itGroup },
  { id: 'itBullMSColor', type: 'color', title: 'Swing and Line Colors, Bullish', defval: '#089981', inline: 'MS', group: itGroup },
  { id: 'itBearMSColor', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'MS', group: itGroup },
  { id: 'ltSwings', type: 'string', title: 'Swings', defval: '◉', options: ['◉', '▲▼', 'LT(H/L)', 'Disabled'], inline: 'NA', group: ltGroup },
  { id: 'ltSwingsSZ', type: 'string', title: 'Size', defval: 'Normal', options: SIZES, inline: 'NA', group: ltGroup },
  { id: 'ltMarketStructures', type: 'bool', title: 'Market Structures', defval: true, group: ltGroup },
  { id: 'ltMSTextT', type: 'string', title: LABELS_TITLE, defval: 'Enabled', options: TOGGLE, group: ltGroup },
  { id: 'ltMSLineStyle', type: 'string', title: STYLE_TITLE, defval: 'Solid', options: STYLES, inline: 'LN', group: ltGroup },
  { id: 'ltMSLineWidth', type: 'int', title: 'Width', defval: 1, min: 1, inline: 'LN', group: ltGroup },
  { id: 'ltBullMSColor', type: 'color', title: 'Swing and Line Colors, Bullish', defval: '#089981', inline: 'MS', group: ltGroup },
  { id: 'ltBearMSColor', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'MS', group: ltGroup },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Pure Price Action Structures [LuxAlgo]',
  shortTitle: 'LuxAlgo - Pure Price Action Structures',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_boxes_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

interface Lb {
  x: number;
  y: number;
  text: string;
  /** null = na (not drawn) */
  textColor: string | null;
  style: 'label_up' | 'label_down';
  size: PineSize;
  deleted: boolean;
}
interface Ln {
  x1: number;
  x2: number;
  y: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
}
interface Bx {
  x1: number;
  x2: number;
  y: number;
  text: string;
  textColor: string;
  vAlign: 'top' | 'bottom';
}

/** The three latest swings of one side on one level, and the state of the break of the latest one (type ICTMS) */
interface Swings {
  lastPrice: number;
  midPrice: number;
  prevPrice: number;
  lastIndex: number;
  midIndex: number;
  prevIndex: number;
  lastLabel: Lb | null;
  midLabel: Lb | null;
  isCrossed: boolean;
}

const newSwings = (): Swings => ({
  lastPrice: NaN, midPrice: NaN, prevPrice: NaN, lastIndex: NaN, midIndex: NaN, prevIndex: NaN,
  lastLabel: null, midLabel: null, isCrossed: false,
});

const textSize = (s: SizeText): PineSize => (s === 'Tiny' ? 'tiny' : s === 'Small' ? 'small' : s === 'Normal' ? 'normal' : 'large');
const lineStyle = (s: StyleText) => (s === 'Solid' ? 'solid' : s === 'Dotted' ? 'dotted' : 'dashed');

/** Three-point swing pattern: the middle one is the extreme */
const queryPatterns = (last: number, mid: number, prev: number, isSwingHigh: boolean) =>
  isSwingHigh ? lt(prev, mid) && ge(mid, last) : gt(prev, mid) && le(mid, last);

const updatePattern = (s: Swings, price: number, index: number) => {
  s.isCrossed = false;
  s.prevPrice = s.midPrice;
  s.midPrice = s.lastPrice;
  s.lastPrice = price;
  s.prevIndex = s.midIndex;
  s.midIndex = s.lastIndex;
  s.lastIndex = index;
  s.midLabel = s.lastLabel;
};

type Result = Omit<IndicatorResult, 'boxes' | 'labels' | 'lines'> & { boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[] };

interface PpasVars {
  /** Live drawings in creation order */
  labels: Lb[];
  lines: Ln[];
  boxes: Bx[];
  /** One market structure direction per level (type MS): 1 after a bullish break, -1 after a bearish break */
  stMS: { type: number };
  itMS: { type: number };
  ltMS: { type: number };
  stLow: Swings;
  stHigh: Swings;
  itLow: Swings;
  itHigh: Swings;
  ltLow: Swings;
  ltHigh: Swings;
  cITL1: boolean;
  cITH1: boolean;
  cLTL1: boolean;
  cLTH1: boolean;
}

type PpasRun = BarRunState<PpasVars>;

/** A copy of the state: the labels are changed in place (promotions), the swings point to them */
function copyPpasVars(v: PpasVars): PpasVars {
  const map = new Map<Lb, Lb>();
  const lb = (l: Lb | null): Lb | null => {
    if (!l) return null;
    let c = map.get(l);
    if (!c) {
      c = { ...l };
      map.set(l, c);
    }
    return c;
  };
  const labels = v.labels.map((l) => lb(l)!);
  const sw = (s: Swings): Swings => ({ ...s, lastLabel: lb(s.lastLabel), midLabel: lb(s.midLabel) });
  return {
    labels, lines: v.lines.slice(), boxes: v.boxes.slice(),
    stMS: { ...v.stMS }, itMS: { ...v.itMS }, ltMS: { ...v.ltMS },
    stLow: sw(v.stLow), stHigh: sw(v.stHigh), itLow: sw(v.itLow), itHigh: sw(v.itHigh), ltLow: sw(v.ltLow), ltHigh: sw(v.ltHigh),
    cITL1: v.cITL1, cITH1: v.cITH1, cLTL1: v.cLTL1, cLTH1: v.cLTH1,
  };
}

// Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until
// max remain. A deleted label ignores later changes.
const trim = <T>(list: T[], onDelete?: (o: T) => void) => {
  if (list.length > MAX_OBJECTS + 5) for (const old of list.splice(0, list.length - MAX_OBJECTS)) onDelete?.(old);
};

const promote = (lb: Lb | null, text: string, size: SizeText, css: string) => {
  if (!lb || lb.deleted) return;
  lb.text = text;
  lb.size = textSize(size);
  lb.textColor = css;
};

function study(inputs: Partial<PurePriceActionStructuresInputs>): BarStudy<PpasRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      return {
        steps: [],
        vars: {
          labels: [], lines: [], boxes: [],
          stMS: { type: 0 }, itMS: { type: 0 }, ltMS: { type: 0 },
          stLow: newSwings(), stHigh: newSwings(), itLow: newSwings(), itHigh: newSwings(), ltLow: newSwings(), ltHigh: newSwings(),
          cITL1: false, cITH1: false, cLTL1: false, cLTH1: false,
        },
        lists: [], series: [],
      };
    },
    copyVars: copyPpasVars,
    bar(s, i, bars) {
      const v = s.vars;
      const { labels, lines, boxes, stMS, itMS, ltMS, stLow, stHigh, itLow, itHigh, ltLow, ltHigh } = v;
      const newLabel = (l: Omit<Lb, 'deleted'>): Lb => {
        const o = { ...l, deleted: false };
        labels.push(o);
        trim(labels, (old) => {
          old.deleted = true;
        });
        return o;
      };
      const renderStructures = (
        sw: Swings, isBullish: boolean, ms: { type: number }, termText: string, css: string, style: StyleText,
        width: number, labelEnabled: boolean,
      ) => {
        const close = bars[i].close;
        const condition = isBullish ? gt(close, sw.lastPrice) : lt(close, sw.lastPrice);
        if (!condition || sw.isCrossed) return;
        sw.isCrossed = true;
        lines.push({ x1: sw.lastIndex, x2: i, y: sw.lastPrice, color: css, style: lineStyle(style), width });
        trim(lines);
        if (labelEnabled) {
          boxes.push({
            x1: sw.lastIndex, x2: i, y: sw.lastPrice,
            text: ms.type === (isBullish ? -1 : 1) ? `${termText}-MSS` : `${termText}-BOS`,
            textColor: String(color.new(css, 17)),
            vAlign: isBullish ? 'bottom' : 'top',
          });
          trim(boxes);
        }
        ms.type = isBullish ? 1 : -1;
      };

      const b = bars[i];
      const b1 = i >= 1 ? bars[i - 1] : null;
      const b2 = i >= 2 ? bars[i - 2] : null;

      // Short term
      if (queryPatterns(b.low, b1 ? b1.low : NaN, b2 ? b2.low : NaN, false)) {
        updatePattern(stLow, b1!.low, i - 1);
        const TX = cfg.stSwings === '⦁' ? '⦁' : gt(stLow.midPrice, stLow.lastPrice) ? 'ST-LL' : 'ST-LH';
        stLow.lastLabel = newLabel({
          x: stLow.lastIndex, y: stLow.lastPrice, text: TX, textColor: cfg.stSwings !== 'Disabled' ? cfg.stBearMSColor : null,
          style: 'label_up', size: textSize(cfg.stSwingsSZ),
        });
      }
      if (queryPatterns(b.high, b1 ? b1.high : NaN, b2 ? b2.high : NaN, true)) {
        updatePattern(stHigh, b1!.high, i - 1);
        const TX = cfg.stSwings === '⦁' ? '⦁' : gt(stHigh.midPrice, stHigh.lastPrice) ? 'ST-HL' : 'ST-HH';
        stHigh.lastLabel = newLabel({
          x: i - 1, y: b1!.high, text: TX, textColor: cfg.stSwings !== 'Disabled' ? cfg.stBullMSColor : null,
          style: 'label_down', size: textSize(cfg.stSwingsSZ),
        });
      }
      if (cfg.stMarketStructures) {
        const on = cfg.stMSTextT === 'Enabled';
        renderStructures(stLow, false, stMS, 'ST', cfg.stBearMSColor, cfg.stMSLineStyle, cfg.stMSLineWidth, on);
        renderStructures(stHigh, true, stMS, 'ST', cfg.stBullMSColor, cfg.stMSLineStyle, cfg.stMSLineWidth, on);
      }

      // Intermediate term
      const cITL = queryPatterns(stLow.lastPrice, stLow.midPrice, stLow.prevPrice, false);
      if (cITL && cITL !== v.cITL1) {
        updatePattern(itLow, stLow.midPrice, stLow.midIndex);
        itLow.lastLabel = stLow.midLabel;
        if (cfg.itSwings !== 'Disabled') {
          const TX = cfg.itSwings === '△▽' ? '△' : cfg.itSwings === '◈' ? '◈' : gt(itLow.lastPrice, itLow.midPrice) ? 'IT-LH' : 'IT-LL';
          promote(stLow.midLabel, TX, cfg.itSwingsSZ, cfg.itBearMSColor);
        }
      }
      v.cITL1 = cITL;
      const cITH = queryPatterns(stHigh.lastPrice, stHigh.midPrice, stHigh.prevPrice, true);
      if (cITH && cITH !== v.cITH1) {
        updatePattern(itHigh, stHigh.midPrice, stHigh.midIndex);
        itHigh.lastLabel = stHigh.midLabel;
        if (cfg.itSwings !== 'Disabled') {
          const TX = cfg.itSwings === '△▽' ? '▽' : cfg.itSwings === '◈' ? '◈' : gt(itHigh.lastPrice, itHigh.midPrice) ? 'IT-HH' : 'IT-HL';
          promote(stHigh.midLabel, TX, cfg.itSwingsSZ, cfg.itBullMSColor);
        }
      }
      v.cITH1 = cITH;
      if (cfg.itMarketStructures) {
        const on = cfg.itMSTextT === 'Enabled';
        renderStructures(itLow, false, itMS, 'IT', cfg.itBearMSColor, cfg.itMSLineStyle, cfg.itMSLineWidth, on);
        renderStructures(itHigh, true, itMS, 'IT', cfg.itBullMSColor, cfg.itMSLineStyle, cfg.itMSLineWidth, on);
      }

      // Long term
      const cLTL = queryPatterns(itLow.lastPrice, itLow.midPrice, itLow.prevPrice, false);
      if (cLTL && cLTL !== v.cLTL1) {
        ltLow.isCrossed = false;
        const TX = cfg.ltSwings === '▲▼' ? '▲' : cfg.ltSwings === '◉' ? '◉' : gt(ltLow.lastPrice, itLow.midPrice) ? 'LT-LL' : 'LT-LH';
        ltLow.lastPrice = itLow.midPrice;
        ltLow.lastIndex = itLow.midIndex;
        if (cfg.ltSwings !== 'Disabled') promote(itLow.midLabel, TX, cfg.ltSwingsSZ, cfg.ltBearMSColor);
      }
      v.cLTL1 = cLTL;
      const cLTH = queryPatterns(itHigh.lastPrice, itHigh.midPrice, itHigh.prevPrice, true);
      if (cLTH && cLTH !== v.cLTH1) {
        ltHigh.isCrossed = false;
        const TX = cfg.ltSwings === '▲▼' ? '▼' : cfg.ltSwings === '◉' ? '◉' : gt(ltHigh.lastPrice, itHigh.midPrice) ? 'LT-HL' : 'LT-HH';
        ltHigh.lastPrice = itHigh.midPrice;
        ltHigh.lastIndex = itHigh.midIndex;
        if (cfg.ltSwings !== 'Disabled') promote(itHigh.midLabel, TX, cfg.ltSwingsSZ, cfg.ltBullMSColor);
      }
      v.cLTH1 = cLTH;
      if (cfg.ltMarketStructures) {
        const on = cfg.ltMSTextT === 'Enabled';
        renderStructures(ltLow, false, ltMS, 'LT', cfg.ltBearMSColor, cfg.ltMSLineStyle, cfg.ltMSLineWidth, on);
        renderStructures(ltHigh, true, ltMS, 'LT', cfg.ltBullMSColor, cfg.ltMSLineStyle, cfg.ltMSLineWidth, on);
      }
    },
    result(s, bars) {
      const { labels, lines, boxes } = s.vars;
      const T = (index: number) => bars[index].time;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: lines.map((l) => ({
          time1: T(l.x1), price1: l.y, time2: T(l.x2), price2: l.y, color: l.color, width: l.width,
          ...(l.style !== 'solid' ? { style: l.style } : {}),
        })),
        boxes: boxes.map((bx) => ({
          time1: T(bx.x1), price1: bx.y, time2: T(bx.x2), price2: bx.y, bgColor: 'transparent', borderColor: 'transparent',
          text: bx.text, textColor: bx.textColor, textSize: 'tiny' as const, textHAlign: 'left' as const, textVAlign: bx.vAlign,
        })),
        labels: labels.map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: 'transparent', textColor: l.textColor ?? 'transparent',
          style: l.style, size: l.size,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PurePriceActionStructuresInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PurePriceActionStructuresInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PurePriceActionStructures = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
