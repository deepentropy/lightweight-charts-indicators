/**
 * Kalman Flow | Lyro RS
 *
 * A two-state (level + velocity) constant-velocity Kalman filter of the source, with process noise
 * q = 10^(sensitivity / 2 - 6) and measurement noise r = 1, started at the first source value (velocity 0, P = I).
 * The tracking error is the SMA of |source - level| over `volLen` bars; the bands are level + posMult * error and
 * level - negMult * error. The trend turns up when the close is above the upper band with a positive velocity, and
 * down when the close is below the lower band with a negative velocity; otherwise it holds. The baseline (with a
 * glow), the bands, their fill and the candles take the trend colour (gray before the first trend), and Long / Short
 * labels mark the trend flips.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Flip', 'Bearish Trend Flip' and 'Any Trend Flip' on
 * the bars of the flips.
 *
 * Reference: "Kalman Flow | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LyroRS
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KalmanFlowLyroRsInputs {
  /** Price series fed into the Kalman filter */
  src: SourceType;
  /** Filter reaction speed (process noise 10^(sensitivity / 2 - 6)) */
  sensitivity: number;
  /** Upper band multiplier of the tracking error */
  madMultp: number;
  /** Lower band multiplier of the tracking error */
  madMultn: number;
  /** SMA length of the tracking error */
  volLen: number;
  showSignals: boolean;
  showBands: boolean;
  /** Candle colouring (the script draws the candles whatever this setting) */
  candleColor: boolean;
  /** Palette used when the custom palette is off */
  colMode: 'Classic' | 'Mystic' | 'Accented' | 'Royal';
  /** Use the custom up / down colours */
  cpyn: boolean;
  cpUpC: string;
  cpDnC: string;
}

export const defaultInputs: KalmanFlowLyroRsInputs = {
  src: 'close',
  sensitivity: 4,
  madMultp: 1.65,
  madMultn: 1,
  volLen: 50,
  showSignals: true,
  showBands: true,
  candleColor: true,
  colMode: 'Mystic',
  cpyn: true,
  cpUpC: '#00ff00',
  cpDnC: '#ff0000',
};

const SETTINGS = '𝗦𝗘𝗧𝗧𝗜𝗡𝗚𝗦';
const FEATURES = '𝗙𝗘𝗔𝗧𝗨𝗥𝗘𝗦';
const COLOR = '𝗖𝗢𝗟𝗢𝗥';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: '𝗦𝗼𝘂𝗿𝗰𝗲', defval: 'close', group: SETTINGS },
  { id: 'sensitivity', type: 'float', title: '𝗦𝗲𝗻𝘀𝗶𝘁𝗶𝘃𝗶𝘁𝘆', defval: 4, min: 1, max: 10, step: 0.5, group: SETTINGS },
  { id: 'madMultp', type: 'float', title: '+ 𝗠𝘂𝗹𝘁𝗶𝗽𝗹𝗶𝗲𝗿', defval: 1.65, min: 0.5, max: 5, step: 0.1, group: SETTINGS },
  { id: 'madMultn', type: 'float', title: '- 𝗠𝘂𝗹𝘁𝗶𝗽𝗹𝗶𝗲𝗿', defval: 1, min: 0.5, max: 5, step: 0.1, group: SETTINGS },
  { id: 'volLen', type: 'int', title: '𝗡𝗼𝗶𝘀𝗲 𝗟𝗲𝗻𝗴𝘁𝗵', defval: 50, min: 5, max: 500, group: SETTINGS },
  { id: 'showSignals', type: 'bool', title: '𝗦𝗵𝗼𝘄 𝗦𝗶𝗴𝗻𝗮𝗹𝘀', defval: true, group: FEATURES },
  { id: 'showBands', type: 'bool', title: '𝗦𝗵𝗼𝘄 𝗕𝗮𝗻𝗱𝘀', defval: true, group: FEATURES },
  { id: 'candleColor', type: 'bool', title: '𝗖𝗮𝗻𝗱𝗹𝗲 𝗖𝗼𝗹𝗼𝗿𝗶𝗻𝗴', defval: true, group: FEATURES },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic', options: ['Classic', 'Mystic', 'Accented', 'Royal'], group: COLOR, inline: 'drop', display: 'none' },
  { id: 'cpyn', type: 'bool', title: 'Use Custom Palette', defval: true, group: COLOR, display: 'none' },
  { id: 'cpUpC', type: 'color', title: 'Custom Up', defval: '#00ff00', group: COLOR, inline: 'Custom Palette', display: 'none' },
  { id: 'cpDnC', type: 'color', title: 'Custom Down', defval: '#ff0000', group: COLOR, inline: 'Custom Palette', display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Kalman Baseline [Glow]', color: String(color.new(color.gray, 80)), lineWidth: 6 },
  { id: 'plot1', title: 'Kalman Baseline', color: color.gray, lineWidth: 2 },
  { id: 'plot2', title: 'Upper Band', color: String(color.new(color.gray, 70)), lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: String(color.new(color.gray, 70)), lineWidth: 1 },
];

export const metadata = {
  title: 'Kalman Flow | Lyro RS',
  shortTitle: 'Kalman Flow | Lyro RS',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

const PALETTES: Record<KalmanFlowLyroRsInputs['colMode'], [string, string]> = {
  Classic: ['#00E676', '#880E4F'],
  Mystic: ['#30FDCF', '#E117B7'],
  Accented: ['#9618F7', '#FF0078'],
  Royal: ['#FFC107', '#673AB7'],
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface KalmanVars {
  kfLevel: number;
  kfVeloc: number;
  p11: number;
  p12: number;
  p21: number;
  p22: number;
  /** var int trend = 0 */
  tr: number;
}

interface KalmanRun extends BarRunState<KalmanVars> {
  sma: WindowSma;
  trend: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  fillColors: string[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<KalmanFlowLyroRsInputs>): BarStudy<KalmanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const [upC, dnC] = cfg.cpyn ? [cfg.cpUpC, cfg.cpDnC] : (PALETTES[cfg.colMode]);
  // Two-state Kalman filter (level, velocity)
  const q = Math.pow(10, cfg.sensitivity / 2 - 6);
  const r = 1.0;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const sma = new WindowSma(cfg.volLen);
      const s: KalmanRun = {
        sma, trend: [], plot0: [], plot1: [], plot2: [], plot3: [], fillColors: [], candles: [], flags: [[], [], []],
        times: [[], [], []], markers: [], steps: [sma],
        vars: { kfLevel: NaN, kfVeloc: 0.0, p11: 1.0, p12: 0.0, p21: 0.0, p22: 1.0, tr: 0 },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.trend, s.plot0, s.plot1, s.plot2, s.plot3, s.fillColors, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      if (isNaN(v.kfLevel)) {
        v.kfLevel = src;
      } else {
        const predLevel = v.kfLevel + v.kfVeloc;
        const predVeloc = v.kfVeloc;
        const p11p = v.p11 + v.p12 + v.p21 + v.p22 + q;
        const p12p = v.p12 + v.p22;
        const p21p = v.p21 + v.p22;
        const p22p = v.p22 + q;
        const sv = p11p + r;
        const k1 = p11p / sv;
        const k2 = p21p / sv;
        const innov = src - predLevel;
        v.kfLevel = predLevel + k1 * innov;
        v.kfVeloc = predVeloc + k2 * innov;
        v.p11 = (1 - k1) * p11p;
        v.p12 = (1 - k1) * p12p;
        v.p21 = p21p - k2 * p11p;
        v.p22 = p22p - k2 * p12p;
      }
      const level = v.kfLevel;
      const veloc = v.kfVeloc;

      // Trend engine
      const trackErr = s.sma.step(Math.abs(src - level));
      const upper = level + cfg.madMultp * trackErr;
      const lower = level - cfg.madMultn * trackErr;
      if (gt(b.close, upper) && gt(veloc, 0)) v.tr = 1;
      else if (lt(b.close, lower) && lt(veloc, 0)) v.tr = -1;
      const t = v.tr;
      s.trend[i] = t;

      const trendCol = t === 1 ? upC : t === -1 ? dnC : color.gray;
      // flipUp = trend == 1 and trend[1] != 1 (trend[1] is na on the first bar: the comparison is false)
      const flipUp = i > 0 && t === 1 && s.trend[i - 1] !== 1;
      const flipDown = i > 0 && t === -1 && s.trend[i - 1] !== -1;
      if (cfg.showSignals && flipUp) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: upC, text: '𝓛𝓸𝓷𝓰',
          textColor: '#000000', size: 'small' });
      }
      if (cfg.showSignals && flipDown) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: dnC, text: '𝓢𝓱𝓸𝓻𝓽',
          textColor: '#000000', size: 'small' });
      }
      // plotcandle(open, high, low, close, "Candle Plot", trendCol, trendCol, bordercolor = trendCol)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: trendCol, wickColor: trendCol, borderColor: trendCol };
      s.plot0[i] = { time: b.time, value: level, color: String(color.new(trendCol, 80)) };
      s.plot1[i] = { time: b.time, value: level, color: trendCol };
      s.plot2[i] = { time: b.time, value: cfg.showBands ? upper : NaN, color: String(color.new(trendCol, 70)) };
      s.plot3[i] = { time: b.time, value: cfg.showBands ? lower : NaN, color: String(color.new(trendCol, 70)) };
      s.fillColors[i] = cfg.showBands ? String(color.new(trendCol, 92)) : 'transparent';
      // alertcondition(flipUp), alertcondition(flipDown), alertcondition(flipUp or flipDown)
      const flags = [flipUp, flipDown, flipUp || flipDown];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        // fill(pUp, pDn, color = showBands ? color.new(trendCol, 92) : na, title = "Band Fill")
        fills: [{
          plot1: 'plot2',
          plot2: 'plot3',
          options: { title: 'Band Fill' },
          colors: s.fillColors.slice(),
        }],
        markers: s.markers.slice(),
        plotCandles: { candlePlot: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KalmanFlowLyroRsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KalmanFlowLyroRsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Flip', message: 'Kalman Flow | Lyro RS: Bullish trend flip on {{ticker}} ({{interval}})' },
  { id: 'alert1', title: 'Bearish Trend Flip', message: 'Kalman Flow | Lyro RS: Bearish trend flip on {{ticker}} ({{interval}})' },
  { id: 'alert2', title: 'Any Trend Flip', message: 'Kalman Flow | Lyro RS: Trend flip on {{ticker}} ({{interval}})' },
];

export const KalmanFlowLyroRs = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
