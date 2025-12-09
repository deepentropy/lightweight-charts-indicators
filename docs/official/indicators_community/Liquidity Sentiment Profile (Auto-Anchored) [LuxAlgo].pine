// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator("Liquidity Sentiment Profile (Auto-Anchored) [LuxAlgo]", "LuxAlgo - Liquidity Sentiment Profile (Auto-Anchored)", true, max_bars_back = 5000, max_boxes_count = 500, max_lines_count = 500)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

rpGR  = 'Liquidity Sentiment Profile'
tfTP  = 'The indicator resolution is set by the input of the Anchor Period. If the Anchor Period is set to AUTO, then the increased resolution is determined by the following algorithm:\n\n' +
          ' - for intraday resolutions up to 4 Hour, DAY (1D) is used\n - for intraday resolutions equal to 4 Hour, WEEK (1W) is used\n - for daily resolutions MONTH is used (1M)\n - for weekly resolution, 3-MONTH (3M) is used\n - for monthly resolution, 12-MONTH (12M) is used\n\n' +
          'If the Anchor Period is set to Fixed Range then the period is defined in the \'Fixed Period\' option\n\n' +
          'If the Anchor Period is set to Swing High or Swing Low then the length required to calculate Swing Levels is defined in the \'Swing Detection Length\' option\n\n' +
          'Note : Difference between Session and Day\n - Day will take into account extended hours (if present on the chart), whereas\n - Session will assume only regular trading hours. Session is default value for AUTO Anchor Period'
tfIN  = input.string('Fixed Range', 'Anchor Period', options=['Auto', 'Fixed Range', 'Swing High', 'Swing Low', 'Session', 'Day', 'Week', 'Month', 'Quarter', 'Year'], group = rpGR, tooltip = tfTP)
tfOT  = tfIN == 'Session' or tfIN == 'Day' ? 'D' : tfIN == 'Week' ? 'W' : tfIN == 'Month' ? 'M' : tfIN == 'Quarter' ? '3M' : tfIN == 'Year' ? '12M' : timeframe.isintraday and timeframe.period != '240' ? 'D' : timeframe.period == '240' ? 'W' : timeframe.isdaily ? 'M' : timeframe.isweekly ? '3M' : '12M'

drpTT = 'Applicable if the Anchor Period is set to \'Fixed Range\' then the period of the profile is defined with this option\n\npossible min value [10]'
drpLN = input.int(360, 'Fixed Period', minval = 10, group = rpGR, tooltip = drpTT)

ppTT  = 'Applicable if the Anchor Period is set to \'Swing High\' or \'Swing Low\' then the length required to detect the Swing Levels is defined with this option\n\npossible min value [1]'
ppLen = input.int(47, "Swing Detection Length", minval = 1, group = rpGR, tooltip = ppTT)

lpGR  = 'Liquidity Profile'
vpTP  = 'In trading, liquidity refers to the availability of orders at specific price points in the market, allowing transactions to occur smoothly, and the profile displays total trading activity (common interest, both buying and selling trading activity) over a specified time period at specific price levels\n\n' +
          ' - high volume node rows : high trading activity price levels - usually represents consolidation levels (value areas)\n' +
          ' - average volume node rows : average trading activity price levels\n' +
          ' - low volume node rows : low trading activity price levels - usually represents supply & demand levels or liquidity levels\n\n' +
          'row lengths, indicates the amount of the traded activity' 
vpSH  = input.bool(true, 'Liquidity Profile', group = lpGR, tooltip = vpTP)
vpHVC = input.color(color.new(#ff9800, 11), 'High Traded Nodes', inline='VP1', group = lpGR)
vpHVT = input.int(53, 'Threshold %' , minval = 47, maxval = 99 , step = 1,inline='VP1', group = lpGR, tooltip = 'possible values [47-99]') / 100
vpAVC = input.color(color.new(#5d606b, 51), 'Average Traded Nodes', inline='VP3' , group = lpGR)
vpLVC = input.color(color.new(#2962ff, 11), 'Low Traded Nodes ', inline='VP2', group = lpGR)
vpLVT = input.int(27, 'Threshold %' , minval = 10, maxval = 47 , step = 1,inline='VP2', group = lpGR, tooltip = 'possible values [10-47]') / 100

spGR  = 'Sentiment Profile'
spTP  = 'displays the sentiment, the dominat party over a specified time period at the specific price levels\n\n' +
          ' - bullish node rows : buying trading activity is higher\n'  +
          ' - barish node rows : selling trading activity is higher\n\n' +
          'row lengths, indicates the strength of the buyers/sellers at the specific price levels' 
spSH  = input.bool(true, 'Sentiment Profile', group = spGR, tooltip = spTP)
spBLC = input.color(color.new(#26a69a, 73), 'Bullish Nodes', inline='SP', group = spGR)
spBRC = input.color(color.new(#ef5350, 73), 'Bearish Nodes', inline='SP', group = spGR)

sdGR  = 'Buyside & Sellside Liquidity Zones'
sdTP  = 'Typically refer to the resting orders in the market, such as limit orders, stop loss orders, and stop limit orders, which can be absorbed or targeted by banks or financial institutions. Those levels are also reffered as supply & demand levels in the market'
sdSH  = input.bool(true, 'Buyside & Sellside Liquidity Zones', group = sdGR, tooltip = sdTP)
sdTH  = input.int(13, 'Threshold %' , minval = 0, maxval = 31, group = sdGR, tooltip = 'possible threshold values [0-31]\n\nhigher values return wider areas') / 100
sdCR  = input.color(color.new(#0094FF, 81), 'Buyside Liquidity Nodes', inline='low2', group = sdGR)
sdCS  = input.color(color.new(#ec1313, 81), 'Sellside Liquidity Nodes', inline='low2', group = sdGR)

othGR = 'Other Settings'
pcTP  = 'displays the changes of the price levels with the highest traded activity'
rpPC  = input.bool(false, 'Level of Significance', inline='PoC', group = othGR, tooltip = pcTP)
rpPCC = input.color(color.new(#ff0000, 1), '', inline='PoC', group = othGR)
rpPCW = input.int(2, '', inline='PoC', group = othGR)

rpPL  = input.bool(false, 'Price Levels, Color', inline='BBe', group = othGR)
rpPLC = input.color(color.new(#00bcd4, 1), '', inline='BBe', group = othGR)
rpLS  = input.string('Small', "Size", options=['Tiny', 'Small', 'Normal'], inline='BBe', group = othGR)
rpS   = switch rpLS
    'Tiny'   => size.tiny
    'Small'  => size.small
    'Normal' => size.normal

rpNR  = input.int(123, 'Number of Rows' , minval = 10, maxval = 155 ,step = 5, group = othGR, tooltip = 'possible values [10-155]')
rpW   = input.int(27, 'Profile Width %', minval = 10, maxval = 50, group = othGR, tooltip = 'possible values [10-50]') / 100
drpHO = input.int(13, 'Horizontal Offset', minval = 0, maxval = 100 ,group = othGR, tooltip = 'plotting by default will be performed on rightmost, where\nhorizontal offset option is for further adjustments\npossible values [0-100]')

rpBG  = input.bool(true, 'Range Background Fill', inline ='BG', group = othGR)
rpBGC = input.color(color.new(#00bcd4, 95), '', inline ='BG', group = othGR)

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
// @field h     (float)  last pivot high
// @field h1    (float)  previous pivot high
// @field l     (float)  last pivot low
// @field l1    (float)  previous pivot low

type pivotPoint
    int    x
    float  h
    float  h1
    float  l
    float  l1

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()

var pivotPoint pp = pivotPoint.new()

bull  = b.c > b.o
nzV   = nz(b.v)

rpVST = array.new_float(rpNR + 1, 0.)
rpVSB = array.new_float(rpNR + 1, 0.)
rpVSD = array.new_float(rpNR + 1, 0.)

var dRP = array.new_box()
var dPC = array.new_line()

var int   x2   = 0
var float pir  = na
var int   pp_x = na
var float pp_y = na

//-----------------------------------------------------------------------------}
// Functions/methods
//-----------------------------------------------------------------------------{

// @function        creates new label object and updates existing label objects 
//                     
// @param           details in Pine Script™ language reference manual
//
// @returns         none, updated visual objects (labels)

f_drawLabelX(_x, _y, _text, _xloc, _yloc, _color, _style, _textcolor, _size, _textalign, _tooltip) =>
    var lb = label.new(_x, _y, _text, _xloc, _yloc, _color, _style, _textcolor, _size, _textalign, _tooltip)
    lb.set_xy(_x, _y)
    lb.set_text(_text)
    lb.set_tooltip(_tooltip)
    lb.set_textcolor(_textcolor)

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{

pp_h = ta.pivothigh(ppLen, ppLen)
pp_l = ta.pivotlow (ppLen, ppLen)

if not na(pp_h) and tfIN == 'Swing High'
    pp.h1 := pp.h
    pp.h  := pp_h
    pp_y  := pp_h
    pp_x  := b.i

if not na(pp_l) and tfIN == 'Swing Low'
    pp.l1 := pp.l
    pp.l  := pp_l
    pp_y  := pp_l
    pp_x  := b.i

if tfOT == 'D' and tfIN == 'Day' ? dayofweek != dayofweek[1] : ta.change(time(tfOT))
    x2 := b.i

rpLN = tfIN == 'Fixed Range' ? drpLN : barstate.islast ? tfIN == 'Swing High' or tfIN == 'Swing Low' ? last_bar_index - pp_x + ppLen : last_bar_index - x2 : 1
pHST = ta.highest(high, rpLN > 0 ? rpLN + 1 : 1)
pLST = ta.lowest (low , rpLN > 0 ? rpLN + 1 : 1)
pSTP = (pHST - pLST) / rpNR

if barstate.islast and nzV and timeframe.period != tfOT and rpLN > 1 and pSTP > 0 //and not timeframe.isseconds

    if dRP.size() > 0
        for i = 0 to dRP.size() - 1
            box.delete(dRP.shift())

    if dPC.size() > 0
        for i = 0 to dPC.size() - 1
            line.delete(dPC.shift())

    for bI = rpLN to 0
        l = 0
        for pLL = pLST to pHST by pSTP
            if b.h[bI] >= pLL and b.l[bI] < pLL + pSTP
                rpVST.set(l, rpVST.get(l) + nzV[bI] * ((b.h[bI] - b.l[bI]) == 0 ? 1 : pSTP / (b.h[bI] - b.l[bI])) )
                
                if bull[bI]
                    rpVSB.set(l, rpVSB.get(l) + nzV[bI] * ((b.h[bI] - b.l[bI]) == 0 ? 1 : pSTP / (b.h[bI] - b.l[bI])) )
            l += 1

        if rpPC
            if bI == rpLN 
                pir := pLST + (rpVST.indexof(rpVST.max()) + .50) * pSTP
            else
                dPC.push(line.new(b.i[bI] - 1, pir, b.i[bI], pLST + (rpVST.indexof(rpVST.max()) + .50) * pSTP, color = rpPCC, width = rpPCW))
                pir := pLST + (rpVST.indexof(rpVST.max()) + .50) * pSTP

    for l = 0 to rpNR - 1
        bbp  = 2 * rpVSB.get(l) - rpVST.get(l)
        rpVSD.set(l, rpVSD.get(l) + bbp * (bbp > 0 ? 1 : -1) )

    if rpBG
        dRP.push(box.new(b.i - rpLN, pLST, b.i, pHST, rpBGC, bgcolor = rpBGC ))

    if rpPL
        f_drawLabelX(b.i + drpHO + rpLN * rpW, pHST, str.tostring(pHST, format.mintick), xloc.bar_index, yloc.price, color(na), label.style_label_down, rpPLC, rpS, text.align_left, 'Profile High - ' + str.tostring(pHST, format.mintick) + '\n %' + str.tostring((pHST - pLST) / pLST * 100, '#.##') + ' higher than the Profile Low\n\nNumber of bars : ' + str.tostring(rpLN))
        f_drawLabelX(b.i + drpHO + rpLN * rpW, pLST, str.tostring(pLST, format.mintick), xloc.bar_index, yloc.price, color(na), label.style_label_up  , rpPLC, rpS, text.align_left, 'Profile Low - '  + str.tostring(pLST, format.mintick) + '\n %' + str.tostring((pHST - pLST) / pHST * 100, '#.##') + ' lower than the Profile High\n\nNumber of bars : ' + str.tostring(rpLN))

        if tfIN == 'Swing High'
            swH = pp.h > pp.h1 ? "HH" : pp.h < pp.h1 ? "LH" : na
            f_drawLabelX(b.i[rpLN], pp.h, swH, xloc.bar_index, yloc.price, color(na), label.style_label_down, rpPLC, rpS, text.align_center, 'Swing High : ' + str.tostring(pp.h, format.mintick))
        
        if tfIN == 'Swing Low'
            swL = pp.l < pp.l1 ? "LL" : pp.l > pp.l1 ? "HL" : na
            f_drawLabelX(b.i[rpLN], pp.l ,swL, xloc.bar_index, yloc.price, color(na), label.style_label_up  , rpPLC, rpS, text.align_center, 'Swing Low : '  + str.tostring(pp.l, format.mintick))

    for l = 0 to rpNR - 1
        if vpSH
            sBI = b.i - int(rpVST.get(l) / rpVST.max() * rpLN * rpW) + rpLN * rpW + drpHO
            eBI = b.i + drpHO + rpLN * rpW
            llC = rpVST.get(l) / rpVST.max() > vpHVT ? color.from_gradient(rpVST.get(l) / rpVST.max(), vpHVT, 1, vpAVC, vpHVC) : color.from_gradient(rpVST.get(l) / rpVST.max(), 0, vpLVT, vpLVC, vpAVC)
            dRP.push(box.new(sBI, pLST + (l + 0.1) * pSTP, eBI, pLST + (l + 0.9) * pSTP, color(na), bgcolor = llC ))

            //sBI := b.i - int( (rpVST.get(l) - rpVSB.get(l))/ rpVST.max() * rpLN * rpW) + rpLN * rpW + drpHO
            //dRP.push(box.new(sBI, pLST + (l + 0.1) * pSTP, eBI, pLST + (l + 0.9) * pSTP, color(na), bgcolor = llC ))

        if spSH
            bbp = 2 * rpVSB.get(l) - rpVST.get(l)
            sBI = b.i + int( rpVSD.get(l) / rpVSD.max() * rpLN * rpW / 2) + rpLN * rpW + drpHO
            eBI = b.i + drpHO + rpLN * rpW
            dRP.push(box.new(sBI, pLST + (l + 0.1) * pSTP, eBI, pLST + (l + 0.9) * pSTP, bbp > 0 ? spBLC : spBRC, bgcolor = bbp > 0 ? spBLC : spBRC ))

        if sdSH and rpVST.get(l) / rpVST.max() < sdTH
            dRP.push(box.new(b.i - rpLN, pLST + (l + 0.) * pSTP, b.i, pLST + (l + 1.) * pSTP, color(na), bgcolor = pLST + (l + .5) * pSTP > pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP ? sdCR : sdCS))

     //-----------------------------------------------------------------------------}