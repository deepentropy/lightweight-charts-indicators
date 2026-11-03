/**
 * Master Pattern [LuxAlgo]
 *
 * Finds price contractions from swing pivots (pivots with "Contraction Detection Lookback" bars on each side): a
 * contraction starts when a pivot high is lower than the pivot high before it while the latest pivot low is higher
 * than the one before it. Its top is the latest pivot high and its bottom the latest pivot low. A bar whose high
 * (seen "Lookback" bars later) goes above the top makes a bullish pattern, a low below the bottom a bearish one.
 *
 * Drawings per pattern: a box over the contraction (from the later of the two pivots to the break bar) and a line
 * at the middle of the contraction (the "friction" level), which runs to the current bar until the next pattern.
 * A pattern becomes "major" when price later trades through the other side of its box: the box gets a border (or the
 * pattern is deleted when "Show Major Pattern" is off). Without "Show Minor Pattern" the area and the line only get
 * their colour once the pattern is major.
 *
 * Liquidity levels: dotted lines at pivots with "Liquidity Levels" bars on each side. A level runs to the current
 * bar until price trades through it; a new pivot ends the level before it on the pivot bar. At most 500 lines and
 * 500 boxes are kept.
 *
 * Reference: "Master Pattern [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, color, Series, line, box, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Box, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface MasterPatternInputs {
  /** Bars on each side of the contraction pivots */
  length: number;
  /** Bars on each side of the liquidity pivots */
  liqLength: number;
  showMajor: boolean;
  showMinor: boolean;
  bullCss: string;
  showBullBox: boolean;
  showBullLvl: boolean;
  bearCss: string;
  showBearBox: boolean;
  showBearLvl: boolean;
  showLiq: boolean;
  bullLiqCss: string;
  bearLiqCss: string;
}

export const defaultInputs: MasterPatternInputs = {
  length: 3,
  liqLength: 20,
  showMajor: true,
  showMinor: true,
  bullCss: '#00897B',
  showBullBox: true,
  showBullLvl: true,
  bearCss: '#FF5252',
  showBearBox: true,
  showBearLvl: true,
  showLiq: true,
  bullLiqCss: '#00897B',
  bearLiqCss: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Contraction Detection Lookback', defval: 3, min: 1 },
  { id: 'liqLength', type: 'int', title: 'Liquidity Levels', defval: 20, min: 1 },
  { id: 'showMajor', type: 'bool', title: 'Show Major Pattern', defval: true },
  { id: 'showMinor', type: 'bool', title: 'Show Minor Pattern', defval: true },
  { id: 'bullCss', type: 'color', title: 'Bullish Pattern', defval: '#00897B', inline: 'bull', group: 'Pattern Style' },
  { id: 'showBullBox', type: 'bool', title: 'Area', defval: true, inline: 'bull', group: 'Pattern Style' },
  { id: 'showBullLvl', type: 'bool', title: 'Line', defval: true, inline: 'bull', group: 'Pattern Style' },
  { id: 'bearCss', type: 'color', title: 'Bearish Pattern', defval: '#FF5252', inline: 'bear', group: 'Pattern Style' },
  { id: 'showBearBox', type: 'bool', title: 'Area', defval: true, inline: 'bear', group: 'Pattern Style' },
  { id: 'showBearLvl', type: 'bool', title: 'Line', defval: true, inline: 'bear', group: 'Pattern Style' },
  { id: 'showLiq', type: 'bool', title: 'Show Liquidity Levels', defval: true, group: 'Liquidity' },
  { id: 'bullLiqCss', type: 'color', title: 'Upper Liquidity', defval: '#00897B', group: 'Liquidity' },
  { id: 'bearLiqCss', type: 'color', title: 'Lower Liquidity', defval: '#FF5252', group: 'Liquidity' },
];

export const plotConfig: PlotConfig[] = [];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['line', 'box'];

export const metadata = {
  title: 'Master Pattern [LuxAlgo]',
  shortTitle: 'LuxAlgo - Master Pattern Indicator',
  overlay: true,
};

/** indicator(max_boxes_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** The user type `mp` (box area, line avg, bool breakup, bool breakdn); null fields are na */
interface Mp {
  area: Box | null;
  avg: Line | null;
  breakup: boolean;
  breakdn: boolean;
}

export function calculate(bars: Bar[], inputs: Partial<MasterPatternInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = Math.trunc(cfg.length);
  const liqLength = Math.trunc(cfg.liqLength);

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const phArr = ta.pivothigh(highS, length, length).toArray();
  const plArr = ta.pivotlow(lowS, length, length).toArray();
  const liqPhArr = ta.pivothigh(highS, liqLength, liqLength).toArray();
  const liqPlArr = ta.pivotlow(lowS, liqLength, liqLength).toArray();

  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS });

  // Contraction state (var)
  let phy = 0;
  let phx = 0;
  let pht = 0;
  let ply = 0;
  let plx = 0;
  let plt = 0;
  let top = NaN;
  let btm = NaN;
  // var mp master = mp.new(): the objects in its fields are not held by a `var` variable
  let master: Mp = { area: null, avg: null, breakup: false, breakdn: false };

  // Liquidity levels: `var line liqup`, `var line liqdn` hold their lines
  const liqup = varDrawing<Line>();
  const liqdn = varDrawing<Line>();
  let liqupReach = false;
  let liqdnReach = false;

  /** `if x` on a float in Pine v5: na and 0 are false */
  const truthy = (x: number) => !isNaN(x) && x !== 0;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const ph = phArr[i] ?? NaN;
    const pl = plArr[i] ?? NaN;

    if (truthy(ph)) {
      pht = Math.sign(ph - phy);
      phy = ph;
      if (pht === -1 && plt === 1) {
        top = ph;
        btm = ply;
        phx = i - length;
      }
    }
    if (truthy(pl)) {
      plt = Math.sign(pl - ply);
      ply = pl;
      if (pht === -1 && plt === 1) {
        top = phy;
        btm = pl;
        plx = i - length;
      }
    }

    // Detect master pattern
    const highBack = i >= length ? bars[i - length].high : NaN;
    const lowBack = i >= length ? bars[i - length].low : NaN;
    const isbull = gt(highBack, top) && gt(top, btm);
    const isbear = lt(lowBack, btm) && gt(top, btm);

    if (isbull || isbear) {
      const css = isbull ? cfg.bullCss : cfg.bearCss;
      if (master.avg) line.set_x2(master.avg, i - length);
      const val = (top + btm) / 2;
      const area = (isbull && cfg.showBullBox) || (isbear && cfg.showBearBox)
        ? box.new(Math.max(phx, plx), top, i - length, btm, 'transparent', undefined, undefined, undefined, undefined,
          cfg.showMinor ? String(color.new(css, 50)) : 'transparent')
        : null;
      const avg = (isbull && cfg.showBullLvl) || (isbear && cfg.showBearLvl)
        ? line.new(i - length, val, i, val, undefined, undefined, cfg.showMinor ? css : 'transparent')
        : null;
      master = { area, avg, breakup: isbull, breakdn: isbear };
      top = NaN;
      btm = NaN;
    }

    // Determine if the pattern switches to major
    if (master.breakup) {
      if (master.area && lt(b.low, box.get_bottom(master.area))) {
        if (!cfg.showMajor) {
          box.delete(master.area);
          if (master.avg) line.delete(master.avg);
        } else {
          box.set_border_color(master.area, cfg.bullCss);
          if (!cfg.showMinor) {
            box.set_bgcolor(master.area, String(color.new(cfg.bullCss, 50)));
            if (master.avg) line.set_color(master.avg, cfg.bullCss);
          }
        }
      }
    } else if (master.breakdn) {
      if (master.area && gt(b.high, box.get_top(master.area))) {
        if (!cfg.showMajor) {
          box.delete(master.area);
          if (master.avg) line.delete(master.avg);
        } else {
          box.set_border_color(master.area, cfg.bearCss);
          if (!cfg.showMinor) {
            box.set_bgcolor(master.area, String(color.new(cfg.bearCss, 50)));
            if (master.avg) line.set_color(master.avg, cfg.bearCss);
          }
        }
      }
    }

    // Friction level x2 to the current bar
    if (master.avg) line.set_x2(master.avg, i);

    // Upper liquidity
    const liqph = liqPhArr[i] ?? NaN;
    if (truthy(liqph) && cfg.showLiq) {
      if (!liqupReach && liqup.value) line.set_x2(liqup.value, i - liqLength);
      liqup.value = line.new(i - liqLength, liqph, i, liqph, undefined, undefined, cfg.bullLiqCss, 'dotted');
      liqupReach = false;
    } else if (!liqupReach && cfg.showLiq && liqup.value) {
      line.set_x2(liqup.value, i);
      if (gt(b.high, line.get_y1(liqup.value))) liqupReach = true;
    }

    // Lower liquidity
    const liqpl = liqPlArr[i] ?? NaN;
    if (truthy(liqpl) && cfg.showLiq) {
      if (!liqdnReach && liqdn.value) line.set_x2(liqdn.value, i - liqLength);
      liqdn.value = line.new(i - liqLength, liqpl, i, liqpl, undefined, undefined, cfg.bearLiqCss, 'dotted');
      liqdnReach = false;
    } else if (!liqdnReach && cfg.showLiq && liqdn.value) {
      line.set_x2(liqdn.value, i);
      if (lt(b.low, line.get_y1(liqdn.value))) liqdnReach = true;
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const MasterPattern = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
