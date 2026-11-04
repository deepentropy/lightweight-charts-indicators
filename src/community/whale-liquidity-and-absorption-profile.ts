/**
 * Whale Liquidity and Absorption Profile [AlgoAlpha]
 *
 * Lower timeframe bars of the chart symbol (the chart timeframe divided by "Bar Granularity", at least one minute
 * unless "Allow Seconds") are kept as rows (direction close > open, volume, close, absorption volume) for the last
 * "Profile Lookback" chart bars (Lookback x the granularity rows). A row's absorption volume is its volume when a
 * rising lower bar closes inside the upper wick of its chart bar, or a falling one inside the lower wick.
 * On the last bar the price range of the rows is cut into "Profile Resolution" bins and three profiles are drawn
 * to the right of the price: a volume profile (strong buy, weak buy, weak sell and strong sell segments; a row is
 * strong when its volume is at or above the "Strength Filter" percentile of the row volumes), a delta heatmap (buy
 * minus sell volume per bin, with the signed value as text) and an absorption profile, with a label above each.
 * Absorption peaks (a bin above both neighbours) are drawn as zones over the lookback. Options: a value area
 * (from the highest-volume bin, adding the larger neighbour until "Value Area Percent" of the volume), bubbles at
 * the price of the strongest lower bar of each of four percentile tiers above the filter (on every bar), and an
 * absorption heatmap of the rows every 5 bars (boxes that stay until the box limit removes them).
 * Alerts (alertcondition, `alerts` of the result): strong buying / selling (a bubble price on the bar), and on the
 * last bar the close in a value-area bin, in the dominant delta bin (bullish / bearish) or in an absorption peak.
 *
 * Lower timeframe bars: the chart symbol on that timeframe (`request.security_lower_tf` of direction, volume and
 * close) from the chart context (`requiredSymbols`, `bars` accessor); without them the port throws a
 * MissingSymbolDataError that lists them. A timeframe equal to the chart timeframe uses the chart bars. The
 * original's platform limits the lower timeframe history; the port uses the bars it receives.
 * Chart values (optional third argument of calculate): the chart timeframe, the symbol tick (minimum price range),
 * `chart.fg_color` / `chart.bg_color` of the labels, texts and absorption boxes (fallbacks #DBDBDB / #0F0F0F), and
 * the state of the last bar: rows are added on closed bars only (barstate.isconfirmed).
 *
 * Reference: "Whale Liquidity and Absorption Profile [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  box, label, color, str, timeframe, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type Box, type Label,
} from 'oakscriptjs';
import type { BoxData, LabelData, MarkerData } from '../types';
import {
  backgroundColorOf, foregroundColorOf, lastBarConfirmedOf, mintickOf, symbolBarsOf, tickeridOf,
  type ChartContext, type SymbolRequest,
} from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface WhaleLiquidityAndAbsorptionProfileInputs {
  /** Profile Lookback */
  lookback: number;
  /** Bar Granularity */
  intragran: number;
  /** Allow Seconds */
  allowSeconds: boolean;
  /** Strength Filter */
  strengthFilter: number;
  /** Strong Only */
  strongOnly: boolean;
  /** Profile Resolution */
  profileBins: number;
  /** Profile Width */
  profileWidth: number;
  /** Profile Offset */
  profileOffset: number;
  /** Detect Value Area */
  detectValueArea: boolean;
  /** Value Area Percent */
  valueAreaPercent: number;
  /** Show Volume Profile */
  showVolumeProfile: boolean;
  /** Show Delta Profile */
  showDeltaProfile: boolean;
  /** Show Absorption Profile */
  showAbsorptionProfile: boolean;
  /** Show Levels */
  showLevels: boolean;
  /** Show Bubbles */
  showBubbles: boolean;
  /** Show Absorption Heatmap */
  showAbsorptionHeatmap: boolean;
  /** Bullish Colour */
  green: string;
  /** Bearish Colour */
  red: string;
}

export const defaultInputs: WhaleLiquidityAndAbsorptionProfileInputs = {
  lookback: 200,
  intragran: 10,
  allowSeconds: false,
  strengthFilter: 97,
  strongOnly: false,
  profileBins: 35,
  profileWidth: 100,
  profileOffset: 120,
  detectValueArea: false,
  valueAreaPercent: 30,
  showVolumeProfile: true,
  showDeltaProfile: true,
  showAbsorptionProfile: true,
  showLevels: true,
  showBubbles: false,
  showAbsorptionHeatmap: false,
  green: '#00ffbb',
  red: '#ff1100',
};

const GM = 'Main Settings';
const GS = 'Strength Settings';
const GP = 'Profile Settings';
const GV = 'Value Area Settings';
const GA = 'Appearance';

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Profile Lookback', defval: 200, group: GM, tooltip: 'Number of chart bars used to build the active profiles, absorption zones, and stored intrabar sample. Higher values make the profiles smoother and more historically anchored, but increase calculation load and make zones less reactive. Lower values make the profiles more responsive to recent activity.' },
  { id: 'intragran', type: 'int', title: 'Bar Granularity', defval: 10, min: 1, max: 100, group: GM, tooltip: 'Controls the lower-timeframe sampling depth. The script requests approximately the chart timeframe divided by this value. Higher values request smaller intrabars for more detail, but may increase runtime load and can require seconds data on very low chart timeframes. Lower values are lighter but less granular.' },
  { id: 'allowSeconds', type: 'bool', title: 'Allow Seconds', defval: false, group: GM, tooltip: 'Allows the script to request seconds-based lower timeframes when the calculated granularity requires them. Disable this for accounts or symbols where seconds data may cause runtime errors. When disabled, requests are clamped to one minute or the current seconds chart timeframe.' },
  { id: 'strengthFilter', type: 'int', title: 'Strength Filter', defval: 97, min: 0, max: 100, group: GS, tooltip: 'Percentile threshold used to classify strong buying and selling by absolute intrabar volume. A value of 97 means only the top 3% of intrabar volume samples are considered strong. Higher values make strong bars rarer; lower values include more activity as strong.' },
  { id: 'strongOnly', type: 'bool', title: 'Strong Only', defval: false, group: GS, tooltip: 'When enabled, the volume profile hides weak buy and weak sell segments and normalizes only strong buying and strong selling. When disabled, the profile displays all four segments: strong buy, weak buy, weak sell, and strong sell.' },
  { id: 'profileBins', type: 'int', title: 'Profile Resolution', defval: 35, min: 2, max: 70, group: GP, tooltip: 'Number of vertical price bins used for the volume, delta, absorption, and heatmap calculations. Higher values create finer price detail but use more boxes and increase visual/object load. Lower values create broader, smoother zones.' },
  { id: 'profileWidth', type: 'int', title: 'Profile Width', defval: 100, min: 1, max: 450, group: GP, tooltip: 'Maximum horizontal width of the volume and absorption profiles measured in bars. Higher values make the profiles longer and easier to compare. Lower values make the profiles more compact.' },
  { id: 'profileOffset', type: 'int', title: 'Profile Offset', defval: 120, min: 0, max: 550, group: GP, tooltip: 'Horizontal offset, in bars, between the current bar and the right edge of the volume profile. Higher values push the live profile further into the future/right side of the chart. Lower values keep it closer to price.' },
  { id: 'detectValueArea', type: 'bool', title: 'Detect Value Area', defval: false, group: GV, tooltip: 'Enables value-area detection on the active volume and absorption profiles. Value-area bins reduce transparency by 25 points for a brighter appearance. Non-value-area bins are faded by 30 points, and volume-profile segments outside the value area are flattened to a shared transparency so strong and weak bars have minimal contrast.' },
  { id: 'valueAreaPercent', type: 'int', title: 'Value Area Percent', defval: 30, min: 1, max: 99, group: GV, tooltip: 'Target share of active profile volume used to build the value area. The range is 1 to 99. The calculation starts from the highest-volume bin and expands outward to adjacent higher-volume candidates until the target percentage is reached. Default is 30%.' },
  { id: 'showVolumeProfile', type: 'bool', title: 'Show Volume Profile', defval: true, group: GA, tooltip: 'Toggles the stacked buy/sell volume profile. This controls the main horizontal profile made of strong buy, weak buy, weak sell, and strong sell segments.' },
  { id: 'showDeltaProfile', type: 'bool', title: 'Show Delta Profile', defval: true, group: GA, tooltip: 'Toggles the delta heatmap next to the volume profile. Delta is calculated per price bin as total buy volume minus total sell volume, with cell text showing the signed delta value.' },
  { id: 'showAbsorptionProfile', type: 'bool', title: 'Show Absorption Profile', defval: true, group: GA, tooltip: 'Toggles the absorption profile next to the delta heatmap. Absorption is calculated from bullish volume in upper wicks and bearish volume in lower wicks, then aggregated by price bin.' },
  { id: 'showLevels', type: 'bool', title: 'Show Levels', defval: true, group: GA, tooltip: 'Toggles absorption-derived support/resistance zones. Zones are drawn when an absorption bin is higher than both neighboring absorption bins, highlighting local absorption peaks across the lookback range.' },
  { id: 'showBubbles', type: 'bool', title: 'Show Bubbles', defval: false, group: GA, tooltip: 'Toggles strong buy/sell bubbles on chart bars. Bubbles are plotted at the price of the strongest qualifying intrabar volume and scale by percentile tier above the Strength Filter.' },
  { id: 'showAbsorptionHeatmap', type: 'bool', title: 'Show Absorption Heatmap', defval: false, group: GA, tooltip: 'Toggles the historical absorption heatmap. Every 5 bars, the script creates a past-5-bar heatmap snapshot from the current absorption profile and leaves it on the chart until the box limit removes older boxes.' },
  { id: 'green', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: GA, tooltip: 'Color used for bullish/positive elements, including buy volume, positive delta, and the middle of the absorption heatmap gradient.' },
  { id: 'red', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: GA, tooltip: 'Color used for bearish/negative elements, including sell volume and negative delta.' },
];

export const plotConfig: PlotConfig[] = [];

const TIERS = ['small', 'normal', 'large', 'huge'] as const;
const BUBBLE_GREEN = String(color.new('#00ffbb', 90));
const BUBBLE_RED = String(color.new('#ff1100', 90));

export const shapeConfig: ShapeConfig[] = [
  ...TIERS.map((size, k) => ({
    id: `char${k}`, kind: 'char' as const, title: `Strong Buying Tier ${k + 1}`, char: '●', location: 'absolute' as const,
    color: BUBBLE_GREEN, size,
  })),
  ...TIERS.map((size, k) => ({
    id: `char${k + 4}`, kind: 'char' as const, title: `Strong Selling Tier ${k + 1}`, char: '●', location: 'absolute' as const,
    color: BUBBLE_RED, size,
  })),
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Strong Buying', message: '' },
  { id: 'alert1', title: 'Strong Selling', message: '' },
  { id: 'alert2', title: 'Value Area Touch', message: '' },
  { id: 'alert3', title: 'Bullish Delta Dominance', message: '' },
  { id: 'alert4', title: 'Bearish Delta Dominance', message: '' },
  { id: 'alert5', title: 'Absorption Level Touch', message: '' },
];

export const metadata = {
  title: 'Whale Liquidity and Absorption Profile [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - 🐳 Liquidity & Absorption',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** The lower timeframe of the original and its row limit */
function lowerTimeframeOf(chartTf: string, cfg: WhaleLiquidityAndAbsorptionProfileInputs) {
  const chartTfSeconds = timeframe.in_seconds(chartTf);
  const targetTfSeconds = Math.max(1, Math.trunc((chartTfSeconds * 1.0) / cfg.intragran));
  const useChartTf = !cfg.allowSeconds && chartTf.endsWith('S');
  const tfSeconds = useChartTf ? chartTfSeconds : cfg.allowSeconds ? targetTfSeconds : Math.max(60, targetTfSeconds);
  const tf = useChartTf ? chartTf : timeframe.from_seconds(tfSeconds);
  const rowLimit = cfg.lookback * Math.max(1, Math.trunc(Math.ceil(chartTfSeconds / tfSeconds)));
  return { tf, rowLimit, sameAsChart: timeframe.in_seconds(tf) === chartTfSeconds };
}

/** Bars the indicator needs: the chart symbol on the lower timeframe (none when it is the chart timeframe). */
export function requiredSymbols(
  inputs: Partial<WhaleLiquidityAndAbsorptionProfileInputs> = {},
  chart?: ChartContext,
): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  if (chartTf === '') return [];
  const { tf, sameAsChart } = lowerTimeframeOf(chartTf, cfg);
  return sameAsChart ? [] : [{ symbol: tickeridOf(chart), timeframe: tf }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<WhaleLiquidityAndAbsorptionProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; boxes: BoxData[]; labels: LabelData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const bins = Math.trunc(cfg.profileBins);
  const mintick = mintickOf(chart);
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  resetDrawings({ line: 50, box: 500, label: 20 });

  // ---- lower timeframe bars (request.security_lower_tf of the chart symbol)
  const chartTf = chartTimeframe(bars, chart) || '1D';
  const { tf, rowLimit, sameAsChart } = lowerTimeframeOf(chartTf, cfg);
  let intrabars: (i: number) => Bar[];
  if (n > 0 && !sameAsChart) {
    const [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: tf }], chart);
    const merge = otherSymbolChart(bars, chart);
    const ranges = securityLowerTf(bars, ltfBars, tf, merge, { other: { timezone: chart?.timezone, session: chart?.session } });
    intrabars = (i) => ltfBars.slice(ranges[i][0], ranges[i][1]);
  } else {
    intrabars = (i) => [bars[i]];
  }

  const clampTransparency = (t: number) => Math.trunc(Math.max(0, Math.min(100, t)));
  const valueAreaTransparency = (base: number, inVa: boolean) =>
    clampTransparency(base + (cfg.detectValueArea ? (inVa ? -25 : 30) : 0));
  const valueAreaVolumeTransparency = (base: number, inVa: boolean) =>
    (cfg.detectValueArea && !inVa ? valueAreaTransparency(55, false) : valueAreaTransparency(base, inVa));
  const heatmapColor = (norm: number) => {
    const c = Math.max(0.0, Math.min(1.0, norm));
    return le(c, 0.5) ? color.from_gradient(c, 0.0, 0.5, color.rgb(140, 0, 255), cfg.green)
      : color.from_gradient(c, 0.5, 1.0, cfg.green, color.rgb(255, 230, 0));
  };
  const formatDelta = (d: number) => '△' + (ge(d, 0) ? '+' : '-') + str.tostring(Math.abs(d), 'volume');

  // matrix data: rows [dir, volume, close, absorption volume], oldest first (from `head`)
  const rDir: number[] = [];
  const rVol: number[] = [];
  const rClose: number[] = [];
  const rAbs: number[] = [];
  let head = 0;
  const rows = () => rDir.length - head;

  const profile: Box[][] = [[], [], [], [], [], [], []]; // strongBull, weakBull, weakBear, strongBear, delta, absorption, zone
  let volumeProfileLabel: Label | undefined;
  let deltaProfileLabel: Label | undefined;
  let absorptionProfileLabel: Label | undefined;

  const markers: MarkerData[] = [];
  const flags: boolean[][] = [[], [], [], [], [], []];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const isLast = i === n - 1;
    const confirmed = !isLast || lastConfirmed;
    const upperWickBase = Math.max(b.open, b.close);
    const lowerWickBase = Math.min(b.open, b.close);
    const hasUpperWick = gt(b.high, upperWickBase);
    const hasLowerWick = lt(b.low, lowerWickBase);
    const ib = intrabars(i);
    const dir_ = ib.map((x) => (gt(x.close, x.open) ? 1 : -1));
    const vol_ = ib.map((x) => x.volume ?? NaN);
    const close_ = ib.map((x) => x.close);

    if (confirmed && dir_.length > 0) {
      for (let k = 0; k < dir_.length; k++) {
        const rowDir = dir_[k];
        const rowClose = close_[k];
        const isAbs = (rowDir > 0 && hasUpperWick && ge(rowClose, upperWickBase) && le(rowClose, b.high))
          || (rowDir < 0 && hasLowerWick && le(rowClose, lowerWickBase) && ge(rowClose, b.low));
        rDir.push(rowDir);
        rVol.push(vol_[k]);
        rClose.push(rowClose);
        rAbs.push(isAbs ? vol_[k] : 0.0);
      }
    }
    while (rows() > rowLimit) head++;
    if (head > 50000) {
      rDir.splice(0, head);
      rVol.splice(0, head);
      rClose.splice(0, head);
      rAbs.splice(0, head);
      head = 0;
    }

    // historical absorption heatmap, every 5 bars
    if (cfg.showAbsorptionHeatmap && confirmed && i % 5 === 0 && rows() > 0) {
      let minP = rClose[head];
      let maxP = rClose[head];
      for (let r = head; r < rDir.length; r++) {
        minP = Math.min(minP, rClose[r]);
        maxP = Math.max(maxP, rClose[r]);
      }
      const step = Math.max(maxP - minP, mintick) / bins;
      const hb = new Array<number>(bins).fill(0.0);
      for (let r = head; r < rDir.length; r++) {
        let k = Math.trunc(Math.floor((rClose[r] - minP) / step));
        k = Math.max(0, Math.min(bins - 1, k));
        if (gt(rAbs[r], 0)) hb[k] = hb[k] + rAbs[r];
      }
      let maxV = 0.0;
      for (let k = 0; k < bins; k++) maxV = Math.max(maxV, hb[k]);
      if (gt(maxV, 0)) {
        for (let k = 0; k < bins; k++) {
          const binBottom = minP + step * k;
          const binTop = minP + step * (k + 1);
          let touched = false;
          for (let off = 0; off <= 4; off++) {
            const j = i - off;
            if (j >= 0) touched = touched || (le(binBottom, bars[j].high) && ge(binTop, bars[j].low));
          }
          if (gt(hb[k], 0) && !touched) {
            box.new(i - 5, binTop, i, binBottom, 'transparent', undefined, undefined, undefined, undefined,
              color.new(heatmapColor(hb[k] / maxV), 33));
          }
        }
      }
    }

    // strength thresholds: percentiles of the row volumes
    let strengthThreshold = NaN;
    let th2 = NaN;
    let th3 = NaN;
    let th4 = NaN;
    if (rows() > 0 && (dir_.length > 0 || isLast)) {
      const sorted = Float64Array.from(rVol.slice(head)).sort();
      const size = sorted.length;
      const span = 100.0 - cfg.strengthFilter;
      const idx = (pct: number) => Math.min(size - 1, Math.max(0, Math.trunc(Math.floor((size * pct) / 100.0))));
      strengthThreshold = sorted[idx(cfg.strengthFilter)];
      th2 = sorted[idx(cfg.strengthFilter + span * 0.25)];
      th3 = sorted[idx(cfg.strengthFilter + span * 0.5)];
      th4 = sorted[idx(cfg.strengthFilter + span * 0.75)];
    }

    // strongest lower bar of each tier
    const buyPrice = [NaN, NaN, NaN, NaN];
    const sellPrice = [NaN, NaN, NaN, NaN];
    const buyMax = [0.0, 0.0, 0.0, 0.0];
    const sellMax = [0.0, 0.0, 0.0, 0.0];
    if (!isNaN(strengthThreshold) && dir_.length > 0) {
      for (let k = 0; k < dir_.length; k++) {
        const v = vol_[k];
        if (!ge(v, strengthThreshold)) continue;
        const tier = ge(v, th4) ? 4 : ge(v, th3) ? 3 : ge(v, th2) ? 2 : 1;
        const maxArr = dir_[k] > 0 ? buyMax : sellMax;
        const priceArr = dir_[k] > 0 ? buyPrice : sellPrice;
        if (gt(v, maxArr[tier - 1])) {
          maxArr[tier - 1] = v;
          priceArr[tier - 1] = close_[k];
        }
      }
    }

    // profile boxes, made on the first bar
    if (profile[0].length === 0) {
      for (let k = 0; k < bins; k++) {
        for (const arr of profile) arr.push(box.new(i, b.close, i, b.close, 'transparent', undefined, undefined, undefined, undefined, 'transparent'));
      }
    }

    let valueAreaTouchAlert = false;
    let absorptionLevelTouchAlert = false;
    let bullishDeltaDominanceAlert = false;
    let bearishDeltaDominanceAlert = false;

    if (isLast && rows() > 0 && profile.every((arr) => arr.length === bins)) {
      let minPrice = rClose[head];
      let maxPrice = rClose[head];
      for (let r = head; r < rDir.length; r++) {
        minPrice = Math.min(minPrice, rClose[r]);
        maxPrice = Math.max(maxPrice, rClose[r]);
      }
      const priceRange = Math.max(maxPrice - minPrice, mintick);
      const step = priceRange / bins;
      const strongBullBins = new Array<number>(bins).fill(0.0);
      const weakBullBins = new Array<number>(bins).fill(0.0);
      const weakBearBins = new Array<number>(bins).fill(0.0);
      const strongBearBins = new Array<number>(bins).fill(0.0);
      const absorptionBins = new Array<number>(bins).fill(0.0);
      const profileVolumeBins = new Array<number>(bins).fill(0.0);
      for (let r = head; r < rDir.length; r++) {
        const isStrong = ge(rVol[r], strengthThreshold);
        let k = Math.trunc(Math.floor((rClose[r] - minPrice) / step));
        k = Math.max(0, Math.min(bins - 1, k));
        if (rDir[r] > 0 && isStrong) strongBullBins[k] += rVol[r];
        else if (rDir[r] > 0) weakBullBins[k] += rVol[r];
        else if (isStrong) strongBearBins[k] += rVol[r];
        else weakBearBins[k] += rVol[r];
        if (gt(rAbs[r], 0)) absorptionBins[k] += rAbs[r];
      }

      let maxBinVolume = 0.0;
      let maxAbsDelta = 0.0;
      let maxAbsorptionVolume = 0.0;
      let totalProfileVolume = 0.0;
      let pocVolume = 0.0;
      let pocIndex = 0;
      for (let k = 0; k < bins; k++) {
        const binVolume = cfg.strongOnly ? strongBullBins[k] + strongBearBins[k]
          : strongBullBins[k] + weakBullBins[k] + weakBearBins[k] + strongBearBins[k];
        const deltaScan = (strongBullBins[k] + weakBullBins[k]) - (strongBearBins[k] + weakBearBins[k]);
        profileVolumeBins[k] = binVolume;
        totalProfileVolume += binVolume;
        if (gt(binVolume, pocVolume)) {
          pocVolume = binVolume;
          pocIndex = k;
        }
        maxBinVolume = Math.max(maxBinVolume, binVolume);
        maxAbsDelta = Math.max(maxAbsDelta, Math.abs(deltaScan));
        maxAbsorptionVolume = Math.max(maxAbsorptionVolume, absorptionBins[k]);
      }

      const valueAreaBins = new Array<boolean>(bins).fill(false);
      if (cfg.detectValueArea && gt(totalProfileVolume, 0)) {
        const target = (totalProfileVolume * cfg.valueAreaPercent) / 100.0;
        let acc = profileVolumeBins[pocIndex];
        let lower = pocIndex;
        let upper = pocIndex;
        valueAreaBins[pocIndex] = true;
        while (lt(acc, target) && (lower > 0 || upper < bins - 1)) {
          const lowerCand = lower > 0 ? profileVolumeBins[lower - 1] : -1.0;
          const upperCand = upper < bins - 1 ? profileVolumeBins[upper + 1] : -1.0;
          if (ge(upperCand, lowerCand)) {
            upper += 1;
            acc += upperCand;
            valueAreaBins[upper] = true;
          } else {
            lower -= 1;
            acc += lowerCand;
            valueAreaBins[lower] = true;
          }
        }
      }

      const profileRight = i + cfg.profileOffset;
      const deltaWidth = Math.max(1, Math.trunc(Math.round(cfg.profileWidth / 10.0)));
      const deltaLeft = profileRight + 1;
      const deltaRight = deltaLeft + deltaWidth;
      const absorptionProfileWidth = cfg.profileWidth;
      const absorptionLeft = deltaRight + 1;
      const volumeLabelX = Math.trunc(Math.round(profileRight - cfg.profileWidth * 0.5));
      const deltaLabelX = Math.trunc(Math.round((deltaLeft + deltaRight) * 0.5));
      const absorptionLabelX = Math.trunc(Math.round(absorptionLeft + absorptionProfileWidth * 0.5));
      const labelY = maxPrice + priceRange * 0.05;
      const textOf = (show: boolean) => (show ? fg : color.new(fg, 100));
      const bgOf = (show: boolean) => (show ? bg : color.new(bg, 100));
      const header = (lbl: Label | undefined, x: number, show: boolean, text: string): Label => {
        if (!lbl) {
          return label.new(x, labelY, show ? text : '', 'bar_index', 'price', bgOf(show), 'label_down', textOf(show), 'small');
        }
        label.set_x(lbl, x);
        label.set_y(lbl, labelY);
        label.set_text(lbl, show ? text : '');
        label.set_textcolor(lbl, textOf(show));
        label.set_color(lbl, bgOf(show));
        return lbl;
      };
      volumeProfileLabel = header(volumeProfileLabel, volumeLabelX, cfg.showVolumeProfile, 'Volume Profile');
      deltaProfileLabel = header(deltaProfileLabel, deltaLabelX, cfg.showDeltaProfile, 'Delta');
      absorptionProfileLabel = header(absorptionProfileLabel, absorptionLabelX, cfg.showAbsorptionProfile, 'Absorption Profile');

      const place = (bx: Box, left: number, right: number, top: number, bottom: number) => {
        box.set_left(bx, left);
        box.set_right(bx, right);
        box.set_top(bx, top);
        box.set_bottom(bx, bottom);
      };
      for (let k = 0; k < bins; k++) {
        const binBottom = minPrice + step * k;
        const binTop = minPrice + step * (k + 1);
        const inBin = ge(b.close, binBottom) && le(b.close, binTop);
        const strongBullVolume = strongBullBins[k];
        const weakBullVolume = cfg.strongOnly ? 0.0 : weakBullBins[k];
        const weakBearVolume = cfg.strongOnly ? 0.0 : weakBearBins[k];
        const strongBearVolume = strongBearBins[k];
        const absorptionVolume = absorptionBins[k];
        const totalVolume = strongBullVolume + weakBullVolume + weakBearVolume + strongBearVolume;
        const inValueArea = cfg.detectValueArea && valueAreaBins[k];
        const strongTransparency = valueAreaVolumeTransparency(40, inValueArea);
        const weakTransparency = valueAreaVolumeTransparency(70, inValueArea);
        const absorptionTransparency = valueAreaTransparency(55, inValueArea);
        valueAreaTouchAlert = valueAreaTouchAlert || (inValueArea && inBin);
        const totalLength = gt(maxBinVolume, 0) ? Math.trunc(Math.round((totalVolume / maxBinVolume) * cfg.profileWidth)) : 0;
        const part = (v: number) => (gt(totalVolume, 0) ? Math.trunc(Math.round((totalLength * v) / totalVolume)) : 0);
        const strongBullLength = part(strongBullVolume);
        const weakBullLength = part(weakBullVolume);
        const weakBearLength = part(weakBearVolume);
        const strongBearLength = totalLength - strongBullLength - weakBullLength - weakBearLength;
        const delta = (strongBullVolume + weakBullBins[k]) - (strongBearVolume + weakBearBins[k]);
        const deltaAbs = Math.abs(delta);
        const isDominantDeltaBin = gt(maxAbsDelta, 0) && ge(deltaAbs, maxAbsDelta);
        bullishDeltaDominanceAlert = bullishDeltaDominanceAlert || (inBin && isDominantDeltaBin && gt(delta, 0));
        bearishDeltaDominanceAlert = bearishDeltaDominanceAlert || (inBin && isDominantDeltaBin && lt(delta, 0));
        const deltaTransparency = gt(maxAbsDelta, 0) ? 90 - Math.trunc(Math.round((deltaAbs / maxAbsDelta) * 90.0)) : 90;
        const deltaColor = ge(delta, 0) ? cfg.green : cfg.red;
        const absorptionLength = gt(maxAbsorptionVolume, 0)
          ? Math.trunc(Math.round((absorptionVolume / maxAbsorptionVolume) * absorptionProfileWidth)) : 0;
        const absorptionRight = absorptionLeft + absorptionLength;

        const strongBullRight = profileRight;
        const strongBullLeft = strongBullRight - strongBullLength;
        const weakBullLeft = strongBullLeft - weakBullLength;
        const weakBearLeft = weakBullLeft - weakBearLength;
        const strongBearLeft = weakBearLeft - strongBearLength;

        const segment = (bx: Box, left: number, right: number, show: boolean, col: string, transp: number) => {
          place(bx, left, right, binTop, binBottom);
          box.set_bgcolor(bx, show ? color.new(col, transp) : 'transparent');
          box.set_border_color(bx, show ? color.new(col, 100) : 'transparent');
        };
        segment(profile[0][k], strongBullLeft, strongBullRight, cfg.showVolumeProfile && strongBullLength > 0, cfg.green, strongTransparency);
        segment(profile[1][k], weakBullLeft, strongBullLeft, cfg.showVolumeProfile && !cfg.strongOnly && weakBullLength > 0, cfg.green, weakTransparency);
        segment(profile[2][k], weakBearLeft, weakBullLeft, cfg.showVolumeProfile && !cfg.strongOnly && weakBearLength > 0, cfg.red, weakTransparency);
        segment(profile[3][k], strongBearLeft, weakBearLeft, cfg.showVolumeProfile && strongBearLength > 0, cfg.red, strongTransparency);

        const deltaBox = profile[4][k];
        const showDelta = cfg.showDeltaProfile && gt(deltaAbs, 0);
        place(deltaBox, deltaLeft, deltaRight, binTop, binBottom);
        box.set_bgcolor(deltaBox, showDelta ? color.new(deltaColor, deltaTransparency) : 'transparent');
        box.set_border_color(deltaBox, 'transparent');
        box.set_text(deltaBox, showDelta ? formatDelta(delta) : '');
        box.set_text_color(deltaBox, showDelta ? fg : color.new(fg, 100));
        box.set_text_size(deltaBox, 'tiny');
        box.set_text_halign(deltaBox, 'center');
        box.set_text_valign(deltaBox, 'center');

        segment(profile[5][k], absorptionLeft, absorptionRight, cfg.showAbsorptionProfile && absorptionLength > 0, fg, absorptionTransparency);

        const isPeak = k > 0 && k < bins - 1 && gt(absorptionVolume, absorptionBins[k - 1]) && gt(absorptionVolume, absorptionBins[k + 1]);
        absorptionLevelTouchAlert = absorptionLevelTouchAlert || (isPeak && inBin);
        const zone = profile[6][k];
        place(zone, i - cfg.lookback, i, binTop, binBottom);
        const showZone = cfg.showLevels && isPeak;
        box.set_bgcolor(zone, showZone ? color.new(gt(b.close, (binTop + binBottom) / 2) ? cfg.green : cfg.red, 90) : 'transparent');
        box.set_border_color(zone, showZone ? color.new(fg, 100) : 'transparent');
      }
    }

    // bubbles
    if (cfg.showBubbles) {
      for (let k = 0; k < 4; k++) {
        if (!isNaN(buyPrice[k])) {
          markers.push({ id: `char${k}`, time: b.time, position: 'atPriceMiddle', price: buyPrice[k], shape: 'circle', char: '●', color: String(color.new(cfg.green, 90)), size: TIERS[k] });
        }
      }
      for (let k = 0; k < 4; k++) {
        if (!isNaN(sellPrice[k])) {
          markers.push({ id: `char${k + 4}`, time: b.time, position: 'atPriceMiddle', price: sellPrice[k], shape: 'circle', char: '●', color: String(color.new(cfg.red, 90)), size: TIERS[k] });
        }
      }
    }
    flags[0].push(buyPrice.some((p) => !isNaN(p)));
    flags[1].push(sellPrice.some((p) => !isNaN(p)));
    flags[2].push(valueAreaTouchAlert);
    flags[3].push(bullishDeltaDominanceAlert);
    flags[4].push(bearishDeltaDominanceAlert);
    flags[5].push(absorptionLevelTouchAlert);
  }
  setDrawingBar(null);

  const out = drawingOutputs(bars);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    boxes: out.boxes ?? [],
    labels: out.labels ?? [],
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const WhaleLiquidityAndAbsorptionProfile = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
  requiredSymbols,
};
