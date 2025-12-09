// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Order Block Detector [LuxAlgo]"
  , overlay = true
  , max_boxes_count = 500
  , max_labels_count = 500
  , max_lines_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length = input.int(5, 'Volume Pivot Length'
  , minval = 1)

bull_ext_last = input.int(3, 'Bullish OB '
  , minval = 1
  , inline = 'bull')

bg_bull_css = input.color(color.new(#169400, 80), ''
  , inline = 'bull')

bull_css = input.color(#169400, ''
  , inline = 'bull')

bull_avg_css = input.color(color.new(#9598a1, 37), ''
  , inline = 'bull')

bear_ext_last = input.int(3, 'Bearish OB'
  , minval = 1
  , inline = 'bear')

bg_bear_css = input.color(color.new(#ff1100, 80), ''
  , inline = 'bear')

bear_css = input.color(#ff1100, ''
  , inline = 'bear')

bear_avg_css = input.color(color.new(#9598a1, 37), ''
  , inline = 'bear')

line_style = input.string('⎯⎯⎯', 'Average Line Style'
  , options = ['⎯⎯⎯', '----', '····'])

line_width = input.int(1, 'Average Line Width'
  , minval = 1)

mitigation = input.string('Wick', 'Mitigation Methods'
  , options = ['Wick', 'Close'])

//-----------------------------------------------------------------------------}
//Functions 
//-----------------------------------------------------------------------------{
//Line Style function
get_line_style(style) =>
    out = switch style
        '⎯⎯⎯'  => line.style_solid
        '----' => line.style_dashed
        '····' => line.style_dotted

//Function to get order block coordinates
get_coordinates(condition, top, btm, ob_val)=>
    var ob_top  = array.new_float(0)
    var ob_btm  = array.new_float(0)
    var ob_avg  = array.new_float(0)
    var ob_left = array.new_int(0)

    float ob = na

    //Append coordinates to arrays
    if condition
        avg = math.avg(top, btm)
        
        array.unshift(ob_top, top)
        array.unshift(ob_btm, btm)
        array.unshift(ob_avg, avg)
        array.unshift(ob_left, time[length])
        
        ob := ob_val
    
    [ob_top, ob_btm, ob_avg, ob_left, ob]

//Function to remove mitigated order blocks from coordinate arrays
remove_mitigated(ob_top, ob_btm, ob_left, ob_avg, target, bull)=>
    mitigated = false
    target_array = bull ? ob_btm : ob_top

    for element in target_array
        idx = array.indexof(target_array, element)

        if (bull ? target < element : target > element)
            mitigated := true

            array.remove(ob_top, idx)
            array.remove(ob_btm, idx)
            array.remove(ob_avg, idx)
            array.remove(ob_left, idx)
    
    mitigated

//Function to set order blocks
set_order_blocks(ob_top, ob_btm, ob_left, ob_avg, ext_last, bg_css, border_css, lvl_css)=>
    var ob_box = array.new_box(0)
    var ob_lvl = array.new_line(0)

    //Fill arrays with boxes/lines
    if barstate.isfirst
        for i = 0 to ext_last-1
            array.unshift(ob_box, box.new(na,na,na,na
              , xloc = xloc.bar_time
              , extend= extend.right
              , bgcolor = bg_css
              , border_color = color.new(border_css, 70)))

            array.unshift(ob_lvl, line.new(na,na,na,na
              , xloc = xloc.bar_time
              , extend = extend.right
              , color = lvl_css
              , style = get_line_style(line_style)
              , width = line_width))

    //Set order blocks
    if barstate.islast
        if array.size(ob_top) > 0
            for i = 0 to math.min(ext_last-1, array.size(ob_top)-1)
                get_box = array.get(ob_box, i)
                get_lvl = array.get(ob_lvl, i)

                box.set_lefttop(get_box, array.get(ob_left, i), array.get(ob_top, i))
                box.set_rightbottom(get_box, array.get(ob_left, i), array.get(ob_btm, i))

                line.set_xy1(get_lvl, array.get(ob_left, i), array.get(ob_avg, i))
                line.set_xy2(get_lvl, array.get(ob_left, i)+1, array.get(ob_avg, i))


//-----------------------------------------------------------------------------}
//Global elements 
//-----------------------------------------------------------------------------{
var os = 0
var target_bull = 0.
var target_bear = 0.

n = bar_index
upper = ta.highest(length)
lower = ta.lowest(length)

if mitigation == 'Close'
    target_bull := ta.lowest(close, length)
    target_bear := ta.highest(close, length)
else
    target_bull := lower
    target_bear := upper

os := high[length] > upper ? 0 : low[length] < lower ? 1 : os[1]

phv = ta.pivothigh(volume, length, length)

//-----------------------------------------------------------------------------}
//Get bullish/bearish order blocks coordinates 
//-----------------------------------------------------------------------------{
[bull_top
  , bull_btm
  , bull_avg
  , bull_left
  , bull_ob] = get_coordinates(phv and os == 1, hl2[length], low[length], low[length])

[bear_top
  , bear_btm
  , bear_avg
  , bear_left
  , bear_ob] = get_coordinates(phv and os == 0, high[length], hl2[length], high[length])

//-----------------------------------------------------------------------------}
//Remove mitigated order blocks
//-----------------------------------------------------------------------------{
mitigated_bull = remove_mitigated(bull_top
  , bull_btm
  , bull_left
  , bull_avg
  , target_bull
  , true)

mitigated_bear = remove_mitigated(bear_top
  , bear_btm
  , bear_left
  , bear_avg
  , target_bear
  , false)

//-----------------------------------------------------------------------------}
//Display order blocks
//-----------------------------------------------------------------------------{
//Set bullish order blocks
set_order_blocks(bull_top
  , bull_btm
  , bull_left
  , bull_avg
  , bull_ext_last
  , bg_bull_css
  , bull_css
  , bull_avg_css)

//Set bearish order blocks
set_order_blocks(bear_top
  , bear_btm
  , bear_left
  , bear_avg
  , bear_ext_last
  , bg_bear_css
  , bear_css
  , bear_avg_css)
        
//Show detected order blocks
plot(bull_ob, 'Bull OB', bull_css, 2, plot.style_linebr
  , offset = -length
  , display = display.none)

plot(bear_ob, 'Bear OB', bear_css, 2, plot.style_linebr
  , offset = -length
  , display = display.none)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
alertcondition(bull_ob, 'Bullish OB Formed', 'Bullish order block detected')

alertcondition(bear_ob, 'Bearish OB Formed', 'bearish order block detected')

alertcondition(mitigated_bull, 'Bullish OB Mitigated', 'Bullish order block mitigated')

alertcondition(mitigated_bear, 'Bearish OB Mitigated', 'bearish order block mitigated')

//-----------------------------------------------------------------------------}