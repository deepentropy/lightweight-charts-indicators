/**
 * Pump & Dump Detector (sensitive)
 *
 * An early signal on a bar whose volume is above a minimum and above its SMA times a multiplier, whose high - low
 * range is above its SMA times a multiplier and whose NATR (ATR / close * 100) is above its SMA times a multiplier:
 * an early pump when the close is above the previous close, an early dump when it is below. A confirmed pump /
 * dump is an early signal with a close-to-close change of at least the pump threshold (%) / at most the dump
 * threshold (%). Each signal draws a marker and a background tint.
 * Alerts (alertcondition, `alerts` of the result): 'Early Pump', 'Confirmed Pump', 'Early Dump' and 'Confirmed Dump'
 * (titles with the original's emoji), true on the bars of each signal.
 *
 * Reference: "Pump & Dump Detector (sensitive)" by btcpayer
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PumpDumpDetectorInputs {
  /** Pump threshold: close-to-close change (%) */
  pumpThreshold: number;
  /** Dump threshold: close-to-close change (%) */
  dumpThreshold: number;
  /** Volume above its SMA times this */
  volumeMultiplier: number;
  /** High - low range above its SMA times this */
  volatilityMultiplier: number;
  /** NATR above its SMA times this */
  natrMultiplier: number;
  /** ATR length of the NATR */
  natrLength: number;
  /** SMA length of the volume, range and NATR averages */
  lookback: number;
  /** Minimum volume */
  minVolume: number;
}

export const defaultInputs: PumpDumpDetectorInputs = {
  pumpThreshold: 2.5,
  dumpThreshold: -2.5,
  volumeMultiplier: 1.8,
  volatilityMultiplier: 1.4,
  natrMultiplier: 1.2,
  natrLength: 7,
  lookback: 5,
  minVolume: 10000,
};

export const inputConfig: InputConfig[] = [
  { id: 'pumpThreshold', type: 'float', title: 'Pump Threshold %', defval: 2.5, min: 0.1 },
  { id: 'dumpThreshold', type: 'float', title: 'Dump Threshold %', defval: -2.5, max: -0.1 },
  { id: 'volumeMultiplier', type: 'float', title: 'Volume Multiplier', defval: 1.8, min: 1.0 },
  { id: 'volatilityMultiplier', type: 'float', title: 'Volatility Multiplier', defval: 1.4, min: 1.0 },
  { id: 'natrMultiplier', type: 'float', title: 'NATR Spike Multiplier', defval: 1.2, min: 1.0 },
  { id: 'natrLength', type: 'int', title: 'NATR Period', defval: 7 },
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 5 },
  { id: 'minVolume', type: 'int', title: 'Min Volume Filter', defval: 10000 },
];

// No plot(): the outputs are markers and background colours
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Pump & Dump Detector (sensitive)',
  shortTitle: 'Pump & Dump Detector (sensitive)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when b - a <= 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface PumpRun extends BarRunState<Record<string, never>> {
  volumeAvg: WindowSma;
  avgBarRange: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  avgNatr: WindowSma;
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PumpDumpDetectorInputs>): BarStudy<PumpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const earlyPumpBg = String(color.new(color.orange, 85));
  const confirmedPumpBg = String(color.new(color.green, 85));
  const earlyDumpBg = String(color.new(color.red, 85));
  const confirmedDumpBg = String(color.new(color.maroon, 85));
  const textColor = color.blue; // no textcolor: the Pine plotshape default text colour
  return {
    init() {
      const volumeAvg = new WindowSma(cfg.lookback);
      const avgBarRange = new WindowSma(cfg.lookback);
      const atr = taStep.atr(cfg.natrLength);
      const avgNatr = new WindowSma(cfg.lookback);
      const s: PumpRun = {
        volumeAvg, avgBarRange, atr, avgNatr, markers: [], bgColors: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [volumeAvg, avgBarRange, atr, avgNatr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const volumeAvg = s.volumeAvg.step(volume);
      const barRange = b.high - b.low;
      const avgBarRange = s.avgBarRange.step(barRange);
      const atr = s.atr.step(b.high, b.low, b.close);
      const natr = (atr / b.close) * 100;
      const avgNatr = s.avgNatr.step(natr);

      const close = b.close;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const priceChange = ((close - close1) / close1) * 100;
      const pricePump = ge(priceChange, cfg.pumpThreshold);
      const priceDump = le(priceChange, cfg.dumpThreshold);
      const volumeSpike = gt(volume, volumeAvg * cfg.volumeMultiplier);
      const volatilitySpike = gt(barRange, avgBarRange * cfg.volatilityMultiplier);
      const natrSpike = gt(natr, avgNatr * cfg.natrMultiplier);
      const base = gt(volume, cfg.minVolume) && volumeSpike && volatilitySpike && natrSpike;
      const earlyPump = base && gt(close, close1);
      const earlyDump = base && lt(close, close1);
      const confirmedPump = pricePump && earlyPump;
      const confirmedDump = priceDump && earlyDump;

      const t = b.time;
      const flags = [earlyPump, confirmedPump, earlyDump, confirmedDump];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }

      const { markers, bgColors } = s;
      // bgcolor / plotshape in the Pine order (a later bgcolor is drawn on top)
      if (earlyPump) {
        bgColors.push({ time: t, color: earlyPumpBg });
        // plotshape(earlyPumpSignal, location.belowbar, color.orange, shape.triangleup, text = "EARLY ↑")
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.orange, text: 'EARLY ↑', textColor, size: 'auto' });
      }
      if (confirmedPump) {
        bgColors.push({ time: t, color: confirmedPumpBg });
        // plotshape(confirmedPumpSignal, location.abovebar, color.lime, shape.labelup, text = "PUMP")
        markers.push({ time: t, position: 'aboveBar', shape: 'labelUp', color: color.lime, text: 'PUMP', textColor, size: 'auto' });
      }
      if (earlyDump) {
        bgColors.push({ time: t, color: earlyDumpBg });
        // plotshape(earlyDumpSignal, location.abovebar, color.red, shape.triangledown, text = "EARLY ↓")
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'EARLY ↓', textColor, size: 'auto' });
      }
      if (confirmedDump) {
        bgColors.push({ time: t, color: confirmedDumpBg });
        // plotshape(confirmedDumpSignal, location.belowbar, color.red, shape.labeldown, text = "DUMP")
        markers.push({ time: t, position: 'belowBar', shape: 'labelDown', color: color.red, text: 'DUMP', textColor, size: 'auto' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(earlyPumpSignal / confirmedPumpSignal / earlyDumpSignal / confirmedDumpSignal)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PumpDumpDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PumpDumpDetectorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '🚨 Early Pump', message: 'EARLY PUMP signal on {{ticker}}' },
  { id: 'alert1', title: '💥 Confirmed Pump', message: 'CONFIRMED PUMP on {{ticker}}' },
  { id: 'alert2', title: '🔻 Early Dump', message: 'EARLY DUMP signal on {{ticker}}' },
  { id: 'alert3', title: '🔥 Confirmed Dump', message: 'CONFIRMED DUMP on {{ticker}}' },
];

export const PumpDumpDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
