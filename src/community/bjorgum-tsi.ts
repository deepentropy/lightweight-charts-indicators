/**
 * Bjorgum TSI
 *
 * True Strength Index with signal line, fill, and OB/OS detection.
 * TSI = 100 * EMA(EMA(momentum, longLen), shortLen) / EMA(EMA(abs(momentum), longLen), shortLen)
 * Signal = EMA(TSI, signalLen)
 * Fast/Slow speed presets. Bar histogram for TSI-signal spread.
 * As the original (theme "Classic Bj"): the candles from 0 to the TSI-signal spread (plotcandle, no colour in this
 * theme), bars coloured on a curl in overbought / oversold ("Ob/Os Curl Color"), background on a cross up in oversold
 * / down in overbought ("Show Ob/Os Cross").
 *
 * Alerts (alertcondition, `alerts` of the result): the original's 11 conditions (TSI crossing its signal, curls,
 * moves into overbought / oversold, curls and crosses inside them).
 *
 * Reference: "Bjorgum TSI" community indicator
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'TSI cross up', message: 'TSI crossed up on {{interval}} chart. Price is {{close}}' },
  { id: 'alert1', title: 'TSI cross down', message: 'TSI crossed down on {{interval}} chart. Price is {{close}}' },
  { id: 'alert2', title: 'TSI cross', message: 'TSI crossed on {{interval}} chart. Price is {{close}}' },
  { id: 'alert3', title: 'TSI Curl Up', message: 'TSI curled up on {{interval}} chart. Price is {{close}}' },
  { id: 'alert4', title: 'TSI Curl Down', message: 'TSI curled down on {{interval}} chart. Price is {{close}}' },
  { id: 'alert5', title: 'TSI Overbought', message: 'TSI moved in to overbought on {{interval}} chart. Price is {{close}}' },
  { id: 'alert6', title: 'TSI Oversold', message: 'TSI moved in to oversold on {{interval}} chart. Price is {{close}}' },
  { id: 'alert7', title: 'TSI Curl Overbought', message: 'TSI Curled Down In Overbought on {{interval}} chart. Price is {{close}}' },
  { id: 'alert8', title: 'TSI Curl Oversold', message: 'TSI Curled Up In Oversold on {{interval}} chart. Price is {{close}}' },
  { id: 'alert9', title: 'TSI Cross Down Overbought', message: 'TSI Crossed Down In Overbought on {{interval}} chart. Price is {{close}}' },
  { id: 'alert10', title: 'TSI Cross Up Oversold', message: 'TSI Crossed Up In Oversold on {{interval}} chart. Price is {{close}}' },
];

export interface BjorgumTSIInputs {
  speedInput: string;
  obValue: number;
  osValue: number;
  showLines: boolean;
  showMid: boolean;
  /** Show Ob/Os Cross: background on a cross up in oversold / down in overbought */
  showHiLo: boolean;
  /** Ob/Os Curl Color: bar colours */
  showCurl: boolean;
  /** Show White Bars: the other bars white (with "Ob/Os Curl Color") */
  blankBars: boolean;
  longfLen: number;
  shortfLen: number;
  signalfLen: number;
  longsLen: number;
  shortsLen: number;
  signalsLen: number;
}

export const defaultInputs: BjorgumTSIInputs = {
  speedInput: 'Fast',
  obValue: 30,
  osValue: -30,
  showLines: true,
  showMid: true,
  showHiLo: false,
  showCurl: false,
  blankBars: false,
  longfLen: 25,
  shortfLen: 5,
  signalfLen: 14,
  longsLen: 25,
  shortsLen: 13,
  signalsLen: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'speedInput', type: 'string', title: 'Speed', defval: 'Fast', options: ['Fast', 'Slow'] },
  { id: 'obValue', type: 'int', title: 'Overbought', defval: 30 },
  { id: 'osValue', type: 'int', title: 'Oversold', defval: -30 },
  { id: 'showLines', type: 'bool', title: 'Show OB/OS Lines', defval: true },
  { id: 'showMid', type: 'bool', title: 'Show Midline', defval: true },
  { id: 'showHiLo', type: 'bool', title: 'Show Ob/Os Cross', defval: false },
  { id: 'showCurl', type: 'bool', title: 'Ob/Os Curl Color', defval: false },
  { id: 'blankBars', type: 'bool', title: 'Show White Bars', defval: false },
  { id: 'longfLen', type: 'int', title: 'Fast Long Length', defval: 25, min: 1 },
  { id: 'shortfLen', type: 'int', title: 'Fast Short Length', defval: 5, min: 1 },
  { id: 'signalfLen', type: 'int', title: 'Fast Signal Length', defval: 14, min: 1 },
  { id: 'longsLen', type: 'int', title: 'Slow Long Length', defval: 25, min: 1 },
  { id: 'shortsLen', type: 'int', title: 'Slow Short Length', defval: 13, min: 1 },
  { id: 'signalsLen', type: 'int', title: 'Slow Signal Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Bar Hi', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'Bar Lo', color: '#EF5350', lineWidth: 4, style: 'histogram' },
  { id: 'h1', title: 'Level', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'h2', title: 'Level', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'p6', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'p7', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Bjorgum TSI',
  shortTitle: 'BTSI',
  overlay: false,
};

type Result = IndicatorResult & {
  plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[]; bgColors: BgColorData[];
} & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

interface TsiRun extends BarRunState<Record<string, never>> {
  pc1: Ema;
  pc2: Ema;
  abs1: Ema;
  abs2: Ema;
  sigEma: Ema;
  tsi: number[];
  sig: number[];
  tsiPlot: Point[];
  sigPlot: Point[];
  barHiPlot: Point[];
  barLoPlot: Point[];
  hidden: Point[][];
  fillColors: string[];
  candles: PlotCandleData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
  /** The values and colours of the 4 gradient fills, per bar */
  gTop: number[][];
  gBottom: number[][];
  gTopColor: Array<Array<string | null>>;
  gBottomColor: Array<Array<string | null>>;
}

function study(inputs: Partial<BjorgumTSIInputs>): BarStudy<TsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // Select speed preset
  const longLen = cfg.speedInput === 'Fast' ? cfg.longfLen : cfg.longsLen;
  const shortLen = cfg.speedInput === 'Fast' ? cfg.shortfLen : cfg.shortsLen;
  const signalLen = cfg.speedInput === 'Fast' ? cfg.signalfLen : cfg.signalsLen;
  const warmup = longLen + shortLen;

  // Pine: isClassic = themeInput == "Classic Bj" (default; this port has no theme input), isBeachy false
  const isClassic = true;
  const ob = cfg.obValue;
  const os = cfg.osValue;
  const obFillColor = '#33FF57'; // Pine: isBeachy ? #FFD700 : #33FF57
  const osFillColor = '#33FF57'; // Pine: isBeachy ? #FF6B6B : #33FF57
  const bullBgColor = '#80FFFF'; // Pine: isBeachy ? #FFD700 : #80FFFF
  const bearBgColor = '#FF80FF'; // Pine: isBeachy ? #FF6B6B : #FF80FF
  const osBg = String(color.new('#ff0000', 80));
  const obBg = String(color.new('#64b5f6', 80));
  const obFill80 = color.new_color(obFillColor, 80) as string;
  const osFill80 = color.new_color(osFillColor, 80) as string;
  const bear30 = color.new_color(bearBgColor, 30) as string;
  const bear90 = color.new_color(bearBgColor, 90) as string;
  const bull90 = color.new_color(bullBgColor, 90) as string;
  const bull30 = color.new_color(bullBgColor, 30) as string;
  return {
    init() {
      // TSI = 100 * EMA(EMA(mom, longLen), shortLen) / EMA(EMA(abs(mom), longLen), shortLen)
      const pc1 = taStep.ema(longLen);
      const pc2 = taStep.ema(shortLen);
      const abs1 = taStep.ema(longLen);
      const abs2 = taStep.ema(shortLen);
      // Signal = EMA(tsi, signalLen)
      const sigEma = taStep.ema(signalLen);
      const s: TsiRun = {
        pc1, pc2, abs1, abs2, sigEma, tsi: [], sig: [], tsiPlot: [], sigPlot: [], barHiPlot: [], barLoPlot: [],
        hidden: [[], [], [], []], fillColors: [], candles: [], barColors: [], bgColors: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        gTop: [[], [], [], []], gBottom: [[], [], [], []], gTopColor: [[], [], [], []], gBottomColor: [[], [], [], []],
        steps: [pc1, pc2, abs1, abs2, sigEma], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.candles, s.barColors, s.bgColors];
      s.series = [
        s.tsi, s.sig, s.tsiPlot, s.sigPlot, s.barHiPlot, s.barLoPlot, ...s.hidden, s.fillColors, ...s.flags,
        ...s.gTop, ...s.gBottom, ...s.gTopColor, ...s.gBottomColor,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // Momentum: close - close[1]
      const mom = i > 0 ? b.close - bars[i - 1].close : NaN;
      const absMom = isNaN(mom) ? NaN : Math.abs(mom);
      const num = s.pc2.step(s.pc1.step(mom));
      const den = s.abs2.step(s.abs1.step(absMom));
      const tsi = num == null || den == null || den === 0 ? NaN : 100 * num / den;
      s.tsi[i] = tsi;
      const sigRaw = s.sigEma.step(tsi);
      s.sig[i] = sigRaw;
      // the 4 gradient fills (see result)
      const gt = s.gTop, gb = s.gBottom, gtc = s.gTopColor, gbc = s.gBottomColor;
      gt[0][i] = ob; gb[0][i] = 5; gtc[0][i] = obFill80; gbc[0][i] = null;
      gt[1][i] = -5; gb[1][i] = os; gtc[1][i] = null; gbc[1][i] = osFill80;
      // Pine: obValue = showObFill ? oBotInput : na (showObFill = tsl > oBotInput and not isClassic)
      gt[2][i] = ob + 50; gb[2][i] = s.sig[i] > ob && !isClassic ? ob : NaN; gtc[2][i] = bear30; gbc[2][i] = bear90;
      // Pine: osValue = showOsFill ? oSoldInput : na (showOsFill = tsl < oSoldInput and not isClassic)
      gt[3][i] = s.sig[i] < os && !isClassic ? os : NaN; gb[3][i] = os - 50; gtc[3][i] = bull90; gbc[3][i] = bull30;
      const sig = sigRaw ?? NaN;
      const prevTsi = i > 0 ? s.tsi[i - 1] : NaN;
      const prevSig = i > 0 ? (s.sig[i - 1] ?? NaN) : NaN;

      // TSI line colored by direction
      s.tsiPlot[i] = i < warmup || isNaN(tsi)
        ? { time, value: NaN }
        : { time, value: tsi, color: !isNaN(prevTsi) && tsi >= prevTsi ? '#2962FF' : '#FF6D00' };
      // Signal line colored by direction
      s.sigPlot[i] = i < warmup || sigRaw == null || isNaN(sigRaw)
        ? { time, value: NaN }
        : { time, value: sigRaw, color: !isNaN(prevSig) && sigRaw >= prevSig ? '#2962FF' : '#FF6D00' };

      // Bar histogram: diff = tsi - signal
      // barHi = max(0, diff), barLo = min(0, diff)
      // Color: OB curl down or OS curl up get special colors
      if (i < warmup || isNaN(tsi) || isNaN(sig)) {
        s.barHiPlot[i] = { time, value: NaN };
        s.barLoPlot[i] = { time, value: NaN };
      } else {
        const diff = tsi - sig;
        const barHi = Math.max(0, diff);
        // OB curl down: tsi was above obValue and is now declining
        const obCurl = !isNaN(prevTsi) && prevTsi >= cfg.obValue && tsi < prevTsi;
        s.barHiPlot[i] = barHi === 0 ? { time, value: NaN } : { time, value: barHi, color: obCurl ? '#FF5252' : '#26A69A' };
        const barLo = Math.min(0, diff);
        // OS curl up: tsi was below osValue and is now rising
        const osCurl = !isNaN(prevTsi) && prevTsi <= cfg.osValue && tsi > prevTsi;
        s.barLoPlot[i] = barLo === 0 ? { time, value: NaN } : { time, value: barLo, color: osCurl ? '#00E676' : '#EF5350' };
      }

      // Fill between TSI and signal
      s.fillColors[i] = i < warmup || isNaN(tsi) || isNaN(sig)
        ? 'transparent'
        : tsi >= sig ? 'rgba(41,98,255,0.15)' : 'rgba(255,109,0,0.15)';

      // Pine: h1 = hline(isClassic ? na : oBotInput, ...); h2 = hline(isClassic ? na : oSoldInput, ...)
      s.hidden[0][i] = { time, value: isClassic ? NaN : ob };
      s.hidden[1][i] = { time, value: isClassic ? NaN : os };
      // Pine: p6 = plot(oBotInput, display = display.none); p7 = plot(oSoldInput, display = display.none)
      s.hidden[2][i] = { time, value: ob };
      s.hidden[3][i] = { time, value: os };

      // Conditions of the original
      const tsl = sig;
      const crossUp = tsi > tsl && prevTsi <= prevSig;
      const crossDn = tsi < tsl && prevTsi >= prevSig;
      const crossAny = crossUp || crossDn;
      const curlUp = tsi > prevTsi && tsi < tsl;
      const curlDn = tsi < prevTsi && tsi > tsl;
      const overBought = tsi > ob && tsi < prevTsi && prevTsi > prevSig;
      const overSold = tsi < os && tsi > prevTsi && prevTsi < prevSig;
      const tsiXUp = tsi > ob && prevTsi <= ob;
      const tsiXDn = tsi < os && prevTsi >= os;
      const osCrossUp = crossUp && tsi <= os;
      const obCrossDn = crossDn && tsi >= ob;
      const flags = [crossUp, crossDn, crossAny, curlUp, curlDn, tsiXUp, tsiXDn, overBought, overSold, obCrossDn, osCrossUp];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }

      // plotcandle(barLo, barLo, barHi, barHi, color = isClassic ? na : ..., bordercolor = isClassic ? na : ...,
      // wickcolor = color(na), display = display.pane): barHi = max(0, diff), barLo = min(0, diff)
      const diff = tsi - tsl;
      if (!isNaN(diff)) {
        const barHi = Math.max(0, 0 + diff);
        const barLo = Math.min(0, 0 + diff);
        s.candles.push({ time, open: barLo, high: barLo, low: barHi, close: barHi,
          color: 'transparent', borderColor: 'transparent', wickColor: 'transparent' });
      }

      // barcolor(showCurlInput ? barColor : na): barColor = overBought ? obBar : overSold ? osBar : blankBars ? neBar : na
      if (cfg.showCurl) {
        const c = overBought ? '#ff0000' : overSold ? '#17ff00' : cfg.blankBars ? '#ffffff' : null;
        if (c !== null) s.barColors.push({ time, color: c, id: 'barcolor0' });
      }
      // bgcolor(osCrossUp and showHiLoInput ? color.new(oBotColInput, 80) : na), bgcolor(obCrossDn and showHiLoInput ?
      // color.new(oSoldColInput, 80) : na) (theme "Classic Bj")
      if (cfg.showHiLo) {
        if (osCrossUp) s.bgColors.push({ time, color: osBg, id: 'bgcolor0' });
        if (obCrossDn) s.bgColors.push({ time, color: obBg, id: 'bgcolor1' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const gradient = (k: number) => ({
        topValue: s.gTop[k].slice(), bottomValue: s.gBottom[k].slice(),
        topColor: s.gTopColor[k].slice(), bottomColor: s.gBottomColor[k].slice(),
      });
      const gradientFills = [
        // Pine: fill(h2, h1, oBotInput, 5, color.new(obFillColor, 80), color(na), fillgaps = true)
        { plot1: 'h2', plot2: 'h1', options: { title: 'Plots Background' }, gradient: gradient(0) },
        // Pine: fill(h2, h1, -5, oSoldInput, color(na), color.new(osFillColor, 80), fillgaps = true)
        { plot1: 'h2', plot2: 'h1', options: { title: 'Plots Background' }, gradient: gradient(1) },
        // Pine: fill(p2, p6, oBotInput + 50, obValue, color.new(bearBgColor, 30), color.new(bearBgColor, 90), fillgaps = true)
        { plot1: 'plot1', plot2: 'p6', options: { title: 'Plots Background' }, gradient: gradient(2) },
        // Pine: fill(p2, p7, osValue, oSoldInput - 50, color.new(bullBgColor, 90), color.new(bullBgColor, 30), fillgaps = true)
        { plot1: 'plot1', plot2: 'p7', options: { title: 'Plots Background' }, gradient: gradient(3) },
      ];
      // Pine: fill(p1, p2, tsi, tsl, fillColor2, color.new(fillColor2, 70), fillgaps = true, display = displayFill)
      // is not returned: displayFill = isClassic ? display.none : display.all, and FillData has no display option.

      // HLines
      const hlines: Array<{ value: number; options: { color: string; linestyle: 'solid' | 'dashed' | 'dotted'; linewidth?: number; title: string } }> = [];
      if (cfg.showLines) {
        hlines.push({ value: cfg.obValue, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'OB' } });
        hlines.push({ value: cfg.osValue, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'OS' } });
      }
      if (cfg.showMid) {
        hlines.push({ value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } });
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.tsiPlot.slice(), 'plot1': s.sigPlot.slice(), 'plot2': s.barHiPlot.slice(), 'plot3': s.barLoPlot.slice(),
          'h1': s.hidden[0].slice(), 'h2': s.hidden[1].slice(), 'p6': s.hidden[2].slice(), 'p7': s.hidden[3].slice(),
        },
        hlines,
        // Pine order: the 4 gradient fills above, then fill(p1, p2, fillColor1, fillgaps = true)
        fills: [...gradientFills, { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
        plotCandles: { candle: s.candles.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BjorgumTSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BjorgumTSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BjorgumTSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
