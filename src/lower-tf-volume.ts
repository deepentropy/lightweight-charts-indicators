/**
 * Lower-timeframe up / down volume of the volume ports (Volume Delta, Cumulative Volume Delta, Net Volume, Up/Down
 * Volume).
 *
 * The originals request bars of a lower timeframe ('Use custom timeframe' / 'Timeframe' inputs, else "1S" on
 * seconds charts, "1" on intraday charts, "5" on daily charts, "60" above) and split the volume of each chart bar
 * into up and down volume from its intrabars (library rule: an intrabar is up when close > open, down when
 * close < open, else up / down when close is above / below the previous close, else as the previous intrabar).
 * A lower timeframe above the chart timeframe is a runtime error (request.security_lower_tf).
 *
 * The bars passed to a port are the chart bars only. When the lower timeframe is the chart timeframe, the
 * intrabars are the chart bars and the port computes the original values (`exact`). When it is lower, the intrabar
 * volume is not available and each port keeps its estimate from the chart bars.
 * The chart timeframe is taken from the bars (`chartTimeframe`: the most frequent gap between two bars).
 */

import { timeframe } from 'oakscriptjs';
import { chartTimeframe } from './anchor-period';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export interface LowerTimeframe {
  /** Lower timeframe requested by the original */
  timeframe: string;
  /** Chart timeframe of the bars */
  chart: string;
  /** True when the lower timeframe is the chart timeframe: the chart bars are the intrabars */
  exact: boolean;
}

/**
 * The lower timeframe of the original: the custom one, else the automatic one for the chart timeframe.
 * @throws Error, as the original, when the lower timeframe is above the chart timeframe
 */
export function lowerTimeframe(
  bars: ReadonlyArray<{ time: number }>,
  useCustomTimeframe: boolean,
  customTimeframe: string,
): LowerTimeframe {
  const chart = chartTimeframe(bars);
  if (chart === '') return { timeframe: useCustomTimeframe ? customTimeframe : '', chart, exact: false };
  const info = timeframe.info(chart);
  const tf = useCustomTimeframe ? customTimeframe
    : info.isseconds ? '1S'
    : info.isintraday ? '1'
    : info.isdaily ? '5'
    : '60';
  // "" (the chart timeframe) is the chart timeframe
  const lower = tf.trim() === '' ? timeframe.in_seconds(chart) : timeframe.in_seconds(tf);
  const chartSeconds = timeframe.in_seconds(chart);
  if (lower > chartSeconds) {
    throw new Error(`The chart's timeframe must be greater or equal to the \`${tf}\` timeframe used with \`request.security_lower_tf()\`.`);
  }
  return { timeframe: tf, chart, exact: lower === chartSeconds };
}

/** Up volume (>= 0), down volume (<= 0) and delta of each chart bar. */
export interface UpDownVolume {
  up: number[];
  down: number[];
  delta: number[];
}

/**
 * Up / down volume of each chart bar with the chart bars as the intrabars (the original when the lower timeframe is
 * the chart timeframe): all the volume of a bar is up or down by the library rule.
 */
export function upDownVolumeOfChartBars(
  bars: ReadonlyArray<{ open: number; close: number; volume?: number }>,
): UpDownVolume {
  const up: number[] = [];
  const down: number[] = [];
  const delta: number[] = [];
  let isBuyVolume = true;
  for (let i = 0; i < bars.length; i++) {
    const { open, close } = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN; // na comparisons are false
    if (gt(close, open)) isBuyVolume = true;
    else if (gt(open, close)) isBuyVolume = false;
    else if (gt(close, prevClose)) isBuyVolume = true;
    else if (gt(prevClose, close)) isBuyVolume = false;
    const volume = bars[i].volume ?? 0;
    const pos = isBuyVolume ? volume : 0;
    const neg = isBuyVolume ? 0 : -volume;
    up.push(pos);
    down.push(neg);
    delta.push(pos + neg);
  }
  return { up, down, delta };
}
