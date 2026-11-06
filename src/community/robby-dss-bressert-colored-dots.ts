/**
 * Robby DSS Bressert Colored Dots
 *
 * Double smoothed stochastic (Bressert DSS): the stochastic of the close over `stoPeriod` bars, smoothed with an EMA
 * of `emaPeriod` bars; the stochastic of that line over `stoPeriod` bars, smoothed again with an EMA of `emaPeriod`
 * bars. The DSS is drawn as dots: lime while it rises, red while it falls; the colour is kept when it does not
 * change. Dashed overbought and oversold lines.
 *
 * Reference: "Robby DSS Bressert Colored Dots" by huatzhi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface RobbyDssBressertColoredDotsInputs {
  /** Smoothing period (EMA) */
  emaPeriod: number;
  /** Stochastic period */
  stoPeriod: number;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const defaultInputs: RobbyDssBressertColoredDotsInputs = {
  emaPeriod: 60,
  stoPeriod: 120,
  overboughtLevel: 80,
  oversoldLevel: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaPeriod', type: 'int', title: 'Smoothing Period (EMA)', defval: 60 },
  { id: 'stoPeriod', type: 'int', title: 'Stochastic Period', defval: 120 },
  { id: 'overboughtLevel', type: 'float', title: 'Overbought Level', defval: 80 },
  { id: 'oversoldLevel', type: 'float', title: 'Oversold Level', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DSS Dots', color: color.red, lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Robby DSS Bressert Colored Dots',
  shortTitle: 'Robby DSS',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

/**
 * `ta.stoch(source, high, low, length)` with a constant length: `100 * (source - lowest(low)) / (highest(high) -
 * lowest(low))`, an na result keeps the previous one (the doubles of taStep.stoch, with the fast window extremes)
 */
class Stoch implements Committable {
  private readonly highest: WindowExtreme;
  private readonly lowest: WindowExtreme;
  private previous = NaN;
  private next = NaN;
  private stepped = false;

  constructor(length: number) {
    // the length check of ta.stoch (an error for a length <= 0)
    if (!(length > 0)) taStep.stoch(length);
    this.highest = new WindowExtreme(false, length);
    this.lowest = new WindowExtreme(true, length);
  }

  step(source: number, high: number, low: number): number {
    this.stepped = true;
    const lo = this.lowest.step(low);
    const k = (100 * (source - lo)) / (this.highest.step(high) - lo);
    this.next = Number.isNaN(k) ? this.previous : k;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.previous = this.next;
    this.highest.commit();
    this.lowest.commit();
  }
}

interface DssRun extends BarRunState<{ dotColor: string }> {
  stochOfPrice: Stoch;
  firstSmooth: ReturnType<typeof taStep.ema>;
  stochOfSmoothed: Stoch;
  dssEma: ReturnType<typeof taStep.ema>;
  dss: number[];
  plot0: Point[];
}

function study(inputs: Partial<RobbyDssBressertColoredDotsInputs>): BarStudy<DssRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // (color.new(c, 0) is the colour c itself: one string per colour of the palette)
  const lime: string = color.lime;
  const red: string = color.red;
  const gray = String(color.new(color.gray, 50));
  return {
    init() {
      const s: DssRun = {
        stochOfPrice: new Stoch(cfg.stoPeriod), firstSmooth: taStep.ema(cfg.emaPeriod),
        stochOfSmoothed: new Stoch(cfg.stoPeriod), dssEma: taStep.ema(cfg.emaPeriod), dss: [], plot0: [],
        // var color dotColor = color.red
        steps: [], vars: { dotColor: red }, lists: [], series: [],
      };
      s.steps = [s.stochOfPrice, s.firstSmooth, s.stochOfSmoothed, s.dssEma];
      s.series = [s.dss, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // stochOfPrice = ta.stoch(close, high, low, stoPeriod); firstSmooth = ta.ema(stochOfPrice, emaPeriod)
      const firstSmooth = s.firstSmooth.step(s.stochOfPrice.step(b.close, b.high, b.low));
      // stochOfSmoothed = ta.stoch(firstSmooth, firstSmooth, firstSmooth, stoPeriod); dssValue = ta.ema(stochOfSmoothed, emaPeriod)
      const dss = s.dssEma.step(s.stochOfSmoothed.step(firstSmooth, firstSmooth, firstSmooth));
      s.dss[i] = dss;
      // lime when dssValue > dssValue[1], red when dssValue < dssValue[1], else kept
      const prev = i > 0 ? s.dss[i - 1] : NaN;
      if (gt(dss, prev)) s.vars.dotColor = lime;
      else if (lt(dss, prev)) s.vars.dotColor = red;
      s.plot0[i] = { time: b.time as number, value: dss, color: s.vars.dotColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.overboughtLevel, options: { title: 'Overbought', color: gray, linestyle: 'dashed' } },
          { value: cfg.oversoldLevel, options: { title: 'Oversold', color: gray, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RobbyDssBressertColoredDotsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RobbyDssBressertColoredDotsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RobbyDssBressertColoredDots = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
