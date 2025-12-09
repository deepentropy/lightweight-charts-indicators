// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('Range Average Retest Model [LuxAlgo]', 'LuxAlgo - Range Average Retest Model', overlay=true, max_bars_back = 5000, max_boxes_count = 500, max_lines_count = 500)

//---------------------------------------------------------------------------------------------------------------------}
//CONSTANTS & STRINGS & INPUTS
//---------------------------------------------------------------------------------------------------------------------{
BULLISH_LEG                     = 1
BEARISH_LEG                     = 0
ARRAY_MAX_SIZE                  = 165

BULLISH_AREA                    = 'BULLISH'
BEARISH_AREA                    = 'BEARISH'
BOTH_AREA                       = 'BOTH'

GREEN                           = #089981
RED                             = #F23645

SWINGS_GROUP                    = 'SWINGS'
TRADES_GROUP                    = 'TRADES'
STYLE_GROUP                     = 'STYLE'

pivotLengthTooltip              = 'How many bars are used to confirm a turn. The larger this parameter is, the larger and fewer swing areas will be detected.'
areaSelectionModeTooltip        = 'Swing area detection mode, detect only bullish swings, only bearish swings or both.'
areaThresholdMultiplierTooltip  = 'Swing area comparator. This threshold is multiplied by a measure of volatility (average true range over the last 200 bars), for a new swing area to be detected it must have an average level that is sufficiently distant from the average level of any untouched swing area, this parameter controls that distance.'
maximumDistanceFromAreaTooltip  = 'Maximum distance allowed between a swing area and a trade'
minimumDistanceFromAreaTooltip  = 'Minimum distance allowed between a swing area and a trade'
takeProfitMultiplierTooltip     = 'The size of the take profit - this threshold is multiplied by a measure of volatility (the average true range over the last 200 bars).'
stopLossMultiplierTooltip       = 'The size of the stop-loss: this threshold is multiplied by a measure of volatility (the average true range over the last 200 bars).'
showAreasTooltip                = 'Activate/deactivate areas, select colours for bullish and bearish areas.'
overlappingTradesTooltip        = 'Activate/deactivate overlapping trades.'


pivotLengthInput                = input.int(    20,                 'Pivot Length',     group = SWINGS_GROUP,   tooltip = pivotLengthTooltip,               minval = 1)	
areaSelectionModeInput          = input.string( BOTH_AREA,          'Selection Mode',   group = SWINGS_GROUP,   tooltip = areaSelectionModeTooltip,         options = [BULLISH_AREA, BEARISH_AREA, BOTH_AREA])
areaThresholdMultiplierInput    = input.float(  4.0,                'Threshold',        group = SWINGS_GROUP,   tooltip = areaThresholdMultiplierTooltip,   step=0.25)

maximumDistanceFromAreaInput    = input.int(    200,                'Maximum distance', group = TRADES_GROUP,   tooltip = maximumDistanceFromAreaTooltip)
minimumDistanceFromAreaInput    = input.int(    10,                 'Minimum distance', group = TRADES_GROUP,   tooltip = minimumDistanceFromAreaTooltip)
takeProfitMultiplierInput       = input.float(  8.0,                'Take profit',      group = TRADES_GROUP,   tooltip = takeProfitMultiplierTooltip)
stopLossMultiplierInput         = input.float(  4.0,                'Stop loss',        group = TRADES_GROUP,   tooltip = stopLossMultiplierTooltip)

showAreasInput                  = input.bool(   true,               'Show Ranges',     group = STYLE_GROUP,    tooltip = showAreasTooltip,                 inline = '1')
bullAreaColorInput              = input.color(  GREEN,'',                              group = STYLE_GROUP,    tooltip = '',                               inline = '1')
bearAreaColorInput              = input.color(  RED,  '',                              group = STYLE_GROUP,    tooltip = '',                               inline = '1')

showAverageInput                = input.bool(   true,               'Show Average',    group = STYLE_GROUP,    tooltip = showAreasTooltip,                 inline = '2')
bullAvgColorInput               = input.color(  GREEN,'',                              group = STYLE_GROUP,    tooltip = '',                               inline = '2')
bearAvgColorInput               = input.color(  RED,  '',                              group = STYLE_GROUP,    tooltip = '',                               inline = '2')

showTPAreasInput                = input.bool(   true,               'Show TP Areas',   group = STYLE_GROUP,    tooltip = showAreasTooltip,                 inline = '3')
takeProfitColorInput            = input.color(  color.new(GREEN,75),'',                group = STYLE_GROUP,    tooltip = '',                               inline = '3')

showSLAreasInput                = input.bool(   true,               'Show SL Areas',   group = STYLE_GROUP,    tooltip = showAreasTooltip,                 inline = '4')
stopLossColorInput              = input.color(  color.new(RED,75),  '',                group = STYLE_GROUP,    tooltip = '',                               inline = '4')

overlappingTradesInput          = input.bool(   false,              'Overlap trades',   group = STYLE_GROUP,    tooltip = overlappingTradesTooltip)

//---------------------------------------------------------------------------------------------------------------------}
//DATA STRUCTURES & VARIABLES
//---------------------------------------------------------------------------------------------------------------------{
// @type                Storage UDT for swing areas
// @field startTime     Time of the first barBar
// @field endTime       Time of the last barBar
// @field endIndex      Bar index of the last bar
// @field areaHigh      Highest price
// @field areaLow       Lowest price
// @field averagePrice  Average price as 0.5*(areaHigh+areaLow)
// @field areaColor     Default colour for drawing lines
// @field touched       True for swing areas with associated trades, false otherwise
type area        
    int     startTime
    int     endTime
    int     endIndex
    float   areaHigh
    float   areaLow
    float   averagePrice
    color   areaColor
    bool    touched = false

// @type                Storage UDT for trades
// @field entry         Price level for trade entry
// @field top           Highest price leve of the trade, can be TP or SL
// @field bottom        Lowest price level of the trade, can be TP or SL
// @field topColor      Top colour can be RED for SL or GREEN for TP
// @field bottomColor   Bottom colour can be RED for SL or GREEN for TP
// @field startTime     Time on the first bar of the trade
// @field endTime       Time on the last bar of the trade
// @field startLineTime Time on the first bar of the line connecting area and trade
// @field tradeColor    Default colour of the trade, RED for shorts, GREEN for longs
// @field openTrade     True for open trades, false for trades that hit TP or SL levels
type trade
    float   entry
    float   top
    float   bottom
    color   topColor
    color   bottomColor
    int     startTime
    int     endTime
    int     startLineTime
    color   tradeColor
    bool    openTrade = true
    int     dir

// @variable            storage array for swing areas
var array<area> areas   = array.new<area>()
// @variable            storage array for trades
var array<trade> trades = array.new<trade>()

// @variable            fast volatility measure of 20 periods
fastVolatilityMeasure   = ta.atr(20)
// @variable            default volatility measure of 200 periods
volatilityMeasure       = ta.atr(200)
// @variable            threshold to compare areas by volatility
areaThreshold           = areaThresholdMultiplierInput  * (bar_index < 200 ? fastVolatilityMeasure : volatilityMeasure)
// @variable            take profit in points by volatility
takeProfit              = takeProfitMultiplierInput     * (bar_index < 200 ? fastVolatilityMeasure : volatilityMeasure)
// @variable            stop loss in points by volatility
stopLoss                = stopLossMultiplierInput       * (bar_index < 200 ? fastVolatilityMeasure : volatilityMeasure)
// @variable            bar index `pivotLengthInput` bars ago
legIndex                = bar_index[pivotLengthInput]
// @variable            high  `pivotLengthInput` bars ago
legHigh                 = high[pivotLengthInput]
// @variable            low  `pivotLengthInput` bars ago
legLow                  = low[pivotLengthInput]
// @variable            time  `pivotLengthInput` bars ago
legTime                 = time[pivotLengthInput]

//---------------------------------------------------------------------------------------------------------------------}
//USER-DEFINED FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------{
// @function            Get the value of the current leg, it can be 0 (bearish) or 1 (bullish)
// @returns             int
leg() =>
    var leg     = 0
    newLegHigh  = legHigh > ta.highest(pivotLengthInput)
    newLegLow   = legLow  < ta.lowest( pivotLengthInput)
    
    if newLegHigh
        leg := BEARISH_LEG
    else if newLegLow
        leg := BULLISH_LEG

    leg

// @function            Identify whether the current value is the start of a new leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfNewLeg(int leg)      => ta.change(leg) != 0

// @function            Identify whether the current level is the start of a new bearish leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfBearishLeg(int leg)  => ta.change(leg) == -1

// @function            Identify whether the current level is the start of a new bullish leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfBullishLeg(int leg)  => ta.change(leg) == +1

// @function            Update highest and/or lowest area values
// @param a_rea         (area) area to update  
// @param areaHigh      (float) new area high, it is used if is not `na`
// @param areaLow       (float) new area low, it is used if is not `na`
// @returns             float
updateAreaValues(area a_rea,float areaHigh, float areaLow) =>
    if not na(areaHigh)
        a_rea.areaHigh  := areaHigh
    if not na(areaLow)           
        a_rea.areaLow   := areaLow

// @function            Create a new area and add it to the storage
// @param areaHigh      (float) area high
// @param areaLow       (float) area low
// @param areaColor     (color) Default area colour
// @returns             void
createNewArea(float areaHigh = na, float areaLow = na, color areaColor) =>
    area a_rea      = area.new()
    updateAreaValues(a_rea, areaHigh, areaLow)
    a_rea.startTime := legTime
    a_rea.areaColor := areaColor

    if array.size(areas) >= ARRAY_MAX_SIZE
        array.shift(areas)
    array.push(areas,a_rea)
   
// @function            Check that an average price is valid comparing it with all the average prices of untouched areas within the parameters defined by the user
// @param averagePrice  (float) average price to check      
// @returns             bool
validAveragePrice(float averagePrice) =>
    validAvegare    = true
    size            = array.size(areas)
    for [index,eachArea] in areas
        if index < size - 1 and not eachArea.touched and bar_index - eachArea.endIndex <= maximumDistanceFromAreaInput
            if math.abs(eachArea.averagePrice - averagePrice) <= areaThreshold
                validAvegare := false
                break
    validAvegare     

// @function            Update the last area with its final values and if it is not a valid one, delete it from storage
// @param areaHigh      (float) area high
// @param areaLow       (float) area low
// @returns             area ID
updateLastArea(float areaHigh = na, float areaLow = na) =>
    if array.size(areas) > 0
        area a_rea  = array.last(areas)
        updateAreaValues(a_rea, areaHigh, areaLow)
        a_rea.endIndex      := legIndex        
        a_rea.endTime       := legTime
        a_rea.averagePrice  := math.round_to_mintick(0.5*(a_rea.areaHigh+a_rea.areaLow))
        if not validAveragePrice(a_rea.averagePrice)
            array.pop(areas)      
     
// @function            Check if close is crossing over the provided price level
// @param level         Price level to be checked against the close
// @returns             bool
crossOver(float level) => close[1] < level and close > level

// @function            Check if close is crossing under the provided price level
// @param level         Price level to be checked against the close
// @returns             bool
crossUnder(float level) => close[1] > level and close < level

// @function            Check if current bar has reached the average price of a given area within the specified parameters
// @param a_rea         (area) Swing area to get values from
// @returns             bool
reach(area a_rea) =>
    openTrade = array.size(trades) > 0 ? array.last(trades).openTrade : false
    checkForTradesDisabled = not overlappingTradesInput and openTrade
    distanceFromArea = bar_index - a_rea.endIndex
    if distanceFromArea <= maximumDistanceFromAreaInput and distanceFromArea >= minimumDistanceFromAreaInput and bar_index > 20 and not checkForTradesDisabled
        crossOver(a_rea.averagePrice) or crossUnder(a_rea.averagePrice)

// @function            Create a new short trade and add it to the storage
// @param a_rea         (area) Swing area to get values from
// @returns             void
addShortTrade(area a_rea) =>
    currentTakeProfit   = a_rea.averagePrice - takeProfit
    currentStopLoss     = a_rea.averagePrice + stopLoss
    
    trade t_rade = trade.new(a_rea.averagePrice, currentStopLoss, math.max(currentTakeProfit,0), stopLossColorInput, takeProfitColorInput, time, time, a_rea.startTime, tradeColor = bearAvgColorInput, dir = -1)

    if array.size(trades) >= ARRAY_MAX_SIZE
        array.shift(trades)
    array.push(trades,t_rade)
    
// @function            Create a new long trade and add it to the storage
// @param a_rea         (area) Swing area to get values from
// @returns             void
addLongTrade(area a_rea) => 
    currentTakeProfit   = a_rea.averagePrice + takeProfit
    currentStopLoss     = a_rea.averagePrice - stopLoss

    trade t_rade = trade.new(a_rea.averagePrice, currentTakeProfit, math.max(currentStopLoss,0), takeProfitColorInput, stopLossColorInput, time, time, a_rea.startTime, tradeColor = bullAvgColorInput, dir = 1)

    if array.size(trades) >= ARRAY_MAX_SIZE
        array.shift(trades)
    array.push(trades,t_rade)

// @function            Update a trade with its definitive values
// @param t_rade        (trade) Trade to update
// @returns             bool
updateTrade(trade t_rade) =>    
    t_rade.endTime      := time
    t_rade.openTrade    := false

// @function            Draw area with two lines
// @param a_rea         (area) Area to draw
// @returns             line ID
drawArea(area a_rea) =>
    line.new(a_rea.startTime,   a_rea.areaHigh,   a_rea.endTime,    a_rea.areaHigh,  xloc.bar_time, color=a_rea.areaColor)
    line.new(a_rea.startTime,   a_rea.areaLow,    a_rea.endTime,    a_rea.areaLow,   xloc.bar_time, color=a_rea.areaColor)
    
// @function            Draw trade with two boxes and one line
// @param t_rade        (trade) Trade to draw
// @returns             line ID
drawTrade(trade t_rade) =>
    if (t_rade.dir == 1 and showTPAreasInput) or (t_rade.dir == -1 and showSLAreasInput)  
        box.new(t_rade.startTime, t_rade.top,  t_rade.openTrade ? time : t_rade.endTime, t_rade.entry, xloc = xloc.bar_time, bgcolor = t_rade.topColor,   border_color = color(na))
    
    if (t_rade.dir == 1 and showSLAreasInput) or (t_rade.dir == -1 and showTPAreasInput)  
        box.new(t_rade.startTime, t_rade.entry,t_rade.openTrade ? time : t_rade.endTime, t_rade.bottom, xloc = xloc.bar_time, bgcolor = t_rade.bottomColor,border_color = color(na))
    
    if showAverageInput
        line.new(t_rade.startLineTime, t_rade.entry, t_rade.openTrade ? time : t_rade.endTime, t_rade.entry, xloc = xloc.bar_time, color = t_rade.tradeColor, style = line.style_dashed)

//---------------------------------------------------------------------------------------------------------------------}
//MUTABLE VARIABLES & EXECUTION
//---------------------------------------------------------------------------------------------------------------------{
// @variable            Get current leg value, this is the leg value on the current bar
currentLeg = leg()

// we execute the logic only once per bar close
if barstate.isconfirmed

    // we get a new swing area
    if startOfNewLeg(currentLeg)

        // we identify the new area as a bearish one so we create and/or update areas upon user selection mode
        if startOfBearishLeg(currentLeg)
            switch areaSelectionModeInput
                BULLISH_AREA => updateLastArea(legHigh)
                BEARISH_AREA => createNewArea(legHigh, areaColor = bearAreaColorInput)
                BOTH_AREA => 
                    updateLastArea(legHigh)
                    createNewArea(legHigh,areaColor = bearAreaColorInput)

        // we identify the new area as a bullish one so we create and/or update areas upon user selection mode
        if startOfBullishLeg(currentLeg)
            switch areaSelectionModeInput
                BULLISH_AREA => createNewArea(areaLow = legLow, areaColor = bullAreaColorInput)
                BEARISH_AREA => updateLastArea(areaLow = legLow)
                BOTH_AREA => 
                    updateLastArea(areaLow = legLow)
                    createNewArea(areaLow = legLow,areaColor = bullAreaColorInput) 

    // we check for new trades on all untouched areas average prices
    for eachArea in areas
        if not eachArea.touched and reach(eachArea)
            eachArea.touched := true
            if crossOver(eachArea.averagePrice)
                addShortTrade(eachArea)
            if crossUnder(eachArea.averagePrice)
                addLongTrade(eachArea)
    
    // we check for stop loss and take profit hits on all open trades
    for eachTrade in trades
        if eachTrade.openTrade
            if high > eachTrade.top or low < eachTrade.bottom
                updateTrade(eachTrade)

// we plot all the drawings (boxes and lines) only once at the end of historical data, and then once per bar on bar close
if barstate.islastconfirmedhistory or (barstate.isrealtime and barstate.isconfirmed)
    if showAreasInput
        // we draw all touched areas
        for eachArea in areas
            if eachArea.touched
                drawArea(eachArea)

    // we draw all trades
    if showTPAreasInput or showSLAreasInput
        for eachTrade in trades
            drawTrade(eachTrade)

//---------------------------------------------------------------------------------------------------------------------}