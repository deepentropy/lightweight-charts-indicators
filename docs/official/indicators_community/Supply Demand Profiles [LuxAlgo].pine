// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator("Supply Demand Profiles [LuxAlgo]", "LuxAlgo - Supply Demand Profiles", true, max_bars_back = 5000, max_boxes_count = 500, max_lines_count = 500)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

clGR   = 'Calculation Settings'
pVDST  = 'This charting tool allows usage of different volume data sources and different polarity options'
vdT1   = 'Volume - Bar Polarity'
vdT2   = 'Volume - Bar Buying/Selling Pressure'
vdT7   = 'Volume - Heikin Ashi Bar Polarity'
vdT3   = 'Volume - Intrabar Polarity (LTF)'
vdT4   = 'Volume - Intrabar Buying/Selling Pressure (LTF)'
vdT5   = 'Volume Delta - Intrabar Polarity (LTF)' 
vdT6   = 'Volume Delta - Intrabar Buying/Selling Pressure (LTF)' 

pVDS   = input.string(vdT1, 'Volume Data Source', options = [vdT1, vdT2, vdT7, vdT3, vdT4, vdT5, vdT6], group = clGR, tooltip = pVDST)
tfTP   = 'This option is applicable when any of the \'Intrabar (LTF)\' option is selected and if so then this opton sets the indicator Precision. ' + 
          'If the Lower Timeframe Precision is set to AUTO, then the Lower Timeframe is determined by the following algorithm:\n\n' +
          ' - Chart Timeframe,  Lower Timeframe\n'  + 
          '       <= 1 min                1 Sec\n'  + 
          '       <= 2 min                5 Sec\n'  + 
          '       <= 3 min                10 Sec\n' + 
          '       <= 5 min                15 Sec\n' + 
          '       <= 15 min              30 Sec\n'  + 
          '       <= 1 hour               1 min\n'  + 
          '       <= 2 hour               3 min\n'  + 
          '       <= 4 hour               5 min\n'  + 
          '       <= 1 day                15 min\n' + 
          '       <= 1 week              1 hour\n'  + 
          '       >   1 week              1 day'
vdLT   = input.string('Auto', 'Lower Timeframe Precision', 
          options=['Auto', '1 Sec', '5 Sec', '10 Sec', '15 Sec', '30 Sec', '1 Min', '3 Min', '5 Min', '15 Min', '30 Min', '1 Hour', '4 Hour', '1 Day'], 
          group = clGR, tooltip = tfTP)
isVA   = input.float(68, "Value Area Volume %", minval = 0, maxval = 100, group = clGR) / 100

prGR   = 'Presentation Settings'
sdTT   = 'Defines the relationship between the price of a given asset and the willingness of traders to either buy or sell it'
sdSH   = input.bool(true, 'Supply & Demand Zones', group = prGR, tooltip = sdTT)
vpTT   = 'Volume profile displays total trading activity (both buying and selling activity) over a specified time period at specific price levels'
vpSH   = input.bool(true, 'Volume Profile', group = prGR, tooltip = vpTT)
spTT   = 'Sentiment profile displays the dominat party at the specific price levels\n' +
           ' - orange rows : selling pressure is higher\n' +
           ' - green rows : buying pressure is higher\n\n' +
           'narrow rows does not mean no interest at that price levels but equlibrium between selling and buying trading activity' 
spSH   = input.bool(true, 'Sentiment Profile', group = prGR, tooltip = spTT)

vspGR  = 'Presentation, Others'
vaHTT  = 'Value Area High (VAH)\n the highest price level within the value area'
vaHL   = input.bool(true, 'Value Area High (VAH)', inline = 'VAH', group = vspGR, tooltip = vaHTT)
vaHC   = input.color(color.new(#2962ff, 0), '', inline = 'VAH', group = vspGR)
pocTT  = 'Point of Control (POC)\n  displays developing POC, the changes of the price levels with the highest traded activity'
pocL   = input.bool(true, 'Point of Control (POC)', inline = 'PoC', group = vspGR, tooltip = pocTT)
pocC   = input.color(color.new(#ff0000, 0), '', inline = 'PoC', group = vspGR)
vaLTT  = 'Value Area Low (VAL)\n  the lowest price level within the value area'
vaLL   = input.bool(true, 'Value Area Low (VAL) ', inline = 'VAL', group = vspGR, tooltip = vaLTT)
vaLC   = input.color(color.new(#2962ff, 0), '', inline = 'VAL', group = vspGR)

sdOT   = 'Supply & Demand, Others'
sdTH   = input.int(15, 'Supply & Demand Threshold %', minval = 0, maxval = 41, group = sdOT) / 100
sdSC   = input.color(color.new(#2157f3, 50), 'Supply Zones', inline = 'SD', group = sdOT)
sdDC   = input.color(color.new(#ff5d00, 50), 'Demand Zones', inline = 'SD', group = sdOT)

vpGR   = 'Volume Profile, Others'
vpUVC  = input.color(color.new(#2962ff, 75), 'Profile,    Up Volume', inline = 'ZZ2', group = vpGR)
vpDVC  = input.color(color.new(#fbc02d, 75), 'Down Volume', inline = 'ZZ2' , group = vpGR)
vaUVC  = input.color(color.new(#2962ff, 25), 'Value Area, Up Volume', inline = 'ZZ1', group = vpGR)
vaDVC  = input.color(color.new(#fbc02d, 25), 'Down Volume', inline = 'ZZ1' , group = vpGR)

spGR   = 'Sentiment Profile, Others'
vsUVC  = input.color(color.new(#089981, 75), 'Sentiment,  Bullish', inline = 'BB', group = spGR)
vsDVC  = input.color(color.new(#ff5d00, 75), 'Bearish', inline = 'BB', group = spGR)
spUVC  = input.color(color.new(#089981, 25), 'Value Area, Bullish', inline = 'BB1', group = spGR)
spDVC  = input.color(color.new(#ff5d00, 25), 'Bearish', inline = 'BB1', group = spGR)

othGR  = 'Others'
pLVL   = input.int(100, 'Number of Rows', minval = 10, maxval = 150, step = 5, group = othGR)
pPLC   = input.string('Left', 'Placment', options = ['Right', 'Left'], group = othGR)
pWDH   = input.int(30, 'Profile Width %', minval = 0, maxval = 100, group = othGR) / 100
pLB    = input.bool(true, 'Profile Price Levels', group = othGR)
pBG    = input.bool(false, 'Profile Background   ', inline = 'BG', group = othGR)
pBGC   = input.color(color.new(#37a6ef, 95), '', inline = 'BG', group = othGR)
vaBG   = input.bool(true, 'Value Area Background', inline ='vBG', group = othGR)
vaBGC  = input.color(color.new(#37a6ef, 95), '', inline ='vBG', group = othGR)
pSCT   = input.time(timestamp("23 Jul 2023"), "Start Calculation", confirm = true, inline = 'wa1', group = othGR)
pECT   = input.time(timestamp("21 Aug 2023"), "End Calculation " , confirm = true, inline = 'wa2', group = othGR)

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

// @type        maintain volume profile data 
//
// @field vsT    (array<float>) array maintains tolal traded volume
// @field vsB    (array<float>) array maintains bullish traded volume
// @field vsD    (array<float>) array maintains delta traded volume
// @field vp     (array<box>)   array maintains visual object of each price level
// @field pc     (array<box>)   array maintains visual object of poc

type VP
    float [] vsT
    float [] vsB
    float [] vsD
    box   [] vp
    line  [] pc

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()

VP aVP  = VP.new(
                 array.new <float> (pLVL + 1, 0.), 
                 array.new <float> (pLVL + 1, 0.), 
                 array.new <float> (pLVL + 1, 0.), 
                 array.new <box> (na), 
                 array.new <line> (na)
 )

nzV   = nz(b.v)

mInMS = 60 * 1000

var laP = 0
var lbP = 0

//-----------------------------------------------------------------------------}
// Functions / Methods
//-----------------------------------------------------------------------------{

// @function     Calculates the volume of up and down bars
//
// @returns      [float, float] the volume of up bars, and the volume of down bars

f_calcV() =>
    uV = 0., dV = 0.
    switch
        (pVDS == vdT4 or pVDS == vdT6) and (b.c - b.l) > (b.h - b.c) => uV += nzV
        (pVDS == vdT4 or pVDS == vdT6) and (b.c - b.l) < (b.h - b.c) => dV -= nzV
        (pVDS == vdT3 or pVDS == vdT5) and b.c > b.o => uV += nzV
        (pVDS == vdT3 or pVDS == vdT5) and b.c < b.o => dV -= nzV
        b.c > nz(b.c[1]) => uV += nzV
        b.c < nz(b.c[1]) => dV -= nzV
        nz(uV[1]) > 0 => uV += nzV
        nz(dV[1]) < 0 => dV -= nzV
    
    [uV, dV]

// @function     Calculates the Lower Timeframe based on the Input or Chart Resolution
//
// @param _tf    chart Timeframe string
//
// @returns      [string] Lower Timeframe string

f_calcLTF(_tf) =>
    int tfInMs = timeframe.in_seconds() * 1000
    switch _tf
        'Auto'   =>  tfInMs <=        1 * mInMS  ? '1S'  : 
                     tfInMs <=        2 * mInMS  ? '5S' : 
                     tfInMs <=        3 * mInMS  ? '10S' : 
                     tfInMs <=        5 * mInMS  ? '15S' : 
                     tfInMs <=       15 * mInMS  ? '30S' : 
                     tfInMs <=       60 * mInMS  ? '1' : 
                     tfInMs <=      120 * mInMS  ? '3' : 
                     tfInMs <=      240 * mInMS  ? '5' : 
                     tfInMs <=     1440 * mInMS  ? '15' : 
                     tfInMs <= 7 * 1440 * mInMS  ? '60' : 'D'
        '1 Sec'  => '1S'
        '5 Sec'  => '5S'
        '10 Sec' => '10S'
        '15 Sec' => '15S'
        '30 Sec' => '30S'
        '1 Min'  => '1'
        '3 Min'  => '3'
        '5 Min'  => '5'
        '15 Min' => '15'
        '30 Min' => '30'
        '1 Hour' => '60'
        '4 Hour' => '240'
        '1 Day'  => '1D'

// @function        creates new line object, updates existing line objects 
//                     
// @param           details in Pine Script™ language reference manual
//
// @returns         id of the line

f_drawLineX(_x1, _y1, _x2, _y2, _xloc, _extend, _color, _style, _width) =>
    var id = line.new(_x1, _y1, _x2, _y2, _xloc, _extend, _color, _style, _width)
    line.set_xy1(id, _x1, _y1)
    line.set_xy2(id, _x2, _y2)
    line.set_color(id, _color)
    id

// @function        creates new label object, updates existing label objects 
//                     
// @param           details in Pine Script™ language reference manual
//
// @returns         none

f_drawLabelX(_x, _y, _text, _xloc, _yloc, _color, _style, _textcolor, _size, _textalign, _tooltip) =>
    var id = label.new(_x, _y, _text, _xloc, _yloc, _color, _style, _textcolor, _size, _textalign, _tooltip)
    label.set_xy(id, _x, _y)
    label.set_text(id, _text)
    label.set_tooltip(id, _tooltip)

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{

sBX = ta.valuewhen(time == pSCT, b.i, 0)
eBX = ta.valuewhen(time == pECT, b.i, 0)

[sB, eB] = if sBX < eBX
    [sBX, eBX]
else
    [eBX, sBX]

pLN  = eB - sB
pHST = ta.highest(high, pLN > 0 ? pLN + 1 : 200)
pLST = ta.lowest (low , pLN > 0 ? pLN + 1 : 200)
pSTP = (pHST - pLST) / pLVL

[uV, dV] = request.security_lower_tf(syminfo.tickerid, f_calcLTF(vdLT), f_calcV())
tuV  = uV.sum()
tdV  = dV.sum()
vd   = tuV + tdV
tV   = tuV - tdV

haP  = request.security(ticker.heikinashi(syminfo.tickerid), timeframe.period, close > open)

nzV := pVDS == vdT1 or pVDS == vdT2 or pVDS == vdT7 ? nzV : pVDS == vdT3 or pVDS == vdT4 ? tV : math.abs(vd)
bCON = pVDS == vdT3 or pVDS == vdT4 or pVDS == vdT5 or pVDS == vdT6 ? tuV > math.abs(tdV) : pVDS == vdT2 ? (b.c - b.l) > (b.h - b.c) : pVDS == vdT7 ? haP : b.c > b.o

var pir = 0.
if (b.i == eB) and nzV and (pLN > 0)

    for bI = pLN to 0
        l = 0
        for pL = pLST to pHST by pSTP
            if b.h[bI] >= pL and b.l[bI] < pL + pSTP
                aVP.vsT.set(l, aVP.vsT.get(l) + nzV[bI] * ((b.h[bI] - b.l[bI]) == 0 ? 1 : pSTP / (b.h[bI] - b.l[bI])))

                if bCON[bI]
                    aVP.vsB.set(l, aVP.vsB.get(l) + nzV[bI] * ((b.h[bI] - b.l[bI]) == 0 ? 1 : pSTP / (b.h[bI] - b.l[bI])))
            l += 1

        if pocL
            if bI == pLN
                pir := pLST + (aVP.vsT.indexof(aVP.vsT.max()) + .50) * pSTP
            else
                aVP.pc.push(line.new(b.i[bI] - 1, pir, b.i[bI], pLST + (aVP.vsT.indexof(aVP.vsT.max()) + .50) * pSTP, color = pocC, width = 2))
                pir := pLST + (aVP.vsT.indexof(aVP.vsT.max()) + .50) * pSTP

    for l = 0 to pLVL - 1
        bbp = 2 * aVP.vsB.get(l) - aVP.vsT.get(l)
        aVP.vsD.set(l, aVP.vsD.get(l) + bbp * (bbp > 0 ? 1 : -1) )

    pcL  = aVP.vsT.indexof(aVP.vsT.max())
    ttV  = aVP.vsT.sum() * isVA
    va   = aVP.vsT.get(pcL)
    laP := pcL
    lbP := pcL
    
    while va < ttV
        if lbP == 0 and laP == pLVL - 1
            break

        vaP = 0.
        if laP < pLVL - 1 
            vaP := aVP.vsT.get(laP + 1)

        vbP = 0.
        if lbP > 0
            vbP := aVP.vsT.get(lbP - 1)
        
        if vaP >= vbP
            va  += vaP
            laP += 1
        else
            va  += vbP
            lbP -= 1

    vah = f_drawLineX(b.i - pLN, pLST + (laP + 1.00) * pSTP, b.i, pLST + (laP + 1.00) * pSTP, xloc.bar_index, extend.none, vaHL ? vaHC : color(na), line.style_solid, 2)
    //f_drawLineX(b.i - pLN, pLST + (pcL + 0.50) * pSTP, b.i, pLST + (pcL + 0.50) * pSTP, xloc.bar_index, extend.none, pocL ? pocC : color(na), line.style_solid, 2)
    val = f_drawLineX(b.i - pLN, pLST + (lbP + 0.00) * pSTP, b.i, pLST + (lbP + 0.00) * pSTP, xloc.bar_index, extend.none, vaLL ? vaLC : color(na), line.style_solid, 2)

    if pLB
        f_drawLabelX((pPLC == 'Right' ? math.min(sBX, eBX) : math.max(sBX, eBX)), pHST, str.tostring(pHST, format.mintick), 
                      xloc.bar_index, yloc.price, color.new(chart.fg_color, 89), label.style_label_down, chart.fg_color, size.normal, text.align_left, 
                      'Profile High\n %' + str.tostring((pHST - pLST) / pLST * 100, '#.##') + ' higher than the Profile Low\n number of bars ' + str.tostring(pLN))
        f_drawLabelX((pPLC == 'Right' ? math.min(sBX, eBX) : math.max(sBX, eBX)), pLST, str.tostring(pLST, format.mintick), 
                      xloc.bar_index, yloc.price, color.new(chart.fg_color, 89), label.style_label_up  , chart.fg_color, size.normal, text.align_left, 
                      'Profile Low\n %'  + str.tostring((pHST - pLST) / pHST * 100, '#.##') + ' lower than the Profile High\n number of bars ' + str.tostring(pLN))
        f_drawLabelX((pPLC == 'Right' ? math.min(sBX, eBX) : math.max(sBX, eBX)), pLST + (laP + 1.) * pSTP, str.tostring(pLST + (laP + 1.) * pSTP, format.mintick), 
                      xloc.bar_index, yloc.price, color.new(chart.fg_color, 89), (pPLC == 'Right' ? label.style_label_right : label.style_label_left), chart.fg_color, 
                      size.normal, text.align_left, 'Value Area High Price')
        f_drawLabelX((pPLC == 'Right' ? math.min(sBX, eBX) : math.max(sBX, eBX)), pLST + (pcL + .5) * pSTP, str.tostring(pLST + (pcL + .5) * pSTP, format.mintick), 
                      xloc.bar_index, yloc.price, color.new(chart.fg_color, 89), (pPLC == 'Right' ? label.style_label_right : label.style_label_left), chart.fg_color, 
                      size.normal, text.align_left, 'Point Of Control Price')
        f_drawLabelX((pPLC == 'Right' ? math.min(sBX, eBX) : math.max(sBX, eBX)), pLST + (lbP + .0) * pSTP, str.tostring(pLST + (lbP + .0) * pSTP, format.mintick), 
                      xloc.bar_index, yloc.price, color.new(chart.fg_color, 89), (pPLC == 'Right' ? label.style_label_right : label.style_label_left), chart.fg_color, 
                      size.normal, text.align_left, 'Value Area Low Price')

    if vaBG
        linefill.new(vah, val, vaBGC)

    if pBG
        aVP.vp.push(box.new(b.i - pLN, pLST, b.i, pHST, pBGC, 1, line.style_dotted, bgcolor = pBGC))

    for l = 0 to pLVL - 1
        if vpSH
            sBI = pPLC == 'Right' ? b.i - int(aVP.vsB.get(l) / aVP.vsT.max() * pLN * pWDH) : b.i - pLN
            eBI = pPLC == 'Right' ? b.i : sBI + int( aVP.vsB.get(l) / aVP.vsT.max() * pLN * pWDH)
            aVP.vp.push(box.new(sBI, pLST + (l + 0.9) * pSTP, eBI, pLST + (l + 0.1) * pSTP, l >= lbP and l <= laP ? vaUVC : vpUVC, bgcolor = l >= lbP and l <= laP ? vaUVC : vpUVC))
            
            sBI := pPLC == 'Right' ? sBI : eBI 
            eBI := sBI + (pPLC == 'Right' ? -1 : 1) * int( (aVP.vsT.get(l) - aVP.vsB.get(l) )/ aVP.vsT.max() * pLN * pWDH)
            aVP.vp.push(box.new(sBI, pLST + (l + 0.9) * pSTP, eBI, pLST + (l + 0.1) * pSTP, l >= lbP and l <= laP ? vaDVC : vpDVC, bgcolor = l >= lbP and l <= laP ? vaDVC : vpDVC))

        if spSH
            bbp = 2 * aVP.vsB.get(l) - aVP.vsT.get(l)
            sBI = pPLC == 'Right' ? b.i + int( aVP.vsD.get(l) / aVP.vsD.max() * pLN * pWDH / 2) : b.i - pLN
            eBI = pPLC == 'Right' ? b.i : sBI - int(aVP.vsD.get(l) / aVP.vsD.max() * pLN * pWDH / 2)
            spC = bbp > 0 ? l >= lbP and l <= laP ? spUVC : vsUVC : l >= lbP and l <= laP ? spDVC : vsDVC
            aVP.vp.push(box.new(sBI, pLST + (l + 0.9) * pSTP, eBI, pLST + (l + 0.1) * pSTP, spC, bgcolor = spC))

        if sdSH and aVP.vsT.get(l) / aVP.vsT.max() < sdTH
            sdC = pLST + (l + 0.50) * pSTP > pLST + (pcL + .5) * pSTP ? sdSC : sdDC
            aVP.vp.push(box.new(eB - pLN, pLST + (l + 1.00) * pSTP, eB, pLST + (l + 0.00) * pSTP, color(na), bgcolor = sdC))
            
 //-----------------------------------------------------------------------------}