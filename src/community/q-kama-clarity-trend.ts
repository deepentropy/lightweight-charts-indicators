/**
 * Q KAMA Clarity Trend
 *
 * The source is smoothed by a Gaussian-weighted window (weights exp(-0.5 * ((i - (len - 1) / 2) / sigma)^2)), then
 * a Kaufman adaptive moving average (KAMA) of it is taken: efficiency ratio over `lenKAMA` bars, fast 2 / slow 30
 * smoothing constants. The trend turns up when the close goes above KAMA + ATR * multiplier and down when it goes
 * below KAMA - ATR * multiplier (or, as an option, when the close crosses KAMA). The KAMA line and a shadow fill to
 * hl2 take the trend colour; a ⦿ mark on the line and an arrow show each trend change.
 * Alerts (alertcondition, `alerts` of the result): 'Uptrend Started' and 'Downtrend Started', true on the trend
 * changes to up / down.
 *
 * Reference: "Q KAMA Clarity Trend " by Quantora
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Quantora
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface QKamaClarityTrendInputs {
  upTrendColor: string;
  downTrendColor: string;
  /** Shadow fill between the KAMA line and hl2 */
  showShadow: boolean;
  /** Gaussian filter length */
  lenGaussian: number;
  /** Gaussian filter sigma */
  sigma: number;
  src: SourceType;
  /** KAMA length (efficiency ratio window) */
  lenKAMA: number;
  lenATR: number;
  multATR: number;
  /** Trend from the close crossing KAMA instead of the ATR channel */
  useSimpleTrend: boolean;
}

export const defaultInputs: QKamaClarityTrendInputs = {
  upTrendColor: '#17dfad',
  downTrendColor: '#dd326b',
  showShadow: true,
  lenGaussian: 4,
  sigma: 2.0,
  src: 'close',
  lenKAMA: 45,
  lenATR: 14,
  multATR: 1.5,
  useSimpleTrend: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'upTrendColor', type: 'color', title: 'Uptrend Color', defval: '#17dfad' },
  { id: 'downTrendColor', type: 'color', title: 'Downtrend Color', defval: '#dd326b' },
  { id: 'showShadow', type: 'bool', title: 'Shadow Fill', defval: true },
  { id: 'lenGaussian', type: 'int', title: 'Gaussian Length', defval: 4 },
  { id: 'sigma', type: 'float', title: 'Gaussian Sigma', defval: 2.0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'lenKAMA', type: 'int', title: 'KAMA Length', defval: 45 },
  { id: 'lenATR', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'multATR', type: 'float', title: 'ATR Multiplier', defval: 1.5 },
  { id: 'useSimpleTrend', type: 'bool', title: 'Use Price Cross KAMA for Trend', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KAMA Trend Line', color: '#17dfad', lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Hidden Price Plot', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Q KAMA Clarity Trend ',
  shortTitle: 'Q KAMA Clarity Trend ',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS) && !(b - a > EPS);
const nz = (v: number, r = 0) => (isNaN(v) ? r : v);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QKamaVars {
  /** volatility := nz(volatility[1]) + change - nz(change[lenKAMA]) */
  vol: number;
}

interface QKamaRun extends BarRunState<QKamaVars> {
  atr: ReturnType<typeof taStep.atr>;
  src: number[];
  filt: number[];
  change: number[];
  kama: number[];
  trend: number[];
  kamaData: Point[];
  hl2Data: Point[];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QKamaClarityTrendInputs>): BarStudy<QKamaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // gaussianFilter(src, len, sigma): (len - 1) / 2 is a float division in Pine v6
  const gl = cfg.lenGaussian;
  const weights: number[] = [];
  for (let k = 0; k <= gl - 1; k++) weights.push(Math.exp(-0.5 * Math.pow((k - (gl - 1) / 2) / cfg.sigma, 2)));
  const L = cfg.lenKAMA;
  const fastSC = 2 / (2 + 1);
  const slowSC = 2 / (30 + 1);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(cfg.lenATR);
      const s: QKamaRun = {
        atr, src: [], filt: [], change: [], kama: [], trend: [], kamaData: [], hl2Data: [], fillColors: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [atr], vars: { vol: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.src, s.filt, s.change, s.kama, s.trend, s.kamaData, s.hl2Data, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = s.src;
      const filt = s.filt;
      const change = s.change;
      const kama = s.kama;
      const trend = s.trend;
      src[i] = value(b);
      let totalWeight = 0;
      let weightedSum = 0;
      for (let k = 0; k <= gl - 1; k++) {
        totalWeight += weights[k];
        weightedSum += (i - k >= 0 ? src[i - k] : NaN) * weights[k];
      }
      filt[i] = weightedSum / totalWeight;

      // KAMA
      change[i] = i > 0 ? Math.abs(filt[i] - filt[i - 1]) : NaN;
      // volatility := nz(volatility[1]) + change - nz(change[lenKAMA])
      const vol = nz(s.vars.vol) + change[i] - nz(i - L >= 0 ? change[i - L] : NaN);
      s.vars.vol = vol;
      const direction = i - L >= 0 ? Math.abs(filt[i] - filt[i - L]) : NaN;
      const er = direction / (eq(vol, 0) ? 1 : vol);
      const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
      // kama := nz(kama[1] + sc * (filteredSrc - kama[1])); kama[1] is na on the first bar
      const prevK = i > 0 ? kama[i - 1] : NaN;
      kama[i] = nz(prevK + sc * (filt[i] - prevK));

      // ATR channel and trend
      const atr = s.atr.step(b.high, b.low, b.close) * cfg.multATR;
      const c = b.close;
      const prev = i > 0 ? trend[i - 1] : 0;
      const upper = kama[i] + atr;
      const lower = kama[i] - atr;
      trend[i] = cfg.useSimpleTrend
        ? gt(c, kama[i]) ? 1 : lt(c, kama[i]) ? -1 : prev
        : gt(c, upper) ? 1 : lt(c, lower) ? -1 : prev;

      const tr = trend[i];
      const trendColor = tr === 1 ? cfg.upTrendColor : tr === -1 ? cfg.downTrendColor : color.gray;
      // alertcondition(trendChanged and trend == 1 / trend == -1)
      const up = i > 0 && tr !== trend[i - 1] && tr === 1;
      const down = i > 0 && tr !== trend[i - 1] && tr === -1;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(t as number);
      if (down) s.times[1].push(t as number);
      // trendChanged = ta.change(trend) != 0 (na on the first bar)
      if (i > 0 && tr !== trend[i - 1]) {
        const col = tr === 1 ? cfg.upTrendColor : cfg.downTrendColor;
        // plotchar(trendChanged ? kama : na, "Trend Change Marker", "⦿", location.absolute, size.tiny, color = col)
        s.markers.push({ time: t, position: 'atPriceMiddle', price: kama[i], shape: 'circle', color: 'transparent', text: '⦿',
          textColor: col, size: 'tiny' });
        // plotshape(trendChanged and trend == 1, "Buy Arrow", location.belowbar, shape.triangleup, upTrendColor, size.small)
        if (tr === 1) {
          s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.upTrendColor, size: 'small' });
        }
        // plotshape(trendChanged and trend == -1, "Sell Arrow", location.abovebar, shape.triangledown, downTrendColor, size.small)
        if (tr === -1) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.downTrendColor, size: 'small' });
        }
      }
      // plot(kama, "KAMA Trend Line", color = trendColor, linewidth = 2, style = plot.style_linebr)
      s.kamaData[i] = { time: t, value: kama[i], color: trendColor };
      // plot(hl2, "Hidden Price Plot", display = display.none)
      s.hl2Data[i] = { time: t, value: (b.high + b.low) / 2 };
      // fill(plotKAMA, hiddenPricePlot, color.new(trendColor, showShadow ? 80 : 100))
      s.fillColors[i] = String(color.new(trendColor, cfg.showShadow ? 80 : 100));
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.kamaData.slice(), plot1: s.hl2Data.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QKamaClarityTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<QKamaClarityTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Uptrend Started', message: 'Uptrend started on {{ticker}}' },
  { id: 'alert1', title: 'Downtrend Started', message: 'Downtrend started on {{ticker}}' },
];

export const QKamaClarityTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
