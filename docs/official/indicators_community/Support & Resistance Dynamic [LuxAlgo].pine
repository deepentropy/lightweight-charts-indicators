// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Support & Resistance Dynamic [LuxAlgo]", "LuxAlgo - Support & Resistance Dynamic", overlay = true)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
mult = input.float(8., 'Multiplicative Factor', minval = 0, step = .5)
atrLen = input.int(50, 'ATR Length', minval = 0)
extLast = input.int(4, 'Extend Last', minval = 0)

//Style
supCss = input.color(#089981, 'Support    ', inline = 'sup', group = 'Style')
supAreaCss = input(color.new(#089981, 80), 'Areas', inline = 'sup', group = 'Style')

resCss = input.color(#f23645, 'Resistance', inline = 'res', group = 'Style')
resAreaCss = input(color.new(#f23645, 80), 'Areas', inline = 'res', group = 'Style')

extLvls = input(true, 'Extend Levels', group = 'Style')
extArea = input(true, 'Extend Areas', group = 'Style')

//-----------------------------------------------------------------------------}
//UDT
//-----------------------------------------------------------------------------{
type sr
    float y
    float area
    int x
    bool support

//-----------------------------------------------------------------------------}
//Calculation
//-----------------------------------------------------------------------------{
var records = array.new<sr>(0)  
var float avg = close
var hold_atr = 0.
var os = 0

n = bar_index
breakout_atr = nz(ta.atr(atrLen)) * mult

avg := math.abs(close - avg) > breakout_atr ? close : avg
hold_atr := avg == close ? breakout_atr : hold_atr
os := avg > avg[1] ? 1 : avg < avg[1] ? 0 : os

upper_res = os == 0 ? avg + hold_atr / mult : na
lower_res = os == 0 ? avg + hold_atr / mult / 2 : na
upper_sup = os == 1 ? avg - hold_atr / mult / 2: na
lower_sup = os == 1 ? avg - hold_atr / mult : na

if close == avg
    if os == 1
        records.unshift(sr.new(lower_sup, upper_sup, time, true))
    else
        records.unshift(sr.new(upper_res, lower_res, time, false))

//-----------------------------------------------------------------------------}
//Extensions
//-----------------------------------------------------------------------------{
var lines = array.new<line>(0)
var boxes = array.new<box>(0)

if barstate.isfirst and extLast > 0
    for i = 0 to extLast-1
        if extLvls
            lines.push(line.new(na,na,na,na, xloc.bar_time, style = line.style_dashed))

        if extArea
            boxes.push(box.new(na,na,na,na,na, xloc = xloc.bar_time))

if barstate.islast and extLast > 0
    for i = 0 to extLast-1
        get_sr = records.get(i)
        
        if extLvls
            get_line = lines.get(i)
            get_line.set_xy1(get_sr.x, get_sr.y)
            get_line.set_xy2(time, get_sr.y)
            get_line.set_color(get_sr.support ? supCss : resCss)
        
        if extArea
            get_box = boxes.get(i)
            get_box.set_lefttop(get_sr.x, get_sr.area)
            get_box.set_rightbottom(time, get_sr.y)
            get_box.set_bgcolor(get_sr.support ? supAreaCss : resAreaCss)

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
//Plot supports
plot_upper_sup = plot(upper_sup, 'Upper Support', na
  , style = plot.style_linebr)
plot_lower_sup = plot(lower_sup, 'Lower Support', close == avg ? na : supCss
  , style = plot.style_linebr)

//Plot resistances
plot_upper_res = plot(upper_res, 'Upper Resistance', close == avg ? na : resCss
  , style = plot.style_linebr)
plot_lower_res = plot(lower_res, 'Lower Resistance', na
  , style = plot.style_linebr)

//Fills
fill(plot_upper_sup, plot_lower_sup, supAreaCss, 'Support Area')
fill(plot_upper_res, plot_lower_res, resAreaCss, 'Resistance Area')

//-----------------------------------------------------------------------------}