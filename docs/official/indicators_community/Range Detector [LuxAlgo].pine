// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Range Detector [LuxAlgo]", "LuxAlgo - Range Detector", overlay = true, max_boxes_count = 500, max_lines_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length = input.int(20, 'Minimum Range Length', minval = 2)
mult   = input.float(1., 'Range Width', minval = 0, step = 0.1)
atrLen = input.int(500, 'ATR Length', minval = 1)

//Style
upCss = input(#089981, 'Broken Upward', group = 'Style')
dnCss = input(#f23645, 'Broken Downward', group = 'Style')
unbrokenCss = input(#2157f3, 'Unbroken', group = 'Style')

//-----------------------------------------------------------------------------}
//Detect and highlight ranges
//-----------------------------------------------------------------------------{
//Ranges drawings
var box bx = na
var line lvl = na

//Extensions
var float max = na
var float min = na

var os = 0
color detect_css = na

n = bar_index
atr = ta.atr(atrLen) * mult
ma = ta.sma(close, length)

count = 0
for i = 0 to length-1
    count += math.abs(close[i] - ma) > atr ? 1 : 0

if count == 0 and count[1] != count
    //Test for overlap and change coordinates
    if n[length] <= bx.get_right()
        max := math.max(ma + atr, bx.get_top())
        min := math.min(ma - atr, bx.get_bottom())
        
        //Box new coordinates
        bx.set_top(max)
        bx.set_rightbottom(n, min)
        bx.set_bgcolor(color.new(unbrokenCss, 80))

        //Line new coordinates
        avg = math.avg(max, min)
        lvl.set_y1(avg)
        lvl.set_xy2(n, avg)
        lvl.set_color(unbrokenCss)
    else
        max := ma + atr
        min := ma - atr

        //Set new box and level
        bx := box.new(n[length], ma + atr, n, ma - atr, na
          , bgcolor = color.new(unbrokenCss, 80))
        
        lvl := line.new(n[length], ma, n, ma
          , color = unbrokenCss
          , style = line.style_dotted)

        detect_css := color.new(color.gray, 80)
        os := 0

else if count == 0
    bx.set_right(n)
    lvl.set_x2(n)

//Set color
if close > bx.get_top()
    bx.set_bgcolor(color.new(upCss, 80))
    lvl.set_color(upCss)
    os := 1
else if close < bx.get_bottom()
    bx.set_bgcolor(color.new(dnCss, 80))
    lvl.set_color(dnCss)
    os := -1

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
//Range detection bgcolor
bgcolor(detect_css)

plot(max, 'Range Top'
  , max != max[1] ? na : os == 0 ? unbrokenCss : os == 1 ? upCss : dnCss)

plot(min, 'Range Bottom'
  , min != min[1] ? na : os == 0 ? unbrokenCss : os == 1 ? upCss : dnCss)

//-----------------------------------------------------------------------------}