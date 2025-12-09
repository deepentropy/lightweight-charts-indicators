// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("FVG Instantaneous Mitigation Signals [LuxAlgo]", "LuxAlgo - FVG Instantaneous Mitigation Signals", overlay = true, max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
filterWidth = input.float(0., 'FVG Width Filter', minval = 0, step = .1)

//TP/SL
showTp = input(false, 'TP Area', inline = 'tp', group = 'TP/SL')
tpMult = input.float(4., 'Multiplier', minval = 0, inline = 'tp', group = 'TP/SL')
tpCss = input(color.new(#5b9cf6, 80), '', inline = 'tp', group = 'TP/SL')

showSl = input(false, 'SL Area', inline = 'sl', group = 'TP/SL')
slMult = input.float(2., 'Multiplier', minval = 0, inline = 'sl', group = 'TP/SL')
slCss = input(color.new(color.gray, 80), '', inline = 'sl', group = 'TP/SL')

//Trailing Stop
tsReset = input.string('Every Signals', 'Reset Trailing Stop'
  , options = ['Every Signals', 'Inverse Signals']
  , group = 'Trailing Stop')

tsMult = input(3., 'Multiplier'
  , group = 'Trailing Stop')

//Style
showBull = input(true, 'Bullish IMFVG', inline = 'bull', group = 'Style')
bullCss = input(color.teal, '', inline = 'bull', group = 'Style')
bullAvg = input(true, 'Average', inline = 'bull', group = 'Style')

showBear = input(true, 'Bearish IMFVG', inline = 'bear', group = 'Style')
bearCss = input(#f23645, '', inline = 'bear', group = 'Style')
bearAvg = input(true, 'Average', inline = 'bear', group = 'Style')

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{
n = bar_index
atr = nz(ta.atr(200))

tpsl(condition, opposite_condition, level, islong)=>
    var box tp_area = na
    var box sl_area = na
    var reached = false

    if condition
        if islong
            if showTp
                tp_area := box.new(n, level + atr * tpMult, n, level, na, bgcolor = tpCss)
            if showSl
                sl_area := box.new(n, level, n, level - atr * slMult, na, bgcolor = slCss)
        else
            if showTp
                tp_area := box.new(n, level, n, level - atr * tpMult, na, bgcolor = tpCss)
            if showSl
                sl_area := box.new(n, level + atr * slMult, n, level, na, bgcolor = slCss)

        reached := false

    else if opposite_condition
        reached := true

    if not reached
        tp_area.set_right(n)
        sl_area.set_right(n)

        if islong
            if high > tp_area.get_top() or low < sl_area.get_bottom()
                reached := true
        else
            if low < tp_area.get_bottom() or high > sl_area.get_top()
                reached := true
    
    reached

trailing_stop(trigger, trend, mult)=>
    var float ts = na
    var reached = false

    if trigger
        ts := switch trend
            1 => close - atr * mult
            0 => close + atr * mult

        reached := false
    else
        ts := switch trend
            1 => close - ts > atr * mult ? close - atr * mult : ts
            0 => ts - close > atr * mult ? close + atr * mult : ts

        if close < ts and trend == 1
            reached := true 
        else if close > ts and trend == 0
            reached := true 

    [ts, reached]  

filter(a, b)=> a - b > atr * filterWidth

//---------------------------------------------------------------------------------------------------------------------}
//Signals
//---------------------------------------------------------------------------------------------------------------------{
var line bull_line    = na
var bool bull_lvl_reached = na
var line bear_line    = na
var bool bear_lvl_reached = na

var os = 0

//Bullish Signals
bull = low[3] > high[1] and close[2] < low[3] and close > low[3] and filter(low[3], high[1]) and showBull

//Set bullish tpsl zones
if bull
    //Imbalance area
    box.new(n-3, low[3], n, high[1], na, bgcolor = color.new(bullCss, 50))
    avg = math.avg(low[3], high[1])

    //Imbalance area average
    if bullAvg
        bull_line := line.new(n, avg, n, avg, color = bullCss, style = line.style_dashed)

    //Label
    label.new(n, low, '▲', color = color(na), textcolor = bullCss, style = label.style_label_up, size = size.small)

    os := 1
    bull_lvl_reached := false

//Bearish Signals
bear = low[1] > high[3] and close[2] > high[3] and close < high[3] and filter(low[1], high[3]) and showBear

//Set bearish tpsl zones
if bear
    //Imbalance area
    box.new(n-3, low[1], n, high[3], na, bgcolor = color.new(bearCss, 50))
    avg = math.avg(low[1], high[3])
    
    //Imbalance area average
    if bearAvg
        bear_line := line.new(n, avg, n, avg, color = bearCss, style = line.style_dashed)

    //Label
    label.new(n, high, '▼', color = color(na), textcolor = bearCss, style = label.style_label_down, size = size.small)

    os := 0
    bear_lvl_reached := false

//Extend average imabalance areas
if not bull_lvl_reached
    bull_line.set_x2(n)
if not bear_lvl_reached
    bear_line.set_x2(n)

//Test if reached
if close < bull_line.get_y2()
    bull_lvl_reached := true

if close > bear_line.get_y2()
    bear_lvl_reached := true

bull_reached = tpsl(bull, bear, math.avg(low[3], high[1]), true)
bear_reached = tpsl(bear, bull, math.avg(low[1], high[3]), false)

//Trailing Stop
ts_reset = tsReset == 'Every Signals' ? bull or bear : os != os[1]
[ts, ts_reached] = trailing_stop(ts_reset, os, tsMult)

//---------------------------------------------------------------------------------------------------------------------}
//Plots
//---------------------------------------------------------------------------------------------------------------------{
barcolor(ts_reached ? na : os == 1 and not bull_reached ? bullCss : os == 0 and not bear_reached ? bearCss : na)

plot(ts, 'Trailing Stop', ts_reached or bull or bear ? na : os ? bullCss : bearCss)

//---------------------------------------------------------------------------------------------------------------------}