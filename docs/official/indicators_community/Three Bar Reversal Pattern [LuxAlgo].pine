// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("Three Bar Reversal Pattern [LuxAlgo]", 'LuxAlgo - Three Bar Reversal Pattern', true, max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500)

//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{

display  = display.all - display.status_line
brpType = input.string("All", "Pattern Type", options = ["Normal", "Enhanced", "All"], display = display)
brpSR  = input.string("Level", "Derived Support and Resistance", options = ["Level", "Zone", "None"], display = display)
brpAC  = input.color(#2962ff, 'Bullish Reversal Patterns')
brpSC  = input.color(#ff9800, 'Bearish Reversal Patterns')

trendIndiGroup = 'Trend Filtering'
trendType = input.string("None", "Filtering", options = ["Moving Average Cloud", "Supertrend", "Donchian Channels", "None"], group = trendIndiGroup, inline = 'flt', display = display)
trendFilt = input.string("Aligned", "", options = ["Aligned", "Opposite"], group = trendIndiGroup, inline = 'flt', display = display) // options = ["Aligned", "Opposite", "No detection"]
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
    (close[2] < open[2]) and
     (low[1] < low[2]) and (high[1] < high[2]) and (close[1] < open[1]) and
     (close > open) and (high > high[2]) //(close > high[1]) 

isBearishReversal() =>
    (close[2] > open[2]) and
     (high[1] > high[2]) and (low[1] > low[2]) and (close[1] > open[1]) and
     (close < open) and (low < low[2]) //(close < low[1]) 

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

bullishReversal = isBullishReversal() and C_UpTrend
bearishReversal = isBearishReversal() and C_DownTrend

var line lnAT = na
var line lnAB = na
var line lnAT2 = na
var line lnAB2 = na
var label lbAT = na
var box bxA = na
var bool bullProcess = false
var bool bullProcess2 = false
var float bullHigh = na

if bullishReversal and (brpType == 'All' ? true : brpType == 'Enhanced' ? close > high[2] ? true : false : brpType == 'Normal' ? close < high[2] ? true : false : false)
    bullProcess := true

    lbAT := label.new(bar_index, low, '▲', color = color(na), textcolor = color.new(brpAC, 07), style = label.style_label_up, size = size.small, tooltip = 'new bullish pattern detected' + (close > high[2] ? ' (enchanced)' : ' (normal)'))

    lnAT := line.new(bar_index[2], high[2], bar_index, high[2], color = color.new(brpAC, 53))
    lnAB := line.new(bar_index[1], math.min(low[1], low), bar_index[0], math.min(low[1], low), color = color.new(brpAC, 53))
    linefill.new(lnAT, lnAB, color.new(brpAC, 73))

    lnAT2 := line.new(bar_index[2], high[2], bar_index, high[2], color = color.new(brpAC, 53))
    lnAB2 := line.new(bar_index[1], math.min(low[1], low), bar_index[0], math.min(low[1], low), color = color.new(brpAC, 53))

    bullHigh := brpSR == 'Zone' ? math.max(low[1], low) : math.min(low[1], low)

if bullProcess 
    if close[1] > lnAT.get_price(bar_index)
        if bullProcess[1] and bullProcess[1] != bullProcess[2]
            lbAT.set_tooltip('enchanced pattern (confirmed at detection)\nprice activity above the pattern high')
        else
            lbAT.set_tooltip('pattern confirmed ' + str.tostring(bar_index[1] - lbAT.get_x()) + ' bars later')
            label.new(bar_index[1], low[1], '⦁', color = color(na), textcolor = color.new(brpAC, 07), style = label.style_label_up, size = size.small, tooltip = 'confirmation bar\nprice activity above the pattern high')
        
        bullProcess := false

        bxA := box.new(bar_index, bullHigh, bar_index, lnAB.get_price(bar_index), color.new(brpAC, brpSR == 'Zone' ? 73 : 53), bgcolor = color.new(brpAC, 73))
        bullProcess2 := true

    if close[1] < lnAB.get_price(bar_index) or bearishReversal
        lbAT.set_tooltip('pattern failed\nthe low of the pattern breached')
        bullProcess := false

    if not bullProcess 
        lnAT2.set_x2(bar_index[1])
        lnAB2.set_x2(bar_index[1])
    else
        lnAT2.set_x2(bar_index)
        lnAB2.set_x2(bar_index)

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

if bearishReversal and (brpType == 'All' ? true : brpType == 'Enhanced' ? close < low[2] ? true : false : brpType == 'Normal' ? close > low[2] ? true : false : false)
    bearProcess := true

    lbST := label.new(bar_index, high, '▼', color = color(na), textcolor = color.new(brpSC, 07), style = label.style_label_down, size = size.small, tooltip = 'new bearish pattern detected' + (close < low[2] ? ' (enchanced)' : ' (normal)'))

    lnSB := line.new(bar_index[2], low[2], bar_index, low[2], color = color.new(brpSC, 53))
    lnST := line.new(bar_index[1], math.max(high[1], high), bar_index[0], math.max(high[1], high), color = color.new(brpSC, 53))
    linefill.new(lnST, lnSB, color.new(brpSC, 73))

    lnSB2 := line.new(bar_index[2], low[2], bar_index, low[2], color = color.new(brpSC, 53))
    lnST2 := line.new(bar_index[1], math.max(high[1], high), bar_index[0], math.max(high[1], high), color = color.new(brpSC, 53))

    bearLow := brpSR == 'Zone' ? math.min(high[1], high) : math.max(high[1], high)

if bearProcess 
    if close[1] > lnST.get_price(bar_index) or bullishReversal
        lbST.set_tooltip('pattern failed\nthe high of the pattern breached')
        bearProcess := false

    if close[1] < lnSB.get_price(bar_index) 
        if bearProcess[1] and bearProcess[1] != bearProcess[2]
            lbST.set_tooltip('enchanced pattern (confirmed at detection)\nprice activity below the pattern low')
        else
            lbST.set_tooltip('pattern confirmed ' + str.tostring(bar_index[1] - lbST.get_x()) + ' bars later')
            label.new(bar_index[1], high[1], '⦁', color = color(na), textcolor = color.new(brpSC, 07), style = label.style_label_down, size = size.small, tooltip = 'confirmation bar\nprice activity blow the pattern low')

        bearProcess := false

        bxS := box.new(bar_index, lnST.get_price(bar_index), bar_index, bearLow, color.new(brpSC, brpSR == 'Zone' ? 73 : 53), bgcolor = color.new(brpSC, 73))
        bearProcess2 := true

    if not bearProcess 
        lnST2.set_x2(bar_index[1])
        lnSB2.set_x2(bar_index[1])
    else
        lnST2.set_x2(bar_index)
        lnSB2.set_x2(bar_index)

if bearProcess2 and brpSR != 'None'
    if close < bxS.get_top()
        bxS.set_right(bar_index)
    else
        bxS.set_right(bar_index)
        bearProcess2 := false

//---------------------------------------------------------------------------------------------------------------------}