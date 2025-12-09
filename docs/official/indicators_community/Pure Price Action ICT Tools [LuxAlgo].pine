// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator("Pure Price Action ICT Tools [LuxAlgo]", 'LuxAlgo - Pure Price Action ICT Tools', true, calc_bars_count = 2000, max_labels_count = 500, max_boxes_count = 500, max_lines_count = 500)

//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{

display  = display.all - display.status_line

msGroup = 'Market Structures'
msShow = input.bool (true, 'Market Structures', group = msGroup)
msTerm = input.string('Intermediate Term', '  Detection', options = ['Short Term', 'Intermediate Term', 'Long Term'], group = msGroup)
msTextT = input.string('Enabled', '  Market Structure Labels', options = ['Enabled', 'Disabled'], group = msGroup, display = display), msText = msTextT == 'Enabled'
msLineStyle = input.string('Solid', '  Line Style', options = ['Solid', 'Dashed', 'Dotted'], group = msGroup, display = display)
msBullColor = input.color(#089981, '  Line Colors, Bullish', group = msGroup, inline = 'MS')
msBearColor = input.color(#f23645, 'Bearish', group = msGroup, inline = 'MS')

obbGroup = 'Order & Breaker Blocks'
obbShow = input.bool (true, 'Order & Breaker Blocks', group = obbGroup)
obbTerm = input.string('Long Term', '  Detection', options = ['Short Term', 'Intermediate Term', 'Long Term'], group = obbGroup, display = display)
obbBullLast = input.int(3, '  Last Bullish Blocks', minval = 0, group = obbGroup, display = display)
obbBearLast = input.int(3, '  Last Bearish Blocks', minval = 0, group = obbGroup, display = display)
obbUseBodyT = input.string('Enabled', '  Use Candle Body', options = ['Enabled', 'Disabled'], group = obbGroup, display = display), obbUseBody = obbUseBodyT == 'Enabled'
obbBullColor      = input(color.new(#089981, 73), '  Bullish OB '   , inline = 'bullC', group = obbGroup)
obbBullBreakColor = input(color.new(#f23645, 41), 'Bullish Break ', inline = 'bullC', group = obbGroup)
obbBearColor      = input(color.new(#f23645, 73), '  Bearish OB'   , inline = 'bearC', group = obbGroup)
obbBearBreakColor = input(color.new(#089981, 41), 'Bearish Break', inline = 'bearC', group = obbGroup)

liqGroup = 'Buyside & Sellside Liquidity'
liqBuySell = input.bool (true, 'Buyside & Sellside Liquidity', group = liqGroup)
liqTerm = input.string('Intermediate Term', '  Detection', options = ['Short Term', 'Intermediate Term', 'Long Term'], group = liqGroup)
liqMar = 10 / input.float (6.9, '  Margin', minval = 4, maxval = 9, step = 0.1, group = liqGroup, display = display)
cLIQ_B = input.color (#089981, '  Line Colors, Buyside', inline = 'LIQ', group = liqGroup)
cLIQ_S = input.color (#f23645, 'Sellside', inline = 'LIQ', group = liqGroup)
visLiq = input.int   (3, '  Visible Levels', minval = 1, maxval = 50, group = liqGroup, display = display)

liqGrp = 'Liquidity Voids'
lqVoid = input.bool (true, 'Liquidity Voids', group = liqGrp)
lqThresh = input.float(.75, '  Threshold Multiplier', minval = .05, step = .05, group = liqGrp, display = display)
lqMode  = input.string('Present', '  Mode', options =['Present', 'Historical'], inline = 'MD', group = liqGrp, display = display)
lqPeriod = input.int(360, ' ', inline = 'MD', group = liqGrp, display = display)
cLQV_B = input.color (#B2B5BE41, '  Bullish Zones', inline = 'void', group = liqGrp)
cLQV_S = input.color (#5D606B41, ' Bearish Zones', inline = 'void', group = liqGrp)
lqTextT = input.string('Disabled', '  Liquidity Void Labels', options = ['Enabled', 'Disabled'], group = liqGrp, display = display), lqText = lqTextT == 'Enabled'

swGroup = 'Swing Highs/Lows'
swShow = input.bool (true, 'Swing Highs/Lows', group = swGroup)
swTerm = input.string('Long Term', '  Detection', options = ['Short Term', 'Intermediate Term', 'Long Term'], group = swGroup)
swSwingsSZ  = input.string('Tiny', '  Label Size', options = ['Tiny', 'Small', 'Normal'], group = swGroup, display = display)
swBullColor = input.color(#089981, '  Label Colors, Bullish', group = swGroup, inline = 'MS')
swBearColor = input.color(#f23645, 'Bearish', group = swGroup, inline = 'MS')

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
    bool    isConfirmed

    int     marketStructure

    line    msLine
    box     msLabel
    box     swpBox

type MS
    int type = 0

type ZZ 
    int   [] d
    int   [] x 
    float [] y 

type liq
    box   bx
    box   bxz
    box   bxt
    bool  brZ
    bool  brL
    line  ln
    line  lne

type ob
    float top = na
    float btm = na
    int   loc = bar_index
    bool  breaker = false
    int   break_loc = na

type SWING
    float y = na
    int   x = na
    bool  crossed = false

type vector
    array<SWING> v

type htfBar
    float price = na
    int   index = na

//---------------------------------------------------------------------------------------------------------------------}
// Generic Variables
//---------------------------------------------------------------------------------------------------------------------{

BAR bar = BAR.new()
var bxOBB = array.new_box()
var lnOBB = array.new_line()

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

timeframe(userTimeframe) =>
    float chartTFinM = timeframe.in_seconds() / 60

    switch 
        userTimeframe == "Auto"       and chartTFinM <= 60   => 'D'
        userTimeframe == "Auto"       and chartTFinM <= 1440 => 'W'
        userTimeframe == "5 Minutes"  and chartTFinM <= 5    => '5'
        userTimeframe == "15 Minutes" and chartTFinM <= 15   => '15'
        userTimeframe == "1 Hour"     and chartTFinM <= 60   => '60'
        userTimeframe == "4 Hours"    and chartTFinM <= 240  => '240'
        userTimeframe == "1 Day"      and timeframe.isintraday => 'D'
        (userTimeframe == "Auto" or userTimeframe == "1 Week")  and (timeframe.isdaily or timeframe.isintraday) => 'W'
        (userTimeframe == "Auto" or userTimeframe == "1 Month") and (timeframe.isweekly or timeframe.isdaily or timeframe.isintraday) => 'M'
        => timeframe.period

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
    this.type := value

method renderStructures(ICTMS this, isBullish, marketStructure, color, style, labelEnabled) =>

    condition = isBullish ? bar.close > this.lastPrice : bar.close < this.lastPrice

    if condition and not this.isCrossed
        this.isCrossed := true
        this.isConfirmed := false
        this.msLine := line.new(this.lastIndex, this.lastPrice, bar.index, this.lastPrice, color = color, style = lineStyle(style))
        this.swpBox := box.new(bar.index, this.lastPrice, bar.index, this.lastPrice, color.new(color, 73), bgcolor = color.new(color, 73))

        if labelEnabled
            this.msLabel := box.new(this.lastIndex, this.lastPrice, bar.index, this.lastPrice, color(na), bgcolor = color(na), 
             text = marketStructure.type == (isBullish ? -1 : 1) ? 'MSS' : 'BOS', text_size = size.tiny, text_halign = text.align_left, text_valign = isBullish ? text.align_bottom : text.align_top, text_color = color.new(color, 17))

        marketStructure.setType(isBullish ? 1 : -1)

method in_out(ZZ aZZ, int _d, int _x, float _y) =>
    aZZ.d.unshift(_d), aZZ.x.unshift(_x), aZZ.y.unshift(_y), aZZ.d.pop(), aZZ.x.pop(), aZZ.y.pop()

method detectSwings(array<vector> id, mode, depth)=>
    var SWING swingLevel = SWING.new(na, na)
    for i = 0 to depth - 1
        get_v = id.get(i).v

        if get_v.size() == 3
            pivot = switch mode
                'bull' => math.max(get_v.get(0).y, get_v.get(1).y, get_v.get(2).y)
                'bear' => math.min(get_v.get(0).y, get_v.get(1).y, get_v.get(2).y)

            if pivot == get_v.get(1).y
                if i < depth - 1
                    id.get(i+1).v.unshift(get_v.get(1))

                    if id.get(i+1).v.size() > 3
                        id.get(i+1).v.pop()
                else
                    swingLevel := SWING.new(get_v.get(1).y, get_v.get(1).x)
            
                get_v.pop()
                get_v.pop()
    swingLevel

method renderBlocks(ob id, color, breakColor)=>
    avg = math.avg(id.top, id.btm)

    if id.breaker
        bxOBB.push(box.new(id.loc, id.top, id.break_loc, id.btm, color, bgcolor = color, xloc = xloc.bar_time))
        lnOBB.push(line.new(id.break_loc, id.top, timenow, id.top, xloc.bar_time, extend.none, breakColor))
        lnOBB.push(line.new(id.break_loc, id.btm, timenow, id.btm, xloc.bar_time, extend.none, breakColor))
        lnOBB.push(line.new(id.loc, avg, timenow, avg, xloc.bar_time, extend.none, breakColor, style = line.style_dotted))
    
    if not id.breaker
        bxOBB.push(box.new(id.loc, id.top, timenow, id.btm, na, bgcolor = color, extend = extend.none, xloc = xloc.bar_time))
        lnOBB.push(line.new(id.loc, id.top, timenow, id.top, xloc.bar_time, extend.none, color))
        lnOBB.push(line.new(id.loc, id.btm, timenow, id.btm, xloc.bar_time, extend.none, color))
        lnOBB.push(line.new(id.loc, avg, timenow, avg, xloc.bar_time, extend.none, breakColor, style = line.style_dotted))

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Swings 
//---------------------------------------------------------------------------------------------------------------------{

var ICTMS stLow  = ICTMS.new()
var ICTMS stHigh = ICTMS.new()
var MS stMS = MS.new()

if queryPatterns(bar.low, bar.low[1], bar.low[2], false)
    stLow.updatePattern(bar.low[1], bar.index[1])
    stLow.lastLabel := label.new(stLow.lastIndex, stLow.lastPrice, '⦁', color = color(na), textcolor = swShow and swTerm == 'Short Term' ? swBearColor : color(na), style = label.style_label_up, size = textSize(swSwingsSZ), tooltip = str.tostring(stLow.lastPrice, format.mintick))

if queryPatterns(bar.high, bar.high[1], bar.high[2], true)
    stHigh.updatePattern(bar.high[1], bar.index[1])
    stHigh.lastLabel := label.new(bar.index[1], bar.high[1], '⦁', color = color(na), textcolor = swShow and swTerm == 'Short Term' ? swBullColor : color(na), style = label.style_label_down, size = textSize(swSwingsSZ), tooltip = str.tostring(bar.high[1], format.mintick))

var ICTMS itLow  = ICTMS.new()
var ICTMS itHigh = ICTMS.new()
var MS itMS = MS.new()

cITL = stLow.queryPatterns(false) 

if cITL and cITL != cITL[1]
    itLow.updatePattern(stLow.midPrice, stLow.midIndex)

    itLow.lastLabel := stLow.midLabel

    if swShow and swTerm == 'Intermediate Term'
        stLow.midLabel.set_size(textSize(swSwingsSZ))
        stLow.midLabel.set_textcolor(swBearColor)

cITH = stHigh.queryPatterns(true) 

if cITH and cITH != cITH[1]
    itHigh.updatePattern(stHigh.midPrice, stHigh.midIndex)

    itHigh.lastLabel := stHigh.midLabel

    if swShow and swTerm == 'Intermediate Term'
        stHigh.midLabel.set_size(textSize(swSwingsSZ))
        stHigh.midLabel.set_textcolor(swBullColor)

var ICTMS ltLow  = ICTMS.new()
var ICTMS ltHigh = ICTMS.new()
var MS ltMS = MS.new()

cLTL = itLow.queryPatterns(false)

if cLTL and cLTL != cLTL[1]
    ltLow.isCrossed := false

    ltLow.lastPrice := itLow.midPrice
    ltLow.lastIndex := itLow.midIndex

    if swShow and swTerm == 'Long Term'
        itLow.midLabel.set_size(textSize(swSwingsSZ))
        itLow.midLabel.set_textcolor(swBearColor)

cLTH = itHigh.queryPatterns(true)

if cLTH and cLTH != cLTH[1]
    ltHigh.isCrossed := false

    ltHigh.lastPrice := itHigh.midPrice
    ltHigh.lastIndex := itHigh.midIndex

    if swShow and swTerm == 'Long Term'
        itHigh.midLabel.set_size(textSize(swSwingsSZ))
        itHigh.midLabel.set_textcolor(swBullColor)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

if msShow
    if msTerm == 'Short Term'
        stLow.renderStructures(false, stMS, msBearColor, msLineStyle, msText)
        stHigh.renderStructures(true, stMS, msBullColor, msLineStyle, msText)

    if msTerm == 'Intermediate Term'
        itLow.renderStructures(false, itMS, msBearColor, msLineStyle, msText)
        itHigh.renderStructures(true, itMS, msBullColor, msLineStyle, msText)

    if msTerm == 'Long Term'
        ltLow.renderStructures(false, ltMS, msBearColor, msLineStyle, msText)
        ltHigh.renderStructures(true, ltMS, msBullColor, msLineStyle, msText)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Buyside & Sellside Liquidity
//---------------------------------------------------------------------------------------------------------------------{

maxSize = 50
atr     = ta.atr(10)

var ZZ aZZ = ZZ.new(
 array.new <int>  (maxSize,  0), 
 array.new <int>  (maxSize,  0), 
 array.new <float>(maxSize, na)
 )


var liq[] b_liq_B = array.new<liq> (1, liq.new(box(na), box(na), box(na), false, false, line(na), line(na)))
var liq[] b_liq_S = array.new<liq> (1, liq.new(box(na), box(na), box(na), false, false, line(na), line(na)))

var b_liq_V = array.new_box()

var int dir = na, var int x1 = na, var float y1 = na, var int x2 = na, var float y2 = na

[topLQ, btmLQ]  = switch liqTerm
    'Short Term' => [SWING.new(stHigh.lastPrice, stHigh.lastIndex), SWING.new(stLow.lastPrice, stLow.lastIndex)]
    'Intermediate Term' =>  [SWING.new(itHigh.lastPrice, itHigh.lastIndex), SWING.new(itLow.lastPrice, itLow.lastIndex)]
    'Long Term' =>  [SWING.new(ltHigh.lastPrice, ltHigh.lastIndex), SWING.new(ltLow.lastPrice, ltLow.lastIndex)]

if not liqBuySell
    topLQ := SWING.new(0, 0)
    btmLQ := SWING.new(0, 0)

swingHigh = topLQ.y 
swingLow  = btmLQ.y 

x2 := bar.index - 1

if swingHigh > 0 and swingHigh != swingHigh[1]   
    dir := aZZ.d.get(0) 
    x1  := aZZ.x.get(0)
    x2  := topLQ.x
    y1  := aZZ.y.get(0) 
    y2  := swingHigh//nz(bar.high[1])

    if dir < 1
        aZZ.in_out(1, x2, y2)
    else
        if dir == 1 and swingHigh > y1 
            aZZ.x.set(0, x2), aZZ.y.set(0, y2)
    
    if true
        count = 0
        st_P  = 0.
        st_B  = 0
        minP  = 0.
        maxP  = 10e6

        for i = 0 to maxSize - 1
            if aZZ.d.get(i) ==  1 
                if aZZ.y.get(i) > swingHigh + (atr / liqMar)
                    break
                else
                    if aZZ.y.get(i) > swingHigh - (atr / liqMar) and aZZ.y.get(i) < swingHigh + (atr / liqMar)
                        count += 1
                        st_B := aZZ.x.get(i)
                        st_P := aZZ.y.get(i)
                        if aZZ.y.get(i) > minP
                            minP := aZZ.y.get(i)
                        if aZZ.y.get(i) < maxP 
                            maxP := aZZ.y.get(i)

        if count > 2
            getB = b_liq_B.get(0)

            if st_B == getB.bx.get_left()
                getB.bx.set_top(math.avg(minP, maxP) + (atr / liqMar))
                getB.bx.set_rightbottom(bar.index + 10, math.avg(minP, maxP) - (atr / liqMar))
            else
                b_liq_B.unshift(
                 liq.new(
                   box.new(st_B, math.avg(minP, maxP) + (atr / liqMar), bar.index + 10, math.avg(minP, maxP) - (atr / liqMar), bgcolor=color(na), border_color=color(na)), 
                   box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                   box.new(st_B, st_P, bar.index + 10, st_P, text = 'Buyside liquidity', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_bottom, text_color = color.new(cLIQ_B, 25), bgcolor = color(na), border_color = color(na)),
                   false, 
                   false,
                   line.new(st_B   , st_P, bar.index - 1, st_P, color = color.new(cLIQ_B, 0)),
                   line.new(bar.index - 1, st_P, na     , st_P, color = color.new(cLIQ_B, 0), style = line.style_dotted))
                 )

            if b_liq_B.size() > visLiq
                getLast = b_liq_B.pop()
                getLast.bx.delete()
                getLast.bxz.delete()
                getLast.bxt.delete()
                getLast.ln.delete()
                getLast.lne.delete()               

if swingLow > 0 and swingLow != swingLow[1]
    dir := aZZ.d.get (0) 
    x1  := aZZ.x.get (0) 
    x2  := btmLQ.x
    y1  := aZZ.y.get (0) 
    y2  := swingLow//nz(bar.low[1])
    
    if dir > -1
        aZZ.in_out(-1, x2, y2)
    else
        if dir == -1 and swingLow < y1 
            aZZ.x.set(0, x2), aZZ.y.set(0, y2)
    
    if true
        count = 0
        st_P  = 0.
        st_B  = 0
        minP  = 0.
        maxP  = 10e6

        for i = 0 to maxSize - 1
            if aZZ.d.get(i) == -1 
                if aZZ.y.get(i) < swingLow - (atr / liqMar)
                    break
                else
                    if aZZ.y.get(i) > swingLow - (atr / liqMar) and aZZ.y.get(i) < swingLow + (atr / liqMar)
                        count += 1
                        st_B := aZZ.x.get(i)
                        st_P := aZZ.y.get(i)
                        if aZZ.y.get(i) > minP
                            minP := aZZ.y.get(i)
                        if aZZ.y.get(i) < maxP 
                            maxP := aZZ.y.get(i)

        if count > 2
            getB = b_liq_S.get(0)

            if st_B == getB.bx.get_left()
                getB.bx.set_top(math.avg(minP, maxP) + (atr / liqMar))
                getB.bx.set_rightbottom(bar.index + 10, math.avg(minP, maxP) - (atr / liqMar))
            else
                b_liq_S.unshift(
                 liq.new(
                   box.new(st_B, math.avg(minP, maxP) + (atr / liqMar), bar.index + 10, math.avg(minP, maxP) - (atr / liqMar), bgcolor=color(na), border_color=color(na)),
                   box.new(na, na, na, na, bgcolor=color(na), border_color=color(na)),
                   box.new(st_B, st_P, bar.index + 10, st_P, text = 'Sellside liquidity', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_top, text_color = color.new(cLIQ_S, 25), bgcolor=color(na), border_color=color(na)),
                   false,
                   false,
                   line.new(st_B   , st_P, bar.index - 1, st_P, color = color.new(cLIQ_S, 0)),
                   line.new(bar.index - 1, st_P, na     , st_P, color = color.new(cLIQ_S, 0), style = line.style_dotted))
                 )  

            if b_liq_S.size() > visLiq
                getLast = b_liq_S.pop()
                getLast.bx.delete()
                getLast.bxz.delete()
                getLast.bxt.delete()
                getLast.ln.delete()            
                getLast.lne.delete()               

for i = 0 to b_liq_B.size() - 1
    x = b_liq_B.get(i)
    
    if not x.brL
        x.lne.set_x2(bar.index)

        if bar.high > x.bx.get_top()
            x.brL := true

for i = 0 to b_liq_S.size() - 1
    x = b_liq_S.get(i)

    if not x.brL
        x.lne.set_x2(bar.index)

        if bar.low < x.bx.get_bottom()
            x.brL := true

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Liquidity Voids 
//---------------------------------------------------------------------------------------------------------------------{

atr200  = ta.atr(200) * lqThresh
dispPeriod = lqMode == 'Present' ? last_bar_index - bar_index <=  lqPeriod : true

if lqVoid and dispPeriod
    bull = bar.low - bar.high[2] > atr200 and bar.low > bar.high[2] and bar.close[1] > bar.high[2]
    bear = bar.low[2] - bar.high > atr200 and bar.high < bar.low[2] and bar.close[1] < bar.low[2]

    if bull 
        l  = 13
        if bull[1] 
            st = math.abs(bar.low - bar.low[1]) / l
            for i = 0 to l - 1
                b_liq_V.push(box.new(bar.index - 2, bar.low[1] + i * st, bar.index, bar.low[1] + (i + 1) * st, border_color = na, bgcolor = cLQV_B ))
        else   
            st = math.abs(bar.low - bar.high[2]) / l
            for i = 0 to l - 1
                if lqText and i == 0
                    array.push(b_liq_V, box.new(bar.index - 2, bar.high[2] + i * st, bar.index, bar.high[2] + (i + 1) * st, text = 'Liquidity Void   ', text_size = size.tiny, text_halign = text.align_right, text_valign = text.align_bottom, text_color = na, border_color = na, bgcolor = cLQV_B ))
                else
                    array.push(b_liq_V, box.new(bar.index - 2, bar.high[2] + i * st, bar.index, bar.high[2] + (i + 1) * st, border_color = na, bgcolor = cLQV_B ))

    if bear
        l  = 13
        if bear[1]
            st = math.abs(bar.high[1] - bar.high) / l
            for i = 0 to l - 1
                array.push(b_liq_V, box.new(bar.index - 2, bar.high + i * st, bar.index, bar.high + (i + 1) * st, border_color = na, bgcolor = cLQV_S ))
        else
            st = math.abs(bar.low[2] - bar.high) / l
            for i = 0 to l - 1
                if lqText and i == l - 1
                    array.push(b_liq_V, box.new(bar.index - 2, bar.high + i * st, bar.index, bar.high + (i + 1) * st, text = 'Liquidity Void   ', text_size = size.tiny, text_halign = text.align_right, text_valign = text.align_top, text_color = na, border_color = na, bgcolor = cLQV_S ))
                else
                    array.push(b_liq_V, box.new(bar.index - 2, bar.high + i * st, bar.index, bar.high + (i + 1) * st, border_color = na, bgcolor = cLQV_S ))

if b_liq_V.size() > 0
    qt = b_liq_V.size()
    for bn = qt - 1 to 0
        if bn < b_liq_V.size()
            cb = b_liq_V.get(bn)
            ba = math.avg(cb.get_bottom(), cb.get_top())

            if math.sign(bar.close[1] - ba) != math.sign(bar.close - ba) or math.sign(bar.close[1] - ba) != math.sign(bar.low - ba) or math.sign(bar.close[1] - ba) != math.sign(bar.high - ba)
                b_liq_V.remove(bn)
            else
                cb.set_right(bar.index + 1)

                if bar.index - cb.get_left() > 21
                    cb.set_text_color(color.new(chart.fg_color, 25))


//---------------------------------------------------------------------------------------------------------------------}
// Order & Breaker Blocks
//---------------------------------------------------------------------------------------------------------------------{

depth  = switch obbTerm
    'Short Term' => 1
    'Intermediate Term' => 2
    'Long Term' => 3

var fractalHigh = array.new<vector>(0)
var fractalLow = array.new<vector>(0)

if barstate.isfirst
    for i = 0 to depth - 1
        fractalHigh.push(vector.new(array.new<SWING>(0)))
        fractalLow.push(vector.new(array.new<SWING>(0)))

fractalHigh.get(0).v.unshift(SWING.new(bar.high, bar.index))
fractalLow.get(0).v.unshift(SWING.new(bar.low, bar.index))

if fractalHigh.get(0).v.size() > 3
    fractalHigh.get(0).v.pop()

if fractalLow.get(0).v.size() > 3
    fractalLow.get(0).v.pop()

top = fractalHigh.detectSwings('bull', depth)
btm = fractalLow.detectSwings('bear', depth)


if obbShow

    max = obbUseBody ? math.max(bar.close, bar.open) : bar.high
    min = obbUseBody ? math.min(bar.close, bar.open) : bar.low

    var bullish_ob = array.new<ob>(0)

    if bar.close > top.y and not top.crossed
        top.crossed := true

        minima = max[1]
        maxima = min[1]
        loc = time[1]

        for i = 1 to (bar.index - top.x) - 1
            minima := math.min(min[i], minima)
            maxima := minima == min[i] ? max[i] : maxima
            loc := minima == min[i] ? time[i] : loc

        bullish_ob.unshift(ob.new(maxima, minima, loc))

    if bullish_ob.size() > 100//obbBullLast
        bullish_ob.pop() 

    if bullish_ob.size() > 0
        for i = bullish_ob.size() - 1 to 0
            element = bullish_ob.get(i)

            if not element.breaker 
                if math.min(bar.close, bar.open) < element.btm
                    element.breaker := true
                    element.break_loc := time
            else
                if bar.close > element.top
                    bullish_ob.remove(i)

    var bearish_ob = array.new<ob>(0)

    if bar.close < btm.y and not btm.crossed
        btm.crossed := true

        minima = min[1]
        maxima = max[1]
        loc = time[1]

        for i = 1 to (bar.index - btm.x) - 1
            maxima := math.max(max[i], maxima)
            minima := maxima == max[i] ? min[i] : minima
            loc := maxima == max[i] ? time[i] : loc

        bearish_ob.unshift(ob.new(maxima, minima, loc))

    if bearish_ob.size() > 100//obbBearLast
        bearish_ob.pop() 

    if bearish_ob.size() > 0
        for i = bearish_ob.size() - 1 to 0
            element = bearish_ob.get(i)

            if not element.breaker 
                if math.max(bar.close, bar.open) > element.top
                    element.breaker := true
                    element.break_loc := time
            else
                if bar.close < element.btm
                    bearish_ob.remove(i)

    if bxOBB.size() > 0
        for i = 0 to bxOBB.size() - 1
            box.delete(bxOBB.shift())

    if lnOBB.size() > 0
        for i = 0 to lnOBB.size() - 1
            line.delete(lnOBB.shift())

    if barstate.islast
        if obbBullLast > 0 and bullish_ob.size() > 0
            for i = 0 to math.min(obbBullLast - 1, bullish_ob.size() - 1)
                get_ob = bullish_ob.get(i)
                get_ob.renderBlocks(obbBullColor, obbBullBreakColor)

        if obbBearLast > 0 and bearish_ob.size() > 0
            for i = 0 to math.min(obbBearLast - 1, bearish_ob.size() - 1)
                get_ob = bearish_ob.get(i)
                get_ob.renderBlocks(obbBearColor, obbBearBreakColor)

//---------------------------------------------------------------------------------------------------------------------}