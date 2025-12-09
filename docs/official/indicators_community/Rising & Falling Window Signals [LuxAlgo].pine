// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Rising & Falling Window Signals [LuxAlgo]","LuxAlgo - Rising & Falling Window Signals", overlay = true, max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
//Horizontal Zone Control
xTendNum = input.int(50, title = "Maximum Live Zone Length", group = "Horizontal Zone Control")
mzHide = input.int(5, title = "Minimum Inactive Zone Length", group = "Horizontal Zone Control")
xot = input.bool(true, title = "Extend Historical Zones on Touch", group = "Horizontal Zone Control")

//Vertical Zone Control
atrLowMulti = input.float(0.25, step = 0.25, title = "Minimum Width", group = "Vertical Zone Control")
atrHighMulti = input.float(5, step = 0.25, title = "Maximum Width", group = "Vertical Zone Control"
  , tooltip = "Width is in Multiples of ATR. Only Zones within the ATR Values are Displayed.")
midDisp = input.bool(true, title = "Show Zone Midlines", group = "Vertical Zone Control")

//Signals
showSignals = input(true, 'Show Zones Tests', group = "Signals")
signalMode = input.string('Engulfing', "Test Type", options = ['Regular', 'Engulfing', "Wick"], group = "Signals")
labSize = str.lower(input.string("Small", title = "Signal Size", options = ["Tiny","Small","Normal","Large","Huge", "Auto"], group = "Signals"))

//Style
bullColor = input.color(color.new(#089981,70), title = "Bull Color  ", group = "Style")
bearColor = input.color(color.new(#f23645,70), title = "Bear Color", group = "Style")

//---------------------------------------------------------------------------------------------------------------------}
//UDTs
//---------------------------------------------------------------------------------------------------------------------{
invis = color.rgb(0,0,0,100)

type bl
    box bx
    line ln

//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{
atr(_multi) => nz(ta.atr(200)*_multi, ta.cum(high - low) / (bar_index+1))

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{

rc = close < open
gc = close > open

win_up = low > high[1]
win_down = high < low[1]

up_width = math.abs(low - high[1])
down_width = math.abs(low[1] - high)

c_bot = math.min(close,open)
c_top = math.max(close,open)

var up_ary = array.new<bl>()
var down_ary = array.new<bl>()

//---------------------------------------------------------------------------------------------------------------------}
//Calculations
//---------------------------------------------------------------------------------------------------------------------{
if win_up and (up_width >= atr(atrLowMulti)) and (up_width <= atr(atrHighMulti))
    mid = midDisp?math.avg(low,high[1]):na
    up_ary.push(bl.new(
      box.new(bar_index[1],low,bar_index,high[1], border_color = na, bgcolor = bullColor),
      line.new(bar_index[1],mid,bar_index,mid, color = bullColor, style = line.style_dashed)))

if win_down and (down_width >= atr(atrLowMulti)) and (down_width <= atr(atrHighMulti))
    mid = midDisp?math.avg(low[1],high):na
    down_ary.push(bl.new(
      box.new(bar_index[1],low[1],bar_index,high, border_color = na, bgcolor = bearColor),
      line.new(bar_index[1],mid,bar_index,mid, color = bearColor, style = line.style_dashed)))

//---------------------------------------------------------------------------------------------------------------------}
//Zone Management & Signal Generation
//---------------------------------------------------------------------------------------------------------------------{
for [i,bxln] in up_ary

    bxlen = math.abs(bxln.bx.get_left() - bxln.bx.get_right())

    up_signal = switch
        signalMode == 'Regular' => (open < bxln.bx.get_top()) and (close > bxln.bx.get_top())
        signalMode == 'Engulfing' => (math.min(low,low[1]) < bxln.bx.get_top()) and rc[1] and (open <= close[1]) and (close > open[1])
        signalMode == 'Wick' => (low < bxln.bx.get_top()) and (c_bot > bxln.bx.get_top())

    if up_signal
        label.new(bar_index, bxln.bx.get_bottom(),
          style = label.style_label_up, 
          text = "▲", 
          color = invis, 
          textcolor = color.new(bullColor,0), 
          size = labSize)

    if bxlen < xTendNum  or (xot and low < bxln.bx.get_top())
        bxln.bx.set_right(bar_index)
        bxln.ln.set_x2(bar_index)

    if c_bot < bxln.bx.get_bottom()
        if bxlen < mzHide
            bxln.bx.delete()
            bxln.ln.delete()
        up_ary.remove(i)

for [i,bxln] in down_ary

    bxlen = math.abs(bxln.bx.get_left() - bxln.bx.get_right())

    down_signal = switch
        signalMode == 'Regular' => (open > bxln.bx.get_bottom()) and (close < bxln.bx.get_bottom())
        signalMode == 'Engulfing' => (math.max(high,high[1]) > bxln.bx.get_bottom()) and gc[1] and (open >= close[1]) and (close < open[1])
        signalMode == 'Wick' => (high > bxln.bx.get_bottom()) and (c_top < bxln.bx.get_bottom())
        
    if down_signal
        label.new(bar_index, bxln.bx.get_top(),
          style = label.style_label_down, 
          text = "▼",
          color = invis, 
          textcolor = color.new(bearColor,0), 
          size = labSize)

    if bxlen < xTendNum  or (xot and high > bxln.bx.get_bottom())
        bxln.bx.set_right(bar_index)
        bxln.ln.set_x2(bar_index)

    if c_top > bxln.bx.get_top()
        if bxlen < mzHide
            bxln.bx.delete()
            bxln.ln.delete()
        down_ary.remove(i)

//---------------------------------------------------------------------------------------------------------------------}