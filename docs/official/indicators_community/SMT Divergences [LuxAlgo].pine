// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("SMT Divergences [LuxAlgo]", "LuxAlgo - SMT Divergences", overlay = true, max_lines_count = 500, max_labels_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length = input.int(3, 'Pivot Lookback', minval = 2)

//Symbol A
useSym1 = input(true, 'Comparison Symbol', inline = 'symA')
sym1    = input.symbol('CME_MINI_DL:ES1!', '', inline = 'symA')

//Symbol B
useSym2 = input(true, 'Comparison Symbol', inline = 'symB')
sym2   = input.symbol('CBOT_MINI_DL:YM1!', '', inline = 'symB')

//Style
bullDivCss = input.color(#ff1100, 'Swing High', group = 'Style')
bearDivCss = input.color(#2157f3, 'Swing Low', group = 'Style')

//Dashboard
showDash = input(false, 'Show Dashboard'                                                               , group = 'Dashboard')
dashLoc  = input.string('Top Right', 'Location', options = ['Top Right', 'Bottom Right', 'Bottom Left'], group = 'Dashboard')
textSize = input.string('Small', 'Size'        , options = ['Tiny', 'Small', 'Normal']                 , group = 'Dashboard')

//-----------------------------------------------------------------------------}
//Function
//-----------------------------------------------------------------------------{
n = bar_index

get_hl() => [high, low, close]

//Swing highs divergences
get_divergence(ph, y2, sym_y2, css)=>
    var float y1 = na
    var float sym_y1 = na
    var int x1 = na
    var smt = 0

    if y2 != y2[1] and sym_y2 != sym_y2[1] 
        //Test for SMT
        if (y2 - y1) * (sym_y2 - sym_y1) < 0
            line.new(n[length], y2, x1, y1, color = css)

            smt += 1
        
        sym_y1 := sym_y2
        y1 := y2
        x1 := n[length]
    else if (ph and y2 > y2[1]) or (not ph and y2 < y2[1]) 
        sym_y1 := na
        y1 := y2
        x1 := n[length]
    
    smt

//-----------------------------------------------------------------------------}
//Main variables
//-----------------------------------------------------------------------------{
var phN = 0, var plN = 0
var ph_smt1 = 0.
var pl_smt1 = 0.
var ph_smt2 = 0.
var pl_smt2 = 0.

ticker1 = syminfo.ticker(sym1)
ticker2 = syminfo.ticker(sym2)

//-----------------------------------------------------------------------------}
//Detect swing highs/lows and divergences
//-----------------------------------------------------------------------------{
ph = fixnan(ta.pivothigh(length, length))
pl = fixnan(ta.pivotlow(length, length))
phN += ph != ph[1] ? 1 : 0
plN += pl != pl[1] ? 1 : 0

//Comparison symbol pivots
[h1, l1, c1] = request.security(sym1, timeframe.period, get_hl())
[h2, l2, c2] = request.security(sym2, timeframe.period, get_hl())

//Detect swing high divergences
if useSym1
    sym_ph1 = fixnan(ta.pivothigh(h1, length, length))
    sym_pl1 = fixnan(ta.pivotlow(l1, length, length))

    ph_smt1 := get_divergence(true, ph, sym_ph1, bullDivCss)
    pl_smt1 := get_divergence(false, pl, sym_pl1, bearDivCss)

if useSym2
    sym_ph2 = fixnan(ta.pivothigh(h2, length, length))
    sym_pl2 = fixnan(ta.pivotlow(l2, length, length))
    
    ph_smt2 := get_divergence(true, ph, sym_ph2, bullDivCss)
    pl_smt2 := get_divergence(false, pl, sym_pl2, bearDivCss)

txt = ''
if ph != ph[1]
    if ph_smt1 > ph_smt1[1]
        txt += ticker1
    if ph_smt2 > ph_smt2[1]
        txt += txt != '' ? ' | ' : ''
        txt += ticker2

    if txt != ''
        label.new(n[length], ph, txt
          , color = bullDivCss
          , style = label.style_label_down
          , textcolor = color.white
          , size = size.tiny)
else
    if pl_smt1 > pl_smt1[1]
        txt += ticker1
    if pl_smt2 > pl_smt2[1]
        txt += txt != '' ? ' | ' : ''
        txt += ticker2

    if txt != ''
        label.new(n[length], pl, txt
          , color = bearDivCss
          , style = label.style_label_up
          , textcolor = color.white
          , size = size.tiny)
    
//-----------------------------------------------------------------------------}
//Tables
//-----------------------------------------------------------------------------{
var table_position = dashLoc == 'Bottom Left' ? position.bottom_left 
  : dashLoc == 'Top Right' ? position.top_right 
  : position.bottom_right

var table_size = textSize == 'Tiny' ? size.tiny 
  : textSize == 'Small' ? size.small 
  : size.normal

var tb = table.new(table_position, 3, 3
  , bgcolor = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color = #373a46
  , frame_width = 1)

if barstate.isfirst and showDash
    tb.cell(1, 0, 'Swing High', text_color = color.white)
    tb.cell(2, 0, 'Swing Low', text_color = color.white)
    
    tb.cell(0, 1, ticker1, text_color = color.white)
    tb.cell(0, 2, ticker2, text_color = color.white)

if barstate.islast and showDash
    //Symbol 1
    tb.cell(1, 1, str.format('{0} ({1, number, percent})', ph_smt1, ph_smt1 / phN)
      , text_color = bullDivCss)
    tb.cell(2, 1, str.format('{0} ({1, number, percent})', pl_smt1, pl_smt1 / plN)
      , text_color = bearDivCss)
    
    //Symbol 2
    tb.cell(1, 2, str.format('{0} ({1, number, percent})', ph_smt2, ph_smt2 / phN)
      , text_color = bullDivCss)
    tb.cell(2, 2, str.format('{0} ({1, number, percent})', pl_smt2, pl_smt2 / plN)
      , text_color = bearDivCss)

//-----------------------------------------------------------------------------}