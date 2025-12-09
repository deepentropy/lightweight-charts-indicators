// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("Session Sweeps [LuxAlgo]", "LuxAlgo - Session Sweeps", overlay = true, max_boxes_count = 500, max_lines_count = 500)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

swpGR = 'Session Sweeps'
swpBZ = input.bool (true, 'Buyside Sweep Zones', inline = 'SWPB', group = swpGR)
swpBC = input.color(color.new(color.orange, 37), '', inline = 'SWPB', group = swpGR)
swpBM = input.float(1.3, 'Margin', minval = .5, maxval = 10, step = .1, inline = 'SWPB', group = swpGR)

swpSZ = input.bool (true, 'Sellside Sweep Zones', inline = 'SWPS', group = swpGR)
swpSC = input.color(color.new(color.blue, 37), '', inline = 'SWPS', group = swpGR)
swpSM = input.float(1.3, 'Margin', minval = .5, maxval = 10, step = .1, inline = 'SWPS', group = swpGR)

swpML = input.int(5, '  Sweep Margin Length', minval = 2, maxval = 10, group = swpGR)
swpDT = input.bool(false, 'Detect Sweeps Once per Session', group = swpGR)

swpHF = input.bool(false, 'Hide Fake Sweep Zones', inline = 'SWPF', group = swpGR)
swpFC = input.color(color.new(#787b86, 73), '', inline = 'SWPF', group = swpGR)

sesGR   = "Sessions"
h01 = '01:00', h02 = '02:00', h03 = '03:00', h04 = '04:00', h05 = '05:00', h06 = '06:00'
h07 = '07:00', h08 = '08:00', h09 = '09:00', h10 = '10:00', h11 = '11:00', h12 = '12:00'
h13 = '13:00', h14 = '14:00', h15 = '15:00', h16 = '16:00', h17 = '17:00', h18 = '18:00'
h19 = '19:00', h20 = '20:00', h21 = '21:00', h22 = '22:00', h23 = '23:00', h00 = '00:00'

asSH    = input.bool(true , '', inline='AS' , group = sesGR)
asST    = input.string('Asia' , '', inline='AS' , group = sesGR)
asSRT   = input.string(h09, '' , options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='AS', group = sesGR)
asEND   = input.string(h18, '-', options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='AS', group = sesGR)
asC     = input.color(color.new(color.yellow, 0), '  ', inline='AS1', group = sesGR)
asMMP   = input.bool (true, 'Extend : Max/Min | Mid', inline = 'AS1', group = sesGR)
asSM    = input.bool(false , '', inline = 'AS1', group = sesGR)
asBG    = input.bool (true, 'Fill', inline = 'AS1', group = sesGR)

ldnSH   = input.bool(true , ''  , inline='LDN' , group = sesGR)
ldnST   = input.string('London' , '', inline='LDN' , group = sesGR)
ldnSRT  = input.string(h08, '' , options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='LDN', group = sesGR)
ldnEND  = input.string(h17, '-', options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='LDN', group = sesGR)
ldnC    = input.color(color.new(color.blue, 0), '  ', inline='LDN1', group = sesGR)
ldnMMP  = input.bool (true, 'Extend : Max/Min | Mid', inline = 'LDN1', group = sesGR)
ldnSM   = input.bool(false , '', inline = 'LDN1', group = sesGR)
ldnBG   = input.bool (true, 'Fill', inline = 'LDN1', group = sesGR)

nyamSH  = input.bool(true , ''  , inline='NYA' , group = sesGR)
nyamST  = input.string('NY AM' , '', inline='NYA' , group = sesGR)
nyamSRT = input.string(h08, '' , options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='NYA', group = sesGR)
nyamEND = input.string(h13, '-', options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='NYA', group = sesGR)
nyamC   = input.color(color.new(color.orange, 0), '  ', inline='NYA1', group = sesGR)
nyamMMP = input.bool (true, 'Extend : Max/Min | Mid', inline = 'NYA1', group = sesGR)
nyamSM  = input.bool(false , '', inline = 'NYA1', group = sesGR)
nyamBG  = input.bool (true, 'Fill', inline = 'NYA1', group = sesGR)

nypmSH  = input.bool(true , ''  , inline='NYP' , group = sesGR)
nypmST  = input.string('NY PM' , '', inline='NYP' , group = sesGR)
nypmSRT = input.string(h13, '' , options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='NYP', group = sesGR)
nypmEND = input.string(h19, '-', options = [h00, h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23], inline='NYP', group = sesGR)
nypmC   = input.color(color.new(color.red, 0), '  ', inline='NYP1', group = sesGR)
nypmMMP = input.bool (true, 'Extend : Max/Min | Mid', inline = 'NYP1', group = sesGR)
nypmSM  = input.bool(false, '', inline = 'NYP1', group = sesGR)
nypmBG  = input.bool (true, 'Fill', inline = 'NYP1', group = sesGR)

nyDST   = input.bool(false , 'New York DST | London DST', inline = 'DST', group = sesGR, tooltip = 'New York - Daylight Saving Time (DST)\n *DST Start : Second Sunday in March at 2:00\n *DST End : First Sunday in November at 2:00\n\nLondon - Daylight saving time (DST)\n *DST Start : Last Sunday in March at 1:00\n *DST End : Last Sunday in October at 1:00')
ldnDST  = input.bool(false , '', inline = 'DST', group = sesGR)

sesDET  = input.bool(true , 'Sessions Extreme Lines | Sessions Names', inline = 'NAM', group = sesGR)
sesNM   = input.bool(true , '', inline = 'NAM', group = sesGR)
sesLNW  = input.int(1 , '  Session Lines Width', group = sesGR)
sesFT   = input.int(95, '  Session Fill Transparency', minval = 0, maxval = 100, group = sesGR)

mssGR   = 'Market Structure Shifts'
mssSH   = input.bool(false, 'Market Structure Shifts', group = mssGR)
mssLN   = input.int(8, "Detection Length", minval = 1, group = mssGR)
ppLCB   = input.color(color.new(color.teal, 0), 'Market Structure Shifts : Bullish', inline = 'MSS', group = mssGR)
ppLCS   = input.color(color.new(color.red, 0), 'Bearish', inline = 'MSS', group = mssGR)

fvgGR   = 'Fair Value Gaps'
fvgSH   = input.bool(false, 'Fair Value Gaps', group = fvgGR)
fvgTT   = 'The script displays the fair value gaps whose width is larger than a fixed-length atr (average true range) value multiplied by the value of the option.\n\n' + 
         'The option value set to 0 means no filtering is applied.\n\n' + 
         'Remark: no filtering will be applied for the first 144 (atr fixed-length) candles since the atr value won\'t be present'
fvgTH   = input.float(1, 'Fair Value Gap Width Filter', minval = 0, step = .1, tooltip = fvgTT, group = fvgGR)

fvgBC   = input.color(color.new(color.teal, 80), 'Bullish Imbalance', inline = 'FVG', group = fvgGR)
fvgSC   = input.color(color.new(color.red, 80), 'Bearish Imbalance', inline = 'FVG', group = fvgGR)

sesOTH  = 'Sessions Tabular View'
sesTSH  = input.bool(true , 'Sessions Tabular View'  , group = sesOTH, tooltip = 'Displays sessions tabular view\n - Date and Time,\n - Sessions Opening/Closing Countdown Timer and\n - Session Status')
hIfN    = input.bool(false, 'Hide if not Forex Market Instrument'  , group = sesOTH)
sesTS   = input.string("Small", "  Table Text Size", options = [ "Tiny", "Small", "Normal"], inline='STAT',group = sesOTH)
sesTS  := sesTS == "Small" ? size.small : sesTS == "Normal" ? size.normal : size.tiny
sesPOS  = input.string('Top Right', '', options = ['Top Left', 'Top Center', 'Top Right', 'Middle Right', 'Bottom Left', 'Bottom Center'], inline='STAT', group = sesOTH) 

//-----------------------------------------------------------------------------}
// User Defined Types
//-----------------------------------------------------------------------------{

type bar
    float o = open
    float h = high
    float l = low
    float c = close
    int   i = bar_index

type session 
    string  []  s
    float   []  oH
    float   []  cH
    int     []  tO

    line        lnSHp
    line        lnSMp
    line        lnSLp
    float       fSHp
    float       fSLp

    box         bzBX
    box         szBX
    bool        bzB
    bool        bsB
    bool        szB
    bool        ssB

    box         lbzBX
    box         lszBX
    bool        lbzB
    bool        lbsB
    bool        lszB
    bool        lssB

type pivotPoint
    float  h
    int    ht
    bool   hx 

    float  l
    int    lt
    bool   lx

type FVG
    box  [] uFVG

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()

tfM = timeframe.multiplier

var session S = session.new(
     array.new <string>  (na),
     array.new <float>   (na),
     array.new <float>   (na),
     array.new <int>     (na),
     line(na), line(na), line(na), na, na, box(na), box(na), 
     false, false, false, false,
     box(na), box(na), 
     false, false, false, false
 )

swpATR = ta.atr(21)

var pivotPoint pp = pivotPoint.new()
var shift = 0

var FVG fvg = FVG.new(array.new <box>  (na))
fvgATR = nz(ta.atr(144)) * fvgTH
var bool last = na 

if barstate.isfirst 
    S.s.push('Asia')  , S.oH.push(09), S.cH.push(14), S.tO.push(09)
    S.s.push('London'), S.oH.push(05), S.cH.push(13), S.tO.push(00)
    S.s.push('NY AM') , S.oH.push(08), S.cH.push(13), S.tO.push(-5)
    S.s.push('NY PM') , S.oH.push(13), S.cH.push(19), S.tO.push(-5)

//-----------------------------------------------------------------------------}
// Functions / Methods
//-----------------------------------------------------------------------------{

f_whatIsTheTime(_ses, _dst) =>
    TZ = 'Etc/UTC'
    DST = _dst ? 1 : 0
    utcTime = (S.tO.get(S.s.indexof(_ses)) + DST) * 3600000 + timenow
    [math.floor(utcTime / 3600000) % 24, math.floor(utcTime / 60000) % 60, math.floor(utcTime / 1000) % 60, dayofmonth(int(utcTime), TZ), month(int(utcTime), TZ), year(int(utcTime), TZ), dayofweek(int(utcTime), TZ)]

f_sesDet(_ses, _dst) =>
    [h, m, s, D, M, Y, A] = f_whatIsTheTime(_ses, _dst)

    ht = h < 10 ? '0' + str.tostring(h) : str.tostring(h)
    mt = m < 10 ? '0' + str.tostring(m) : str.tostring(m)
    st = s < 10 ? '0' + str.tostring(s) : str.tostring(s)
    Dt = D < 10 ? '0' + str.tostring(D) : str.tostring(D)
    Mt = M < 10 ? '0' + str.tostring(M) : str.tostring(M)
    Yt = str.tostring(Y)
    dateTime = Dt + '/' + Mt + '/' + Yt + '-' + ht + ':' + mt + ':' + st

    if A != 1 and A != 7
        SoH = S.oH.get(S.s.indexof(_ses))
        ScH = S.cH.get(S.s.indexof(_ses))
        market = if h >= SoH and h < ScH
            hc = ScH - h - 1
            mc = 60 - m - 1
            sc = 60 - s
            sct = sc < 10 ? '0' + str.tostring(sc) : str.tostring(sc)
            mct = mc < 10 ? '0' + str.tostring(mc) : str.tostring(mc)
            hct = hc < 10 ? '0' + str.tostring(hc) : str.tostring(hc)
            closes = hct + ':' + mct + ':' + sct
            if hc == 0
                sc % 2 == 0 ? dateTime + ' 🟢 Closes in ' + closes : dateTime + ' 🔴 Closes in ' + closes
            else
                dateTime + ' 🟢 Closes in ' + closes
        else
            ho = if h < SoH
                SoH - h - 1
            else
                24 - h + SoH - 1
            mo = 60 - m - 1
            so = 60 - s
            sot = so < 10 ? '0' + str.tostring(so) : str.tostring(so)
            mot = mo < 10 ? '0' + str.tostring(mo) : str.tostring(mo)
            hot = ho < 10 ? '0' + str.tostring(ho) : str.tostring(ho)
            opens = hot + ':' + mot + ':' + sot
            if h >= ScH and A == 6
                dateTime + ' 🟠 Weekend'
            else
                if ho == 0
                    so % 2 == 0 ? dateTime + ' 🔴 Opens in ' + opens : dateTime + ' 🟢 Opens in ' + opens
                else
                    dateTime + ' 🔴 Opens in ' + opens
        market
    else
        dateTime + ' 🟠 Weekend'

f_gSesI( _ses, _dst) =>
    TZ  = 'Etc/UTC'
    DST = _dst ? 1 : 0
    SES = S.s.indexof(_ses)
    utcTime = (S.tO.get(SES) + DST) * 3600000 + time
    h = math.floor(utcTime / 3600000) % 24

    h >= S.oH.get(SES) and h < S.cH.get(SES)

f_pSWP(_show, _cSes, _sSes, _dst, _cC, _mm, _bg, _sM) =>
    var line lnSHc = na, var line lnSLc = na, var box bxSTc = na
    var line llnSHc = na, var line llnSLc = na, var line llnSMc = na

    if _show 
        cSES = f_gSesI(_cSes, _dst)

        if cSES and cSES != cSES[1]
            lnSHc := line.new(b.i, b.h, b.i, b.h, xloc.bar_index, extend.none, color.new(_cC, sesDET ? 0 : sesFT), line.style_solid, sesLNW)
            lnSLc := line.new(b.i, b.l, b.i, b.l, xloc.bar_index, extend.none, color.new(_cC, sesDET ? 0 : sesFT), line.style_solid, sesLNW)
           
            if _bg
                linefill.new(lnSHc, lnSLc, color.new(_cC, sesFT))

            if sesNM
                bxSTc := box.new (b.i, b.l, b.i, b.l, text = _cSes, text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_top, 
                               text_color = color.new(_cC, 25), bgcolor = color(na), border_color = color(na))

        if cSES
            lnSHc.set_y1(math.max(b.h, lnSHc.get_y1())), lnSHc.set_y2(math.max(b.h, lnSHc.get_y2())), lnSHc.set_x2(b.i)
            lnSLc.set_y1(math.min(b.l, lnSLc.get_y1())), lnSLc.set_y2(math.min(b.l, lnSLc.get_y2())), lnSLc.set_x2(b.i)

            if sesNM
                bxSTc.set_bottom(math.min(b.l, lnSLc.get_y1())), bxSTc.set_top(math.min(b.l, lnSLc.get_y1()))

        if not cSES and cSES != cSES[1]
            S.lnSHp := line.new(b.i - 1, lnSHc.get_y1(), b.i, lnSHc.get_y2(), xloc.bar_index, extend.none, _mm ? _cC : color(na), line.style_dotted, sesLNW)
            S.lnSMp := line.new(b.i - 1, math.avg(lnSHc.get_y1(), lnSLc.get_y1()), b.i, math.avg(lnSHc.get_y2(), lnSLc.get_y2()), xloc.bar_index, extend.none, _sM ? _cC : color(na), line.style_dotted, sesLNW)
            S.lnSLp := line.new(b.i - 1, lnSLc.get_y1(), b.i, lnSLc.get_y2(), xloc.bar_index, extend.none, _mm ? _cC : color(na), line.style_dotted, sesLNW)

            S.bsB := false, S.bzB := false
            S.ssB := false, S.szB := false

            if _cSes == ldnST and nyamSH
                S.fSHp := lnSHc.get_y1()
                S.fSLp := lnSLc.get_y1()
                llnSHc := line.new(b.i - 1, S.fSHp, b.i, S.fSHp, xloc.bar_index, extend.none, _mm ? _cC : color(na), line.style_dotted, sesLNW)
                llnSMc := line.new(b.i - 1, math.avg(S.fSHp, S.fSLp), b.i, math.avg(S.fSHp, S.fSLp), xloc.bar_index, extend.none, _sM ? _cC : color(na), line.style_dotted, sesLNW)
                llnSLc := line.new(b.i - 1, S.fSLp, b.i, S.fSLp, xloc.bar_index, extend.none, _mm ? _cC : color(na), line.style_dotted, sesLNW)
                S.lbsB := false, S.lbzB := false
                S.lssB := false, S.lszB := false
            else if _cSes == nypmST
                S.fSHp := 10e6
                S.fSLp := 0

        if not cSES
            S.lnSHp.set_x2(b.i - 1)
            S.lnSMp.set_x2(b.i - 1)
            S.lnSLp.set_x2(b.i - 1)

            if _cSes == ldnST and S.fSLp != 0
                llnSHc.set_x2(b.i - 1)
                llnSMc.set_x2(b.i - 1)
                llnSLc.set_x2(b.i - 1)

    if swpBZ
        pSH = S.lnSHp.get_y1()

        if not S.bsB

            if b.h > pSH and b.o < pSH
                alert(syminfo.ticker + ' buyside session level breached, price ' + str.tostring(b.c, format.mintick) + ', timeframe ' + timeframe.period, alert.freq_once_per_bar)
                S.bzBX := box.new (b.i - 1, math.min(pSH + swpBM * swpATR, b.h), b.i + 1, pSH, bgcolor = swpBC, border_color = color(na))

                S.bzB := true
                S.bsB := true

        else if S.bzB

            if b.l > pSH - swpBM * swpATR and b.h < pSH + swpBM * swpATR
                S.bzBX.set_top(math.max(b.h, S.bzBX.get_top()))

                if b.h > pSH
                    S.bzBX.set_right(b.i + 1)
                na
            else
                if b.c > pSH + swpBM * swpATR * 1.5
                    S.bzBX.set_bgcolor(swpHF ? color(na) : swpFC)
                    S.bzBX.set_right(b.i)
                    S.bzB := false
                else if b.i - S.bzBX.get_right() >= swpML
                    if b.h > pSH + swpBM * swpATR
                        S.bzBX.set_bgcolor(swpHF ? color(na) : swpFC)
                        S.bzBX.set_right(b.i + 1)

                    S.bzB := false
                    if not swpDT
                        S.bsB := false

        if _cSes == ldnST and nyamSH
            lpSH = S.fSHp

            if not S.lbsB

                if b.h > lpSH and b.o < lpSH
                    alert(syminfo.ticker + ' buyside session level breached, price ' + str.tostring(b.c, format.mintick) + ', timeframe ' + timeframe.period, alert.freq_once_per_bar)
                    S.lbzBX := box.new (b.i - 1, math.min(lpSH + swpBM * swpATR, b.h), b.i + 1, lpSH, bgcolor = swpBC, border_color = color(na))

                    S.lbzB := true
                    S.lbsB := true

            else if S.lbzB

                if b.l > lpSH - swpBM * swpATR and b.h < lpSH + swpBM * swpATR
                    S.lbzBX.set_top(math.max(b.h, S.lbzBX.get_top()))

                    if b.h > lpSH
                        S.lbzBX.set_right(b.i + 1)
                    na
                else
                    if b.c > lpSH + swpBM * swpATR * 1.5
                        S.lbzBX.set_bgcolor(swpHF ? color(na) : swpFC)
                        S.lbzBX.set_right(b.i)
                        S.lbzB := false
                    else if b.i - S.lbzBX.get_right() >= swpML
                        if b.h > lpSH + swpBM * swpATR
                            S.lbzBX.set_bgcolor(swpHF ? color(na) : swpFC)
                            S.lbzBX.set_right(b.i + 1)

                        S.lbzB := false
                        if not swpDT
                            S.lbsB := false

    if swpSZ
        pSL = S.lnSLp.get_y1()

        if not S.ssB

            if b.l < pSL and b.o > pSL
                alert(syminfo.ticker + ' sellside session level breached, price ' + str.tostring(b.c, format.mintick) + ', timeframe ' + timeframe.period, alert.freq_once_per_bar)
                S.szBX := box.new (b.i - 1, pSL, b.i + 1, math.max(pSL - swpSM * swpATR, b.l), bgcolor = swpSC, border_color = color(na))

                S.szB := true
                S.ssB := true

        else if S.szB

            if b.l > pSL - swpSM * swpATR and b.h < pSL + swpSM * swpATR
                S.szBX.set_bottom(math.min(b.l, S.szBX.get_bottom()))

                if b.l < pSL
                    S.szBX.set_right(b.i + 1)
                na
            else
                if b.c < pSL - swpSM * swpATR * 1.5
                    S.szBX.set_bgcolor(swpHF ? color(na) : swpFC)
                    S.szBX.set_right(b.i + 1)
                    S.szB := false
                else if b.i - S.szBX.get_right() >= swpML
                    if b.l < pSL - swpSM * swpATR
                        S.szBX.set_bgcolor(swpHF ? color(na) : swpFC)
                        S.szBX.set_right(b.i + 1)

                    S.szB := false
                    if not swpDT
                        S.ssB := false

        if _cSes == ldnST and nyamSH
            lpSL = S.fSLp

            if not S.lssB

                if b.l < lpSL and b.o > lpSL
                    alert(syminfo.ticker + ' sellside session level breached, price ' + str.tostring(b.c, format.mintick) + ', timeframe ' + timeframe.period, alert.freq_once_per_bar)
                    S.lszBX := box.new (b.i - 1, lpSL, b.i + 1, math.max(lpSL - swpSM * swpATR, b.l), bgcolor = swpSC, border_color = color(na))

                    S.lszB := true
                    S.lssB := true

            else if S.lszB

                if b.l > lpSL - swpSM * swpATR and b.h < lpSL + swpSM * swpATR
                    S.lszBX.set_bottom(math.min(b.l, S.lszBX.get_bottom()))

                    if b.l < lpSL
                        S.lszBX.set_right(b.i + 1)
                    na
                else
                    if b.c < lpSL - swpSM * swpATR * 1.5
                        S.lszBX.set_bgcolor(swpHF ? color(na) : swpFC)
                        S.lszBX.set_right(b.i)
                        S.lszB := false
                    else if b.i - S.lszBX.get_right() >= swpML
                        if b.l < lpSL - swpSM * swpATR
                            S.lszBX.set_bgcolor(swpHF ? color(na) : swpFC)
                            S.lszBX.set_right(b.i + 1)

                        S.lszB := false
                        if not swpDT
                            S.lssB := false

method clear(FVG _id) =>
    _id.uFVG.pop()

method fvgUpdate(FVG _id, _h, _l, _p) =>
    cUB = _id.uFVG.get(0)
    tUB = cUB.get_top()
    bUB = cUB.get_bottom()

    if _h > bUB and _l < tUB
        if _p
            if _l > bUB
                na
            else
                fvg.clear()

        else
            if _h < tUB
                na
            else
                fvg.clear()

    cUB.set_right(b.i)

//-----------------------------------------------------------------------------}
// Calculations - Sessions Tabular View
//-----------------------------------------------------------------------------{

S.s.set(0, asST)
S.oH.set(S.s.indexof(asST)  , str.tonumber(str.substring(asSRT  , 0, str.pos(asSRT  , ":"))))
S.cH.set(S.s.indexof(asST)  , str.tonumber(str.substring(asEND  , 0, str.pos(asEND  , ":"))))

S.s.set(1, ldnST)
S.oH.set(S.s.indexof(ldnST), str.tonumber(str.substring(ldnSRT , 0, str.pos(ldnSRT , ":"))))
S.cH.set(S.s.indexof(ldnST), str.tonumber(str.substring(ldnEND , 0, str.pos(ldnEND , ":"))))

S.s.set(2, nyamST)
S.oH.set(S.s.indexof(nyamST) , str.tonumber(str.substring(nyamSRT, 0, str.pos(nyamSRT, ":"))))
S.cH.set(S.s.indexof(nyamST) , str.tonumber(str.substring(nyamEND, 0, str.pos(nyamEND, ":"))))

S.s.set(3, nypmST)
S.oH.set(S.s.indexof(nypmST) , str.tonumber(str.substring(nypmSRT, 0, str.pos(nypmSRT, ":"))))
S.cH.set(S.s.indexof(nypmST) , str.tonumber(str.substring(nypmEND, 0, str.pos(nypmEND, ":"))))

forex_n_cdf  = syminfo.type == 'forex' or syminfo.type == 'cfd'

statPosition = switch sesPOS
    'Top Left'      => position.top_left
    'Top Center'    => position.top_center
    'Top Right'     => position.top_right
    'Middle Right'  => position.middle_right
    'Bottom Left'   => position.bottom_left
    'Bottom Center' => position.bottom_center

hide = hIfN ? forex_n_cdf ? true : false : true

if barstate.islast and sesTSH and hide
    var table clock = table.new(statPosition, 3, 4, border_width = 3)

    ses = f_sesDet(asST, false)
    sesC = str.contains(ses, 'Closes') ? #26a69a : #ef5350
    table.cell(clock, 0, 0, "█", text_size = sesTS, text_color = asC)
    table.cell(clock, 1, 0, asST , text_color = asC, bgcolor = color.new(asC, 75), text_halign = text.align_left, text_size = sesTS)
    table.cell(clock, 2, 0, ses, text_color = sesC, bgcolor = color.new(sesC, 75), text_halign = text.align_left, text_size = sesTS)

    ses := f_sesDet(ldnST, ldnDST)
    sesC := str.contains(ses, 'Closes') ? #26a69a : #ef5350
    table.cell(clock, 0, 1, "█", text_size = sesTS, text_color = ldnC)
    table.cell(clock, 1, 1, ldnST , text_color = ldnC, bgcolor = color.new(ldnC, 75), text_halign = text.align_left, text_size = sesTS)
    table.cell(clock, 2, 1, ses, text_color = sesC, bgcolor = color.new(sesC, 75), text_halign = text.align_left, text_size = sesTS)

    ses := f_sesDet(nyamST, nyDST)
    sesC := str.contains(ses, 'Closes') ? #26a69a : #ef5350
    table.cell(clock, 0, 2, "█", text_size = sesTS, text_color = nyamC)
    table.cell(clock, 1, 2, nyamST , text_color = nyamC, bgcolor = color.new(nyamC, 75), text_halign = text.align_left, text_size = sesTS)
    table.cell(clock, 2, 2, ses, text_color = sesC , bgcolor = color.new(sesC, 75), text_halign = text.align_left, text_size = sesTS)

    ses := f_sesDet(nypmST, nyDST)
    sesC := str.contains(ses, 'Closes') ? #26a69a : #ef5350
    table.cell(clock, 0, 3, "█", text_size = sesTS, text_color = nypmC)
    table.cell(clock, 1, 3, nypmST, text_color = nypmC, bgcolor = color.new(nypmC, 75), text_halign = text.align_left, text_size = sesTS)
    table.cell(clock, 2, 3, ses, text_color = sesC , bgcolor = color.new(sesC, 75), text_halign = text.align_left, text_size = sesTS)

//-----------------------------------------------------------------------------}
// Calculations - Sessions
//-----------------------------------------------------------------------------{

if timeframe.isintraday and tfM <= 5
    f_pSWP(asSH  , asST  , ldnSH  ? ldnST  : nyamSH ? nyamST : nypmSH ? nypmST : asST  , false , asC  , asMMP  , asBG  , asSM  )
    f_pSWP(ldnSH , ldnST , nypmSH ? nypmST : asSH   ? asST   : ldnST , ldnDST, ldnC , ldnMMP , ldnBG , ldnSM )
    f_pSWP(nyamSH, nyamST, nypmSH ? nypmST : asSH   ? asST   : ldnSH  ? ldnST  : nyamST, nyDST , nyamC, nyamMMP, nyamBG, nyamSM)
    f_pSWP(nypmSH, nypmST, asSH   ? asST   : ldnSH  ? ldnST  : nyamSH ? nyamST : nypmST, nyDST , nypmC, nypmMMP, nypmBG, nypmSM) 
else
    var table note = table.new(position.bottom_right, 1, 1)
    if barstate.islast
        table.cell(note, 0, 0, 'Session Sweeps are supported on:       \n 1 min, 3 mins and 5 mins charts\n\n', text_size=size.small, text_color=chart.fg_color)

//-----------------------------------------------------------------------------}
// Calculations - Market Structure Shifts
//-----------------------------------------------------------------------------{

pp_h = ta.pivothigh(mssLN, mssLN)
pp_l = ta.pivotlow (mssLN, mssLN)

if not na(pp_h)
    pp.h  := pp_h
    pp.hx := false
    pp.ht := b.i - mssLN

if not na(pp_l)
    pp.l  := pp_l
    pp.lx := false
    pp.lt := b.i - mssLN

if mssSH
    if b.c > pp.h and not pp.hx
        pp.hx := true

        if shift == -1
            line.new(pp.ht, pp.h, b.i, pp.h, color = ppLCB)
            box.new (pp.ht, pp.h, b.i, pp.h, text = 'CHoCH', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_bottom, 
                      text_color = ppLCB, bgcolor = color(na), border_color = color(na))
        shift := 1

    if b.c < pp.l and not pp.lx
        pp.lx := true

        if shift == 1
            line.new(pp.lt, pp.l, b.i, pp.l, color = ppLCS)
            box.new (pp.lt, pp.l, b.i, pp.l, text = 'CHoCH', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_top, 
                      text_color = ppLCS, bgcolor = color(na), border_color = color(na))
        shift := -1

//-----------------------------------------------------------------------------}
// Calculations - Fair Value Gaps
//-----------------------------------------------------------------------------{

if fvgSH
    bullG = b.l > b.h[1]
    bearG = b.h < b.l[1]

    bull  = (b.l - b.h[2]) > fvgATR and b.l > b.h[2] and b.c[1] > b.h[2] and not (bullG or bullG[1])

    if bull 
        if fvg.uFVG.size() > 0
            fvg.clear()

        fvg.uFVG.push(box.new (b.i - 1, b.l, b.i, b.h[2], na, bgcolor = fvgBC))

        last := true

    bear  = (b.l[2] - b.h) > fvgATR and b.h < b.l[2] and b.c[1] < b.l[2] and not (bearG or bearG[1])

    if bear 
        if fvg.uFVG.size() > 0
            fvg.clear()

        fvg.uFVG.push(box.new (b.i - 1, b.l[2], b.i, b.h, na, bgcolor = fvgSC))

        last := false

    if bullG or bearG
        if fvg.uFVG.size() > 0
            fvg.clear()

    if fvg.uFVG.size() > 0
        fvg.fvgUpdate(b.h, b.l, last)

//-----------------------------------------------------------------------------}