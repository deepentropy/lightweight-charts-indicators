/**
 * Directional Logistic Oscillator
 *
 * +DI, -DI and ADX of the DMI are each turned into a probability with a logistic function of their distance to
 * their long SMA (mean lookback), smoothed by an EMA. The net directional probability (+DI minus -DI) times the ADX
 * probability and the scale is bounded by tanh and smoothed by an EMA: the market strength columns. The column and
 * bar colours are strong when the strength is beyond its EMA, weak otherwise. Mean-reversion marks: the SMA / EMA
 * of the strength crossing up its 10th / 5th percentile or down its 90th / 95th percentile (mean lookback window).
 * Reversion marks: turns of an EMA of the strength SMA. A background tint shows strength and its EMA both beyond
 * +/-0.5. With "Allow Intrabar Updating" off, every output uses the values of the previous bar.
 * Alerts (alertcondition, `alerts` of the result, on the current bar's values whatever "Allow Intrabar Updating"):
 * '[DLO] Reversion Up' / '[DLO] Reversion Down' (cycle turns), '[DLO] MR Buy' / '[DLO] MR Sell' (percentile
 * crosses), '[DLO] Osc Bullish Cross' / '[DLO] Osc Bearish Cross' (strength crossing 0).
 *
 * Reference: "Directional Logistic Oscillator | GainzAlgo" by GainzAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DirectionalLogisticOscillatorInputs {
  /** DMI DI length (also the ADX smoothing) */
  diLength: number;
  /** SMA lookback of the logistic means and window of the percentile thresholds */
  meanLookback: number;
  /** Logistic slope */
  slope: number;
  /** EMA length of the probabilities and of the bounded strength */
  smoothLength: number;
  /** Multiplier before tanh */
  oscScale: number;
  /** SMA / EMA length of the strength */
  oscSmoothLength: number;
  buyColor: string;
  sellColor: string;
  /** Plot the reversion marks */
  plotReversion: boolean;
  /** Plot the mean-reversion marks */
  plotMeanReversion: boolean;
  /** Plot the oscillator SMA */
  plotMA: boolean;
  /** Off: every output uses the values of the previous bar */
  intrabar: boolean;
}

export const defaultInputs: DirectionalLogisticOscillatorInputs = {
  diLength: 14,
  meanLookback: 360,
  slope: 0.18,
  smoothLength: 3,
  oscScale: 2.5,
  oscSmoothLength: 7,
  buyColor: '#00ffaa',
  sellColor: '#ff0000',
  plotReversion: true,
  plotMeanReversion: true,
  plotMA: false,
  intrabar: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'diLength', type: 'int', title: 'DI Length', defval: 14, min: 1 },
  { id: 'meanLookback', type: 'int', title: 'Mean Lookback', defval: 360 },
  { id: 'slope', type: 'float', title: 'LR Slope (higher = steeper)', defval: 0.18, step: 0.02 },
  { id: 'smoothLength', type: 'int', title: 'Probability Smoothing (EMA)', defval: 3, min: 1, max: 9 },
  { id: 'oscScale', type: 'float', title: 'Oscillator Scale (pre-tanh)', defval: 2.5, step: 0.1 },
  { id: 'oscSmoothLength', type: 'int', title: 'Oscillator Smoothing Length', defval: 7 },
  { id: 'buyColor', type: 'color', title: 'Buy Color', defval: '#00ffaa' },
  { id: 'sellColor', type: 'color', title: 'Sell Color', defval: '#ff0000' },
  { id: 'plotReversion', type: 'bool', title: 'Plot Reversion Signals', defval: true },
  { id: 'plotMeanReversion', type: 'bool', title: 'Plot Mean-Reversion Signals', defval: true },
  { id: 'plotMA', type: 'bool', title: 'Plot Oscillator MA', defval: false },
  { id: 'intrabar', type: 'bool', title: 'Allow Intrabar Updating', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Market Strength', color: '#00ffaa', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Osc MA', color: '#1400c5', lineWidth: 3 },
];

export const metadata = {
  title: 'Directional Logistic Oscillator | GainzAlgo',
  shortTitle: 'DLO',
  overlay: false,
};

/** Pine a > b: true only when a - b > 1e-10 (float comparison tolerance); false when a value is na */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * function (values inserted before the first value >= them, the value of `length` bars back removed), its value at
 * rank `ceil(percentage / 100 * length)`. A new step on the same bar first undoes the step not committed.
 */
class PercentileNearestRankStep {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private readonly rank: number;
  /** The step not committed: where it inserted, where it removed (-1: none) and what */
  private pending: { k: number; old: number; value: number; bar: number } | null = null;

  constructor(private readonly length: number, percentage: number) {
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(i: number, v: number): number {
    const { values, bars, length } = this;
    const p = this.pending;
    if (p) {
      if (p.old >= 0) {
        values.splice(p.old, 0, p.value);
        bars.splice(p.old, 0, p.bar);
      }
      values.splice(p.k, 1);
      bars.splice(p.k, 1);
    }
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    values.splice(k, 0, v);
    bars.splice(k, 0, i);
    let old = -1;
    let value = NaN;
    let bar = -1;
    if (i >= length) {
      old = bars.indexOf(i - length);
      value = values[old]!;
      bar = bars[old]!;
      values.splice(old, 1);
      bars.splice(old, 1);
    }
    this.pending = { k, old, value, bar };
    return i < length - 1 ? NaN : values[this.rank - 1]!;
  }

  commit(): void {
    this.pending = null;
  }
}

/**
 * logistic_prob(series): mean = ta.sma(series, mean_lb); z = (series - mean) * slope;
 * prob_raw = 1.0 / (1.0 + math.exp(-z)); ta.ema(prob_raw, smooth_len)
 */
class LogisticProb {
  readonly mean = taStep.sma();
  readonly ema: ReturnType<typeof taStep.ema>;

  constructor(private readonly meanLookback: number, private readonly slope: number, smoothLength: number) {
    this.ema = taStep.ema(smoothLength);
  }

  step(v: number): number {
    const mean = this.mean.step(v, this.meanLookback) ?? NaN;
    const probRaw = 1.0 / (1.0 + Math.exp(-((v - mean) * this.slope)));
    return this.ema.step(probRaw) ?? NaN;
  }

  commit(): void {
    this.mean.commit();
    this.ema.commit();
  }
}

interface DloRun extends BarRunState<Record<string, never>> {
  dmi: ReturnType<typeof taStep.dmi>;
  probPlus: LogisticProb;
  probMinus: LogisticProb;
  probAdx: LogisticProb;
  strengthEma: ReturnType<typeof taStep.ema>;
  sSmaStep: ReturnType<typeof taStep.sma>;
  sEmaStep: ReturnType<typeof taStep.ema>;
  cycleEma: ReturnType<typeof taStep.ema>;
  pLowerSma: PercentileNearestRankStep;
  pUpperSma: PercentileNearestRankStep;
  pLowerEma: PercentileNearestRankStep;
  pUpperEma: PercentileNearestRankStep;
  strength: number[];
  sSma: number[];
  sEma: number[];
  sSmaCycle: number[];
  lowerSma: number[];
  upperSma: number[];
  lowerEma: number[];
  upperEma: number[];
  mrBuy: boolean[];
  mrSell: boolean[];
  revUp: boolean[];
  revDn: boolean[];
  strengthPlot: { time: number; value: number; color: string }[];
  maPlot: { time: number; value: number }[];
  barColors: BarColorData[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DirectionalLogisticOscillatorInputs>): BarStudy<DloRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const upStrong = cfg.buyColor;
  const dnStrong = cfg.sellColor;
  const upWeak = String(color.new(upStrong, 70));
  const dnWeak = String(color.new(dnStrong, 70));
  const upBg = String(color.new(upStrong, 95));
  const dnBg = String(color.new(dnStrong, 95));

  // tanh(x) of the script: e2x = math.exp(2 * x); (e2x - 1) / (e2x + 1)
  const tanh = (x: number) => {
    const e2x = Math.exp(2 * x);
    return (e2x - 1) / (e2x + 1);
  };
  // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]
  // (exact comparisons: ta.crossover / ta.crossunder do not use the 1e-10 tolerance of the operators)
  const crossover = (a: number[], b: number[], k: number) =>
    k > 0 && a[k] > b[k] && !isNaN(a[k - 1]) && !isNaN(b[k - 1]) && !(a[k - 1] > b[k - 1]);
  const crossunder = (a: number[], b: number[], k: number) =>
    k > 0 && a[k] < b[k] && !isNaN(a[k - 1]) && !isNaN(b[k - 1]) && !(a[k - 1] < b[k - 1]);
  // i = intrabar ? 0 : 1: every output reads its series i bars back (na / false before the first bar)
  const off = cfg.intrabar ? 0 : 1;
  const num = (a: number[], k: number) => (k - off >= 0 ? a[k - off] : NaN);
  const flag = (a: boolean[], k: number) => k - off >= 0 && a[k - off];

  return {
    init() {
      // [plus_di, minus_di, adx] = ta.dmi(di_len, di_len)
      const dmi = taStep.dmi(cfg.diLength, cfg.diLength);
      const probPlus = new LogisticProb(cfg.meanLookback, cfg.slope, cfg.smoothLength);
      const probMinus = new LogisticProb(cfg.meanLookback, cfg.slope, cfg.smoothLength);
      const probAdx = new LogisticProb(cfg.meanLookback, cfg.slope, cfg.smoothLength);
      const strengthEma = taStep.ema(cfg.smoothLength);
      const sSmaStep = taStep.sma();
      const sEmaStep = taStep.ema(cfg.oscSmoothLength);
      const cycleEma = taStep.ema(Math.ceil(cfg.oscSmoothLength / 2));
      // percentile thresholds over mean_lb bars
      const pLowerSma = new PercentileNearestRankStep(cfg.meanLookback, 10);
      const pUpperSma = new PercentileNearestRankStep(cfg.meanLookback, 90);
      const pLowerEma = new PercentileNearestRankStep(cfg.meanLookback, 5);
      const pUpperEma = new PercentileNearestRankStep(cfg.meanLookback, 95);
      const s: DloRun = {
        dmi, probPlus, probMinus, probAdx, strengthEma, sSmaStep, sEmaStep, cycleEma, pLowerSma, pUpperSma, pLowerEma,
        pUpperEma, strength: [], sSma: [], sEma: [], sSmaCycle: [], lowerSma: [], upperSma: [], lowerEma: [],
        upperEma: [], mrBuy: [], mrSell: [], revUp: [], revDn: [], strengthPlot: [], maPlot: [], barColors: [],
        markers: [], bgColors: [], flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [
          dmi, probPlus, probMinus, probAdx, strengthEma, sSmaStep, sEmaStep, cycleEma, pLowerSma, pUpperSma, pLowerEma,
          pUpperEma,
        ],
        vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [
        s.strength, s.sSma, s.sEma, s.sSmaCycle, s.lowerSma, s.upperSma, s.lowerEma, s.upperEma, s.mrBuy, s.mrSell,
        s.revUp, s.revDn, s.strengthPlot, s.maPlot, s.barColors, ...s.flags,
      ];
      return s;
    },
    bar(s, k, bars) {
      const b = bars[k];
      const t = b.time;
      const [plusDi, minusDi, adx] = s.dmi.step(b.high, b.low, b.close);
      const probPlus = s.probPlus.step(plusDi ?? NaN);
      const probMinus = s.probMinus.step(minusDi ?? NaN);
      const probAdx = s.probAdx.step(adx ?? NaN);

      // strength = ta.ema(tanh((prob_plus - prob_minus) * prob_adx * osc_scale), smooth_len)
      const bounded = tanh((probPlus - probMinus) * probAdx * cfg.oscScale);
      const strengthK = s.strengthEma.step(bounded) ?? NaN;
      s.strength[k] = strengthK;

      // s_sma = ta.sma(strength, osc_smooth_len); s_ema = ta.ema(...); s_sma_cycle = ta.ema(s_sma, math.ceil(len / 2))
      const sSmaK = s.sSmaStep.step(strengthK, cfg.oscSmoothLength) ?? NaN;
      const sEmaK = s.sEmaStep.step(strengthK) ?? NaN;
      s.sSma[k] = sSmaK;
      s.sEma[k] = sEmaK;
      s.sSmaCycle[k] = s.cycleEma.step(sSmaK) ?? NaN;

      // percentile thresholds over mean_lb bars
      s.lowerSma[k] = s.pLowerSma.step(k, sSmaK) ?? NaN;
      s.upperSma[k] = s.pUpperSma.step(k, sSmaK) ?? NaN;
      s.lowerEma[k] = s.pLowerEma.step(k, sEmaK) ?? NaN;
      s.upperEma[k] = s.pUpperEma.step(k, sEmaK) ?? NaN;

      const cyc = (j: number) => (j >= 0 ? s.sSmaCycle[j] : NaN);
      s.mrBuy[k] = crossover(s.sSma, s.lowerSma, k) || crossover(s.sEma, s.lowerEma, k);
      s.mrSell[k] = crossunder(s.sSma, s.upperSma, k) || crossunder(s.sEma, s.upperEma, k);
      // rev_up_c = s_sma_cycle > s_sma_cycle[1] and not (s_sma_cycle[1] > s_sma_cycle[2])
      s.revUp[k] = gt(cyc(k), cyc(k - 1)) && !gt(cyc(k - 1), cyc(k - 2));
      s.revDn[k] = lt(cyc(k), cyc(k - 1)) && !lt(cyc(k - 1), cyc(k - 2));

      const sv = num(s.strength, k);
      const e = num(s.sEma, k);
      // strength_col = strength[i] > 0 ? (strength[i] > s_ema[i] ? up_strong : up_weak)
      //                                : (strength[i] < s_ema[i] ? dn_strong : dn_weak)   (na: dn_weak)
      const col = gt(sv, 0) ? (gt(sv, e) ? upStrong : upWeak) : lt(sv, e) ? dnStrong : dnWeak;
      s.strengthPlot[k] = { time: t, value: sv, color: col };
      // plot(plot_ma ? s_sma[i] : na, "Osc MA")
      s.maPlot[k] = { time: t, value: cfg.plotMA ? num(s.sSma, k) : NaN };

      // plotchar(..., location.belowbar / abovebar, size = size.tiny, force_overlay = true)
      const markers = s.markers;
      if (cfg.plotMeanReversion && flag(s.mrBuy, k)) {
        markers.push({ time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '▲',
          textColor: upStrong, size: 'tiny', forceOverlay: true });
      }
      if (cfg.plotMeanReversion && flag(s.mrSell, k)) {
        markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '▼',
          textColor: dnStrong, size: 'tiny', forceOverlay: true });
      }
      if (cfg.plotReversion && flag(s.revUp, k)) {
        markers.push({ time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '⬆',
          textColor: upStrong, size: 'tiny', forceOverlay: true });
      }
      if (cfg.plotReversion && flag(s.revDn, k)) {
        markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '⬇',
          textColor: dnStrong, size: 'tiny', forceOverlay: true });
      }

      // bgcolor(strength[i] > 0.5 and s_ema[i] > 0.5 ? color.new(up, 95) : strength[i] < -0.5 and s_ema[i] < -0.5 ? ...)
      if (gt(sv, 0.5) && gt(e, 0.5)) s.bgColors.push({ time: t, color: upBg });
      else if (lt(sv, -0.5) && lt(e, -0.5)) s.bgColors.push({ time: t, color: dnBg });
      // barcolor(strength_col)
      s.barColors[k] = { time: t, color: col };

      // alertcondition(rev_up_c) / (rev_dn_c) / (bc1 or bc2) / (sc1 or sc2) / (ta.crossover(strength, 0)) /
      // (ta.crossunder(strength, 0))
      const prevStrength = k > 0 ? s.strength[k - 1] : NaN;
      const flags = [
        s.revUp[k], s.revDn[k], s.mrBuy[k], s.mrSell[k], strengthK > 0 && prevStrength <= 0,
        strengthK < 0 && prevStrength >= 0,
      ];
      for (let j = 0; j < 6; j++) {
        s.flags[j][k] = flags[j];
        if (flags[j]) s.times[j].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.strengthPlot.slice(), plot1: s.maPlot.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dashed' } },
          { value: 0.5, options: { title: 'Strong +', color: upWeak, linestyle: 'dotted' } },
          { value: -0.5, options: { title: 'Strong -', color: dnWeak, linestyle: 'dotted' } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DirectionalLogisticOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DirectionalLogisticOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '[DLO] Reversion Up', message: 'DLO: Potential bullish reversion detected (cycle turning upward)' },
  { id: 'alert1', title: '[DLO] Reversion Down', message: 'DLO: Potential bearish reversion detected (cycle turning downward)' },
  { id: 'alert2', title: '[DLO] MR Buy', message: 'DLO: Mean-reversion BUY – oscillator crossed up from extreme oversold zone (percentile-based)' },
  { id: 'alert3', title: '[DLO] MR Sell', message: 'DLO: Mean-reversion SELL – oscillator crossed down from extreme overbought zone (percentile-based)' },
  { id: 'alert4', title: '[DLO] Osc Bullish Cross', message: 'DLO: Oscillator crossed above zero → bullish momentum shift' },
  { id: 'alert5', title: '[DLO] Osc Bearish Cross', message: 'DLO: Oscillator crossed below zero → bearish momentum shift' },
];

export const DirectionalLogisticOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
