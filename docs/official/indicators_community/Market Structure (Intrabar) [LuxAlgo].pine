// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator('Market Structure (Intrabar) [LuxAlgo]', 'LuxAlgo - Market Structure (Intrabar)', true, max_lines_count = 500, max_labels_count = 500)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

liGR  = 'Inside the Bar Market Structure'

liTT  = 'If intrabar timeframe is set to \'Auto\', then the lower timeframe is determined by the following algorithm:\n' +
          '  Chart Timeframe Lower Timeframe\n'  + 
          '    <= 3 min      1 Sec\n'  + 
          '    <= 15 min     5 Sec\n'  + 
          '    <= 30 min     10 Sec\n' + 
          '    <= 1 hour     15 Sec\n' + 
          '    <= 2 hour      30 Sec\n'  + 
          '    <= 4 hour      1 min\n'  + 
          '    <= 1 day      5 min\n' + 
          '    <= 1 week     1 hour\n'  + 
          '    <= 1 month     4 hour\n'  + 
          '    >   1 month     1 Day\n\n' +
         'Tip: the higher the chart resolutions the higher the intrabar historical depth\n\n' +
         'LIMITATIONS\nPlease note that seconds-based intervals are available for premium and professional plan holders, which implies that the seconds-based intervals usage of the indicator may not be available for all users depending on their subscription plan.'

lcTF  = input.timeframe('Auto', "Intrabar Timeframe", options=['Auto', '1S', '5S', '10S', '15S', '30S', '1m', '3m', '5m', '15m', '30m', '45m', '1H', '2H', '3H', '4H', 'D'], group = liGR, tooltip = liTT)
lcMS  = input.bool(true, 'Intrabar Market Structure, Length', inline = 'MS', group = liGR)
pLN   = input.int(5, '', minval = 3, inline = 'MS', group = liGR, tooltip = 'possible minimum value = 3')

lcPP  = input.bool(true, 'Intrabar Swing Levels, ', inline = 'SW', group = liGR)
swHC  = input(color.new(#089981, 13), 'Highs', inline = 'SW', group = liGR)
swLC  = input(color.new(#f23645, 13), 'Lows', inline = 'SW', group = liGR)

liS2  = 'Show Dashboard and Remove Intrabar Visuals'
liST  = input.string('Show Dashboard', 'Intrabar Statistics', options = ['Show Dashboard', liS2, 'None'], group = liGR)

otGR  = 'General'
lcUC  = input(color.new(#089981, 13), "Market Structure Colors : Bullish", inline = 'CL', group = otGR)
lcDC  = input(color.new(#f23645, 13), "Bearish", inline = 'CL', group = otGR)

lcGC  = input(color.new(#089981, 13), "Intrabar Candle Colors : Bullish", inline = 'COL', group = otGR)
lcRC  = input(color.new(#f23645, 13), "Bearish", inline = 'COL', group = otGR)

lcHO  = input.int(13, 'Intrabar Candles Horizontal Offset', minval = 3, group = otGR, tooltip = 'possible minimum value = 3')

lcDB  = input.string('Top Right', 'Dashboard    ', options = ['Top Right', 'Bottom Right', 'Bottom Left'], inline = 'ST', group = otGR)
lcDS = input.string('Small', '', options = ['Tiny', 'Small', 'Normal'], inline = 'ST', group = otGR)

//-----------------------------------------------------------------------------}
// General Calculations
//-----------------------------------------------------------------------------{

tPOS = lcDB == 'Bottom Left' ? position.bottom_left 
     : lcDB == 'Top Right' ? position.top_right 
     : position.bottom_right

tSZ =  lcDS == 'Tiny' ? size.tiny 
     : lcDS == 'Small' ? size.small 
     : size.normal

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

// @field lc    (float) close price of the intrabar
// @field lc1   (float) previous close price of the intrabar

type bar
    float o = open
    float h = high
    float l = low
    float c = close
    float v = volume
    int   i = bar_index

    float lc
    float lc1

// @type        store pivot high/low data 
//
// @field s     (int)    market structure status

// @field h     (float)  last pivot high
// @field h1    (float)  previous pivot high
// @field hx    (bool)   last pivot high cross staus
// @field ht    (int)    last pivot high bar index

// @field l     (float)  last pivot low
// @field l1    (float)  previous pivot low
// @field lx    (bool)   last pivot low cross staus
// @field lt    (int)    last pivot low bar index

type pivotPoint
    int    s = 0
    
    float  h
    float  h1
    bool   hx
    int    ht

    float  l
    float  l1
    bool   lx
    int    lt

// @type         store Statistics
//
// @field uB     (int)     bullish BoS count
// @field uC     (int)     bullish CHoCH count
// @field dB     (int)     bearish BoS count
// @field dC     (int)     bearish CHoCH count
// @field l      (string)  last market structure status
// @field t      (int)     last market structure index

type count 
    int    uB = 0
    int    uC = 0
    int    dB = 0
    int    dC = 0
    string l = 'none'
    int    t

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()
count c = count.new()
var pivotPoint pp = pivotPoint.new()

//-----------------------------------------------------------------------------}
// Functions/Methods
//-----------------------------------------------------------------------------{

// @function   This function returns timeframe period
//
// @param _t   [string] timeframe custom sting 
//
// @returns    [string] formatted timeframe period

f_gTF(_t) =>
    str.contains(_t, 'S') or str.contains(_t, 'D') or str.contains(_t, 'W') or str.contains(_t, 'M') ? _t :
     str.contains(_t, 'm') ? str.replace(_t, 'm', '', 0) :
     str.contains(_t, 'H') ? str.tostring(str.tonumber(str.replace(_t, 'H', '', 0)) * 60) :
     '12M'

// @function   This function returns timeframe period
//
// @returns    [string] formatted timeframe period

f_gTF() => 
    int tfInMs = timeframe.in_seconds(timeframe.period)
    int mInMS = 60
    switch
        tfInMs <=         3 * mInMS  =>  '1S'
        tfInMs <=        15 * mInMS  =>  '5S'
        tfInMs <=        30 * mInMS  => '10S'
        tfInMs <=        60 * mInMS  => '15S'
        tfInMs <=       120 * mInMS  => '30S'
        tfInMs <=       240 * mInMS  =>   '1'
        tfInMs <=      1440 * mInMS  =>   '5'
        tfInMs <=  7 * 1440 * mInMS  =>  '60'
        tfInMs <= 31 * 1440 * mInMS  => '240'
        => 'D'

// @function     This function returns price of the pivot high/low point. It returns 'NaN', if there was no pivot high/low point
//
// @param _l     [int]  Left/right strength
//
// @returns      [float, float] pivot high/low price values

f_gPP(_l) =>
    ph = ta.pivothigh(_l, _l)
    pl = ta.pivotlow (_l, _l)

    [not na(ph) ? ph : na, not na(pl) ? pl : na]

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{

ltf = lcTF == 'Auto' ? f_gTF() : f_gTF(lcTF)

[aPH, aPL]       = request.security_lower_tf(syminfo.tickerid, ltf, f_gPP(pLN))
[aO, aH, aL, aC] = request.security_lower_tf(syminfo.tickerid, ltf, [b.o, b.h, b.l, b.c])

if timeframe.change(timeframe.period)

    aLN = line.all
    if aLN.size() > 0
        for i = 0 to aLN.size() - 1
            line.delete(aLN.get(i))
    
    aLB = label.all
    if aLB.size() > 0
        for i = 0 to aLB.size() - 1
            label.delete(aLB.get(i))

if barstate.islast and array.size(aH) > 0

    for i = 0 to aH.size() - 1

        cBI = b.i + lcHO + i
        b.lc1 := b.lc
        b.lc  := aC.get(i)

        if liST != liS2
            lcC = aO.get(i) > aC.get(i) ? lcRC : lcGC
            line.new(cBI, aO.get(i), cBI, aC.get(i), xloc.bar_index, extend.none, lcC, line.style_solid, 3)
            line.new(cBI, aH.get(i), cBI, aL.get(i), xloc.bar_index, extend.none, lcC, line.style_solid, 1)
        
        if not na(aPH.get(i))
            pp.h1 := pp.h
            pp.h  := aPH.get(i)
            pp.ht := cBI - pLN
            pp.hx := false
            
            if lcPP
                if liST != liS2
                    swH = pp.h > pp.h1 ? "Higher High : " : pp.h < pp.h1 ? "Lower High : " : na
                    label.new(cBI - pLN, aPH.get(i), '◈', xloc.bar_index, yloc.price, color(na), label.style_label_down, swHC, size.tiny, text.align_left, swH + str.tostring(aPH.get(i), format.mintick))
   
        if not na(aPL.get(i))
            pp.l1 := pp.l
            pp.l  := aPL.get(i)
            pp.lt := cBI - pLN
            pp.lx := false
            
            if lcPP
                if liST != liS2
                    swL = pp.l < pp.l1 ? "Lower Low : " : pp.l > pp.l1 ? "Higher Low : " : na
                    label.new(cBI - pLN, aPL.get(i), '◈', xloc.bar_index, yloc.price, color(na), label.style_label_up, swLC, size.tiny, text.align_left, swL + str.tostring(aPL.get(i), format.mintick))

        if lcMS
            if b.lc1 > pp.h and not pp.hx
                pp.hx  := true

                if liST != liS2
                    line.new(pp.ht, pp.h, cBI - 1, pp.h, color = lcUC, style = pp.s == -1 ? line.style_solid : line.style_dotted, width = 1)
                    label.new(int(math.avg(pp.ht, cBI - 1)), pp.h, pp.s == -1 ? 'CHoCH' : 'BoS', xloc.bar_index, yloc.price, color(na), label.style_label_down, lcUC, size.tiny, text.align_left, pp.s == -1 ? 'Change of Character' : 'Break of Structure')
            
                if pp.s == -1
                    c.uC += 1
                    c.l := 'bullish change of character'
                else
                    c.uB += 1
                    c.l := 'bullish break of structure'

                pp.s := 1
                c.t  := aH.size() - i

            if b.lc1 < pp.l and not pp.lx
                pp.lx  := true

                if liST != liS2
                    line.new(pp.lt, pp.l, cBI - 1, pp.l, color = lcDC, style = pp.s == 1 ? line.style_solid : line.style_dotted, width = 1)
                    label.new(int(math.avg(pp.lt, cBI - 1)), pp.l, pp.s == 1 ? 'CHoCH' : 'BoS', xloc.bar_index, yloc.price, color(na), label.style_label_up, lcDC, size.tiny, text.align_left, pp.s == 1 ? 'Change of Character' : 'Break of Structure')
                        
                if pp.s == 1
                    c.dC += 1
                    c.l := 'bearish change of character'
                else
                    c.dB += 1
                    c.l := 'bearish break of structure'

                pp.s := -1
                c.t  := aH.size() - i

    if liST != 'None'
        tb = table.new(tPOS, 3, 6, bgcolor = #1e222d, border_color = #373a46, border_width = 1, frame_color = #373a46, frame_width = 1)
        table.cell(tb, 0, 0, 'Intrabar Market Stucture\nStatistics', text_size = tSZ , text_color = color.white,
         tooltip = 'chart timeframe : ' + timeframe.period + '\nintrabar timeframe : ' + ltf )
        table.merge_cells(tb, 0, 0, 2, 0)
    
        if lcMS
            table.cell(tb, 0, 1,  str.contains(c.l, 'bearish') ? '▼' : str.contains(c.l, 'bullish') ?  '▲' : '█', 
             text_size = tSZ , text_color = str.contains(c.l, 'bearish') ?  color.red : str.contains(c.l, 'bullish') ?  color.teal : color.gray,
             tooltip = 'last detected intrabar market stucture\n -' + c.l + (str.contains(c.l, 'none') ? '' : '\n -detected ' + str.tostring(c.t) + ' intrabar(s) earlier'))
            table.cell(tb, 1, 1, 'BoS', text_color = color.white, text_halign = text.align_center, text_size = tSZ)
            table.cell(tb, 2, 1, 'CHoCH', text_color = color.white, text_halign = text.align_center, text_size = tSZ)

            table.cell(tb, 0, 2, 'Bullish', text_color = color.white, text_halign = text.align_left, text_size = tSZ)
            table.cell(tb, 1, 2, str.tostring(c.uB), text_color = color.white, text_halign = text.align_center, text_size = tSZ)
            table.cell(tb, 2, 2, str.tostring(c.uC), text_color = color.white, text_halign = text.align_center, text_size = tSZ)

            table.cell(tb, 0, 3, 'Bearish', text_color = color.white, text_halign = text.align_left, text_size = tSZ)
            table.cell(tb, 1, 3, str.tostring(c.dB), text_color = color.white, text_halign = text.align_center, text_size = tSZ)
            table.cell(tb, 2, 3, str.tostring(c.dC), text_color = color.white, text_halign = text.align_center, text_size = tSZ)

        table.cell(tb, 0, 4, 'Intrabar\nCandles', text_color = color.white, text_halign = text.align_left, text_size = tSZ)
        table.merge_cells(tb, 0, 4, 0, 5)
        table.cell(tb, 1, 4, 'Formed', text_color = color.white, text_halign = text.align_center, text_size = tSZ)
        table.cell(tb, 2, 4, 'Total', text_color = color.white, text_halign = text.align_center, text_size = tSZ)

        table.cell(tb, 1, 5, str.tostring(aO.size()), text_color = color.white, text_halign = text.align_center, text_size = tSZ)
        table.cell(tb, 2, 5, str.tostring(timeframe.in_seconds(timeframe.period)/timeframe.in_seconds(ltf), '#'), text_color = color.white, text_halign = text.align_center, text_size = tSZ)

//-----------------------------------------------------------------------------}