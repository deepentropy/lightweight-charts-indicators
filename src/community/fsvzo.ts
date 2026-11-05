/**
 * FSVZO [Alpha Extract]
 *
 * A volume-weighted momentum oscillator. The price change and the relative volume (volume / SMA of volume) are
 * EMA-smoothed; their product (70 %) and the product with a trend factor (30 %: 1 +/- 0.1 from the distance of a
 * short and a long SMA of the close in standard deviations) is smoothed again. The EMAs of the positive and negative
 * momentum give a ratio r and vzo_raw = 100 * (r - 1) / (r + 1). The oscillator is 60 % of an EMA of vzo_raw plus
 * 40 % of an exponentially weighted average (clamped to -100..100), with an SMA signal line and a flow momentum line
 * (oscillator - its EMA) / 2. Colours move between the primary and secondary colours with the momentum intensity.
 * Circles mark the turns of the oscillator, crosses / triangles the turns beyond +/-90, and pivot divergences
 * (regular and hidden) give lines and labels.
 * Alerts (alertcondition, `alerts` of the result): the oscillator crossing its signal line, and the same crosses
 * beyond -80 / +80 (reversals).
 *
 * Reference: "FSVZO [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type FsvzoGradientStyle = 'Modern' | 'Ocean' | 'Sunset' | 'Aurora' | 'Neon';

export interface FsvzoInputs {
  /** VZO length */
  length: number;
  /** Signal line (SMA) length */
  signalLength: number;
  /** Period of the exponential smoothing */
  smoothingLength: number;
  /** Number of periods of the Fourier-based smoothing */
  fourierLength: number;
  /** Window of the trend filter (ADF test approximation) */
  adfWindow: number;
  /** Overbought level (not used by the outputs, as in the original script) */
  overboughtLevel: number;
  /** Oversold level (not used by the outputs, as in the original script) */
  oversoldLevel: number;
  /** EMA length of the flow momentum */
  momentumLookback: number;
  enableVolumeDynamics: boolean;
  enableFlowMomentum: boolean;
  enableSignalMarkers: boolean;
  /** Confirm the flip markers on bar close (historical bars are always confirmed) */
  confirmOnClose: boolean;
  enableStandardBullDiv: boolean;
  enableHiddenBullDiv: boolean;
  enableStandardBearDiv: boolean;
  enableHiddenBearDiv: boolean;
  /** Use the colours of the gradient style instead of the manual colours */
  useColorPalette: boolean;
  /** Preset palette (also gives the neutral colours) */
  gradientStyle: FsvzoGradientStyle;
  manualBullPrimary: string;
  manualBullSecondary: string;
  manualBearPrimary: string;
  manualBearSecondary: string;
  pivotBarsRight: number;
  pivotBarsLeft: number;
}

export const defaultInputs: FsvzoInputs = {
  length: 9,
  signalLength: 3,
  smoothingLength: 3,
  fourierLength: 31,
  adfWindow: 50,
  overboughtLevel: 60,
  oversoldLevel: 40,
  momentumLookback: 14,
  enableVolumeDynamics: true,
  enableFlowMomentum: true,
  enableSignalMarkers: true,
  confirmOnClose: true,
  enableStandardBullDiv: true,
  enableHiddenBullDiv: true,
  enableStandardBearDiv: true,
  enableHiddenBearDiv: true,
  useColorPalette: false,
  gradientStyle: 'Modern',
  manualBullPrimary: '#13fed9',
  manualBullSecondary: '#13fed9',
  manualBearPrimary: '#f23744',
  manualBearSecondary: '#f23744',
  pivotBarsRight: 1,
  pivotBarsLeft: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'VZO Length', defval: 9, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Line Length', defval: 3, min: 1 },
  { id: 'smoothingLength', type: 'int', title: 'Smoothing Period', defval: 3, min: 1 },
  { id: 'fourierLength', type: 'int', title: 'Fourier Approx. Length', defval: 31, min: 5 },
  { id: 'adfWindow', type: 'int', title: 'ADF Test Approx. Window', defval: 50, min: 10 },
  { id: 'overboughtLevel', type: 'int', title: 'Overbought Level', defval: 60, min: 0, max: 100 },
  { id: 'oversoldLevel', type: 'int', title: 'Oversold Level', defval: 40, min: 0, max: 100 },
  { id: 'momentumLookback', type: 'int', title: 'Flow Momentum Lookback', defval: 14, min: 1 },
  { id: 'enableVolumeDynamics', type: 'bool', title: 'Enable Volume Dynamics', defval: true },
  { id: 'enableFlowMomentum', type: 'bool', title: 'Enable Flow Momentum', defval: true },
  { id: 'enableSignalMarkers', type: 'bool', title: 'Enable Signal Markers', defval: true },
  { id: 'confirmOnClose', type: 'bool', title: 'Confirm Markers on Bar Close', defval: true },
  { id: 'enableStandardBullDiv', type: 'bool', title: 'Standard Bullish Divergence', defval: true },
  { id: 'enableHiddenBullDiv', type: 'bool', title: 'Hidden Bullish Divergence', defval: true },
  { id: 'enableStandardBearDiv', type: 'bool', title: 'Standard Bearish Divergence', defval: true },
  { id: 'enableHiddenBearDiv', type: 'bool', title: 'Hidden Bearish Divergence', defval: true },
  { id: 'useColorPalette', type: 'bool', title: 'Use Color Palette', defval: false },
  { id: 'gradientStyle', type: 'string', title: 'Gradient Style', defval: 'Modern', options: ['Modern', 'Ocean', 'Sunset', 'Aurora', 'Neon'] },
  { id: 'manualBullPrimary', type: 'color', title: 'Bull Primary Color', defval: '#13fed9' },
  { id: 'manualBullSecondary', type: 'color', title: 'Bull Secondary Color', defval: '#13fed9' },
  { id: 'manualBearPrimary', type: 'color', title: 'Bear Primary Color', defval: '#f23744' },
  { id: 'manualBearSecondary', type: 'color', title: 'Bear Secondary Color', defval: '#f23744' },
  { id: 'pivotBarsRight', type: 'int', title: 'Pivot Right Bars', defval: 1 },
  { id: 'pivotBarsLeft', type: 'int', title: 'Pivot Left Bars', defval: 10 },
];

/** Preset colours per gradient style: bull primary / secondary, bear primary / secondary, neutral primary / secondary */
const PALETTES: Record<FsvzoGradientStyle, [string, string, string, string, string, string]> = {
  Modern: ['#00D4FF', '#0099CC', '#FF6B6B', '#CC5555', '#4ECDC4', '#45B7D1'],
  Ocean: ['#4FC3F7', '#29B6F6', '#FF5722', '#E64A19', '#26C6DA', '#00ACC1'],
  Sunset: ['#FFB74D', '#FF9800', '#E91E63', '#C2185B', '#FF7043', '#FF5722'],
  Aurora: ['#81C784', '#66BB6A', '#BA68C8', '#AB47BC', '#64B5F6', '#42A5F5'],
  Neon: ['#00ffa6', '#00ffa6', '#FF1744', '#D50000', '#00B0FF', '#0091EA'],
};

const DEFAULT_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Enhanced Reference Line', color: String(color.new('#45B7D1', 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Enhanced Flow Momentum', color: String(color.new('#13fed9', 60)), lineWidth: 1 },
  { id: 'plot2', title: 'Enhanced Volume Dynamics', color: '#13fed9', lineWidth: 1 },
  { id: 'plot3', title: 'Enhanced Signal Line', color: String(color.new('#13fed9', 40)), lineWidth: 1 },
  { id: 'plot4', title: 'Boundary', color: DEFAULT_BLUE, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Upper Extreme', color: DEFAULT_BLUE, lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Lower Extreme', color: DEFAULT_BLUE, lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Upper Threshold', color: DEFAULT_BLUE, lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Lower Threshold', color: DEFAULT_BLUE, lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Enhanced Bull Divergence', color: '#13fed9', lineWidth: 1 },
  { id: 'plot10', title: 'Enhanced Hidden Bull Divergence', color: String(color.new('#13fed9', 50)), lineWidth: 1 },
  { id: 'plot11', title: 'Enhanced Bear Divergence', color: '#f23744', lineWidth: 1 },
  { id: 'plot12', title: 'Enhanced Hidden Bear Divergence', color: String(color.new('#f23744', 50)), lineWidth: 1 },
];

export const metadata = {
  title: 'FSVZO [Alpha Extract]',
  shortTitle: 'FSVZO [Alpha Extract]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FsvzoVars {
  /** ta.valuewhen(pivot, x, 1) histories: the last two values (older first) */
  plO: readonly number[];
  plL: readonly number[];
  phO: readonly number[];
  phH: readonly number[];
  /** Calls of the four ta.barssince of validate_range (Pine v6 `and` is lazy), changed in place */
  calls: number[];
}

interface FsvzoRun extends BarRunState<FsvzoVars> {
  smaShort: ReturnType<typeof taStep.sma>;
  smaLong: ReturnType<typeof taStep.sma>;
  stdev: ReturnType<typeof taStep.stdev>;
  volSma: ReturnType<typeof taStep.sma>;
  smoothedVol: ReturnType<typeof taStep.ema>;
  smoothedChange: ReturnType<typeof taStep.ema>;
  baseMomentum: ReturnType<typeof taStep.ema>;
  trendMomentum: ReturnType<typeof taStep.ema>;
  posMom: ReturnType<typeof taStep.ema>;
  negMom: ReturnType<typeof taStep.ema>;
  emaRaw: ReturnType<typeof taStep.ema>;
  signal: ReturnType<typeof taStep.sma>;
  change3: ReturnType<typeof taStep.change>;
  maxStrength: ReturnType<typeof taStep.highest>;
  vzoEma: ReturnType<typeof taStep.ema>;
  pl: PivotStep;
  ph: PivotStep;
  vzoRaw: number[];
  vzo: number[];
  signalArr: number[];
  rising: boolean[];
  lowPivot: boolean[];
  highPivot: boolean[];
  /** plot0..plot8 */
  plots: Point[][];
  /** plot9..plot12: one point per bar from bar pivot_bars_right (the point of bar i - pivot_bars_right) */
  divPlots: Point[][];
  fill0: string[];
  fill1: { top: number[]; bottom: number[]; topColor: string[]; bottomColor: string[] };
  fill2: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen(cond, source, 1) history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<FsvzoInputs>): BarStudy<FsvzoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rb = cfg.pivotBarsRight;

  // ── Colours ──
  const pal = PALETTES[cfg.gradientStyle] ?? PALETTES.Modern;
  const bullPrimary = cfg.useColorPalette ? pal[0] : cfg.manualBullPrimary;
  const bullSecondary = cfg.useColorPalette ? pal[1] : cfg.manualBullSecondary;
  const bearPrimary = cfg.useColorPalette ? pal[2] : cfg.manualBearPrimary;
  const bearSecondary = cfg.useColorPalette ? pal[3] : cfg.manualBearSecondary;
  const neutralPrimary = pal[4];
  const neutralSecondary = pal[5];

  // get_dynamic_color: RGB between the primary and the secondary colour (math.round of na is na: channel 0)
  const dynColor = (isBullish: boolean, strength: number): string => {
    const c1 = isBullish ? bullPrimary : bearPrimary;
    const c2 = isBullish ? bullSecondary : bearSecondary;
    const mix = (a: number, b: number) => Math.round(a + (b - a) * strength);
    return String(color.rgb(mix(color.r(c1), color.r(c2)), mix(color.g(c1), color.g(c2)), mix(color.b(c1), color.b(c2))));
  };

  const transparent = String(color.new(color.white, 100));
  const zeroColor = String(color.new(neutralSecondary, 70));
  const hiddenBullColor = String(color.new(bullPrimary, 50));
  const hiddenBearColor = String(color.new(bearPrimary, 50));
  const bullDivColor = dynColor(true, 0.8);
  const bearDivColor = dynColor(false, 0.8);
  const showFlips = cfg.enableVolumeDynamics && cfg.enableSignalMarkers;
  const white80 = String(color.new(color.white, 20));
  const bullFull = dynColor(true, 1.0);
  const bearFull = dynColor(false, 1.0);
  const bullLabel = dynColor(true, 0.9);
  const bearLabel = dynColor(false, 0.9);
  const fill1Top = String(color.new(dynColor(true, 0.5), 85));
  const fill1Bottom = String(color.new(dynColor(false, 0.5), 85));
  const fourierWeights: number[] = [];
  for (let k = 0; k < cfg.fourierLength; k++) fourierWeights.push(Math.exp(-k / (cfg.fourierLength * 0.3)));

  return {
    init() {
      const s: FsvzoRun = {
        smaShort: taStep.sma(), smaLong: taStep.sma(), stdev: taStep.stdev(), volSma: taStep.sma(),
        smoothedVol: taStep.ema(cfg.smoothingLength), smoothedChange: taStep.ema(cfg.smoothingLength),
        baseMomentum: taStep.ema(cfg.smoothingLength), trendMomentum: taStep.ema(cfg.smoothingLength),
        posMom: taStep.ema(cfg.length), negMom: taStep.ema(cfg.length), emaRaw: taStep.ema(cfg.smoothingLength),
        signal: taStep.sma(), change3: taStep.change(3), maxStrength: taStep.highest(),
        vzoEma: taStep.ema(cfg.momentumLookback),
        pl: new PivotStep(cfg.pivotBarsLeft, rb, false), ph: new PivotStep(cfg.pivotBarsLeft, rb, true),
        vzoRaw: [], vzo: [], signalArr: [], rising: [], lowPivot: [], highPivot: [],
        plots: Array.from({ length: 9 }, () => []), divPlots: Array.from({ length: 4 }, () => []),
        fill0: [], fill1: { top: [], bottom: [], topColor: [], bottomColor: [] }, fill2: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { plO: [], plL: [], phO: [], phH: [], calls: [NaN, NaN, NaN, NaN] }, lists: [], series: [],
      };
      s.steps = [
        s.smaShort, s.smaLong, s.stdev, s.volSma, s.smoothedVol, s.smoothedChange, s.baseMomentum, s.trendMomentum,
        s.posMom, s.negMom, s.emaRaw, s.signal, s.change3, s.maxStrength, s.vzoEma, s.pl, s.ph,
      ];
      s.lists = [...s.divPlots, s.markers, ...s.times];
      s.series = [
        s.vzoRaw, s.vzo, s.signalArr, s.rising, s.lowPivot, s.highPivot, ...s.plots, s.fill0, s.fill1.top,
        s.fill1.bottom, s.fill1.topColor, s.fill1.bottomColor, s.fill2, ...s.flags,
      ];
      return s;
    },
    copyVars: (v) => ({ ...v, calls: v.calls.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;

      // ── VZO ──
      // adf_trend_filter(close, adfWindow): 1 + clamp((sma(close, window / 3) - sma(close, window)) / stdev * 0.2, +/-0.1)
      let trend = 1.0;
      if (cfg.adfWindow > 10) {
        // window / 3: a fractional length is truncated (checked: 50 / 3 gives the SMA of 16 bars)
        const smaShort = s.smaShort.step(close, Math.max(1, Math.trunc(cfg.adfWindow / 3)));
        const smaLong = s.smaLong.step(close, cfg.adfWindow);
        const vol = s.stdev.step(close, cfg.adfWindow);
        const strength = gt(vol, 0) ? (smaShort - smaLong) / vol : 0;
        trend = 1.0 + Math.max(-0.1, Math.min(0.1, strength * 0.2));
      }
      const volSma = s.volSma.step(b.volume ?? NaN, cfg.length);
      // rel_volume = volume / ta.sma(volume, length): a plain division (x / 0 is +-infinity, 0 / 0 NaN)
      const relVolume = (b.volume ?? NaN) / volSma;
      const smoothedVol = s.smoothedVol.step(relVolume);
      const priceChange = i > 0 ? close - bars[i - 1].close : NaN;
      const smoothedChange = s.smoothedChange.step(priceChange);
      const baseMomentum = s.baseMomentum.step(smoothedChange * smoothedVol);
      const trendMomentum = s.trendMomentum.step(smoothedChange * smoothedVol * trend);
      const momentum = baseMomentum * 0.7 + trendMomentum * 0.3;
      // math.max(na, 0) is na
      const posMom = s.posMom.step(isNaN(momentum) ? NaN : Math.max(momentum, 0));
      const negMom = s.negMom.step(isNaN(momentum) ? NaN : Math.abs(Math.min(momentum, 0)));
      const ratio = gt(negMom, 0.00001) ? posMom / negMom : gt(posMom, 0.00001) ? 100.0 : 1.0;
      const vzoRaw = (100.0 * (ratio - 1.0)) / (ratio + 1.0);
      s.vzoRaw[i] = vzoRaw;
      const emaRaw = s.emaRaw.step(vzoRaw);
      let finalVzo: number;
      if (cfg.fourierLength >= 5) {
        // fourier_smooth(vzo_raw, fourierLength): weights exp(-k / (length * 0.3)), vzo_raw[k] na before the first bar
        let sum = 0;
        let weightSum = 0;
        for (let k = 0; k < cfg.fourierLength; k++) {
          const weight = fourierWeights[k];
          sum = sum + (i - k >= 0 ? s.vzoRaw[i - k] : NaN) * weight;
          weightSum = weightSum + weight;
        }
        finalVzo = emaRaw * 0.6 + (sum / weightSum) * 0.4;
      } else {
        finalVzo = emaRaw;
      }
      const vzo = Math.min(Math.max(finalVzo, -100), 100);
      s.vzo[i] = vzo;
      const signal = s.signal.step(vzo, cfg.signalLength);
      s.signalArr[i] = signal;

      // intensity = max_strength > 0 ? momentum_strength / max_strength : 0
      const momentumStrength = Math.abs(s.change3.step(vzo));
      const maxStrength = s.maxStrength.step(momentumStrength, 50);
      const intensity = gt(maxStrength, 0) ? momentumStrength / maxStrength : 0;

      const rising = i > 0 && gt(vzo, s.vzo[i - 1]); // vzoRising = vzo > vzo[1]
      s.rising[i] = rising;
      // flow_momentum = (volume_oscillator - ta.ema(volume_oscillator, momentum_lookback)) * 0.5
      const flow = (vzo - s.vzoEma.step(vzo)) * 0.5;

      const P = s.plots;
      P[0][i] = { time, value: 0, color: zeroColor };
      // flow_color = flow_momentum > 0 ? color.new(get_dynamic_color(true, intensity), 60) : color.new(..(false..), 60)
      P[1][i] = { time, value: cfg.enableFlowMomentum ? flow : NaN, color: String(color.new(dynColor(gt(flow, 0), intensity), 60)) };
      P[2][i] = { time, value: cfg.enableVolumeDynamics ? vzo : NaN, color: dynColor(rising, intensity) };
      P[3][i] = { time, value: cfg.enableVolumeDynamics ? signal : NaN,
        color: String(color.new(gt(vzo, signal) ? bullSecondary : bearSecondary, 40)) };
      // boundary: vzo >= 0 ? math.min(vzo, signal) : math.max(vzo, signal) (display.none)
      P[4][i] = { time, value: !cfg.enableVolumeDynamics ? NaN
        : ge(vzo, 0) ? Math.min(vzo, signal) : Math.max(vzo, signal) };
      P[5][i] = { time, value: 120 };
      P[6][i] = { time, value: -120 };
      P[7][i] = { time, value: 80 };
      P[8][i] = { time, value: -80 };

      // ── Divergences ──
      const v = s.vars;
      const lowPivot = !isNaN(s.pl.step(i, vzo));
      const highPivot = !isNaN(s.ph.step(i, vzo));
      s.lowPivot[i] = lowPivot;
      s.highPivot[i] = highPivot;
      const o = i - rb >= 0 ? s.vzo[i - rb] : NaN;
      const lowR = i - rb >= 0 ? bars[i - rb].low : NaN;
      const highR = i - rb >= 0 ? bars[i - rb].high : NaN;
      const prevLow = i > 0 && s.lowPivot[i - 1];
      const prevHigh = i > 0 && s.highPivot[i - 1];
      // ta.valuewhen(pivot, x, 1): x on the pivot bar before the latest one (the latest can be the current bar)
      if (lowPivot) {
        v.plO = pushed(v.plO, o);
        v.plL = pushed(v.plL, lowR);
      }
      if (highPivot) {
        v.phO = pushed(v.phO, o);
        v.phH = pushed(v.phH, highR);
      }
      const vwPlO = second(v.plO);
      const vwPlL = second(v.plL);
      const vwPhO = second(v.phO);
      const vwPhH = second(v.phH);
      // validate_range(pivot[1]) = 0 <= ta.barssince(pivot[1]) <= 80. Pine v6 `and` is lazy: the barssince of each
      // of the four call sites only runs on the bars where the left side of its `and` is true (its own history).
      const calls = v.calls;
      const validate = (k: number, cond: boolean) => {
        if (cond) calls[k] = 0;
        else if (!isNaN(calls[k])) calls[k]++;
        return -80 <= calls[k] && calls[k] <= 80;
      };
      const oscHigherLow = gt(o, vwPlO) && validate(0, prevLow);
      const bullDiv = cfg.enableStandardBullDiv && lt(lowR, vwPlL) && oscHigherLow && lowPivot;
      const oscLowerLow = lt(o, vwPlO) && validate(1, prevLow);
      const hiddenBullDiv = cfg.enableHiddenBullDiv && gt(lowR, vwPlL) && oscLowerLow && lowPivot;
      const oscLowerHigh = lt(o, vwPhO) && validate(2, prevHigh);
      const bearDiv = cfg.enableStandardBearDiv && gt(highR, vwPhH) && oscLowerHigh && highPivot;
      const oscHigherHigh = gt(o, vwPhO) && validate(3, prevHigh);
      const hiddenBearDiv = cfg.enableHiddenBearDiv && lt(highR, vwPhH) && oscHigherHigh && highPivot;

      // plot(pivot ? volume_oscillator[pivot_bars_right] : na, offset = -pivot_bars_right): value of bar i on bar i - rb
      if (i >= rb) {
        const dt = bars[i - rb].time;
        s.divPlots[0].push({ time: dt, value: lowPivot ? o : NaN, color: bullDiv ? bullDivColor : transparent });
        s.divPlots[1].push({ time: dt, value: lowPivot ? o : NaN, color: hiddenBullDiv ? hiddenBullColor : transparent });
        s.divPlots[2].push({ time: dt, value: highPivot ? o : NaN, color: bearDiv ? bearDivColor : transparent });
        s.divPlots[3].push({ time: dt, value: highPivot ? o : NaN, color: hiddenBearDiv ? hiddenBearColor : transparent });
      }

      // ── Fills ──
      // fill(main_plot, signal_plot, color.new(get_dynamic_color(vzo > signal, intensity * 0.7), math.round(70 + 20 * (1 - intensity))))
      s.fill0[i] = String(color.new(dynColor(gt(vzo, signal), intensity * 0.7), Math.round(70 + 20 * (1 - intensity))));
      // fill(boundary_plot, zero_line, top_value, bottom_value, top_color, bottom_color)
      const sPos = gt(signal, 0);
      s.fill1.top[i] = sPos ? signal : 0;
      s.fill1.bottom[i] = sPos ? 0 : signal;
      s.fill1.topColor[i] = sPos ? fill1Top : '#00000000';
      s.fill1.bottomColor[i] = sPos ? '#00000000' : fill1Bottom;
      // fill(flow_plot, zero_line, color.new(color.from_gradient(+/-flow / 50, 0, 1, neutral_primary, bull / bear primary), 80))
      s.fill2[i] = String(color.new(gt(flow, 0)
        ? color.from_gradient(flow / 50, 0, 1, neutralPrimary, bullPrimary)
        : color.from_gradient(flow / -50, 0, 1, neutralPrimary, bearPrimary), 80));

      // Alerts: ta.crossover / ta.crossunder(volume_oscillator, oscillator_ema)
      const pv = i > 0 ? s.vzo[i - 1] : NaN;
      const pw = i > 0 ? s.signalArr[i - 1] : NaN;
      const bullFlow = vzo > signal && pv <= pw;
      const bearFlow = vzo < signal && pv >= pw;
      const flags = [bullFlow, bearFlow, bullFlow && lt(vzo, -80), bearFlow && gt(vzo, 80)];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }

      // ── Markers ──
      const markers = s.markers;
      // flip_to_bull_bar = bullish and not bullish[1]; flip_to_bear_bar = bearish and not bearish[1] (bearish =
      // not bullish; a bool [1] is false on the first bar). Drawn at vzo[1] with offset -1.
      const bullish = rising;
      const bearish = !rising;
      const prevBullish = i > 0 && s.rising[i - 1];
      const prevBearish = i > 0 && !s.rising[i - 1];
      const flipBull = bullish && !prevBullish;
      const flipBear = bearish && !prevBearish;
      if (showFlips && i > 0 && !isNaN(s.vzo[i - 1])) {
        if (flipBull) {
          markers.push({ time: bars[i - 1].time, position: 'atPriceMiddle', price: s.vzo[i - 1], shape: 'circle',
            color: dynColor(true, intensity), size: 'tiny', id: 'shape0' });
        }
        if (flipBear) {
          markers.push({ time: bars[i - 1].time, position: 'atPriceMiddle', price: s.vzo[i - 1], shape: 'circle',
            color: dynColor(false, intensity), size: 'tiny', id: 'shape1' });
        }
      }
      // bull_signal = ta.crossover(vzo, vzo[1]); bear_signal = ta.crossover(vzo[1], vzo)
      // (exact comparisons, no 1e-10 tolerance; na gives false)
      const v0 = vzo;
      const v1 = i > 0 ? s.vzo[i - 1] : NaN;
      const v2 = i > 1 ? s.vzo[i - 2] : NaN;
      const bullSignal = v0 > v1 && v1 <= v2;
      const bearSignal = v1 > v0 && v2 <= v1;
      // plotchar outputs char2..char5
      const char = (price: number, text: string, textColor: string, id: string) => markers.push({ time,
        position: 'atPriceMiddle', price, shape: 'circle', color: 'transparent', text, textColor, size: 'tiny', id });
      if (bullSignal && gt(v0, 90)) char(125, '×', white80, 'char2');
      if (bearSignal && lt(v0, -90)) char(-125, '×', white80, 'char3');
      if (bullSignal && lt(v0, -90)) char(-125, '▲', bullFull, 'char4');
      if (bearSignal && gt(v0, 90)) char(125, '▼', bearFull, 'char5');
      // divergence labels (offset = -pivot_bars_right, at volume_oscillator[pivot_bars_right])
      if (i - rb >= 0 && !isNaN(o)) {
        const lt0 = bars[i - rb].time;
        if (bullDiv) markers.push({ time: lt0, position: 'atPriceBottom', price: o, shape: 'labelUp', color: bullLabel,
          text: ' BULL ', textColor: color.white, size: 'tiny', id: 'shape6' });
        if (hiddenBullDiv) markers.push({ time: lt0, position: 'atPriceBottom', price: o, shape: 'labelUp',
          color: hiddenBullColor, text: ' H.BULL ', textColor: color.white, size: 'tiny', id: 'shape7' });
        if (bearDiv) markers.push({ time: lt0, position: 'atPriceTop', price: o, shape: 'labelDown', color: bearLabel,
          text: ' BEAR ', textColor: color.white, size: 'tiny', id: 'shape8' });
        if (hiddenBearDiv) markers.push({ time: lt0, position: 'atPriceTop', price: o, shape: 'labelDown',
          color: hiddenBearColor, text: ' H.BEAR ', textColor: color.white, size: 'tiny', id: 'shape9' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 9; k++) plots[`plot${k}`] = s.plots[k].slice();
      for (let k = 0; k < 4; k++) plots[`plot${9 + k}`] = s.divPlots[k].slice();
      const fills = [
        { plot1: 'plot2', plot2: 'plot3', options: { title: 'Enhanced Dynamic Fill' }, colors: s.fill0.slice() },
        { plot1: 'plot4', plot2: 'plot0',
          gradient: {
            topValue: s.fill1.top.slice(), bottomValue: s.fill1.bottom.slice(),
            topColor: s.fill1.topColor.slice(), bottomColor: s.fill1.bottomColor.slice(),
          } },
        { plot1: 'plot1', plot2: 'plot0', options: { title: 'Enhanced Flow Fill' }, colors: s.fill2.slice() },
        { plot1: 'plot5', plot2: 'plot7', options: { title: 'Enhanced Overbought Zone' },
          gradient: {
            topValue: new Array<number>(n).fill(120), bottomValue: new Array<number>(n).fill(80),
            topColor: new Array<string>(n).fill(String(color.new(bearPrimary, 60))),
            bottomColor: new Array<string>(n).fill(String(color.new(bearSecondary, 85))),
          } },
        { plot1: 'plot6', plot2: 'plot8', options: { title: 'Enhanced Oversold Zone' },
          gradient: {
            topValue: new Array<number>(n).fill(-80), bottomValue: new Array<number>(n).fill(-120),
            topColor: new Array<string>(n).fill(String(color.new(bullSecondary, 85))),
            bottomColor: new Array<string>(n).fill(String(color.new(bullPrimary, 60))),
          } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        // alertcondition(ta.crossover(volume_oscillator, oscillator_ema)) / crossunder(...) / crossover(...) and
        // volume_oscillator < -80 / crossunder(...) and volume_oscillator > 80
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FsvzoInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FsvzoInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Enhanced Bullish Flow Alert', message: '🟢 Enhanced Bullish Flow Detected! {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Enhanced Bearish Flow Alert', message: '🔴 Enhanced Bearish Flow Detected! {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'Enhanced Bullish Reversal Alert', message: '🚀 Strong Enhanced Bullish Reversal! {{exchange}}:{{ticker}}' },
  { id: 'alert3', title: 'Enhanced Bearish Reversal Alert', message: '💥 Strong Enhanced Bearish Reversal! {{exchange}}:{{ticker}}' },
];

export const Fsvzo = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
