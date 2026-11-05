/**
 * [Pandora] Laguerre Ultimate Explorations Multicator (LUEM)
 *
 * Each filter is an Ehlers Ultimate Smoother of the source (period P), then a modified four-stage Laguerre low-pass
 * of the smoother with the lag factor; the Laguerre mode picks the binomial weights of the output (mode 0 = the
 * smoother itself, mode 4 = Ehlers' original weights). The oscillator in the pane is the difference between the
 * smoother and a Laguerre-style one-pole filter of it, divided by the RMS of that difference over `periodRMS` bars.
 * On the price pane: a ribbon of the Laguerre filters with periods 2 to 59, the Ultimate Smoother and the Laguerre
 * filter of the main period.
 *
 * The fourth Laguerre stage uses lerp1[1] (not lerp3[1]) in its difference term, as the Pine script.
 *
 * Reference: "[Pandora] Laguerre Ultimate Explorations Multicator" by ImmortalFreedom
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Use and reuse of this code is governed by the terms of the Attribution-NonCommercial-ShareAlike
 * 4.0 International License. https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.txt
 */

import { taStep, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LaguerreUltimateExplorationsMulticatorInputs {
  /** Source series */
  source: SourceType;
  /** Laguerre period of the main filter */
  period: number;
  /** Laguerre lag factor */
  lag: number;
  /** Laguerre mode (0 to 4): weights of the Laguerre output */
  laguerreMode: number;
  /** RMS period of the oscillator */
  periodRMS: number;
}

export const defaultInputs: LaguerreUltimateExplorationsMulticatorInputs = {
  source: 'close',
  period: 20.0,
  lag: 0.5,
  laguerreMode: 3,
  periodRMS: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source Series', defval: 'close' },
  { id: 'period', type: 'float', title: 'Laguerre Period', defval: 20.0, min: 1.0, step: 2.0, group: 'Laguerre options' },
  { id: 'lag', type: 'float', title: 'Laguerre Lag', defval: 0.5, min: -0.5, max: 0.95, step: 0.05, group: 'Laguerre options' },
  { id: 'laguerreMode', type: 'int', title: 'Laguerre Mode', defval: 3, min: 0, max: 4, step: 1, tooltip: 'This option determines the lag mode', group: 'Laguerre options' },
  { id: 'periodRMS', type: 'int', title: 'RMS Period', defval: 100, min: 5, step: 5, group: 'Oscillator Only Option' },
];

const RIBBON_COL = '#8080FF';
const RIBBON_PERIODS = Array.from({ length: 58 }, (_v, k) => k + 2); // 2 .. 59

// display = display.all - display.status_line - display.price_scale on the price pane plots (drawn in the pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre Oscillator', color: RIBBON_COL, lineWidth: 1 },
  ...RIBBON_PERIODS.map((p, k): PlotConfig => (
    { id: `plot${k + 1}`, title: `Laguerre ${p}`, color: RIBBON_COL, lineWidth: 1, forceOverlay: true })),
  { id: 'plot59', title: 'Ultimate Smoother', color: '#FFCC00', lineWidth: 1, forceOverlay: true },
  { id: 'plot60', title: 'Laguerre Filter', color: '#990099', lineWidth: 2, forceOverlay: true },
];

export const metadata = {
  title: '[Pandora] Laguerre Ultimate Explorations Multicator',
  shortTitle: 'LUEM',
  overlay: false,
};

const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

/** laguerreMulti(Series, Period, Lag, LaguerreMode): ultis, lagFilt, filt of each bar (one call site), stepped bar by bar */
class LaguerreMulti {
  private readonly coef0: number;
  private readonly coef1: number;
  private readonly coef2: number;
  /** Values of the last committed bar (src[1], src[2], ultis[1], ultis[2], lerp1..4[1], filt[1]) */
  private s1 = NaN;
  private s2 = NaN;
  private u1 = NaN;
  private u2 = NaN;
  private l1p = NaN;
  private l2p = NaN;
  private l3p = NaN;
  private l4p = NaN;
  private fp = NaN;
  /** Values of the bar stepped last */
  private s = NaN;
  private l1 = NaN;
  private l2 = NaN;
  private l3 = NaN;
  private l4 = NaN;
  private stepped = false;
  ultis = NaN;
  lagFilt = NaN;
  filt = NaN;

  constructor(period: number, private readonly lag: number, private readonly mode: number) {
    const SQRT2 = math.sqrt(2.0) as number;
    const omega = (Math.PI * SQRT2) / Math.max(1, period);
    const alpha = math.exp(-omega) as number;
    this.coef1 = (math.cos(omega) as number) * 2.0 * alpha;
    this.coef2 = math.pow(alpha, 2) as number;
    this.coef0 = (1.0 + this.coef1 + this.coef2) * 0.25;
  }

  step(s: number): void {
    const { coef0, coef1, coef2, lag, mode, s1, s2, u1, u2, l1p, l2p, l3p, l4p } = this;
    const u = (1.0 - coef0) * s
      + (2.0 * coef0 - coef1) * nz(s1, s)
      - (coef0 - coef2) * nz(s2, nz(s1, s))
      + coef1 * nz(u1, s)
      - coef2 * nz(u2, nz(u1, s));
    // Modified Laguerre low-pass filter
    const l1 = nz(u1, u) + lag * (nz(l1p, u) - nz(u1, u));
    const l2 = nz(l1p, l1) + lag * (nz(l2p, l1) - nz(l1p, l1));
    const l3 = nz(l2p, l2) + lag * (nz(l3p, l2) - nz(l2p, l2));
    const l4 = nz(l3p, l3) + lag * (nz(l4p, l3) - nz(l1p, l1));
    this.s = s;
    this.l1 = l1;
    this.l2 = l2;
    this.l3 = l3;
    this.l4 = l4;
    this.ultis = u;
    this.lagFilt = mode === 4 ? 0.0625 * (u + l1 * 4.0 + l2 * 6.0 + l3 * 4.0 + l4)
      : mode === 3 ? 0.125 * (u + l1 * 3.0 + l2 * 3.0 + l3)
        : mode === 2 ? 0.25 * (u + l1 * 2.0 + l2)
          : mode === 1 ? 0.5 * (u + l1)
            : u;
    // Laguerre oscillator filter: filt := -Lag * ultis + nz(ultis[1]) + Lag * nz(filt[1])
    this.filt = -lag * u + nz(u1) + lag * nz(this.fp);
    this.stepped = true;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.s2 = this.s1;
    this.s1 = this.s;
    this.u2 = this.u1;
    this.u1 = this.ultis;
    this.l1p = this.l1;
    this.l2p = this.l2;
    this.l3p = this.l3;
    this.l4p = this.l4;
    this.fp = this.filt;
  }
}

type Point = { time: number; value: number };

interface LaguerreRun extends BarRunState<Record<string, never>> {
  main: LaguerreMulti;
  ribbon: LaguerreMulti[];
  ms: ReturnType<typeof taStep.sma>;
  plotData: Point[][];
}

function study(inputs: Partial<LaguerreUltimateExplorationsMulticatorInputs>): BarStudy<LaguerreRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const main = new LaguerreMulti(cfg.period, cfg.lag, cfg.laguerreMode);
      const ribbon = RIBBON_PERIODS.map((p) => new LaguerreMulti(p, cfg.lag, cfg.laguerreMode));
      const ms = taStep.sma();
      const s: LaguerreRun = {
        main, ribbon, ms, plotData: Array.from({ length: RIBBON_PERIODS.length + 3 }, () => []),
        steps: [main, ...ribbon, ms], vars: {}, lists: [], series: [],
      };
      s.series = s.plotData;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time as number;
      const v = value(bars[i]) ?? NaN;
      const main = s.main;
      main.step(v);
      // RMS = math.sqrt(ta.sma(math.pow(ultis - filt, 2), RMSperiod)); lOsc = math.sign(RMS) == 0 ? 0 : (ultis - filt) / RMS
      const d = main.ultis - main.filt;
      const ms = s.ms.step(math.pow(d, 2) as number, cfg.periodRMS);
      const rms = math.sqrt(ms) as number;
      const osc = (math.sign(rms) as number) === 0 ? 0.0 : d / rms;
      const p = s.plotData;
      p[0][i] = { time, value: fin(osc) };
      for (let k = 0; k < RIBBON_PERIODS.length; k++) {
        const r = s.ribbon[k];
        r.step(v);
        p[k + 1][i] = { time, value: fin(r.lagFilt) };
      }
      p[59][i] = { time, value: fin(main.ultis) };
      p[60][i] = { time, value: fin(main.lagFilt) };
    },
    result(s) {
      const plots: Record<string, Point[]> = { plot0: s.plotData[0].slice() };
      RIBBON_PERIODS.forEach((_p, k) => {
        plots[`plot${k + 1}`] = s.plotData[k + 1].slice();
      });
      plots.plot59 = s.plotData[59].slice();
      plots.plot60 = s.plotData[60].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 1.0, options: { title: 'Upper Level', color: '#FF000080', linestyle: 'dotted' } },
          { value: 0.0, options: { title: 'Zero Level', color: '#EEEEEE', linestyle: 'dashed' } },
          { value: -1.0, options: { title: 'Lower Level', color: '#00FF0080', linestyle: 'dotted' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<LaguerreUltimateExplorationsMulticatorInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LaguerreUltimateExplorationsMulticatorInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LaguerreUltimateExplorationsMulticator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
