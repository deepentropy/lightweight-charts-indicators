// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator(    'Swing Breakouts Tests & Retests [LuxAlgo]', shorttitle='LuxAlgo - Swing Breakouts Tests & Retests', max_labels_count=500, max_boxes_count=500, overlay=true)
//---------------------------------------------------------------------------------------------------------------------}
// Settings
//---------------------------------------------------------------------------------------------------------------------{
display     = input.string('Bullish AND Bearish',   'Display'  , options=['Bullish OR Bearish', 'Bullish AND Bearish', 'Bearish', 'Bullish'])
mult        = input.float (1   , 'Width'                       , step   =0.1                                                                        )
maxBars     = input.int   (500 , 'Maximum Bars'                , tooltip=                  'Maximum bars without signal'                                    )
showReTest  = input.string('All', 'Display Test/Retest Labels' , options=                                                    ['All', 'Last']                        )
minBars     = input.int   (0   , 'Minimum Bars'                , minval =0, tooltip= 'Minimum required amount of bars between each labels')
setBack     = input.bool  (true, 'Set Back To Last Retest'     , tooltip='When the right side of the area is too far, stop updating and set back to position of last test/retest')
left        = input.int   (10  , 'Left'                        , minval =1, group='Swings'), right = input.int   (1, 'Right'    , minval =1       , group ='Swings' )
//Style
bull1_color = input.color (#08998145,           'Bullish '   , inline =  'bull'  , group= 'Style'                                                       )
bull2_color = input.color (#f2364545,               ''       , inline =  'bull'  , group= 'Style'                                               )
bear1_color = input.color (#f2364545,           'Bearish'    , inline =  'bear'  , group= 'Style'                                       )
bear2_color = input.color (#08998145,               ''       , inline =  'bear'  , group= 'Style'                               )
labSize     = input.string(size.small ,          'Label Size'  , options=[size.tiny, size.small, size.normal, size.large]   )

//---------------------------------------------------------------------------------------------------------------------}
//UDT
//---------------------------------------------------------------------------------------------------------------------{

// @type  bin     object
// @field bx      box, breakout and retest
// @field state   holds the current state 
// @field price   holds highest/lowest price
// @field lab1    array of labels (re-test)
// @field lab2    array of labels (re-test)
type bin 
    box   bx 
    int    state
    float    price
    array<label>lab1
    array<label>lab2

//---------------------------------------------------------------------------------------------------------------------}
//Methods
//---------------------------------------------------------------------------------------------------------------------{
n = bar_index

// @function      Fetches the red, green and blue value from the input           
// @param         col color
// @returns       color.rgb() without transparancy
method colorRGB(color col) => 
    color.rgb(
       color.r(col)
     , color.g(col)
     , color.b(col)
     )

// @function      controls whether a label may be added to array    
// @param         aLab array (receiver)
// @returns       bool - true/false
method mayAdd(array<label>aLab) => aLab.size() == 0 or showReTest == 'Last' ? true : showReTest == 'All' and n - aLab.first().get_x() > minBars

// @function      Provides a label          
// @param         dir  bullish 'bull' or bearish 'bear'
// @param         state concerning state (1 or 2)
// @returns       label
method label(string dir, int state, float y) => 
    lab = label.new(n, y, color= color(na), size=labSize)
    switch dir 
        'bull' => 
            switch state 
                1 => lab.set_style(label.style_label_up  ), lab.set_text('▲'), lab.set_textcolor(bull1_color.colorRGB()) 
                2 => lab.set_style(label.style_label_down), lab.set_text('▽'), lab.set_textcolor(bull2_color.colorRGB()) 
        'bear' => 
            switch state 
                1 => lab.set_style(label.style_label_down), lab.set_text('▼'), lab.set_textcolor(bear1_color.colorRGB())
                2 => lab.set_style(label.style_label_up  ), lab.set_text('△'), lab.set_textcolor(bear2_color.colorRGB())
    lab

// @function      Adds label to array, pops 1 out if 'onlyLast'          
// @param         aLab array (receiver)
// @param         lab  lab to add 
// @returns       void or label 
method addLabel(array<label>aLab, label lab) => 
    aLab.unshift(lab)
    if showReTest == 'Last' 
     and aLab.size() > 1
        aLab.pop()

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{
var bull = bin.new(box(na), 0, na, array.new<label>(), array.new<label>())
var bear = bin.new(box(na), 0, na, array.new<label>(), array.new<label>())

//---------------------------------------------------------------------------------------------------------------------}
//Execution
//---------------------------------------------------------------------------------------------------------------------{
atr   = nz(ta.atr(200), ta.cum(high - low) / (n + 1)) * mult 

ph    = ta.pivothigh(left, right)
pl    = ta.pivotlow (left, right)

box_bull_left   = bull.bx.get_left  () 
box_bull_right  = bull.bx.get_right ()
box_bull_top    = bull.bx.get_top   () 
box_bull_bottom = bull.bx.get_bottom() 
box_bear_left   = bear.bx.get_left  () 
box_bear_right  = bear.bx.get_right ()
box_bear_top    = bear.bx.get_top   () 
box_bear_bottom = bear.bx.get_bottom() 

//Bullish 
if   display    == 'Bullish' 
 or  display    == 'Bullish AND Bearish' 
 or (display    == 'Bullish OR Bearish' 
 and bear.state == 0
   )
    switch 
        bull.state == 0 =>
            if not na(pl)
                bull.bx := box.new(n - right, pl + atr, n, pl, bgcolor=bull1_color, border_color=color(na))
                bull.state := 1   //Swing found; if condition is ok - state 0 -> 1 
                bull.lab1.clear() //chuck labels out of array without deleting
                bull.lab2.clear()
                bull.price := pl 

        bull.state == 1 => 
            if box_bull_right - box_bull_left >= maxBars //Right side is too far from start
                if bull.lab1.size() == 0 
                    bull.bx.delete()
                else 
                    if setBack
                        bull.bx.set_right(bull.lab1.first().get_x())
                bull.state := 0 //Reset
            else
                bull.bx.set_right(n)

                //Breakout; first box remains, switch to second box - state 1 -> 2
                if close < box_bull_bottom
                    bull.bx := box.new(n, box_bull_top, n, box_bull_bottom, bgcolor=bull2_color, border_color=color(na))
                    bull.state := 2 
                    bull.price := box_bull_top

                if close > box_bull_top and open < box_bull_top and bull.lab1.mayAdd()
                    bull.lab1.addLabel('bull'.label(1, bull.price)).delete()

        bull.state == 2 => 

            if box_bull_right - box_bull_left >= maxBars
                if bull.lab2.size() == 0 
                    bull.bx.delete()
                else 
                    if setBack
                        bull.bx.set_right(bull.lab2.first().get_x())
                bull.state := 0
            else
                bull.bx.set_right(n)
                if close > box_bull_top
                    bull.state := 0 //Reset

                if close < box_bull_bottom and open > box_bull_bottom and bull.lab2.mayAdd()
                    bull.lab2.addLabel('bull'.label(2, bull.price)).delete()

//Bearish
if   display    == 'Bearish' 
 or  display    == 'Bullish AND Bearish' 
 or (display    == 'Bullish OR Bearish' 
 and bull.state == 0
   )
    switch 
        bear.state == 0 =>
            if not na(ph)
                bear.bx := box.new(n - right, ph, n, ph - atr, bgcolor=bear1_color, border_color=color(na))
                bear.state := 1 
                bear.lab1.clear() //chuck labels out of array without deleting
                bear.lab2.clear()
                bear.price := ph 

        bear.state == 1 => 
            if box_bear_right - box_bear_left >= maxBars
                if bear.lab1.size() == 0 
                    bear.bx.delete()
                else 
                    if setBack
                        bear.bx.set_right(bear.lab1.first().get_x())
                bear.state := 0
            else
                bear.bx.set_right(n)

                if close > box_bear_top
                    bear.bx := box.new(n, box_bear_top, n, box_bear_bottom, bgcolor=bear2_color, border_color=color(na))
                    bear.state := 2 
                    bear.price := box_bear_bottom

                if close < box_bear_bottom and open > box_bear_bottom and bear.lab1.mayAdd()
                    bear.lab1.addLabel('bear'.label(1, bear.price)).delete()

        bear.state == 2 =>             
            
            if box_bear_right - box_bear_left >= maxBars
                if bear.lab2.size() == 0 
                    bear.bx.delete()
                else 
                    if setBack
                        bear.bx.set_right(bear.lab2.first().get_x())
                bear.state := 0
            else
                bear.bx.set_right(n)
                if close < box_bear_bottom
                    bear.state := 0 

                if close > box_bear_top and open < box_bear_top and bear.lab2.mayAdd()
                    bear.lab2.addLabel('bear'.label(2, bear.price)).delete()

//---------------------------------------------------------------------------------------------------------------------}