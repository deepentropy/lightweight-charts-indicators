// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("ICT Killzones [LuxAlgo]"
  , overlay = true
  , max_lines_count = 500
  , max_labels_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
//New York
showNy = input(true,   'New York', inline = 'ny', group = 'Killzones')
nyCss  = input.color(color.new(#ff5d00, 80), '', inline = 'ny', group = 'Killzones')

//London Open
showLdno = input(true, 'London Open', inline = 'ldno', group = 'Killzones')
ldnoCss  = input.color(color.new(#00bcd4, 80), '', inline = 'ldno', group = 'Killzones')

//London Close
showLdnc = input(true, 'London Close', inline = 'ldnc', group = 'Killzones')
ldncCss  = input.color(color.new(#2157f3, 80), '', inline = 'ldnc', group = 'Killzones')

//Asian
showAsia = input(true, 'Asian', inline = 'asia', group = 'Killzones')
asiaCss  = input.color(color.new(#e91e63, 80), '', inline = 'asia', group = 'Killzones')

//Fib Retracements
showFibs = input(true,  'Show Retracements', group = 'Killzones Retracements')
extend   = input(true,  'Extend', group = 'Killzones Retracements')
reverse  = input(false, 'Reverse', group = 'Killzones Retracements')

//Fib 0
fib0      = input(true, '', inline = '0', group = 'Killzones Retracements')
fib0Value = input(0., '', inline = '0', group = 'Killzones Retracements')
fib0Css   = input(color.gray, '', inline = '0', group = 'Killzones Retracements')

//Fib 0.236
fib236      = input(true, '', inline = '0', group = 'Killzones Retracements')
fib236Value = input(0.236, '', inline = '0', group = 'Killzones Retracements')
fib236Css   = input(color.yellow, '', inline = '0', group = 'Killzones Retracements')

//Fib 0.382
fib382      = input(true, '', inline = '382', group = 'Killzones Retracements')
fib382Value = input(0.382, '', inline = '382', group = 'Killzones Retracements')
fib382Css   = input(color.fuchsia, '', inline = '382', group = 'Killzones Retracements')

//Fib 0.5
fib5      = input(true, '', inline = '382', group = 'Killzones Retracements')
fib5Value = input(0.5, '', inline = '382', group = 'Killzones Retracements')
fib5Css   = input(color.orange, '', inline = '382', group = 'Killzones Retracements')

//Fib 0.618
fib618      = input(true, '', inline = '618', group = 'Killzones Retracements')
fib618Value = input(0.618, '', inline = '618', group = 'Killzones Retracements')
fib618Css   = input(color.blue, '', inline = '618', group = 'Killzones Retracements')

//Fib 0.782
fib782      = input(true, '', inline = '618', group = 'Killzones Retracements')
fib782Value = input(0.782, '', inline = '618', group = 'Killzones Retracements')
fib782Css   = input(color.green, '', inline = '618', group = 'Killzones Retracements')

//Fib 1
fib1      = input(true, '', inline = '1', group = 'Killzones Retracements')
fib1Value = input(1., '', inline = '1', group = 'Killzones Retracements')
fib1Css   = input(color.gray, '', inline = '1', group = 'Killzones Retracements')

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
n = bar_index

avg(val, max, min)=> 
    var float fib = na

    if reverse
        fib := val * min + (1 - val) * max
    else
        fib := val * max + (1 - val) * min

fib_values()=>
    var fibs = array.from(
      fib0 ? fib0Value : na
      , fib236 ? fib236Value : na
      , fib382 ? fib382Value : na
      , fib5 ? fib5Value : na
      , fib618 ? fib618Value : na
      , fib782 ? fib782Value : na
      , fib1 ? fib1Value : na)

display_retracements(session)=>
    var lines = array.new_line(0)
    fibs = fib_values()

    var float max = na
    var float min = na

    if session and not session[1]
        max := high
        min := low
        
        lines := array.from(
          line.new(n,na,na,na,   color = fib0Css)
          , line.new(n,na,na,na, color = fib236Css)
          , line.new(n,na,na,na, color = fib382Css)
          , line.new(n,na,na,na, color = fib5Css)
          , line.new(n,na,na,na, color = fib618Css)
          , line.new(n,na,na,na, color = fib782Css)
          , line.new(n,na,na,na, color = fib1Css))
    
    if session
        max := math.max(high, max)
        min := math.min(low, min)

        for [i, lvl] in lines
            fib = array.get(fibs, i)

            line.set_y1(lvl, avg(fib, max, min))
            line.set_xy2(lvl, n, avg(fib, max, min))
    else if extend
        for [i, lvl] in lines
            fib = array.get(fibs, i)

            line.set_y1(lvl, avg(fib, max, min))
            line.set_xy2(lvl, n, avg(fib, max, min))

labels(session, css, txt)=>
    var label lbl = na
    var float max = na 
    var int anchor = na
    var get_css = color.rgb(color.r(css), color.g(css), color.b(css))

    if session and not session[1]
        max := high
        anchor := time
        
        lbl := label.new(anchor, max
          , txt
          , xloc.bar_time
          , color = #ffffff00
          , style = label.style_label_down
          , textcolor = get_css
          , size = size.small)
    
    if session
        max := math.max(high, max)

        label.set_x(lbl, int(math.avg(time, anchor)))
        label.set_y(lbl, max)

//-----------------------------------------------------------------------------}
//Retracements
//-----------------------------------------------------------------------------{
ny        = time(timeframe.period, '0700-0900', 'UTC-5') and showNy
ldn_open  = time(timeframe.period, '0200-0500', 'UTC-5') and showLdno
ldn_close = time(timeframe.period, '1000-1200', 'UTC-5') and showLdnc
asian     = time(timeframe.period, '2000-0000', 'UTC-5') and showAsia

if showFibs
    display_retracements(ldn_open or ldn_close or ny or asian)

//-----------------------------------------------------------------------------}
//Labels
//-----------------------------------------------------------------------------{
labels(ny, nyCss, 'New York')
labels(ldn_open, ldnoCss, 'London Open')
labels(ldn_close, ldncCss, 'London Close')
labels(asian, asiaCss, 'Asian')

//-----------------------------------------------------------------------------}
//Background
//-----------------------------------------------------------------------------{
bgcolor(ny ? nyCss : na, editable = false)
bgcolor(ldn_open ? ldnoCss : na, editable = false)
bgcolor(ldn_close ? ldncCss : na, editable = false)
bgcolor(asian ? asiaCss : na, editable = false)

//-----------------------------------------------------------------------------}