// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// ©LuxAlgo

//@version=5
indicator("Inversion Fair Value Gaps (IFVG) [LuxAlgo]", "LuxAlgo - Inversion Fair Value Gaps (IFVG)", overlay = true, max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
disp_num = input.int(5, maxval = 100, minval = 1, title = "Show Last", tooltip = "Specifies the amount of most recent inversion FVG to display in Bullish/Bearish pairs, starting at the current and looking back.")
signal_pref = input.string("Close", title = "Signal Preference", options = ["Close","Wick"], tooltip = "Choose to send signals based on Wicks or Close Price.")
wt = signal_pref == "Wick"
atr_multi = input.float(0.25, step = 0.25,minval = 0,  title = "ATR Multiplier", tooltip = "Filters FVGs based on ATR Width, Only displays Inversions that are Greater-Than the ATR*Multiplier.")

//Colors
green = input.color(color.new(#089981, 80), title = "Bull Color", group = "Colors")
red = input.color(color.new(#f23645, 80), title = "Bear Color", group = "Colors")
gray = input.color(#787b86, title = "Midline Color", group = "Colors")
invis = color.rgb(0,0,0,100)

//---------------------------------------------------------------------------------------------------------------------}
//UDT's
//---------------------------------------------------------------------------------------------------------------------{
type lab //Contains Necessary Label Data to Send to Label Function
    int x
    float y
    int dir

type fvg //Contains Necessary FVG Data to Send to Chart.
    int left = na
    float top = na
    int right = na
    float bot = na
    float mid = na
    int dir = na
    int state = na
    array<lab> labs = na
    int x_val = na

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{
//Basic Calcs
buffer = 100 //How many FVGs to keep in memory.
c_top = math.max(open,close)
c_bot = math.min(open,close)

label_maker(_x,_y,_dir) => //Used for making Labels
    switch
        _dir == 1 => label.new(_x,_y,"\n▲", style = label.style_text_outline, color = invis,  textcolor = color.new(green,0), size = size.small, xloc = xloc.bar_time)
        _dir == -1 => label.new(_x,_y, "▼\n", style = label.style_text_outline, color = invis,  textcolor = color.new(red,0), size = size.small, xloc = xloc.bar_time)

fvg_manage(_ary,_inv_ary) => //First step filtering of FVG data, Not all FVGs will be displayed, only inversions.
    if _ary.size() >= buffer
        _ary.shift()

    if _ary.size() > 0
        for i = _ary.size()-1 to 0
            value = _ary.get(i)
            _dir = value.dir

            if _dir == 1 and (c_bot < value.bot)
                value.x_val := time
                _inv_ary.push(_ary.remove(i))
            if _dir == -1 and (c_top > value.top)
                value.x_val := time
                _inv_ary.push(_ary.remove(i))
            

inv_manage(_ary) => //All inversions will be displayed.
    fire = false
    if _ary.size() >= buffer
        _ary.shift()
    if _ary.size() > 0
        for i = _ary.size()-1 to 0
            value = _ary.get(i)
            bx_top = value.top
            bx_bot = value.bot
            _dir = value.dir
            st = value.state

            if (st == 0 and _dir == 1)
                value.state := 1
                value.dir := -1
            if (_dir == -1 and st == 0)
                value.state := 1
                value.dir := 1
            if st >= 1
                value.right := time
            if (_dir == -1 and st == 1 and close < bx_bot and (wt?high:close[1]) >= bx_bot and (wt?high:close[1]) < bx_top)
                value.labs.push(lab.new(time,bx_top,-1))
                fire := true
            if (_dir == 1 and st == 1 and close > bx_top and (wt?low:close[1]) <= bx_top and (wt?low:close[1]) > bx_bot)
                value.labs.push(lab.new(time,bx_bot,1))
                fire := true
            if st >= 1 and ((_dir == -1 and c_top > bx_top) or (_dir == 1 and c_bot < bx_bot))
                _ary.remove(i)
            
    fire

send_it(_ary) => // Draws Everything on the Chart
    last_index = _ary.size()-1
    for [index,value] in _ary
        bx_top = value.top
        bx_bot = value.bot
        bx_left = value.left
        xval = value.x_val
        mid = value.mid
        col = value.dir == -1 ? green : red
        o_col = value.dir == -1 ? red : green

        if index > last_index - disp_num
            box.new(bx_left,bx_top,xval,bx_bot,bgcolor = col, border_color = invis, xloc = xloc.bar_time)
            box.new(xval,bx_top,time,bx_bot, bgcolor = o_col, border_color = invis, xloc = xloc.bar_time)

            line.new(bx_left,mid,time,mid, color = gray, style = line.style_dashed, xloc = xloc.bar_time)
            box.new(bar_index,bx_top,bar_index+50,bx_bot, bgcolor = o_col, border_color = invis)
            line.new(bar_index,mid,bar_index+50,mid, color = gray, style = line.style_dashed)

            for stuff in value.labs
                label_maker(stuff.x,stuff.y,stuff.dir)

//---------------------------------------------------------------------------------------------------------------------}
//Delete drawings
//---------------------------------------------------------------------------------------------------------------------{
for boxes in box.all
    box.delete(boxes)

for lines in line.all
    line.delete(lines)

for labels in label.all
    label.delete(labels)

//---------------------------------------------------------------------------------------------------------------------}
//Data Arrays
//---------------------------------------------------------------------------------------------------------------------{
var bull_fvg_ary = array.new<fvg>(na) // FVG Data, Not all will be Drawn
var bear_fvg_ary = array.new<fvg>(na)

var bull_inv_ary = array.new<fvg>(na) // Inversion Data, All will be Drawn
var bear_inv_ary = array.new<fvg>(na)

//---------------------------------------------------------------------------------------------------------------------}
//FVG Detection
//---------------------------------------------------------------------------------------------------------------------{
atr = nz(ta.atr(200)*atr_multi, ta.cum(high - low) / (bar_index+1))

fvg_up = (low > high[2]) and (close[1] > high[2])
fvg_down = (high < low[2]) and (close[1] < low[2])

if fvg_up and math.abs(low-high[2]) > atr
    array.push(bull_fvg_ary,fvg.new(time[1], low, time, high[2], math.avg(low,high[2]), 1, 0,array.new<lab>(na),na))

if fvg_down and math.abs(low[2]-high) > atr
    array.push(bear_fvg_ary,fvg.new(time[1], low[2], time, high, math.avg(high,low[2]),-1 ,0,array.new<lab>(na),na))

//---------------------------------------------------------------------------------------------------------------------}
//Running Functions
//---------------------------------------------------------------------------------------------------------------------{
// FVG_Data -> Inversion_Data -> Chart
fvg_manage(bull_fvg_ary,bull_inv_ary)
fvg_manage(bear_fvg_ary,bear_inv_ary)

bear_signal = inv_manage(bull_inv_ary)
bull_signal = inv_manage(bear_inv_ary)

if barstate.islast
    send_it(bull_inv_ary)
    send_it(bear_inv_ary)

//Alert Options
alertcondition(bull_signal, "Bullish Signal")
alertcondition(bear_signal, "Bearish Signal")

//---------------------------------------------------------------------------------------------------------------------}