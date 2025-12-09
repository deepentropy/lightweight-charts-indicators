// This Pine Script™ code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © ChartPrime

//@version=6
indicator("Parabolic RSI [ChartPrime]", overlay = false)

// --------------------------------------------------------------------------------------------------------------------}
// 𝙐𝙎𝙀𝙍 𝙄𝙉𝙋𝙐𝙏𝙎
// --------------------------------------------------------------------------------------------------------------------{

len = input.int(14, "RSI Length", group = "RSI")

upper_ = input.int(70, "Threshold: ⭱", inline = "Threshold")
lower_ = input.int(30, " ⤓", inline = "Threshold")

display_sar = input.bool(true, "SAR", group = "SAR")
start       = input.float(0.02, "Start", step = 0.01, inline = "sar", group = "SAR")
inc         = input.float(0.02, "Increment", step = 0.01, inline = "sar", group = "SAR")
max         = input.float(0.2, "Maximum", step = 0.01, inline = "sar", group = "SAR")
color_up    = input.color(#EEA47F, "", inline = "c")
color_dn    = input.color(#00539C, "", inline = "c")


// --------------------------------------------------------------------------------------------------------------------}
// 𝙄𝙉𝘿𝙄𝘾𝘼𝙏𝙊𝙍 𝘾𝘼𝙇𝘾𝙐𝙇𝘼𝙏𝙄𝙊𝙉𝙎
// --------------------------------------------------------------------------------------------------------------------{

rsi = ta.rsi(close, len)

pine_sar(src, start, inc, max) =>

    src_high = src+1
    src_low  = src-1

    var float result = na
    var float maxMin = na
    var float acceleration = na
    var bool isBelow = false
    bool isFirstTrendBar = false
    
    if bar_index <= len+2
        if src > src[1]
            isBelow := true
            maxMin := src_high
            result := src_low[1]
        else
            isBelow := false
            maxMin := src_low
            result := src_high[1]
            
        isFirstTrendBar := true
        acceleration := start
    
    result := result + acceleration * (maxMin - result)
    
    if isBelow
        if result > src_low
            isFirstTrendBar := true
            isBelow := false
            result := math.max(src_high, maxMin)
            maxMin := src_low
            acceleration := start
    else
        if result < src_high
            isFirstTrendBar := true
            isBelow := true
            result := math.min(src_low, maxMin)
            maxMin := src_high
            acceleration := start
            
    if not isFirstTrendBar
        if isBelow
            if src_high > maxMin
                maxMin := src_high
                acceleration := math.min(acceleration + inc, max)
        else
            if src_low < maxMin
                maxMin := src_low
                acceleration := math.min(acceleration + inc, max)
    
    if isBelow
        result := math.min(result, src_low[1])
        if bar_index > 1
            result := math.min(result, src_low[2])
        
    else
        result := math.max(result, src_high[1])
        if bar_index > 1
            result := math.max(result, src_high[2])
    
    [result, isBelow]

[sar_rsi, isBelow] = pine_sar(rsi, start, inc, max)


sig_up = isBelow != isBelow[1] and isBelow and barstate.isconfirmed
sig_dn = isBelow != isBelow[1] and not isBelow and barstate.isconfirmed

s_sig_up = isBelow != isBelow[1] and isBelow and barstate.isconfirmed and sar_rsi <= lower_
s_sig_dn = isBelow != isBelow[1] and not isBelow and barstate.isconfirmed and sar_rsi >= upper_

var sar = float(na)

if display_sar
    sar := isBelow != isBelow[1] ? na : sar_rsi

sar_col = isBelow ? color_up : color_dn

// --------------------------------------------------------------------------------------------------------------------}
// 𝙑𝙄𝙎𝙐𝘼𝙇𝙄𝙕𝘼𝙏𝙄𝙊𝙉
// --------------------------------------------------------------------------------------------------------------------{

rsiPlot = plot(rsi, "RSI", color=chart.fg_color)
rsiUpperBand = hline(upper_, "RSI Upper Band", color=#787B86)
midline = hline(50, "RSI Middle Band", color=color.new(#787B86, 50))
rsiLowerBand = hline(lower_, "RSI Lower Band", color=#787B86)
fill(rsiUpperBand, rsiLowerBand, color=#c292571a, title="RSI Background Fill")
midLinePlot = plot(50, color = na, editable = false, display = display.none)
fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.red, 0), bottom_color = color.new(color.orange, 100),  title = "Overbought Gradient Fill")
fill(rsiPlot, midLinePlot, 30,  0,  top_color = color.new(color.red, 100), bottom_color = color.new(color.orange, 0),      title = "Oversold Gradient Fill")


sar_p = plot(sar, "SAR", color = sar_col, style = plot.style_circles)

plotshape(sig_up and sar_rsi >= lower_ ? sar_rsi : na, "Rsi Up", shape.diamond, location.absolute, size = size.tiny, color = sar_col)
plotshape(sig_dn and sar_rsi <= upper_  ? sar_rsi : na, "Rsi Dn", shape.diamond, location.absolute, size = size.tiny, color = sar_col)

plotchar(s_sig_up ? sar_rsi : na, "Rsi Up", "◈", location.absolute, size = size.tiny, color = sar_col)
plotchar(s_sig_dn ? sar_rsi : na, "Rsi Dn", "◈", location.absolute, size = size.tiny, color = sar_col)


plotshape(s_sig_up, "Chart Strong Rsi Up", shape.diamond, location.belowbar, size = size.small, color = sar_col, force_overlay = true)
plotshape(s_sig_dn, "Chart Strong Rsi Dn", shape.diamond, location.abovebar, size = size.small, color = sar_col, force_overlay = true)

plotshape(sig_up and sar_rsi >= lower_, "Chart Rsi Up", shape.diamond, location.belowbar, size = size.tiny, color = sar_col, force_overlay = true)
plotshape(sig_dn and sar_rsi <= upper_, "Chart Rsi Dn", shape.diamond, location.abovebar, size = size.tiny, color = sar_col, force_overlay = true)
// --------------------------------------------------------------------------------------------------------------------}
