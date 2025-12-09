// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Liquidity Price Depth Chart [LuxAlgo]", "LuxAlgo - Liquidity Price Depth Chart", overlay = true, max_labels_count = 500)
//-----------------------------------------------------------------------------}
//Settings
//-----------------------------------------------------------------------------{
//Bullish Elements
showBullMax = input(true, 'Bullish Price Highest Volume Location', group = 'Bullish Elements')
showBullPer = input(true, 'Bullish Volume %', group = 'Bullish Elements')

bullCss     = input(#089981, 'Bullish Prices', inline = 'bull', group = 'Bullish Elements')
bullFillCss = input(color.new(#089981, 90), 'Area', inline = 'bull', group = 'Bullish Elements')

//Bearish Elements
showBearMax = input(true, 'Bearish Price Highest Volume Location', group = 'Bearish Elements')
showBearPer = input(true, 'Bearish Volume %', group = 'Bearish Elements')

bearCss     = input(#f23645, 'Bearish Prices', inline = 'bear', group = 'Bearish Elements')
bearFillCss = input(color.new(#f23645, 90), 'Area', inline = 'bear', group = 'Bearish Elements')

//Misc
padding = input.float(5, 'Volume % Box Padding', minval = 0, maxval = 100, group = 'Misc') / 100

//-----------------------------------------------------------------------------}
//Populate maps
//-----------------------------------------------------------------------------{
var int x1 = na

var float max = na, var float max_bull_vol = na
var float min = na, var float max_bear_vol = na

var max_bull_vlvl = line.new(na,na,na,na, color = bullCss, extend = extend.both, style = line.style_dotted)
var max_bear_vlvl = line.new(na,na,na,na, color = bearCss, extend = extend.both, style = line.style_dotted)

var bull_map = map.new<float, float>()
var bear_map = map.new<float, float>()

n = bar_index

if time == chart.left_visible_bar_time
    x1 := n
    max := high, max_bull_vol := close > open ? volume : 0.
    min := low , max_bear_vol := close < open ? volume : 0.

//Populate price/volume map
if time <= chart.right_visible_bar_time and time >= chart.left_visible_bar_time
    if close > open 
        bull_map.put(close, volume)
        max_bull_vol := math.max(volume, max_bull_vol)

        if max_bull_vol == volume and showBullMax
            max_bull_vlvl.set_xy1(n, close + syminfo.mintick)
            max_bull_vlvl.set_xy2(n, close - syminfo.mintick)

    else if close < open 
        bear_map.put(close, volume)
        max_bear_vol := math.max(volume, max_bear_vol)

        if max_bear_vol == volume and showBearMax
            max_bear_vlvl.set_xy1(n, close + syminfo.mintick)
            max_bear_vlvl.set_xy2(n, close - syminfo.mintick)

    //Get maximum/minimum wicks in visible range
    max := math.max(high, max)
    min := math.min(low, min)

//-----------------------------------------------------------------------------}
//Set cumulative areas
//-----------------------------------------------------------------------------{
if time == chart.right_visible_bar_time
    //Sort bull map keys
    bull_sorted = bull_map.keys()
    bull_sorted.sort(order.descending)
    
    //Sort bear map keys
    bear_sorted = bear_map.keys()
    bear_sorted.sort(order.descending)

    //Get bullish/bearish volume sums
    bull_sumv = bull_map.values().sum()
    bear_sumv = bear_map.values().sum()

    bull_idx = 0.
    bear_idx = 0.
    bull_coordinates = array.new<chart.point>(0)
    bear_coordinates = array.new<chart.point>(0)

    bull_coordinates.push(chart.point.from_index(x1, max))
    bear_coordinates.push(chart.point.from_index(n, max))
    
    //Cumulated bullish volume
    for element in bull_sorted
        bull_idx += bull_map.get(element) / bull_sumv
        chart_point = chart.point.from_index(x1 + int(bull_idx * (n - x1) / 2), element)

        if bull_map.get(element) == max_bull_vol and showBullMax
            line.new(x1, element, n, element, color = bullCss, style = line.style_dotted)

        bull_coordinates.push(chart_point)

        //Point label
        label.new(chart_point
          , color = color(na)
          , style = label.style_label_center
          , text = '•'
          , textcolor = bullCss)

    //Cumulated bearish volume
    for [index, element] in bear_sorted
        bear_idx += bear_map.get(element) / bear_sumv
        chart_point = chart.point.from_index(n - int(bear_idx * (n - x1) / 2), element)

        if bear_map.get(element) == max_bear_vol and showBearMax
            line.new(x1, element, n, element, color = bearCss, style = line.style_dotted)

        bear_coordinates.push(chart_point)

        //Point label
        label.new(chart_point
          , color = color(na)
          , style = label.style_label_center
          , text = '•'
          , textcolor = bearCss)

    //Set horizontal min line for valid fill
    bull_coordinates.push(chart.point.from_index(x1 + (n - x1) / 2, min))
    bull_coordinates.push(chart.point.from_index(x1, min))

    bear_coordinates.push(chart.point.from_index(n - (n - x1) / 2, min))
    bear_coordinates.push(chart.point.from_index(n, min))

    //Create polylines
    polyline.new(bull_coordinates, line_color = bullCss, fill_color = bullFillCss)
    polyline.new(bear_coordinates, line_color = bearCss, fill_color = bearFillCss)

    //Bull % Boxes
    if showBullPer
        bull_vper = bull_sumv / (bull_sumv + bear_sumv)

        box.new(x1, min, x1 + (n - x1) / 2, min - padding * (max - min)
          , bullCss
          , bgcolor = na)
        
        box.new(x1, min, x1 + int((n - x1) / 2 * bull_vper), min - padding * (max - min)
          , na
          , bgcolor = bullCss
          , text_color = color.white
          , text = str.tostring(bull_vper * 100, format.percent)
          , text_size = size.small)
    
    //Bear % Boxes
    if showBearPer
        bear_vper = bear_sumv / (bull_sumv + bear_sumv)

        box.new(n - (n - x1) / 2, min, n, min - padding * (max - min)
          , bearCss
          , bgcolor = na)

        box.new(n - int((n - x1) / 2 * bear_vper), min, n, min - padding * (max - min)
          , na
          , bgcolor = bearCss
          , text_color = color.white
          , text = str.tostring(bear_vper * 100, format.percent)
          , text_size = size.small)

//-----------------------------------------------------------------------------}