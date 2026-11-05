/**
 * Keltner-Aroon-EFI Flow
 *
 * Three votes of -1 / 0 / 1: the close outside a Keltner channel (EMA +- ATR(10) * multiplier), an Aroon-style
 * comparison of the bars since the highest high / lowest low (above 70), and the sign of the EMA of the Elder force
 * index. The average of the active votes is smoothed by an ALMA; the flow is 1 above 0.1, -1 below -0.1, else 0.
 * A DEMA(200) signal line and the candles take the flow colour; a Supertrend(3, 10) is drawn as up / down bands, with
 * gradient fills from the Supertrend and from the close to the signal line.
 * Alerts (alertcondition, `alerts` of the result): 'KAE Long' when the smoothed vote crosses over 0.1, 'KAE Short'
 * when it crosses under -0.1.
 *
 * Reference: "Keltner-Aroon-EFI Flow" by D_QUANT
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © D_QUANT
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface KeltnerAroonEfiFlowInputs {
  kcLength: number;
  kcMult: number;
  aroonLength: number;
  efiLength: number;
  /** ALMA smoothing of the average vote */
  useSmoothing: boolean;
  smoothLength: number;
  smoothOffset: number;
  smoothSigma: number;
  /** Include the Keltner vote */
  on1: boolean;
  /** Include the Aroon vote */
  on2: boolean;
  /** Include the EFI vote */
  on3: boolean;
}

export const defaultInputs: KeltnerAroonEfiFlowInputs = {
  kcLength: 54,
  kcMult: 1,
  aroonLength: 32,
  efiLength: 70,
  useSmoothing: true,
  smoothLength: 50,
  smoothOffset: 0.95,
  smoothSigma: 45,
  on1: true,
  on2: true,
  on3: false,
};

const G_IND = '1.1 KAE Logic Engine';
const G_SMOOTH = '1.2 Signal Processing (ALMA)';
const G_TGL = '1.3 Active Components';

export const inputConfig: InputConfig[] = [
  { id: 'kcLength', type: 'int', title: 'Keltner Length', defval: 54, group: G_IND },
  { id: 'kcMult', type: 'float', title: 'Keltner Multiplier', defval: 1, group: G_IND },
  { id: 'aroonLength', type: 'int', title: 'Aroon Length', defval: 32, group: G_IND },
  { id: 'efiLength', type: 'int', title: 'Force Index Length', defval: 70, group: G_IND },
  { id: 'useSmoothing', type: 'bool', title: 'Active Smoothing', defval: true, group: G_SMOOTH },
  { id: 'smoothLength', type: 'int', title: 'Length', defval: 50, min: 1, group: G_SMOOTH },
  { id: 'smoothOffset', type: 'float', title: 'Offset', defval: 0.95, min: 0.0, max: 1.0, step: 0.05, group: G_SMOOTH },
  { id: 'smoothSigma', type: 'float', title: 'Sigma', defval: 45, min: 1, group: G_SMOOTH },
  { id: 'on1', type: 'bool', title: 'Include Keltner (Trend)', defval: true, group: G_TGL },
  { id: 'on2', type: 'bool', title: 'Include Aroon (Strength)', defval: true, group: G_TGL },
  { id: 'on3', type: 'bool', title: 'Include EFI (Volume)', defval: false, group: G_TGL },
];

const COL_LONG_DEEP = String(color.rgb(0, 45, 92));
const COL_LONG_BBL = String(color.rgb(0, 85, 164));
const COL_SHORT = String(color.rgb(255, 255, 255));
const COL_NEUTRAL = String(color.rgb(120, 123, 134));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signal Line', color: COL_NEUTRAL, lineWidth: 2 },
  { id: 'plot1', title: 'Source', color: String(color.new(COL_NEUTRAL, 100)), lineWidth: 1 },
  { id: 'plot2', title: 'Band-Up', color: COL_LONG_BBL, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Band-Down', color: COL_SHORT, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Keltner-Aroon-EFI Flow',
  shortTitle: '|K| |A| |E| |F| ',
  overlay: true,
  precision: 2,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time: the best of the last
 * `length` non-na values (+-infinity skipped), the newest one on equal values, as an offset `-(bar - its bar)` (-0 on
 * the current bar); na before bar `length - 1` and while no value was received (the rules of the library function).
 */
class ExtremeBarsStep implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private pending = NaN;
  private pendingBar = -1;
  private stepped = false;

  constructor(private readonly length: number, private readonly lowest: boolean) {}

  step(bar: number, value: number): number {
    this.stepped = true;
    this.pending = value;
    this.pendingBar = bar;
    const len = Math.trunc(this.length);
    const own = Number.isFinite(value);
    const count = this.values.length + (own ? 1 : 0);
    const k = count - 1;
    if (bar < len - 1 || k < 0) return NaN;
    const at = (j: number) => (j === this.values.length ? value : this.values[j]);
    let best = k;
    for (let j = k - 1; j >= 0 && j > k - len; j--) {
      if (this.lowest ? at(j) < at(best) : at(j) > at(best)) best = j;
    }
    return -(bar - (best === this.values.length ? bar : this.bars[best]));
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    if (Number.isFinite(this.pending)) {
      this.values.push(this.pending);
      this.bars.push(this.pendingBar);
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface KaeRun extends BarRunState<Record<string, never>> {
  kcEma: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  hb: ExtremeBarsStep;
  lb: ExtremeBarsStep;
  efiEma: ReturnType<typeof taStep.ema>;
  ma1: ReturnType<typeof taStep.ema>;
  ma2: ReturnType<typeof taStep.ema>;
  st: ReturnType<typeof taStep.supertrend>;
  rawSignal: number[];
  avgSignal: number[];
  plots: Point[][];
  kaeft: number[];
  sig: number[];
  topColors: (string | null)[][];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

const longDeep80 = String(color.new(COL_LONG_DEEP, 80));
const short80 = String(color.new(COL_SHORT, 80));
const gray90 = String(color.new(color.gray, 90));
const short90 = String(color.new(COL_SHORT, 90));
const longDeep85 = String(color.new(COL_LONG_DEEP, 85));
const gray95 = String(color.new(color.gray, 95));
const num = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<KeltnerAroonEfiFlowInputs>): BarStudy<KaeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // ta.alma(rawSignal, smoothLength, smoothOffset, smoothSigma): the normalised gaussian weights of the window
  const almaLen = cfg.smoothLength;
  const weights: number[] = [];
  if (cfg.useSmoothing) {
    const m = cfg.smoothOffset * (almaLen - 1);
    const sg = almaLen / cfg.smoothSigma;
    let weightSum = 0;
    for (let j = 0; j < almaLen; j++) {
      const weight = Math.exp(-1 * Math.pow(j - m, 2) / (2 * Math.pow(sg, 2)));
      weights.push(weight);
      weightSum += weight;
    }
    for (let j = 0; j < almaLen; j++) weights[j] /= weightSum;
  }
  return {
    init() {
      const s: KaeRun = {
        kcEma: taStep.ema(cfg.kcLength), atr: taStep.atr(10), hb: new ExtremeBarsStep(cfg.aroonLength, false),
        lb: new ExtremeBarsStep(cfg.aroonLength, true), efiEma: taStep.ema(cfg.efiLength), ma1: taStep.ema(200),
        ma2: taStep.ema(200), st: taStep.supertrend(3, 10), rawSignal: [], avgSignal: [],
        plots: [[], [], [], []], kaeft: [], sig: [], topColors: [[], [], []], candles: [], flags: [[], []],
        times: [[], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        ...(cfg.on1 ? [s.kcEma, s.atr] : []), ...(cfg.on2 ? [s.hb, s.lb] : []), ...(cfg.on3 ? [s.efiEma] : []),
        s.ma1, s.ma2, s.st,
      ];
      s.lists = s.times;
      s.series = [s.rawSignal, s.avgSignal, ...s.plots, s.kaeft, s.sig, ...s.topColors, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // Votes (constant toggles: each function runs on every bar or on none)
      let s1 = NaN;
      let s2 = NaN;
      let s3 = NaN;
      if (cfg.on1) {
        // f_keltner: ema(close, len) +- atr(10) * mult
        const ma = s.kcEma.step(b.close);
        const rng = s.atr.step(b.high, b.low, b.close);
        const upper = ma + rng * cfg.kcMult;
        const lower = ma - rng * cfg.kcMult;
        let val = 0;
        if (gt(b.close, upper)) val = 1;
        if (lt(b.close, lower)) val = -1;
        s1 = val;
      }
      if (cfg.on2) {
        // f_aroon: 100 * (ta.highestbars(high, len) + len) / len, same with lowestbars(low)
        const len = cfg.aroonLength;
        const upper = (100 * (s.hb.step(i, b.high) + len)) / len;
        const lower = (100 * (s.lb.step(i, b.low) + len)) / len;
        let val = 0;
        if (gt(upper, lower) && gt(upper, 70)) val = 1;
        if (gt(lower, upper) && gt(lower, 70)) val = -1;
        s2 = val;
      }
      if (cfg.on3) {
        // f_efi: ema((close - close[1]) * volume, len)
        const efiRaw = i > 0 ? (b.close - bars[i - 1].close) * (b.volume ?? NaN) : NaN;
        const efiSmooth = s.efiEma.step(efiRaw);
        let val = 0;
        if (gt(efiSmooth, 0)) val = 1;
        if (lt(efiSmooth, 0)) val = -1;
        s3 = val;
      }

      let numerator = 0.0;
      let denominator = 0;
      if (cfg.on1 && !isNaN(s1)) { numerator += s1; denominator += 1; }
      if (cfg.on2 && !isNaN(s2)) { numerator += s2; denominator += 1; }
      if (cfg.on3 && !isNaN(s3)) { numerator += s3; denominator += 1; }
      const rawSignal = denominator > 0 ? numerator / denominator : 0.0;
      s.rawSignal[i] = rawSignal;
      let avgSignal = rawSignal;
      if (cfg.useSmoothing) {
        if (i < almaLen - 1) avgSignal = NaN;
        else {
          let almaValue = 0;
          for (let j = 0; j < almaLen; j++) almaValue += s.rawSignal[i - almaLen + 1 + j] * weights[j];
          avgSignal = almaValue;
        }
      }
      s.avgSignal[i] = avgSignal;

      // Flow = avg > 0.1 ? 1 : avg < -0.1 ? -1 : 0
      const flow = gt(avgSignal, 0.1) ? 1 : lt(avgSignal, -0.1) ? -1 : 0;
      const colorMain = flow === 1 ? COL_LONG_DEEP : flow === -1 ? COL_SHORT : COL_NEUTRAL;

      // Signal line: DEMA(200) of the close
      const ma1 = s.ma1.step(b.close);
      const ma2 = s.ma2.step(ma1);
      const sig = 2 * ma1 - ma2;

      // [kaeft, kaefw] = ta.supertrend(3, 10)
      const [kaeft, kaefw] = s.st.step(b.high, b.low, b.close);
      s.kaeft[i] = num(kaeft);
      s.sig[i] = num(sig);

      const p = s.plots;
      p[0][i] = { time, value: num(sig), color: colorMain };
      p[1][i] = { time, value: b.close, color: String(color.new(colorMain, 100)) };
      // kaefw < 0 (na compares false)
      const up = kaefw < 0;
      p[2][i] = { time, value: up ? num(kaeft) : NaN, color: COL_LONG_BBL };
      p[3][i] = { time, value: up ? NaN : num(kaeft), color: COL_SHORT };
      s.topColors[0][i] = flow === 1 ? longDeep80 : flow === -1 ? null : gray90;
      s.topColors[1][i] = flow === -1 ? short80 : flow === 1 ? null : gray90;
      s.topColors[2][i] = flow === -1 ? short90 : flow === 1 ? longDeep85 : gray95;

      // plotcandle(open, high, low, close, 'BarColor', color_main, wickcolor = color_main, bordercolor = color_main,
      //   force_overlay = true)
      s.candles[i] = {
        time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: colorMain, wickColor: colorMain, borderColor: colorMain, forceOverlay: true,
      };

      // alertcondition(ta.crossover(avgIndicatorSignal, 0.1), "KAE Long");
      // alertcondition(ta.crossunder(avgIndicatorSignal, -0.1), "KAE Short")
      const prev = i > 0 ? s.avgSignal[i - 1] : NaN;
      const long = avgSignal > 0.1 && prev <= 0.1;
      const short = avgSignal < -0.1 && prev >= -0.1;
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const nulls = (): (string | null)[] => new Array(n).fill(null);
      const fills = [
        // fill(PlotSig, kaefUp, kaeft, sig, Flow == 1 ? color.new(col_long_deep, 80) : Flow == -1 ? na : gray 90, na)
        { plot1: 'plot0', plot2: 'plot2', gradient: {
          topValue: s.kaeft.slice(), bottomValue: s.sig.slice(), topColor: s.topColors[0].slice(), bottomColor: nulls() } },
        // fill(PlotSig, kaefDown, kaeft, sig, Flow == -1 ? color.new(col_short, 80) : Flow == 1 ? na : gray 90, na)
        { plot1: 'plot0', plot2: 'plot3', gradient: {
          topValue: s.kaeft.slice(), bottomValue: s.sig.slice(), topColor: s.topColors[1].slice(), bottomColor: nulls() } },
        // fill(PlotSig, SRC, close, sig, Flow == -1 ? short 90 : Flow == 1 ? long_deep 85 : gray 95, na)
        { plot1: 'plot0', plot2: 'plot1', gradient: {
          topValue: bars.map((b) => b.close), bottomValue: s.sig.slice(), topColor: s.topColors[2].slice(), bottomColor: nulls() } },
      ];
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        fills,
        plotCandles: { barColor: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KeltnerAroonEfiFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KeltnerAroonEfiFlowInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'KAE Long', message: 'KAE Flow turned Bullish' },
  { id: 'alert1', title: 'KAE Short', message: 'KAE Flow turned Bearish' },
];

export const KeltnerAroonEfiFlow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
