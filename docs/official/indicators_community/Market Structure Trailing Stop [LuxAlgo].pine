// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Market Structure Trailing Stop [LuxAlgo]", overlay = true, max_lines_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
length  = input(14, 'Pivot Lookback')
incr    = input.float(100, 'Increment Factor %', minval = 0)
resetOn = input.string('CHoCH', 'Reset Stop On', options = ['CHoCH', 'All'])
showMS  = input(true, "Show Structures")

//Style
bullCss    = input(color.teal, 'Bullish MS'                           , group = 'Colors')
bearCss    = input(color.red, 'Bearish MS'                            , group = 'Colors')
retCss     = input(#ff5d00, 'Retracement'                             , group = 'Colors')
areaTransp = input.int(80, 'Area Transparency', minval = 0, maxval = 100, group = 'Colors')

//------------------------------------------------------------------------------
//Global variables
//-----------------------------------------------------------------------------{
var float ph_y = na , var int ph_x = na
var float pl_y = na , var int pl_x = na
var float top = na  , var float btm = na
var ph_cross = false, var pl_cross = false

var float max = na
var float min = na
var float ts = na

var os = 0
ms = 0

//------------------------------------------------------------------------------
//Detect pivots and get coordinates
//-----------------------------------------------------------------------------{
n = bar_index
ph = ta.pivothigh(length, length)
pl = ta.pivotlow(length, length)

if ph 
    ph_y := ph
    ph_x := n - length
    ph_cross := false

if pl 
    pl_y := pl
    pl_x := n - length
    pl_cross := false

//-----------------------------------------------------------------------------}
//Bullish structures
//-----------------------------------------------------------------------------{
if close > ph_y and not ph_cross
    if resetOn == 'CHoCH'
        ms := os == -1 ? 1 : 0
    else
        ms := 1

    ph_cross := true

    //Highilight bullish MS
    if showMS
        line.new(ph_x, ph_y, n, ph_y
          , color = bullCss
          , style = os == -1 ? line.style_dashed : line.style_dotted)

    os := 1

    //Search for local minima
    btm := low
    for i = 0 to (n - ph_x)-1
        btm := math.min(low[i], btm)

//-----------------------------------------------------------------------------}
//Bearish structures
//-----------------------------------------------------------------------------{
if close < pl_y and not pl_cross
    if resetOn == 'CHoCH'
        ms := os == 1 ? -1 : 0
    else
        ms := -1

    pl_cross := true

    //Highilight bearish MS
    if showMS
        line.new(pl_x, pl_y, n, pl_y
          , color = bearCss
          , style = os == 1 ? line.style_dashed : line.style_dotted)

    os := -1

    //Search for local maxima
    top := high
    for i = 0 to (n - pl_x)-1
        top := math.max(high[i], top)

//-----------------------------------------------------------------------------}
//Trailing stop
//-----------------------------------------------------------------------------{
//Trailing max/min
if ms == 1
    max := close
else if ms == -1
    min := close
else
    max := math.max(close, max)
    min := math.min(close, min)

//Trailing stop
ts := ms == 1 ? btm
  : ms == -1 ? top
  : os == 1 ? ts + (max - max[1]) * incr / 100
  : ts + (min - min[1]) * incr / 100

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
css = ms ? na 
  : os == 1 ? bullCss
  : bearCss

plot_price = plot(close, editable = false, display = display.none)
plot_ts    = plot(ts, 'Trailing Stop', color = css)

css_area = (close - ts) * os < 0 ? retCss
  : css

fill(plot_price, plot_ts, color.new(css_area, areaTransp))

//-----------------------------------------------------------------------------}