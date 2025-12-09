// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("FVG Sessions [LuxAlgo]", overlay = true, max_lines_count = 500, max_boxes_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
bullCss          = input.color(color.teal, 'FVG Level'               , inline = 'bull')
bullAreaCss      = input.color(color.new(color.teal, 50), 'Area'     , inline = 'bull')
bullMitigatedCss = input.color(color.new(color.teal, 80), 'Mitigated', inline = 'bull')

bearCss          = input.color(color.red, 'FVG Level'                , inline = 'bear')
bearAreaCss      = input.color(color.new(color.red, 50), 'Area'      , inline = 'bear')
bearMitigatedCss = input.color(color.new(color.red, 80), 'Mitigated' , inline = 'bear')

//-----------------------------------------------------------------------------}
//UDT's
//-----------------------------------------------------------------------------{
type fvg
    float top
    float btm
    bool  mitigated
    bool  isnew
    bool  isbull
    line  lvl
    box   area

type session_range
    line max
    line min

//-----------------------------------------------------------------------------}
//Methods
//-----------------------------------------------------------------------------{
n = bar_index

//Method for setting fair value gaps
method set_fvg(fvg id, offset, bg_css, l_css)=>
    avg = math.avg(id.top, id.btm)

    area  = box.new(n - offset, id.top, n, id.btm, na, bgcolor = bg_css)
    avg_l = line.new(n - offset, avg, n, avg, color = l_css, style = line.style_dashed)

    id.lvl := avg_l
    id.area := area

//Method for setting session range maximum/minimum
method set_range(session_range id)=>
    max = math.max(high, id.max.get_y2())
    min = math.min(low, id.min.get_y2())

    id.max.set_xy2(n, max)
    id.max.set_y1(max)

    id.min.set_xy2(n, min)
    id.min.set_y1(min)

//-----------------------------------------------------------------------------}
//Variables
//-----------------------------------------------------------------------------{
var chartCss = color.new(chart.fg_color, 50)

var fvg sfvg = fvg.new(na, na, na, true, na)
var session_range sesr = na

var box area = na
var line avg = na

bull_fvg = low > high[2] and close[1] > high[2]
bear_fvg = high < low[2] and close[1] < low[2]

//Alert conditions
bull_isnew      = false
bear_isnew      = false
bull_mitigated  = false
bear_mitigated  = false
within_bull_fvg = false
within_bear_fvg = false

//-----------------------------------------------------------------------------}
//New session
//-----------------------------------------------------------------------------{
dtf = timeframe.change('D')

//On new session
if dtf
    //Set delimiter
    line.new(n, high + syminfo.mintick
      , n, low - syminfo.mintick
      , color = chartCss
      , style = line.style_dashed
      , extend = extend.both)

    //Set new range
    sesr := session_range.new(
      line.new(n, high, n, high, color = chartCss)
      , line.new(n, low, n, low, color = chartCss))

    sfvg.isnew := true

    //Set prior session fvg right coordinates
    if not na(sfvg.lvl)
        sfvg.lvl.set_x2(n-2)
        sfvg.area.set_right(n-2)

//Set range
else if not na(sesr)
    sesr.set_range()

    //Set range lines color
    sesr.max.set_color(sfvg.isbull ? bullCss : bearCss)
    sesr.min.set_color(sfvg.isbull ? bullCss : bearCss)

//-----------------------------------------------------------------------------}
//Set FVG
//-----------------------------------------------------------------------------{
//New session bullish fvg
if bull_fvg and sfvg.isnew
    sfvg := fvg.new(low, high[2], false, false, true)
    sfvg.set_fvg(2, bullAreaCss, bullCss)

    bull_isnew := true

//New session bearish fvg
else if bear_fvg and sfvg.isnew
    sfvg := fvg.new(low[2], high, false, false, false)
    sfvg.set_fvg(2, bearAreaCss, bearCss)

    bear_isnew := true

//Change object transparencies if mitigated
if not sfvg.mitigated
    //If session fvg is bullish
    if sfvg.isbull and close < sfvg.btm
        sfvg.set_fvg(1, bullMitigatedCss, bullCss)

        sfvg.mitigated := true
        bull_mitigated := true

    //If session fvg is bearish
    else if not sfvg.isbull and close > sfvg.top
        sfvg.set_fvg(1, bearMitigatedCss, bearCss)

        sfvg.mitigated := true
        bear_mitigated := true

//Set fvg right coordinates to current bar
if not sfvg.isnew
    sfvg.lvl.set_x2(n)
    sfvg.area.set_right(n)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
//On new session fvg
alertcondition(bull_isnew, 'Bullish FVG', 'New session bullish fvg')
alertcondition(bear_isnew, 'Bearish FVG', 'New session bearish fvg')

//On fvg mitigation
alertcondition(bull_mitigated, 'Mitigated Bullish FVG', 'Session bullish fvg has been mitigated')
alertcondition(bear_mitigated, 'Mitigated Bearish FVG', 'Session bearish fvg has been mitigated')

//If within fvg
alertcondition(close >= sfvg.btm and close <= sfvg.top and sfvg.isbull and not sfvg.isnew
  , 'Price Within Bullish FVG'
  , 'Price is within bullish fvg')

alertcondition(close >= sfvg.btm and close <= sfvg.top and not sfvg.isbull and not sfvg.isnew
  , 'Price Within Bearish FVG'
  , 'Price is within bearish fvg')

//On fvg average cross
alertcondition(ta.cross(close, math.avg(sfvg.top, sfvg.btm)) and sfvg.isbull and not sfvg.isnew
  , 'Bullish FVG AVG Cross'
  , 'Price crossed bullish fvg average')

alertcondition(ta.cross(close, math.avg(sfvg.top, sfvg.btm)) and not sfvg.isbull and not sfvg.isnew
  , 'Bearish FVG AVG Cross'
  , 'Price crossed bearish fvg average')

//-----------------------------------------------------------------------------}