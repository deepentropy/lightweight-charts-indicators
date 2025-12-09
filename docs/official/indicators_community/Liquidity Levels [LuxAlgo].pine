// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Liquidity Levels [LuxAlgo]", "LuxAlgo - Liquidity Levels",overlay = true, max_bars_back = 2000, max_lines_count = 500, max_labels_count = 500)
//-----------------------------------------------------------------------------}
//Settings
//-----------------------------------------------------------------------------{
length = input.int(20, minval = 1)
show   = input.int(5,'Number Of Levels', minval = 1)

lineCol  = input.string('Fixed','Levels Color Mode', options = ['Relative','Random','Fixed'])
lvlStyle = input.string('──','Levels Style', options = ['──','- - -','· · ·'])

//Levels color
relativeColUp = input(#2157f3,'', inline = 'lvlcol')
relativeColDn = input(#ff5d00,'', inline = 'lvlcol')
fixed_col       = input(#2157f3,'Fixed Color', inline = 'lvlcol')

//Style
show_hist = input(true, 'Show Histogram', group = 'Histogram')
distwin   = input.int(200, 'Histogram Window', maxval = 500, group = 'Histogram')
upCol     = input(color.new(#2157f3,50), 'Bins Colors', group = 'Histogram', inline = 'col')
dnCol     = input(color.new(#ff5d00,50), '', group = 'Histogram', inline = 'col')

//-----------------------------------------------------------------------------}
//Type
//-----------------------------------------------------------------------------{
type histbar
    box bull
    box bear

//-----------------------------------------------------------------------------}
//Populate arrays
//-----------------------------------------------------------------------------{
var color css = na
var lines   = array.new_line(0)
var hist_bars = array.new<histbar>(0)

if barstate.isfirst
    color rand_css = na

    //Populate levels
    for i = 0 to show-1
        //Levels color
        if lineCol == 'Random'
            rand_css := color.rgb(math.random(0,255), math.random(0,255), math.random(0,255))
        else
            rand_css := fixed_col

        //Line style
        style = switch lvlStyle
            '- - -' => line.style_dashed
            '· · ·' => line.style_dotted
            => line.style_solid
            
        lines.push(line.new(na,na,na,na
          , color = rand_css
          , extend = extend.left
          , style = style))
        
        //Populate histogram bars
        if i < show-1 and show_hist
            hist_bars.push(histbar.new(box.new(na,na,na,na,na, bgcolor = upCol), box.new(na,na,na,na,na, bgcolor = dnCol)))

//-----------------------------------------------------------------------------}
//Get liquidity levels values
//-----------------------------------------------------------------------------{
var pals = array.new<float>(0)

phv = ta.pivothigh(volume,length,length)

//On volume peak
if phv
    pals.unshift(close[length])

    if pals.size() > show
        pals.pop()

//-----------------------------------------------------------------------------}
//Display levels/histogram
//-----------------------------------------------------------------------------{
n = bar_index

if barstate.islast
    //Sort liquidity levels values (required for binary search)
    pals.sort()

    //Set levels
    for [index, element] in pals
        get = lines.get(index)
        get.set_xy1(n-1, element)
        get.set_xy2(n, element)

        if lineCol == 'Relative'
            get.set_color(close > element ? relativeColUp : relativeColDn)

    //Compute histogram
    bull  = array.new<int>(show-1, 0)
    bear = array.new<int>(show-1, 0)
    if show_hist
        //Iterate trough calculation window
        for i = 0 to distwin-1
            //Look where current close lies within liquidity levels and return index
            idx = pals.binary_search_rightmost(close[i])

            //Test if price lies within valid liquidity levels range and update count
            if idx >= 1 and idx < show
                if close[i] > open[i]
                    get = bull.get(idx-1)
                    bull.set(idx-1, get + 1)
                else
                    get = bear.get(idx-1)
                    bear.set(idx-1, get + 1)
        
        //Set histogram
        for [index, element] in hist_bars
            element.bull.set_rightbottom(n+bull.get(index), pals.get(index+1))
            element.bull.set_lefttop(n, pals.get(index))
            
            element.bear.set_rightbottom(n+bull.get(index)+bear.get(index), pals.get(index+1))
            element.bear.set_lefttop(n+bull.get(index), pals.get(index))

//-----------------------------------------------------------------------------}