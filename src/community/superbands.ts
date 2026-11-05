/**
 * SuperBands
 *
 * Two SuperTrend-like trails, one bullish and one bearish, each with its own ATR (Wilder smoothing of the true range)
 * times a multiplier. The bullish trail follows max(low - atr, trail) and the bearish trail min(high + atr, trail),
 * both smoothed by an EMA of period `smoothing`. A trail is reset and starts again from the current bar when the
 * close crosses its previous value (below for the bullish trail, above for the bearish trail). The colour of a trail
 * is a gradient of the slope of the trail, normalised by an EMA of its absolute changes (angle in degrees * 10 / 9:
 * 0..65 for the bullish trail, -65..0 for the bearish trail). The center line is the mean of the two trails, with the
 * colour of the bullish trail when it rises and of the bearish trail when it falls. Gradient fills run from the
 * bullish trail to the high and from the bearish trail to the low.
 *
 * Reference: "SuperBands" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SuperBandsInputs {
  /** Trail smoothing period of the bullish leg */
  bullSmoothing: number;
  /** ATR length of the bullish trail offset */
  bullAtrPeriod: number;
  /** ATR multiplier of the bullish trail */
  bullMultiplier: number;
  /** Bullish colour (top of the gradient) */
  bullUpColor: string;
  /** Bullish colour (bottom of the gradient) */
  bullDownColor: string;
  /** Transparency of the bullish fill at the trail */
  bullStartAlpha: number;
  /** Transparency of the bullish fill at the high */
  bullEndAlpha: number;
  /** Trail smoothing period of the bearish leg */
  bearSmoothing: number;
  /** ATR length of the bearish trail offset */
  bearAtrPeriod: number;
  /** ATR multiplier of the bearish trail */
  bearMultiplier: number;
  /** Bearish colour (bottom of the gradient) */
  bearDownColor: string;
  /** Bearish colour (top of the gradient) */
  bearUpColor: string;
  /** Transparency of the bearish fill at the trail */
  bearStartAlpha: number;
  /** Transparency of the bearish fill at the low */
  bearEndAlpha: number;
}

export const defaultInputs: SuperBandsInputs = {
  bullSmoothing: 18,
  bullAtrPeriod: 12,
  bullMultiplier: 1,
  bullUpColor: '#26A69A',
  bullDownColor: '#B2DFDB',
  bullStartAlpha: 86,
  bullEndAlpha: 98,
  bearSmoothing: 18,
  bearAtrPeriod: 12,
  bearMultiplier: 1,
  bearDownColor: '#FF5252',
  bearUpColor: '#FFCDD2',
  bearStartAlpha: 86,
  bearEndAlpha: 98,
};

const BULL = 'Bullish Settings';
const BEAR = 'Bearish Settings';

export const inputConfig: InputConfig[] = [
  { id: 'bullSmoothing', type: 'float', title: 'Smoothing', defval: 18, min: 1, step: 0.125, group: BULL,
    tooltip: 'Trail smoothing period for the bullish leg.\nHigher values smooth more but react slower.' },
  { id: 'bullAtrPeriod', type: 'float', title: 'ATR Period', defval: 12, min: 1, step: 0.125, group: BULL,
    tooltip: 'ATR length used to compute the bullish trail offset.' },
  { id: 'bullMultiplier', type: 'float', title: 'Multiplier', defval: 1, min: 0, step: 0.125, group: BULL,
    tooltip: 'Multiplier applied to ATR to size the bullish trail.\nLarger = wider distance from price.' },
  { id: 'bullUpColor', type: 'color', title: 'Color', defval: '#26A69A', inline: 'bull_color_inline', group: BULL,
    tooltip: 'Primary color for bullish up-trend visual.' },
  { id: 'bullDownColor', type: 'color', title: '', defval: '#B2DFDB', inline: 'bull_color_inline', group: BULL },
  { id: 'bullStartAlpha', type: 'int', title: 'BG Alpha', defval: 86, min: 0, max: 100, inline: 'bull_bg_inline', group: BULL },
  { id: 'bullEndAlpha', type: 'int', title: '', defval: 98, min: 0, max: 100, inline: 'bull_bg_inline', group: BULL },
  { id: 'bearSmoothing', type: 'float', title: 'Smoothing', defval: 18, min: 1, step: 0.125, group: BEAR,
    tooltip: 'Trail smoothing period for the bearish leg.\nHigher values smooth more but react slower.' },
  { id: 'bearAtrPeriod', type: 'float', title: 'ATR Period', defval: 12, min: 1, step: 0.125, group: BEAR,
    tooltip: 'ATR length used to compute the bearish trail offset.' },
  { id: 'bearMultiplier', type: 'float', title: 'Multiplier', defval: 1, min: 0, step: 0.125, group: BEAR,
    tooltip: 'Multiplier applied to ATR to size the bearish trail.\nLarger = wider distance from price.' },
  { id: 'bearDownColor', type: 'color', title: 'Color', defval: '#FF5252', inline: 'bear_color_inline', group: BEAR,
    tooltip: 'Primary color for bearish down-trend visual.' },
  { id: 'bearUpColor', type: 'color', title: '', defval: '#FFCDD2', inline: 'bear_color_inline', group: BEAR },
  { id: 'bearStartAlpha', type: 'int', title: 'BG Alpha', defval: 86, min: 0, max: 100, inline: 'bear_bg_inline', group: BEAR },
  { id: 'bearEndAlpha', type: 'int', title: '', defval: 98, min: 0, max: 100, inline: 'bear_bg_inline', group: BEAR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Center', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Up Trend', color: String(color.new('#26A69A', 80)), lineWidth: 4, style: 'linebr' },
  { id: 'plot2', title: 'Down Trend', color: String(color.new('#FF5252', 80)), lineWidth: 4, style: 'linebr' },
  { id: 'plot3', title: 'Up Trend', color: String(color.new('#26A69A', 60)), lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Down Trend', color: String(color.new('#FF5252', 60)), lineWidth: 2, style: 'linebr' },
  { id: 'plot5', title: 'Up Trend', color: String(color.new('#26A69A', 5)), lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Down Trend', color: String(color.new('#FF5252', 5)), lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'High', color: '#0000001a', lineWidth: 1, style: 'linebr', display: 'pane' },
  { id: 'plot8', title: 'Low', color: '#0000001a', lineWidth: 1, style: 'linebr', display: 'pane' },
];

export const metadata = {
  title: 'SuperBands',
  shortTitle: 'SuperBands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Direction = 'up' | 'down' | 'nan';
/** Pine colour; null = na */
type PineColor = string | null;

/** color.from_gradient: na when the value is na */
const gradient = (v: number, lo: number, hi: number, cLo: PineColor, cHi: PineColor): PineColor =>
  (isNaN(v) ? null : color.from_gradient(v, lo, hi, cLo as string, cHi as string));
/** color.new(c, t): color.new(na, t) is black with transparency t */
const withTransp = (c: PineColor, t: number): string => String(color.new((c ?? '#000000') as string, t));

/**
 * superbands(direction, atr_period, multiplier, smoothing, color_lo, color_hi): trail price and colour of one leg
 * (its own `var` SuperTrend object, ATR and trend_atr state), one bar at a time. A class so that a live run can copy
 * its state at the end of the last confirmed bar.
 */
class Leg {
  // var SuperTrend trend = SuperTrend.new()
  stDirection: Direction = 'nan';
  stLastDirection: Direction = 'nan';
  current = NaN;
  last = NaN;
  active = false;
  trendAtr = 0; // var float trend_atr = 0
  rma = NaN;
  /** The trail price and colour of the last bar calculated */
  price = NaN;
  col: PineColor = null;

  constructor(
    private readonly direction: 'up' | 'down', private readonly atrPeriod: number, private readonly multiplier: number,
    private readonly smoothing: number, private readonly colorLo: string, private readonly colorHi: string,
  ) {}

  clone(): Leg {
    return Object.assign(new Leg(this.direction, this.atrPeriod, this.multiplier, this.smoothing, this.colorLo, this.colorHi), this);
  }

  step(bars: Bar[], i: number): void {
    const { direction, atrPeriod, multiplier, smoothing, colorLo, colorHi } = this;
    const alphaT = 2 / (smoothing * 2 + 1);
    const betaT = 1 - alphaT;
    // rma(tr(), atr_period): var float rma = nz(source); rma := source * beta + nz(rma[1], rma) * alpha
    const rmaBeta = 1 / atrPeriod;
    const rmaAlpha = 1 - rmaBeta;
    const gradMin = direction === 'up' ? 0 : -65;
    const gradMax = direction === 'up' ? 65 : 0;
    const stAlpha = 2 / (1 + smoothing);
    const stBeta = 1 - stAlpha;

    const { high, low, open, close } = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const tr = Math.max(
      high - low,
      Math.abs(high - (isNaN(prevClose) ? Math.max(open, close) : prevClose)),
      Math.abs(low - (isNaN(prevClose) ? Math.min(open, close) : prevClose)),
    );
    if (i === 0) this.rma = isNaN(tr) ? 0 : tr;
    this.rma = tr * rmaBeta + this.rma * rmaAlpha;
    const legAtr = this.rma * multiplier;

    // update_state(direction)
    if (this.active && this.stDirection === direction) {
      const ref = isNaN(this.last) ? close : this.last;
      this.active = direction === 'up' ? !lt(close, ref) : !gt(close, ref);
      if (!this.active) {
        // reset()
        this.stDirection = 'nan';
        this.last = NaN;
        this.current = NaN;
      }
    }
    // update_last_direction()
    this.stLastDirection = this.stDirection;
    // update_direction(direction)
    if (!this.active) this.stDirection = direction;
    // check_new()
    if (this.stLastDirection !== this.stDirection && !this.active) this.active = true;
    // add_new_point(atr, period)
    const current = this.current;
    if (this.active) {
      let trend = this.stDirection === 'up'
        ? Math.max(low - legAtr, isNaN(current) ? low - legAtr : current)
        : this.stDirection === 'down'
          ? Math.min(high + legAtr, isNaN(current) ? high + legAtr : current)
          : NaN;
      trend = trend * stAlpha + (isNaN(current) ? trend : current) * stBeta;
      this.last = isNaN(current) ? trend : current;
      this.current = trend;
    }

    const delta = this.current - this.last;
    if (!isNaN(delta)) this.trendAtr = Math.abs(delta) * alphaT + this.trendAtr * betaT;
    // to_oscilator(fixnan(nz(delta)), trend_atr): x / 0 is na
    const d = isNaN(delta) ? 0 : delta;
    const angle = this.trendAtr === 0 ? NaN : ((Math.atan(d / this.trendAtr) * 180) / Math.PI) * (10 / 9);
    this.col = gradient(angle, gradMin, gradMax, colorLo, colorHi);
    this.price = this.current;
  }
}

type Point = { time: number; value: number; color?: string };

interface SuperBandsVars {
  up: Leg;
  down: Leg;
}

interface SuperBandsRun extends BarRunState<SuperBandsVars> {
  center: number[];
  plots: Point[][];
  upTop: number[];
  upBottom: number[];
  upTopColor: string[];
  upBottomColor: string[];
  downTop: number[];
  downBottom: number[];
  downTopColor: string[];
  downBottomColor: string[];
}

function study(inputs: Partial<SuperBandsInputs>): BarStudy<SuperBandsRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const shadow = '#0000001a';
  return {
    init() {
      const s: SuperBandsRun = {
        center: [], plots: Array.from({ length: 9 }, () => []),
        upTop: [], upBottom: [], upTopColor: [], upBottomColor: [],
        downTop: [], downBottom: [], downTopColor: [], downBottomColor: [],
        steps: [],
        vars: {
          up: new Leg('up', cfg.bullAtrPeriod, cfg.bullMultiplier, cfg.bullSmoothing, cfg.bullDownColor, cfg.bullUpColor),
          down: new Leg('down', cfg.bearAtrPeriod, cfg.bearMultiplier, cfg.bearSmoothing, cfg.bearDownColor, cfg.bearUpColor),
        },
        lists: [], series: [],
      };
      s.series = [
        s.center, ...s.plots, s.upTop, s.upBottom, s.upTopColor, s.upBottomColor, s.downTop, s.downBottom,
        s.downTopColor, s.downBottomColor,
      ];
      return s;
    },
    copyVars: (v) => ({ up: v.up.clone(), down: v.down.clone() }),
    bar(s, i, bars) {
      const { up, down } = s.vars;
      up.step(bars, i);
      down.step(bars, i);
      const b = bars[i];
      const time = b.time;

      const center = (up.price + down.price) / 2;
      s.center[i] = center;
      const prev = i > 0 && !isNaN(s.center[i - 1]) ? s.center[i - 1] : center;
      const centerDelta = center - prev;
      const centerColor = gt(centerDelta, 0) ? up.col
        : lt(centerDelta, 0) ? down.col
          : gradient(0.5, 0, 1, down.col, up.col);

      const hl2 = (b.high + b.low) / 2;
      const p = s.plots;
      p[0][i] = { time, value: center, color: centerColor ?? 'transparent' };
      p[1][i] = { time, value: up.price, color: withTransp(up.col, 80) };
      p[2][i] = { time, value: down.price, color: withTransp(down.col, 80) };
      p[3][i] = { time, value: up.price, color: withTransp(up.col, 60) };
      p[4][i] = { time, value: down.price, color: withTransp(down.col, 60) };
      p[5][i] = { time, value: up.price, color: withTransp(up.col, 5) };
      p[6][i] = { time, value: down.price, color: withTransp(down.col, 5) };
      // plot(not na(down_price) ? hl2 : na, "High", ...), plot(not na(up_price) ? hl2 : na, "Low", ...)
      p[7][i] = { time, value: isNaN(down.price) ? NaN : hl2, color: shadow };
      p[8][i] = { time, value: isNaN(up.price) ? NaN : hl2, color: shadow };

      // fill(up_p, low_p, high, up_price, color.new(bull_up_color, bull_end_alpha), color.new(up_trend_color, bull_start_alpha))
      s.upTop[i] = b.high;
      s.upBottom[i] = up.price;
      s.upTopColor[i] = withTransp(cfg.bullUpColor, cfg.bullEndAlpha);
      s.upBottomColor[i] = withTransp(up.col, cfg.bullStartAlpha);
      // fill(down_p, high_p, down_price, low, color.new(down_trend_color, bear_start_alpha), color.new(bear_down_color, bear_end_alpha))
      s.downTop[i] = down.price;
      s.downBottom[i] = b.low;
      s.downTopColor[i] = withTransp(down.col, cfg.bearStartAlpha);
      s.downBottomColor[i] = withTransp(cfg.bearDownColor, cfg.bearEndAlpha);
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(), plot7: p[7].slice(), plot8: p[8].slice(),
        },
        fills: [
          {
            plot1: 'plot5', plot2: 'plot8',
            gradient: {
              topValue: s.upTop.slice(), bottomValue: s.upBottom.slice(),
              topColor: s.upTopColor.slice(), bottomColor: s.upBottomColor.slice(),
            },
          },
          {
            plot1: 'plot6', plot2: 'plot7',
            gradient: {
              topValue: s.downTop.slice(), bottomValue: s.downBottom.slice(),
              topColor: s.downTopColor.slice(), bottomColor: s.downBottomColor.slice(),
            },
          },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuperBandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SuperBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
