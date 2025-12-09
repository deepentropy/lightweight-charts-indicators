// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('Trendline Breakout Navigator [LuxAlgo]', shorttitle='LuxAlgo - Trendline Breakout Navigator', max_lines_count=500, max_labels_count=500, max_bars_back=5000, overlay=true)

//---------------------------------------------------------------------------------------------------------------------
// Settings
//---------------------------------------------------------------------------------------------------------------------{
sp='         '
res   = input.timeframe (    ''   , 'Period        '                                )
i1        = input.bool  (   true  , ''            , inline='1', group='Swing Length')
i2        = input.bool  (   true  , ''            , inline='2', group='Swing Length')
i3        = input.bool  (   true  , ''            , inline='3', group='Swing Length')
l1        = input.int   (60, 'Long     ', minval=1, inline='1', group='Swing Length')
l2        = input.int   (30, 'Medium'   , minval=1, inline='2', group='Swing Length')
l3        = input.int   (10, 'Short    ', minval=1, inline='3', group='Swing Length')
cBull     = input.color (#089981, 'Trendline'+sp, inline='d', group='Style'       )
cBear     = input.color (#f23645, ''            , inline='d', group='Style'
          , tooltip    =            'Bullish/Bearish Trendline'                   )
cWickBull = input.color (#085def, 'Wick Dot' +sp, inline='w', group='Style'   )
cWickBear = input.color (#ff5d00, ''            , inline='w', group='Style'
          , tooltip    =            'Bullish/Bearish Wick'                   )
term      = input.string('Long'   , 'Term'
          , options    =['Long'   , 'Medium', 'Short'              ]     )
HHLL      = input.string('None'   , 'HH/LL'  
          , options    =['None','Only HH/LL','HH/LL & previous H/L'])
bg        = input.bool  (  false  , 'Background Color'        )
cc        = input.bool  (  false  , 'Bar Color'      )

//---------------------------------------------------------------------------------------------------------------------}
//LuxAlgo Defined Type
//---------------------------------------------------------------------------------------------------------------------{
type bin 
    line    lin 
    float   slope
    bool    active
    chart.point cp

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{
lbi = last_bar_index
n   = bar_index
INV = color(na)

//---------------------------------------------------------------------------------------------------------------------}
//Function
//---------------------------------------------------------------------------------------------------------------------{
draw(toggle, res, left, right, pos) =>

    ps = term == 'Long' ? 1 : term == 'Medium' ? 2 : 3

    var int trend    = 0
    var chart.point prevPh = chart.point.from_index(na, na)
    var chart.point prevPl = chart.point.from_index(na, na)

    var bn = bin.new(line(na), 0, false)

    ph_ = ta.pivothigh(left, right), [tH, ph]  = request.security(syminfo.tickerid, res, [time[2], ph_])
    pl_ = ta.pivotlow (left, right), [tL, pl]  = request.security(syminfo.tickerid, res, [time[2], pl_])

    cH = ta.change(fixnan(ph))    
    cL = ta.change(fixnan(pl))

    chH = cH != 0 and cL == 0
    chL = cL != 0 and cH == 0

    if toggle

        if bn.active 
            if bn.lin.get_x2() - bn.lin.get_x1() > 5000 
                bn.active := false 
                bn.lin.delete() 
            else 
                bn.lin.set_xy2(n, bn.lin.get_y2() + bn.slope)

        if chH 
            v = 0.
            idx = 0
            for i = 0 to 5000 
                Ti = time[i]
                if high[i] > v 
                    v := high[i]
                    idx := i
                if Ti < tH 
                    break
            x = n - idx
            c = close[idx]

            if trend < 1 
                //HH
                if v > prevPh.price and x - prevPh.index > 5 and n - prevPl.index < 5000
                    if pos == ps and HHLL != 'None'
                        label.new(x, v, color=color(na), text='HH\n', size=size.tiny, textcolor=chart.fg_color)
                        if HHLL == 'HH/LL & previous H/L'
                            label.new(prevPh.index, prevPh.price, color=color(na), size=size.tiny, text='●', textcolor=chart.fg_color)

                    trend := 1
                    bn := bin.new(line.new(prevPl.index, prevPl.price, n, prevPl.price, color=cBull
                     , style= pos == 1 ? line.style_solid : pos == 2 ? line.style_dashed : line.style_dotted, width=pos == 1 ? 2 : 1)
                     , 0, true, chart.point.from_index(prevPl.index, prevPl.price))
                else 
                    //if bearish TL
                    if bn.active
                        slope = (v - bn.cp.price) / (x - bn.cp.index)
                        //if line direction is down and wick breaks line or first LH
                        if v < bn.lin.get_y1() + slope and (v > bn.lin.get_y2() + slope or bn.slope == 0)
                            priceLin = bn.lin.get_price(n-idx) 
                            if c < priceLin
                                //where wick breaks last line price 
                                if bn.slope != 0
                                    label.new(n-idx, priceLin, style=label.style_label_center, text='●', color=color(na), textcolor=cWickBear)
                                //First update line
                                bn.lin.set_xy2(n, v + slope*idx)
                                //if first Swing after line conception
                                if bn.slope == 0
                                    //repeat until all close prices are below the line
                                    stop = false 
                                    while not stop
                                        arr = array.new<float>()
                                        //check for inner-line breaks with close
                                        for i = 0 to n - bn.lin.get_x1()
                                            arr.push(close[i] - bn.lin.get_price(n-i))
                                        highest_point = arr.max()
                                        //if yes, update first point to highest point
                                        if highest_point > 0
                                            ix = arr.indexof(highest_point)  
                                            x1 = n-ix, y1 = high[ix]
                                            //label.new(x1, y1)
                                            bn.cp.index := x1 
                                            bn.cp.price := y1
                                            slope  := (v - y1) / (x - x1)
                                            bn.lin.set_xy2(n, v + slope*idx)                                         
                                            bn.lin.set_xy1(x1, y1)
                                            bn.slope := slope
                                        else 
                                            bn.lin.set_xy2(n, v + slope*idx)                                         
                                            bn.slope := slope
                                            stop := true
                                else 
                                    bn.slope := slope
                            else 
                                //if close price at Swing point breaks line
                                bn.active := false
            prevPh.index := x
            prevPh.price := v

        else 
            if trend < 1 
                if close > bn.lin.get_y2() 
                    bn.active := false

        if chL 
            v = 10e6
            idx = 0
            for i = 0 to 5000 
                Ti = time[i]
                if low[i] < v 
                    v := low[i]
                    idx := i
                if Ti < tL
                    break
            x = n - idx
            c = close[idx]

            if trend >-1 
                //LL
                if v < prevPl.price and x - prevPl.index > 5 and n - prevPh.index < 5000
                    if pos == ps and HHLL != 'None'
                        label.new(x, v, color=color(na), text='\nLL', size=size.tiny, textcolor=chart.fg_color, style=label.style_label_up)
                        if HHLL == 'HH/LL & previous H/L'
                            label.new(prevPl.index, prevPl.price, color=color(na), size=size.tiny, text='●', textcolor=chart.fg_color, style=label.style_label_up)

                    trend :=-1
                    bn := bin.new(line.new(prevPh.index, prevPh.price, n, prevPh.price, color=cBear
                     , style= pos == 1 ? line.style_solid : pos == 2 ? line.style_dashed : line.style_dotted, width=pos == 1 ? 2 : 1)
                     , 0, true, chart.point.from_index(prevPh.index, prevPh.price))
                else 
                    //if bullish TL
                    if bn.active
                        slope = (v - bn.cp.price) / (x - bn.cp.index)
                        //if line direction is up and wick breaks line or first HL
                        if v > bn.lin.get_y1() + slope and (v < bn.lin.get_y2() + slope or bn.slope == 0)
                            priceLin = bn.lin.get_price(n-idx)

                            if c > priceLin 
                                //where wick breaks last line price 
                                if bn.slope != 0
                                    label.new(n-idx, priceLin, style=label.style_label_center, text='●', color=color(na), textcolor=cWickBull)
                                //First update line
                                bn.lin.set_xy2(n, v + slope*idx)
                                //if first Swing after line conception
                                if bn.slope == 0
                                    //repeat until all close prices are above the line
                                    stop = false 
                                    while not stop                                        
                                        arr = array.new<float>()
                                        //check for inner-line breaks with close
                                        for i = 0 to n - bn.lin.get_x1()
                                            arr.push(bn.lin.get_price(n-i)-close[i])
                                        deepest_point = arr.max()
                                        //if yes, update first point to deepest point
                                        if deepest_point > 0
                                            ix = arr.indexof(deepest_point)  
                                            x1 = n-ix, y1 = low[ix]
                                            bn.cp.index := x1 
                                            bn.cp.price := y1
                                            slope  := (v - y1) / (x - x1)
                                            bn.lin.set_xy2(n, v + slope*idx)                                         
                                            bn.lin.set_xy1(x1, y1)
                                            bn.slope := slope
                                        else
                                            bn.lin.set_xy2(n, v + slope*idx)                                         
                                            bn.slope := slope
                                            stop := true
                                else 
                                    bn.slope := slope
                            else 
                                //if close price at Swing point breaks line
                                bn.active := false
            prevPl.index := x
            prevPl.price := v
        else 
            if trend >-1 
                if close < bn.lin.get_y2() 
                    bn.active := false

    [trend, bn.lin.get_y2()]

//---------------------------------------------------------------------------------------------------------------------}
//Execution
//---------------------------------------------------------------------------------------------------------------------{
[trend1, value1] = draw(i1, res, l1, 1, 1)
[trend2, value2] = draw(i2, res, l2, 1, 2)
[trend3, value3] = draw(i3, res, l3, 1, 3)

col = color(na)
if cc 
    col := switch close > value1
        true => 
            switch close > value2
                true => 
                    if close > value3
                        color.new(cBull, 20)
                    else
                        color.new(cBull, 43)
                => 
                    if close > value3
                        color.new(cBull, 66)
                    else
                        color.new(cBull, 89)
        => 
            switch close < value2
                true => 
                    if close < value3
                        color.new(cBear, 20)
                    else
                        color.new(cBear, 43)
                => 
                    if close < value3
                        color.new(cBear, 66)
                    else
                        color.new(cBear, 89)

//---------------------------------------------------------------------------------------------------------------------}
//Plot - Bar/Background Color
//---------------------------------------------------------------------------------------------------------------------{
plot(value1, display=display.none)
plot(value2, display=display.none)
plot(value3, display=display.none)
plot(trend1, display=display.none)
barcolor(cc ? col : na)

//Background color - close above/below value1-2-3
isValid = bg and (term == 'Long' ? i1 : term == 'Medium' ? i2 : i3)
bgcolor(isValid ? color.new(close > (term == 'Long' ? value1 : term == 'Medium' ? value2 : value3) ? cBull : cBear, 97) : na)

//---------------------------------------------------------------------------------------------------------------------}