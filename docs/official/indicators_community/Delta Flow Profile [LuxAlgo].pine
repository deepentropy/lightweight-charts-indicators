// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator("Delta Flow Profile [LuxAlgo]", "LuxAlgo - Delta Flow Profile", true, max_bars_back = 1500, max_boxes_count = 500, max_lines_count = 500)

//---------------------------------------------------------------------------------------------------------------------}
// Settings
//---------------------------------------------------------------------------------------------------------------------{

display = display.all - display.status_line

vpGR   = 'Calculation Settings'

vpTP   = 'MONEY FLOW PROFILE:\n\nDisplays total money flow (both buying and selling) over a specified time period at specific price levels. ' +
         'Row lengths indicate the amount of money flow at specific price levels.\n\n' +
         'NORMALIZED:\n\nThis profile normalizes the money flow data so that the length of each level is presented as a percentage of the maximum level length. This makes it easier to compare levels relative to the peak money flow.'
vpSH   = input.bool(true, 'Money Flow Profile', inline = 'mfp', group = vpGR, tooltip = vpTP, display = display)
mfpC   = input.color(color.new(#5288C4, 0), '', inline = 'mfp',  group = vpGR)
npSH   = input.bool(true, 'Normalized ', inline = 'mfp', group = vpGR, tooltip = vpTP, display = display)

spTP   = 'DELTA PROFILE:\n\nDisplays the delta and the dominant party over a specified time period at specific price levels.'
spSH   = input.bool(true, 'Delta Profile', group = vpGR, tooltip = spTP)

spPT   = 'POLARITY METHOD:\n\n' +
          'Conditions used to calculate the up/down money flow:\n\n' +
          '* Bar Polarity\n   up => if close > open\n   down => if close <= open\n\n' +
          '* Bar Buying/Selling Pressure\n   up => if (close - low) > (high - close)\n   down => if (close - low) <= (high - close)'
spPT1  = 'Bar Polarity'
spPT2  = 'Bar Buying/Selling Pressure'
spPTY  = input.string(spPT1, '  Polarity Method', options = [spPT1, spPT2], inline = 'pm', group = vpGR,  display = display, tooltip = spPT)
spBLC  = input.color(color.new(#5288C4, 0), '', inline = 'pm', group = vpGR)
spBRC  = input.color(color.new(#f7525f, 0), '', inline = 'pm', group = vpGR)

pcTP   = 'Displays the price levels with the highest money flow or the changes in these price levels over a specified time period.'
pcSH   = input.bool(true, 'Level of Significance', inline = 'PoC', group = vpGR, tooltip = pcTP, display = display)
rpPC   = input.string('Developing', '', options = ['Developing', 'Level', 'Row'], inline = 'PoC', group = vpGR, display = display)
vpHVC  = input.color(color.new(#f23645, 25), '', inline = 'PoC', group = vpGR)

rpLN   = input.int(360, 'Lookback Length / Fixed Range', minval = 10, maxval = 1500, step = 10 , group = vpGR, display = display)
rpLN  := last_bar_index > rpLN ? rpLN - 1 : last_bar_index

rpNR   = input.int(25, 'Number of Rows' , minval = 10, maxval = 125 ,step = 5, group = vpGR, display = display)

otGR   = 'Display Settings'

rpW    = input.int(17, 'Profile Width %', minval = 10, maxval = 50, group = otGR, display = display) / 100
vpHO   = input.int(13, 'Profile Horizontal Offset', group = otGR, display = display)

vpLS   = input.string('Tiny', "Profile Text", options=['Auto', 'Tiny', 'Small', 'None'], inline = 'txt', group = otGR, display = display)
vpLC   = input.bool(false, 'Currency', inline = 'txt', group = otGR)

rpPL   = input.bool(false, 'Profile Price Levels', inline = 'BBe', group = otGR)
rpLS   = input.string('Small', "", options=['Tiny', 'Small', 'Normal'], inline = 'BBe', group = otGR, display = display)

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{

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
nzV   = nz(b.v)

rpVST = array.new_float(rpNR, 0.)
rpVSB = array.new_float(rpNR, 0.)
rpVSD = array.new_float(rpNR, 0.)

var dRP = array.new_box()
var dPR = array.new_line()
var pocPoints = array.new<chart.point>()  
var polyline pocPolyline = na

var float pLST = na
var float pHST = na
var int     sI = na
var color  llC = na

//---------------------------------------------------------------------------------------------------------------------}
// Functions/Methods
//---------------------------------------------------------------------------------------------------------------------{

f_drawLabelX(_x, _y, _text, _style, _textcolor, _size, _tooltip) =>
    var lb = label.new(_x, _y, _text, xloc.bar_index, yloc.price, color(na), _style, _textcolor, _size, text.align_left, _tooltip)
    lb.set_xy(_x, _y)
    lb.set_text(_text)
    lb.set_tooltip(_tooltip)
    lb.set_textcolor(_textcolor)

f_gTxtSz(_t) =>
    switch _t
        'Tiny'   => size.tiny
        'Small'  => size.small 
        'Normal' => size.normal
        => size.auto

//---------------------------------------------------------------------------------------------------------------------}
// Calculations
//---------------------------------------------------------------------------------------------------------------------{

bull = spPTY == spPT1 ? b.c > b.o : (b.c - b.l) > (b.h - b.c)

rpS  = f_gTxtSz(rpLS)
vpS  = f_gTxtSz(vpLS)

if b.i == last_bar_index - rpLN
    sI := b.i
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

    if dPR.size() > 0
        for i = 0 to dPR.size() - 1
            line.delete(dPR.shift())

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

                rpVST.set(l, rpVST.get(l) + nzV[bI] * vPOR * (pLST + (l + .5) * pSTP) )

                if bull[bI] and spSH
                    rpVSB.set(l, rpVSB.get(l) + nzV[bI] * vPOR * (pLST + (l + .5) * pSTP))
            l += 1

        if pcSH and rpPC == 'Developing'
            pocPoints.push(chart.point.from_index(b.i[bI], pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
        
    vtMX = rpVST.max()

    for l = 0 to rpNR - 1
        vtLV = rpVST.get(l)
        LpM  = vtLV / vtMX

        bbp  = 2 * rpVSB.get(l) - vtLV
        rpVSD.set(l, rpVSD.get(l) + bbp * (bbp > 0 ? 1 : -1) )

        if vpSH and npSH
            llC := color.from_gradient(LpM, 0, 1, color.new(mfpC, 93), color.new(mfpC, 53))

            sBI = b.i + int(4 * rpLN * rpW / 3)
            dRP.push(box.new(sBI + 1 + vpHO, pLST + (l + .03) * pSTP, sBI + int(rpLN * rpW / 3) + 3 + vpHO, pLST + (l + .97) * pSTP, color(na), bgcolor = llC))
            dPR.push(line.new(sBI + 1 + vpHO, pLST + (l + .0) * pSTP, sBI + int(rpLN * rpW / 3) + 3 + vpHO, pLST + (l + .0) * pSTP, color = color.gray, width = 2))

            if l == rpNR - 1
                dPR.push(line.new(sBI + 1 + vpHO, pLST + (l + 1.) * pSTP, sBI + int(rpLN * rpW / 3) + 3 + vpHO, pLST + (l + 1.) * pSTP, color = color.gray, width = 2))


            sBI := sBI + int(rpLN * rpW / 3) + 3 + vpHO
            eBI  = sBI - int(LpM * (int(rpLN * rpW / 3) + 2))
            llC := color.from_gradient(LpM, 0, 1, color.new(mfpC, 53), color.new(chart.fg_color, 13))
            dRP.push(box.new(sBI, pLST + (l + .1) * pSTP, eBI, pLST + (l + .9) * pSTP, color(na), bgcolor = llC, 
                               text = vpLS != 'None' ? str.tostring(LpM * 100, format.percent) : '', text_color = LpM == 1 ? color.blue : LpM > .5 ? chart.bg_color : chart.fg_color, text_halign = text.align_right, text_size = LpM == 1 ? size.small : size.tiny)) //vpS ))

    if spSH
        bbp  = 2 * rpVSB.sum() - rpVST.sum()
        llC := bbp > 0 ? spBLC : spBRC
        dPR.push(line.new(sI, pLST, sI, pHST, color = llC, width = 2))

    if vpSH
        dPR.push(line.new(b.i + int(4 * rpLN * rpW / 3) + 1 + vpHO, pLST, b.i + int(4 * rpLN * rpW / 3) + 1 + vpHO, pHST, color = mfpC, width = 2))

        if npSH
            dPR.push(line.new(b.i + int(5 * rpLN * rpW / 3) + 3 + vpHO, pLST, b.i + int(5 * rpLN * rpW / 3) + 3 + vpHO, pHST, color = mfpC, width = 2))

    if rpPL
        f_drawLabelX(vpSH ? b.i + int(4 * rpLN * rpW / 3) + 1 + vpHO : b.i, pHST, 'Profile High · ' + str.tostring(pHST, format.mintick), label.style_label_down, mfpC, rpS, 
                     'Profile High · ' + str.tostring(pHST, format.mintick) + '\n %' + str.tostring((pHST - pLST) / pLST * 100, '#.##') + ' higher than the Profile Low\n\n' +
                     'Total Money Flow (' + syminfo.currency + ') : ' + str.tostring(rpVST.sum(), format.volume) +
                     '\nNumber of bars : ' + str.tostring(rpLN + 1))

        f_drawLabelX(vpSH ? b.i + int(4 * rpLN * rpW / 3) + 1 + vpHO : b.i, pLST, 'Profile Low · ' + str.tostring(pLST, format.mintick), label.style_label_up  , mfpC, rpS, 
                     'Profile Low · '  + str.tostring(pLST, format.mintick) + '\n %' + str.tostring((pHST - pLST) / pHST * 100, '#.##') + ' lower than the Profile High\n\n' +
                     'Total Money Flow (' + syminfo.currency + ') : ' + str.tostring(rpVST.sum(), format.volume) +
                     '\nNumber of bars : ' + str.tostring(rpLN + 1))

    vdMX = rpVSD.max()

    for l = 0 to rpNR - 1
        if dRP.size() < 500
            vtLV = rpVST.get(l)
            LpM  = vtLV / vtMX
            DpM  = rpVSD.get(l) / vdMX

            if vpSH
                sBI  = b.i + int(4 * rpLN * rpW / 3)
                eBI  = sBI - int(LpM * rpLN * rpW)
                llC := color.from_gradient(LpM, 0, 1, color.new(mfpC, 73), color.new(mfpC, 3))

                dRP.push(box.new(sBI + vpHO, pLST + (l + .1) * pSTP, eBI + vpHO, pLST + (l + .9) * pSTP, color(na), bgcolor = llC, 
                                 text = (vpLS != 'None' ? str.tostring(array.get(rpVST, l), format.volume) + (vpLC ? ' ' + syminfo.currency : '') +
                                 ' (' + str.tostring(math.abs(vtLV / rpVST.sum() * 100), '#.##') + '%)' : ''), 
                                 text_halign = text.align_right, text_color = LpM == 1 ? color.yellow : chart.fg_color, text_size = vpS ))

            if spSH
                sBI = sI 
                eBI = sBI + int(DpM * rpLN * rpW) 
                bbp = 2 * rpVSB.get(l) - vtLV
                llC := bbp > 0 ? color.from_gradient(DpM, 0, 1, color.new(spBLC, 80), color.new(spBLC, 20)) : 
                             color.from_gradient(DpM, 0, 1, color.new(spBRC, 80), color.new(spBRC, 20))

                dRP.push(box.new(sBI + 1, pLST + (l + .1) * pSTP, eBI + 1, pLST + (l + .9) * pSTP, color(na), bgcolor = llC, 
                                 text = (vpLS != 'None' ? str.tostring(bbp, format.volume) + (vpLC ? ' ' + syminfo.currency : '') : ''), text_halign =  text.align_left, text_color = chart.fg_color, text_size = vpS ))

            if pcSH and LpM == 1

                eBI  = vpSH ? b.i + math.round(rpLN * rpW / 3) + vpHO : b.i

                if rpPC == 'Row' or rpPC == 'Level'
                    if spSH
                        sBI = sI + int(DpM * rpLN * rpW)
                        pocPoints.push(chart.point.from_index(sBI + 3, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
                        pocPoints.push(chart.point.from_index(sBI + 1, pLST + (rpVST.indexof(rpVST.max()) + .2) * pSTP))
                        pocPoints.push(chart.point.from_index(sBI + 3, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
                        pocPoints.push(chart.point.from_index(sBI + 1, pLST + (rpVST.indexof(rpVST.max()) + .8) * pSTP))
                        pocPoints.push(chart.point.from_index(sBI + 3, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))

                    else
                        pocPoints.push(chart.point.from_index(b.i[rpLN], pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
                    
                if vpSH
                    pocPoints.push(chart.point.from_index(eBI - 2, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
                    pocPoints.push(chart.point.from_index(eBI, pLST + (rpVST.indexof(rpVST.max()) + .2) * pSTP))
                    pocPoints.push(chart.point.from_index(eBI - 2, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
                    pocPoints.push(chart.point.from_index(eBI, pLST + (rpVST.indexof(rpVST.max()) + .8) * pSTP))
                    pocPoints.push(chart.point.from_index(eBI - 2, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))
                else
                    pocPoints.push(chart.point.from_index(eBI, pLST + (rpVST.indexof(rpVST.max()) + .5) * pSTP))

                if rpPC == 'Row' or rpPC == 'Level'
                    pocPolyline := polyline.new(pocPoints, false, false, xloc.bar_index, vpHVC, color(na), rpPC == 'Level' ? line.style_solid : line.style_dotted, rpPC == 'Level' ? 2 : 1)

                if rpPC == 'Row'
                    dRP.push(box.new(spSH ? sI + int(DpM * rpLN * rpW) + 1 : b.i[rpLN], pLST + (rpVST.indexof(vtMX) + .1) * pSTP, eBI, pLST + (rpVST.indexof(vtMX) + .9) * pSTP, vpHVC, bgcolor = color.new(vpHVC, 73) ))

    if pcSH and rpPC == 'Developing'           
        pocPolyline := polyline.new(pocPoints, false, false, xloc.bar_index, vpHVC, color(na), line.style_solid, 2)

//---------------------------------------------------------------------------------------------------------------------}