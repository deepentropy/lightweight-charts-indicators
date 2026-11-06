/**
 * Volume and Volatility Ratio Indicator-WODI
 *
 * The volume in percent of its SMA (columns) is multiplied by the bar range in percent of the close
 * ((high - low) / close * 100) to give a volume / volatility index (step line). Short and long SMAs of the index are
 * drawn scaled by a sensitivity factor, with a constant threshold line. The volume columns above the volume SMA are
 * cyan, purple on a bullish reversal pattern and red on a bearish one: the index of the previous bar is above the bar
 * before and above the current index (or the previous volume is above the current one), the closes fell (rose) over
 * the lookback bars before the previous bar and the close then rose (fell), the volume is above its SMA, the index is
 * above the threshold and one of the last two candles has a lower (upper) wick longer than its body.
 *
 * Reference: "Volume and Volatility Ratio Indicator-WODI" by W0DI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeAndVolatilityRatioIndicatorWodiInputs {
  /** Volume SMA length */
  volLength: number;
  /** Short SMA length of the index */
  indexShortLength: number;
  /** Long SMA length of the index */
  indexLongLength: number;
  /** Factor of the two index SMAs */
  indexMagnification: number;
  /** Index threshold */
  indexThreshold: number;
  /** Number of bars of the pattern check */
  lookbackBars: number;
}

export const defaultInputs: VolumeAndVolatilityRatioIndicatorWodiInputs = {
  volLength: 48,
  indexShortLength: 13,
  indexLongLength: 26,
  indexMagnification: 2,
  indexThreshold: 200,
  lookbackBars: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'volLength', type: 'int', title: '交易量均线长度', defval: 48 },
  { id: 'indexShortLength', type: 'int', title: '指数短均线长度', defval: 13 },
  { id: 'indexLongLength', type: 'int', title: '指数均线长度', defval: 26 },
  { id: 'indexMagnification', type: 'int', title: '指数均线敏感度', defval: 2 },
  { id: 'indexThreshold', type: 'int', title: '指数阈值', defval: 200 },
  { id: 'lookbackBars', type: 'int', title: 'K线形态检测长度', defval: 3 },
];

const THRESHOLD_COLOR = String(color.rgb(238, 66, 193));
const BULL_COLOR = '#bc2af6';
const BEAR_COLOR = '#f22a2a';
const HIGH_VOLUME_COLOR = String(color.rgb(77, 231, 255, 37));
const LOW_VOLUME_COLOR = String(color.rgb(120, 123, 134, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '指数短均线', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: '指数长均线', color: '#2ad7f6', lineWidth: 1 },
  { id: 'plot2', title: '波动率阈值', color: THRESHOLD_COLOR, lineWidth: 1 },
  { id: 'plot3', title: '交易量柱状图', color: HIGH_VOLUME_COLOR, lineWidth: 1, style: 'columns' },
  { id: 'plot4', title: '交易量/波动率指数', color: '#000000', lineWidth: 1, style: 'stepline' },
];

export const metadata = {
  title: 'Volume and Volatility Ratio Indicator-WODI',
  shortTitle: 'Volume and Volatility Ratio Indicator-WODI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface WodiRun extends BarRunState<Record<string, never>> {
  volMa: WindowSma;
  shortMa: WindowSma;
  longMa: WindowSma;
  vi: number[];
  plots: Point[][];
}

function study(inputs: Partial<VolumeAndVolatilityRatioIndicatorWodiInputs>): BarStudy<WodiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.lookbackBars;
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    init() {
      const s: WodiRun = {
        volMa: new WindowSma(cfg.volLength), shortMa: new WindowSma(cfg.indexShortLength),
        longMa: new WindowSma(cfg.indexLongLength), vi: [], plots: [[], [], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.volMa, s.shortMa, s.longMa];
      s.series = [s.vi, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const volume = b.volume ?? NaN;
      const volMa = s.volMa.step(volume);
      // Plain divisions: x / 0 is +-infinity (0 / 0 na); comparisons use the infinite value, plots show na
      const volPercent = (volume / volMa) * 100;
      const volatility = ((b.high - b.low) / b.close) * 100;
      const vi = volPercent * volatility;
      s.vi[i] = vi;
      const shortMa = s.shortMa.step(vi);
      const longMa = s.longMa.step(vi);

      const get = (k: number, f: 'open' | 'high' | 'low' | 'close') => (i - k >= 0 ? bars[i - k][f] : NaN);
      const vi1 = i >= 1 ? s.vi[i - 1] : NaN;
      const vi2 = i >= 2 ? s.vi[i - 2] : NaN;
      const vol1 = i >= 1 ? bars[i - 1].volume ?? NaN : NaN;
      const { close, open, high, low } = b;
      let isRev = false;
      let isRevS = false;
      const common = gt(vi1, vi2) && (gt(vi1, vi) || gt(vol1, volume)) && gt(volume, volMa) && gt(vi, cfg.indexThreshold);
      // Pine `for i = 1 to lookback_bars` (counts down when lookback_bars < 1)
      const step = L >= 1 ? 1 : -1;
      for (let k = 1; step > 0 ? k <= L : k >= L; k += step) {
        const cond = common && gt(get(k + 1, 'close'), get(k, 'close')) && lt(get(1, 'close'), close)
          && (lt(get(1, 'open') - get(1, 'close'), get(1, 'close') - get(1, 'low')) || lt(open - close, close - low));
        if (cond) {
          if (k >= L) isRev = true;
        } else if (k < L) break;
      }
      for (let k = 1; step > 0 ? k <= L : k >= L; k += step) {
        const cond = common && lt(get(k + 1, 'close'), get(k, 'close')) && gt(get(1, 'close'), close)
          && (lt(get(1, 'close') - get(1, 'open'), get(1, 'high') - get(1, 'close')) || lt(close - open, high - close));
        if (cond) {
          if (k >= L) isRevS = true;
        } else if (k < L) break;
      }

      s.plots[0][i] = { time, value: fin(shortMa * cfg.indexMagnification), color: color.gray };
      s.plots[1][i] = { time, value: fin(longMa * cfg.indexMagnification), color: '#2ad7f6' };
      s.plots[2][i] = { time, value: cfg.indexThreshold, color: THRESHOLD_COLOR };
      // bar_color = volume > vol_ma ? (is_reversal_pattern ? #bc2af6 : (is_reversal_pattern_s ? #f22a2a : rgb(77, 231, 255, 37))) : rgb(120, 123, 134, 70)
      s.plots[3][i] = {
        time,
        value: fin(volPercent),
        color: gt(volume, volMa) ? (isRev ? BULL_COLOR : isRevS ? BEAR_COLOR : HIGH_VOLUME_COLOR) : LOW_VOLUME_COLOR,
      };
      s.plots[4][i] = { time, value: fin(vi), color: '#000000' };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeAndVolatilityRatioIndicatorWodiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeAndVolatilityRatioIndicatorWodiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeAndVolatilityRatioIndicatorWodi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
