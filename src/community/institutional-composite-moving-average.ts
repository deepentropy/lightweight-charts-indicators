/**
 * Institutional Composite Moving Average (ICMA)
 *
 * Four composite moving averages. Each one is the mean of four averages of its source over its length: SMA, EMA,
 * WMA and a Hull average wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len))). Each line has its own source,
 * length, colour and show switch.
 *
 * Reference: "Institutional Composite Moving Average (ICMA) [Volume Vigilante]" by VolumeVigilante
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VolumeVigilante
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface InstitutionalCompositeMovingAverageInputs {
  showMa1: boolean;
  ma1Source: SourceType;
  ma1Length: number;
  ma1Color: string;
  showMa2: boolean;
  ma2Source: SourceType;
  ma2Length: number;
  ma2Color: string;
  showMa3: boolean;
  ma3Source: SourceType;
  ma3Length: number;
  ma3Color: string;
  showMa4: boolean;
  ma4Source: SourceType;
  ma4Length: number;
  ma4Color: string;
}

export const defaultInputs: InstitutionalCompositeMovingAverageInputs = {
  showMa1: true,
  ma1Source: 'close',
  ma1Length: 20,
  ma1Color: String(color.new(color.gray, 0)),
  showMa2: true,
  ma2Source: 'close',
  ma2Length: 50,
  ma2Color: String(color.new(color.green, 0)),
  showMa3: true,
  ma3Source: 'close',
  ma3Length: 100,
  ma3Color: String(color.new(color.red, 0)),
  showMa4: true,
  ma4Source: 'close',
  ma4Length: 200,
  ma4Color: String(color.new(color.purple, 0)),
};

export const inputConfig: InputConfig[] = [
  { id: 'showMa1', type: 'bool', title: 'Show MA #1', defval: true, inline: 'MA #1', group: 'MA #1' },
  { id: 'ma1Source', type: 'source', title: 'MA #1 Source', defval: 'close', inline: 'MA #1', group: 'MA #1' },
  { id: 'ma1Length', type: 'int', title: 'MA #1 Length', defval: 20, min: 1, inline: 'MA #1', group: 'MA #1' },
  { id: 'ma1Color', type: 'color', title: 'MA #1 Color', defval: defaultInputs.ma1Color, inline: 'MA #1', group: 'MA #1' },
  { id: 'showMa2', type: 'bool', title: 'Show MA #2', defval: true, inline: 'MA #2', group: 'MA #2' },
  { id: 'ma2Source', type: 'source', title: 'MA #2 Source', defval: 'close', inline: 'MA #2', group: 'MA #2' },
  { id: 'ma2Length', type: 'int', title: 'MA #2 Length', defval: 50, min: 1, inline: 'MA #2', group: 'MA #2' },
  { id: 'ma2Color', type: 'color', title: 'MA #2 Color', defval: defaultInputs.ma2Color, inline: 'MA #2', group: 'MA #2' },
  { id: 'showMa3', type: 'bool', title: 'Show MA #3', defval: true, inline: 'MA #3', group: 'MA #3' },
  { id: 'ma3Source', type: 'source', title: 'MA #3 Source', defval: 'close', inline: 'MA #3', group: 'MA #3' },
  { id: 'ma3Length', type: 'int', title: 'MA #3 Length', defval: 100, min: 1, inline: 'MA #3', group: 'MA #3' },
  { id: 'ma3Color', type: 'color', title: 'MA #3 Color', defval: defaultInputs.ma3Color, inline: 'MA #3', group: 'MA #3' },
  { id: 'showMa4', type: 'bool', title: 'Show MA #4', defval: true, inline: 'MA #4', group: 'MA #4' },
  { id: 'ma4Source', type: 'source', title: 'MA #4 Source', defval: 'close', inline: 'MA #4', group: 'MA #4' },
  { id: 'ma4Length', type: 'int', title: 'MA #4 Length', defval: 200, min: 1, inline: 'MA #4', group: 'MA #4' },
  { id: 'ma4Color', type: 'color', title: 'MA #4 Color', defval: defaultInputs.ma4Color, inline: 'MA #4', group: 'MA #4' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Composite MA #1', color: defaultInputs.ma1Color, lineWidth: 1 },
  { id: 'plot1', title: 'Composite MA #2', color: defaultInputs.ma2Color, lineWidth: 1 },
  { id: 'plot2', title: 'Composite MA #3', color: defaultInputs.ma3Color, lineWidth: 1 },
  { id: 'plot3', title: 'Composite MA #4', color: defaultInputs.ma4Color, lineWidth: 1 },
];

export const metadata = {
  title: 'Institutional Composite Moving Average (ICMA) [Volume Vigilante]',
  shortTitle: 'ICMA [Volume Vigilante]',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

/** compositeMA(src, len): (sma + ema + hma + wma) / 4, one bar at a time */
class CompositeMA {
  private readonly sma = taStep.sma();
  private readonly ema: ReturnType<typeof taStep.ema>;
  private readonly wma = taStep.wma();
  private readonly wmaHalf = taStep.wma();
  private readonly hma = taStep.wma();
  private readonly hmaLength: number;

  constructor(private readonly len: number) {
    this.ema = taStep.ema(len);
    this.hmaLength = Math.round(Math.sqrt(len));
  }

  step(v: number): number {
    const sma = this.sma.step(v, this.len);
    const ema = this.ema.step(v);
    const wma = this.wma.step(v, this.len);
    // hma = ta.wma(2 * ta.wma(src, len / 2) - ta.wma(src, len), math.round(math.sqrt(len)))
    const wmaHalf = this.wmaHalf.step(v, this.len / 2);
    const hma = this.hma.step(2 * wmaHalf - wma, this.hmaLength);
    return (sma + ema + hma + wma) / 4;
  }

  commit(): void {
    this.sma.commit();
    this.ema.commit();
    this.wma.commit();
    this.wmaHalf.commit();
    this.hma.commit();
  }
}

interface IcmaRun extends BarRunState<Record<string, never>> {
  plots: Point[][];
}

function study(inputs: Partial<InstitutionalCompositeMovingAverageInputs>): BarStudy<IcmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const lines = [
    { show: cfg.showMa1, source: cfg.ma1Source, len: cfg.ma1Length, col: cfg.ma1Color },
    { show: cfg.showMa2, source: cfg.ma2Source, len: cfg.ma2Length, col: cfg.ma2Color },
    { show: cfg.showMa3, source: cfg.ma3Source, len: cfg.ma3Length, col: cfg.ma3Color },
    { show: cfg.showMa4, source: cfg.ma4Source, len: cfg.ma4Length, col: cfg.ma4Color },
  ].map((l) => ({ ...l, value: barSource(l.source) }));
  let mas: CompositeMA[] = [];
  return {
    fullRunReason: () => (lines.every((l) => isBarSource(l.source)) ? null : 'source of another study'),
    init() {
      mas = lines.map((l) => new CompositeMA(l.len));
      const s: IcmaRun = { plots: lines.map(() => []), steps: mas, vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      lines.forEach((l, k) => {
        const ma = mas[k].step(l.value(b));
        // plot(show_ma ? ma : na, color = ma_color)
        s.plots[k][i] = { time: b.time, value: l.show ? ma : NaN, color: l.col };
      });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<InstitutionalCompositeMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InstitutionalCompositeMovingAverageInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const InstitutionalCompositeMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
