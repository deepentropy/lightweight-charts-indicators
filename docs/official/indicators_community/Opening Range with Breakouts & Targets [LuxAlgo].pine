// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=6
indicator("Opening Range with Breakouts & Targets [LuxAlgo]",shorttitle = "LuxAlgo - ORB & Targets", overlay = true, max_lines_count = 500, max_labels_count = 500, max_boxes_count = 500)

//---------------------------------------------------------------------------------------------------------------------}
//inputs
//---------------------------------------------------------------------------------------------------------------------{

//Historical Display
showHist = input.bool(true, title = "Show Historical Data", group = "Historical Display", tooltip = "Displays All Data from Previous Sessions")
//Opening Range
orTF = input.timeframe("30", title = "Time Period", group = "Opening Range", tooltip = "Sets the Length of Time used for determining Opening Range.") 
//Custom Range
crTog = input.bool(false, title = "", inline = "Custom", group = "Custom Range")
crSesh = input.session("0930-0945", title = "", inline = "Custom", group = "Custom Range")
tz = input.string("UTC-5", title = "", group = "Custom Range", inline = "Custom", options = ["UTC-10", "UTC-8", "UTC-7", "UTC-6", "UTC-5", "UTC-4", "UTC-3", "UTC+0", "UTC+1", "UTC+2", "UTC+3", "UTC+3:30", "UTC+4", "UTC+5", "UTC+5:30", "UTC+5:45", "UTC+6","UTC+6:30", "UTC+7", "UTC+8", "UTC+9", "UTC+9:30", "UTC+10", "UTC+11", "UTC+12", "UTC+12:45", "UTC+13"])
//Breakout Signals
sigTog = input.bool(true, title = "Show Breakout Signals", group = "Breakout Signals")
useBias = input.string("No Bias", title = "Signal Bias", options = ["No Bias","Daily Bias"], group = "Breakout Signals", tooltip = "OR Fill Color is directional based on if the current Day/Session ORM is Above or Below the Previous ORM.\nExamples\nNo Bias: Signals Occur Regardless of OR Color\nDaily Bias: Signals do not fire until Target 1 when Breakout is in opposite direction of OR Color.") == "No Bias" ? false : true
sigSize = str.lower(input.string("Small", title = "Signal Size", options = ["Tiny","Small","Normal","Large","Huge"], group = "Breakout Signals"))
upSigColor = input.color(#089981, title = "Up Color", group = "Breakout Signals", inline = "Colors")
downSigColor = input.color(#f23645, title = "Down Color", group = "Breakout Signals", inline = "Colors")
//Targets
tTog = input.bool(true, title = "Show Targets", group = "Targets")
tPer = input.float(50,minval = 1, title = "Target % of Range", group = "Targets", tooltip = "Uses this % of OR Width to use as the distance for targets.")*0.01
tSrc = input.string("Close", title = "Target Cross Source", options = ["Close","Highs/Lows"], group = "Targets", tooltip = "Uses this Source to tell the script when a target is hit in order to draw the next target.")
tDispType = input.string("Adaptive", title = "Target Display", options = ["Adaptive","Extended"], group = "Targets", tooltip = "Adaptive: Displays and hides targets Adaptivly based on the current price.\nExtended: Extends all targets to the current bar and does not hide any targets after generation.")
//Session Moving Average
maTog = input.bool(false, title = "", inline = "MA", group = "Session Moving Average")
maLen = input.int(20, title = "", inline = "MA", group = "Session Moving Average")
maType = input.string("EMA", title = "", options=["SMA", "EMA", "RMA", "WMA", "VWMA"], inline = "MA", group = "Session Moving Average")
maColor = input.color(color.orange, title = "", inline = "MA", group = "Session Moving Average", tooltip  = "Moving average resets on the start of each session (at Opening Range Start).")
//Style
green = input.color(color.new(#089981,60), title = " Bull Target Color", group = "Style", inline = "Bull")
red = input.color(color.new(#f23645,60), title = "Bear Target Color", group = "Style", inline = "Bear")
greenFill = input.color(color.new(#089981,80), title = " Bull Fill Color", group = "Style", inline = "Bull")
redFill = input.color(color.new(#f23645,80), title = "Bear Fill Color", group = "Style", inline = "Bear")
orColor = input.color(#787b86, title = "   OR Levels Color", group = "Style", inline = "Range")
orFillColor = input.color(color.new(color.gray,60), title = "OR Highlight Color", group = "Style", inline = "Range")
tStyle = input.string("___", title = "Target Style", options = ["___","- - -",". . ."], group = "Style")
txtSize = str.lower(input.string("Small", title = "Text Size", options = ["Tiny","Small","Normal","Large","Huge"], group = "Style"))

invis = color.rgb(0,0,0,100)
//---------------------------------------------------------------------------------------------------------------------}
//Error
//---------------------------------------------------------------------------------------------------------------------{
if timeframe.in_seconds(timeframe.period) >= timeframe.in_seconds("D")
    runtime.error("Timeframe is too High! Please Reduce Timeframe to be Less-Than 1 Day.")

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{
fz(_val) => _val == 0 ? 1 : _val

day_ma(_start,_type,s,l) =>
    bs_nd = fz(ta.barssince(_start))
    v_len = bs_nd < l?bs_nd:l
    var float ma = na
    if _type == "EMA"
        k = 2/(v_len + 1)
        ma := (s*k) + (nz(ma[1])*(1-k))
    if _type == "RMA"
        a = (1/v_len)
	    ma := a * s + (1 - a) * nz(ma[1])
    if _type == "SMA"
        ma := ta.sma(s,v_len)
    if _type == "WMA"
        ma := ta.wma(s,v_len)    
    if _type == "VWMA"
        ma := ta.vwma(s,v_len)
    ma

dash() => (bar_index/2 - math.floor(bar_index/2)) > 0

linestyle(_input) =>
    _input == "___"?line.style_solid:
     _input == "- - -"?line.style_dashed:
     _input == ". . ."?line.style_dotted:
     na

get_1up(_val) => (_val - math.floor(_val)) > 0 ? int(math.floor(_val) + 1) : int(_val)

//---------------------------------------------------------------------------------------------------------------------}
//UDTs
//---------------------------------------------------------------------------------------------------------------------{

type target
    line ln
    label lab

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{

var up_targs = array.new<target>(na)
var down_targs = array.new<target>(na)
var signals = array.new_label()

var bool or_sesh = false
var bool or_token = false

var float orh = na 
var float orl = na
var float hst = na 
var float lst = na
var float prev_orm = na

var int up_count = na
var int down_count = na

var box or_bx = na

var int day_dir = 0
var down_check = false
var up_check = false
down_signal = false
up_signal = false

var target h_ln = target.new(na,na)
var target l_ln = target.new(na,na)
var line m_ln = na

//---------------------------------------------------------------------------------------------------------------------}
//Calculations
//---------------------------------------------------------------------------------------------------------------------{

orm = math.avg(orh,orl)
orw = math.abs(orh-orl)    

h_src = tSrc == "Close" ? close : high
l_src = tSrc == "Close" ? close : low

//Establishing When the OR Sesssion is

new_tf = timeframe.change(orTF)
if crTog
    or_sesh := not na(time(timeframe.period, crSesh, tz))
else 
    if session.isfirstbar
        or_sesh := true
    else if not session.isfirstbar and new_tf
        or_sesh := false

or_start = or_sesh and not or_sesh[1]
or_end = or_sesh[1] and not or_sesh

//On Start of OR Session
if or_start
    for targ in up_targs
        if showHist == false
            targ.ln.delete()
        targ.lab.delete()

    for targ in down_targs
        if showHist == false
            targ.ln.delete()
        targ.lab.delete()

    for lab in signals
        if showHist == false
            lab.delete()

    if showHist == false
        or_bx.delete()
        h_ln.ln.delete()
        l_ln.ln.delete()
        m_ln.delete()

    h_ln.lab.delete()
    l_ln.lab.delete()
    up_targs.clear()
    down_targs.clear()

    orh := high
    orl := low
    prev_orm := orm[1]
    up_count := 0
    down_count := 0
    up_check := true
    down_check := true

    or_bx := box.new(bar_index,high,bar_index,low, bgcolor = orFillColor, border_width = 0)

    or_token := false

//Running while OR Session is Live
if or_sesh
    if high > orh
        orh := high
    if low < orl
        orl := low
    or_bx.set_top(orh)
    or_bx.set_bottom(orl)
    or_bx.set_right(bar_index)
    if orh != orl
        or_token := true
        
//On End of OR Session
if or_end and or_token
    h_ln := target.new(line.new(bar_index,orh,bar_index,orh, color = orColor),label.new(bar_index,orh,text = "ORH",tooltip = str.tostring(orh,format.mintick), style = label.style_label_left, color = invis, textcolor = color.new(orColor,0), size = txtSize))
    l_ln := target.new(line.new(bar_index,orl,bar_index,orl, color = orColor),label.new(bar_index,orl,text = "ORL",tooltip = str.tostring(orl,format.mintick), style = label.style_label_left, color = invis, textcolor = color.new(orColor,0), size = txtSize))
    m_ln := line.new(bar_index,orm,bar_index,orm, style = line.style_dashed, color = orColor)
    hst := orh + (orw*tPer)
    lst := orl - (orw*tPer)

    day_dir := orm > prev_orm ? 1 : orm < prev_orm ? -1 : 0
    linefill.new(h_ln.ln,l_ln.ln, day_dir == 1 ? greenFill : day_dir == -1 ? redFill : invis)


//Running outside of OR Session
if not or_sesh and or_token
    h_ln.ln.set_x2(bar_index)
    l_ln.ln.set_x2(bar_index)
    h_ln.lab.set_x(bar_index)
    l_ln.lab.set_x(bar_index)
    m_ln.set_x2(bar_index)

//Target Calculations
if h_src > hst
    hst := h_src
if l_src < lst
    lst := l_src

up_max = get_1up((hst - orh)/(orw*tPer))
down_max = get_1up((orl - lst)/(orw*tPer))

up_cur = math.max(0,get_1up((h_src - orh)/(orw*tPer)))
down_cur = math.max(0,get_1up((orl - l_src)/(orw*tPer)))

//Signal Calcs
if  (close > orm and down_check == false)
    down_check := true

xdown = ta.crossunder(close,orl)
xdown2 = ta.crossunder(close,orl-orw*tPer)
if (useBias ? ((day_dir != 1 and xdown) or (day_dir == 1 and xdown2)) : ta.crossunder(close,orl)) and down_check
    down_signal := true
    down_check := false

if (close < orm and up_check == false)
    up_check := true

xup = ta.crossover(close,orh)
xup2 = ta.crossover(close,orh+orw*tPer)
if (useBias ? ((day_dir != -1 and xup) or (day_dir == -1 and xup2)) : ta.crossover(close,orh)) and up_check
    up_signal := true
    up_check := false

//---------------------------------------------------------------------------------------------------------------------}
//Display
//---------------------------------------------------------------------------------------------------------------------{

//Targets
if not or_sesh and or_token
    if up_count < up_max and tTog
        for i = (up_count+1) to up_max 
            up_targs.push(target.new(
              line.new(bar_index-1,(orh+orw*tPer*i),bar_index,(orh+(orw*tPer*i)), color = green, style = linestyle(tStyle)),
              label.new(bar_index,(orh+orw*tPer*i),text = str.tostring(i),tooltip = str.tostring(orh+orw*tPer*i,format.mintick), style = label.style_label_left, color = invis, textcolor = color.new(green,0), size = txtSize)
              ))
            if i == up_max
                up_count := up_max
    if down_count < down_max and tTog
        for i = (down_count+1) to down_max
            down_targs.push(target.new(
              line.new(bar_index-1,(orl-orw*tPer*i),bar_index,(orl-(orw*tPer*i)), color = red, style = linestyle(tStyle)),
              label.new(bar_index,(orl-orw*tPer*i),text = str.tostring(i),tooltip = str.tostring(orl-orw*tPer*i,format.mintick), style = label.style_label_left, color = invis, textcolor = color.new(red,0), size = txtSize)
              ))
            if i == down_max
                down_count := down_max

//Extending to Current Bar   
if tDispType == "Extended" and tTog
    for targ in up_targs
        targ.ln.set_x2(bar_index)
        targ.lab.set_x(bar_index)
    for targ in down_targs
        targ.ln.set_x2(bar_index)
        targ.lab.set_x(bar_index) 

if tDispType == "Adaptive" and tTog
    for targ in up_targs
        if targ.ln.get_y1() <= (orh+(orw*tPer*(up_cur))) and targ.ln.get_y1() >= (orh+(orw*tPer*(up_cur-2)))
            targ.ln.set_x2(bar_index+1)
            targ.lab.set_x(bar_index+1)
    for targ in down_targs
        if targ.ln.get_y1() <= (orl-(orw*tPer*(down_cur-2))) and targ.ln.get_y1() >= (orl-(orw*tPer*(down_cur)))
            targ.ln.set_x2(bar_index+1)
            targ.lab.set_x(bar_index+1)


//Moving Average
ma = day_ma(or_start,maType,close,maLen)
plot(or_start?na:ma, style = plot.style_linebr, color = maColor, display = maTog?display.all:display.none, title = "Moving Average", editable = false)

//Signals
if up_signal and sigTog
    signals.push(label.new(bar_index, orl,
      style = label.style_label_center, 
      text = "\n▲", 
      color = invis, 
      textcolor = upSigColor, 
      size = sigSize))

if down_signal and sigTog
    signals.push(label.new(bar_index, orh,
      style = label.style_label_center, 
      text = "▼\n",
      color = invis, 
      textcolor = downSigColor, 
      size = sigSize))

//---------------------------------------------------------------------------------------------------------------------}