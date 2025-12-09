// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Master Pattern [LuxAlgo]", "LuxAlgo - Master Pattern Indicator", overlay = true, max_boxes_count = 500, max_lines_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length = input.int(3, 'Contraction Detection Lookback', minval = 1)
liqLength = input.int(20, 'Liquidity Levels', minval = 1)

showMajor = input(true, 'Show Major Pattern')
showMinor = input(true, 'Show Minor Pattern')

//Style
bullCss = input.color(color.teal, 'Bullish Pattern', inline = 'bull', group = 'Pattern Style')
showBullBox = input(true, 'Area', inline = 'bull', group = 'Pattern Style')
showBullLvl = input(true, 'Line', inline = 'bull', group = 'Pattern Style')

bearCss = input.color(color.red, 'Bearish Pattern', inline = 'bear', group = 'Pattern Style')
showBearBox = input(true, 'Area', inline = 'bear', group = 'Pattern Style')
showBearLvl = input(true, 'Line', inline = 'bear', group = 'Pattern Style')

//Liquidity Style
showLiq = input(true, 'Show Liquidity Levels', group = 'Liquidity')
bullLiqCss = input.color(color.teal, 'Upper Liquidity', group = 'Liquidity')
bearLiqCss = input.color(color.red, 'Lower Liquidity', group = 'Liquidity')

//-----------------------------------------------------------------------------}
//UDT
//-----------------------------------------------------------------------------{
type mp
    box area
    line avg
    bool breakup
    bool breakdn

//-----------------------------------------------------------------------------}
//Detect contraction
//-----------------------------------------------------------------------------{
var phy = 0., var phx = 0, var pht = 0.
var ply = 0., var plx = 0, var plt = 0.

var float top = na
var float btm = na

n = bar_index
ph = ta.pivothigh(length, length)
pl = ta.pivotlow(length, length)

if ph
    pht := math.sign(ph - phy)
    phy := ph

    if pht == -1 and plt == 1
        top := ph
        btm := ply
        phx := n-length

if pl
    plt := math.sign(pl - ply)
    ply := pl

    if pht  == -1 and plt == 1
        top := phy
        btm := pl
        plx := n-length

//-----------------------------------------------------------------------------}
//Set pattern
//-----------------------------------------------------------------------------{
var mp master = mp.new()

//Detect master pattern
isbull = high[length] > top and top > btm
isbear = low[length] < btm and top > btm

if isbull or isbear
    css = isbull ? bullCss : bearCss

    master.avg.set_x2(n-length)

    val = math.avg(top, btm)

    //Create new master pattern object
    master := mp.new(
      (isbull and showBullBox) or (isbear and showBearBox) ? box.new(math.max(phx, plx), top, n-length, btm, na, bgcolor = showMinor ? color.new(css, 50) : na) : na
      , (isbull and showBullLvl) or (isbear and showBearLvl) ? line.new(n-length, val, n, val, color = showMinor ? css : na) : na
      , isbull
      , isbear)

    top := na
    btm := na

//Determine if pattern switch to major
if master.breakup
    if low < master.area.get_bottom()
        if not showMajor
            master.area.delete()
            master.avg.delete()
        else
            master.area.set_border_color(bullCss)
            if not showMinor
                master.area.set_bgcolor(color.new(bullCss, 50))
                master.avg.set_color(bullCss)
else if master.breakdn
    if high > master.area.get_top()
        if not showMajor
            master.area.delete()
            master.avg.delete()
        else
            master.area.set_border_color(bearCss)
            if not showMinor
                master.area.set_bgcolor(color.new(bearCss, 50))
                master.avg.set_color(bearCss)

//Set friction level x2 coordinate to current bar
if not na(master.avg)
    master.avg.set_x2(n)

//-----------------------------------------------------------------------------}
//Liquidity levels
//-----------------------------------------------------------------------------{
var line liqup = na, var liqup_reach = false
var line liqdn = na, var liqdn_reach = false

liqph = ta.pivothigh(liqLength, liqLength)
liqpl = ta.pivotlow(liqLength, liqLength)

//Set upper liquidity
if liqph and showLiq
    if not liqup_reach
        liqup.set_x2(n-liqLength)

    liqup := line.new(n-liqLength, liqph, n, liqph, color = bullLiqCss, style = line.style_dotted)
    liqup_reach := false
else if not liqup_reach and showLiq
    liqup.set_x2(n)

    if high > liqup.get_y1()
        liqup_reach := true

//Set lower liquidity
if liqpl and showLiq
    if not liqdn_reach
        liqdn.set_x2(n-liqLength)

    liqdn := line.new(n-liqLength, liqpl, n, liqpl, color = bearLiqCss, style = line.style_dotted)
    liqdn_reach := false
else if not liqdn_reach and showLiq
    liqdn.set_x2(n)

    if low < liqdn.get_y1()
        liqdn_reach := true

//-----------------------------------------------------------------------------}