// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Trend Lines [LuxAlgo]", shorttitle= "LuxAlgo - Trend Lines", max_lines_count = 500, max_labels_count = 500, overlay = true)

//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
NN     = "Disabled"
AB     = "Point A - Point B"
AC     = "Point A - Current bar"
length = input.int   (   50    ,                                    minval =          2         , group=        "Swings"        )
toggle = input.string(   NN    ,  'Check breaks between:' ,         options=  [  AB, AC, NN  ]  , group= "Trendline validation" )
source = input.string( "close" ,     'source (breaks)'    ,         options=  ["close", "H/L"]  , group= "Trendline validation" )
count  = input.int   (    3    ,       'Minimal bars'     ,         minval =          0         , group=   "Trendline breaks"   
                                                          ,         tooltip=       'Uninterrupted Trendline for at least x bars') 
showA  = input.bool  (  true   ,       'show Angles'                                            , group=        "Angles"        )
ratio  = input.float (    3    ,     'Ratio X-Y axis'     ,           step =0.1                 , group=        "Angles"        )
anglA  = input.float (    0.1  ,'Only Trendlines between:',         minval =0.1, inline= 'angle', group=        "Angles"        ) 
anglB  = input.float (   90    ,           ' - '          ,         minval =0.1, inline= 'angle', group=        "Angles"        ) 
upCss  = input.color (#2962ff,           'Up'           ,                                       group=       "Colours"        ) 
dnCss  = input.color (#f23645,          'Down'          ,                                       group=       "Colours"        ) 

//-----------------------------------------------------------------------------}
//Variables
//-----------------------------------------------------------------------------{
//Downtrendline
var int   phx1    = na
var float phslope = na
var float phy1    = na
var float upper   = na
var float plotH   = na
var bool  isOnH   = false

//Uptrendline
var int   plx1    = na
var float plslope = na
var float ply1    = na
var float lower   = na
var float plotL   = na
var bool  isOnL   = false

var line testLine = line.new(na, na, na, na, color=color.new(color.blue, 100))

//-----------------------------------------------------------------------------}
//Calculations
//-----------------------------------------------------------------------------{
n     = bar_index
bg    = chart.bg_color
fg    = chart.fg_color
ph    = ta.pivothigh  (length, length)
pl    = ta.pivotlow   (length, length)
bars  = 500 , height = bars  /  ratio
Xaxis = math.min(math.max(1, n), bars)
Yaxis = ta.highest(Xaxis) - ta.lowest(Xaxis)
srcBl = source == "close" ? close : high
srcBr = source == "close" ? close : low

//-----------------------------------------------------------------------------}
//Function
//-----------------------------------------------------------------------------{
calculate_slope(x1, x2, y1, y2) => 
    diffX = x2 - x1, diffY = y2 - y1
    diffY_to_Yaxis   =  Yaxis  / diffY
    normalised_slope = (height / diffY_to_Yaxis) / diffX
    slope            =           diffY           / diffX
    angle = math.round(math.atan(normalised_slope) * 180 / math.pi, 2)
    [normalised_slope, slope, angle]

//-----------------------------------------------------------------------------}
//Execution
//-----------------------------------------------------------------------------{
if not na(ph)
    if ph < phy1
        [normalised_slope, slope, angle]= calculate_slope(phx1, n-length, phy1, ph)
        testLine.set_xy1(phx1, phy1), testLine.set_xy2(n, ph + slope * length)        
        src    = source == "close" ? close : high, max_bars_back(src, 2000)
        isOnH := false
        broken = false
        if math.abs(angle) > anglA and math.abs(angle) < anglB
            if toggle != NN
                for i  = (toggle == AB ? length : 0) to n - phx1 
                    if   src[i]   > testLine.get_price(n - i)
                        broken   := true
                        break
            if not broken        
                phslope := slope, isOnH := true, upper := ph + slope * length
                line.new(phx1, phy1, n, ph + slope * length
                 , color= dnCss, style= line.style_dotted)
                if showA
                    label.new(phx1, phy1, text= str.tostring(angle)
                     , style      = label.style_label_down
                     , color      = color.new(bg, 100)
                     , textcolor  = dnCss)
    
    phy1 := ph
    phx1 := n-length

upper += phslope
plotH := not na(ph) and ta.change(phslope) ? na : srcBl[1] > upper[1] ? na : upper 
bs_H   = ta.barssince (na(plotH ))

if not na(pl)
    if pl > ply1
        [normalised_slope, slope, angle]= calculate_slope(plx1, n-length, ply1, pl)
        testLine.set_xy1(plx1, ply1), testLine.set_xy2(n, pl + slope * length)        
        src    = source == "close" ? close : low , max_bars_back(src, 2000)
        isOnL := false
        broken = false
        if angle > anglA and angle < anglB
            if toggle != NN
                for i  = (toggle == AB ? length : 0) to n - plx1 
                    if   src[i]   < testLine.get_price(n - i)
                        broken   := true
                        break        
            if not broken
                plslope := slope, isOnL := true, lower := pl + slope * length
                line.new(plx1, ply1, n, pl + slope * length
                 , color= upCss, style= line.style_dotted)
                if showA            
                    label.new(plx1, ply1, text= str.tostring(angle) 
                     , style      = label.style_label_up  
                     , color      = color.new(bg, 100)
                     , textcolor  = upCss)   

    ply1 := pl
    plx1 := n-length

lower += plslope
plotL := not na(pl) and ta.change(plslope) ? na : srcBr[1]  < lower[1] ? na : lower
bs_L   = ta.barssince (na(plotL ))

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
plot(plotH, 'Down Trendline'
  , dnCss
  , 1
  , plot.style_linebr)

plot(plotL, 'Up Trendline'
  , upCss
  , 1
  , plot.style_linebr)

plotshape(
  bs_H > count and srcBl > upper and srcBl[1] <= upper[1]
  , 'Bullish break'
  , shape.labelup 
  , location.belowbar
  , dnCss
  , size = size.tiny)

plotshape(
  bs_L > count and srcBr < lower and srcBr[1] >= lower[1]
  , 'Bearish break'
  , shape.labeldown 
  , location.abovebar
  , upCss
  , size = size.tiny)

//-----------------------------------------------------------------------------}