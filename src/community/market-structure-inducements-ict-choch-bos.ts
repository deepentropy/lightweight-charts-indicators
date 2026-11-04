/**
 * Market Structure Inducements ICT CHoch BOS Sweeps
 *
 * Market structure from three pivot periods:
 * - ChoCh: pivot highs / lows of (ChoCh period / 2 left bars with "Fast Trend Detector", else the period) and the
 *   ChoCh period right bars. The latest pivot high is the bullish ChoCh level (in an up trend only a higher one
 *   replaces it), the latest pivot low the bearish level. A close crossing above the bullish level (in a down trend
 *   or before any trend) starts an up trend, a close crossing below the bearish level a down trend. The level of the
 *   opposite side is drawn as a solid line with a "Bullish ChoCh" / "Bearish ChoCh" label and extended until the
 *   next pivot replaces it.
 * - BoS & liquidity: in an up trend each pivot high (BoS period) at or above the last one draws a dashed "BoS" line
 *   that is extended until a close above it (broken) or a bar that trades above it and closes below it (then a
 *   dotted "LQDT" liquidity line); mirrored in a down trend. A ChoCh removes the active BoS line.
 * - Inducement: in an up trend each pivot low (inducement period) draws a dotted "IDMT" line, extended until it is
 *   swept ("Sweeps": a low below it with a close above it; a close below it removes it) or touched ("Total");
 *   mirrored in a down trend.
 *
 * Reference: "Market Structure Inducements ICT [TradinFinder] CHoch BOS Sweeps" by TradingFinder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab
 */

import {
  ta, color, callsite, Series, line, label, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface MarketStructureInducementsIctChochBosInputs {
  longP: number;
  shortP: number;
  inducementP: number;
  ftd: boolean;
  idmtType: string;
  showChoCh: boolean;
  colorBuChoCh: string;
  colorBeChoCh: string;
  sizeChoCh: string;
  showBoS: boolean;
  colorBuBoS: string;
  colorBeBoS: string;
  colorLqdy: string;
  sizeBoS: string;
  showIdmt: boolean;
  colorIdmt: string;
  sizeIdmt: string;
}

export const defaultInputs: MarketStructureInducementsIctChochBosInputs = {
  longP: 30,
  shortP: 1,
  inducementP: 3,
  ftd: true,
  idmtType: 'Sweeps',
  showChoCh: true,
  colorBuChoCh: '#005503',
  colorBeChoCh: '#630000',
  sizeChoCh: 'small',
  showBoS: true,
  colorBuBoS: '#006bc2',
  colorBeBoS: '#e79e01',
  colorLqdy: '#7905af',
  sizeBoS: 'small',
  showIdmt: true,
  colorIdmt: '#666566',
  sizeIdmt: 'small',
};

const SIZES = ['tiny', 'small', 'normal', 'large', 'auto'];
const LOGIC = 'Logical Setting';
const CHOCH = 'ChoCh Display';
const BOS = 'BoS & LQDY Display';
const IDMT = 'Inducement Display';

export const inputConfig: InputConfig[] = [
  { id: 'longP', type: 'int', title: 'ChoCh Detector Period', defval: 30, min: 1, group: LOGIC },
  { id: 'shortP', type: 'int', title: 'BoS & Liquidity Detector Period', defval: 1, min: 1, group: LOGIC },
  { id: 'inducementP', type: 'int', title: 'Inducement Detector Period', defval: 3, min: 1, group: LOGIC },
  { id: 'ftd', type: 'bool', title: 'Fast Trend Detector', defval: true, group: LOGIC },
  { id: 'idmtType', type: 'string', title: 'Inducement Type Detector', defval: 'Sweeps', options: ['Total', 'Sweeps'], group: LOGIC },
  { id: 'showChoCh', type: 'bool', title: 'Show ChoCh Level', defval: true, group: CHOCH },
  { id: 'colorBuChoCh', type: 'color', title: 'Bull', defval: '#005503', group: CHOCH, inline: 'ChoCh' },
  { id: 'colorBeChoCh', type: 'color', title: 'Bear', defval: '#630000', group: CHOCH, inline: 'ChoCh' },
  { id: 'sizeChoCh', type: 'string', title: 'ChoCh Label Size', defval: 'small', options: SIZES, group: CHOCH },
  { id: 'showBoS', type: 'bool', title: 'Show BoS & Liquidity Level', defval: true, group: BOS },
  { id: 'colorBuBoS', type: 'color', title: 'Bull', defval: '#006bc2', group: BOS, inline: 'BoS' },
  { id: 'colorBeBoS', type: 'color', title: 'Bear', defval: '#e79e01', group: BOS, inline: 'BoS' },
  { id: 'colorLqdy', type: 'color', title: 'LQDY', defval: '#7905af', group: BOS, inline: 'BoS' },
  { id: 'sizeBoS', type: 'string', title: 'BoS & LQDY Label Size', defval: 'small', options: SIZES, group: BOS },
  { id: 'showIdmt', type: 'bool', title: 'Show Inducement Level', defval: true, group: IDMT, inline: 'IDMT' },
  { id: 'colorIdmt', type: 'color', title: '', defval: '#666566', group: IDMT, inline: 'IDMT' },
  { id: 'sizeIdmt', type: 'string', title: 'Inducement Label Size', defval: 'small', options: SIZES, group: IDMT },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Market Structure Inducements ICT [TradinFinder] CHoch BOS Sweeps',
  shortTitle: 'TFlab Market Structure',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** nz(x) != 0 */
const nzNe0 = (x: number) => !Number.isNaN(x) && Math.abs(x) > EPS;

const UP = 'Up Trend';
const DOWN = 'Down Trend';

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureInducementsIctChochBosInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { longP, shortP, inducementP } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);

  const ATR = A(ta.atr(bars, 50));
  // ChoCh period: LHP = ta.pivothigh(FTD ? int(LongP / 2) : LongP, LongP)
  const chochLeft = cfg.ftd ? Math.trunc(longP / 2) : longP;
  const LHP = A(ta.pivothigh(highS, chochLeft, longP));
  const LLP = A(ta.pivotlow(lowS, chochLeft, longP));
  const SHP = A(ta.pivothigh(highS, shortP, shortP));
  const SLP = A(ta.pivotlow(lowS, shortP, shortP));
  const IHP = A(ta.pivothigh(highS, inducementP, inducementP));
  const ILP = A(ta.pivotlow(lowS, inducementP, inducementP));

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });
  const buChoChLine = varDrawing<Line>();
  const buChoChLabel = varDrawing<Label>();
  const beChoChLine = varDrawing<Line>();
  const beChoChLabel = varDrawing<Label>();
  const idmLine = varDrawing<Line>();
  const idmLabel = varDrawing<Label>();
  const bosLine = varDrawing<Line>();
  const bosLabel = varDrawing<Label>();
  const buCross = callsite.crossover();
  const beCross = callsite.crossunder();

  // na-safe drawing calls (a `var line x = na` never set)
  const x1Of = (l: Line | undefined) => (l ? line.get_x1(l) : NaN);
  const y1Of = (l: Line | undefined) => (l ? line.get_y1(l) : NaN);
  const delLine = (l: Line | undefined) => { if (l) line.delete(l); };
  const delLabel = (l: Label | undefined) => { if (l) label.delete(l); };
  const setX2 = (l: Line | undefined, x: number) => { if (l) line.set_x2(l, x); };
  const setLabelX = (l: Label | undefined, x: number) => { if (l) label.set_x(l, x); };

  let trend = '';
  let buP = 0;
  let buI = 0;
  let buIB = 0;
  let buCount = 0;
  let buB = '';
  let beP = 0;
  let beI = 0;
  let beIB = 0;
  let beCount = 0;
  let beB = '';
  let idmPermit = true;
  let High = 0;
  let Low = 0;
  let Index = 0;
  let bosPermit = true;

  const buChoChColor = String(color.new(cfg.colorBuChoCh, 30));
  const beChoChColor = String(color.new(cfg.colorBeChoCh, 30));
  const buBoSColor = String(color.new(cfg.colorBuBoS, 30));
  const beBoSColor = String(color.new(cfg.colorBeBoS, 30));
  const lqdyColor = String(color.new(cfg.colorLqdy, 30));
  const idmtColor = String(color.new(cfg.colorIdmt, 30));

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    // history of the bar before: Trend[1], BuChoCh_I[1], BeChoCh_I[1], the var drawings [1], the permits [1]
    const trend1 = trend;
    const buI1 = i > 0 ? buI : NaN;
    const beI1 = i > 0 ? beI : NaN;
    const buLine1 = buChoChLine.value;
    const buLabel1 = buChoChLabel.value;
    const beLine1 = beChoChLine.value;
    const beLabel1 = beChoChLabel.value;
    const bosLine1 = bosLine.value;
    const bosLabel1 = bosLabel.value;
    const bosPermit1 = i > 0 ? bosPermit : null;
    const idmLine1 = idmLine.value;
    const idmLabel1 = idmLabel.value;
    const idmPermit1 = i > 0 ? idmPermit : null;
    const atr = ATR[i];

    // ---- ChoCh block
    if (nzNe0(LHP[i])) {
      if (trend === '' || trend === DOWN) {
        buP = LHP[i];
        buI = i - longP;
      } else if (trend === UP) {
        if (gt(LHP[i], buP)) {
          buP = LHP[i];
          buI = i - longP;
        }
      }
    }
    if (nzNe0(LLP[i])) {
      if (trend === '' || trend === UP) {
        beP = LLP[i];
        beI = i - longP;
      } else if (trend === DOWN) {
        if (lt(LLP[i], beP)) {
          beP = LLP[i];
          beI = i - longP;
        }
      }
    }
    // Break: the crossings run only on the bars where both levels are set
    if (gt(buP, 0) && gt(beP, 0)) {
      const up = buCross(b.close, buP);
      if (up && (trend === DOWN || trend === '')) {
        trend = UP;
        buB = 'Break';
        buIB = x1Of(buChoChLine.value);
        buCount = 0;
      } else {
        buB = '';
      }
      const dn = beCross(b.close, beP);
      if (dn && (trend === UP || trend === '')) {
        trend = DOWN;
        beB = 'Break';
        beIB = x1Of(beChoChLine.value);
        beCount = 0;
      } else {
        beB = '';
      }
    }
    // Clear BoS when a ChoCh forms
    if (beB === 'Break' || buB === 'Break') {
      if (bosPermit) {
        delLine(bosLine.value);
        delLabel(bosLabel.value);
      }
    }
    // Next ChoCh line, bullish
    if (ne(buI, buI1) && trend === DOWN) {
      buCount += 1;
      if (trend1 === DOWN && buCount > 1) {
        delLine(buLine1);
        delLabel(buLabel1);
      }
      if (cfg.showChoCh) {
        buChoChLine.value = line.new(buI, buP, i, buP, 'bar_index', 'none', buChoChColor, 'solid');
        buChoChLabel.value = label.new(Math.trunc((buI + i) / 2), buP + atr * 0.1, 'Bullish ChoCh', 'bar_index', 'price',
          'transparent', 'label_down', cfg.colorBuChoCh, cfg.sizeChoCh);
      }
    }
    // Next ChoCh line, bearish
    if (ne(beI, beI1) && trend === UP) {
      beCount += 1;
      if (trend1 === UP && beCount > 1) {
        delLine(beLine1);
        delLabel(beLabel1);
      }
      if (cfg.showChoCh) {
        beChoChLine.value = line.new(beI, beP, i, beP, 'bar_index', 'none', beChoChColor, 'solid');
        beChoChLabel.value = label.new(Math.trunc((beI + i) / 2), beP - atr * 0.5, 'Bearish ChoCh', 'bar_index', 'price',
          'transparent', 'label_up', cfg.colorBeChoCh, cfg.sizeChoCh);
      }
    }
    // First ChoCh line, bullish: (bar_index - Index) > LongP ? BuChoCh_I : Index, high[bar_index - Index]
    const far = i - Index > longP;
    if (buCount === 0 && beB === 'Break' && ne(buIB, buI)) {
      buCount += 1;
      if (cfg.showChoCh) {
        const x = far ? buI : Index;
        const y = far ? buP : bars[Index].high;
        buChoChLine.value = line.new(x, y, i, y, 'bar_index', 'none', buChoChColor, 'solid');
        buChoChLabel.value = label.new(Math.trunc((x + i) / 2), y + atr * 0.1, 'Bullish ChoCh', 'bar_index', 'price',
          'transparent', 'label_down', cfg.colorBuChoCh, cfg.sizeChoCh);
      }
    }
    // First ChoCh line, bearish
    if (beCount === 0 && buB === 'Break' && ne(beIB, beI)) {
      beCount += 1;
      if (cfg.showChoCh) {
        const x = far ? beI : Index;
        const y = far ? beP : bars[Index].low;
        beChoChLine.value = line.new(x, y, i, y, 'bar_index', 'none', beChoChColor, 'solid');
        beChoChLabel.value = label.new(Math.trunc((x + i) / 2), y - atr * 0.5, 'Bearish ChoCh', 'bar_index', 'price',
          'transparent', 'label_up', cfg.colorBeChoCh, cfg.sizeChoCh);
      }
    }
    // Reset ChoCh lines
    if (eq(buI, buI1) && trend === DOWN && buCount > 0) {
      setX2(buChoChLine.value, i + 1);
      setLabelX(buChoChLabel.value, Math.trunc((x1Of(buChoChLine.value) + i) / 2));
    }
    if (eq(beI, beI1) && trend === UP && beCount > 0) {
      setX2(beChoChLine.value, i + 1);
      setLabelX(beChoChLabel.value, Math.trunc((x1Of(beChoChLine.value) + i) / 2));
    }

    // ---- BoS & liquidity block
    if (trend === UP) {
      Low = 0;
      if (nzNe0(SHP[i])) {
        const h = bars[i - shortP].high;
        if (eq(High, 0) ? eq(High, 0) : !gt(High, h)) {
          High = h;
          Index = i - shortP;
          bosPermit = true;
          if (cfg.showBoS) {
            bosLine.value = line.new(i - shortP, h, i, h, 'bar_index', 'none', buBoSColor, 'dashed');
            bosLabel.value = label.new(Math.trunc((i - shortP + i) / 2), h + atr * 0.1, 'BoS', 'bar_index', 'price',
              'transparent', 'label_center', cfg.colorBuBoS, cfg.sizeBoS);
          }
          if (bosPermit1 === true) {
            delLine(bosLine1);
            delLabel(bosLabel1);
          }
        }
      }
      if (!nzNe0(SHP[i]) && bosPermit) {
        setX2(bosLine.value, i);
        setLabelX(bosLabel.value, Math.trunc((x1Of(bosLine.value) + i) / 2));
      }
      const y = y1Of(bosLine.value);
      if (gt(b.close, y) && bosPermit) bosPermit = false;
      if (lt(b.close, y) && gt(b.high, y) && bosPermit) {
        bosPermit = false;
        const l = bosLine.value!;
        line.set_color(l, lqdyColor);
        line.set_style(l, 'dotted');
        const lb = bosLabel.value;
        if (lb) {
          label.set_text(lb, 'LQDT');
          label.set_textcolor(lb, cfg.colorLqdy);
        }
      }
    }
    if (trend === DOWN) {
      High = 0;
      if (nzNe0(SLP[i])) {
        const lo = bars[i - shortP].low;
        if (eq(Low, 0) ? eq(Low, 0) : !lt(Low, lo)) {
          Low = lo;
          Index = i - shortP;
          bosPermit = true;
          if (cfg.showBoS) {
            bosLine.value = line.new(i - shortP, lo, i, lo, 'bar_index', 'none', beBoSColor, 'dashed');
            bosLabel.value = label.new(Math.trunc((i - shortP + i) / 2), lo - atr * 0.4, 'BoS', 'bar_index', 'price',
              'transparent', 'label_center', cfg.colorBeBoS, cfg.sizeBoS);
          }
          if (bosPermit1 === true) {
            delLine(bosLine1);
            delLabel(bosLabel1);
          }
        }
      }
      if (!nzNe0(SLP[i]) && bosPermit) {
        setX2(bosLine.value, i);
        setLabelX(bosLabel.value, Math.trunc((x1Of(bosLine.value) + i) / 2));
      }
      const y = y1Of(bosLine.value);
      if (lt(b.close, y) && bosPermit) bosPermit = false;
      if (gt(b.close, y) && lt(b.low, y) && bosPermit) {
        bosPermit = false;
        const l = bosLine.value!;
        line.set_color(l, lqdyColor);
        line.set_style(l, 'dotted');
        const lb = bosLabel.value;
        if (lb) {
          label.set_text(lb, 'LQDT');
          label.set_textcolor(lb, cfg.colorLqdy);
        }
      }
    }

    // ---- Inducement block
    if (trend === UP) {
      if (nzNe0(ILP[i])) {
        idmPermit = true;
        if (cfg.showIdmt) {
          const lo = bars[i - inducementP].low;
          idmLine.value = line.new(i - inducementP, lo, i, lo, 'bar_index', 'none', idmtColor, 'dotted');
          idmLabel.value = label.new(Math.trunc((i - inducementP + i) / 2), lo - atr * 0.4, 'IDMT', 'bar_index', 'price',
            'transparent', 'label_center', cfg.colorIdmt, cfg.sizeIdmt);
        }
        if (idmPermit1 === true) {
          delLine(idmLine1);
          delLabel(idmLabel1);
        }
      }
      if (!nzNe0(ILP[i]) && idmPermit) {
        setX2(idmLine.value, i);
        setLabelX(idmLabel.value, Math.trunc((x1Of(idmLine.value) + i) / 2));
      }
      const y = y1Of(idmLine.value);
      if (cfg.idmtType === 'Total') {
        if (lt(b.low, y)) idmPermit = false;
      }
      if (cfg.idmtType === 'Sweeps') {
        if (lt(b.low, y) && gt(b.close, y)) idmPermit = false;
        if (lt(b.close, y)) {
          delLine(idmLine.value);
          delLabel(idmLabel.value);
        }
      }
    }
    if (trend === DOWN) {
      if (nzNe0(IHP[i])) {
        idmPermit = true;
        if (cfg.showIdmt) {
          const h = bars[i - inducementP].high;
          idmLine.value = line.new(i - inducementP, h, i, h, 'bar_index', 'none', idmtColor, 'dotted');
          idmLabel.value = label.new(Math.trunc((i - inducementP + i) / 2), h + atr * 0.1, 'IDMT', 'bar_index', 'price',
            'transparent', 'label_center', cfg.colorIdmt, cfg.sizeIdmt);
        }
        if (idmPermit1 === true) {
          delLine(idmLine1);
          delLabel(idmLabel1);
        }
      }
      if (!nzNe0(IHP[i]) && idmPermit) {
        setX2(idmLine.value, i);
        setLabelX(idmLabel.value, Math.trunc((x1Of(idmLine.value) + i) / 2));
      }
      const y = y1Of(idmLine.value);
      if (cfg.idmtType === 'Total') {
        if (gt(b.high, y)) idmPermit = false;
      }
      if (cfg.idmtType === 'Sweeps') {
        if (gt(b.high, y) && lt(b.close, y)) idmPermit = false;
        if (gt(b.close, y)) {
          delLine(idmLine.value);
          delLabel(idmLabel.value);
        }
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

export const MarketStructureInducementsIctChochBos = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
