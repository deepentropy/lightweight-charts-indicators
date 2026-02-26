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

// GMMA - Guppy Multiple Moving Average
import * as gmmaIndicator from './community/gmma';
export { GMMA, calculate as calculateGMMA } from './community/gmma';
export type { GMMAInputs } from './community/gmma';

// Turtle Trade Channels
import * as turtleTradeChannelsIndicator from './community/turtle-trade-channels';
export { TurtleTradeChannels, calculate as calculateTurtleTradeChannels } from './community/turtle-trade-channels';
export type { TurtleTradeChannelsInputs } from './community/turtle-trade-channels';

// Linear Regression Channel
import * as linearRegressionChannelIndicator from './community/linear-regression-channel';
export { LinearRegressionChannel, calculate as calculateLinearRegressionChannel } from './community/linear-regression-channel';
export type { LinearRegressionChannelInputs } from './community/linear-regression-channel';

// Twin Range Filter
import * as twinRangeFilterIndicator from './community/twin-range-filter';
export { TwinRangeFilter, calculate as calculateTwinRangeFilter } from './community/twin-range-filter';
export type { TwinRangeFilterInputs } from './community/twin-range-filter';

// TMA Bands
import * as tmaBandsIndicator from './community/tma-bands';
export { TMABands, calculate as calculateTMABands } from './community/tma-bands';
export type { TMABandsInputs } from './community/tma-bands';

// Ehlers Stochastic CG Oscillator
import * as ehlersStochasticCGIndicator from './community/ehlers-stochastic-cg';
export { EhlersStochasticCG, calculate as calculateEhlersStochasticCG } from './community/ehlers-stochastic-cg';
export type { EhlersStochasticCGInputs } from './community/ehlers-stochastic-cg';

// Volume Price Confirmation Indicator
import * as vpciIndicator from './community/vpci';
export { VPCI, calculate as calculateVPCI } from './community/vpci';
export type { VPCIInputs } from './community/vpci';

// Premier Stochastic Oscillator
import * as premierStochasticIndicator from './community/premier-stochastic';
export { PremierStochastic, calculate as calculatePremierStochastic } from './community/premier-stochastic';
export type { PremierStochasticInputs } from './community/premier-stochastic';

// Volume Accumulation Percentage
import * as volumeAccumulationPctIndicator from './community/volume-accumulation-pct';
export { VolumeAccumulationPct, calculate as calculateVolumeAccumulationPct } from './community/volume-accumulation-pct';
export type { VolumeAccumulationPctInputs } from './community/volume-accumulation-pct';

// Vervoort HA Oscillator
import * as vervoortHAOscillatorIndicator from './community/vervoort-ha-oscillator';
export { VervoortHAOscillator, calculate as calculateVervoortHAOscillator } from './community/vervoort-ha-oscillator';
export type { VervoortHAOscillatorInputs } from './community/vervoort-ha-oscillator';

// ===== NEW COMMUNITY INDICATORS =====

// ADXCobra
import * as adxCobraIndicator from './community/adx-cobra';
export { ADXCobra, calculate as calculateADXCobra } from './community/adx-cobra';
export type { ADXCobraInputs } from './community/adx-cobra';

// AIEngulfing
import * as aiEngulfingIndicator from './community/ai-engulfing';
export { AIEngulfing, calculate as calculateAIEngulfing } from './community/ai-engulfing';
export type { AIEngulfingInputs } from './community/ai-engulfing';

// AKTrendID
import * as akTrendIdIndicator from './community/ak-trend-id';
export { AKTrendID, calculate as calculateAKTrendID } from './community/ak-trend-id';
export type { AKTrendIDInputs } from './community/ak-trend-id';

// AllCandlestickPatterns
import * as allCandlestickPatternsIndicator from './community/all-candlestick-patterns';
export { AllCandlestickPatterns, calculate as calculateAllCandlestickPatterns } from './community/all-candlestick-patterns';
export type { AllCandlestickPatternsInputs } from './community/all-candlestick-patterns';

// AntiVolumeStop
import * as antiVolumeStopIndicator from './community/anti-volume-stop';
export { AntiVolumeStop, calculate as calculateAntiVolumeStop } from './community/anti-volume-stop';
export type { AntiVolumeStopInputs } from './community/anti-volume-stop';

// ATRPlus
import * as atrPlusIndicator from './community/atr-plus';
export { ATRPlus, calculate as calculateATRPlus } from './community/atr-plus';
export type { ATRPlusInputs } from './community/atr-plus';

// ATRTrailingColored
import * as atrTrailingColoredIndicator from './community/atr-trailing-colored';
export { ATRTrailingColored, calculate as calculateATRTrailingColored } from './community/atr-trailing-colored';
export type { ATRTrailingColoredInputs } from './community/atr-trailing-colored';

// AutoFib
import * as autoFibIndicator from './community/auto-fib';
export { AutoFib, calculate as calculateAutoFib } from './community/auto-fib';
export type { AutoFibInputs } from './community/auto-fib';

// AutoSupport
import * as autoSupportIndicator from './community/auto-support';
export { AutoSupport, calculate as calculateAutoSupport } from './community/auto-support';
export type { AutoSupportInputs } from './community/auto-support';

// AutoSupportResistance
import * as autoSupportResistanceIndicator from './community/auto-support-resistance';
export { AutoSupportResistance, calculate as calculateAutoSupportResistance } from './community/auto-support-resistance';
export type { AutoSupportResistanceInputs } from './community/auto-support-resistance';

// BBStochRSI
import * as bbStochRsiIndicator from './community/bb-stoch-rsi';
export { BBStochRSI, calculate as calculateBBStochRSI } from './community/bb-stoch-rsi';
export type { BBStochRSIInputs } from './community/bb-stoch-rsi';

// BinaryOptionArrows
import * as binaryOptionArrowsIndicator from './community/binary-option-arrows';
export { BinaryOptionArrows, calculate as calculateBinaryOptionArrows } from './community/binary-option-arrows';
export type { BinaryOptionArrowsInputs } from './community/binary-option-arrows';

// BitcoinKillZones
import * as bitcoinKillZonesIndicator from './community/bitcoin-kill-zones';
export { BitcoinKillZones, calculate as calculateBitcoinKillZones } from './community/bitcoin-kill-zones';
export type { BitcoinKillZonesInputs } from './community/bitcoin-kill-zones';

// BullishEngulfingFinder
import * as bullishEngulfingFinderIndicator from './community/bullish-engulfing-finder';
export { BullishEngulfingFinder, calculate as calculateBullishEngulfingFinder } from './community/bullish-engulfing-finder';
export type { BullishEngulfingFinderInputs } from './community/bullish-engulfing-finder';

// BullsBears
import * as bullsBearsControlIndicator from './community/bulls-bears-control';
export { BullsBears, calculate as calculateBullsBears } from './community/bulls-bears-control';
export type { BullsBearsInputs } from './community/bulls-bears-control';

// BuyingSellVolume
import * as buyingSellingVolumeIndicator from './community/buying-selling-volume';
export { BuyingSellVolume, calculate as calculateBuyingSellVolume } from './community/buying-selling-volume';
export type { BuyingSellVolumeInputs } from './community/buying-selling-volume';

// BuySellPressure
import * as buySellPressureIndicator from './community/buy-sell-pressure';
export { BuySellPressure, calculate as calculateBuySellPressure } from './community/buy-sell-pressure';
export type { BuySellPressureInputs } from './community/buy-sell-pressure';

// CandlestickReversal
import * as candlestickReversalIndicator from './community/candlestick-reversal';
export { CandlestickReversal, calculate as calculateCandlestickReversal } from './community/candlestick-reversal';
export type { CandlestickReversalInputs } from './community/candlestick-reversal';

// CCIOBV
import * as cciObvIndicator from './community/cci-obv';
export { CCIOBV, calculate as calculateCCIOBV } from './community/cci-obv';
export type { CCIOBVInputs } from './community/cci-obv';

// CMADX
import * as cmAdxIndicator from './community/cm-adx';
export { CMADX, calculate as calculateCMADX } from './community/cm-adx';
export type { CMADXInputs } from './community/cm-adx';

// CMEnhancedIchimoku
import * as cmEnhancedIchimokuIndicator from './community/cm-enhanced-ichimoku';
export { CMEnhancedIchimoku, calculate as calculateCMEnhancedIchimoku } from './community/cm-enhanced-ichimoku';
export type { CMEnhancedIchimokuInputs } from './community/cm-enhanced-ichimoku';

// CMGannSwing
import * as cmGannSwingIndicator from './community/cm-gann-swing';
export { CMGannSwing, calculate as calculateCMGannSwing } from './community/cm-gann-swing';
export type { CMGannSwingInputs } from './community/cm-gann-swing';

// CMGuppyEMA
import * as cmGuppyEmaIndicator from './community/cm-guppy-ema';
export { CMGuppyEMA, calculate as calculateCMGuppyEMA } from './community/cm-guppy-ema';
export type { CMGuppyEMAInputs } from './community/cm-guppy-ema';

// CMHeikinAshi
import * as cmHeikinAshiIndicator from './community/cm-heikin-ashi';
export { CMHeikinAshi, calculate as calculateCMHeikinAshi } from './community/cm-heikin-ashi';
export type { CMHeikinAshiInputs } from './community/cm-heikin-ashi';

// CMLaguerrePPO
import * as cmLaguerrePpoIndicator from './community/cm-laguerre-ppo';
export { CMLaguerrePPO, calculate as calculateCMLaguerrePPO } from './community/cm-laguerre-ppo';
export type { CMLaguerrePPOInputs } from './community/cm-laguerre-ppo';

// CMParabolicSAR
import * as cmParabolicSarIndicator from './community/cm-parabolic-sar';
export { CMParabolicSAR, calculate as calculateCMParabolicSAR } from './community/cm-parabolic-sar';
export type { CMParabolicSARInputs } from './community/cm-parabolic-sar';

// CMPriceAction
import * as cmPriceActionIndicator from './community/cm-price-action';
export { CMPriceAction, calculate as calculateCMPriceAction } from './community/cm-price-action';
export type { CMPriceActionInputs } from './community/cm-price-action';

// CMRSI2Lower
import * as cmRsi2LowerIndicator from './community/cm-rsi-2-lower';
export { CMRSI2Lower, calculate as calculateCMRSI2Lower } from './community/cm-rsi-2-lower';
export type { CMRSI2LowerInputs } from './community/cm-rsi-2-lower';

// CMRSI2Upper
import * as cmRsi2UpperIndicator from './community/cm-rsi-2-upper';
export { CMRSI2Upper, calculate as calculateCMRSI2Upper } from './community/cm-rsi-2-upper';
export type { CMRSI2UpperInputs } from './community/cm-rsi-2-upper';

// CMRSIPlusEMA
import * as cmRsiEmaIndicator from './community/cm-rsi-ema';
export { CMRSIPlusEMA, calculate as calculateCMRSIPlusEMA } from './community/cm-rsi-ema';
export type { CMRSIPlusEMAInputs } from './community/cm-rsi-ema';

// CMStochHighlight
import * as cmStochHighlightIndicator from './community/cm-stoch-highlight';
export { CMStochHighlight, calculate as calculateCMStochHighlight } from './community/cm-stoch-highlight';
export type { CMStochHighlightInputs } from './community/cm-stoch-highlight';

// CMTimeLines
import * as cmTimeLinesIndicator from './community/cm-time-lines';
export { CMTimeLines, calculate as calculateCMTimeLines } from './community/cm-time-lines';
export type { CMTimeLinesInputs } from './community/cm-time-lines';

// CMVixFixV3
import * as cmVixFixV3Indicator from './community/cm-vix-fix-v3';
export { CMVixFixV3, calculate as calculateCMVixFixV3 } from './community/cm-vix-fix-v3';
export type { CMVixFixV3Inputs } from './community/cm-vix-fix-v3';

// COGChannel
import * as cogChannelIndicator from './community/cog-channel';
export { COGChannel, calculate as calculateCOGChannel } from './community/cog-channel';
export type { COGChannelInputs } from './community/cog-channel';

// DarvasBox
import * as darvasBoxIndicator from './community/darvas-box';
export { DarvasBox, calculate as calculateDarvasBox } from './community/darvas-box';
export type { DarvasBoxInputs } from './community/darvas-box';

// DMIADX
import * as dmiAdxLevelsIndicator from './community/dmi-adx-levels';
export { DMIADX, calculate as calculateDMIADX } from './community/dmi-adx-levels';
export type { DMIADXInputs } from './community/dmi-adx-levels';

// DonchianCustom
import * as donchianCustomIndicator from './community/donchian-custom';
export { DonchianCustom, calculate as calculateDonchianCustom } from './community/donchian-custom';
export type { DonchianCustomInputs } from './community/donchian-custom';

// EasyTrendColors
import * as easyTrendColorsIndicator from './community/easy-trend-colors';
export { EasyTrendColors, calculate as calculateEasyTrendColors } from './community/easy-trend-colors';
export type { EasyTrendColorsInputs } from './community/easy-trend-colors';

// EMAEnveloper
import * as emaEnveloperIndicator from './community/ema-enveloper';
export { EMAEnveloper, calculate as calculateEMAEnveloper } from './community/ema-enveloper';
export type { EMAEnveloperInputs } from './community/ema-enveloper';

// EMAMACross
import * as emaMaCrossoverIndicator from './community/ema-ma-crossover';
export { EMAMACross, calculate as calculateEMAMACross } from './community/ema-ma-crossover';
export type { EMAMACrossInputs } from './community/ema-ma-crossover';

// EMAMulti
import * as emaMultiIndicator from './community/ema-multi';
export { EMAMulti, calculate as calculateEMAMulti } from './community/ema-multi';
export type { EMAMultiInputs } from './community/ema-multi';

// EMARibbon
import * as emaRibbonIndicator from './community/ema-ribbon';
export { EMARibbon, calculate as calculateEMARibbon } from './community/ema-ribbon';
export type { EMARibbonInputs } from './community/ema-ribbon';

// EMASupertrend
import * as emaSupertrendIndicator from './community/ema-supertrend';
export { EMASupertrend, calculate as calculateEMASupertrend } from './community/ema-supertrend';
export type { EMASuperTrendInputs } from './community/ema-supertrend';

// EMAWave
import * as emaWaveIndicator from './community/ema-wave';
export { EMAWave, calculate as calculateEMAWave } from './community/ema-wave';
export type { EMAWaveInputs } from './community/ema-wave';

// EntryPoints
import * as entryPointsIndicator from './community/entry-points';
export { EntryPoints, calculate as calculateEntryPoints } from './community/entry-points';
export type { EntryPointsInputs } from './community/entry-points';

// EnvelopeRSI
import * as envelopeRsiIndicator from './community/envelope-rsi';
export { EnvelopeRSI, calculate as calculateEnvelopeRSI } from './community/envelope-rsi';
export type { EnvelopeRSIInputs } from './community/envelope-rsi';

// EVWMAEnvelope
import * as evwmaEnvelopeIndicator from './community/evwma-envelope';
export { EVWMAEnvelope, calculate as calculateEVWMAEnvelope } from './community/evwma-envelope';
export type { EVWMAEnvelopeInputs } from './community/evwma-envelope';

// FaithIndicator
import * as faithIndicatorIndicator from './community/faith-indicator';
export { FaithIndicator, calculate as calculateFaithIndicator } from './community/faith-indicator';
export type { FaithIndicatorInputs } from './community/faith-indicator';

// FibonacciLevels
import * as fibonacciLevelsIndicator from './community/fibonacci-levels';
export { FibonacciLevels, calculate as calculateFibonacciLevels } from './community/fibonacci-levels';
export type { FibonacciLevelsInputs } from './community/fibonacci-levels';

// FibonacciZone
import * as fibonacciZoneIndicator from './community/fibonacci-zone';
export { FibonacciZone, calculate as calculateFibonacciZone } from './community/fibonacci-zone';
export type { FibonacciZoneInputs } from './community/fibonacci-zone';

// ForexSessions
import * as forexSessionsIndicator from './community/forex-sessions';
export { ForexSessions, calculate as calculateForexSessions } from './community/forex-sessions';
export type { ForexSessionsInputs } from './community/forex-sessions';

// FXSniperT3CCI
import * as fxSniperT3CciIndicator from './community/fx-sniper-t3-cci';
export { FXSniperT3CCI, calculate as calculateFXSniperT3CCI } from './community/fx-sniper-t3-cci';
export type { FXSniperT3CCIInputs } from './community/fx-sniper-t3-cci';

// HawkEyeVolume
import * as hawkeyeVolumeIndicator from './community/hawkeye-volume';
export { HawkEyeVolume, calculate as calculateHawkEyeVolume } from './community/hawkeye-volume';
export type { HawkEyeVolumeInputs } from './community/hawkeye-volume';

// IchimokuEMABands
import * as ichimokuEmaBandsIndicator from './community/ichimoku-ema-bands';
export { IchimokuEMABands, calculate as calculateIchimokuEMABands } from './community/ichimoku-ema-bands';
export type { IchimokuEMABandsInputs } from './community/ichimoku-ema-bands';

// IntradayBuySell
import * as intradayBuySellIndicator from './community/intraday-buy-sell';
export { IntradayBuySell, calculate as calculateIntradayBuySell } from './community/intraday-buy-sell';
export type { IntradayBuySellInputs } from './community/intraday-buy-sell';

// IntradayTSBB
import * as intradayTsBbIndicator from './community/intraday-ts-bb';
export { IntradayTSBB, calculate as calculateIntradayTSBB } from './community/intraday-ts-bb';
export type { IntradayTSBBInputs } from './community/intraday-ts-bb';

// IsolatedPeakBottom
import * as isolatedPeakBottomIndicator from './community/isolated-peak-bottom';
export { IsolatedPeakBottom, calculate as calculateIsolatedPeakBottom } from './community/isolated-peak-bottom';
export type { IsolatedPeakBottomInputs } from './community/isolated-peak-bottom';

// LeledcLevels
import * as leledcLevelsIndicator from './community/leledc-levels';
export { LeledcLevels, calculate as calculateLeledcLevels } from './community/leledc-levels';
export type { LeledcLevelsInputs } from './community/leledc-levels';

// LinRegCandles
import * as linearRegressionCandlesIndicator from './community/linear-regression-candles';
export { LinRegCandles, calculate as calculateLinRegCandles } from './community/linear-regression-candles';
export type { LinRegCandlesInputs } from './community/linear-regression-candles';

// MAADX
import * as maAdxIndicator from './community/ma-adx';
export { MAADX, calculate as calculateMAADX } from './community/ma-adx';
export type { MAADXInputs } from './community/ma-adx';

// MACDAS
import * as macdasIndicator from './community/macdas';
export { MACDAS, calculate as calculateMACDAS } from './community/macdas';
export type { MACDASInputs } from './community/macdas';

// MACDBB
import * as macdBbIndicator from './community/macd-bb';
export { MACDBB, calculate as calculateMACDBB } from './community/macd-bb';
export type { MACDBBInputs } from './community/macd-bb';

// MACDCrossover
import * as macdCrossoverIndicator from './community/macd-crossover';
export { MACDCrossover, calculate as calculateMACDCrossover } from './community/macd-crossover';
export type { MACDCrossoverInputs } from './community/macd-crossover';

// MACDDEMA
import * as macdDemaIndicator from './community/macd-dema';
export { MACDDEMA, calculate as calculateMACDDEMA } from './community/macd-dema';
export type { MACDDEMAInputs } from './community/macd-dema';

// MACDDivergence
import * as macdDivergenceIndicator from './community/macd-divergence';
export { MACDDivergence, calculate as calculateMACDDivergence } from './community/macd-divergence';
export type { MACDDivergenceInputs } from './community/macd-divergence';

// MACDVXI
import * as macdVxiIndicator from './community/macd-vxi';
export { MACDVXI, calculate as calculateMACDVXI } from './community/macd-vxi';
export type { MACDVXIInputs } from './community/macd-vxi';

// MAColored
import * as maColoredIndicator from './community/ma-colored';
export { MAColored, calculate as calculateMAColored } from './community/ma-colored';
export type { MAColoredInputs } from './community/ma-colored';

// MADeviationRate
import * as maDeviationRateIndicator from './community/ma-deviation-rate';
export { MADeviationRate, calculate as calculateMADeviationRate } from './community/ma-deviation-rate';
export type { MADeviationRateInputs } from './community/ma-deviation-rate';

// MarketCipherA
import * as marketCipherAIndicator from './community/market-cipher-a';
export { MarketCipherA, calculate as calculateMarketCipherA } from './community/market-cipher-a';
export type { MarketCipherAInputs } from './community/market-cipher-a';

// MarketCipherB
import * as marketCipherBIndicator from './community/market-cipher-b';
export { MarketCipherB, calculate as calculateMarketCipherB } from './community/market-cipher-b';
export type { MarketCipherBInputs } from './community/market-cipher-b';

// MarketShiftLevels
import * as marketShiftLevelsIndicator from './community/market-shift-levels';
export { MarketShiftLevels, calculate as calculateMarketShiftLevels } from './community/market-shift-levels';
export type { MarketShiftLevelsInputs } from './community/market-shift-levels';

// MAShadedFill
import * as maShadedFillIndicator from './community/ma-shaded-fill';
export { MAShadedFill, calculate as calculateMAShadedFill } from './community/ma-shaded-fill';
export type { MAShadedFillInputs } from './community/ma-shaded-fill';

// MAShift
import * as maShiftIndicator from './community/ma-shift';
export { MAShift, calculate as calculateMAShift } from './community/ma-shift';
export type { MAShiftInputs } from './community/ma-shift';

// MatrixSeries
import * as matrixSeriesIndicator from './community/matrix-series';
export { MatrixSeries, calculate as calculateMatrixSeries } from './community/matrix-series';
export type { MatrixSeriesInputs } from './community/matrix-series';

// MFIRSIBollingerBands
import * as mfiRsiBbIndicator from './community/mfi-rsi-bb';
export { MFIRSIBollingerBands, calculate as calculateMFIRSIBollingerBands } from './community/mfi-rsi-bb';
export type { MFIRSIBollingerBandsInputs } from './community/mfi-rsi-bb';

// ModifiedHeikinAshi
import * as modifiedHeikinAshiIndicator from './community/modified-heikin-ashi';
export { ModifiedHeikinAshi, calculate as calculateModifiedHeikinAshi } from './community/modified-heikin-ashi';
export type { ModifiedHeikinAshiInputs } from './community/modified-heikin-ashi';

// MultipleMA
import * as multipleMaIndicator from './community/multiple-ma';
export { MultipleMA, calculate as calculateMultipleMA } from './community/multiple-ma';
export type { MultipleMAInputs } from './community/multiple-ma';

// MurreysOscillator
import * as murreysMathOscIndicator from './community/murreys-math-osc';
export { MurreysOscillator, calculate as calculateMurreysOscillator } from './community/murreys-math-osc';
export type { MurreysOscillatorInputs } from './community/murreys-math-osc';

// NormalizedQQE
import * as normalizedQqeIndicator from './community/normalized-qqe';
export { NormalizedQQE, calculate as calculateNormalizedQQE } from './community/normalized-qqe';
export type { NormalizedQQEInputs } from './community/normalized-qqe';

// ParallelPivotLines
import * as parallelPivotLinesIndicator from './community/parallel-pivot-lines';
export { ParallelPivotLines, calculate as calculateParallelPivotLines } from './community/parallel-pivot-lines';
export type { ParallelPivotLinesInputs } from './community/parallel-pivot-lines';

// PhilakoneEMASwing
import * as philakoneEmaSwingIndicator from './community/philakone-ema-swing';
export { PhilakoneEMASwing, calculate as calculatePhilakoneEMASwing } from './community/philakone-ema-swing';
export type { PhilakoneEMASwingInputs } from './community/philakone-ema-swing';

// PivotPointSupertrend
import * as pivotPointSupertrendIndicator from './community/pivot-point-supertrend';
export { PivotPointSupertrend, calculate as calculatePivotPointSupertrend } from './community/pivot-point-supertrend';
export type { PivotPointSupertrendInputs } from './community/pivot-point-supertrend';

// PPOAlerts
import * as ppoAlertsIndicator from './community/ppo-alerts';
export { PPOAlerts, calculate as calculatePPOAlerts } from './community/ppo-alerts';
export type { PPOAlertsInputs } from './community/ppo-alerts';

// PPODivergence
import * as ppoDivergenceIndicator from './community/ppo-divergence';
export { PPODivergence, calculate as calculatePPODivergence } from './community/ppo-divergence';
export type { PPODivergenceInputs } from './community/ppo-divergence';

// PriceActionSystem
import * as priceActionSystemIndicator from './community/price-action-system';
export { PriceActionSystem, calculate as calculatePriceActionSystem } from './community/price-action-system';
export type { PriceActionSystemInputs } from './community/price-action-system';

// QQE
import * as qqeIndicator from './community/qqe';
export { QQE, calculate as calculateQQE } from './community/qqe';
export type { QQEInputs } from './community/qqe';

// QQESignals
import * as qqeSignalsIndicator from './community/qqe-signals';
export { QQESignals, calculate as calculateQQESignals } from './community/qqe-signals';
export type { QQESignalsInputs } from './community/qqe-signals';

// RCI3Lines
import * as rci3linesIndicator from './community/rci-3lines';
export { RCI3Lines, calculate as calculateRCI3Lines } from './community/rci-3lines';
export type { RCI3LinesInputs } from './community/rci-3lines';

// RedKRSSWMA
import * as redkRssWmaIndicator from './community/redk-rss-wma';
export { RedKRSSWMA, calculate as calculateRedKRSSWMA } from './community/redk-rss-wma';
export type { RedKRSSWMAInputs } from './community/redk-rss-wma';

// ReversalCandleSetup
import * as reversalCandleSetupIndicator from './community/reversal-candle-setup';
export { ReversalCandleSetup, calculate as calculateReversalCandleSetup } from './community/reversal-candle-setup';
export type { ReversalCandleSetupInputs } from './community/reversal-candle-setup';

// RSIBands
import * as rsiBandsIndicator from './community/rsi-bands';
export { RSIBands, calculate as calculateRSIBands } from './community/rsi-bands';
export type { RSIBandsInputs } from './community/rsi-bands';

// RSIBBDispersion
import * as rsiBbDispersionIndicator from './community/rsi-bb-dispersion';
export { RSIBBDispersion, calculate as calculateRSIBBDispersion } from './community/rsi-bb-dispersion';
export type { RSIBBDispersionInputs } from './community/rsi-bb-dispersion';

// RSIDivergence
import * as rsiDivergenceIndicator from './community/rsi-divergence';
export { RSIDivergence, calculate as calculateRSIDivergence } from './community/rsi-divergence';
export type { RSIDivergenceInputs } from './community/rsi-divergence';

// RSIHistoAlert
import * as rsiHistoalertIndicator from './community/rsi-histoalert';
export { RSIHistoAlert, calculate as calculateRSIHistoAlert } from './community/rsi-histoalert';
export type { RSIHistoAlertInputs } from './community/rsi-histoalert';

// RSISnabbel
import * as rsiSnabbelIndicator from './community/rsi-snabbel';
export { RSISnabbel, calculate as calculateRSISnabbel } from './community/rsi-snabbel';
export type { RSISnabbelInputs } from './community/rsi-snabbel';

// RSISwingSignal
import * as rsiSwingSignalIndicator from './community/rsi-swing-signal';
export { RSISwingSignal, calculate as calculateRSISwingSignal } from './community/rsi-swing-signal';
export type { RSISwingSignalInputs } from './community/rsi-swing-signal';

// RSSupportResistance
import * as rsSupportResistanceIndicator from './community/rs-support-resistance';
export { RSSupportResistance, calculate as calculateRSSupportResistance } from './community/rs-support-resistance';
export type { RSSupportResistanceInputs } from './community/rs-support-resistance';

// SAREMAMACDSignals
import * as sarEmaMacdIndicator from './community/sar-ema-macd';
export { SAREMAMACDSignals, calculate as calculateSAREMAMACDSignals } from './community/sar-ema-macd';
export type { SAREMAMACDInputs } from './community/sar-ema-macd';

// ScalpingLine
import * as scalpingLineIndicator from './community/scalping-line';
export { ScalpingLine, calculate as calculateScalpingLine } from './community/scalping-line';
export type { ScalpingLineInputs } from './community/scalping-line';

// SellBuyRates
import * as sellBuyRatesIndicator from './community/sell-buy-rates';
export { SellBuyRates, calculate as calculateSellBuyRates } from './community/sell-buy-rates';
export type { SellBuyRatesInputs } from './community/sell-buy-rates';

// SignalMA
import * as signalMaIndicator from './community/signal-ma';
export { SignalMA, calculate as calculateSignalMA } from './community/signal-ma';
export type { SignalMAInputs } from './community/signal-ma';

// SimpleMovingAverages
import * as simpleMovingAveragesIndicator from './community/simple-moving-averages';
export { SimpleMovingAverages, calculate as calculateSimpleMovingAverages } from './community/simple-moving-averages';
export type { SimpleMovingAveragesInputs } from './community/simple-moving-averages';

// SlowHeikenAshi
import * as slowHeikenAshiIndicator from './community/slow-heiken-ashi';
export { SlowHeikenAshi, calculate as calculateSlowHeikenAshi } from './community/slow-heiken-ashi';
export type { SlowHeikenAshiInputs } from './community/slow-heiken-ashi';

// SMIUCS
import * as smiUcsIndicator from './community/smi-ucs';
export { SMIUCS, calculate as calculateSMIUCS } from './community/smi-ucs';
export type { SMIUCSInputs } from './community/smi-ucs';

// SqueezeMomentumV2
import * as squeezeMomentumV2Indicator from './community/squeeze-momentum-v2';
export { SqueezeMomentumV2, calculate as calculateSqueezeMomentumV2 } from './community/squeeze-momentum-v2';
export type { SqueezeMomentumV2Inputs } from './community/squeeze-momentum-v2';

// SRLevelsBreaks
import * as srLevelsBreaksIndicator from './community/sr-levels-breaks';
export { SRLevelsBreaks, calculate as calculateSRLevelsBreaks } from './community/sr-levels-breaks';
export type { SRLevelsBreaksInputs } from './community/sr-levels-breaks';

// ST0P
import * as st0pIndicator from './community/st0p';
export { ST0P, calculate as calculateST0P } from './community/st0p';
export type { ST0PInputs } from './community/st0p';

// StochasticOTT
import * as stochasticOttIndicator from './community/stochastic-ott';
export { StochasticOTT, calculate as calculateStochasticOTT } from './community/stochastic-ott';
export type { StochasticOTTInputs } from './community/stochastic-ott';

// StochPOP1
import * as stochPop1Indicator from './community/stoch-pop-1';
export { StochPOP1, calculate as calculateStochPOP1 } from './community/stoch-pop-1';
export type { StochPOP1Inputs } from './community/stoch-pop-1';

// StochPOP2
import * as stochPop2Indicator from './community/stoch-pop-2';
export { StochPOP2, calculate as calculateStochPOP2 } from './community/stoch-pop-2';
export type { StochPOP2Inputs } from './community/stoch-pop-2';

// StochVX3
import * as stochVx3Indicator from './community/stoch-vx3';
export { StochVX3, calculate as calculateStochVX3 } from './community/stoch-vx3';
export type { StochVX3Inputs } from './community/stoch-vx3';

// SuperSmoothedMACD
import * as superSmoothedMacdIndicator from './community/super-smoothed-macd';
export { SuperSmoothedMACD, calculate as calculateSuperSmoothedMACD } from './community/super-smoothed-macd';
export type { SuperSmoothedMACDInputs } from './community/super-smoothed-macd';

// SuperSupertrend
import * as superSupertrendIndicator from './community/super-supertrend';
export { SuperSupertrend, calculate as calculateSuperSupertrend } from './community/super-supertrend';
export type { SuperSupertrendInputs } from './community/super-supertrend';

// SupertrendChannels
import * as supertrendChannelsIndicator from './community/supertrend-channels';
export { SupertrendChannels, calculate as calculateSupertrendChannels } from './community/supertrend-channels';
export type { SupertrendChannelsInputs } from './community/supertrend-channels';

// SwingTradeSignals
import * as swingTradeSignalsIndicator from './community/swing-trade-signals';
export { SwingTradeSignals, calculate as calculateSwingTradeSignals } from './community/swing-trade-signals';
export type { SwingTradeSignalsInputs } from './community/swing-trade-signals';

// TDIHLCTrix
import * as tdiHlcTrixIndicator from './community/tdi-hlc-trix';
export { TDIHLCTrix, calculate as calculateTDIHLCTrix } from './community/tdi-hlc-trix';
export type { TDIHLCTrixInputs } from './community/tdi-hlc-trix';

// TDMacd
import * as tdMacdIndicator from './community/td-macd';
export { TDMacd, calculate as calculateTDMacd } from './community/td-macd';
export type { TDMacdInputs } from './community/td-macd';

// ThreeMovingAverages
import * as threeMovingAveragesIndicator from './community/three-moving-averages';
export { ThreeMovingAverages, calculate as calculateThreeMovingAverages } from './community/three-moving-averages';
export type { ThreeMovingAveragesInputs } from './community/three-moving-averages';

// TonyUXScalper
import * as tonyuxEmaScalperIndicator from './community/tonyux-ema-scalper';
export { TonyUXScalper, calculate as calculateTonyUXScalper } from './community/tonyux-ema-scalper';
export type { TonyUXScalperInputs } from './community/tonyux-ema-scalper';

// TopBottomCandle
import * as topBottomCandleIndicator from './community/top-bottom-candle';
export { TopBottomCandle, calculate as calculateTopBottomCandle } from './community/top-bottom-candle';
export type { TopBottomCandleInputs } from './community/top-bottom-candle';

// TopsBottoms
import * as topsBottomsIndicator from './community/tops-bottoms';
export { TopsBottoms, calculate as calculateTopsBottoms } from './community/tops-bottoms';
export type { TopsBottomsInputs } from './community/tops-bottoms';

// TRAMA
import * as tramaIndicator from './community/trama';
export { TRAMA, calculate as calculateTRAMA } from './community/trama';
export type { TRAMAInputs } from './community/trama';

// TransientZones
import * as transientZonesIndicator from './community/transient-zones';
export { TransientZones, calculate as calculateTransientZones } from './community/transient-zones';
export type { TransientZonesInputs } from './community/transient-zones';

// TrendFollowingMA
import * as trendFollowingMaIndicator from './community/trend-following-ma';
export { TrendFollowingMA, calculate as calculateTrendFollowingMA } from './community/trend-following-ma';
export type { TrendFollowingMAInputs } from './community/trend-following-ma';

// TrendTrader
import * as trendTraderIndicator from './community/trend-trader';
export { TrendTrader, calculate as calculateTrendTrader } from './community/trend-trader';
export type { TrendTraderInputs } from './community/trend-trader';

// TriangularMomentumOsc
import * as triangularMomentumOscIndicator from './community/triangular-momentum-osc';
export { TriangularMomentumOsc, calculate as calculateTriangularMomentumOsc } from './community/triangular-momentum-osc';
export type { TriangularMomentumOscInputs } from './community/triangular-momentum-osc';

// TripleMAForecast
import * as tripleMaForecastIndicator from './community/triple-ma-forecast';
export { TripleMAForecast, calculate as calculateTripleMAForecast } from './community/triple-ma-forecast';
export type { TripleMAForecastInputs } from './community/triple-ma-forecast';

// TTMSqueezePro
import * as ttmSqueezeProIndicator from './community/ttm-squeeze-pro';
export { TTMSqueezePro, calculate as calculateTTMSqueezePro } from './community/ttm-squeeze-pro';
export type { TTMSqueezeProInputs } from './community/ttm-squeeze-pro';

// VdubSniper
import * as vdubSniperIndicator from './community/vdub-sniper';
export { VdubSniper, calculate as calculateVdubSniper } from './community/vdub-sniper';
export type { VdubSniperInputs } from './community/vdub-sniper';

// VdubusBinaryPro
import * as vdubusBinaryproIndicator from './community/vdubus-binarypro';
export { VdubusBinaryPro, calculate as calculateVdubusBinaryPro } from './community/vdubus-binarypro';
export type { VdubusBinaryProInputs } from './community/vdubus-binarypro';

// VolumeColoredBars
import * as volumeColoredBarsIndicator from './community/volume-colored-bars';
export { VolumeColoredBars, calculate as calculateVolumeColoredBars } from './community/volume-colored-bars';
export type { VolumeColoredBarsInputs } from './community/volume-colored-bars';

// VolumeFlowV3
import * as volumeFlowV3Indicator from './community/volume-flow-v3';
export { VolumeFlowV3, calculate as calculateVolumeFlowV3 } from './community/volume-flow-v3';
export type { VolumeFlowV3Inputs } from './community/volume-flow-v3';

// VolumeLinRegTrend
import * as volumeLinregTrendIndicator from './community/volume-linreg-trend';
export { VolumeLinRegTrend, calculate as calculateVolumeLinRegTrend } from './community/volume-linreg-trend';
export type { VolumeLinRegTrendInputs } from './community/volume-linreg-trend';

// VWMACDSZO
import * as vwmacdSzoIndicator from './community/vwmacd-szo';
export { VWMACDSZO, calculate as calculateVWMACDSZO } from './community/vwmacd-szo';
export type { VWMACDSZOInputs } from './community/vwmacd-szo';

// VWMACDV2
import * as vwMacdV2Indicator from './community/vw-macd-v2';
export { VWMACDV2, calculate as calculateVWMACDV2 } from './community/vw-macd-v2';
export type { VWMACDV2Inputs } from './community/vw-macd-v2';

// WeisWaveVolume
import * as weisWaveVolumeIndicator from './community/weis-wave-volume';
export { WeisWaveVolume, calculate as calculateWeisWaveVolume } from './community/weis-wave-volume';
export type { WeisWaveVolumeInputs } from './community/weis-wave-volume';

// WickedFractals
import * as wickedFractalsIndicator from './community/wicked-fractals';
export { WickedFractals, calculate as calculateWickedFractals } from './community/wicked-fractals';
export type { WickedFractalsInputs } from './community/wicked-fractals';

// WilliamsCombo
import * as williamsComboIndicator from './community/williams-combo';
export { WilliamsCombo, calculate as calculateWilliamsCombo } from './community/williams-combo';
export type { WilliamsComboInputs } from './community/williams-combo';

// ZeroLagEMA
import * as zeroLagEmaIndicator from './community/zero-lag-ema';

// Medium community indicators
import * as bjorgumTripleEmaIndicator from './community/bjorgum-triple-ema';
import * as bollingerAwesomeAlertIndicator from './community/bollinger-awesome-alert';
import * as cciStochasticIndicator from './community/cci-stochastic';
import * as doubleMacdIndicator from './community/double-macd';
import * as gaussianChannelIndicator from './community/gaussian-channel';
import * as ichimokuOscillatorIndicator from './community/ichimoku-oscillator';
import * as idealBbMaIndicator from './community/ideal-bb-ma';
import * as lucidSarIndicator from './community/lucid-sar';
import * as madridMaRibbonIndicator from './community/madrid-ma-ribbon';
import * as mostRsiIndicator from './community/most-rsi';
import * as nrtrIndicator from './community/nrtr';
import * as ottBandsIndicator from './community/ott-bands';
import * as ottoIndicator from './community/otto';
import * as parabolicRsiIndicator from './community/parabolic-rsi';
import * as pivotHhHlLhLlIndicator from './community/pivot-hh-hl-lh-ll';
import * as pmaxRsiT3Indicator from './community/pmax-rsi-t3';
import * as profitMaximizerIndicator from './community/profit-maximizer';
import * as rangeFilterDwIndicator from './community/range-filter-dw';
import * as redkVaderIndicator from './community/redk-vader';
import * as rmiTrendSniperIndicator from './community/rmi-trend-sniper';
import * as rsiCyclicSmoothedIndicator from './community/rsi-cyclic-smoothed';
import * as supertrendLadderIndicator from './community/supertrend-ladder';
import * as t3PsarIndicator from './community/t3-psar';
import * as zlmaTrendLevelsIndicator from './community/zlma-trend-levels';

// AI/ML community indicators
import * as aiTrendNavigatorIndicator from './community/ai-trend-navigator';
import * as mlAdaptiveSupertrendIndicator from './community/ml-adaptive-supertrend';
import * as mlKnnStrategyIndicator from './community/ml-knn-strategy';
import * as mlMomentumIndexIndicator from './community/ml-momentum-index';
import * as mlMovingAverageIndicator from './community/ml-moving-average';
import * as mlRsiIndicator from './community/ml-rsi';
import * as supertrendAiClusteringIndicator from './community/supertrend-ai-clustering';
import * as volumeSupertrendAiIndicator from './community/volume-supertrend-ai';
export { ZeroLagEMA, calculate as calculateZeroLagEMA } from './community/zero-lag-ema';

export { BjorgumTripleEma } from './community/bjorgum-triple-ema';
export { BollingerAwesomeAlert } from './community/bollinger-awesome-alert';
export { CCIStochastic } from './community/cci-stochastic';
export { DoubleMACD } from './community/double-macd';
export { GaussianChannel } from './community/gaussian-channel';
export { IchimokuOscillator } from './community/ichimoku-oscillator';
export { IdealBbMa } from './community/ideal-bb-ma';
export { LucidSar } from './community/lucid-sar';
export { MadridMaRibbon } from './community/madrid-ma-ribbon';
export { MOSTRSI } from './community/most-rsi';
export { NRTR } from './community/nrtr';
export { OTTBands } from './community/ott-bands';
export { OTTO } from './community/otto';
export { ParabolicRSI } from './community/parabolic-rsi';
export { PivotHhHlLhLl } from './community/pivot-hh-hl-lh-ll';
export { PMaxRSIT3 } from './community/pmax-rsi-t3';
export { ProfitMaximizer } from './community/profit-maximizer';
export { RangeFilterDW } from './community/range-filter-dw';
export { RedKVADER } from './community/redk-vader';
export { RMITrendSniper } from './community/rmi-trend-sniper';
export { RSICyclicSmoothed } from './community/rsi-cyclic-smoothed';
export { SupertrendLadder } from './community/supertrend-ladder';
export { T3Psar } from './community/t3-psar';
export { ZlmaTrendLevels } from './community/zlma-trend-levels';

export { AiTrendNavigator } from './community/ai-trend-navigator';
export { MlAdaptiveSupertrend } from './community/ml-adaptive-supertrend';
export { MlKnnStrategy } from './community/ml-knn-strategy';
export { MlMomentumIndex } from './community/ml-momentum-index';
export { MlMovingAverage } from './community/ml-moving-average';
export { MlRsi } from './community/ml-rsi';
export { SupertrendAiClustering } from './community/supertrend-ai-clustering';
export { VolumeSuperTrendAi } from './community/volume-supertrend-ai';
export type { ZeroLagEMAInputs } from './community/zero-lag-ema';

export type { BjorgumTripleEmaInputs } from './community/bjorgum-triple-ema';
export type { BollingerAwesomeAlertInputs } from './community/bollinger-awesome-alert';
export type { CCIStochasticInputs } from './community/cci-stochastic';
export type { DoubleMACDInputs } from './community/double-macd';
export type { GaussianChannelInputs } from './community/gaussian-channel';
export type { IchimokuOscillatorInputs } from './community/ichimoku-oscillator';
export type { IdealBbMaInputs } from './community/ideal-bb-ma';
export type { LucidSarInputs } from './community/lucid-sar';
export type { MadridMaRibbonInputs } from './community/madrid-ma-ribbon';
export type { MOSTRSIInputs } from './community/most-rsi';
export type { NRTRInputs } from './community/nrtr';
export type { OTTBandsInputs } from './community/ott-bands';
export type { OTTOInputs } from './community/otto';
export type { ParabolicRSIInputs } from './community/parabolic-rsi';
export type { PivotHhHlLhLlInputs } from './community/pivot-hh-hl-lh-ll';
export type { PMaxRSIT3Inputs } from './community/pmax-rsi-t3';
export type { ProfitMaximizerInputs } from './community/profit-maximizer';
export type { RangeFilterDWInputs } from './community/range-filter-dw';
export type { RedKVADERInputs } from './community/redk-vader';
export type { RMITrendSniperInputs } from './community/rmi-trend-sniper';
export type { RSICyclicSmoothedInputs } from './community/rsi-cyclic-smoothed';
export type { SupertrendLadderInputs } from './community/supertrend-ladder';
export type { T3PsarInputs } from './community/t3-psar';
export type { ZlmaTrendLevelsInputs } from './community/zlma-trend-levels';

export type { AiTrendNavigatorInputs } from './community/ai-trend-navigator';
export type { MlAdaptiveSupertrendInputs } from './community/ml-adaptive-supertrend';
export type { MlKnnStrategyInputs } from './community/ml-knn-strategy';
export type { MlMomentumIndexInputs } from './community/ml-momentum-index';
export type { MlMovingAverageInputs } from './community/ml-moving-average';
export type { MlRsiInputs } from './community/ml-rsi';
export type { SupertrendAiClusteringInputs } from './community/supertrend-ai-clustering';
export type { VolumeSuperTrendAiInputs } from './community/volume-supertrend-ai';



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
  group: 'standard' | 'community' | 'candlestick';
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
    group: 'candlestick',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'standard',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
    group: 'community',
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
  {
    id: 'gmma',
    group: 'community',
    name: 'Guppy Multiple Moving Average',
    shortName: 'GMMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: gmmaIndicator.metadata,
    inputConfig: gmmaIndicator.inputConfig as InputConfig[],
    plotConfig: gmmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...gmmaIndicator.defaultInputs },
    calculate: gmmaIndicator.calculate,
  },
  {
    id: 'turtle-trade-channels',
    group: 'community',
    name: 'Turtle Trade Channels',
    shortName: 'TTC',
    category: 'Channels & Bands',
    overlay: true,
    metadata: turtleTradeChannelsIndicator.metadata,
    inputConfig: turtleTradeChannelsIndicator.inputConfig as InputConfig[],
    plotConfig: turtleTradeChannelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...turtleTradeChannelsIndicator.defaultInputs },
    calculate: turtleTradeChannelsIndicator.calculate,
  },
  {
    id: 'linear-regression-channel',
    group: 'community',
    name: 'Linear Regression Channel',
    shortName: 'LRC',
    category: 'Channels & Bands',
    overlay: true,
    metadata: linearRegressionChannelIndicator.metadata,
    inputConfig: linearRegressionChannelIndicator.inputConfig as InputConfig[],
    plotConfig: linearRegressionChannelIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...linearRegressionChannelIndicator.defaultInputs },
    calculate: linearRegressionChannelIndicator.calculate,
  },
  {
    id: 'twin-range-filter',
    group: 'community',
    name: 'Twin Range Filter',
    shortName: 'TRF',
    category: 'Trend',
    overlay: true,
    metadata: twinRangeFilterIndicator.metadata,
    inputConfig: twinRangeFilterIndicator.inputConfig as InputConfig[],
    plotConfig: twinRangeFilterIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...twinRangeFilterIndicator.defaultInputs },
    calculate: twinRangeFilterIndicator.calculate,
  },
  {
    id: 'tma-bands',
    group: 'community',
    name: 'Triangular MA Bands',
    shortName: 'TMA',
    category: 'Channels & Bands',
    overlay: true,
    metadata: tmaBandsIndicator.metadata,
    inputConfig: tmaBandsIndicator.inputConfig as InputConfig[],
    plotConfig: tmaBandsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tmaBandsIndicator.defaultInputs },
    calculate: tmaBandsIndicator.calculate,
  },
  {
    id: 'ehlers-stochastic-cg',
    group: 'community',
    name: 'Ehlers Stochastic CG Oscillator',
    shortName: 'ESCG',
    category: 'Oscillators',
    overlay: false,
    metadata: ehlersStochasticCGIndicator.metadata,
    inputConfig: ehlersStochasticCGIndicator.inputConfig as InputConfig[],
    plotConfig: ehlersStochasticCGIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ehlersStochasticCGIndicator.defaultInputs },
    calculate: ehlersStochasticCGIndicator.calculate,
  },
  {
    id: 'vpci',
    group: 'community',
    name: 'Volume Price Confirmation Indicator',
    shortName: 'VPCI',
    category: 'Volume',
    overlay: false,
    metadata: vpciIndicator.metadata,
    inputConfig: vpciIndicator.inputConfig as InputConfig[],
    plotConfig: vpciIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vpciIndicator.defaultInputs },
    calculate: vpciIndicator.calculate,
  },
  {
    id: 'premier-stochastic',
    group: 'community',
    name: 'Premier Stochastic Oscillator',
    shortName: 'PSO',
    category: 'Oscillators',
    overlay: false,
    metadata: premierStochasticIndicator.metadata,
    inputConfig: premierStochasticIndicator.inputConfig as InputConfig[],
    plotConfig: premierStochasticIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...premierStochasticIndicator.defaultInputs },
    calculate: premierStochasticIndicator.calculate,
  },
  {
    id: 'volume-accumulation-pct',
    group: 'community',
    name: 'Volume Accumulation Percentage',
    shortName: 'VA%',
    category: 'Volume',
    overlay: false,
    metadata: volumeAccumulationPctIndicator.metadata,
    inputConfig: volumeAccumulationPctIndicator.inputConfig as InputConfig[],
    plotConfig: volumeAccumulationPctIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...volumeAccumulationPctIndicator.defaultInputs },
    calculate: volumeAccumulationPctIndicator.calculate,
  },
  {
    id: 'vervoort-ha-oscillator',
    group: 'community',
    name: 'Vervoort HA LT Candlestick Oscillator',
    shortName: 'VHO',
    category: 'Oscillators',
    overlay: false,
    metadata: vervoortHAOscillatorIndicator.metadata,
    inputConfig: vervoortHAOscillatorIndicator.inputConfig as InputConfig[],
    plotConfig: vervoortHAOscillatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vervoortHAOscillatorIndicator.defaultInputs },
    calculate: vervoortHAOscillatorIndicator.calculate,
  },
  {
    id: 'adx-cobra',
    group: 'community',
    name: 'ADX by cobra',
    shortName: 'ADX Cobra',
    category: 'Trend',
    overlay: false,
    metadata: adxCobraIndicator.metadata,
    inputConfig: adxCobraIndicator.inputConfig as InputConfig[],
    plotConfig: adxCobraIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...adxCobraIndicator.defaultInputs },
    calculate: adxCobraIndicator.calculate,
  },
  {
    id: 'ai-engulfing',
    group: 'community',
    name: 'AI Engulfing Candle',
    shortName: 'AIEngulf',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: aiEngulfingIndicator.metadata,
    inputConfig: aiEngulfingIndicator.inputConfig as InputConfig[],
    plotConfig: aiEngulfingIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...aiEngulfingIndicator.defaultInputs },
    calculate: aiEngulfingIndicator.calculate,
  },
  {
    id: 'ak-trend-id',
    group: 'community',
    name: 'AK TREND ID',
    shortName: 'AKTID',
    category: 'Trend',
    overlay: true,
    metadata: akTrendIdIndicator.metadata,
    inputConfig: akTrendIdIndicator.inputConfig as InputConfig[],
    plotConfig: akTrendIdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...akTrendIdIndicator.defaultInputs },
    calculate: akTrendIdIndicator.calculate,
  },
  {
    id: 'all-candlestick-patterns',
    group: 'community',
    name: 'All Candlestick Patterns',
    shortName: 'CdlPat',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: allCandlestickPatternsIndicator.metadata,
    inputConfig: allCandlestickPatternsIndicator.inputConfig as InputConfig[],
    plotConfig: allCandlestickPatternsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...allCandlestickPatternsIndicator.defaultInputs },
    calculate: allCandlestickPatternsIndicator.calculate,
  },
  {
    id: 'anti-volume-stop',
    group: 'community',
    name: 'Anti-Volume Stop Loss',
    shortName: 'AVStop',
    category: 'Trend',
    overlay: true,
    metadata: antiVolumeStopIndicator.metadata,
    inputConfig: antiVolumeStopIndicator.inputConfig as InputConfig[],
    plotConfig: antiVolumeStopIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...antiVolumeStopIndicator.defaultInputs },
    calculate: antiVolumeStopIndicator.calculate,
  },
  {
    id: 'atr-plus',
    group: 'community',
    name: 'ATR+ Stop Loss Indicator',
    shortName: 'ATR+',
    category: 'Trend',
    overlay: true,
    metadata: atrPlusIndicator.metadata,
    inputConfig: atrPlusIndicator.inputConfig as InputConfig[],
    plotConfig: atrPlusIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...atrPlusIndicator.defaultInputs },
    calculate: atrPlusIndicator.calculate,
  },
  {
    id: 'atr-trailing-colored',
    group: 'community',
    name: 'Average True Range Trailing Stops Colored',
    shortName: 'ATRTSC',
    category: 'Trend',
    overlay: true,
    metadata: atrTrailingColoredIndicator.metadata,
    inputConfig: atrTrailingColoredIndicator.inputConfig as InputConfig[],
    plotConfig: atrTrailingColoredIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...atrTrailingColoredIndicator.defaultInputs },
    calculate: atrTrailingColoredIndicator.calculate,
  },
  {
    id: 'auto-fib',
    group: 'community',
    name: 'Auto Fibonacci',
    shortName: 'AutoFib',
    category: 'Channels & Bands',
    overlay: true,
    metadata: autoFibIndicator.metadata,
    inputConfig: autoFibIndicator.inputConfig as InputConfig[],
    plotConfig: autoFibIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...autoFibIndicator.defaultInputs },
    calculate: autoFibIndicator.calculate,
  },
  {
    id: 'auto-support',
    group: 'community',
    name: 'Auto-Support',
    shortName: 'AutoSup',
    category: 'Channels & Bands',
    overlay: true,
    metadata: autoSupportIndicator.metadata,
    inputConfig: autoSupportIndicator.inputConfig as InputConfig[],
    plotConfig: autoSupportIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...autoSupportIndicator.defaultInputs },
    calculate: autoSupportIndicator.calculate,
  },
  {
    id: 'auto-support-resistance',
    group: 'community',
    name: 'Automatic Support & Resistance',
    shortName: 'Auto S/R',
    category: 'Channels & Bands',
    overlay: true,
    metadata: autoSupportResistanceIndicator.metadata,
    inputConfig: autoSupportResistanceIndicator.inputConfig as InputConfig[],
    plotConfig: autoSupportResistanceIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...autoSupportResistanceIndicator.defaultInputs },
    calculate: autoSupportResistanceIndicator.calculate,
  },
  {
    id: 'bb-stoch-rsi',
    group: 'community',
    name: 'BB Stochastic RSI Extreme Signal',
    shortName: 'BBStochRSI',
    category: 'Oscillators',
    overlay: false,
    metadata: bbStochRsiIndicator.metadata,
    inputConfig: bbStochRsiIndicator.inputConfig as InputConfig[],
    plotConfig: bbStochRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bbStochRsiIndicator.defaultInputs },
    calculate: bbStochRsiIndicator.calculate,
  },
  {
    id: 'binary-option-arrows',
    group: 'community',
    name: 'Binary Option Arrows',
    shortName: 'BinArrows',
    category: 'Trend',
    overlay: true,
    metadata: binaryOptionArrowsIndicator.metadata,
    inputConfig: binaryOptionArrowsIndicator.inputConfig as InputConfig[],
    plotConfig: binaryOptionArrowsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...binaryOptionArrowsIndicator.defaultInputs },
    calculate: binaryOptionArrowsIndicator.calculate,
  },
  {
    id: 'bitcoin-kill-zones',
    group: 'community',
    name: 'Bitcoin Kill Zones',
    shortName: 'BKZ',
    category: 'Oscillators',
    overlay: false,
    metadata: bitcoinKillZonesIndicator.metadata,
    inputConfig: bitcoinKillZonesIndicator.inputConfig as InputConfig[],
    plotConfig: bitcoinKillZonesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bitcoinKillZonesIndicator.defaultInputs },
    calculate: bitcoinKillZonesIndicator.calculate,
  },
  {
    id: 'bullish-engulfing-finder',
    group: 'community',
    name: 'Bullish Engulfing Finder',
    shortName: 'BullEngulf',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: bullishEngulfingFinderIndicator.metadata,
    inputConfig: bullishEngulfingFinderIndicator.inputConfig as InputConfig[],
    plotConfig: bullishEngulfingFinderIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bullishEngulfingFinderIndicator.defaultInputs },
    calculate: bullishEngulfingFinderIndicator.calculate,
  },
  {
    id: 'bulls-bears-control',
    group: 'community',
    name: 'Bulls or Bears in Control',
    shortName: 'BullBear',
    category: 'Trend',
    overlay: false,
    metadata: bullsBearsControlIndicator.metadata,
    inputConfig: bullsBearsControlIndicator.inputConfig as InputConfig[],
    plotConfig: bullsBearsControlIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bullsBearsControlIndicator.defaultInputs },
    calculate: bullsBearsControlIndicator.calculate,
  },
  {
    id: 'buying-selling-volume',
    group: 'community',
    name: 'Buying Selling Volume',
    shortName: 'BSVol',
    category: 'Volume',
    overlay: false,
    metadata: buyingSellingVolumeIndicator.metadata,
    inputConfig: buyingSellingVolumeIndicator.inputConfig as InputConfig[],
    plotConfig: buyingSellingVolumeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...buyingSellingVolumeIndicator.defaultInputs },
    calculate: buyingSellingVolumeIndicator.calculate,
  },
  {
    id: 'buy-sell-pressure',
    group: 'community',
    name: 'Buy & Sell Pressure',
    shortName: 'BSP',
    category: 'Volume',
    overlay: false,
    metadata: buySellPressureIndicator.metadata,
    inputConfig: buySellPressureIndicator.inputConfig as InputConfig[],
    plotConfig: buySellPressureIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...buySellPressureIndicator.defaultInputs },
    calculate: buySellPressureIndicator.calculate,
  },
  {
    id: 'candlestick-reversal',
    group: 'community',
    name: 'Candlestick Reversal',
    shortName: 'CdlRev',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: candlestickReversalIndicator.metadata,
    inputConfig: candlestickReversalIndicator.inputConfig as InputConfig[],
    plotConfig: candlestickReversalIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...candlestickReversalIndicator.defaultInputs },
    calculate: candlestickReversalIndicator.calculate,
  },
  {
    id: 'cci-obv',
    group: 'community',
    name: 'CCI coded OBV',
    shortName: 'CCIOBV',
    category: 'Oscillators',
    overlay: false,
    metadata: cciObvIndicator.metadata,
    inputConfig: cciObvIndicator.inputConfig as InputConfig[],
    plotConfig: cciObvIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cciObvIndicator.defaultInputs },
    calculate: cciObvIndicator.calculate,
  },
  {
    id: 'cm-adx',
    group: 'community',
    name: 'CM ADX V1',
    shortName: 'CM ADX',
    category: 'Trend',
    overlay: false,
    metadata: cmAdxIndicator.metadata,
    inputConfig: cmAdxIndicator.inputConfig as InputConfig[],
    plotConfig: cmAdxIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmAdxIndicator.defaultInputs },
    calculate: cmAdxIndicator.calculate,
  },
  {
    id: 'cm-enhanced-ichimoku',
    group: 'community',
    name: 'CM Enhanced Ichimoku Cloud V5',
    shortName: 'CM Ichimoku',
    category: 'Channels & Bands',
    overlay: true,
    metadata: cmEnhancedIchimokuIndicator.metadata,
    inputConfig: cmEnhancedIchimokuIndicator.inputConfig as InputConfig[],
    plotConfig: cmEnhancedIchimokuIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmEnhancedIchimokuIndicator.defaultInputs },
    calculate: cmEnhancedIchimokuIndicator.calculate,
  },
  {
    id: 'cm-gann-swing',
    group: 'community',
    name: 'CM Gann Swing High Low V2',
    shortName: 'Gann Swing',
    category: 'Trend',
    overlay: true,
    metadata: cmGannSwingIndicator.metadata,
    inputConfig: cmGannSwingIndicator.inputConfig as InputConfig[],
    plotConfig: cmGannSwingIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmGannSwingIndicator.defaultInputs },
    calculate: cmGannSwingIndicator.calculate,
  },
  {
    id: 'cm-guppy-ema',
    group: 'community',
    name: 'CM Guppy EMA',
    shortName: 'GuppyEMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: cmGuppyEmaIndicator.metadata,
    inputConfig: cmGuppyEmaIndicator.inputConfig as InputConfig[],
    plotConfig: cmGuppyEmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmGuppyEmaIndicator.defaultInputs },
    calculate: cmGuppyEmaIndicator.calculate,
  },
  {
    id: 'cm-heikin-ashi',
    group: 'community',
    name: 'CM Heikin-Ashi',
    shortName: 'CMHA',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: cmHeikinAshiIndicator.metadata,
    inputConfig: cmHeikinAshiIndicator.inputConfig as InputConfig[],
    plotConfig: cmHeikinAshiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmHeikinAshiIndicator.defaultInputs },
    calculate: cmHeikinAshiIndicator.calculate,
  },
  {
    id: 'cm-laguerre-ppo',
    group: 'community',
    name: 'CM Laguerre PPO PercentileRank',
    shortName: 'LagPPO',
    category: 'Oscillators',
    overlay: false,
    metadata: cmLaguerrePpoIndicator.metadata,
    inputConfig: cmLaguerrePpoIndicator.inputConfig as InputConfig[],
    plotConfig: cmLaguerrePpoIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmLaguerrePpoIndicator.defaultInputs },
    calculate: cmLaguerrePpoIndicator.calculate,
  },
  {
    id: 'cm-parabolic-sar',
    group: 'community',
    name: 'CM Parabolic SAR',
    shortName: 'CMSAR',
    category: 'Oscillators',
    overlay: true,
    metadata: cmParabolicSarIndicator.metadata,
    inputConfig: cmParabolicSarIndicator.inputConfig as InputConfig[],
    plotConfig: cmParabolicSarIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmParabolicSarIndicator.defaultInputs },
    calculate: cmParabolicSarIndicator.calculate,
  },
  {
    id: 'cm-price-action',
    group: 'community',
    name: 'CM Price Action Bars',
    shortName: 'CMPriceAction',
    category: 'Oscillators',
    overlay: true,
    metadata: cmPriceActionIndicator.metadata,
    inputConfig: cmPriceActionIndicator.inputConfig as InputConfig[],
    plotConfig: cmPriceActionIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmPriceActionIndicator.defaultInputs },
    calculate: cmPriceActionIndicator.calculate,
  },
  {
    id: 'cm-rsi-2-lower',
    group: 'community',
    name: 'CM RSI-2 Strategy Lower',
    shortName: 'CMRSI2L',
    category: 'Oscillators',
    overlay: false,
    metadata: cmRsi2LowerIndicator.metadata,
    inputConfig: cmRsi2LowerIndicator.inputConfig as InputConfig[],
    plotConfig: cmRsi2LowerIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmRsi2LowerIndicator.defaultInputs },
    calculate: cmRsi2LowerIndicator.calculate,
  },
  {
    id: 'cm-rsi-2-upper',
    group: 'community',
    name: 'CM RSI-2 Strategy Upper',
    shortName: 'CMRSI2',
    category: 'Oscillators',
    overlay: true,
    metadata: cmRsi2UpperIndicator.metadata,
    inputConfig: cmRsi2UpperIndicator.inputConfig as InputConfig[],
    plotConfig: cmRsi2UpperIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmRsi2UpperIndicator.defaultInputs },
    calculate: cmRsi2UpperIndicator.calculate,
  },
  {
    id: 'cm-rsi-ema',
    group: 'community',
    name: 'CM RSI Plus EMA',
    shortName: 'CMRSIEMA',
    category: 'Oscillators',
    overlay: false,
    metadata: cmRsiEmaIndicator.metadata,
    inputConfig: cmRsiEmaIndicator.inputConfig as InputConfig[],
    plotConfig: cmRsiEmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmRsiEmaIndicator.defaultInputs },
    calculate: cmRsiEmaIndicator.calculate,
  },
  {
    id: 'cm-stoch-highlight',
    group: 'community',
    name: 'CM Stochastic Highlight Bars',
    shortName: 'CMStochHL',
    category: 'Oscillators',
    overlay: false,
    metadata: cmStochHighlightIndicator.metadata,
    inputConfig: cmStochHighlightIndicator.inputConfig as InputConfig[],
    plotConfig: cmStochHighlightIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmStochHighlightIndicator.defaultInputs },
    calculate: cmStochHighlightIndicator.calculate,
  },
  {
    id: 'cm-time-lines',
    group: 'community',
    name: 'CM Time Based Vertical Lines',
    shortName: 'CMTime',
    category: 'Trend',
    overlay: false,
    metadata: cmTimeLinesIndicator.metadata,
    inputConfig: cmTimeLinesIndicator.inputConfig as InputConfig[],
    plotConfig: cmTimeLinesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmTimeLinesIndicator.defaultInputs },
    calculate: cmTimeLinesIndicator.calculate,
  },
  {
    id: 'cm-vix-fix-v3',
    group: 'community',
    name: 'CM Williams Vix Fix V3',
    shortName: 'VixFixV3',
    category: 'Oscillators',
    overlay: false,
    metadata: cmVixFixV3Indicator.metadata,
    inputConfig: cmVixFixV3Indicator.inputConfig as InputConfig[],
    plotConfig: cmVixFixV3Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cmVixFixV3Indicator.defaultInputs },
    calculate: cmVixFixV3Indicator.calculate,
  },
  {
    id: 'cog-channel',
    group: 'community',
    name: 'Center of Gravity Channel',
    shortName: 'COGCh',
    category: 'Channels & Bands',
    overlay: true,
    metadata: cogChannelIndicator.metadata,
    inputConfig: cogChannelIndicator.inputConfig as InputConfig[],
    plotConfig: cogChannelIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cogChannelIndicator.defaultInputs },
    calculate: cogChannelIndicator.calculate,
  },
  {
    id: 'darvas-box',
    group: 'community',
    name: 'Darvas Box',
    shortName: 'Darvas',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: darvasBoxIndicator.metadata,
    inputConfig: darvasBoxIndicator.inputConfig as InputConfig[],
    plotConfig: darvasBoxIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...darvasBoxIndicator.defaultInputs },
    calculate: darvasBoxIndicator.calculate,
  },
  {
    id: 'dmi-adx-levels',
    group: 'community',
    name: 'Directional Movement Index + ADX & Key Levels',
    shortName: 'DMI ADX',
    category: 'Trend',
    overlay: false,
    metadata: dmiAdxLevelsIndicator.metadata,
    inputConfig: dmiAdxLevelsIndicator.inputConfig as InputConfig[],
    plotConfig: dmiAdxLevelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...dmiAdxLevelsIndicator.defaultInputs },
    calculate: dmiAdxLevelsIndicator.calculate,
  },
  {
    id: 'donchian-custom',
    group: 'community',
    name: 'Custom Donchian Channels',
    shortName: 'DonchianC',
    category: 'Channels & Bands',
    overlay: true,
    metadata: donchianCustomIndicator.metadata,
    inputConfig: donchianCustomIndicator.inputConfig as InputConfig[],
    plotConfig: donchianCustomIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...donchianCustomIndicator.defaultInputs },
    calculate: donchianCustomIndicator.calculate,
  },
  {
    id: 'easy-trend-colors',
    group: 'community',
    name: 'Easy Entry/Exit Trend Colors',
    shortName: 'EasyTrend',
    category: 'Trend',
    overlay: true,
    metadata: easyTrendColorsIndicator.metadata,
    inputConfig: easyTrendColorsIndicator.inputConfig as InputConfig[],
    plotConfig: easyTrendColorsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...easyTrendColorsIndicator.defaultInputs },
    calculate: easyTrendColorsIndicator.calculate,
  },
  {
    id: 'ema-enveloper',
    group: 'community',
    name: 'EMA Enveloper',
    shortName: 'EMAE',
    category: 'Moving Averages',
    overlay: true,
    metadata: emaEnveloperIndicator.metadata,
    inputConfig: emaEnveloperIndicator.inputConfig as InputConfig[],
    plotConfig: emaEnveloperIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaEnveloperIndicator.defaultInputs },
    calculate: emaEnveloperIndicator.calculate,
  },
  {
    id: 'ema-ma-crossover',
    group: 'community',
    name: 'EMA & MA Crossover',
    shortName: 'EMAC',
    category: 'Moving Averages',
    overlay: true,
    metadata: emaMaCrossoverIndicator.metadata,
    inputConfig: emaMaCrossoverIndicator.inputConfig as InputConfig[],
    plotConfig: emaMaCrossoverIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaMaCrossoverIndicator.defaultInputs },
    calculate: emaMaCrossoverIndicator.calculate,
  },
  {
    id: 'ema-multi',
    group: 'community',
    name: 'EMA 20/50/100/200',
    shortName: 'EMA4',
    category: 'Moving Averages',
    overlay: true,
    metadata: emaMultiIndicator.metadata,
    inputConfig: emaMultiIndicator.inputConfig as InputConfig[],
    plotConfig: emaMultiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaMultiIndicator.defaultInputs },
    calculate: emaMultiIndicator.calculate,
  },
  {
    id: 'ema-ribbon',
    group: 'community',
    name: 'EMA Ribbon',
    shortName: 'EMAR',
    category: 'Moving Averages',
    overlay: true,
    metadata: emaRibbonIndicator.metadata,
    inputConfig: emaRibbonIndicator.inputConfig as InputConfig[],
    plotConfig: emaRibbonIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaRibbonIndicator.defaultInputs },
    calculate: emaRibbonIndicator.calculate,
  },
  {
    id: 'ema-supertrend',
    group: 'community',
    name: 'EMA + SuperTrend',
    shortName: 'EMA+ST',
    category: 'Moving Averages',
    overlay: true,
    metadata: emaSupertrendIndicator.metadata,
    inputConfig: emaSupertrendIndicator.inputConfig as InputConfig[],
    plotConfig: emaSupertrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaSupertrendIndicator.defaultInputs },
    calculate: emaSupertrendIndicator.calculate,
  },
  {
    id: 'ema-wave',
    group: 'community',
    name: 'EMA Wave Indicator',
    shortName: 'EMAW',
    category: 'Moving Averages',
    overlay: false,
    metadata: emaWaveIndicator.metadata,
    inputConfig: emaWaveIndicator.inputConfig as InputConfig[],
    plotConfig: emaWaveIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...emaWaveIndicator.defaultInputs },
    calculate: emaWaveIndicator.calculate,
  },
  {
    id: 'entry-points',
    group: 'community',
    name: 'Entry Points',
    shortName: 'EntryPts',
    category: 'Oscillators',
    overlay: true,
    metadata: entryPointsIndicator.metadata,
    inputConfig: entryPointsIndicator.inputConfig as InputConfig[],
    plotConfig: entryPointsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...entryPointsIndicator.defaultInputs },
    calculate: entryPointsIndicator.calculate,
  },
  {
    id: 'envelope-rsi',
    group: 'community',
    name: 'Envelope RSI',
    shortName: 'EnvRSI',
    category: 'Oscillators',
    overlay: false,
    metadata: envelopeRsiIndicator.metadata,
    inputConfig: envelopeRsiIndicator.inputConfig as InputConfig[],
    plotConfig: envelopeRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...envelopeRsiIndicator.defaultInputs },
    calculate: envelopeRsiIndicator.calculate,
  },
  {
    id: 'evwma-envelope',
    group: 'community',
    name: 'EVWMA Envelope',
    shortName: 'EVWMA',
    category: 'Oscillators',
    overlay: true,
    metadata: evwmaEnvelopeIndicator.metadata,
    inputConfig: evwmaEnvelopeIndicator.inputConfig as InputConfig[],
    plotConfig: evwmaEnvelopeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...evwmaEnvelopeIndicator.defaultInputs },
    calculate: evwmaEnvelopeIndicator.calculate,
  },
  {
    id: 'faith-indicator',
    group: 'community',
    name: 'Faith Indicator',
    shortName: 'Faith',
    category: 'Trend',
    overlay: false,
    metadata: faithIndicatorIndicator.metadata,
    inputConfig: faithIndicatorIndicator.inputConfig as InputConfig[],
    plotConfig: faithIndicatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...faithIndicatorIndicator.defaultInputs },
    calculate: faithIndicatorIndicator.calculate,
  },
  {
    id: 'fibonacci-levels',
    group: 'community',
    name: 'Fibonacci Levels',
    shortName: 'FibLvl',
    category: 'Channels & Bands',
    overlay: true,
    metadata: fibonacciLevelsIndicator.metadata,
    inputConfig: fibonacciLevelsIndicator.inputConfig as InputConfig[],
    plotConfig: fibonacciLevelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...fibonacciLevelsIndicator.defaultInputs },
    calculate: fibonacciLevelsIndicator.calculate,
  },
  {
    id: 'fibonacci-zone',
    group: 'community',
    name: 'Fibonacci Zone',
    shortName: 'FibZone',
    category: 'Channels & Bands',
    overlay: true,
    metadata: fibonacciZoneIndicator.metadata,
    inputConfig: fibonacciZoneIndicator.inputConfig as InputConfig[],
    plotConfig: fibonacciZoneIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...fibonacciZoneIndicator.defaultInputs },
    calculate: fibonacciZoneIndicator.calculate,
  },
  {
    id: 'forex-sessions',
    group: 'community',
    name: 'Forex Sessions',
    shortName: 'FXSessions',
    category: 'Oscillators',
    overlay: false,
    metadata: forexSessionsIndicator.metadata,
    inputConfig: forexSessionsIndicator.inputConfig as InputConfig[],
    plotConfig: forexSessionsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...forexSessionsIndicator.defaultInputs },
    calculate: forexSessionsIndicator.calculate,
  },
  {
    id: 'fx-sniper-t3-cci',
    group: 'community',
    name: 'FX Sniper T3-CCI',
    shortName: 'T3CCI',
    category: 'Oscillators',
    overlay: false,
    metadata: fxSniperT3CciIndicator.metadata,
    inputConfig: fxSniperT3CciIndicator.inputConfig as InputConfig[],
    plotConfig: fxSniperT3CciIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...fxSniperT3CciIndicator.defaultInputs },
    calculate: fxSniperT3CciIndicator.calculate,
  },
  {
    id: 'hawkeye-volume',
    group: 'community',
    name: 'HawkEye Volume',
    shortName: 'HEVol',
    category: 'Volume',
    overlay: false,
    metadata: hawkeyeVolumeIndicator.metadata,
    inputConfig: hawkeyeVolumeIndicator.inputConfig as InputConfig[],
    plotConfig: hawkeyeVolumeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...hawkeyeVolumeIndicator.defaultInputs },
    calculate: hawkeyeVolumeIndicator.calculate,
  },
  {
    id: 'ichimoku-ema-bands',
    group: 'community',
    name: 'Ichimoku EMA Bands',
    shortName: 'Ichi EMA',
    category: 'Channels & Bands',
    overlay: true,
    metadata: ichimokuEmaBandsIndicator.metadata,
    inputConfig: ichimokuEmaBandsIndicator.inputConfig as InputConfig[],
    plotConfig: ichimokuEmaBandsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ichimokuEmaBandsIndicator.defaultInputs },
    calculate: ichimokuEmaBandsIndicator.calculate,
  },
  {
    id: 'intraday-buy-sell',
    group: 'community',
    name: 'Intraday BUY_SELL',
    shortName: 'IBS',
    category: 'Trend',
    overlay: true,
    metadata: intradayBuySellIndicator.metadata,
    inputConfig: intradayBuySellIndicator.inputConfig as InputConfig[],
    plotConfig: intradayBuySellIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...intradayBuySellIndicator.defaultInputs },
    calculate: intradayBuySellIndicator.calculate,
  },
  {
    id: 'intraday-ts-bb',
    group: 'community',
    name: 'Intraday TS BB',
    shortName: 'ITSBB',
    category: 'Oscillators',
    overlay: false,
    metadata: intradayTsBbIndicator.metadata,
    inputConfig: intradayTsBbIndicator.inputConfig as InputConfig[],
    plotConfig: intradayTsBbIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...intradayTsBbIndicator.defaultInputs },
    calculate: intradayTsBbIndicator.calculate,
  },
  {
    id: 'isolated-peak-bottom',
    group: 'community',
    name: 'Isolated Peak and Bottom',
    shortName: 'PeakBot',
    category: 'Oscillators',
    overlay: true,
    metadata: isolatedPeakBottomIndicator.metadata,
    inputConfig: isolatedPeakBottomIndicator.inputConfig as InputConfig[],
    plotConfig: isolatedPeakBottomIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...isolatedPeakBottomIndicator.defaultInputs },
    calculate: isolatedPeakBottomIndicator.calculate,
  },
  {
    id: 'leledc-levels',
    group: 'community',
    name: 'Leledc Levels',
    shortName: 'Leledc',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: leledcLevelsIndicator.metadata,
    inputConfig: leledcLevelsIndicator.inputConfig as InputConfig[],
    plotConfig: leledcLevelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...leledcLevelsIndicator.defaultInputs },
    calculate: leledcLevelsIndicator.calculate,
  },
  {
    id: 'linear-regression-candles',
    group: 'community',
    name: 'Linear Regression Candles',
    shortName: 'LRCandle',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: linearRegressionCandlesIndicator.metadata,
    inputConfig: linearRegressionCandlesIndicator.inputConfig as InputConfig[],
    plotConfig: linearRegressionCandlesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...linearRegressionCandlesIndicator.defaultInputs },
    calculate: linearRegressionCandlesIndicator.calculate,
  },
  {
    id: 'ma-adx',
    group: 'community',
    name: 'Moving Average ADX',
    shortName: 'MAADX',
    category: 'Moving Averages',
    overlay: true,
    metadata: maAdxIndicator.metadata,
    inputConfig: maAdxIndicator.inputConfig as InputConfig[],
    plotConfig: maAdxIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maAdxIndicator.defaultInputs },
    calculate: maAdxIndicator.calculate,
  },
  {
    id: 'macdas',
    group: 'community',
    name: 'MACDAS',
    shortName: 'MACDAS',
    category: 'Momentum',
    overlay: false,
    metadata: macdasIndicator.metadata,
    inputConfig: macdasIndicator.inputConfig as InputConfig[],
    plotConfig: macdasIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdasIndicator.defaultInputs },
    calculate: macdasIndicator.calculate,
  },
  {
    id: 'macd-bb',
    group: 'community',
    name: 'AK MACD BB',
    shortName: 'MACDBB',
    category: 'Momentum',
    overlay: false,
    metadata: macdBbIndicator.metadata,
    inputConfig: macdBbIndicator.inputConfig as InputConfig[],
    plotConfig: macdBbIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdBbIndicator.defaultInputs },
    calculate: macdBbIndicator.calculate,
  },
  {
    id: 'macd-crossover',
    group: 'community',
    name: 'MACD Crossover',
    shortName: 'MACDCross',
    category: 'Momentum',
    overlay: false,
    metadata: macdCrossoverIndicator.metadata,
    inputConfig: macdCrossoverIndicator.inputConfig as InputConfig[],
    plotConfig: macdCrossoverIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdCrossoverIndicator.defaultInputs },
    calculate: macdCrossoverIndicator.calculate,
  },
  {
    id: 'macd-dema',
    group: 'community',
    name: 'MACD DEMA',
    shortName: 'MACDDEMA',
    category: 'Momentum',
    overlay: false,
    metadata: macdDemaIndicator.metadata,
    inputConfig: macdDemaIndicator.inputConfig as InputConfig[],
    plotConfig: macdDemaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdDemaIndicator.defaultInputs },
    calculate: macdDemaIndicator.calculate,
  },
  {
    id: 'macd-divergence',
    group: 'community',
    name: 'MACD Divergence',
    shortName: 'MACDDiv',
    category: 'Momentum',
    overlay: false,
    metadata: macdDivergenceIndicator.metadata,
    inputConfig: macdDivergenceIndicator.inputConfig as InputConfig[],
    plotConfig: macdDivergenceIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdDivergenceIndicator.defaultInputs },
    calculate: macdDivergenceIndicator.calculate,
  },
  {
    id: 'macd-vxi',
    group: 'community',
    name: 'MACD VXI',
    shortName: 'MACDVXI',
    category: 'Momentum',
    overlay: false,
    metadata: macdVxiIndicator.metadata,
    inputConfig: macdVxiIndicator.inputConfig as InputConfig[],
    plotConfig: macdVxiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...macdVxiIndicator.defaultInputs },
    calculate: macdVxiIndicator.calculate,
  },
  {
    id: 'ma-colored',
    group: 'community',
    name: 'Moving Average Colored',
    shortName: 'MAC',
    category: 'Moving Averages',
    overlay: true,
    metadata: maColoredIndicator.metadata,
    inputConfig: maColoredIndicator.inputConfig as InputConfig[],
    plotConfig: maColoredIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maColoredIndicator.defaultInputs },
    calculate: maColoredIndicator.calculate,
  },
  {
    id: 'ma-deviation-rate',
    group: 'community',
    name: 'Moving Average Deviation Rate',
    shortName: 'MADR',
    category: 'Moving Averages',
    overlay: false,
    metadata: maDeviationRateIndicator.metadata,
    inputConfig: maDeviationRateIndicator.inputConfig as InputConfig[],
    plotConfig: maDeviationRateIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maDeviationRateIndicator.defaultInputs },
    calculate: maDeviationRateIndicator.calculate,
  },
  {
    id: 'market-cipher-a',
    group: 'community',
    name: 'Market Cipher A',
    shortName: 'MCA',
    category: 'Oscillators',
    overlay: false,
    metadata: marketCipherAIndicator.metadata,
    inputConfig: marketCipherAIndicator.inputConfig as InputConfig[],
    plotConfig: marketCipherAIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...marketCipherAIndicator.defaultInputs },
    calculate: marketCipherAIndicator.calculate,
  },
  {
    id: 'market-cipher-b',
    group: 'community',
    name: 'Market Cipher B',
    shortName: 'MCB',
    category: 'Oscillators',
    overlay: false,
    metadata: marketCipherBIndicator.metadata,
    inputConfig: marketCipherBIndicator.inputConfig as InputConfig[],
    plotConfig: marketCipherBIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...marketCipherBIndicator.defaultInputs },
    calculate: marketCipherBIndicator.calculate,
  },
  {
    id: 'market-shift-levels',
    group: 'community',
    name: 'Market Shift Levels',
    shortName: 'MSL',
    category: 'Trend',
    overlay: true,
    metadata: marketShiftLevelsIndicator.metadata,
    inputConfig: marketShiftLevelsIndicator.inputConfig as InputConfig[],
    plotConfig: marketShiftLevelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...marketShiftLevelsIndicator.defaultInputs },
    calculate: marketShiftLevelsIndicator.calculate,
  },
  {
    id: 'ma-shaded-fill',
    group: 'community',
    name: 'MA Shaded Fill Crossover',
    shortName: 'MASF',
    category: 'Moving Averages',
    overlay: true,
    metadata: maShadedFillIndicator.metadata,
    inputConfig: maShadedFillIndicator.inputConfig as InputConfig[],
    plotConfig: maShadedFillIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maShadedFillIndicator.defaultInputs },
    calculate: maShadedFillIndicator.calculate,
  },
  {
    id: 'ma-shift',
    group: 'community',
    name: 'Moving Average Shift',
    shortName: 'MAS',
    category: 'Moving Averages',
    overlay: true,
    metadata: maShiftIndicator.metadata,
    inputConfig: maShiftIndicator.inputConfig as InputConfig[],
    plotConfig: maShiftIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...maShiftIndicator.defaultInputs },
    calculate: maShiftIndicator.calculate,
  },
  {
    id: 'matrix-series',
    group: 'community',
    name: 'Matrix Series',
    shortName: 'MTX',
    category: 'Oscillators',
    overlay: false,
    metadata: matrixSeriesIndicator.metadata,
    inputConfig: matrixSeriesIndicator.inputConfig as InputConfig[],
    plotConfig: matrixSeriesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...matrixSeriesIndicator.defaultInputs },
    calculate: matrixSeriesIndicator.calculate,
  },
  {
    id: 'mfi-rsi-bb',
    group: 'community',
    name: 'MFI/RSI Bollinger Bands',
    shortName: 'MFIRSBB',
    category: 'Oscillators',
    overlay: false,
    metadata: mfiRsiBbIndicator.metadata,
    inputConfig: mfiRsiBbIndicator.inputConfig as InputConfig[],
    plotConfig: mfiRsiBbIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mfiRsiBbIndicator.defaultInputs },
    calculate: mfiRsiBbIndicator.calculate,
  },
  {
    id: 'modified-heikin-ashi',
    group: 'community',
    name: 'Modified Heikin-Ashi',
    shortName: 'ModHA',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: modifiedHeikinAshiIndicator.metadata,
    inputConfig: modifiedHeikinAshiIndicator.inputConfig as InputConfig[],
    plotConfig: modifiedHeikinAshiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...modifiedHeikinAshiIndicator.defaultInputs },
    calculate: modifiedHeikinAshiIndicator.calculate,
  },
  {
    id: 'multiple-ma',
    group: 'community',
    name: 'Multiple Moving Averages',
    shortName: 'MMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: multipleMaIndicator.metadata,
    inputConfig: multipleMaIndicator.inputConfig as InputConfig[],
    plotConfig: multipleMaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...multipleMaIndicator.defaultInputs },
    calculate: multipleMaIndicator.calculate,
  },
  {
    id: 'murreys-math-osc',
    group: 'community',
    name: 'MurreysOscillator',
    shortName: 'MMO',
    category: 'Oscillators',
    overlay: false,
    metadata: murreysMathOscIndicator.metadata,
    inputConfig: murreysMathOscIndicator.inputConfig as InputConfig[],
    plotConfig: murreysMathOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...murreysMathOscIndicator.defaultInputs },
    calculate: murreysMathOscIndicator.calculate,
  },
  {
    id: 'normalized-qqe',
    group: 'community',
    name: 'Normalized QQE',
    shortName: 'nQQE',
    category: 'Oscillators',
    overlay: false,
    metadata: normalizedQqeIndicator.metadata,
    inputConfig: normalizedQqeIndicator.inputConfig as InputConfig[],
    plotConfig: normalizedQqeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...normalizedQqeIndicator.defaultInputs },
    calculate: normalizedQqeIndicator.calculate,
  },
  {
    id: 'parallel-pivot-lines',
    group: 'community',
    name: 'Parallel Pivot Lines',
    shortName: 'PPL',
    category: 'Channels & Bands',
    overlay: true,
    metadata: parallelPivotLinesIndicator.metadata,
    inputConfig: parallelPivotLinesIndicator.inputConfig as InputConfig[],
    plotConfig: parallelPivotLinesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...parallelPivotLinesIndicator.defaultInputs },
    calculate: parallelPivotLinesIndicator.calculate,
  },
  {
    id: 'philakone-ema-swing',
    group: 'community',
    name: 'Philakone 55 EMA Swing Trading',
    shortName: 'P55EMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: philakoneEmaSwingIndicator.metadata,
    inputConfig: philakoneEmaSwingIndicator.inputConfig as InputConfig[],
    plotConfig: philakoneEmaSwingIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...philakoneEmaSwingIndicator.defaultInputs },
    calculate: philakoneEmaSwingIndicator.calculate,
  },
  {
    id: 'pivot-point-supertrend',
    group: 'community',
    name: 'Pivot Point SuperTrend',
    shortName: 'PPST',
    category: 'Trend',
    overlay: true,
    metadata: pivotPointSupertrendIndicator.metadata,
    inputConfig: pivotPointSupertrendIndicator.inputConfig as InputConfig[],
    plotConfig: pivotPointSupertrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...pivotPointSupertrendIndicator.defaultInputs },
    calculate: pivotPointSupertrendIndicator.calculate,
  },
  {
    id: 'ppo-alerts',
    group: 'community',
    name: 'PPO Alerts',
    shortName: 'PPOAlerts',
    category: 'Momentum',
    overlay: false,
    metadata: ppoAlertsIndicator.metadata,
    inputConfig: ppoAlertsIndicator.inputConfig as InputConfig[],
    plotConfig: ppoAlertsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ppoAlertsIndicator.defaultInputs },
    calculate: ppoAlertsIndicator.calculate,
  },
  {
    id: 'ppo-divergence',
    group: 'community',
    name: 'PPO Divergence',
    shortName: 'PPODiv',
    category: 'Momentum',
    overlay: false,
    metadata: ppoDivergenceIndicator.metadata,
    inputConfig: ppoDivergenceIndicator.inputConfig as InputConfig[],
    plotConfig: ppoDivergenceIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ppoDivergenceIndicator.defaultInputs },
    calculate: ppoDivergenceIndicator.calculate,
  },
  {
    id: 'price-action-system',
    group: 'community',
    name: 'Price Action Trading System',
    shortName: 'PATS',
    category: 'Oscillators',
    overlay: true,
    metadata: priceActionSystemIndicator.metadata,
    inputConfig: priceActionSystemIndicator.inputConfig as InputConfig[],
    plotConfig: priceActionSystemIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...priceActionSystemIndicator.defaultInputs },
    calculate: priceActionSystemIndicator.calculate,
  },
  {
    id: 'qqe',
    group: 'community',
    name: 'Quantitative Qualitative Estimation',
    shortName: 'QQE',
    category: 'Oscillators',
    overlay: false,
    metadata: qqeIndicator.metadata,
    inputConfig: qqeIndicator.inputConfig as InputConfig[],
    plotConfig: qqeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...qqeIndicator.defaultInputs },
    calculate: qqeIndicator.calculate,
  },
  {
    id: 'qqe-signals',
    group: 'community',
    name: 'QQE Signals',
    shortName: 'QQESig',
    category: 'Oscillators',
    overlay: false,
    metadata: qqeSignalsIndicator.metadata,
    inputConfig: qqeSignalsIndicator.inputConfig as InputConfig[],
    plotConfig: qqeSignalsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...qqeSignalsIndicator.defaultInputs },
    calculate: qqeSignalsIndicator.calculate,
  },
  {
    id: 'rci-3lines',
    group: 'community',
    name: 'RCI 3 Lines',
    shortName: 'RCI3',
    category: 'Oscillators',
    overlay: false,
    metadata: rci3linesIndicator.metadata,
    inputConfig: rci3linesIndicator.inputConfig as InputConfig[],
    plotConfig: rci3linesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rci3linesIndicator.defaultInputs },
    calculate: rci3linesIndicator.calculate,
  },
  {
    id: 'redk-rss-wma',
    group: 'community',
    name: 'RedK RSS_WMA',
    shortName: 'RSS',
    category: 'Moving Averages',
    overlay: true,
    metadata: redkRssWmaIndicator.metadata,
    inputConfig: redkRssWmaIndicator.inputConfig as InputConfig[],
    plotConfig: redkRssWmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...redkRssWmaIndicator.defaultInputs },
    calculate: redkRssWmaIndicator.calculate,
  },
  {
    id: 'reversal-candle-setup',
    group: 'community',
    name: 'Reversal Candle Setup',
    shortName: 'RevCdl',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: reversalCandleSetupIndicator.metadata,
    inputConfig: reversalCandleSetupIndicator.inputConfig as InputConfig[],
    plotConfig: reversalCandleSetupIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...reversalCandleSetupIndicator.defaultInputs },
    calculate: reversalCandleSetupIndicator.calculate,
  },
  {
    id: 'rsi-bands',
    group: 'community',
    name: 'RSI Bands %B & Bandwidth',
    shortName: 'RSIB',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiBandsIndicator.metadata,
    inputConfig: rsiBandsIndicator.inputConfig as InputConfig[],
    plotConfig: rsiBandsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiBandsIndicator.defaultInputs },
    calculate: rsiBandsIndicator.calculate,
  },
  {
    id: 'rsi-bb-dispersion',
    group: 'community',
    name: 'RSI + BB + Dispersion',
    shortName: 'RSIBB',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiBbDispersionIndicator.metadata,
    inputConfig: rsiBbDispersionIndicator.inputConfig as InputConfig[],
    plotConfig: rsiBbDispersionIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiBbDispersionIndicator.defaultInputs },
    calculate: rsiBbDispersionIndicator.calculate,
  },
  {
    id: 'rsi-divergence',
    group: 'community',
    name: 'RSI Divergence',
    shortName: 'RSIDiv',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiDivergenceIndicator.metadata,
    inputConfig: rsiDivergenceIndicator.inputConfig as InputConfig[],
    plotConfig: rsiDivergenceIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiDivergenceIndicator.defaultInputs },
    calculate: rsiDivergenceIndicator.calculate,
  },
  {
    id: 'rsi-histoalert',
    group: 'community',
    name: 'RSI HistoAlert',
    shortName: 'RSIHist',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiHistoalertIndicator.metadata,
    inputConfig: rsiHistoalertIndicator.inputConfig as InputConfig[],
    plotConfig: rsiHistoalertIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiHistoalertIndicator.defaultInputs },
    calculate: rsiHistoalertIndicator.calculate,
  },
  {
    id: 'rsi-snabbel',
    group: 'community',
    name: 'RSI Snabbel',
    shortName: 'RSISnab',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiSnabbelIndicator.metadata,
    inputConfig: rsiSnabbelIndicator.inputConfig as InputConfig[],
    plotConfig: rsiSnabbelIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiSnabbelIndicator.defaultInputs },
    calculate: rsiSnabbelIndicator.calculate,
  },
  {
    id: 'rsi-swing-signal',
    group: 'community',
    name: 'RSI Swing Signal',
    shortName: 'RSISwing',
    category: 'Oscillators',
    overlay: false,
    metadata: rsiSwingSignalIndicator.metadata,
    inputConfig: rsiSwingSignalIndicator.inputConfig as InputConfig[],
    plotConfig: rsiSwingSignalIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiSwingSignalIndicator.defaultInputs },
    calculate: rsiSwingSignalIndicator.calculate,
  },
  {
    id: 'rs-support-resistance',
    group: 'community',
    name: '[RS] Support and Resistance V0',
    shortName: 'RS S/R',
    category: 'Channels & Bands',
    overlay: true,
    metadata: rsSupportResistanceIndicator.metadata,
    inputConfig: rsSupportResistanceIndicator.inputConfig as InputConfig[],
    plotConfig: rsSupportResistanceIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsSupportResistanceIndicator.defaultInputs },
    calculate: rsSupportResistanceIndicator.calculate,
  },
  {
    id: 'sar-ema-macd',
    group: 'community',
    name: 'SAR + EMA + MACD Signals',
    shortName: 'SEM',
    category: 'Oscillators',
    overlay: true,
    metadata: sarEmaMacdIndicator.metadata,
    inputConfig: sarEmaMacdIndicator.inputConfig as InputConfig[],
    plotConfig: sarEmaMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...sarEmaMacdIndicator.defaultInputs },
    calculate: sarEmaMacdIndicator.calculate,
  },
  {
    id: 'scalping-line',
    group: 'community',
    name: 'Scalping Line',
    shortName: 'SL',
    category: 'Oscillators',
    overlay: true,
    metadata: scalpingLineIndicator.metadata,
    inputConfig: scalpingLineIndicator.inputConfig as InputConfig[],
    plotConfig: scalpingLineIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...scalpingLineIndicator.defaultInputs },
    calculate: scalpingLineIndicator.calculate,
  },
  {
    id: 'sell-buy-rates',
    group: 'community',
    name: 'Sell & Buy Rates',
    shortName: 'SBR',
    category: 'Oscillators',
    overlay: false,
    metadata: sellBuyRatesIndicator.metadata,
    inputConfig: sellBuyRatesIndicator.inputConfig as InputConfig[],
    plotConfig: sellBuyRatesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...sellBuyRatesIndicator.defaultInputs },
    calculate: sellBuyRatesIndicator.calculate,
  },
  {
    id: 'signal-ma',
    group: 'community',
    name: 'Signal Moving Average',
    shortName: 'SigMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: signalMaIndicator.metadata,
    inputConfig: signalMaIndicator.inputConfig as InputConfig[],
    plotConfig: signalMaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...signalMaIndicator.defaultInputs },
    calculate: signalMaIndicator.calculate,
  },
  {
    id: 'simple-moving-averages',
    group: 'community',
    name: 'Simple Moving Averages',
    shortName: 'SMA5',
    category: 'Moving Averages',
    overlay: true,
    metadata: simpleMovingAveragesIndicator.metadata,
    inputConfig: simpleMovingAveragesIndicator.inputConfig as InputConfig[],
    plotConfig: simpleMovingAveragesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...simpleMovingAveragesIndicator.defaultInputs },
    calculate: simpleMovingAveragesIndicator.calculate,
  },
  {
    id: 'slow-heiken-ashi',
    group: 'community',
    name: 'Slow Heiken Ashi',
    shortName: 'SlowHA',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: slowHeikenAshiIndicator.metadata,
    inputConfig: slowHeikenAshiIndicator.inputConfig as InputConfig[],
    plotConfig: slowHeikenAshiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...slowHeikenAshiIndicator.defaultInputs },
    calculate: slowHeikenAshiIndicator.calculate,
  },
  {
    id: 'smi-ucs',
    group: 'community',
    name: 'Stochastic Momentum Index UCS',
    shortName: 'SMIUCS',
    category: 'Oscillators',
    overlay: false,
    metadata: smiUcsIndicator.metadata,
    inputConfig: smiUcsIndicator.inputConfig as InputConfig[],
    plotConfig: smiUcsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...smiUcsIndicator.defaultInputs },
    calculate: smiUcsIndicator.calculate,
  },
  {
    id: 'squeeze-momentum-v2',
    group: 'community',
    name: 'Squeeze Momentum V2',
    shortName: 'SQZMOMV2',
    category: 'Oscillators',
    overlay: false,
    metadata: squeezeMomentumV2Indicator.metadata,
    inputConfig: squeezeMomentumV2Indicator.inputConfig as InputConfig[],
    plotConfig: squeezeMomentumV2Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...squeezeMomentumV2Indicator.defaultInputs },
    calculate: squeezeMomentumV2Indicator.calculate,
  },
  {
    id: 'sr-levels-breaks',
    group: 'community',
    name: 'Support and Resistance Levels with Breaks',
    shortName: 'S/R Breaks',
    category: 'Channels & Bands',
    overlay: true,
    metadata: srLevelsBreaksIndicator.metadata,
    inputConfig: srLevelsBreaksIndicator.inputConfig as InputConfig[],
    plotConfig: srLevelsBreaksIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...srLevelsBreaksIndicator.defaultInputs },
    calculate: srLevelsBreaksIndicator.calculate,
  },
  {
    id: 'st0p',
    group: 'community',
    name: 'ST0P',
    shortName: 'ST0P',
    category: 'Oscillators',
    overlay: true,
    metadata: st0pIndicator.metadata,
    inputConfig: st0pIndicator.inputConfig as InputConfig[],
    plotConfig: st0pIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...st0pIndicator.defaultInputs },
    calculate: st0pIndicator.calculate,
  },
  {
    id: 'stochastic-ott',
    group: 'community',
    name: 'Stochastic OTT',
    shortName: 'StochOTT',
    category: 'Oscillators',
    overlay: false,
    metadata: stochasticOttIndicator.metadata,
    inputConfig: stochasticOttIndicator.inputConfig as InputConfig[],
    plotConfig: stochasticOttIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...stochasticOttIndicator.defaultInputs },
    calculate: stochasticOttIndicator.calculate,
  },
  {
    id: 'stoch-pop-1',
    group: 'community',
    name: 'CM Stochastic POP Method 1',
    shortName: 'StochPOP1',
    category: 'Oscillators',
    overlay: false,
    metadata: stochPop1Indicator.metadata,
    inputConfig: stochPop1Indicator.inputConfig as InputConfig[],
    plotConfig: stochPop1Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...stochPop1Indicator.defaultInputs },
    calculate: stochPop1Indicator.calculate,
  },
  {
    id: 'stoch-pop-2',
    group: 'community',
    name: 'CM Stochastic POP Method 2',
    shortName: 'StochPOP2',
    category: 'Oscillators',
    overlay: false,
    metadata: stochPop2Indicator.metadata,
    inputConfig: stochPop2Indicator.inputConfig as InputConfig[],
    plotConfig: stochPop2Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...stochPop2Indicator.defaultInputs },
    calculate: stochPop2Indicator.calculate,
  },
  {
    id: 'stoch-vx3',
    group: 'community',
    name: 'Stoch VX3',
    shortName: 'StochVX3',
    category: 'Oscillators',
    overlay: false,
    metadata: stochVx3Indicator.metadata,
    inputConfig: stochVx3Indicator.inputConfig as InputConfig[],
    plotConfig: stochVx3Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...stochVx3Indicator.defaultInputs },
    calculate: stochVx3Indicator.calculate,
  },
  {
    id: 'super-smoothed-macd',
    group: 'community',
    name: 'Super Smoothed MACD',
    shortName: 'SSMACD',
    category: 'Momentum',
    overlay: false,
    metadata: superSmoothedMacdIndicator.metadata,
    inputConfig: superSmoothedMacdIndicator.inputConfig as InputConfig[],
    plotConfig: superSmoothedMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...superSmoothedMacdIndicator.defaultInputs },
    calculate: superSmoothedMacdIndicator.calculate,
  },
  {
    id: 'super-supertrend',
    group: 'community',
    name: 'Super SuperTrend',
    shortName: 'SST',
    category: 'Trend',
    overlay: true,
    metadata: superSupertrendIndicator.metadata,
    inputConfig: superSupertrendIndicator.inputConfig as InputConfig[],
    plotConfig: superSupertrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...superSupertrendIndicator.defaultInputs },
    calculate: superSupertrendIndicator.calculate,
  },
  {
    id: 'supertrend-channels',
    group: 'community',
    name: 'SuperTrend Channels',
    shortName: 'STCh',
    category: 'Channels & Bands',
    overlay: true,
    metadata: supertrendChannelsIndicator.metadata,
    inputConfig: supertrendChannelsIndicator.inputConfig as InputConfig[],
    plotConfig: supertrendChannelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...supertrendChannelsIndicator.defaultInputs },
    calculate: supertrendChannelsIndicator.calculate,
  },
  {
    id: 'swing-trade-signals',
    group: 'community',
    name: 'Swing Trade Signals',
    shortName: 'STS',
    category: 'Oscillators',
    overlay: true,
    metadata: swingTradeSignalsIndicator.metadata,
    inputConfig: swingTradeSignalsIndicator.inputConfig as InputConfig[],
    plotConfig: swingTradeSignalsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...swingTradeSignalsIndicator.defaultInputs },
    calculate: swingTradeSignalsIndicator.calculate,
  },
  {
    id: 'tdi-hlc-trix',
    group: 'community',
    name: 'Traders Dynamic Index',
    shortName: 'TDI',
    category: 'Oscillators',
    overlay: false,
    metadata: tdiHlcTrixIndicator.metadata,
    inputConfig: tdiHlcTrixIndicator.inputConfig as InputConfig[],
    plotConfig: tdiHlcTrixIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tdiHlcTrixIndicator.defaultInputs },
    calculate: tdiHlcTrixIndicator.calculate,
  },
  {
    id: 'td-macd',
    group: 'community',
    name: 'Tom DeMark MACD',
    shortName: 'TDMacd',
    category: 'Momentum',
    overlay: false,
    metadata: tdMacdIndicator.metadata,
    inputConfig: tdMacdIndicator.inputConfig as InputConfig[],
    plotConfig: tdMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tdMacdIndicator.defaultInputs },
    calculate: tdMacdIndicator.calculate,
  },
  {
    id: 'three-moving-averages',
    group: 'community',
    name: 'Three Moving Averages',
    shortName: '3MA',
    category: 'Moving Averages',
    overlay: true,
    metadata: threeMovingAveragesIndicator.metadata,
    inputConfig: threeMovingAveragesIndicator.inputConfig as InputConfig[],
    plotConfig: threeMovingAveragesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...threeMovingAveragesIndicator.defaultInputs },
    calculate: threeMovingAveragesIndicator.calculate,
  },
  {
    id: 'tonyux-ema-scalper',
    group: 'community',
    name: 'TonyUX EMA Scalper',
    shortName: 'TUXS',
    category: 'Oscillators',
    overlay: true,
    metadata: tonyuxEmaScalperIndicator.metadata,
    inputConfig: tonyuxEmaScalperIndicator.inputConfig as InputConfig[],
    plotConfig: tonyuxEmaScalperIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tonyuxEmaScalperIndicator.defaultInputs },
    calculate: tonyuxEmaScalperIndicator.calculate,
  },
  {
    id: 'top-bottom-candle',
    group: 'community',
    name: 'Top & Bottom Candle',
    shortName: 'TopBot',
    category: 'Candlestick Patterns',
    overlay: true,
    metadata: topBottomCandleIndicator.metadata,
    inputConfig: topBottomCandleIndicator.inputConfig as InputConfig[],
    plotConfig: topBottomCandleIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...topBottomCandleIndicator.defaultInputs },
    calculate: topBottomCandleIndicator.calculate,
  },
  {
    id: 'tops-bottoms',
    group: 'community',
    name: 'Tops/Bottoms',
    shortName: 'TB',
    category: 'Oscillators',
    overlay: true,
    metadata: topsBottomsIndicator.metadata,
    inputConfig: topsBottomsIndicator.inputConfig as InputConfig[],
    plotConfig: topsBottomsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...topsBottomsIndicator.defaultInputs },
    calculate: topsBottomsIndicator.calculate,
  },
  {
    id: 'trama',
    group: 'community',
    name: 'Trend Regularity Adaptive MA',
    shortName: 'TRAMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: tramaIndicator.metadata,
    inputConfig: tramaIndicator.inputConfig as InputConfig[],
    plotConfig: tramaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tramaIndicator.defaultInputs },
    calculate: tramaIndicator.calculate,
  },
  {
    id: 'transient-zones',
    group: 'community',
    name: 'Transient Zones v1.1',
    shortName: 'TZones',
    category: 'Channels & Bands',
    overlay: true,
    metadata: transientZonesIndicator.metadata,
    inputConfig: transientZonesIndicator.inputConfig as InputConfig[],
    plotConfig: transientZonesIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...transientZonesIndicator.defaultInputs },
    calculate: transientZonesIndicator.calculate,
  },
  {
    id: 'trend-following-ma',
    group: 'community',
    name: 'Trend Following Moving Averages',
    shortName: 'TFMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: trendFollowingMaIndicator.metadata,
    inputConfig: trendFollowingMaIndicator.inputConfig as InputConfig[],
    plotConfig: trendFollowingMaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...trendFollowingMaIndicator.defaultInputs },
    calculate: trendFollowingMaIndicator.calculate,
  },
  {
    id: 'trend-trader',
    group: 'community',
    name: 'Trend Trader Strategy',
    shortName: 'TrendTrader',
    category: 'Trend',
    overlay: true,
    metadata: trendTraderIndicator.metadata,
    inputConfig: trendTraderIndicator.inputConfig as InputConfig[],
    plotConfig: trendTraderIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...trendTraderIndicator.defaultInputs },
    calculate: trendTraderIndicator.calculate,
  },
  {
    id: 'triangular-momentum-osc',
    group: 'community',
    name: 'Triangular Momentum Oscillator',
    shortName: 'TMO',
    category: 'Oscillators',
    overlay: false,
    metadata: triangularMomentumOscIndicator.metadata,
    inputConfig: triangularMomentumOscIndicator.inputConfig as InputConfig[],
    plotConfig: triangularMomentumOscIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...triangularMomentumOscIndicator.defaultInputs },
    calculate: triangularMomentumOscIndicator.calculate,
  },
  {
    id: 'triple-ma-forecast',
    group: 'community',
    name: 'Triple MA Forecast',
    shortName: '3MAF',
    category: 'Moving Averages',
    overlay: true,
    metadata: tripleMaForecastIndicator.metadata,
    inputConfig: tripleMaForecastIndicator.inputConfig as InputConfig[],
    plotConfig: tripleMaForecastIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...tripleMaForecastIndicator.defaultInputs },
    calculate: tripleMaForecastIndicator.calculate,
  },
  {
    id: 'ttm-squeeze-pro',
    group: 'community',
    name: 'TTM Squeeze Pro',
    shortName: 'TTMSqzPro',
    category: 'Oscillators',
    overlay: false,
    metadata: ttmSqueezeProIndicator.metadata,
    inputConfig: ttmSqueezeProIndicator.inputConfig as InputConfig[],
    plotConfig: ttmSqueezeProIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ttmSqueezeProIndicator.defaultInputs },
    calculate: ttmSqueezeProIndicator.calculate,
  },
  {
    id: 'vdub-sniper',
    group: 'community',
    name: 'Vdub FX Sniper',
    shortName: 'VSniper',
    category: 'Oscillators',
    overlay: false,
    metadata: vdubSniperIndicator.metadata,
    inputConfig: vdubSniperIndicator.inputConfig as InputConfig[],
    plotConfig: vdubSniperIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vdubSniperIndicator.defaultInputs },
    calculate: vdubSniperIndicator.calculate,
  },
  {
    id: 'vdubus-binarypro',
    group: 'community',
    name: 'vdubus BinaryPro',
    shortName: 'VBP',
    category: 'Oscillators',
    overlay: false,
    metadata: vdubusBinaryproIndicator.metadata,
    inputConfig: vdubusBinaryproIndicator.inputConfig as InputConfig[],
    plotConfig: vdubusBinaryproIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vdubusBinaryproIndicator.defaultInputs },
    calculate: vdubusBinaryproIndicator.calculate,
  },
  {
    id: 'volume-colored-bars',
    group: 'community',
    name: 'Volume Colored Bars',
    shortName: 'VCBars',
    category: 'Volume',
    overlay: false,
    metadata: volumeColoredBarsIndicator.metadata,
    inputConfig: volumeColoredBarsIndicator.inputConfig as InputConfig[],
    plotConfig: volumeColoredBarsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...volumeColoredBarsIndicator.defaultInputs },
    calculate: volumeColoredBarsIndicator.calculate,
  },
  {
    id: 'volume-flow-v3',
    group: 'community',
    name: 'Volume Flow v3',
    shortName: 'VFv3',
    category: 'Volume',
    overlay: false,
    metadata: volumeFlowV3Indicator.metadata,
    inputConfig: volumeFlowV3Indicator.inputConfig as InputConfig[],
    plotConfig: volumeFlowV3Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...volumeFlowV3Indicator.defaultInputs },
    calculate: volumeFlowV3Indicator.calculate,
  },
  {
    id: 'volume-linreg-trend',
    group: 'community',
    name: 'Volume LinReg Trend',
    shortName: 'VLRTrend',
    category: 'Volume',
    overlay: true,
    metadata: volumeLinregTrendIndicator.metadata,
    inputConfig: volumeLinregTrendIndicator.inputConfig as InputConfig[],
    plotConfig: volumeLinregTrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...volumeLinregTrendIndicator.defaultInputs },
    calculate: volumeLinregTrendIndicator.calculate,
  },
  {
    id: 'vwmacd-szo',
    group: 'community',
    name: 'VWMACD & SZO',
    shortName: 'VWMACDSZO',
    category: 'Momentum',
    overlay: false,
    metadata: vwmacdSzoIndicator.metadata,
    inputConfig: vwmacdSzoIndicator.inputConfig as InputConfig[],
    plotConfig: vwmacdSzoIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vwmacdSzoIndicator.defaultInputs },
    calculate: vwmacdSzoIndicator.calculate,
  },
  {
    id: 'vw-macd-v2',
    group: 'community',
    name: 'Volume Weighted MACD V2',
    shortName: 'VWMACDV2',
    category: 'Momentum',
    overlay: false,
    metadata: vwMacdV2Indicator.metadata,
    inputConfig: vwMacdV2Indicator.inputConfig as InputConfig[],
    plotConfig: vwMacdV2Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...vwMacdV2Indicator.defaultInputs },
    calculate: vwMacdV2Indicator.calculate,
  },
  {
    id: 'weis-wave-volume',
    group: 'community',
    name: 'Weis Wave Volume',
    shortName: 'WWV',
    category: 'Volume',
    overlay: false,
    metadata: weisWaveVolumeIndicator.metadata,
    inputConfig: weisWaveVolumeIndicator.inputConfig as InputConfig[],
    plotConfig: weisWaveVolumeIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...weisWaveVolumeIndicator.defaultInputs },
    calculate: weisWaveVolumeIndicator.calculate,
  },
  {
    id: 'wicked-fractals',
    group: 'community',
    name: 'WICK.ED Fractals',
    shortName: 'WFrac',
    category: 'Oscillators',
    overlay: true,
    metadata: wickedFractalsIndicator.metadata,
    inputConfig: wickedFractalsIndicator.inputConfig as InputConfig[],
    plotConfig: wickedFractalsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...wickedFractalsIndicator.defaultInputs },
    calculate: wickedFractalsIndicator.calculate,
  },
  {
    id: 'williams-combo',
    group: 'community',
    name: 'Williams Alligator + Fractals',
    shortName: 'WilliamsCombo',
    category: 'Trend',
    overlay: true,
    metadata: williamsComboIndicator.metadata,
    inputConfig: williamsComboIndicator.inputConfig as InputConfig[],
    plotConfig: williamsComboIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...williamsComboIndicator.defaultInputs },
    calculate: williamsComboIndicator.calculate,
  },
  {
    id: 'zero-lag-ema',
    group: 'community',
    name: 'Zero Lag EMA',
    shortName: 'ZLEMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: zeroLagEmaIndicator.metadata,
    inputConfig: zeroLagEmaIndicator.inputConfig as InputConfig[],
    plotConfig: zeroLagEmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...zeroLagEmaIndicator.defaultInputs },
    calculate: zeroLagEmaIndicator.calculate,
  },
  // Candlestick Patterns

  // Medium community indicators
  {
    id: 'bjorgum-triple-ema',
    group: 'community',
    name: 'Fast Length',
    shortName: 'BTEMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: bjorgumTripleEmaIndicator.metadata,
    inputConfig: bjorgumTripleEmaIndicator.inputConfig as InputConfig[],
    plotConfig: bjorgumTripleEmaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bjorgumTripleEmaIndicator.defaultInputs },
    calculate: bjorgumTripleEmaIndicator.calculate,
  },
  {
    id: 'bollinger-awesome-alert',
    group: 'community',
    name: 'AO Fast',
    shortName: 'BBAO',
    category: 'Oscillators',
    overlay: false,
    metadata: bollingerAwesomeAlertIndicator.metadata,
    inputConfig: bollingerAwesomeAlertIndicator.inputConfig as InputConfig[],
    plotConfig: bollingerAwesomeAlertIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...bollingerAwesomeAlertIndicator.defaultInputs },
    calculate: bollingerAwesomeAlertIndicator.calculate,
  },
  {
    id: 'cci-stochastic',
    group: 'community',
    name: 'CCI Length',
    shortName: 'CCIStoch',
    category: 'Momentum',
    overlay: false,
    metadata: cciStochasticIndicator.metadata,
    inputConfig: cciStochasticIndicator.inputConfig as InputConfig[],
    plotConfig: cciStochasticIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...cciStochasticIndicator.defaultInputs },
    calculate: cciStochasticIndicator.calculate,
  },
  {
    id: 'double-macd',
    group: 'community',
    name: 'MACD1 Fast',
    shortName: 'DMACD',
    category: 'Momentum',
    overlay: false,
    metadata: doubleMacdIndicator.metadata,
    inputConfig: doubleMacdIndicator.inputConfig as InputConfig[],
    plotConfig: doubleMacdIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...doubleMacdIndicator.defaultInputs },
    calculate: doubleMacdIndicator.calculate,
  },
  {
    id: 'gaussian-channel',
    group: 'community',
    name: 'Length',
    shortName: 'GC',
    category: 'Channels & Bands',
    overlay: true,
    metadata: gaussianChannelIndicator.metadata,
    inputConfig: gaussianChannelIndicator.inputConfig as InputConfig[],
    plotConfig: gaussianChannelIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...gaussianChannelIndicator.defaultInputs },
    calculate: gaussianChannelIndicator.calculate,
  },
  {
    id: 'ichimoku-oscillator',
    group: 'community',
    name: 'Conversion Periods',
    shortName: 'IchiOsc',
    category: 'Momentum',
    overlay: false,
    metadata: ichimokuOscillatorIndicator.metadata,
    inputConfig: ichimokuOscillatorIndicator.inputConfig as InputConfig[],
    plotConfig: ichimokuOscillatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ichimokuOscillatorIndicator.defaultInputs },
    calculate: ichimokuOscillatorIndicator.calculate,
  },
  {
    id: 'ideal-bb-ma',
    group: 'community',
    name: 'BB Length',
    shortName: 'IBBMA',
    category: 'Moving Averages',
    overlay: true,
    metadata: idealBbMaIndicator.metadata,
    inputConfig: idealBbMaIndicator.inputConfig as InputConfig[],
    plotConfig: idealBbMaIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...idealBbMaIndicator.defaultInputs },
    calculate: idealBbMaIndicator.calculate,
  },
  {
    id: 'lucid-sar',
    group: 'community',
    name: 'Start',
    shortName: 'LSAR',
    category: 'Trend',
    overlay: true,
    metadata: lucidSarIndicator.metadata,
    inputConfig: lucidSarIndicator.inputConfig as InputConfig[],
    plotConfig: lucidSarIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...lucidSarIndicator.defaultInputs },
    calculate: lucidSarIndicator.calculate,
  },
  {
    id: 'madrid-ma-ribbon',
    group: 'community',
    name: 'MA Type',
    shortName: 'MAR',
    category: 'Moving Averages',
    overlay: true,
    metadata: madridMaRibbonIndicator.metadata,
    inputConfig: madridMaRibbonIndicator.inputConfig as InputConfig[],
    plotConfig: madridMaRibbonIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...madridMaRibbonIndicator.defaultInputs },
    calculate: madridMaRibbonIndicator.calculate,
  },
  {
    id: 'most-rsi',
    group: 'community',
    name: 'RSI Length',
    shortName: 'MOST-RSI',
    category: 'Momentum',
    overlay: false,
    metadata: mostRsiIndicator.metadata,
    inputConfig: mostRsiIndicator.inputConfig as InputConfig[],
    plotConfig: mostRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mostRsiIndicator.defaultInputs },
    calculate: mostRsiIndicator.calculate,
  },
  {
    id: 'nrtr',
    group: 'community',
    name: 'ATR Period',
    shortName: 'NRTR',
    category: 'Trend',
    overlay: true,
    metadata: nrtrIndicator.metadata,
    inputConfig: nrtrIndicator.inputConfig as InputConfig[],
    plotConfig: nrtrIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...nrtrIndicator.defaultInputs },
    calculate: nrtrIndicator.calculate,
  },
  {
    id: 'ott-bands',
    group: 'community',
    name: 'Source',
    shortName: 'OTTBands',
    category: 'Channels & Bands',
    overlay: true,
    metadata: ottBandsIndicator.metadata,
    inputConfig: ottBandsIndicator.inputConfig as InputConfig[],
    plotConfig: ottBandsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ottBandsIndicator.defaultInputs },
    calculate: ottBandsIndicator.calculate,
  },
  {
    id: 'otto',
    group: 'community',
    name: 'Source',
    shortName: 'OTTO',
    category: 'Oscillators',
    overlay: false,
    metadata: ottoIndicator.metadata,
    inputConfig: ottoIndicator.inputConfig as InputConfig[],
    plotConfig: ottoIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...ottoIndicator.defaultInputs },
    calculate: ottoIndicator.calculate,
  },
  {
    id: 'parabolic-rsi',
    group: 'community',
    name: 'RSI Length',
    shortName: 'PRSI',
    category: 'Momentum',
    overlay: false,
    metadata: parabolicRsiIndicator.metadata,
    inputConfig: parabolicRsiIndicator.inputConfig as InputConfig[],
    plotConfig: parabolicRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...parabolicRsiIndicator.defaultInputs },
    calculate: parabolicRsiIndicator.calculate,
  },
  {
    id: 'pivot-hh-hl-lh-ll',
    group: 'community',
    name: 'Left Bars',
    shortName: 'PivotHHLL',
    category: 'Trend',
    overlay: true,
    metadata: pivotHhHlLhLlIndicator.metadata,
    inputConfig: pivotHhHlLhLlIndicator.inputConfig as InputConfig[],
    plotConfig: pivotHhHlLhLlIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...pivotHhHlLhLlIndicator.defaultInputs },
    calculate: pivotHhHlLhLlIndicator.calculate,
  },
  {
    id: 'pmax-rsi-t3',
    group: 'community',
    name: 'RSI Length',
    shortName: 'PMaxRSIT3',
    category: 'Momentum',
    overlay: false,
    metadata: pmaxRsiT3Indicator.metadata,
    inputConfig: pmaxRsiT3Indicator.inputConfig as InputConfig[],
    plotConfig: pmaxRsiT3Indicator.plotConfig as PlotConfig[],
    defaultInputs: { ...pmaxRsiT3Indicator.defaultInputs },
    calculate: pmaxRsiT3Indicator.calculate,
  },
  {
    id: 'profit-maximizer',
    group: 'community',
    name: 'ATR Period',
    shortName: 'PMax',
    category: 'Moving Averages',
    overlay: true,
    metadata: profitMaximizerIndicator.metadata,
    inputConfig: profitMaximizerIndicator.inputConfig as InputConfig[],
    plotConfig: profitMaximizerIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...profitMaximizerIndicator.defaultInputs },
    calculate: profitMaximizerIndicator.calculate,
  },
  {
    id: 'range-filter-dw',
    group: 'community',
    name: 'Source',
    shortName: 'RngFilt',
    category: 'Trend',
    overlay: true,
    metadata: rangeFilterDwIndicator.metadata,
    inputConfig: rangeFilterDwIndicator.inputConfig as InputConfig[],
    plotConfig: rangeFilterDwIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rangeFilterDwIndicator.defaultInputs },
    calculate: rangeFilterDwIndicator.calculate,
  },
  {
    id: 'redk-vader',
    group: 'community',
    name: 'Length',
    shortName: 'VADER',
    category: 'Oscillators',
    overlay: false,
    metadata: redkVaderIndicator.metadata,
    inputConfig: redkVaderIndicator.inputConfig as InputConfig[],
    plotConfig: redkVaderIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...redkVaderIndicator.defaultInputs },
    calculate: redkVaderIndicator.calculate,
  },
  {
    id: 'rmi-trend-sniper',
    group: 'community',
    name: 'RMI Length',
    shortName: 'RMI',
    category: 'Momentum',
    overlay: false,
    metadata: rmiTrendSniperIndicator.metadata,
    inputConfig: rmiTrendSniperIndicator.inputConfig as InputConfig[],
    plotConfig: rmiTrendSniperIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rmiTrendSniperIndicator.defaultInputs },
    calculate: rmiTrendSniperIndicator.calculate,
  },
  {
    id: 'rsi-cyclic-smoothed',
    group: 'community',
    name: 'RSI Length',
    shortName: 'RSICS',
    category: 'Momentum',
    overlay: false,
    metadata: rsiCyclicSmoothedIndicator.metadata,
    inputConfig: rsiCyclicSmoothedIndicator.inputConfig as InputConfig[],
    plotConfig: rsiCyclicSmoothedIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...rsiCyclicSmoothedIndicator.defaultInputs },
    calculate: rsiCyclicSmoothedIndicator.calculate,
  },
  {
    id: 'supertrend-ladder',
    group: 'community',
    name: 'ATR Period',
    shortName: 'STLadder',
    category: 'Trend',
    overlay: true,
    metadata: supertrendLadderIndicator.metadata,
    inputConfig: supertrendLadderIndicator.inputConfig as InputConfig[],
    plotConfig: supertrendLadderIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...supertrendLadderIndicator.defaultInputs },
    calculate: supertrendLadderIndicator.calculate,
  },
  {
    id: 't3-psar',
    group: 'community',
    name: 'T3 Length',
    shortName: 'T3+SAR',
    category: 'Moving Averages',
    overlay: true,
    metadata: t3PsarIndicator.metadata,
    inputConfig: t3PsarIndicator.inputConfig as InputConfig[],
    plotConfig: t3PsarIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...t3PsarIndicator.defaultInputs },
    calculate: t3PsarIndicator.calculate,
  },
  {
    id: 'zlma-trend-levels',
    group: 'community',
    name: 'Length',
    shortName: 'ZLMA-TL',
    category: 'Moving Averages',
    overlay: true,
    metadata: zlmaTrendLevelsIndicator.metadata,
    inputConfig: zlmaTrendLevelsIndicator.inputConfig as InputConfig[],
    plotConfig: zlmaTrendLevelsIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...zlmaTrendLevelsIndicator.defaultInputs },
    calculate: zlmaTrendLevelsIndicator.calculate,
  },

  // AI/ML community indicators
  {
    id: 'ai-trend-navigator',
    group: 'community',
    name: 'AI Trend Navigator [K-Neighbor]',
    shortName: 'AiTrendNavigator',
    category: 'Trend',
    overlay: true,
    metadata: aiTrendNavigatorIndicator.metadata,
    inputConfig: aiTrendNavigatorIndicator.inputConfig as InputConfig[],
    plotConfig: aiTrendNavigatorIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...aiTrendNavigatorIndicator.defaultInputs },
    calculate: aiTrendNavigatorIndicator.calculate,
  },
  {
    id: 'ml-adaptive-supertrend',
    group: 'community',
    name: 'ML Adaptive SuperTrend',
    shortName: 'MlAdaptiveSupertrend',
    category: 'Trend',
    overlay: true,
    metadata: mlAdaptiveSupertrendIndicator.metadata,
    inputConfig: mlAdaptiveSupertrendIndicator.inputConfig as InputConfig[],
    plotConfig: mlAdaptiveSupertrendIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mlAdaptiveSupertrendIndicator.defaultInputs },
    calculate: mlAdaptiveSupertrendIndicator.calculate,
  },
  {
    id: 'ml-knn-strategy',
    group: 'community',
    name: 'ML: kNN Strategy',
    shortName: 'MlKnnStrategy',
    category: 'Momentum',
    overlay: false,
    metadata: mlKnnStrategyIndicator.metadata,
    inputConfig: mlKnnStrategyIndicator.inputConfig as InputConfig[],
    plotConfig: mlKnnStrategyIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mlKnnStrategyIndicator.defaultInputs },
    calculate: mlKnnStrategyIndicator.calculate,
  },
  {
    id: 'ml-momentum-index',
    group: 'community',
    name: 'ML Momentum Index',
    shortName: 'MlMomentumIndex',
    category: 'Momentum',
    overlay: false,
    metadata: mlMomentumIndexIndicator.metadata,
    inputConfig: mlMomentumIndexIndicator.inputConfig as InputConfig[],
    plotConfig: mlMomentumIndexIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mlMomentumIndexIndicator.defaultInputs },
    calculate: mlMomentumIndexIndicator.calculate,
  },
  {
    id: 'ml-moving-average',
    group: 'community',
    name: 'ML Moving Average',
    shortName: 'MlMovingAverage',
    category: 'Moving Averages',
    overlay: true,
    metadata: mlMovingAverageIndicator.metadata,
    inputConfig: mlMovingAverageIndicator.inputConfig as InputConfig[],
    plotConfig: mlMovingAverageIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mlMovingAverageIndicator.defaultInputs },
    calculate: mlMovingAverageIndicator.calculate,
  },
  {
    id: 'ml-rsi',
    group: 'community',
    name: 'ML RSI',
    shortName: 'MlRsi',
    category: 'Momentum',
    overlay: false,
    metadata: mlRsiIndicator.metadata,
    inputConfig: mlRsiIndicator.inputConfig as InputConfig[],
    plotConfig: mlRsiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...mlRsiIndicator.defaultInputs },
    calculate: mlRsiIndicator.calculate,
  },
  {
    id: 'supertrend-ai-clustering',
    group: 'community',
    name: 'SuperTrend AI Clustering',
    shortName: 'SupertrendAiClustering',
    category: 'Trend',
    overlay: true,
    metadata: supertrendAiClusteringIndicator.metadata,
    inputConfig: supertrendAiClusteringIndicator.inputConfig as InputConfig[],
    plotConfig: supertrendAiClusteringIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...supertrendAiClusteringIndicator.defaultInputs },
    calculate: supertrendAiClusteringIndicator.calculate,
  },
  {
    id: 'volume-supertrend-ai',
    group: 'community',
    name: 'Volume SuperTrend AI',
    shortName: 'VolumeSuperTrendAi',
    category: 'Trend',
    overlay: true,
    metadata: volumeSupertrendAiIndicator.metadata,
    inputConfig: volumeSupertrendAiIndicator.inputConfig as InputConfig[],
    plotConfig: volumeSupertrendAiIndicator.plotConfig as PlotConfig[],
    defaultInputs: { ...volumeSupertrendAiIndicator.defaultInputs },
    calculate: volumeSupertrendAiIndicator.calculate,
  },
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
