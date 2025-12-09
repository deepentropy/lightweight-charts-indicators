// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("Fibonacci Confluence Toolkit [LuxAlgo]", 'LuxAlgo - Fibonacci Confluence Toolkit', true, max_labels_count = 500, max_boxes_count = 500, max_lines_count = 500)
//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{

display  = display.all - display.status_line

ltGroup = 'Market Patterns'
bullCHoCHs = input(true, 'Bullish Structures', inline = 'MS', group = ltGroup)
ltBullMSColor = input.color(#089981, '', group = ltGroup, inline = 'MS'), ltBullMSColor := bullCHoCHs ? ltBullMSColor : chart.bg_color
bearCHoCHs = input(true, 'Bearish Structures', inline = 'MS1', group = ltGroup)
ltBearMSColor = input.color(#f23645, '', group = ltGroup, inline = 'MS1'), ltBearMSColor := bearCHoCHs ? ltBearMSColor : chart.bg_color

areaOfInt = input.string('Enabled', 'Highlight Area of Interest', options = ['Enabled', 'Disabled'], group = ltGroup, display = display)
ltMSLineStyle = input.string('Solid', 'CHoCH Line', options = ['Solid', 'Dashed', 'Dotted'], group = ltGroup, inline = 'LN', display = display)
ltMSLineWidth = input.int(2, 'Width', minval = 1, group = ltGroup, inline = 'LN', display = display)

group_fib = 'Retracement Levels'

show_0 = input.bool(true, '', inline='Level0', group = group_fib)
value_0 = input.float(0, '', inline='Level0', group = group_fib, display = display)

show_0_236 = input.bool(false, '', inline='Level0', group = group_fib)
value_0_236 = input.float(0.236, '', inline='Level0', group = group_fib, display = display)

show_0_382 = input.bool(true, '', inline='Level1', group = group_fib)
value_0_382 = input.float(0.382, '', inline='Level1', group = group_fib, display = display)

show_0_5 = input.bool(true, '', inline='Level1', group = group_fib)
value_0_5 = input.float(0.5, '', inline='Level1', group = group_fib, display = display)

show_0_618 = input.bool(true, '', inline='Level2', group = group_fib)
value_0_618 = input.float(0.618, '', inline='Level2', group = group_fib, display = display)

show_0_65 = input.bool(false, '', inline='Level2', group = group_fib)
value_0_65 = input.float(0.65, '', inline='Level2', group = group_fib, display = display)

show_0_786 = input.bool(true, '', inline='Level3', group = group_fib)
value_0_786 = input.float(0.786, '', inline='Level3', group = group_fib, display = display)

show_1 = input.bool(true, '', inline='Level3', group = group_fib)
value_1 = input.float(1, '', inline='Level3', group = group_fib, display = display)

sweGroup = 'Swing Levels & Engulfing Patterns'
ltSwings = input.string('Disabled', 'Swing Levels', options = ['◉', '△▽', 'H/L', 'Disabled'], inline = 'NA', group = sweGroup, display = display)
ltSwingsSZ  = input.string('Tiny', 'Size', options = ['Tiny', 'Small', 'Normal', 'Large'], inline = 'NA', group = sweGroup, display = display)
engulf = input.string('Structure Based', 'Engulfing Candle Patterns', options = ['All', 'Structure Based', 'Disabled'], inline = 'NA1', group = sweGroup, display = display)
engulfSZ  = input.string('Tiny', '', options = ['Tiny', 'Small', 'Normal', 'Large'], inline = 'NA1', group = sweGroup, display = display)

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{

type BAR
    float   open  = open
    float   high  = high
    float   low   = low
    float   close = close
    int     index = bar_index

type ICTMS
    float   lastPrice
    float   midPrice
    float   prevPrice

    int     lastIndex
    int     midIndex
    int     prevIndex

    label   lastLabel
    label   midLabel
    label   prevLabel

    bool    isCrossed
    bool    isCHoCH
    bool    measure

    int     marketStructure

    float   lwest 
    float   hghst
    line    msLine
    box     msLabel
    box     zone

type MS
    int lastType = 0
    int prevType = 0

type FIB
    line lnRef
    line ln0
    line ln0_236
    line ln0_382
    line ln0_5
    line ln0_618
    line ln0_65
    line ln0_786
    line ln1

    label lb0
    label lb0_236
    label lb0_382
    label lb0_5
    label lb0_618
    label lb0_65
    label lb0_786
    label lb1
//---------------------------------------------------------------------------------------------------------------------}
// Generic Variables
//---------------------------------------------------------------------------------------------------------------------{

BAR bar = BAR.new()

var ICTMS stLow  = ICTMS.new()
var ICTMS stHigh = ICTMS.new()

var ICTMS itLow  = ICTMS.new()
var ICTMS itHigh = ICTMS.new()

var ICTMS ltLow  = ICTMS.new()
var ICTMS ltHigh = ICTMS.new()
var MS ltMS = MS.new()

var FIB bullFibs = FIB.new()
var FIB bearFibs = FIB.new()

//---------------------------------------------------------------------------------------------------------------------}
// Functions / Methods
//---------------------------------------------------------------------------------------------------------------------{

textSize(sizeInText) =>
    switch sizeInText
        'Tiny'   => size.tiny
        'Small'  => size.small
        'Normal' => size.normal
        => size.large

lineStyle(styleInText) =>
    switch styleInText
        'Solid'     => line.style_solid
        'Dotted'    => line.style_dotted
        'Dashed'    => line.style_dashed

queryPatterns(lastPrice, midPrice, prevPrice, isSwingHigh) =>
    if isSwingHigh
        prevPrice < midPrice and midPrice >= lastPrice
    else
        prevPrice > midPrice and midPrice <= lastPrice

method queryPatterns(ICTMS this, isSwingHigh) =>
    if isSwingHigh
        this.prevPrice < this.midPrice and this.midPrice >= this.lastPrice
    else
        this.prevPrice > this.midPrice and this.midPrice <= this.lastPrice

method updatePattern(ICTMS this, price, index) =>
    this.isCrossed := false
    this.prevPrice := this.midPrice, this.midPrice := this.lastPrice, this.lastPrice := price
    this.prevIndex := this.midIndex, this.midIndex := this.lastIndex, this.lastIndex := index
    this.prevLabel := this.midLabel, this.midLabel := this.lastLabel

method setType(MS this, value) =>
    this.prevType := this.lastType
    this.lastType := value

method renderStructures(ICTMS this, isBullish, marketStructure, color, style, width) =>

    condition = isBullish ? bar.close > this.lastPrice : bar.close < this.lastPrice

    if condition and not this.isCrossed
        this.isCrossed := true

        if marketStructure.lastType == (isBullish ? -1 : 1)
            this.isCHoCH := true
            this.measure := false

            this.msLine := line.new(this.lastIndex, this.lastPrice, bar.index, this.lastPrice, color = color, style = lineStyle(style), width = width)

            float refValue = isBullish ? bar.low : bar.high
            int   refIndex = bar.index

            [value, index] = if isBullish
                for i = 1 to (bar.index - this.lastIndex)
                    if low[i] < refValue
                        refValue := low[i]
                        refIndex := bar_index[i]
                [refValue, refIndex]
            else
                for i = 1 to (bar.index - this.lastIndex)
                    if  high[i] > refValue
                        refValue := high[i]
                        refIndex := bar_index[i]
                [refValue, refIndex]

            if isBullish
                bullFibs.ln1 := line.new(index, value, bar.index, value, color = color(na))
                bullFibs.lb1 := label.new(bar.index, value, '1 · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = '1 · ' + str.tostring(value, format.mintick))
            else
                bearFibs.ln1 := line.new(index, value, bar.index, value, color = color(na))
                bearFibs.lb1 := label.new(bar.index, value, '1 · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = '1 · ' + str.tostring(value, format.mintick))

            this.lwest := isBullish ? value : bar.low
            this.hghst := isBullish ? bar.high  : value
            this.zone := box.new(bar.index, isBullish ? this.lastPrice : value, bar.index + 1, isBullish ? value : this.lastPrice, color(na), bgcolor = areaOfInt == 'Enabled' ? color.new(color, 89) : color(na))

            this.msLabel := box.new(this.lastIndex, this.lastPrice, bar.index, this.lastPrice, color(na), bgcolor = color(na), 
             text = 'CHoCH', text_size = size.tiny, text_halign = text.align_left, text_valign = isBullish ? text.align_bottom : text.align_top, text_color = color.new(color, 17))
        else
            this.isCHoCH := false

        marketStructure.setType(isBullish ? 1 : -1)
        true
    else
        if this.isCHoCH
            if (isBullish ? bar.low > this.lwest : bar.high < this.hghst)
                this.zone.set_right(bar_index + 1)
            else
                this.isCHoCH := false
        true

method manageFibs(FIB this, render, isBullish, rHighI, rHighV, rLowI, rLowV, color) =>

    if render
        rnage = math.abs(rHighV - rLowV)
        m = (rHighV - rLowV) / (rHighI - rLowI)
        b = rLowV - m * rLowI

        if show_1 or show_0_786 or show_0_65 or show_0_618 or show_0_5 or show_0_382 or show_0_236 or show_0
            this.lnRef := line.new(rLowI, rLowV, rHighI, rHighV, color = color, style = lineStyle('Dashed'))
        if show_1
            this.ln1.set_color(color), this.ln1.set_x2(bar.index + 1), this.lb1.set_x(bar.index + 1)//, this.lb1.set_textcolor(color)
        if show_0_786
            value = isBullish ? rHighV - rnage * value_0_786 : rLowV + rnage * value_0_786
            this.ln0_786 := line.new(math.ceil((value - b)/ m), value, bar.index + 1, value, color = color, style = lineStyle('Dotted'))
            this.lb0_786 := label.new(bar.index + 1, value, str.tostring(value_0_786) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0_786) + ' · ' + str.tostring(value, format.mintick))
        if show_0_65
            value = isBullish ? rHighV - rnage * value_0_65 : rLowV + rnage * value_0_65
            this.ln0_65 := line.new(math.ceil((value - b)/ m), value, bar.index + 1, value, color = color, style = lineStyle('Dotted'))
            this.lb0_65 := label.new(bar.index + 1, value, str.tostring(value_0_65) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0_65) + ' · ' + str.tostring(value, format.mintick))
        if show_0_618
            value = isBullish ? rHighV - rnage * value_0_618 : rLowV + rnage * value_0_618
            this.ln0_618 := line.new(math.ceil((value - b)/ m), value, bar.index + 1, value, color = color, style = lineStyle('Dotted'))
            this.lb0_618 := label.new(bar.index + 1, value, str.tostring(value_0_618) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0_618) + ' · ' + str.tostring(value, format.mintick))
        if show_0_5
            value = isBullish ? rHighV - rnage * value_0_5 : rLowV + rnage * value_0_5
            this.ln0_5 := line.new(math.ceil((value - b)/ m), value, bar.index + 1, value, color = color, style = lineStyle('Dotted'))
            this.lb0_5 := label.new(bar.index + 1, value, str.tostring(value_0_5) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0_5) + ' · ' + str.tostring(value, format.mintick))
        if show_0_382
            value = isBullish ? rHighV - rnage * value_0_382 : rLowV + rnage * value_0_382
            this.ln0_382 := line.new(math.ceil((value - b)/ m), value, bar.index + 1, value, color = color, style = lineStyle('Dotted'))
            this.lb0_382 := label.new(bar.index + 1, value, str.tostring(value_0_382) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0_382) + ' · ' + str.tostring(value, format.mintick))
        if show_0_236
            value = isBullish ? rHighV - rnage * value_0_236 : rLowV + rnage * value_0_236
            this.ln0_236 := line.new(math.ceil((value - b)/ m), value, bar.index + 1, value, color = color, style = lineStyle('Dotted'))
            this.lb0_236 := label.new(bar.index + 1, value, str.tostring(value_0_236) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0_236) + ' · ' + str.tostring(value, format.mintick))
        if show_0
            value = isBullish ? rHighV : rLowV
            this.ln0 := line.new(isBullish ? rHighI : rLowI, value, bar.index + 1, value, color = color, style = lineStyle('Solid'))
            this.lb0 := label.new(bar.index + 1, value, str.tostring(value_0) + ' · ' + str.tostring(value, format.mintick), color = color(na), style = label.style_label_left, textcolor = color(na), size = size.small, tooltip = str.tostring(value_0) + ' · ' + str.tostring(value, format.mintick))
        true
    else
        if show_1
            this.ln1.set_x2(bar.index + 1), this.lb1.set_x(bar.index + 1)
        if show_0_786
            this.ln0_786.set_x2(bar.index + 1), this.lb0_786.set_x(bar.index + 1)
        if show_0_65
            this.ln0_65.set_x2(bar.index + 1), this.lb0_65.set_x(bar.index + 1)
        if show_0_618
            this.ln0_618.set_x2(bar.index + 1), this.lb0_618.set_x(bar.index + 1)
        if show_0_5
            this.ln0_5.set_x2(bar.index + 1), this.lb0_5.set_x(bar.index + 1)
        if show_0_382
            this.ln0_382.set_x2(bar.index + 1), this.lb0_382.set_x(bar.index + 1)
        if show_0_236
            this.ln0_236.set_x2(bar.index + 1), this.lb0_236.set_x(bar.index + 1)
        if show_0
            this.ln0.set_x2(bar.index + 1), this.lb0.set_x(bar.index + 1)
        true
//---------------------------------------------------------------------------------------------------------------------}
// Calculations - ICT Short Term Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

if queryPatterns(bar.low, bar.low[1], bar.low[2], false)
    stLow.updatePattern(bar.low[1], bar.index[1])
    stLow.lastLabel := label.new(stLow.lastIndex, stLow.lastPrice, '⦁', color = color(na), textcolor = color(na), style = label.style_label_up)

if queryPatterns(bar.high, bar.high[1], bar.high[2], true)
    stHigh.updatePattern(bar.high[1], bar.index[1])
    stHigh.lastLabel := label.new(bar.index[1], bar.high[1], '⦁', color = color(na), textcolor = color(na), style = label.style_label_down)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - ICT Intermediate Term Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

cITL = stLow.queryPatterns(false) 

if cITL and cITL != cITL[1]
    itLow.updatePattern(stLow.midPrice, stLow.midIndex)
    itLow.lastLabel := stLow.midLabel

cITH = stHigh.queryPatterns(true) 

if cITH and cITH != cITH[1]
    itHigh.updatePattern(stHigh.midPrice, stHigh.midIndex)
    itHigh.lastLabel := stHigh.midLabel

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - ICT Long Term Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

cLTL = itLow.queryPatterns(false)

if cLTL and cLTL != cLTL[1]
    ltLow.isCrossed := false

    if ltMS.lastType == -1 and ltMS.prevType != ltMS.lastType and not ltLow.measure// 
        ltLow.measure := true
        bearFibs.manageFibs(true, false, bearFibs.ln1.get_x1(), ltLow.zone.get_top(), itLow.midIndex, itLow.midPrice , ltBearMSColor)

    TX = ltSwings == '△▽' ? '△' : ltSwings == '◉' ? '◉' : ltLow.lastPrice > itLow.midPrice ? 'LL' : 'LH'

    ltLow.lastPrice := itLow.midPrice
    ltLow.lastIndex := itLow.midIndex

    if ltSwings != 'Disabled'
        itLow.midLabel.set_text(TX)
        itLow.midLabel.set_size(textSize(ltSwingsSZ))
        itLow.midLabel.set_textcolor(ltBearMSColor)

if ltLow.isCHoCH and ltLow.measure
    if bar.high < ltLow.hghst
        bearFibs.manageFibs(false, false, 0, 0., 0, 0., color(na))

cLTH = itHigh.queryPatterns(true)

if cLTH and cLTH != cLTH[1]
    ltHigh.isCrossed := false

    if ltMS.lastType == 1 and ltMS.prevType != ltMS.lastType and not ltHigh.measure// 
        ltHigh.measure := true
        bullFibs.manageFibs(true, true, itHigh.midIndex, itHigh.midPrice, bullFibs.ln1.get_x1(), ltHigh.zone.get_bottom(), ltBullMSColor)

    TX = ltSwings == '△▽' ? '▽' : ltSwings == '◉' ? '◉' : ltHigh.lastPrice > itHigh.midPrice ? 'HL' : 'HH'

    ltHigh.lastPrice := itHigh.midPrice
    ltHigh.lastIndex := itHigh.midIndex

    if ltSwings != 'Disabled'
        itHigh.midLabel.set_text(TX)
        itHigh.midLabel.set_size(textSize(ltSwingsSZ))
        itHigh.midLabel.set_textcolor(ltBullMSColor)

if ltHigh.isCHoCH and ltHigh.measure
    if bar.low > ltHigh.lwest
        bullFibs.manageFibs(false, true, 0, 0., 0, 0., color(na))

ltLow.renderStructures(false, ltMS, ltBearMSColor, ltMSLineStyle, ltMSLineWidth)
ltHigh.renderStructures(true, ltMS, ltBullMSColor, ltMSLineStyle, ltMSLineWidth)

C_DownTrend = engulf == 'Disabled' ? false : true
C_UpTrend = engulf == 'Disabled' ? false : true
C_Len = 14
C_BodyHi = math.max(close, open)
C_BodyLo = math.min(close, open)
C_Body = C_BodyHi - C_BodyLo
C_BodyAvg = ta.ema(C_Body, C_Len)
C_SmallBody = C_Body < C_BodyAvg
C_LongBody = C_Body > C_BodyAvg
C_WhiteBody = open < close
C_BlackBody = open > close

C_EngulfingBearish = C_UpTrend and C_BlackBody and C_LongBody and C_WhiteBody[1] and C_SmallBody[1] and close <= open[1] and open >= close[1] and ( close < open[1] or open > close[1] )

if C_EngulfingBearish and (engulf == 'All' ? true : ltLow.isCHoCH and ltLow.measure and bar.close > ltLow.zone.get_bottom())
    var ttBearishEngulfing = "A bearish engulfing pattern is a two-candle reversal pattern that often signals a potential shift from an uptrend to a downtrend."
    label.new(bar.index, bar.high, '▼', color = color(na), textcolor = ltBearMSColor, style = label.style_label_down, tooltip = ttBearishEngulfing, size = textSize(engulfSZ))

C_EngulfingBullish = C_DownTrend and C_WhiteBody and C_LongBody and C_BlackBody[1] and C_SmallBody[1] and close >= open[1] and open <= close[1] and ( close > open[1] or open < close[1] )

if C_EngulfingBullish and (engulf == 'All' ? true : ltHigh.isCHoCH and ltHigh.measure and bar.close < ltHigh.zone.get_top())
    var ttBullishEngulfing = "A bullish engulfing pattern is a two-candle reversal pattern that typically signals a potential shift from a downtrend to an uptrend in price."
    label.new(bar.index, bar.low, '▲', color = color(na), textcolor = ltBullMSColor, style=label.style_label_up, tooltip = ttBullishEngulfing, size = textSize(engulfSZ))

//---------------------------------------------------------------------------------------------------------------------}