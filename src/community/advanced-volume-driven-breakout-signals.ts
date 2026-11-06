/**
 * Advanced Volume-Driven Breakout Signals
 *
 * The volume is split by candle direction (bull volume on up candles, bear volume on down candles). A breakout is a
 * crossover of the bull (bear) volume above its moving average * a multiplier. Volume spikes are crossovers of the
 * volume above the volume MA * a threshold multiplier (significant) or half of it (high). Buy / sell labels need a
 * breakout without a spike, and optionally a relative volume (volume / its MA) above a threshold and a cumulative net
 * volume (CNV) above / below its MA. Overextension arrows mark spikes on up / down candles without a breakout. Bar
 * colours show the raw breakout and spike states; an optional background shows the CNV state.
 * Alerts (alertcondition, `alerts` of the result): buy volume, sell volume, bullish and bearish overextension, each
 * while its alert input is on.
 *
 * Reference: "Advanced Volume-Driven Breakout Signals" by VolumeVigilante
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VolumeVigilante
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AdvancedVolumeDrivenBreakoutSignalsMaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'VWMA';

export interface AdvancedVolumeDrivenBreakoutSignalsInputs {
  /** Alert inputs: the conditions of `alerts` are false while their input is off */
  enableBuyVolumeAlerts: boolean;
  enableSellVolumeAlerts: boolean;
  enableBullishOverextensionAlerts: boolean;
  enableBearishOverextensionAlerts: boolean;
  showOverextensionSignals: boolean;
  showBuySellLabels: boolean;
  showCnvBackground: boolean;
  vfMaType: AdvancedVolumeDrivenBreakoutSignalsMaType;
  vfMaPeriod: number;
  vfBreakoutMultiplier: number;
  vsMaType: AdvancedVolumeDrivenBreakoutSignalsMaType;
  vsMaPeriod: number;
  vsThresholdMultiplier: number;
  useRvol: boolean;
  rvolMaType: AdvancedVolumeDrivenBreakoutSignalsMaType;
  rvolMaPeriod: number;
  rvolThreshold: number;
  useCnv: boolean;
  cnvMaType: AdvancedVolumeDrivenBreakoutSignalsMaType;
  cnvMaPeriod: number;
}

export const defaultInputs: AdvancedVolumeDrivenBreakoutSignalsInputs = {
  enableBuyVolumeAlerts: true,
  enableSellVolumeAlerts: true,
  enableBullishOverextensionAlerts: false,
  enableBearishOverextensionAlerts: false,
  showOverextensionSignals: false,
  showBuySellLabels: true,
  showCnvBackground: false,
  vfMaType: 'VWMA',
  vfMaPeriod: 20,
  vfBreakoutMultiplier: 2.0,
  vsMaType: 'VWMA',
  vsMaPeriod: 20,
  vsThresholdMultiplier: 4.0,
  useRvol: false,
  rvolMaType: 'VWMA',
  rvolMaPeriod: 10,
  rvolThreshold: 2.0,
  useCnv: false,
  cnvMaType: 'VWMA',
  cnvMaPeriod: 10,
};

const MA_TYPES: AdvancedVolumeDrivenBreakoutSignalsMaType[] = ['SMA', 'EMA', 'WMA', 'HMA', 'VWMA'];

export const inputConfig: InputConfig[] = [
  { id: 'enableBuyVolumeAlerts', type: 'bool', title: 'Enable Buy Volume Alerts', defval: true, group: 'Alert Settings' },
  { id: 'enableSellVolumeAlerts', type: 'bool', title: 'Enable Sell Volume Alerts', defval: true, group: 'Alert Settings' },
  { id: 'enableBullishOverextensionAlerts', type: 'bool', title: 'Enable Bullish Overextension Alerts', defval: false, group: 'Alert Settings' },
  { id: 'enableBearishOverextensionAlerts', type: 'bool', title: 'Enable Bearish Overextension Alerts', defval: false, group: 'Alert Settings' },
  { id: 'showOverextensionSignals', type: 'bool', title: 'Show Overextension Signals', defval: false, group: 'Display Settings' },
  { id: 'showBuySellLabels', type: 'bool', title: 'Show Buy/Sell Volume Labels', defval: true, group: 'Display Settings' },
  { id: 'showCnvBackground', type: 'bool', title: 'Show CNV Background', defval: false, group: 'Display Settings' },
  { id: 'vfMaType', type: 'string', title: 'MA Type for VF', defval: 'VWMA', options: MA_TYPES, group: 'Volume Flow (VF) Settings' },
  { id: 'vfMaPeriod', type: 'int', title: 'MA Period for VF', defval: 20, min: 1, group: 'Volume Flow (VF) Settings' },
  { id: 'vfBreakoutMultiplier', type: 'float', title: 'Breakout Multiplier for VF', defval: 2.0, min: 0.0, step: 0.1, group: 'Volume Flow (VF) Settings' },
  { id: 'vsMaType', type: 'string', title: 'MA Type for VS Threshold', defval: 'VWMA', options: MA_TYPES, group: 'Volume Spike (VS) Settings' },
  { id: 'vsMaPeriod', type: 'int', title: 'MA Period for VS Threshold', defval: 20, min: 1, group: 'Volume Spike (VS) Settings' },
  { id: 'vsThresholdMultiplier', type: 'float', title: 'Threshold Multiplier for VS', defval: 4.0, min: 0.0, step: 0.1, group: 'Volume Spike (VS) Settings' },
  { id: 'useRvol', type: 'bool', title: 'Use Relative Volume Filter', defval: false, group: 'Relative Volume (RVOL) Filter' },
  { id: 'rvolMaType', type: 'string', title: 'MA Type for RVOL', defval: 'VWMA', options: MA_TYPES, group: 'Relative Volume (RVOL) Filter' },
  { id: 'rvolMaPeriod', type: 'int', title: 'MA Period for RVOL', defval: 10, min: 1, group: 'Relative Volume (RVOL) Filter' },
  { id: 'rvolThreshold', type: 'float', title: 'RVOL Threshold', defval: 2.0, min: 0.0, step: 0.1, group: 'Relative Volume (RVOL) Filter' },
  { id: 'useCnv', type: 'bool', title: 'Use CNV Filter', defval: false, group: 'Cumulative Net Volume (CNV) Filter' },
  { id: 'cnvMaType', type: 'string', title: 'MA Type for CNV', defval: 'VWMA', options: MA_TYPES, group: 'Cumulative Net Volume (CNV) Filter' },
  { id: 'cnvMaPeriod', type: 'int', title: 'MA Period for CNV', defval: 10, min: 1, group: 'Cumulative Net Volume (CNV) Filter' },
];

// No plot(): the outputs are bar colours, a background colour and plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'VolumeVigilante | Advanced Volume-Driven Breakout Signals',
  shortTitle: 'VolumeVigilante | Advanced Volume-Driven Breakout Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

const OFFSET_POINTS = 0.02;
const VS_MID_DIV = 2.0;
const INFO_COLOR = '#2962FF';
const BEAR_COLOR = '#FF5252';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };
type Cross = ReturnType<typeof taStep.crossover>;

/** calculateMa(maType, source, length) stepped bar by bar (only the selected average) */
function maStep(maType: string, length: number): Ma {
  switch (maType) {
    case 'SMA': { const m = new WindowSma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'HMA': {
      // ta.wma(2 * ta.wma(source, length / 2) - ta.wma(source, length), math.round(math.sqrt(length))):
      // length / 2 keeps the fractional quotient (Pine v6); ta.wma uses the integer part of its length
      const half = taStep.wma();
      const full = taStep.wma();
      const outer = taStep.wma();
      const outerLen = Math.round(Math.sqrt(length));
      return {
        step: (v) => outer.step(2 * half.step(v, length / 2) - full.step(v, length), outerLen),
        commit: () => { half.commit(); full.commit(); outer.commit(); },
      };
    }
    case 'VWMA': {
      // ta.sma(source * volume, length) / ta.sma(volume, length), na when the volume average is 0 or na
      const len = Math.floor(length);
      const num = new WindowSum(length);
      const den = new WindowSum(length);
      return {
        step: (v, volume) => {
          const nu = num.step(v * volume) / len;
          const d = den.step(volume) / len;
          return d === 0 || isNaN(d) ? NaN : nu / d;
        },
        commit: () => { num.commit(); den.commit(); },
      };
    }
    default: return { step: () => NaN, commit: () => {} };
  }
}

interface VolumeRun extends BarRunState<Record<string, never>> {
  avgVolume: Ma | null;
  vsMa: Ma;
  bullMa: Ma;
  bearMa: Ma;
  cnvMa: Ma | null;
  buyCross: Cross;
  sellCross: Cross;
  sigCross: Cross;
  highCross: Cross;
  change: ReturnType<typeof taStep.change>;
  cum: ReturnType<typeof taStep.cum>;
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdvancedVolumeDrivenBreakoutSignalsInputs>): BarStudy<VolumeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const vsHighColor = String(color.rgb(255, 165, 0, 25));
  const vsSignifColor = String(color.rgb(255, 255, 0, 25));
  const cnvBullBg = String(color.new(INFO_COLOR, 85));
  const cnvBearBg = String(color.new(BEAR_COLOR, 85));
  return {
    init() {
      const s: VolumeRun = {
        avgVolume: cfg.useRvol ? maStep(cfg.rvolMaType, cfg.rvolMaPeriod) : null,
        vsMa: maStep(cfg.vsMaType, cfg.vsMaPeriod),
        bullMa: maStep(cfg.vfMaType, cfg.vfMaPeriod),
        bearMa: maStep(cfg.vfMaType, cfg.vfMaPeriod),
        cnvMa: cfg.useCnv ? maStep(cfg.cnvMaType, cfg.cnvMaPeriod) : null,
        buyCross: taStep.crossover(), sellCross: taStep.crossover(), sigCross: taStep.crossover(),
        highCross: taStep.crossover(), change: taStep.change(), cum: taStep.cum(),
        markers: [], barColors: [], bgColors: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        ...(s.avgVolume ? [s.avgVolume] : []), s.vsMa, s.bullMa, s.bearMa, ...(s.cnvMa ? [s.cnvMa, s.change, s.cum] : []),
        s.buyCross, s.sellCross, s.sigCross, s.highCross,
      ];
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // Volume split (candle direction)
      const bullVolume = gt(b.close, b.open) ? volume : 0.0;
      const bearVolume = gt(b.open, b.close) ? volume : 0.0;

      // RVOL
      const rvol = s.avgVolume ? volume / s.avgVolume.step(volume, volume) : NaN;

      // Volume spike thresholds
      const vsHighThreshold = s.vsMa.step(volume, volume) * cfg.vsThresholdMultiplier;
      const vsMidThreshold = vsHighThreshold / VS_MID_DIV;

      // Volume flow baselines
      const bullMa = s.bullMa.step(bullVolume, volume);
      const bearMa = s.bearMa.step(bearVolume, volume);

      // Breakout signals and spike states (ta.crossover compares exactly)
      const buyVolumeSignal = !!s.buyCross.step(bullVolume, bullMa * cfg.vfBreakoutMultiplier);
      const sellVolumeSignal = !!s.sellCross.step(bearVolume, bearMa * cfg.vfBreakoutMultiplier);
      const vsSignificant = !!s.sigCross.step(volume, vsHighThreshold);
      const vsHigh = !!s.highCross.step(volume, vsMidThreshold);

      // CNV
      let smoothedCnv = NaN;
      if (s.cnvMa) {
        const c = s.change.step(b.close);
        const netVolume = gt(c, 0) ? volume : lt(c, 0) ? -volume : 0.0;
        const cumulativeNetVolume = s.cum.step(netVolume);
        smoothedCnv = cumulativeNetVolume - s.cnvMa.step(cumulativeNetVolume, volume);
      }

      const cnvBullishCondition = cfg.useCnv ? gt(smoothedCnv, 0) : true;
      const cnvBearishCondition = cfg.useCnv ? le(smoothedCnv, 0) : true;
      const rvolOk = !cfg.useRvol || gt(rvol, cfg.rvolThreshold);
      const spikeBlock = vsHigh || vsSignificant;
      const buyVolumeCondition = buyVolumeSignal && rvolOk && cnvBullishCondition && !spikeBlock;
      const sellVolumeCondition = sellVolumeSignal && rvolOk && cnvBearishCondition && !spikeBlock;
      const bearishOverextension = spikeBlock && lt(b.close, b.open) && rvolOk && !sellVolumeSignal;
      const bullishOverextension = spikeBlock && gt(b.close, b.open) && rvolOk && !buyVolumeSignal;
      const flags = [
        cfg.enableBuyVolumeAlerts && buyVolumeCondition,
        cfg.enableSellVolumeAlerts && sellVolumeCondition,
        cfg.enableBullishOverextensionAlerts && bullishOverextension,
        cfg.enableBearishOverextensionAlerts && bearishOverextension,
      ];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }

      // barcolor(buyVolumeSignal ? INFO : sellVolumeSignal ? BEAR : vsHigh ? VS_HIGH : vsSignificant ? VS_SIGNIF : na)
      const bc = buyVolumeSignal ? INFO_COLOR : sellVolumeSignal ? BEAR_COLOR
        : vsHigh ? vsHighColor : vsSignificant ? vsSignifColor : null;
      if (bc) s.barColors.push({ time: b.time, color: bc });

      // bgcolor(showCnvBackground and useCnv ? (cnvBullishCondition ? CNV_BULL_BG : CNV_BEAR_BG) : na)
      if (cfg.showCnvBackground && cfg.useCnv) {
        s.bgColors.push({ time: b.time, color: cnvBullishCondition ? cnvBullBg : cnvBearBg });
      }

      // plotshape series: a price (low - 0.02, high + 0.02, ...) when the condition holds, else na; the location is
      // abovebar / belowbar, so the price only decides whether the shape is drawn
      const markers = s.markers;
      if (cfg.showBuySellLabels && buyVolumeCondition && !isNaN(b.low - OFFSET_POINTS)) {
        markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: INFO_COLOR, text: 'BUY VOL',
          textColor: color.white, size: 'tiny' });
      }
      if (cfg.showBuySellLabels && sellVolumeCondition && !isNaN(b.high + OFFSET_POINTS)) {
        markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: BEAR_COLOR, text: 'SELL VOL',
          textColor: color.white, size: 'tiny' });
      }
      // "Bearish Overextension Signal": arrow up below the bar; "Bullish Overextension Signal": arrow down above the bar
      if (cfg.showOverextensionSignals && bearishOverextension && !isNaN(b.high + OFFSET_POINTS * 4)) {
        markers.push({ time: b.time, position: 'belowBar', shape: 'arrowUp', color: INFO_COLOR, text: 'OVER',
          textColor: color.white, size: 'tiny' });
      }
      if (cfg.showOverextensionSignals && bullishOverextension && !isNaN(b.low - OFFSET_POINTS * 4)) {
        markers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: BEAR_COLOR, text: 'OVER',
          textColor: color.white, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        // 4 alertconditions: buy volume, sell volume, bullish / bearish overextension
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdvancedVolumeDrivenBreakoutSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdvancedVolumeDrivenBreakoutSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Volume Vigilante | AVDBS | Buy Volume', message: 'VV AVDBS: Buy Volume signal detected on {{ticker}}.' },
  { id: 'alert1', title: 'Volume Vigilante | AVDBS | Sell Volume', message: 'VV AVDBS: Sell Volume signal detected on {{ticker}}.' },
  { id: 'alert2', title: 'Volume Vigilante | AVDBS | Bullish Overextension', message: 'VV AVDBS: Bullish overextension detected on {{ticker}}.' },
  { id: 'alert3', title: 'Volume Vigilante | AVDBS | Bearish Overextension', message: 'VV AVDBS: Bearish overextension detected on {{ticker}}.' },
];

export const AdvancedVolumeDrivenBreakoutSignals = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, alertConditions };
