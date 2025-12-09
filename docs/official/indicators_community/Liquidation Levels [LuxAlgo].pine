// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
 
//@version=5

indicator('Liquidation Levels [LuxAlgo]', 'LuxAlgo - Liquidation Levels', true, max_lines_count = 500, max_bars_back = 5000)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

rpTT  = 'Liquidation Levels are estimates of potential price levels where liquidation events may occur\n' +
         ' - The reference price option defines the base price in calculating liquidation price levels'
refPL = input.string("open", "Reference Price", options = ["open", "close", "oc2", "hl2", "hlc3", "ohlc4", "hlcc4"], tooltip = rpTT)
vlTT  = 'Liquidation data is closely tied in with trading volumes in the market and the movement in the underlying asset’s price\n' +
         ' -  The volume threshold option is the primary factor in detecting the significant trading activities that could potentially lead to liquidating leveraged positions\n' +
         ' -  The volatility threshold option (below) is the secondary factor that aims at detecting significant movement in the underlying asset’s price with relatively lower trading activities that could potentially also lead to liquidating high-leveraged positions'
vbHT  = input.float(1.7, 'Volume Threshold', minval = 1., step = .1, tooltip = vlTT)
lqTH  = input.int(10, 'Volatility Threshold', minval = 0, step = 5)

lqL1  = input.bool(true, 'Leverage', inline = 'L1')
lgL1V = input.int(25, '', minval = 1, inline = 'L1')
lqL1L = input.color(color.new(#5b9cf6, 50), '', inline = 'L1')
lqL1S = input.color(color.new(#f06292, 50), '', inline = 'L1')

lqL2  = input.bool(true, 'Leverage', inline = 'L2')
lgL2V = input.int(50, '', minval = 1, inline = 'L2')
lqL2L = input.color(color.new(#4dd0e1, 50), '', inline = 'L2')
lqL2S = input.color(color.new(#ba68c8, 50), '', inline = 'L2')

lqL3  = input.bool(true, 'Leverage', inline = 'L3')
lgL3V = input.int(100, '', minval = 1, inline = 'L3')
lqL3L = input.color(color.new(#42bda8, 50), '', inline = 'L3')
lqL3S = input.color(color.new(#9575cd, 50), '', inline = 'L3')

lqBB  = input.bool(false, 'Hide Liquidation Bubbles')
lqLN  = input.bool(false, 'Hide Liquidation Levels')

//-----------------------------------------------------------------------------}
// User Defined Types
//-----------------------------------------------------------------------------{

// @type        bar properties with their values 
//
// @field h     (float) high price of the bar
// @field l     (float) low price of the bar
// @field v     (float) volume of the bar
// @field i     (int)   index of the bar

type bar
    float h = high
    float l = low
    float v = volume
    int   i = bar_index

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()
var aLQ = array.new_line()

nzV = nz(b.v)

//-----------------------------------------------------------------------------}
// Functions/methods
//-----------------------------------------------------------------------------{

// @function   This function converts string to source
//
// @param _s   [string] source custom sting 
//
// @returns    [float] source

f_gSRC(_s) =>
    switch _s
        "open"  => open
        "close" => close
        "hl2"   => hl2
        "oc2"   => math.avg(open, close)
        "hlc3"  => hlc3
        "ohlc4" => ohlc4
        "hlcc4" => hlcc4

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{

refP  = f_gSRC(refPL)
vbMA  = ta.sma(nzV, 13)
nzVd2 = nzV > vbMA * (2 + vbHT)
nzVd1 = nzV > vbMA * (1 + vbHT)
nzVd0 = nzV > vbMA * (0 + vbHT)

lT = (b.l != refP and refP / (refP - b.l) <= lqTH) or (b.h != refP and refP / (b.h - refP) <= lqTH)
eC = refP * (1 + 1. / 333) < b.h or refP * (1 - 1. / 333) > b.l

l1PL = refP * (1 + 1. / lgL1V)
plotshape(not lqBB and lqL1 and nzVd2 and eC ? l1PL : na, 'Bubbles', shape.circle, location.absolute, lqL1L, editable = false, size = size.normal)
plotshape(not lqBB and lqL1 and nzVd1 and eC ? l1PL : na, 'Bubbles', shape.circle, location.absolute, lqL1L, editable = false, size = size.small)
plotshape(not lqBB and lqL1 and nzVd0 and eC ? l1PL : not lqBB and lqL1 and lT ? l1PL : na, 'Bubbles', shape.circle, location.absolute, lqL1L, editable = false, size = size.tiny)

if not lqLN and lqL1 and (lT or nzVd0) and l1PL > b.h and eC
    aLQ.push(line.new(b.i, l1PL, b.i + 1, l1PL, color = lqL1L, width = nzVd2 ? 3 : nzVd1 ? 2 : 1))

l1PS = refP * (1 - 1. / lgL1V)
plotshape(not lqBB and lqL1 and nzVd0 and eC ? l1PS : not lqBB and lqL1 and lT ? l1PS : na, 'Bubbles', shape.circle, location.absolute, lqL1S, editable = false, size = size.tiny)
plotshape(not lqBB and lqL1 and nzVd1 and eC ? l1PS : na, 'Bubbles', shape.circle, location.absolute, lqL1S, editable = false, size = size.small)
plotshape(not lqBB and lqL1 and nzVd2 and eC ? l1PS : na, 'Bubbles', shape.circle, location.absolute, lqL1S, editable = false, size = size.normal)

if not lqLN and lqL1 and (lT or nzVd0) and l1PS < b.l and eC
    aLQ.push(line.new(b.i, l1PS, b.i + 1, l1PS, color = lqL1S, width = nzVd2 ? 3 : nzVd1 ? 2 : 1))

l2PL = refP * (1 + 1. / lgL2V)
plotshape(not lqBB and lqL2 and nzVd2 and eC ? l2PL : na, 'Bubbles', shape.circle, location.absolute, lqL2L, editable = false, size = size.normal)
plotshape(not lqBB and lqL2 and nzVd1 and eC ? l2PL : na, 'Bubbles', shape.circle, location.absolute, lqL2L, editable = false, size = size.small)
plotshape(not lqBB and lqL2 and nzVd0 and eC ? l2PL : not lqBB and lqL2 and lT ? l2PL : na, 'Bubbles', shape.circle, location.absolute, lqL2L, editable = false, size = size.tiny)

if not lqLN and lqL2 and (lT or nzVd0) and l2PL > b.h and eC
    aLQ.push(line.new(b.i, l2PL, b.i + 1, l2PL, color = lqL2L, width = nzVd2 ? 3 : nzVd1 ? 2 : 1))

l2PS = refP * (1 - 1. / lgL2V)
plotshape(not lqBB and lqL2 and nzVd0 and eC ? l2PS : not lqBB and lqL2 and lT ? l2PS : na, 'Bubbles', shape.circle, location.absolute, lqL2S, editable = false, size = size.tiny)
plotshape(not lqBB and lqL2 and nzVd1 and eC ? l2PS : na, 'Bubbles', shape.circle, location.absolute, lqL2S, editable = false, size = size.small)
plotshape(not lqBB and lqL2 and nzVd2 and eC ? l2PS : na, 'Bubbles', shape.circle, location.absolute, lqL2S, editable = false, size = size.normal)

if not lqLN and lqL2 and (lT or nzVd0) and l2PS < b.l and eC
    aLQ.push(line.new(b.i, l2PS, b.i + 1, l2PS, color = lqL2S, width = nzVd2 ? 3 : nzVd1 ? 2 : 1))

l3PL = refP * (1 + 1. / lgL3V)
plotshape(not lqBB and lqL3 and nzVd2 and eC ? l3PL : na, 'Bubbles', shape.circle, location.absolute, lqL3L, editable = false, size = size.normal)
plotshape(not lqBB and lqL3 and nzVd1 and eC ? l3PL : na, 'Bubbles', shape.circle, location.absolute, lqL3L, editable = false, size = size.small)
plotshape(not lqBB and lqL3 and nzVd0 and eC ? l3PL : not lqBB and lqL3 and lT ? l3PL : na, 'Bubbles', shape.circle, location.absolute, lqL3L, editable = false, size = size.tiny)

if not lqLN and lqL3 and (lT or nzVd0) and l3PL > b.h and eC
    aLQ.push(line.new(b.i, l3PL, b.i + 1, l3PL, color = lqL3L, width = nzVd2 ? 3 : nzVd1 ? 2 : 1))

l3PS = refP * (1 - 1. / lgL3V)
plotshape(not lqBB and lqL3 and nzVd0 and eC ? l3PS : not lqBB and lqL3 and lT ? l3PS : na, 'Bubbles', shape.circle, location.absolute, lqL3S, editable = false, size = size.tiny)
plotshape(not lqBB and lqL3 and nzVd1 and eC ? l3PS : na, 'Bubbles', shape.circle, location.absolute, lqL3S, editable = false, size = size.small)
plotshape(not lqBB and lqL3 and nzVd2 and eC ? l3PS : na, 'Bubbles', shape.circle, location.absolute, lqL3S, editable = false, size = size.normal)

if not lqLN and lqL3 and (lT or nzVd0) and l3PS < b.l and eC
    aLQ.push(line.new(b.i, l3PS, b.i + 1, l3PS, color = lqL3S, width = nzVd2 ? 3 : nzVd1 ? 2 : 1))

if aLQ.size() > 0
    qt = aLQ.size()

    for ln = qt - 1 to 0
        if ln < aLQ.size()
            cL = aLQ.get(ln)
            yL = cL.get_y1()
            if b.h > yL and b.l < yL
                aLQ.remove(ln)
            else
                cL.set_x2(b.i + 1)

    if aLQ.size() > 500
        aLQ.shift().delete()

//-----------------------------------------------------------------------------}