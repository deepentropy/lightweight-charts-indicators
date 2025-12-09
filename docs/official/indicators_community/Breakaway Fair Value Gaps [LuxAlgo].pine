// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=6
indicator("Breakaway Fair Value Gaps [LuxAlgo]", "LuxAlgo - Breakaway FVG", overlay = true, max_boxes_count = 500, max_lines_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
length = input.int(20, 'Trend Length', minval = 1)

//Mitigation Levels
showMitigation = input(true, 'Show Mitigation Levels', group = 'Mitigation Levels')
maxDuration = input(60, 'Maximum Duration', group = 'Mitigation Levels')

//Style
// showBreakaway = input(false, 'Only Show Breakaway FVGs', group = 'Style')

bullBCss = input(color.new(#089981, 40), 'Bullish BFVG', inline = 'bull', group = 'Style')
bullCss  = input(color.new(#9598a1, 40), 'FVG'         , inline = 'bull', group = 'Style')

bearBCss = input(color.new(#f23645, 40), 'Bearish BFVG', inline = 'bear', group = 'Style')
bearCss  = input(color.new(#434651, 40), 'FVG'         , inline = 'bear', group = 'Style')

//Dashboard
showDash = input.bool(true, 'Show Dashboard', group = 'Dashboard')
use_med = input.bool(false, title = "Use Median Duration", group = "Dashboard")
dashLoc  = input.string('Bottom Right' , 'Location'  , options = ['Top Right', 'Bottom Right', 'Bottom Left'] , group = 'Dashboard')
textSize = input.int(14,'Size', group = 'Dashboard')


//---------------------------------------------------------------------------------------------------------------------}
//Detection
//---------------------------------------------------------------------------------------------------------------------{
var bull_bfvg_mt = array.new<line>(0)
var bear_bfvg_mt = array.new<line>(0)
var bull_bfvg_la = array.new<label>(0)
var bear_bfvg_la = array.new<label>(0)

var bull_fvg_count = 0, var bull_bfvg_count = 0
var bear_fvg_count = 0, var bear_bfvg_count = 0

upper = ta.highest(length)
lower = ta.lowest(length)
mid = math.avg(upper,lower)

n = bar_index
bull_fvg = low > high[2] and close[1] > high[2]
bear_fvg = high < low[2] and close[1] < low[2]

var bool bull_break = false
var bool bear_break = false
var float bull_lvl = 0
var float bear_lvl = 0

var bull_bars = array.new_int(na)
var bear_bars = array.new_int(na)

//Bullish BFVG
if low > upper[2] and bull_fvg
    box.new(n-2, high[2], n, low, na, bgcolor = bullBCss)
    bull_bfvg_count += 1
    bull_break := false
    bull_lvl := high[2]

    //Add fvg mitigation level to array
    if showMitigation
        bull_bfvg_mt.unshift(line.new(n-2, high[2], n, high[2], color = bullBCss))
        bull_bfvg_la.unshift(label.new(bar_index,high[2], color = color.rgb(0,0,0,100), text = "2", textcolor = bullBCss, style = label.style_label_left))
// //Regular FVG    
// else if bull_fvg and not showBreakaway
//     box.new(n-2, high[2], n, low, na, bgcolor = bullCss)

//Bearish BFVG
if high < lower[2] and bear_fvg
    box.new(n-2, low[2], n, high, na, bgcolor = bearBCss)
    bear_bfvg_count += 1
    bear_break := false
    bear_lvl := low[2]

    //Add fvg mitigation level to array
    if showMitigation
        bear_bfvg_mt.unshift(line.new(n-2, low[2], n, low[2], color = bearBCss))
        bear_bfvg_la.unshift(label.new(bar_index,low[2], color = color.rgb(0,0,0,100), text = "2", textcolor = bearBCss, style = label.style_label_left))
// //Regular FVG    
// else if bear_fvg and not showBreakaway
//     box.new(n-2, low[2], n, high, na, bgcolor = bearCss)

bull_lvl := math.max(bull_lvl,mid)
bear_lvl := math.min(bear_lvl,mid)

if high > bear_lvl
    bear_break := true
if low < bull_lvl
    bull_break := true

// plot(bull_break?na:bull_lvl, style = plot.style_linebr, color = bullBCss)
// plot(bear_break?na:bear_lvl, style = plot.style_linebr, color = bearBCss)

bull_fvg_count += bull_fvg ? 1 : 0
bear_fvg_count += bear_fvg ? 1 : 0
var bear_mit_count = 0
var bull_mit_count = 0
//---------------------------------------------------------------------------------------------------------------------}
//Mitigation Levels
//---------------------------------------------------------------------------------------------------------------------{
//Test for mitigation on bullish bfvg's 
if bull_bfvg_mt.size() > 0
    for i = bull_bfvg_mt.size()-1 to 0
        get_fvg = bull_bfvg_mt.get(i)
        get_fvg.set_x2(n)
        bull_bfvg_la.get(i).set_x(n)
        bull_bfvg_la.get(i).set_text(str.tostring(bar_index - get_fvg.get_x1()))
        //Test for mitigation
        if close < get_fvg.get_y1()
            bull_bfvg_mt.remove(i)
            bull_bfvg_la.remove(i).delete()
            bull_mit_count += 1
            bull_bars.push(bar_index - get_fvg.get_x1())
        //Test for max duration
        else if n - get_fvg.get_x1() == maxDuration
            bull_bfvg_mt.remove(i).delete()
            bull_bfvg_la.remove(i).delete()

//Test for mitigation on bullish bfvg's 
if bear_bfvg_mt.size() > 0
    for i = bear_bfvg_mt.size()-1 to 0
        get_fvg = bear_bfvg_mt.get(i)
        get_fvg.set_x2(n)
        bear_bfvg_la.get(i).set_x(n)
        bear_bfvg_la.get(i).set_text(str.tostring(bar_index - get_fvg.get_x1()))
        //Test for mitigation
        if close > get_fvg.get_y1()
            bear_bfvg_mt.remove(i)
            bear_bfvg_la.remove(i).delete()
            bear_mit_count += 1
            bear_bars.push(bar_index - get_fvg.get_x1())
        //Test for max duration
        else if n - get_fvg.get_x1() == maxDuration
            bear_bfvg_mt.remove(i).delete()
            bear_bfvg_la.remove(i).delete()

//---------------------------------------------------------------------------------------------------------------------}
//Dashboard
//---------------------------------------------------------------------------------------------------------------------{
var table_position = dashLoc == 'Bottom Left' ? position.bottom_left 
  : dashLoc == 'Top Right' ? position.top_right 
  : position.bottom_right

var tb = table.new(table_position, 4, 3
  , bgcolor      = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color  = #373a46
  , frame_width  = 1)

if barstate.isfirst and showDash
    tb.cell(0, 0, 'Max ' + str.tostring(maxDuration) + " \nBars", text_color = color.white, text_size = textSize, text_formatting = text.format_bold)
    tb.cell(1, 0, 'Mitigation %', text_color = color.white, text_size = textSize)
    tb.cell(2, 0, (use_med?"Med.":"Avg.") + ' Bars', text_color = color.white, text_size = textSize)
    tb.cell(3, 0, 'Total', text_color = color.white, text_size = textSize)
    
    tb.cell(0, 1, 'Bullish', text_color = color.white, text_size = textSize)
    tb.cell(0, 2, 'Bearish', text_color = color.white, text_size = textSize)

if barstate.islast and showDash
    tb.cell(1, 1, str.tostring(bull_mit_count / bull_bfvg_count * 100, format.percent), text_color = color.white, text_size = textSize)
    tb.cell(2, 1, str.tostring(int((use_med?bull_bars.median():bull_bars.avg()))), text_color = color.white, text_size = textSize)
    tb.cell(3, 1, str.tostring(bull_bfvg_count), text_color = color.white, text_size = textSize)

    tb.cell(1, 2, str.tostring(bear_mit_count / bear_bfvg_count * 100, format.percent), text_color = color.white, text_size = textSize)
    tb.cell(2, 2, str.tostring(int((use_med?bear_bars.median():bear_bars.avg()))), text_color = color.white, text_size = textSize)
    tb.cell(3, 2, str.tostring(bear_bfvg_count), text_color = color.white, text_size = textSize)

//---------------------------------------------------------------------------------------------------------------------}