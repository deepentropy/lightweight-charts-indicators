/**
 * RSI Candle Color
 *
 * Colours every bar by an RSI. The close is smoothed with a 1-2-2-1 weighted filter (as the difference of its
 * cumulative sum), the RSI of the filtered series is reshaped by a power curve around 50 (exponent
 * (length / 14)^0.618; na is 50), and the result (0-100) picks a colour on a 101-colour gradient (blue - green -
 * yellow - red - purple). The gradient interpolates in a polar HSL space: each colour is turned into HSL with the
 * selected luminance style, its hue shifted, and placed at (s * cos(h), s * sin(h), l); the interpolated point is
 * turned back to HSL and RGB. The script has no plot: the only output is the bar colour.
 *
 * Note: the Pine script computes the RSI of the close; the Source input is not used by the calculation.
 *
 * Reference: "RSI Color" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © peacefulLizard50262
 */

import { taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type LuminanceStyle = 'SDTV' | 'Adobe' | 'HDTV' | 'Standard' | 'Bihexcone';

export interface RSICandleColorInputs {
  /** Source input of the Pine script (not used by its calculation, which uses the close) */
  source: SourceType;
  length: number;
  hueShift: number;
  luminanceStyle: LuminanceStyle;
}

export const defaultInputs: RSICandleColorInputs = {
  source: 'close',
  length: 8,
  hueShift: 0,
  luminanceStyle: 'Standard',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 8, min: 2 },
  { id: 'hueShift', type: 'float', title: 'Hue Shift', defval: 0, min: -360, max: 360 },
  {
    id: 'luminanceStyle', type: 'string', title: 'Luminance Style', defval: 'Standard',
    options: ['SDTV', 'Adobe', 'HDTV', 'Standard', 'Bihexcone'],
  },
];

// No plot: bar colours only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'RSI Color',
  shortTitle: 'RSI Color',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10, a > b only when a - b > 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !(b - a > EPS);

const GRADIENT_HEX = [
  '#1500FF', '#1709F6', '#1912ED', '#1B1AE5', '#1D23DC', '#1F2CD3', '#2135CA', '#233EC1', '#2446B9', '#264FB0',
  '#2858A7', '#2A619E', '#2C6A95', '#2E728D', '#307B84', '#32847B', '#348D72', '#36956A', '#389E61', '#3AA758',
  '#3CB04F', '#3EB946', '#3FC13E', '#41CA35', '#43D32C', '#45DC23', '#47E51A', '#49ED12', '#4BF609', '#4DFF00',
  '#53FF00', '#59FF00', '#5FFE00', '#65FE00', '#6BFE00', '#71FE00', '#77FD00', '#7DFD00', '#82FD00', '#88FD00',
  '#8EFC00', '#94FC00', '#9AFC00', '#A0FB00', '#A6FB00', '#ACFB00', '#B2FB00', '#B8FA00', '#BEFA00', '#C4FA00',
  '#CAF900', '#D0F900', '#D5F900', '#DBF900', '#E1F800', '#E7F800', '#EDF800', '#F3F800', '#F9F700', '#FFF700',
  '#FFEE00', '#FFE600', '#FFDE00', '#FFD500', '#FFCD00', '#FFC500', '#FFBD00', '#FFB500', '#FFAC00', '#FFA400',
  '#FF9C00', '#FF9400', '#FF8C00', '#FF8300', '#FF7B00', '#FF7300', '#FF6B00', '#FF6200', '#FF5A00', '#FF5200',
  '#FF4A00', '#FF4200', '#FF3900', '#FF3100', '#FF2900', '#FF2100', '#FF1900', '#FF1000', '#FF0800', '#FF0000',
  '#F60000', '#DF0505', '#C90909', '#B20E0E', '#9B1313', '#851717', '#6E1C1C', '#572121', '#412525', '#2A2A2A',
  '#220027',
];
const GRADIENT_TRANSP = 20;

interface RGB { r: number; g: number; b: number; t: number }
interface HSL { h: number; s: number; l: number; t: number }
interface XYZ { x: number; y: number; z: number; t: number }

const clamp = (source: number, min: number, max: number) => Math.max(Math.min(source, max), min);

/** Luminance weights of a style (Standard and Bihexcone keep the initial 1/3 weights) */
function getLuminance(style: LuminanceStyle): [number, number, number] {
  switch (style) {
    case 'SDTV': return [0.299, 0.587, 0.114];
    case 'Adobe': return [0.212, 0.701, 0.087];
    case 'HDTV': return [0.2126, 0.7152, 0.0722];
    default: return [math.constant(1.0 / 3.0), math.constant(1.0 / 3.0), math.constant(1.0 / 3.0)];
  }
}

const gammaSdtvAdobe = (v: number) => math.pow(v, math.constant(1 / 2.2));
const gammaHdtv = (v: number) => (lt(v, 0.018) ? 4.5 * v : 1.099 * math.pow(v, 0.45) - 0.099);
const gammaInverseSrgb = (v: number) => (!gt(v, 0.04045) ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4));

function lumaTransfer(v: number, style: LuminanceStyle): number {
  switch (style) {
    case 'SDTV':
    case 'Adobe': return gammaSdtvAdobe(gammaInverseSrgb(v));
    case 'HDTV': return gammaHdtv(gammaInverseSrgb(v));
    default: return v;
  }
}

/** get_lightness: applies the gamma of the style to the channels (in place, as the Pine method) */
function getLightness(self: RGB, style: LuminanceStyle): number {
  const [yr, yg, yb] = getLuminance(style);
  self.r = lumaTransfer(self.r, style);
  self.g = lumaTransfer(self.g, style);
  self.b = lumaTransfer(self.b, style);
  if (style === 'Bihexcone') {
    return math.avg(Math.max(self.r, self.g, self.b), Math.min(self.r, self.g, self.b)) as number;
  }
  return self.r * yr + self.g * yg + self.b * yb;
}

function hslFromRgb(self: RGB, style: LuminanceStyle): HSL {
  const max = Math.max(self.r, self.g, self.b);
  const min = Math.min(self.r, self.g, self.b);
  const delta = max - min;
  let h = 0.0;
  if (!eq(delta, 0)) {
    if (eq(max, self.r)) h = 60 * (((self.g - self.b) / delta) % 6);
    else if (eq(max, self.g)) h = 60 * (((self.b - self.r) / delta) + 2);
    else if (eq(max, self.b)) h = 60 * (((self.r - self.g) / delta) + 4);
  }
  h = (h + 360) % 360;
  const l = getLightness(self, style);
  const s = eq(delta, 0) ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l, t: self.t };
}

function shiftHue(self: HSL, shift: number): HSL {
  const hueShift = (self.h + shift) % 360;
  self.h = math.sign(hueShift) === -1 ? hueShift + 360 : hueShift;
  return self;
}

function toXyz(self: HSL): XYZ {
  const x = self.s * Math.cos(math.toradians(self.h) as number);
  const y = self.s * Math.sin(math.toradians(self.h) as number);
  return { x, y, z: self.l, t: self.t };
}

/** The atan2 of the Pine script (x first; Pine comparisons) */
function atan2(x: number, y: number): number {
  if (gt(x, 0)) return Math.atan(y / x);
  if (lt(x, 0) && ge(y, 0)) return Math.atan(y / x) + Math.PI;
  if (lt(x, 0) && lt(y, 0)) return Math.atan(y / x) - Math.PI;
  if (eq(x, 0) && gt(y, 0)) return math.constant(Math.PI / 2);
  if (eq(x, 0) && lt(y, 0)) return math.constant(-Math.PI / 2);
  return 0;
}

function xyzToHsl(self: XYZ): HSL {
  let hRad = atan2(self.x, self.y);
  hRad = lt(hRad, 0) ? hRad + math.constant(2 * Math.PI) : hRad;
  const h = hRad * math.constant(180 / Math.PI);
  const s = Math.sqrt(math.pow(self.x, 2) + math.pow(self.y, 2));
  return { h, s, l: self.z, t: self.t };
}

function hslSwitch(c: number, x: number, m: number, hPrime: number, t: number): RGB {
  let rgb: RGB;
  if (ge(hPrime, 0) && lt(hPrime, 1)) rgb = { r: c, g: x, b: 0, t };
  else if (ge(hPrime, 1) && lt(hPrime, 2)) rgb = { r: x, g: c, b: 0, t };
  else if (ge(hPrime, 2) && lt(hPrime, 3)) rgb = { r: 0, g: c, b: x, t };
  else if (ge(hPrime, 3) && lt(hPrime, 4)) rgb = { r: 0, g: x, b: c, t };
  else if (ge(hPrime, 4) && lt(hPrime, 5)) rgb = { r: x, g: 0, b: c, t };
  else if (ge(hPrime, 5) && lt(hPrime, 6)) rgb = { r: c, g: 0, b: x, t };
  // No case: the switch gives na and the field access below is a Pine runtime error
  else throw new Error('Cannot access field of na object (hsl_switch: hue out of 0..360)');
  rgb.r = clamp((rgb.r + m) * 255, 0, 255);
  rgb.g = clamp((rgb.g + m) * 255, 0, 255);
  rgb.b = clamp((rgb.b + m) * 255, 0, 255);
  return rgb;
}

function hslToColor(self: HSL): string {
  const c = (1 - Math.abs(2 * self.l - 1)) * self.s;
  const hPrime = self.h / 60;
  const x = c * (1 - Math.abs(hPrime % 2 - 1));
  const m = self.l - c / 2;
  const rgb = hslSwitch(c, x, m, hPrime, self.t);
  return String(color.rgb(rgb.r, rgb.g, rgb.b, rgb.t));
}

const linearInterpolation = (end: number, start: number, u: number) => start + u * (end - start);

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface RsiColorRun extends BarRunState<Record<string, never>> {
  cum: ReturnType<typeof taStep.cum>;
  rsi: ReturnType<typeof taStep.rsi>;
  cumArr: number[];
  barColors: BarColorData[];
}

function study(inputs: Partial<RSICandleColorInputs>): BarStudy<RsiColorRun, Result> {
  const { length, hueShift, luminanceStyle } = { ...defaultInputs, ...inputs };

  const p = math.pow(length / 14, 0.618);
  const e1 = 1 + p - 1;
  const e2 = p - 1;

  // Gradient colours in the polar HSL space (computed once, on the first bar in Pine)
  const xyzColors: XYZ[] = GRADIENT_HEX.map((hex) => {
    const base = color.new(hex, GRADIENT_TRANSP);
    const rgb: RGB = { r: color.r(base), g: color.g(base), b: color.b(base), t: color.t(base) };
    // var const float i_255 = 1 / 255: a constant expression, computed by PineScript before the script runs
    const i255 = math.constant(1 / 255);
    rgb.r = rgb.r * i255;
    rgb.g = rgb.g * i255;
    rgb.b = rgb.b * i255;
    return toXyz(shiftHue(hslFromRgb(rgb, luminanceStyle), hueShift));
  });
  const segmentCount = GRADIENT_HEX.length - 1;
  const bottomValue = 0;
  const totalRange = 100 - bottomValue;

  return {
    init() {
      const cum = taStep.cum();
      const rsi = taStep.rsi(length);
      const s: RsiColorRun = { cum, rsi, cumArr: [], barColors: [], steps: [cum, rsi], vars: {}, lists: [], series: [] };
      s.series = [s.cumArr, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const close = (k: number) => bars[k].close;
      // filter(close, 1): difference of the cumulative sum of the 1-2-2-1 weighted close
      const weighted = i >= 3 ? (close(i) + (close(i - 1) * 2) + (close(i - 2) * 2) + close(i - 3)) / 6 : NaN;
      const cum = s.cum.step(weighted) ?? NaN;
      s.cumArr[i] = cum;
      const filtered = i >= 1 ? (cum - s.cumArr[i - 1]) / 1 : NaN;
      const r = s.rsi.step(filtered) ?? NaN;

      const f = -math.pow(Math.abs(Math.abs(r - 50) - 50), e1) / math.pow(50, e2) + 50;
      const rsia = gt(r, 50) ? f + 50 : -f + 50;
      const value = Number.isNaN(rsia) ? 50 : rsia;

      const uTotal = clamp((value - bottomValue) / totalRange, 0.0, 0.99999999);
      const scaledPos = uTotal * segmentCount;
      const current = Math.floor(scaledPos);
      const localU = scaledPos - current;
      const a = xyzColors[current + 1];
      const b = xyzColors[current];
      const xyz: XYZ = {
        x: linearInterpolation(a.x, b.x, localU),
        y: linearInterpolation(a.y, b.y, localU),
        z: linearInterpolation(a.z, b.z, localU),
        t: linearInterpolation(a.t, b.t, localU),
      };
      s.barColors[i] = { time: bars[i].time, color: hslToColor(xyzToHsl(xyz)) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSICandleColorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSICandleColorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RSICandleColor = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
