// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("N Bar Reversal Detector [LuxAlgo]", 'LuxAlgo - N Bar Reversal Detector', true, max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500)

//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{

display  = display.all - display.status_line

brpGroup = 'Pattern Detection'
brpTypeTT = 'Selects the type of reversal pattern to detect:\n\n' +
             ' *Normal: Detects standard reversal patterns based on the high and low prices of the sequence.\n\n' +
             ' *Enhanced: Detects advanced reversal patterns where the most recent closing price must exceed or fall below the high or low of the first candle.\n\n' +
             ' *All: Includes both normal and enhanced patterns.'
brpType = input.string("All", "Pattern Type", options = ["Normal", "Enhanced", "All"], group = brpGroup, display = display, tooltip = brpTypeTT)
numBarsTT = 'Specifies the number of candles in the sequence used to identify a reversal pattern. The length N includes the initial N-1 candles plus the most recent candle (Nth) for pattern detection.'
numBars = input.int(7, 'Reversal Pattern Sequence Length', minval = 2, group = brpGroup, display = display, tooltip = numBarsTT)
minBrasTT = 'Sets the minimum percentage of the first N-1 candles that must be bullish (for a bearish reversal) or bearish (for a bullish reversal) to qualify as a valid reversal pattern. This setting helps adjust the sensitivity of the pattern detection.'
minBars = input.int(50, 'Min Percentage of Required Candles', minval = 0, maxval = 100, group = brpGroup, display = display, tooltip = minBrasTT) / 100

brpSRTT = 'Shows horizontal support and resistance lines based on the highest high or lowest low of the pattern'
brpSR  = input.string("Level", "Derived Support and Resistance", options = ["Level", "None"], group = brpGroup, display = display, tooltip = brpSRTT)
brpAC  = input.color(#089981, 'Bullish Reversal Patterns', group = brpGroup)
brpSC  = input.color(#f23645, 'Bearish Reversal Patterns', group = brpGroup)

trendIndiGroup = 'Trend Filtering'
trendTT = 'Selects the trend filtering method for detecting reversal patterns and specifies the alignment with the trend.'
trendType = input.string("None", "Filtering", options = ["Moving Average Cloud", "Supertrend", "Donchian Channels", "None"], group = trendIndiGroup, inline = 'flt', display = display, tooltip = trendTT)
trendFilt = input.string("Aligned", "", options = ["Aligned", "Opposite"], group = trendIndiGroup, inline = 'flt', display = display)
trendAC  = input.color(#089981, 'Bullish Trend', inline = 'trnd')
trendSC  = input.color(#f23645, ' Bearish Trend', inline = 'trnd')

ma_Group  = 'Moving Average Settings'
maType    = input.string("HMA", "Type", options = ["SMA", "EMA", "HMA", "RMA", "WMA", "VWMA"], group = ma_Group, display = display)
maFLength  = input.int(50, 'Fast Length', minval = 1, maxval = 100, group = ma_Group, display = display)
maSLength  = input.int(200, 'Slow Length', minval = 100, group = ma_Group, display = display)

st_Group  = 'Supertrend Settings'
atrPeriod = input.int(10, 'ATR Length', minval=1, group = st_Group, display = display)
factor = input.float(3, 'Factor', minval = 2, step = 0.1, group = st_Group, display = display)

dc_Group  = 'Donchian Channel Settings'
length = input.int(13, 'Length', minval = 1, group = dc_Group, display = display)

//---------------------------------------------------------------------------------------------------------------------}
// Functions / Methods
//---------------------------------------------------------------------------------------------------------------------{

movingAverage(source, length, maType) => 
    switch maType
        "SMA"  => ta.sma (source, length)
        "EMA"  => ta.ema (source, length)
        "HMA"  => ta.hma (source, length)
        "RMA"  => ta.rma (source, length)
        "WMA"  => ta.wma (source, length)
        "VWMA" => ta.vwma(source, length)

donchian(len) => math.avg(ta.lowest(len), ta.highest(len))

isBullishReversal() =>
    var bool bullReversal = na
    float bullLow = low[numBars]
    int bearCount = 0

    for i = 1 to numBars - 1
        if high[i] > high[numBars]
            bullReversal := false
            break
        else 
            bullReversal := true
            bullLow := math.min(bullLow, low[i])
            if open[i] > close[i]
                bearCount += 1
    
    if bearCount / (numBars-1) >= minBars
        bullReversal := true
    else
        bullReversal := false

    [math.min(bullLow, low), bullReversal and high > high[numBars]] 

isBearishReversal() =>
    var bool bearReversal = na
    float bearHigh = high[numBars]
    int bullCount = 0

    for i = 1 to numBars - 1
        if low[i] < low[numBars]
            bearReversal := false
            break
        else 
            bearReversal := true
            bearHigh := math.max(bearHigh, high[i])
            if open[i] < close[i]
                bullCount += 1
    
    if bullCount / (numBars-1) >= minBars
        bearReversal := true
    else
        bearReversal := false

    [math.max(bearHigh, high), bearReversal and low < low[numBars]]

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Trend Indicators - Moving Average Cloud
//---------------------------------------------------------------------------------------------------------------------{

maFast = movingAverage(close, maFLength, maType) 
maSlow = movingAverage(close, maSLength, maType) 

maColor = maFast > maSlow ? trendAC : trendSC
ma1 = plot(trendType == 'Moving Average Cloud' ? maFast : na, "ma fast", color.new(maColor, 81), 1, plot.style_linebr, display = display, editable = false)
ma2 = plot(trendType == 'Moving Average Cloud' ? maSlow : na, "ma slow", color.new(maColor, 73), 1, plot.style_linebr, display = display, editable = false)

fill(ma1, ma2, math.max(maFast, maSlow), math.min(maFast, maSlow), color.new(maColor, maFast > maSlow ? 99 : 81), color.new(maColor, maFast > maSlow ? 81 : 99))

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Trend Indicators - Supertrend
//---------------------------------------------------------------------------------------------------------------------{

[supertrend, direction] = ta.supertrend(factor, atrPeriod)

supertrend := barstate.isfirst ? na : supertrend
upTrend     = plot(direction < 0 ? trendType == 'Supertrend' ? supertrend : na : na, "Up Trend", color.new(trendAC, 73), style = plot.style_linebr, display = display, editable = false)
downTrend   = plot(direction < 0 ? na : trendType == 'Supertrend' ? supertrend : na, "Down Trend", color.new(trendSC, 73),   style = plot.style_linebr, display = display, editable = false)
bodyMiddle  = plot(barstate.isfirst ? na : trendType == 'Supertrend' ? (open + close) / 2 : na, "Body Middle", display = display.none, editable = false)

fill(bodyMiddle, upTrend  , supertrend, (open + close) / 2, color.new(trendAC, 81), color.new(chart.bg_color, 100), fillgaps = false)
fill(bodyMiddle, downTrend, (open + close) / 2, supertrend, color.new(chart.bg_color, 100), color.new(trendSC, 81), fillgaps = false)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Trend Indicators - Donchian Channels
//---------------------------------------------------------------------------------------------------------------------{

var os = 0
upper = ta.highest(close, length)
lower = ta.lowest(close, length)
os := upper > upper[1] ? 1 : lower < lower[1] ? 0 : os

dcUpper = plot(trendType == 'Donchian Channels' ? upper : na, color = os == 1 ? color.new(trendAC, 99) : color.new(trendSC, 73), display = display, editable = false)
dcLower = plot(trendType == 'Donchian Channels' ? lower : na, color = os == 1 ? color.new(trendAC, 73) : color.new(trendSC, 99), display = display, editable = false)

fill(dcUpper, dcLower, upper, lower, os == 1 ? color.new(chart.bg_color, 100) : color.new(trendSC, 81) , os == 0 ? color.new(chart.bg_color, 100) : color.new(trendAC, 81))

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - 3-Bar Reversal Pattern
//---------------------------------------------------------------------------------------------------------------------{

C_DownTrend = true
C_UpTrend = true

if trendType == 'Moving Average Cloud'
    if trendFilt == 'Aligned'
	    C_DownTrend := close < maFast and maFast < maSlow
	    C_UpTrend := close > maFast and maFast > maSlow
    else if trendFilt == 'Opposite'
	    C_DownTrend := close > maFast and maFast > maSlow
	    C_UpTrend := close < maFast and maFast < maSlow
    else
        C_DownTrend := true
        C_UpTrend := true

if trendType == 'Supertrend'
    if trendFilt == 'Aligned'
        C_DownTrend := direction > 0 
        C_UpTrend := direction < 0 
    else if trendFilt == 'Opposite'
        C_DownTrend := direction < 0 
        C_UpTrend := direction > 0 
    else
        C_DownTrend := true
        C_UpTrend := true

if trendType == 'Donchian Channels'
    if trendFilt == 'Aligned'
        C_DownTrend := os == 0 
        C_UpTrend := os == 1 
    else if trendFilt == 'Opposite'
        C_DownTrend := os == 1
        C_UpTrend := os == 0 
    else
        C_DownTrend := true
        C_UpTrend := true

[bullLow, isBullish] = isBullishReversal()
bullishReversal = isBullish and C_UpTrend

[bearHigh, isBearish] = isBearishReversal()
bearishReversal = isBearish and C_DownTrend

var line lnAT = na
var line lnAB = na
var line lnAT2 = na
var line lnAB2 = na
var label lbAT = na
var box bxA = na
var bool bullProcess = false
var bool bullProcess2 = false
var float bullHigh = na

if bullishReversal and not bullishReversal[1] and (brpType == 'All' ? true : brpType == 'Enhanced' ? close > high[numBars] ? true : false : brpType == 'Normal' ? close < high[numBars] ? true : false : false)
    bullProcess := true

    lbAT := label.new(bar_index, low, '▲', color = color(na), textcolor = color.new(brpAC, 07), style = label.style_label_up, size = size.small, tooltip = 'new bullish pattern detected' + (close > high[2] ? ' (enchanced)' : ' (normal)'))

    lnAT2 := line.new(bar_index[numBars], high[numBars], bar_index, high[numBars], color = color.new(brpAC, 53))
    lnAB2 := line.new(bar_index[numBars], bullLow, bar_index, bullLow, color = color.new(brpAC, 53))
    linefill.new(lnAT2, lnAB2, color.new(brpAC, 73))

    lnAT := line.new(bar_index[numBars], high[numBars], bar_index, high[numBars], color = color.new(brpAC, 53))
    lnAB := line.new(bar_index[numBars], bullLow, bar_index, bullLow, color = color.new(brpAC, 53))

    bullHigh := brpSR == 'Zone' ? math.max(low[1], low) : bullLow

if bullProcess 
    if close[1] > lnAT.get_price(bar_index)
        if bullProcess[1] and bullProcess[1] != bullProcess[2]
            lbAT.set_tooltip('enchanced pattern (confirmed at detection)\nprice activity above the pattern high')
        else
            lbAT.set_tooltip('pattern confirmed ' + str.tostring(bar_index[1] - lbAT.get_x()) + ' bar(s) later')
            label.new(bar_index[1], low[1], '⦁', color = color(na), textcolor = color.new(brpAC, 07), style = label.style_label_up, size = size.small, tooltip = 'confirmation bar\nprice activity above the pattern high')
        
        bullProcess := false

        bxA := box.new(bar_index, bullHigh, bar_index, lnAB.get_price(bar_index), color.new(brpAC, brpSR == 'Zone' ? 73 : 53), bgcolor = color.new(brpAC, 73))
        bullProcess2 := true

    if close[1] < lnAB.get_price(bar_index) or bearishReversal
        lbAT.set_tooltip('pattern failed\nthe low of the pattern breached')
        bullProcess := false

    if not bullProcess 
        lnAT.set_x2(bar_index[1])
        lnAB.set_x2(bar_index[1])
    else
        lnAT.set_x2(bar_index)
        lnAB.set_x2(bar_index)

if bullProcess2 and brpSR != 'None'
    if close > bxA.get_bottom()
        bxA.set_right(bar_index)
    else
        bxA.set_right(bar_index)
        bullProcess2 := false


var line lnST = na
var line lnSB = na
var line lnST2 = na
var line lnSB2 = na
var label lbST = na
var box bxS = na
var bool bearProcess = false
var bool bearProcess2 = false
var float bearLow = na

if bearishReversal and not bearishReversal[1] and (brpType == 'All' ? true : brpType == 'Enhanced' ? close < low[numBars] ? true : false : brpType == 'Normal' ? close > low[numBars] ? true : false : false)
    bearProcess := true

    lbST := label.new(bar_index, high, '▼', color = color(na), textcolor = color.new(brpSC, 07), style = label.style_label_down, size = size.small, tooltip = 'new bearish pattern detected' + (close < low[2] ? ' (enchanced)' : ' (normal)'))

    lnSB2 := line.new(bar_index[numBars], low[numBars], bar_index, low[numBars], color = color.new(brpSC, 53))
    lnST2 := line.new(bar_index[numBars], bearHigh, bar_index, bearHigh, color = color.new(brpSC, 53))
    linefill.new(lnST2, lnSB2, color.new(brpSC, 89))

    lnSB := line.new(bar_index[numBars], low[numBars], bar_index, low[numBars], color = color.new(brpSC, 53))
    lnST := line.new(bar_index[numBars], bearHigh, bar_index, bearHigh, color = color.new(brpSC, 53))

    bearLow := brpSR == 'Zone' ? math.min(high[1], high) : bearHigh

if bearProcess 
    if close[1] > lnST.get_price(bar_index) or bullishReversal
        lbST.set_tooltip('pattern failed\nthe high of the pattern breached')
        bearProcess := false

    if close[1] < lnSB.get_price(bar_index) 
        if bearProcess[1] and bearProcess[1] != bearProcess[2]
            lbST.set_tooltip('enchanced pattern (confirmed at detection)\nprice activity below the pattern low')
        else
            lbST.set_tooltip('pattern confirmed ' + str.tostring(bar_index[1] - lbST.get_x()) + ' bar(s) later')
            label.new(bar_index[1], high[1], '⦁', color = color(na), textcolor = color.new(brpSC, 07), style = label.style_label_down, size = size.small, tooltip = 'confirmation bar\nprice activity blow the pattern low')

        bearProcess := false

        bxS := box.new(bar_index, lnST.get_price(bar_index), bar_index, bearLow, color.new(brpSC, brpSR == 'Zone' ? 89 : 53), bgcolor = color.new(brpSC, 89))
        bearProcess2 := true

    if not bearProcess 
        lnST.set_x2(bar_index[1])
        lnSB.set_x2(bar_index[1])
    else
        lnST.set_x2(bar_index)
        lnSB.set_x2(bar_index)

if bearProcess2 and brpSR != 'None'
    if close < bxS.get_top()
        bxS.set_right(bar_index)
    else
        bxS.set_right(bar_index)
        bearProcess2 := false

//---------------------------------------------------------------------------------------------------------------------}