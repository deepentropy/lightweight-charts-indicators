// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
  
//@version=5
indicator("Liquidity Pools [LuxAlgo]", shorttitle = "LuxAlgo - Liquidity Pools", overlay = true, max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500)

//---------------------------------------------------------------------------------------------------------------------}
//Inputs
//---------------------------------------------------------------------------------------------------------------------{

cNum = input.int(2, minval = 2, title = "Zone Contact Amount", group = "Liquidity Identification", tooltip = "The number of times price must bounce from this zone before considering it as a liquidity pool.  \n\nHigher == Less Zones that are 'More Precise'\nLower == More Zones that are 'Less precise'")
gapCount = input.int(5, minval = 0, title = "Bars Required Between Each Contact", group = "Liquidity Identification", tooltip = "The number of bars to wait before checking for another zone contact.")
wait = input.int(10, title = "Confirmation Bars", tooltip = "Used to Confirm Zones for Validity. \n Waits [X] Bars before drawing Zone.", group = "Liquidity Identification")

volTog = input.bool(true, title = "Display Volume Labels")
volSize = str.lower(input.string("Small", title = "Volume Label Size", options = ["Tiny","Small","Normal","Large","Huge"]))

bullColor = input.color(color.new(#089981,80), title = "Bull Zone Color  ", group = "Style") 
bearColor = input.color(color.new(#f23645,80), title = "Bear Zone Color", group = "Style")
canTog = input.bool(false, title = "Fill Candles Inside Zones", group = "Style", tooltip = "Fills Candles that are inside the last liquidity zone.\n\nNOTE: The candles will only be filled AFTER the Zone is generated. Candles fills will not overlap the zone it is referencing.")
bullCanColor = input.color(#089981, title = "Bull Candle Fill  ", group = "Style") 
bearCanColor = input.color(#f23645, title = "Bear Candle Fill", group = "Style")

invis = color.rgb(0,0,0,100)

//---------------------------------------------------------------------------------------------------------------------}
//UDTs (User-Defined Types)
//---------------------------------------------------------------------------------------------------------------------{

type data
    float h
    float t
    float b
    float l
    int bi

type zn
    box bx
    int state
    line ln
    float vol
    label lab

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{

//Candle (Body) Top/Bottom
c_top = math.max(open,close)
c_bot = math.min(open,close)

//Current Candle Data
cur = data.new(high,c_top,c_bot,low,bar_index)

//Highest and Lowest Candle Data
var data hst = data.new(high,c_top,c_bot,low,bar_index)
var data lst = data.new(high,c_top,c_bot,low,bar_index)

//High/Low Contact Counts
var int h_count = 0
var int l_count = 0
 
//Last Wick Bar Indexes
var int last_h_wick = bar_index
var int last_l_wick = bar_index

//Historical Zone Array (Un-Mitigated)
var bull_zones = array.new<zn>(na)
var bear_zones = array.new<zn>(na)

//Running Zones
var zn h_zn = zn.new(na,na,na,na,na)
var zn l_zn = zn.new(na,na,na,na,na)

//Plot Candle Fill Points
float g_o = na
float g_h = na
float g_l = na
float g_c = na

float r_o = na
float r_h = na
float r_l = na
float r_c = na

//Running Volume Totals
var float hi_vol = 0
var float lo_vol = 0
//---------------------------------------------------------------------------------------------------------------------}
//Functions
//---------------------------------------------------------------------------------------------------------------------{

//Get Candle Fill Points
get_cfp(_bx) =>
    top = _bx.get_top()
    bot = _bx.get_bottom()
    _o = c_top < bot ? bot : c_top > top ? top : c_top
    _h = high < bot ? bot : high > top ? top : high
    _l = low < bot ? bot : low > top ? top : low
    _c = c_bot < bot ? bot : c_bot > top ? top : c_bot
    [_o,_h,_l,_c]

//Get Candle Inside Volume
get_civ(_bx) =>
    top = _bx.get_top()
    bot = _bx.get_bottom()
    _r = high - low
    _h = high > top ? top : high
    _l = low < bot ? bot : low
    _vol = nz((_h - _l) / _r, 1) * volume
    _vol

//---------------------------------------------------------------------------------------------------------------------}
//Calculations
//---------------------------------------------------------------------------------------------------------------------{

//Adjusting High and Low Check Boundaries
if (high > hst.h) and ((c_top > hst.h) or (c_top < hst.t))
    if h_count > 1
        lst := cur
        lo_vol := 0
        l_count := 0
    hst := cur
    hi_vol := 0
    h_count := 1
    last_h_wick := bar_index

if (low < lst.l) and ((c_bot < lst.l) or (c_bot > lst.b))
    if l_count > 1
        hst := cur
        hi_vol := 0
        h_count := 0
    lst := cur
    lo_vol := 0
    l_count := 1
    last_l_wick := bar_index

//Counting Contacts
var int bs_hw = 0
var int bs_lw = 0

h_wick = high > hst.t and c_top <= hst.t
l_wick = low < lst.b and c_bot >= lst.b

if (h_wick[1] and (hst.t[1] == hst.t[2]) and (bs_hw > gapCount))
    h_count += 1
    last_h_wick := bar_index[1]

if (l_wick[1] and (lst.b[1] == lst.b[2]) and (bs_lw > gapCount))
    l_count += 1
    last_l_wick := bar_index[1]

bs_hw := math.abs(last_h_wick - bar_index)
bs_lw := math.abs(last_l_wick - bar_index)

//High/Low Tracking for Zone Outer Extremes
if (high > hst.h)
    hst.h := high
if (low < lst.l)
    lst.l := low

//---------------------------------------------------------------------------------------------------------------------}
//Volume Tracking
//---------------------------------------------------------------------------------------------------------------------{
hst_vol = (math.max((high - hst.t),0) / (high-low)) * volume
lst_vol = (math.max((lst.b - low),0)/ (high-low)) * volume

hi_vol += nz(hst_vol)
lo_vol += nz(lst_vol)

//---------------------------------------------------------------------------------------------------------------------}
//Zone Management (Creation & Merging)
//---------------------------------------------------------------------------------------------------------------------{

if (h_count >= cNum) and ta.crossover(bs_hw,wait) and (close < hst.t)

    top = h_zn.bx.get_top()
    bot = h_zn.bx.get_bottom()

    if hst.bi == h_zn.bx.get_left()
        h_zn.bx.set_top(math.max(hst.h,top))
        h_zn.bx.set_bottom(math.min(hst.t,top))

    else if (hst.h <= top) and (hst.t >= top)
        h_zn.bx.set_right(bar_index)
        h_zn.vol += hi_vol
        bear_zones.push(h_zn)

    else if ((hst.h > top) and (hst.t < top)) or ((hst.h > top) and (hst.t < top)) or ((hst.h > top) and (hst.t < top))
        h_zn.bx.set_top(math.max(hst.t,top))
        h_zn.bx.set_bottom(math.min(hst.h,top))
        h_zn.bx.set_right(bar_index)
        h_zn.vol += hi_vol
        bear_zones.push(h_zn)

    else
        h_zn := zn.new(box.new(hst.bi, hst.h, bar_index, hst.t, bgcolor = bearColor, border_color = na),
          0, 
          line.new(hst.bi, hst.t, bar_index, na, color = color.new(bearColor,0)),
          hi_vol, 
          label.new(bar_index,na, color = invis, text = str.tostring(hi_vol,format.volume) + "\n", textcolor = color.new(bearColor,0), style = label.style_label_right, size = volSize,  textalign = text.align_right))
        
        bear_zones.push(h_zn)

if (l_count >= cNum) and ta.crossover(bs_lw,wait) and (close > lst.b)
    
    top = l_zn.bx.get_top()
    bot = l_zn.bx.get_bottom()

    if lst.bi == l_zn.bx.get_left()
        l_zn.bx.set_top(math.max(lst.b,top))
        l_zn.bx.set_bottom(math.min(lst.l,bot))

    else if (lst.b <= top) and (lst.l >= bot)
        l_zn.bx.set_right(bar_index)
        l_zn.vol += lo_vol
        bull_zones.push(l_zn)

    else if ((lst.b > top) and (lst.l < top)) or ((lst.b > bot) and (lst.l < bot)) or ((lst.b > top) and (lst.l < bot))
        l_zn.bx.set_top(math.max(lst.b,top))
        l_zn.bx.set_bottom(math.min(lst.l,bot))
        l_zn.bx.set_right(bar_index)
        l_zn.vol += lo_vol
        bull_zones.push(l_zn)

    else
        l_zn := zn.new(box.new(lst.bi, lst.b, bar_index, lst.l, bgcolor = bullColor, border_color = na),
          0, 
          line.new(lst.bi, lst.b, bar_index, na, color = color.new(bullColor,0)),
          lo_vol, 
          label.new(bar_index,na, color = invis, text = "\n" + str.tostring(lo_vol,format.volume), textcolor = color.new(bullColor,0), style = label.style_label_right, size = volSize, textalign = text.align_right))
        
        bull_zones.push(l_zn)

//---------------------------------------------------------------------------------------------------------------------}
//Zone Management (Extention & Deletion)
//---------------------------------------------------------------------------------------------------------------------{

//Bull Zones
if bull_zones.size() > 0
    for i = bull_zones.size()-1 to 0
    //Values    
        z = bull_zones.get(i)
        bot = z.bx.get_bottom()
        top = z.bx.get_top()
    //Zone Management
        if (i == bull_zones.size()-1)
        //Line Extentions
            if (close > top)
                z.ln.set_y1(top)
                z.ln.set_xy2(bar_index,top)
                if volTog
                    z.lab.set_xy(bar_index,top)
        //Determining Candle Fill Points
            if ((high < top and high > bot) or (low < top and low > bot) or (high >= top and low <= bot))
                z.vol += get_civ(z.bx)
                if (z.bx.get_left() == l_zn.bx.get_left())
                    [_o,_h,_l,_c] = get_cfp(l_zn.bx)
                    g_o := _o
                    g_h := _h
                    g_l := _l
                    g_c := _c
            z.lab.set_text("\n" + str.tostring(z.vol,format.volume))
    //Hiding Lines        
        else if (l_zn.bx.get_bottom() > bot)
            z.ln.set_y2(na)
            z.lab.set_y(na)
    //Zone Deletion 
        if (close < bot)
            if (z.state < 0)
                bull_zones.remove(i)
            z.state -= 1
        else
            z.state := 0

//Bear Zones
if bear_zones.size() > 0
    for i = bear_zones.size()-1 to 0
    //Values
        z = bear_zones.get(i)
        bot = z.bx.get_bottom()
        top = z.bx.get_top()       
    //Zone Management
        if (i == bear_zones.size()-1)
        //Line Extentions
            if (close < bot)
                z.ln.set_y1(bot)
                z.ln.set_xy2(bar_index,bot)
                if volTog
                    z.lab.set_xy(bar_index,bot)
        //Determining Candle Fill Points
            if ((high < top and high > bot) or (low < top and low > bot) or (high >= top and low <= bot))
                z.vol += get_civ(z.bx)
                if (h_zn.bx.get_left() == z.bx.get_left()) 
                    [_o,_h,_l,_c] = get_cfp(h_zn.bx)
                    r_o := _o
                    r_h := _h
                    r_l := _l
                    r_c := _c
            z.lab.set_text(str.tostring(z.vol,format.volume) + "\n")
    //Hiding Lines
        else if (h_zn.bx.get_top() < bot)
            z.ln.set_y2(na)
            z.lab.set_y(na)

    //Zone Deletion 
        if (close > top)
            if (z.state < 0)
                bear_zones.remove(i)
            z.state -= 1
        else
            z.state := 0

//---------------------------------------------------------------------------------------------------------------------}
//Colored Candles
//---------------------------------------------------------------------------------------------------------------------{

plotcandle((canTog?g_o:na),g_h,g_l,g_c, 
  wickcolor = bullCanColor, 
  color = bullCanColor, 
  bordercolor = (g_o == g_c ? invis : bullCanColor), 
  display = display.pane, 
  editable = false)

plotcandle((canTog?r_o:na),r_h,r_l,r_c, 
  wickcolor = bearCanColor, 
  color = bearCanColor, 
  bordercolor = (r_o == r_c ? invis : bearCanColor), 
  display = display.pane, 
  editable = false)

//---------------------------------------------------------------------------------------------------------------------}