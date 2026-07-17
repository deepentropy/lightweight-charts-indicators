/**
 * Registry of all 44 ported candlestick patterns (the 45th official script,
 * "_All Candlestick Patterns_", is the composite in all-patterns.ts).
 */
import type { PatternDef } from './pattern-runner';

import { abandonedBabyBearish } from './patterns/abandoned-baby-bearish';
import { abandonedBabyBullish } from './patterns/abandoned-baby-bullish';
import { darkCloudCoverBearish } from './patterns/dark-cloud-cover-bearish';
import { doji } from './patterns/doji';
import { dojiStarBearish } from './patterns/doji-star-bearish';
import { dojiStarBullish } from './patterns/doji-star-bullish';
import { downsideTasukiGapBearish } from './patterns/downside-tasuki-gap-bearish';
import { dragonflyDojiBullish } from './patterns/dragonfly-doji-bullish';
import { engulfingBearish } from './patterns/engulfing-bearish';
import { engulfingBullish } from './patterns/engulfing-bullish';
import { eveningDojiStarBearish } from './patterns/evening-doji-star-bearish';
import { eveningStarBearish } from './patterns/evening-star-bearish';
import { fallingThreeMethodsBearish } from './patterns/falling-three-methods-bearish';
import { fallingWindowBearish } from './patterns/falling-window-bearish';
import { gravestoneDojiBearish } from './patterns/gravestone-doji-bearish';
import { hammerBullish } from './patterns/hammer-bullish';
import { hangingManBearish } from './patterns/hanging-man-bearish';
import { haramiBearish } from './patterns/harami-bearish';
import { haramiBullish } from './patterns/harami-bullish';
import { haramiCrossBearish } from './patterns/harami-cross-bearish';
import { haramiCrossBullish } from './patterns/harami-cross-bullish';
import { invertedHammerBullish } from './patterns/inverted-hammer-bullish';
import { kickingBearish } from './patterns/kicking-bearish';
import { kickingBullish } from './patterns/kicking-bullish';
import { longLowerShadowBullish } from './patterns/long-lower-shadow-bullish';
import { longUpperShadowBearish } from './patterns/long-upper-shadow-bearish';
import { marubozuBlackBearish } from './patterns/marubozu-black-bearish';
import { marubozuWhiteBullish } from './patterns/marubozu-white-bullish';
import { morningDojiStarBullish } from './patterns/morning-doji-star-bullish';
import { morningStarBullish } from './patterns/morning-star-bullish';
import { onNeckBearish } from './patterns/on-neck-bearish';
import { piercingBullish } from './patterns/piercing-bullish';
import { risingThreeMethodsBullish } from './patterns/rising-three-methods-bullish';
import { risingWindowBullish } from './patterns/rising-window-bullish';
import { shootingStarBearish } from './patterns/shooting-star-bearish';
import { spinningTopBlack } from './patterns/spinning-top-black';
import { spinningTopWhite } from './patterns/spinning-top-white';
import { threeBlackCrowsBearish } from './patterns/three-black-crows-bearish';
import { threeWhiteSoldiersBullish } from './patterns/three-white-soldiers-bullish';
import { triStarBearish } from './patterns/tri-star-bearish';
import { triStarBullish } from './patterns/tri-star-bullish';
import { tweezerBottomBullish } from './patterns/tweezer-bottom-bullish';
import { tweezerTopBearish } from './patterns/tweezer-top-bearish';
import { upsideTasukiGapBullish } from './patterns/upside-tasuki-gap-bullish';

export const ALL_PATTERNS: readonly PatternDef[] = [
  abandonedBabyBearish,
  abandonedBabyBullish,
  darkCloudCoverBearish,
  doji,
  dojiStarBearish,
  dojiStarBullish,
  downsideTasukiGapBearish,
  dragonflyDojiBullish,
  engulfingBearish,
  engulfingBullish,
  eveningDojiStarBearish,
  eveningStarBearish,
  fallingThreeMethodsBearish,
  fallingWindowBearish,
  gravestoneDojiBearish,
  hammerBullish,
  hangingManBearish,
  haramiBearish,
  haramiBullish,
  haramiCrossBearish,
  haramiCrossBullish,
  invertedHammerBullish,
  kickingBearish,
  kickingBullish,
  longLowerShadowBullish,
  longUpperShadowBearish,
  marubozuBlackBearish,
  marubozuWhiteBullish,
  morningDojiStarBullish,
  morningStarBullish,
  onNeckBearish,
  piercingBullish,
  risingThreeMethodsBullish,
  risingWindowBullish,
  shootingStarBearish,
  spinningTopBlack,
  spinningTopWhite,
  threeBlackCrowsBearish,
  threeWhiteSoldiersBullish,
  triStarBearish,
  triStarBullish,
  tweezerBottomBullish,
  tweezerTopBearish,
  upsideTasukiGapBullish,
];

/** Look up a pattern by its indicator title (e.g. 'Engulfing - Bullish'). */
export function getPattern(name: string): PatternDef | undefined {
  return ALL_PATTERNS.find((p) => p.name === name);
}
