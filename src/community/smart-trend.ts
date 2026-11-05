/**
 * Smart Trend [Zofesu]
 *
 * An ATR trailing line. In an up trend the line is the highest value of high - ATR * multiplier since the trend
 * start; in a down trend it is the lowest value of low + ATR * multiplier. The trend turns down when the close is
 * below the line and turns up when the close is above it, only when the volume confirms (volume percent rank over
 * 500 bars above the target, when the volume filter is on). A Hull MA of the close (main trend filter) colours the
 * background (close above it: green tint, else red tint) and greys the line when the trend is against the filter.
 * BUY / SELL triangles mark trend changes that agree with the filter.
 * Alerts (alertcondition, `alerts` of the result): 'Smart Trend: BUY Signal' and 'Smart Trend: SELL Signal', true on
 * the bars of the BUY / SELL triangles.
 *
 * Reference: "Smart Trend [Zofesu]" by Zofesu
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Since 2020 Zofesu
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SmartTrendInputs {
  /** ATR period */
  atrLength: number;
  /** Volatility multiplier */
  multiplier: number;
  /** Main trend filter (HMA) */
  useFilter: boolean;
  /** HMA length of the main trend filter */
  filterLen: number;
  /** Background bias tint */
  showBg: boolean;
  /** Require volume confirmation */
  useVol: boolean;
  /** Volume percentile rank target (%) */
  volPctTarget: number;
}

export const defaultInputs: SmartTrendInputs = {
  atrLength: 25,
  multiplier: 3.2,
  useFilter: true,
  filterLen: 500,
  showBg: true,
  useVol: true,
  volPctTarget: 40,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Period', defval: 25 },
  { id: 'multiplier', type: 'float', title: 'Volatility Multiplier', defval: 3.2, step: 0.1 },
  { id: 'useFilter', type: 'bool', title: 'Enable Main Trend Filter?', defval: true },
  { id: 'filterLen', type: 'int', title: 'Main Trend Smoothness (HMA)', defval: 500 },
  { id: 'showBg', type: 'bool', title: 'Show Background Bias Tint?', defval: true },
  { id: 'useVol', type: 'bool', title: 'Require Volume Confirmation?', defval: true },
  { id: 'volPctTarget', type: 'int', title: 'Volume Percentile Rank (%)', defval: 40, min: 1, max: 100 },
];

const BULL = String(color.new('#00ffbb', 0));
const BEAR = String(color.new('#ff0055', 0));
const GREY = String(color.new(color.gray, 50));
const BG_BULL = String(color.new('#00ffbb', 95));
const BG_BEAR = String(color.new('#ff0055', 95));
const REF_COLOR = String(color.new(color.white, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: BULL, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Main Trend Reference', color: REF_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Smart Trend [Zofesu]',
  shortTitle: 'Zofesu - SmartTrend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface SmartTrendVars {
  /** var float trend_line = na */
  line: number;
  /** var int trend_dir = 1 */
  dir: number;
}

interface SmartTrendRun extends BarRunState<SmartTrendVars> {
  atr: ReturnType<typeof taStep.atr>;
  vRank: ReturnType<typeof taStep.percentrank>;
  hma: ReturnType<typeof taStep.hma> | null;
  trendLine: number[];
  trendDir: number[];
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SmartTrendInputs>): BarStudy<SmartTrendRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const vRank = taStep.percentrank(500);
      // the wma of length 0 throws on the first bar (below)
      const hma = cfg.filterLen === 1 ? null : taStep.hma(cfg.filterLen);
      const s: SmartTrendRun = {
        atr, vRank, hma, trendLine: [], trendDir: [], plot0: [], plot1: [], bgColors: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: hma ? [atr, vRank, hma] : [atr, vRank],
        vars: { line: NaN, dir: 1 },
        lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.trendLine, s.trendDir, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const atrV = s.atr.step(b.high, b.low, b.close);
      const vRank = s.vRank.step(b.volume ?? NaN);
      if (!s.hma) {
        throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      const mainTrendMa = s.hma.step(b.close);
      const close = b.close;
      const mainTrendBull = gt(close, mainTrendMa);
      const mainTrendBear = lt(close, mainTrendMa);
      const upperBand = b.high - atrV * cfg.multiplier;
      const lowerBand = b.low + atrV * cfg.multiplier;
      const volConfirmed = !cfg.useVol || gt(vRank, cfg.volPctTarget);

      const prevLine = i > 0 ? s.trendLine[i - 1] : NaN; // trend_line[1]
      let line = v.line;
      let dir = v.dir;
      if (isNaN(line)) line = upperBand;
      if (dir === 1) {
        if (lt(close, line) && volConfirmed) {
          dir = -1;
          line = lowerBand;
        } else {
          // math.max(nz(trend_line[1]), upper_band): na when upper_band is na
          line = Math.max(isNaN(prevLine) ? 0 : prevLine, upperBand);
        }
      } else if (gt(close, line) && volConfirmed) {
        dir = 1;
        line = upperBand;
      } else {
        line = Math.min(isNaN(prevLine) ? 0 : prevLine, lowerBand);
      }
      v.line = line;
      v.dir = dir;
      s.trendLine[i] = line;
      s.trendDir[i] = dir;

      if (cfg.showBg) s.bgColors.push({ time: b.time, color: mainTrendBull ? BG_BULL : BG_BEAR });

      const lineColor = dir === 1 ? BULL : BEAR;
      const finalLineCol = cfg.useFilter
        ? (dir === 1 && !mainTrendBull ? GREY : dir === -1 && !mainTrendBear ? GREY : lineColor)
        : lineColor;
      s.plot0[i] = { time: b.time, value: line, color: finalLineCol };
      s.plot1[i] = { time: b.time, value: cfg.useFilter ? mainTrendMa : NaN, color: REF_COLOR };

      const prevDir = i > 0 ? s.trendDir[i - 1] : NaN; // trend_dir[1] (na on bar 0)
      const showLong = dir === 1 && prevDir === -1 && (!cfg.useFilter || mainTrendBull);
      const showShort = dir === -1 && prevDir === 1 && (!cfg.useFilter || mainTrendBear);
      s.flags[0][i] = showLong;
      s.flags[1][i] = showShort;
      if (showLong) s.times[0].push(b.time as number);
      if (showShort) s.times[1].push(b.time as number);
      if (showLong) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: BULL, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (showShort) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: BEAR, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(show_long, ...) / alertcondition(show_short, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmartTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmartTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Smart Trend: BUY Signal', message: 'Smart Trend Buy Signal on {{ticker}}' },
  { id: 'alert1', title: 'Smart Trend: SELL Signal', message: 'Smart Trend Sell Signal on {{ticker}}' },
];

export const SmartTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
