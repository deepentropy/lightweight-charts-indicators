/**
 * Volume-Weighted Money Flow
 *
 * A weighted average of five money flow measures on a 0..100 scale (50 = neutral): the MFI of hlc3, the CMF
 * ((sum of money flow volume / sum of volume + 1) * 50), and OBV, PVT and A/D minus their moving average (EMA or SMA),
 * each divided by the largest absolute value of that difference over the window and centred on 50. The bullish
 * strength is the share of the five measures above 50. The background is coloured by the side of the oscillator (or
 * of the strength), with an opacity that grows with the number of measures on that side.
 *
 * Alerts (alertcondition, `alerts` of the result): the oscillator crossing above / below 50, a bullish (bearish)
 * strength of 60 to 99 % and of 100 %.
 *
 * Reference: "Volume-Weighted Money Flow [sgbpulse]" by sgbpulse
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © sgbpulse
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWeightedMoneyFlowInputs {
  /** Weight of the OBV (%) */
  wObv: number;
  /** Weight of the PVT (%) */
  wPvt: number;
  /** Weight of the A/D (%) */
  wAccDist: number;
  /** Weight of the CMF (%) */
  wCmf: number;
  /** Weight of the MFI (%) */
  wMfi: number;
  mfiLength: number;
  /** Moving average of OBV, PVT and A/D */
  maType: 'EMA' | 'SMA';
  /** Moving average length, normalisation window and CMF length */
  volumeFlowMaLength: number;
  /** Background opacity source: the oscillator or the bullish strength */
  bgColorLogic: 'Weighted Value' | 'Strength';
  bullishColor: string;
  bearishColor: string;
  oscillatorColor: string;
}

export const defaultInputs: VolumeWeightedMoneyFlowInputs = {
  wObv: 20.0,
  wPvt: 20.0,
  wAccDist: 20.0,
  wCmf: 20.0,
  wMfi: 20.0,
  mfiLength: 14,
  maType: 'EMA',
  volumeFlowMaLength: 20,
  bgColorLogic: 'Weighted Value',
  bullishColor: '#88b8e3',
  bearishColor: '#ae9d9d',
  oscillatorColor: color.blue,
};

export const inputConfig: InputConfig[] = [
  { id: 'wObv', type: 'float', title: 'Weight - OBV (%)', defval: 20.0, min: 0.0, max: 100.0 },
  { id: 'wPvt', type: 'float', title: 'Weight - PVT (%)', defval: 20.0, min: 0.0, max: 100.0 },
  { id: 'wAccDist', type: 'float', title: 'Weight - A/D (%)', defval: 20.0, min: 0.0, max: 100.0 },
  { id: 'wCmf', type: 'float', title: 'Weight - CMF (%)', defval: 20.0, min: 0.0, max: 100.0 },
  { id: 'wMfi', type: 'float', title: 'Weight - MFI (%)', defval: 20.0, min: 0.0, max: 100.0 },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1, max: 100 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'volumeFlowMaLength', type: 'int', title: 'Volume Flow MA Length', defval: 20, min: 10, max: 50 },
  { id: 'bgColorLogic', type: 'string', title: 'Background Color Logic', defval: 'Weighted Value', options: ['Weighted Value', 'Strength'] },
  { id: 'bullishColor', type: 'color', title: 'Bullish Consensus Color', defval: '#88b8e3' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Consensus Color', defval: '#ae9d9d' },
  { id: 'oscillatorColor', type: 'color', title: 'VWMF Color', defval: color.blue },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMF', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Bullish Strength %', color: color.blue, lineWidth: 1, display: 'status_line' },
  { id: 'plot2', title: 'Bearish Strength %', color: color.blue, lineWidth: 1, display: 'status_line' },
  { id: 'plot3', title: 'Normalized OBV', color: '#88b8e3', lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'Normalized PVT', color: '#88b8e3', lineWidth: 1, display: 'data_window' },
  { id: 'plot5', title: 'Normalized A/D', color: '#88b8e3', lineWidth: 1, display: 'data_window' },
  { id: 'plot6', title: 'Normalized CMF', color: '#88b8e3', lineWidth: 1, display: 'data_window' },
  { id: 'plot7', title: 'Normalized MFI', color: '#88b8e3', lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'Volume-Weighted Money Flow [sgbpulse]',
  shortTitle: 'VWMF [sgbpulse]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

const CENTER = 50.0;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface VwmfVars {
  /** ta.accdist: the running sum */
  ad: number;
}

interface VwmfRun extends BarRunState<VwmfVars> {
  mfi: ReturnType<typeof taStep.mfi>;
  obv: ReturnType<typeof taStep.obv>;
  pvt: ReturnType<typeof taStep.cum>;
  sumMfv: ReturnType<typeof taStep.sum>;
  sumVol: ReturnType<typeof taStep.sum>;
  /** ma() of OBV, PVT and A/D */
  mas: Array<{ step(v: number): number; commit(): void }>;
  /** ta.highest / ta.lowest of the three differences (normalizeCentered) */
  his: Array<ReturnType<typeof taStep.highest>>;
  los: Array<ReturnType<typeof taStep.lowest>>;
  combined: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeWeightedMoneyFlowInputs>): BarStudy<VwmfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.volumeFlowMaLength;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const totalWeight = cfg.wObv + cfg.wPvt + cfg.wAccDist + cfg.wMfi + cfg.wCmf;
  const sideColor = (v: number) => (gt(v, CENTER) ? cfg.bullishColor : cfg.bearishColor);

  // ma(type, source, length): SMA or EMA
  const maStep = (): VwmfRun['mas'][number] => {
    if (cfg.maType === 'SMA') { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    return taStep.ema(len);
  };

  return {
    init() {
      const s: VwmfRun = {
        mfi: taStep.mfi(cfg.mfiLength), obv: taStep.obv(), pvt: taStep.cum(), sumMfv: taStep.sum(), sumVol: taStep.sum(),
        mas: [maStep(), maStep(), maStep()],
        his: [taStep.highest(), taStep.highest(), taStep.highest()],
        los: [taStep.lowest(), taStep.lowest(), taStep.lowest()],
        combined: [],
        plots: Array.from({ length: 8 }, () => []),
        bgColors: [],
        flags: Array.from({ length: 6 }, () => []),
        times: Array.from({ length: 6 }, () => []),
        steps: [], vars: { ad: 0 }, lists: [], series: [],
      };
      s.steps = [s.mfi, s.obv, s.pvt, s.sumMfv, s.sumVol, ...s.mas, ...s.his, ...s.los];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.combined, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = b.close;
      const h = b.high;
      const l = b.low;
      const hlc3 = (b.high + b.low + b.close) / 3;
      const vol = b.volume ?? NaN;
      const stdMfi = s.mfi.step(hlc3, vol);
      const stdObv = s.obv.step(c, vol);
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const stdPvt = s.pvt.step(i === 0 ? NaN : ((c - pc) / pc) * vol);
      // ta.accdist: a bar whose money flow volume is na adds nothing
      const adMfv = (((c - l) - (h - c)) / (h - l)) * vol;
      if (Number.isFinite(adMfv)) s.vars.ad += adMfv;
      const stdAccumDist = s.vars.ad;
      // close == high and close == low or high == low ? 0 : ((2 * close - low - high) / (high - low)) * volume
      const mfv = (eq(c, h) && eq(c, l)) || eq(h, l) ? 0 : ((2 * c - l - h) / (h - l)) * vol;
      const stdCmf = s.sumMfv.step(mfv, len) / s.sumVol.step(vol, len);

      // normalizeCentered(source - ma(source), length): max(|highest|, |lowest|); 50 when it is 0 or na
      const normalizeCentered = (k: number, src: number) => {
        const v = src - s.mas[k].step(src);
        const maxAbs = Math.max(Math.abs(s.his[k].step(v, len)), Math.abs(s.los[k].step(v, len)));
        return ne(maxAbs, 0) ? (v / maxAbs) * CENTER + CENTER : CENTER;
      };
      const normalizedMfi = stdMfi;
      const normalizedObv = normalizeCentered(0, stdObv);
      const normalizedPvt = normalizeCentered(1, stdPvt);
      const normalizedAccDist = normalizeCentered(2, stdAccumDist);
      const normalizedCmf = (stdCmf + 1) * CENTER;

      let cv = normalizedMfi * cfg.wMfi + normalizedObv * cfg.wObv + normalizedPvt * cfg.wPvt
        + normalizedAccDist * cfg.wAccDist + normalizedCmf * cfg.wCmf;
      if (ne(totalWeight, 0)) cv = cv / totalWeight;
      s.combined[i] = cv;
      let bullishCount = 0;
      let bearishCount = 0;
      for (const v of [normalizedMfi, normalizedObv, normalizedPvt, normalizedAccDist, normalizedCmf]) {
        if (gt(v, CENTER)) bullishCount++;
        if (lt(v, CENTER)) bearishCount++;
      }
      const bullStrength = (bullishCount / 5.0) * 100;
      const bearStrength = 100.0 - bullStrength;
      const active = cfg.bgColorLogic === 'Weighted Value' ? cv : bullStrength;
      if (gt(active, CENTER)) {
        s.bgColors.push({ time, color: String(color.new(cfg.bullishColor, 100 - bullishCount * 15)) });
      } else if (lt(active, CENTER)) {
        s.bgColors.push({ time, color: String(color.new(cfg.bearishColor, 100 - bearishCount * 15)) });
      }

      // The alertconditions of the original
      const prev = i > 0 ? s.combined[i - 1] : NaN;
      const flags = [
        gt(cv, CENTER) && le(prev, CENTER),
        lt(cv, CENTER) && ge(prev, CENTER),
        ge(bullStrength, 60) && lt(bullStrength, 100),
        ge(bullStrength, 100),
        ge(bearStrength, 60) && lt(bearStrength, 100),
        ge(bearStrength, 100),
      ];
      flags.forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });

      const comp = (v: number): Point => ({ time, value: fin(v), color: sideColor(v) });
      s.plots[0][i] = { time, value: fin(cv), color: cfg.oscillatorColor };
      s.plots[1][i] = { time, value: bullStrength };
      s.plots[2][i] = { time, value: bearStrength };
      s.plots[3][i] = comp(normalizedObv);
      s.plots[4][i] = comp(normalizedPvt);
      s.plots[5][i] = comp(normalizedAccDist);
      s.plots[6][i] = comp(normalizedCmf);
      s.plots[7][i] = comp(normalizedMfi);
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [{ value: CENTER, options: { title: 'Center Line', color: color.gray, linestyle: 'dashed' } }],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedMoneyFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeWeightedMoneyFlowInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'VWMF Cross Above 50', message: '{{ticker}}: Volume-Weighted Money Flow crossed above 50. Possible bullish momentum shift.' },
  { id: 'alert1', title: 'VWMF Cross Below 50', message: '{{ticker}}: Volume-Weighted Money Flow crossed below 50. Possible bearish momentum shift.' },
  { id: 'alert2', title: 'Bullish Strength: High But Not Absolute Consensus', message: '{{ticker}}: Bullish strength is high (between 60% and 80% consensus).' },
  { id: 'alert3', title: 'Bullish Strength: Absolute Consensus (100%)', message: '{{ticker}}: All 5 indicators show bullish strength.' },
  { id: 'alert4', title: 'Bearish Strength: High But Not Absolute Consensus', message: '{{ticker}}: Bearish strength is high (between 60% and 80% consensus).' },
  { id: 'alert5', title: 'Bearish Strength: Absolute Consensus (100%)', message: '{{ticker}}: All 5 indicators show bearish strength.' },
];

export const VolumeWeightedMoneyFlow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
