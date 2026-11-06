/**
 * CBC Flip with Volume
 *
 * Candle-by-candle (CBC) flip state: it turns bullish when a bullish candle closes above the previous high with more
 * volume than the previous bar, and bearish when a bearish candle closes below the previous low with more volume
 * than the previous bar. Each flip is marked by a triangle and a background colour, strong (bigger, more opaque)
 * when the volume is above its SMA over `volLen` bars. Two hidden plots give the gain in % since the open of the
 * flip candle while the state holds.
 * Alerts (alertcondition, `alerts` of the result): 'Bull Flip' and 'Bear Flip', true on the bars of each flip.
 *
 * Reference: "CBC Flip with Volume [Pt]" by PtGambler
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PtGambler
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CbcFlipWithVolumeInputs {
  /** Volume SMA lookback */
  volLen: number;
}

export const defaultInputs: CbcFlipWithVolumeInputs = {
  volLen: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'volLen', type: 'int', title: 'Volume MA Lookback', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull in Control (% gain)', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Bear in Control (% gain)', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'CBC Flip with Volume [Pt]',
  shortTitle: 'CBC Flip[Pt]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };

interface CbcRun extends BarRunState<{ cbc: boolean; cbcOpen: number }> {
  avgVol: WindowSma;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<CbcFlipWithVolumeInputs>): BarStudy<CbcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullNormal = String(color.rgb(120, 206, 176));
  const bearNormal = String(color.rgb(228, 102, 102));
  const bullStrong = String(color.rgb(0, 200, 100));
  const bearStrong = String(color.rgb(200, 50, 50));
  const bgBullStrong = String(color.new(color.green, 40));
  const bgBullNormal = String(color.new(color.green, 80));
  const bgBearStrong = String(color.new(color.red, 40));
  const bgBearNormal = String(color.new(color.red, 80));
  return {
    init() {
      const avgVol = new WindowSma(cfg.volLen);
      // var bool cbc = false; var float cbc_open = 0.
      const s: CbcRun = {
        avgVol, plot0: [], plot1: [], flags: [[], []], times: [[], []], markers: [], bgColors: [], steps: [avgVol],
        vars: { cbc: false, cbcOpen: 0.0 }, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.bgColors];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      // volHigh = volume > ta.sma(volume, volLen)
      const volHigh = gt(volume, s.avgVol.step(volume));
      // prevCbc = cbc[1] (false on the first bar: a bool is never na)
      const prevCbc = v.cbc;
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      const prevHigh = i > 0 ? bars[i - 1].high : NaN;
      const prevVol = i > 0 ? bars[i - 1].volume ?? NaN : NaN;
      if (v.cbc && lt(b.close, prevLow) && lt(b.close, b.open) && gt(volume, prevVol)) {
        v.cbc = false;
        v.cbcOpen = b.open;
      }
      if (!v.cbc && gt(b.close, prevHigh) && gt(b.close, b.open) && gt(volume, prevVol)) {
        v.cbc = true;
        v.cbcOpen = b.open;
      }
      const cbc = v.cbc;
      const cbcOpen = v.cbcOpen;
      const bullFlip = cbc && !prevCbc;
      const bearFlip = !cbc && prevCbc;
      s.flags[0][i] = bullFlip;
      s.flags[1][i] = bearFlip;
      if (bullFlip) s.times[0].push(t as number);
      if (bearFlip) s.times[1].push(t as number);

      // The four plotshape calls: Bull / Bear Flip (Normal), then Bull / Bear Flip (Strong), ids shape0 .. shape3
      if (bullFlip && !volHigh) {
        s.markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'triangleUp', color: bullNormal, size: 'tiny' });
      }
      if (bearFlip && !volHigh) {
        s.markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'triangleDown', color: bearNormal, size: 'tiny' });
      }
      if (bullFlip && volHigh) {
        s.markers.push({ id: 'shape2', time: t, position: 'belowBar', shape: 'triangleUp', color: bullStrong, size: 'small' });
      }
      if (bearFlip && volHigh) {
        s.markers.push({ id: 'shape3', time: t, position: 'aboveBar', shape: 'triangleDown', color: bearStrong, size: 'small' });
      }

      if (bullFlip) s.bgColors.push({ time: t, color: volHigh ? bgBullStrong : bgBullNormal });
      else if (bearFlip) s.bgColors.push({ time: t, color: volHigh ? bgBearStrong : bgBearNormal });

      // A plain division: cbc_open = 0 gives +-infinity (na in the plot)
      const bull = cbc && gt(b.close, cbcOpen) ? ((b.close - cbcOpen) / cbcOpen) * 100 : 0;
      const bear = !cbc && lt(b.close, cbcOpen) ? ((b.close - cbcOpen) / cbcOpen) * -100 : 0;
      s.plot0[i] = { time: t, value: Number.isFinite(bull) ? bull : NaN };
      s.plot1[i] = { time: t, value: Number.isFinite(bear) ? bear : NaN };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(cbc and not prevCbc, 'Bull Flip') / alertcondition(not cbc and prevCbc, 'Bear Flip')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CbcFlipWithVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CbcFlipWithVolumeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bull Flip', message: 'CBC Flip: Bulls in control' },
  { id: 'alert1', title: 'Bear Flip', message: 'CBC Flip: Bears in control' },
];

export const CbcFlipWithVolume = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
