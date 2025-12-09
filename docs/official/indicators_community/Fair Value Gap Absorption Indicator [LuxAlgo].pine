// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("Fair Value Gap Absorption Indicator [LuxAlgo]", "LuxAlgo - Fair Value Gap Absorption Indicator", overlay = true, max_boxes_count = 500)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

fvgTT = 'The script displays the fair value gaps whose width is larger than a fixed-length atr (average true range) value multiplied by the value of the option.\n\n' + 
         'The option value set to 0 means no filtering is applied.\n\n' + 
         'Remark: no filtering will be applied for the first 144 (atr fixed-length) candles since the atr value won\'t be present'
fvgTH = input.float(.5, 'Fair Value Gap Width Filter', minval = 0, step = .1, tooltip = fvgTT)

fvgBC = input.color(color.new(#089981, 55), 'Bullish, Imbalance', inline = 'VA')
fvgAC = input.color(color.new(#787b86, 77), 'Mitigation', inline = 'VA')
fvgSC = input.color(color.new(#f23645, 55), 'Bearish, Imbalance', inline = 'VD')
fvgFC = input.color(color.new(#787b86, 77), 'Mitigation', inline = 'VD')

fvgPT = 'Displays percentage value of the mitigation area'
fvgPR = input.bool (true, 'Display Percentage of Mitigation', tooltip = fvgPT)

fvgFT = 'Toggles the visibility of the historical fair value gaps'
fvgVF = input.bool (true, 'Historical Fair Value Gaps', inline = 'FL', tooltip = fvgFT)

//-----------------------------------------------------------------------------}
// User Defined Types
//-----------------------------------------------------------------------------{

type bar
    float h = high
    float l = low
    float c = close
    int   i = bar_index

type FVG
    box  [] uFVG
    box  [] mFVG
    box  [] tFVG
    line [] lFVG

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{
bar b = bar.new()

var FVG fvg = FVG.new(
     array.new <box>  (na), 
     array.new <box>  (na), 
     array.new <box>  (na), 
     array.new <line> (na)
 )

var bool last = na 

//-----------------------------------------------------------------------------}
// Functions / Methods
//-----------------------------------------------------------------------------{
method clear(FVG _id, _h) =>
    arr = array.from(_id.uFVG.pop(), _id.mFVG.pop(), _id.tFVG.pop())

    if not _h
        for bx in arr
            bx.delete()
        _id.lFVG.pop().delete()
    else
        _id.lFVG.pop()
        na

method update(FVG _id, _h, _l, _p) =>

    cUB = _id.uFVG.get(0)
    tUB = cUB.get_top()
    bUB = cUB.get_bottom()

    cMB = _id.mFVG.get(0)
    tMB = cMB.get_top()
    bMB = cMB.get_bottom()

    cTB = _id.tFVG.get(0)

    cL  = _id.lFVG.get(0)

    if _h > bUB and _l < tUB
        if _p
            if _l > bUB
                cMB.set_bottom(math.min(_l, bMB))
                cUB.set_top(math.min(_l, bMB))

                if fvgPR
                    cTB.set_text(str.tostring((tMB - math.min(_l, bMB)) / (tMB - bUB), '#.#%'))
            else
                cMB.set_bottom(bUB)
                cUB.set_top(bUB)

                cTB.set_text('')

                fvg.clear(fvgVF)

        else
            if _h < tUB
                cMB.set_top(math.max(_h, tMB))
                cUB.set_bottom(math.max(_h, tMB))

                if fvgPR
                    cTB.set_text(str.tostring((math.max(_h, tMB) - bMB) / (tUB - bMB), '#.#%'))
            else
                cMB.set_top(tUB)
                cUB.set_bottom(tUB)

                cTB.set_text('')

                fvg.clear(fvgVF)

    cMB.set_right(b.i)
    cUB.set_right(b.i)
    cTB.set_right(b.i)
    cL.set_x2(b.i)

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{
bullG = b.l > b.h[1]
bearG = b.h < b.l[1]

atr   = nz(ta.atr(144)) * fvgTH

bull  = (b.l - b.h[2]) > atr and b.l > b.h[2] and b.c[1] > b.h[2] and not (bullG or bullG[1])

if bull 
    if fvg.uFVG.size() > 0
        fvg.clear(fvgVF)

    fvg.uFVG.push(box.new (b.i - 1, b.l, b.i, b.h[2], na, bgcolor = fvgBC))
    fvg.mFVG.push(box.new (b.i - 1, b.l, b.i, b.l   , na, bgcolor = fvgAC))
    fvg.tFVG.push(box.new (b.i - 1, b.l, b.i, b.h[2], na, bgcolor = color(na), text_color = chart.fg_color, text_size = size.small))
    fvg.lFVG.push(line.new(b.i - 1, b.h[2], b.i, b.h[2], color = fvgBC, width = 2))

    last := true

bear  = (b.l[2] - b.h) > atr and b.h < b.l[2] and b.c[1] < b.l[2] and not (bearG or bearG[1])

if bear
    if fvg.uFVG.size() > 0
        fvg.clear(fvgVF)

    fvg.uFVG.push(box.new (b.i - 1, b.l[2], b.i, b.h, na, bgcolor = fvgSC))
    fvg.mFVG.push(box.new (b.i - 1, b.h   , b.i, b.h, na, bgcolor = fvgFC))
    fvg.tFVG.push(box.new (b.i - 1, b.l[2], b.i, b.h, na, bgcolor = color(na), text_color = chart.fg_color, text_size = size.small))
    fvg.lFVG.push(line.new(b.i - 1, b.l[2], b.i, b.l[2], color = fvgSC, width = 2))

    last := false

if bullG or bearG
    if fvg.uFVG.size() > 0
        fvg.clear(fvgVF)

if fvg.uFVG.size() > 0
    fvg.update(b.h, b.l, last)

//-----------------------------------------------------------------------------}