// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("DTFX Algo Zones [LuxAlgo]", shorttitle = "LuxAlgo - DTFX Algo Zones", overlay = true, max_boxes_count = 500, max_lines_count = 500)

///---------------------------------------------------------------------------------------------------------------------}
//Inputs
//---------------------------------------------------------------------------------------------------------------------{

structureTog = input.bool(true, title = "Show Swing Points", group = "Structure")
structureLen = input.int(10, title = "Structure Length", group = "Structure")

zoneDispNum = input.int(1, title = "Show Last", group = "Zones", minval = 0)
dispAll = input.bool(true, title = "Display All Zones", tooltip = "Ignores Zone Display # and Displays all Possible Zones.", group = "Zones")
zoneFilter = input.string("Both", title = "Zone Display", options = ["Bullish Only", "Bearish Only", "Both"], group = "Zones")
noOverlap = input.bool(true, title = "Clean-Up Level Overlap", group = "Zones")

fib_group = "              Fib Levels                    Line Style                 Bull | Bear"

f1Tog = input.bool(false, title = "", group = fib_group, inline = "1")
f2Tog = input.bool(true, title = "", group = fib_group, inline = "2")
f3Tog = input.bool(true, title = "", group = fib_group, inline = "3")
f4Tog = input.bool(true, title = "", group = fib_group, inline = "4")
f5Tog = input.bool(false, title = "", group = fib_group, inline = "5")

f1Lvl = f1Tog?input.float(0, title = "", group = fib_group, inline = "1"):na
f2Lvl = f2Tog?input.float(0.3, title = "", group = fib_group, inline = "2"):na
f3Lvl = f3Tog?input.float(0.5, title = "", group = fib_group, inline = "3"):na
f4Lvl = f4Tog?input.float(0.7, title = "", group = fib_group, inline = "4"):na
f5Lvl = f5Tog?input.float(1, title = "", group = fib_group, inline = "5"):na

f1Style = input.string(". . .", title = "", options = ["___","- - -",". . ."], group = fib_group, inline = "1")
f2Style = input.string("- - -", title = "", options = ["___","- - -",". . ."], group = fib_group, inline = "2")
f3Style = input.string("___", title = "", options = ["___","- - -",". . ."], group = fib_group, inline = "3")
f4Style = input.string("- - -", title = "", options = ["___","- - -",". . ."], group = fib_group, inline = "4")
f5Style = input.string(". . .", title = "", options = ["___","- - -",". . ."], group = fib_group, inline = "5")

f1BullColor = input.color(#089981, title = "", group = fib_group, inline = "1")
f2BullColor = input.color(#089981, title = "", group = fib_group, inline = "2")
f3BullColor = input.color(#089981, title = "", group = fib_group, inline = "3")
f4BullColor = input.color(#089981, title = "", group = fib_group, inline = "4")
f5BullColor = input.color(#089981, title = "", group = fib_group, inline = "5")

f1BearColor = input.color(#f23645, title = "", group = fib_group, inline = "1")
f2BearColor = input.color(#f23645, title = "", group = fib_group, inline = "2")
f3BearColor = input.color(#f23645, title = "", group = fib_group, inline = "3")
f4BearColor = input.color(#f23645, title = "", group = fib_group, inline = "4")
f5BearColor = input.color(#f23645, title = "", group = fib_group, inline = "5")

structureColor = input.color(color.gray, title = "Structure Color", group = "Style")
bullZoneColor = input.color(color.new(#089981,80), title = "Bullish Zone Color", group = "Style")
bearZoneColor = input.color(color.new(#f23645,80), title = "Bearish Zone Color", group = "Style")


//---------------------------------------------------------------------------------------------------------------------}
//UDTs
//---------------------------------------------------------------------------------------------------------------------{

type pb 
    float price
    int bar

type fs
    line f1
    line f2
    line f3
    line f4
    line f5

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{

linestyle(_input) =>
    _input == "___"?line.style_solid:
     _input == "- - -"?line.style_dashed:
     _input == ". . ."?line.style_dotted:
     na

get_fibs(_top,_bot,_dir,_fl1,_fl2,_fl3,_fl4,_fl5) =>
    rng = _dir == 1 ? _top - _bot : _bot - _top
    anchor = _dir == 1 ? _bot : _top
    fib1 = anchor + (rng*_fl1)
    fib2 = anchor + (rng*_fl2)
    fib3 = anchor + (rng*_fl3)
    fib4 = anchor + (rng*_fl4)
    fib5 = anchor + (rng*_fl5)
    [fib1,fib2,fib3,fib4,fib5]

//---------------------------------------------------------------------------------------------------------------------}
//Calcs
//---------------------------------------------------------------------------------------------------------------------{

var int dir = 0

float top = na
float btm = na

var pb t = pb.new(na,na)
var pb b = pb.new(na,na)

var bool bos_up_check = false
var bool bos_down_check = false
    
var string last_bot = "NA"
var string last_top = "NA"

var zones = array.new_box()
var lvls = array.new<fs>()

var box live_zone = na
var fs live_lvls = fs.new(na,na,na,na,na)

upper = ta.highest(structureLen)
lower = ta.lowest(structureLen)

if dir >= 0 and high[structureLen] > upper
    dir := -1 
    top := high[structureLen]

if dir <= 0 and low[structureLen] < lower
    dir := 1
    btm := low[structureLen]

top_conf = not na(top)
bot_conf = not na(btm)

int structure_confirmed = 0

if top_conf
    t := pb.new(top,bar_index-structureLen)
    bos_up_check := true
    if structureTog
        structure_confirmed := 1
if bot_conf
    b := pb.new(btm,bar_index-structureLen)
    bos_down_check := true
    if structureTog
        structure_confirmed := -1
    
plotshape(structure_confirmed>0?true:false, style = shape.circle, title = "Swing High", location = location.abovebar, offset = -structureLen, color = structureColor)
plotshape(structure_confirmed<0?true:false, style = shape.circle, title = "Swing Low", location = location.belowbar, offset = -structureLen, color = structureColor)


HH = top_conf and t.price > t.price[1]
HL = bot_conf and b.price > b.price[1]
LH = top_conf and t.price < t.price[1]
LL = bot_conf and b.price < b.price[1]

last_top := HH?"HH":LH?"LH":last_top
last_bot := LL?"LL":HL?"HL":last_bot

var int t_dir = 0

choch_up = ta.crossover(close,t.price) and (high == upper) and t_dir <= 0 
choch_down = ta.crossunder(close,b.price) and (low == lower) and t_dir >= 0
    
if choch_up
    t_dir := 1
if choch_down
    t_dir := -1
    
bos_up = ta.crossover(close,t.price) and bos_up_check and t_dir >= 0
bos_down = ta.crossunder(close,b.price) and bos_down_check and t_dir <= 0

mss_up = bos_up or choch_up
mss_down = bos_down or choch_down

if mss_up
    bos_up_check := false
    if zoneFilter != "Bearish Only"
        _top = t.price
        _bot = dir == -1 ? lower : dir == 1 ? b.price : 0
        [fib1,fib2,fib3,fib4,fib5] = get_fibs(_top,_bot,1,f1Lvl,f2Lvl,f3Lvl,f4Lvl,f5Lvl)
        live_zone := box.new(t.bar,_top,bar_index,_bot,bgcolor = bullZoneColor,border_color = na)
        live_lvls := fs.new(
          line.new(t.bar,(f1Tog?fib1:na),bar_index,fib1, color = f1BullColor, style = linestyle(f1Style)),
          line.new(t.bar,(f2Tog?fib2:na),bar_index,fib2, color = f2BullColor, style = linestyle(f2Style)),
          line.new(t.bar,(f3Tog?fib3:na),bar_index,fib3, color = f3BullColor, style = linestyle(f3Style)),
          line.new(t.bar,(f4Tog?fib4:na),bar_index,fib4, color = f4BullColor, style = linestyle(f4Style)),
          line.new(t.bar,(f5Tog?fib5:na),bar_index,fib5, color = f5BullColor, style = linestyle(f5Style))
          )
        zones.push(live_zone)
        lvls.push(live_lvls)  

if mss_down
    bos_down_check := false
    if zoneFilter != "Bullish Only"
        _top = dir == 1 ? upper : dir == -1 ? t.price : 0
        _bot = b.price
        [fib1,fib2,fib3,fib4,fib5] = get_fibs(_top,_bot,-1,f1Lvl,f2Lvl,f3Lvl,f4Lvl,f5Lvl)
        live_zone := box.new(b.bar,_top,bar_index,_bot,bgcolor = bearZoneColor,border_color = na)
        live_lvls := fs.new(
          line.new(b.bar,(f1Tog?fib1:na),bar_index,fib1, color = f1BearColor, style = linestyle(f1Style)),
          line.new(b.bar,(f2Tog?fib2:na),bar_index,fib2, color = f2BearColor, style = linestyle(f2Style)),
          line.new(b.bar,(f3Tog?fib3:na),bar_index,fib3, color = f3BearColor, style = linestyle(f3Style)),
          line.new(b.bar,(f4Tog?fib4:na),bar_index,fib4, color = f4BearColor, style = linestyle(f4Style)),
          line.new(b.bar,(f5Tog?fib5:na),bar_index,fib5, color = f5BearColor, style = linestyle(f5Style))
          )
        zones.push(live_zone)
        lvls.push(live_lvls)  

if zones.size() > zoneDispNum and not dispAll
    zones.shift().delete()
    ln = lvls.shift()
    ln.f1.delete()
    ln.f2.delete()
    ln.f3.delete()
    ln.f4.delete()
    ln.f5.delete()

if lvls.size() > 1 and noOverlap
    last_zone = zones.get(zones.size()-2)
    last_lvl = lvls.get(lvls.size()-2)
    if last_lvl.f1.get_x2() > live_lvls.f1.get_x1()
        last_lvl.f1.set_x2(math.max(live_zone.get_left(),last_zone.get_right()))
        last_lvl.f2.set_x2(math.max(live_zone.get_left(),last_zone.get_right()))
        last_lvl.f3.set_x2(math.max(live_zone.get_left(),last_zone.get_right()))
        last_lvl.f4.set_x2(math.max(live_zone.get_left(),last_zone.get_right()))
        last_lvl.f5.set_x2(math.max(live_zone.get_left(),last_zone.get_right()))

        live_lvls.f1.set_x1(math.max(live_zone.get_left(),last_zone.get_right()))
        live_lvls.f2.set_x1(math.max(live_zone.get_left(),last_zone.get_right()))
        live_lvls.f3.set_x1(math.max(live_zone.get_left(),last_zone.get_right()))
        live_lvls.f4.set_x1(math.max(live_zone.get_left(),last_zone.get_right()))
        live_lvls.f5.set_x1(math.max(live_zone.get_left(),last_zone.get_right()))

live_lvls.f1.set_x2(bar_index)
live_lvls.f2.set_x2(bar_index)
live_lvls.f3.set_x2(bar_index)
live_lvls.f4.set_x2(bar_index)
live_lvls.f5.set_x2(bar_index)
    
//---------------------------------------------------------------------------------------------------------------------}