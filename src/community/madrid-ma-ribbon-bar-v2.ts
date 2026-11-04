/**
 * Madrid MA Ribbon Bar v2
 *
 * Twenty moving averages of the close (lengths 5 to 100, step 5; EMA or SMA) shown as a stack of 20 column bands
 * (band k from 5 * (k - 1) to 5 * k). Each band is coloured from the slope of its average and the position of the
 * 5-bar average against the 100-bar average: lime (rising, 5 above 100), maroon (falling, 5 above 100), red
 * (falling or flat, 5 below 100), green (rising, 5 below 100), else gray. The bands 95 and 100 use the 90-bar
 * average, as the original does.
 *
 * Reference: "Madrid MA Ribbon Bar v2" by Madrid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, color, getSourceSeries, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

export interface MadridMaRibbonBarV2Inputs {
  /** Exponential MA (else simple) */
  exponential: boolean;
}

export const defaultInputs: MadridMaRibbonBarV2Inputs = {
  exponential: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'exponential', type: 'bool', title: 'Exponential MA', defval: true },
];

const LEVELS = Array.from({ length: 20 }, (_, k) => 5 * (k + 1));

export const plotConfig: PlotConfig[] = LEVELS.map((lvl, k) => ({
  id: `plot${k}`,
  title: `MMA${lvl < 10 ? '0' : ''}${lvl}`,
  color: '#2962FF',
  lineWidth: 2,
  style: 'columns' as const,
  histbase: lvl - 5,
}));

export const metadata = {
  title: 'Madrid MA Ribbon Bar v2',
  shortTitle: 'MMARB',
  overlay: false,
  precision: 0,
};

/** Pine float comparisons (1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;

export function calculate(bars: Bar[], inputs: Partial<MadridMaRibbonBarV2Inputs> = {}): IndicatorResult {
  const { exponential } = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, 'close');
  const mas = LEVELS.map((len) =>
    (exponential ? ta.ema(src, len) : ta.sma(src, len)).toArray().map((v) => v ?? NaN),
  );
  const ma05 = mas[0];
  const ma100 = mas[19];

  // maColor(ma, maRef): ta.change(ma) against 0, ma05 against the reference
  const colourOf = (ma: number[], i: number): string => {
    const ch = i > 0 ? ma[i] - ma[i - 1] : NaN;
    const above = gt(ma05[i], ma100[i]);
    const below = lt(ma05[i], ma100[i]);
    if (ge(ch, 0) && above) return color.lime;
    if (lt(ch, 0) && above) return color.maroon;
    if (le(ch, 0) && below) return color.red;
    if (ge(ch, 0) && below) return color.green;
    return color.gray;
  };

  const plots: IndicatorResult['plots'] = {};
  LEVELS.forEach((lvl, k) => {
    // MMA95 and MMA100 take the colour of ma90 in the original
    const ma = mas[Math.min(k, 17)];
    plots[`plot${k}`] = bars.map((b, i) => ({ time: b.time, value: lvl, color: colourOf(ma, i) }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const MadridMaRibbonBarV2 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
