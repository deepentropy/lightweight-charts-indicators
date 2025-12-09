// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © LeviathanCapital

//@version=5
indicator("Swing Points and Liquidity - By Leviathan", overlay=true, max_boxes_count=500, max_lines_count=500, max_labels_count = 500)

// Inputs
swingSizeR       = input.int(10, 'Bars Right-Left', inline='brl')
swingSizeL       = input.int(15, '-', inline='brl')
showBoxes        = input.bool(true, 'Show Boxes ', inline='aa')
showSwingLines   = input.bool(true, 'Show Lines', inline='aa')
showBubbles      = input.bool(true, 'Show Labels ', inline='bb')
showVol          = input.bool(false, 'Show Volume', inline='bb')
showOId          = input.bool(false, 'Show OI Δ   ', inline='cc')
extendtilfilled  = input.bool(true, 'Extend Until Fill', inline='cc')

// Conditions
hidefilled       = input.bool(false, 'Hide Filled', group='Conditions')
voltresh = input.int(0, 'Volume >', group='Conditions')
oitresh  = input.int(0, 'OI Δ (abs.) >',  group='Conditions')
pnoid   = input.string('/', 'Only Swings With', options = ['Positive OI Delta', 'Negative OI Delta', '/'], group='Conditions')
// Appearance inputs
showhighs        = input.bool(true, '', inline='sh', group='Appearance')
showlows         = input.bool(true, '', inline='sl', group='Appearance')
sellcol          = input.color(#aa2430, 'Lows (Line - Label - Box)', inline = 'sh', group='Appearance')
buycol           = input.color(#66bb6a, 'Highs (Line - Label - Box)', inline='sl', group='Appearance')
sellcolB         = input.color(#aa2430, '', inline='sh', group='Appearance')
buycolB          = input.color(#66bb6a, '', inline = 'sl', group='Appearance')
sellboxCol       = input.color(#80192231, '', inline = 'sh', group='Appearance')
buyboxCol        = input.color(#66bb6a31, '', inline='sl', group='Appearance')
lineStyle        = input.string('Dotted', 'Line Style + Width', ['Solid', 'Dashed', 'Dotted'], inline='l', group='Appearance')
lineWid          = input.int(1, '', inline='l', group='Appearance')
boxWid           = input.float(0.7, 'Box Width + Type ', step=0.1, inline='xx', group='Appearance')
boxStyle         = input.string('TYPE 1', '', options=['TYPE 1', 'TYPE 2'], inline='xx', group='Appearance')
labelsize        = input.string('Size: Tiny', 'Text Style        ', options = ['Size: Normal','Size: Large', 'Size: Small', 'Size: Tiny', 'Size: Auto' ], inline='txt', group = 'Appearance' )
texthalign       = input.string('Right','', options = ['Middle', 'Right', 'Left'], inline='txt', group = 'Appearance')
lookback         = input.bool(false, '', inline='lb')
daysBack         = input.float(150, 'Lookback (D)               ',inline='lb')
// OI Data
binance   = input.bool(true, 'Binance USDT.P', inline = 'src',  group = 'Open Interest')
binance2  = input.bool(true, 'Binance USD.P',  inline = 'src',  group = 'Open Interest')
binance3  = input.bool(true, 'Binance BUSD.P', inline = 'src2', group = 'Open Interest')
bitmex    = input.bool(true, 'BitMEX USD.P',   inline = 'src2', group = 'Open Interest')
bitmex2   = input.bool(true, 'BitMEX USDT.P ', inline = 'src3', group = 'Open Interest')
kraken    = input.bool(true, 'Kraken USD.P',   inline = 'src3', group = 'Open Interest')

// Calculating inRange, used for lookback in days
MSPD             = 24 * 60 * 60 * 1000
lastBarDate      = timestamp(year(timenow), month(timenow), dayofmonth(timenow), hour(timenow), minute(timenow), second(timenow))
thisBarDate      = timestamp(year, month, dayofmonth, hour, minute, second)
daysLeft         = math.abs(math.floor((lastBarDate - thisBarDate) / MSPD))
inRange          = lookback ? (daysLeft < daysBack) : true

//Pivot calculations
int prevHighIndex= na, int prevLowIndex= na, bool highActive= false, bool lowActive= false, bool h= false, bool l= false
pivHi            = ta.pivothigh(high, swingSizeL, swingSizeR)
pivLo            = ta.pivotlow(low, swingSizeL, swingSizeR)

if not na(pivHi)
    h := true
    prevHighIndex := bar_index - swingSizeR
if not na(pivLo)
    l := true
    prevLowIndex  := bar_index - swingSizeR

// Getting OI data
mex =  syminfo.basecurrency=='BTC' ? 'XBT' : string(syminfo.basecurrency)
oid1 = nz(request.security('BINANCE' + ":" + string(syminfo.basecurrency) + 'USDT.P_OI',  timeframe.period,  close-close[1], ignore_invalid_symbol = true), 0)
oid2 = nz(request.security('BINANCE' + ":" + string(syminfo.basecurrency) + 'USD.P_OI',   timeframe.period,  close-close[1], ignore_invalid_symbol = true), 0)
oid3 = nz(request.security('BINANCE' + ":" + string(syminfo.basecurrency) + 'BUSD.P_OI',  timeframe.period,  close-close[1], ignore_invalid_symbol = true), 0)
oid4 = nz(request.security('BITMEX'  + ":" + mex                          + 'USD.P_OI',   timeframe.period,  close-close[1], ignore_invalid_symbol = true), 0)
oid5 = nz(request.security('BITMEX'  + ":" + mex                          + 'USDT.P_OI',  timeframe.period,  close-close[1], ignore_invalid_symbol = true), 0)
oid6 = nz(request.security('KRAKEN'  + ":" + string(syminfo.basecurrency) + 'USD.P_OI',   timeframe.period,  close-close[1], ignore_invalid_symbol = true), 0)

deltaOI   = (binance ? nz(oid1,0) : 0)   +   (binance2 ? nz(oid2,0)/close : 0)   +    (binance3 ? nz(oid3,0) : 0)    +   (bitmex ? nz(oid4,0)/close : 0)   +   (bitmex2 ? nz(oid5,0)/close : 0)   +   (kraken ? nz(oid6,0)/close : 0)




//Volume, OI, box width
vol         = volume[swingSizeR]

oitreshcond = oitresh > 0 ? math.abs(deltaOI[swingSizeR])>oitresh : true
voltreshcond = voltresh > 0 ? vol > voltresh : true
oicond = pnoid=='Positive OI Delta' ? deltaOI[swingSizeR]>0 : pnoid=='Negative OI Delta' ? deltaOI[swingSizeR]<0 : true

color CLEAR = color.rgb(0,0,0,100)
boxWid1     = 0.001 * boxWid


// Styles
boxStyle(x) =>
    switch x
        'TYPE 1' => h ? pivHi : l ? pivLo : na
        'TYPE 2' => h ? pivHi * (1 - boxWid1) : l ? pivLo * (1 + boxWid1) : na
lineStyle(x) =>
    switch x
        'Solid'  => line.style_solid
        'Dashed' => line.style_dashed
        'Dotted' => line.style_dotted
switchtextsize(textsize) =>
    switch textsize
        'Size: Normal'  => size.normal
        'Size: Small'   => size.small
        'Size: Tiny'    => size.tiny
        'Size: Auto'    => size.auto
        'Size: Large'   => size.large
switchhalign(texthalign) =>
    switch texthalign
        'Middle'        => text.align_center
        'Right'         => text.align_right
        'Left'          => text.align_left

//Swing level labels
var levelBoxes = array.new_box(), var levelLines = array.new_line()
if h and inRange and showhighs and oitreshcond and voltreshcond and oicond
    hBox    = box.new(prevHighIndex, pivHi * (1 + boxWid1), bar_index, boxStyle(boxStyle), border_color = na, bgcolor = showBoxes ? sellboxCol : CLEAR, text= (showVol ? str.tostring(vol, format.volume) : na) +' '+ (showOId ? str.tostring(deltaOI[swingSizeR], format.volume) : ''),text_halign=switchhalign(texthalign),text_valign=text.align_center,text_color=chart.fg_color, text_size=switchtextsize(labelsize))
    hLine   = line.new(prevHighIndex, pivHi, bar_index, pivHi, color = showSwingLines ? sellcol : CLEAR, style=lineStyle(lineStyle), width=lineWid)
    array.push(levelBoxes, hBox)
    array.push(levelLines, hLine)
if l and inRange and showhighs and oitreshcond and voltreshcond and oicond
    lBox    = box.new(prevLowIndex, pivLo * (1 - boxWid1), bar_index, boxStyle(boxStyle), border_color = na, bgcolor = showBoxes ? buyboxCol : CLEAR, text= (showVol ? str.tostring(vol, format.volume) : na) +' '+ (showOId ? str.tostring(deltaOI[swingSizeR], format.volume) : ''),text_halign=switchhalign(texthalign),text_valign=text.align_center,text_color=chart.fg_color, text_size=switchtextsize(labelsize))
    lLine   = line.new(prevLowIndex, pivLo, bar_index, pivLo, color = showSwingLines ? buycol : CLEAR, style=lineStyle(lineStyle), width=lineWid)
    array.push(levelBoxes, lBox)
    array.push(levelLines, lLine)

// Looping over the full array of lines and updating them, and deleting them if they have been touched
size = array.size(levelBoxes)
if size > 0
    for i = 0 to size - 1
        j = size - 1 - i
        box = array.get(levelBoxes, j)
        line = array.get(levelLines, j)
        level = line.get_y2(line)
        filled = (high >= level and low <= level)

        if filled and extendtilfilled and not hidefilled
            array.remove(levelLines, j)
            array.remove(levelBoxes, j)
            continue 

        box.set_right(box, bar_index+1)
        line.set_x2(line, bar_index+1)
        if filled and hidefilled
            array.remove(levelLines, j)
            array.remove(levelBoxes, j)
            line.delete(line)
            box.delete(box)

        if not filled and not extendtilfilled
            array.remove(levelLines, j)
            array.remove(levelBoxes, j)
            continue 
            box.set_right(box, bar_index[0]+4)
            line.set_x2(line, bar_index[0]+4)


// Deleting the oldest lines if array is too big 
if array.size(levelBoxes) >= 500
    int i = 0
    while array.size(levelBoxes) >= 500
        box = array.get(levelBoxes, i)
        line = array.get(levelLines, i)
        box.delete(box)
        line.delete(line)
        array.remove(levelBoxes, i)
        array.remove(levelLines, i)
        i += 1 
        
// Plotting circle labels
plotshape(showhighs and showBubbles and h and oitreshcond and voltreshcond and oicond ? high[swingSizeR] : na, style=shape.circle, location = location.absolute, offset = -swingSizeR, color=sellcolB, size = size.tiny)
plotshape(showlows and showBubbles and l and oitreshcond and voltreshcond and oicond ? low[swingSizeR] : na, style=shape.circle, location = location.absolute, offset = -swingSizeR, color=buycolB, size = size.tiny)