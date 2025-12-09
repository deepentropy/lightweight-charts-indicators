// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("ICT Killzones Toolkit [LuxAlgo]", 'LuxAlgo - ICT Killzones Toolkit', true, max_lines_count  = 500, max_labels_count = 500, max_boxes_count  = 500, max_bars_back = 500)

//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{

disp    = display.all - display.status_line

kzGR    = 'Killzones'
asSH    = input(true, '', inline = 'asia', group = kzGR)
asST    = input.string('Asian', '', inline = 'asia', group = kzGR, display = disp)
asS     = input.session('2000-0000', '', inline = 'asia', group = kzGR, display = disp)
asC     = input.color(color.new(#e91e63, 90), '', inline = 'asia', group = kzGR)

ldnOSH  = input(true, '', inline = 'ldno', group = kzGR)
ldnOST  = input.string('London', '', inline = 'ldno', group = kzGR, display = disp)
ldnOS   = input.session('0200-0500', '', inline = 'ldno', group = kzGR, display = disp)
ldnOC   = input.color(color.new(#00bcd4, 90), '', inline = 'ldno', group = kzGR)

nySH    = input(true,   '', inline = 'nyam', group = kzGR)
nyST    = input.string('New York AM', '', inline = 'nyam', group = kzGR, display = disp)
nyS     = input.session('0830-1100', '', inline = 'nyam', group = kzGR, display = disp)
nyC     = input.color(color.new(#ff5d00, 90), '', inline = 'nyam', group = kzGR)

ldnCSH  = input(true, '', inline = 'nypm', group = kzGR)
ldnCST  = input.string('New York PM', '', inline = 'nypm', group = kzGR, display = disp)
ldnCS   = input.session('1330-1600', '', inline = 'nypm', group = kzGR, display = disp)
ldnCC   = input.color(color.new(#2157f3, 90), '', inline = 'nypm', group = kzGR)

kzMML   = input(true,   'Killzone Lines : Top/Bottom', inline = 'LN', group = kzGR)
kzML    = input(false,  'Mean', inline = 'LN', group = kzGR)
kzLE    = input(true,  'Extend Top/Bottom', inline = 'LN', group = kzGR)
kzLB    = input(true,  'Killzone Labels', group = kzGR)
kzSH    = input.int(15, 'Display Killzones within Timeframes Up To', options = [1, 3, 5, 15, 30, 45, 60], group = kzGR, display = disp)
dwmO    = input.string('None', 'Open Price of', options = ['Killzones', 'the Day', 'the Week', 'the Month', 'None'], inline = 'OP', group = kzGR, display = disp)
dwmS    = input.bool(true, 'Separator', inline = 'OP', group = kzGR)
dwmC    = input(color.new(color.gray, 89), '', inline = 'OP', group = kzGR)
dwmL    = input.bool(true, 'Label', inline = 'OP', group = kzGR)

obbGR   = 'Order Blocks & Breaker Blocks'
obSH    = input.bool(true, 'Order Blocks | Breaker Blocks', inline = 'OB', group = obbGR)
bbSH    = input.bool(false, '', inline = 'OB', group = obbGR)

obbLN   = input.int(5, 'Swing Detection Length', minval = 3, group = obbGR, display = disp)
obbMT   = input.string('Closing Price', 'Mitigation Price', options = ['Closing Price', 'Wick'], group = obbGR, display = disp)
obbMP   = obbMT == 'Closing Price'
useBody = input(false, 'Use Candle Body in Detection', group = obbGR)
obbR    = input.bool(true, 'Remove Mitigated Order Blocks & Breaker Blocks', group = obbGR)
extTT   = 'In this context, "extend" refers to the action of projecting or elongating the visual objects beyond the boundaries of the killzones.'
obbEX   = input.bool(true, 'Extend Order Blocks & Breaker Blocks', group = obbGR, tooltip = extTT)
obbSH   = input.string('First', 'Display Order Blocks & Breaker Blocks', options = ['All', 'First', 'Last'], group = obbGR, display = disp)

bullOC  = input(color.new(#2157f3, 80), 'Order Blocks  : Bullish'   , inline = 'OBC', group = obbGR)
bearOC  = input(color.new(#ff5d00, 80), 'Bearish'   , inline = 'OBC', group = obbGR)
bullBC  = input(color.new(#ff1100, 80), 'Breaker Blocks : Bullish', inline = 'BBC', group = obbGR)
bearBC  = input(color.new(#0cb51a, 80), 'Bearish', inline = 'BBC', group = obbGR)
obbTX   = input.bool(true, 'Show Order Blocks & Breaker Blocks Text', group = obbGR)

mssGR   = 'Market Structure Shifts'
mssSH   = input.bool(false, 'Market Structure Shifts', group = mssGR)
mssLN   = input.int(7, "Detection Length", minval = 1, group = mssGR, display = disp)
mssDO   = input.string('First', 'Display Market Structure Shifts', options = ['All', 'First', 'Last'], group = mssGR, display = disp)
ppLCB   = input.color(color.new(color.teal, 0), 'Market Structure Shifts : Bullish', inline = 'MSS', group = mssGR)
ppLCS   = input.color(color.new(color.red, 0), 'Bearish', inline = 'MSS', group = mssGR)
mssTX   = input.bool(true, 'Show Market Structure Shifts Text', group = mssGR)

fvgGR   = 'Fair Value Gaps'
fvgSH   = input.bool(true, 'Fair Value Gaps', group = fvgGR)
fvgTT   = 'The script showcases fair value gaps that exceed a predetermined length calculated by multiplying the fixed-average true range (ATR) value by the option\'s value.\n\n' + 
           'The option value set to 0 means no filtering is applied.\n\n' + 
           'Remark: No filtering will be implemented for the initial 144 candles based on the fixed-length ATR, as the ATR value won\'t be available during this period.'
fvgTH   = input.float(1.2, 'Fair Value Gap Width Filter', minval = 0, step = .1, tooltip = fvgTT, group = fvgGR, display = disp)
fvgR    = input.bool(true, 'Remove Mitigated Fair Value Gaps', group = fvgGR)
fvgE    = input.bool(true, 'Extend Fair Value Gaps', group = fvgGR, tooltip = extTT)
fvgDO   = input.string('First', 'Display Fair Value Gaps', options = ['All', 'First', 'Last'], group = fvgGR, display = disp)
fvgBC   = input.color(color.new(#4caf50, 80), 'Bullish Imbalance', group = fvgGR)
fvgSC   = input.color(color.new(color.red, 80), 'Bearish Imbalance', group = fvgGR)
fvgTX   = input.bool(true, 'Show Fair Value Gaps Text', group = fvgGR)

//-----------------------------------------------------------------------------}
// User Defined Types
//-----------------------------------------------------------------------------{

type bar
    float o = open
    float h = high
    float l = low
    float c = close
    int   t = time
    int   i = bar_index
    
type OB
    float top  = na
    float btm  = na
    int   obI  = bar_index
    box   bxOB
    bool  ext  = true

type BB
    box   bxOB
    box   bxBB
    bool  ext  = true
    bool  bb   = false
    int   bbI  = na
    int   lst  = na

type swing
    float y = na
    int   i = na
    bool  x = false

type pivotPoint
    float  h
    int    hi
    bool   hx 

    float  l
    int    li
    bool   lx

type KZ
    line  lnT
    line  lnM
    line  lnB
    line  lnO
    label lb
    label lbO

type DWM
    line  ln
    label lb

type MSS
    line  ln
    box   bx

type FVG
    box   bx
    bool  e

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()

tfM = timeframe.multiplier

nyam    = not na(time(timeframe.period, nyS  , 'UTC-5')) and nySH   and tfM <= kzSH
ldnO  = not na(time(timeframe.period, ldnOS, 'UTC-5')) and ldnOSH and tfM <= kzSH
ldnC  = not na(time(timeframe.period, ldnCS, 'UTC-5')) and ldnCSH and tfM <= kzSH
asian = not na(time(timeframe.period, asS  , 'UTC-5')) and asSH   and tfM <= kzSH

inKZ  = nyam or ldnO or ldnC or asian
var KZ kz = KZ.new()

var DWM dwm = DWM.new()

var bOB = array.new<OB>(0)
var aOB = array.new<OB>(0)

var bBB = array.new<BB>(0)
var aBB = array.new<BB>(0)

var bLS = array.new_int()
var aLS = array.new_int()


var bMSS = array.new<MSS>(0)
var aMSS = array.new<MSS>(0)

var pivotPoint pp = pivotPoint.new()
var shift = 0

var bFVG = array.new<FVG>(0)//FVG.new(array.new <box>  (na))
var aFVG = array.new<FVG>(0)//FVG.new(array.new <box>  (na))
fvgATR = nz(ta.atr(144)) * fvgTH
//var bool last = na 

//-----------------------------------------------------------------------------}
// Functions / Methods
//-----------------------------------------------------------------------------{

swings(_l)=>
    var os = 0
    var swing top = swing.new(na, na)
    var swing btm = swing.new(na, na)
    
    upper = ta.highest(_l)
    lower = ta.lowest(_l)

    os := high[_l] > upper ? 0 : low[_l] < lower ? 1 : os

    if os == 0 and os[1] != 0
        top := swing.new(high[_l], bar_index[_l])
    
    if os == 1 and os[1] != 1
        btm := swing.new(low[_l], bar_index[_l])

    [top, btm]

method killzones(KZ _id, _s, _kz, _o, _h, _l, _c, _t, _cr, _tx, _mml, _ml, _lb, _le, _ol, _olC, _olL, areaCss)=>
    var float max = na, var float mid = na, var float min = na 
    var int sbT = na, var bool xt = na, var bool xb = na
    var box area = na
    var tC = color.rgb(color.r(_cr), color.g(_cr), color.b(_cr))
    
    if _s and not _s[1]
        max := _h
        sbT := _t
        min := _l
        mid := math.avg(max, min)
        area := box.new(bar_index, max, bar_index, min, na, bgcolor = areaCss)

        if _mml
            _id.lnT := line.new(sbT, max, sbT, max, xloc.bar_time, color = tC)//, xt := true
            _id.lnB := line.new(sbT, min, sbT, min, xloc.bar_time, color = tC)//, xb := true

        if _ml
            _id.lnM := line.new(sbT, mid, sbT, mid, xloc.bar_time, color = tC, style = line.style_dotted)
        
        if _ol
            _id.lnO := line.new(sbT, _o, sbT, _o, xloc.bar_time, color = color.new(_olC, 0), style = line.style_dotted)

            if _olL
                _id.lbO := label.new(sbT, _o, 'KZO(' + str.tostring(_o, format.mintick) + ')', xloc.bar_time, color = color(na), style = label.style_label_left, textcolor = color.new(_olC, 0), size = size.tiny)

        if _lb
            _id.lb := label.new(sbT, max, _tx, xloc.bar_time, color = #ffffff00, style = label.style_label_down, textcolor = tC, size = size.small)
    
    if _s
        max := math.max(_h, max)
        min := math.min(_l, min)
        mid := math.avg(max, min)
        xt := true
        xb := true

        area.set_top(max)
        area.set_rightbottom(bar_index, min)

        if _lb
            label.set_x(_id.lb, int(math.avg(_t, sbT))), label.set_y(_id.lb, max)

        if _mml
            _id.lnT.set_y1(max), _id.lnT.set_xy2(_t, max)
            _id.lnB.set_y1(min), _id.lnB.set_xy2(_t, min)
        
        if _ml
            _id.lnM.set_y1(mid), _id.lnM.set_xy2(_t, mid)
        
        if _ol 
            _id.lnO.set_x2(_t)

            if _olL
                _id.lbO.set_x(_t)
    
    if not _s and _le and not _kz

        if _mml
            if xt 
                if _h < _id.lnT.get_y1()
                    _id.lnT.set_x2(_t)
                else 
                    _id.lnT.set_x2(_t)
                    xt := false

            if xb
                if _l > _id.lnB.get_y1()
                    _id.lnB.set_x2(_t)
                else 
                    _id.lnB.set_x2(_t)
                    xb := false

        if _ml
            _id.lnM.set_x2(_t)

method pDWM(DWM _id, _tC, _t, _o, _cl, _lbTX, _olL) =>
    if _tC
        _id.lb.delete()
        _id.ln := line.new(_t, _o, _t, _o, xloc.bar_time, extend.none, color.new(_cl, 0), line.style_dotted, 1)

        if _olL
            _id.lb := label.new(_t, _o, _lbTX + '(' + str.tostring(_o, format.mintick) + ')', xloc.bar_time, yloc.price, color(na), label.style_label_left, color.new(_cl, 0), size.tiny)
    else
        _id.ln.set_x2(_t)

        if _olL
            _id.lb.set_x(_t)
        na

pOBB(_s, _o, _h, _l, _c, _i, _t, _st, _sb, _mx, _mn, _cOBb, _cBBb, _cOBa, _cBBa, _obS, _bbS, _obbM, _obbTX, _obbE, _obbD, _obbR) => 

    var int sbI = 0, var bool xb = na, var bool xa = na//, var bool zb = na

    if _s and not _s[1]
        sbI := _i, xb := true, xa := true//, zb := true
        
        if _obbE
            if bOB.size() > 0
                for i = bOB.size() - 1 to 0
                    bOB.remove(i)

            if aOB.size() > 0
                for i = aOB.size() - 1 to 0
                    aOB.remove(i)

            if bBB.size() > 0
                for i = bBB.size() - 1 to 0
                    bBB.remove(i)

            if aBB.size() > 0
                for i = aBB.size() - 1 to 0
                    aBB.remove(i)

    if _s
        if _c[1] > _st.y and not _st.x and _st.i >= sbI
            _st.x := true

            minima = _mx[1]
            maxima = _mn[1]
            sBT = _t[1]

            for i = 1 to (_i - _st.i) - 1
                minima := math.min(_mn[i], minima)
                maxima := minima == _mn[i] ? _mx[i] : maxima
                sBT := minima == _mn[i] ? _t[i] : sBT
            
            bOB.unshift(OB.new(maxima, minima, sBT, 
                         box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = _obbTX ? 'OB' : '', text_size = size.tiny, text_halign = text.align_center, text_valign = text.align_center, text_color = color.new(_cOBb, 0)))) 
            bBB.unshift(BB.new(
                         box.new(na, na, na, na, color(na), xloc = xloc.bar_time), 
                         box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = _obbTX ? 'BB' : '', text_size = size.tiny, text_halign = text.align_center, text_valign = text.align_center, text_color = color.new(_cBBb, 0))))

        if _c[1] < _sb.y and not _sb.x and _st.i >= sbI 
            _sb.x := true

            minima = _mn[1]
            maxima = _mx[1]
            sBT = _t[1]

            for i = 1 to (_i - _sb.i) - 1
                maxima := math.max(_mx[i], maxima)
                minima := maxima == _mx[i] ? _mn[i] : minima
                sBT := maxima == _mx[i] ? _t[i] : sBT

            aOB.unshift(OB.new(maxima, minima, sBT, 
                         box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = _obbTX ? 'OB' : '', text_size = size.tiny, text_halign = text.align_center, text_valign = text.align_center, text_color = color.new(_cOBa, 0)))) 
            aBB.unshift(BB.new(
                         box.new(na, na, na, na, color(na), xloc = xloc.bar_time), 
                         box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = _obbTX ? 'BB' : '', text_size = size.tiny, text_halign = text.align_center, text_valign = text.align_center, text_color = color.new(_cBBa, 0))))

    if _obbE ? true : _s

        if bOB.size() > 0
            for i = bOB.size() - 1 to 0
                ob = bOB.get(i)
                bb = bBB.get(i)

                if _obbR 
                    if not ob.ext
                        ob.bxOB.delete()

                    if not bb.ext
                        bb.bxOB.delete(), bb.bxBB.delete()

                if not bb.bb 
                    if _obS and (_obbD == 'First' ? i == bOB.size() - 1 : true)
                        ob.bxOB.set_lefttop(ob.obI, ob.top)
                        ob.bxOB.set_rightbottom(_t, ob.btm)
                        ob.bxOB.set_bgcolor((_obbD == 'Last' ? i == 0 ? _cOBb : color(na): _cOBb))
                        ob.bxOB.set_text_color((_obbD == 'Last' ? i == 0 ? color.new(_cOBb, 0) : color(na): color.new(_cOBb, 0)))

                    if math.min((_obbM ? _c[1] : _l[1]), _o[1]) < ob.btm
                        bb.bb := true

                        if _obS
                            ob.bxOB.set_right(_t[1])
                            ob.ext := false

                        if _bbS and xb
                            bb.bbI := _t[1]
                            bb.bxBB.set_lefttop(bb.bbI, ob.top)
                            bb.bxBB.set_rightbottom(_t, ob.btm)
                            bb.bxBB.set_bgcolor(_cBBb)

                            if not _obS or _obbR or not (_obbD == 'First' ? i == bOB.size() - 1 : true)
                                bb.bxOB.set_lefttop(ob.obI, ob.top)
                                bb.bxOB.set_rightbottom(bb.bbI, ob.btm)
                                bb.bxOB.set_bgcolor(color(na))
                                bb.bxOB.set_border_color(_cBBb)

                            if _obbD == 'First'
                                xb := false

                            if _obbD == 'Last'
                                bLS.push(bb.bbI)

                else
                    if (_obbM ? _c[1] : _h[1]) > ob.top
                        bb.ext := false

                    if _obS
                        ob.bxOB.set_bgcolor((_obbD == 'Last' ? i == 0 ? _cOBb : color(na): _cOBb))
                        ob.bxOB.set_text_color((_obbD == 'Last' ? i == 0 ? color.new(_cOBb, 0) : color(na): color.new(_cOBb, 0)))

                    if _bbS and bb.ext
                        bb.bxBB.set_right(_t)

                    if _bbS
                        if _obbD == 'Last' //and zb
                            if i != 0
                                bb.bxOB.set_lefttop(ob.obI, ob.top)
                                bb.bxOB.set_rightbottom(bb.bbI, ob.btm)
                                bb.bxOB.set_bgcolor(color(na))
                                bb.bxOB.set_border_color(_cBBb)

                            if bLS.max() != bb.bxBB.get_left()
                                bb.bxBB.set_bgcolor(color(na))
                                bb.bxBB.set_text_color(color(na))
                                bb.bxOB.set_border_color(color(na))

        //bLS.clear()

        if aOB.size() > 0
            for i = aOB.size() - 1 to 0
                ob = aOB.get(i)
                bb = aBB.get(i)

                if _obbR 
                    if not ob.ext
                        ob.bxOB.delete()

                    if not bb.ext
                        bb.bxOB.delete(), bb.bxBB.delete()

                if not bb.bb 
                    if _obS and (_obbD == 'First' ? i == aOB.size() - 1 : true)
                        ob.bxOB.set_lefttop(ob.obI, ob.top)
                        ob.bxOB.set_rightbottom(_t, ob.btm)
                        ob.bxOB.set_bgcolor((_obbD == 'Last' ? i == 0 ? _cOBa : color(na) : _cOBa))
                        ob.bxOB.set_text_color((_obbD == 'Last' ? i == 0 ? color.new(_cOBa, 0) : color(na): color.new(_cOBa, 0)))

                    if math.max((_obbM ? _c[1] : _h[1]), _o[1]) > ob.top
                        bb.bb := true

                        if _obS
                            ob.bxOB.set_right(_t[1])
                            ob.ext := false

                        if _bbS and xa
                            bb.bbI := _t[1]
                            bb.bxBB.set_lefttop(bb.bbI, ob.top)
                            bb.bxBB.set_rightbottom(_t, ob.btm)
                            bb.bxBB.set_bgcolor(_cBBa)

                            if not _obS or _obbR or not (_obbD == 'First' ? i == aOB.size() - 1 : true)
                                bb.bxOB.set_lefttop(ob.obI, ob.top)
                                bb.bxOB.set_rightbottom(bb.bbI, ob.btm)
                                bb.bxOB.set_bgcolor(color(na))
                                bb.bxOB.set_border_color(_cBBa)
                            
                            if _obbD == 'First'
                                xa := false

                            if _obbD == 'Last'
                                aLS.push(bb.bbI)
                else
                    if (_obbM ? _c[1] : _l[1]) < ob.btm
                        bb.ext := false

                    if _obS
                        ob.bxOB.set_bgcolor((_obbD == 'Last' ? i == 0 ? _cOBa : color(na): _cOBa))
                        ob.bxOB.set_text_color((_obbD == 'Last' ? i == 0 ? color.new(_cOBa, 0) : color(na): color.new(_cOBa, 0)))

                    if _bbS and bb.ext 
                        bb.bxBB.set_right(_t)
                    
                    if _bbS
                        if _obbD == 'Last'
                            if i != 0
                                bb.bxOB.set_lefttop(ob.obI, ob.top)
                                bb.bxOB.set_rightbottom(bb.bbI, ob.btm)
                                bb.bxOB.set_bgcolor(color(na))
                                bb.bxOB.set_border_color(_cBBa)

                            if aLS.max() != bb.bxBB.get_left()
                                bb.bxBB.set_bgcolor(color(na))
                                bb.bxBB.set_text_color(color(na))
                                bb.bxOB.set_border_color(color(na))

    else if not _obbE
        if bOB.size() > 0
            for i = bOB.size() - 1 to 0
                bOB.remove(i)

        if aOB.size() > 0
            for i = aOB.size() - 1 to 0
                aOB.remove(i)

        if bBB.size() > 0
            for i = bBB.size() - 1 to 0
                bBB.remove(i)

        if aBB.size() > 0
            for i = aBB.size() - 1 to 0
                aBB.remove(i)
        na

pFVG(_s, _h, _l, _c, _i, _atr, _fR, _fE, _fD, _fTX, _fbC, _faC) =>

    var bool xb = na, var bool xa = na

    if _s and not _s[1]
        xb := true, xa := true
        if _fE
            if bFVG.size() > 0
                for i = bFVG.size() - 1 to 0
                    bFVG.remove(i)

            if aFVG.size() > 0
                for i = aFVG.size() - 1 to 0
                    aFVG.remove(i)

    bullG = _l > _h[1]
    bearG = _h < _l[1]

    if _s
        bull  = (_l - _h[2]) > _atr and _l > _h[2] and _c[1] > _h[2] and not (bullG or bullG[1])

        if bull and xb
            bFVG.unshift(FVG.new(box.new(_i - 1, _l, _i, _h[2], na, bgcolor = _fbC, text = _fTX ? 'FVG' : '', text_size = size.tiny, text_halign = text.align_center, text_valign = text.align_center, text_color = color.new(_fbC, 0)), true))
            
            if _fD == 'First'
                xb := false
        
            if bFVG.size() > 1
                if _fD == 'Last'
                    fvg = bFVG.pop()
                    fvg.bx.delete()

        bear  = (_l[2] - _h) > _atr and _h < _l[2] and _c[1] < _l[2] and not (bearG or bearG[1])

        if bear and xa
            aFVG.unshift(FVG.new(box.new(_i - 1, _l[2], _i, _h, na, bgcolor = _faC, text = _fTX ? 'FVG' : '', text_size = size.tiny, text_halign = text.align_center, text_valign = text.align_center, text_color = color.new(_faC, 0)), true))

            if _fD == 'First'
                xa := false

            if aFVG.size() > 1
                if _fD == 'Last'
                    fvg = aFVG.pop()
                    fvg.bx.delete()

    if _fE ? true : _s
        if bFVG.size() > 0 
            for i = bFVG.size() - 1 to 0

                fvg  = bFVG.get(i)
                fvgB = fvg.bx.get_bottom()

                if fvg.e
                    if _l < fvgB
                        fvg.bx.set_right(_i)

                        if _fR
                            fvg.bx.delete()
                        fvg.e := false
                    else
                        fvg.bx.set_right(_i)

        if aFVG.size() > 0
            for i = aFVG.size() - 1 to 0

                fvg  = aFVG.get(i)
                fvgT = fvg.bx.get_top()

                if fvg.e
                    if _h > fvgT
                        fvg.bx.set_right(_i)

                        if _fR
                            fvg.bx.delete()
                        fvg.e := false
                        na
                    else
                        fvg.bx.set_right(_i)

    else if not _fE
        if bFVG.size() > 0
            for i = bFVG.size() - 1 to 0
                bFVG.remove(i)

        if aFVG.size() > 0
            for i = aFVG.size() - 1 to 0
                aFVG.remove(i)
        na

//-----------------------------------------------------------------------------}
// Calculations - Killzones
//-----------------------------------------------------------------------------{
kzO = dwmO == 'Killzones'

kz.killzones(nyam    and timeframe.isintraday, inKZ, b.o, b.h, b.l, b.c, b.t, nyC  , nyST  , kzMML, kzML, kzLB, kzLE, kzO, dwmC, dwmL, nyC)
kz.killzones(ldnO  and timeframe.isintraday, inKZ, b.o, b.h, b.l, b.c, b.t, ldnOC, ldnOST, kzMML, kzML, kzLB, kzLE, kzO, dwmC, dwmL, ldnOC)
kz.killzones(ldnC  and timeframe.isintraday, inKZ, b.o, b.h, b.l, b.c, b.t, ldnCC, ldnCST, kzMML, kzML, kzLB, kzLE, kzO, dwmC, dwmL, ldnCC)
kz.killzones(asian and timeframe.isintraday, inKZ, b.o, b.h, b.l, b.c, b.t, asC  , asST  , kzMML, kzML, kzLB, kzLE, kzO, dwmC, dwmL, asC)

[xChg, xTxt] = switch dwmO
    'the Day'   => [timeframe.change('D'), 'DO']
    'the Week'  => [timeframe.change('W'), 'WO']
    'the Month' => [timeframe.change('M'), 'MO']

if not kzO and timeframe.isintraday and tfM <= kzSH
    dwm.pDWM(xChg, b.t, b.o, dwmC, xTxt, dwmL)

bgcolor(dwmS and not kzO and timeframe.isintraday and tfM <= kzSH ? xChg ? dwmC : na : na)

//-----------------------------------------------------------------------------}
// Calculations - Order Blocks & Breaker Blocks
//-----------------------------------------------------------------------------{

[top, btm] = swings(obbLN)
max = useBody ? math.max(b.c, b.o) : b.h
min = useBody ? math.min(b.c, b.o) : b.l

if obSH or bbSH
    pOBB(inKZ, b.o, b.h, b.l, b.c, b.i, b.t, top, btm, max, min, bullOC, bullBC, bearOC, bearBC, obSH, bbSH, obbMP, obbTX, obbEX, obbSH, obbR)

//-----------------------------------------------------------------------------}
// Calculations - Market Structure Shifts
//-----------------------------------------------------------------------------{

pp_h = ta.pivothigh(mssLN, mssLN)
pp_l = ta.pivotlow (mssLN, mssLN)

if not na(pp_h)
    pp.h  := pp_h
    pp.hx := false
    pp.hi := b.i - mssLN

if not na(pp_l)
    pp.l  := pp_l
    pp.lx := false
    pp.li := b.i - mssLN

if not inKZ
    pp.l := 0
    pp.h := 10e8
    shift := 0

    if bMSS.size() > 0
        for i = bMSS.size() - 1 to 0
            bMSS.remove(i)

    if aMSS.size() > 0
        for i = aMSS.size() - 1 to 0
            aMSS.remove(i)

if mssSH and inKZ
    if b.c[1] > pp.h and not pp.hx
        pp.hx := true

        if shift == -1 or shift == 0
            if (mssDO == 'First' ? bMSS.size() < 1 : true)
                bMSS.unshift(MSS.new(line.new(pp.hi, pp.h, b.i - 1, pp.h, color = ppLCB), 
                 box.new(pp.hi, pp.h, b.i - 1, pp.h, text = 'CHoCH', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_bottom, text_color = mssTX ? ppLCB : color(na), bgcolor = color(na), border_color = color(na))
                 ))

            if bMSS.size() > 1
                if mssDO == 'Last'
                    mss = bMSS.pop()
                    mss.ln.delete(), mss.bx.delete()

        shift := 1

    if b.c[1] < pp.l and not pp.lx
        pp.lx := true

        if shift == 1 or shift == 0
            if (mssDO == 'First' ? aMSS.size() < 1 : true)
                aMSS.unshift(MSS.new(line.new(pp.li, pp.l, b.i - 1, pp.l, color = ppLCS), 
                 box.new(pp.li, pp.l, b.i - 1, pp.l, text = 'CHoCH', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_top, text_color = mssTX ? ppLCS : color(na), bgcolor = color(na), border_color = color(na))
                 ))

            if aMSS.size() > 1
                if mssDO == 'Last'
                    mss = aMSS.pop()
                    mss.ln.delete(), mss.bx.delete()

        shift := -1

//-----------------------------------------------------------------------------}
// Calculations - Fair Value Gaps
//-----------------------------------------------------------------------------{

if fvgSH 
    pFVG(inKZ, b.h, b.l, b.c, b.i, fvgATR, fvgR, fvgE, fvgDO, fvgTX, fvgBC, fvgSC)

//-----------------------------------------------------------------------------}