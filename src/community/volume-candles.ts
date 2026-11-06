/**
 * Volume Candles
 *
 * Colours the price bars by volume: green on bars with close >= open, red on the others, in three tiers.
 * Percentile Ranking mode: the rank is the share of the last `length` volumes (current bar included) that are below
 * the current volume, in percent; under 50 gives the low tier, under 80 the medium tier, else the high tier.
 * Volume Average mode: volume below half of its SMA gives the low tier, up to 1.5 times the SMA the medium tier,
 * else the high tier. The default low tier colours are fully transparent (the bar keeps its own colour).
 *
 * Reference: "Volume Candles" by alexrainman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © alexrainman
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeCandlesInputs {
  /** 'Percentile Ranking' or 'Volume Average' */
  mode: string;
  /** Ranking lookback (also the SMA length of the Volume Average mode) */
  length: number;
  bullishHigh: string;
  bullishMedium: string;
  bullishLow: string;
  bearishHigh: string;
  bearishMedium: string;
  bearishLow: string;
}

export const defaultInputs: VolumeCandlesInputs = {
  mode: 'Percentile Ranking',
  length: 20,
  bullishHigh: 'rgba(10, 153, 134, 1)',
  bullishMedium: 'rgba(10, 153, 134, 0.6)',
  bullishLow: 'rgba(10, 153, 134, 0)',
  bearishHigh: 'rgba(242, 54, 69, 1)',
  bearishMedium: 'rgba(242, 54, 69, 0.6)',
  bearishLow: 'rgba(242, 54, 69, 0)',
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'mode', defval: 'Percentile Ranking', options: ['Percentile Ranking', 'Volume Average'] },
  { id: 'length', type: 'int', title: 'Ranking Lookback', defval: 20 },
  { id: 'bullishHigh', type: 'color', title: 'Bright Green', defval: defaultInputs.bullishHigh },
  { id: 'bullishMedium', type: 'color', title: 'Medium Green', defval: defaultInputs.bullishMedium },
  { id: 'bullishLow', type: 'color', title: 'Dark Green', defval: defaultInputs.bullishLow },
  { id: 'bearishHigh', type: 'color', title: 'Bright Red', defval: defaultInputs.bearishHigh },
  { id: 'bearishMedium', type: 'color', title: 'Medium Red', defval: defaultInputs.bearishMedium },
  { id: 'bearishLow', type: 'color', title: 'Dark Red', defval: defaultInputs.bearishLow },
];

// Only bar colours (barcolor): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Candles',
  shortTitle: 'VC',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface VolumeCandlesRun extends BarRunState<Record<string, never>> {
  avrg: WindowSma;
  volume: number[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VolumeCandlesInputs>): BarStudy<VolumeCandlesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // avrg = ta.sma(volume, length): computed on every bar
      const avrg = new WindowSma(cfg.length);
      const s: VolumeCandlesRun = { avrg, volume: [], barColors: [], steps: [avrg], vars: {}, lists: [], series: [] };
      s.series = [s.volume, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = s.volume;
      volume[i] = b.volume ?? NaN;
      const a = s.avrg.step(volume[i]);
      let bullColor: string;
      let bearColor: string;
      if (cfg.mode === 'Percentile Ranking') {
        // for i = 0 to length - 1: rank += volume > volume[i] ? 1 : 0 (volume[i] before bar 0 is na: false)
        let rank = 0;
        for (let k = 0; k <= cfg.length - 1; k++) {
          if (i - k >= 0 && gt(volume[i], volume[i - k])) rank += 1;
        }
        const volPercentile = (rank / cfg.length) * 100;
        bullColor = lt(volPercentile, 50) ? cfg.bullishLow : lt(volPercentile, 80) ? cfg.bullishMedium : cfg.bullishHigh;
        bearColor = lt(volPercentile, 50) ? cfg.bearishLow : lt(volPercentile, 80) ? cfg.bearishMedium : cfg.bearishHigh;
      } else {
        const v = volume[i];
        const low = lt(v, a * 0.5);
        const medium = ge(v, a * 0.5) && le(v, a * 1.5);
        bullColor = low ? cfg.bullishLow : medium ? cfg.bullishMedium : cfg.bullishHigh;
        bearColor = low ? cfg.bearishLow : medium ? cfg.bearishMedium : cfg.bearishHigh;
      }
      // barcolor(close >= open ? bullColor : bearColor, title = 'Volume Candles')
      s.barColors[i] = { time: b.time, color: ge(b.close, b.open) ? bullColor : bearColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeCandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeCandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeCandles = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
