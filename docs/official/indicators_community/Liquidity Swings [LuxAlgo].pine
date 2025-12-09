// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Liquidity Swings [LuxAlgo]"
  , overlay = true
  , max_lines_count = 500
  , max_labels_count = 500
  , max_boxes_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length = input(14, 'Pivot Lookback')

area = input.string('Wick Extremity', 'Swing Area', options = ['Wick Extremity', 'Full Range'])

intraPrecision = input(false, 'Intrabar Precision', inline = 'intrabar')
intrabarTf = input.timeframe('1', ''              , inline = 'intrabar')

filterOptions = input.string('Count', 'Filter Areas By', options = ['Count', 'Volume'], inline = 'filter')
filterValue   = input.float(0, ''                                            , inline = 'filter')

//Style
showTop      = input(true, 'Swing High'              , inline = 'top', group = 'Style')
topCss       = input(color.red, ''                   , inline = 'top', group = 'Style')
topAreaCss   = input(color.new(color.red, 50), 'Area', inline = 'top', group = 'Style')

showBtm      = input(true, 'Swing Low'                , inline = 'btm', group = 'Style')
btmCss       = input(color.teal, ''                   , inline = 'btm', group = 'Style')
btmAreaCss   = input(color.new(color.teal, 50), 'Area', inline = 'btm', group = 'Style')

labelSize = input.string('Tiny', 'Labels Size', options = ['Tiny', 'Small', 'Normal'], group = 'Style')

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
n = bar_index

get_data()=> [high, low, volume]

[h, l, v] = request.security_lower_tf(syminfo.tickerid, intrabarTf, get_data())

get_counts(condition, top, btm)=>
    var count = 0
    var vol = 0.

    if condition
        count := 0
        vol := 0.
    else
        if intraPrecision
            if n > length
                if array.size(v[length]) > 0
                    for [index, element] in v[length]
                        vol += array.get(l[length], index) < top and array.get(h[length], index) > btm ? element : 0
        else
            vol += low[length] < top and high[length] > btm ? volume[length] : 0
        
        count += low[length] < top and high[length] > btm ? 1 : 0

    [count, vol]

set_label(count, vol, x, y, css, lbl_style)=>
    var label lbl = na
    var label_size = switch labelSize
        'Tiny' => size.tiny
        'Small' => size.small
        'Normal' => size.normal

    target = switch filterOptions
        'Count'  => count
        'Volume' => vol

    if ta.crossover(target, filterValue)
        lbl := label.new(x, y, str.tostring(vol, format.volume)
          , style = lbl_style
          , size = label_size
          , color = #00000000
          , textcolor = css)

    if target > filterValue
        label.set_text(lbl, str.tostring(vol, format.volume))

set_level(condition, crossed, value, count, vol, css)=>
    var line lvl = na

    target = switch filterOptions
        'Count'  => count
        'Volume' => vol

    if condition
        if target[1] < filterValue[1]
            line.delete(lvl[1])
        else if not crossed[1]
            line.set_x2(lvl, n - length)

        lvl := line.new(n - length, value, n, value
          , color = na)

    if not crossed[1]
        line.set_x2(lvl, n+3)
    
    if crossed and not crossed[1]
        line.set_x2(lvl, n)
        line.set_style(lvl, line.style_dashed)

    if target > filterValue
        line.set_color(lvl, css)

set_zone(condition, x, top, btm, count, vol, css)=>
    var box bx = na

    target = switch filterOptions
        'Count'  => count
        'Volume' => vol

    if ta.crossover(target, filterValue)
        bx := box.new(x, top, x + count, btm
          , border_color = na
          , bgcolor = css)
    
    if target > filterValue
        box.set_right(bx, x + count)

//-----------------------------------------------------------------------------}
//Global variables
//-----------------------------------------------------------------------------{
//Pivot high
var float ph_top = na
var float ph_btm = na
var bool  ph_crossed = na
var       ph_x1 = 0
var box   ph_bx = box.new(na,na,na,na
  , bgcolor = color.new(topAreaCss, 80)
  , border_color = na)

//Pivot low
var float pl_top = na
var float pl_btm = na
var bool  pl_crossed = na
var       pl_x1 = 0
var box   pl_bx = box.new(na,na,na,na
  , bgcolor = color.new(btmAreaCss, 80)
  , border_color = na)

//-----------------------------------------------------------------------------}
//Display pivot high levels/blocks
//-----------------------------------------------------------------------------{
ph = ta.pivothigh(length, length)

//Get ph counts
[ph_count, ph_vol] = get_counts(ph, ph_top, ph_btm)

//Set ph area and level
if ph and showTop
    ph_top := high[length]
    ph_btm := switch area 
        'Wick Extremity' => math.max(close[length], open[length])
        'Full Range' => low[length]
    
    ph_x1 := n - length
    ph_crossed := false

    box.set_lefttop(ph_bx, ph_x1, ph_top)
    box.set_rightbottom(ph_bx, ph_x1, ph_btm)
else
    ph_crossed := close > ph_top ? true : ph_crossed
    
    if ph_crossed
        box.set_right(ph_bx, ph_x1)
    else
        box.set_right(ph_bx, n+3)

if showTop
    //Set ph zone
    set_zone(ph, ph_x1, ph_top, ph_btm, ph_count, ph_vol, topAreaCss)

    //Set ph level
    set_level(ph, ph_crossed, ph_top, ph_count, ph_vol, topCss)

    //Set ph label
    set_label(ph_count, ph_vol, ph_x1, ph_top, topCss, label.style_label_down)

//-----------------------------------------------------------------------------}
//Display pivot low levels/blocks
//-----------------------------------------------------------------------------{
pl = ta.pivotlow(length, length)

//Get pl counts
[pl_count, pl_vol] = get_counts(pl, pl_top, pl_btm)

//Set pl area and level
if pl and showBtm
    pl_top := switch area 
        'Wick Extremity' => math.min(close[length], open[length])
        'Full Range' => high[length] 
    pl_btm := low[length]
    
    pl_x1 := n - length
    pl_crossed := false
    
    box.set_lefttop(pl_bx, pl_x1, pl_top)
    box.set_rightbottom(pl_bx, pl_x1, pl_btm)
else
    pl_crossed := close < pl_btm ? true : pl_crossed

    if pl_crossed
        box.set_right(pl_bx, pl_x1)
    else
        box.set_right(pl_bx, n+3)

if showBtm
    //Set pl zone
    set_zone(pl, pl_x1, pl_top, pl_btm, pl_count, pl_vol, btmAreaCss)
    
    //Set pl level
    set_level(pl, pl_crossed, pl_btm, pl_count, pl_vol, btmCss)

    //Set pl labels
    set_label(pl_count, pl_vol, pl_x1, pl_btm, btmCss, label.style_label_up)

//-----------------------------------------------------------------------------}