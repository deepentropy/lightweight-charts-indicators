/**
 * Candle Count RSI
 *
 * Standard RSI: ta.rsi of the close, optionally smoothed with a WMA. Candle Count RSI: an RSI of the candle
 * directions (RMA of 1 for close > open and of 1 for close < open, 100 when the down average is 0), pushed away from
 * 50 by the current streak of same-direction candles (x 1.05 per candle, at most x 1.5), optionally smoothed with a
 * WMA. A histogram fill from 50 to 50 + (candle RSI - RSI) is green when both lines rise, red when both fall, yellow
 * otherwise. The background glows green / red with a strength that grows with the distance of the candle RSI from
 * 50; divergence backgrounds mark candle RSI > 50 with RSI below the bullish threshold, and candle RSI < 50 with RSI
 * above the bearish threshold. Glow lines (wide plots and wide 70 / 30 levels) surround the lines and levels.
 *
 * Reference: "Candle Count RSI" by Sherlock_MacGyver
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CandleCountRsiInputs {
  /** RSI length (standard RSI and candle count RSI) */
  length: number;
  showStandard: boolean;
  standardColor: string;
  showStandardGlow: boolean;
  standardColorGlow: string;
  /** WMA smoothing of the standard RSI */
  smoothStandard: boolean;
  smoothLenStandard: number;
  showCandle: boolean;
  candleCountColor: string;
  showCandleGlow: boolean;
  candleCountColorGlow: string;
  /** WMA smoothing of the candle count RSI */
  smoothCandle: boolean;
  smoothLenCandle: number;
  /** Enable all glows (line glows, glow levels, glow and divergence backgrounds) */
  masterGlowToggle: boolean;
  /** RSI glow zones (background by the candle RSI side of 50) */
  showGlow: boolean;
  /** Glow background in the indicator pane */
  showSubpaneGlow: boolean;
  /** Glow background on the price pane */
  showChartGlow: boolean;
  /** Glow intensity: transparency drop per point of distance from 50 */
  glowStrengthMult: number;
  bullGlowColor: string;
  bearGlowColor: string;
  /** Divergence backgrounds */
  showDivBG: boolean;
  /** Transparency of the divergence backgrounds */
  divTransp: number;
  /** Divergence background in the indicator pane */
  showDivSubpane: boolean;
  /** Divergence background on the price pane */
  showDivChart: boolean;
  bullDivColor: string;
  bearDivColor: string;
  /** Bullish divergence: standard RSI below this value while the candle RSI is above 50 */
  bullDivThresh: number;
  /** Bearish divergence: standard RSI above this value while the candle RSI is below 50 */
  bearDivThresh: number;
  showDirectionHistogram: boolean;
  histBullColor: string;
  histBearColor: string;
  histNeutralColor: string;
  /** Transparency of the histogram fill */
  histTransparency: number;
}

export const defaultInputs: CandleCountRsiInputs = {
  length: 32,
  showStandard: true,
  standardColor: color.white,
  showStandardGlow: true,
  standardColorGlow: 'rgba(255, 255, 255, 0.3)',
  smoothStandard: true,
  smoothLenStandard: 8,
  showCandle: true,
  candleCountColor: color.fuchsia,
  showCandleGlow: true,
  candleCountColorGlow: 'rgba(224, 64, 251, 0.3)',
  smoothCandle: true,
  smoothLenCandle: 8,
  masterGlowToggle: true,
  showGlow: true,
  showSubpaneGlow: true,
  showChartGlow: false,
  glowStrengthMult: 5.0,
  bullGlowColor: color.green,
  bearGlowColor: color.red,
  showDivBG: true,
  divTransp: 80,
  showDivSubpane: true,
  showDivChart: false,
  bullDivColor: color.orange,
  bearDivColor: color.blue,
  bullDivThresh: 45.0,
  bearDivThresh: 55.0,
  showDirectionHistogram: true,
  histBullColor: color.lime,
  histBearColor: color.red,
  histNeutralColor: color.yellow,
  histTransparency: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI Length', defval: 32 },
  { id: 'showStandard', type: 'bool', title: 'Standard RSI', defval: true },
  { id: 'standardColor', type: 'color', title: 'Standard RSI Color', defval: color.white },
  { id: 'showStandardGlow', type: 'bool', title: 'Show Glow', defval: true },
  { id: 'standardColorGlow', type: 'color', title: 'Standard RSI Glow Color', defval: 'rgba(255, 255, 255, 0.3)' },
  { id: 'smoothStandard', type: 'bool', title: 'Smoothing? --- Amount →', defval: true },
  { id: 'smoothLenStandard', type: 'int', title: 'Standard RSI Smoothing Length', defval: 8, min: 1 },
  { id: 'showCandle', type: 'bool', title: 'Candle Count RSI', defval: true },
  { id: 'candleCountColor', type: 'color', title: 'Candle Count RSI Color', defval: color.fuchsia },
  { id: 'showCandleGlow', type: 'bool', title: 'Show Glow', defval: true },
  { id: 'candleCountColorGlow', type: 'color', title: 'Candle Count RSI Glow Color', defval: 'rgba(224, 64, 251, 0.3)' },
  { id: 'smoothCandle', type: 'bool', title: 'Smoothing? --- Amount →', defval: true },
  { id: 'smoothLenCandle', type: 'int', title: 'Candle Count RSI Smoothing Length', defval: 8, min: 1 },
  { id: 'masterGlowToggle', type: 'bool', title: 'Enable All Glows', defval: true },
  { id: 'showGlow', type: 'bool', title: 'RSI Glow Zones', defval: true },
  { id: 'showSubpaneGlow', type: 'bool', title: 'Indicator', defval: true },
  { id: 'showChartGlow', type: 'bool', title: 'Main Chart', defval: false },
  { id: 'glowStrengthMult', type: 'float', title: 'Glow Intensity', defval: 5.0, min: 1, max: 20 },
  { id: 'bullGlowColor', type: 'color', title: 'Bull', defval: color.green },
  { id: 'bearGlowColor', type: 'color', title: 'Bear', defval: color.red },
  { id: 'showDivBG', type: 'bool', title: 'Divergence Backgrounds', defval: true },
  { id: 'divTransp', type: 'int', title: 'Transparency', defval: 80, min: 0, max: 100, step: 10 },
  { id: 'showDivSubpane', type: 'bool', title: 'Indicator', defval: true },
  { id: 'showDivChart', type: 'bool', title: 'Main Chart', defval: false },
  { id: 'bullDivColor', type: 'color', title: 'Bull', defval: color.orange },
  { id: 'bearDivColor', type: 'color', title: 'Bear', defval: color.blue },
  { id: 'bullDivThresh', type: 'float', title: 'Bullish RSI Threshold', defval: 45.0, step: 0.5 },
  { id: 'bearDivThresh', type: 'float', title: 'Bearish RSI Threshold', defval: 55.0, step: 0.5 },
  { id: 'showDirectionHistogram', type: 'bool', title: 'Show Directional Histogram', defval: true },
  { id: 'histBullColor', type: 'color', title: 'Bullish Agreement', defval: color.lime },
  { id: 'histBearColor', type: 'color', title: 'Bearish Agreement', defval: color.red },
  { id: 'histNeutralColor', type: 'color', title: 'Conflict', defval: color.yellow },
  { id: 'histTransparency', type: 'int', title: 'Transparency', defval: 70, min: 0, max: 100, step: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Directional Histogram Top', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'Directional Histogram Base', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Standard RSI', color: color.white, lineWidth: 1 },
  { id: 'plot3', title: 'Standard RSI Glow', color: 'rgba(255, 255, 255, 0.3)', lineWidth: 5 },
  { id: 'plot4', title: 'Candle Count RSI', color: color.fuchsia, lineWidth: 1 },
  { id: 'plot5', title: 'Candle Count RSI Glow', color: 'rgba(224, 64, 251, 0.3)', lineWidth: 5 },
];

/** The seven levels; the four glow levels are na (not drawn) when masterGlowToggle is off */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, title: 'Overbought', color: color.red, linestyle: 'solid' },
  { id: 'hline_ob_mid_glow', price: 70, title: 'Mid 70 Glow', color: String(color.new(color.red, 60)), linestyle: 'solid', linewidth: 9 },
  { id: 'hline_ob_high_glow', price: 70, title: 'High 70 Glow', color: String(color.new(color.red, 70)), linestyle: 'solid', linewidth: 18 },
  { id: 'hline_mid', price: 50, title: 'Bias Midline', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_os_high_glow', price: 30, title: 'High 30 Glow', color: String(color.new(color.green, 70)), linestyle: 'solid', linewidth: 18 },
  { id: 'hline_os_mid_glow', price: 30, title: 'Mid 30 Glow', color: String(color.new(color.green, 60)), linestyle: 'solid', linewidth: 9 },
  { id: 'hline_os', price: 30, title: 'Oversold', color: color.green, linestyle: 'solid' },
];

const GLOW_LEVELS = new Set(['hline_ob_mid_glow', 'hline_ob_high_glow', 'hline_os_high_glow', 'hline_os_mid_glow']);

export const metadata = {
  title: 'Candle Count RSI',
  shortTitle: 'Candle Count RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface CandleCountVars {
  greenStreak: number;
  redStreak: number;
}

interface CandleCountRun extends BarRunState<CandleCountVars> {
  rawRSI: ReturnType<typeof taStep.rsi>;
  smoothRSI: ReturnType<typeof taStep.wma> | null;
  avgUp: ReturnType<typeof taStep.rma>;
  avgDown: ReturnType<typeof taStep.rma>;
  smoothCandle: ReturnType<typeof taStep.wma> | null;
  rsi: number[];
  candleRSI: number[];
  plots: Point[][];
  histColor: string[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<CandleCountRsiInputs>): BarStudy<CandleCountRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Directional histogram colour
  const histBull = String(color.new(cfg.histBullColor, cfg.histTransparency));
  const histBear = String(color.new(cfg.histBearColor, cfg.histTransparency));
  const histNeutral = String(color.new(cfg.histNeutralColor, cfg.histTransparency));
  const glowOn = cfg.masterGlowToggle && cfg.showGlow;
  const divOn = cfg.masterGlowToggle && cfg.showDivBG;
  const divBull = String(color.new(cfg.bullDivColor, cfg.divTransp));
  const divBear = String(color.new(cfg.bearDivColor, cfg.divTransp));
  const hist = cfg.showDirectionHistogram;
  const glowLines = cfg.masterGlowToggle;
  return {
    init() {
      const s: CandleCountRun = {
        rawRSI: taStep.rsi(cfg.length), smoothRSI: cfg.smoothStandard ? taStep.wma() : null,
        avgUp: taStep.rma(cfg.length), avgDown: taStep.rma(cfg.length), smoothCandle: cfg.smoothCandle ? taStep.wma() : null,
        rsi: [], candleRSI: [], plots: [[], [], [], [], [], []], histColor: [], bgColors: [],
        steps: [], vars: { greenStreak: 0, redStreak: 0 }, lists: [], series: [],
      };
      s.steps = [s.rawRSI, ...(s.smoothRSI ? [s.smoothRSI] : []), s.avgUp, s.avgDown, ...(s.smoothCandle ? [s.smoothCandle] : [])];
      s.lists = [s.bgColors];
      s.series = [s.rsi, s.candleRSI, ...s.plots, s.histColor];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // Standard RSI
      const rawRSI = s.rawRSI.step(b.close);
      const rsi = s.smoothRSI ? s.smoothRSI.step(rawRSI, cfg.smoothLenStandard) : rawRSI;
      s.rsi[i] = rsi;

      // Candle count RSI: RMA of the up / down candle flags
      const avgUp = s.avgUp.step(gt(b.close, b.open) ? 1.0 : 0.0);
      const avgDown = s.avgDown.step(lt(b.close, b.open) ? 1.0 : 0.0);
      // rs = avgDown == 0 ? na : avgUp / avgDown; rawCandleRSI = avgDown == 0 ? 100 : 100 - 100 / (1 + rs)
      const down0 = eq(avgDown, 0);
      const rs = down0 ? NaN : avgUp / avgDown;
      const rawCandleRSI = down0 ? 100 : 100 - 100 / (1 + rs);
      // Streaks (an unchanged bar keeps both)
      if (gt(b.close, b.open)) {
        v.greenStreak += 1;
        v.redStreak = 0;
      } else if (lt(b.close, b.open)) {
        v.redStreak += 1;
        v.greenStreak = 0;
      }
      const streakLength = gt(b.close, b.open) ? v.greenStreak : v.redStreak;
      const streakMult = 1 + Math.min(streakLength, 10) * 0.05;
      const unsmoothed = gt(rawCandleRSI, 50)
        ? 50 + (rawCandleRSI - 50) * streakMult
        : 50 - (50 - rawCandleRSI) * streakMult;
      const c = s.smoothCandle ? s.smoothCandle.step(unsmoothed, cfg.smoothLenCandle) : unsmoothed;
      s.candleRSI[i] = c;

      const candleSlope = i > 0 ? c - s.candleRSI[i - 1] : NaN;
      const standardSlope = i > 0 ? rsi - s.rsi[i - 1] : NaN;
      const histColor = gt(candleSlope, 0) && gt(standardSlope, 0)
        ? histBull
        : lt(candleSlope, 0) && lt(standardSlope, 0) ? histBear : histNeutral;
      s.histColor[i] = hist ? histColor : 'transparent';

      // Backgrounds, in the order of the Pine bgcolor calls (a later call is drawn on top); id bgcolor<k> = k-th call
      // bullFadeStrength = candleRSI > 50 ? 100 - min((candleRSI - 50) * mult, 100) : na (bear: below 50)
      const bullFade = gt(c, 50) ? 100 - Math.min((c - 50) * cfg.glowStrengthMult, 100) : NaN;
      const bearFade = lt(c, 50) ? 100 - Math.min((50 - c) * cfg.glowStrengthMult, 100) : NaN;
      const bullGlow = !isNaN(bullFade) ? String(color.new(cfg.bullGlowColor, bullFade)) : null;
      const bearGlow = !isNaN(bearFade) ? String(color.new(cfg.bearGlowColor, bearFade)) : null;
      const bullDiv = gt(c, 50) && lt(rsi, cfg.bullDivThresh);
      const bearDiv = lt(c, 50) && gt(rsi, cfg.bearDivThresh);
      const bg = s.bgColors;
      if (glowOn && cfg.showSubpaneGlow && bullGlow !== null) bg.push({ id: 'bgcolor0', time, color: bullGlow });
      if (glowOn && cfg.showSubpaneGlow && bearGlow !== null) bg.push({ id: 'bgcolor1', time, color: bearGlow });
      if (glowOn && cfg.showChartGlow && bullGlow !== null) bg.push({ id: 'bgcolor2', time, color: bullGlow, forceOverlay: true });
      if (glowOn && cfg.showChartGlow && bearGlow !== null) bg.push({ id: 'bgcolor3', time, color: bearGlow, forceOverlay: true });
      if (divOn && cfg.showDivSubpane && bullDiv) bg.push({ id: 'bgcolor4', time, color: divBull });
      if (divOn && cfg.showDivSubpane && bearDiv) bg.push({ id: 'bgcolor5', time, color: divBear });
      if (divOn && cfg.showDivChart && bullDiv) bg.push({ id: 'bgcolor6', time, color: divBull, forceOverlay: true });
      if (divOn && cfg.showDivChart && bearDiv) bg.push({ id: 'bgcolor7', time, color: divBear, forceOverlay: true });

      s.plots[0][i] = { time, value: hist ? c - rsi + 50 : NaN };
      s.plots[1][i] = { time, value: hist ? 50 : NaN };
      s.plots[2][i] = { time, value: cfg.showStandard ? rsi : NaN, color: cfg.standardColor };
      s.plots[3][i] = { time, value: glowLines && cfg.showStandardGlow ? rsi : NaN, color: cfg.standardColorGlow };
      s.plots[4][i] = { time, value: cfg.showCandle ? c : NaN, color: cfg.candleCountColor };
      s.plots[5][i] = { time, value: glowLines && cfg.showCandleGlow ? c : NaN, color: cfg.candleCountColorGlow };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(), plot5: s.plots[5].slice(),
        },
        // hline(masterGlowToggle ? level : na, ...): an na level draws no line
        hlines: hlineConfig.filter((h) => glowLines || !GLOW_LEVELS.has(h.id)).map((h) => ({
          value: h.price,
          options: { title: h.title, color: h.color, linestyle: h.linestyle, linewidth: h.linewidth ?? 1 },
        })),
        fills: [
          {
            plot1: 'plot0', plot2: 'plot1', options: { title: 'Directional Histogram Fill' },
            colors: s.histColor.slice(),
          },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleCountRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CandleCountRsiInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CandleCountRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
