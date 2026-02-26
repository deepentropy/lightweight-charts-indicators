/**
 * lightweight-charts-indicators
 *
 * Optimized technical indicators built with OakScriptJS for use with lightweight-charts.
 *
 * These indicators are hand-optimized versions that leverage the oakscriptjs
 * library for better performance and more idiomatic TypeScript code.
 */

import type { Bar, InputConfig, PlotConfig, HLineConfig, FillConfig } from 'oakscriptjs';
export type { InputConfig, PlotConfig, HLineConfig, FillConfig } from 'oakscriptjs';

// SMA - Simple Moving Average
import * as smaIndicator from './standard/sma';
export { SMA, calculate as calculateSMA } from './standard/sma';
export type { SMAInputs } from './standard/sma';

// ADR - Average Day Range
import * as adrIndicator from './standard/adr';
export { ADR, calculate as calculateADR } from './standard/adr';
export type { ADRInputs } from './standard/adr';

// ALMA - Arnaud Legoux Moving Average
import * as almaIndicator from './standard/alma';
export { ALMA, calculate as calculateALMA } from './standard/alma';
export type { ALMAInputs } from './standard/alma';

// ATR - Average True Range
import * as atrIndicator from './standard/atr';
export { ATR, calculate as calculateATR } from './standard/atr';
export type { ATRInputs } from './standard/atr';

// BB - Bollinger Bands
import * as bbIndicator from './standard/bb';
export { BollingerBands, calculate as calculateBB } from './standard/bb';
export type { BBInputs } from './standard/bb';

// BOP - Balance of Power
import * as bopIndicator from './standard/bop';
export { BOP, calculate as calculateBOP } from './standard/bop';
export type { BOPInputs } from './standard/bop';

// CCI - Commodity Channel Index
import * as cciIndicator from './standard/cci';
export { CCI, calculate as calculateCCI } from './standard/cci';
export type { CCIInputs } from './standard/cci';

// DEMA - Double Exponential Moving Average
import * as demaIndicator from './standard/dema';
export { DEMA, calculate as calculateDEMA } from './standard/dema';
export type { DEMAInputs } from './standard/dema';

// Donchian Channels
import * as donchianIndicator from './standard/donchian';
export { DonchianChannels, calculate as calculateDonchian } from './standard/donchian';
export type { DonchianInputs } from './standard/donchian';

// EMA - Exponential Moving Average
import * as emaIndicator from './standard/ema';
export { EMA, calculate as calculateEMA } from './standard/ema';
export type { EMAInputs } from './standard/ema';

// HMA - Hull Moving Average
import * as hmaIndicator from './standard/hma';
export { HMA, calculate as calculateHMA } from './standard/hma';
export type { HMAInputs } from './standard/hma';

// Ichimoku Cloud
import * as ichimokuIndicator from './standard/ichimoku';
export { IchimokuCloud, calculate as calculateIchimoku } from './standard/ichimoku';
export type { IchimokuInputs } from './standard/ichimoku';

// Keltner Channels
import * as keltnerIndicator from './standard/keltner';
export { KeltnerChannels, calculate as calculateKeltner } from './standard/keltner';
export type { KeltnerInputs } from './standard/keltner';

// LSMA - Least Squares Moving Average
import * as lsmaIndicator from './standard/lsma';
export { LSMA, calculate as calculateLSMA } from './standard/lsma';
export type { LSMAInputs } from './standard/lsma';

// MACD - Moving Average Convergence Divergence
import * as macdIndicator from './standard/macd';
export { MACD, calculate as calculateMACD } from './standard/macd';
export type { MACDInputs } from './standard/macd';

// MA Ribbon - Moving Average Ribbon
import * as maRibbonIndicator from './standard/ma-ribbon';
export { MARibbon, calculate as calculateMARibbon } from './standard/ma-ribbon';
export type { MARibbonInputs } from './standard/ma-ribbon';

// Mass Index
import * as massIndexIndicator from './standard/mass-index';
export { MassIndex, calculate as calculateMassIndex } from './standard/mass-index';
export type { MassIndexInputs } from './standard/mass-index';

// McGinley Dynamic
import * as mcGinleyDynamicIndicator from './standard/mcginley-dynamic';
export { McGinleyDynamic, calculate as calculateMcGinleyDynamic } from './standard/mcginley-dynamic';
export type { McGinleyDynamicInputs } from './standard/mcginley-dynamic';

// Momentum
import * as momentumIndicator from './standard/momentum';
export { Momentum, calculate as calculateMomentum } from './standard/momentum';
export type { MomentumInputs } from './standard/momentum';

// OBV - On Balance Volume
import * as obvIndicator from './standard/obv';
export { OBV, calculate as calculateOBV } from './standard/obv';
export type { OBVInputs } from './standard/obv';

// Parabolic SAR
import * as parabolicSarIndicator from './standard/parabolic-sar';
export { ParabolicSAR, calculate as calculateParabolicSAR } from './standard/parabolic-sar';
export type { ParabolicSARInputs } from './standard/parabolic-sar';

// RMA - Smoothed Moving Average
import * as rmaIndicator from './standard/rma';
export { RMA, calculate as calculateRMA } from './standard/rma';
export type { RMAInputs } from './standard/rma';

// ROC - Rate of Change
import * as rocIndicator from './standard/roc';
export { ROC, calculate as calculateROC } from './standard/roc';
export type { ROCInputs } from './standard/roc';

// RSI - Relative Strength Index
import * as rsiIndicator from './standard/rsi';
export { RSI, calculate as calculateRSI } from './standard/rsi';
export type { RSIInputs } from './standard/rsi';

// Stochastic
import * as stochIndicator from './standard/stoch';
export { Stochastic, calculate as calculateStochastic } from './standard/stoch';
export type { StochasticInputs } from './standard/stoch';

// Supertrend
import * as supertrendIndicator from './standard/supertrend';
export { Supertrend, calculate as calculateSupertrend } from './standard/supertrend';
export type { SupertrendInputs } from './standard/supertrend';

// ADX - Average Directional Index
import * as adxIndicator from './standard/adx';
export { ADX, calculate as calculateADX } from './standard/adx';
export type { ADXInputs } from './standard/adx';

// Awesome Oscillator
import * as awesomeOscIndicator from './standard/awesome-oscillator';
export { AwesomeOscillator, calculate as calculateAwesomeOscillator } from './standard/awesome-oscillator';
export type { AwesomeOscillatorInputs } from './standard/awesome-oscillator';

// BBTrend
import * as bbtrendIndicator from './standard/bbtrend';
export { BBTrend, calculate as calculateBBTrend } from './standard/bbtrend';
export type { BBTrendInputs } from './standard/bbtrend';

// Bull Bear Power
import * as bullBearPowerIndicator from './standard/bull-bear-power';
export { BullBearPower, calculate as calculateBullBearPower } from './standard/bull-bear-power';
export type { BullBearPowerInputs } from './standard/bull-bear-power';

// Chande Momentum Oscillator
import * as chandeMOIndicator from './standard/chande-mo';
export { ChandeMO, calculate as calculateChandeMO } from './standard/chande-mo';
export type { ChandeMOInputs } from './standard/chande-mo';

// DPO - Detrended Price Oscillator
import * as dpoIndicator from './standard/dpo';
export { DPO, calculate as calculateDPO } from './standard/dpo';
export type { DPOInputs } from './standard/dpo';

// Elder Force Index
import * as elderForceIndicator from './standard/elder-force';
export { ElderForceIndex, calculate as calculateElderForce } from './standard/elder-force';
export type { ElderForceInputs } from './standard/elder-force';

// Historical Volatility
import * as histVolIndicator from './standard/historical-volatility';
export { HistoricalVolatility, calculate as calculateHistoricalVolatility } from './standard/historical-volatility';
export type { HistoricalVolatilityInputs } from './standard/historical-volatility';

// MA Cross
import * as maCrossIndicator from './standard/ma-cross';
export { MACross, calculate as calculateMACross } from './standard/ma-cross';
export type { MACrossInputs } from './standard/ma-cross';

// Median
import * as medianIndicator from './standard/median';
export { Median, calculate as calculateMedian } from './standard/median';
export type { MedianInputs } from './standard/median';

// MFI - Money Flow Index
import * as mfiIndicator from './standard/mfi';
export { MFI, calculate as calculateMFI } from './standard/mfi';
export type { MFIInputs } from './standard/mfi';

// PVT - Price Volume Trend
import * as pvtIndicator from './standard/pvt';
export { PVT, calculate as calculatePVT } from './standard/pvt';
export type { PVTInputs } from './standard/pvt';

// RVI - Relative Vigor Index
import * as rviIndicator from './standard/rvi';
export { RVI, calculate as calculateRVI } from './standard/rvi';
export type { RVIInputs } from './standard/rvi';

// SMI Ergodic
import * as smiErgodicIndicator from './standard/smi-ergodic';
export { SMIErgodic, calculate as calculateSMIErgodic } from './standard/smi-ergodic';
export type { SMIErgodicInputs } from './standard/smi-ergodic';

// SMI Ergodic Oscillator
import * as smiErgodicOscIndicator from './standard/smi-ergodic-oscillator';
export { SMIErgodicOscillator, calculate as calculateSMIErgodicOsc } from './standard/smi-ergodic-oscillator';
export type { SMIErgodicOscInputs } from './standard/smi-ergodic-oscillator';

// SMMA - Smoothed Moving Average
import * as smmaIndicator from './standard/smma';
export { SMMA, calculate as calculateSMMA } from './standard/smma';
export type { SMMAInputs } from './standard/smma';

// Standard Deviation
import * as stdevIndicator from './standard/stdev';
export { StandardDeviation, calculate as calculateStDev } from './standard/stdev';
export type { StDevInputs } from './standard/stdev';

// Stochastic RSI
import * as stochRsiIndicator from './standard/stoch-rsi';
export { StochRSI, calculate as calculateStochRSI } from './standard/stoch-rsi';
export type { StochRSIInputs } from './standard/stoch-rsi';

// Trend Strength Index
import * as trendStrengthIndicator from './standard/trend-strength';
export { TrendStrengthIndex, calculate as calculateTrendStrength } from './standard/trend-strength';
export type { TrendStrengthInputs } from './standard/trend-strength';

// TSI - True Strength Index
import * as tsiIndicator from './standard/tsi';
export { TSI, calculate as calculateTSI } from './standard/tsi';
export type { TSIInputs } from './standard/tsi';

// Volume Oscillator
import * as volumeOscIndicator from './standard/volume-oscillator';
export { VolumeOscillator, calculate as calculateVolumeOsc } from './standard/volume-oscillator';
export type { VolumeOscillatorInputs } from './standard/volume-oscillator';

// Vortex Indicator
import * as vortexIndicator from './standard/vortex';
export { VortexIndicator, calculate as calculateVortex } from './standard/vortex';
export type { VortexInputs } from './standard/vortex';

// Williams Alligator
import * as williamsAlligatorIndicator from './standard/williams-alligator';
export { WilliamsAlligator, calculate as calculateWilliamsAlligator } from './standard/williams-alligator';
export type { WilliamsAlligatorInputs } from './standard/williams-alligator';

// Williams %R
import * as williamsRIndicator from './standard/williams-r';
export { WilliamsPercentRange, calculate as calculateWilliamsR } from './standard/williams-r';
export type { WilliamsRInputs } from './standard/williams-r';

// Woodies CCI
import * as woodiesCCIIndicator from './standard/woodies-cci';
export { WoodiesCCI, calculate as calculateWoodiesCCI } from './standard/woodies-cci';
export type { WoodiesCCIInputs } from './standard/woodies-cci';

// BB %B - Bollinger Bands %B
import * as bbPercentBIndicator from './standard/bb-percent-b';
export { BBPercentB, calculate as calculateBBPercentB } from './standard/bb-percent-b';
export type { BBPercentBInputs } from './standard/bb-percent-b';

// BB Width - Bollinger BandWidth
import * as bbBandwidthIndicator from './standard/bb-bandwidth';
export { BBBandWidth, calculate as calculateBBBandwidth } from './standard/bb-bandwidth';
export type { BBBandWidthInputs } from './standard/bb-bandwidth';

// Chaikin Money Flow
import * as chaikinMFIndicator from './standard/chaikin-mf';
export { ChaikinMF, calculate as calculateChaikinMF } from './standard/chaikin-mf';
export type { ChaikinMFInputs } from './standard/chaikin-mf';

// Envelope
import * as envelopeIndicator from './standard/envelope';
export { Envelope, calculate as calculateEnvelope } from './standard/envelope';
export type { EnvelopeInputs } from './standard/envelope';

// Price Oscillator (PPO)
import * as priceOscillatorIndicator from './standard/price-oscillator';
export { PriceOscillator, calculate as calculatePriceOscillator } from './standard/price-oscillator';
export type { PriceOscillatorInputs } from './standard/price-oscillator';

// Aroon
import * as aroonIndicator from './standard/aroon';
export { Aroon, calculate as calculateAroon } from './standard/aroon';
export type { AroonInputs } from './standard/aroon';

// Coppock Curve
import * as coppockCurveIndicator from './standard/coppock-curve';
export { CoppockCurve, calculate as calculateCoppockCurve } from './standard/coppock-curve';
export type { CoppockCurveInputs } from './standard/coppock-curve';

// Choppiness Index
import * as choppinessIndicator from './standard/choppiness';
export { Choppiness, calculate as calculateChoppiness } from './standard/choppiness';
export type { ChoppinessInputs } from './standard/choppiness';

// Ease of Movement
import * as eomIndicator from './standard/ease-of-movement';
export { EaseOfMovement, calculate as calculateEOM } from './standard/ease-of-movement';
export type { EaseOfMovementInputs } from './standard/ease-of-movement';

// Chaikin Oscillator
import * as chaikinOscIndicator from './standard/chaikin-oscillator';
export { ChaikinOscillator, calculate as calculateChaikinOsc } from './standard/chaikin-oscillator';
export type { ChaikinOscillatorInputs } from './standard/chaikin-oscillator';

// TEMA - Triple Exponential Moving Average
import * as temaIndicator from './standard/tema';
export { TEMA, calculate as calculateTEMA } from './standard/tema';
export type { TEMAInputs } from './standard/tema';

// ZigZag
import * as zigzagIndicator from './standard/zigzag';
export { ZigZag, calculate as calculateZigZag } from './standard/zigzag';
export type { ZigZagInputs, ZigZagResult } from './standard/zigzag';

// Fisher Transform
import * as fisherTransformIndicator from './standard/fisher-transform';
export { FisherTransform, calculate as calculateFisherTransform } from './standard/fisher-transform';
export type { FisherTransformInputs } from './standard/fisher-transform';

// TRIX
import * as trixIndicator from './standard/trix';
export { TRIX, calculate as calculateTRIX } from './standard/trix';
export type { TRIXInputs } from './standard/trix';

// DMI - Directional Movement Index
import * as dmiIndicator from './standard/dmi';
export { DMI, calculate as calculateDMI } from './standard/dmi';
export type { DMIInputs } from './standard/dmi';

// Klinger Oscillator
import * as klingerIndicator from './standard/klinger';
export { KlingerOscillator, calculate as calculateKlinger } from './standard/klinger';
export type { KlingerInputs } from './standard/klinger';

// Ultimate Oscillator
import * as ultimateOscIndicator from './standard/ultimate-oscillator';
export { UltimateOscillator, calculate as calculateUltimateOsc } from './standard/ultimate-oscillator';
export type { UltimateOscillatorInputs } from './standard/ultimate-oscillator';

// Chande Kroll Stop
import * as chandeKrollStopIndicator from './standard/chande-kroll-stop';
export { ChandeKrollStop, calculate as calculateChandeKrollStop } from './standard/chande-kroll-stop';
export type { ChandeKrollStopInputs } from './standard/chande-kroll-stop';

// Relative Volume at Time
import * as relativeVolumeAtTimeIndicator from './standard/relative-volume-at-time';
export { RelativeVolumeAtTime, calculate as calculateRelativeVolumeAtTime } from './standard/relative-volume-at-time';
export type { RelativeVolumeAtTimeInputs } from './standard/relative-volume-at-time';

// RCI Ribbon
import * as rciRibbonIndicator from './standard/rci-ribbon';
export { RCIRibbon, calculate as calculateRCIRibbon } from './standard/rci-ribbon';
export type { RCIRibbonInputs } from './standard/rci-ribbon';

// Volume Delta
import * as volumeDeltaIndicator from './standard/volume-delta';
export { VolumeDelta, calculate as calculateVolumeDelta } from './standard/volume-delta';
export type { VolumeDeltaInputs } from './standard/volume-delta';

// Cumulative Volume Delta
import * as cumulativeVolumeDeltaIndicator from './standard/cumulative-volume-delta';
export { CumulativeVolumeDelta, calculate as calculateCVD } from './standard/cumulative-volume-delta';
export type { CumulativeVolumeDeltaInputs } from './standard/cumulative-volume-delta';

// Net Volume
import * as netVolumeIndicator from './standard/net-volume';
export { NetVolume, calculate as calculateNetVolume } from './standard/net-volume';
export type { NetVolumeInputs } from './standard/net-volume';

// VWMA - Volume Weighted Moving Average
import * as vwmaIndicator from './standard/vwma';
export { VWMA, calculate as calculateVWMA } from './standard/vwma';
export type { VWMAInputs } from './standard/vwma';

// WMA - Weighted Moving Average
import * as wmaIndicator from './standard/wma';
export { WMA, calculate as calculateWMA } from './standard/wma';
export type { WMAInputs } from './standard/wma';

// KST - Know Sure Thing
import * as kstIndicator from './standard/kst';
export { KnowSureThing, calculate as calculateKST } from './standard/kst';
export type { KSTInputs } from './standard/kst';

// Connors RSI
import * as connorsRsiIndicator from './standard/connors-rsi';
export { ConnorsRSI, calculate as calculateConnorsRSI } from './standard/connors-rsi';
export type { ConnorsRSIInputs } from './standard/connors-rsi';

// Chop Zone
import * as chopZoneIndicator from './standard/chop-zone';
export { ChopZone, calculate as calculateChopZone } from './standard/chop-zone';
export type { ChopZoneInputs } from './standard/chop-zone';

// RCI - Rank Correlation Index
import * as rciIndicator from './standard/rank-correlation-index';
export { RankCorrelationIndex, calculate as calculateRCI } from './standard/rank-correlation-index';
export type { RCIInputs } from './standard/rank-correlation-index';

// Relative Volatility Index
import * as relativeVolatilityIndexIndicator from './standard/relative-volatility-index';
export { RelativeVolatilityIndex, calculate as calculateRelativeVolatilityIndex } from './standard/relative-volatility-index';
export type { RelativeVolatilityIndexInputs } from './standard/relative-volatility-index';

// Williams Fractals
import * as williamsFractalsIndicator from './standard/williams-fractals';
export { WilliamsFractals, calculate as calculateWilliamsFractals } from './standard/williams-fractals';
export type { WilliamsFractalsInputs } from './standard/williams-fractals';

// TWAP - Time Weighted Average Price
import * as twapIndicator from './standard/twap';
export { TWAP, calculate as calculateTWAP } from './standard/twap';
export type { TWAPInputs } from './standard/twap';

// Bollinger Bars
import * as bollingerBarsIndicator from './standard/bollinger-bars';
export { BollingerBars, calculate as calculateBollingerBars } from './standard/bollinger-bars';
export type { BollingerBarsInputs } from './standard/bollinger-bars';

// Moon Phases
import * as moonPhasesIndicator from './standard/moon-phases';
export { MoonPhases, calculate as calculateMoonPhases } from './standard/moon-phases';
export type { MoonPhasesInputs } from './standard/moon-phases';

// ZLSMA - Zero Lag LSMA
import * as zlsmaIndicator from './community/zlsma';
export { ZLSMA, calculate as calculateZLSMA } from './community/zlsma';
export type { ZLSMAInputs } from './community/zlsma';

// Forecast Oscillator
import * as forecastOscillatorIndicator from './community/forecast-oscillator';
export { ForecastOscillator, calculate as calculateForecastOscillator } from './community/forecast-oscillator';
export type { ForecastOscillatorInputs } from './community/forecast-oscillator';

// CCT Bollinger Band Oscillator
import * as cctbboIndicator from './community/cct-bbo';
export { CCTBBO, calculate as calculateCCTBBO } from './community/cct-bbo';
export type { CCTBBOInputs } from './community/cct-bbo';

// MACD 4C
import * as macd4cIndicator from './community/macd-4c';
export { MACD4C, calculate as calculateMACD4C } from './community/macd-4c';
export type { MACD4CInputs } from './community/macd-4c';

// Colored Volume Bars
import * as coloredVolumeIndicator from './community/colored-volume';
export { ColoredVolume, calculate as calculateColoredVolume } from './community/colored-volume';
export type { ColoredVolumeInputs } from './community/colored-volume';

// KDJ Indicator
import * as kdjIndicator from './community/kdj';
export { KDJ, calculate as calculateKDJ } from './community/kdj';
export type { KDJInputs } from './community/kdj';

// WaveTrend
import * as waveTrendIndicator from './community/wavetrend';
export { WaveTrend, calculate as calculateWaveTrend } from './community/wavetrend';
export type { WaveTrendInputs } from './community/wavetrend';

// Squeeze Momentum
import * as squeezeMomentumIndicator from './community/squeeze-momentum';
export { SqueezeMomentum, calculate as calculateSqueezeMomentum } from './community/squeeze-momentum';
export type { SqueezeMomentumInputs } from './community/squeeze-momentum';

// Coral Trend
import * as coralTrendIndicator from './community/coral-trend';
export { CoralTrend, calculate as calculateCoralTrend } from './community/coral-trend';
export type { CoralTrendInputs } from './community/coral-trend';

// Chandelier Exit
import * as chandelierExitIndicator from './community/chandelier-exit';
export { ChandelierExit, calculate as calculateChandelierExit } from './community/chandelier-exit';
export type { ChandelierExitInputs } from './community/chandelier-exit';

// Impulse MACD
import * as impulseMacdIndicator from './community/impulse-macd';
export { ImpulseMACD, calculate as calculateImpulseMACD } from './community/impulse-macd';
export type { ImpulseMACDInputs } from './community/impulse-macd';

// Schaff Trend Cycle
import * as schaffTrendCycleIndicator from './community/schaff-trend-cycle';
export { SchaffTrendCycle, calculate as calculateSchaffTrendCycle } from './community/schaff-trend-cycle';
export type { SchaffTrendCycleInputs } from './community/schaff-trend-cycle';

// Donchian Trend Ribbon
import * as donchianTrendRibbonIndicator from './community/donchian-trend-ribbon';
export { DonchianTrendRibbon, calculate as calculateDonchianTrendRibbon } from './community/donchian-trend-ribbon';
export type { DonchianTrendRibbonInputs } from './community/donchian-trend-ribbon';

// OBV MACD
import * as obvMacdIndicator from './community/obv-macd';
export { OBVMACD, calculate as calculateOBVMACD } from './community/obv-macd';
export type { OBVMACDInputs } from './community/obv-macd';

// AlphaTrend
import * as alphaTrendIndicator from './community/alpha-trend';
export { AlphaTrend, calculate as calculateAlphaTrend } from './community/alpha-trend';
export type { AlphaTrendInputs } from './community/alpha-trend';

// HalfTrend
import * as halfTrendIndicator from './community/half-trend';
export { HalfTrend, calculate as calculateHalfTrend } from './community/half-trend';
export type { HalfTrendInputs } from './community/half-trend';

// QQE MOD
import * as qqeModIndicator from './community/qqe-mod';
export { QQEMod, calculate as calculateQQEMod } from './community/qqe-mod';
export type { QQEModInputs } from './community/qqe-mod';

// Follow Line
import * as followLineIndicator from './community/follow-line';
export { FollowLine, calculate as calculateFollowLine } from './community/follow-line';
export type { FollowLineInputs } from './community/follow-line';

// UT Bot
import * as utBotIndicator from './community/ut-bot';
export { UTBot, calculate as calculateUTBot } from './community/ut-bot';
export type { UTBotInputs } from './community/ut-bot';

// Hull Suite
import * as hullSuiteIndicator from './community/hull-suite';
export { HullSuite, calculate as calculateHullSuite } from './community/hull-suite';
export type { HullSuiteInputs } from './community/hull-suite';

// Optimized Trend Tracker
import * as ottIndicator from './community/optimized-trend-tracker';
export { OptimizedTrendTracker, calculate as calculateOTT } from './community/optimized-trend-tracker';
export type { OTTInputs } from './community/optimized-trend-tracker';

// Trend Magic
import * as trendMagicIndicator from './community/trend-magic';
export { TrendMagic, calculate as calculateTrendMagic } from './community/trend-magic';
export type { TrendMagicInputs } from './community/trend-magic';

// SSL Channel
import * as sslChannelIndicator from './community/ssl-channel';
export { SSLChannel, calculate as calculateSSLChannel } from './community/ssl-channel';
export type { SSLChannelInputs } from './community/ssl-channel';

// MavilimW
import * as mavilimWIndicator from './community/mavilimw';
export { MavilimW, calculate as calculateMavilimW } from './community/mavilimw';
export type { MavilimWInputs } from './community/mavilimw';

// CDC Action Zone
import * as cdcActionZoneIndicator from './community/cdc-action-zone';
export { CDCActionZone, calculate as calculateCDCActionZone } from './community/cdc-action-zone';
export type { CDCActionZoneInputs } from './community/cdc-action-zone';

// Tillson T3
import * as tillsonT3Indicator from './community/tillson-t3';
export { TillsonT3, calculate as calculateTillsonT3 } from './community/tillson-t3';
export type { TillsonT3Inputs } from './community/tillson-t3';

// Waddah Attar Explosion
import * as waddahAttarExplosionIndicator from './community/waddah-attar-explosion';
export { WaddahAttarExplosion, calculate as calculateWaddahAttarExplosion } from './community/waddah-attar-explosion';
export type { WaddahAttarExplosionInputs } from './community/waddah-attar-explosion';

// Ripster EMA Clouds
import * as ripsterEMACloudsIndicator from './community/ripster-ema-clouds';
export { RipsterEMAClouds, calculate as calculateRipsterEMAClouds } from './community/ripster-ema-clouds';
export type { RipsterEMACloudsInputs } from './community/ripster-ema-clouds';

// Premier RSI Oscillator
import * as premierRsiIndicator from './community/premier-rsi';
export { PremierRSI, calculate as calculatePremierRSI } from './community/premier-rsi';
export type { PremierRSIInputs } from './community/premier-rsi';

// Laguerre RSI
import * as laguerreRsiIndicator from './community/laguerre-rsi';
export { LaguerreRSI, calculate as calculateLaguerreRSI } from './community/laguerre-rsi';
export type { LaguerreRSIInputs } from './community/laguerre-rsi';

// RSI Candles
import * as rsiCandlesIndicator from './community/rsi-candles';
export { RSICandles, calculate as calculateRSICandles } from './community/rsi-candles';
export type { RSICandlesInputs } from './community/rsi-candles';

// Zero Lag MACD
import * as zeroLagMacdIndicator from './community/zero-lag-macd';
export { ZeroLagMACD, calculate as calculateZeroLagMACD } from './community/zero-lag-macd';
export type { ZeroLagMACDInputs } from './community/zero-lag-macd';

// ADX and DI
import * as adxDiIndicator from './community/adx-di';
export { ADXDI, calculate as calculateADXDI } from './community/adx-di';
export type { ADXDIInputs } from './community/adx-di';

// Awesome Oscillator V2
import * as awesomeOscV2Indicator from './community/awesome-oscillator-v2';
export { AwesomeOscillatorV2, calculate as calculateAwesomeOscillatorV2 } from './community/awesome-oscillator-v2';
export type { AwesomeOscillatorV2Inputs } from './community/awesome-oscillator-v2';

// CM EMA Trend Bars
import * as cmEmaTrendBarsIndicator from './community/cm-ema-trend-bars';
export { CMEMATrendBars, calculate as calculateCMEMATrendBars } from './community/cm-ema-trend-bars';
export type { CMEMATrendBarsInputs } from './community/cm-ema-trend-bars';

// BB Fibonacci Ratios
import * as bbFibRatiosIndicator from './community/bb-fibonacci-ratios';
export { BBFibonacciRatios, calculate as calculateBBFibonacciRatios } from './community/bb-fibonacci-ratios';
export type { BBFibonacciRatiosInputs } from './community/bb-fibonacci-ratios';

// Average Sentiment Oscillator
import * as avgSentimentOscIndicator from './community/average-sentiment-oscillator';
export { AverageSentimentOscillator, calculate as calculateAverageSentimentOsc } from './community/average-sentiment-oscillator';
export type { AverageSentimentOscInputs } from './community/average-sentiment-oscillator';

// ATR Trailing Stops
import * as atrTrailingStopsIndicator from './community/atr-trailing-stops';
export { ATRTrailingStops, calculate as calculateATRTrailingStops } from './community/atr-trailing-stops';
export type { ATRTrailingStopsInputs } from './community/atr-trailing-stops';

// Accurate Swing Trading
import * as accurateSwingTradingIndicator from './community/accurate-swing-trading';
export { AccurateSwingTrading, calculate as calculateAccurateSwingTrading } from './community/accurate-swing-trading';
export type { AccurateSwingTradingInputs } from './community/accurate-swing-trading';

// Bull Bear Power Trend
import * as bullBearPowerTrendIndicator from './community/bull-bear-power-trend';
export { BullBearPowerTrend, calculate as calculateBullBearPowerTrend } from './community/bull-bear-power-trend';
export type { BullBearPowerTrendInputs } from './community/bull-bear-power-trend';

// BB Breakout Oscillator
import * as bbBreakoutOscIndicator from './community/bb-breakout-oscillator';
export { BBBreakoutOscillator, calculate as calculateBBBreakoutOsc } from './community/bb-breakout-oscillator';
export type { BBBreakoutOscInputs } from './community/bb-breakout-oscillator';

// Chandelier Stop
import * as chandelierStopIndicator from './community/chandelier-stop';
export { ChandelierStop, calculate as calculateChandelierStop } from './community/chandelier-stop';
export type { ChandelierStopInputs } from './community/chandelier-stop';

// Stochastic Momentum Index
import * as smiIndicator from './community/stochastic-momentum-index';
export { StochasticMomentumIndex, calculate as calculateSMI } from './community/stochastic-momentum-index';
export type { StochasticMomentumIndexInputs } from './community/stochastic-momentum-index';

// Volume Flow Indicator
import * as vfiIndicator from './community/volume-flow-indicator';
export { VolumeFlowIndicator, calculate as calculateVFI } from './community/volume-flow-indicator';
export type { VolumeFlowIndicatorInputs } from './community/volume-flow-indicator';

// Ehlers Instantaneous Trend
import * as ehlersITrendIndicator from './community/ehlers-instantaneous-trend';
export { EhlersInstantaneousTrend, calculate as calculateEhlersITrend } from './community/ehlers-instantaneous-trend';
export type { EhlersInstantaneousTrendInputs } from './community/ehlers-instantaneous-trend';

// Price Momentum Oscillator
import * as pmoIndicator from './community/price-momentum-oscillator';
export { PriceMomentumOscillator, calculate as calculatePMO } from './community/price-momentum-oscillator';
export type { PriceMomentumOscInputs } from './community/price-momentum-oscillator';

// Fibonacci Bollinger Bands
import * as fibBBIndicator from './community/fibonacci-bollinger-bands';
export { FibonacciBollingerBands, calculate as calculateFibBB } from './community/fibonacci-bollinger-bands';
export type { FibonacciBollingerBandsInputs } from './community/fibonacci-bollinger-bands';

// Trend Trigger Factor
import * as ttfIndicator from './community/trend-trigger-factor';
export { TrendTriggerFactor, calculate as calculateTTF } from './community/trend-trigger-factor';
export type { TrendTriggerFactorInputs } from './community/trend-trigger-factor';

// Elliott Wave Oscillator
import * as ewoIndicator from './community/elliott-wave-oscillator';
export { ElliottWaveOscillator, calculate as calculateEWO } from './community/elliott-wave-oscillator';
export type { ElliottWaveOscInputs } from './community/elliott-wave-oscillator';

// Madrid Trend Squeeze
import * as madridTrendSqueezeIndicator from './community/madrid-trend-squeeze';
export { MadridTrendSqueeze, calculate as calculateMadridTrendSqueeze } from './community/madrid-trend-squeeze';
export type { MadridTrendSqueezeInputs } from './community/madrid-trend-squeeze';

// Kaufman Adaptive Moving Average
import * as kamaIndicator from './community/kaufman-adaptive-ma';
export { KaufmanAdaptiveMA, calculate as calculateKAMA } from './community/kaufman-adaptive-ma';
export type { KaufmanAdaptiveMAInputs } from './community/kaufman-adaptive-ma';

// Williams Vix Fix
import * as williamsVixFixIndicator from './community/williams-vix-fix';
export { WilliamsVixFix, calculate as calculateWilliamsVixFix } from './community/williams-vix-fix';
export type { WilliamsVixFixInputs } from './community/williams-vix-fix';

// Ehlers MESA Adaptive Moving Average
import * as ehlersMESAMAIndicator from './community/ehlers-mesa-ma';
export { EhlersMESAMA, calculate as calculateEhlersMESAMA } from './community/ehlers-mesa-ma';
export type { EhlersMESAMAInputs } from './community/ehlers-mesa-ma';

// Gann High Low
import * as gannHighLowIndicator from './community/gann-high-low';
export { GannHighLow, calculate as calculateGannHighLow } from './community/gann-high-low';
export type { GannHighLowInputs } from './community/gann-high-low';

// CM Sling Shot System
import * as cmSlingShotIndicator from './community/cm-sling-shot';
export { CMSlingShot, calculate as calculateCMSlingShot } from './community/cm-sling-shot';
export type { CMSlingShotInputs } from './community/cm-sling-shot';

// Range Identifier
import * as rangeIdentifierIndicator from './community/range-identifier';
export { RangeIdentifier, calculate as calculateRangeIdentifier } from './community/range-identifier';
export type { RangeIdentifierInputs } from './community/range-identifier';

// Smoothed Heiken Ashi
import * as smoothedHeikenAshiIndicator from './community/smoothed-heiken-ashi';
export { SmoothedHeikenAshi, calculate as calculateSmoothedHeikenAshi } from './community/smoothed-heiken-ashi';
export type { SmoothedHeikenAshiInputs } from './community/smoothed-heiken-ashi';

// MACD Leader
import * as macdLeaderIndicator from './community/macd-leader';
export { MACDLeader, calculate as calculateMACDLeader } from './community/macd-leader';
export type { MACDLeaderInputs } from './community/macd-leader';

// Slow Stochastic
import * as slowStochasticIndicator from './community/slow-stochastic';
export { SlowStochastic, calculate as calculateSlowStochastic } from './community/slow-stochastic';
export type { SlowStochasticInputs } from './community/slow-stochastic';

// IFT Stoch RSI CCI
import * as iftStochRsiCciIndicator from './community/ift-stoch-rsi-cci';
export { IFTStochRSICCI, calculate as calculateIFTStochRSICCI } from './community/ift-stoch-rsi-cci';
export type { IFTStochRSICCIInputs } from './community/ift-stoch-rsi-cci';

// Variable Moving Average
import * as variableMAIndicator from './community/variable-ma';
export { VariableMA, calculate as calculateVariableMA } from './community/variable-ma';
export type { VariableMAInputs } from './community/variable-ma';

// OBV Oscillator
import * as obvOscillatorIndicator from './community/obv-oscillator';
export { OBVOscillator, calculate as calculateOBVOscillator } from './community/obv-oscillator';
export type { OBVOscillatorInputs } from './community/obv-oscillator';

// Candlestick Patterns
import * as hammerIndicator from './candlestick/hammer';
import * as shootingStarIndicator from './candlestick/shooting-star';
import * as hangingManIndicator from './candlestick/hanging-man';
import * as invertedHammerIndicator from './candlestick/inverted-hammer';
import * as marubozuWhiteIndicator from './candlestick/marubozu-white';
import * as marubozuBlackIndicator from './candlestick/marubozu-black';
import * as dojiIndicator from './candlestick/doji';
import * as gravestoneDojiIndicator from './candlestick/gravestone-doji';
import * as dragonflyDojiIndicator from './candlestick/dragonfly-doji';
import * as longLowerShadowIndicator from './candlestick/long-lower-shadow';
import * as longUpperShadowIndicator from './candlestick/long-upper-shadow';
import * as spinningTopWhiteIndicator from './candlestick/spinning-top-white';
import * as spinningTopBlackIndicator from './candlestick/spinning-top-black';
import * as onNeckIndicator from './candlestick/on-neck';
import * as piercingIndicator from './candlestick/piercing';
import * as darkCloudCoverIndicator from './candlestick/dark-cloud-cover';
import * as tweezerTopIndicator from './candlestick/tweezer-top';
import * as tweezerBottomIndicator from './candlestick/tweezer-bottom';
import * as dojiStarBearishIndicator from './candlestick/doji-star-bearish';
import * as dojiStarBullishIndicator from './candlestick/doji-star-bullish';
import * as engulfingBullishIndicator from './candlestick/engulfing-bullish';
import * as engulfingBearishIndicator from './candlestick/engulfing-bearish';
import * as haramiBullishIndicator from './candlestick/harami-bullish';
import * as haramiBearishIndicator from './candlestick/harami-bearish';
import * as haramiCrossBullishIndicator from './candlestick/harami-cross-bullish';
import * as haramiCrossBearishIndicator from './candlestick/harami-cross-bearish';
import * as risingWindowIndicator from './candlestick/rising-window';
import * as fallingWindowIndicator from './candlestick/falling-window';
import * as kickingBullishIndicator from './candlestick/kicking-bullish';
import * as kickingBearishIndicator from './candlestick/kicking-bearish';
import * as morningStarIndicator from './candlestick/morning-star';
import * as eveningStarIndicator from './candlestick/evening-star';
import * as morningDojiStarIndicator from './candlestick/morning-doji-star';
import * as eveningDojiStarIndicator from './candlestick/evening-doji-star';
import * as threeWhiteSoldiersIndicator from './candlestick/three-white-soldiers';
import * as threeBlackCrowsIndicator from './candlestick/three-black-crows';
import * as abandonedBabyBullishIndicator from './candlestick/abandoned-baby-bullish';
import * as abandonedBabyBearishIndicator from './candlestick/abandoned-baby-bearish';
import * as triStarBullishIndicator from './candlestick/tri-star-bullish';
import * as triStarBearishIndicator from './candlestick/tri-star-bearish';
import * as downsideTasukiGapIndicator from './candlestick/downside-tasuki-gap';
import * as upsideTasukiGapIndicator from './candlestick/upside-tasuki-gap';
import * as fallingThreeMethodsIndicator from './candlestick/falling-three-methods';
import * as risingThreeMethodsIndicator from './candlestick/rising-three-methods';
export { Hammer } from './candlestick/hammer';
export { ShootingStar } from './candlestick/shooting-star';
export { HangingMan } from './candlestick/hanging-man';
export { InvertedHammer } from './candlestick/inverted-hammer';
export { MarubozuWhite } from './candlestick/marubozu-white';
export { MarubozuBlack } from './candlestick/marubozu-black';
export { Doji } from './candlestick/doji';
export { GravestoneDoji } from './candlestick/gravestone-doji';
export { DragonflyDoji } from './candlestick/dragonfly-doji';
export { LongLowerShadow } from './candlestick/long-lower-shadow';
export { LongUpperShadow } from './candlestick/long-upper-shadow';
export { SpinningTopWhite } from './candlestick/spinning-top-white';
export { SpinningTopBlack } from './candlestick/spinning-top-black';
export { OnNeck } from './candlestick/on-neck';
export { Piercing } from './candlestick/piercing';
export { DarkCloudCover } from './candlestick/dark-cloud-cover';
export { TweezerTop } from './candlestick/tweezer-top';
export { TweezerBottom } from './candlestick/tweezer-bottom';
export { DojiStarBearish } from './candlestick/doji-star-bearish';
export { DojiStarBullish } from './candlestick/doji-star-bullish';
export { EngulfingBullish } from './candlestick/engulfing-bullish';
export { EngulfingBearish } from './candlestick/engulfing-bearish';
export { HaramiBullish } from './candlestick/harami-bullish';
export { HaramiBearish } from './candlestick/harami-bearish';
export { HaramiCrossBullish } from './candlestick/harami-cross-bullish';
export { HaramiCrossBearish } from './candlestick/harami-cross-bearish';
export { RisingWindow } from './candlestick/rising-window';
export { FallingWindow } from './candlestick/falling-window';
export { KickingBullish } from './candlestick/kicking-bullish';
export { KickingBearish } from './candlestick/kicking-bearish';
export { MorningStar } from './candlestick/morning-star';
export { EveningStar } from './candlestick/evening-star';
export { MorningDojiStar } from './candlestick/morning-doji-star';
export { EveningDojiStar } from './candlestick/evening-doji-star';
export { ThreeWhiteSoldiers } from './candlestick/three-white-soldiers';
export { ThreeBlackCrows } from './candlestick/three-black-crows';
export { AbandonedBabyBullish } from './candlestick/abandoned-baby-bullish';
export { AbandonedBabyBearish } from './candlestick/abandoned-baby-bearish';
export { TriStarBullish } from './candlestick/tri-star-bullish';
export { TriStarBearish } from './candlestick/tri-star-bearish';
export { DownsideTasukiGap } from './candlestick/downside-tasuki-gap';
export { UpsideTasukiGap } from './candlestick/upside-tasuki-gap';
export { FallingThreeMethods } from './candlestick/falling-three-methods';
export { RisingThreeMethods } from './candlestick/rising-three-methods';

// InputConfig, PlotConfig, HLineConfig, FillConfig re-exported from oakscriptjs above

export type {
  MarkerData,
  BarColorData,
  BgColorData,
  PlotCandleData,
  LabelData,
  LineDrawingData,
  BoxData,
  TableData,
  TableCell,
} from './types';

/**
 * Indicator category types
 */
export type IndicatorCategory =
  | 'Moving Averages'
  | 'Momentum'
  | 'Volatility'
  | 'Volume'
  | 'Trend'
  | 'Oscillators'
  | 'Channels & Bands'
  | 'Candlestick Patterns';

/**
 * Indicator registry entry
 */
export interface IndicatorRegistryEntry {
  id: string;
  name: string;
  shortName: string;
  description?: string;
  category: IndicatorCategory;
  overlay: boolean;
  metadata: {
    title: string;
    shortTitle: string;
    overlay: boolean;
  };
  inputConfig: InputConfig[];
  plotConfig: PlotConfig[];
  hlineConfig?: HLineConfig[];
  fillConfig?: FillConfig[];
  plotCandleConfig?: { id: string; title: string }[];
  defaultInputs: Record<string, unknown>;
  calculate: (bars: Bar[], inputs?: any) => any;
}

/**
 * Generate candlestick pattern registry entries
 */
function candlestickEntries(
  pairs: [string, { metadata: any; inputConfig: any; plotConfig: any; defaultInputs: any; calculate: any }][]
): IndicatorRegistryEntry[] {
  return pairs.map(([id, ind]) => ({
    id,
    name: ind.metadata.title,
    shortName: ind.metadata.shortTitle,
    category: 'Candlestick Patterns' as IndicatorCategory,
    overlay: true,
    metadata: ind.metadata,
    inputConfig: ind.inputConfig as InputConfig[],
    plotConfig: ind.plotConfig as PlotConfig[],
    defaultInputs: { ...ind.defaultInputs },
    calculate: ind.calculate,
  }));
}

/**
 * Registry of all available indicators
 * Add new indicators here to make them available in the example
 */
export const indicatorRegistry: IndicatorRegistryEntry[] = [
  {
    id: 'sma',
    name: 'Simple Moving Average (SMA)',
    shortName: 'SMA',
    description: 'A simple moving average that smooths price data by calculating the arithmetic mean over a specified period.',
    category: 'Moving Averages',
    overlay: true,
    metadata: smaIndicator.metadata,
    inputConfig: smaIndicator.inputConfig as InputConfig[],
    plotConfig: smaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smaIndicator.defaultInputs },
    calculate: smaIndicator.calculate,
  },
  {
    id: 'adr',
    name: 'Average Day Range (ADR)',
    shortName: 'ADR',
    description: 'Calculates the average of the daily price range (high - low) over a specified period.',
    category: 'Volatility',
    overlay: false,
    metadata: adrIndicator.metadata,
    inputConfig: adrIndicator.inputConfig as InputConfig[],
    plotConfig: adrIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...adrIndicator.defaultInputs },
    calculate: adrIndicator.calculate,
  },
  {
    id: 'alma',
    name: 'Arnaud Legoux Moving Average (ALMA)',
    shortName: 'ALMA',
    description: 'A moving average using a Gaussian distribution to reduce lag while maintaining smoothness.',
    category: 'Moving Averages',
    overlay: true,
    metadata: almaIndicator.metadata,
    inputConfig: almaIndicator.inputConfig as InputConfig[],
    plotConfig: almaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...almaIndicator.defaultInputs },
    calculate: almaIndicator.calculate,
  },
  {
    id: 'atr',
    name: 'Average True Range (ATR)',
    shortName: 'ATR',
    description: 'Measures market volatility by calculating the average range between high and low prices.',
    category: 'Volatility',
    overlay: false,
    metadata: atrIndicator.metadata,
    inputConfig: atrIndicator.inputConfig as InputConfig[],
    plotConfig: atrIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...atrIndicator.defaultInputs },
    calculate: atrIndicator.calculate,
  },
  {
    id: 'bb',
    name: 'Bollinger Bands (BB)',
    shortName: 'BB',
    description: 'Volatility bands placed above and below a moving average, using standard deviation.',
    category: 'Channels & Bands',
    overlay: true,
    metadata: bbIndicator.metadata,
    inputConfig: bbIndicator.inputConfig as InputConfig[],
    plotConfig: bbIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bbIndicator.defaultInputs },
    calculate: bbIndicator.calculate,
  },
  {
    id: 'bop',
    name: 'Balance of Power (BOP)',
    shortName: 'BOP',
    description: 'Measures the strength of buyers vs sellers by comparing close-open to high-low range.',
    category: 'Momentum',
    overlay: false,
    metadata: bopIndicator.metadata,
    inputConfig: bopIndicator.inputConfig as InputConfig[],
    plotConfig: bopIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bopIndicator.defaultInputs },
    calculate: bopIndicator.calculate,
  },
  {
    id: 'cci',
    name: 'Commodity Channel Index (CCI)',
    shortName: 'CCI',
    description: 'Measures the variation of a security\'s price from its statistical mean.',
    category: 'Oscillators',
    overlay: false,
    metadata: cciIndicator.metadata,
    inputConfig: cciIndicator.inputConfig as InputConfig[],
    plotConfig: cciIndicator.plotConfig as PlotConfig[],
    hlineConfig: cciIndicator.hlineConfig as HLineConfig[],
    fillConfig: cciIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...cciIndicator.defaultInputs },
    calculate: cciIndicator.calculate,
  },
  {
    id: 'dema',
    name: 'Double EMA (DEMA)',
    shortName: 'DEMA',
    description: 'Reduces lag by applying EMA twice.',
    category: 'Moving Averages',
    overlay: true,
    metadata: demaIndicator.metadata,
    inputConfig: demaIndicator.inputConfig as InputConfig[],
    plotConfig: demaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...demaIndicator.defaultInputs },
    calculate: demaIndicator.calculate,
  },
  {
    id: 'ema',
    name: 'Exponential Moving Average (EMA)',
    shortName: 'EMA',
    description: 'A weighted moving average giving more weight to recent prices.',
    category: 'Moving Averages',
    overlay: true,
    metadata: emaIndicator.metadata,
    inputConfig: emaIndicator.inputConfig as InputConfig[],
    plotConfig: emaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaIndicator.defaultInputs },
    calculate: emaIndicator.calculate,
  },
  {
    id: 'hma',
    name: 'Hull Moving Average (HMA)',
    shortName: 'HMA',
    description: 'Reduces lag while maintaining smoothness using weighted moving averages.',
    category: 'Moving Averages',
    overlay: true,
    metadata: hmaIndicator.metadata,
    inputConfig: hmaIndicator.inputConfig as InputConfig[],
    plotConfig: hmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...hmaIndicator.defaultInputs },
    calculate: hmaIndicator.calculate,
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    shortName: 'Ichimoku',
    description: 'Comprehensive trend system showing support/resistance and momentum.',
    category: 'Trend',
    overlay: true,
    metadata: ichimokuIndicator.metadata,
    inputConfig: ichimokuIndicator.inputConfig as InputConfig[],
    plotConfig: ichimokuIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ichimokuIndicator.defaultInputs },
    calculate: ichimokuIndicator.calculate,
  },
  {
    id: 'keltner',
    name: 'Keltner Channels (KC)',
    shortName: 'KC',
    description: 'Volatility-based envelope using EMA and ATR.',
    category: 'Channels & Bands',
    overlay: true,
    metadata: keltnerIndicator.metadata,
    inputConfig: keltnerIndicator.inputConfig as InputConfig[],
    plotConfig: keltnerIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...keltnerIndicator.defaultInputs },
    calculate: keltnerIndicator.calculate,
  },
  {
    id: 'lsma',
    name: 'Least Squares Moving Average (LSMA)',
    shortName: 'LSMA',
    description: 'Uses linear regression to fit a line through recent prices.',
    category: 'Moving Averages',
    overlay: true,
    metadata: lsmaIndicator.metadata,
    inputConfig: lsmaIndicator.inputConfig as InputConfig[],
    plotConfig: lsmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...lsmaIndicator.defaultInputs },
    calculate: lsmaIndicator.calculate,
  },
  {
    id: 'macd',
    name: 'MACD',
    shortName: 'MACD',
    description: 'Trend-following momentum indicator showing relationship between two EMAs.',
    category: 'Momentum',
    overlay: false,
    metadata: macdIndicator.metadata,
    inputConfig: macdIndicator.inputConfig as InputConfig[],
    plotConfig: macdIndicator.plotConfig as PlotConfig[],
    hlineConfig: macdIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...macdIndicator.defaultInputs },
    calculate: macdIndicator.calculate,
  },
  {
    id: 'mass-index',
    name: 'Mass Index',
    shortName: 'MI',
    description: 'Identifies trend reversals by examining range between high and low.',
    category: 'Trend',
    overlay: false,
    metadata: massIndexIndicator.metadata,
    inputConfig: massIndexIndicator.inputConfig as InputConfig[],
    plotConfig: massIndexIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...massIndexIndicator.defaultInputs },
    calculate: massIndexIndicator.calculate,
  },
  {
    id: 'mc-ginley-dynamic',
    name: 'McGinley Dynamic',
    shortName: 'MD',
    description: 'An adaptive moving average that adjusts to market speed.',
    category: 'Moving Averages',
    overlay: true,
    metadata: mcGinleyDynamicIndicator.metadata,
    inputConfig: mcGinleyDynamicIndicator.inputConfig as InputConfig[],
    plotConfig: mcGinleyDynamicIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mcGinleyDynamicIndicator.defaultInputs },
    calculate: mcGinleyDynamicIndicator.calculate,
  },
  {
    id: 'momentum',
    name: 'Momentum',
    shortName: 'Mom',
    description: 'Measures the rate of change of price over a specified period.',
    category: 'Momentum',
    overlay: false,
    metadata: momentumIndicator.metadata,
    inputConfig: momentumIndicator.inputConfig as InputConfig[],
    plotConfig: momentumIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...momentumIndicator.defaultInputs },
    calculate: momentumIndicator.calculate,
  },
  {
    id: 'obv',
    name: 'On Balance Volume (OBV)',
    shortName: 'OBV',
    description: 'Cumulative volume indicator based on price direction.',
    category: 'Volume',
    overlay: false,
    metadata: obvIndicator.metadata,
    inputConfig: obvIndicator.inputConfig as InputConfig[],
    plotConfig: obvIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...obvIndicator.defaultInputs },
    calculate: obvIndicator.calculate,
  },
  {
    id: 'rma',
    name: 'Smoothed Moving Average (RMA)',
    shortName: 'RMA',
    description: 'Wilder smoothing with alpha = 1/length.',
    category: 'Moving Averages',
    overlay: true,
    metadata: rmaIndicator.metadata,
    inputConfig: rmaIndicator.inputConfig as InputConfig[],
    plotConfig: rmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rmaIndicator.defaultInputs },
    calculate: rmaIndicator.calculate,
  },
  {
    id: 'roc',
    name: 'Rate of Change (ROC)',
    shortName: 'ROC',
    description: 'Measures percentage change in price over a specified period.',
    category: 'Momentum',
    overlay: false,
    metadata: rocIndicator.metadata,
    inputConfig: rocIndicator.inputConfig as InputConfig[],
    plotConfig: rocIndicator.plotConfig as PlotConfig[],
    hlineConfig: rocIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...rocIndicator.defaultInputs },
    calculate: rocIndicator.calculate,
  },
  {
    id: 'rsi',
    name: 'Relative Strength Index (RSI)',
    shortName: 'RSI',
    description: 'Momentum oscillator measuring speed and magnitude of price changes.',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiIndicator.metadata,
    inputConfig: rsiIndicator.inputConfig as InputConfig[],
    plotConfig: rsiIndicator.plotConfig as PlotConfig[],
    hlineConfig: rsiIndicator.hlineConfig as HLineConfig[],
    fillConfig: rsiIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...rsiIndicator.defaultInputs },
    calculate: rsiIndicator.calculate,
  },
  {
    id: 'stoch',
    name: 'Stochastic',
    shortName: 'Stoch',
    description: 'Compares closing price to its price range over a given period.',
    category: 'Oscillators',
    overlay: false,
    metadata: stochIndicator.metadata,
    inputConfig: stochIndicator.inputConfig as InputConfig[],
    plotConfig: stochIndicator.plotConfig as PlotConfig[],
    hlineConfig: stochIndicator.hlineConfig as HLineConfig[],
    fillConfig: stochIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...stochIndicator.defaultInputs },
    calculate: stochIndicator.calculate,
  },
  {
    id: 'tema',
    name: 'Triple EMA (TEMA)',
    shortName: 'TEMA',
    description: 'Further reduces lag with triple exponential smoothing.',
    category: 'Moving Averages',
    overlay: true,
    metadata: temaIndicator.metadata,
    inputConfig: temaIndicator.inputConfig as InputConfig[],
    plotConfig: temaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...temaIndicator.defaultInputs },
    calculate: temaIndicator.calculate,
  },
  {
    id: 'vwma',
    name: 'Volume Weighted Moving Average (VWMA)',
    shortName: 'VWMA',
    description: 'A moving average weighted by volume.',
    category: 'Moving Averages',
    overlay: true,
    metadata: vwmaIndicator.metadata,
    inputConfig: vwmaIndicator.inputConfig as InputConfig[],
    plotConfig: vwmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vwmaIndicator.defaultInputs },
    calculate: vwmaIndicator.calculate,
  },
  {
    id: 'wma',
    name: 'Weighted Moving Average (WMA)',
    shortName: 'WMA',
    description: 'A moving average with linearly increasing weights.',
    category: 'Moving Averages',
    overlay: true,
    metadata: wmaIndicator.metadata,
    inputConfig: wmaIndicator.inputConfig as InputConfig[],
    plotConfig: wmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...wmaIndicator.defaultInputs },
    calculate: wmaIndicator.calculate,
  },
  {
    id: 'donchian',
    name: 'Donchian Channels (DC)',
    shortName: 'DC',
    description: 'Shows the highest high and lowest low over a period, used for breakout trading.',
    category: 'Channels & Bands',
    overlay: true,
    metadata: donchianIndicator.metadata,
    inputConfig: donchianIndicator.inputConfig as InputConfig[],
    plotConfig: donchianIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...donchianIndicator.defaultInputs },
    calculate: donchianIndicator.calculate,
  },
  {
    id: 'parabolic-sar',
    name: 'Parabolic SAR',
    shortName: 'SAR',
    description: 'A trend-following indicator that provides potential entry and exit points.',
    category: 'Trend',
    overlay: true,
    metadata: parabolicSarIndicator.metadata,
    inputConfig: parabolicSarIndicator.inputConfig as InputConfig[],
    plotConfig: parabolicSarIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...parabolicSarIndicator.defaultInputs },
    calculate: parabolicSarIndicator.calculate,
  },
  {
    id: 'supertrend',
    name: 'Supertrend',
    shortName: 'ST',
    description: 'A trend-following overlay that uses ATR to calculate dynamic support/resistance.',
    category: 'Trend',
    overlay: true,
    metadata: supertrendIndicator.metadata,
    inputConfig: supertrendIndicator.inputConfig as InputConfig[],
    plotConfig: supertrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...supertrendIndicator.defaultInputs },
    calculate: supertrendIndicator.calculate,
  },
  {
    id: 'adx',
    name: 'Average Directional Index (ADX)',
    shortName: 'ADX',
    description: 'Measures trend strength regardless of direction.',
    category: 'Trend',
    overlay: false,
    metadata: adxIndicator.metadata,
    inputConfig: adxIndicator.inputConfig as InputConfig[],
    plotConfig: adxIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...adxIndicator.defaultInputs },
    calculate: adxIndicator.calculate,
  },
  {
    id: 'awesome-oscillator',
    name: 'Awesome Oscillator',
    shortName: 'AO',
    description: 'Shows market momentum using SMA difference.',
    category: 'Oscillators',
    overlay: false,
    metadata: awesomeOscIndicator.metadata,
    inputConfig: awesomeOscIndicator.inputConfig as InputConfig[],
    plotConfig: awesomeOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...awesomeOscIndicator.defaultInputs },
    calculate: awesomeOscIndicator.calculate,
  },
  {
    id: 'bbtrend',
    name: 'BBTrend',
    shortName: 'BBT',
    description: 'Measures trend using Bollinger Bands.',
    category: 'Trend',
    overlay: false,
    metadata: bbtrendIndicator.metadata,
    inputConfig: bbtrendIndicator.inputConfig as InputConfig[],
    plotConfig: bbtrendIndicator.plotConfig as PlotConfig[],
    hlineConfig: bbtrendIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...bbtrendIndicator.defaultInputs },
    calculate: bbtrendIndicator.calculate,
  },
  {
    id: 'bull-bear-power',
    name: 'Bull Bear Power',
    shortName: 'BBP',
    description: 'Measures buying/selling pressure relative to EMA.',
    category: 'Momentum',
    overlay: false,
    metadata: bullBearPowerIndicator.metadata,
    inputConfig: bullBearPowerIndicator.inputConfig as InputConfig[],
    plotConfig: bullBearPowerIndicator.plotConfig as PlotConfig[],
    hlineConfig: bullBearPowerIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...bullBearPowerIndicator.defaultInputs },
    calculate: bullBearPowerIndicator.calculate,
  },
  {
    id: 'chande-mo',
    name: 'Chande Momentum Oscillator',
    shortName: 'CMO',
    description: 'Measures momentum on a scale of -100 to +100.',
    category: 'Oscillators',
    overlay: false,
    metadata: chandeMOIndicator.metadata,
    inputConfig: chandeMOIndicator.inputConfig as InputConfig[],
    plotConfig: chandeMOIndicator.plotConfig as PlotConfig[],
    hlineConfig: chandeMOIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...chandeMOIndicator.defaultInputs },
    calculate: chandeMOIndicator.calculate,
  },
  {
    id: 'dpo',
    name: 'Detrended Price Oscillator',
    shortName: 'DPO',
    description: 'Removes trend to identify cycles.',
    category: 'Oscillators',
    overlay: false,
    metadata: dpoIndicator.metadata,
    inputConfig: dpoIndicator.inputConfig as InputConfig[],
    plotConfig: dpoIndicator.plotConfig as PlotConfig[],
    hlineConfig: dpoIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...dpoIndicator.defaultInputs },
    calculate: dpoIndicator.calculate,
  },
  {
    id: 'elder-force',
    name: 'Elder Force Index',
    shortName: 'EFI',
    description: 'Combines price and volume for force measurement.',
    category: 'Momentum',
    overlay: false,
    metadata: elderForceIndicator.metadata,
    inputConfig: elderForceIndicator.inputConfig as InputConfig[],
    plotConfig: elderForceIndicator.plotConfig as PlotConfig[],
    hlineConfig: elderForceIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...elderForceIndicator.defaultInputs },
    calculate: elderForceIndicator.calculate,
  },
  {
    id: 'hist-volatility',
    name: 'Historical Volatility',
    shortName: 'HV',
    description: 'Annualized standard deviation of log returns.',
    category: 'Volatility',
    overlay: false,
    metadata: histVolIndicator.metadata,
    inputConfig: histVolIndicator.inputConfig as InputConfig[],
    plotConfig: histVolIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...histVolIndicator.defaultInputs },
    calculate: histVolIndicator.calculate,
  },
  {
    id: 'ma-cross',
    name: 'MA Cross',
    shortName: 'MAC',
    description: 'Two moving averages for crossover signals.',
    category: 'Moving Averages',
    overlay: true,
    metadata: maCrossIndicator.metadata,
    inputConfig: maCrossIndicator.inputConfig as InputConfig[],
    plotConfig: maCrossIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maCrossIndicator.defaultInputs },
    calculate: maCrossIndicator.calculate,
  },
  {
    id: 'ma-ribbon',
    name: 'Moving Average Ribbon',
    shortName: 'MA Ribbon',
    description: 'Multiple moving averages showing trend direction and momentum.',
    category: 'Moving Averages',
    overlay: true,
    metadata: maRibbonIndicator.metadata,
    inputConfig: maRibbonIndicator.inputConfig as InputConfig[],
    plotConfig: maRibbonIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maRibbonIndicator.defaultInputs },
    calculate: maRibbonIndicator.calculate,
  },
  {
    id: 'median',
    name: 'Median',
    shortName: 'MED',
    description: 'Median price with ATR bands.',
    category: 'Channels & Bands',
    overlay: true,
    metadata: medianIndicator.metadata,
    inputConfig: medianIndicator.inputConfig as InputConfig[],
    plotConfig: medianIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...medianIndicator.defaultInputs },
    calculate: medianIndicator.calculate,
  },
  {
    id: 'mfi',
    name: 'Money Flow Index',
    shortName: 'MFI',
    description: 'Volume-weighted RSI measuring buying/selling pressure.',
    category: 'Volume',
    overlay: false,
    metadata: mfiIndicator.metadata,
    inputConfig: mfiIndicator.inputConfig as InputConfig[],
    plotConfig: mfiIndicator.plotConfig as PlotConfig[],
    hlineConfig: mfiIndicator.hlineConfig as HLineConfig[],
    fillConfig: mfiIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...mfiIndicator.defaultInputs },
    calculate: mfiIndicator.calculate,
  },
  {
    id: 'pvt',
    name: 'Price Volume Trend',
    shortName: 'PVT',
    description: 'Cumulative volume weighted by price changes.',
    category: 'Volume',
    overlay: false,
    metadata: pvtIndicator.metadata,
    inputConfig: pvtIndicator.inputConfig as InputConfig[],
    plotConfig: pvtIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...pvtIndicator.defaultInputs },
    calculate: pvtIndicator.calculate,
  },
  {
    id: 'rvi',
    name: 'Relative Vigor Index',
    shortName: 'RVI',
    description: 'Measures conviction of price action.',
    category: 'Oscillators',
    overlay: false,
    metadata: rviIndicator.metadata,
    inputConfig: rviIndicator.inputConfig as InputConfig[],
    plotConfig: rviIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rviIndicator.defaultInputs },
    calculate: rviIndicator.calculate,
  },
  {
    id: 'smi-ergodic',
    name: 'SMI Ergodic Indicator',
    shortName: 'SMII',
    description: 'TSI-based momentum oscillator with signal line.',
    category: 'Oscillators',
    overlay: false,
    metadata: smiErgodicIndicator.metadata,
    inputConfig: smiErgodicIndicator.inputConfig as InputConfig[],
    plotConfig: smiErgodicIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smiErgodicIndicator.defaultInputs },
    calculate: smiErgodicIndicator.calculate,
  },
  {
    id: 'smi-ergodic-osc',
    name: 'SMI Ergodic Oscillator',
    shortName: 'SMIO',
    description: 'Difference between SMI and signal as histogram.',
    category: 'Oscillators',
    overlay: false,
    metadata: smiErgodicOscIndicator.metadata,
    inputConfig: smiErgodicOscIndicator.inputConfig as InputConfig[],
    plotConfig: smiErgodicOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smiErgodicOscIndicator.defaultInputs },
    calculate: smiErgodicOscIndicator.calculate,
  },
  {
    id: 'smma',
    name: 'Smoothed Moving Average',
    shortName: 'SMMA',
    description: 'Wilder smoothing moving average.',
    category: 'Moving Averages',
    overlay: true,
    metadata: smmaIndicator.metadata,
    inputConfig: smmaIndicator.inputConfig as InputConfig[],
    plotConfig: smmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smmaIndicator.defaultInputs },
    calculate: smmaIndicator.calculate,
  },
  {
    id: 'stdev',
    name: 'Standard Deviation',
    shortName: 'StDev',
    description: 'Measures price volatility.',
    category: 'Volatility',
    overlay: false,
    metadata: stdevIndicator.metadata,
    inputConfig: stdevIndicator.inputConfig as InputConfig[],
    plotConfig: stdevIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...stdevIndicator.defaultInputs },
    calculate: stdevIndicator.calculate,
  },
  {
    id: 'stoch-rsi',
    name: 'Stochastic RSI',
    shortName: 'StochRSI',
    description: 'Stochastic applied to RSI values.',
    category: 'Oscillators',
    overlay: false,
    metadata: stochRsiIndicator.metadata,
    inputConfig: stochRsiIndicator.inputConfig as InputConfig[],
    plotConfig: stochRsiIndicator.plotConfig as PlotConfig[],
    hlineConfig: stochRsiIndicator.hlineConfig as HLineConfig[],
    fillConfig: stochRsiIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...stochRsiIndicator.defaultInputs },
    calculate: stochRsiIndicator.calculate,
  },
  {
    id: 'trend-strength',
    name: 'Trend Strength Index',
    shortName: 'TrStr',
    description: 'Measures trend strength based on directional movement.',
    category: 'Trend',
    overlay: false,
    metadata: trendStrengthIndicator.metadata,
    inputConfig: trendStrengthIndicator.inputConfig as InputConfig[],
    plotConfig: trendStrengthIndicator.plotConfig as PlotConfig[],
    hlineConfig: trendStrengthIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...trendStrengthIndicator.defaultInputs },
    calculate: trendStrengthIndicator.calculate,
  },
  {
    id: 'tsi',
    name: 'True Strength Index',
    shortName: 'TSI',
    description: 'Double-smoothed momentum oscillator.',
    category: 'Oscillators',
    overlay: false,
    metadata: tsiIndicator.metadata,
    inputConfig: tsiIndicator.inputConfig as InputConfig[],
    plotConfig: tsiIndicator.plotConfig as PlotConfig[],
    hlineConfig: tsiIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...tsiIndicator.defaultInputs },
    calculate: tsiIndicator.calculate,
  },
  {
    id: 'volume-osc',
    name: 'Volume Oscillator',
    shortName: 'VO',
    description: 'Percentage difference between volume EMAs.',
    category: 'Volume',
    overlay: false,
    metadata: volumeOscIndicator.metadata,
    inputConfig: volumeOscIndicator.inputConfig as InputConfig[],
    plotConfig: volumeOscIndicator.plotConfig as PlotConfig[],
    hlineConfig: volumeOscIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...volumeOscIndicator.defaultInputs },
    calculate: volumeOscIndicator.calculate,
  },
  {
    id: 'vortex',
    name: 'Vortex Indicator',
    shortName: 'VI',
    description: 'Identifies trend start and direction.',
    category: 'Trend',
    overlay: false,
    metadata: vortexIndicator.metadata,
    inputConfig: vortexIndicator.inputConfig as InputConfig[],
    plotConfig: vortexIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vortexIndicator.defaultInputs },
    calculate: vortexIndicator.calculate,
  },
  {
    id: 'williams-alligator',
    name: 'Williams Alligator',
    shortName: 'Alligator',
    description: 'Three smoothed moving averages for trend detection.',
    category: 'Trend',
    overlay: true,
    metadata: williamsAlligatorIndicator.metadata,
    inputConfig: williamsAlligatorIndicator.inputConfig as InputConfig[],
    plotConfig: williamsAlligatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...williamsAlligatorIndicator.defaultInputs },
    calculate: williamsAlligatorIndicator.calculate,
  },
  {
    id: 'williams-r',
    name: 'Williams %R',
    shortName: '%R',
    description: 'Momentum indicator showing overbought/oversold levels.',
    category: 'Oscillators',
    overlay: false,
    metadata: williamsRIndicator.metadata,
    inputConfig: williamsRIndicator.inputConfig as InputConfig[],
    plotConfig: williamsRIndicator.plotConfig as PlotConfig[],
    hlineConfig: williamsRIndicator.hlineConfig as HLineConfig[],
    fillConfig: williamsRIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...williamsRIndicator.defaultInputs },
    calculate: williamsRIndicator.calculate,
  },
  {
    id: 'woodies-cci',
    name: 'Woodies CCI',
    shortName: 'WCCI',
    description: 'CCI with turbo for faster signals.',
    category: 'Oscillators',
    overlay: false,
    metadata: woodiesCCIIndicator.metadata,
    inputConfig: woodiesCCIIndicator.inputConfig as InputConfig[],
    plotConfig: woodiesCCIIndicator.plotConfig as PlotConfig[],
    hlineConfig: woodiesCCIIndicator.hlineConfig as HLineConfig[],
    fillConfig: woodiesCCIIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...woodiesCCIIndicator.defaultInputs },
    calculate: woodiesCCIIndicator.calculate,
  },
  {
    id: 'bb-percent-b',
    name: 'Bollinger Bands %B',
    shortName: 'BB%B',
    description: 'Shows where price is relative to Bollinger Bands (0 = lower, 1 = upper).',
    category: 'Oscillators',
    overlay: false,
    metadata: bbPercentBIndicator.metadata,
    inputConfig: bbPercentBIndicator.inputConfig as InputConfig[],
    plotConfig: bbPercentBIndicator.plotConfig as PlotConfig[],
    hlineConfig: bbPercentBIndicator.hlineConfig as HLineConfig[],
    fillConfig: bbPercentBIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...bbPercentBIndicator.defaultInputs },
    calculate: bbPercentBIndicator.calculate,
  },
  {
    id: 'bb-bandwidth',
    name: 'Bollinger BandWidth',
    shortName: 'BBW',
    description: 'Measures the width of Bollinger Bands as a percentage.',
    category: 'Volatility',
    overlay: false,
    metadata: bbBandwidthIndicator.metadata,
    inputConfig: bbBandwidthIndicator.inputConfig as InputConfig[],
    plotConfig: bbBandwidthIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bbBandwidthIndicator.defaultInputs },
    calculate: bbBandwidthIndicator.calculate,
  },
  {
    id: 'chaikin-mf',
    name: 'Chaikin Money Flow',
    shortName: 'CMF',
    description: 'Measures buying/selling pressure using price and volume.',
    category: 'Volume',
    overlay: false,
    metadata: chaikinMFIndicator.metadata,
    inputConfig: chaikinMFIndicator.inputConfig as InputConfig[],
    plotConfig: chaikinMFIndicator.plotConfig as PlotConfig[],
    hlineConfig: chaikinMFIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...chaikinMFIndicator.defaultInputs },
    calculate: chaikinMFIndicator.calculate,
  },
  {
    id: 'envelope',
    name: 'Envelope',
    shortName: 'Env',
    description: 'Moving average with fixed percentage bands.',
    category: 'Channels & Bands',
    overlay: true,
    metadata: envelopeIndicator.metadata,
    inputConfig: envelopeIndicator.inputConfig as InputConfig[],
    plotConfig: envelopeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...envelopeIndicator.defaultInputs },
    calculate: envelopeIndicator.calculate,
  },
  {
    id: 'price-oscillator',
    name: 'Price Oscillator (PPO)',
    shortName: 'PPO',
    description: 'MACD expressed as a percentage for cross-security comparison.',
    category: 'Momentum',
    overlay: false,
    metadata: priceOscillatorIndicator.metadata,
    inputConfig: priceOscillatorIndicator.inputConfig as InputConfig[],
    plotConfig: priceOscillatorIndicator.plotConfig as PlotConfig[],
    hlineConfig: priceOscillatorIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...priceOscillatorIndicator.defaultInputs },
    calculate: priceOscillatorIndicator.calculate,
  },
  {
    id: 'aroon',
    name: 'Aroon',
    shortName: 'Aroon',
    description: 'Identifies trend strength by measuring time since highest/lowest.',
    category: 'Trend',
    overlay: false,
    metadata: aroonIndicator.metadata,
    inputConfig: aroonIndicator.inputConfig as InputConfig[],
    plotConfig: aroonIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...aroonIndicator.defaultInputs },
    calculate: aroonIndicator.calculate,
  },
  {
    id: 'coppock-curve',
    name: 'Coppock Curve',
    shortName: 'Coppock',
    description: 'Long-term momentum indicator using ROC and WMA.',
    category: 'Momentum',
    overlay: false,
    metadata: coppockCurveIndicator.metadata,
    inputConfig: coppockCurveIndicator.inputConfig as InputConfig[],
    plotConfig: coppockCurveIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...coppockCurveIndicator.defaultInputs },
    calculate: coppockCurveIndicator.calculate,
  },
  {
    id: 'choppiness',
    name: 'Choppiness Index',
    shortName: 'CHOP',
    description: 'Measures market choppiness vs trending (high = choppy).',
    category: 'Trend',
    overlay: false,
    metadata: choppinessIndicator.metadata,
    inputConfig: choppinessIndicator.inputConfig as InputConfig[],
    plotConfig: choppinessIndicator.plotConfig as PlotConfig[],
    hlineConfig: choppinessIndicator.hlineConfig as HLineConfig[],
    fillConfig: choppinessIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...choppinessIndicator.defaultInputs },
    calculate: choppinessIndicator.calculate,
  },
  {
    id: 'eom',
    name: 'Ease of Movement',
    shortName: 'EOM',
    description: 'Relates price change to volume, showing ease of price movement.',
    category: 'Volume',
    overlay: false,
    metadata: eomIndicator.metadata,
    inputConfig: eomIndicator.inputConfig as InputConfig[],
    plotConfig: eomIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...eomIndicator.defaultInputs },
    calculate: eomIndicator.calculate,
  },
  {
    id: 'chaikin-osc',
    name: 'Chaikin Oscillator',
    shortName: 'Chaikin',
    description: 'Momentum of the Accumulation/Distribution line.',
    category: 'Volume',
    overlay: false,
    metadata: chaikinOscIndicator.metadata,
    inputConfig: chaikinOscIndicator.inputConfig as InputConfig[],
    plotConfig: chaikinOscIndicator.plotConfig as PlotConfig[],
    hlineConfig: chaikinOscIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...chaikinOscIndicator.defaultInputs },
    calculate: chaikinOscIndicator.calculate,
  },
  {
    id: 'zigzag',
    name: 'Zig Zag',
    shortName: 'ZigZag',
    description: 'Identifies trend reversals by connecting pivot highs and lows.',
    category: 'Trend',
    overlay: true,
    metadata: zigzagIndicator.metadata,
    inputConfig: zigzagIndicator.inputConfig as InputConfig[],
    plotConfig: zigzagIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...zigzagIndicator.defaultInputs },
    calculate: zigzagIndicator.calculate,
  },
  {
    id: 'fisher-transform',
    name: 'Fisher Transform',
    shortName: 'Fisher',
    description: 'Converts prices into a Gaussian normal distribution for clearer turning points.',
    category: 'Oscillators',
    overlay: false,
    metadata: fisherTransformIndicator.metadata,
    inputConfig: fisherTransformIndicator.inputConfig as InputConfig[],
    plotConfig: fisherTransformIndicator.plotConfig as PlotConfig[],
    hlineConfig: fisherTransformIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...fisherTransformIndicator.defaultInputs },
    calculate: fisherTransformIndicator.calculate,
  },
  {
    id: 'trix',
    name: 'TRIX',
    shortName: 'TRIX',
    description: 'Triple exponential average rate of change, filters out noise.',
    category: 'Momentum',
    overlay: false,
    metadata: trixIndicator.metadata,
    inputConfig: trixIndicator.inputConfig as InputConfig[],
    plotConfig: trixIndicator.plotConfig as PlotConfig[],
    hlineConfig: trixIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...trixIndicator.defaultInputs },
    calculate: trixIndicator.calculate,
  },
  {
    id: 'dmi',
    name: 'Directional Movement Index',
    shortName: 'DMI',
    description: 'Shows trend direction and strength with +DI, -DI, and ADX.',
    category: 'Trend',
    overlay: false,
    metadata: dmiIndicator.metadata,
    inputConfig: dmiIndicator.inputConfig as InputConfig[],
    plotConfig: dmiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...dmiIndicator.defaultInputs },
    calculate: dmiIndicator.calculate,
  },
  {
    id: 'klinger',
    name: 'Klinger Oscillator',
    shortName: 'KVO',
    description: 'Volume-based oscillator measuring long-term money flow.',
    category: 'Volume',
    overlay: false,
    metadata: klingerIndicator.metadata,
    inputConfig: klingerIndicator.inputConfig as InputConfig[],
    plotConfig: klingerIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...klingerIndicator.defaultInputs },
    calculate: klingerIndicator.calculate,
  },
  {
    id: 'ultimate-osc',
    name: 'Ultimate Oscillator',
    shortName: 'UO',
    description: 'Multi-timeframe momentum oscillator using weighted averages.',
    category: 'Oscillators',
    overlay: false,
    metadata: ultimateOscIndicator.metadata,
    inputConfig: ultimateOscIndicator.inputConfig as InputConfig[],
    plotConfig: ultimateOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ultimateOscIndicator.defaultInputs },
    calculate: ultimateOscIndicator.calculate,
  },
  {
    id: 'chande-kroll-stop',
    name: 'Chande Kroll Stop',
    shortName: 'CKS',
    description: 'ATR-based trailing stop system for long and short positions.',
    category: 'Trend',
    overlay: true,
    metadata: chandeKrollStopIndicator.metadata,
    inputConfig: chandeKrollStopIndicator.inputConfig as InputConfig[],
    plotConfig: chandeKrollStopIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...chandeKrollStopIndicator.defaultInputs },
    calculate: chandeKrollStopIndicator.calculate,
  },
  {
    id: 'relative-volume-at-time',
    name: 'Relative Volume at Time',
    shortName: 'RelVol',
    description: 'Compares current volume to historical average at the same time of day.',
    category: 'Volume',
    overlay: false,
    metadata: relativeVolumeAtTimeIndicator.metadata,
    inputConfig: relativeVolumeAtTimeIndicator.inputConfig as InputConfig[],
    plotConfig: relativeVolumeAtTimeIndicator.plotConfig as PlotConfig[],
    hlineConfig: relativeVolumeAtTimeIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...relativeVolumeAtTimeIndicator.defaultInputs },
    calculate: relativeVolumeAtTimeIndicator.calculate,
  },
  {
    id: 'rci-ribbon',
    name: 'RCI Ribbon',
    shortName: 'RCIR',
    description: 'Three Rank Correlation Index lines measuring directional consistency.',
    category: 'Oscillators',
    overlay: false,
    metadata: rciRibbonIndicator.metadata,
    inputConfig: rciRibbonIndicator.inputConfig as InputConfig[],
    plotConfig: rciRibbonIndicator.plotConfig as PlotConfig[],
    hlineConfig: rciRibbonIndicator.hlineConfig as HLineConfig[],
    fillConfig: rciRibbonIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...rciRibbonIndicator.defaultInputs },
    calculate: rciRibbonIndicator.calculate,
  },
  {
    id: 'volume-delta',
    name: 'Volume Delta',
    shortName: 'Vol Δ',
    description: 'Shows buying vs selling pressure based on close-open comparison.',
    category: 'Volume',
    overlay: false,
    metadata: volumeDeltaIndicator.metadata,
    inputConfig: volumeDeltaIndicator.inputConfig as InputConfig[],
    plotConfig: volumeDeltaIndicator.plotConfig as PlotConfig[],
    plotCandleConfig: volumeDeltaIndicator.plotCandleConfig,
    hlineConfig: volumeDeltaIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...volumeDeltaIndicator.defaultInputs },
    calculate: volumeDeltaIndicator.calculate,
  },
  {
    id: 'cvd',
    name: 'Cumulative Volume Delta',
    shortName: 'CVD',
    description: 'Cumulative volume delta within anchor periods.',
    category: 'Volume',
    overlay: false,
    metadata: cumulativeVolumeDeltaIndicator.metadata,
    inputConfig: cumulativeVolumeDeltaIndicator.inputConfig as InputConfig[],
    plotConfig: cumulativeVolumeDeltaIndicator.plotConfig as PlotConfig[],
    plotCandleConfig: cumulativeVolumeDeltaIndicator.plotCandleConfig,
    hlineConfig: cumulativeVolumeDeltaIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...cumulativeVolumeDeltaIndicator.defaultInputs },
    calculate: cumulativeVolumeDeltaIndicator.calculate,
  },
  {
    id: 'net-volume',
    name: 'Net Volume',
    shortName: 'Net Vol',
    description: 'Net volume (up - down) per bar.',
    category: 'Volume',
    overlay: false,
    metadata: netVolumeIndicator.metadata,
    inputConfig: netVolumeIndicator.inputConfig as InputConfig[],
    plotConfig: netVolumeIndicator.plotConfig as PlotConfig[],
    hlineConfig: netVolumeIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...netVolumeIndicator.defaultInputs },
    calculate: netVolumeIndicator.calculate,
  },
  {
    id: 'kst',
    name: 'Know Sure Thing (KST)',
    shortName: 'KST',
    description: 'Momentum oscillator based on rate of change for four timeframes.',
    category: 'Momentum',
    overlay: false,
    metadata: kstIndicator.metadata,
    inputConfig: kstIndicator.inputConfig as InputConfig[],
    plotConfig: kstIndicator.plotConfig as PlotConfig[],
    hlineConfig: kstIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...kstIndicator.defaultInputs },
    calculate: kstIndicator.calculate,
  },
  {
    id: 'connors-rsi',
    name: 'Connors RSI',
    shortName: 'CRSI',
    description: 'Composite momentum oscillator combining RSI, streak RSI, and percent rank.',
    category: 'Oscillators',
    overlay: false,
    metadata: connorsRsiIndicator.metadata,
    inputConfig: connorsRsiIndicator.inputConfig as InputConfig[],
    plotConfig: connorsRsiIndicator.plotConfig as PlotConfig[],
    hlineConfig: connorsRsiIndicator.hlineConfig as HLineConfig[],
    fillConfig: connorsRsiIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...connorsRsiIndicator.defaultInputs },
    calculate: connorsRsiIndicator.calculate,
  },
  {
    id: 'chop-zone',
    name: 'Chop Zone',
    shortName: 'ChopZ',
    description: 'Uses EMA angle to determine trending vs choppy conditions.',
    category: 'Trend',
    overlay: false,
    metadata: chopZoneIndicator.metadata,
    inputConfig: chopZoneIndicator.inputConfig as InputConfig[],
    plotConfig: chopZoneIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...chopZoneIndicator.defaultInputs },
    calculate: chopZoneIndicator.calculate,
  },
  {
    id: 'rci',
    name: 'Rank Correlation Index (RCI)',
    shortName: 'RCI',
    description: 'Measures directional consistency using Spearman rank correlation.',
    category: 'Oscillators',
    overlay: false,
    metadata: rciIndicator.metadata,
    inputConfig: rciIndicator.inputConfig as InputConfig[],
    plotConfig: rciIndicator.plotConfig as PlotConfig[],
    hlineConfig: rciIndicator.hlineConfig as HLineConfig[],
    fillConfig: rciIndicator.fillConfig as FillConfig[],
    defaultInputs: { ...rciIndicator.defaultInputs },
    calculate: rciIndicator.calculate,
  },
  {
    id: 'rvol',
    name: 'Relative Volatility Index',
    shortName: 'RVol',
    description: 'Measures volatility direction using standard deviation and EMA.',
    category: 'Volatility',
    overlay: false,
    metadata: relativeVolatilityIndexIndicator.metadata,
    inputConfig: relativeVolatilityIndexIndicator.inputConfig as InputConfig[],
    plotConfig: relativeVolatilityIndexIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...relativeVolatilityIndexIndicator.defaultInputs },
    calculate: relativeVolatilityIndexIndicator.calculate,
  },
  {
    id: 'williams-fractals',
    name: 'Williams Fractals',
    shortName: 'Fractals',
    description: 'Identifies fractal highs and lows in price action.',
    category: 'Trend',
    overlay: true,
    metadata: williamsFractalsIndicator.metadata,
    inputConfig: williamsFractalsIndicator.inputConfig as InputConfig[],
    plotConfig: williamsFractalsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...williamsFractalsIndicator.defaultInputs },
    calculate: williamsFractalsIndicator.calculate,
  },
  {
    id: 'twap',
    name: 'Time Weighted Average Price (TWAP)',
    shortName: 'TWAP',
    description: 'Cumulative average of ohlc4 within anchor period.',
    category: 'Moving Averages',
    overlay: true,
    metadata: twapIndicator.metadata,
    inputConfig: twapIndicator.inputConfig as InputConfig[],
    plotConfig: twapIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...twapIndicator.defaultInputs },
    calculate: twapIndicator.calculate,
  },
  {
    id: 'bb-bars',
    name: 'Bollinger Bars',
    shortName: 'BB Bars',
    description: 'Visual candle indicator with colored wick and body layers.',
    category: 'Volatility',
    overlay: true,
    metadata: bollingerBarsIndicator.metadata,
    inputConfig: bollingerBarsIndicator.inputConfig as InputConfig[],
    plotConfig: bollingerBarsIndicator.plotConfig as PlotConfig[],
    plotCandleConfig: bollingerBarsIndicator.plotCandleConfig,
    defaultInputs: { ...bollingerBarsIndicator.defaultInputs },
    calculate: bollingerBarsIndicator.calculate,
  },
  {
    id: 'moon-phases',
    name: 'Moon Phases',
    shortName: 'Moon',
    description: 'Displays new moon and full moon phases using astronomical calculations.',
    category: 'Trend',
    overlay: true,
    metadata: moonPhasesIndicator.metadata,
    inputConfig: moonPhasesIndicator.inputConfig as InputConfig[],
    plotConfig: moonPhasesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...moonPhasesIndicator.defaultInputs },
    calculate: moonPhasesIndicator.calculate,
  },
  // --- Wave 1 Community Indicators ---
  {
    id: 'zlsma',
    name: 'Zero Lag LSMA (ZLSMA)',
    shortName: 'ZLSMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: zlsmaIndicator.metadata,
    inputConfig: zlsmaIndicator.inputConfig as InputConfig[],
    plotConfig: zlsmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...zlsmaIndicator.defaultInputs },
    calculate: zlsmaIndicator.calculate,
  },
  {
    id: 'forecast-oscillator',
    name: 'Forecast Oscillator',
    shortName: 'FOSC',
    category: 'Oscillators',
    overlay: false,
    metadata: forecastOscillatorIndicator.metadata,
    inputConfig: forecastOscillatorIndicator.inputConfig as InputConfig[],
    plotConfig: forecastOscillatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...forecastOscillatorIndicator.defaultInputs },
    calculate: forecastOscillatorIndicator.calculate,
  },
  {
    id: 'cct-bbo',
    name: 'CCT Bollinger Band Oscillator',
    shortName: 'CCTBBO',
    category: 'Oscillators',
    overlay: false,
    metadata: cctbboIndicator.metadata,
    inputConfig: cctbboIndicator.inputConfig as InputConfig[],
    plotConfig: cctbboIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cctbboIndicator.defaultInputs },
    calculate: cctbboIndicator.calculate,
  },
  {
    id: 'macd-4c',
    name: 'MACD 4C',
    shortName: 'MACD4C',
    category: 'Momentum',
    overlay: false,
    metadata: macd4cIndicator.metadata,
    inputConfig: macd4cIndicator.inputConfig as InputConfig[],
    plotConfig: macd4cIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macd4cIndicator.defaultInputs },
    calculate: macd4cIndicator.calculate,
  },
  {
    id: 'colored-volume',
    name: 'Colored Volume Bars',
    shortName: 'CVolBars',
    category: 'Volume',
    overlay: false,
    metadata: coloredVolumeIndicator.metadata,
    inputConfig: coloredVolumeIndicator.inputConfig as InputConfig[],
    plotConfig: coloredVolumeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...coloredVolumeIndicator.defaultInputs },
    calculate: coloredVolumeIndicator.calculate,
  },
  {
    id: 'kdj',
    name: 'KDJ',
    shortName: 'KDJ',
    category: 'Oscillators',
    overlay: false,
    metadata: kdjIndicator.metadata,
    inputConfig: kdjIndicator.inputConfig as InputConfig[],
    plotConfig: kdjIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...kdjIndicator.defaultInputs },
    calculate: kdjIndicator.calculate,
  },
  {
    id: 'wavetrend',
    name: 'WaveTrend',
    shortName: 'WT',
    category: 'Oscillators',
    overlay: false,
    metadata: waveTrendIndicator.metadata,
    inputConfig: waveTrendIndicator.inputConfig as InputConfig[],
    plotConfig: waveTrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...waveTrendIndicator.defaultInputs },
    calculate: waveTrendIndicator.calculate,
  },
  {
    id: 'squeeze-momentum',
    name: 'Squeeze Momentum',
    shortName: 'SQZMOM',
    category: 'Momentum',
    overlay: false,
    metadata: squeezeMomentumIndicator.metadata,
    inputConfig: squeezeMomentumIndicator.inputConfig as InputConfig[],
    plotConfig: squeezeMomentumIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...squeezeMomentumIndicator.defaultInputs },
    calculate: squeezeMomentumIndicator.calculate,
  },
  {
    id: 'coral-trend',
    name: 'Coral Trend',
    shortName: 'Coral',
    category: 'Trend',
    overlay: true,
    metadata: coralTrendIndicator.metadata,
    inputConfig: coralTrendIndicator.inputConfig as InputConfig[],
    plotConfig: coralTrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...coralTrendIndicator.defaultInputs },
    calculate: coralTrendIndicator.calculate,
  },
  {
    id: 'chandelier-exit',
    name: 'Chandelier Exit',
    shortName: 'CE',
    category: 'Trend',
    overlay: true,
    metadata: chandelierExitIndicator.metadata,
    inputConfig: chandelierExitIndicator.inputConfig as InputConfig[],
    plotConfig: chandelierExitIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...chandelierExitIndicator.defaultInputs },
    calculate: chandelierExitIndicator.calculate,
  },
  {
    id: 'impulse-macd',
    name: 'Impulse MACD',
    shortName: 'IMACD',
    category: 'Momentum',
    overlay: false,
    metadata: impulseMacdIndicator.metadata,
    inputConfig: impulseMacdIndicator.inputConfig as InputConfig[],
    plotConfig: impulseMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...impulseMacdIndicator.defaultInputs },
    calculate: impulseMacdIndicator.calculate,
  },
  {
    id: 'schaff-trend-cycle',
    name: 'Schaff Trend Cycle',
    shortName: 'STC',
    category: 'Oscillators',
    overlay: false,
    metadata: schaffTrendCycleIndicator.metadata,
    inputConfig: schaffTrendCycleIndicator.inputConfig as InputConfig[],
    plotConfig: schaffTrendCycleIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...schaffTrendCycleIndicator.defaultInputs },
    calculate: schaffTrendCycleIndicator.calculate,
  },
  {
    id: 'donchian-trend-ribbon',
    name: 'Donchian Trend Ribbon',
    shortName: 'DTR',
    category: 'Trend',
    overlay: false,
    metadata: donchianTrendRibbonIndicator.metadata,
    inputConfig: donchianTrendRibbonIndicator.inputConfig as InputConfig[],
    plotConfig: donchianTrendRibbonIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...donchianTrendRibbonIndicator.defaultInputs },
    calculate: donchianTrendRibbonIndicator.calculate,
  },
  {
    id: 'obv-macd',
    name: 'OBV MACD',
    shortName: 'OBVMACD',
    category: 'Volume',
    overlay: false,
    metadata: obvMacdIndicator.metadata,
    inputConfig: obvMacdIndicator.inputConfig as InputConfig[],
    plotConfig: obvMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...obvMacdIndicator.defaultInputs },
    calculate: obvMacdIndicator.calculate,
  },
  {
    id: 'alpha-trend',
    name: 'AlphaTrend',
    shortName: 'AT',
    category: 'Trend',
    overlay: true,
    metadata: alphaTrendIndicator.metadata,
    inputConfig: alphaTrendIndicator.inputConfig as InputConfig[],
    plotConfig: alphaTrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...alphaTrendIndicator.defaultInputs },
    calculate: alphaTrendIndicator.calculate,
  },
  {
    id: 'half-trend',
    name: 'HalfTrend',
    shortName: 'HT',
    category: 'Trend',
    overlay: true,
    metadata: halfTrendIndicator.metadata,
    inputConfig: halfTrendIndicator.inputConfig as InputConfig[],
    plotConfig: halfTrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...halfTrendIndicator.defaultInputs },
    calculate: halfTrendIndicator.calculate,
  },
  {
    id: 'qqe-mod',
    name: 'QQE MOD',
    shortName: 'QQEM',
    category: 'Momentum',
    overlay: false,
    metadata: qqeModIndicator.metadata,
    inputConfig: qqeModIndicator.inputConfig as InputConfig[],
    plotConfig: qqeModIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...qqeModIndicator.defaultInputs },
    calculate: qqeModIndicator.calculate,
  },
  {
    id: 'follow-line',
    name: 'Follow Line',
    shortName: 'FLI',
    category: 'Trend',
    overlay: true,
    metadata: followLineIndicator.metadata,
    inputConfig: followLineIndicator.inputConfig as InputConfig[],
    plotConfig: followLineIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...followLineIndicator.defaultInputs },
    calculate: followLineIndicator.calculate,
  },
  {
    id: 'ut-bot',
    name: 'UT Bot',
    shortName: 'UTBot',
    category: 'Trend',
    overlay: true,
    metadata: utBotIndicator.metadata,
    inputConfig: utBotIndicator.inputConfig as InputConfig[],
    plotConfig: utBotIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...utBotIndicator.defaultInputs },
    calculate: utBotIndicator.calculate,
  },
  {
    id: 'hull-suite',
    name: 'Hull Suite',
    shortName: 'HS',
    category: 'Trend',
    overlay: true,
    metadata: hullSuiteIndicator.metadata,
    inputConfig: hullSuiteIndicator.inputConfig as InputConfig[],
    plotConfig: hullSuiteIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...hullSuiteIndicator.defaultInputs },
    calculate: hullSuiteIndicator.calculate,
  },
  {
    id: 'optimized-trend-tracker',
    name: 'Optimized Trend Tracker',
    shortName: 'OTT',
    category: 'Trend',
    overlay: true,
    metadata: ottIndicator.metadata,
    inputConfig: ottIndicator.inputConfig as InputConfig[],
    plotConfig: ottIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ottIndicator.defaultInputs },
    calculate: ottIndicator.calculate,
  },
  {
    id: 'trend-magic',
    name: 'Trend Magic',
    shortName: 'TM',
    category: 'Trend',
    overlay: true,
    metadata: trendMagicIndicator.metadata,
    inputConfig: trendMagicIndicator.inputConfig as InputConfig[],
    plotConfig: trendMagicIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...trendMagicIndicator.defaultInputs },
    calculate: trendMagicIndicator.calculate,
  },
  {
    id: 'ssl-channel',
    name: 'SSL Channel',
    shortName: 'SSL',
    category: 'Trend',
    overlay: true,
    metadata: sslChannelIndicator.metadata,
    inputConfig: sslChannelIndicator.inputConfig as InputConfig[],
    plotConfig: sslChannelIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...sslChannelIndicator.defaultInputs },
    calculate: sslChannelIndicator.calculate,
  },
  {
    id: 'mavilimw',
    name: 'MavilimW',
    shortName: 'MAVW',
    category: 'Trend',
    overlay: true,
    metadata: mavilimWIndicator.metadata,
    inputConfig: mavilimWIndicator.inputConfig as InputConfig[],
    plotConfig: mavilimWIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mavilimWIndicator.defaultInputs },
    calculate: mavilimWIndicator.calculate,
  },
  {
    id: 'cdc-action-zone',
    name: 'CDC Action Zone',
    shortName: 'CDC',
    category: 'Trend',
    overlay: true,
    metadata: cdcActionZoneIndicator.metadata,
    inputConfig: cdcActionZoneIndicator.inputConfig as InputConfig[],
    plotConfig: cdcActionZoneIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cdcActionZoneIndicator.defaultInputs },
    calculate: cdcActionZoneIndicator.calculate,
  },
  {
    id: 'tillson-t3',
    name: 'Tillson T3',
    shortName: 'T3',
    category: 'Trend',
    overlay: true,
    metadata: tillsonT3Indicator.metadata,
    inputConfig: tillsonT3Indicator.inputConfig as InputConfig[],
    plotConfig: tillsonT3Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tillsonT3Indicator.defaultInputs },
    calculate: tillsonT3Indicator.calculate,
  },
  {
    id: 'waddah-attar-explosion',
    name: 'Waddah Attar Explosion',
    shortName: 'WAE',
    category: 'Momentum',
    overlay: false,
    metadata: waddahAttarExplosionIndicator.metadata,
    inputConfig: waddahAttarExplosionIndicator.inputConfig as InputConfig[],
    plotConfig: waddahAttarExplosionIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...waddahAttarExplosionIndicator.defaultInputs },
    calculate: waddahAttarExplosionIndicator.calculate,
  },
  {
    id: 'ripster-ema-clouds',
    name: 'Ripster EMA Clouds',
    shortName: 'REC',
    category: 'Trend',
    overlay: true,
    metadata: ripsterEMACloudsIndicator.metadata,
    inputConfig: ripsterEMACloudsIndicator.inputConfig as InputConfig[],
    plotConfig: ripsterEMACloudsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ripsterEMACloudsIndicator.defaultInputs },
    calculate: ripsterEMACloudsIndicator.calculate,
  },
  {
    id: 'premier-rsi',
    name: 'Premier RSI Oscillator',
    shortName: 'PRO',
    category: 'Momentum',
    overlay: false,
    metadata: premierRsiIndicator.metadata,
    inputConfig: premierRsiIndicator.inputConfig as InputConfig[],
    plotConfig: premierRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...premierRsiIndicator.defaultInputs },
    calculate: premierRsiIndicator.calculate,
  },
  {
    id: 'laguerre-rsi',
    name: 'Laguerre RSI',
    shortName: 'LRSI',
    category: 'Momentum',
    overlay: false,
    metadata: laguerreRsiIndicator.metadata,
    inputConfig: laguerreRsiIndicator.inputConfig as InputConfig[],
    plotConfig: laguerreRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...laguerreRsiIndicator.defaultInputs },
    calculate: laguerreRsiIndicator.calculate,
  },
  {
    id: 'rsi-candles',
    name: 'RSI Candles',
    shortName: 'RSIC',
    category: 'Momentum',
    overlay: false,
    metadata: rsiCandlesIndicator.metadata,
    inputConfig: rsiCandlesIndicator.inputConfig as InputConfig[],
    plotConfig: rsiCandlesIndicator.plotConfig as PlotConfig[],
    plotCandleConfig: rsiCandlesIndicator.plotCandleConfig,
    hlineConfig: rsiCandlesIndicator.hlineConfig as HLineConfig[],
    defaultInputs: { ...rsiCandlesIndicator.defaultInputs },
    calculate: rsiCandlesIndicator.calculate,
  },
  {
    id: 'zero-lag-macd',
    name: 'Zero Lag MACD',
    shortName: 'ZLMACD',
    category: 'Momentum',
    overlay: false,
    metadata: zeroLagMacdIndicator.metadata,
    inputConfig: zeroLagMacdIndicator.inputConfig as InputConfig[],
    plotConfig: zeroLagMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...zeroLagMacdIndicator.defaultInputs },
    calculate: zeroLagMacdIndicator.calculate,
  },
  {
    id: 'adx-di',
    name: 'ADX and DI',
    shortName: 'ADX DI',
    category: 'Trend',
    overlay: false,
    metadata: adxDiIndicator.metadata,
    inputConfig: adxDiIndicator.inputConfig as InputConfig[],
    plotConfig: adxDiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...adxDiIndicator.defaultInputs },
    calculate: adxDiIndicator.calculate,
  },
  {
    id: 'awesome-oscillator-v2',
    name: 'Awesome Oscillator V2',
    shortName: 'AOv2',
    category: 'Oscillators',
    overlay: false,
    metadata: awesomeOscV2Indicator.metadata,
    inputConfig: awesomeOscV2Indicator.inputConfig as InputConfig[],
    plotConfig: awesomeOscV2Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...awesomeOscV2Indicator.defaultInputs },
    calculate: awesomeOscV2Indicator.calculate,
  },
  {
    id: 'cm-ema-trend-bars',
    name: 'CM EMA Trend Bars',
    shortName: 'CM EMA',
    category: 'Trend',
    overlay: true,
    metadata: cmEmaTrendBarsIndicator.metadata,
    inputConfig: cmEmaTrendBarsIndicator.inputConfig as InputConfig[],
    plotConfig: cmEmaTrendBarsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmEmaTrendBarsIndicator.defaultInputs },
    calculate: cmEmaTrendBarsIndicator.calculate,
  },
  {
    id: 'bb-fibonacci-ratios',
    name: 'BB Fibonacci Ratios',
    shortName: 'BB Fib',
    category: 'Channels & Bands',
    overlay: true,
    metadata: bbFibRatiosIndicator.metadata,
    inputConfig: bbFibRatiosIndicator.inputConfig as InputConfig[],
    plotConfig: bbFibRatiosIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bbFibRatiosIndicator.defaultInputs },
    calculate: bbFibRatiosIndicator.calculate,
  },
  {
    id: 'average-sentiment-oscillator',
    name: 'Average Sentiment Oscillator',
    shortName: 'ASO',
    category: 'Oscillators',
    overlay: false,
    metadata: avgSentimentOscIndicator.metadata,
    inputConfig: avgSentimentOscIndicator.inputConfig as InputConfig[],
    plotConfig: avgSentimentOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...avgSentimentOscIndicator.defaultInputs },
    calculate: avgSentimentOscIndicator.calculate,
  },
  {
    id: 'atr-trailing-stops',
    name: 'ATR Trailing Stops',
    shortName: 'ATRTS',
    category: 'Trend',
    overlay: true,
    metadata: atrTrailingStopsIndicator.metadata,
    inputConfig: atrTrailingStopsIndicator.inputConfig as InputConfig[],
    plotConfig: atrTrailingStopsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...atrTrailingStopsIndicator.defaultInputs },
    calculate: atrTrailingStopsIndicator.calculate,
  },
  {
    id: 'accurate-swing-trading',
    name: 'Accurate Swing Trading',
    shortName: 'AST',
    category: 'Trend',
    overlay: true,
    metadata: accurateSwingTradingIndicator.metadata,
    inputConfig: accurateSwingTradingIndicator.inputConfig as InputConfig[],
    plotConfig: accurateSwingTradingIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...accurateSwingTradingIndicator.defaultInputs },
    calculate: accurateSwingTradingIndicator.calculate,
  },
  {
    id: 'bull-bear-power-trend',
    name: 'Bull Bear Power Trend',
    shortName: 'BBPT',
    category: 'Momentum',
    overlay: false,
    metadata: bullBearPowerTrendIndicator.metadata,
    inputConfig: bullBearPowerTrendIndicator.inputConfig as InputConfig[],
    plotConfig: bullBearPowerTrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bullBearPowerTrendIndicator.defaultInputs },
    calculate: bullBearPowerTrendIndicator.calculate,
  },
  {
    id: 'bb-breakout-oscillator',
    name: 'BB Breakout Oscillator',
    shortName: 'BBBO',
    category: 'Oscillators',
    overlay: false,
    metadata: bbBreakoutOscIndicator.metadata,
    inputConfig: bbBreakoutOscIndicator.inputConfig as InputConfig[],
    plotConfig: bbBreakoutOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bbBreakoutOscIndicator.defaultInputs },
    calculate: bbBreakoutOscIndicator.calculate,
  },
  {
    id: 'chandelier-stop',
    name: 'Chandelier Stop',
    shortName: 'CStop',
    category: 'Trend',
    overlay: true,
    metadata: chandelierStopIndicator.metadata,
    inputConfig: chandelierStopIndicator.inputConfig as InputConfig[],
    plotConfig: chandelierStopIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...chandelierStopIndicator.defaultInputs },
    calculate: chandelierStopIndicator.calculate,
  },
  {
    id: 'stochastic-momentum-index',
    name: 'Stochastic Momentum Index',
    shortName: 'SMI',
    category: 'Oscillators',
    overlay: false,
    metadata: smiIndicator.metadata,
    inputConfig: smiIndicator.inputConfig as InputConfig[],
    plotConfig: smiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smiIndicator.defaultInputs },
    calculate: smiIndicator.calculate,
  },
  {
    id: 'volume-flow-indicator',
    name: 'Volume Flow Indicator',
    shortName: 'VFI',
    category: 'Volume',
    overlay: false,
    metadata: vfiIndicator.metadata,
    inputConfig: vfiIndicator.inputConfig as InputConfig[],
    plotConfig: vfiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vfiIndicator.defaultInputs },
    calculate: vfiIndicator.calculate,
  },
  {
    id: 'ehlers-instantaneous-trend',
    name: 'Ehlers Instantaneous Trend',
    shortName: 'EIT',
    category: 'Trend',
    overlay: true,
    metadata: ehlersITrendIndicator.metadata,
    inputConfig: ehlersITrendIndicator.inputConfig as InputConfig[],
    plotConfig: ehlersITrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ehlersITrendIndicator.defaultInputs },
    calculate: ehlersITrendIndicator.calculate,
  },
  {
    id: 'price-momentum-oscillator',
    name: 'Price Momentum Oscillator',
    shortName: 'PMO',
    category: 'Momentum',
    overlay: false,
    metadata: pmoIndicator.metadata,
    inputConfig: pmoIndicator.inputConfig as InputConfig[],
    plotConfig: pmoIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...pmoIndicator.defaultInputs },
    calculate: pmoIndicator.calculate,
  },
  {
    id: 'fibonacci-bollinger-bands',
    name: 'Fibonacci Bollinger Bands',
    shortName: 'FBB',
    category: 'Channels & Bands',
    overlay: true,
    metadata: fibBBIndicator.metadata,
    inputConfig: fibBBIndicator.inputConfig as InputConfig[],
    plotConfig: fibBBIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...fibBBIndicator.defaultInputs },
    calculate: fibBBIndicator.calculate,
  },
  {
    id: 'trend-trigger-factor',
    name: 'Trend Trigger Factor',
    shortName: 'TTF',
    category: 'Oscillators',
    overlay: false,
    metadata: ttfIndicator.metadata,
    inputConfig: ttfIndicator.inputConfig as InputConfig[],
    plotConfig: ttfIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ttfIndicator.defaultInputs },
    calculate: ttfIndicator.calculate,
  },
  {
    id: 'elliott-wave-oscillator',
    name: 'Elliott Wave Oscillator',
    shortName: 'EWO',
    category: 'Oscillators',
    overlay: false,
    metadata: ewoIndicator.metadata,
    inputConfig: ewoIndicator.inputConfig as InputConfig[],
    plotConfig: ewoIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ewoIndicator.defaultInputs },
    calculate: ewoIndicator.calculate,
  },
  {
    id: 'madrid-trend-squeeze',
    name: 'Madrid Trend Squeeze',
    shortName: 'MTS',
    category: 'Momentum',
    overlay: false,
    metadata: madridTrendSqueezeIndicator.metadata,
    inputConfig: madridTrendSqueezeIndicator.inputConfig as InputConfig[],
    plotConfig: madridTrendSqueezeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...madridTrendSqueezeIndicator.defaultInputs },
    calculate: madridTrendSqueezeIndicator.calculate,
  },
  {
    id: 'kaufman-adaptive-ma',
    name: 'Kaufman Adaptive Moving Average',
    shortName: 'KAMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: kamaIndicator.metadata,
    inputConfig: kamaIndicator.inputConfig as InputConfig[],
    plotConfig: kamaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...kamaIndicator.defaultInputs },
    calculate: kamaIndicator.calculate,
  },
  {
    id: 'williams-vix-fix',
    name: 'Williams Vix Fix',
    shortName: 'WVF',
    category: 'Volatility',
    overlay: false,
    metadata: williamsVixFixIndicator.metadata,
    inputConfig: williamsVixFixIndicator.inputConfig as InputConfig[],
    plotConfig: williamsVixFixIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...williamsVixFixIndicator.defaultInputs },
    calculate: williamsVixFixIndicator.calculate,
  },
  {
    id: 'ehlers-mesa-ma',
    name: 'Ehlers MESA Adaptive Moving Average',
    shortName: 'MESA',
    category: 'Moving Averages',
    overlay: true,
    metadata: ehlersMESAMAIndicator.metadata,
    inputConfig: ehlersMESAMAIndicator.inputConfig as InputConfig[],
    plotConfig: ehlersMESAMAIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ehlersMESAMAIndicator.defaultInputs },
    calculate: ehlersMESAMAIndicator.calculate,
  },
  {
    id: 'gann-high-low',
    name: 'Gann High Low',
    shortName: 'GannHL',
    category: 'Trend',
    overlay: true,
    metadata: gannHighLowIndicator.metadata,
    inputConfig: gannHighLowIndicator.inputConfig as InputConfig[],
    plotConfig: gannHighLowIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...gannHighLowIndicator.defaultInputs },
    calculate: gannHighLowIndicator.calculate,
  },
  {
    id: 'cm-sling-shot',
    name: 'CM Sling Shot System',
    shortName: 'CMSlShot',
    category: 'Trend',
    overlay: true,
    metadata: cmSlingShotIndicator.metadata,
    inputConfig: cmSlingShotIndicator.inputConfig as InputConfig[],
    plotConfig: cmSlingShotIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmSlingShotIndicator.defaultInputs },
    calculate: cmSlingShotIndicator.calculate,
  },
  {
    id: 'range-identifier',
    name: 'Range Identifier',
    shortName: 'RangeID',
    category: 'Channels & Bands',
    overlay: true,
    metadata: rangeIdentifierIndicator.metadata,
    inputConfig: rangeIdentifierIndicator.inputConfig as InputConfig[],
    plotConfig: rangeIdentifierIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rangeIdentifierIndicator.defaultInputs },
    calculate: rangeIdentifierIndicator.calculate,
  },
  {
    id: 'smoothed-heiken-ashi',
    name: 'Smoothed Heiken Ashi',
    shortName: 'SmHA',
    category: 'Trend',
    overlay: true,
    metadata: smoothedHeikenAshiIndicator.metadata,
    inputConfig: smoothedHeikenAshiIndicator.inputConfig as InputConfig[],
    plotConfig: smoothedHeikenAshiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smoothedHeikenAshiIndicator.defaultInputs },
    calculate: smoothedHeikenAshiIndicator.calculate,
  },
  {
    id: 'macd-leader',
    name: 'MACD Leader',
    shortName: 'MACDLeader',
    category: 'Momentum',
    overlay: false,
    metadata: macdLeaderIndicator.metadata,
    inputConfig: macdLeaderIndicator.inputConfig as InputConfig[],
    plotConfig: macdLeaderIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdLeaderIndicator.defaultInputs },
    calculate: macdLeaderIndicator.calculate,
  },
  {
    id: 'slow-stochastic',
    name: 'Slow Stochastic',
    shortName: 'SlowStoch',
    category: 'Momentum',
    overlay: false,
    metadata: slowStochasticIndicator.metadata,
    inputConfig: slowStochasticIndicator.inputConfig as InputConfig[],
    plotConfig: slowStochasticIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...slowStochasticIndicator.defaultInputs },
    calculate: slowStochasticIndicator.calculate,
  },
  {
    id: 'ift-stoch-rsi-cci',
    name: 'IFT Stoch RSI CCI',
    shortName: 'IFTCombo',
    category: 'Momentum',
    overlay: false,
    metadata: iftStochRsiCciIndicator.metadata,
    inputConfig: iftStochRsiCciIndicator.inputConfig as InputConfig[],
    plotConfig: iftStochRsiCciIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...iftStochRsiCciIndicator.defaultInputs },
    calculate: iftStochRsiCciIndicator.calculate,
  },
  {
    id: 'variable-ma',
    name: 'Variable Moving Average',
    shortName: 'VMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: variableMAIndicator.metadata,
    inputConfig: variableMAIndicator.inputConfig as InputConfig[],
    plotConfig: variableMAIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...variableMAIndicator.defaultInputs },
    calculate: variableMAIndicator.calculate,
  },
  {
    id: 'obv-oscillator',
    name: 'OBV Oscillator',
    shortName: 'OBVOsc',
    category: 'Volume',
    overlay: false,
    metadata: obvOscillatorIndicator.metadata,
    inputConfig: obvOscillatorIndicator.inputConfig as InputConfig[],
    plotConfig: obvOscillatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...obvOscillatorIndicator.defaultInputs },
    calculate: obvOscillatorIndicator.calculate,
  },
  // Candlestick Patterns
  ...candlestickEntries([
    ['abandoned-baby-bearish', abandonedBabyBearishIndicator],
    ['abandoned-baby-bullish', abandonedBabyBullishIndicator],
    ['dark-cloud-cover', darkCloudCoverIndicator],
    ['doji', dojiIndicator],
    ['doji-star-bearish', dojiStarBearishIndicator],
    ['doji-star-bullish', dojiStarBullishIndicator],
    ['downside-tasuki-gap', downsideTasukiGapIndicator],
    ['dragonfly-doji', dragonflyDojiIndicator],
    ['engulfing-bearish', engulfingBearishIndicator],
    ['engulfing-bullish', engulfingBullishIndicator],
    ['evening-doji-star', eveningDojiStarIndicator],
    ['evening-star', eveningStarIndicator],
    ['falling-three-methods', fallingThreeMethodsIndicator],
    ['falling-window', fallingWindowIndicator],
    ['gravestone-doji', gravestoneDojiIndicator],
    ['hammer', hammerIndicator],
    ['hanging-man', hangingManIndicator],
    ['harami-bearish', haramiBearishIndicator],
    ['harami-bullish', haramiBullishIndicator],
    ['harami-cross-bearish', haramiCrossBearishIndicator],
    ['harami-cross-bullish', haramiCrossBullishIndicator],
    ['inverted-hammer', invertedHammerIndicator],
    ['kicking-bearish', kickingBearishIndicator],
    ['kicking-bullish', kickingBullishIndicator],
    ['long-lower-shadow', longLowerShadowIndicator],
    ['long-upper-shadow', longUpperShadowIndicator],
    ['marubozu-black', marubozuBlackIndicator],
    ['marubozu-white', marubozuWhiteIndicator],
    ['morning-doji-star', morningDojiStarIndicator],
    ['morning-star', morningStarIndicator],
    ['on-neck', onNeckIndicator],
    ['piercing', piercingIndicator],
    ['rising-three-methods', risingThreeMethodsIndicator],
    ['rising-window', risingWindowIndicator],
    ['shooting-star', shootingStarIndicator],
    ['spinning-top-black', spinningTopBlackIndicator],
    ['spinning-top-white', spinningTopWhiteIndicator],
    ['three-black-crows', threeBlackCrowsIndicator],
    ['three-white-soldiers', threeWhiteSoldiersIndicator],
    ['tri-star-bearish', triStarBearishIndicator],
    ['tri-star-bullish', triStarBullishIndicator],
    ['tweezer-bottom', tweezerBottomIndicator],
    ['tweezer-top', tweezerTopIndicator],
    ['upside-tasuki-gap', upsideTasukiGapIndicator],
  ]),
];

// Package version
export const version = '0.4.0';
