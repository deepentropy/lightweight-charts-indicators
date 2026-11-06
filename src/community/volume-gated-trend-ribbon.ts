/**
 * Volume-Gated Trend Ribbon [QuantAlgo]
 *
 * The close is "gated" by volume: the gated close only takes the new close on bars whose volume is at least
 * SMA(volume, period) * multiplier, and keeps its last value on the other bars. A fast and a slow moving average
 * (15 types) of the gated close (VWMA: of the raw close) form a ribbon with two intermediate lines
 * (0.67 / 0.33 blends) and three fills of decreasing opacity from the slow to the fast line. The ribbon is bullish
 * when the fast MA is above the slow MA; bars can take the trend colour.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Signal' / 'Bearish Trend Signal' on the bar the trend
 * state (1 when the fast MA is above the slow MA, else -1) turns to 1 / -1, 'Trend Change' on either.
 *
 * Reference: "Volume-Gated Trend Ribbon [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowSum, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

const MA_TYPES = ['SMA', 'EMA', 'WMA', 'RMA', 'HMA', 'VWMA', 'DEMA', 'TEMA', 'ALMA', 'LSMA', 'SMMA', 'KAMA', 'ZLEMA', 'T3', 'VIDYA'];
const COLOR_PAIRS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00bfff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Ember: ['#ff6600', '#00cccc'],
  Neon: ['#ffff00', '#ff00ff'],
};

export interface VolumeGatedTrendRibbonInputs {
  /** Volume multiplier: a bar is significant when volume >= SMA(volume) * multiplier */
  volMult: number;
  /** Period of the average volume */
  volPeriod: number;
  /** Moving average type */
  maType: string;
  /** Fast MA length (HMA: at least 4) */
  fastLen: number;
  /** Slow MA length (at least fast length + 1) */
  slowLen: number;
  /** Default uses the inputs above; Fast Response 0.8 / 20 / 10 / 20; Smooth Trend 1.2 / 75 / 20 / 40 */
  presetConfig: string;
  /** Colour the price bars with the trend colour */
  enableBarColor: boolean;
  /** Colour preset; Custom uses bullColorInput / bearColorInput */
  colorPreset: string;
  bullColorInput: string;
  bearColorInput: string;
  /** Fill opacity 0..100 */
  fillOpacity: number;
}

export const defaultInputs: VolumeGatedTrendRibbonInputs = {
  volMult: 1.0,
  volPeriod: 50,
  maType: 'EMA',
  fastLen: 15,
  slowLen: 30,
  presetConfig: 'Default',
  enableBarColor: false,
  colorPreset: 'Custom',
  bullColorInput: '#00ffaa',
  bearColorInput: '#ff0000',
  fillOpacity: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'volMult', type: 'float', title: 'Volume Multiplier', defval: 1.0, min: 0.5, max: 3.0, step: 0.1 },
  { id: 'volPeriod', type: 'int', title: 'Volume Period', defval: 50, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: MA_TYPES },
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 15, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 30, min: 1 },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'enableBarColor', type: 'bool', title: 'Enable Bar Coloring', defval: false },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Ember', 'Neon', 'Custom'] },
  { id: 'bullColorInput', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearColorInput', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'fillOpacity', type: 'int', title: 'Fill Opacity', defval: 100, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot1', title: 'Mid-Fast MA', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot2', title: 'Mid-Slow MA', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot3', title: 'Slow MA', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot4', title: 'Fast Edge', color: '#00ffaa', lineWidth: 2 },
  { id: 'plot5', title: 'Slow Edge', color: '#00ffaa', lineWidth: 2 },
];

export const metadata = {
  title: 'Volume-Gated Trend Ribbon [QuantAlgo]',
  shortTitle: 'Volume-Gated Trend Ribbon',
  overlay: true,
};

/** Pine float comparisons with the 1e-10 tolerance (false with na) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
/** Pine x != 0 (false when x is na) */
const ne0 = (x: number) => Math.abs(x) > EPS;

/** One moving average of the ribbon stepped bar by bar: `step(i, src, volume)` reads `src[i]` and earlier values */
type MaStep = Committable & { step(i: number, src: number[], volume: number): number };

/** A machine of one value per bar (ema chains of DEMA / TEMA / T3) */
type ValueStep = Committable & { step(v: number): number };

/** gd(src, len, factor) = ema * (1 + factor) - ema(ema) * factor */
function gdStep(len: number, factor: number): ValueStep {
  const e1 = taStep.ema(len);
  const e2 = taStep.ema(len);
  return {
    step: (v) => {
      const a = e1.step(v);
      return a * (1 + factor) - e2.step(a) * factor;
    },
    commit: () => { e1.commit(); e2.commit(); },
  };
}

/** A machine whose output on bar i reads its own output of the bar before (`prev`), committed with the bar */
abstract class Recursive implements Committable {
  protected prev = NaN;
  private next = NaN;
  protected abstract parts: Committable[];
  protected abstract value(i: number, src: number[], volume: number): number;

  step(i: number, src: number[], volume: number): number {
    this.next = this.value(i, src, volume);
    return this.next;
  }

  commit(): void {
    for (const p of this.parts) p.commit();
    this.prev = this.next;
  }
}

/** smma: result := na(result[1]) ? ta.sma(src, len) : (result[1] * (len - 1) + src) / len */
class SmmaStep extends Recursive {
  // ta.sma only runs while result[1] is na: consecutive bars from bar 0, so it is the plain SMA there
  private readonly sma: WindowSma;
  protected parts: Committable[];

  constructor(private readonly len: number) {
    super();
    this.sma = new WindowSma(len);
    this.parts = [this.sma];
  }

  protected value(i: number, src: number[]): number {
    const sma = this.sma.step(src[i]);
    const prev = i > 0 ? this.prev : NaN;
    return isNaN(prev) ? sma : (prev * (this.len - 1) + src[i]) / this.len;
  }
}

/** kama: er = vol != 0 ? change / vol : 0; sc = (er * (fastSC - slowSC) + slowSC)^2 */
class KamaStep extends Recursive {
  private readonly vol: WindowSum;
  protected parts: Committable[];

  constructor(private readonly len: number) {
    super();
    this.vol = new WindowSum(len);
    this.parts = [this.vol];
  }

  protected value(i: number, src: number[]): number {
    const fastSC = 2.0 / 3;
    const slowSC = 2.0 / 31;
    const len = this.len;
    const vol = this.vol.step(i > 0 ? Math.abs(src[i] - src[i - 1]) : NaN);
    const change = Math.abs(src[i] - (i - len >= 0 ? src[i - len] : NaN));
    const er = ne0(vol) ? change / vol : 0;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    const prev = i > 0 ? this.prev : NaN;
    return isNaN(prev) ? src[i] : prev + sc * (src[i] - prev);
  }
}

/** vidya: cmo = (upSum + dnSum) != 0 ? |(upSum - dnSum) / (upSum + dnSum)| : 0 */
class VidyaStep extends Recursive {
  private readonly up: WindowSum;
  private readonly dn: WindowSum;
  protected parts: Committable[];

  constructor(private readonly len: number) {
    super();
    this.up = new WindowSum(len);
    this.dn = new WindowSum(len);
    this.parts = [this.up, this.dn];
  }

  protected value(i: number, src: number[]): number {
    const m = i > 0 ? src[i] - src[i - 1] : NaN;
    // math.max(na, 0) is na
    const upSum = this.up.step(isNaN(m) ? NaN : Math.max(m, 0));
    const dnSum = this.dn.step(isNaN(m) ? NaN : Math.max(-m, 0));
    const alpha = 2.0 / (this.len + 1);
    const tot = upSum + dnSum;
    const cmo = ne0(tot) ? Math.abs((upSum - dnSum) / tot) : 0;
    const prev = i > 0 ? this.prev : NaN;
    return isNaN(prev) ? src[i] : src[i] * alpha * cmo + prev * (1 - alpha * cmo);
  }
}

/** ta.alma(src, len, 0.85, 6): the weights and the sum of the library function (same doubles) */
function almaStep(length: number, offset: number, sigma: number): MaStep {
  const m = offset * (length - 1);
  const s = length / sigma;
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < length; i++) {
    const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(weight);
    weightSum += weight;
  }
  for (let i = 0; i < length; i++) weights[i] /= weightSum;
  return {
    step: (i, src) => {
      if (i < length - 1) return NaN;
      let almaValue = 0;
      for (let j = 0; j < length; j++) almaValue += src[i - length + 1 + j] * weights[j];
      return almaValue;
    },
    commit: () => {},
  };
}

const wrap = (m: ValueStep): MaStep => ({ step: (i, src) => m.step(src[i]), commit: () => m.commit() });

/** ma(src, len) of the selected type */
function maStep(maType: string, len: number): MaStep {
  switch (maType) {
    case 'SMA': return wrap(new WindowSma(len));
    case 'EMA': return wrap(taStep.ema(len));
    case 'WMA': { const m = taStep.wma(); return wrap({ step: (v) => m.step(v, len), commit: () => m.commit() }); }
    case 'RMA': return wrap(taStep.rma(len));
    case 'HMA': return wrap(taStep.hma(len));
    case 'VWMA': { const m = taStep.vwma(len); return { step: (i, src, vol) => m.step(src[i], vol), commit: () => m.commit() }; }
    case 'DEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return wrap({
        step: (v) => { const a = e1.step(v); return 2 * a - e2.step(a); },
        commit: () => { e1.commit(); e2.commit(); },
      });
    }
    case 'TEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return wrap({
        step: (v) => { const a = e1.step(v); const b = e2.step(a); const c = e3.step(b); return 3 * (a - b) + c; },
        commit: () => { e1.commit(); e2.commit(); e3.commit(); },
      });
    }
    case 'ALMA': return almaStep(len, 0.85, 6);
    case 'LSMA': return wrap(taStep.linreg(len, 0));
    case 'SMMA': return new SmmaStep(len);
    case 'KAMA': return new KamaStep(len);
    case 'ZLEMA': {
      /** zlema: lag = (len - 1) / 2; ta.ema(src + (src - src[lag]), len) */
      const lag = Math.floor((len - 1) / 2);
      const e = taStep.ema(len);
      return { step: (i, src) => { const v = src[i]; return e.step(v + (v - (i - lag >= 0 ? src[i - lag] : NaN))); }, commit: () => e.commit() };
    }
    case 'T3': {
      const g1 = gdStep(len, 0.7);
      const g2 = gdStep(len, 0.7);
      const g3 = gdStep(len, 0.7);
      return wrap({ step: (v) => g3.step(g2.step(g1.step(v))), commit: () => { g1.commit(); g2.commit(); g3.commit(); } });
    }
    case 'VIDYA': return new VidyaStep(len);
    default: return wrap(taStep.ema(len));
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface VgtrVars {
  /** var float gatedClose = close */
  gated: number;
  /** trendState of the bar before (na on the first bar) */
  prevState: number;
}

interface VgtrRun extends BarRunState<VgtrVars> {
  avgVol: WindowSma;
  fast: MaStep;
  slow: MaStep;
  close: number[];
  gated: number[];
  plots: Point[][];
  fillCols: string[][];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeGatedTrendRibbonInputs>): BarStudy<VgtrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { volMult, volPeriod, fastLen, slowLen } = cfg;
  if (cfg.presetConfig === 'Fast Response') {
    volMult = 0.8;
    volPeriod = 20;
    fastLen = 10;
    slowLen = 20;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    volMult = 1.2;
    volPeriod = 75;
    fastLen = 20;
    slowLen = 40;
  }
  const maType = cfg.maType;
  const [bullColor, bearColor] = COLOR_PAIRS[cfg.colorPreset] ?? [cfg.bullColorInput, cfg.bearColorInput];
  // fastPeriod = maType == 'HMA' ? math.max(fastLen, 4) : fastLen; slowPeriod = math.max(slowLen, fastPeriod + 1)
  const fastPeriod = maType === 'HMA' ? Math.max(fastLen, 4) : fastLen;
  const slowPeriod = Math.max(slowLen, fastPeriod + 1);

  // outerOp = 100 - math.round(fillOpacity * 0.8); innerOp: * 0.6; coreOp: * 0.4
  const outerOp = 100 - Math.round(cfg.fillOpacity * 0.8);
  const innerOp = 100 - Math.round(cfg.fillOpacity * 0.6);
  const coreOp = 100 - Math.round(cfg.fillOpacity * 0.4);
  const c = (col: string, transp: number) => String(color.new(col, transp));
  return {
    init() {
      // volMA(gatedSrc, rawSrc, len) => maType == 'VWMA' ? ta.vwma(rawSrc, len) : ma(gatedSrc, len)
      const s: VgtrRun = {
        avgVol: new WindowSma(volPeriod), fast: maStep(maType, fastPeriod), slow: maStep(maType, slowPeriod),
        close: [], gated: [], plots: Array.from({ length: 6 }, () => []), fillCols: [[], [], []], barColors: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { gated: NaN, prevState: NaN }, lists: [], series: [],
      };
      s.steps = [s.avgVol, s.fast, s.slow];
      s.lists = s.times;
      s.series = [s.close, s.gated, ...s.plots, ...s.fillCols, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = s.vars;
      const volume = b.volume ?? NaN;
      s.close[i] = b.close;
      // avgVol = ta.sma(volume, volPeriod); highVol = volume >= avgVol * volMult
      const avgVol = s.avgVol.step(volume);
      // var float gatedClose = close; if highVol: gatedClose := close
      if (i === 0) v.gated = b.close;
      if (ge(volume, avgVol * volMult)) v.gated = b.close;
      s.gated[i] = v.gated;

      const src = maType === 'VWMA' ? s.close : s.gated;
      const f = s.fast.step(i, src, volume);
      const sl = s.slow.step(i, src, volume);

      // trendState := bullish ? 1 : -1; longSignal = trendState == 1 and trendState[1] != 1 (na on the first bar: false)
      const state = gt(f, sl) ? 1 : -1;
      const longSignal = state === 1 && i > 0 && v.prevState !== 1;
      const shortSignal = state === -1 && i > 0 && v.prevState !== -1;
      v.prevState = state;
      const flags = [longSignal, shortSignal, longSignal || shortSignal];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t);
      }
      // bullish = fastMA > slowMA; trendCol = bullish ? bullColor : bearColor
      const trendCol = gt(f, sl) ? bullColor : bearColor;
      const line = c(trendCol, 80);
      const p = s.plots;
      p[0][i] = { time: t, value: f, color: line };
      p[1][i] = { time: t, value: f * 0.67 + sl * 0.33, color: line };
      p[2][i] = { time: t, value: f * 0.33 + sl * 0.67, color: line };
      p[3][i] = { time: t, value: sl, color: line };
      p[4][i] = { time: t, value: f, color: c(trendCol, 0) };
      p[5][i] = { time: t, value: sl, color: c(trendCol, 0) };
      s.fillCols[0][i] = c(trendCol, coreOp);
      s.fillCols[1][i] = c(trendCol, innerOp);
      s.fillCols[2][i] = c(trendCol, outerOp);
      // barcolor(enableBarColor ? trendCol : na)
      if (cfg.enableBarColor) s.barColors[i] = { time: t, color: trendCol };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        fills: [
          // fill(pMidSlow, pSlow, 'Core Fill'); fill(pMidFast, pMidSlow, 'Inner Fill'); fill(pFast, pMidFast, 'Outer Fill')
          { plot1: 'plot2', plot2: 'plot3', colors: s.fillCols[0].slice() },
          { plot1: 'plot1', plot2: 'plot2', colors: s.fillCols[1].slice() },
          { plot1: 'plot0', plot2: 'plot1', colors: s.fillCols[2].slice() },
        ],
        markers: [],
        barColors: cfg.enableBarColor ? s.barColors.slice() : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeGatedTrendRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeGatedTrendRibbonInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Volume-Gated Ribbon: Trend changed to BULLISH {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Volume-Gated Ribbon: Trend changed to BEARISH {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Trend Change', message: 'Volume-Gated Ribbon: Trend direction changed - Check chart {{exchange}}:{{ticker}} - {{interval}}' },
];

export const VolumeGatedTrendRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
