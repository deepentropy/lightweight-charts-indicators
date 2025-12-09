// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Market Structure with Inducements & Sweeps [LuxAlgo]", "LuxAlgo - Market Structure with Inducements & Sweeps", overlay = true, max_lines_count = 500, max_labels_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
len = input(50, 'CHoCH Detection Period')
shortLen = input(3, 'IDM Detection Period')

//Styling
bullCss = input(#089981, 'Bullish Elements', group = 'Style')
bearCss = input(#ff5252, 'Bearish Elements', group = 'Style')

showChoch = input(true, "Show CHoCH", group = 'Style')
showBos = input(true, "Show BOS", group = 'Style')

showIdm = input(true, "Show Inducements", inline = 'idm', group = 'Style')
idmCss = input(color.gray, "", inline = 'idm', group = 'Style')

showSweeps = input(true, "Show Sweeps", inline = 'sweeps', group = 'Style')
sweepsCss = input(color.gray, "", inline = 'sweeps', group = 'Style')

showCircles = input(true, "Show Swings", group = 'Style')

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{
//Swings detection/measurements
n = bar_index

swings(len)=>
    var os = 0
    var int topx = na
    var int btmx = na
    
    upper = ta.highest(len)
    lower = ta.lowest(len)

    os := high[len] > upper ? 0 : low[len] < lower ? 1 : os[1]

    top = os == 0 and os[1] != 0 ? high[len] : na
    topx := os == 0 and os[1] != 0 ? n[len] : topx

    btm = os == 1 and os[1] != 1 ? low[len] : na
    btmx := os == 1 and os[1] != 1 ? n[len] : btmx

    [top, topx, btm, btmx]

//---------------------------------------------------------------------------------------------------------------------}
//Swings
//---------------------------------------------------------------------------------------------------------------------{
[top, topx, btm, btmx] = swings(len)
[stop, stopx, sbtm, sbtmx] = swings(shortLen)

var os = 0
var top_crossed = false
var btm_crossed = false

var float max = na
var float min = na

var int max_x1 = na
var int min_x1 = na

var float topy = na
var float btmy = na
var stop_crossed = false
var sbtm_crossed = false    

//---------------------------------------------------------------------------------------------------------------------}
//CHoCH Detection
//---------------------------------------------------------------------------------------------------------------------{
if top
    topy := top
    top_crossed := false
if btm
    btmy := btm
    btm_crossed := false

//Test for CHoCH
if close > topy and not top_crossed
    os := 1
    top_crossed := true
if close < btmy and not btm_crossed
    os := 0
    btm_crossed := true

//Display CHoCH
if os != os[1]
    max := high
    min := low
    max_x1 := n
    min_x1 := n
    stop_crossed := false
    sbtm_crossed := false

    if os == 1 and showChoch
        line.new(topx, topy, n, topy, color = bullCss, style = line.style_dashed)
        label.new(int(math.avg(n, topx)), topy, 'CHoCH', color = color(na), style = label.style_label_down, textcolor = bullCss, size = size.tiny)
    else if showChoch
        line.new(btmx, btmy, n, btmy, color = bearCss, style = line.style_dashed)
        label.new(int(math.avg(n, btmx)), btmy, 'CHoCH', color = color(na), style = label.style_label_up, textcolor = bearCss, size = size.tiny)

stopy = fixnan(stop)
sbtmy = fixnan(sbtm)

//---------------------------------------------------------------------------------------------------------------------}
//Bullish BOS
//---------------------------------------------------------------------------------------------------------------------{
//IDM
if low < sbtmy and not sbtm_crossed and os == 1 and sbtmy != btmy
    if showIdm
        line.new(sbtmx, sbtmy, n, sbtmy, color = idmCss, style = line.style_dotted)
        label.new(int(math.avg(n, sbtmx)), sbtmy, 'IDM', color = color(na), style = label.style_label_up, textcolor = idmCss, size = size.tiny)
    
    sbtm_crossed := true

//BOS
if close > max and sbtm_crossed and os == 1
    if showBos
        line.new(max_x1, max, n, max, color = bullCss)
        label.new(int(math.avg(n, max_x1)), max, 'BOS', color = color(na), style = label.style_label_down, textcolor = bullCss, size = size.tiny)
    
    sbtm_crossed := false

//---------------------------------------------------------------------------------------------------------------------}
//Bearish BOS
//---------------------------------------------------------------------------------------------------------------------{
//IDM
if high > stopy and not stop_crossed and os == 0 and stopy != topy
    if showIdm
        line.new(stopx, stopy, n, stopy, color = color.gray, style = line.style_dotted)
        label.new(int(math.avg(n, stopx)), stopy, 'IDM', color = color(na), style = label.style_label_down, textcolor = color.gray, size = size.tiny)
    
    stop_crossed := true

//BOS
if close < min and stop_crossed and os == 0
    if showBos
        line.new(min_x1, min, n, min, color = bearCss)
        label.new(int(math.avg(n, min_x1)), min, 'BOS', color = color(na), style = label.style_label_up, textcolor = bearCss, size = size.tiny)
    
    stop_crossed := false

//---------------------------------------------------------------------------------------------------------------------}
//Sweeps
//---------------------------------------------------------------------------------------------------------------------{
if high > max and close < max and os == 1 and n - max_x1 > 1 and showSweeps
    line.new(max_x1, max, n, max, color = sweepsCss, style = line.style_dotted)
    label.new(int(math.avg(n, max_x1)), max, 'x', color = color(na), style = label.style_label_down, textcolor = sweepsCss)

if low < min and close > min and os == 0 and n - min_x1 > 1 and showSweeps
    line.new(min_x1, min, n, min, color = sweepsCss, style = line.style_dotted)
    label.new(int(math.avg(n, min_x1)), min, 'x', color = color(na), style = label.style_label_up, textcolor = sweepsCss)

//Trailing max/min
max := math.max(high, max)
min := math.min(low, min)

if max > max[1]
    max_x1 := n
if min < min[1]
    min_x1 := n

//---------------------------------------------------------------------------------------------------------------------}
//Extensions
//---------------------------------------------------------------------------------------------------------------------{
var ext_choch = line.new(na,na,na,na, style = line.style_dashed)
var ext_bos   = line.new(na,na,na,na)
var ext_idm   = line.new(na,na,na,na, style = line.style_dotted, color = idmCss)

var ext_choch_lbl = label.new(na,na, 'CHoCH', color = color(na), size = size.tiny)
var ext_bos_lbl   = label.new(na,na, 'BOS'  , color = color(na), size = size.tiny)
var ext_idm_lbl   = label.new(na,na, 'IDM'  , color = color(na), size = size.tiny, textcolor = idmCss)

if barstate.islast
    if os == 1
        if showChoch
            ext_choch.set_xy1(btmx, btmy), ext_choch.set_xy2(n, btmy), ext_choch.set_color(bearCss)    
            ext_choch_lbl.set_xy(n, btmy), ext_choch_lbl.set_style(label.style_label_up), ext_choch_lbl.set_textcolor(bearCss)
        
        if showBos
            ext_bos.set_xy1(max_x1, max), ext_bos.set_xy2(n, max), ext_bos.set_color(bullCss)    
            ext_bos_lbl.set_xy(n, max), ext_bos_lbl.set_style(label.style_label_down), ext_bos_lbl.set_textcolor(bullCss)
        
        if not sbtm_crossed and showIdm
            ext_idm.set_xy1(sbtmx, sbtmy), ext_idm.set_xy2(n+15, sbtmy)   
            ext_idm_lbl.set_xy(n+15, sbtmy), ext_idm_lbl.set_style(label.style_label_up)
            ext_idm.set_color(idmCss), ext_idm_lbl.set_textcolor(idmCss)
        else
            ext_idm.set_color(na)
            ext_idm_lbl.set_textcolor(na)
    else
        if showChoch
            ext_choch.set_xy1(topx, topy), ext_choch.set_xy2(n, topy), ext_choch.set_color(bullCss)    
            ext_choch_lbl.set_xy(n, topy), ext_choch_lbl.set_style(label.style_label_down), ext_choch_lbl.set_textcolor(bullCss)
        
        if showBos
            ext_bos.set_xy1(min_x1, min), ext_bos.set_xy2(n, min), ext_bos.set_color(bearCss)    
            ext_bos_lbl.set_xy(n, min), ext_bos_lbl.set_style(label.style_label_up), ext_bos_lbl.set_textcolor(bearCss)

        if not stop_crossed and showIdm
            ext_idm.set_xy1(stopx, stopy), ext_idm.set_xy2(n+15, stopy)   
            ext_idm_lbl.set_xy(n+15, stopy), ext_idm_lbl.set_style(label.style_label_down)
            ext_idm.set_color(idmCss), ext_idm_lbl.set_textcolor(idmCss)
        else
            ext_idm.set_color(na)
            ext_idm_lbl.set_textcolor(na)

//---------------------------------------------------------------------------------------------------------------------}
//Plots
//---------------------------------------------------------------------------------------------------------------------{
plot(showCircles ? top : na, 'Swing High', color.new(bearCss, 50), 5, plot.style_circles, offset = -len)
plot(showCircles ? btm : na, 'Swing Low', color.new(bullCss, 50), 5, plot.style_circles, offset = -len)

//---------------------------------------------------------------------------------------------------------------------}