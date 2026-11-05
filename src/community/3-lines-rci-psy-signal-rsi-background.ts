/**
 * 3 Lines RCI + Psy Signal + RSI Background
 *
 * Three RCI lines (rank correlation of the close with time; short, mid and long length). The script ranks the
 * values itself: rank = 1 + the number of window values above the value (tied values share the best rank), and
 * RCI = 100 * (1 - 6 * sum(d^2) / (n * (n^2 - 1))) with d = bar age - (rank - 1), clamped to -100..100; na while
 * bar_index < length. A psychological line counts the up closes of the last bars (psy = 100 * count / length): above
 * the overbought level it gives a red column (psy - ob) / (100 - ob) * 100, below the oversold level a green column
 * (psy - os) / os * 100. The background is red when RSI is above its overbought line and green when it is below its
 * oversold line. An ADX (Wilder smoothing of +DM, -DM and the true range) is drawn blue below the weak threshold,
 * yellow below the mid threshold and red above. Filled zones from the RCI overheat level to +-100.
 *
 * Reference: "3 Lines RCI + Psy Signal + RSI Background" by masato19810122
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ThreeLinesRciPsySignalInputs {
  rciShortLen: number;
  rciMidLen: number;
  rciLongLen: number;
  /** Psychological line length */
  psyLen: number;
  psyOverbought: number;
  psyOversold: number;
  /** RCI overheat line (+ and -) */
  rciOverHeat: number;
  adxLen: number;
  /** ADX weak trend threshold */
  adxWeak: number;
  /** ADX mid trend threshold */
  adxMid: number;
  rsiLen: number;
  rsiOB: number;
  rsiOS: number;
}

export const defaultInputs: ThreeLinesRciPsySignalInputs = {
  rciShortLen: 9,
  rciMidLen: 26,
  rciLongLen: 52,
  psyLen: 12,
  psyOverbought: 70,
  psyOversold: 30,
  rciOverHeat: 80,
  adxLen: 14,
  adxWeak: 20,
  adxMid: 30,
  rsiLen: 14,
  rsiOB: 68,
  rsiOS: 32,
};

export const inputConfig: InputConfig[] = [
  { id: 'rciShortLen', type: 'int', title: 'RCI 短期', defval: 9 },
  { id: 'rciMidLen', type: 'int', title: 'RCI 中期', defval: 26 },
  { id: 'rciLongLen', type: 'int', title: 'RCI 長期', defval: 52 },
  { id: 'psyLen', type: 'int', title: 'サイコロジカル期間', defval: 12 },
  { id: 'psyOverbought', type: 'int', title: 'サイコロジカル買われすぎ', defval: 70 },
  { id: 'psyOversold', type: 'int', title: 'サイコロジカル売られすぎ', defval: 30 },
  { id: 'rciOverHeat', type: 'int', title: 'RCI 過熱ライン', defval: 80 },
  { id: 'adxLen', type: 'int', title: 'ADX期間', defval: 14 },
  { id: 'adxWeak', type: 'int', title: 'ADX弱いトレンド閾値', defval: 20 },
  { id: 'adxMid', type: 'int', title: 'ADX中間トレンド閾値', defval: 30 },
  { id: 'rsiLen', type: 'int', title: 'RSI 長さ', defval: 14 },
  { id: 'rsiOB', type: 'int', title: 'RSI 買われすぎライン', defval: 68 },
  { id: 'rsiOS', type: 'int', title: 'RSI 売られすぎライン', defval: 32 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RCI 短期', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'RCI 中期', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'RCI 長期', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'サイコロジカルシグナル', color: color.gray, lineWidth: 3, style: 'columns' },
  { id: 'plot4', title: 'ADX', color: color.blue, lineWidth: 2 },
];

const RED = String(color.new(color.red, 0));
const GREEN = String(color.new(color.green, 0));
const GRAY = String(color.new(color.gray, 0));

/** The 8 hlines with the default inputs (the result `hlines` follow the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_top1', price: 80, title: '', color: RED, linestyle: 'dashed' },
  { id: 'hline_top2', price: 100, title: '', color: RED, linestyle: 'dashed' },
  { id: 'hline_bottom1', price: -80, title: '', color: GREEN, linestyle: 'dashed' },
  { id: 'hline_bottom2', price: -100, title: '', color: GREEN, linestyle: 'dashed' },
  { id: 'hline_plus80', price: 80, title: 'RCI +80ライン', color: color.red, linestyle: 'dotted' },
  { id: 'hline_minus80', price: -80, title: 'RCI -80ライン', color: color.green, linestyle: 'dotted' },
  { id: 'hline_zero', price: 0, title: 'ゼロライン', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_adx_mid', price: 30, title: '中間閾値', color: color.gray, linestyle: 'dotted' },
];

const TOP_FILL = String(color.new(color.red, 80));
const BOTTOM_FILL = String(color.new(color.green, 80));

export const fillConfig: FillConfig[] = [
  { id: 'fill_top', plot1: 'hline_top1', plot2: 'hline_top2', color: TOP_FILL },
  { id: 'fill_bottom', plot1: 'hline_bottom1', plot2: 'hline_bottom2', color: BOTTOM_FILL },
];

export const metadata = {
  title: '3 Lines RCI + Psy Signal + RSI Background',
  shortTitle: '3 Lines RCI + Psy Signal + RSI Background',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface ThreeLinesRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  smTR: ReturnType<typeof taStep.rma>;
  smPlusDM: ReturnType<typeof taStep.rma>;
  smMinusDM: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  close: number[];
  plots: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<ThreeLinesRciPsySignalInputs>): BarStudy<ThreeLinesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const obBg = String(color.new(color.red, 87));
  const osBg = String(color.new(color.green, 87));
  const blue0 = String(color.new(color.blue, 0));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  // rci(src, length): the script's own ranking (no averaging of tied ranks); na while bar_index < length
  const rci = (src: number[], bi: number, length: number): number => {
    if (!(bi >= length)) return NaN;
    const arr: number[] = new Array(length);
    for (let i = 0; i < length; i++) arr[i] = src[bi - i];
    let sumD = 0;
    for (let i = 0; i < length; i++) {
      let rank = 1.0;
      for (let j = 0; j < length; j++) if (gt(arr[j], arr[i])) rank += 1;
      const d = i - (rank - 1);
      sumD += d * d;
    }
    const rciVal = 100 * (1 - (6 * sumD) / (length * (length * length - 1)));
    return Math.max(-100, Math.min(100, rciVal));
  };

  return {
    init() {
      const s: ThreeLinesRun = {
        rsi: taStep.rsi(cfg.rsiLen),
        smTR: taStep.rma(cfg.adxLen),
        smPlusDM: taStep.rma(cfg.adxLen),
        smMinusDM: taStep.rma(cfg.adxLen),
        adx: taStep.rma(cfg.adxLen),
        close: [],
        plots: Array.from({ length: 5 }, () => []),
        bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.smTR, s.smPlusDM, s.smMinusDM, s.adx];
      s.lists = [s.bgColors];
      s.series = [s.close, ...s.plots];
      return s;
    },
    bar(s, bi, bars) {
      const b = bars[bi];
      const t = b.time as number;
      const close = s.close;
      close[bi] = b.close;
      const rsi = s.rsi.step(b.close) ?? NaN;

      // Psychological line and its columns
      let psyCount = 0;
      for (let i = 0; i <= cfg.psyLen - 1; i++) {
        // close[i] > close[i + 1] (na before the first bar compares false)
        if (bi - i - 1 >= 0 && gt(close[bi - i], close[bi - i - 1])) psyCount += 1;
      }
      const psy = (100.0 * psyCount) / cfg.psyLen;
      let sig = NaN;
      let col = GRAY;
      if (gt(psy, cfg.psyOverbought)) {
        sig = ((psy - cfg.psyOverbought) / (100 - cfg.psyOverbought)) * 100;
        col = RED;
      } else if (gt(cfg.psyOversold, psy)) {
        sig = ((psy - cfg.psyOversold) / cfg.psyOversold) * 100;
        col = GREEN;
      }

      // ADX from +DI / -DI
      const prev = bi > 0 ? bars[bi - 1] : undefined;
      const upMove = b.high - (prev ? prev.high : NaN);
      const downMove = (prev ? prev.low : NaN) - b.low;
      const plusDM = gt(upMove, downMove) && gt(upMove, 0) ? upMove : 0;
      const minusDM = gt(downMove, upMove) && gt(downMove, 0) ? downMove : 0;
      const prevClose = prev ? prev.close : NaN;
      // math.max with an na argument is na
      const tr = Math.max(b.high - b.low, Math.max(Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)));
      const smTR = s.smTR.step(tr) ?? NaN;
      const smPlusDM = s.smPlusDM.step(plusDM) ?? NaN;
      const smMinusDM = s.smMinusDM.step(minusDM) ?? NaN;
      const plusDI = (100 * smPlusDM) / smTR;
      const minusDI = (100 * smMinusDM) / smTR;
      const dx = (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
      const adxVal = s.adx.step(dx) ?? NaN;

      // bgcolor(rsi > rsiOB ? ... : na), then bgcolor(rsi < rsiOS ? ... : na)
      if (gt(rsi, cfg.rsiOB)) s.bgColors.push({ time: t, color: obBg });
      if (gt(cfg.rsiOS, rsi)) s.bgColors.push({ time: t, color: osBg });

      const p = s.plots;
      p[0][bi] = { time: t, value: rci(close, bi, cfg.rciShortLen), color: RED };
      p[1][bi] = { time: t, value: rci(close, bi, cfg.rciMidLen), color: blue0 };
      p[2][bi] = { time: t, value: rci(close, bi, cfg.rciLongLen), color: GREEN };
      p[3][bi] = { time: t, value: Number.isFinite(sig) ? sig : NaN, color: col };
      // adxColor = adxVal < adxWeak ? blue : adxVal < adxMid ? yellow : red
      p[4][bi] = {
        time: t, value: fin(adxVal),
        color: gt(cfg.adxWeak, adxVal) ? color.blue : gt(cfg.adxMid, adxVal) ? color.yellow : color.red,
      };
    },
    result(s, bars) {
      const n = bars.length;
      const ohl = cfg.rciOverHeat;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        hlines: [
          { value: ohl, options: { title: '', color: RED, linestyle: 'dashed' } },
          { value: 100, options: { title: '', color: RED, linestyle: 'dashed' } },
          { value: -ohl, options: { title: '', color: GREEN, linestyle: 'dashed' } },
          { value: -100, options: { title: '', color: GREEN, linestyle: 'dashed' } },
          { value: ohl, options: { title: 'RCI +80ライン', color: color.red, linestyle: 'dotted' } },
          { value: -ohl, options: { title: 'RCI -80ライン', color: color.green, linestyle: 'dotted' } },
          { value: 0, options: { title: 'ゼロライン', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.adxMid, options: { title: '中間閾値', color: color.gray, linestyle: 'dotted' } },
        ],
        fills: [
          // fill(topZoneLine1, topZoneLine2, color.new(color.red, 80)); fill(bottomZoneLine1, bottomZoneLine2, ...)
          { plot1: 'hline_top1', plot2: 'hline_top2', colors: new Array<string>(n).fill(TOP_FILL) },
          { plot1: 'hline_bottom1', plot2: 'hline_bottom2', colors: new Array<string>(n).fill(BOTTOM_FILL) },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThreeLinesRciPsySignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ThreeLinesRciPsySignalInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ThreeLinesRciPsySignal = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
