/**
 * kNN Market Architecture [LuxAlgo]
 *
 * Market structure on three terms. The short-term pivot length is round((11 - sensitivity) * m), at least 3, where
 * m = 1 or, with "Auto-Adjust Sensitivity", (EMA 50 of ATR 200 / SMA 200 of ATR 200) ^ 1.5; the medium term uses 3
 * times that length and the long term 9 times. Each pivot (same number of bars on each side) is scored with a
 * k-nearest-neighbours vote over the last 100 pivots of its side (features: ATR 14 and volume relative to their
 * SMA 100 on the pivot bar). Every stored pivot has a score of 1, so the score is 1 once more than k pivots are
 * stored and 0.5 before: a pivot is kept when that score is at least "Confidence Threshold".
 *
 * A kept pivot draws an icon label (offset by "Label Offset Multiplier" ATR 14) and starts a level line of its term
 * (solid LT, dashed MT, dotted ST) that follows the bars until a close goes beyond it: then the line stops there and a
 * "<term> BOS" label marks its middle. The term of "Bias Source" (Auto: the longest term shown) also gets a "Delta
 * Tank" label at its newest high and low level: the up-minus-down volume since that pivot as a part of the total
 * volume (10 blocks and a percentage), deleted at the break. The candles are coloured by the close within the last
 * high / low of that term (gradient red - grey - green, full colours beyond the levels). On the last bar a volume
 * profile of the closes between the two levels (at most 500 bars, from the older of the two Delta Tank pivots) is
 * drawn right of the last bar with three boxes per row, and a dashboard shows the term and the bias.
 *
 * At most 500 lines, 500 labels and 500 boxes are kept.
 *
 * Reference: "kNN Market Architecture [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, Series, line, label, box, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type Line, type Label, type IndicatorResult, type InputConfig, type PlotConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

type SizeName = 'Tiny' | 'Small' | 'Normal' | 'Large';
type BosSize = 'None' | SizeName;
type Term = 'ST' | 'MT' | 'LT';

export interface KnnMarketArchitectureInputs {
  /** Structure Sensitivity (1 to 10): a higher value gives shorter pivots */
  sensitivityInput: number;
  /** Scale the pivot length with the volatility */
  autoSensitivity: boolean;
  /** k of the nearest-neighbours vote */
  knnKInput: number;
  /** Minimum score of a pivot */
  minConfidence: number;
  showST: boolean;
  showMT: boolean;
  showLT: boolean;
  colorCandlesInput: boolean;
  biasSourceInput: 'Auto' | 'LT' | 'MT' | 'ST' | 'None';
  infoLabelSize: SizeName;
  showDeltaTankInput: boolean;
  stLabelsInput: boolean;
  stLabelInput: string;
  stSizeInput: SizeName;
  stBOSInput: BosSize;
  mtLabelsInput: boolean;
  mtLabelInput: string;
  mtSizeInput: SizeName;
  mtBOSInput: BosSize;
  ltLabelsInput: boolean;
  ltLabelInput: string;
  ltSizeInput: SizeName;
  ltBOSInput: BosSize;
  /** Icon distance from the pivot, in ATR 14 */
  offsetMultiplier: number;
  showVP: boolean;
  vpRows: number;
  /** Width of the largest row, in bars */
  vpWidth: number;
  /** Bars between the last bar and the right edge of the profile */
  vpOffset: number;
  showDashboard: boolean;
}

export const defaultInputs: KnnMarketArchitectureInputs = {
  sensitivityInput: 5,
  autoSensitivity: true,
  knnKInput: 5,
  minConfidence: 0.4,
  showST: true,
  showMT: true,
  showLT: true,
  colorCandlesInput: true,
  biasSourceInput: 'Auto',
  infoLabelSize: 'Small',
  showDeltaTankInput: true,
  stLabelsInput: true,
  stLabelInput: '•',
  stSizeInput: 'Tiny',
  stBOSInput: 'Tiny',
  mtLabelsInput: false,
  mtLabelInput: '•',
  mtSizeInput: 'Small',
  mtBOSInput: 'None',
  ltLabelsInput: true,
  ltLabelInput: '●',
  ltSizeInput: 'Normal',
  ltBOSInput: 'Normal',
  offsetMultiplier: 0.8,
  showVP: true,
  vpRows: 30,
  vpWidth: 50,
  vpOffset: 50,
  showDashboard: true,
};

const SIZES: SizeName[] = ['Tiny', 'Small', 'Normal', 'Large'];
const BOS_SIZES: BosSize[] = ['None', 'Tiny', 'Small', 'Normal', 'Large'];
const VH = 'Visual Hierarchy';

export const inputConfig: InputConfig[] = [
  { id: 'sensitivityInput', type: 'int', title: 'Structure Sensitivity', defval: 5, min: 1, max: 10, group: 'Dynamic Engine' },
  { id: 'autoSensitivity', type: 'bool', title: 'Auto-Adjust Sensitivity', defval: true, group: 'Dynamic Engine' },
  { id: 'knnKInput', type: 'int', title: 'k-Nearest Neighbors', defval: 5, min: 1, max: 20, group: 'kNN Classifier' },
  { id: 'minConfidence', type: 'float', title: 'Confidence Threshold', defval: 0.4, min: 0, max: 1, step: 0.1, group: 'kNN Classifier' },
  { id: 'showST', type: 'bool', title: 'Short-Term Lines (ST)', defval: true, group: VH },
  { id: 'showMT', type: 'bool', title: 'Medium-Term Lines (MT)', defval: true, group: VH },
  { id: 'showLT', type: 'bool', title: 'Long-Term Lines (LT)', defval: true, group: VH },
  { id: 'colorCandlesInput', type: 'bool', title: 'Color Candles by Bias', defval: true, group: VH },
  { id: 'biasSourceInput', type: 'string', title: 'Bias Source', defval: 'Auto', options: ['Auto', 'LT', 'MT', 'ST', 'None'], group: VH },
  { id: 'infoLabelSize', type: 'string', title: 'Info Label Size', defval: 'Small', options: SIZES, group: VH },
  { id: 'showDeltaTankInput', type: 'bool', title: 'Show Delta Tank', defval: true, group: VH },
  { id: 'stLabelsInput', type: 'bool', title: 'Show ST Icons', defval: true, inline: 'ST', group: VH },
  { id: 'stLabelInput', type: 'string', title: 'Icon', defval: '•', inline: 'ST', group: VH },
  { id: 'stSizeInput', type: 'string', title: 'Size', defval: 'Tiny', options: SIZES, inline: 'ST', group: VH },
  { id: 'stBOSInput', type: 'string', title: 'ST BOS Size', defval: 'Tiny', options: BOS_SIZES, group: VH },
  { id: 'mtLabelsInput', type: 'bool', title: 'Show MT Icons', defval: false, inline: 'MT', group: VH },
  { id: 'mtLabelInput', type: 'string', title: 'Icon', defval: '•', inline: 'MT', group: VH },
  { id: 'mtSizeInput', type: 'string', title: 'Size', defval: 'Small', options: SIZES, inline: 'MT', group: VH },
  { id: 'mtBOSInput', type: 'string', title: 'MT BOS Size', defval: 'None', options: BOS_SIZES, group: VH },
  { id: 'ltLabelsInput', type: 'bool', title: 'Show LT Icons', defval: true, inline: 'LT', group: VH },
  { id: 'ltLabelInput', type: 'string', title: 'Icon', defval: '●', inline: 'LT', group: VH },
  { id: 'ltSizeInput', type: 'string', title: 'Size', defval: 'Normal', options: SIZES, inline: 'LT', group: VH },
  { id: 'ltBOSInput', type: 'string', title: 'LT BOS Size', defval: 'Normal', options: BOS_SIZES, group: VH },
  { id: 'offsetMultiplier', type: 'float', title: 'Label Offset Multiplier', defval: 0.8, min: 0, max: 5, step: 0.1, group: VH },
  { id: 'showVP', type: 'bool', title: 'Show Volume Profile', defval: true, group: 'Volume Profile' },
  { id: 'vpRows', type: 'int', title: 'Profile Rows', defval: 30, min: 10, max: 100, group: 'Volume Profile' },
  { id: 'vpWidth', type: 'int', title: 'Profile Width (%)', defval: 50, min: 10, max: 100, group: 'Volume Profile' },
  { id: 'vpOffset', type: 'int', title: 'Profile Offset', defval: 50, min: 0, max: 500, group: 'Volume Profile' },
  { id: 'showDashboard', type: 'bool', title: 'Dashboard', defval: true, group: 'Dashboard' },
];

export const plotConfig: PlotConfig[] = [];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['label', 'line', 'box', 'table'];

export const metadata = {
  title: 'kNN Market Architecture [LuxAlgo]',
  shortTitle: 'LuxAlgo - kNN Market Architecture',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;
const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const NEUTRAL_COLOR = '#787b86';
const WHITE = '#FFFFFF';
const DATA = '#DBDBDB';
const HEADERS = '#808080';
const BACKGROUND = '#161616';
const BORDERS = '#2E2E2E';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const nz = (x: number, y = 0) => (Number.isNaN(x) ? y : x);
const size = (s: string) => (({ Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large' } as Record<string, string>)[s] ?? 'small');

interface StructurePoint { feat1: number; feat2: number; score: number }
interface LineMetadata { startBar: number; infoLabel: Label; cumVol: number; cumDelta: number }

/** f_knn_score(): mean score of the k nearest stored points (0.5 while k or fewer are stored) */
function knnScore(current: StructurePoint, history: StructurePoint[], k: number): number {
  if (!(history.length > k)) return 0.5;
  const distances = history.map((p) => Math.abs(current.feat1 - p.feat1) + Math.abs(current.feat2 - p.feat2));
  const ranks = history.map((_, i) => i);
  for (let i = 0; i <= k - 1; i++) {
    for (let j = i + 1; j <= history.length - 1; j++) {
      if (lt(distances[ranks[j]], distances[ranks[i]])) {
        const temp = ranks[i];
        ranks[i] = ranks[j];
        ranks[j] = temp;
      }
    }
  }
  let sumScore = 0;
  for (let i = 0; i <= k - 1; i++) sumScore += history[ranks[i]].score;
  return sumScore / k;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KnnMarketArchitectureInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);

  // Dynamic detection engine
  const atr = ta.atr(bars, 200).toArray().map((v) => v ?? NaN);
  const avgAtr = ta.sma(Series.fromArray(bars, atr), 200).toArray().map((v) => v ?? NaN);
  const volRatio = atr.map((a, i) => a / nz(avgAtr[i], a));
  const smoothedRatio = ta.ema(Series.fromArray(bars, volRatio), 50).toArray().map((v) => v ?? NaN);
  const baseLen = smoothedRatio.map((s) => {
    const dynamicMultiplier = cfg.autoSensitivity ? Math.pow(nz(s, 1.0), 1.5) : 1.0;
    return Math.max(3, Math.round((11 - cfg.sensitivityInput) * dynamicMultiplier));
  });
  const mtLen = baseLen.map((l) => l * 3);
  const ltLen = mtLen.map((l) => l * 3);

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const pivots = (len: number[]) => {
    const L = Series.fromArray(bars, len);
    return [
      ta.pivothigh(highS, L, L).toArray().map((v) => v ?? NaN),
      ta.pivotlow(lowS, L, L).toArray().map((v) => v ?? NaN),
    ];
  };

  const smaVol = ta.sma(Series.fromArray(bars, volume), 100).toArray().map((v) => v ?? NaN);
  const relVol = volume.map((v, i) => v / smaVol[i]);
  const atr14 = ta.atr(bars, 14).toArray().map((v) => v ?? NaN);
  const smaAtr14 = ta.sma(Series.fromArray(bars, atr14), 100).toArray().map((v) => v ?? NaN);
  const relATR = atr14.map((a, i) => a / smaAtr14[i]);

  const activeTerm = cfg.biasSourceInput === 'None' ? '' : cfg.biasSourceInput !== 'Auto' ? cfg.biasSourceInput
    : cfg.showLT ? 'LT' : cfg.showMT ? 'MT' : cfg.showST ? 'ST' : '';
  const parsedLabelSize = size(cfg.infoLabelSize);

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });

  // var StructurePoint histories, var lines and var last levels per term
  const terms = ([['ST', baseLen], ['MT', mtLen], ['LT', ltLen]] as [Term, number[]][]).map(([term, len]) => {
    const [ph, pl] = pivots(len);
    return {
      term, len, ph, pl,
      hHigh: [] as StructurePoint[],
      hLow: [] as StructurePoint[],
      activeH: varDrawing<Line>(),
      activeL: varDrawing<Line>(),
      lastHigh: NaN,
      lastLow: NaN,
      showLines: term === 'LT' ? cfg.showLT : term === 'MT' ? cfg.showMT : cfg.showST,
      showLabels: term === 'LT' ? cfg.ltLabelsInput : term === 'MT' ? cfg.mtLabelsInput : cfg.stLabelsInput,
      iconSize: size(term === 'LT' ? cfg.ltSizeInput : term === 'MT' ? cfg.mtSizeInput : cfg.stSizeInput),
      icon: term === 'LT' ? cfg.ltLabelInput : term === 'MT' ? cfg.mtLabelInput : cfg.stLabelInput,
      lStyle: (term === 'LT' ? 'solid' : term === 'MT' ? 'dashed' : 'dotted') as 'solid' | 'dashed' | 'dotted',
      bos: term === 'LT' ? cfg.ltBOSInput : term === 'MT' ? cfg.mtBOSInput : cfg.stBOSInput,
    };
  });
  let activeMetaHigh: LineMetadata | null = null;
  let activeMetaLow: LineMetadata | null = null;
  const barColors: BarColorData[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const visualOffset = atr14[i] * cfg.offsetMultiplier;

    for (const t of terms) {
      const len = t.len[i];
      const ph = t.ph[i];
      const pl = t.pl[i];
      // f_process_term()
      let phTriggered = false;
      let plTriggered = false;
      const point = (): StructurePoint => ({
        feat1: i - len >= 0 ? relATR[i - len] : NaN, feat2: i - len >= 0 ? relVol[i - len] : NaN, score: 1.0,
      });
      if (!Number.isNaN(ph)) {
        const current = point();
        if (ge(knnScore(current, t.hHigh, cfg.knnKInput), cfg.minConfidence)) {
          if (t.showLabels) {
            label.new(i - len, ph + visualOffset, t.icon, 'bar_index', 'price', undefined, 'none', BULL_COLOR, t.iconSize);
          }
          if (t.showLines) {
            if (t.activeH.value) line.delete(t.activeH.value);
            t.activeH.value = line.new(i - len, ph, i, ph, 'bar_index', undefined, BULL_COLOR, t.lStyle);
            phTriggered = true;
          }
        }
        t.hHigh.push(current);
        if (t.hHigh.length > 100) t.hHigh.shift();
      }
      if (!Number.isNaN(pl)) {
        const current = point();
        if (ge(knnScore(current, t.hLow, cfg.knnKInput), cfg.minConfidence)) {
          if (t.showLabels) {
            label.new(i - len, pl - visualOffset, t.icon, 'bar_index', 'price', undefined, 'none', BEAR_COLOR, t.iconSize);
          }
          if (t.showLines) {
            if (t.activeL.value) line.delete(t.activeL.value);
            t.activeL.value = line.new(i - len, pl, i, pl, 'bar_index', undefined, BEAR_COLOR, t.lStyle);
            plTriggered = true;
          }
        }
        t.hLow.push(current);
        if (t.hLow.length > 100) t.hLow.shift();
      }

      // Delta Tank labels of the active term
      if (phTriggered && activeTerm === t.term && cfg.showDeltaTankInput) {
        if (activeMetaHigh) label.delete(activeMetaHigh.infoLabel);
        activeMetaHigh = {
          startBar: i - len, cumVol: 0, cumDelta: 0,
          infoLabel: label.new(i, ph, '', 'bar_index', 'price', String(color.new(BULL_COLOR, 30)), 'label_left', WHITE, parsedLabelSize),
        };
      }
      if (plTriggered && activeTerm === t.term && cfg.showDeltaTankInput) {
        if (activeMetaLow) label.delete(activeMetaLow.infoLabel);
        activeMetaLow = {
          startBar: i - len, cumVol: 0, cumDelta: 0,
          infoLabel: label.new(i, pl, '', 'bar_index', 'price', String(color.new(BEAR_COLOR, 30)), 'label_left', WHITE, parsedLabelSize),
        };
      }
      if (!Number.isNaN(ph)) t.lastHigh = ph;
      if (!Number.isNaN(pl)) t.lastLow = pl;
    }

    // f_update_metadata()
    for (const m of [activeMetaHigh, activeMetaLow]) {
      if (!m) continue;
      m.cumVol += volume[i];
      m.cumDelta += gt(b.close, b.open) ? volume[i] : -volume[i];
      const fillRatio = Math.max(0, Math.min(1, Math.abs(m.cumDelta) / Math.max(1, m.cumVol)));
      const fillBlocks = Math.round(fillRatio * 10);
      let barStr = '';
      for (let k = 1; k <= 10; k++) barStr += k <= fillBlocks ? '█' : '░';
      const up = ge(m.cumDelta, 0);
      const txt = ' [ DELTA TANK ] \n' + `       ${up ? '▲' : '▼'}       \n` + ` ${barStr} \n`
        + `       ${str.tostring(fillRatio * 100, '#')}%       `;
      label.set_text(m.infoLabel, txt);
      label.set_color(m.infoLabel, String(color.new(up ? BULL_COLOR : BEAR_COLOR, 30)));
      label.set_textcolor(m.infoLabel, WHITE);
      label.set_x(m.infoLabel, i);
    }

    // f_terminate_line()
    const terminate = (v: { value: Line | undefined }, isHigh: boolean, term: Term, meta: LineMetadata | null, bosSize: BosSize) => {
      const l = v.value;
      if (!l) return;
      const y1 = line.get_y1(l);
      const broken = isHigh ? gt(b.close, y1) : lt(b.close, y1);
      line.set_x2(l, i);
      if (broken) {
        const midX = Math.round((line.get_x1(l) + i) / 2);
        if (bosSize !== 'None') {
          label.new(midX, y1, `${term} BOS`, 'bar_index', 'price', '#00000000', isHigh ? 'label_down' : 'label_up',
            isHigh ? BULL_COLOR : BEAR_COLOR, size(bosSize));
        }
        if (meta) label.delete(meta.infoLabel);
        v.value = undefined;
      }
    };
    for (const t of terms) {
      terminate(t.activeH, true, t.term, activeTerm === t.term ? activeMetaHigh : null, t.bos);
      terminate(t.activeL, false, t.term, activeTerm === t.term ? activeMetaLow : null, t.bos);
    }

    // Bias colour of the candles
    const sel = terms.find((t) => t.term === activeTerm);
    const selectedHigh = sel ? sel.lastHigh : NaN;
    const selectedLow = sel ? sel.lastLow : NaN;
    let candleColor: string | null = null;
    if (!Number.isNaN(selectedHigh) && !Number.isNaN(selectedLow)) {
      const factor = (b.close - selectedLow) / Math.max(1e-6, selectedHigh - selectedLow);
      candleColor = gt(factor, 0.5)
        ? String(color.from_gradient(factor, 0.5, 1.0, NEUTRAL_COLOR, BULL_COLOR))
        : String(color.from_gradient(factor, 0.0, 0.5, BEAR_COLOR, NEUTRAL_COLOR));
      if (gt(b.close, selectedHigh)) candleColor = BULL_COLOR;
      if (lt(b.close, selectedLow)) candleColor = BEAR_COLOR;
    }
    if (cfg.colorCandlesInput && candleColor !== null) barColors.push({ id: 'barcolor0', time: b.time, color: candleColor });

    if (i !== n - 1) continue;

    // Volume profile on the last bar
    if (cfg.showVP && !Number.isNaN(selectedHigh) && !Number.isNaN(selectedLow)) {
      let firstBar = Math.max(0, i - 499);
      if (activeMetaHigh && activeMetaLow) {
        firstBar = Math.max(firstBar, Math.min(activeMetaHigh.startBar, activeMetaLow.startBar));
      }
      const lookback = i - firstBar;
      const rows = cfg.vpRows;
      const binStep = (selectedHigh - selectedLow) / rows;
      const binVolumes: number[] = new Array(rows).fill(0);
      for (let k = 0; k <= lookback; k++) {
        const p = close[i - k];
        const v = volume[i - k];
        if (ge(p, selectedLow) && le(p, selectedHigh)) {
          let binIdx = Math.min(rows - 1, Math.floor((p - selectedLow) / binStep));
          if (binIdx < 0) binIdx += rows; // a negative array index counts from the end
          binVolumes[binIdx] += v;
        }
      }
      let maxVol = NaN;
      for (const v of binVolumes) if (!Number.isNaN(v) && !(v <= maxVol)) maxVol = v;
      const pocIdx = binVolumes.findIndex((v) => Math.abs(v - maxVol) <= EPS);
      for (let r = 0; r <= rows - 1; r++) {
        const vol = binVolumes[r];
        if (!gt(vol, 0)) continue;
        const binBottom = selectedLow + r * binStep;
        const binTop = binBottom + binStep;
        const binWidth = Math.round((vol / maxVol) * cfg.vpWidth);
        const baseColor = r === pocIdx ? NEUTRAL_COLOR : r > pocIdx ? BULL_COLOR : BEAR_COLOR;
        const rightEdge = i + cfg.vpOffset;
        const leftEdge = rightEdge - binWidth;
        box.new(leftEdge, binTop, rightEdge, binBottom, 'transparent', undefined, undefined, undefined, undefined,
          String(color.new(baseColor, 75)));
        const highlightHeight = binStep * 0.15;
        box.new(leftEdge, binTop, rightEdge, binTop - highlightHeight, 'transparent', undefined, undefined, undefined,
          undefined, String(color.new(baseColor, 40)));
        box.new(leftEdge, binTop, leftEdge + 1, binBottom, 'transparent', undefined, undefined, undefined, undefined,
          String(color.new(baseColor, 20)));
      }
    }

    // Dashboard
    if (cfg.showDashboard) {
      const t = table.new('top_right', 3, 5, BACKGROUND, BORDERS, 1);
      table.merge_cells(t, 0, 0, 2, 0);
      table.cell(t, 0, 0, 'Multi-Term kNN [LuxAlgo]', undefined, undefined, DATA, undefined, undefined, 'small');
      table.cell(t, 0, 2, 'Active Term', undefined, undefined, HEADERS, 'left', undefined, 'small');
      table.cell(t, 1, 2, activeTerm === '' ? 'None' : activeTerm, undefined, undefined, DATA, undefined, undefined, 'small');
      table.cell(t, 0, 4, 'Bias', undefined, undefined, HEADERS, 'left', undefined, 'small');
      const biasStr = gt(b.close, selectedHigh) ? 'Bullish' : lt(b.close, selectedLow) ? 'Bearish' : 'Neutral';
      table.cell(t, 1, 4, biasStr, undefined, undefined,
        biasStr === 'Bullish' ? BULL_COLOR : biasStr === 'Bearish' ? BEAR_COLOR : NEUTRAL_COLOR, undefined, undefined, 'small');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
    ...drawingOutputs(bars),
  };
}

export const KnnMarketArchitecture = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  barColorConfig,
  drawingKinds,
};
