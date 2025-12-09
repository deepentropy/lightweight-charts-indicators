// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5
indicator("ICT Immediate Rebalance Toolkit [LuxAlgo]", "LuxAlgo - ICT Immediate Rebalance Toolkit", overlay = true,  max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500, max_bars_back = 3000)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
disp  = display.all - display.status_line

irGR  = 'Immediate Rebalances'
irSH  = input.bool(true, 'Immediate Rebalances', group = irGR)
irBC  = input.color(color.new(#5b9cf6, 1), '  Bullish Immediate Rebalance', group = irGR)
irSC  = input.color(color.new(#ffb74d, 1), '  Bearish Immediate Rebalance', group = irGR)
irL75 = input.color(color.new(#b2b5be, 1), '  Wicks 75%', inline = 'IR' , group = irGR)
irL50 = input.color(color.new(#d1d4dc, 1), '50%', inline = 'IR' , group = irGR)
irL25 = input.color(color.new(#b2b5be, 1), '25%', inline = 'IR' , group = irGR)
itCTT = 'Specifies the number of bars required to confirm the validation of the detected immediate rebalance.\n\n' +
         'It\'s important to highlight that both failed and successful immediate rebalances, when considered within a context, are significant signatures in trading.'
irCFR = input.int(2, '  Confirmation (Bars)', minval = 1, maxval = 5, group = irGR, tooltip = itCTT, display = disp)
irSZ  = input.string('Normal', '  Immediate Rebalance Icon', options = ['Small', 'Normal', 'Large'], group = irGR, display = disp)

liqGR = 'Buyside/Sellside Liquidity'
liqSH = input(true, 'Buyside/Sellside Liquidity', group = liqGR)
liqTT = 'This option is to identify liquidity levels from higher timeframes. If a timeframe lower than the chart\'s timeframe is selected, calculations will be based on the chart\'s timeframe.'
liqTF = input.string('Chart', '  Timeframe', options=['Chart', '5 Minutes', '15 Minutes', '1 Hour', '4 Hours', '1 Day'], group = liqGR, display = disp, tooltip = liqTT)
liqLN = input.int(7, title = '  Detection Length', minval = 3, maxval = 13, group = liqGR, display = disp)
liqMR = 10 / input.float (6.9, '  Margin', minval = 4, maxval = 9, step = 0.1, group = liqGR, display = disp)
liqBC = input.color(#089981, '  Buyside Liquidity', group = liqGR)
liqSC = input.color(#f23645, '  Sellside Liquidity',  group = liqGR)
liqVL = input.int(3, '  Visible Liquidity Levels', minval = 1, maxval = 50, group = liqGR, display = disp)

obbGR  = 'Order Blocks & Breaker Blocks'
obSH   = input.bool(true, 'Order Blocks', group = obbGR)
bbSH   = input.bool(false, 'Breaker Blocks', group = obbGR)
obbLN  = input.int(7, '  Swing Detection Length', minval = 3, group = obbGR, display = disp)
obbMT  = input.string('Closing Price', '  Mitigation Price', options = ['Closing Price', 'Wick'], group = obbGR, display = disp)
obbMP  = obbMT == 'Closing Price'
obbUB  = input(false, 'Use Candle Body in Detection', group = obbGR)
obbR   = input.bool(false, 'Remove Mitigated Order & Breaker Blocks', group = obbGR)
obCb   = input(color.new(#2157f3, 90), '  Order Blocks  : Bullish'   , inline = 'OBC', group = obbGR)
obCa   = input(color.new(#ff5d00, 90), 'Bearish'   , inline = 'OBC', group = obbGR)
bbCb   = input(color.new(#ff1100, 90), '  Breaker Blocks : Bullish', inline = 'BBC', group = obbGR)
bbCa   = input(color.new(#0cb51a, 90), 'Bearish', inline = 'BBC', group = obbGR)
obbVL  = input.int(1, '  Visible Order & Breaker Blocks', minval = 1, maxval = 50, group = obbGR, display = disp)
obbTX  = input.bool(true, 'Order & Breaker Blocks Labels', inline = 'SZ', group = obbGR)
obbLSZ = input.string('Small', '', options = ['Tiny', 'Small', 'Normal'], inline = 'SZ', group = obbGR, display = disp)

lqvGR = 'Liquidity Voids'
lqvSH = input.bool (false, 'Liquidity Voids', group = lqvGR)
lqvTT = 'The script showcases liquidity voids that exceed a predetermined length calculated by multiplying the fixed-average true range (ATR) value by the option\'s value.\n\n' + 
           'The option value set to 0 means no filtering is applied.\n\n' + 
           'Remark: No filtering will be implemented for the initial 144 candles based on the fixed-length ATR, as the ATR value won\'t be available during this period.'
lqvTH = input.float(.9, '  Liquidity Voids Width Filter', minval = 0, step = .1, tooltip = lqvTT, group = lqvGR, display = disp)
lqvGP = input.bool (false, 'Ignore Price Gaps', group = lqvGR)
lqvRM = input.bool (false, 'Remove Mitigated Liquidity Voids', group = lqvGR)
lqvBC = input.color (color.new(#4caf50, 87), '  Bullish Liquidity Voids', group = lqvGR)
lqvSC = input.color (color.new(#f23645, 87), '  Bearish Liquidity Voids', group = lqvGR)
lqvMC = input.color (color.new(#5d606b, 87), '  Mitigated Liquidity Voids', group = lqvGR)
lqvTX = input.bool (false, 'Liquidity Void Labels', group = lqvGR)

mcGR      = 'Macros'
//ldnST   = input.bool(false , 'London Daylight Saving Time (DST)', group = mcGR, tooltip = 'London : Daylight Saving Time (DST)\n - DST Start : Last Sunday in March at 1:00 UTC\n - DST End   : Last Sunday in October at 1:00 UTC')
m02330300 = input.bool(false, '02:33 AM 03:00 - LONDON ', inline = 'LND2', group = mcGR)
mcLDNC2   = input.color(color.new(#9c27b0, 89), '', inline = 'LND2', group = mcGR)

m04030430 = input.bool(false, '04:03 AM 04:30 - LONDON ', inline = 'LND4', group = mcGR)
mcLDNC4   = input.color(color.new(#9c27b0, 89), '', inline = 'LND4', group = mcGR)

m08500910 = input.bool(false, '08:50 AM 09:10 - NY AM  ', inline = 'NYA8', group = mcGR)
mcNYAMC8  = input.color(color.new(#00bcd4, 89), '', inline = 'NYA8', group = mcGR)

m09501010 = input.bool(false, '09:50 AM 10:10 - NY AM  ', inline = 'NYA9', group = mcGR)
mcNYAMC9  = input.color(color.new(#00bcd4, 89), '', inline = 'NYA9', group = mcGR)

m10501110 = input.bool(false, '10:50 AM 11:10 - NY AM  ', inline = 'NYA10', group = mcGR)
mcNYAMC10 = input.color(color.new(#00bcd4, 89), '', inline = 'NYA10', group = mcGR)

m11501210 = input.bool(false, '11:50 AM 12:10 - NY LAUNCH', inline = 'NYL', group = mcGR)
mcNYLC    = input.color(color.new(#ff5d00, 89), '', inline = 'NYL', group = mcGR)

m13101340 = input.bool(false, '13:10 PM 13:40 - NY PM  ', inline = 'NYP13', group = mcGR)
mcNYPMC13 = input.color(color.new(#2157f3, 89), '', inline = 'NYP13', group = mcGR)

m15151545 = input.bool(false, '15:15 PM 15:45 - NY PM  ', inline = 'NYP15', group = mcGR)
mcNYPMC15 = input.color(color.new(#2157f3, 89), '', inline = 'NYP15', group = mcGR)

//nyST      = input.bool(false , 'New York Daylight Saving Time (DST)', group = mcGR, tooltip = 'New York : Daylight Saving Time (DST)\n - DST Start : Second Sunday in March at 2:00\n - DST End   : First Sunday in November at 2:00')

mcTB   = input(true,   'Macro Top/Bottom Lines', inline = 'LN', group = mcGR)
extTT  = 'In this context, "extend" refers to the action of projecting or elongating the visual objects beyond the boundaries of the macros.'
mcLE   = input(true, 'Extend', inline = 'LN', group = mcGR, tooltip = extTT)
mcML   = input(false, 'Macro Mean Line',  group = mcGR)
mcLB   = input(true,  'Macro Labels', inline = 'ST', group = mcGR)
mcLSZ  = input.string('Small', '', options = ['Tiny', 'Small', 'Normal'], inline = 'ST', group = mcGR, display = disp)

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{
// @type        bar properties with their values 
//
// @field o     (float) open price of the bar
// @field h     (float) high price of the bar
// @field l     (float) low price of the bar
// @field c     (float) close price of the bar
// @field i     (int) index of the bar

type BAR
    float o = open
    float h = high
    float l = low
    float c = close
    int   i = bar_index
    int   t = time

type IR
    line    ln
    line    ln25
    line    ln50
    line    ln75
    label   lbE
    int     idx

// @type        used to store pivot high/low data 
//
// @field d     (array<int>) The array where the trend direction is to be maintained
// @field x     (array<int>) The array where the bar index value of pivot high/low is to be maintained
// @field y     (array<float>) The array where the price value of pivot high/low is to be maintained

type ZZ 
    int   [] d
    int   [] x 
    float [] y 

// @type        liquidity object definition 
//
// @field bx    (box) box maitaing the liquity level margin extreme levels
// @field bxt   (box) box maitaing the labels
// @field brL   (bool) mainains broken level status
// @field ln    (line) maitaing the liquity level line
// @field lne   (line) maitaing the liquity extended level line

type LIQ
    box   bx
    box   bxt
    bool  brL
    line  ln
    line  lne

type MACRO
    line  lnT
    line  lnM
    line  lnB
    label lb

type OB
    float top  = na
    float btm  = na
    int   obI  = bar_index
    line  lnCE
    line  lnTOP
    line  lnBTM
    box   bxOB
    bool  extend  = true

type BB
    line  lnCE
    line  lnTOP
    line  lnBTM
    box   bxOB
    box   bxBB
    bool  extend  = true
    bool  breaker = false

type SWING
    float y = na
    int   i = na
    bool  x = false

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{
BAR b = BAR.new()

//---------------------------------------------------------------------------------------------------------------------}
// Functions/Methods
//---------------------------------------------------------------------------------------------------------------------{
// @function        maintains arrays 
//                     it prepends a `value` to the arrays and removes their oldest element at last position
// @param aZZ       (UDT<array<int>, array<int>, array<float>>) The UDT obejct of arrays
// @param _d        (array<int>) The array where the trend direction is maintained
// @param _x        (array<int>) The array where the bar index value of pivot high/low is maintained
// @param _y        (array<float>) The array where the price value of pivot high/low is maintained
//
// @returns         none

method liqInOut(ZZ this, int _d, int _x, float _y) =>
    this.d.unshift(_d), this.x.unshift(_x), this.y.unshift(_y), this.d.pop(), this.x.pop(), this.y.pop()

method liqDelete(LIQ this) =>
    this.bx.delete(), this.bxt.delete(), this.ln.delete(), this.lne.delete()

method mcRender(MACRO _id, _s, _kz, _o, _h, _l, _c, _t, _cr, _tx, _mml, _ml, _lb, _le, _ts)=>
    var float max = na, var float mid = na, var float min = na 
    var int sbT = na, var bool xt = na, var bool xb = na
    var tC = color.rgb(color.r(_cr), color.g(_cr), color.b(_cr))
    
    if _s and not _s[1]
        max := _h
        sbT := _t
        min := _l
        mid := math.avg(max, min)

        if _mml
            _id.lnT := line.new(sbT, max, sbT, max, xloc.bar_time, color = tC)//, xt := true
            _id.lnB := line.new(sbT, min, sbT, min, xloc.bar_time, color = tC)//, xb := true

        if _ml
            _id.lnM := line.new(sbT, mid, sbT, mid, xloc.bar_time, color = tC, style = line.style_dotted)
        
        if _lb
            _id.lb := label.new(sbT, max, _tx, xloc.bar_time, color = #ffffff00, style = label.style_label_down, textcolor = tC, size = _ts)
    
    if _s
        max := math.max(_h, max)
        min := math.min(_l, min)
        mid := math.avg(max, min)
        xt := true
        xb := true

        if _lb
            label.set_x(_id.lb, int(math.avg(_t, sbT))), label.set_y(_id.lb, max)

        if _mml
            _id.lnT.set_y1(max), _id.lnT.set_xy2(_t, max)
            _id.lnB.set_y1(min), _id.lnB.set_xy2(_t, min)
        
        if _ml
            _id.lnM.set_y1(mid), _id.lnM.set_xy2(_t, mid)

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

method obbRender(OB this, left, top, right, bottom, color) =>
    this.bxOB.set_lefttop(left, top)
    this.bxOB.set_rightbottom(right, bottom)
    this.bxOB.set_bgcolor(color)
    this.bxOB.set_text_color(color.new(color, 0))

    this.lnTOP.set_xy1(left , top)
    this.lnTOP.set_xy2(right, top)
    this.lnTOP.set_color(color.new(color, 3))

    this.lnCE.set_xy1(left , math.avg(top, bottom))
    this.lnCE.set_xy2(right, math.avg(top, bottom))
    this.lnCE.set_color(color.new(color, 3))

    this.lnBTM.set_xy1(left , bottom)
    this.lnBTM.set_xy2(right, bottom)
    this.lnBTM.set_color(color.new(color, 3))

method obbSetRight(OB this, right) =>
    this.bxOB.set_right(right), this.lnTOP.set_x2(right), this.lnCE.set_x2(right), this.lnBTM.set_x2(right)

method obbDelete(OB this) =>
    this.bxOB.delete(), this.lnCE.delete(), this.lnTOP.delete(), this.lnBTM.delete()

method obbRender(BB this, left, top, right, bottom, color) =>
    this.bxBB.set_lefttop(left, top)
    this.bxBB.set_rightbottom(right, bottom)
    this.bxBB.set_bgcolor(color)
    this.bxBB.set_text_color(color.new(color, 0))

    this.lnTOP.set_xy1(left , top)
    this.lnTOP.set_xy2(right, top)
    this.lnTOP.set_color(color.new(color, 3))

    this.lnCE.set_xy1(left , math.avg(top, bottom))
    this.lnCE.set_xy2(right, math.avg(top, bottom))
    this.lnCE.set_color(color.new(color, 3))

    this.lnBTM.set_xy1(left , bottom)
    this.lnBTM.set_xy2(right, bottom)
    this.lnBTM.set_color(color.new(color, 3))

method obbSetRight(BB this, right) =>
    this.bxBB.set_right(right), this.lnTOP.set_x2(right), this.lnCE.set_x2(right), this.lnBTM.set_x2(right)

method obbDelete(BB this) =>
    this.bxOB.delete(), this.bxBB.delete(), this.lnCE.delete(), this.lnTOP.delete(), this.lnBTM.delete()


obbSwings(_l)=>
    var os = 0
    var SWING top = SWING.new(na, na)
    var SWING btm = SWING.new(na, na)
    
    upper = ta.highest(_l)
    lower = ta.lowest(_l)

    os := high[_l] > upper ? 0 : low[_l] < lower ? 1 : os

    if os == 0 and os[1] != 0
        top := SWING.new(high[_l], bar_index[_l])
    
    if os == 1 and os[1] != 1
        btm := SWING.new(low[_l], bar_index[_l])

    [top, btm]
    
max_bars_back(time, 1000)

//-----------------------------------------------------------------------------}
// Calculations - Immediate Rebalance
//-----------------------------------------------------------------------------{

[irSZl, irWTH] = switch irSZ 
    'Small'  => [size.small , 2]
    'Normal' => [size.normal, 2]
    => [size.large, 3]

var aIR = array.new<IR>()
var bIR = array.new<IR>()

if irSH
    
    bIRc  = b.l < b.h[2] and b.l > b.c[2] and b.c > b.h[2] and b.c[1] > b.h[2] and b.c > b.c[1]
    
    if bIRc

        bIR.unshift(IR.new(
             line.new(b.i[2], b.h[2], b.i, b.h[2], color = irBC, style = line.style_solid, width = irWTH),
             line.new(b.i[2], math.avg(b.h[2], math.avg(b.h[2], math.max(b.o[2], b.c[2]))), b.i, math.avg(b.h[2], math.avg(b.h[2], math.max(b.o[2], b.c[2]))), color = irL75, style = line.style_dotted, width = 1),
             line.new(b.i[2], math.avg(b.h[2], math.max(b.o[2], b.c[2])), b.i, math.avg(b.h[2], math.max(b.o[2], b.c[2])), color = irL50, style = line.style_solid, width = 1),
             line.new(b.i[2], math.avg(math.max(b.o[2], b.c[2]), math.avg(b.h[2], math.max(b.o[2], b.c[2]))), b.i, math.avg(math.max(b.o[2], b.c[2]),  math.avg(b.h[2], math.max(b.o[2], b.c[2]))), color = irL25, style = line.style_dotted, width = 1),
             label.new(b.i, b.h[2], '◥', textcolor = irBC, color = color(na), style = label.style_label_center, size = irSZl, tooltip = 'Bullish Immediate Rebalance'),
             b.i
             )
         ) 

    if bIR.size() > 0
        for i = bIR.size() - 1 to 0
            lF = bIR.get(i)
    
            if lF.idx + irCFR == b.i and barstate.isconfirmed and (b.l < lF.ln.get_y1())// or b.c[1] < lF.ln.get_y1())  // veya and (b.l < lF.ln.get_y1()
                lF.lbE.set_text('❌')
                lF.lbE.set_tooltip('Failed Bullish Immediate Rebalance')
                lF.lbE.set_size(size.normal)

            if lF.idx + irCFR < b.i
                bIR.remove(i)

    aIRc  = b.h > b.l[2] and b.h < b.c[2] and b.c < b.l[2] and b.c[1] < b.l[2] and b.c < b.c[1]
    
    if aIRc
    
        aIR.unshift(IR.new(
             line.new(b.i[2], b.l[2], b.i, b.l[2], color = irSC, style = line.style_solid, width = irWTH),
             line.new(b.i[2], math.avg(b.l[2], math.avg(b.l[2], math.min(b.o[2], b.c[2]))), b.i, math.avg(b.l[2], math.avg(b.l[2], math.min(b.o[2], b.c[2]))), color = irL75, style = line.style_dotted, width = 1),
             line.new(b.i[2], math.avg(b.l[2], math.min(b.o[2], b.c[2])), b.i, math.avg(b.l[2], math.min(b.o[2], b.c[2])), color = irL50, style = line.style_solid, width = 1),
             line.new(b.i[2], math.avg(math.min(b.o[2], b.c[2]), math.avg(b.l[2], math.min(b.o[2], b.c[2]))), b.i, math.avg(math.min(b.o[2], b.c[2]),math.avg(b.l[2], math.min(b.o[2], b.c[2]))), color = irL25, style = line.style_dotted, width = 1),
             label.new(b.i, b.l[2], text = '◢', textcolor = irSC, color = color(na), style = label.style_label_center, size = irSZl, tooltip = 'Bearish Immediate Rebalance'),
             b.i
             )
         ) 
    
    if aIR.size() > 0
        for i = aIR.size() - 1 to 0
            lF = aIR.get(i)
    
            if lF.idx + irCFR == b.i and barstate.isconfirmed and (b.h > lF.ln.get_y1())// or b.c[1] > lF.ln.get_y1())
                lF.lbE.set_text('❌')
                lF.lbE.set_tooltip('Failed Bearish Immediate Rebalance')
                lF.lbE.set_size(size.normal)

            if lF.idx + irCFR < b.i
                aIR.remove(i)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Macros
//---------------------------------------------------------------------------------------------------------------------{

var MACRO mc = MACRO.new()

tSZ =  mcLSZ == 'Tiny' ? size.tiny 
     : mcLSZ == 'Small' ? size.small 
     : size.normal

tfM   = timeframe.multiplier <= 15 and timeframe.isminutes
nyTZ  = 'UTC-5'//nyST ? 'UTC-5' : 'UTC-4'
ldnTZ = 'UTC-5'//ldnST ? 'UTC-5' : 'UTC-4'

Im02330300 = m02330300 and math.sign(nz(time(timeframe.period, '0233-0300', ldnTZ))) > 0
Im04030430 = m04030430 and math.sign(nz(time(timeframe.period, '0403-0430', ldnTZ))) > 0
Im08500910 = m08500910 and math.sign(nz(time(timeframe.period, '0850-0910', nyTZ))) > 0
Im09501010 = m09501010 and math.sign(nz(time(timeframe.period, '0950-1010', nyTZ))) > 0
Im10501110 = m10501110 and math.sign(nz(time(timeframe.period, '1050-1110', nyTZ))) > 0
Im11501210 = m11501210 and math.sign(nz(time(timeframe.period, '1150-1210', nyTZ))) > 0
Im13101340 = m13101340 and math.sign(nz(time(timeframe.period, '1310-1340', nyTZ))) > 0
Im15151545 = m15151545 and math.sign(nz(time(timeframe.period, '1515-1545', nyTZ))) > 0

inMC     = Im02330300 or Im04030430 or Im08500910 or Im09501010 or Im10501110 or Im11501210 or Im13101340 or Im15151545

bgcolor(Im02330300 and tfM ? mcLDNC2  : na, title = 'London Macro Background', editable = false)
bgcolor(Im04030430 and tfM ? mcLDNC4  : na, title = 'London Macro Background', editable = false)

bgcolor(Im08500910 and tfM ? mcNYAMC8  : na, title = 'New York AM Macro Background', editable = false)
bgcolor(Im09501010 and tfM ? mcNYAMC9  : na, title = 'New York AM Macro Background', editable = false)
bgcolor(Im10501110 and tfM ? mcNYAMC10 : na, title = 'New York AM Macro Background', editable = false)

bgcolor(Im11501210 and tfM ? mcNYLC : na, title = 'New York Launch Macro Background', editable = false)

bgcolor(Im13101340 and tfM ? mcNYPMC13 : na, title = 'New York PM Macro Background', editable = false)
bgcolor(Im15151545 and tfM ? mcNYPMC15 : na, title = 'New York PM Macro Background', editable = false)

mc.mcRender(Im02330300 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcLDNC2  , 'LONDON\n02:33 AM 03:00', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im04030430 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcLDNC4  , 'LONDON\n04:03 AM 04:30', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im08500910 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcNYAMC8 , 'NEW YORK AM\n08:50 AM 09:10', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im09501010 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcNYAMC9 , 'NEW YORK AM\n09:50 AM 10:10', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im10501110 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcNYAMC10, 'NEW YORK AM\n10:50 AM 11:10', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im11501210 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcNYLC   , 'NEW YORK LAUNCH\n11:50 AM 12:10', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im13101340 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcNYPMC13, 'NEW YORK PM\n13:10 PM 13:40', mcTB, mcML, mcLB, mcLE, tSZ)
mc.mcRender(Im15151545 and tfM, inMC, b.o, b.h, b.l, b.c, b.t, mcNYPMC15, 'NEW YORK PM\n15:15 PM 15:45', mcTB, mcML, mcLB, mcLE, tSZ)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Buyside/Sellside Liquidity
//---------------------------------------------------------------------------------------------------------------------{

maxSize = 50
var int dir = na, var int x1 = na, var float y1 = na, var int x2 = na, var float y2 = na

var ZZ aZZ = ZZ.new(
 array.new <int>  (maxSize,  0), 
 array.new <int>  (maxSize,  0), 
 array.new <float>(maxSize, na)
 )

var LIQ[] bsLIQ = array.new<LIQ> (1, LIQ.new(box(na), box(na), false, line(na), line(na)))
var LIQ[] ssLIQ = array.new<LIQ> (1, LIQ.new(box(na), box(na), false, line(na), line(na)))

int tf_m = switch 
    liqTF == "5 Minutes"  and timeframe.multiplier <= 5    => 5
    liqTF == "15 Minutes" and timeframe.multiplier <= 15   => 15
    liqTF == "1 Hour"     and timeframe.multiplier <= 60   => 60
    liqTF == "4 Hours"    and timeframe.multiplier <= 240  => 240
    liqTF == "1 Day"      and timeframe.multiplier <= 1440 => 1440
    => (timeframe.isdaily ? 1440 : timeframe.multiplier)

ch_m  = if timeframe.isintraday
    timeframe.multiplier
else if timeframe.isdaily
    1440

liqLN := timeframe.isdwm ? liqLN : liqLN * int(tf_m / ch_m)

liqATR  = ta.atr(10)

x2 := b.i - 1
ph  = ta.pivothigh(liqLN, 1)
pl  = ta.pivotlow (liqLN, 1)

if liqSH
    if not na(ph)   
        dir := aZZ.d.get(0) 
        x1  := aZZ.x.get(0) 
        y1  := aZZ.y.get(0) 
        y2  := nz(b.h[1])

        if dir < 1
            aZZ.liqInOut(1, x2, y2)
        else
            if dir == 1 and ph > y1 
                aZZ.x.set(0, x2), aZZ.y.set(0, y2)

        count = 0
        st_P  = 0.
        st_B  = 0
        minP  = 0.
        maxP  = 10e6

        for i = 0 to maxSize - 1
            if aZZ.d.get(i) ==  1 
                if aZZ.y.get(i) > ph + (liqATR / liqMR)
                    break
                else
                    if aZZ.y.get(i) > ph - (liqATR / liqMR) and aZZ.y.get(i) < ph + (liqATR / liqMR)
                        count += 1
                        st_B := aZZ.x.get(i)
                        st_P := aZZ.y.get(i)

                        if aZZ.y.get(i) > minP
                            minP := aZZ.y.get(i)
                        if aZZ.y.get(i) < maxP 
                            maxP := aZZ.y.get(i)

        if count > 2
            getB = bsLIQ.get(0)

            if st_B == getB.bx.get_left()
                getB.bx.set_top(math.avg(minP, maxP) + (liqATR / liqMR))
                getB.bx.set_rightbottom(b.i + 10, math.avg(minP, maxP) - (liqATR / liqMR))
            else
                bsLIQ.unshift(
                     LIQ.new(
                       box.new(st_B, math.avg(minP, maxP) + (liqATR / liqMR), b.i + 10, math.avg(minP, maxP) - (liqATR / liqMR), bgcolor = color(na), border_color = color(na)), 
                       box.new(st_B, st_P, b.i + 10, st_P, text = 'Buyside liquidity', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_bottom, text_color = color.new(liqBC, 17), bgcolor = color(na), border_color = color(na)),
                       false,
                       line.new(st_B   , st_P, b.i - 1, st_P, color = color.new(liqBC, 0)),
                       line.new(b.i - 1, st_P, na     , st_P, color = color.new(liqBC, 0), style = line.style_dotted))
                     )

            if bsLIQ.size() > liqVL
                getLast = bsLIQ.pop()
                getLast.liqDelete()

    if not na(pl)
        dir := aZZ.d.get (0) 
        x1  := aZZ.x.get (0) 
        y1  := aZZ.y.get (0) 
        y2  := nz(b.l[1])

        if dir > -1
            aZZ.liqInOut(-1, x2, y2)
        else
            if dir == -1 and pl < y1 
                aZZ.x.set(0, x2), aZZ.y.set(0, y2)

        count = 0
        st_P  = 0.
        st_B  = 0
        minP  = 0.
        maxP  = 10e6

        for i = 0 to maxSize - 1
            if aZZ.d.get(i) == -1 
                if aZZ.y.get(i) < pl - (liqATR / liqMR)
                    break
                else
                    if aZZ.y.get(i) > pl - (liqATR / liqMR) and aZZ.y.get(i) < pl + (liqATR / liqMR)
                        count += 1
                        st_B := aZZ.x.get(i)
                        st_P := aZZ.y.get(i)

                        if aZZ.y.get(i) > minP
                            minP := aZZ.y.get(i)
                        if aZZ.y.get(i) < maxP 
                            maxP := aZZ.y.get(i)

        if count > 2
            getB = ssLIQ.get(0)

            if st_B == getB.bx.get_left()
                getB.bx.set_top(math.avg(minP, maxP) + (liqATR / liqMR))
                getB.bx.set_rightbottom(b.i + 10, math.avg(minP, maxP) - (liqATR / liqMR))
            else
                ssLIQ.unshift(
                     LIQ.new(
                       box.new(st_B, math.avg(minP, maxP) + (liqATR / liqMR), b.i + 10, math.avg(minP, maxP) - (liqATR / liqMR), bgcolor = color(na), border_color = color(na)),
                       box.new(st_B, st_P, b.i + 10, st_P, text = 'Sellside liquidity', text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_top, text_color = color.new(liqSC, 17), bgcolor = color(na), border_color = color(na)),
                       false,
                       line.new(st_B   , st_P, b.i - 1, st_P, color = color.new(liqSC, 0)),
                       line.new(b.i - 1, st_P, na     , st_P, color = color.new(liqSC, 0), style = line.style_dotted))
                     )  

            if ssLIQ.size() > liqVL
                getLast = ssLIQ.pop()
                getLast.liqDelete()

    for i = 0 to bsLIQ.size() - 1
        x = bsLIQ.get(i)

        if not x.brL
            x.lne.set_x2(b.i)

            if b.h > x.bx.get_top()
                x.brL := true

    for i = 0 to ssLIQ.size() - 1
        x = ssLIQ.get(i)

        if not x.brL
            x.lne.set_x2(b.i)

            if b.l < x.bx.get_bottom()
                x.brL := true

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Order Blocks & Breaker Blocks
//---------------------------------------------------------------------------------------------------------------------{

var aOB = array.new<OB>(0)
var bOB = array.new<OB>(0)

var aBB = array.new<BB>(0)
var bBB = array.new<BB>(0)

[top, btm] = obbSwings(obbLN)
max = obbUB ? math.max(b.c, b.o) : b.h
min = obbUB ? math.min(b.c, b.o) : b.l

obbSZ =  obbLSZ == 'Tiny' ? size.tiny 
     : obbLSZ == 'Small' ? size.small 
     : size.normal

if obSH or bbSH
    if b.c[1] > top.y and not top.x
        top.x := true

        minima = max[1]
        maxima = min[1]
        sBT = b.t[1]

        for i = 1 to (b.i - top.i) - 1
            minima := math.min(min[i], minima)
            maxima := minima == min[i] ? max[i] : maxima
            sBT := minima == min[i] ? b.t[i] : sBT
            
        bOB.unshift(OB.new(maxima, minima, sBT, 
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_solid, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             box.new(na, na, na, na, color(na), xloc = xloc.bar_time,text = obbTX ? '+OB' : '', text_size = obbSZ, text_halign = text.align_center, text_valign = text.align_bottom, text_color = color.new(obCb, 0)))) 
        
        bBB.unshift(BB.new(
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_solid, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             box.new(na, na, na, na, color(na), xloc = xloc.bar_time, bgcolor = color(na)), 
             box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = obbTX ? '+BB' : '', text_size = obbSZ, text_halign = text.align_center, text_valign = text.align_top, text_color = color.new(bbCb, 0))))

    if b.c[1] < btm.y and not btm.x
        btm.x := true

        minima = min[1]
        maxima = max[1]
        sBT = b.t[1]

        for i = 1 to (b.i - btm.i) - 1
            maxima := math.max(max[i], maxima)
            minima := maxima == max[i] ? min[i] : minima
            sBT := maxima == max[i] ? b.t[i] : sBT

        aOB.unshift(OB.new(maxima, minima, sBT,
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_solid, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = obbTX ? '-OB' : '', text_size = obbSZ, text_halign = text.align_center, text_valign = text.align_top, text_color = color.new(obCa, 0)))) 
        
        aBB.unshift(BB.new(
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_solid, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             line.new(na, na, na, na, xloc.bar_time, color = color(na), style = line.style_dashed, width = 1),
             box.new(na, na, na, na, color(na), xloc = xloc.bar_time, bgcolor = color(na)), 
             box.new(na, na, na, na, color(na), xloc = xloc.bar_time, text = obbTX ? '-BB' : '', text_size = obbSZ, text_halign = text.align_center, text_valign = text.align_bottom, text_color = color.new(bbCa, 0))))

    if bOB.size() > 0
        for i = bOB.size() - 1 to 0
            ob = bOB.get(i)
            bb = bBB.get(i)

            if obbR 
                if not ob.extend
                    ob.obbDelete()

                if not bb.extend
                    bb.obbDelete()

            if not bb.breaker 
                if obSH
                    ob.obbRender(ob.obI, ob.top, b.t, ob.btm, obCb)

                if math.min((obbMP ? b.c[1] : b.l[1]), b.o[1]) < ob.btm
                    bb.breaker := true

                    if obSH
                        ob.obbSetRight(b.t[1])
                        ob.extend := false

                    if bbSH
                        bb.obbRender(b.t[1], ob.top, b.t, ob.btm, bbCb)

                        if not obSH or obbR
                            bb.bxOB.set_lefttop(ob.obI, ob.top)
                            bb.bxOB.set_rightbottom(b.t[1], ob.btm)
                            //bb.bxOB.set_bgcolor(color(na))
                            bb.bxOB.set_border_color(color.new(bbCb, 53))
            else
                if (obbMP ? b.c[1] : b.h[1]) > ob.top
                    bb.extend := false

                if obSH
                    ob.bxOB.set_bgcolor(obCb)
                    ob.bxOB.set_text_color(color.new(obCb, 0))

                if bbSH and bb.extend
                    bb.obbSetRight(b.t)

        if bOB.size() > obbVL
            ob = bOB.pop()
            ob.obbDelete()

        if bBB.size() > obbVL
            bb = bBB.pop()
            bb.obbDelete()

    if aOB.size() > 0
        for i = aOB.size() - 1 to 0
            ob = aOB.get(i)
            bb = aBB.get(i)

            if obbR 
                if not ob.extend
                    ob.obbDelete()

                if not bb.extend
                    bb.obbDelete()

            if not bb.breaker 
                if obSH
                    ob.obbRender(ob.obI, ob.top, b.t, ob.btm, obCa)

                if math.max((obbMP ? b.c[1] : b.h[1]), b.o[1]) > ob.top
                    bb.breaker := true

                    if obSH
                        ob.obbSetRight(b.t[1])
                        ob.extend := false

                    if bbSH
                        bb.obbRender(b.t[1], ob.top, b.t, ob.btm, bbCa)

                        if not obSH or obbR
                            bb.bxOB.set_lefttop(ob.obI, ob.top)
                            bb.bxOB.set_rightbottom(b.t[1], ob.btm)
                            //bb.bxOB.set_bgcolor(color(na))
                            bb.bxOB.set_border_color(color.new(bbCa, 53))
            else
                if (obbMP ? b.c[1] : b.l[1]) < ob.btm
                    bb.extend := false

                if obSH
                    ob.bxOB.set_bgcolor(obCa)
                    ob.bxOB.set_text_color(color.new(obCa, 0))

                if bbSH and bb.extend 
                    bb.obbSetRight(b.t)

        if aOB.size() > obbVL
            ob = aOB.pop()
            ob.obbDelete()

        if aBB.size() > obbVL
            bb = aBB.pop()
            bb.obbDelete()

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Liquidity Voids
//---------------------------------------------------------------------------------------------------------------------{

var LQV = array.new_box()

lqvATR  = ta.atr(144) * lqvTH
bullGap = b.l > b.h[1]
bearGap = b.h < b.l[1]

if lqvSH and last_bar_index - bar_index <=  500
    
    bLQV = b.l - b.h[2] > lqvATR and b.l > b.h[2] and b.c[1] > b.h[2] and (lqvGP ? not (bullGap or bullGap[1]) : true)
    aLQV = b.l[2] - b.h > lqvATR and b.h < b.l[2] and b.c[1] < b.l[2] and (lqvGP ? not (bearGap or bearGap[1]) : true)

    if bLQV 
        l = 13
        if bLQV[1] 
            stp = math.abs(b.l - b.l[1]) / l
            for i = 0 to l - 1
                LQV.push(box.new(b.i - 2, b.l[1] + i * stp, b.i, b.l[1] + (i + 1) * stp, border_color = na, bgcolor = lqvBC ))
        else   
            stp = math.abs(b.l - b.h[2]) / l
            for i = 0 to l - 1
                if lqvTX and i == 0
                    LQV.push(box.new(b.i - 2, b.h[2] + i * stp, b.i, b.h[2] + (i + 1) * stp, text = 'Liquidity Void   ', text_size = size.tiny, text_halign = text.align_right, text_valign = text.align_bottom, text_color = na, border_color = na, bgcolor = lqvBC ))
                else
                    LQV.push(box.new(b.i - 2, b.h[2] + i * stp, b.i, b.h[2] + (i + 1) * stp, border_color = na, bgcolor = lqvBC ))

    if aLQV
        l = 13
        if aLQV[1]
            stp = math.abs(b.h[1] - b.h) / l
            for i = 0 to l - 1
                LQV.push(box.new(b.i - 2, b.h + i * stp, b.i, b.h + (i + 1) * stp, border_color = na, bgcolor = lqvSC ))
        else
            stp = math.abs(b.l[2] - b.h) / l
            for i = 0 to l - 1
                if lqvTX and i == l - 1
                    LQV.push(box.new(b.i - 2, b.h + i * stp, b.i, b.h + (i + 1) * stp, text = 'Liquidity Void   ', text_size = size.tiny, text_halign = text.align_right, text_valign = text.align_top, text_color = na, border_color = na, bgcolor = lqvSC ))
                else
                    LQV.push(box.new(b.i - 2, b.h + i * stp, b.i, b.h + (i + 1) * stp, border_color = na, bgcolor = lqvSC ))

if LQV.size() > 0

    qt = LQV.size()

    for bxNO = qt - 1 to 0
        if bxNO < LQV.size()
            cBX = LQV.get(bxNO)
            bxAVG = math.avg(cBX.get_bottom(), cBX.get_top())

            if math.sign(b.c[1] - bxAVG) != math.sign(b.c - bxAVG) or math.sign(b.c[1] - bxAVG) != math.sign(b.l - bxAVG) or math.sign(b.c[1] - bxAVG) != math.sign(b.h - bxAVG)
                LQV.remove(bxNO)
                cBX.set_bgcolor(lqvMC)

                if lqvRM
                    cBX.delete()
            else
                cBX.set_right(b.i + 1)
                
                if b.i - cBX.get_left() > 21
                    cBX.set_text_color(color.new(chart.fg_color, 7))

//---------------------------------------------------------------------------------------------------------------------}