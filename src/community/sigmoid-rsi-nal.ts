/**
 * Sigmoid RSI | NAL
 *
 * The RSI is centred on 50 and passed through a logistic function: raw = 100 * sigmoid(RSI - 50). It is smoothed by
 * an adaptive EMA whose alpha = 2 / (len + 1) * (0.5 + sigmoid(feed)), clamped to 0.01..1, where the feed is the
 * change of the ATR over the weight change window (volatility). The signal line is the same adaptive EMA of the
 * Sigmoid RSI with the change of an RSI (weight lookback) as feed (momentum). The state turns long above the long
 * threshold (and above the signal line with confluence), short below the short threshold (and below the signal line);
 * it colours the line, the price candles and the bars, and its transitions give Buy / Sell triangles. The areas
 * beyond the thresholds are filled.
 *
 * Reference: "Sigmoid RSI | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SigmoidRsiNalInputs {
  /** Colour mode: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  rsiLen: number;
  /** Length of the adaptive EMA of the Sigmoid RSI */
  rsiSmoothLen: number;
  longThres: number;
  shortThres: number;
  /** RSI / ATR length of the weight feeds */
  modLen: number;
  /** Change window (bars) of the weight feeds */
  changeL: number;
  /** Long / short state also needs the Sigmoid RSI above / below its signal line */
  boolCon: boolean;
  /** Length of the adaptive EMA signal line */
  rsiSignalLen: number;
}

export const defaultInputs: SigmoidRsiNalInputs = {
  colMode: 'Standard',
  src: 'close',
  rsiLen: 9,
  rsiSmoothLen: 14,
  longThres: 72,
  shortThres: 40,
  modLen: 14,
  changeL: 2,
  boolCon: true,
  rsiSignalLen: 40,
};

const TP = 'Measures how much the selected Weight Source has changed compared with its value X bars ago. Lower values '
  + 'react faster and may be noisier; higher values respond more slowly and emphasize broader shifts.';

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'], group: 'Visuals' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'RSI' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 9, min: 1, group: 'RSI' },
  { id: 'rsiSmoothLen', type: 'int', title: 'Sigmoid RSI Smoothing', defval: 14, min: 1, group: 'RSI' },
  { id: 'longThres', type: 'int', title: 'Long Threshold', defval: 72, min: 1, group: 'RSI' },
  { id: 'shortThres', type: 'int', title: 'Short Threshold', defval: 40, min: 1, group: 'RSI' },
  { id: 'modLen', type: 'int', title: 'Weight Lookback', defval: 14, min: 1, group: 'Sigmoid Weights' },
  { id: 'changeL', type: 'int', title: 'Weight Change Window (Bars)', defval: 2, min: 1, group: 'Sigmoid Weights', tooltip: TP },
  { id: 'boolCon', type: 'bool', title: 'Sigmoid EMA Confluence?', defval: true, group: 'Confluence' },
  { id: 'rsiSignalLen', type: 'int', title: 'Signal Length', defval: 40, min: 1, group: 'Confluence' },
];

const STD_UP = String(color.rgb(0, 255, 200));
const STD_DN = String(color.rgb(32, 94, 144));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Sigmoid RSI', color: STD_UP, lineWidth: 2 },
  { id: 'plot1', title: 'Sigmoid RSI Glow', color: String(color.new(STD_UP, 78)), lineWidth: 7, display: 'pane' },
  { id: 'plot2', title: 'Sigmoid RSI MA', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Long Threshold', color: STD_UP, lineWidth: 1 },
  { id: 'plot4', title: 'Short Threshold', color: STD_DN, lineWidth: 1 },
  { id: 'plot5', title: 'Midline', color: String(color.new(color.gray, 75)), lineWidth: 1, display: 'pane' },
  { id: 'plot6', title: 'Upper Fill Anchor', color: String(color.new(STD_UP, 100)), lineWidth: 1, display: 'pane' },
  { id: 'plot7', title: 'Lower Fill Anchor', color: String(color.new(STD_DN, 100)), lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'Sigmoid RSI | NAL',
  shortTitle: 'Sigmoid RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** f_clamp(value, min, max) = math.max(min, math.min(value, max)) (na when value is na) */
const clamp = (v: number, lo: number, hi: number) => (isNaN(v) ? NaN : Math.max(lo, Math.min(v, hi)));
/** sigmoid_function(x) = 1 / (1 + exp(-clamp(nz(x), -60, 60))) */
const sigmoid = (x: number) => 1.0 / (1.0 + Math.exp(-clamp(isNaN(x) ? 0 : x, -60.0, 60.0)));

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>;
};

interface SigmoidVars {
  /** sigmoidEma[1] of the Sigmoid RSI and of its signal line */
  prevRsi: number;
  prevSignal: number;
}

interface SigmoidRun extends BarRunState<SigmoidVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  modRsi: ReturnType<typeof taStep.rsi>;
  modRsiChange: ReturnType<typeof taStep.change>;
  atr: ReturnType<typeof taStep.atr>;
  atrChange: ReturnType<typeof taStep.change>;
  nal: number[];
  plots: Point[][];
  candles: PlotCandleData[];
  barColors: BarColorData[];
  markers: MarkerData[];
}

/** f_sigmoid_ema(source, feed, len) on one bar: sigmoidEma := na(sigmoidEma[1]) ? source : sigmoidEma[1] + alpha * (source - sigmoidEma[1]) */
function sigmoidEmaStep(prev: number, source: number, feed: number, baseAlpha: number): number {
  const alpha = clamp(baseAlpha * (0.5 + sigmoid(feed)), 0.01, 1.0);
  return isNaN(prev) ? source : prev + alpha * (source - prev);
}

function study(inputs: Partial<SigmoidRsiNalInputs>): BarStudy<SigmoidRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(0, 96, 175)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STD_UP, STD_DN, color.gray];
  const upFill = String(color.new(colUp, 100));
  const dnFill = String(color.new(colDn, 100));
  const mid = String(color.new(colNu, 75));
  const upFillCol = String(color.new(colUp, 86));
  const dnFillCol = String(color.new(colDn, 86));
  const rsiAlpha = 2.0 / (cfg.rsiSmoothLen + 1.0);
  const signalAlpha = 2.0 / (cfg.rsiSignalLen + 1.0);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: SigmoidRun = {
        rsi: taStep.rsi(cfg.rsiLen), modRsi: taStep.rsi(cfg.modLen), modRsiChange: taStep.change(cfg.changeL),
        atr: taStep.atr(cfg.modLen), atrChange: taStep.change(cfg.changeL),
        nal: [], plots: Array.from({ length: 8 }, () => []), candles: [], barColors: [], markers: [],
        steps: [], vars: { prevRsi: NaN, prevSignal: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.modRsi, s.modRsiChange, s.atr, s.atrChange];
      s.lists = [s.markers];
      s.series = [s.nal, ...s.plots, s.candles, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const x = value(b);
      const rsiRaw = s.rsi.step(x);
      const sigmoidRsiRaw = 100.0 * sigmoid(rsiRaw - 50.0);
      // momentumFeed = ta.change(ta.rsi(src, modLen), changeL); volatilityFeed = ta.change(ta.atr(modLen), changeL)
      const momentumFeed = s.modRsiChange.step(s.modRsi.step(x));
      const volatilityFeed = s.atrChange.step(s.atr.step(b.high, b.low, b.close));

      const sigRsi = sigmoidEmaStep(v.prevRsi, sigmoidRsiRaw, volatilityFeed, rsiAlpha);
      v.prevRsi = sigRsi;
      const sigSignal = sigmoidEmaStep(v.prevSignal, sigRsi, momentumFeed, signalAlpha);
      v.prevSignal = sigSignal;

      // var int NAL = 0; NAL := ... : NAL[1] (NAL[1] is na on the first bar)
      const prev = i > 0 ? s.nal[i - 1] : NaN;
      const nal = gt(sigRsi, cfg.longThres) && (gt(sigRsi, sigSignal) || !cfg.boolCon) ? 1
        : lt(sigRsi, cfg.shortThres) && (lt(sigRsi, sigSignal) || !cfg.boolCon) ? -1 : prev;
      s.nal[i] = nal;

      const plotColor = nal === 1 ? colUp : nal === -1 ? colDn : colNu;
      const p = s.plots;
      p[0][i] = { time, value: sigRsi, color: plotColor };
      p[1][i] = { time, value: sigRsi, color: String(color.new(plotColor, 78)) };
      p[2][i] = { time, value: sigSignal, color: color.gray };
      p[3][i] = { time, value: cfg.longThres, color: colUp };
      p[4][i] = { time, value: cfg.shortThres, color: colDn };
      p[5][i] = { time, value: 50.0, color: mid };
      // plot(rsi_bullish ? sigmoidRSI : na, 'Upper Fill Anchor', color.new(col_up, 100), display = display.pane)
      p[6][i] = { time, value: gt(sigRsi, cfg.longThres) ? sigRsi : NaN, color: upFill };
      p[7][i] = { time, value: lt(sigRsi, cfg.shortThres) ? sigRsi : NaN, color: dnFill };

      // plotcandle(open, high, low, close, 'Candles', plotColor, wickcolor, bordercolor, force_overlay = true, display.pane)
      s.candles[i] = {
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: plotColor, wickColor: plotColor, borderColor: plotColor, forceOverlay: true,
      };
      s.barColors[i] = { time: b.time, color: plotColor };

      if (i >= 1) {
        // bullish_transition = NAL == 1 and NAL[1] == -1 (and the reverse)
        if (nal === 1 && prev === -1) {
          s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: colUp, text: '𝓑𝓾𝔂',
            textColor: colUp, size: 'tiny', forceOverlay: true });
        }
        if (nal === -1 && prev === 1) {
          s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: colDn, text: '𝓢𝓮𝓵𝓵',
            textColor: colDn, size: 'tiny', forceOverlay: true });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      // fill(p_upper_fill, p_long, color.new(col_up, 86)); fill(p_lower_fill, p_short, color.new(col_dn, 86))
      const fills = [
        { plot1: 'plot6', plot2: 'plot3', colors: new Array<string>(n).fill(upFillCol) },
        { plot1: 'plot7', plot2: 'plot4', colors: new Array<string>(n).fill(dnFillCol) },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        plotCandles: { Candles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SigmoidRsiNalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SigmoidRsiNalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SigmoidRsiNal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
