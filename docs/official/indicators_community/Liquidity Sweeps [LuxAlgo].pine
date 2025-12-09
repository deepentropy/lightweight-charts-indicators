// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator( 'Liquidity Sweeps [LuxAlgo]'
         , 'LuxAlgo - Liquidity Sweeps'
         ,  max_lines_count=500
         ,  max_boxes_count=500
         ,  overlay=true
         )

//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
len    = input.int(5, 'Swings', minval=1, group='Liquidity Sweeps')
opt    = input.string('Only Wicks', 'options'
       , options=['Only Wicks', 'Only Outbreaks & Retest', 'Wicks + Outbreaks & Retest'], group='Liquidity Sweeps')

colBl  = input.color(#089981, 'Bull ', group='Liquidity Sweeps', inline='c1')
colBr  = input.color(#f23645, 'Bear' , group='Liquidity Sweeps', inline='c2')
colBl2 = input.color(#08998180,  ''  , group='Liquidity Sweeps', inline='c1')
colBr2 = input.color(#f2364580,  ''  , group='Liquidity Sweeps', inline='c2')

extend = input.bool(true, 'Extend', group='Sweep Area') 
maxB   = input.int(300, 'Max bars', minval=1, maxval=5000, group='Sweep Area')
colBl3 = input.color(#08998141, 'Bull ', group='Sweep Area')
colBr3 = input.color(#f2364541, 'Bear' , group='Sweep Area')

oW = opt == 'Only Wicks'
oO = opt == 'Only Outbreaks & Retest'
WO = opt == 'Wicks + Outbreaks & Retest'

n = bar_index 

//-----------------------------------------------------------------------------}      
//UDT's
//-----------------------------------------------------------------------------{
type piv
    float prc // price
    int   bix // bar_index
    bool  brk // broken
    bool  mit // mitigated
    bool  tak // taken
    bool  wic // wick
    line  lin 

type boxBr 
    box  bx 
    line ln
    bool br
    int  dr

//-----------------------------------------------------------------------------}      
//Variables
//-----------------------------------------------------------------------------{
var array< piv >aPivH  = array.new< piv >(1, piv.new  ())
var array< piv >aPivL  = array.new< piv >(1, piv.new  ())
var array<boxBr>aBoxBr = array.new<boxBr>(1, boxBr.new())

//-----------------------------------------------------------------------------}      
//Methods - functions
//-----------------------------------------------------------------------------{
method n(float piv) => bool out = not na(piv)

method p(piv piv, float val) => float out = (100 / piv.prc * val) - 100

method l(piv get, color c, string s='sd') => 
    style = switch s 
        'dt' => line.style_dotted
        'ds' => line.style_dashed
        =>      line.style_solid 
    line.new(get.bix, get.prc, n, get.prc, color=c, style = style)

method br(piv get, color c3, color c, int d) =>
    y1 = d == 1 ? high : get.prc
    y2 = d == 1 ? get.prc : low
    boxBr.new( 
     box.new(n -1, y1, n +1, y2
     , border_color
     = color.new(
       na, na   )
     , bgcolor=c3)
     , line.new(n , y1, n, y2, color=c, width=3)
     , false
     , d)

lnDot(y, c) => line.new(n, y, n+3, y, color=c, style=line.style_dotted)

//-----------------------------------------------------------------------------}      
//Execution
//-----------------------------------------------------------------------------{
ph = ta.pivothigh(len, len)
pl = ta.pivotlow (len, len)

if ph.n() 
    aPivH.unshift(piv.new(ph, n -len, false, false, false, false))

if pl.n() 
    aPivL.unshift(piv.new(pl, n -len, false, false, false, false)) 

for i = aPivH.size() -1 to 0
    get = aPivH.get(i)
    if not get.mit
        if not get.brk
            if close > get.prc 
                if not oW
                    get.brk := true
                else 
                    get.mit := true
            if not oO and not get.wic 
                if high > get.prc and close < get.prc                   
                    aBoxBr.unshift(get.br(colBr3, colBr, 1))       
                    get.l(colBr2, 'dt'), lnDot(low, colBr)
                    get.wic := true  
        else 
            if close < get.prc 
                get.mit := true
            if not oW and low < get.prc and close > get.prc                    
                aBoxBr.unshift(get.br(colBl3, colBl, -1))    
                get.l(colBl2, 'ds'), lnDot(high, colBl)
                get.tak := true 

    if n - get.bix > 2000 or get.mit or get.tak 
        aPivH.remove(i).lin.delete()

for i = aPivL.size() -1 to 0
    get = aPivL.get(i)
    if not get.mit
        if not get.brk
            if close < get.prc 
                if not oW
                    get.brk := true
                else 
                    get.mit := true
            if not oO and not get.wic 
                if low < get.prc and close > get.prc                              
                    aBoxBr.unshift(get.br(colBl3, colBl, -1))     
                    get.l(colBl2, 'dt'), lnDot(high, colBl)
                    get.wic := true 
        else 
            if close > get.prc 
                get.mit := true
            if not oW and high > get.prc and close < get.prc                     
                aBoxBr.unshift(get.br(colBr3, colBr, 1))    
                get.l(colBr2, 'ds'), lnDot(low, colBr)
                get.tak := true  

    if n - get.bix > 2000 or get.mit or get.tak 
        aPivL.remove(i).lin.delete()

if extend
    for bx in aBoxBr 
        if not bx.br and n - bx.bx.get_left() -1 <= maxB 
            bx.bx.set_right(bar_index)
            if bx.dr == -1 and close < bx.bx.get_bottom() 
                bx.br := true 
            if bx.dr ==  1 and close > bx.bx.get_top   () 
                bx.br := true 

//-----------------------------------------------------------------------------} 