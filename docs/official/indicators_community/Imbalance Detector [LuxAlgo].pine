// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Imbalance Detector [LuxAlgo]"
  , overlay = true
  , max_boxes_count = 500
  , max_labels_count = 500
  , max_lines_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
//Fair Value Gaps
show_fvg = input(true, 'Fair Value Gaps (FVG)'
  , inline = 'fvg_css'
  , group = 'Fair Value Gaps')

bull_fvg_css = input.color(#2157f3, ''
  , inline = 'fvg_css'
  , group = 'Fair Value Gaps')

bear_fvg_css = input.color(#ff1100, ''
  , inline = 'fvg_css'
  , group = 'Fair Value Gaps')

fvg_usewidth = input(false, 'Min Width'
  , inline = 'fvg_width'
  , group = 'Fair Value Gaps')

fvg_gapwidth = input.float(0, ''
  , inline = 'fvg_width'
  , group = 'Fair Value Gaps')

fvg_method = input.string('Points', ''
  , options = ['Points', '%', 'ATR']
  , inline = 'fvg_width'
  , group = 'Fair Value Gaps')

fvg_extend = input.int(0, 'Extend FVG'
  , minval = 0
  , group = 'Fair Value Gaps')

//Opening Gaps
show_og = input(true, 'Show Opening Gaps (OG)'
  , inline = 'og_css'
  , group = 'Opening Gaps')

bull_og_css = input.color(#2157f3, ''
  , inline = 'og_css'
  , group = 'Opening Gaps')

bear_og_css = input.color(#ff1100, ''
  , inline = 'og_css'
  , group = 'Opening Gaps')

og_usewidth = input(false, 'Min Width'
  , inline = 'og_width'
  , group = 'Opening Gaps')

og_gapwidth = input.float(0, ''
  , inline = 'og_width'
  , group = 'Opening Gaps')

og_method = input.string('Points', ''
  , options = ['Points', '%', 'ATR']
  , inline = 'og_width'
  , group = 'Opening Gaps')

og_extend = input.int(0, 'Extend OG'
  , minval = 0
  , group = 'Opening Gaps')

//Volume Imbalance
show_vi = input(true, 'Show Volume Imbalances (VI)'
  , inline = 'vi_css'
  , group = 'Volume Imbalance')

bull_vi_css = input.color(#2157f3, ''
  , inline = 'vi_css'
  , group = 'Volume Imbalance')

bear_vi_css = input.color(#ff1100, ''
  , inline = 'vi_css'
  , group = 'Volume Imbalance')

vi_usewidth = input(false, 'Min Width'
  , inline = 'vi_width'
  , group = 'Volume Imbalance')

vi_gapwidth = input.float(0, ''
  , inline = 'vi_width'
  , group = 'Volume Imbalance')

vi_method = input.string('Points', ''
  , options = ['Points', '%', 'ATR']
  , inline = 'vi_width'
  , group = 'Volume Imbalance')

vi_extend = input.int(5, 'Extend VI'
  , minval = 0
  , group = 'Volume Imbalance')

//Dashboard
show_dash = input(false, 'Show Dashboard'
  , group   = 'Dashboard')

dash_loc = input.string('Bottom Right', 'Dashboard Location'
  , options = ['Top Right', 'Bottom Right', 'Bottom Left']
  , group   = 'Dashboard')
  
text_size = input.string('Tiny', 'Dashboard Size'
  , options = ['Tiny', 'Small', 'Normal']
  , group   = 'Dashboard')

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
n = bar_index
atr = ta.atr(200)

//Detect imbalance and return count over time
imbalance_detection(show, usewidth, method, width, top, btm, condition)=>
    var is_width = true
    var count = 0

    if usewidth
        dist = top - btm

        is_width := switch method
            'Points' => dist > width
            '%' => dist / btm * 100 > width
            'ATR' => dist > atr * width

    is_true = show and condition and is_width
    count += is_true ? 1 : 0
    
    [is_true, count]

//Detect if bullish imbalance is filled and return count over time
bull_filled(condition, btm)=>
    var btms = array.new_float(0)
    var count = 0

    if condition
        array.unshift(btms, btm)
    
    size = array.size(btms)

    for i = (size > 0 ? size-1 : na) to 0
        value = array.get(btms, i)

        if low < value
            array.remove(btms, i)      
            count += 1 

    count

//Detect if bearish imbalance is filled and return count over time
bear_filled(condition, top)=>
    var tops = array.new_float(0)
    var count = 0
    
    if condition
        array.unshift(tops, top)
    
    size = array.size(tops)
    
    for i = (size > 0 ? size-1 : na) to 0
        value = array.get(tops, i)

        if high > value
            array.remove(tops, i)      
            count += 1 

    count

//Set table data cells
set_cells(tb, column, bull_filled, bull_count, bear_filled, bear_count, bull_css, bear_css, table_size)=>
    table.cell(tb, column, 1, str.tostring(bull_count)
      , text_color = bull_css
      , text_size = table_size
      , text_halign = text.align_left)

    table.cell(tb, column, 2, str.format('{0,number,percent}', bull_filled / bull_count)
      , text_color = bull_css
      , text_size = table_size
      , text_halign = text.align_left)

    table.cell(tb, column, 3, str.tostring(bear_count)
      , text_color = bear_css
      , text_size = table_size
      , text_halign = text.align_left)

    table.cell(tb, column, 4, str.format('{0,number,percent}', bear_filled / bear_count)
      , text_color = bear_css
      , text_size = table_size
      , text_halign = text.align_left)

//-----------------------------------------------------------------------------}
//Volume Imbalances
//-----------------------------------------------------------------------------{
//Bullish
bull_gap_top = math.min(close, open)
bull_gap_btm = math.max(close[1], open[1])

[bull_vi, bull_vi_count] = imbalance_detection(
  show_vi
  , vi_usewidth
  , vi_method
  , vi_gapwidth
  , bull_gap_top
  , bull_gap_btm
  , open > close[1] and high[1] > low and close > close[1] and open > open[1] and high[1] < bull_gap_top)

bull_vi_filled = bull_filled(bull_vi[1], bull_gap_btm[1])

//Bearish
bear_gap_top = math.min(close[1], open[1])
bear_gap_btm = math.max(close, open)

[bear_vi, bear_vi_count] = imbalance_detection(
  show_vi
  , vi_usewidth
  , vi_method
  , vi_gapwidth
  , bear_gap_top
  , bear_gap_btm
  , open < close[1] and low[1] < high and close < close[1] and open < open[1] and low[1] > bear_gap_btm)

bear_vi_filled = bear_filled(bear_vi[1], bear_gap_top[1])

if bull_vi
    box.new(n-1, bull_gap_top, n + vi_extend, bull_gap_btm, border_color = bull_vi_css, bgcolor = na, border_style = line.style_dotted)
    
if bear_vi
    box.new(n-1, bear_gap_top, n + vi_extend, bear_gap_btm, border_color = bear_vi_css, bgcolor = na, border_style = line.style_dotted)

//-----------------------------------------------------------------------------}
//Opening Gaps
//-----------------------------------------------------------------------------{
//Bullish
[bull_og, bull_og_count] = imbalance_detection(
  show_og
  , og_usewidth
  , og_method
  , og_gapwidth
  , bull_gap_top
  , bull_gap_btm
  , low > high[1])

bull_og_filled = bull_filled(bull_og, bull_gap_btm)

//Bullish
[bear_og, bear_og_count] = imbalance_detection(
  show_og
  , og_usewidth
  , og_method
  , og_gapwidth
  , bear_gap_top
  , bear_gap_btm
  , high < low[1])

bear_og_filled = bear_filled(bear_og, bear_gap_top)

if bull_og
    box.new(n-1, bull_gap_top, n + og_extend, bull_gap_btm, border_color = na, bgcolor = color.new(bull_og_css, 50), text = 'OG', text_color = chart.fg_color)

if bear_og
    box.new(n-1, bear_gap_top, n + og_extend, bear_gap_btm, border_color = na, bgcolor = color.new(bear_og_css, 50), text = 'OG', text_color = chart.fg_color)

//-----------------------------------------------------------------------------}
//Fair Value Gaps
//-----------------------------------------------------------------------------{
//Bullish
[bull_fvg, bull_fvg_count] = imbalance_detection(
  show_fvg
  , fvg_usewidth
  , fvg_method
  , fvg_gapwidth
  , low
  , high[2]
  , low > high[2] and close[1] > high[2] and not (bull_og or bull_og[1]))

bull_fvg_filled = bull_filled(bull_fvg, high[2])

//Bearish
[bear_fvg, bear_fvg_count] = imbalance_detection(
  show_fvg
  , fvg_usewidth
  , fvg_method
  , fvg_gapwidth
  , low[2]
  , high
  , high < low[2] and close[1] < low[2] and not (bear_og or bear_og[1]))

bear_fvg_filled = bear_filled(bear_fvg, low[2])

if bull_fvg
    avg = math.avg(low, high[2])
    
    box.new(n-2, low, n + fvg_extend, high[2], border_color = na, bgcolor = color.new(bull_fvg_css, 80))
    line.new(n-2, avg, n + fvg_extend, avg, color = bull_fvg_css)
    
if bear_fvg
    avg = math.avg(low[2], high)

    box.new(n-2, low[2], n + fvg_extend, high, border_color = na, bgcolor = color.new(bear_fvg_css, 80))
    line.new(n-2, avg, n + fvg_extend, avg, color = bear_fvg_css)

//-----------------------------------------------------------------------------}
//Dashboard
//-----------------------------------------------------------------------------{
var table_position = dash_loc == 'Bottom Left' ? position.bottom_left 
  : dash_loc == 'Top Right' ? position.top_right 
  : position.bottom_right

var table_size = text_size == 'Tiny' ? size.tiny 
  : text_size == 'Small' ? size.small 
  : size.normal

var table tb = na

//Set table legends
if barstate.isfirst and show_dash
    tb := table.new(table_position, 5, 7
      , bgcolor = #1e222d
      , border_color = #373a46
      , border_width = 1
      , frame_color = #373a46
      , frame_width = 1)
    
    if show_fvg
        table.cell(tb, 2, 0, '〓 FVG', text_color = color.white, text_size = table_size)

    if show_og
        table.cell(tb, 3, 0, '◼ OG', text_color = color.white, text_size = table_size)

    if show_vi
        table.cell(tb, 4, 0, '⬚ VI', text_color = color.white, text_size = table_size)
    
    //Set vertical legends
    table.merge_cells(tb, 0, 0, 1, 0)

    table.cell(tb, 0, 1, 'Bullish', text_color = #089981, text_size = table_size)
    
    table.cell(tb, 1, 1, 'Frequency', text_color = #089981, text_size = table_size, text_halign = text.align_left)
    
    table.cell(tb, 1, 2, 'Filled', text_color = #089981, text_size = table_size, text_halign = text.align_left)
    
    table.merge_cells(tb, 0, 1, 0, 2)
    
    table.cell(tb, 0, 3, 'Bearish', text_color = #f23645, text_size = table_size)
    
    table.cell(tb, 1, 3, 'Frequency', text_color = #f23645, text_size = table_size, text_halign = text.align_left)
    
    table.cell(tb, 1, 4, 'Filled', text_color = #f23645, text_size = table_size, text_halign = text.align_left)

    table.merge_cells(tb, 0, 3, 0, 4)

//Set dashboard data
if barstate.islast and show_dash
    if show_fvg
        set_cells(tb, 2, bull_fvg_filled, bull_fvg_count, bear_fvg_filled, bear_fvg_count, bull_fvg_css, bear_fvg_css, table_size)

    if show_og
        set_cells(tb, 3, bull_og_filled, bull_og_count, bear_og_filled, bear_og_count, bull_og_css, bear_og_css, table_size)
        
    if show_vi
        set_cells(tb, 4, bull_vi_filled, bull_vi_count, bear_vi_filled, bear_vi_count, bull_vi_css, bear_vi_css, table_size)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
//FVG
alertcondition(bull_fvg, 'Bullish FVG', 'Bullish FVG detected')
alertcondition(bear_fvg, 'Bearish FVG', 'Bearish FVG detected')

//OG
alertcondition(bull_og, 'Bullish OG', 'Bullish OG detected')
alertcondition(bear_og, 'Bearish OG', 'Bearish OG detected')

//VI
alertcondition(bull_vi, 'Bullish VI', 'Bullish VI detected')
alertcondition(bear_vi, 'Bearish VI', 'Bearish VI detected')

//-----------------------------------------------------------------------------}