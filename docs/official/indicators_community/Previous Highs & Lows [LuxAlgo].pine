// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Previous Highs & Lows [LuxAlgo]", "LuxAlgo - Previous Highs & Lows", overlay = true)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
showLast = input.int(4, 'Show Last', minval = 1)

freq = input.string('Day', 'Frequency', options = ['Hour', 'Day', 'Week', 'Month', 'Year'])

areasWidth = input.int(20, 'Areas Width', minval = 0, maxval = 100)

filter = input(false, 'Filter Based On Position', tooltip = "Filter out previous highs below the current closing price, and previous low's above it.")

//Style
showPrevh  = input(true, 'Previous Highs', inline = 'inline1', group = 'Style')
prevhColor = input(#f23645, '', inline = 'inline1', group = 'Style')

showPrevl  = input(true, 'Previous Lows', inline = 'inline2', group = 'Style')
prevlColor = input(#089981, '', inline = 'inline2', group = 'Style')

minTransp = input.float(80, 'Minimum Gradient Transparency', group = 'Style')

showAreas = input(true, 'Show Areas', inline = 'inline3', group = 'Style')
topCss = input(color.new(#f23645, 80), '', inline = 'inline3', group = 'Style')
btmCss = input(color.new(#089981, 80), '', inline = 'inline3', group = 'Style')

//---------------------------------------------------------------------------------------------------------------------}
//Function
//---------------------------------------------------------------------------------------------------------------------{
output()=>
    prev_h  = array.new<float>(0)
    prev_l  = array.new<float>(0)
    prev_t  = array.new<int>(0)
    
    for i = 0 to showLast
        prev_h.push(high[i])
        prev_l.push(low[i])
        prev_t.push(time[i])

    [prev_h, prev_l, prev_t]

line_label(x1, y, index, col)=>
    css = color.from_gradient(index, 0, showLast, col, color.new(col, minTransp))

    //Level
    line.new(x1, y, time, y, xloc.bar_time, color = css
      , style = index == 0 ? line.style_dashed : line.style_solid)

    //Label
    label.new(bar_index, y, str.tostring(index), color = color(na)
      , style = label.style_label_left, size = size.tiny, textcolor = col
      , tooltip = str.format_time(x1, "yyyy-MM-dd HH:mm", syminfo.timezone))

//---------------------------------------------------------------------------------------------------------------------}
//Display Previous H/L
//---------------------------------------------------------------------------------------------------------------------{
var tf = switch freq
    'Hour'  => '60'
    'Day'   => 'D'
    'Week'  => 'W'
    'Month' => 'M'
    'Year'  => '12M'

var area_top = box.new(na,na,na,na,na, xloc = xloc.bar_time, bgcolor = topCss)
var area_btm = box.new(na,na,na,na,na, xloc = xloc.bar_time, bgcolor = btmCss)

//Get high/low and time coordinates
[prev_h, prev_l, prev_t] = request.security(syminfo.tickerid, tf, output(), calc_bars_count = showLast+1)

//Remove lines
for element in line.all
    element.delete()
for element in label.all
    element.delete()

//Display previous high/low
if barstate.islast
    min = math.min(prev_l.min(), prev_l.max())
    
    for [index, element] in prev_t
        get_h = prev_h.get(index)
        get_l = prev_l.get(index)

        //Show previous highs
        if showPrevh
            if (filter and close <= get_h) or not filter
                css = color.from_gradient(index, 0, showLast, prevhColor, color.new(prevhColor, minTransp))

                //Level
                line_label(element, get_h, index, prevhColor)

        //Show previous lows
        if showPrevl
            if (filter and close >= get_l) or not filter
                css = color.from_gradient(index, 0, showLast, prevlColor, color.new(prevlColor, minTransp))
                
                //Level
                line_label(element, get_l, index, prevlColor)

        //Vertical lines
        line.new(element, get_h, element, get_l, xloc.bar_time, color = color.gray, extend = extend.both
          , style = index == 0 ? line.style_dashed : line.style_solid)

    //Display areas
    if showAreas
        
        //Top area
        if prev_h.size() > 0
            p80 = prev_h.percentile_linear_interpolation(100 - areasWidth)
            area_top.set_top_left_point(chart.point.from_time(prev_t.last(), prev_h.max()))
            area_top.set_bottom_right_point(chart.point.from_time(time, p80))

        //Bottom area
        if prev_l.size() > 0
            p20 = prev_l.percentile_linear_interpolation(areasWidth)
            area_btm.set_top_left_point(chart.point.from_time(prev_t.last(), p20))
            area_btm.set_bottom_right_point(chart.point.from_time(time, prev_l.min()))

//---------------------------------------------------------------------------------------------------------------------}