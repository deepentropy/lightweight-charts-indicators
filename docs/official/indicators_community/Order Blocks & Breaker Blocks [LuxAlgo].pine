// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Order Blocks & Breaker Blocks [LuxAlgo]", overlay = true
  , max_lines_count  = 500
  , max_labels_count = 500
  , max_boxes_count  = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length   = input.int(10, 'Swing Lookback'     , minval = 3)
showBull = input.int(3, 'Show Last Bullish OB', minval = 0)
showBear = input.int(3, 'Show Last Bearish OB', minval = 0)
useBody  = input(false, 'Use Candle Body')

//Style
bullCss      = input(color.new(#2157f3, 80), 'Bullish OB'   , inline = 'bullcss', group = 'Style')
bullBreakCss = input(color.new(#ff1100, 80), 'Bullish Break', inline = 'bullcss', group = 'Style')

bearCss      = input(color.new(#ff5d00, 80), 'Bearish OB'   , inline = 'bearcss', group = 'Style')
bearBreakCss = input(color.new(#0cb51a, 80), 'Bearish Break', inline = 'bearcss', group = 'Style')

showLabels = input(false, 'Show Historical Polarity Changes')

//-----------------------------------------------------------------------------}
//UDT's
//-----------------------------------------------------------------------------{
type ob
    float top = na
    float btm = na
    int   loc = bar_index
    bool  breaker = false
    int   break_loc = na

type swing
    float y = na
    int   x = na
    bool  crossed = false

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
swings(len)=>
    var os = 0
    var swing top = swing.new(na, na)
    var swing btm = swing.new(na, na)
    
    upper = ta.highest(len)
    lower = ta.lowest(len)

    os := high[len] > upper ? 0 
      : low[len] < lower ? 1 : os

    if os == 0 and os[1] != 0
        top := swing.new(high[length], bar_index[length])
    
    if os == 1 and os[1] != 1
        btm := swing.new(low[length], bar_index[length])

    [top, btm]

method notransp(color css) => color.rgb(color.r(css), color.g(css), color.b(css))

method display(ob id, css, break_css)=>
    if id.breaker
        box.new(id.loc, id.top, id.break_loc, id.btm, css.notransp()
          , bgcolor = css
          , xloc = xloc.bar_time)

        box.new(id.break_loc, id.top, time+1, id.btm, na
          , bgcolor = break_css
          , extend = extend.right
          , xloc = xloc.bar_time)
        
        line.new(id.loc, id.top, id.break_loc, id.top, xloc.bar_time, color = css.notransp())
        line.new(id.loc, id.btm, id.break_loc, id.btm, xloc.bar_time, color = css.notransp())
        line.new(id.break_loc, id.top, time+1, id.top, xloc.bar_time, extend.right, break_css.notransp(), line.style_dashed)
        line.new(id.break_loc, id.btm, time+1, id.btm, xloc.bar_time, extend.right, break_css.notransp(), line.style_dashed)
    else
        box.new(id.loc, id.top, time, id.btm, na
          , bgcolor = css
          , extend = extend.right
          , xloc = xloc.bar_time)
        
        line.new(id.loc, id.top, time, id.top, xloc.bar_time, extend.right, css.notransp())
        line.new(id.loc, id.btm, time, id.btm, xloc.bar_time, extend.right, css.notransp())

//-----------------------------------------------------------------------------}
//Detect Swings
//-----------------------------------------------------------------------------{
n = bar_index

[top, btm] = swings(length)
max = useBody ? math.max(close, open) : high
min = useBody ? math.min(close, open) : low

//-----------------------------------------------------------------------------}
//Bullish OB
//-----------------------------------------------------------------------------{
var bullish_ob = array.new<ob>(0)
bull_break_conf = 0

if close > top.y and not top.crossed
    top.crossed := true

    minima = max[1]
    maxima = min[1]
    loc = time[1]

    for i = 1 to (n - top.x)-1
        minima := math.min(min[i], minima)
        maxima := minima == min[i] ? max[i] : maxima
        loc := minima == min[i] ? time[i] : loc

    bullish_ob.unshift(ob.new(maxima, minima, loc))

if bullish_ob.size() > 0
    for i = bullish_ob.size()-1 to 0
        element = bullish_ob.get(i)
    
        if not element.breaker 
            if math.min(close, open) < element.btm
                element.breaker := true
                element.break_loc := time
        else
            if close > element.top
                bullish_ob.remove(i)
            else if i < showBull and top.y < element.top and top.y > element.btm 
                bull_break_conf := 1

//Set label
if bull_break_conf > bull_break_conf[1] and showLabels
    label.new(top.x, top.y, '▼', color = na
      , textcolor = bearCss.notransp()
      , style = label.style_label_down
      , size = size.tiny)

//-----------------------------------------------------------------------------}
//Bearish OB
//-----------------------------------------------------------------------------{
var bearish_ob = array.new<ob>(0)
bear_break_conf = 0

if close < btm.y and not btm.crossed
    btm.crossed := true

    minima = min[1]
    maxima = max[1]
    loc = time[1]

    for i = 1 to (n - btm.x)-1
        maxima := math.max(max[i], maxima)
        minima := maxima == max[i] ? min[i] : minima
        loc := maxima == max[i] ? time[i] : loc

    bearish_ob.unshift(ob.new(maxima, minima, loc))

if bearish_ob.size() > 0
    for i = bearish_ob.size()-1 to 0
        element = bearish_ob.get(i)

        if not element.breaker 
            if math.max(close, open) > element.top
                element.breaker := true
                element.break_loc := time
        else
            if close < element.btm
                bearish_ob.remove(i)
            else if i < showBear and btm.y > element.btm and btm.y < element.top 
                bear_break_conf := 1

//Set label
if bear_break_conf > bear_break_conf[1] and showLabels
    label.new(btm.x, btm.y, '▲', color = na
      , textcolor = bullCss.notransp()
      , style = label.style_label_up
      , size = size.tiny)

//-----------------------------------------------------------------------------}
//Set Order Blocks
//-----------------------------------------------------------------------------{
for bx in box.all
    bx.delete()

for l in line.all
    l.delete()

if barstate.islast
    //Bullish
    if showBull > 0
        for i = 0 to math.min(showBull-1, bullish_ob.size())
            get_ob = bullish_ob.get(i)
            get_ob.display(bullCss, bullBreakCss)

    //Bearish
    if showBear > 0
        for i = 0 to math.min(showBear-1, bearish_ob.size())
            get_ob = bearish_ob.get(i)
            get_ob.display(bearCss, bearBreakCss)

//-----------------------------------------------------------------------------}