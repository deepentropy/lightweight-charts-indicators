// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator("Money Flow Profile [LuxAlgo]", "LuxAlgo - Money Flow Profile", true, max_bars_back = 1500, max_boxes_count = 500, max_lines_count = 500)

//---------------------------------------------------------------------------------------------------------------------}
// Settings
//---------------------------------------------------------------------------------------------------------------------{

disp   = display.all - display.status_line

rpGR   = 'Profile Generic Settings'
rpLN   = input.int(200, '  Lookback Length / Fixed Range', minval = 10, maxval = 1500, step = 10 , group = rpGR, display = disp)
rpLN  := last_bar_index > rpLN ? rpLN - 1 : last_bar_index
vpSRC  = input.string('Volume', '  Profile Source', options = ['Volume', 'Money Flow'], group = rpGR, display = disp)

vpGR   = 'Profile Presentation Settings'
vpTP   = 'displays total trading activity/money flow (common interest, both buying and selling trading activity/money flow) over a specified time period at specific price levels\n\n' +
          ' - high traded node rows : high trading activity/money flow price levels - usually represents consolidation levels (value areas)\n' +
          ' - average traded node rows : average trading activity/money flow price levels\n' +
          ' - low traded node rows : low trading activity/money flow price levels - usually represents supply & demand levels or liquidity levels\n\n' +
          'row lengths, indicates the amount of the traded activity/money flow at specific price levels' 
vpSH   = input.bool(true, 'Volume/Money Flow Profile', group = vpGR, tooltip = vpTP, display = disp)

vpHVC  = input.color(color.new(#ffeb3b, 50), '  High Traded Nodes', inline = 'VP1', group = vpGR)
vpHVT  = input.int(53, 'Threshold %' , minval = 50, maxval = 99 , step = 1,inline = 'VP1', group = vpGR, tooltip = 'option range [50-99]', display = disp) / 100
vpAVC  = input.color(color.new(#2962ff, 50), '  Average Traded Nodes', group = vpGR)
vpLVC  = input.color(color.new(#f23645, 50), '  Low Traded Nodes', inline = 'VP2', group = vpGR)
vpLVT  = input.int(37, 'Threshold %' , minval = 10, maxval = 40 , step = 1,inline = 'VP2', group = vpGR, tooltip = 'option range [10-40]', display = disp) / 100

spTP   = 'displays the sentiment, the dominat party over a specified time period at the specific price levels\n\n' +
          ' - bullish node rows : buying trading activity/money flow is higher\n'  +
          ' - barish node rows : selling trading activity/money flow is higher\n\n' +
          'row lengths, indicates the strength of the buyers/sellers at the specific price levels' 
spSH   = input.bool(true, 'Sentiment Profile', group = vpGR, tooltip = spTP)

spPTT  = 'conditions used to calculate the up/down volume/money flow\n\n' +
         '* bar polarity\n   up => if close > open\n   down => if close <= open\n\n' +
         '* bar buying/selling pressure\n   up => if (close - low) > (high - close)\n   down => if (close - low) <= (high - close)'
spPT1  = 'Bar Polarity'
spPT2  = 'Bar Buying/Selling Pressure'
spPTY  = input.string(spPT1, '  Sentiment Polarity Method', options = [spPT1, spPT2], group = vpGR, tooltip = spPTT, display = disp)

spBLC  = input.color(color.new(#26a69a, 50), '  Bullish Nodes', inline = 'SP', group = vpGR)
spBRC  = input.color(color.new(#ef5350, 50), 'Bearish Nodes', inline = 'SP', group = vpGR)

hmSH   = input.bool(false, 'Profile Heatmap', group = vpGR, tooltip = 'tip : higher number of rows results with a better visuals')
hmSO1  = 'Volume/Money Flow Profile'
hmSRC  = input.string(hmSO1, '  Heatmap Source', options = [hmSO1, 'Sentiment Profile'], group = vpGR, display = disp)
hmTR   = input.int(73, '  Heatmap Transparency' , minval = 0, maxval = 100 , group = vpGR, display = disp)

othGR  = 'Other Presentation Settings'

pcTP   = 'displays the price level of the highest traded activity/money flow or the changes of the price levels with the highest traded activity/money flow'
rpPC   = input.string('Last(Zone)', '  Level of Significance', options = ['Developing', 'Last(Line)', 'Last(Zone)', 'None'], inline='PoC', group = othGR, tooltip = pcTP, display = disp)

vaSH   = input.bool(false, 'Consolidation Zones', group = othGR, display = disp)
vaTH   = input.int(25, '  Consolidation Threshold %' , minval = 0, maxval = 100, inline = 'va', group = othGR, display = disp) / 100
vaC    = input.color(color.new(#2962ff, 73), '', inline = 'va', group = othGR)

spTT   = 'displays the price zone of the highest bullish or bearish sentiment zone'
spPC   = input.bool(false, 'Highest Sentiment Zone', inline = 'spP', group = othGR, tooltip = spTT)

rpPL   = input.bool(false, 'Profile Price Levels', inline = 'BBe', group = othGR)
rpPLC  = input.color(color.new(#00bcd4, 0), '', inline = 'BBe', group = othGR)
rpLS   = input.string('Small', "", options=['Tiny', 'Small', 'Normal'], inline = 'BBe', group = othGR, display = disp)

rpBG   = input.bool(false, 'Profile Range Background Fill', inline = 'BG', group = othGR)
rpBGC  = input.color(color.new(#00bcd4, 95), '', inline = 'BG', group = othGR)

otGR   = 'Other Profile Settings'

rpNR   = input.int(25, '  Number of Rows' , minval = 10, maxval = 100 ,step = 5, group = otGR, tooltip = 'option range [10-100]', display = disp)
rpW    = input.int(13, '  Profile Width %', minval = 10, maxval = 50, group = otGR, tooltip = 'option range [10-50]', display = disp) / 100
vpLS   = input.string('Auto', "  Profile Text Size", options=['Auto', 'Tiny', 'Small'], group = otGR, display = disp)
vpHO   = input.int(13, '  Profile Horizontal Offset', group = otGR, tooltip = 'option allows negative numbers as well, in case of a use the profiles will overlap with the price chart', display = disp)

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{

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

//---------------------------------------------------------------------------------------------------------------------}
// Variables
//---------------------------------------------------------------------------------------------------------------------{

bar b = bar.new()

rpVST = array.new_float(rpNR, 0.)
rpVSB = array.new_float(rpNR, 0.)
rpVSD = array.new_float(rpNR, 0.)

var dRP = array.new_box()
var pocPoints = array.new<chart.point>()  
var polyline pocPolyline = na
var polyline spPolyline = na

var color llC = na
var color lsC = na

//---------------------------------------------------------------------------------------------------------------------}
// Functions/Methods
//---------------------------------------------------------------------------------------------------------------------{

// @function        creates new label object and updates existing label objects 
//                     
// @param           details in Pine Script™ language reference manual
//
// @returns         none, updated visual objects (labels)

f_drawLabelX(_x, _y, _text, _style, _textcolor, _size, _tooltip) =>
    var lb = label.new(_x, _y, _text, xloc.bar_index, yloc.price, color(na), _style, _textcolor, _size, text.align_left, _tooltip)
    lb.set_xy(_x, _y)
    lb.set_text(_text)
    lb.set_tooltip(_tooltip)
    lb.set_textcolor(_textcolor)

// @function    This function converts string to enumerated size
//
// @param _t    [string]    custom string 
//
// @returns     [string]    enumerated size

f_gTS(_t) =>
    switch _t
        'Tiny'   => size.tiny
        'Small'  => size.small 
        'Normal' => size.normal
        'Auto'   => size.auto

//---------------------------------------------------------------------------------------------------------------------}
// Calculations
//---------------------------------------------------------------------------------------------------------------------{

bull = spPTY == spPT1 ? b.c > b.o : (b.c - b.l) > (b.h - b.c)
nzV  = nz(b.v)
rpS  = f_gTS(rpLS)
vpS  = f_gTS(vpLS)

var float pLST = na
var float pHST = na

if b.i == last_bar_index - rpLN
    pLST := b.l 
    pHST := b.h
else if b.i > last_bar_index - rpLN
    pLST := math.min(b.l, pLST)
    pHST := math.max(b.h, pHST)

pSTP = (pHST - pLST) / rpNR

if barstate.islast and not na(nzV) and not timeframe.isseconds and rpLN > 0 and pSTP > 0 and nzV > 0

    if dRP.size() > 0
        for i = 0 to dRP.size() - 1
            box.delete(dRP.shift())

    if pocPoints.size() > 0
        pocPoints.clear()
    
    a_allPolylines = polyline.all
    if array.size(a_allPolylines) > 0
        for i = 0 to array.size(a_allPolylines) - 1
            polyline.delete(a_allPolylines.get(i))

    for bI = rpLN to 0
        l = 0
        for pLL = pLST to pHST - pSTP by pSTP
            if b.h[bI] >= pLL and b.l[bI] < pLL + pSTP

                vPOR = if b.l[bI] >= pLL and b.h[bI] > pLL + pSTP
                    (pLL + pSTP - b.l[bI]) / (b.h[bI] - b.l[bI])
                else if b.h[bI] <= pLL + pSTP and b.l[bI] < pLL
                    (b.h[bI] - pLL) / (b.h[bI] - b.l[bI])
                else if (b.l[bI] >= pLL and b.h[bI] <= pLL + pSTP)
                    1
                else
                    pSTP / (b.h[bI] - b.l[bI])

                if vpSRC == 'Money Flow'
                    rpVST.set(l, rpVST.get(l) + nzV[bI] * vPOR * (pLST + (l + .5) * pSTP) )
                else
                    rpVST.set(l, rpVST.get(l) + nzV[bI] * vPOR )

                if bull[bI] and spSH
                    if vpSRC == 'Money Flow'
                        rpVSB.set(l, rpVSB.get(l) + nzV[bI] * vPOR * (pLST + (l + .5) * pSTP))
                    else
                        rpVSB.set(l, rpVSB.get(l) + nzV[bI] * vPOR )
            l += 1

        if rpPC == 'Developing'
            if bI == rpLN
                pocPoints.push(chart.point.from_index(b.i[bI], pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
            else
                pocPoints.push(chart.point.from_index(b.i[bI], pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))

    if rpPC == 'Developing'           
        pocPolyline := polyline.new(pocPoints, false, false, xloc.bar_index, vpHVC, color(na), line.style_solid, 2)

    if rpPC == 'Last(Zone)' or rpPC == 'Last(Line)'
        pocPoints.push(chart.point.from_index(b.i[rpLN], pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
        pocPoints.push(chart.point.from_index(b.i, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))

        pocPolyline := polyline.new(pocPoints, false, false, xloc.bar_index, vpHVC, color(na), rpPC == 'Last(Line)' ? line.style_solid : line.style_dotted, rpPC == 'Last(Line)' ? 2 : 1)

    for l = 0 to rpNR - 1
        bbp  = 2 * rpVSB.get(l) - rpVST.get(l)
        rpVSD.set(l, rpVSD.get(l) + bbp * (bbp > 0 ? 1 : -1) )

        if vpSH or spSH
            sBI = b.i + (spSH ? rpLN * rpW : 7) + int(rpLN * rpW / 3)
            dRP.push(box.new(sBI - 1 + vpHO, pLST + (l + .1) * pSTP, sBI - int(rpLN * rpW / 3) + 1 + vpHO, pLST + (l + .9) * pSTP, #2962ff80, bgcolor = #2962ff10, 
                               text = str.tostring(pLST + (l + .5) * pSTP, format.mintick), text_color = chart.fg_color, text_size = vpS ))

    if rpBG
        dRP.push(box.new(b.i - rpLN, pLST, b.i, pHST, rpBGC, bgcolor = rpBGC ))

    if rpPL
        f_drawLabelX(b.i, pHST, str.tostring(pHST, format.mintick), label.style_label_down, rpPLC, rpS, 
                     'Profile High - ' + str.tostring(pHST, format.mintick) + '\n %' + str.tostring((pHST - pLST) / pLST * 100, '#.##') + ' higher than the Profile Low\n\n' +
                     'Total ' + (vpSRC == 'Volume' ? 'Volume : ' : 'Money Flow (' + syminfo.currency + ') : ') + str.tostring(rpVST.sum(), format.volume) +
                     '\nNumber of bars : ' + str.tostring(rpLN + 1))

        f_drawLabelX(b.i, pLST, str.tostring(pLST, format.mintick), label.style_label_up  , rpPLC, rpS, 
                     'Profile Low - '  + str.tostring(pLST, format.mintick) + '\n %' + str.tostring((pHST - pLST) / pHST * 100, '#.##') + ' lower than the Profile High\n\n' +
                     'Total ' + (vpSRC == 'Volume' ? 'Volume : ' : 'Money Flow (' + syminfo.currency + ') : ') + str.tostring(rpVST.sum(), format.volume) +
                     '\nNumber of bars : ' + str.tostring(rpLN + 1))

    for l = 0 to rpNR - 1
        if dRP.size() < 500
            vtLV = rpVST.get(l)
            vtMX = rpVST.max()
            LpM  = vtLV / vtMX
            vdMX = rpVSD.max()
            DpM  = rpVSD.get(l) / vdMX

            llC := LpM > vpHVT ? color.from_gradient(LpM, vpHVT, 1, vpAVC, vpHVC) : color.from_gradient(LpM, 0, vpLVT, vpLVC, vpAVC)

            bbp = 2 * rpVSB.get(l) - vtLV
            lsC := bbp > 0 ? color.from_gradient(DpM, 0, .7, color.new(spBLC, 70 + int(hmTR / 4)), color.new(spBLC, 30 + int(hmTR / 4))) : 
                             color.from_gradient(DpM, 0, .7, color.new(spBRC, 70 + int(hmTR / 4)), color.new(spBRC, 30 + int(hmTR / 4)))

            if rpPC == 'Last(Zone)' and LpM == 1
                dRP.push(box.new(b.i[rpLN], pLST + (rpVST.indexof(vtMX) + .0) * pSTP, b.i, pLST + (rpVST.indexof(vtMX) + 1.) * pSTP, vpHVC, bgcolor = color.new(vpHVC, 73) ))

            if vaSH and LpM > vaTH and LpM < 1
                dRP.push(box.new(b.i[rpLN], pLST + (l + .0) * pSTP, b.i, pLST + (l + 1.) * pSTP, color(na), bgcolor = vaC ))

            if vaSH and rpPC != 'Last(Zone)' and LpM == 1
                dRP.push(box.new(b.i[rpLN], pLST + (l + .0) * pSTP, b.i, pLST + (l + 1.) * pSTP, color(na), bgcolor = vaC ))

            if spPC and DpM == 1
                spPolyline := polyline.new(array.from(chart.point.from_index(b.i[rpLN], pLST + (rpVSD.indexof(vdMX) + .5) * pSTP), chart.point.from_index(b.i, pLST + (rpVSD.indexof(vdMX) + .5) * pSTP)), false, false, xloc.bar_index, lsC, color(na), line.style_dotted, 1)

                dRP.push(box.new(b.i[rpLN], pLST + (rpVSD.indexof(vdMX) + .0) * pSTP, b.i, pLST + (rpVSD.indexof(vdMX) + 1.) * pSTP, lsC, bgcolor = color.new(lsC, 73) ))

            if vpSH
                sBI  = b.i + (spSH ? rpLN * rpW : 7) + int(rpLN * rpW / 3)
                eBI  = sBI + int(LpM * rpLN * rpW)

                dRP.push(box.new(sBI + vpHO, pLST + (l + .1) * pSTP, eBI + vpHO, pLST + (l + .9) * pSTP, llC, bgcolor = llC, 
                                 text = str.tostring(vpSRC == 'Money Flow' ? array.get(rpVST, l) : array.get(rpVST, l) * (pLST + (l + .5) * pSTP), format.volume) + ' ' + 
                                 syminfo.currency + ' (' + str.tostring(math.abs(vtLV / rpVST.sum() * 100), '#.##') + '%)', 
                                 text_halign =  text.align_left, text_color = chart.fg_color, text_size = vpS ))

            if spSH
                sBI = b.i + rpLN * rpW
                eBI = sBI - int(DpM * rpLN * rpW) 

                dRP.push(box.new(sBI + vpHO, pLST + (l + .1) * pSTP, eBI + vpHO, pLST + (l + .9) * pSTP, lsC, bgcolor = lsC, 
                                 text = str.tostring(bbp, format.volume ) + (vpSRC == 'Money Flow' ? ' ' + syminfo.currency : '') + 
                                 ' (' + str.tostring(math.abs(bbp / vtLV * 100), '#.##') + '%)', 
                                 text_halign =  text.align_right, text_color = chart.fg_color, text_size = vpS ))

            if hmSH
                dRP.push(box.new(b.i[rpLN], pLST + (l + .0) * pSTP, b.i, pLST + (l + 1.) * pSTP, hmSRC == hmSO1 ? color.new(llC, hmTR) : lsC, bgcolor = hmSRC == hmSO1 ? color.new(llC, hmTR) : lsC))

//---------------------------------------------------------------------------------------------------------------------}