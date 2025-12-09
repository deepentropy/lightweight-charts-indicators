// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator( 'ICT Unicorn Model [LuxAlgo]'
         , 'LuxAlgo - ICT Unicorn Model'
         ,  max_boxes_count =500
         ,  max_lines_count =500
         ,  max_labels_count=500
         ,  overlay=true
         )

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{
len       = input.int   (     10                ,     'Swings'                                  , group='Unicorn')

iBull     = input.bool  (    true               ,      'Bull'                    , inline = 'bl', group='Unicorn')
colBl     = input.color (  #089981            ,        ''                      , inline = 'bl', group='Unicorn')

iBear     = input.bool  (    true               ,      'Bear'                    , inline = 'br', group='Unicorn')
colBr     = input.color (  #f23645            ,        ''                      , inline = 'br', group='Unicorn')

combine   = input.bool  (    false              ,    'Combine'  
 , tooltip=                  'Bull and Bear pattern can be present at the same time'            , group='Unicorn')

//Targets
risk      = input.float   (     1                 ,   'Risk/Reward'                , step = .1, inline = 'r' , group='Targets')
reward    = input.float   (     1                 ,        ':'                     , step = .1, inline = 'r' , group='Targets')
rr        = reward / risk 

trail     = input.bool  (    false               ,  'Trailing Stop'               , inline = 'ts', group='Targets')
lenS      = input.int   (     5                 ,        '', minval =3, maxval=10, inline = 'ts', group='Targets')

showTargets = input(true,  'Target Areas'                      , inline='target_css', group='Targets')
colRisk     = input.color(color.new(#787b86, 80),  ''         , inline='target_css', group='Targets')
colReward   = input.color(color.new(#5b9cf6, 80),  ''         , inline='target_css', group='Targets')

//-----------------------------------------------------------------------------}      
//UDT's
//-----------------------------------------------------------------------------{
type piv 
    int   b 
    float p
    bool br

type ZZ 
    int   [] d
    int   [] x 
    float [] y 

type unicorn 
    box      box    
    box      fvg
    box      Risk
    box      Reward

    line     lT 
    line     lB
    line     SL
    line     linSL

    label    labC

    bool     active
    bool     isTaR 
    bool     isTsL 
    bool     trig

    float    swing
    float    TaR
    float    TsL




//-----------------------------------------------------------------------------}      
//Variables
//-----------------------------------------------------------------------------{
var x = 0 
var y = 0.
var z = 0.

var ZZ aZZ = 
 ZZ.new(
 array.new < int    >(50,  0), 
 array.new < int    >(50,  0), 
 array.new < float  >(50, na)
 )

var patL   = array.new<  line >(3, line.new(na, na, na, na))

var aUniBl = array.new<unicorn>(2, unicorn.new(
                                   box.new (na, 0, 0, na)
                                 , box.new (na, 0, 0, na)
                                 , box.new (na, 0, 0, na)
                                 , box.new (na, 0, 0, na) 
                                 , line.new(na, 0, 0, na)
                                 , line.new(na, 0, 0, na)                                 
                                 , line.new(na, 0, 0, na)
                                 , line.new(na, 0, 0, na)
                                 , label.new  (na, na)  
                               , false, false, false, false
                                 ,   na ,   na ,   na
                                  )
                                 )
var aUniBr = array.new<unicorn>(2, unicorn.new(
                                   box.new (na, 0, 0, na)
                                 , box.new (na, 0, 0, na)
                                 , box.new (na, 0, 0, na)
                                 , box.new (na, 0, 0, na) 
                                 , line.new(na, 0, 0, na)
                                 , line.new(na, 0, 0, na)                                 
                                 , line.new(na, 0, 0, na)
                                 , line.new(na, 0, 0, na)
                                 , label.new  (na, na)  
                               , false, false, false, false
                                 ,   na ,   na ,   na
                                  )
                                 )

piv[] swingH = na
piv[] swingL = na
float mnPiv  = na
float mxPiv  = 0

//-----------------------------------------------------------------------------}      
//Methods
//-----------------------------------------------------------------------------{
method in_out(ZZ aZZ, int d, int Cx, float Cy, int Dx, float Dy) =>
    aZZ.d.unshift(d), aZZ.x.unshift(Dx), aZZ.y.unshift(Dy), aZZ.d.pop(), aZZ.x.pop(), aZZ.y.pop()

method n(float p) => bool out = not na(p)

method remove(unicorn uni) => 
    uni.active := false
    uni.swing  := na
    uni.TaR    := na
    uni.fvg  .delete()
    uni.linSL.delete()
    uni.lT   .delete()        
    uni.lB   .delete()
    uni.SL   .delete()
    uni.labC .delete()
    uni.box.set_bgcolor(color.new(na, na))

//-----------------------------------------------------------------------------}      
//Execution
//-----------------------------------------------------------------------------{
n       = bar_index
atr     = ta.atr(14) 
cFg     = chart.fg_color

lenL    = 1 
ph      = ta.pivothigh(len, lenL)
pl      = ta.pivotlow (len, lenL)

phTsL   = ta.pivothigh(lenS, lenS)
plTsL   = ta.pivotlow (lenS, lenS)

highest = ta.highest(5)
lowest  = ta.lowest (5)

firstBl = aUniBl.first()
firstBr = aUniBr.first()

secndBl = aUniBl.get (1)
secndBr = aUniBr.get (1)

bool chS_bl  = ta.change(firstBl.swing) != 0
bool chS_br  = ta.change(firstBr.swing) != 0

//Creating ZZ
if ph.n() 
    if ph > mxPiv
        mxPiv := ph
    if swingH.size() > 0
        for i      = swingH.size() -1 to 0
            get    = swingH.get(i)
            if ph >= get.p
                swingH.remove(i)

    swingH.unshift(piv.new(n -1, ph))    

    dr_  = aZZ.d.get (0) 
    Cx_  = aZZ.x.get (0) 
    Cy_  = aZZ.y.get (0) 
    Dx_  = n -lenL
    Dy_  = high[lenL]
    
    if dr_ <  1  // if previous point was a pl, add, and change direction ( 1)
        aZZ.in_out( 1, Cx_, Cy_, Dx_, Dy_)
    else
        if dr_ ==  1 and ph > Cy_
            aZZ.x.set(0, Dx_), aZZ.y.set(0, Dy_)    

if pl.n()
    if pl < mnPiv
        mnPiv := pl    
    if swingL.size() > 0
        for i      = swingL.size() -1 to 0
            get    = swingL.get(i)
            if pl <= get.p
                swingL.remove(i)

    swingL.unshift(piv.new(n -1, pl))
    
    dr_  = aZZ.d.get (0) 
    Cx_  = aZZ.x.get (0) 
    Cy_  = aZZ.y.get (0) 
    Dx_  = n -lenL
    Dy_  = low[lenL]
    
    if dr_ > -1  // if previous point was a ph, add, and change direction (-1)
        aZZ.in_out(-1, Cx_, Cy_, Dx_, Dy_)
    else
        if dr_ == -1 and pl < Cy_ 
            aZZ.x.set(0, Dx_), aZZ.y.set(0, Dy_)          


Ax  = aZZ.x.get (3) 
Ay  = aZZ.y.get (3) 
Bx  = aZZ.x.get (2) 
By  = aZZ.y.get (2) 
Cx  = aZZ.x.get (1) 
Cy  = aZZ.y.get (1) 
Dx  = aZZ.x.get (0) 
Dy  = aZZ.y.get (0)         
dir = aZZ.d.get (0) 

//Unicorn Pattern
if firstBl.active
    if combine or (not combine and (not firstBl.active[1] or chS_bl))
        if not secndBl.trig  
            secndBl.remove()

    if not firstBl.trig and 
     close < firstBl.fvg.get_bottom()      
        firstBl.remove()   

if firstBr.active
    if combine or (not combine and (not firstBr.active[1] or chS_br))
        if not secndBr.trig  
            secndBr.remove()

    if not firstBr.trig and 
     close > firstBr.fvg.get_top()
        firstBr.remove()


if n -lenL == Dx 
    
    if dir <  1 and iBear
     and close[lenL] < By and Cy > Ay 
     and Dx - Cx > (len > 1 ? 1 : 0 )          
     and Cx - Bx > (len > 1 ? 1 : 0 )  
     and Bx - Ax > (len > 1 ? 1 : 0 )  
        
        // BRB
        switch 
            close[n - Bx +0] < open[n - Bx +0] => x := Bx -0, y := high[n - Bx +0], z := low[n - Bx +0]             
            close[n - Bx +1] < open[n - Bx +1] => x := Bx -1, y := high[n - Bx +1], z := low[n - Bx +1]  
            close[n - Bx +2] < open[n - Bx +2] => x := Bx -2, y := high[n - Bx +2], z := low[n - Bx +2]  
            close[n - Bx +3] < open[n - Bx +3] => x := Bx -3, y := high[n - Bx +3], z := low[n - Bx +3]  
            close[n - Bx +4] < open[n - Bx +4] => x := Bx -4, y := high[n - Bx +4], z := low[n - Bx +4]  
        
        // FVG
        for i = 0 to n - Cx
            fvgT = low[i+2]
            fvgB = high[i]
            if fvgB < fvgT
             and ((fvgT < y and fvgT > z) or  (fvgB < y and fvgB > z))
             and fvgT - fvgB > atr * 0.05 // FVG large enough
                if y != firstBr.box.get_top()
                    aUniBr.unshift(unicorn.new(
                       box = box.new(  x ,  y  ,  n -i-2 , z    
                       , border_color = color.new(   cFg , 100)
                       , bgcolor      = color.new(   cFg , 97))
                     , fvg = box.new(n -i-2, low[i+2], n-1, high[i]
                       , border_color = color.new(    na , na )
                       , bgcolor      = color.new( colBr , 75))
                     , active = true , swing = Cy
                     , isTaR  = false, TaR   = na
                     , lT = line.new(x, y, n-1, y
                      , color=color.new(cFg, 50)
                      , style=line.style_dashed)                             
                     , lB = line.new(x, z, n-1, z
                      , color=color.new(cFg, 50)
                      , style=line.style_dashed)
                     , SL = line.new(Cx, Cy, Cx, Cy
                      , color=color.new(cFg, 65)
                      , style=line.style_dotted)
                     , trig=false
                      )
                     )

                if not combine 

                    if not firstBl.trig
                        firstBl.remove()

                    firstBl.active := false
                    firstBl.TaR    := na                     
                    firstBl.TsL    := na 
                    firstBl.swing  := na

                break

    if dir > -1 and iBull
     and close[lenL] > By and Cy < Ay 
     and Dx - Cx > (len > 1 ? 1 : 0 )         
     and Cx - Bx > (len > 1 ? 1 : 0 )
     and Bx - Ax > (len > 1 ? 1 : 0 )

        // BRB
        switch 
            close[n - Bx +0] > open[n - Bx +0] => x := Bx -0, y := high[n - Bx +0], z := low[n - Bx +0]             
            close[n - Bx +1] > open[n - Bx +1] => x := Bx -1, y := high[n - Bx +1], z := low[n - Bx +1]  
            close[n - Bx +2] > open[n - Bx +2] => x := Bx -2, y := high[n - Bx +2], z := low[n - Bx +2]  
            close[n - Bx +3] > open[n - Bx +3] => x := Bx -3, y := high[n - Bx +3], z := low[n - Bx +3]  
            close[n - Bx +4] > open[n - Bx +4] => x := Bx -4, y := high[n - Bx +4], z := low[n - Bx +4]  

        // FVG
        for i = 0 to n - Cx
            fvgB = high[i+2]
            fvgT = low [i]
            if fvgB < fvgT
             and ((fvgT < y and fvgT > z) or  (fvgB < y and fvgB > z))
             and fvgT - fvgB > atr * 0.05 // FVG large enough
                if y != firstBl.box.get_top()
                    aUniBl.unshift(unicorn.new(
                       box = box.new(  x ,  y  ,  n-i-2  , z    
                       , border_color = color.new(   cFg , 100)
                       , bgcolor      = color.new(   cFg , 97))
                     , fvg = box.new(n -i-2, low[i], n-1, high[i+2]
                       , border_color = color.new(  na   , na )
                       , bgcolor      = color.new( colBl , 75))
                     , active = true , swing = Cy
                     , isTaR  = false, TaR   = na
                     , lT = line.new(x, y, n-1, y
                      , color=color.new(cFg, 50)
                      , style=line.style_dashed)                             
                     , lB = line.new(x, z, n-1, z
                      , color=color.new(cFg, 50)
                      , style=line.style_dashed)
                     , SL = line.new(Cx, Cy, Cx, Cy
                      , color=color.new(cFg, 65)
                      , style=line.style_dotted)
                     , trig = false
                      )
                     )

                if not combine 

                    if not firstBr.trig
                        firstBr.remove()

                    firstBr.active := false
                    firstBr.TaR    := na                     
                    firstBr.TsL    := na 
                    firstBr.swing  := na

                break

if firstBr.active

    firstBr.Risk  .set_right(n +1)
    firstBr.Reward.set_right(n +1)

    rgt = firstBr.fvg.get_right()
    top = firstBr.lT .get_y2   () 
    btm = firstBr.lB .get_y2   () 

    isStopBr = high > firstBr.swing
    if isStopBr
        if showTargets
            firstBr.linSL := 
             line.new(
              rgt, firstBr.swing
              , n, firstBr.swing
              , color
              = color.new(cFg, 50)) 

        firstBr.active := false
        firstBr.TaR    := na         
        firstBr.TsL    := na 
        firstBr.swing  := na
    
    if not firstBr.trig
        firstBr.fvg.set_right(n-1)

    if firstBr.isTaR
        if low < firstBr.TaR
            if showTargets              
                line.new(
                 rgt, firstBr.TaR
                 , n, firstBr.TaR
                 , color
                 = color.new(cFg, 50)) 

            firstBr.isTaR  := false
            firstBr.active := false 
            firstBr.TaR    := na 
            firstBr.TsL    := na 

        if trail

            switch 
                close[1] > firstBr.TsL[1] => firstBr.TsL   :=  na 
                close    > firstBr.TsL    => firstBr.isTsL := false
        
            if phTsL.n()
                firstBr.TsL := math.min(firstBr.TsL, phTsL)
    else
        trigger = 
         close < btm 
         and open > btm and open < top 
         and math.max(close[1], open[1]) > btm 
         and math.min(close[1], open[1]) < top

        if trigger 
            label.new(n, high, text='●'
             , color=color.new(na, na), textcolor=colBr
             , style=label.style_label_center
             , size=size.tiny
             )

            firstBr.trig   := true
            firstBr.isTaR  := true  

            firstBr.SL .set_x2   (n)
            firstBr.lT .set_x2   (n)            
            firstBr.lB .set_x2   (n)
            firstBr.fvg.set_right(n)
            
            diff = (firstBr.swing - btm) * rr
            firstBr.TaR    := btm - diff
            firstBr.TsL    := firstBr.swing

            if showTargets
                firstBr.Risk   := box.new(
                                  chart.point.from_index(n   , firstBr.swing) 
                                  , chart.point.from_index(n +1,   btm       )
                                  , border_color=color.new(na  ,   na       )
                                  , bgcolor     =colRisk
                                  )
                firstBr.Reward := box.new(
                                  chart.point.from_index(n   ,   btm        ) 
                                  , chart.point.from_index(n +1,   btm - diff)
                                  , border_color=color.new(na  ,   na       )
                                  , bgcolor     =colReward
                                  )

if firstBl.active

    firstBl.Risk  .set_right(n +1)
    firstBl.Reward.set_right(n +1)

    top = firstBl.lT .get_y2   () 
    btm = firstBl.lB .get_y2   ()
    rgt = firstBl.fvg.get_right()

    isStopBl = low  < firstBl.swing
    if isStopBl
        if showTargets
            firstBl.linSL := 
             line.new(
              rgt, firstBl.swing
              , n, firstBl.swing
              , color
              = color.new(cFg, 50)) 

        firstBl.active := false
        firstBl.TaR    := na        
        firstBl.TsL    := na 
        firstBl.swing  := na
    
    if not firstBl.trig
        firstBl.fvg.set_right(n-1)

    if firstBl.isTaR
        if high > firstBl.TaR 
            if showTargets        
                line.new(
                 rgt, firstBl.TaR
                 , n, firstBl.TaR
                 , color
                 = color.new(cFg, 50)) 

            firstBl.isTaR  := false
            firstBl.active := false 
            firstBl.TaR    := na 
            firstBl.TsL    := na 

        if trail
            switch 
                close[1] < firstBl.TsL[1] => firstBl.TsL   :=  na 
                close    < firstBl.TsL    => firstBl.isTsL := false

            if plTsL.n()
                firstBl.TsL := math.max(firstBl.TsL, plTsL)
    else
        trigger = 
         close > top 
         and open < top and open > btm 
         and math.min(close[1], open[1]) < top 
         and math.max(close[1], open[1]) > btm

        if trigger 
            label.new(n, low, text='●'
             , color=color.new(na, na), textcolor=colBl
             , style=label.style_label_center
             , size=size.tiny
             )

            firstBl.trig  := true
            firstBl.isTaR := true 

            firstBl.SL .set_x2   (n)
            firstBl.lT .set_x2   (n)            
            firstBl.lB .set_x2   (n)
            firstBl.fvg.set_right(n)

            diff = (top - firstBl.swing) * rr
            firstBl.TaR    := top + diff
            firstBl.TsL    := firstBl.swing   

            if showTargets
                firstBl.Risk   := box.new(
                                  chart.point.from_index(n   , firstBl.swing) 
                                  , chart.point.from_index(n +1,   top       )
                                  , border_color=color.new(na  ,   na       )
                                  , bgcolor     =colRisk
                                  )
                firstBl.Reward := box.new(
                                  chart.point.from_index(n   ,   top        ) 
                                  , chart.point.from_index(n +1,   top + diff)
                                  , border_color=color.new(na  ,   na       )
                                  , bgcolor     =colReward
                                  )

//-----------------------------------------------------------------------------}      
//Plot
//-----------------------------------------------------------------------------{
plot(trail and (firstBl.TsL >= firstBl.TsL[1] or na(firstBl.TsL[1])) ? firstBl.TsL : na, color = colBl, style=plot.style_linebr)
plot(trail and (firstBr.TsL <= firstBr.TsL[1] or na(firstBr.TsL[1])) ? firstBr.TsL : na, color = colBr, style=plot.style_linebr)

//-----------------------------------------------------------------------------} 