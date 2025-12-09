// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Elliott Wave [LuxAlgo]", max_lines_count=500, max_labels_count=500, overlay=true, max_bars_back=5000)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
i_hi  = input.string('high'        , title=        ''          , group='source [high - low]', inline='hl', options=['high', 'close', 'max open/close'])
i_lo  = input.string('low'         , title=        ''          , group='source [high - low]', inline='hl', options=['low' , 'close', 'min open/close'])

s1    = input.bool  (true          , title=        ''          , group='ZigZag'             , inline= '1'                                             )
len1  = input.int   ( 4            , title=        '  1 Length', group='ZigZag'             , inline= '1', minval =1                                  )
col1  = input.color (color.red   , title=        ''          , group='ZigZag'             , inline= '1'                                             )
s2    = input.bool  (true          , title=        ''          , group='ZigZag'             , inline= '2'                                             )
len2  = input.int   ( 8            , title=        '  2 Length', group='ZigZag'             , inline= '2', minval =1                                  )
col2  = input.color (color.blue  , title=        ''          , group='ZigZag'             , inline= '2'                                             )
s3    = input.bool  (true          , title=        ''          , group='ZigZag'             , inline= '3'                                             )                                           
len3  = input.int   (16            , title=        '  3 Length', group='ZigZag'             , inline= '3', minval =1                                  )
col3  = input.color (color.white , title=        ''          , group='ZigZag'             , inline= '3'                                             )


i_500 = input.float (0.500         , title='           level 1', group='Fibonacci values'   ,              minval =0, maxval =1, step =0.01           )
i_618 = input.float (0.618         , title='           level 2', group='Fibonacci values'   ,              minval =0, maxval =1, step =0.01           )
i_764 = input.float (0.764         , title='           level 3', group='Fibonacci values'   ,              minval =0, maxval =1, step =0.01           )
i_854 = input.float (0.854         , title='           level 4', group='Fibonacci values'   ,              minval =0, maxval =1, step =0.01           )

shZZ  = input.bool  (false         , title=         ''         , group='show ZZ'            , inline='zz'                                             )

//-----------------------------------------------------------------------------}
//User Defined Types
//-----------------------------------------------------------------------------{
type ZZ 
    int  [] d
    int  [] x 
    float[] y 
    line [] l

type Ewave
    line   l1
    line   l2
    line   l3  
    line   l4
    line   l5
    label  b1
    label  b2
    label  b3
    label  b4
    label  b5
    //
    bool   on
    bool   br //= na
    //
    int    dir
    //
    line   lA
    line   lB
    line   lC
    label  bA
    label  bB
    label  bC
    //
    bool next = false
    //
    label  lb
    box    bx

type fibL
    line wave1_0_500 
    line wave1_0_618 
    line wave1_0_764 
    line wave1_0_854 
    line wave1_pole_ 
    linefill l_fill_ 
    bool     _break_ //= na

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
hi = i_hi == 'high' ? high : i_hi == 'close' ? close : math.max(open, close)
lo = i_lo == 'low'  ? low  : i_hi == 'close' ? close : math.min(open, close)

in_out(aZZ, d, x1, y1, x2, y2, col) =>
    aZZ.d.unshift(d), aZZ.x.unshift(x2), aZZ.y.unshift(y2), aZZ.d.pop(), aZZ.x.pop(), aZZ.y.pop()
    if shZZ
        aZZ.l.unshift(line.new(x1, y1, x2, y2, color= col)), aZZ.l.pop().delete()

method isSame(Ewave gEW, _1x, _2x, _3x, _4x) => 
    t1 = _1x == gEW.l1.get_x1() 
    t2 = _2x == gEW.l2.get_x1() 
    t3 = _3x == gEW.l3.get_x1()  
    t4 = _4x == gEW.l4.get_x1()
    t1 and t2 and t3 and t4

method isSame2(Ewave gEW, _1x, _2x, _3x) => 
    t1 = _1x == gEW.l3.get_x2() 
    t2 = _2x == gEW.l4.get_x2()  
    t3 = _3x == gEW.l5.get_x2()
    t1 and t2 and t3 

method dot(Ewave gEW) =>
    gEW.l1.set_style(line.style_dotted)
    gEW.l2.set_style(line.style_dotted)
    gEW.l3.set_style(line.style_dotted)
    gEW.l4.set_style(line.style_dotted)
    gEW.l5.set_style(line.style_dotted)
    gEW.b1.set_textcolor    (color(na))
    gEW.b2.set_textcolor    (color(na))
    gEW.b3.set_textcolor    (color(na))
    gEW.b4.set_textcolor    (color(na))
    gEW.b5.set_textcolor    (color(na))
    gEW.on := false

method dash(Ewave gEW) =>
    gEW.lA.set_style(line.style_dashed)
    gEW.lB.set_style(line.style_dashed)
    gEW.lC.set_style(line.style_dashed)
    gEW.bA.set_textcolor    (color(na))
    gEW.bB.set_textcolor    (color(na))
    gEW.bC.set_textcolor    (color(na))
    gEW.bx.set_bgcolor      (color(na))
    gEW.bx.set_border_color (color(na))

method sol_dot(fibL nFibL, sol_dot, col) =>
    style = 
     sol_dot ==  'dot'  ? 
      line.style_dotted : 
     sol_dot ==  'sol'  ? 
      line.style_solid  :
      line.style_dashed
    nFibL.wave1_0_500.set_style(style)
    nFibL.wave1_0_618.set_style(style)
    nFibL.wave1_0_764.set_style(style)
    nFibL.wave1_0_854.set_style(style)
    nFibL.l_fill_.set_color(col)

method set(fibL nFibL, int x1, int x2, float max_500, float max_618, float max_764, float max_854, float y2) =>
    nFibL.wave1_0_500.set_xy1(x1, max_500)
    nFibL.wave1_0_500.set_xy2(x2, max_500)
    nFibL.wave1_0_618.set_xy1(x1, max_618)
    nFibL.wave1_0_618.set_xy2(x2, max_618)
    nFibL.wave1_0_764.set_xy1(x1, max_764)
    nFibL.wave1_0_764.set_xy2(x2, max_764)
    nFibL.wave1_0_854.set_xy1(x1, max_854)
    nFibL.wave1_0_854.set_xy2(x2, max_854)
    nFibL.wave1_pole_.set_xy1(x1,     y2 )
    nFibL.wave1_pole_.set_xy2(x1, max_854)
    nFibL.l_fill_.get_line1().set_xy1(x1, max_764)
    nFibL.l_fill_.get_line1().set_xy2(x2, max_764)
    nFibL.l_fill_.get_line2().set_xy1(x1, max_854)
    nFibL.l_fill_.get_line2().set_xy2(x2, max_854)

method setNa(fibL nFibL) =>
    nFibL.wave1_0_500.set_xy1(na, na)
    nFibL.wave1_0_500.set_xy2(na, na)
    nFibL.wave1_0_618.set_xy1(na, na)
    nFibL.wave1_0_618.set_xy2(na, na)
    nFibL.wave1_0_764.set_xy1(na, na)
    nFibL.wave1_0_764.set_xy2(na, na)
    nFibL.wave1_0_854.set_xy1(na, na)
    nFibL.wave1_0_854.set_xy2(na, na)
    nFibL.wave1_pole_.set_xy1(na, na)
    nFibL.wave1_pole_.set_xy2(na, na)
    nFibL.l_fill_.set_color(color(na))

draw(enabled, left, col, n) =>
    //
    max_bars_back(time, 2000)
    var int dir = na, var int x1= na, var float y1 = na, var int x2 = na, var float y2 = na, var Ewave gEW = na
    var int last_0x = na    ,  var float last_0y = na    ,   var int last_6x = na   ,    var float last_6y = na
    //
    if enabled
        var fibL nFibL = fibL.new(
           wave1_0_500 = line.new(na, na, na, na, color= color.new(col, 50), style= line.style_solid ),
           wave1_0_618 = line.new(na, na, na, na, color= color.new(col, 38), style= line.style_solid ),
           wave1_0_764 = line.new(na, na, na, na, color= color.new(col, 24), style= line.style_solid ),
           wave1_0_854 = line.new(na, na, na, na, color= color.new(col, 15), style= line.style_solid ),
           wave1_pole_ = line.new(na, na, na, na, color= color.new(col, 50), style= line.style_dashed),
               l_fill_ = linefill.new(
                         line.new(na, na, na, na, color= color(na))
                       , line.new(na, na, na, na, color= color(na))
                       ,                          color= color(na))
                       ,                         _break_   =   na
               )
        //
        var  ZZ        aZZ   =   ZZ.new(array.new < int   > ()
                                      , array.new < int   > ()
                                      , array.new < float > ()
                                      , array.new < line  > () )
        var Ewave[]    aEW   =          array.new < Ewave > ()
        //
        if barstate.isfirst
            aEW.unshift(Ewave.new())
            for i = 0 to 10
                aZZ.d.unshift(0)
                aZZ.x.unshift(0)
                aZZ.y.unshift(0)
                aZZ.l.unshift(shZZ ? line.new(na, na, na, na) : na)
        //
        sz       = aZZ.d.size( )
        x2      := bar_index -1
        ph       = ta.pivothigh(hi, left, 1)
        pl       = ta.pivotlow (lo, left, 1)
        t        = n == 2 ? '\n\n' : n == 1 ? '\n' : ''
        //
        // when a new Pivot High is found
        if not na(ph) 
            gEW := aEW.get   (0)
            dir := aZZ.d.get (0) 
            x1  := aZZ.x.get (0) 
            y1  := aZZ.y.get (0) 
            y2  :=      nz(hi[1])
            //
            if dir <  1  // if previous point was a pl, add, and change direction ( 1)
                in_out(aZZ,  1, x1, y1, x2, y2, col)
            else
                if dir ==  1 and ph > y1 
                    aZZ.x.set(0, x2), aZZ.y.set(0, y2)
                    if shZZ
                        aZZ.l.get(0).set_xy2(x2, y2)
            //
            _6x = x2, _6y = y2
            _5x = aZZ.x.get(1), _5y = aZZ.y.get(1)
            _4x = aZZ.x.get(2), _4y = aZZ.y.get(2)
            _3x = aZZ.x.get(3), _3y = aZZ.y.get(3)
            _2x = aZZ.x.get(4), _2y = aZZ.y.get(4)
            _1x = aZZ.x.get(5), _1y = aZZ.y.get(5)
            //
            // –––––––––––––––––––––[ 12345 ]–––––––––––––––––––––
            _W5 = _6y - _5y
            _W3 = _4y - _3y
            _W1 = _2y - _1y
            min = math.min(_W1, _W3, _W5)
            isWave = 
             _W3 != min and
             _6y  > _4y and 
             _3y  > _1y and 
             _5y  > _2y
            // 
            same = gEW.isSame(_1x, _2x, _3x, _4x)
            if isWave
                if same
                    gEW.l5.set_xy2(_6x, _6y)
                    gEW.b5.set_xy (_6x, _6y)
                else
                    tx = ''
                    if _2x == aEW.get(0).b5.get_x() 
                        tx := '(5) (1)' 
                        aEW.get(0).b5.set_text('')
                    else
                        tx := '(1)'
                    //                
                    wave = Ewave.new(
                     l1  = line.new (_1x, _1y, _2x, _2y                      , color=col       , style= line.style_solid     ),
                     l2  = line.new (_2x, _2y, _3x, _3y                      , color=col       , style= line.style_solid     ),
                     l3  = line.new (_3x, _3y, _4x, _4y                      , color=col       , style= line.style_solid     ),
                     l4  = line.new (_4x, _4y, _5x, _5y                      , color=col       , style= line.style_solid     ),
                     l5  = line.new (_5x, _5y, _6x, _6y                      , color=col       , style= line.style_solid     ),
                     b1  = label.new(_2x, _2y, text= tx    + t, textcolor=col, color= color(na), style=label.style_label_down),
                     b2  = label.new(_3x, _3y, text= t + '(2)', textcolor=col, color= color(na), style=label.style_label_up  ),
                     b3  = label.new(_4x, _4y, text= '(3)' + t, textcolor=col, color= color(na), style=label.style_label_down),
                     b4  = label.new(_5x, _5y, text= t + '(4)', textcolor=col, color= color(na), style=label.style_label_up  ),
                     b5  = label.new(_6x, _6y, text= '(5)' + t, textcolor=col, color= color(na), style=label.style_label_down),
                     on  = true                                                                                               ,
                     br  = false                                                                                              ,
                     dir = 1
                      )
                    aEW.unshift(wave)
                    nFibL._break_ := false   
                    alert('New EW Motive Bullish Pattern found'  , alert.freq_once_per_bar_close)                                                                                       
            //
            if not isWave
                if same and gEW.on == true
                    gEW.dot() 
                    alert('Invalidated EW Motive Bullish Pattern', alert.freq_once_per_bar_close)                                                                                       
            //
            // –––––––––––––––––––––[ ABC ]–––––––––––––––––––––
            getEW    = aEW.get(0)
            last_0x := getEW.l1.get_x1(), last_0y := getEW.l1.get_y1()
            last_6x := getEW.l5.get_x2(), last_6y := getEW.l5.get_y2()
            diff     = math.abs(last_6y - last_0y)
            //
            if getEW.dir == -1 
                getX    = getEW.l5.get_x2()                
                getY    = getEW.l5.get_y2() 
                isSame2 = getEW.isSame2  (_1x, _2x, _3x)
                isValid =
                   _3x == getX                  and 
                   _6y  < getY + (diff * i_854) and
                   _4y  < getY + (diff * i_854) and
                   _5y  > getY
                //
                if isValid
                    width = _6x - _2x // –––[ width (4) - (c) ]–––
                    if isSame2 and getEW.bA.get_x() > _3x
                        getEW.lC.set_xy1(_5x, _5y), getEW.lC.set_xy2(_6x, _6y), getEW.bC.set_xy(_6x, _6y), getEW.bx.set_lefttop(_6x, _6y), getEW.bx.set_right(_6x + width)
                    else
                        getEW.lA := line.new (_3x, _3y, _4x, _4y, color=col), getEW.bA := label.new(_4x, _4y, text= '(a)' + t, textcolor=col, color= color(na), style=label.style_label_down)
                        getEW.lB := line.new (_4x, _4y, _5x, _5y, color=col), getEW.bB := label.new(_5x, _5y, text= t + '(b)', textcolor=col, color= color(na), style=label.style_label_up  )
                        getEW.lC := line.new (_5x, _5y, _6x, _6y, color=col), getEW.bC := label.new(_6x, _6y, text= '(c)' + t, textcolor=col, color= color(na), style=label.style_label_down)
                        getEW.bx := box.new  (_6x, _6y, _6x + width, _4y, bgcolor=color.new(col, 93), border_color=color.new(col, 65))
                        alert('New EW Corrective Bullish Pattern found'  , alert.freq_once_per_bar_close)                                                                                       
                else
                    if isSame2 and getEW.bA.get_x() > _3x
                        getEW.dash()
                        alert('Invalidated EW Corrective Bullish Pattern', alert.freq_once_per_bar_close)                                                                                       
            //
            // –––––––––––––––––––––[ new (1) ? ]–––––––––––––––––––––
            if getEW.dir ==  1 
                if _5x == getEW.bC.get_x() and 
                   _6y >  getEW.b5.get_y() and
                   getEW.next  == false
                    getEW.next := true
                    getEW.lb   := label.new(_6x, _6y, style=label.style_circle, color=color.new(col, 65), yloc=yloc.abovebar, size=size.tiny)
                    alert('Possible new start of EW Motive Bullish Wave', alert.freq_once_per_bar_close)                                                                                       
        //
        // when a new Pivot Low is found
        if not na(pl) 
            gEW := aEW.get   (0)
            dir := aZZ.d.get (0) 
            x1  := aZZ.x.get (0) 
            y1  := aZZ.y.get (0) 
            y2  :=      nz(lo[1])
            //
            if dir > -1  // if previous point was a ph, add, and change direction (-1)
                in_out(aZZ, -1, x1, y1, x2, y2, col)
            else
                if dir == -1 and pl < y1 
                    aZZ.x.set(0, x2), aZZ.y.set(0, y2)
                    if shZZ
                        aZZ.l.get(0).set_xy2(x2, y2)
            //
            _6x = x2, _6y = y2
            _5x = aZZ.x.get(1), _5y = aZZ.y.get(1)
            _4x = aZZ.x.get(2), _4y = aZZ.y.get(2)
            _3x = aZZ.x.get(3), _3y = aZZ.y.get(3)
            _2x = aZZ.x.get(4), _2y = aZZ.y.get(4)
            _1x = aZZ.x.get(5), _1y = aZZ.y.get(5)
            //
            // –––––––––––––––––––––[ 12345 ]–––––––––––––––––––––
            _W5 = _5y - _6y
            _W3 = _3y - _4y
            _W1 = _1y - _2y
            min = math.min(_W1, _W3, _W5)
            isWave = 
             _W3 != min and
             _4y  > _6y and 
             _1y  > _3y and 
             _2y  > _5y
            // 
            same = isSame(gEW, _1x, _2x, _3x, _4x)
            if isWave
                if same
                    gEW.l5.set_xy2(_6x, _6y)
                    gEW.b5.set_xy (_6x, _6y)
                else
                    tx = ''
                    if _2x == aEW.get(0).b5.get_x() 
                        tx := '(5) (1)' 
                        aEW.get(0).b5.set_text('')
                    else
                        tx := '(1)'
                    //
                    wave = Ewave.new(
                     l1  = line.new (_1x, _1y, _2x, _2y                      , color=col       , style= line.style_solid     ),
                     l2  = line.new (_2x, _2y, _3x, _3y                      , color=col       , style= line.style_solid     ),
                     l3  = line.new (_3x, _3y, _4x, _4y                      , color=col       , style= line.style_solid     ),
                     l4  = line.new (_4x, _4y, _5x, _5y                      , color=col       , style= line.style_solid     ),
                     l5  = line.new (_5x, _5y, _6x, _6y                      , color=col       , style= line.style_solid     ),
                     b1  = label.new(_2x, _2y, text= t    + tx, textcolor=col, color= color(na), style=label.style_label_up  ),
                     b2  = label.new(_3x, _3y, text= '(2)' + t, textcolor=col, color= color(na), style=label.style_label_down),
                     b3  = label.new(_4x, _4y, text= t + '(3)', textcolor=col, color= color(na), style=label.style_label_up  ),
                     b4  = label.new(_5x, _5y, text= '(4)' + t, textcolor=col, color= color(na), style=label.style_label_down),
                     b5  = label.new(_6x, _6y, text= t + '(5)', textcolor=col, color= color(na), style=label.style_label_up  ),
                     on  = true                                                                                               ,
                     br  = false                                                                                              ,
                     dir =-1
                      )
                    aEW.unshift(wave)
                    nFibL._break_ := false 
                    alert('New EW Motive Bearish Pattern found'  , alert.freq_once_per_bar_close)                                                                                                                                                            
            //        
            if not isWave
                if same and gEW.on == true
                    gEW.dot()   
                    alert('Invalidated EW Motive Bearish Pattern', alert.freq_once_per_bar_close)                                                                                       
            //
            // –––––––––––––––––––––[ ABC ]–––––––––––––––––––––
            getEW    = aEW.get(0)
            last_0x := getEW.l1.get_x1(), last_0y := getEW.l1.get_y1()
            last_6x := getEW.l5.get_x2(), last_6y := getEW.l5.get_y2()
            diff     = math.abs(last_6y - last_0y)
            //
            if getEW.dir ==  1 
                getX    = getEW.l5.get_x2()                
                getY    = getEW.l5.get_y2() 
                isSame2 = getEW.isSame2  (_1x, _2x, _3x)
                isValid =
                   _3x == getX                  and 
                   _6y  > getY - (diff * i_854) and
                   _4y  > getY - (diff * i_854) and
                   _5y  < getY
                //
                if isValid
                    width = _6x - _2x // –––[ width (4) - (c) ]–––
                    if isSame2 and getEW.bA.get_x() > _3x
                        getEW.lC.set_xy1(_5x, _5y), getEW.lC.set_xy2(_6x, _6y), getEW.bC.set_xy(_6x, _6y), getEW.bx.set_lefttop(_6x, _6y), getEW.bx.set_right(_6x + width)
                    else
                        getEW.lA := line.new (_3x, _3y, _4x, _4y, color=col), getEW.bA := label.new(_4x, _4y, text= t + '(a)', textcolor=col, color= color(na), style=label.style_label_up  )
                        getEW.lB := line.new (_4x, _4y, _5x, _5y, color=col), getEW.bB := label.new(_5x, _5y, text= '(b)' + t, textcolor=col, color= color(na), style=label.style_label_down)
                        getEW.lC := line.new (_5x, _5y, _6x, _6y, color=col), getEW.bC := label.new(_6x, _6y, text= t + '(c)', textcolor=col, color= color(na), style=label.style_label_up  )
                        getEW.bx := box.new  (_6x, _6y, _6x + width, _4y, bgcolor=color.new(col, 93), border_color=color.new(col, 65))
                        alert('New EW Corrective Bearish Pattern found'  , alert.freq_once_per_bar_close)                                                                                       
                else
                    if isSame2 and getEW.bA.get_x() > _3x
                        getEW.dash() 
                        alert('Invalidated EW Corrective Bullish Pattern', alert.freq_once_per_bar_close)                                                                                       
            //
            // –––[ check (only once) for a possible new (1) after an impulsive AND corrective wave ]–––
            if getEW.dir == -1 
                if _5x == getEW.bC.get_x() and 
                   _6y <  getEW.b5.get_y() and
                   getEW.next  == false
                    getEW.next := true
                    getEW.lb   := label.new(_6x, _6y, style=label.style_circle, color=color.new(col, 65), yloc=yloc.belowbar, size=size.tiny)
                    alert('Possible new start of EW Motive Bearish Wave', alert.freq_once_per_bar_close)                                                                                       
        //                    
        // –––[ check for break box ]–––
        if aEW.size() > 0
            gEW    := aEW.get(0)
            if gEW.dir == 1 
                if ta.crossunder(low , gEW.bx.get_bottom()) and bar_index <= gEW.bx.get_right()
                    label.new(bar_index, low , yloc= yloc.belowbar, style= label.style_xcross, color=color.red, size=size.tiny)
            else
                if ta.crossover (high, gEW.bx.get_top   ()) and bar_index <= gEW.bx.get_right()
                    label.new(bar_index, high, yloc= yloc.abovebar, style= label.style_xcross, color=color.red, size=size.tiny)       
        //
        if barstate.islast
            //  –––[ get last 2 EW's ]–––
            getEW    = aEW.get(0)
            if aEW.size() > 1
                getEW1   = aEW.get(1)
                last_0x := getEW.l1.get_x1(), last_0y := getEW.l1.get_y1()
                last_6x := getEW.l5.get_x2(), last_6y := getEW.l5.get_y2()
                //
                diff = math.abs(last_6y - last_0y) // –––[ max/min difference ]–––
                _500 = diff * i_500
                _618 = diff * i_618
                _764 = diff * i_764
                _854 = diff * i_854
                bull = getEW.dir == 1 
                // –––[ if EW is not valid or an ABC has developed -> remove fibonacci lines ]–––
                if getEW.on == false or getEW.bC.get_x() > getEW.b5.get_x()
                    nFibL.setNa()
                else
                // –––[ get.on == true ~ valid EW ]–––
                    max_500 = last_6y + ((bull ? -1 : 1) * _500)
                    max_618 = last_6y + ((bull ? -1 : 1) * _618)
                    max_764 = last_6y + ((bull ? -1 : 1) * _764)
                    max_854 = last_6y + ((bull ? -1 : 1) * _854)
                    //
                    nFibL.set(last_6x, bar_index + 10, max_500, max_618, max_764, max_854, last_6y)
                // –––[ if (2) label overlap with (C) label ]–––
                if  getEW.b2.get_x() == getEW1.bC.get_x()
                    getEW.b1.set_textcolor(color(na))
                    getEW.b2.set_textcolor(color(na))
                    strB  = getEW1.bB.get_text() 
                    strC  = getEW1.bC.get_text()
                    strB_ = str.replace(strB, "(b)",  "(b) (1)", 0)
                    strC_ = str.replace(strC, "(c)",  "(c) (2)", 0)
                    getEW1.bB.set_text(strB_)
                    getEW1.bC.set_text(strC_)
            //        
            // –––[ check if fib limits are broken ]–––
            getP_854 = nFibL.wave1_0_854.get_y1()
            for i = 0 to bar_index - nFibL.wave1_0_854.get_x1()
                if getEW.dir == -1
                    if high[i] > getP_854
                        nFibL._break_ := true
                        break
                else
                    if low [i] < getP_854
                        nFibL._break_ := true
                        break  
            //––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
            switch nFibL._break_
                true  => nFibL.sol_dot('dot', color.new(color.red , 95))
                false => nFibL.sol_dot('sol', color.new(color.lime, 95))
                => 
                    nFibL.wave1_0_500.set_xy1(na, na)
                    nFibL.wave1_0_500.set_xy2(na, na)
                    nFibL.wave1_0_618.set_xy1(na, na)
                    nFibL.wave1_0_618.set_xy2(na, na)
                    nFibL.wave1_0_764.set_xy1(na, na)
                    nFibL.wave1_0_764.set_xy2(na, na)
                    nFibL.wave1_0_854.set_xy1(na, na)
                    nFibL.wave1_0_854.set_xy2(na, na)
                    nFibL.wave1_pole_.set_xy1(na, na)
                    nFibL.wave1_pole_.set_xy2(na, na)
                    nFibL.l_fill_.set_color(color(na))

        if aEW.size() > 15 
            pop = aEW.pop()
            pop.l1.delete(), pop.b1.delete()
            pop.l2.delete(), pop.b2.delete()
            pop.l3.delete(), pop.b3.delete()
            pop.l4.delete(), pop.b4.delete()
            pop.l5.delete(), pop.b5.delete()
            pop.lA.delete(), pop.bA.delete()
            pop.lB.delete(), pop.bB.delete()
            pop.lC.delete(), pop.bC.delete()
            pop.lb.delete(), pop.bx.delete()
        //----------------------------------

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
draw(s1, len1, col1, 0)
draw(s2, len2, col2, 1)
draw(s3, len3, col3, 2)

//-----------------------------------------------------------------------------}