// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC Dy-NC-SA 4.0) https://creativecommons.org/licenses/Dy-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Breaker Blocks with Signals [LuxAlgo]", max_lines_count=500, max_boxes_count=500, max_labels_count=500, max_bars_back=3000, overlay=true)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
shZZ                  = false 
len                   = input.int   (    5     , title='      Length'              , inline='MS' , group='Market Structure' 
                      ,                                         minval=1, maxval=10                                                                      )
//Breaker block
breakerCandleOnlyBody = input.bool  (  false   , title='Use only candle body'                    , group='Breaker Block'                                 )
breakerCandle_2Last   = input.bool  (  false   , title='Use 2 candles instead of 1'              , group='Breaker Block', tooltip='In the same direction')
tillFirstBreak        = input.bool  (  true   , title='Stop at first break of center line'      , group='Breaker Block'                                 )

//PD array
onlyWhenInPDarray     = input.bool  (  false   , title='Only when E is in Premium/Discount Array', group='PD array'                                      )
showPDarray           = input.bool  (  false   , title='show Premium/Discount Zone'              , group='PD array'                                      )
showBreaks            = input.bool  (  false   , title='Highlight Swing Breaks'                  , group='PD array'                                      )
showSPD               = input.bool  (  true    , title='Show Swings/PD Arrays'                   , group='PD array'                                      )
PDtxtCss              = input.color (  color.silver, 'Text Color'      , group='PD array'                                      )
PDSCss                = input.color (  color.silver, 'Swing Line Color', group='PD array'                                      )

//Take profit
iTP                   = input.bool  (  false   , title='Enable TP'                 , inline='RR' , group='TP'                                            )
tpCss                 = input.color ( #2157f3, title=''                  , inline='RR', group='TP'                                            )
R1a                   = input.float (    1     , title='R:R 1', minval= 1, maxval=1, inline='RR1', group='TP'                                            )
R2a                   = input.float (    2     , title= ':'   , minval=.2, step= .1, inline='RR1', group='TP'                                            )
R1b                   = input.float (    1     , title='R:R 2', minval= 1, maxval=1, inline='RR2', group='TP'                                            )
R2b                   = input.float (    3     , title= ':'   , minval=.2, step= .1, inline='RR2', group='TP'                                            )
R1c                   = input.float (    1     , title='R:R 3', minval= 1, maxval=1, inline='RR3', group='TP'                                            )
R2c                   = input.float (    4     , title= ':'   , minval=.2, step= .1, inline='RR3', group='TP'                                            )
 
//Colors
cBBplusA              = input.color (color.rgb(12, 181, 26, 93)
                                               , title='      '                    , inline='bl' , group='Colours    +BB                   Last Swings'  )
cBBplusB              = input.color (color.rgb(12, 181, 26, 85)
                                               , title=''                          , inline='bl' , group='Colours    +BB                   Last Swings'  )
cSwingBl              = input.color (color.rgb(255, 82, 82, 85)
                                               , title='        '                  , inline='bl' , group='Colours    +BB                   Last Swings'  )
cBB_minA              = input.color (color.rgb(255, 17, 0, 95)
                                               , title='      '                    , inline='br' , group='Colours    -BB                   Last Swings'  )
cBB_minB              = input.color (color.rgb(255, 17, 0, 85)
                                               , title=''                          , inline='br' , group='Colours    -BB                   Last Swings'  )
cSwingBr              = input.color (color.rgb(0, 137, 123, 85)
                                               , title='        '                  , inline='br' , group='Colours    -BB                   Last Swings'  )

_arrowup = '▲'
_arrowdn = '▼'
_c = '●'
_x = '❌'

//-----------------------------------------------------------------------------}
//General Calculations
//-----------------------------------------------------------------------------{
per        = last_bar_index - bar_index <= 2000 
mx         = math.max(close , open     )
mn         = math.min(close , open )
atr        = ta.atr  (10    )
n          = bar_index
hi         = high  
lo         = low   
mCxSize    = 50

//-----------------------------------------------------------------------------}
//User Defined Types
//-----------------------------------------------------------------------------{
type ZZ 
    int   [] d
    int   [] x 
    float [] y 
    line  [] l
    bool  [] b

type mss 
    int     dir
    line [] l_mssBl
    line [] l_mssBr
    line [] l_bosBl
    line [] l_bosBr
    label[] lbMssBl
    label[] lbMssBr
    label[] lbBosBl
    label[] lbBosBr

type block
    int   dir
    bool  Broken
    bool  Mitigated
    box   BB_boxA
    box   BB_boxB
    line  BB_line
    box   FVG_box
    line  line_1
    line  line_2
    bool  Broken_1
    bool  Broken_2
    box   PDa_boxA
    box   PDa_boxB
    box   PDa_box1
    line  PDaLine1
    label PDaLab_1
    box   PDa_box2
    line  PDaLine2    
    label PDaLab_2
    bool  PDbroken1
    bool  PDbroken2
    line  TP1_line
    line  TP2_line
    line  TP3_line
    bool  TP1_hit
    bool  TP2_hit
    bool  TP3_hit
    bool  scalp
    label HL
    label[] aLabels

//-----------------------------------------------------------------------------}
//Variables
//-----------------------------------------------------------------------------{
BBplus = 0, signUP = 1, cnclUP = 2, LL1break = 3, LL2break = 4, SW1breakUP = 5
 ,      SW2breakUP = 6,  tpUP1 = 7,    tpUP2 = 8,    tpUP3 = 9,   BB_endBl =10
BB_min =11, signDN =12, cnclDN =13, HH1break =14, HH2break =15, SW1breakDN =16
 ,      SW2breakDN =17,  tpDN1 =18,    tpDN2 =19,    tpDN3 =20,   BB_endBr =21

signals = 
 array.from(
   false // BBplus
 , false // signUP
 , false // cnclUP
 , false // LL1break
 , false // LL2break
 , false // SW1breakUP
 , false // SW2breakUP
 , false // tpUP1
 , false // tpUP2
 , false // tpUP3
 , false // BB_endBl
 , false // BB_min
 , false // signDN
 , false // cnclDN
 , false // HH1break
 , false // HH2break
 , false // SW1breakDN
 , false // SW2breakDN
 , false // tpDN1
 , false // tpDN2
 , false // tpDN3
 , false // BB_endBr
 )

var block   [] aBlockBl   = array.new<   block  >(          )
var block   [] aBlockBr   = array.new<   block  >(          )

var  ZZ         aZZ       = 
 ZZ.new(
 array.new < int    >(mCxSize,  0), 
 array.new < int    >(mCxSize,  0), 
 array.new < float  >(mCxSize, na),
 array.new < line   >(mCxSize, na),
 array.new < bool   >(mCxSize, na))

var mss MSS = mss.new(
 0
 , array.new < line  >()
 , array.new < line  >() 
 , array.new < line  >()
 , array.new < line  >()
 , array.new < label >() 
 , array.new < label >()
 , array.new < label >()
 , array.new < label >()
 )

var block BB = block.new(
   BB_boxA   = box.new  (na, na, na, na, border_color=color(na))
 , BB_boxB   = box.new  (na, na, na, na, border_color=color(na)
  , text_size=size.small
  , text_halign=text.align_right
  , text_font_family=font.family_monospace
  )
 , BB_line   = line.new (na, na, na, na
  , style=line.style_dashed
  , color=color.silver
  )
 , PDa_box1  = box.new  (na, na, na, na, border_color=color(na))
 , PDaLine1  = line.new (na, na, na, na, color=PDSCss)
 , PDaLab_1  = label.new(na, na, color=color(na))
 , PDa_box2  = box.new  (na, na, na, na, border_color=color(na))
 , PDaLine2  = line.new (na, na, na, na, color=PDSCss)
 , PDaLab_2  = label.new(na, na, color=color(na))
 , line_1    = line.new (na, na, na, na, color=PDSCss)
 , line_2    = line.new (na, na, na, na, color=PDSCss)
 , TP1_line  = line.new (na, na, na, na, color=tpCss)
 , TP2_line  = line.new (na, na, na, na, color=tpCss)
 , TP3_line  = line.new (na, na, na, na, color=tpCss)
 , HL        = label.new(na, na, color=color(na)
  , textcolor=PDtxtCss
  , yloc=yloc.price
  )
 , aLabels   = array.new<label>(1, label(na))
 )

//-----------------------------------------------------------------------------}
//Functions/methods
//-----------------------------------------------------------------------------{
method in_out(ZZ aZZ, int d, int x1, float y1, int x2, float y2, color col, bool b) =>
    aZZ.d.unshift(d), aZZ.x.unshift(x2), aZZ.y.unshift(y2), aZZ.b.unshift(b), aZZ.d.pop(), aZZ.x.pop(), aZZ.y.pop(), aZZ.b.pop()
    if shZZ
        aZZ.l.unshift(line.new(x1, y1, x2, y2, color= col)), aZZ.l.pop().delete()

method io_box(box[] aB, box b) => aB.unshift(b), aB.pop().delete()

method setLine(line ln, int x1, float y1, int x2, float y2) => ln.set_xy1(x1, y1), ln.set_xy2(x2, y2)

method notransp(color css) => color.rgb(color.r(css), color.g(css), color.b(css))

createLab(string s, float y, color c, string t, string sz = size.small) =>      
    label.new(n
     , y
     , style=s == 'c' ? label.style_label_center    
      : s == 'u' ? label.style_label_up 
      : label.style_label_down
     , textcolor=c
     , color=color(na)    
     , size=sz
     , text=t
     )

draw(left, col) =>
    
    max_bars_back(time, 1000)
    var int dir= na, var int x1= na, var float y1= na, var int x2= na, var float y2= na
    
    sz       = aZZ.d.size( )
    x2      := bar_index -1
    ph       = ta.pivothigh(hi, left, 1)
    pl       = ta.pivotlow (lo, left, 1)
    if ph   
        dir := aZZ.d.get (0) 
        x1  := aZZ.x.get (0) 
        y1  := aZZ.y.get (0) 
        y2  :=      nz(hi[1])
        
        if dir <  1  // if previous point was a pl, add, and change direction ( 1)
            aZZ.in_out( 1, x1, y1, x2, y2, col, true)
        else
            if dir ==  1 and ph > y1 
                aZZ.x.set(0, x2), aZZ.y.set(0, y2)   
                if shZZ
                    aZZ.l.get(0).set_xy2(x2, y2)        

    if pl
        dir := aZZ.d.get (0) 
        x1  := aZZ.x.get (0) 
        y1  := aZZ.y.get (0) 
        y2  :=      nz(lo[1])
        
        if dir > -1  // if previous point was a ph, add, and change direction (-1)
            aZZ.in_out(-1, x1, y1, x2, y2, col, true)
        else
            if dir == -1 and pl < y1 
                aZZ.x.set(0, x2), aZZ.y.set(0, y2)       
                if shZZ
                    aZZ.l.get(0).set_xy2(x2, y2)   
    
    iH = aZZ.d.get(2) ==  1 ? 2 : 1
    iL = aZZ.d.get(2) == -1 ? 2 : 1
    
    switch
        // MSS Bullish
        close > aZZ.y.get(iH) and aZZ.d.get(iH) ==  1 and MSS.dir <  1 and per =>
            
            Ex   = aZZ.x.get(iH -1), Ey = aZZ.y.get(iH -1) 
            Dx   = aZZ.x.get(iH   ), Dy = aZZ.y.get(iH   ), DyMx = mx[n - Dx]
            Cx   = aZZ.x.get(iH +1), Cy = aZZ.y.get(iH +1) 
            Bx   = aZZ.x.get(iH +2), By = aZZ.y.get(iH +2), ByMx = mx[n - Bx] 
            Ax   = aZZ.x.get(iH +3), Ay = aZZ.y.get(iH +3), AyMn = mn[n - Ax]
            _y   = math.max(ByMx, DyMx)
            mid  = AyMn + ((_y - AyMn) / 2) // 50% fib A- min(B, D)
            isOK = onlyWhenInPDarray ? Ay < Cy and Ay < Ey and Ey < mid : true
            
            float green1prT = na
            float green1prB = na
            float    avg    = na

            if Ey < Cy and Cx != Dx and isOK 
                // latest HH to 1 HH further -> search first green bar
                for i = n - Dx to n - Cx
                    if close[i] > open[i]
                        // reset previous swing box's
                        BB.PDa_box1.set_lefttop(na, na), BB.PDaLine1.set_xy1(na, na), BB.PDaLab_1.set_xy(na, na)
                        BB.PDa_box2.set_lefttop(na, na), BB.PDaLine2.set_xy1(na, na), BB.PDaLab_2.set_xy(na, na)
                        
                        green1idx   = n - i
                        green1prT  := breakerCandleOnlyBody ? mx[i] : high[i]
                        green1prB  := breakerCandleOnlyBody ? mn[i] : low [i]
                        if breakerCandle_2Last 
                            if close[i +1] > open[i +1]
                                green2prT  = breakerCandleOnlyBody ? mx[i +1] : high[i +1]
                                green2prB  = breakerCandleOnlyBody ? mn[i +1] : low [i +1]
                                if green2prT > green1prT or green2prB < green1prB
                                    green1idx -= 1
                                green1prT := math.max(green1prT, green2prT)
                                green1prB := math.min(green1prB, green2prB)
                        
                        // Breaker Block + 
                        avg := math.avg(green1prB, green1prT)
                        while BB.aLabels.size() > 0
                            BB.aLabels.pop().delete()
                        BB.PDa_boxA.delete(), BB.PDa_boxB.delete(), BB.dir :=  1
                        BB.BB_boxA.set_left   (green1idx)
                        BB.BB_boxA.set_top    (green1prT)
                        BB.BB_boxA.set_right  (    n    )
                        BB.BB_boxA.set_bottom (green1prB)
                        BB.BB_boxA.set_bgcolor(cBBplusA )

                        BB.BB_boxB.set_left   (    n    )
                        BB.BB_boxB.set_top    (green1prT)
                        BB.BB_boxB.set_right  (    n + 8)
                        BB.BB_boxB.set_bottom (green1prB)
                        BB.BB_boxB.set_bgcolor(cBBplusB )
                        BB.BB_boxB.set_text('+BB')
                        BB.BB_boxB.set_text_color(cBBplusB.notransp())
                        BB.BB_boxB.set_text_valign(text.align_bottom)
                       
                        BB.BB_line.set_xy1(n, avg), BB.BB_line.set_xy2(n , avg)

                        if showSPD
                            BB.line_1.set_xy1(Cx, Cy), BB.line_1.set_xy2(n , Cy), BB.Broken_1 := false
                            BB.line_2.set_xy1(Ex, Ey), BB.line_2.set_xy2(n , Ey), BB.Broken_2 := false
                            BB.HL.set_xy(Ex, Ey), BB.HL.set_style(label.style_label_up), BB.HL.set_text('LL')
                        
                        BB.TP1_hit    := false     
                        BB.TP2_hit    := false                              
                        BB.TP3_hit    := false  
                        BB.Broken     := false
                        BB.Mitigated  := false
                        BB.scalp      := false
                        BB.PDbroken1  := false
                        BB.PDbroken2  := false

                        if onlyWhenInPDarray and showPDarray
                            BB.PDa_boxA := box.new(Ax, mid, Ex +1, AyMn, bgcolor=color.rgb(132, 248, 171, 90), border_color=color(na)
                             , text = 'Discount PD Array', text_size = size.small, text_color = color.rgb(132, 248, 171, 25)
                             , text_halign = text.align_right, text_valign = text.align_center, text_font_family = font.family_monospace) // , text_wrap= text.wrap_auto
                            BB.PDa_boxB := box.new(Ax,  _y, Ex +1,  mid, bgcolor=color.rgb(248, 153, 132, 90), border_color=color(na))
                        
                        // Previous swings
                        cnt = 0, hh1 = high
                        for c = 0 to sz -2
                            getX = aZZ.x.get(c)
                            getY = aZZ.y.get(c)
                            if getY > hh1 and aZZ.d.get(c) ==  1 and showSPD
                                getY2 = (high[n - getX] - mn[n - getX]) / 4
                                switch cnt
                                    0 =>
                                        BB.PDa_box1.set_lefttop    (getX,        getY )
                                        BB.PDaLine1.set_xy1        (getX,        getY )
                                        BB.PDa_box1.set_rightbottom(n   , getY - getY2)
                                        BB.PDaLine1.set_xy2        (n   , getY        )
                                        BB.PDa_box1.set_bgcolor    (       cSwingBl   )
                                        BB.PDaLab_1.set_xy         (       getX, getY )
                                        BB.PDaLab_1.set_size       (       size.small )
                                        BB.PDaLab_1.set_textcolor  (    PDtxtCss )
                                        BB.PDaLab_1.set_text       ('Premium PD Array')
                                        BB.PDaLab_1.set_style(label.style_label_lower_left)
                                        cnt := 1                                        
                                        hh1 := getY
                                    1 =>
                                        if getY - getY2 > hh1
                                            BB.PDa_box2.set_lefttop    (getX,        getY )
                                            BB.PDaLine2.set_xy1        (getX,        getY )
                                            BB.PDa_box2.set_rightbottom(n   , getY - getY2)
                                            BB.PDaLine2.set_xy2        (n   , getY        )
                                            BB.PDa_box2.set_bgcolor    (       cSwingBl   )
                                            BB.PDaLab_2.set_xy         (       getX, getY )
                                            BB.PDaLab_2.set_size       (       size.small )
                                            BB.PDaLab_2.set_textcolor  (    PDtxtCss )
                                            BB.PDaLab_2.set_text       ('Premium PD Array')
                                            BB.PDaLab_2.set_style(label.style_label_lower_left)                                    
                                            cnt := 2
                            if cnt == 2
                                break                         

                        I  = green1prT - green1prB
                        E1 = green1prT + (I * R2a / R1a)
                        E2 = green1prT + (I * R2b / R1b)
                        E3 = green1prT + (I * R2c / R1c)

                        if iTP
                            if not BB.TP1_hit
                                BB.TP1_line.set_xy1(n, E1)  
                                BB.TP1_line.set_xy2(n + 20, E1)  
                            if not BB.TP2_hit
                                BB.TP2_line.set_xy1(n, E2)  
                                BB.TP2_line.set_xy2(n + 20, E2) 
                            if not BB.TP3_hit
                                BB.TP3_line.set_xy1(n, E3)  
                                BB.TP3_line.set_xy2(n + 20, E3) 

                        signals.set(BBplus, true)                        
                        alert('+BB', alert.freq_once_per_bar_close)
                        BB.aLabels.unshift(createLab('u', low, cBBplusB.notransp(), _arrowup, size.large))

                        break

            MSS.dir :=  1
            
        // MSS Bearish
        close < aZZ.y.get(iL) and aZZ.d.get(iL) == -1 and MSS.dir > -1 and per =>
            Ex   = aZZ.x.get(iL -1), Ey = aZZ.y.get(iL -1) 
            Dx   = aZZ.x.get(iL   ), Dy = aZZ.y.get(iL   ), DyMn = mn[n - Dx]
            Cx   = aZZ.x.get(iL +1), Cy = aZZ.y.get(iL +1) 
            Bx   = aZZ.x.get(iL +2), By = aZZ.y.get(iL +2), ByMn = mn[n - Bx] 
            Ax   = aZZ.x.get(iL +3), Ay = aZZ.y.get(iL +3), AyMx = mx[n - Ax]
            _y   = math.min(ByMn, DyMn)
            //_x   = _y == ByMn ? Bx : Dx
            mid  = AyMx - ((AyMx - _y) / 2) // 50% fib A- min(B, D)
            isOK = onlyWhenInPDarray ? Ay > Cy and Ay > Ey and Ey > mid : true
            //
            float red_1_prT = na
            float red_1_prB = na
            float    avg    = na
            if Ey > Cy and Cx != Dx and isOK 
                // latest LL to LL further -> search first red bar
                for i = n - Dx to n - Cx
                    if close[i] < open[i]
                        // reset previous swing box's
                        BB.PDa_box1.set_lefttop(na, na), BB.PDaLine1.set_xy1(na, na), BB.PDaLab_1.set_xy(na, na)
                        BB.PDa_box2.set_lefttop(na, na), BB.PDaLine2.set_xy1(na, na), BB.PDaLab_2.set_xy(na, na)

                        red_1_idx  = n - i
                        red_1_prT  := breakerCandleOnlyBody ? mx[i] : high[i]
                        red_1_prB  := breakerCandleOnlyBody ? mn[i] : low [i]
                        if breakerCandle_2Last 
                            if close[i +1] < open[i +1]
                                red_2_prT  = breakerCandleOnlyBody ? mx[i +1] : high[i +1]
                                red_2_prB  = breakerCandleOnlyBody ? mn[i +1] : low [i +1]
                                if red_2_prT > red_1_prT or red_2_prB < red_1_prB
                                    red_1_idx -= 1
                                red_1_prT := math.max(red_1_prT, red_2_prT)
                                red_1_prB := math.min(red_1_prB, red_2_prB)
                        
                        // Breaker Block -
                        avg := math.avg(red_1_prB, red_1_prT)
                        while BB.aLabels.size() > 0
                            BB.aLabels.pop().delete()
                        BB.PDa_boxA.delete(), BB.PDa_boxB.delete(), BB.dir := -1
                        BB.BB_boxA.set_left   (red_1_idx)
                        BB.BB_boxA.set_top    (red_1_prT)
                        BB.BB_boxA.set_right  (    n    )
                        BB.BB_boxA.set_bottom (red_1_prB)
                        BB.BB_boxA.set_bgcolor(cBB_minA )

                        BB.BB_boxB.set_left   (n)
                        BB.BB_boxB.set_top    (red_1_prT)
                        BB.BB_boxB.set_right  (    n + 8)
                        BB.BB_boxB.set_bottom (red_1_prB)
                        BB.BB_boxB.set_bgcolor(cBB_minB )
                        BB.BB_boxB.set_text('-BB')
                        BB.BB_boxB.set_text_color(cBB_minB.notransp())
                        BB.BB_boxB.set_text_valign(text.align_top)

                        BB.BB_line.set_xy1(n, avg), BB.BB_line.set_xy2(n , avg)

                        if showSPD
                            BB.line_1.set_xy1(Cx, Cy), BB.line_1.set_xy2(n , Cy), BB.Broken_1 := false
                            BB.line_2.set_xy1(Ex, Ey), BB.line_2.set_xy2(n , Ey), BB.Broken_2 := false
                            BB.HL.set_xy(Ex, Ey), BB.HL.set_style(label.style_label_down), BB.HL.set_text('HH'), BB.HL.set_textcolor(PDtxtCss)

                        BB.TP1_hit    := false     
                        BB.TP2_hit    := false                              
                        BB.TP3_hit    := false    
                        BB.Broken     := false
                        BB.Mitigated  := false   
                        BB.scalp      := false
                        BB.PDbroken1  := false
                        BB.PDbroken2  := false

                        if onlyWhenInPDarray and showPDarray
                            BB.PDa_boxA := box.new(Ax, AyMx, Ex +1, mid, bgcolor=color.rgb(248, 153, 132, 90), border_color=color(na)
                             , text = 'Premium PD Array', text_size = size.small, text_color = color.rgb(248, 153, 132, 25)
                             , text_halign = text.align_right, text_valign = text.align_center, text_font_family = font.family_monospace) // , text_wrap= text.wrap_auto
                            BB.PDa_boxB := box.new(Ax, mid , Ex +1,  _y, bgcolor=color.rgb(132, 248, 171, 90), border_color=color(na))

                        // Previous swings
                        cnt = 0, ll1 = low
                        for c = 0 to sz -2
                            getX = aZZ.x.get(c)
                            getY = aZZ.y.get(c)
                            if getY < ll1 and aZZ.d.get(c) == -1 and showSPD
                                getY2 = (mx[n - getX] - low[n - getX]) / 4
                                switch cnt 
                                    0 =>
                                        BB.PDa_box1.set_lefttop    (getX, getY + getY2)
                                        BB.PDaLine1.set_xy1        (getX,        getY )
                                        BB.PDa_box1.set_rightbottom(       n   , getY )
                                        BB.PDaLine1.set_xy2        (       n   , getY )
                                        BB.PDa_box1.set_bgcolor    (       cSwingBr   )
                                        BB.PDaLab_1.set_xy         (       getX, getY )
                                        BB.PDaLab_1.set_size       (       size.small )
                                        BB.PDaLab_1.set_textcolor  (    PDtxtCss )
                                        BB.PDaLab_1.set_text      ('Discount PD Array')
                                        BB.PDaLab_1.set_style(label.style_label_upper_left)

                                        cnt := 1
                                        ll1 := getY
                                    1 => 
                                        if getY + getY2 < ll1
                                            BB.PDa_box2.set_lefttop    (getX, getY + getY2)
                                            BB.PDaLine2.set_xy1        (getX,        getY )
                                            BB.PDa_box2.set_rightbottom(       n   , getY )
                                            BB.PDaLine2.set_xy2        (       n   , getY )
                                            BB.PDa_box2.set_bgcolor    (       cSwingBr   )
                                            BB.PDaLab_2.set_xy         (       getX, getY )
                                            BB.PDaLab_2.set_size       (       size.small )
                                            BB.PDaLab_2.set_textcolor  (    PDtxtCss )
                                            BB.PDaLab_2.set_text      ('Discount PD Array')
                                            BB.PDaLab_2.set_style(label.style_label_upper_left)                                       
                                            cnt := 2
                            if cnt == 2
                                break  

                        I  = red_1_prT - red_1_prB
                        E1 = red_1_prB - (I * R2a / R1a)
                        E2 = red_1_prB - (I * R2b / R1b)
                        E3 = red_1_prB - (I * R2c / R1c)

                        if iTP
                            if not BB.TP1_hit
                                BB.TP1_line.set_xy1(n, E1)  
                                BB.TP1_line.set_xy2(n + 20, E1)  
                            if not BB.TP2_hit
                                BB.TP2_line.set_xy1(n, E2)  
                                BB.TP2_line.set_xy2(n + 20, E2) 
                            if not BB.TP3_hit
                                BB.TP3_line.set_xy1(n, E3)  
                                BB.TP3_line.set_xy2(n + 20, E3) 

                        signals.set(BB_min, true)                        
                        alert('-BB', alert.freq_once_per_bar_close)
                        BB.aLabels.unshift(createLab('d', high, cBB_minB.notransp(), _arrowdn, size.large))
                        
                        break       
                
            MSS.dir := -1 

//-----------------------------------------------------------------------------}
//Calculations
//-----------------------------------------------------------------------------{
draw(len, tpCss)  


lft = BB.BB_boxB.get_left  ()
top = BB.BB_boxB.get_top   ()
btm = BB.BB_boxB.get_bottom() 
avg = BB.BB_line.get_y2    ()
l_1 = BB.line_1.get_y2     ()
l_2 = BB.line_2.get_y2     ()
TP1 = BB.TP1_line.get_y2   ()
TP2 = BB.TP2_line.get_y2   ()
TP3 = BB.TP3_line.get_y2   ()

switch BB.dir
    1  => 
        if not BB.Mitigated
            if close < btm
                BB.Mitigated := true 
                signals.set(BB_endBl, true)     
                alert('+BB Mitigated', alert.freq_once_per_bar_close)

                BB.aLabels.unshift(createLab('u', low, color.yellow, _c))
                
                BB.BB_boxB.set_right(n)
                BB.BB_line.set_x2   (n)
            else
                BB.BB_boxB.set_right(n + 8)
                BB.BB_line.set_x2   (n + 8)
                
            BB.TP1_line.set_x2   (n)
            BB.TP2_line.set_x2   (n)
            BB.TP3_line.set_x2   (n)

            if n > BB.BB_boxB.get_left()
                if not BB.Broken
                    if BB.scalp
                        if not BB.TP1_hit and open < TP1 and high > TP1
                            BB.TP1_hit := true
                            signals.set(tpUP1, true)     
                            alert('TP UP 1', alert.freq_once_per_bar)
                            BB.aLabels.unshift(createLab('c', TP1, #ff00dd, _c))
                        if not BB.TP2_hit and open < TP2 and high > TP2
                            BB.TP2_hit := true                                 
                            signals.set(tpUP2, true)     
                            alert('TP UP 2', alert.freq_once_per_bar)
                            BB.aLabels.unshift(createLab('c', TP2, #ff00dd, _c))
                        if not BB.TP3_hit and open < TP3 and high > TP3
                            BB.TP3_hit := true                        
                            signals.set(tpUP3, true)     
                            alert('TP UP 3', alert.freq_once_per_bar)
                            BB.aLabels.unshift(createLab('c', TP3, #ff00dd, _c))
                    switch
                        open > avg and open < top and close > top => 
                            BB.TP1_hit := false
                            BB.TP2_hit := false
                            BB.TP3_hit := false
                            BB.scalp   := true
                            signals.set(signUP, true)                        
                            alert('signal UP', alert.freq_once_per_bar_close)
                            BB.aLabels.unshift(createLab('u', low, color.lime, _arrowup, size.normal))
                        close < avg and close > btm => 
                            BB.Broken := true
                            BB.scalp  := false
                            signals.set(cnclUP, true)                        
                            alert('cancel UP', alert.freq_once_per_bar_close)
                            BB.aLabels.unshift(createLab('u', low, color.orange, _x))
                else
                    // reset
                    if not tillFirstBreak and close > top 
                        BB.Broken := false  
                        BB.scalp := true 
                        signals.set(BBplus, true)                        
                        alert('+BB (R)', alert.freq_once_per_bar_close)
                        BB.aLabels.unshift(createLab('u', low, color.blue, 'R', size.normal)) 

        if not BB.Broken_1
            BB.line_1.set_x2(n)
            if close < l_1
                BB.Broken_1 := true
                signals.set(LL1break, true)                        
                alert('LL 1 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', low, #c00000, _c))
        if not BB.Broken_2 
            BB.line_2.set_x2(n)
            if close < l_2
                BB.Broken_2 := true                     
                signals.set(LL2break, true)                        
                alert('LL 2 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', low, #c00000, _c))

        if not BB.PDbroken1
            BB.PDa_box1.set_right(n)            
            BB.PDaLine1.set_x2   (n)
            if close > BB.PDa_box1.get_top() and n > BB.PDa_box1.get_left()
                BB.PDbroken1 := true             
                signals.set(SW1breakUP, true)                       
                alert('Swing UP 1 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', high, #c00000, _c))
        if not BB.PDbroken2
            BB.PDa_box2.set_right(n)            
            BB.PDaLine2.set_x2   (n)
            if close > BB.PDa_box2.get_top() and n > BB.PDa_box2.get_left()
                BB.PDbroken2 := true                 
                signals.set(SW2breakUP, true)                        
                alert('Swing UP 2 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', high, #c00000, _c))

    -1 =>
        if not BB.Mitigated
            if close > top
                BB.Mitigated := true 
                signals.set(BB_endBr, true)     
                alert('-BB Mitigated', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('d', high, cBB_minB.notransp(), _c))
                BB.BB_boxB.set_right(n)
                BB.BB_line.set_x2   (n)
            else
                BB.BB_boxB.set_right(n + 8)
                BB.BB_line.set_x2   (n + 8)

            BB.TP1_line.set_x2   (n)
            BB.TP2_line.set_x2   (n)
            BB.TP3_line.set_x2   (n)

            if n > BB.BB_boxB.get_left()
                if not BB.Broken
                    if BB.scalp
                        if not BB.TP1_hit and open > TP1 and low < TP1
                            BB.TP1_hit := true                       
                            signals.set(tpDN1, true)                             
                            alert('TP DN 1', alert.freq_once_per_bar)
                            BB.aLabels.unshift(createLab('c', TP1, #ff00dd, _c))
                        if not BB.TP2_hit and open > TP2 and low < TP2
                            BB.TP2_hit := true                                 
                            signals.set(tpDN2, true)                             
                            alert('TP DN 2', alert.freq_once_per_bar)               
                            BB.aLabels.unshift(createLab('c', TP2, #ff00dd, _c))
                        if not BB.TP3_hit and open > TP3 and low < TP3
                            BB.TP3_hit := true                                    
                            signals.set(tpDN3, true)                             
                            alert('TP DN 3', alert.freq_once_per_bar)       
                            BB.aLabels.unshift(createLab('c', TP3, #ff00dd, _c))
                    switch
                        open < avg and open > btm and close < btm => 
                            BB.TP1_hit := false
                            BB.TP2_hit := false
                            BB.TP3_hit := false
                            BB.scalp   := true
                            signals.set(signDN, true)
                            alert('signal DN', alert.freq_once_per_bar_close)
                            BB.aLabels.unshift(createLab('d', high, color.orange, _arrowdn, size.normal))
                        close > avg and close < top => 
                            BB.Broken := true
                            BB.scalp  := false
                            signals.set(cnclDN, true)
                            alert('cancel DN', alert.freq_once_per_bar_close)
                            BB.aLabels.unshift(createLab('d', high, color.red   , _x))
                else
                    // reset
                    if not tillFirstBreak and close < btm 
                        BB.Broken := false 
                        BB.scalp  := true 
                        signals.set(BB_min, true)                        
                        alert('-BB (R)', alert.freq_once_per_bar_close)                        
                        BB.aLabels.unshift(createLab('d', high, color.blue, 'R', size.normal))

        if not BB.Broken_1             
            BB.line_1.set_x2(n)
            if close > l_1                 
                BB.Broken_1 := true
                signals.set(HH1break, true)                        
                alert('HH 1 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', high, #c00000, _c))
        if not BB.Broken_2             
            BB.line_2.set_x2(n)
            if close > l_2
                BB.Broken_2 := true
                signals.set(HH2break, true)                        
                alert('HH 2 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', high, #c00000, _c))

        if not BB.PDbroken1
            BB.PDa_box1.set_right(n)
            BB.PDaLine1.set_x2   (n)
            if close < BB.PDa_box1.get_bottom() and n > BB.PDa_box1.get_left()
                BB.PDbroken1 := true
                signals.set(SW1breakDN, true)                        
                alert('Swing DN 1 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', low, #c00000, _c))
        if not BB.PDbroken2
            BB.PDa_box2.set_right(n)            
            BB.PDaLine2.set_x2   (n)
            if close < BB.PDa_box2.get_bottom() and n > BB.PDa_box2.get_left()
                BB.PDbroken2 := true
                signals.set(SW2breakDN, true)                        
                alert('Swing DN 2 break', alert.freq_once_per_bar_close)
                if showBreaks
                    BB.aLabels.unshift(createLab('c', low, #c00000, _c))
  
//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
alertcondition(signals.get(BBplus    ), ' 1. +BB'             , '1. +BB'             )
alertcondition(signals.get(signUP    ), ' 2. signal UP'       , '2. signal UP'       )
alertcondition(signals.get(tpUP1     ), ' 3. TP UP 1'         , '3. TP UP 1'         )
alertcondition(signals.get(tpUP2     ), ' 3. TP UP 2'         , '3. TP UP 2'         )
alertcondition(signals.get(tpUP3     ), ' 3. TP UP 3'         , '3. TP UP 3'         )
alertcondition(signals.get(cnclUP    ), ' 4. cancel UP'       , '4. cancel UP'       )
alertcondition(signals.get(BB_endBl  ), ' 5. +BB Mitigated'   , '5. +BB Mitigated'   )
alertcondition(signals.get(LL1break  ), ' 6. LL 1 Break'      , '6. LL 1 Break'      )
alertcondition(signals.get(LL2break  ), ' 6. LL 2 Break'      , '6. LL 2 Break'      )
alertcondition(signals.get(SW1breakUP), ' 7. Swing UP 1 Break', '7. Swing UP 1 Break')
alertcondition(signals.get(SW2breakUP), ' 7. Swing UP 2 Break', '7. Swing UP 2 Break')

alertcondition(signals.get(BB_min    ),  '1. -BB'             , '1. -BB'             )
alertcondition(signals.get(signDN    ),  '2. signal DN'       , '2. signal DN'       )
alertcondition(signals.get(tpDN1     ),  '3. TP DN 1'         , '3. TP DN 1'         )
alertcondition(signals.get(tpDN2     ),  '3. TP DN 2'         , '3. TP DN 2'         )
alertcondition(signals.get(tpDN3     ),  '3. TP DN 3'         , '3. TP DN 3'         )
alertcondition(signals.get(cnclDN    ),  '4. cancel DN'       , '4. cancel DN'       )
alertcondition(signals.get(BB_endBr  ),  '5. -BB Mitigated'   , '5. -BB Mitigated'   )
alertcondition(signals.get(HH1break  ),  '6. HH 1 Break'      , '6. HH 1 Break'      )
alertcondition(signals.get(HH2break  ),  '6. HH 2 Break'      , '6. HH 2 Break'      )
alertcondition(signals.get(SW1breakDN),  '7. Swing DN 1 Break', '7. Swing DN 1 Break')
alertcondition(signals.get(SW2breakDN),  '7. Swing DN 2 Break', '7. Swing DN 2 Break')

//-----------------------------------------------------------------------------}