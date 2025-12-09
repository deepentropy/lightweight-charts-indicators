// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Pure Price Action Order & Breaker Blocks [LuxAlgo]", 'LuxAlgo - Pure Price Action OB/BB', true, max_lines_count  = 500, max_labels_count = 500, max_boxes_count  = 500)

//---------------------------------------------------------------------------------------------------------------------
//Settings 
//---------------------------------------------------------------------------------------------------------------------{

term = input.string('Intermediate Term', 'Detection', options = ['Short Term', 'Intermediate Term', 'Long Term'], display = display.all - display.status_line)
showBull = input.int(3, 'Show Last Bullish OB', minval = 0, display = display.all - display.status_line)
showBear = input.int(3, 'Show Last Bearish OB', minval = 0, display = display.all - display.status_line)
useBody  = input(true, 'Use Candle Body')

//Style
bullCss      = input(color.new(#2157f3, 80), 'Bullish OB'   , inline = 'bullcss', group = 'Style')
bullBreakCss = input(color.new(#ff1100, 40), 'Bullish Break', inline = 'bullcss', group = 'Style')

bearCss      = input(color.new(#ff5d00, 80), 'Bearish OB'   , inline = 'bearcss', group = 'Style')
bearBreakCss = input(color.new(#0cb51a, 40), 'Bearish Break', inline = 'bearcss', group = 'Style')

showLabels = input(true, 'Show Historical Polarity Changes')

//---------------------------------------------------------------------------------------------------------------------}
//UDT's
//---------------------------------------------------------------------------------------------------------------------{

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

type vector
    array<swing> v

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{

method notransp(color css) => color.rgb(color.r(css), color.g(css), color.b(css))

method display(ob id, css, break_css)=>
    avg = math.avg(id.top, id.btm)

    if id.breaker
        box.new(id.loc, id.top, id.break_loc, id.btm, css
          , bgcolor = css
          , xloc = xloc.bar_time)
        
        line.new(id.break_loc, id.top, time+1, id.top, xloc.bar_time, extend.right, break_css)
        line.new(id.break_loc, id.btm, time+1, id.btm, xloc.bar_time, extend.right, break_css)
        line.new(id.loc, avg, time+1, avg, xloc.bar_time, extend.right, break_css.notransp(), style = line.style_dotted)
    
    if not id.breaker
        box.new(id.loc, id.top, time, id.btm, na
          , bgcolor = css
          , extend = extend.right
          , xloc = xloc.bar_time)

        line.new(id.loc, id.top, time+1, id.top, xloc.bar_time, extend.right, css)
        line.new(id.loc, id.btm, time+1, id.btm, xloc.bar_time, extend.right, css)
        line.new(id.loc, avg, time+1, avg, xloc.bar_time, extend.right, css.notransp(), style = line.style_dotted)

method detect(array<vector> id, mode, depth)=>
    var swing swingLevel = swing.new(na, na)
    for i = 0 to depth-1
        get_v = id.get(i).v

        if get_v.size() == 3
            pivot = switch mode
                'bull' => math.max(get_v.get(0).y, get_v.get(1).y, get_v.get(2).y)
                'bear' => math.min(get_v.get(0).y, get_v.get(1).y, get_v.get(2).y)

            if pivot == get_v.get(1).y
                if i < depth-1
                    id.get(i+1).v.unshift(get_v.get(1))

                    if id.get(i+1).v.size() > 3
                        id.get(i+1).v.pop()
                else
                    swingLevel := swing.new(get_v.get(1).y, get_v.get(1).x)
            
                get_v.pop()
                get_v.pop()
    swingLevel

//---------------------------------------------------------------------------------------------------------------------}
//Detect Swings
//---------------------------------------------------------------------------------------------------------------------{

n = bar_index

depth  = switch term
    'Short Term' => 1
    'Intermediate Term' => 2
    'Long Term' => 3

var fh = array.new<vector>(0)
var fl = array.new<vector>(0)

if barstate.isfirst
    for i = 0 to depth-1
        fh.push(vector.new(array.new<swing>(0)))
        fl.push(vector.new(array.new<swing>(0)))

fh.get(0).v.unshift(swing.new(high, n))
fl.get(0).v.unshift(swing.new(low, n))

if fh.get(0).v.size() > 3
    fh.get(0).v.pop()

if fl.get(0).v.size() > 3
    fl.get(0).v.pop()

top = fh.detect('bull', depth)
btm = fl.detect('bear', depth)

max = useBody ? math.max(close, open) : high
min = useBody ? math.min(close, open) : low

//---------------------------------------------------------------------------------------------------------------------}
//Bullish OB
//---------------------------------------------------------------------------------------------------------------------{

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

//---------------------------------------------------------------------------------------------------------------------}
//Bearish OB
//---------------------------------------------------------------------------------------------------------------------{

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

//---------------------------------------------------------------------------------------------------------------------}
//Set Order Blocks
//---------------------------------------------------------------------------------------------------------------------{

for bx in box.all
    bx.delete()

for l in line.all
    l.delete()

if barstate.islast
    //Bullish
    if showBull > 0
        for i = 0 to math.min(showBull-1, bullish_ob.size()-1)
            get_ob = bullish_ob.get(i)
            get_ob.display(bullCss, bullBreakCss)

    //Bearish
    if showBear > 0
        for i = 0 to math.min(showBear-1, bearish_ob.size()-1)
            get_ob = bearish_ob.get(i)
            get_ob.display(bearCss, bearBreakCss)

//---------------------------------------------------------------------------------------------------------------------}