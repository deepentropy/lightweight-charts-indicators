/**
 * Multi ZigZag Harmonic Patterns
 *
 * Four zig-zags (lengths 5, 10, 15, 20 by default): a bar whose high is the highest high of the last `length` bars is
 * a high pivot, a bar whose low is the lowest low a low pivot (a bar that is both keeps the direction before). A new
 * pivot in the same direction replaces the last one unless the last one goes further. A pivot beyond the pivot two
 * back has a direction of +-2, else +-1. The last `max_pivot_size` pivots are kept per zig-zag.
 *
 * On every bar each zig-zag tests its pivots Y, X, A, B, C, D (with "waitForConfirmation" the latest pivot is left
 * out) against the ratios of the harmonic patterns: Gartley, Crab, Deep Crab, Bat, Butterfly, Shark, Cypher (only
 * when B lies between the highest and lowest of X..D; otherwise these flags keep their previous values), 3 Drives,
 * 5-0, ABCD, AB=CD, ABCD Extension (within `errorPercent` %) and Double Top / Bottom (risk below "Max Risk Per
 * Reward" % of risk + reward). A harmonic pattern draws the lines XA, AB, BC, CD, XB, BD, XD and AC, an ABCD pattern
 * AB, BC and CD, a double top / bottom BD, in the zig-zag colour, and a label at D lists the pattern names (green
 * below for a bullish pattern, red above for a bearish one). While the pivots stay the same, the drawing of the bar
 * before is deleted and drawn again. At most 500 lines and 500 labels are kept.
 *
 * Alert (alertcondition, `alerts` of the result): a new pattern on any of the four zig-zags.
 * The statistics table of the original is off (a constant `showStatTable = false`): its empty table is returned.
 *
 * Reference: "Multi ZigZag Harmonic Patterns" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HeWhoMustNotBeNamed
 */

import {
  ta, line, label, table, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface MultiZigzagHarmonicPatternsInputs {
  /** Pivots kept per zig-zag */
  max_pivot_size: number;
  showZigZag1: boolean;
  zigzag1Length: number;
  zigzag1Color: string;
  showZigZag2: boolean;
  zigzag2Length: number;
  zigzag2Color: string;
  showZigZag3: boolean;
  zigzag3Length: number;
  zigzag3Color: string;
  showZigZag4: boolean;
  zigzag4Length: number;
  zigzag4Color: string;
  abcdClassic: boolean;
  abEQcd: boolean;
  abcdExt: boolean;
  gartley: boolean;
  crab: boolean;
  deepCrab: boolean;
  bat: boolean;
  butterfly: boolean;
  shark: boolean;
  cypher: boolean;
  threeDrives: boolean;
  fiveZero: boolean;
  doubleBottomTop: boolean;
  /** Tolerance of the ratios, in % */
  errorPercent: number;
  /** Largest risk of a double top / bottom, in % of risk + reward */
  MaxRiskPerReward: number;
  /** Leave the latest (unconfirmed) pivot out of the patterns */
  waitForConfirmation: boolean;
  bullishColor: string;
  bearishColor: string;
}

export const defaultInputs: MultiZigzagHarmonicPatternsInputs = {
  max_pivot_size: 100,
  showZigZag1: true,
  zigzag1Length: 5,
  zigzag1Color: '#00897B',
  showZigZag2: true,
  zigzag2Length: 10,
  zigzag2Color: '#808000',
  showZigZag3: true,
  zigzag3Length: 15,
  zigzag3Color: '#00E676',
  showZigZag4: true,
  zigzag4Length: 20,
  zigzag4Color: '#E040FB',
  abcdClassic: true,
  abEQcd: true,
  abcdExt: true,
  gartley: true,
  crab: true,
  deepCrab: true,
  bat: true,
  butterfly: true,
  shark: true,
  cypher: true,
  threeDrives: true,
  fiveZero: true,
  doubleBottomTop: true,
  errorPercent: 10,
  MaxRiskPerReward: 30,
  waitForConfirmation: true,
  bullishColor: '#4CAF50',
  bearishColor: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'max_pivot_size', type: 'int', title: 'max_pivot_size', defval: 100, step: 10 },
  { id: 'showZigZag1', type: 'bool', title: 'showZigZag1', defval: true },
  { id: 'zigzag1Length', type: 'int', title: 'zigzag1Length', defval: 5, min: 1, step: 5 },
  { id: 'zigzag1Color', type: 'color', title: 'zigzag1Color', defval: '#00897B' },
  { id: 'showZigZag2', type: 'bool', title: 'showZigZag2', defval: true },
  { id: 'zigzag2Length', type: 'int', title: 'zigzag2Length', defval: 10, min: 1, step: 5 },
  { id: 'zigzag2Color', type: 'color', title: 'zigzag2Color', defval: '#808000' },
  { id: 'showZigZag3', type: 'bool', title: 'showZigZag3', defval: true },
  { id: 'zigzag3Length', type: 'int', title: 'zigzag3Length', defval: 15, min: 1, step: 5 },
  { id: 'zigzag3Color', type: 'color', title: 'zigzag3Color', defval: '#00E676' },
  { id: 'showZigZag4', type: 'bool', title: 'showZigZag4', defval: true },
  { id: 'zigzag4Length', type: 'int', title: 'zigzag4Length', defval: 20, min: 1, step: 5 },
  { id: 'zigzag4Color', type: 'color', title: 'zigzag4Color', defval: '#E040FB' },
  { id: 'abcdClassic', type: 'bool', title: 'abcdClassic', defval: true },
  { id: 'abEQcd', type: 'bool', title: 'abEQcd', defval: true },
  { id: 'abcdExt', type: 'bool', title: 'abcdExt', defval: true },
  { id: 'gartley', type: 'bool', title: 'gartley', defval: true },
  { id: 'crab', type: 'bool', title: 'crab', defval: true },
  { id: 'deepCrab', type: 'bool', title: 'deepCrab', defval: true },
  { id: 'bat', type: 'bool', title: 'bat', defval: true },
  { id: 'butterfly', type: 'bool', title: 'butterfly', defval: true },
  { id: 'shark', type: 'bool', title: 'shark', defval: true },
  { id: 'cypher', type: 'bool', title: 'cypher', defval: true },
  { id: 'threeDrives', type: 'bool', title: 'threeDrives', defval: true },
  { id: 'fiveZero', type: 'bool', title: 'fiveZero', defval: true },
  { id: 'doubleBottomTop', type: 'bool', title: 'doubleBottomTop', defval: true },
  { id: 'errorPercent', type: 'int', title: 'errorPercent', defval: 10, min: 5, max: 20, step: 5 },
  { id: 'MaxRiskPerReward', type: 'int', title: 'Max Risk Per Reward (Double Top/Bottom)', defval: 30, min: 0, step: 10 },
  { id: 'waitForConfirmation', type: 'bool', title: 'waitForConfirmation', defval: true },
  { id: 'bullishColor', type: 'color', title: 'bullishColor', defval: '#4CAF50' },
  { id: 'bearishColor', type: 'color', title: 'bearishColor', defval: '#FF5252' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New harmonic pattern alert', message: 'New harmonic pattern detected on {{ticker}}' },
];

export const metadata = {
  title: 'Multi ZigZag Harmonic Patterns',
  shortTitle: 'MZigZag - HP',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
/** Pine v5 color.black */
const BLACK = '#363A45';

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** A float used as a bool before v6: na and 0 are false */
const truthy = (x: number) => !Number.isNaN(x) && x !== 0;

const NAMES: [index: number, text: string][] = [
  [0, 'Gartley'], [1, 'Crab'], [2, 'Deep Crab'], [3, 'Bat'], [4, 'Butterfly'], [5, 'Shark'], [6, 'Cypher'],
  [7, '3 Drive'], [8, '5-0'], [9, 'ABCD'], [10, 'AB=CD'], [11, 'ABCD Extension'],
];

export function calculate(
  bars: Bar[],
  inputs: Partial<MultiZigzagHarmonicPatternsInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { bullishColor, bearishColor } = cfg;
  // err_min = (100 - errorPercent) / 100 (a float division with an input int)
  const errMin = (100 - cfg.errorPercent) / 100;
  const errMax = (100 + cfg.errorPercent) / 100;
  const start = cfg.waitForConfirmation ? 1 : 0;
  const highs = new Series(bars, (b) => b.high);
  const lows = new Series(bars, (b) => b.low);
  // ratio within [lo * err_min, hi * err_max]
  const within = (r: number, lo: number, hi: number) => ge(r, lo * errMin) && le(r, hi * errMax);

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });

  /** One zig-zag with its pattern state (the var arrays of one call of zigzag() / detect_harmonic_pattern()) */
  const zigzag = (length: number, show: boolean, zzColor: string) => {
    const hb = ta.highestbars(highs, length).toArray();
    const lb = ta.lowestbars(lows, length).toArray();
    const pivots: number[] = [];
    const pivotBars: number[] = [];
    const pivotDirs: number[] = [];
    const wmLines: (Line | null)[] = new Array(8).fill(null);
    let wmLabel: Label | null = null;
    const wmLabels: boolean[] = new Array(13).fill(false);
    let dirPrev = NaN;
    // wm_pattern[1], abcd_pattern[1], double_pattern[1]; x[1], a[1], b[1], c[1] (the if block runs on every bar
    // once it has started)
    let wmPrev = false, abcdPrev = false, doublePrev = false;
    let xPrev = NaN, aPrev = NaN, bPrev = NaN, cPrev = NaN;

    const pivotStep = (i: number) => {
      // pivots(length)
      const bar = bars[i];
      const phigh = hb[i] === 0 ? bar.high : NaN;
      const plow = lb[i] === 0 ? bar.low : NaN;
      const iff1 = truthy(plow) && Number.isNaN(phigh) ? -1 : dirPrev;
      const dir = truthy(phigh) && Number.isNaN(plow) ? 1 : iff1;
      // dirchanged = ta.change(dir); `not dirchanged` is true for 0 and na
      const dirchanged = truthy(dir - dirPrev);
      dirPrev = dir;
      if (truthy(phigh) || truthy(plow)) {
        let value = eq(dir, 1) ? phigh : plow;
        let pivotBar = i;
        let newDir = dir;
        if (!dirchanged && pivots.length >= 1) {
          const pivot = pivots.shift()!;
          const pbar = pivotBars.shift()!;
          const pdir = pivotDirs.shift()!;
          const useNewValues = lt(value * pdir, pivot * pdir);
          value = useNewValues ? pivot : value;
          pivotBar = useNewValues ? pbar : pivotBar;
        }
        if (pivots.length >= 2) {
          const lastPoint = pivots[1];
          newDir = gt(dir * value, dir * lastPoint) ? dir * 2 : dir;
        }
        pivots.unshift(value);
        pivotBars.unshift(pivotBar);
        pivotDirs.unshift(newDir);
        if (pivots.length > cfg.max_pivot_size) {
          pivots.pop();
          pivotBars.pop();
          pivotDirs.pop();
        }
      }
    };

    const harmonicLabel = (dir: number, price: number, bar: number): Label => {
      const isDoubleTop = wmLabels[12] && dir < 0;
      const isDoubleBottom = wmLabels[12] && dir > 0;
      let text = '';
      const add = (on: boolean, name: string) => { if (on) text += (text === '' ? '' : '\n') + name; };
      for (const [k, name] of NAMES) add(wmLabels[k], name);
      add(isDoubleTop, 'Double Top');
      add(isDoubleBottom, 'Double Bottom');
      return label.new(bar, price, text, 'bar_index', 'price', dir > 0 ? bullishColor : bearishColor,
        dir < 1 ? 'label_down' : 'label_up', BLACK, 'normal');
    };

    const newLine = (y1: number, y2: number, x1: number, x2: number) =>
      line.new(x1, y1, x2, y2, 'bar_index', 'none', zzColor, 'solid', 1);
    const del = (k: number) => { const l = wmLines[k]; if (l) line.delete(l); };
    const delLabel = () => { if (wmLabel) label.delete(wmLabel); };

    /** detect_harmonic_pattern(): true when a pattern starts on this bar */
    const detect = (): boolean => {
      let wm = false, abcd = false, dbl = false;
      if (pivots.length >= 6 + start && show) {
        const d = pivots[start], dBar = pivotBars[start], dDir = pivotDirs[start];
        const c = pivots[start + 1], cBar = pivotBars[start + 1], cDir = pivotDirs[start + 1];
        const b = pivots[start + 2], bBar = pivotBars[start + 2], bDir = pivotDirs[start + 2];
        const a = pivots[start + 3], aBar = pivotBars[start + 3];
        const x = pivots[start + 4], xBar = pivotBars[start + 4];
        const y = pivots[start + 5];

        const highPoint = Math.max(x, a, b, c, d);
        const lowPoint = Math.min(x, a, b, c, d);
        const dir = gt(c, d) ? 1 : -1;

        const xabRatio = Math.abs(b - a) / Math.abs(x - a);
        const abcRatio = Math.abs(c - b) / Math.abs(a - b);
        const bcdRatio = Math.abs(d - c) / Math.abs(b - c);
        const xadRatio = Math.abs(d - a) / Math.abs(x - a);
        const yxaRatio = Math.abs(a - x) / Math.abs(y - x);

        const abTime = Math.abs(aBar - bBar);
        const cdTime = Math.abs(cBar - dBar);
        const abPrice = Math.abs(a - b);
        const cdPrice = Math.abs(c - d);
        const timeRatio = cdTime / abTime;
        const priceRatio = cdPrice / abPrice;
        const abcdDirection = lt(a, b) && lt(a, c) && lt(c, b) && lt(c, d) && lt(a, d) && lt(b, d) ? 1
          : gt(a, b) && gt(a, c) && gt(c, b) && gt(c, d) && gt(a, d) && gt(b, d) ? -1 : 0;

        const risk = Math.abs(b - d);
        const reward = Math.abs(c - d);
        const riskPerReward = (risk * 100) / (risk + reward);

        const flag = (k: number, on: boolean, harmonic: boolean) => {
          if (on) {
            if (harmonic) wm = true;
            else abcd = true;
          }
          wmLabels[k] = on;
        };

        if (lt(b, highPoint) && gt(b, lowPoint)) {
          flag(0, cfg.gartley && within(xabRatio, 0.618, 0.618) && within(abcRatio, 0.382, 0.886)
            && (within(bcdRatio, 1.272, 1.618) || within(xadRatio, 0.786, 0.786)), true);
          flag(1, cfg.crab && within(xabRatio, 0.382, 0.618) && within(abcRatio, 0.382, 0.886)
            && (within(bcdRatio, 2.24, 3.618) || within(xadRatio, 1.618, 1.618)), true);
          flag(2, cfg.deepCrab && within(xabRatio, 0.886, 0.886) && within(abcRatio, 0.382, 0.886)
            && (within(bcdRatio, 2.0, 3.618) || within(xadRatio, 1.618, 1.618)), true);
          flag(3, cfg.bat && within(xabRatio, 0.382, 0.5) && within(abcRatio, 0.382, 0.886)
            && (within(bcdRatio, 1.618, 2.618) || within(xadRatio, 0.886, 0.886)), true);
          flag(4, cfg.butterfly && within(xabRatio, 0.786, 0.786) && within(abcRatio, 0.382, 0.886)
            && (within(bcdRatio, 1.618, 2.618) || within(xadRatio, 1.272, 1.618)), true);
          flag(5, cfg.shark && within(abcRatio, 1.13, 1.618) && within(bcdRatio, 1.618, 2.24)
            && within(xadRatio, 0.886, 1.13), true);
          flag(6, cfg.cypher && within(xabRatio, 0.382, 0.618) && within(abcRatio, 1.13, 1.414)
            && (within(bcdRatio, 1.272, 2.0) || within(xadRatio, 0.786, 0.786)), true);
        }
        flag(7, cfg.threeDrives && within(yxaRatio, 0.618, 0.618) && within(xabRatio, 1.27, 1.618)
          && within(abcRatio, 0.618, 0.618) && within(bcdRatio, 1.27, 1.618), true);
        flag(8, cfg.fiveZero && within(xabRatio, 1.13, 1.618) && within(abcRatio, 1.618, 2.24)
          && within(bcdRatio, 0.5, 0.5), true);
        flag(9, cfg.abcdClassic && within(abcRatio, 0.618, 0.786) && within(bcdRatio, 1.272, 1.618)
          && abcdDirection !== 0, false);
        flag(10, cfg.abEQcd && within(timeRatio, 1, 1) && within(priceRatio, 1, 1) && abcdDirection !== 0, false);
        flag(11, cfg.abcdExt && within(priceRatio, 1.272, 1.618) && within(abcRatio, 0.618, 0.786)
          && abcdDirection !== 0, false);
        const isDouble = cfg.doubleBottomTop
          && ((dDir === 1 && bDir === 2 && cDir === -1) || (dDir === -1 && bDir === -2 && cDir === 1))
          && lt(riskPerReward, cfg.MaxRiskPerReward);
        if (isDouble) dbl = true;
        wmLabels[12] = isDouble;

        if (wmPrev && eq(x, xPrev) && eq(a, aPrev) && eq(b, bPrev) && eq(c, cPrev)) {
          for (let k = 0; k < 8; k++) del(k);
          delLabel();
        }
        if (abcdPrev && eq(a, aPrev) && eq(b, bPrev) && eq(c, cPrev)) {
          del(1);
          del(2);
          del(3);
          delLabel();
        }
        if (doublePrev && eq(a, aPrev) && eq(b, bPrev) && eq(c, cPrev)) {
          del(5);
          delLabel();
        }

        if (wm) {
          wmLines[0] = newLine(x, a, xBar, aBar);
          wmLines[1] = newLine(a, b, aBar, bBar);
          wmLines[2] = newLine(b, c, bBar, cBar);
          wmLines[3] = newLine(c, d, cBar, dBar);
          wmLines[4] = newLine(x, b, xBar, bBar);
          wmLines[5] = newLine(b, d, bBar, dBar);
          wmLines[6] = newLine(x, d, xBar, dBar);
          wmLines[7] = newLine(a, c, aBar, cBar);
        }
        if (abcd && !wm) {
          wmLines[1] = newLine(a, b, aBar, bBar);
          wmLines[2] = newLine(b, c, bBar, cBar);
          wmLines[3] = newLine(c, d, cBar, dBar);
        }
        if (dbl && !wm) {
          wmLines[5] = newLine(b, d, bBar, dBar);
        }
        if (wm || abcd || dbl) wmLabel = harmonicLabel(dir, d, dBar);

        xPrev = x;
        aPrev = a;
        bPrev = b;
        cPrev = c;
      }
      const pattern = (wm && !wmPrev) || (abcd && !abcdPrev) || (dbl && !doublePrev);
      wmPrev = wm;
      abcdPrev = abcd;
      doublePrev = dbl;
      return pattern;
    };

    return { pivotStep, detect };
  };

  const zigzags = [
    zigzag(cfg.zigzag1Length, cfg.showZigZag1, cfg.zigzag1Color),
    zigzag(cfg.zigzag2Length, cfg.showZigZag2, cfg.zigzag2Color),
    zigzag(cfg.zigzag3Length, cfg.showZigZag3, cfg.zigzag3Color),
    zigzag(cfg.zigzag4Length, cfg.showZigZag4, cfg.zigzag4Color),
  ];

  const alert: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    for (const z of zigzags) z.pivotStep(i);
    let any = false;
    for (const z of zigzags) if (z.detect()) any = true;
    alert[i] = any;
    // var stats = table.new(position.top_right, 8, max_pivot_size + 2, border_width = 1); showStatTable is false
    if (i === 0) table.new('top_right', 8, cfg.max_pivot_size + 2, undefined, undefined, undefined, undefined, 1);
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, [alert]),
  };
}

export const MultiZigzagHarmonicPatterns = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
};
