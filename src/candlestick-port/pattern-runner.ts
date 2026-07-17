/**
 * Generic runner that turns a PatternDef into the declarations one official
 * candlestick .pine script makes: the trend input, the label-color input,
 * an alertcondition, a label marker (plotshape) and the background highlight
 * over the candles forming the pattern (bgcolor with negative offset).
 */
import { indicator, alertcondition, plotshape, bgcolor, input, ta, color, Series } from 'oakscriptjs/script';
import { candleProps, trendInputs, noTrend, type CandleProps, type TrendFlags } from './candle-props';

export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

export interface PatternDef {
  /** Indicator title, matches the original .pine file name (without extension). */
  name: string;
  /** PineScript shorttitle. */
  shortName: string;
  direction: PatternDirection;
  /** Label text shown on the marker (e.g. 'BE'). */
  labelText: string;
  /** Number of candles forming the pattern (span of the background highlight). */
  candles: number;
  /** Whether the original script declares the trend detection input. */
  needsTrend: boolean;
  /** Original TradingView tooltip text. */
  tooltip: string;
  /** Detection condition: truthy (1) on the last bar of the pattern. */
  detect(c: CandleProps, t: TrendFlags): Series;
}

interface DirectionStyle {
  base: string;
  inputTitle: string;
  style: 'labelup' | 'labeldown';
  location: 'belowbar' | 'abovebar';
}

const DIRECTION_STYLE: Record<PatternDirection, DirectionStyle> = {
  bullish: { base: color.blue, inputTitle: 'Label Color Bullish', style: 'labelup', location: 'belowbar' },
  bearish: { base: color.red, inputTitle: 'Label Color Bearish', style: 'labeldown', location: 'abovebar' },
  neutral: { base: color.gray, inputTitle: 'Label Color Neutral', style: 'labelup', location: 'belowbar' },
};

/** Emits alert + label marker + background highlight for a detected pattern. */
export function emitPattern(def: PatternDef, cond: Series, labelColor: string): void {
  alertcondition(cond, 'New pattern detected', `New ${def.name} pattern detected`);
  const s = DIRECTION_STYLE[def.direction];
  plotshape(cond, def.name, {
    style: s.style,
    location: s.location,
    color: labelColor,
    text: def.labelText,
    textcolor: color.white,
    tooltip: def.tooltip,
  });
  // bgcolor(ta.highest(cond?1:0, N) != 0 ? color.new(base, 90) : na, offset=-(N-1))
  // .gt(0) instead of != 0 so the NaN warm-up bars of highest() stay uncolored.
  const highlight = color.new(s.base, 90) as string;
  bgcolor(color.when(ta.highest(cond, def.candles).gt(0), highlight), {
    offset: -(def.candles - 1),
  });
}

/** Full script body for a single-pattern indicator (mirrors one .pine file). */
export function patternScript(def: PatternDef): void {
  indicator(def.name, { shorttitle: def.shortName, overlay: true });
  const trend = def.needsTrend ? trendInputs() : noTrend();
  const props = candleProps();
  const s = DIRECTION_STYLE[def.direction];
  const labelColor = input.color(s.base, s.inputTitle);
  emitPattern(def, def.detect(props, trend), labelColor);
}
