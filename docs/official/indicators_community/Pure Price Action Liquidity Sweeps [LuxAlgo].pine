// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('Pure Price Action Liquidity Sweeps [LuxAlgo]', 'LuxAlgo - Pure Price Action Liquidity Sweeps', true, max_lines_count=500,  max_boxes_count=500)
//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{
term   = input.string('Long Term', 'Detection', options = ['Short Term', 'Intermediate Term', 'Long Term'], display = display.all - display.status_line)

//Style
colBl  = input.color(#089981, 'Bullish Level', inline='c1', group = 'Style')
colBlS = input.color(#08998180, 'Sweep', inline='c1', group = 'Style')

colBr  = input.color(#f23645, 'Bearish Level' , inline='c2', group = 'Style')
colBrS = input.color(#f2364580, 'Sweep' , inline='c2', group = 'Style')

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{
type piv
    float prc 
    int   bix 
    bool  mit
    bool  wic 
    line  lin 

type boxBr 
    box  bx 
    int  dr

type swing
    float y = na
    int   x = na
    
type vector
    array<swing> v

//---------------------------------------------------------------------------------------------------------------------}
// Variables
//---------------------------------------------------------------------------------------------------------------------{
n = bar_index

depth  = switch term
    'Short Term' => 1
    'Intermediate Term' => 2
    'Long Term' => 3

//---------------------------------------------------------------------------------------------------------------------}
// Functions / Methods
//---------------------------------------------------------------------------------------------------------------------{
method l(piv get, color c) => 
    line.new(get.bix, get.prc, n, get.prc, color=c, style = line.style_solid)

method br(piv get, color c, int d) =>
    y1 = d == 1 ? high : get.prc
    y2 = d == 1 ? get.prc : low
    boxBr.new(box.new(n -1, y1, n +1, y2, border_color = color(na), bgcolor=c), d)

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
// Calculations
//---------------------------------------------------------------------------------------------------------------------{
var fh = array.new<vector>(0)
var fl = array.new<vector>(0)

//Detect swings
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

ph = top.y 
pl = btm.y 

//Handle swing levels
var array<piv> aPivH  = array.new<piv>(1, piv.new())
var array<piv> aPivL  = array.new<piv>(1, piv.new())
var array<boxBr> aBoxBr = array.new<boxBr>(1, boxBr.new())

if ph > 0 and ph != ph[1]
    aPivH.unshift(piv.new(ph, top.x, false, false))

if pl > 0 and pl != pl[1]
    aPivL.unshift(piv.new(pl, btm.x, false, false)) 

//Test for bearish sweeps/detect breaks
for i = aPivH.size() -1 to 0
    get = aPivH.get(i)
    if not get.mit
        if close > get.prc 
            get.mit := true
        if not get.wic
            if high > get.prc and close < get.prc                   
                aBoxBr.unshift(get.br(colBrS, 1))       
                get.l(colBr)
                get.wic := true  

    //Remove old levels
    if n - get.bix > 2000 or get.mit 
        aPivH.remove(i).lin.delete()

//Test for bullish sweeps/detect breaks
for i = aPivL.size() -1 to 0
    get = aPivL.get(i)
    if not get.mit
        if close < get.prc 
            get.mit := true
        if not get.wic 
            if low < get.prc and close > get.prc                              
                aBoxBr.unshift(get.br(colBlS, -1))     
                get.l(colBl)
                get.wic := true 

    //Remove old levels
    if n - get.bix > 2000 or get.mit
        aPivL.remove(i).lin.delete()

//---------------------------------------------------------------------------------------------------------------------}