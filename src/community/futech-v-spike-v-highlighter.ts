/**
 * FuTech Volume Spike & Volume Highlighter
 *
 * Volume spike: volume above the EMA of volume times a multiplier; the bar is coloured with the up colour when the
 * close is above the previous close, the down colour when it is below. Volume highlighter: the bar with the highest
 * volume of the lookback window gets a background (colour of the candle direction, transparency 90) and a circle at
 * the bottom of the chart.
 * Alerts (alertcondition, `alerts` of the result): volume spike (any, bullish, bearish) and highest volume candle
 * (any, bullish, bearish).
 *
 * Reference: "FuTech : Volume Spike & Volume Highlighter" by Atmiya_aatubhai
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Atmiya_aatubhai
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FuTechVSpikeVHighlighterInputs {
  /** Volume spike: multiplier of the volume EMA */
  thresholdMultiplier: number;
  /** Volume spike: EMA length */
  lookbackSpike: number;
  /** Colour the volume spike bars */
  showVolumeSpikeBarColor: boolean;
  upVolumeSpikeColor: string;
  downVolumeSpikeColor: string;
  /** Volume highlighter: window of the highest volume */
  lookbackHighlighter: number;
  /** Background on the highest volume bars */
  showHighlighterColor: boolean;
  upHighlighterColor: string;
  downHighlighterColor: string;
}

export const defaultInputs: FuTechVSpikeVHighlighterInputs = {
  thresholdMultiplier: 1.5,
  lookbackSpike: 10,
  showVolumeSpikeBarColor: true,
  upVolumeSpikeColor: 'rgb(246, 255, 0)',
  downVolumeSpikeColor: 'rgb(0, 0, 0)',
  lookbackHighlighter: 20,
  showHighlighterColor: true,
  upHighlighterColor: 'rgb(2, 36, 255)',
  downHighlighterColor: 'rgb(255, 0, 0)',
};

export const inputConfig: InputConfig[] = [
  { id: 'thresholdMultiplier', type: 'float', title: 'Volume Spike - Multiplier', defval: 1.5, min: 1, group: 'Volume Spike Settings' },
  { id: 'lookbackSpike', type: 'int', title: 'Volume Spike - Lookback Candles', defval: 10, min: 1, group: 'Volume Spike Settings' },
  { id: 'showVolumeSpikeBarColor', type: 'bool', title: 'Show Volume Spike Candles ?', defval: true, group: 'Volume Spike Settings' },
  { id: 'upVolumeSpikeColor', type: 'color', title: 'Up Volume Spike Color', defval: 'rgb(246, 255, 0)', group: 'Volume Spike Settings' },
  { id: 'downVolumeSpikeColor', type: 'color', title: 'Down Volume Spike Color', defval: 'rgb(0, 0, 0)', group: 'Volume Spike Settings' },
  { id: 'lookbackHighlighter', type: 'int', title: 'Volume Highlighter - Lookback Candles', defval: 20, min: 1, group: 'Volume Highlighter Settings' },
  { id: 'showHighlighterColor', type: 'bool', title: 'Show Volume Highlighter in Background ?', defval: true, group: 'Volume Highlighter Settings' },
  { id: 'upHighlighterColor', type: 'color', title: 'Up Volume Highlighter Color', defval: 'rgb(2, 36, 255)', group: 'Volume Highlighter Settings' },
  { id: 'downHighlighterColor', type: 'color', title: 'Down Volume Highlighter Color', defval: 'rgb(255, 0, 0)', group: 'Volume Highlighter Settings' },
];

/** No plot: the outputs are bar colours, background colours and circle markers */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'FuTech : Volume Spike & Volume Highlighter',
  shortTitle: 'FuTech : Volume Spike & Volume Highlighter',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;
/** Pine a >= b: not (b > a), false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
/** Pine a == b: within 1e-10, false with na */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface FuTechRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  highest: WindowExtreme;
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FuTechVSpikeVHighlighterInputs>): BarStudy<FuTechRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // avgVolume = ta.ema(volume, lookbackSpike); highestVolume = ta.highest(volume, lookbackHighlighter)
      const ema = taStep.ema(cfg.lookbackSpike);
      const highest = new WindowExtreme(false, cfg.lookbackHighlighter);
      const s: FuTechRun = {
        ema, highest, markers: [], barColors: [], bgColors: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [ema, highest], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.barColors, s.bgColors];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = b.volume ?? NaN;
      const avgVolume = s.ema.step(v) ?? NaN;
      const highestVolume = s.highest.step(v) ?? NaN;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const volumeSpike = gt(v, avgVolume * cfg.thresholdMultiplier);
      const isPriceUp = gt(b.close, prevClose);
      const isPriceDown = lt(b.close, prevClose);

      // barcolor(showVolumeSpikeBarColor and volumeSpike ? (isPriceUp ? up : isPriceDown ? down : na) : na)
      if (cfg.showVolumeSpikeBarColor && volumeSpike && (isPriceUp || isPriceDown)) {
        s.barColors.push({ time: b.time, color: isPriceUp ? cfg.upVolumeSpikeColor : cfg.downVolumeSpikeColor });
      }

      // bigVolumeCondition = volume == highestVolume; highlightColor = close >= open ? up : down
      const bigVolumeCondition = eq(v, highestVolume);
      const highlightColor = ge(b.close, b.open) ? cfg.upHighlighterColor : cfg.downHighlighterColor;
      // bgcolor(showHighlighterColor and bigVolumeCondition ? color.new(highlightColor, 90) : na)
      if (cfg.showHighlighterColor && bigVolumeCondition) {
        s.bgColors.push({ time: b.time, color: String(color.new(highlightColor, 90)) });
      }
      // plotshape(bigVolumeCondition, location.bottom, color = highlightColor, shape.circle, size.small)
      if (bigVolumeCondition) {
        s.markers.push({ time: b.time, position: 'bottom', shape: 'circle', color: highlightColor, size: 'small' });
      }
      // bullishVolumeSpike = volumeSpike and isPriceUp; bearishVolumeSpike = volumeSpike and isPriceDown;
      // bullishHighestVolume = bigVolumeCondition and close >= open; bearishHighestVolume = ... and close < open
      const flag = (k: number, f: boolean) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      };
      flag(0, volumeSpike);
      flag(1, volumeSpike && isPriceUp);
      flag(2, volumeSpike && isPriceDown);
      flag(3, bigVolumeCondition);
      flag(4, bigVolumeCondition && ge(b.close, b.open));
      flag(5, bigVolumeCondition && lt(b.close, b.open));
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FuTechVSpikeVHighlighterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FuTechVSpikeVHighlighterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Volume Spike', message: '{{ticker}} Volume Spike detected on {{interval}}' },
  { id: 'alert1', title: 'Bullish Volume Spike', message: '{{ticker}} Bullish Volume Spike on {{interval}}' },
  { id: 'alert2', title: 'Bearish Volume Spike', message: '{{ticker}} Bearish Volume Spike on {{interval}}' },
  { id: 'alert3', title: 'Highest Volume Candle', message: '{{ticker}} Highest Volume candle in lookback period on {{interval}}' },
  { id: 'alert4', title: 'Bullish Highest Volume Candle', message: '{{ticker}} Bullish Highest Volume candle on {{interval}}' },
  { id: 'alert5', title: 'Bearish Highest Volume Candle', message: '{{ticker}} Bearish Highest Volume candle on {{interval}}' },
];

export const FuTechVSpikeVHighlighter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
