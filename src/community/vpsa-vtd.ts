/**
 * VPSA-VTD (Volume Price Spread Analysis with a Volume Trend Detector)
 *
 * The spread (high - low) and the volume are normalised to 0..1 between their lowest and highest values of the
 * last `VPSA period` bars (0 when the range is 0 or not yet known). Their z-scores (value - EMA) / stdev colour the
 * normalised volume columns and the normalised spread candles (drawn from 0 to the value): blue below 1, green from
 * 1 to 2, red above 2, fuchsia above 3. The Volume Trend Detector compares the SMA of the volume with the same SMA
 * `period - 1` bars before ('SMA' mode, the SMA is drawn scaled by its highest value so far), or checks that the
 * volume rose / fell on each of the last `period` steps ('Step By Step' mode); all bars of the period can be
 * required to be bullish or bearish. A label at the top of the pane marks the bars of the chosen trend.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): with the combined alert off, 'Conditions met:
 * Spread & Volume.' when the four spread / volume conditions (normalised value and z-score against their thresholds)
 * hold and 'Condition met: Volume Trend Detector' on a trend bar; with it on, 'Conditions met: Spread, Volume & Volume
 * Trend Detector.' when the normalised spread condition holds on a trend bar.
 *
 * Reference: "VPSA-VTD" by CatTheTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © CatTheTrader
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';
import type { AlertCall, MarkerData, PlotCandleData } from '../types';

/** The original makes alert() calls */
export const hasAlertFunction = true;

const CONDITIONS = ['greater than or equal to', 'less than or equal to'];

export interface VpsaVtdInputs {
  /** Period of the normalisation and of the z-scores */
  nvsaPeriod: number;
  /** Period of the Volume Trend Detector */
  voldecPeriod: number;
  /** Alert thresholds and conditions (alert() calls only: no drawn output) */
  alertSpreadNormalized: number;
  alertVolumeNormalized: number;
  alertSpreadSigma: number;
  alertVolumeSigma: number;
  spreadCondition: string;
  volumeCondition: string;
  spreadSigmaCondition: string;
  volumeSigmaCondition: string;
  /** 'SMA' or 'Step By Step' */
  trendType: string;
  /** 'Upward' or 'Downward' */
  trendDirection: string;
  /** 'Any', 'Bullish only' or 'Bearish only' */
  barType: string;
  enableCombinedAlert: boolean;
}

export const defaultInputs: VpsaVtdInputs = {
  nvsaPeriod: 14,
  voldecPeriod: 14,
  alertSpreadNormalized: 0.2,
  alertVolumeNormalized: 0.2,
  alertSpreadSigma: 1,
  alertVolumeSigma: 1,
  spreadCondition: 'greater than or equal to',
  volumeCondition: 'greater than or equal to',
  spreadSigmaCondition: 'greater than or equal to',
  volumeSigmaCondition: 'greater than or equal to',
  trendType: 'SMA',
  trendDirection: 'Upward',
  barType: 'Any',
  enableCombinedAlert: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'nvsaPeriod', type: 'int', title: 'VPSA period for analysis', defval: 14, min: 1, group: 'VPSA Analysis' },
  { id: 'voldecPeriod', type: 'int', title: 'Volume Trend Detector period for analysis', defval: 14, min: 2, group: 'Volume Trend Detector' },
  { id: 'alertSpreadNormalized', type: 'float', title: 'Normalized Spread alert threshold', defval: 0.2, min: 0.01, max: 1, group: 'VPSA Analysis' },
  { id: 'alertVolumeNormalized', type: 'float', title: 'Normalized Volume alert threshold', defval: 0.2, min: 0.01, max: 1, group: 'VPSA Analysis' },
  { id: 'alertSpreadSigma', type: 'float', title: 'Spread Z-SCORE alert threshold', defval: 1, min: 0, group: 'VPSA Analysis' },
  { id: 'alertVolumeSigma', type: 'float', title: 'Volume Z-SCORE alert threshold', defval: 1, min: 0, group: 'VPSA Analysis' },
  { id: 'spreadCondition', type: 'string', title: 'Spread condition', defval: CONDITIONS[0], options: CONDITIONS, group: 'VPSA Analysis' },
  { id: 'volumeCondition', type: 'string', title: 'Volume condition', defval: CONDITIONS[0], options: CONDITIONS, group: 'VPSA Analysis' },
  { id: 'spreadSigmaCondition', type: 'string', title: 'Spread Z-SCORE condition', defval: CONDITIONS[0], options: CONDITIONS, group: 'VPSA Analysis' },
  { id: 'volumeSigmaCondition', type: 'string', title: 'Volume Z-SCORE condition', defval: CONDITIONS[0], options: CONDITIONS, group: 'VPSA Analysis' },
  { id: 'trendType', type: 'string', title: 'Method of trend determination', defval: 'SMA', options: ['SMA', 'Step By Step'], group: 'Volume Trend Detector' },
  { id: 'trendDirection', type: 'string', title: 'Trend direction', defval: 'Upward', options: ['Upward', 'Downward'], group: 'Volume Trend Detector' },
  { id: 'barType', type: 'string', title: 'Candle type', defval: 'Any', options: ['Any', 'Bullish only', 'Bearish only'], group: 'Volume Trend Detector' },
  { id: 'enableCombinedAlert', type: 'bool', title: 'Enable combined alert for VPSA and Volume Trend Detector', defval: true, group: 'Alerts' },
];

const SMA_COL = String(color.new(color.red, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume SMA', color: SMA_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Normalized Volume', color: color.blue, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'VPSA-VTD',
  shortTitle: 'VPSA-VTD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Pine plotshape default text colour */
const PINE_TEXT = '#2962FF';
/** plotcandle without wickcolor / bordercolor: the style defaults of the plot (no colorer) */
const CANDLE_WICK = '#737375';
const CANDLE_BORDER = '#000000';

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]>; alertCalls: AlertCall[];
};
type Point = { time: number; value: number; color: string };

interface VpsaVars {
  /** var float sma_max_global = 0.0 */
  smaMaxGlobal: number;
  /** The counter of ta.rising / ta.falling (rises / falls in a row of the called volumes) */
  stepCount: number;
}

interface VpsaRun extends BarRunState<VpsaVars> {
  spreadEma: ReturnType<typeof taStep.ema>;
  spreadSd: WindowStdev;
  volumeEma: ReturnType<typeof taStep.ema>;
  volumeSd: WindowStdev;
  spreadLo: WindowExtreme;
  spreadHi: WindowExtreme;
  volumeLo: WindowExtreme;
  volumeHi: WindowExtreme;
  smaVol: WindowSma;
  smaVolume: number[];
  /** Bars of the candle type in a row up to each bar */
  typeRun: number[];
  /** The volume where f_checkStepTrend calls ta.rising / ta.falling, else na */
  called: number[];
  plot0: Point[];
  plot1: Point[];
  candles: PlotCandleData[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<VpsaVtdInputs>): BarStudy<VpsaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.nvsaPeriod;
  const vlen = cfg.voldecPeriod;
  // f_checkAllBarsType(length, bar_type): false while bar_index < length, else every bar of the last length bars
  // (k = 0 to length - 1) is of the type: the bars of the type in a row reach that count
  const needed = vlen - 1 >= 0 ? Math.floor(vlen - 1) + 1 : 0;
  const isBarType = (b: Bar) => {
    if (cfg.barType === 'Bullish only') return gt(b.close, b.open);
    if (cfg.barType === 'Bearish only') return lt(b.close, b.open);
    return cfg.barType === 'Any';
  };
  const zColor = (z: number) => (gt(z, 3) ? color.fuchsia : gt(z, 2) ? color.red : lt(z, 1) ? color.blue : color.green);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  // Alert conditions: value >= threshold or value <= threshold, as the condition input says
  const check = (cond: string, v: number, thr: number) =>
    (cond === 'greater than or equal to' && ge(v, thr)) || (cond === 'less than or equal to' && le(v, thr));
  const step = cfg.trendType === 'Step By Step';
  const up = cfg.trendDirection === 'Upward';
  return {
    init() {
      const spreadEma = taStep.ema(len);
      const spreadSd = new WindowStdev(len);
      const volumeEma = taStep.ema(len);
      const volumeSd = new WindowStdev(len);
      const spreadLo = new WindowExtreme(true, len);
      const spreadHi = new WindowExtreme(false, len);
      const volumeLo = new WindowExtreme(true, len);
      const volumeHi = new WindowExtreme(false, len);
      const smaVol = new WindowSma(vlen);
      const s: VpsaRun = {
        spreadEma, spreadSd, volumeEma, volumeSd, spreadLo, spreadHi, volumeLo, volumeHi, smaVol, smaVolume: [],
        typeRun: [], called: [], plot0: [], plot1: [], candles: [], markers: [], alertCalls: [],
        steps: [spreadEma, spreadSd, volumeEma, volumeSd, spreadLo, spreadHi, volumeLo, volumeHi, smaVol],
        vars: { smaMaxGlobal: 0.0, stepCount: 0 }, lists: [], series: [],
      };
      s.lists = [s.candles, s.markers, s.alertCalls];
      s.series = [s.smaVolume, s.typeRun, s.called, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const spread = b.high - b.low;
      const volume = b.volume ?? NaN;

      // f_zscore_ema(src, length) = (src - ta.ema(src, length)) / ta.stdev(src, length); plain division
      const spreadZ = (spread - s.spreadEma.step(spread)) / s.spreadSd.step(spread);
      const volumeZ = (volume - s.volumeEma.step(volume)) / s.volumeSd.step(volume);

      // f_normalize: diff != 0.0 ? (src - min) / diff : 0.0 (0.0 while diff is na)
      const sLo = s.spreadLo.step(spread);
      const sDiff = s.spreadHi.step(spread) - sLo;
      const spreadNorm = ne(sDiff, 0) ? (spread - sLo) / sDiff : 0.0;
      const vLo = s.volumeLo.step(volume);
      const vDiff = s.volumeHi.step(volume) - vLo;
      const volumeNorm = ne(vDiff, 0) ? (volume - vLo) / vDiff : 0.0;

      // SMA of the volume, scaled by its highest value so far
      const smaVolume = s.smaVol.step(volume);
      s.smaVolume[i] = smaVolume;
      v.smaMaxGlobal = Math.max(v.smaMaxGlobal, isNaN(smaVolume) ? 0.0 : smaVolume);
      const smaScaled = gt(v.smaMaxGlobal, 0) ? smaVolume / v.smaMaxGlobal : 0.0;

      const run = isBarType(b) ? (i > 0 ? s.typeRun[i - 1] : 0) + 1 : 0;
      s.typeRun[i] = run;
      const allType = !(i < vlen) && run >= needed;
      let conditionVtd: boolean;
      if (cfg.trendType === 'SMA') {
        const smaFirst = i - (vlen - 1) >= 0 ? s.smaVolume[i - (vlen - 1)] : NaN;
        conditionVtd = up ? gt(smaVolume, smaFirst) && allType : lt(smaVolume, smaFirst) && allType;
      } else {
        // f_checkStepTrend: ta.rising / ta.falling(volume, length) run only on the bars where all bars are of the type,
        // so their history holds the volumes of those bars only (na on the other bars: not called)
        const called = allType ? volume : NaN;
        s.called[i] = called;
        const prev = i > 0 ? s.called[i - 1] : NaN;
        if (Number.isFinite(called) && Number.isFinite(prev)) {
          v.stepCount = (up ? gt(called, prev) : lt(called, prev)) ? v.stepCount + 1 : 0;
        }
        conditionVtd = allType && v.stepCount >= vlen;
      }

      s.plot0[i] = { time, value: cfg.trendType === 'SMA' ? fin(smaScaled) : NaN, color: SMA_COL };
      s.plot1[i] = { time, value: fin(volumeNorm), color: zColor(volumeZ) };

      // plotcandle(0, 0, 0, spread_normalized, 'Normalized Spread', color = spread_color)
      if (Number.isFinite(spreadNorm)) {
        s.candles.push({ time, open: 0, high: 0, low: 0, close: spreadNorm, color: zColor(spreadZ),
          wickColor: CANDLE_WICK, borderColor: CANDLE_BORDER });
      }

      if (conditionVtd) {
        const markers = s.markers;
        if (step && up) markers.push({ id: 'shape0', time, position: 'top', shape: 'labelUp', color: color.green, text: 'Step Up', textColor: PINE_TEXT, size: 'auto' });
        if (step && !up) markers.push({ id: 'shape1', time, position: 'top', shape: 'labelDown', color: color.red, text: 'Step Down', textColor: PINE_TEXT, size: 'auto' });
        if (!step && up) markers.push({ id: 'shape2', time, position: 'top', shape: 'labelUp', color: color.lime, text: 'SMA Up', textColor: PINE_TEXT, size: 'auto' });
        if (!step && !up) markers.push({ id: 'shape3', time, position: 'top', shape: 'labelDown', color: color.maroon, text: 'SMA Down', textColor: PINE_TEXT, size: 'auto' });
      }

      const call = (message: string) => s.alertCalls.push({ time, message, freq: 'once_per_bar' });
      const spreadAlert = check(cfg.spreadCondition, spreadNorm, cfg.alertSpreadNormalized);
      const spreadSigmaAlert = check(cfg.spreadSigmaCondition, spreadZ, cfg.alertSpreadSigma);
      const volumeAlert = check(cfg.volumeCondition, volumeNorm, cfg.alertVolumeNormalized);
      const volumeSigmaAlert = check(cfg.volumeSigmaCondition, volumeZ, cfg.alertVolumeSigma);
      if (!cfg.enableCombinedAlert && spreadAlert && spreadSigmaAlert && volumeAlert && volumeSigmaAlert) {
        call('Conditions met: Spread & Volume.');
      }
      if (!cfg.enableCombinedAlert && conditionVtd) call('Condition met: Volume Trend Detector');
      // combined_alert_condition = spread_alert_condition and condition_vtd
      if (cfg.enableCombinedAlert && spreadAlert && conditionVtd) {
        call('Conditions met: Spread, Volume & Volume Trend Detector.');
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        plotCandles: { normalizedSpread: s.candles.slice() },
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VpsaVtdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VpsaVtdInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]>; alertCalls: AlertCall[];
} {
  return fullResult(createRun(inputs).update(bars));
}

export const VpsaVtd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
