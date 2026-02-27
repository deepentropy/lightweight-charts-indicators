/**
 * Bjorgum TSI
 *
 * True Strength Index with signal line, fill, and OB/OS detection.
 * TSI = 100 * EMA(EMA(momentum, longLen), shortLen) / EMA(EMA(abs(momentum), longLen), shortLen)
 * Signal = EMA(TSI, signalLen)
 * Fast/Slow speed presets. Bar histogram for TSI-signal spread.
 *
 * Reference: TradingView "Bjorgum TSI" community indicator
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BjorgumTSIInputs {
  speedInput: string;
  obValue: number;
  osValue: number;
  showLines: boolean;
  showMid: boolean;
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
];

export const metadata = {
  title: 'Bjorgum TSI',
  shortTitle: 'BTSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BjorgumTSIInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };

  // Select speed preset
  const longLen = cfg.speedInput === 'Fast' ? cfg.longfLen : cfg.longsLen;
  const shortLen = cfg.speedInput === 'Fast' ? cfg.shortfLen : cfg.shortsLen;
  const signalLen = cfg.speedInput === 'Fast' ? cfg.signalfLen : cfg.signalsLen;

  // Momentum: close - close[1]
  const momArr: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    momArr.push(bars[i].close - bars[i - 1].close);
  }
  const absMomArr = momArr.map(v => isNaN(v) ? NaN : Math.abs(v));

  // TSI = 100 * EMA(EMA(mom, longLen), shortLen) / EMA(EMA(abs(mom), longLen), shortLen)
  const momSeries = new Series(bars, (_, i) => momArr[i]);
  const absMomSeries = new Series(bars, (_, i) => absMomArr[i]);

  const dsPC = ta.ema(ta.ema(momSeries, longLen), shortLen);
  const dsAbsPC = ta.ema(ta.ema(absMomSeries, longLen), shortLen);

  const dsPCArr = dsPC.toArray();
  const dsAbsPCArr = dsAbsPC.toArray();

  const tsiArr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const num = dsPCArr[i];
    const den = dsAbsPCArr[i];
    if (num == null || den == null || den === 0) {
      tsiArr.push(NaN);
    } else {
      tsiArr.push(100 * num / den);
    }
  }

  // Signal = EMA(tsi, signalLen)
  const tsiSeries = new Series(bars, (_, i) => tsiArr[i]);
  const signalArr = ta.ema(tsiSeries, signalLen).toArray();

  const warmup = longLen + shortLen;

  // TSI line colored by direction
  const tsiPlot = tsiArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? tsiArr[i - 1] : NaN;
    const color = !isNaN(prev) && v >= prev ? '#2962FF' : '#FF6D00';
    return { time: bars[i].time, value: v, color };
  });

  // Signal line colored by direction
  const sigPlot = signalArr.map((v, i) => {
    if (i < warmup || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (signalArr[i - 1] ?? NaN) : NaN;
    const color = !isNaN(prev) && v >= prev ? '#2962FF' : '#FF6D00';
    return { time: bars[i].time, value: v, color };
  });

  // Bar histogram: diff = tsi - signal
  // barHi = max(0, diff), barLo = min(0, diff)
  // Color: OB curl down or OS curl up get special colors
  const barHiPlot = tsiArr.map((tsi, i) => {
    const sig = signalArr[i] ?? NaN;
    if (i < warmup || isNaN(tsi) || isNaN(sig)) return { time: bars[i].time, value: NaN };
    const diff = tsi - sig;
    const barHi = Math.max(0, diff);
    if (barHi === 0) return { time: bars[i].time, value: NaN };

    // OB curl down: tsi was above obValue and is now declining
    const prevTsi = i > 0 ? tsiArr[i - 1] : NaN;
    const obCurl = !isNaN(prevTsi) && prevTsi >= cfg.obValue && tsi < prevTsi;
    const color = obCurl ? '#FF5252' : '#26A69A';
    return { time: bars[i].time, value: barHi, color };
  });

  const barLoPlot = tsiArr.map((tsi, i) => {
    const sig = signalArr[i] ?? NaN;
    if (i < warmup || isNaN(tsi) || isNaN(sig)) return { time: bars[i].time, value: NaN };
    const diff = tsi - sig;
    const barLo = Math.min(0, diff);
    if (barLo === 0) return { time: bars[i].time, value: NaN };

    // OS curl up: tsi was below osValue and is now rising
    const prevTsi = i > 0 ? tsiArr[i - 1] : NaN;
    const osCurl = !isNaN(prevTsi) && prevTsi <= cfg.osValue && tsi > prevTsi;
    const color = osCurl ? '#00E676' : '#EF5350';
    return { time: bars[i].time, value: barLo, color };
  });

  // Fill between TSI and signal
  const fillColors = tsiArr.map((tsi, i) => {
    const sig = signalArr[i] ?? NaN;
    if (i < warmup || isNaN(tsi) || isNaN(sig)) return 'transparent';
    return tsi >= sig ? 'rgba(41,98,255,0.15)' : 'rgba(255,109,0,0.15)';
  });

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
    plots: { 'plot0': tsiPlot, 'plot1': sigPlot, 'plot2': barHiPlot, 'plot3': barLoPlot },
    hlines,
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
  };
}

export const BjorgumTSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
