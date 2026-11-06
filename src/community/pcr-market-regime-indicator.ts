/**
 * PCR Market Regime Indicator
 *
 * Price change ratio: raw = (close - close[len]) / (highest(high, len) - lowest(low, len)) * 100 (0 when the range is
 * 0 or na), smoothed by an EMA, with an EMA signal line. The regime is 1 when the PCR is above the neutral zone
 * for at least the hold bars, -1 when it is below -zone for at least the hold bars, 0 inside the zone (else it
 * keeps its value). The background shows the regime (green / red / gray); horizontal lines at 100, 70, 0, -70, -100.
 *
 * Reference: "PCR Market Regime Indicator" by Aleksin_Aleksandar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PcrMarketRegimeIndicatorInputs {
  /** PCR length */
  pcrLen: number;
  /** Minimum hold bars */
  holdBars: number;
  /** Neutral zone (+/- around 0) */
  zone: number;
  /** EMA smoothing length of the raw PCR */
  smoothLen: number;
  showEMA: boolean;
  emaLen: number;
  show100: boolean;
  show70: boolean;
  show0: boolean;
  showNeg70: boolean;
  showNeg100: boolean;
}

export const defaultInputs: PcrMarketRegimeIndicatorInputs = {
  pcrLen: 80,
  holdBars: 1,
  zone: 1.0,
  smoothLen: 3,
  showEMA: true,
  emaLen: 10,
  show100: true,
  show70: true,
  show0: true,
  showNeg70: true,
  showNeg100: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pcrLen', type: 'int', title: 'PCR Length', defval: 80 },
  { id: 'holdBars', type: 'int', title: 'Min Hold Bars', defval: 1 },
  { id: 'zone', type: 'float', title: 'Neutral Zone (+/- around 0)', defval: 1.0 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing', defval: 3 },
  { id: 'showEMA', type: 'bool', title: 'Show EMA', defval: true },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 10 },
  { id: 'show100', type: 'bool', title: 'Show 100', defval: true },
  { id: 'show70', type: 'bool', title: 'Show 70', defval: true },
  { id: 'show0', type: 'bool', title: 'Show 0', defval: true },
  { id: 'showNeg70', type: 'bool', title: 'Show -70', defval: true },
  { id: 'showNeg100', type: 'bool', title: 'Show -100', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PCR', color: color.lime, lineWidth: 2 },
  { id: 'plot1', title: 'PCR EMA', color: color.purple, lineWidth: 2 },
];

export const metadata = {
  title: 'PCR Market Regime Indicator',
  shortTitle: 'PCR Market Regime Indicator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface PcrRun extends BarRunState<{ regime: number }> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  pcr: ReturnType<typeof taStep.ema>;
  pcrEma: ReturnType<typeof taStep.ema>;
  sinceNotAbove: ReturnType<typeof taStep.barssince>;
  sinceNotBelow: ReturnType<typeof taStep.barssince>;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<PcrMarketRegimeIndicatorInputs>): BarStudy<PcrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.pcrLen;
  const bgUp = String(color.new(color.green, 85));
  const bgDown = String(color.new(color.red, 85));
  const bgFlat = String(color.new(color.gray, 85));
  return {
    init() {
      const s: PcrRun = {
        hh: new WindowExtreme(false, len), ll: new WindowExtreme(true, len), pcr: taStep.ema(cfg.smoothLen),
        pcrEma: taStep.ema(cfg.emaLen), sinceNotAbove: taStep.barssince(), sinceNotBelow: taStep.barssince(),
        plot0: [], plot1: [], bgColors: [],
        steps: [], vars: { regime: 0 }, lists: [], series: [],
      };
      s.steps = [s.hh, s.ll, s.pcr, s.pcrEma, s.sinceNotAbove, s.sinceNotBelow];
      s.series = [s.plot0, s.plot1, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // f_pcr(_length): _r != 0 ? _c / _r * 100 : 0 (an na range compares false: 0)
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const c = i >= len ? b.close - bars[i - len].close : NaN;
      const r = hh - ll;
      const raw = !isNaN(r) && Math.abs(r) > EPS ? (c / r) * 100 : 0;
      const pcr = s.pcr.step(raw);
      const pcrEma = s.pcrEma.step(pcr);

      // Zones, hold (ta.barssince(not above) >= holdBars) and the regime state
      const above = gt(pcr, cfg.zone);
      const below = lt(pcr, -cfg.zone);
      const sinceNotAbove = s.sinceNotAbove.step(above ? 0 : 1);
      const sinceNotBelow = s.sinceNotBelow.step(below ? 0 : 1);
      const neutral = !above && !below;
      const v = s.vars;
      if (above && sinceNotAbove >= cfg.holdBars) v.regime = 1;
      else if (below && sinceNotBelow >= cfg.holdBars) v.regime = -1;
      else if (neutral) v.regime = 0;
      s.bgColors[i] = { time, color: v.regime === 1 ? bgUp : v.regime === -1 ? bgDown : bgFlat };

      s.plot0[i] = { time, value: pcr, color: gt(pcr, 0) ? color.lime : color.red };
      s.plot1[i] = { time, value: cfg.showEMA ? pcrEma : NaN, color: color.purple };
    },
    result(s) {
      const hlines: NonNullable<IndicatorResult['hlines']> = [];
      const level = (show: boolean, value: number, title: string, c: string) => {
        if (show) hlines.push({ value, options: { title, color: c, linestyle: 'dashed' } });
      };
      level(cfg.show100, 100, '100', color.blue);
      level(cfg.show70, 70, '70', color.green);
      level(cfg.show0, 0, '0', String(color.rgb(251, 251, 253)));
      level(cfg.showNeg70, -70, '-70', color.red);
      level(cfg.showNeg100, -100, '-100', color.maroon);

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PcrMarketRegimeIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PcrMarketRegimeIndicatorInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const PcrMarketRegimeIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
