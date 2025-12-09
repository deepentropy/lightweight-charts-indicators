// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator("Support and Resistance Signals MTF [LuxAlgo]", 'LuxAlgo - Support Resistance Signals MTF', true, max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

srGR   = 'Support & Resistance Settings'
srTT   = 'tip : in ranging markets higher timeframe resolution or higher detection length might help reduce the noise'
srTF   = input.string('Chart', 'Detection Timeframe', options=['Chart', '15 Minutes', '1 Hour', '4 Hours', '1 Day', '1 Week'], group = srGR, tooltip = srTT)
srLN   = input(15, 'Detection Length', group = srGR)

srMR   = input.float(2, 'Support Resistance Margin', minval = .1, maxval = 10, step = .1, group = srGR)

srSLC  = input(color.new(#089981, 53), '   - Support,     Lines', inline = 'srS', group = srGR)
srSZC  = input(color.new(#089981, 83), 'Zones', inline = 'srS', group = srGR)
srRLC  = input(color.new(#f23645, 53), '   - Resistance, Lines', inline = 'srR', group = srGR)
srRZC  = input(color.new(#f23645, 83), 'Zones', inline = 'srR', group = srGR)

srHST  = input.bool(true, 'Check Previous Historical S&R Zone', group = srGR)

mnGR   = 'Manupulations' 
mnSH   = input.bool(true, 'Manupulation Zones', group = mnGR)
mnMR   = input.float(1.3, 'Manupulation Margin', minval = .1, maxval = 10, step = .1, group = mnGR)
mnSZC  = input(color.new(#2962ff, 73), 'Manupulation Zones, Support', inline = 'LQ', group = mnGR)
mnRZC  = input(color.new(#ff9800, 73), 'Resistance', inline = 'LQ', group = mnGR)

sigGR  = 'Signals'
srFBT  = 'Filters the breakouts that failed to continue beyond a level'
srFBO  = input.bool(true, 'Avoid False Breakouts', group = sigGR, tooltip = srFBT)

srBUC  = input(color.new(#089981, 33), 'Breakouts, Bullish', inline = 'srB', group = sigGR)
srBDC  = input(color.new(#f23645, 33), 'Bearish', inline = 'srB', group = sigGR)
srBS   = input.string('Tiny', "", options=['Auto', 'Tiny', 'Small', 'Normal', 'None'], inline = 'srB', group = sigGR)

srTUC  = input(color.new(#2962ff, 33), 'Tests,        Bullish', inline = 'srT', group = sigGR)
srTDC  = input(color.new(#e040fb, 33), 'Bearish', inline = 'srT', group = sigGR)
srTS   = input.string('Tiny', "", options=['Auto', 'Tiny', 'Small', 'Normal', 'None'], inline = 'srT', group = sigGR)

srRUC  = input(color.new(#089981, 33), 'Retests,     Bullish', inline = 'srR', group = sigGR)
srRDC  = input(color.new(#f23645, 33), 'Bearish', inline = 'srR', group = sigGR)
srRS   = input.string('Tiny', "", options=['Auto', 'Tiny', 'Small', 'Normal', 'None'], inline = 'srR', group = sigGR)

srPUC  = input(color.new(#089981, 33), 'Rejections, Bullish', inline = 'srP', group = sigGR)
srPDC  = input(color.new(#f23645, 33), 'Bearish', inline = 'srP', group = sigGR)
srPS   = input.string('Tiny', "", options=['Auto', 'Tiny', 'Small', 'Normal', 'None'], inline = 'srP', group = sigGR)

othGR  = 'Others'
swSH   = input.string('None', "Swing Levels", options=['Auto', 'Small', 'Normal', 'Large', 'None'], inline = 'sw', group = othGR)
swHC   = input(color.new(#f23645, 33), 'H', inline = 'sw', group = othGR)
swLC   = input(color.new(#089981, 33), 'L', inline = 'sw', group = othGR)

//-----------------------------------------------------------------------------}
// User Defined Types
//-----------------------------------------------------------------------------{

// @type        bar properties with their values 
//
// @field o     (float) open price of the bar
// @field h     (float) high price of the bar
// @field l     (float) low price of the bar
// @field c     (float) close price of the bar
// @field v     (float) volume of the bar
// @field i     (int) index of the bar

type bar
    float o = open
    float h = high
    float l = low
    float c = close
    float v = volume
    int   i = bar_index

// @type        store pivot high/low and index data 
//
// @field x     (int)    last pivot bar index
// @field x1    (int)    previous pivot bar index
// @field h     (float)  last pivot high
// @field h1    (float)  previous pivot high
// @field l     (float)  last pivot low
// @field l1    (float)  previous pivot low
// @field hx    (bool)   pivot high cross status
// @field lx    (bool)   pivot low cross status

type pivotPoint
    int    x
    int    x1
    float  h
    float  h1
    float  l
    float  l1
    bool   hx
    bool   lx

// @type        stores support and resistance visuals and signal status 
//
// @field bx    (box)   support and resistance zones
// @field lq    (box)   liquidity sweeps
// @field ln    (line)  support and resistance levels
// @field b     (bool)  breakout status
// @field b     (bool)  test status
// @field b     (bool)  retest status
// @field b     (bool)  liqudation status
// @field m     (float) default margin 

type SnR
    box    bx
    box    lq
    line   ln
    bool   b
    bool   t
    bool   r
    bool   l
    float  m

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()

var pivotPoint pp  = pivotPoint.new()

var SnR[] R = array.new<SnR> (1, SnR.new(box(na), box(na), line(na), false, false, false, false, na))  
var SnR[] S = array.new<SnR> (1, SnR.new(box(na), box(na), line(na), false, false, false, false, na)) 

var SnR lR  = SnR.new(box(na), box(na), line(na), false, false, false, false, na)
var SnR lS  = SnR.new(box(na), box(na), line(na), false, false, false, false, na)
var SnR lRt = SnR.new(box(na), box(na), line(na), false, false, false, false, na)
var SnR lSt = SnR.new(box(na), box(na), line(na), false, false, false, false, na)

var int mss = 0

//-----------------------------------------------------------------------------}
// General Calculations
//-----------------------------------------------------------------------------{

int tf_m = switch srTF
    "Chart"      => timeframe.isintraday ? timeframe.multiplier : timeframe.isdaily ? 1440 : timeframe.isweekly ? 10080 : 10080 * 30
    "15 Minutes" => 15
    "1 Hour"     => 60
    "4 Hours"    => 240
    "1 Day"      => 1440
    "1 Week"     => 10080

ch_m  = if timeframe.isintraday
    timeframe.multiplier
else if timeframe.isdaily
    1440
else if timeframe.isweekly
    10080
else if timeframe.ismonthly
    10080 * 30

srLN := srLN * tf_m / ch_m

pHST = ta.highest(b.h, srLN)
pLST = ta.lowest (b.l, srLN)

atr   = ta.atr(17)
isLLS = math.abs(b.l - math.min(b.o, b.c)) >= 1.618 * atr
isLUS = math.abs(b.h - math.max(b.o, b.c)) >= 1.618 * atr

vSMA  = ta.sma(nz(b.v), 17)
isHV  = nz(b.v) >= 1.618 * vSMA
isLV  = nz(b.v) <= 0.618 * vSMA
vST   = isHV ? '\n *High Trading Activity' : isLV ? '\n *Low Trading Activity' : '\n *Average Trading Activity'

if nz(b.v) > vSMA * 4.669
    alert('High trading activity (Volume SPIKE) detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

srBUC := srBS != 'None' ? srBUC : color(na)
srBDC := srBS != 'None' ? srBDC : color(na)
srBTC  = srBS != 'None' ? color.white : color(na)

srTUC := srTS != 'None' ? srTUC : color(na)
srTDC := srTS != 'None' ? srTDC : color(na)
srTTC  = srTS != 'None' ? color.white : color(na)

srRUC := srRS != 'None' ? srRUC : color(na)
srRDC := srRS != 'None' ? srRDC : color(na)
srRTC  = srRS != 'None' ? color.white : color(na)

//-----------------------------------------------------------------------------}
// Functions/Methods
//-----------------------------------------------------------------------------{

// @function        calcuates cumulative volume of the given range
//                     
// @param _l        (int)  length of the range
// @param _o        (int)  offset 
//
// @returns         (float) cumulative volume

f_getTradedVolume(_l, _o) =>
    v = 0.
    for x = 0 to _l - 1
        v += volume[_o + x]
    v

// @function        converts size strings to enumerated values
//                     
// @param _l        (string) size string
//
// @returns         (enumeration) size enumerated value

f_getSize(_s) =>
    switch _s
        'Tiny'   => size.tiny
        'Small'  => size.small
        'Normal' => size.normal
        'Large'  => size.large
        'Huge'   => size.huge
        => size.auto

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{

pp_h  = ta.pivothigh(srLN, srLN)

if not na(pp_h)
    pp.h1  := pp.h 
    pp.h   := pp_h
    pp.x1  := pp.x
    pp.x   := b.i[srLN]
    pp.hx  := false

    if R.size() > 1
        lR  := R.get(0)
        lRt := R.get(1)

        if pp.h < lR.bx.get_bottom() * (1 - lR.m * .17 * srMR) or pp.h > lR.bx.get_top() * (1 + lR.m * .17 * srMR) 
            if pp.x < lR.bx.get_left() and pp.x + srLN > lR.bx.get_left() and b.c < lR.bx.get_bottom()
                na
            else
                if pp.h < lRt.bx.get_bottom() * (1 - lRt.m * .17 * srMR) or pp.h > lRt.bx.get_top() * (1 + lRt.m * .17 * srMR)

                    R.unshift(
                      SnR.new(
                         box.new(pp.x, pp.h, b.i, pp.h * (1 - ((pHST - pLST) / pHST) * .17 * srMR), border_color = color(na), bgcolor = srRZC),
                         box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                         line.new(pp.x, pp.h, b.i, pp.h, color = srRLC, width = srMR <= .5 ? 2 : 3),
                         false, false, false, false, (pHST - pLST) / pHST))

                    lS.t := false
                else
                    lRt.bx.set_right(b.i)
                    lRt.ln.set_x2(b.i)

        else if lR.bx.get_top() != lS.bx.get_top()
            lR.bx.set_right(b.i)
            lR.ln.set_x2(b.i)
    else
        R.unshift(
          SnR.new(
             box.new(pp.x, pp.h, b.i, pp.h * (1 - ((pHST - pLST) / pHST) * .17 * srMR), border_color = color(na), bgcolor = srRZC),
             //box.new(pp.x, pp.h, b.i, pp.h * (1 - ((pHST - pLST) / pHST) * .17 * srMR), border_color = color(na), bgcolor = color.new(color.orange, 89)),
             box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
             line.new(pp.x, pp.h, b.i, pp.h, color = srRLC, width = srMR <= .5 ? 2 : 3),
             false, false, false, false, (pHST - pLST) / pHST))

        lS.t := false

    if swSH != 'None'
        StS = pp.x - pp.x1
        tradedVolume = f_getTradedVolume(StS, srLN)
        swH = pp.h > pp.h1 ? "Higher High" : pp.h < pp.h1 ? "Lower High" : na
        rTT = 'Swing High (' + swH + ') : ' + str.tostring(pp.h, format.mintick) + 
              (mss == -1 and pp.h < pp.h1 ? '\n    *Counter-Trend Move' : '') +
              '\n -Price Change : ↑ %' + str.tostring((pp.h - pp.l) * 100 / pp.l , '#.##') + 
              (nz(b.v) ? '\n -Traded Volume : ' + str.tostring(tradedVolume, format.volume)  + ' (' + str.tostring(StS - 1) + ' bars)' +
              '\n    *Average Volume/Bar : ' + str.tostring(tradedVolume / (StS - 1), format.volume) : '') 
        label.new(pp.x, pp.h, '◈', color = color(na), style = label.style_label_down, textcolor = swHC, size = f_getSize(swSH), tooltip = rTT)

        alert('New ' + swH + (mss == -1 and pp.h < pp.h1 ? ' (counter-trend move)' : '') + ' formed\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

if b.c[1] > pp.h and b.c > pp.h and not pp.hx 
    pp.hx := true
    mss := 1

pp_l  = ta.pivotlow (srLN, srLN)

if not na(pp_l) 
    pp.l1  := pp.l
    pp.l   := pp_l
    pp.x1  := pp.x
    pp.x   := b.i[srLN]
    pp.lx  := false

    if S.size() > 2 
        lS  := S.get(0)
        lSt := S.get(1)

        if pp.l < lS.bx.get_bottom() * (1 - lS.m * .17 * srMR) or pp.l > lS.bx.get_top() * (1 + lS.m * .17 * srMR)
            if pp.x < lS.bx.get_left() and pp.x + srLN > lS.bx.get_left() and b.c > lS.bx.get_top() //not lR.b
                na
            else
                if pp.l < lSt.bx.get_bottom() * (1 - lSt.m * .17 * srMR) or pp.l > lSt.bx.get_top() * (1 + lSt.m * .17 * srMR)

                    S.unshift(
                      SnR.new(
                         box.new(pp.x, pp.l * (1 + ((pHST - pLST) / pHST) * .17 * srMR), b.i, pp.l, border_color = color(na), bgcolor = srSZC),
                         box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                         line.new(pp.x, pp.l, b.i, pp.l, color = srSLC, width = srMR <= .5 ? 2 : 3),
                         false, false, false, false, (pHST - pLST) / pHST))

                    lR.t := false
                else
                    lSt.bx.set_right(b.i)
                    lSt.ln.set_x2(b.i)

        else if lS.bx.get_bottom() != lR.bx.get_bottom()
            lS.bx.set_right(b.i)
            lS.ln.set_x2(b.i)
    else
        S.unshift(
          SnR.new(
             box.new(pp.x, pp.l * (1 + ((pHST - pLST) / pHST) * .17 * srMR), b.i, pp.l, border_color = color(na), bgcolor = srSZC),
             //box.new(pp.x, pp.l * (1 + ((pHST - pLST) / pHST) * .17 * srMR), b.i, pp.l, border_color = color(na), bgcolor = color.new(color.aqua, 89)),
             box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
             line.new(pp.x, pp.l, b.i, pp.l, color = srSLC, width = srMR <= .5 ? 2 : 3),
             false, false, false, false, (pHST - pLST) / pHST))

        lR.t := false

    if swSH != 'None'
        StS = pp.x - pp.x1
        tradedVolume = f_getTradedVolume(StS, srLN)
        swL = pp.l < pp.l1 ? "Lower Low" : pp.l > pp.l1 ? "Higher Low" : na
        sTT = 'Swing Low (' + swL + ') : ' + str.tostring(pp.l, format.mintick) + 
              (mss == 1 and pp.l > pp.l1 ? '\n    *Counter-Trend Move' : '') +
              '\n -Price Change : ↓ %' + str.tostring((pp.h - pp.l) * 100 / pp.h , '#.##') + 
              (nz(b.v) ? '\n -Traded Volume : ' + str.tostring(tradedVolume, format.volume)  + ' (' + str.tostring(StS - 1) + ' bars)' +
              '\n    *Average Volume/Bar : ' + str.tostring(tradedVolume / (StS - 1), format.volume) : '')
        label.new(pp.x, pp.l, '◈', color = color(na), style = label.style_label_up, textcolor = swLC, size = f_getSize(swSH), tooltip = sTT)

        alert('New ' + swL + (mss == 1 and pp.l > pp.l1 ? ' (counter-trend move)' : '') + ' formed\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

if b.c[1] < pp.l and b.c < pp.l and not pp.lx 
    pp.lx := true
    mss := -1

if R.size() > 0
    lR := R.get(0)

    if  srFBO and b.c[1] > lR.bx.get_top() * (1 + lR.m * .17) and not lR.b
        lR.bx.set_right(b.i[1])
        lR.ln.set_x2(b.i[1])
        lR.b := true
        lR.r := false

        label.new(b.i[1], b.l[1] * (1 - lR.m * .017), '▲\n\nB', color = srBUC, style = label.style_label_up , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bullish Breakout' + vST[1])
        //label.new(b.i[1], b.l[1] * (1 - lR.m * .017), '▲\n\nB', color = color.yellow, style = label.style_label_up , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bullish Breakout' + vST[1])

        S.unshift(
          SnR.new(
             box.new(b.i[1], lR.bx.get_top(), b.i + 1, lR.bx.get_bottom(), border_color = color(na), bgcolor = srSZC),
             box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
             line.new(b.i[1], lR.bx.get_bottom(), b.i + 1, lR.bx.get_bottom(), color = srSLC, width = srMR <= .5 ? 2 : 3),
             false, false, false, false, lR.m))
        //R.remove(0)

        if srBS != 'None'
            alert('Bullish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    else if b.c[1] > lR.bx.get_top() and not lR.b and not srFBO
        lR.bx.set_right(b.i[1])
        lR.ln.set_x2(b.i[1])
        lR.b := true
        lR.r := false

        label.new(b.i[1], b.l[1] * (1 - lR.m * .017), '▲\n\nB', color = srBUC, style = label.style_label_up , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bullish Breakout' + vST[1])

        S.unshift(
          SnR.new(
             box.new(b.i[1], lR.bx.get_top(), b.i + 1, lR.bx.get_bottom(), border_color = color(na), bgcolor = srSZC),
             box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
             line.new(b.i[1], lR.bx.get_bottom(), b.i + 1, lR.bx.get_bottom(), color = srSLC, width = srMR <= .5 ? 2 : 3),
             false, false, false, false, lR.m))
        //R.remove(0)

        if srBS != 'None'
            alert('Bullish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    else if lS.b and b.o[1] < lR.bx.get_top() and b.h[1] > lR.bx.get_bottom() and b.c[1] < lR.bx.get_bottom() and not lR.r and b.i[1] != lR.bx.get_left()
        label.new(b.i[1], b.h[1] * (1 + lR.m * .017), 'R', color = srRDC, style = label.style_label_down , textcolor = srRTC, size = f_getSize(srRS), tooltip = 'Re-test of Resistance Zone' + vST[1] )
        lR.r := true //
        lR.bx.set_right(b.i)
        lR.ln.set_x2(b.i)

        if srRS != 'None'
            alert('Re-test of resistance zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    else if b.h[1] > lR.bx.get_bottom() and b.c[1] < lR.bx.get_top() and b.c < lR.bx.get_top() and not lR.t and not lR.r and not lR.b and not lS.b and b.i[1] != lR.bx.get_left()
        label.new(b.i[1], b.h[1] * (1 + lR.m * .017), 'T', color = srTDC, style = label.style_label_down , textcolor = srTTC, size = f_getSize(srTS), tooltip = 'Test of Resistance Zone' + vST[1] )
        lR.t := true
        lR.bx.set_right(b.i)
        lR.ln.set_x2(b.i)

        if srTS != 'None'
            alert('Test of resistance zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period, alert.freq_once_per_bar_close)

    else if b.h > lR.bx.get_bottom() * (1 - lR.m * .17) and not lR.b //and lR.bx.get_top() != lS.bx.get_top()
        if b.h > lR.bx.get_bottom()
            lR.bx.set_right(b.i)
        lR.ln.set_x2(b.i)

    if isLLS[1] and isHV[1] and srPS != 'None'
        label.new(b.i[1], b.l[1] * (1 - lR.m * .017), '', color = srPUC, style = label.style_label_up , textcolor = color.white, size = f_getSize(srPS), tooltip = 'Rejection of Lower Prices' + vST[1])
        alert('Rejection of lower prices detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    if mnSH
        if b.h > lR.bx.get_top() and b.c <= lR.bx.get_top() * (1 + lR.m * .17 * mnMR) and not lR.l and b.i == lR.bx.get_right()
            if lR.lq.get_right() + srLN > b.i
                lR.lq.set_right(b.i + 1)
                lR.lq.set_top(math.min(math.max(b.h, lR.lq.get_top()), lR.bx.get_top() * (1 + lR.m * .17 * mnMR)))
            else
                lR.lq.set_lefttop(b.i[1], math.min(b.h, lR.bx.get_top() * (1 + lR.m * .17 * mnMR)))
                lR.lq.set_rightbottom(b.i + 1, lR.bx.get_top())
                lR.lq.set_bgcolor(mnRZC)

            lR.l := true

        else if b.h > lR.bx.get_top() and b.c <= lR.bx.get_top() * (1 + lR.m * .17 * mnMR) and lR.l and b.i == lR.bx.get_right()
            lR.lq.set_right(b.i + 1)
            lR.lq.set_top(math.min(math.max(b.h,lR.lq.get_top()), lR.bx.get_top() * (1 + lR.m * .17 * mnMR)))
        else if lR.l and (b.c >= lR.bx.get_top() * (1 + lR.m * .17 * mnMR) or b.c < lR.bx.get_bottom())
            lR.l := false

if R.size() > 1 and srHST //and (lR.b or lS.b)// and lR.bx.get_top() != lS.bx.get_top()
    lRt := R.get(1)

    if lR.bx.get_top() != lRt.bx.get_top()

        if  srFBO and b.c[1] > lRt.bx.get_top() * (1 + lRt.m * .17) and not lRt.b
            lRt.bx.set_right(b.i[1])
            lRt.ln.set_x2(b.i[1])
            lRt.b := true
            lRt.r := false

            label.new(b.i[1], b.l[1] * (1 - lRt.m * .017), '▲\n\nB', color = srBUC, style = label.style_label_up , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bullish Breakout' + vST[1])

            S.unshift(
              SnR.new(
                 box.new(b.i[1], lRt.bx.get_top(), b.i + 1, lRt.bx.get_bottom(), border_color = color(na), bgcolor = srSZC),
                 box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                 line.new(b.i[1], lRt.bx.get_bottom(), b.i + 1, lRt.bx.get_bottom(), color = srSLC, width = srMR <= .5 ? 2 : 3),
                 false, false, false, false, lRt.m))
            //R.remove(1)

            if srBS != 'None'
                alert('Bullish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

        else if b.c[1] > lRt.bx.get_top() and not lRt.b and not srFBO
            lRt.bx.set_right(b.i[1])
            lRt.ln.set_x2(b.i[1])
            lRt.b := true
            lRt.r := false

            label.new(b.i[1], b.l[1] * (1 - lRt.m * .017), '▲\n\nB', color = srBUC, style = label.style_label_up , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bullish Breakout' + vST[1])

            S.unshift(
              SnR.new(
                 box.new(b.i[1], lRt.bx.get_top(), b.i + 1, lRt.bx.get_bottom(), border_color = color(na), bgcolor = srSZC),
                 box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                 line.new(b.i[1], lRt.bx.get_bottom(), b.i + 1, lRt.bx.get_bottom(), color = srSLC, width = srMR <= .5 ? 2 : 3),
                 false, false, false, false, lRt.m))
            //R.remove(1)

            if srBS != 'None'
                alert('Bullish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

        else if lSt.b and b.o[1] < lRt.bx.get_top() and b.h[1] > lRt.bx.get_bottom() and b.c[1] < lRt.bx.get_bottom() and not lRt.r and b.i[1] != lRt.bx.get_left()
            label.new(b.i[1], b.h[1] * (1 + lRt.m * .017), 'R', color = srRDC, style = label.style_label_down , textcolor = srRTC, size = f_getSize(srRS), tooltip = 'Re-test of Resistance Zone' + vST[1] )
            lRt.r := true //
            lRt.bx.set_right(b.i)
            lRt.ln.set_x2(b.i)

            if srRS != 'None'
                alert('Re-test of resistance zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

        else if b.h[1] > lRt.bx.get_bottom() and b.c[1] < lRt.bx.get_top() and b.c < lRt.bx.get_top() and not lRt.t and not lRt.b and not lSt.b and b.i[1] != lRt.bx.get_left()
            label.new(b.i[1], b.h[1] * (1 + lRt.m * .017), 'T', color = srTDC, style = label.style_label_down , textcolor = srTTC, size = f_getSize(srTS), tooltip = 'Test of Resistance Zone' + vST[1] )
            lRt.t := true
            lRt.bx.set_right(b.i)
            lRt.ln.set_x2(b.i)

            if srTS != 'None'
                alert('Test of resistance zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period, alert.freq_once_per_bar_close)

        else if b.h > lRt.bx.get_bottom() * (1 - lRt.m * .17) and not lRt.b
            if b.h > lRt.bx.get_bottom()
                lRt.bx.set_right(b.i)
            lRt.ln.set_x2(b.i)

        if mnSH
            if b.h > lRt.bx.get_top() and b.c <= lRt.bx.get_top() * (1 + lRt.m * .17 * mnMR) and not lRt.l and b.i == lRt.bx.get_right()
                if lRt.lq.get_right() + srLN > b.i
                    lRt.lq.set_right(b.i + 1)
                    lRt.lq.set_top(math.min(math.max(b.h, lRt.lq.get_top()), lRt.bx.get_top() * (1 + lRt.m * .17 * mnMR)))
                else
                    lRt.lq.set_lefttop(b.i[1], math.min(b.h, lRt.bx.get_top() * (1 + lRt.m * .17 * mnMR)))
                    lRt.lq.set_rightbottom(b.i + 1, lRt.bx.get_top())
                    lRt.lq.set_bgcolor(mnRZC)
    
                lRt.l := true
    
            else if b.h > lRt.bx.get_top() and b.c <= lRt.bx.get_top() * (1 + lRt.m * .17 * mnMR) and lRt.l and b.i == lRt.bx.get_right()
                lRt.lq.set_right(b.i + 1)
                lRt.lq.set_top(math.min(math.max(b.h, lRt.lq.get_top()), lRt.bx.get_top() * (1 + lRt.m * .17 * mnMR)))
            else if lRt.l and (b.c >= lRt.bx.get_top() * (1 + lRt.m * .17 * mnMR) or b.c < lRt.bx.get_bottom())
                lRt.l := false

if S.size() > 1
    lS := S.get(0)

    if  srFBO and b.c[1] < lS.bx.get_bottom() * (1 - lS.m * .17) and not lS.b
        lS.bx.set_right(b.i[1])
        lS.ln.set_x2(b.i[1])
        lS.b := true
        lS.r := false

        label.new(b.i[1], b.h[1] * (1 + lS.m * .017), 'B\n\n▼', color = srBDC, style = label.style_label_down , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bearish Breakout' + vST[1] )
        //label.new(b.i[1], b.h[1] * (1 + lS.m * .017), 'B\n\n▼', color = color.yellow, style = label.style_label_down , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bearish Breakout' + vST[1] )

        R.unshift(
          SnR.new(
             box.new(b.i[1], lS.bx.get_top(), b.i + 1, lS.bx.get_bottom(), border_color = color(na), bgcolor = srRZC),
             box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
             line.new(b.i[1], lS.bx.get_top(), b.i + 1, lS.bx.get_top(), color = srRLC, width = srMR <= .5 ? 2 : 3),
             false, false, false, false, lS.m))
        //S.remove(0)

        if srBS != 'None'
            alert('Bearish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    if  b.c[1] < lS.bx.get_bottom() and not lS.b and not srFBO
        lS.bx.set_right(b.i[1])
        lS.ln.set_x2(b.i[1])
        lS.b := true
        lS.r := false

        label.new(b.i[1], b.h[1] * (1 + lS.m * .017), 'B\n\n▼', color = srBDC, style = label.style_label_down , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bearish Breakout' + vST[1] )

        R.unshift(
          SnR.new(
             box.new(b.i[1], lS.bx.get_top(), b.i + 1, lS.bx.get_bottom(), border_color = color(na), bgcolor = srRZC),
             box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
             line.new(b.i[1], lS.bx.get_top(), b.i + 1, lS.bx.get_top(), color = srRLC, width = srMR <= .5 ? 2 : 3),
             false, false, false, false, lS.m))
        //S.remove(0)

        if srBS != 'None'
            alert('Bearish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    else if lR.b and b.o[1] > lS.bx.get_bottom() and b.l[1] < lS.bx.get_top() and b.c[1] > lS.bx.get_top() and not lS.r and b.i[1] != lS.bx.get_left()
        label.new(b.i[1], b.l[1] * (1 - lS.m * .017), 'R', color = srRUC, style = label.style_label_up , textcolor = srRTC, size = f_getSize(srRS), tooltip = 'Re-test of Support Zone' + vST[1] )
        lS.r := true //
        lS.bx.set_right(b.i)
        lS.ln.set_x2(b.i)

        if srRS != 'None'
            alert('Re-test of support zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    else if b.l[1] < lS.bx.get_top() and b.c[1] > lS.bx.get_bottom() and b.c > lS.bx.get_bottom() and not lS.t and not lS.b and not lR.b and b.i[1] != lS.bx.get_left()
        label.new(b.i[1], b.l[1] * (1 - lS.m * .017), 'T', color = srTUC, style = label.style_label_up , textcolor = srTTC, size = f_getSize(srTS), tooltip = 'Test of Support Zone' + vST[1] )
        lS.t := true
        lS.bx.set_right(b.i)
        lS.ln.set_x2(b.i)

        if srTS != 'None'
            alert('Test of support zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period, alert.freq_once_per_bar_close)

    else if b.l < lS.bx.get_top() * (1 + lS.m * .17) and not lS.b //and lS.bx.get_bottom() != lR.bx.get_bottom()
        if b.l < lS.bx.get_top()
            lS.bx.set_right(b.i)
        lS.ln.set_x2(b.i)

    if isLUS[1] and isHV[1] and srPS != 'None'
        label.new(b.i[1], b.h[1] * (1 + lS.m * .017), '', color = srPDC, style = label.style_label_down , textcolor = color.white, size = f_getSize(srPS), tooltip = 'Rejection of Higher Prices' + vST[1] )
        alert('Rejection of higher prices detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

    if mnSH
        if b.l < lS.bx.get_bottom() and b.c >= lS.bx.get_bottom() * (1 - lS.m * .17 * mnMR) and not lS.l and b.i == lS.bx.get_right()
            if lS.lq.get_right() + srLN > b.i
                lS.lq.set_right(b.i + 1)
                lS.lq.set_bottom(math.max(math.min(b.l, lS.lq.get_bottom()), lS.bx.get_bottom() * (1 - lS.m * .17 * mnMR)))
            else
                lS.lq.set_lefttop(b.i[1], lS.bx.get_bottom())
                lS.lq.set_rightbottom(b.i + 1, math.max(b.l, lS.bx.get_bottom() * (1 - lS.m * .17 * mnMR)))
                lS.lq.set_bgcolor(mnSZC)

            lS.l := true

        else if b.l < lS.bx.get_bottom() and b.c >= lS.bx.get_bottom() * (1 - lS.m * .17 * mnMR) and lS.l and b.i == lS.bx.get_right()
            lS.lq.set_right(b.i + 1)
            lS.lq.set_bottom(math.max(math.min(b.l, lS.lq.get_bottom()), lS.bx.get_bottom() * (1 - lS.m * .17 * mnMR)))
        else if lS.l and (b.c <= lS.bx.get_bottom() * (1 - lS.m * .17 * mnMR) or b.c > lS.bx.get_top())
            lS.l := false

if S.size() > 2 and srHST //and (lR.b or lS.b)// and lS.bx.get_bottom() != lR.bx.get_bottom() 
    lSt := S.get(1)

    if lS.bx.get_bottom() != lSt.bx.get_bottom()

        if  srFBO and b.c[1] < lSt.bx.get_bottom() * (1 - lSt.m * .17) and not lSt.b //and b.i[1] != lR.bx.get_left()
            lSt.bx.set_right(b.i[1])
            lSt.ln.set_x2(b.i[1])
            lSt.b := true
            lSt.r := false

            label.new(b.i[1], b.h[1] * (1 + lSt.m * .017), 'B\n\n▼', color = srBDC, style = label.style_label_down , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bearish Breakout' + vST[1] )

            R.unshift(
              SnR.new(
                 box.new(b.i[1], lSt.bx.get_top(), b.i + 1, lSt.bx.get_bottom(), border_color = color(na), bgcolor = srRZC),
                 box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                 line.new(b.i[1], lSt.bx.get_top(), b.i + 1, lSt.bx.get_top(), color = srRLC, width = srMR <= .5 ? 2 : 3),
                 false, false, false, false, lSt.m))
            //S.remove(1)

            if srBS != 'None'
                alert('Bearish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

        else if b.c[1] < lSt.bx.get_bottom() and not lSt.b and not srFBO //and b.i[1] != lR.bx.get_left()
            lSt.bx.set_right(b.i[1])
            lSt.ln.set_x2(b.i[1])
            lSt.b := true
            lSt.r := false

            label.new(b.i[1], b.h[1] * (1 + lSt.m * .017), 'B\n\n▼', color = srBDC, style = label.style_label_down , textcolor = srBTC, size = f_getSize(srBS), tooltip = 'Bearish Breakout' + vST[1] )

            R.unshift(
              SnR.new(
                 box.new(b.i[1], lSt.bx.get_top(), b.i + 1, lSt.bx.get_bottom(), border_color = color(na), bgcolor = srRZC),
                 box.new(na, na, na, na, bgcolor = color(na), border_color = color(na)),
                 line.new(b.i[1], lSt.bx.get_top(), b.i + 1, lSt.bx.get_top(), color = srRLC, width = srMR <= .5 ? 2 : 3),
                 false, false, false, false, lSt.m))
            //S.remove(1)

            if srBS != 'None'
                alert('Bearish breakout detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

        else if lRt.b and b.o[1] > lSt.bx.get_bottom() and b.l[1] < lSt.bx.get_top() and b.c[1] > lSt.bx.get_top() and not lSt.r and b.i[1] != lSt.bx.get_left() //and lSt.bx.get_top() != lS.bx.get_top() //DGT
            label.new(b.i[1], b.l[1] * (1 - lSt.m * .017), 'R', color = srRUC, style = label.style_label_up , textcolor = srRTC, size = f_getSize(srRS), tooltip = 'Re-test of Support Zone' + vST[1] )
            lSt.r := true
            lSt.bx.set_right(b.i)
            lSt.ln.set_x2(b.i)

            if srRS != 'None'
                alert('Re-test of support zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period)

        else if b.l[1] < lSt.bx.get_top() and b.c[1] > lSt.bx.get_bottom() and b.c > lSt.bx.get_bottom() and not lSt.t and not lSt.b and not lRt.b and b.i[1] != lSt.bx.get_left()
            label.new(b.i[1], b.l[1] * (1 - lSt.m * .017), 'T', color = srTUC, style = label.style_label_up , textcolor = srTTC, size = f_getSize(srTS), tooltip = 'Test of Support Zone' + vST[1] )
            lSt.t := true
            lSt.bx.set_right(b.i)
            lSt.ln.set_x2(b.i)

            if srTS != 'None'
                alert('Test of support zone detected\n' + syminfo.ticker + ' price (' + str.tostring(b.c, format.mintick) + '), timeframe ' + timeframe.period, alert.freq_once_per_bar_close)

        else if b.l < lSt.bx.get_top() * (1 + lSt.m * .17) and not lSt.b
            if b.l < lSt.bx.get_top()
                lSt.bx.set_right(b.i)
            lSt.ln.set_x2(b.i)

        if mnSH
            if b.l < lSt.bx.get_bottom() and b.c >= lSt.bx.get_bottom() * (1 - lSt.m * .17 * mnMR) and not lSt.l and b.i == lSt.bx.get_right()
                if lSt.lq.get_right() + srLN > b.i
                    lSt.lq.set_right(b.i + 1)
                    lSt.lq.set_bottom(math.max(math.min(b.l, lSt.lq.get_bottom()), lSt.bx.get_bottom() * (1 - lSt.m * .17 * mnMR)))
                else
                    lSt.lq.set_lefttop(b.i[1], lSt.bx.get_bottom())
                    lSt.lq.set_rightbottom(b.i + 1, math.max(b.l, lSt.bx.get_bottom() * (1 - lSt.m * .17 * mnMR)))
                    lSt.lq.set_bgcolor(mnSZC)

                lSt.l := true

            else if b.l < lSt.bx.get_bottom() and b.c >= lSt.bx.get_bottom() * (1 - lSt.m * .17 * mnMR) and lSt.l and b.i == lSt.bx.get_right()
                lSt.lq.set_right(b.i + 1)
                lSt.lq.set_bottom(math.max(math.min(b.l, lSt.lq.get_bottom()), lSt.bx.get_bottom() * (1 - lSt.m * .17 * mnMR)))
            else if lSt.l and (b.c <= lSt.bx.get_bottom() * (1 - lS.m * .17 * mnMR) or b.c > lSt.bx.get_top())
                lSt.l := false

//-----------------------------------------------------------------------------}