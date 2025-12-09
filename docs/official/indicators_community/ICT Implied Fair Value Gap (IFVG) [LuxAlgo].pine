// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("ICT Implied Fair Value Gap (IFVG) [LuxAlgo]", overlay = true
  , max_lines_count = 500
  , max_boxes_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
thr    = input.float(30, 'Shadow Threshold %', minval = 0, maxval = 100) / 100
ext    = input(8, 'IFVG Extension')
extAvg = input(false, 'Extend Averages')

//Style
showBull = input(true, 'Bullish IFVG'        , inline = 'bull', group = 'Style')
bullZone = input(color.new(#3179f5, 50), '', inline = 'bull', group = 'Style')
bullAvg  = input(#3179f5, ''               , inline = 'bull', group = 'Style')

showBear = input(true, 'Bearish IFVG'        , inline = 'bear', group = 'Style')
bearZone = input(color.new(#ff5d00, 50), '', inline = 'bear', group = 'Style')
bearAvg  = input(#ff5d00, ''               , inline = 'bear', group = 'Style')

//-----------------------------------------------------------------------------}
//Detection Rules
//-----------------------------------------------------------------------------{
n = bar_index
r = high - low
b = math.abs(close - open)

//Bullish IFVG
bull_top = math.avg(math.min(close, open), low)
bull_btm = math.avg(math.max(close[2], open[2]), high[2])

bull_ifvg = b[1] > math.max(b, b[2]) 
  and low < high[2] 
  and (math.min(close, open) - low) / r > thr
  and (high[2] - math.max(close[2], open[2])) / r > thr
  and bull_top > bull_btm

//Bearish IFVG
bear_top = math.avg(math.min(close[2], open[2]), low[2])
bear_btm = math.avg(math.max(close, open), high)

bear_ifvg = b[1] > math.max(b, b[2]) 
  and high > low[2]
  and (high - math.max(close, open)) / r > thr
  and (math.min(close[2], open[2]) - low[2]) / r > thr
  and bear_top > bear_btm

//-----------------------------------------------------------------------------}
//Display IFVG's
//-----------------------------------------------------------------------------{
var float bull_ifvg_avg = na
var float bear_ifvg_avg = na

if bull_ifvg and showBull
    bull_ifvg_avg := math.avg(bull_top, bull_btm)

    //Zone
    box.new(n-2, bull_top, n+ext, bull_btm
      , border_color = bullAvg
      , bgcolor = bullZone)

    //Average
    line.new(n-2, bull_ifvg_avg, n+ext, bull_ifvg_avg
      , color = bullAvg)

if bear_ifvg and showBear
    bear_ifvg_avg := math.avg(bear_top, bear_btm)
    
    //Zone
    box.new(n-2, bear_top, n+ext, bear_btm
      , border_color = bearAvg 
      , bgcolor = bearZone)

    //Average
    line.new(n-2, bear_ifvg_avg, n+ext, bear_ifvg_avg
      , color = bearAvg)

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
plot(bull_ifvg_avg, 'Bullish IFVG Average'
  , ta.barssince(bull_ifvg) > ext and extAvg ? bullAvg : na)

plot(bear_ifvg_avg, 'Bearish IFVG Average'
  , ta.barssince(bear_ifvg) > ext and extAvg ? bearAvg : na)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
alertcondition(bull_ifvg, 'Bullish IFVG', 'Bullish IFVG detected')
alertcondition(bear_ifvg, 'Bearish IFVG', 'Bearish IFVG detected')

//-----------------------------------------------------------------------------}