/**
 * OBV, AD, VPT & CDV Oscillators | Jerk Flow Stack
 *
 * Four cumulative volume series: OBV (sign of the close change * volume), AD (close location in the bar range *
 * volume), CDV (sign of close - open * volume) and VPT (ta.pvt). Long-period oscillators: the series minus its
 * SMA or Ehlers DSMA (2 * SMA - SMA of the SMA) over `maLenLong` bars (VPT scaled by `vptScaleLong`). RSI pane: the
 * RSI of each series and the MFI of hlc3, with dashed levels 80 / 70 / 50 / 30 / 20. Jerk = change of the change
 * of OBV / CDV; a background marks bars whose jerk exceeds `jerkFrac` * its highest absolute value over `jerkLen`
 * bars. The stacked filter marks jerk breaks in the same direction for OBV and CDV with high relative volume
 * (volume / 20-bar median > 1.3), an ATR(14) percent rank over 200 bars above 0.25, a close beyond the previous
 * high / low and a cool-down of `coolBars` bars.
 *
 * Reference: "OBV & AD Oscillators with Dual Smoothing Options" by hollowwick (indicator title "OBV, AD, VPT & CDV
 * Oscillators  |  Jerk Flow Stack")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface ObvAdOscillatorsInputs {
  colLongOBV: string;
  colLongCDV: string;
  colLongAD: string;
  colLongVPT: string;
  colRSIOBV: string;
  colRSICDV: string;
  colRSIAD: string;
  colRSIVPT: string;
  colRSIMFI: string;
  /** Plot the long-period oscillators */
  plotLong: boolean;
  /** Plot the RSI pane (RSI lines and levels) */
  plotShort: boolean;
  showLongOBV: boolean;
  showLongCDV: boolean;
  showLongAD: boolean;
  showLongVPT: boolean;
  showRSIOBV: boolean;
  showRSICDV: boolean;
  showRSIAD: boolean;
  showRSIVPT: boolean;
  showRSIMFI: boolean;
  /** Background on OBV jerk */
  showOBVJerkBG: boolean;
  /** Background on CDV jerk */
  showCDVJerkBG: boolean;
  /** Stacked jerk filter background */
  stackBG: boolean;
  /** Jerk look-back (highest absolute jerk) */
  jerkLen: number;
  /** Threshold fraction of the highest absolute jerk */
  jerkFrac: number;
  /** Cool-down bars of the stacked filter */
  coolBars: number;
  /** Long MA type */
  maTypeLong: 'None' | 'SMA' | 'Ehlers DSMA';
  /** Long MA length */
  maLenLong: number;
  /** Long VPT scale */
  vptScaleLong: number;
  /** RSI length */
  rsiLen: number;
}

export const defaultInputs: ObvAdOscillatorsInputs = {
  colLongOBV: color.blue,
  colLongCDV: color.red,
  colLongAD: color.orange,
  colLongVPT: color.green,
  colRSIOBV: color.lime,
  colRSICDV: color.red,
  colRSIAD: color.purple,
  colRSIVPT: color.yellow,
  colRSIMFI: color.aqua,
  plotLong: false,
  plotShort: true,
  showLongOBV: false,
  showLongCDV: false,
  showLongAD: true,
  showLongVPT: true,
  showRSIOBV: true,
  showRSICDV: true,
  showRSIAD: false,
  showRSIVPT: false,
  showRSIMFI: false,
  showOBVJerkBG: false,
  showCDVJerkBG: false,
  stackBG: false,
  jerkLen: 20,
  jerkFrac: 0.8,
  coolBars: 5,
  maTypeLong: 'Ehlers DSMA',
  maLenLong: 377,
  vptScaleLong: 610.0,
  rsiLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'colLongOBV', type: 'color', title: 'Long OBV', defval: color.blue, group: 'Line Colours' },
  { id: 'colLongCDV', type: 'color', title: 'Long CDV', defval: color.red, group: 'Line Colours' },
  { id: 'colLongAD', type: 'color', title: 'Long AD', defval: color.orange, group: 'Line Colours' },
  { id: 'colLongVPT', type: 'color', title: 'Long VPT', defval: color.green, group: 'Line Colours' },
  { id: 'colRSIOBV', type: 'color', title: 'RSI OBV', defval: color.lime, group: 'Line Colours' },
  { id: 'colRSICDV', type: 'color', title: 'RSI CDV', defval: color.red, group: 'Line Colours' },
  { id: 'colRSIAD', type: 'color', title: 'RSI AD', defval: color.purple, group: 'Line Colours' },
  { id: 'colRSIVPT', type: 'color', title: 'RSI VPT', defval: color.yellow, group: 'Line Colours' },
  { id: 'colRSIMFI', type: 'color', title: 'RSI MFI', defval: color.aqua, group: 'Line Colours' },
  { id: 'plotLong', type: 'bool', title: 'Plot Long‑Period Oscillators', defval: false, group: 'General' },
  { id: 'plotShort', type: 'bool', title: 'Plot RSI Pane (visual only)', defval: true, group: 'General' },
  { id: 'showLongOBV', type: 'bool', title: 'Long OBV', defval: false, group: 'Long Components' },
  { id: 'showLongCDV', type: 'bool', title: 'Long CDV', defval: false, group: 'Long Components' },
  { id: 'showLongAD', type: 'bool', title: 'Long AD', defval: true, group: 'Long Components' },
  { id: 'showLongVPT', type: 'bool', title: 'Long VPT', defval: true, group: 'Long Components' },
  { id: 'showRSIOBV', type: 'bool', title: 'RSI OBV', defval: true, group: 'RSI Components' },
  { id: 'showRSICDV', type: 'bool', title: 'RSI CDV', defval: true, group: 'RSI Components' },
  { id: 'showRSIAD', type: 'bool', title: 'RSI AD', defval: false, group: 'RSI Components' },
  { id: 'showRSIVPT', type: 'bool', title: 'RSI VPT', defval: false, group: 'RSI Components' },
  { id: 'showRSIMFI', type: 'bool', title: 'RSI MFI', defval: false, group: 'RSI Components' },
  { id: 'showOBVJerkBG', type: 'bool', title: 'Background on OBV Jerk', defval: false, group: 'Jerk BG' },
  { id: 'showCDVJerkBG', type: 'bool', title: 'Background on CDV Jerk', defval: false, group: 'Jerk BG' },
  { id: 'stackBG', type: 'bool', title: 'Stacked Jerk Filter', defval: false, group: 'Jerk BG' },
  { id: 'jerkLen', type: 'int', title: 'Jerk look‑back', defval: 20, min: 1, group: 'Jerk BG' },
  { id: 'jerkFrac', type: 'float', title: 'Threshold fraction', defval: 0.8, step: 0.05, group: 'Jerk BG' },
  { id: 'coolBars', type: 'int', title: 'Cool‑down bars', defval: 5, min: 1, group: 'Jerk BG' },
  { id: 'maTypeLong', type: 'string', title: 'Long MA Type', defval: 'Ehlers DSMA', options: ['None', 'SMA', 'Ehlers DSMA'], group: 'Long Period' },
  { id: 'maLenLong', type: 'int', title: 'Long MA Length', defval: 377, min: 1, group: 'Long Period' },
  { id: 'vptScaleLong', type: 'float', title: 'Long VPT Scale', defval: 610.0, step: 0.1, group: 'Long Period' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, group: 'Volume RSI' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long OBV', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Long AD', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'Long CDV', color: color.red, lineWidth: 1 },
  { id: 'plot3', title: 'Long VPT', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: 'RSI OBV', color: color.lime, lineWidth: 1 },
  { id: 'plot5', title: 'RSI CDV', color: color.red, lineWidth: 1 },
  { id: 'plot6', title: 'RSI AD', color: color.purple, lineWidth: 1 },
  { id: 'plot7', title: 'RSI VPT', color: color.yellow, lineWidth: 1 },
  { id: 'plot8', title: 'RSI MFI', color: color.aqua, lineWidth: 1 },
];

export const metadata = {
  title: 'OBV, AD, VPT & CDV Oscillators  |  Jerk Flow Stack',
  shortTitle: 'VolOscSets',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };
type Ma = { step(v: number): number; commit(): void };

interface ObvAdVars {
  lastLong: number;
  lastShort: number;
}

interface ObvAdRun extends BarRunState<ObvAdVars> {
  closeChange: ReturnType<typeof taStep.change>;
  obvCum: ReturnType<typeof taStep.cum>;
  adCum: ReturnType<typeof taStep.cum>;
  cdvCum: ReturnType<typeof taStep.cum>;
  vptCum: ReturnType<typeof taStep.cum>;
  maOBV: Ma;
  maAD: Ma;
  maCDV: Ma;
  maVPT: Ma;
  rsiOBVStep: ReturnType<typeof taStep.rsi>;
  rsiCDVStep: ReturnType<typeof taStep.rsi>;
  rsiADStep: ReturnType<typeof taStep.rsi>;
  rsiVPTStep: ReturnType<typeof taStep.rsi>;
  mfiStep: ReturnType<typeof taStep.mfi>;
  jerkOBV1: ReturnType<typeof taStep.change>;
  jerkOBV2: ReturnType<typeof taStep.change>;
  jerkCDV1: ReturnType<typeof taStep.change>;
  jerkCDV2: ReturnType<typeof taStep.change>;
  thrOBVStep: ReturnType<typeof taStep.highest>;
  thrCDVStep: ReturnType<typeof taStep.highest>;
  medianStep: ReturnType<typeof taStep.median>;
  atrStep: ReturnType<typeof taStep.atr>;
  /** ta.atr(14) of each bar (read by ta.percentrank(atr, 200)) */
  atr: number[];
  plotData: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<ObvAdOscillatorsInputs>): BarStudy<ObvAdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // ma(src, len, typ): SMA, Ehlers DSMA (2 * sma - sma(sma)) or na
  const maStep = (): Ma => {
    if (cfg.maTypeLong === 'SMA') {
      const m = taStep.sma();
      return { step: (v) => m.step(v, cfg.maLenLong) ?? NaN, commit: () => m.commit() };
    }
    if (cfg.maTypeLong === 'Ehlers DSMA') {
      const m1 = taStep.sma();
      const m2 = taStep.sma();
      return {
        step: (v) => {
          const s1 = m1.step(v, cfg.maLenLong) ?? NaN;
          const s2 = m2.step(s1, cfg.maLenLong) ?? NaN;
          return 2 * s1 - s2;
        },
        commit: () => { m1.commit(); m2.commit(); },
      };
    }
    return { step: () => NaN, commit: () => {} };
  };
  // opa(v, thr) = int(math.min(math.abs(v) / thr, 1) * 20)
  const opa = (v: number, thr: number) => Math.trunc(Math.min(Math.abs(v) / thr, 1) * 20);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const longColor = String(color.new(color.green, 70));
  const shortColor = String(color.new(color.red, 70));
  const coolOK = (last: number, i: number) => isNaN(last) || i - last > cfg.coolBars;
  const L = cfg.plotLong;
  const R = cfg.plotShort;
  const shown = [
    L && cfg.showLongOBV, L && cfg.showLongAD, L && cfg.showLongCDV, L && cfg.showLongVPT, R && cfg.showRSIOBV,
    R && cfg.showRSICDV, R && cfg.showRSIAD, R && cfg.showRSIVPT, R && cfg.showRSIMFI,
  ];
  // Only the values that reach an output are calculated (the others do not change any output)
  const jerkBg = cfg.showOBVJerkBG || cfg.showCDVJerkBG || cfg.stackBG;
  const colors = [
    cfg.colLongOBV, cfg.colLongAD, cfg.colLongCDV, cfg.colLongVPT, cfg.colRSIOBV, cfg.colRSICDV, cfg.colRSIAD,
    cfg.colRSIVPT, cfg.colRSIMFI,
  ];

  return {
    init() {
      const s: ObvAdRun = {
        closeChange: taStep.change(), obvCum: taStep.cum(), adCum: taStep.cum(), cdvCum: taStep.cum(),
        vptCum: taStep.cum(), maOBV: maStep(), maAD: maStep(), maCDV: maStep(), maVPT: maStep(),
        rsiOBVStep: taStep.rsi(cfg.rsiLen), rsiCDVStep: taStep.rsi(cfg.rsiLen), rsiADStep: taStep.rsi(cfg.rsiLen),
        rsiVPTStep: taStep.rsi(cfg.rsiLen), mfiStep: taStep.mfi(cfg.rsiLen), jerkOBV1: taStep.change(),
        jerkOBV2: taStep.change(), jerkCDV1: taStep.change(), jerkCDV2: taStep.change(),
        thrOBVStep: taStep.highest(), thrCDVStep: taStep.highest(), medianStep: taStep.median(20),
        atrStep: taStep.atr(14), atr: [],
        plotData: Array.from({ length: 9 }, () => []), bgColors: [],
        steps: [], vars: { lastLong: NaN, lastShort: NaN }, lists: [], series: [],
      };
      const used: [Committable, boolean][] = [
        [s.closeChange, true], [s.obvCum, true], [s.adCum, true], [s.cdvCum, true], [s.vptCum, true],
        [s.maOBV, shown[0]], [s.maAD, shown[1]], [s.maCDV, shown[2]], [s.maVPT, shown[3]], [s.rsiOBVStep, shown[4]],
        [s.rsiCDVStep, shown[5]], [s.rsiADStep, shown[6]], [s.rsiVPTStep, shown[7]], [s.mfiStep, shown[8]],
        [s.jerkOBV1, jerkBg], [s.jerkOBV2, jerkBg], [s.jerkCDV1, jerkBg], [s.jerkCDV2, jerkBg], [s.thrOBVStep, jerkBg],
        [s.thrCDVStep, jerkBg], [s.medianStep, cfg.stackBG], [s.atrStep, cfg.stackBG],
      ];
      s.steps = used.filter(([, on]) => on).map(([m]) => m);
      s.lists = [s.bgColors];
      s.series = [...s.plotData, s.atr];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const vol = b.volume ?? NaN;
      const close = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;

      // Cumulative series
      const closeChange = s.closeChange.step(close) ?? NaN;
      const obv = s.obvCum.step(Math.sign(closeChange) * vol) ?? NaN;
      const ad = s.adCum.step((eq(b.close, b.high) && eq(b.close, b.low)) || eq(b.high, b.low)
        ? 0 : ((2 * b.close - b.low - b.high) / (b.high - b.low)) * vol) ?? NaN;
      const cdv = s.cdvCum.step(Math.sign(b.close - b.open) * vol) ?? NaN;
      // ta.pvt: ta.cum((close - close[1]) / close[1] * volume)
      const vpt = s.vptCum.step(i === 0 ? NaN : ((close - prevClose) / prevClose) * vol) ?? NaN;

      const oscOBVLong = shown[0] ? obv - s.maOBV.step(obv) : NaN;
      const oscADLong = shown[1] ? ad - s.maAD.step(ad) : NaN;
      const oscCDVLong = shown[2] ? cdv - s.maCDV.step(cdv) : NaN;
      const oscVPTLong = shown[3] ? (vpt - s.maVPT.step(vpt)) * cfg.vptScaleLong : NaN;

      // RSI pane
      const rsiOBV = shown[4] ? s.rsiOBVStep.step(obv) ?? NaN : NaN;
      const rsiCDV = shown[5] ? s.rsiCDVStep.step(cdv) ?? NaN : NaN;
      const rsiAD = shown[6] ? s.rsiADStep.step(ad) ?? NaN : NaN;
      const rsiVPT = shown[7] ? s.rsiVPTStep.step(vpt) ?? NaN : NaN;
      const hlc3 = (b.high + b.low + b.close) / 3;
      const mfi = shown[8] ? s.mfiStep.step(hlc3, vol) ?? NaN : NaN;

      // Jerk: ta.change(ta.change(src)); threshold jerkFrac * ta.highest(math.abs(jerk), jerkLen)
      const jo = jerkBg ? s.jerkOBV2.step(s.jerkOBV1.step(obv) ?? NaN) ?? NaN : NaN;
      const jc = jerkBg ? s.jerkCDV2.step(s.jerkCDV1.step(cdv) ?? NaN) ?? NaN : NaN;
      const thrOBV = jerkBg ? cfg.jerkFrac * (s.thrOBVStep.step(Math.abs(jo), cfg.jerkLen) ?? NaN) : NaN;
      const thrCDV = jerkBg ? cfg.jerkFrac * (s.thrCDVStep.step(Math.abs(jc), cfg.jerkLen) ?? NaN) : NaN;

      // Stack filter
      const median = cfg.stackBG ? s.medianStep.step(vol) ?? NaN : NaN;
      let atrRank = NaN;
      if (cfg.stackBG) {
        // ta.percentrank(ta.atr(14), 200): the share of the 200 bars before with an ATR <= this one (na: not counted)
        const atr = s.atr;
        const a = s.atrStep.step(b.high, b.low, close) ?? NaN;
        atr[i] = a;
        if (i >= 200) {
          let count = 0;
          for (let j = 1; j <= 200; j++) {
            const x = atr[i - j];
            if (!isNaN(x) && !isNaN(a) && x - a <= EPS) count++;
          }
          atrRank = (count * 100) / 200;
        }
      }

      const v = s.vars;
      const bgColors = s.bgColors;
      if (cfg.showOBVJerkBG && gt(Math.abs(jo), thrOBV)) {
        bgColors.push({ time: t, color: String(color.new(gt(jo, 0) ? color.green : color.red, 100 - opa(jo, thrOBV))), id: 'bgcolor0' });
      }
      if (cfg.showCDVJerkBG && gt(Math.abs(jc), thrCDV)) {
        bgColors.push({ time: t, color: String(color.new(gt(jc, 0) ? color.green : color.red, 100 - opa(jc, thrCDV))), id: 'bgcolor1' });
      }
      const relVol = vol / median;
      const tapeOK = gt(relVol, 1.3) && gt(atrRank, 0.25);
      const sameDir = (gt(jo, 0) && gt(jc, 0)) || (lt(jo, 0) && lt(jc, 0));
      const newLong = gt(jo, thrOBV) || gt(jc, thrCDV);
      const newShort = lt(jo, -thrOBV) || lt(jc, -thrCDV);
      const longPriceOK = i > 0 && gt(close, bars[i - 1].high);
      const shortPriceOK = i > 0 && lt(close, bars[i - 1].low);
      const jerkLongOK = cfg.stackBG && tapeOK && sameDir && newLong && longPriceOK && coolOK(v.lastLong, i);
      const jerkShortOK = cfg.stackBG && tapeOK && sameDir && newShort && shortPriceOK && coolOK(v.lastShort, i);
      if (jerkLongOK) v.lastLong = i;
      if (jerkShortOK) v.lastShort = i;
      if (jerkLongOK) bgColors.push({ time: t, color: longColor, id: 'bgcolor2' });
      if (jerkShortOK) bgColors.push({ time: t, color: shortColor, id: 'bgcolor3' });

      const values = [oscOBVLong, oscADLong, oscCDVLong, oscVPTLong, rsiOBV, rsiCDV, rsiAD, rsiVPT, mfi];
      for (let k = 0; k < 9; k++) {
        s.plotData[k][i] = { time: t, value: shown[k] ? fin(values[k]) : NaN, color: colors[k] };
      }
    },
    copyVars: (v) => ({ ...v }),
    result(s) {
      const p = s.plotData;
      const plots = {
        plot0: p[0].slice(),
        plot1: p[1].slice(),
        plot2: p[2].slice(),
        plot3: p[3].slice(),
        plot4: p[4].slice(),
        plot5: p[5].slice(),
        plot6: p[6].slice(),
        plot7: p[7].slice(),
        plot8: p[8].slice(),
      };

      // hline(plotShort ? level : na, ...): no line when plotShort is off
      const hlines = R
        ? [80, 70, 50, 30, 20].map((v) => ({ value: v, options: { title: `RSI ${v}`, color: color.gray, linestyle: 'dashed' as const } }))
        : [];

      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format,
        },
        plots,
        hlines,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ObvAdOscillatorsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ObvAdOscillatorsInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ObvAdOscillatorsWithDualSmoothingOptions = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
