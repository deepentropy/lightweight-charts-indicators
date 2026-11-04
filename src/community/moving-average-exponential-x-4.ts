/**
 * Moving Average Exponential x 4
 *
 * Four exponential moving averages (default lengths 50, 100, 200 and 400), each with its own length and source.
 *
 * Reference: "Moving Average Exponential x 4" by krogsgard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, getSourceSeries, type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type SourceType } from 'oakscriptjs';

export interface MovingAverageExponentialX4Inputs {
  len50: number;
  src50: SourceType;
  len100: number;
  src100: SourceType;
  len200: number;
  src200: SourceType;
  len400: number;
  src400: SourceType;
}

export const defaultInputs: MovingAverageExponentialX4Inputs = {
  len50: 50,
  src50: 'close',
  len100: 100,
  src100: 'close',
  len200: 200,
  src200: 'close',
  len400: 400,
  src400: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len50', type: 'int', title: 'First', defval: 50, min: 1 },
  { id: 'src50', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len100', type: 'int', title: 'Second', defval: 100, min: 1 },
  { id: 'src100', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len200', type: 'int', title: 'Third', defval: 200, min: 1 },
  { id: 'src200', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len400', type: 'int', title: 'Fourth', defval: 400, min: 1 },
  { id: 'src400', type: 'source', title: 'Source', defval: 'close' },
];

const COLORS = ['#fc4c2a', '#35b4b8', '#2e3440', '#9b9e9e'];

export const plotConfig: PlotConfig[] = COLORS.map((c, k) => ({
  id: `plot${k}`,
  title: `EMA - ${k + 1}`,
  color: c,
  lineWidth: 4,
}));

export const metadata = {
  title: 'Moving Average Exponential x 4',
  shortTitle: 'EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MovingAverageExponentialX4Inputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const pairs: [number, SourceType][] = [
    [cfg.len50, cfg.src50],
    [cfg.len100, cfg.src100],
    [cfg.len200, cfg.src200],
    [cfg.len400, cfg.src400],
  ];
  const plots: IndicatorResult['plots'] = {};
  pairs.forEach(([len, src], k) => {
    const out = ta.ema(getSourceSeries(bars, src), len).toArray();
    plots[`plot${k}`] = bars.map((b, i) => {
      const v = out[i];
      return { time: b.time, value: v == null || !Number.isFinite(v) ? NaN : v, color: COLORS[k] };
    });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const MovingAverageExponentialX4 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
