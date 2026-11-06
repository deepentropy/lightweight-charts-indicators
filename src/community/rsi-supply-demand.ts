/**
 * RSI Based Automatic Supply and Demand
 *
 * RSI-based supply and demand zones, four of them (four RSI lengths: 7, 14, 21, 28; only zone 2 is shown by
 * default). For each zone: counts the consecutive bars on which the RSI is overbought or oversold (also only
 * overbought for the resistance zone, only oversold for the support zone); once the count reaches the confirmation
 * bars, the high / low of that bar become the zone boundaries, carried forward (fixnan). The zone fill has no colour
 * on the bar where the zone changes. No markers: the original draws only the zone plots and fills.
 * Alerts (alertcondition, `alerts` of the result): 'Price Enters S/D Zone 1' to '4' (the close inside the zone, the
 * zone unchanged since the bar before, and not inside on the bar before) and 'Price Enters Any S/D Zone'.
 *
 * Reference: "RSI Supply/Demand" by shtcoinr / Lij_MC
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiSupplyDemandInputs {
  /** Zone 2 (shown by default) */
  rsiLength: number;
  obLevel: number;
  osLevel: number;
  confirmationBars: number;
  showSD: boolean;
  showSupport: boolean;
  showResistance: boolean;
  /** Zone 1 */
  rsiLength1: number;
  obLevel1: number;
  osLevel1: number;
  confirmationBars1: number;
  showSD1: boolean;
  showSupport1: boolean;
  showResistance1: boolean;
  /** Zone 3 */
  rsiLength3: number;
  obLevel3: number;
  osLevel3: number;
  confirmationBars3: number;
  showSD3: boolean;
  showSupport3: boolean;
  showResistance3: boolean;
  /** Zone 4 */
  rsiLength4: number;
  obLevel4: number;
  osLevel4: number;
  confirmationBars4: number;
  showSD4: boolean;
  showSupport4: boolean;
  showResistance4: boolean;
}

export const defaultInputs: RsiSupplyDemandInputs = {
  rsiLength: 14,
  obLevel: 70,
  osLevel: 30,
  confirmationBars: 3,
  showSD: true,
  showSupport: false,
  showResistance: false,
  rsiLength1: 7,
  obLevel1: 70,
  osLevel1: 30,
  confirmationBars1: 3,
  showSD1: false,
  showSupport1: false,
  showResistance1: false,
  rsiLength3: 21,
  obLevel3: 70,
  osLevel3: 30,
  confirmationBars3: 3,
  showSD3: false,
  showSupport3: false,
  showResistance3: false,
  rsiLength4: 28,
  obLevel4: 70,
  osLevel4: 30,
  confirmationBars4: 3,
  showSD4: false,
  showSupport4: false,
  showResistance4: false,
};

const ZONES = [1, 2, 3, 4];

/** Input ids of zone k (zone 2: the ids without a number, those of the first version of the port) */
const zoneKeys = (k: number) => {
  const sfx = k === 2 ? '' : String(k);
  return {
    rsiLength: `rsiLength${sfx}`, obLevel: `obLevel${sfx}`, osLevel: `osLevel${sfx}`, confirmationBars: `confirmationBars${sfx}`,
    showSD: `showSD${sfx}`, showSupport: `showSupport${sfx}`, showResistance: `showResistance${sfx}`,
  };
};

const defaults = defaultInputs as unknown as Record<string, number | boolean>;

export const inputConfig: InputConfig[] = ZONES.flatMap((k): InputConfig[] => {
  const key = zoneKeys(k);
  const group = `Supply Demand ${k}`;
  return [
    { id: key.showSD, type: 'bool', title: 'Show Supply/Demand Zone', defval: defaults[key.showSD], group },
    { id: key.showSupport, type: 'bool', title: 'Show Support Zone', defval: defaults[key.showSupport], group },
    { id: key.showResistance, type: 'bool', title: 'Show Resistance Zone', defval: defaults[key.showResistance], group },
    { id: key.rsiLength, type: 'int', title: 'RSI Length', defval: defaults[key.rsiLength], min: 1, group },
    { id: key.obLevel, type: 'int', title: 'Overbought Level', defval: 70, min: 50, max: 100, group },
    { id: key.osLevel, type: 'int', title: 'Oversold Level', defval: 30, min: 0, max: 50, group },
    { id: key.confirmationBars, type: 'int', title: 'Confirmation Bars', defval: 3, min: 1, group },
  ];
});

/** Plot ids of zone k (zone 2: the ids of the first version of the port) */
const plotIds = (k: number) => (k === 2
  ? { resHigh: 'resistanceHigh', resLow: 'resistanceLow', supHigh: 'supportHigh', supLow: 'supportLow', sdHigh: 'sdHigh', sdLow: 'sdLow' }
  : {
    resHigh: `resistance${k}High`, resLow: `resistance${k}Low`, supHigh: `support${k}High`, supLow: `support${k}Low`,
    sdHigh: `sd${k}High`, sdLow: `sd${k}Low`,
  });

/** The six plots of each zone, with the original's titles */
export const plotConfig: PlotConfig[] = ZONES.flatMap((k): PlotConfig[] => {
  const id = plotIds(k);
  return [
    { id: id.resHigh, title: `Resistance Zone - ${k} - High`, color: '#FF3333', lineWidth: 1 },
    { id: id.resLow, title: `Resistance Zone - ${k} - Low`, color: '#FF3333', lineWidth: 1 },
    { id: id.supHigh, title: `Support Zone - ${k} - High`, color: '#33FF33', lineWidth: 1 },
    { id: id.supLow, title: `Support Zone - ${k} - Low`, color: '#33FF33', lineWidth: 1 },
    { id: id.sdHigh, title: `Supply Demand - ${k} - High`, color: '#3366FF', lineWidth: 1 },
    { id: id.sdLow, title: `Supply Demand - ${k} - Low`, color: '#3366FF', lineWidth: 1 },
  ];
});

export const metadata = {
  title: 'RSI Supply/Demand',
  shortTitle: 'RSI S/D',
  overlay: true,
};

/** Pine float comparisons: a <= b unless a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { alerts: AlertConditionState[] };

/** One zone of a run: the RSI of one length, its counts and boundaries per bar, its plots and fill colours */
interface ZoneRun {
  rsi: ReturnType<typeof taStep.rsi>;
  len: number;
  obLevel: number;
  osLevel: number;
  confirmationBars: number;
  showSD: boolean;
  showSupport: boolean;
  showResistance: boolean;
  /** Consecutive bars overbought or oversold / overbought / oversold */
  rsx: number[];
  rsu: number[];
  rsd: number[];
  /** fixnan of the boundaries */
  sdH: number[];
  sdL: number[];
  resH: number[];
  resL: number[];
  supH: number[];
  supL: number[];
  inZone: boolean[];
  /** Plots: resHigh, resLow, supHigh, supLow, sdHigh, sdLow */
  lines: Point[][];
  resFill: string[];
  supFill: string[];
  sdFill: string[];
}

interface RsiSdRun extends BarRunState<Record<string, never>> {
  zones: ZoneRun[];
  flags: boolean[][];
  times: number[][];
}

// Colors: transparent when zone changes (new != prev), normal otherwise
const sdColor = 'rgba(51,102,255,0.15)';
const resColor = 'rgba(255,51,51,0.08)';
const supColor = 'rgba(51,255,51,0.08)';
const transparent = 'transparent';

/** fixnan of a boundary on bar i: the bar's value when the zone is confirmed, else the value of the bar before */
const fix = (on: boolean, raw: number, prev: number[], i: number) => (on && !isNaN(raw) ? raw : i > 0 ? prev[i - 1] : NaN);

function study(inputs: Partial<RsiSupplyDemandInputs>): BarStudy<RsiSdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const c = cfg as unknown as Record<string, number | boolean>;
  return {
    init() {
      const zones = ZONES.map((k): ZoneRun => {
        const key = zoneKeys(k);
        const len = c[key.rsiLength] as number;
        return {
          rsi: taStep.rsi(len), len, obLevel: c[key.obLevel] as number, osLevel: c[key.osLevel] as number,
          confirmationBars: c[key.confirmationBars] as number, showSD: c[key.showSD] as boolean,
          showSupport: c[key.showSupport] as boolean, showResistance: c[key.showResistance] as boolean,
          rsx: [], rsu: [], rsd: [], sdH: [], sdL: [], resH: [], resL: [], supH: [], supL: [], inZone: [],
          lines: [[], [], [], [], [], []], resFill: [], supFill: [], sdFill: [],
        };
      });
      const s: RsiSdRun = {
        zones, flags: [[], [], [], [], []], times: [[], [], [], [], []],
        steps: zones.map((z) => z.rsi), vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [
        ...zones.flatMap((z) => [
          z.rsx, z.rsu, z.rsd, z.sdH, z.sdL, z.resH, z.resL, z.supH, z.supL, z.inZone, ...z.lines, z.resFill, z.supFill,
          z.sdFill,
        ]),
        ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      let any = false;
      for (let k = 0; k < 4; k++) {
        const z = s.zones[k];
        const rsiVal = z.rsi.step(b.close);
        const isOB = rsiVal > z.obLevel;
        const isOS = rsiVal < z.osLevel;
        const isEither = isOB || isOS;

        // Combined S/D zone (OB or OS), resistance zone (OB only), support zone (OS only); fixnan of each boundary
        const rsx = isEither ? (i > 0 ? z.rsx[i - 1] : 0) + 1 : 0;
        const rsu = isOB ? (i > 0 ? z.rsu[i - 1] : 0) + 1 : 0;
        const rsd = isOS ? (i > 0 ? z.rsd[i - 1] : 0) + 1 : 0;
        z.rsx[i] = rsx;
        z.rsu[i] = rsu;
        z.rsd[i] = rsd;
        const sdOn = rsx >= z.confirmationBars;
        const resOn = rsu >= z.confirmationBars;
        const supOn = rsd >= z.confirmationBars;
        const sdH = (z.sdH[i] = fix(sdOn, b.high, z.sdH, i));
        const sdL = (z.sdL[i] = fix(sdOn, b.low, z.sdL, i));
        const resH = (z.resH[i] = fix(resOn, b.high, z.resH, i));
        const resL = (z.resL[i] = fix(resOn, b.low, z.resL, i));
        const supH = (z.supH[i] = fix(supOn, b.high, z.supH, i));
        const supL = (z.supL[i] = fix(supOn, b.low, z.supL, i));

        // PriceInSDZone = close <= rH and close >= rL and rH == rH[1]; PriceEntersSDZone = in and not in[1]
        const inZone = le(b.close, sdH) && ge(b.close, sdL) && i > 0 && sdH === z.sdH[i - 1];
        z.inZone[i] = inZone;
        const enters = inZone && !(i > 0 && z.inZone[i - 1]);
        s.flags[k][i] = enters;
        if (enters) s.times[k].push(time as number);
        any = any || enters;

        const warmup = z.len + 1;
        const early = i < warmup;
        z.sdFill[i] = early ? transparent : (i > 0 && sdH !== z.sdH[i - 1]) ? transparent : sdColor;
        z.resFill[i] = early ? transparent : (i > 0 && resH !== z.resH[i - 1]) ? transparent : resColor;
        z.supFill[i] = early ? transparent : (i > 0 && supL !== z.supL[i - 1]) ? transparent : supColor;

        const L = z.lines;
        L[0][i] = { time, value: (early || !z.showResistance) ? NaN : resH };
        L[1][i] = { time, value: (early || !z.showResistance) ? NaN : resL };
        L[2][i] = { time, value: (early || !z.showSupport) ? NaN : supH };
        L[3][i] = { time, value: (early || !z.showSupport) ? NaN : supL };
        L[4][i] = { time, value: (early || !z.showSD) ? NaN : sdH };
        L[5][i] = { time, value: (early || !z.showSD) ? NaN : sdL };
      }
      s.flags[4][i] = any;
      if (any) s.times[4].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const plots: IndicatorResult['plots'] = {};
      const fills: NonNullable<IndicatorResult['fills']> = [];
      s.zones.forEach((z, j) => {
        const k = ZONES[j];
        const id = plotIds(k);
        plots[id.resHigh] = z.lines[0].slice();
        plots[id.resLow] = z.lines[1].slice();
        plots[id.supHigh] = z.lines[2].slice();
        plots[id.supLow] = z.lines[3].slice();
        plots[id.sdHigh] = z.lines[4].slice();
        plots[id.sdLow] = z.lines[5].slice();
        // The original's fill titles (its resistance fill is titled "Support Zone - k - Fill" too)
        fills.push(
          { plot1: id.resHigh, plot2: id.resLow, options: { color: resColor, title: `Support Zone - ${k} - Fill` }, colors: z.resFill.slice() },
          { plot1: id.supHigh, plot2: id.supLow, options: { color: supColor, title: `Support Zone - ${k} - Fill` }, colors: z.supFill.slice() },
          { plot1: id.sdHigh, plot2: id.sdLow, options: { color: sdColor, title: `Supply Demand - ${k} - Fill` }, colors: z.sdFill.slice() },
        );
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiSupplyDemandInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiSupplyDemandInputs> = {},
): Omit<IndicatorResult, 'markers'> & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Alert - Price Enters S/D Zone 1', message: 'Price Enters S/D Zone 1 - RSI S/D' },
  { id: 'alert1', title: 'Alert - Price Enters S/D Zone 2', message: 'Price Enters S/D Zone 2 - RSI S/D' },
  { id: 'alert2', title: 'Alert - Price Enters S/D Zone 3', message: 'Price Enters S/D Zone 3 - RSI S/D' },
  { id: 'alert3', title: 'Alert - Price Enters S/D Zone 4', message: 'Price Enters S/D Zone 4 - RSI S/D' },
  { id: 'alert4', title: 'Alert - Price Enters Any S/D Zone', message: 'Price Enters Any S/D Zone - RSI S/D' },
];

export const RsiSupplyDemand = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
