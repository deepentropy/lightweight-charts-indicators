// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Fair Value Gap [LuxAlgo]", "LuxAlgo - Fair Value Gap", overlay = true, max_lines_count = 500, max_boxes_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
thresholdPer = input.float(0, "Threshold %", minval = 0, maxval = 100, step = .1, inline = 'threshold')
auto = input(false, "Auto", inline = 'threshold')

showLast = input.int(0, 'Unmitigated Levels', minval = 0)
mitigationLevels = input.bool(false, 'Mitigation Levels')

tf = input.timeframe('', "Timeframe")

//Style
extend = input.int(20, 'Extend', minval = 0, inline = 'extend', group = 'Style')
dynamic = input(false, 'Dynamic', inline = 'extend', group = 'Style')

bullCss = input.color(color.new(#089981, 70), "Bullish FVG", group = 'Style')
bearCss = input.color(color.new(#f23645, 70), "Bearish FVG", group = 'Style')

//Dashboard
showDash  = input(false, 'Show Dashboard', group = 'Dashboard')
dashLoc  = input.string('Top Right', 'Location', options = ['Top Right', 'Bottom Right', 'Bottom Left'], group = 'Dashboard')
textSize = input.string('Small', 'Size'        , options = ['Tiny', 'Small', 'Normal']                 , group = 'Dashboard')

//-----------------------------------------------------------------------------}
//UDT's
//-----------------------------------------------------------------------------{
type fvg
    float max
    float min
    bool  isbull
    int   t = time

//-----------------------------------------------------------------------------}
//Methods/Functions
//-----------------------------------------------------------------------------{
n = bar_index

method tosolid(color id)=> color.rgb(color.r(id),color.g(id),color.b(id))

detect()=>
    var new_fvg = fvg.new(na, na, na, na)
    threshold = auto ? ta.cum((high - low) / low) / bar_index : thresholdPer / 100

    bull_fvg = low > high[2] and close[1] > high[2] and (low - high[2]) / high[2] > threshold
    bear_fvg = high < low[2] and close[1] < low[2] and (low[2] - high) / high > threshold
    
    if bull_fvg
        new_fvg := fvg.new(low, high[2], true)
    else if bear_fvg
        new_fvg := fvg.new(low[2], high, false)

    [bull_fvg, bear_fvg, new_fvg]

//-----------------------------------------------------------------------------}
//FVG's detection/display
//-----------------------------------------------------------------------------{
var float max_bull_fvg = na, var float min_bull_fvg = na, var bull_count = 0, var bull_mitigated = 0
var float max_bear_fvg = na, var float min_bear_fvg = na, var bear_count = 0, var bear_mitigated = 0
var t = 0

var fvg_records = array.new<fvg>(0)
var fvg_areas = array.new<box>(0)

[bull_fvg, bear_fvg, new_fvg] = request.security(syminfo.tickerid, tf, detect())

//Bull FVG's
if bull_fvg and new_fvg.t != t
    if dynamic
        max_bull_fvg := new_fvg.max
        min_bull_fvg := new_fvg.min
    
    //Populate FVG array
    if not dynamic
        fvg_areas.unshift(box.new(n-2, new_fvg.max, n+extend, new_fvg.min, na, bgcolor = bullCss))
    fvg_records.unshift(new_fvg)

    bull_count += 1
    t := new_fvg.t
else if dynamic
    max_bull_fvg := math.max(math.min(close, max_bull_fvg), min_bull_fvg)

//Bear FVG's
if bear_fvg and new_fvg.t != t
    if dynamic
        max_bear_fvg := new_fvg.max
        min_bear_fvg := new_fvg.min
    
    //Populate FVG array
    if not dynamic
        fvg_areas.unshift(box.new(n-2, new_fvg.max, n+extend, new_fvg.min, na, bgcolor = bearCss))
    fvg_records.unshift(new_fvg)

    bear_count += 1
    t := new_fvg.t
else if dynamic
    min_bear_fvg := math.min(math.max(close, min_bear_fvg), max_bear_fvg) 

//-----------------------------------------------------------------------------}
//Unmitigated/Mitigated lines
//-----------------------------------------------------------------------------{
//Test for mitigation
if fvg_records.size() > 0
    for i = fvg_records.size()-1 to 0
        get = fvg_records.get(i)

        if get.isbull
            if close < get.min
                //Display line if mitigated
                if mitigationLevels
                    line.new(get.t
                      , get.min
                      , time
                      , get.min
                      , xloc.bar_time
                      , color = bullCss
                      , style = line.style_dashed)

                //Delete box
                if not dynamic
                    area = fvg_areas.remove(i)
                    area.delete()

                fvg_records.remove(i)
                bull_mitigated += 1
        else if close > get.max
            //Display line if mitigated
            if mitigationLevels
                line.new(get.t
                  , get.max
                  , time
                  , get.max
                  , xloc.bar_time
                  , color = bearCss
                  , style = line.style_dashed)

            //Delete box
            if not dynamic
                area = fvg_areas.remove(i)
                area.delete()
            
            fvg_records.remove(i)
            bear_mitigated += 1

//Unmitigated lines
var unmitigated = array.new<line>(0)

//Remove umitigated lines 
if barstate.islast and showLast > 0 and fvg_records.size() > 0
    if unmitigated.size() > 0 
        for element in unmitigated
            element.delete()
        unmitigated.clear()

    for i = 0 to math.min(showLast-1, fvg_records.size()-1)
        get = fvg_records.get(i)

        unmitigated.push(line.new(get.t
          , get.isbull ? get.min : get.max 
          , time
          , get.isbull ? get.min : get.max
          , xloc.bar_time
          , color = get.isbull ? bullCss : bearCss))

//-----------------------------------------------------------------------------}
//Dashboard
//-----------------------------------------------------------------------------{
var table_position = dashLoc == 'Bottom Left' ? position.bottom_left 
  : dashLoc == 'Top Right' ? position.top_right 
  : position.bottom_right

var table_size = textSize == 'Tiny' ? size.tiny 
  : textSize == 'Small' ? size.small 
  : size.normal

var tb = table.new(table_position, 3, 3
  , bgcolor = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color = #373a46
  , frame_width = 1)

if showDash
    if barstate.isfirst
        tb.cell(1, 0, 'Bullish', text_color = bullCss.tosolid(), text_size = table_size)
        tb.cell(2, 0, 'Bearish', text_color = bearCss.tosolid(), text_size = table_size)
    
        tb.cell(0, 1, 'Count', text_size = table_size, text_color = color.white)
        tb.cell(0, 2, 'Mitigated', text_size = table_size, text_color = color.white)
    
    if barstate.islast
        tb.cell(1, 1, str.tostring(bull_count), text_color = bullCss.tosolid(), text_size = table_size)
        tb.cell(2, 1, str.tostring(bear_count), text_color = bearCss.tosolid(), text_size = table_size)
        
        tb.cell(1, 2, str.tostring(bull_mitigated / bull_count * 100, format.percent), text_color = bullCss.tosolid(), text_size = table_size)
        tb.cell(2, 2, str.tostring(bear_mitigated / bear_count * 100, format.percent), text_color = bearCss.tosolid(), text_size = table_size)

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
//Dynamic Bull FVG
max_bull_plot = plot(max_bull_fvg, color = na)
min_bull_plot = plot(min_bull_fvg, color = na)
fill(max_bull_plot, min_bull_plot, color = bullCss)

//Dynamic Bear FVG
max_bear_plot = plot(max_bear_fvg, color = na)
min_bear_plot = plot(min_bear_fvg, color = na)
fill(max_bear_plot, min_bear_plot, color = bearCss)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
alertcondition(bull_count > bull_count[1], 'Bullish FVG', 'Bullish FVG detected')
alertcondition(bear_count > bear_count[1], 'Bearish FVG', 'Bearish FVG detected')

alertcondition(bull_mitigated > bull_mitigated[1], 'Bullish FVG Mitigation', 'Bullish FVG mitigated')
alertcondition(bear_mitigated > bear_mitigated[1], 'Bearish FVG Mitigation', 'Bearish FVG mitigated')

//-----------------------------------------------------------------------------}