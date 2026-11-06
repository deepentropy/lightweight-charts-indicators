/**
 * Moving Average Ribbon Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Displays up to 4 moving averages to visualize trend direction and momentum.
 * Based on the standard MA Ribbon indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MARibbonInputs {
  /** Show MA 1 */
  showMa1: boolean;
  /** MA 1 type */
  ma1Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 1 source */
  ma1Source: SourceType;
  /** MA 1 length */
  ma1Length: number;
  /** MA 1 colour */
  ma1Color: string;
  /** Show MA 2 */
  showMa2: boolean;
  /** MA 2 type */
  ma2Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 2 source */
  ma2Source: SourceType;
  /** MA 2 length */
  ma2Length: number;
  /** MA 2 colour */
  ma2Color: string;
  /** Show MA 3 */
  showMa3: boolean;
  /** MA 3 type */
  ma3Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 3 source */
  ma3Source: SourceType;
  /** MA 3 length */
  ma3Length: number;
  /** MA 3 colour */
  ma3Color: string;
  /** Show MA 4 */
  showMa4: boolean;
  /** MA 4 type */
  ma4Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 4 source */
  ma4Source: SourceType;
  /** MA 4 length */
  ma4Length: number;
  /** MA 4 colour */
  ma4Color: string;
}

export const defaultInputs: MARibbonInputs = {
  showMa1: true,
  ma1Type: 'SMA',
  ma1Source: 'close',
  ma1Length: 20,
  ma1Color: '#F6C309',
  showMa2: true,
  ma2Type: 'SMA',
  ma2Source: 'close',
  ma2Length: 50,
  ma2Color: '#FB9800',
  showMa3: true,
  ma3Type: 'SMA',
  ma3Source: 'close',
  ma3Length: 100,
  ma3Color: '#FB6500',
  showMa4: true,
  ma4Type: 'SMA',
  ma4Source: 'close',
  ma4Length: 200,
  ma4Color: '#F60C0C',
};

export const inputConfig: InputConfig[] = [
  { id: 'showMa1', type: 'bool', title: 'MA #1', defval: true, inline: 'MA #1', display: 'none' },
  { id: 'ma1Type', type: 'string', title: '', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], inline: 'MA #1', active: 'showMa1' },
  { id: 'ma1Source', type: 'source', title: '', defval: 'close', inline: 'MA #1', display: 'none', active: 'showMa1' },
  { id: 'ma1Length', type: 'int', title: '', defval: 20, min: 1, inline: 'MA #1', active: 'showMa1' },
  { id: 'ma1Color', type: 'color', title: '', defval: '#F6C309', inline: 'MA #1', active: 'showMa1' },
  { id: 'showMa2', type: 'bool', title: 'MA #2', defval: true, inline: 'MA #2', display: 'none' },
  { id: 'ma2Type', type: 'string', title: '', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], inline: 'MA #2', active: 'showMa2' },
  { id: 'ma2Source', type: 'source', title: '', defval: 'close', inline: 'MA #2', display: 'none', active: 'showMa2' },
  { id: 'ma2Length', type: 'int', title: '', defval: 50, min: 1, inline: 'MA #2', active: 'showMa2' },
  { id: 'ma2Color', type: 'color', title: '', defval: '#FB9800', inline: 'MA #2', active: 'showMa2' },
  { id: 'showMa3', type: 'bool', title: 'MA #3', defval: true, inline: 'MA #3', display: 'none' },
  { id: 'ma3Type', type: 'string', title: '', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], inline: 'MA #3', active: 'showMa3' },
  { id: 'ma3Source', type: 'source', title: '', defval: 'close', inline: 'MA #3', display: 'none', active: 'showMa3' },
  { id: 'ma3Length', type: 'int', title: '', defval: 100, min: 1, inline: 'MA #3', active: 'showMa3' },
  { id: 'ma3Color', type: 'color', title: '', defval: '#FB6500', inline: 'MA #3', active: 'showMa3' },
  { id: 'showMa4', type: 'bool', title: 'MA #4', defval: true, inline: 'MA #4', display: 'none' },
  { id: 'ma4Type', type: 'string', title: '', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], inline: 'MA #4', active: 'showMa4' },
  { id: 'ma4Source', type: 'source', title: '', defval: 'close', inline: 'MA #4', display: 'none', active: 'showMa4' },
  { id: 'ma4Length', type: 'int', title: '', defval: 200, min: 1, inline: 'MA #4', active: 'showMa4' },
  { id: 'ma4Color', type: 'color', title: '', defval: '#F60C0C', inline: 'MA #4', active: 'showMa4' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA #1', color: '#F6C309', lineWidth: 1 },
  { id: 'plot1', title: 'MA #2', color: '#FB9800', lineWidth: 1 },
  { id: 'plot2', title: 'MA #3', color: '#FB6500', lineWidth: 1 },
  { id: 'plot3', title: 'MA #4', color: '#F60C0C', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Ribbon',
  shortTitle: 'MA Ribbon',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number, volume: number): number; commit(): void };

/**
 * A moving average based on type, stepped bar by bar
 */
function maStep(maType: string, length: number): Ma {
  switch (maType) {
    case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'SMMA (RMA)': { const m = taStep.rma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'VWMA': return new WindowVwma(length);
    case 'SMA':
    default: { const m = new WindowSma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  }
}

interface MaRibbonRun extends BarRunState<Record<string, never>> {
  mas: (Ma | null)[];
  out: Point[][];
}

function study(inputs: Partial<MARibbonInputs>): BarStudy<MaRibbonRun, IndicatorResult> {
  const {
    showMa1, ma1Type, ma1Source, ma1Length, ma1Color,
    showMa2, ma2Type, ma2Source, ma2Length, ma2Color,
    showMa3, ma3Type, ma3Source, ma3Length, ma3Color,
    showMa4, ma4Type, ma4Source, ma4Length, ma4Color,
  } = { ...defaultInputs, ...inputs };
  const maConfigs = [
    { show: showMa1, type: ma1Type, source: ma1Source, length: ma1Length, color: ma1Color, plotId: 'plot0' },
    { show: showMa2, type: ma2Type, source: ma2Source, length: ma2Length, color: ma2Color, plotId: 'plot1' },
    { show: showMa3, type: ma3Type, source: ma3Source, length: ma3Length, color: ma3Color, plotId: 'plot2' },
    { show: showMa4, type: ma4Type, source: ma4Source, length: ma4Length, color: ma4Color, plotId: 'plot3' },
  ];
  const values = maConfigs.map((c) => barSource(c.source));
  return {
    fullRunReason: () => (maConfigs.every((c) => !c.show || isBarSource(c.source)) ? null : 'source of another study'),
    init() {
      const mas = maConfigs.map((c) => (c.show ? maStep(c.type, c.length) : null));
      const out: Point[][] = maConfigs.map(() => []);
      return { mas, out, steps: mas.filter((m): m is Ma => m !== null), vars: {}, lists: [], series: out };
    },
    bar(s, i, bars) {
      const b = bars[i];
      for (let k = 0; k < 4; k++) {
        const m = s.mas[k];
        // Hidden MA: na values (the plot keeps its colour)
        const value = m ? m.step(values[k](b), b.volume ?? 0) : NaN;
        s.out[k][i] = { time: b.time, value: value ?? NaN, color: maConfigs[k].color };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      maConfigs.forEach((c, k) => { plots[c.plotId] = s.out[k].slice(); });
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MARibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MARibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MARibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
